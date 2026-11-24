import { DB, getDefaultChannelIdentifier } from './db';
import { sendPromptToTelegram, sendPrivateTelegramNotification, buildReplyMarkup } from './telegram';
import { sendRichTelegramMessage } from './telegramRich';
import { createNotificationInDb } from './db/notificationsTable';
import { formatMskDateTime } from './promoApi';
import { pgQuery, savePgDB } from './db/postgres';

import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import {
  acquireEntityPublishSlot,
  canonicalizeTelegramTarget,
  finalizePublishDedup
} from './telegram/publishDedupGuard';

// Re-entrancy mutex so overlapping 30s cron ticks never process promos simultaneously
let isPromoCronRunning = false;

// Deduplication cache for error alerts (avoids spamming the user multiple times on restarts / cron ticks)
const errorAlertCooldownMap = new Map<string, number>();

// Strict in-memory deduplication for 1-hour promo launch reminders (prevents any duplicate DM even if DB lag occurs)
const sentPromoReminderKeys = new Set<string>();

// Strict in-memory + atomic Cloud PG claim tracking for channel posts (status 2 = in-flight)
const inProgressPromoPublishKeys = new Set<string>();
const sentPromoPublishKeys = new Set<string>();

// Bounded retry state for failed channel deliveries (prevents premature post_published = 1 / archiving)
const promoRetryStateMap = new Map<string, { count: number; lastAttemptMs: number }>();
const PROMO_MAX_AUTO_RETRIES = 5;
const PROMO_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

function isAmbiguousNetworkTimeout(errMsg: string): boolean {
  return /timeout|timed out|abort|etimedout|econnreset|socket hang up|und_err_headers_timeout|und_err_body_timeout/i.test(errMsg || '');
}

async function claimPromoReminderInPg(
  table: 'promo_selections' | 'promo_folders',
  rowId: string
): Promise<boolean> {
  try {
    const pgRes = await pgQuery(
      `UPDATE ${table} SET reminder_sent = 1 WHERE id = $1 AND (reminder_sent IS NULL OR reminder_sent = 0) RETURNING id`,
      [rowId]
    );
    if (pgRes) {
      if ((pgRes.rowCount || 0) > 0) return true;
      const checkRes = await pgQuery(`SELECT reminder_sent FROM ${table} WHERE id = $1 LIMIT 1`, [rowId]);
      if (checkRes && checkRes.rows.length > 0 && Number(checkRes.rows[0].reminder_sent || 0) === 1) {
        return false;
      }
    }
  } catch (e) {
    console.warn('[PromoCron] PG reminder claim warning:', (e as any)?.message || e);
  }
  return true;
}

async function claimPromoDeliverySlot(params: {
  table: 'promo_selection_channels' | 'promo_folder_participants';
  column: 'post_published' | 'repeat_post_published';
  rowId: string;
  claimKey: string;
  persistentSlotKey?: string;
  entityType?: 'folder' | 'folder_repeat' | 'selection';
  entityId?: string;
  channelKey?: string;
  db: any;
}): Promise<{ claimed: boolean }> {
  const { table, column, rowId, claimKey, persistentSlotKey, entityType, entityId, channelKey, db } = params;

  if (sentPromoPublishKeys.has(claimKey) || inProgressPromoPublishKeys.has(claimKey)) {
    return { claimed: false };
  }

  // Local DB status check (must strictly be 0/null; 1 = sent, 2 = in-flight)
  try {
    const localStmt = db.prepare(`SELECT ${column} AS val FROM ${table} WHERE id = ? LIMIT 1`);
    localStmt.bind([rowId]);
    if (localStmt.step()) {
      const localVal = Number(localStmt.getAsObject().val || 0);
      localStmt.free();
      if (localVal !== 0) {
        return { claimed: false };
      }
    } else {
      localStmt.free();
    }
  } catch {}

  // Persistent multi-instance ledger lock across canonical target & entity
  if (persistentSlotKey && entityType && entityId) {
    const slotRes = await acquireEntityPublishSlot({
      slotKey: persistentSlotKey,
      entityType,
      entityId,
      channelKey: channelKey || 'default'
    });
    if (!slotRes.claimed) {
      console.warn(`[PromoCron] Persistent slot lock blocked ${persistentSlotKey} (${slotRes.reason})`);
      return { claimed: false };
    }
  }

  // Atomic Cloud PG compare-and-set claim BEFORE any delay or Telegram HTTP call (fail-closed on conflict)
  try {
    const pgRes = await pgQuery(
      `UPDATE ${table} SET ${column} = 2 WHERE id = $1 AND (${column} IS NULL OR ${column} = 0) RETURNING id`,
      [rowId],
      { safeMode: false, retries: 1 }
    );
    if (pgRes) {
      if ((pgRes.rowCount || 0) === 0) {
        const chk = await pgQuery(`SELECT ${column} AS val FROM ${table} WHERE id = $1 LIMIT 1`, [rowId], {
          safeMode: false,
          retries: 1
        });
        if (chk && chk.rows.length > 0) {
          const remoteVal = Number(chk.rows[0].val || 0);
          if (remoteVal !== 0) {
            try {
              db.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [remoteVal, rowId]);
            } catch {}
            if (persistentSlotKey) {
              await finalizePublishDedup([persistentSlotKey], remoteVal === 1 ? 'sent' : 'definite_failure');
            }
            return { claimed: false };
          }
        }
      }
    }
  } catch (pgErr: any) {
    const msg = String(pgErr?.message || pgErr || '');
    console.warn('[PromoCron] PG slot claim warning:', msg);
    if (/duplicate|conflict|constraint/i.test(msg)) {
      if (persistentSlotKey) {
        await finalizePublishDedup([persistentSlotKey], 'definite_failure');
      }
      return { claimed: false };
    }
  }

  inProgressPromoPublishKeys.add(claimKey);
  try {
    db.run(`UPDATE ${table} SET ${column} = 2 WHERE id = ?`, [rowId]);
  } catch {}

  return { claimed: true };
}

async function finalizePromoDeliverySlot(params: {
  table: 'promo_selection_channels' | 'promo_folder_participants';
  column: 'post_published' | 'repeat_post_published';
  rowId: string;
  claimKey: string;
  persistentSlotKey?: string;
  db: any;
  outcome: 'ok' | 'ambiguous_timeout' | 'failed';
  errorMsg?: string;
}): Promise<number> {
  const { table, column, rowId, claimKey, persistentSlotKey, db, outcome, errorMsg } = params;
  const finalStatus = outcome === 'failed' ? 0 : 1;

  try {
    if (outcome === 'ok' || outcome === 'ambiguous_timeout') {
      sentPromoPublishKeys.add(claimKey);
    }

    if (outcome === 'ok') {
      if (table === 'promo_selection_channels' || column === 'post_published') {
        db.run(`UPDATE ${table} SET ${column} = 1, reject_reason = NULL WHERE id = ?`, [rowId]);
        await pgQuery(`UPDATE ${table} SET ${column} = 1, reject_reason = NULL WHERE id = $1`, [rowId]).catch(() => {});
      } else {
        db.run(`UPDATE ${table} SET ${column} = 1 WHERE id = ?`, [rowId]);
        await pgQuery(`UPDATE ${table} SET ${column} = 1 WHERE id = $1`, [rowId]).catch(() => {});
      }
    } else if (outcome === 'ambiguous_timeout') {
      const warnReason = errorMsg ? `Таймаут сети (вероятно доставлено): ${errorMsg}` : null;
      db.run(`UPDATE ${table} SET ${column} = 1, reject_reason = ? WHERE id = ?`, [warnReason, rowId]);
      await pgQuery(`UPDATE ${table} SET ${column} = 1, reject_reason = $1 WHERE id = $2`, [warnReason, rowId]).catch(() => {});
    } else {
      db.run(`UPDATE ${table} SET ${column} = 0, reject_reason = ? WHERE id = ?`, [errorMsg || 'Ошибка отправки', rowId]);
      await pgQuery(`UPDATE ${table} SET ${column} = 0, reject_reason = $1 WHERE id = $2`, [errorMsg || 'Ошибка отправки', rowId]).catch(() => {});
    }

    if (persistentSlotKey) {
      await finalizePublishDedup(
        [persistentSlotKey],
        outcome === 'ok' ? 'sent' : outcome === 'ambiguous_timeout' ? 'ambiguous_timeout' : 'definite_failure'
      );
    }
  } finally {
    inProgressPromoPublishKeys.delete(claimKey);
  }

  return finalStatus;
}

function canAttemptPromoRetry(retryKey: string, nowMs: number): boolean {
  const rec = promoRetryStateMap.get(retryKey);
  if (!rec) return true;
  if (rec.count >= PROMO_MAX_AUTO_RETRIES) return false;
  return nowMs - rec.lastAttemptMs >= PROMO_RETRY_COOLDOWN_MS;
}

function recordPromoRetryFailure(retryKey: string, nowMs: number): number {
  const prev = promoRetryStateMap.get(retryKey);
  const nextCount = (prev?.count || 0) + 1;
  promoRetryStateMap.set(retryKey, { count: nextCount, lastAttemptMs: nowMs });
  return nextCount;
}

function parseJsonStringArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((u) => String(u || '').trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((u) => String(u || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Builds rich markdown post text for a selection from its header and participating channels.
 */
export function buildUnifiedSelectionText(sel: any, channels: any[]): string {
  const parts: string[] = [];
  let remainingMediaBudget = 50;

  const imageUrl = normalizeProTalkMediaUrl((sel.image_url || '').trim());
  if (imageUrl) {
    parts.push(`![](${imageUrl})`);
    remainingMediaBudget = Math.max(0, remainingMediaBudget - 1);
  }

  const mainHeader = (sel.header_title || sel.title || 'Подборка экспертных каналов').trim();
  if (mainHeader) {
    parts.push(`# ${mainHeader}`);
  }

  const subtitle = (sel.header_subtitle || '').trim();
  if (subtitle) {
    parts.push(`_${subtitle}_`);
  }

  const activeChannels = channels
    .filter((c: any) => c.status === 'active' || c.moderation_status === 'approved' || !c.status)
    .slice(0, 50);

  if (activeChannels.length > 0) {
    const channelBlocks = activeChannels.map((ch: any) => {
      const chName = (ch.channel_name || 'Канал').trim();
      const rawUser = (ch.channel_username || '').replace(/^@/, '').trim();
      const directLink = rawUser ? `https://t.me/${rawUser}` : 'https://t.me/IIrkiBot';
      const rawAvatar = ch.channel_avatar_url ? normalizeProTalkMediaUrl(String(ch.channel_avatar_url).trim()) : '';
      let avatar = '';
      if (rawAvatar && remainingMediaBudget > 0) {
        avatar = rawAvatar;
        remainingMediaBudget--;
      }
      const bio = (ch.promo_text || '').trim().slice(0, 200);

      const topLines = [
        `## [${chName}](${directLink})`,
        avatar ? `![](${avatar})` : '',
        bio ? `<i>${bio}</i>` : ''
      ].filter(Boolean);

      const subscribeLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${directLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;
      return `${topLines.join('\n')}\n\n\n${subscribeLine}`;
    });
    parts.push(channelBlocks.join('\n\n'));
  }

  const rules = (sel.rules || '').trim();
  if (rules) {
    parts.push(
      rules.length > 140
        ? `<blockquote expandable>${rules}</blockquote>`
        : `<blockquote>${rules}</blockquote>`
    );
  }

  return parts.join('\n\n');
}

/**
 * Builds post text for a folder from its title, description and folder invite link.
 */
export function buildUnifiedFolderText(folder: any): string {
  const isV2 = folder.message_format === 'v2';
  const parts: string[] = [];
  const img = folder.image_url ? normalizeProTalkMediaUrl(String(folder.image_url).trim()) : '';
  if (!isV2 && img) {
    parts.push(`![](${img})`);
  }
  if (folder.title && String(folder.title).trim()) {
    parts.push(isV2 ? `*${String(folder.title).trim()}*` : `# ${String(folder.title).trim()}`);
  }
  const body = String(folder.post_text || folder.description || '').trim();
  if (body) {
    parts.push(body);
  }
  if (folder.telegram_folder_link && String(folder.telegram_folder_link).trim()) {
    const link = String(folder.telegram_folder_link).trim();
    parts.push(
      isV2
        ? `[📁 Добавить папку в Telegram](${link})`
        : `\n\n<tg-button-row align="center">\n  <tg-button type="url" style="success" url="${link}">📁 Добавить папку в Telegram</tg-button>\n</tg-button-row>`
    );
  }
  return parts.join('\n\n');
}

/**
 * Safely dispatches error alerts with deduplication so users are never spammed by duplicates.
 */
function sendDeduplicatedAlert(userTelegramId: number, alertKey: string, messageHtml: string) {
  const now = Date.now();
  const lastSent = errorAlertCooldownMap.get(alertKey) || 0;
  // 1-hour cooldown per specific error and user
  if (now - lastSent < 3600 * 1000) {
    return;
  }
  errorAlertCooldownMap.set(alertKey, now);
  sendPrivateTelegramNotification(userTelegramId, messageHtml, undefined, {
    category: 'folders',
    title: 'Уведомление о папке или подборке'
  }).catch(() => {});
}

/**
 * Background checks for Promo Folders & Selections:
 * - 1 hour before: checks bot presence in channels
 * - At scheduled time: transitions status to published
 * - 72h after: transitions selections to results & calculates statistics
 */
export async function processDuePromoFoldersAndSelections(db: any) {
  if (isPromoCronRunning) {
    return;
  }
  isPromoCronRunning = true;
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Process scheduled publications for Promo Selections (Подборки)
    try {
      const activeSelectionsStmt = db.prepare(`
        SELECT * FROM promo_selections 
        WHERE status IN ('recruiting', 'bot_checking', 'confirmed', 'published')
           OR (id IN (SELECT selection_id FROM promo_selection_channels WHERE (post_published IS NULL OR post_published = 0) AND status = 'active'))
      `);
      const activeSelections: any[] = [];
      while (activeSelectionsStmt.step()) {
        activeSelections.push(activeSelectionsStmt.getAsObject());
      }
      activeSelectionsStmt.free();

      for (const sel of activeSelections) {
        // Skip archived selections
        if (sel.status === 'archived') continue;

        const schedTime = new Date(sel.scheduled_at).getTime();

        // 1a. Bot checking & private 1h reminder before launch
        const selReminderMinutes = Number(sel.reminder_before_minutes) || 60;
        const selDiffMs = schedTime - now.getTime();
        if (selDiffMs <= selReminderMinutes * 60 * 1000 && selDiffMs > 0) {
          if (sel.status === 'recruiting' || sel.status === 'confirmed') {
            db.run("UPDATE promo_selections SET status = 'bot_checking', updated_at = ? WHERE id = ?", [nowIso, sel.id]);
            sel.status = 'bot_checking';
          }

          // Private reminder to participants in Telegram PM (never to channels)
          const selRemKey = `sel_rem_${sel.id}_${sel.scheduled_at || ''}`;
          if (Number(sel.reminder_sent) !== 1 && !sentPromoReminderKeys.has(selRemKey)) {
            sentPromoReminderKeys.add(selRemKey);
            sel.reminder_sent = 1;
            db.run("UPDATE promo_selections SET reminder_sent = 1, updated_at = ? WHERE id = ?", [nowIso, sel.id]);
            const canSendRem = await claimPromoReminderInPg('promo_selections', String(sel.id));
            savePgDB();
            if (!canSendRem) {
              continue;
            }

            try {
              const pStmt = db.prepare("SELECT user_id, channel_name, custom_publish_time FROM promo_selection_channels WHERE selection_id = ? AND status = 'active'");
              pStmt.bind([sel.id]);
              const dateReadable = formatMskDateTime(sel.scheduled_at);

              const userGroups = new Map<number, { channelNames: string[]; customTimes: string[] }>();
              while (pStmt.step()) {
                const partRow: any = pStmt.getAsObject();
                const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
                uStmt.bind([String(partRow.user_id)]);
                if (uStmt.step()) {
                  const tgId = Number(uStmt.getAsObject().telegram_id);
                  if (tgId) {
                    if (!userGroups.has(tgId)) {
                      userGroups.set(tgId, { channelNames: [], customTimes: [] });
                    }
                    const grp = userGroups.get(tgId)!;
                    const chLabel = String(partRow.channel_name || 'Канал').trim();
                    if (!grp.channelNames.includes(chLabel)) grp.channelNames.push(chLabel);
                    if (partRow.custom_publish_time) {
                      grp.customTimes.push(`${chLabel}: ${formatMskDateTime(partRow.custom_publish_time)}`);
                    }
                  }
                }
                uStmt.free();
              }
              pStmt.free();

              for (const [tgId, grp] of userGroups.entries()) {
                const userRemKey = `sel_rem_user_${sel.id}_${sel.scheduled_at || ''}_${tgId}`;
                if (sentPromoReminderKeys.has(userRemKey)) continue;
                sentPromoReminderKeys.add(userRemKey);

                const channelsLabel = grp.channelNames.map((n) => `«${n}»`).join(', ');
                const customNote = grp.customTimes.length > 0
                  ? `\n⏱ Индивидуальное время выхода: ${grp.customTimes.join('; ')}`
                  : '';

                sendPrivateTelegramNotification(
                  tgId,
                  `🔔 <b>Напоминание о выходе подборки «${sel.title}»</b>\n\nОбщее время публикации: ${dateReadable}.${customNote}\n\nПожалуйста, убедитесь, что бот назначен администратором ${grp.channelNames.length > 1 ? 'ваших каналов' : 'вашего канала'} ${channelsLabel}.`,
                  undefined,
                  { category: 'folders', title: `Напоминание о подборке «${sel.title}»` }
                ).catch(() => {});
              }
            } catch (remErr) {
              console.warn('[Cron] Selection reminder warning:', remErr);
            }
          }
        }

        // Fetch participating channels
        const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status = 'active'");
        cStmt.bind([sel.id]);
        const channels: any[] = [];
        while (cStmt.step()) {
          channels.push(cStmt.getAsObject());
        }
        cStmt.free();

        // Ensure selection has valid post_text in DB
        let postTextToSend = (sel.post_text || '').trim();
        if (!postTextToSend) {
          postTextToSend = buildUnifiedSelectionText(sel, channels);
          if (postTextToSend) {
            db.run("UPDATE promo_selections SET post_text = ? WHERE id = ?", [postTextToSend, sel.id]);
            sel.post_text = postTextToSend;
          }
        }

        // 1b. Dispatch Rich message to participant channels cascadingly
        const sentTargetsInSel = new Set<string>();
        for (const ch of channels) {
          const chPubStatus = Number(ch.post_published || 0);
          const targetPublishTime = ch.custom_publish_time ? new Date(ch.custom_publish_time).getTime() : schedTime;

          if (chPubStatus === 0 && now.getTime() >= targetPublishTime) {
            const selRetryKey = `sel_${sel.id}_${ch.id}`;
            if (!canAttemptPromoRetry(selRetryKey, now.getTime())) {
              continue;
            }
            let targetChan = '';
            const allChannels = DB.getChannels() || [];
            const found = allChannels.find((c: any) =>
              c.id === ch.channel_id ||
              c.channelId === ch.channel_id ||
              (ch.channel_name && (c.name === ch.channel_name || c.title === ch.channel_name)) ||
              (ch.channel_username && c.username && c.username.replace(/^@/, '').toLowerCase() === ch.channel_username.replace(/^@/, '').toLowerCase())
            );

            if (found) {
              if (found.telegramId && /^-?\d+$/.test(String(found.telegramId))) {
                targetChan = String(found.telegramId);
              } else if (found.username && /^[a-zA-Z0-9_]{4,32}$/.test(found.username.replace(/^@/, '').trim())) {
                targetChan = `@${found.username.replace(/^@/, '').trim()}`;
              }
            }

            if (!targetChan && ch.channel_id && /^-?\d+$/.test(String(ch.channel_id))) {
              targetChan = String(ch.channel_id);
            }

            if (!targetChan && ch.channel_username) {
              const cleanU = ch.channel_username.replace(/^@/, '').trim();
              if (/^[a-zA-Z0-9_]{4,32}$/.test(cleanU)) {
                targetChan = `@${cleanU}`;
              }
            }

            if (!targetChan) {
              const defaultChan = DB.getSettings()?.channelId;
              targetChan = (defaultChan && (/^-?\d+$/.test(defaultChan) || /^[a-zA-Z0-9_]{4,32}$/.test(defaultChan.replace(/^@/, '')))) ? defaultChan : getDefaultChannelIdentifier();
            }

            const normTarget = canonicalizeTelegramTarget(targetChan);
            if (normTarget && sentTargetsInSel.has(normTarget)) {
              continue;
            }

            const selPersistentSlot = `sel_chan:${sel.id}:${normTarget}`;
            const selClaimKey = `sel_pub_${sel.id}_${ch.id}_${sel.scheduled_at || ''}_${ch.custom_publish_time || ''}`;
            const { claimed } = await claimPromoDeliverySlot({
              table: 'promo_selection_channels',
              column: 'post_published',
              rowId: String(ch.id),
              claimKey: selClaimKey,
              persistentSlotKey: selPersistentSlot,
              entityType: 'selection',
              entityId: String(sel.id),
              channelKey: normTarget,
              db
            });
            if (!claimed) {
              continue;
            }
            if (normTarget) sentTargetsInSel.add(normTarget);

            // Cascading throttle between channels (1.5s delay)
            await new Promise(resolve => setTimeout(resolve, 1500));

            try {
              let parsedButtons: any = undefined;
              if (sel.inline_buttons) {
                try {
                  parsedButtons = typeof sel.inline_buttons === 'string' ? JSON.parse(sel.inline_buttons) : sel.inline_buttons;
                } catch (e) {}
              }

              const selCover = sel.image_url ? normalizeProTalkMediaUrl(String(sel.image_url).trim()) : '';

              // Strictly enforce Rich format for all Selections (Подборки)
              const pubRes = await sendRichTelegramMessage(
                sel.header_title || sel.title,
                postTextToSend,
                {
                  id: `sel_post_${sel.id}`,
                  channel: targetChan,
                  messageFormat: 'rich',
                  status: 'active'
                } as any,
                {
                  messageFormat: 'rich',
                  attachmentType: selCover ? 'photo' : 'none',
                  attachmentUrl: selCover || undefined,
                  inlineButtons: parsedButtons,
                  channels: [targetChan]
                }
              );

              if (pubRes && pubRes.ok) {
                promoRetryStateMap.delete(selRetryKey);
                ch.post_published = await finalizePromoDeliverySlot({
                  table: 'promo_selection_channels',
                  column: 'post_published',
                  rowId: String(ch.id),
                  claimKey: selClaimKey,
                  persistentSlotKey: selPersistentSlot,
                  db,
                  outcome: 'ok'
                });
                ch.reject_reason = null;
              } else {
                const errMsg = pubRes?.error || 'Бот не является администратором канала';
                if (isAmbiguousNetworkTimeout(errMsg)) {
                  ch.post_published = await finalizePromoDeliverySlot({
                    table: 'promo_selection_channels',
                    column: 'post_published',
                    rowId: String(ch.id),
                    claimKey: selClaimKey,
                    persistentSlotKey: selPersistentSlot,
                    db,
                    outcome: 'ambiguous_timeout',
                    errorMsg: errMsg
                  });
                } else {
                  recordPromoRetryFailure(selRetryKey, Date.now());
                  console.warn(`[Cron] Selection post failed for channel ${targetChan}:`, errMsg);
                  ch.post_published = await finalizePromoDeliverySlot({
                    table: 'promo_selection_channels',
                    column: 'post_published',
                    rowId: String(ch.id),
                    claimKey: selClaimKey,
                    persistentSlotKey: selPersistentSlot,
                    db,
                    outcome: 'failed',
                    errorMsg: errMsg
                  });
                  ch.reject_reason = errMsg;

                  // Resolve organizer and participant telegram IDs
                  let orgTgId: any = sel.author_telegram_id;
                  if (!orgTgId && sel.author_id) {
                    try {
                      const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
                      uStmt.bind([String(sel.author_id)]);
                      if (uStmt.step()) orgTgId = uStmt.getAsObject().telegram_id;
                      uStmt.free();
                    } catch (e) {}
                  }

                  let partTgId: any = null;
                  if (ch.user_id) {
                    try {
                      const pUStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
                      pUStmt.bind([String(ch.user_id)]);
                      if (pUStmt.step()) partTgId = pUStmt.getAsObject().telegram_id;
                      pUStmt.free();
                    } catch (e) {}
                  }

                  const alertText = `⚠️ <b>Ошибка публикации подборки на канал</b>\n\n` +
                    `📚 <b>Подборка:</b> «${sel.header_title || sel.title}»\n` +
                    `📢 <b>Канал:</b> ${ch.channel_name || targetChan} (${targetChan})\n` +
                    `❌ <b>Причина:</b> <i>${errMsg}</i>\n\n` +
                    `Пожалуйста, убедитесь, что бот добавлен в администраторы канала с правом публикации сообщений.`;

                  // If organizer and participant are the SAME user, send only ONE alert to avoid duplicate spam!
                  if (orgTgId && partTgId && String(orgTgId) === String(partTgId)) {
                    sendDeduplicatedAlert(Number(orgTgId), `sel_err_${sel.id}_${ch.id}_${orgTgId}`, alertText);
                  } else {
                    if (orgTgId) {
                      sendDeduplicatedAlert(Number(orgTgId), `sel_err_org_${sel.id}_${ch.id}_${orgTgId}`, alertText);
                    }
                    if (partTgId) {
                      sendDeduplicatedAlert(Number(partTgId), `sel_err_part_${sel.id}_${ch.id}_${partTgId}`, alertText);
                    }
                  }

                  // In-app notifications
                  if (sel.author_id) {
                    createNotificationInDb(db, {
                      userId: String(sel.author_id),
                      title: 'Ошибка отправки подборки на канал',
                      message: `Не удалось отправить подборку «${sel.title}» на канал ${ch.channel_name || targetChan}. Причина: ${errMsg}`,
                      type: 'publish',
                      link: `/folders?selectionId=${sel.id}`
                    });
                  }
                }
              }
            } catch (pubErr: any) {
              const errMsg = pubErr?.message || 'Ошибка отправки в Telegram';
              if (isAmbiguousNetworkTimeout(errMsg)) {
                ch.post_published = await finalizePromoDeliverySlot({
                  table: 'promo_selection_channels',
                  column: 'post_published',
                  rowId: String(ch.id),
                  claimKey: selClaimKey,
                  persistentSlotKey: selPersistentSlot,
                  db,
                  outcome: 'ambiguous_timeout',
                  errorMsg: errMsg
                });
              } else {
                recordPromoRetryFailure(selRetryKey, Date.now());
                console.error(`[Cron] Error publishing selection post to channel ${targetChan}:`, pubErr);
                ch.post_published = await finalizePromoDeliverySlot({
                  table: 'promo_selection_channels',
                  column: 'post_published',
                  rowId: String(ch.id),
                  claimKey: selClaimKey,
                  persistentSlotKey: selPersistentSlot,
                  db,
                  outcome: 'failed',
                  errorMsg: errMsg
                });
                ch.reject_reason = errMsg;
              }
            }
          }
        }

        // 1c. Archive selection when all participants have completed (or failed) OR if there are no participants and time has arrived
        const allTargetTimes = channels.map(c => c.custom_publish_time ? new Date(c.custom_publish_time).getTime() : schedTime);
        const maxParticipantTime = channels.length > 0 ? Math.max(schedTime, ...allTargetTimes) : schedTime;
        const allChansPublished = channels.length === 0 || channels.every(c => Number(c.post_published || 0) === 1);

        if (allChansPublished && now.getTime() >= maxParticipantTime && sel.status !== 'archived') {
          db.run("UPDATE promo_selections SET status = 'archived', results_collected_at = COALESCE(results_collected_at, ?), updated_at = ? WHERE id = ?", [nowIso, nowIso, sel.id]);
          sel.status = 'archived';
          console.log(`[Cron] Selection ${sel.id} («${sel.title}») completed (published/attempted/no channels) and moved to archive.`);
        } else if (now.getTime() >= schedTime && sel.status !== 'published' && sel.status !== 'archived') {
          db.run("UPDATE promo_selections SET status = 'published', updated_at = ? WHERE id = ?", [nowIso, sel.id]);
          sel.status = 'published';
        }
      }
      savePgDB();
    } catch (selErr) {
      console.error('[Cron Worker] Error processing promo selections:', selErr);
    }

    // 2. Check Promo Folders (Reminders, Custom Time, Sponsor rules & Channel Publications)
    try {
      // 2a. Send reminders to participants
      const remFoldersStmt = db.prepare(`
        SELECT * FROM promo_folders 
        WHERE status IN ('recruiting', 'confirmed', 'bot_checking') AND (reminder_sent IS NULL OR reminder_sent = 0)
      `);
      const remFolders: any[] = [];
      while (remFoldersStmt.step()) {
        remFolders.push(remFoldersStmt.getAsObject());
      }
      remFoldersStmt.free();

      for (const folder of remFolders) {
        const scheduledTime = new Date(folder.scheduled_at).getTime();
        const reminderMinutes = Number(folder.reminder_before_minutes) || 60;
        const diffMs = scheduledTime - now.getTime();
        const fldRemKey = `fld_rem_${folder.id}_${folder.scheduled_at || ''}`;

        // If within reminder window (e.g. 60 min before scheduled_at)
        if (diffMs <= reminderMinutes * 60 * 1000 && diffMs > 0 && Number(folder.reminder_sent) !== 1 && !sentPromoReminderKeys.has(fldRemKey)) {
          sentPromoReminderKeys.add(fldRemKey);
          folder.reminder_sent = 1;
          db.run("UPDATE promo_folders SET reminder_sent = 1, updated_at = ? WHERE id = ?", [nowIso, folder.id]);
          const canSendFldRem = await claimPromoReminderInPg('promo_folders', String(folder.id));
          savePgDB();
          if (!canSendFldRem) {
            continue;
          }

          const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status = 'accepted'");
          pStmt.bind([folder.id]);
          const participants: any[] = [];
          while (pStmt.step()) {
            participants.push(pStmt.getAsObject());
          }
          pStmt.free();

          const dateReadable = formatMskDateTime(folder.scheduled_at);

          // Build reminder reply markup buttons
          const reminderButtons: any[] = [];
          if (folder.telegram_folder_link) {
            reminderButtons.push([{ text: '📁 Ссылка на инвайт папки', url: folder.telegram_folder_link }]);
          }
          if (folder.author_username) {
            const orgClean = String(folder.author_username).replace(/^@/, '');
            reminderButtons.push([{ text: '👤 Организатор папки', url: `https://t.me/${orgClean}` }]);
          }
          reminderButtons.push([{ text: '🔔 Отписаться от напоминания', callback_data: 'unsub_reminder' }]);

          const replyMarkup = buildReplyMarkup(reminderButtons);

          const userGroups = new Map<number, { channelNames: string[]; notes: string[] }>();
          for (const p of participants) {
            const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
            uStmt.bind([p.user_id]);
            if (uStmt.step()) {
              const tgId = Number(uStmt.getAsObject().telegram_id);
              if (tgId) {
                if (!userGroups.has(tgId)) {
                  userGroups.set(tgId, { channelNames: [], notes: [] });
                }
                const grp = userGroups.get(tgId)!;
                const chLabel = String(p.channel_name || 'Канал').trim();
                if (!grp.channelNames.includes(chLabel)) grp.channelNames.push(chLabel);
                if (p.custom_publish_time) {
                  grp.notes.push(`⏱ Индивидуальное время (${chLabel}): ${formatMskDateTime(p.custom_publish_time)}`);
                }
                if (p.is_sponsor === 1) {
                  grp.notes.push(`⭐ Статус: Спонсор${p.sponsor_skip_posting === 1 ? ' (публикация на ваш канал отключена)' : ''}`);
                }
              }
            }
            uStmt.free();
          }

          for (const [tgId, grp] of userGroups.entries()) {
            const userRemKey = `fld_rem_user_${folder.id}_${folder.scheduled_at || ''}_${tgId}`;
            if (sentPromoReminderKeys.has(userRemKey)) continue;
            sentPromoReminderKeys.add(userRemKey);

            const channelsLabel = grp.channelNames.map((n) => `«${n}»`).join(', ');
            const notesText = grp.notes.length > 0 ? `\n${grp.notes.join('\n')}` : '';

            sendPrivateTelegramNotification(
              tgId,
              `🔔 <b>Напоминание о выходе папки «${folder.title}»</b>\n\nОбщее время публикации: ${dateReadable}.${notesText}\n\nПожалуйста, убедитесь, что бот назначен администратором ${grp.channelNames.length > 1 ? 'ваших каналов' : 'вашего канала'} ${channelsLabel}.`,
              replyMarkup,
              { category: 'folders', title: `Напоминание о папке «${folder.title}»` }
            ).catch(() => {});
          }
        }
      }

      // 2b. Process publication to participant channels
      const activeFoldersStmt = db.prepare(`
        SELECT * FROM promo_folders 
        WHERE status IN ('recruiting', 'confirmed', 'published')
      `);
      const activeFolders: any[] = [];
      while (activeFoldersStmt.step()) {
        activeFolders.push(activeFoldersStmt.getAsObject());
      }
      activeFoldersStmt.free();

      for (const folder of activeFolders) {
        const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status = 'accepted'");
        pStmt.bind([folder.id]);
        const participants: any[] = [];
        while (pStmt.step()) {
          participants.push(pStmt.getAsObject());
        }
        pStmt.free();

        let folderPostText = (folder.post_text || '').trim();
        if (!folderPostText) {
          folderPostText = buildUnifiedFolderText(folder);
          if (folderPostText) {
            db.run("UPDATE promo_folders SET post_text = ? WHERE id = ?", [folderPostText, folder.id]);
            folder.post_text = folderPostText;
          }
        }

        const sentTargetsInFolder = new Set<string>();
        const sentTargetsInFolderRepeat = new Set<string>();

        for (const p of participants) {
          // Sponsor skip posting check
          if (p.is_sponsor === 1 && p.sponsor_skip_posting === 1) {
            continue;
          }

          // Main post timing check (custom_publish_time or folder.scheduled_at)
          const targetPublishTime = p.custom_publish_time ? new Date(p.custom_publish_time).getTime() : new Date(folder.scheduled_at).getTime();
          const mainPubStatus = Number(p.post_published || 0);

          if (mainPubStatus === 0) {
            if (now.getTime() >= targetPublishTime) {
              const fldRetryKey = `fld_main_${folder.id}_${p.id}`;
              if (!canAttemptPromoRetry(fldRetryKey, now.getTime())) {
                continue;
              }
              let channelTarget = '';
              const allChannels = DB.getChannels() || [];
              const found = allChannels.find((c: any) =>
                c.id === p.channel_id ||
                c.channelId === p.channel_id ||
                (p.channel_name && (c.name === p.channel_name || c.title === p.channel_name)) ||
                (p.channel_username && c.username && c.username.replace(/^@/, '').toLowerCase() === p.channel_username.replace(/^@/, '').toLowerCase())
              );

              if (found) {
                if (found.telegramId && /^-?\d+$/.test(String(found.telegramId))) {
                  channelTarget = String(found.telegramId);
                } else if (found.username && /^[a-zA-Z0-9_]{4,32}$/.test(found.username.replace(/^@/, '').trim())) {
                  channelTarget = `@${found.username.replace(/^@/, '').trim()}`;
                }
              }

              if (!channelTarget && p.channel_id && /^-?\d+$/.test(String(p.channel_id))) {
                channelTarget = String(p.channel_id);
              }

              if (!channelTarget && p.channel_username) {
                const cleanU = p.channel_username.replace(/^@/, '').trim();
                if (/^[a-zA-Z0-9_]{4,32}$/.test(cleanU)) {
                  channelTarget = `@${cleanU}`;
                }
              }

              if (!channelTarget) {
                const defaultChan = DB.getSettings()?.channelId;
                channelTarget = (defaultChan && (/^-?\d+$/.test(defaultChan) || /^[a-zA-Z0-9_]{4,32}$/.test(defaultChan.replace(/^@/, '')))) ? defaultChan : getDefaultChannelIdentifier();
              }

              const normTarget = canonicalizeTelegramTarget(channelTarget);
              if (normTarget && sentTargetsInFolder.has(normTarget)) {
                continue;
              }

              const fldPersistentSlot = `fld_main_chan:${folder.id}:${normTarget}`;
              const fldClaimKey = `fld_main_pub_${folder.id}_${p.id}_${folder.scheduled_at || ''}_${p.custom_publish_time || ''}`;
              const { claimed } = await claimPromoDeliverySlot({
                table: 'promo_folder_participants',
                column: 'post_published',
                rowId: String(p.id),
                claimKey: fldClaimKey,
                persistentSlotKey: fldPersistentSlot,
                entityType: 'folder',
                entityId: String(folder.id),
                channelKey: normTarget,
                db
              });
              if (!claimed) {
                continue;
              }
              if (normTarget) sentTargetsInFolder.add(normTarget);

              // Cascading throttle between channels (1.5s delay)
              await new Promise(resolve => setTimeout(resolve, 1500));

              try {
                let parsedButtons: any = undefined;
                if (folder.inline_buttons) {
                  try {
                    parsedButtons = typeof folder.inline_buttons === 'string' ? JSON.parse(folder.inline_buttons) : folder.inline_buttons;
                  } catch (e) {}
                }

                const folderFormat: 'v2' | 'rich' = folder.message_format === 'v2' ? 'v2' : 'rich';
                const parsedAttUrls = parseJsonStringArray(folder.attachment_urls);
                const resolvedAttType = (folder.attachment_type && folder.attachment_type !== 'none')
                  ? folder.attachment_type
                  : (parsedAttUrls.length > 1 ? 'album' : (parsedAttUrls[0] || folder.image_url) ? 'photo' : 'none');
                const resolvedAttUrl = parsedAttUrls[0] || folder.image_url || undefined;

                const pubRes = await sendPromptToTelegram(
                  folder.title,
                  folderPostText,
                  {
                    id: `folder_post_${folder.id}`,
                    channel: channelTarget,
                    messageFormat: folderFormat,
                    audioFormat: folder.audio_format || (resolvedAttType === 'voice' ? 'voice' : 'audio'),
                    status: 'active'
                  } as any,
                  {
                    messageFormat: folderFormat,
                    attachmentType: resolvedAttType as any,
                    audioFormat: folder.audio_format || (resolvedAttType === 'voice' ? 'voice' : 'audio'),
                    attachmentUrl: resolvedAttUrl,
                    attachmentUrls: parsedAttUrls.length > 0 ? parsedAttUrls : undefined,
                    inlineButtons: parsedButtons,
                    channels: [channelTarget]
                  }
                );

                if (pubRes && pubRes.ok) {
                  promoRetryStateMap.delete(fldRetryKey);
                  p.post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'post_published',
                    rowId: String(p.id),
                    claimKey: fldClaimKey,
                    persistentSlotKey: fldPersistentSlot,
                    db,
                    outcome: 'ok'
                  });
                  p.reject_reason = null;
                } else {
                  const errMsg = pubRes?.error || 'Бот не является администратором канала';
                  if (isAmbiguousNetworkTimeout(errMsg)) {
                    p.post_published = await finalizePromoDeliverySlot({
                      table: 'promo_folder_participants',
                      column: 'post_published',
                      rowId: String(p.id),
                      claimKey: fldClaimKey,
                      persistentSlotKey: fldPersistentSlot,
                      db,
                      outcome: 'ambiguous_timeout',
                      errorMsg: errMsg
                    });
                  } else {
                    recordPromoRetryFailure(fldRetryKey, Date.now());
                    console.warn(`[Cron] Folder post failed for channel ${channelTarget}:`, errMsg);
                    p.post_published = await finalizePromoDeliverySlot({
                      table: 'promo_folder_participants',
                      column: 'post_published',
                      rowId: String(p.id),
                      claimKey: fldClaimKey,
                      persistentSlotKey: fldPersistentSlot,
                      db,
                      outcome: 'failed',
                      errorMsg: errMsg
                    });
                    p.reject_reason = errMsg;

                    // Resolve organizer and participant telegram IDs
                    let orgTgId: any = folder.author_telegram_id;
                    if (!orgTgId && folder.author_id) {
                      try {
                        const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
                        uStmt.bind([String(folder.author_id)]);
                        if (uStmt.step()) orgTgId = uStmt.getAsObject().telegram_id;
                        uStmt.free();
                      } catch (e) {}
                    }

                    let partTgId: any = null;
                    if (p.user_id) {
                      try {
                        const pUStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
                        pUStmt.bind([String(p.user_id)]);
                        if (pUStmt.step()) partTgId = pUStmt.getAsObject().telegram_id;
                        pUStmt.free();
                      } catch (e) {}
                    }

                    const alertText = `⚠️ <b>Ошибка публикации папки на канал</b>\n\n` +
                      `📁 <b>Папка:</b> «${folder.title}»\n` +
                      `📢 <b>Канал:</b> ${p.channel_name || channelTarget} (${channelTarget})\n` +
                      `❌ <b>Причина:</b> <i>${errMsg}</i>\n\n` +
                      `Пожалуйста, убедитесь, что бот добавлен в администраторы канала с правом публикации сообщений.`;

                    if (orgTgId && partTgId && String(orgTgId) === String(partTgId)) {
                      sendDeduplicatedAlert(Number(orgTgId), `fld_err_${folder.id}_${p.id}_${orgTgId}`, alertText);
                    } else {
                      if (orgTgId) {
                        sendDeduplicatedAlert(Number(orgTgId), `fld_err_org_${folder.id}_${p.id}_${orgTgId}`, alertText);
                      }
                      if (partTgId) {
                        sendDeduplicatedAlert(Number(partTgId), `fld_err_part_${folder.id}_${p.id}_${partTgId}`, alertText);
                      }
                    }

                    // In-app notification for organizer
                    if (folder.author_id) {
                      createNotificationInDb(db, {
                        userId: String(folder.author_id),
                        title: 'Ошибка отправки папки на канал',
                        message: `Не удалось отправить папку «${folder.title}» на канал ${p.channel_name || channelTarget}. Причина: ${errMsg}`,
                        type: 'publish',
                        link: `/folders?folderId=${folder.id}`
                      });
                    }
                  }
                }
              } catch (pubErr: any) {
                const errMsg = pubErr?.message || 'Ошибка отправки в Telegram';
                if (isAmbiguousNetworkTimeout(errMsg)) {
                  p.post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'post_published',
                    rowId: String(p.id),
                    claimKey: fldClaimKey,
                    persistentSlotKey: fldPersistentSlot,
                    db,
                    outcome: 'ambiguous_timeout',
                    errorMsg: errMsg
                  });
                } else {
                  recordPromoRetryFailure(fldRetryKey, Date.now());
                  console.error(`[Cron] Error publishing folder post to channel ${channelTarget}:`, pubErr);
                  p.post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'post_published',
                    rowId: String(p.id),
                    claimKey: fldClaimKey,
                    persistentSlotKey: fldPersistentSlot,
                    db,
                    outcome: 'failed',
                    errorMsg: errMsg
                  });
                  p.reject_reason = errMsg;
                }
              }
            }
          }

          // Repeat post timing check if enabled
          if (folder.repeat_post_enabled === 1 && folder.repeat_scheduled_at) {
            const targetRepeatTime = p.custom_repeat_publish_time ? new Date(p.custom_repeat_publish_time).getTime() : new Date(folder.repeat_scheduled_at).getTime();
            const repeatPubStatus = Number(p.repeat_post_published || 0);
            const repeatRetryKey = `fld_repeat_${folder.id}_${p.id}`;

            if (repeatPubStatus === 0 && now.getTime() >= targetRepeatTime && canAttemptPromoRetry(repeatRetryKey, now.getTime())) {
              let channelTarget = p.channel_username ? `@${p.channel_username.replace(/^@/, '')}` : '';
              if (!channelTarget && (p.channel_id || p.channel_name)) {
                const allChannels = DB.getChannels() || [];
                const found = allChannels.find((c: any) => c.id === p.channel_id || c.channelId === p.channel_id || c.name === p.channel_name);
                if (found) {
                  channelTarget = found.telegramId && /^-?\d+$/.test(String(found.telegramId))
                    ? String(found.telegramId)
                    : (found.username ? `@${found.username.replace(/^@/, '')}` : '');
                }
              }
              if (!channelTarget) channelTarget = p.channel_name;

              const normRepeatTarget = canonicalizeTelegramTarget(channelTarget);
              if (normRepeatTarget && sentTargetsInFolderRepeat.has(normRepeatTarget)) {
                continue;
              }

              const repeatPersistentSlot = `fld_rep_chan:${folder.id}:${normRepeatTarget}`;
              const repeatClaimKey = `fld_rep_pub_${folder.id}_${p.id}_${folder.repeat_scheduled_at || ''}_${p.custom_repeat_publish_time || ''}`;
              const { claimed: claimedRep } = await claimPromoDeliverySlot({
                table: 'promo_folder_participants',
                column: 'repeat_post_published',
                rowId: String(p.id),
                claimKey: repeatClaimKey,
                persistentSlotKey: repeatPersistentSlot,
                entityType: 'folder_repeat',
                entityId: String(folder.id),
                channelKey: normRepeatTarget,
                db
              });
              if (!claimedRep) {
                continue;
              }
              if (normRepeatTarget) sentTargetsInFolderRepeat.add(normRepeatTarget);

              // Cascading throttle
              await new Promise(resolve => setTimeout(resolve, 1500));

              try {
                let parsedRepeatButtons: any = undefined;
                if (folder.repeat_inline_buttons) {
                  try {
                    parsedRepeatButtons = typeof folder.repeat_inline_buttons === 'string' ? JSON.parse(folder.repeat_inline_buttons) : folder.repeat_inline_buttons;
                  } catch (e) {}
                }

                const repeatText = (folder.repeat_post_text || folderPostText || '').trim();
                const repeatFormat: 'v2' | 'rich' = (folder.repeat_message_format || folder.message_format) === 'v2' ? 'v2' : 'rich';
                const parsedRepeatAttUrls = parseJsonStringArray(folder.repeat_attachment_urls);
                const resolvedRepeatAttType = (folder.repeat_attachment_type && folder.repeat_attachment_type !== 'none')
                  ? folder.repeat_attachment_type
                  : (parsedRepeatAttUrls.length > 1 ? 'album' : (parsedRepeatAttUrls[0] || folder.repeat_image_url || folder.image_url) ? 'photo' : 'none');
                const resolvedRepeatAttUrl = parsedRepeatAttUrls[0] || folder.repeat_image_url || folder.image_url || undefined;

                const repeatRes = await sendPromptToTelegram(
                  folder.title,
                  repeatText,
                  {
                    id: `folder_repeat_${folder.id}`,
                    channel: channelTarget,
                    messageFormat: repeatFormat,
                    audioFormat: folder.audio_format || (resolvedRepeatAttType === 'voice' ? 'voice' : 'audio'),
                    status: 'active'
                  } as any,
                  {
                    messageFormat: repeatFormat,
                    attachmentType: resolvedRepeatAttType as any,
                    audioFormat: folder.audio_format || (resolvedRepeatAttType === 'voice' ? 'voice' : 'audio'),
                    attachmentUrl: resolvedRepeatAttUrl,
                    attachmentUrls: parsedRepeatAttUrls.length > 0 ? parsedRepeatAttUrls : undefined,
                    inlineButtons: parsedRepeatButtons,
                    channels: [channelTarget]
                  }
                );

                if (repeatRes && repeatRes.ok) {
                  promoRetryStateMap.delete(repeatRetryKey);
                  p.repeat_post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'repeat_post_published',
                    rowId: String(p.id),
                    claimKey: repeatClaimKey,
                    persistentSlotKey: repeatPersistentSlot,
                    db,
                    outcome: 'ok'
                  });
                } else {
                  const errMsg = repeatRes?.error || 'Ошибка отправки повторного поста папки';
                  if (isAmbiguousNetworkTimeout(errMsg)) {
                    p.repeat_post_published = await finalizePromoDeliverySlot({
                      table: 'promo_folder_participants',
                      column: 'repeat_post_published',
                      rowId: String(p.id),
                      claimKey: repeatClaimKey,
                      persistentSlotKey: repeatPersistentSlot,
                      db,
                      outcome: 'ambiguous_timeout',
                      errorMsg: errMsg
                    });
                  } else {
                    recordPromoRetryFailure(repeatRetryKey, Date.now());
                    p.repeat_post_published = await finalizePromoDeliverySlot({
                      table: 'promo_folder_participants',
                      column: 'repeat_post_published',
                      rowId: String(p.id),
                      claimKey: repeatClaimKey,
                      persistentSlotKey: repeatPersistentSlot,
                      db,
                      outcome: 'failed',
                      errorMsg: errMsg
                    });
                    p.reject_reason = errMsg;
                  }
                }
              } catch (repeatErr: any) {
                const errMsg = repeatErr?.message || 'Ошибка отправки repeat поста в Telegram';
                if (isAmbiguousNetworkTimeout(errMsg)) {
                  p.repeat_post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'repeat_post_published',
                    rowId: String(p.id),
                    claimKey: repeatClaimKey,
                    persistentSlotKey: repeatPersistentSlot,
                    db,
                    outcome: 'ambiguous_timeout',
                    errorMsg: errMsg
                  });
                } else {
                  recordPromoRetryFailure(repeatRetryKey, Date.now());
                  console.error(`[Cron] Error publishing repeat folder post to channel ${channelTarget}:`, repeatErr);
                  p.repeat_post_published = await finalizePromoDeliverySlot({
                    table: 'promo_folder_participants',
                    column: 'repeat_post_published',
                    rowId: String(p.id),
                    claimKey: repeatClaimKey,
                    persistentSlotKey: repeatPersistentSlot,
                    db,
                    outcome: 'failed',
                    errorMsg: errMsg
                  });
                }
              }
            }
          }
        }

        const schedMs = new Date(folder.scheduled_at).getTime();
        const repeatSchedMs = (folder.repeat_post_enabled === 1 && folder.repeat_scheduled_at) ? new Date(folder.repeat_scheduled_at).getTime() : 0;
        
        // Calculate max participant custom time across all active participants
        const activeParts = participants.filter((p: any) => !(p.is_sponsor === 1 && p.sponsor_skip_posting === 1));
        const participantTimes = activeParts.map((p: any) => {
          const t1 = p.custom_publish_time ? new Date(p.custom_publish_time).getTime() : schedMs;
          const t2 = (folder.repeat_post_enabled === 1 && p.custom_repeat_publish_time) ? new Date(p.custom_repeat_publish_time).getTime() : repeatSchedMs;
          return Math.max(t1, t2);
        });
        const finalTime = Math.max(schedMs, repeatSchedMs, ...participantTimes);
        
        // All parts done: if 0 active participants, done = true; otherwise all must have published post 1 AND post 2 (if enabled)
        const allPartsDone = activeParts.length === 0 || activeParts.every((p: any) => Number(p.post_published || 0) === 1 && (folder.repeat_post_enabled !== 1 || Number(p.repeat_post_published || 0) === 1));

        // In archive ONLY after the latest participant's scheduled time has arrived and all are published (including second post if enabled)
        if (allPartsDone && now.getTime() >= finalTime && folder.status !== 'archived') {
          db.run("UPDATE promo_folders SET status = 'archived', updated_at = ? WHERE id = ?", [nowIso, folder.id]);
          folder.status = 'archived';
          console.log(`[Cron] Folder ${folder.id} («${folder.title}») completed (all participant posts published including repeat post if enabled, or no participants) and moved to archive.`);
        } else if (now.getTime() >= schedMs && folder.status !== 'published' && folder.status !== 'archived') {
          db.run("UPDATE promo_folders SET status = 'published', updated_at = ? WHERE id = ?", [nowIso, folder.id]);
          folder.status = 'published';
        }
      }
      savePgDB();
    } catch (e) {
      console.error('[Cron Worker] Error processing promo folders:', e);
    }

    // 3. Check Selections older than 72h or completed -> ensure transitioned to 'archived'
    try {
      const threeDaysAgo = new Date(now.getTime() - 72 * 3600 * 1000).toISOString();
      const resRes = db.exec(`
        SELECT id, title FROM promo_selections
        WHERE (status = 'published' OR status = 'results') AND scheduled_at <= '${threeDaysAgo}'
      `);
      if (resRes.length > 0 && resRes[0].values.length > 0) {
        for (const row of resRes[0].values) {
          const selId = row[0];
          const title = row[1];
          db.run("UPDATE promo_selections SET status = 'archived', updated_at = ? WHERE id = ?", [nowIso, selId]);
          console.log(`[Cron] Selection ${selId} (${title}) transitioned to 'archived'.`);
        }
      }
    } catch (e) {}
  } catch (err) {
    // Non-critical background worker catch
  } finally {
    isPromoCronRunning = false;
  }
}
