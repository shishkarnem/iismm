import type { Express, Request, Response } from 'express';
import { DB } from '../db';
import {
  getPgDB,
  savePgDB,
  fetchAllUsersFromPg,
  getBotDetailsFromPg
} from '../db/postgres';
import { getTelegramBotConfig } from '../telegram';
import {
  fetchTelegramBotApi,
  normalizeTelegramGatewayUrl,
  TELEGRAM_GATEWAY_PRESETS
} from '../telegram/apiEndpointFallback';
import {
  ensureUserTelegramAvatarInGallery,
  isFullGalleryDirectUrl,
  expandShortGalleryUrlToFull
} from '../channelAvatarService';

async function resolveActiveBotApiAndToken(): Promise<{
  apiBaseUrl: string;
  proxyType: string;
  botToken: string;
}> {
  try {
    const cfg = await getTelegramBotConfig();
    if (cfg?.botToken) {
      return {
        apiBaseUrl: normalizeTelegramGatewayUrl(cfg.apiBaseUrl),
        proxyType: cfg.proxyType || 'dialog_ai',
        botToken: cfg.botToken
      };
    }
  } catch {}

  const botDetails = getBotDetailsFromPg();
  const fallbackToken =
    (botDetails && botDetails.bot_token) ||
    DB.getSettings()?.telegramBotToken ||
    '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
  return {
    apiBaseUrl: TELEGRAM_GATEWAY_PRESETS.dialog_ai,
    proxyType: 'dialog_ai',
    botToken: fallbackToken
  };
}

function computeUsersStatsFromRows(rows: any[]) {
  const total = rows.length;
  let withTelegramCount = 0;
  let active = 0;
  let blocked = 0;
  let deleted = 0;
  let admins = 0;
  let fullGalleryPhotos = 0;

  for (const r of rows) {
    const tgNum = Number(r.telegram_id || 0);
    if (tgNum > 0) withTelegramCount += 1;
    if (r.status === 'Активный') active += 1;
    else if (r.status === 'Блок') blocked += 1;
    else if (r.status === 'Удален') deleted += 1;
    if (r.role === 'admin') admins += 1;
    const pUrl = String(r.photo_url || r.user_avatar || '');
    if (isFullGalleryDirectUrl(pUrl)) fullGalleryPhotos += 1;
  }

  return {
    total,
    withTelegramCount,
    active,
    blocked,
    deleted,
    admins: Math.max(1, admins),
    fullGalleryPhotos
  };
}

export function registerTelegramUsersBatchRoutes(app: Express) {
  /**
   * 1. Инициализация каскадного обновления пользователей Telegram
   */
  app.get('/api/admin/tg-users-sync/init', async (_req: Request, res: Response) => {
    try {
      await getPgDB();
      const rows = fetchAllUsersFromPg();
      const stats = computeUsersStatsFromRows(rows);
      res.json({
        success: true,
        totalUsers: rows.length,
        withTelegramCount: stats.withTelegramCount,
        recommendedBatchSize: 8,
        stats
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Не удалось получить список пользователей для проверки'
      });
    }
  });

  /**
   * 2. Пакетная каскадная проверка пользователей Telegram (по 8 записей за шаг)
   * Проверяет статус диалога, обновляет имя/username/описание и загружает полные фото в галерею
   */
  app.post('/api/admin/tg-users-sync/batch', async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      const allRows = fetchAllUsersFromPg();
      const totalUsers = allRows.length;

      const offset = Math.max(0, parseInt(String(req.body?.offset ?? 0), 10) || 0);
      const batchSize = Math.min(
        15,
        Math.max(1, parseInt(String(req.body?.batchSize ?? 8), 10) || 8)
      );
      const syncPhotos = req.body?.syncPhotos !== false;

      if (offset >= totalUsers) {
        const finalStats = computeUsersStatsFromRows(allRows);
        res.json({
          success: true,
          processedInBatch: 0,
          nextOffset: totalUsers,
          hasMore: false,
          totalUsers,
          percent: 100,
          stats: finalStats,
          batchLogs: []
        });
        return;
      }

      const slice = allRows.slice(offset, offset + batchSize);
      const { apiBaseUrl, proxyType, botToken } = await resolveActiveBotApiAndToken();

      const batchResults = await Promise.all(
        slice.map(async (row: any) => {
          const userId = String(row.id || '');
          const tgNum = Number(row.telegram_id || 0);
          const displayLabel =
            row.username || row.first_name || row.email || `Пользователь ${userId}`;

          if (!tgNum || tgNum <= 0) {
            // Email-only account without Telegram ID: normalize shortened avatar if present
            const currentPhoto = expandShortGalleryUrlToFull(
              db,
              String(row.photo_url || row.user_avatar || '')
            );
            if (currentPhoto && currentPhoto !== row.photo_url) {
              try {
                db.run('UPDATE users SET photo_url = ?, user_avatar = ? WHERE id = ?', [
                  currentPhoto,
                  currentPhoto,
                  userId
                ]);
              } catch {}
            }
            return {
              userId,
              telegramId: null,
              label: displayLabel,
              status: String(row.status || 'Активный'),
              photoUpdated: false,
              note: 'Аккаунт по почте (без Telegram)'
            };
          }

          let nextStatus: 'Активный' | 'Блок' | 'Удален' = 'Удален';
          let parsedFirst = String(row.first_name || '');
          let parsedLast = String(row.last_name || '');
          let parsedUsername = String(row.username || '');
          let parsedBio = String(row.bio || '');

          // 1) Check typing action for real delivery reachability
          try {
            const actData = await fetchTelegramBotApi({
              primaryBase: apiBaseUrl,
              proxyType,
              token: botToken,
              endpoint: `sendChatAction?chat_id=${tgNum}&action=typing`,
              timeoutMs: 7000
            });
            if (actData?.ok) {
              nextStatus = 'Активный';
            } else {
              const desc = String(actData?.description || '').toLowerCase();
              if (desc.includes('blocked') || desc.includes('forbidden') || desc.includes('deactivated')) {
                nextStatus = desc.includes('deactivated') ? 'Удален' : 'Блок';
              } else {
                nextStatus = 'Удален';
              }
            }
          } catch {
            // Network hiccup — preserve existing status if known, otherwise check getChat
            if (row.status === 'Активный' || row.status === 'Блок') {
              nextStatus = row.status;
            }
          }

          // 2) Fetch fresh profile metadata from getChat
          try {
            const chatData = await fetchTelegramBotApi({
              primaryBase: apiBaseUrl,
              proxyType,
              token: botToken,
              endpoint: `getChat?chat_id=${tgNum}`,
              timeoutMs: 7000
            });
            if (chatData?.ok && chatData.result) {
              const ch = chatData.result;
              if (ch.first_name) parsedFirst = String(ch.first_name).trim();
              if (ch.last_name !== undefined) parsedLast = String(ch.last_name || '').trim();
              if (ch.username) {
                const cleanU = String(ch.username).replace(/^@/, '').trim();
                parsedUsername = `@${cleanU}`;
              }
              if (ch.bio) parsedBio = String(ch.bio).trim();
            }
          } catch {}

          // 3) Ensure full direct gallery avatar URL (upload missing or expand shortened)
          let currentPhoto = expandShortGalleryUrlToFull(
            db,
            String(row.photo_url || row.user_avatar || '')
          );
          let photoUpdated = false;

          if (syncPhotos && !isFullGalleryDirectUrl(currentPhoto)) {
            try {
              const uploadedFull = await ensureUserTelegramAvatarInGallery(
                tgNum,
                userId,
                currentPhoto || undefined,
                true
              );
              if (uploadedFull && isFullGalleryDirectUrl(uploadedFull)) {
                currentPhoto = uploadedFull;
                photoUpdated = true;
              }
            } catch {}
          }

          try {
            db.run(
              `UPDATE users
               SET status = ?,
                   first_name = ?,
                   last_name = ?,
                   username = ?,
                   bio = ?,
                   photo_url = CASE WHEN ? != '' THEN ? ELSE photo_url END,
                   user_avatar = CASE WHEN ? != '' THEN ? ELSE user_avatar END
               WHERE id = ? OR telegram_id = ?`,
              [
                nextStatus,
                parsedFirst,
                parsedLast,
                parsedUsername,
                parsedBio,
                currentPhoto,
                currentPhoto,
                currentPhoto,
                currentPhoto,
                userId,
                tgNum
              ]
            );
          } catch {}

          try {
            DB.updateUser(userId, {
              firstName: parsedFirst,
              lastName: parsedLast,
              username: parsedUsername,
              ...(currentPhoto ? { photoUrl: currentPhoto, userAvatar: currentPhoto } : {})
            });
          } catch {}

          return {
            userId,
            telegramId: tgNum,
            label: parsedUsername || parsedFirst || displayLabel,
            status: nextStatus,
            photoUpdated,
            note: photoUpdated
              ? `${nextStatus} • фото загружено в галерею`
              : nextStatus
          };
        })
      );

      savePgDB();

      const nextOffset = Math.min(totalUsers, offset + slice.length);
      const hasMore = nextOffset < totalUsers;
      const percent = totalUsers > 0 ? Math.min(100, Math.round((nextOffset / totalUsers) * 100)) : 100;

      const updatedRows = fetchAllUsersFromPg();
      const stats = computeUsersStatsFromRows(updatedRows);

      res.json({
        success: true,
        processedInBatch: slice.length,
        nextOffset,
        hasMore,
        totalUsers,
        percent,
        stats,
        batchLogs: batchResults
      });
    } catch (err: any) {
      console.error('[tg-users-sync/batch] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Ошибка при пакетном обновлении пользователей Telegram'
      });
    }
  });
}
