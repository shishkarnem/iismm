import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { DB } from '../db';
import { callProTalkBotApi } from '../protalk';
import { getBotTokenFromPg } from '../db/postgres';
import { getDatabase, saveDatabaseToDisk } from '../db/index';
import { addTransactionWithBalanceUpdate } from '../db/transactionsTable';
import { format11DigitUserId } from '../db/usersTable';
import {
  expandShortGalleryUrlToFull,
  ensureChannelAvatarInGallery,
  isFullGalleryDirectUrl
} from '../channelAvatarService';
import { getPricingConfig } from '../pricing/pricingService';
import { formatIirkyCount } from '../../shared/pricingConfig';
import { getTelegramBotConfig } from '../telegram';
import { fetchTelegramBotApi } from '../telegram/apiEndpointFallback';

const DEFAULT_CHANNEL_DESCRIPTION_PROMPT = `Ты опытный редактор Telegram-каналов.
Напиши живое, понятное и привлекательное описание для Telegram-канала (поле "О канале" в профиле).
Требования:
- Длина строго до 220 символов (лимит Telegram 255 символов).
- Без кавычек вокруг ответа, без вступлений и пояснений — верни только готовый текст описания.
- Добавь 1-2 уместных аккуратных эмодзи, отрази пользу канала для читателя и мягкий призыв оставаться на связи.`;

function normalizeNoCapsText(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/^[#"«»"'\s]+|[#"«»"'\s]+$/g, '')
    .trim();
}

async function ensureChannelBrandingTable() {
  const db = await getDatabase();
  db.run(`
    CREATE TABLE IF NOT EXISTS channel_branding_settings (
      id TEXT PRIMARY KEY,
      description_prompt TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const check = db.exec("SELECT id, description_prompt FROM channel_branding_settings WHERE id = 'default' LIMIT 1");
  if (!check[0] || !check[0].values || check[0].values.length === 0) {
    db.run(
      `INSERT INTO channel_branding_settings (id, description_prompt, updated_at) VALUES ('default', ?, ?)`,
      [DEFAULT_CHANNEL_DESCRIPTION_PROMPT, new Date().toISOString()]
    );
    saveDatabaseToDisk();
  }
  return db;
}

async function resolveImageBufferForTelegram(photoUrl: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const clean = String(photoUrl || '').trim();
  if (!clean) return null;

  if (clean.startsWith('/')) {
    const rel = clean.replace(/^\/+/, '');
    const candidates = [
      path.join(process.cwd(), 'public', rel),
      path.join(process.cwd(), 'dist', rel)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          buffer: fs.readFileSync(candidate),
          filename: path.basename(candidate) || 'avatar.png'
        };
      }
    }
  }

  if (/^https?:\/\//i.test(clean)) {
    const resp = await fetch(clean, { signal: AbortSignal.timeout(12000) });
    if (resp.ok) {
      const arr = await resp.arrayBuffer();
      return {
        buffer: Buffer.from(arr),
        filename: 'channel_avatar.png'
      };
    }
  }

  return null;
}

export function registerChannelBrandingRoutes(app: Express): void {
  ensureChannelBrandingTable().catch((err) => {
    console.warn('[ChannelBranding] Failed to init PostgreSQL table:', err?.message);
  });

  // Generate Telegram channel description for 1 Iirka
  app.post('/api/channels/generate-description', async (req: Request, res: Response) => {
    try {
      const rawUserId = String(req.body?.userId || req.headers['x-user-id'] || '16926299042').trim();
      const channelName = String(req.body?.channelName || 'Мой канал').trim();
      const channelUsername = String(req.body?.channelUsername || '').trim();
      const topicHint = String(req.body?.topicHint || '').trim();
      const currentDescription = String(req.body?.currentDescription || '').trim();

      const db = await ensureChannelBrandingTable();
      const pricing = await getPricingConfig(db);
      const descCost = pricing.textAi.channelDescription;
      const cleanId = format11DigitUserId(rawUserId);
      const tgNum = parseInt(rawUserId, 10) || 0;

      const userStmt = db.prepare(
        'SELECT id, balance FROM users WHERE id = ? OR telegram_id = ? LIMIT 1'
      );
      userStmt.bind([cleanId, tgNum]);
      let userRow: any = null;
      if (userStmt.step()) {
        userRow = userStmt.getAsObject();
      }
      userStmt.free();

      const legacyUser = DB.getUserById(rawUserId) || DB.getUserById(cleanId);
      const canonicalId = userRow?.id ? String(userRow.id) : legacyUser?.id || cleanId;
      const currentBalance =
        userRow?.balance !== undefined && userRow?.balance !== null
          ? Number(userRow.balance)
          : Number(legacyUser?.balance ?? 300);

      if (descCost > 0 && currentBalance < descCost) {
        res.status(402).json({
          error: `Недостаточно Иирок на балансе. Для генерации описания канала требуется ${formatIirkyCount(descCost)}.`
        });
        return;
      }

      let basePrompt = DEFAULT_CHANNEL_DESCRIPTION_PROMPT;
      const promptRes = db.exec(
        "SELECT description_prompt FROM channel_branding_settings WHERE id = 'default' LIMIT 1"
      );
      if (promptRes[0]?.values?.[0]?.[0]) {
        basePrompt = String(promptRes[0].values[0][0]);
      }

      const fullPrompt = [
        basePrompt,
        `Название канала: ${channelName}`,
        channelUsername ? `Юзернейм канала: ${channelUsername}` : '',
        topicHint ? `Тематика и пожелания автора: ${topicHint}` : '',
        currentDescription ? `Текущий черновик описания (улучши и освежи): ${currentDescription}` : ''
      ]
        .filter(Boolean)
        .join('\n');

      let generated = '';
      try {
        const rawAi = await callProTalkBotApi(fullPrompt, undefined, undefined, `post${canonicalId}`);
        generated = normalizeNoCapsText(rawAi).slice(0, 240);
      } catch (aiErr: any) {
        console.warn('[ChannelBranding] ProTalk fallback used:', aiErr?.message);
      }

      if (!generated || generated.length < 12) {
        const focusText = topicHint || channelName;
        generated = normalizeNoCapsText(
          `✨ Авторский канал «${channelName}» — практические разборы, свежие идеи и полезные материалы по теме: ${focusText}. Подписывайтесь, чтобы ничего не пропустить!`
        ).slice(0, 240);
      }

      let updatedBalance = Math.max(0, currentBalance - descCost);
      if (userRow && descCost > 0) {
        const txRes = addTransactionWithBalanceUpdate(db, {
          userId: canonicalId,
          type: 'cost',
          amount: descCost,
          description: `Нейрогенерация описания канала «${channelName.slice(0, 40)}» (${formatIirkyCount(descCost)})`,
          comment: 'Оформление канала'
        });
        if (txRes?.newBalances?.balance !== undefined) {
          updatedBalance = Number(txRes.newBalances.balance);
        }
      }

      try {
        if (legacyUser && descCost > 0) {
          DB.updateUser(legacyUser.id, { balance: updatedBalance });
        }
      } catch {}

      saveDatabaseToDisk();

      res.json({
        success: true,
        description: generated,
        cost: descCost,
        balance: updatedBalance
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Не удалось сгенерировать описание канала'
      });
    }
  });

  // Save channel avatar + description + name in DB and optionally push to Telegram Bot API
  app.post('/api/channels/:id/apply-branding', async (req: Request, res: Response) => {
    try {
      const channelId = String(req.params.id || '').trim();
      const {
        name,
        username,
        description,
        photoUrl,
        inviteLink,
        subscribersCount,
        isActive,
        syncToTelegram = true,
        syncPhotoToTelegram = true
      } = req.body || {};

      const db = await getDatabase();
      const allChannels = DB.getChannels();
      let existing = allChannels.find((c) => c.id === channelId);

      if (!existing) {
        const q = db.exec('SELECT * FROM channels WHERE id = ? LIMIT 1', [channelId]);
        if (q[0]?.values?.[0]) {
          const cols = q[0].columns;
          const vals = q[0].values[0];
          const obj: any = {};
          cols.forEach((col, i) => {
            obj[col] = vals[i];
          });
          existing = {
            id: String(obj.id),
            userId: String(obj.user_id || ''),
            name: String(obj.name || ''),
            username: String(obj.username || ''),
            telegramId: obj.telegram_id ? String(obj.telegram_id) : undefined,
            photoUrl: obj.photo_url ? String(obj.photo_url) : undefined,
            description: obj.description ? String(obj.description) : undefined,
            inviteLink: obj.invite_link ? String(obj.invite_link) : undefined,
            subscribersCount: Number(obj.subscribers_count || 0),
            isActive: Boolean(obj.is_active ?? 1)
          };
        }
      }

      if (!existing) {
        res.status(404).json({ error: 'Канал не найден в базе данных' });
        return;
      }

      const nextName = name !== undefined ? String(name).trim() || existing.name : existing.name;
      let nextUsername =
        username !== undefined ? String(username).trim() || existing.username : existing.username;
      if (
        nextUsername &&
        !nextUsername.startsWith('@') &&
        !nextUsername.startsWith('-100') &&
        !/^-?\d+$/.test(nextUsername)
      ) {
        nextUsername = '@' + nextUsername;
      }
      const nextDescription =
        description !== undefined ? String(description).slice(0, 255) : existing.description || '';
      const rawCandidatePhoto =
        photoUrl !== undefined ? String(photoUrl).trim() : existing.photoUrl || '';
      let nextPhotoUrl = expandShortGalleryUrlToFull(db, rawCandidatePhoto) || rawCandidatePhoto;
      if (
        nextPhotoUrl &&
        !isFullGalleryDirectUrl(nextPhotoUrl) &&
        (nextPhotoUrl.includes('/channel-avatar/') || nextPhotoUrl.startsWith('http'))
      ) {
        const uploadedFull = await ensureChannelAvatarInGallery(
          nextUsername || existing.telegramId || existing.id,
          nextPhotoUrl.includes('/channel-avatar/') ? '' : nextPhotoUrl,
          existing.userId || 'admin'
        );
        if (uploadedFull) nextPhotoUrl = uploadedFull;
      }
      const nextInviteLink =
        inviteLink !== undefined ? String(inviteLink).trim() : existing.inviteLink || '';
      const nextSubscribers =
        subscribersCount !== undefined ? Number(subscribersCount) || 0 : existing.subscribersCount || 0;
      const nextIsActive = isActive !== undefined ? Boolean(isActive) : existing.isActive;

      let updatedChannel: any = {
        ...existing,
        name: nextName,
        username: nextUsername,
        description: nextDescription,
        photoUrl: nextPhotoUrl,
        inviteLink: nextInviteLink,
        subscribersCount: nextSubscribers,
        isActive: nextIsActive
      };

      try {
        updatedChannel = DB.updateChannel(channelId, {
          name: nextName,
          username: nextUsername,
          description: nextDescription,
          photoUrl: nextPhotoUrl,
          inviteLink: nextInviteLink,
          subscribersCount: nextSubscribers,
          isActive: nextIsActive
        });
      } catch {}

      try {
        db.run(
          `UPDATE channels
           SET name = ?, username = ?, description = ?, photo_url = ?, invite_link = ?, subscribers_count = ?, is_active = ?
           WHERE id = ?`,
          [
            nextName,
            nextUsername,
            nextDescription,
            nextPhotoUrl,
            nextInviteLink,
            nextSubscribers,
            nextIsActive ? 1 : 0,
            channelId
          ]
        );
      } catch {}

      saveDatabaseToDisk();

      const telegramSync: {
        attempted: boolean;
        descriptionSynced: boolean;
        photoSynced: boolean;
        notes: string[];
      } = {
        attempted: Boolean(syncToTelegram),
        descriptionSynced: false,
        photoSynced: false,
        notes: []
      };

      if (syncToTelegram) {
        const settings = DB.getSettings();
        const botToken =
          getBotTokenFromPg() ||
          settings.telegramBotToken ||
          '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

        const chatTarget = existing.telegramId || nextUsername;
        if (botToken && chatTarget) {
          const tgConfig = await getTelegramBotConfig().catch(() => null);

          // 1. Sync Description to Telegram (setChatDescription)
          if (description !== undefined) {
            try {
              const descJson = await fetchTelegramBotApi({
                primaryBase: tgConfig?.apiBaseUrl,
                proxyType: tgConfig?.proxyType,
                token: botToken,
                endpoint: 'setChatDescription',
                buildInit: () => ({
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatTarget,
                    description: nextDescription.slice(0, 255)
                  })
                }),
                timeoutMs: 9000
              });
              if (descJson?.ok) {
                telegramSync.descriptionSynced = true;
                telegramSync.notes.push('Описание канала обновлено в Telegram');
              } else if (descJson?.description) {
                telegramSync.notes.push(
                  'Описание сохранено в базе (для обновления в самом Telegram выдайте боту право «Изменение профиля канала»)'
                );
              }
            } catch {
              telegramSync.notes.push('Описание сохранено в базе данных');
            }
          }

          // 2. Sync Photo to Telegram (setChatPhoto) when photoUrl changed or requested
          if (
            syncPhotoToTelegram &&
            nextPhotoUrl &&
            !nextPhotoUrl.includes('/api/channel-avatar/')
          ) {
            try {
              const filePayload = await resolveImageBufferForTelegram(nextPhotoUrl);
              if (filePayload && filePayload.buffer.length > 0) {
                const form = new FormData();
                form.append('chat_id', String(chatTarget));
                form.append('photo', filePayload.buffer, {
                  filename: filePayload.filename,
                  contentType: 'image/png'
                });
                const formHeaders = form.getHeaders();
                const formBytes = new Uint8Array(form.getBuffer());
                const photoJson = await fetchTelegramBotApi({
                  primaryBase: tgConfig?.apiBaseUrl,
                  proxyType: tgConfig?.proxyType,
                  token: botToken,
                  endpoint: 'setChatPhoto',
                  buildInit: () => ({
                    method: 'POST',
                    headers: formHeaders as any,
                    body: formBytes
                  }),
                  timeoutMs: 15000
                });
                if (photoJson?.ok) {
                  telegramSync.photoSynced = true;
                  telegramSync.notes.push('Аватарка канала обновлена в Telegram');
                } else if (photoJson?.description) {
                  telegramSync.notes.push(
                    'Аватарка сохранена в сервисе (для смены фото в Telegram выдайте боту право «Изменение профиля канала»)'
                  );
                }
              }
            } catch {
              telegramSync.notes.push('Аватарка сохранена в базе данных сервиса');
            }
          }
        }
      }

      res.json({
        success: true,
        channel: updatedChannel,
        telegramSync
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Ошибка сохранения оформления канала'
      });
    }
  });
}
