import { flushPendingPgWrites, getPgDB, pgQuery, savePgDB } from './db/postgres';
import { DB, DayRequest, detectMessageFormat, getDefaultChannelIdentifier } from './db';
import { sendPromptToTelegram, sendPrivateTelegramNotification, buildReplyMarkup } from './telegram';
import { syncScheduledPublicationsForPost, generateScheduleSlotsForPost, renewAllActiveSchedules } from './scheduleGenerator';
import { executeDatabaseBackup } from './backup';
import { getNextMsk0600Iso } from './db/cronTable';
import { processDuePromoFoldersAndSelections } from './promoCron';
import {
  processDueScenarioCronTask,
  resolveFreshScheduledPublicationPayload,
  sharedScheduledPubLock
} from './scenarios/scenarioCronSync';
import { syncPublishedPostToPlatformBlog } from './social/blogFeedSyncHelper';
import {
  getZonedPartsInTimezone,
  isOneOffScheduleFrequency,
  isPublishedPostStatus,
  parseScheduleDateTimeInTimezone
} from './domains/posts/postStatusHelpers';
import { createNotificationInDb } from './db/notificationsTable';
import {
  acquireEntityPublishSlot,
  canonicalizeTelegramTarget,
  finalizePublishDedup,
  isDefiniteClientFailure,
  isPostRecentlyPublished
} from './telegram/publishDedupGuard';

const WORKER_BOOT_TIMESTAMP_MS = Date.now();
let lastScheduleHorizonRenewalMs = 0;
let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;
const inProgressPostCronIds = new Set<string>();

/**
 * Calculates the next run ISO timestamp for a cron schedule
 */
export function computeNextRunTimestamp(schedule: any, userTimezone: string = 'Europe/Moscow'): { nextRunIso: string; isCompleted: boolean } {
  const now = new Date();
  if (!schedule || schedule.enabled === false) {
    return { nextRunIso: now.toISOString(), isCompleted: true };
  }

  const frequency = String(
    schedule.frequency || (schedule.exactDateTime ? 'once' : 'daily')
  ).toLowerCase().trim();
  const tz = String(schedule.timezone || userTimezone || 'Europe/Moscow');
  const pad = (n: number) => String(n).padStart(2, '0');

  if (isOneOffScheduleFrequency(frequency)) {
    const parsedDt = parseScheduleDateTimeInTimezone(schedule.exactDateTime, tz);
    return { nextRunIso: (parsedDt || now).toISOString(), isCompleted: true };
  }

  if (frequency === 'interval_minutes' || frequency === 'minutes') {
    const mins = Math.max(1, Number(schedule.intervalMinutes || 15));
    let nextDate = new Date(now.getTime() + mins * 60 * 1000);

    if (schedule.sleepModeEnabled && schedule.sleepStartTime && schedule.sleepEndTime) {
      const [sH, sM] = String(schedule.sleepStartTime).split(':').map(Number);
      const [eH, eM] = String(schedule.sleepEndTime).split(':').map(Number);
      const zNext = getZonedPartsInTimezone(nextDate, tz);
      const curTotal = zNext.hours * 60 + zNext.minutes;
      const sTotal = (sH || 23) * 60 + (sM || 0);
      const eTotal = (eH || 8) * 60 + (eM || 0);

      const inSleep = sTotal <= eTotal
        ? (curTotal >= sTotal && curTotal < eTotal)
        : (curTotal >= sTotal || curTotal < eTotal);

      if (inSleep) {
        let wakeSlot = parseScheduleDateTimeInTimezone(
          `${zNext.year}-${pad(zNext.month)}-${pad(zNext.day)}T${pad(eH || 8)}:${pad(eM || 0)}`,
          tz
        );
        if (wakeSlot && wakeSlot.getTime() <= now.getTime()) {
          wakeSlot = new Date(wakeSlot.getTime() + 24 * 60 * 60 * 1000);
        }
        if (wakeSlot) nextDate = wakeSlot;
      }
    }

    return { nextRunIso: nextDate.toISOString(), isCompleted: false };
  }

  if (frequency === 'interval_hours' || frequency === 'hours') {
    const hrs = Math.max(1, Number(schedule.intervalHours || 2));
    const nextDate = new Date(now.getTime() + hrs * 3600 * 1000);
    return { nextRunIso: nextDate.toISOString(), isCompleted: false };
  }

  if (frequency === 'daily' || frequency === 'dayofweek' || frequency === 'weekly') {
    const timeStr = String(schedule.time || '09:00');
    const [hh, mm] = timeStr.split(':').map(Number);
    const h = Number.isNaN(hh) ? 9 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    const zNow = getZonedPartsInTimezone(now, tz);
    let slot = parseScheduleDateTimeInTimezone(
      `${zNow.year}-${pad(zNow.month)}-${pad(zNow.day)}T${pad(h)}:${pad(m)}`,
      tz
    );
    const stepDays = frequency === 'daily' ? 1 : 7;
    if (slot && slot.getTime() <= now.getTime()) {
      slot = new Date(slot.getTime() + stepDays * 24 * 60 * 60 * 1000);
    }
    return { nextRunIso: (slot || new Date(now.getTime() + 86400000)).toISOString(), isCompleted: false };
  }

  if (frequency === 'monthly') {
    const timeStr = String(schedule.time || '09:00');
    const dom = Math.min(28, Math.max(1, Number(schedule.dayOfMonth || 1)));
    const [hh, mm] = timeStr.split(':').map(Number);
    const h = Number.isNaN(hh) ? 9 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    const zNow = getZonedPartsInTimezone(now, tz);
    let targetMonth = zNow.month;
    let targetYear = zNow.year;
    let slot = parseScheduleDateTimeInTimezone(
      `${targetYear}-${pad(targetMonth)}-${pad(dom)}T${pad(h)}:${pad(m)}`,
      tz
    );
    if (slot && slot.getTime() <= now.getTime()) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      slot = parseScheduleDateTimeInTimezone(
        `${targetYear}-${pad(targetMonth)}-${pad(dom)}T${pad(h)}:${pad(m)}`,
        tz
      );
    }
    return { nextRunIso: (slot || new Date(now.getTime() + 86400000)).toISOString(), isCompleted: false };
  }

  return { nextRunIso: new Date(now.getTime() + 86400000).toISOString(), isCompleted: false };
}

/**
 * Executes a database backup cron job strictly inside the 06:00-06:30 MSK window
 */
async function processDueBackupTask(cronRow: any, db: any) {
  const cronId = cronRow.id;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  // 06:00 MSK == 03:00 UTC. Only allow automatic cron firing inside 03:00..03:29 UTC.
  const isInsideScheduledWindow = utcHour === 3 && utcMinute < 30;
  const nextRunIso = getNextMsk0600Iso();

  if (!isInsideScheduledWindow) {
    try {
      db.run(
        "UPDATE cron SET next_run = ?, status = 'active' WHERE id = ?",
        [nextRunIso, cronId]
      );
      savePgDB();
      console.log(`[Centralized Cron Worker] Skipped overdue backup outside 06:00 MSK window; rescheduled to ${nextRunIso}`);
    } catch (e) {}
    return;
  }

  try {
    console.log(`[Centralized Cron Worker] Executing scheduled daily 06:00 MSK Telegram database backup (ID: ${cronId})...`);
    // Persist next_run BEFORE awaiting network upload so no concurrent tick or restart can double-fire
    const startedIso = now.toISOString();
    db.run(
      "UPDATE cron SET status = 'active', next_run = ? WHERE id = ?",
      [nextRunIso, cronId]
    );
    savePgDB();

    const backupRes = await executeDatabaseBackup('Автоматический ежедневный бэкап по расписанию 06:00 МСК');

    if (backupRes.success && !backupRes.skipped) {
      db.run(
        "UPDATE cron SET last_run = ?, next_run = ?, status = 'active' WHERE id = ?",
        [startedIso, nextRunIso, cronId]
      );
      savePgDB();
      console.log(`[Centralized Cron Worker] Backup successfully sent! Next run scheduled at: ${nextRunIso}`);
    }
  } catch (err) {
    console.error(`[Centralized Cron Worker] Error executing backup cron task ${cronId}:`, err);
    try {
      db.run(
        "UPDATE cron SET status = 'active', next_run = ? WHERE id = ?",
        [nextRunIso, cronId]
      );
      savePgDB();
    } catch (e) {}
  }
}

/**
 * Checks tariffs expiration, charges renewals, and sends notifications
 */
export async function processDueTariffsTask(cronRow?: any) {
  try {
    const db = await getPgDB();
    const { processTariffsCronLifecycle } = await import('./tariffs/tariffLifecycle');
    const { checkAndApplyMonthlyTariffs } = await import('./db/index');

    const lifecycleRes = await processTariffsCronLifecycle(
      db,
      (tgId, htmlText, meta) => sendPrivateTelegramNotification(Number(tgId), htmlText, undefined, meta)
    );
    checkAndApplyMonthlyTariffs(db);

    const processedCount = lifecycleRes.renewed + lifecycleRes.downgraded + lifecycleRes.warned;
    const { getNextMskTimeIso } = await import('./db/cronTable');
    const nextRun = getNextMskTimeIso(0, 5);
    if (cronRow) {
      db.run(
        "UPDATE cron SET last_run = datetime('now'), next_run = ?, status = 'active' WHERE id = ?",
        [nextRun, cronRow.id]
      );
    }
    savePgDB();
    return {
      success: true,
      processedCount,
      ...lifecycleRes,
      message: `Проверены тарифы: продлено ${lifecycleRes.renewed}, переведено на Старт ${lifecycleRes.downgraded}, предупреждений ${lifecycleRes.warned}.`
    };
  } catch (err) {
    console.error('[Centralized Cron Worker] Error in processDueTariffsTask:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Executes a single due post publication task
 */
async function processDuePostTask(cronRow: any, db: any) {
  const cronId = String(cronRow.id || '');
  const postId = String(cronRow.item_id || '').trim();

  if (
    !postId ||
    postId.startsWith('pub_cron_') ||
    postId.startsWith('pub_') ||
    postId.startsWith('sched_') ||
    postId.startsWith('blog_') ||
    /^\d{12,}$/.test(postId)
  ) {
    try {
      db.run('DELETE FROM cron WHERE id = ?', [cronId]);
      savePgDB();
    } catch {}
    return;
  }

  if (inProgressPostCronIds.has(postId)) return;
  inProgressPostCronIds.add(postId);

  try {
    const post = DB.getDayRequests().find(p => String(p.id) === postId);
    if (!post) {
      db.run("UPDATE cron SET status = 'error_not_found' WHERE id = ?", [cronId]);
      savePgDB();
      return;
    }

    const schedule: any = post.triggerSchedule || {};
    const postStatusLower = String(post.status || '').toLowerCase().trim();
    const isFailedOneOff =
      (postStatusLower === 'ошибка' || postStatusLower === 'failed' || postStatusLower === 'error') &&
      isOneOffScheduleFrequency(schedule.frequency);
    const alreadyFinishedOneOff =
      (isPublishedPostStatus(post.status) || isFailedOneOff) && isOneOffScheduleFrequency(schedule.frequency);

    if (schedule.enabled !== true || alreadyFinishedOneOff) {
      db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
      savePgDB();
      return;
    }

    const { nextRunIso, isCompleted } = computeNextRunTimestamp(schedule, (schedule as any).timezone || 'Europe/Moscow');
    const newStatus = isCompleted ? 'completed' : 'active';

    const rawSched = cronRow.next_run ? String(cronRow.next_run) : '';
    const schedMs = rawSched ? Date.parse(rawSched.includes('T') ? rawSched : `${rawSched.replace(' ', 'T')}Z`) : 0;
    const lateByMs = Date.now() - schedMs;
    const isRecurringPreBoot = !isCompleted && schedMs < (WORKER_BOOT_TIMESTAMP_MS - 2 * 60 * 1000);
    const isStalePreBoot = !schedMs || Number.isNaN(schedMs) || isRecurringPreBoot || lateByMs > 15 * 60 * 1000;

    if (isStalePreBoot) {
      if (isCompleted) {
        db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
      } else {
        db.run('UPDATE cron SET next_run = ?, status = ? WHERE id = ?', [nextRunIso, newStatus, cronId]);
      }
      savePgDB();
      return;
    }

    if (isCompleted && (await isPostRecentlyPublished(postId, 15 * 60 * 1000))) {
      db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
      savePgDB();
      console.log(`[Cron Worker] One-off post ${postId} already published recently; skipping duplicate execution.`);
      return;
    }

    // Fail-closed PostgreSQL cron claim
    let pgClaimVerified = false;
    try {
      if (isCompleted) {
        const postPg = await pgQuery<{ status: string }>(
          'SELECT status FROM posts WHERE id = $1 LIMIT 1',
          [postId],
          { safeMode: false, retries: 1 }
        );
        const pgSt = String(postPg.rows[0]?.status || '').toLowerCase().trim();
        if (pgSt && (isPublishedPostStatus(pgSt) || pgSt === 'ошибка' || pgSt === 'failed')) {
          db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
          savePgDB();
          return;
        }
      }
      const claimRes = await pgQuery<{ id: string }>(
        `UPDATE cron SET status = 'processing', last_run = $1 WHERE id = $2 AND status = 'active' RETURNING id`,
        [new Date().toISOString(), cronId],
        { safeMode: false, retries: 1 }
      );
      if (claimRes.rows.length === 0) {
        const existsRes = await pgQuery<{ id: string }>('SELECT id FROM cron WHERE id = $1 LIMIT 1', [cronId], {
          safeMode: false,
          retries: 1
        });
        if (existsRes.rows.length > 0) {
          db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
          savePgDB();
          console.log(`[Cron Worker] Post task ${cronId} already claimed in PostgreSQL; skipping duplicate send.`);
          return;
        }
      }
      pgClaimVerified = true;
    } catch (claimErr: any) {
      console.warn(`[Cron Worker] PG claim check failed (${cronId}):`, claimErr?.message);
    }

    const channels = (post.channels && post.channels.length > 0) ? post.channels : [post.channel || '@SAV_AI'];
    const canonicalChannelList = channels.map((c) => canonicalizeTelegramTarget(c)).sort().join(',');
    const slotStamp = Math.floor((schedMs || Date.now()) / 60000);
    const entitySlotKey = isCompleted ? `post_once:${postId}` : `post_slot:${postId}:${slotStamp}`;
    const entitySlot = await acquireEntityPublishSlot({
      slotKey: entitySlotKey,
      entityType: 'post',
      entityId: postId,
      channelKey: canonicalChannelList
    });
    if (!entitySlot.claimed) {
      if (isCompleted) {
        db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
        savePgDB();
      }
      console.warn(`[Cron Worker] Entity slot blocked for post ${postId} (${entitySlot.reason}); skipping duplicate send.`);
      return;
    }
    if (!pgClaimVerified) {
      console.log(`[Cron Worker] Proceeding with persistent dedup slot lock ${entitySlot.dedupKey} for post ${postId}.`);
    }

    // Persist next_run/completed BEFORE awaiting Telegram delivery so concurrent ticks/restarts never duplicate
    db.run(
      "UPDATE cron SET last_run = datetime('now'), next_run = ?, status = ? WHERE id = ?",
      [nextRunIso, newStatus, cronId]
    );
    savePgDB();
    await flushPendingPgWrites(5000);

    const text = post.postText || post.requestTemplate || '';
    const title = post.title || 'Автопубликация';
    const format = detectMessageFormat(text, post.messageFormat);

    console.log(`[Centralized Cron Worker] Executing auto-publish for post "${title}" (ID: ${postId}) to [${channels.join(', ')}]...`);

    let pubResult: any = { ok: false, error: 'Не удалось выполнить отправку' };
    try {
      pubResult = await sendPromptToTelegram(
        title,
        text,
        post,
        {
          messageFormat: format,
          uppercaseHeader: post.uppercaseHeader !== false,
          signature: post.signature || '',
          linkPreviewEnabled: post.linkPreviewEnabled !== false,
          protectContent: Boolean((post as any).protectContent),
          attachmentType: (post.attachmentType as any) || 'none',
          audioFormat: (post as any).audioFormat || (post.attachmentType === 'voice' ? 'voice' : 'audio'),
          audioTitle: (post as any).audioTitle,
          audioPerformer: (post as any).audioPerformer,
          attachmentUrl: post.attachmentUrl,
          attachmentUrls: post.attachmentUrls,
          inlineButtons: post.inlineButtons,
          channels
        }
      );
    } finally {
      const outcome = pubResult?.ok
        ? 'sent'
        : isCompleted
        ? 'ambiguous_timeout'
        : isDefiniteClientFailure(pubResult?.error || '')
        ? 'definite_failure'
        : 'ambiguous_timeout';
      await finalizePublishDedup([entitySlot.dedupKey], outcome, pubResult?.messageId);
    }

    const nowIso = new Date().toISOString();

    // For completed one-off schedules, explicitly set enabled: false so syncPostCronTask never reactivates the cron task
    await DB.updateDayRequestAsync(postId, {
      status: pubResult.ok ? (isCompleted ? 'опубликован' : 'запланирован') : (isCompleted ? 'ошибка' : 'запланирован'),
      publishedAt: pubResult.ok ? nowIso : undefined,
      triggerSchedule: isCompleted ? { ...schedule, enabled: false } : schedule
    });

    db.run(
      'UPDATE cron SET status = ?, next_run = ? WHERE id = ?',
      [newStatus, nextRunIso, cronId]
    );

    if (isCompleted) {
      try {
        DB.getPublications()
          .filter((p) => (String(p.id) === postId || String(p.promptId) === postId) && p.statusType === 'scheduled')
          .forEach((p) => {
            DB.updatePublication(p.id, {
              status: pubResult.ok,
              statusType: pubResult.ok ? 'published' : 'failed',
              publishedAt: nowIso,
              messageId: pubResult.messageId,
              response: pubResult.ok ? 'Успешно опубликовано по расписанию' : (pubResult.error || 'Ошибка отправки')
            });
          });
      } catch {}
    }

    // Record execution in publication history with disabled triggerSchedule (never loops back into cron)
    const newPubId = `pub_cron_${postId}_${Date.now()}`;
    const pubEntry = {
      id: newPubId,
      userId: post.userId || '',
      promptId: postId,
      promptTitle: title,
      category: post.category || 'автопостинг',
      text,
      channel: channels.join(', '),
      messageId: pubResult.messageId ? String(pubResult.messageId) : undefined,
      status: pubResult.ok,
      statusType: (pubResult.ok ? 'published' : 'failed') as 'published' | 'failed',
      publishedAt: nowIso,
      response: pubResult.ok ? 'Успешно опубликовано по расписанию' : (pubResult.error || 'Ошибка отправки'),
      messageFormat: format,
      attachmentType: (post.attachmentType as any) || 'none',
      audioFormat: (post as any).audioFormat || (post.attachmentType === 'voice' ? 'voice' : 'audio'),
      audioTitle: (post as any).audioTitle,
      audioPerformer: (post as any).audioPerformer,
      protectContent: Boolean((post as any).protectContent),
      linkPreviewEnabled: post.linkPreviewEnabled !== false,
      attachmentUrl: post.attachmentUrl,
      attachmentUrls: post.attachmentUrls,
      inlineButtons: post.inlineButtons,
      signature: post.signature,
      uppercaseHeader: post.uppercaseHeader !== false,
      triggerSchedule: { enabled: false },
      publishToSocialFeed: post.publishToSocialFeed
    };

    DB.addPublication(pubEntry);

    if (pubResult.ok && post.publishToSocialFeed !== false) {
      syncPublishedPostToPlatformBlog({
        sourcePostId: postId,
        userId: post.userId,
        title,
        content: text,
        attachmentType: post.attachmentType,
        attachmentUrl: post.attachmentUrl,
        attachmentUrls: post.attachmentUrls,
        inlineButtons: post.inlineButtons,
        messageFormat: format,
        category: post.category || 'news',
        channel: channels[0] || 'Telegram',
        prompt: post.requestTemplate || title
      });
    }

    if (post.userId) {
      try {
        createNotificationInDb(db, {
          userId: String(post.userId),
          type: 'publish',
          title: pubResult.ok
            ? `Пост «${title}» опубликован`
            : `Ошибка отправки поста «${title}»`,
          message: pubResult.ok
            ? `Публикация отправлена по расписанию в каналы: ${channels.join(', ')}.`
            : `Не удалось отправить пост по расписанию (${channels.join(', ')}): ${pubResult.error || 'Ошибка отправки'}.`,
          link: pubResult.ok ? '/history' : `/posts/${postId}`
        });
      } catch {}
    }

    if ((schedule as any).notifyUser && post.userId) {
      const user = DB.getUsers().find(u => u.id === post.userId);
      const tgId = user?.telegramId;
      if (tgId) {
        sendPrivateTelegramNotification(
          tgId,
          `🤖 <b>Автопубликация выполнена!</b>\n\nПост: «${title}»\nКаналы: ${channels.join(', ')}\nФормат: ${format === 'rich' ? 'Rich HTML' : 'Markdown V2'}\nСтатус: ${pubResult.ok ? 'Успешно' : 'Ошибка'}`,
          undefined,
          { userId: String(post.userId), category: 'publish', title: 'Автопубликация' }
        ).catch(() => null);
      }
    }

    savePgDB();
  } catch (err: any) {
    console.error(`[Centralized Cron Worker] Error processing post task ${cronId}:`, err);
  } finally {
    inProgressPostCronIds.delete(postId);
  }
}

// Concurrency guard to prevent parallel overlapping runs of identical publications
const inProgressPubIds = new Set<string>();

/**
 * Checks and executes any individual scheduled publications (from Calendar queue)
 */
async function processDueScheduledPublications() {
  try {
    const allPubs = DB.getPublications();
    const now = new Date();

    const duePubs = allPubs.filter(p => {
      if (p.statusType !== 'scheduled') return false;
      if (
        String(p.id).startsWith('folder_') ||
        String(p.id).startsWith('sel_') ||
        String(p.promptId).startsWith('folder_') ||
        String(p.promptId).startsWith('sel_') ||
        p.category === 'Подборки' ||
        p.category === 'Папки'
      ) {
        return false;
      }
      if (inProgressPubIds.has(p.id) || sharedScheduledPubLock.has(p.id)) {
        return false;
      }
      const schedTime = new Date(p.scheduledFor || p.publishedAt);
      return schedTime.getTime() <= now.getTime();
    });

    if (duePubs.length === 0) return;

    const dbPg = await getPgDB();
    for (const pub of duePubs) {
      if (inProgressPubIds.has(pub.id) || sharedScheduledPubLock.has(pub.id)) continue;

      // Never double-execute if cron_post_<promptId> owns this post OR if it was already published recently
      const candidatePostId = pub.promptId || pub.id;
      if (candidatePostId) {
        try {
          const ownCheck = dbPg.exec('SELECT status FROM cron WHERE id = ? LIMIT 1', [`cron_post_${candidatePostId}`]);
          const ownStatus = ownCheck?.[0]?.values?.[0]?.[0]
            ? String(ownCheck[0].values[0][0]).toLowerCase()
            : '';
          if (String(pub.id).startsWith('sched_') && ownCheck.length > 0 && ownCheck[0].values.length > 0) {
            DB.updatePublication(pub.id, {
              status: false,
              statusType: 'cancelled',
              response: 'Управляется основным расписанием поста'
            });
            continue;
          }
          if (ownStatus === 'active' || ownStatus === 'processing' || ownStatus === 'completed') {
            DB.updatePublication(pub.id, {
              status: false,
              statusType: 'cancelled',
              response: 'Управляется основным расписанием поста'
            });
            continue;
          }
        } catch {}

        if (await isPostRecentlyPublished(String(candidatePostId), 15 * 60 * 1000)) {
          DB.updatePublication(pub.id, {
            status: false,
            statusType: 'cancelled',
            response: 'Дубликат: пост уже недавно опубликован'
          });
          continue;
        }
      }

      try {
        const pubClaim = await pgQuery<{ id: string }>(
          `UPDATE publications SET status_type = 'processing' WHERE id = $1 AND status_type = 'scheduled' RETURNING id`,
          [pub.id],
          { safeMode: false, retries: 1 }
        );
        if (pubClaim.rows.length === 0) {
          const pubExists = await pgQuery<{ id: string }>('SELECT id FROM publications WHERE id = $1 LIMIT 1', [pub.id], {
            safeMode: false,
            retries: 1
          });
          if (pubExists.rows.length > 0) {
            DB.updatePublication(pub.id, { status: false, statusType: 'cancelled', response: 'Обработано другим инстансом' });
            continue;
          }
        }
      } catch (pgErr: any) {
        if (/duplicate|conflict|constraint/i.test(String(pgErr?.message || ''))) {
          continue;
        }
      }

      const pubSlot = await acquireEntityPublishSlot({
        slotKey: `pub_exec:${pub.id}`,
        entityType: 'pub',
        entityId: String(candidatePostId || pub.id),
        channelKey: String(pub.channel || '')
      });
      if (!pubSlot.claimed) {
        DB.updatePublication(pub.id, {
          status: false,
          statusType: 'cancelled',
          response: 'Дубликат публикации заблокирован защитой'
        });
        continue;
      }

      inProgressPubIds.add(pub.id);
      sharedScheduledPubLock.add(pub.id);

      try {
        const fresh = resolveFreshScheduledPublicationPayload(pub);
        if (fresh.cancelled) {
          await finalizePublishDedup([pubSlot.dedupKey], 'definite_failure');
          DB.updatePublication(pub.id, {
            status: false,
            statusType: 'cancelled',
            response: fresh.cancelReason || 'Отменено автором'
          });
          continue;
        }

        if (!fresh.text.trim() && !fresh.attachmentUrl.trim() && fresh.attachmentUrls.length === 0) {
          await finalizePublishDedup([pubSlot.dedupKey], 'definite_failure');
          DB.updatePublication(pub.id, {
            status: false,
            statusType: 'cancelled',
            response: 'Текст и вложения публикации пусты'
          });
          continue;
        }

        const format = detectMessageFormat(fresh.text, fresh.messageFormat);
        console.log(`[Centralized Cron Worker] Publishing due scheduled queue item "${fresh.title}" (ID: ${pub.id}) to [${fresh.targetChannels.join(', ')}]...`);

        const effectiveReq: DayRequest = fresh.parentPost || {
          id: pub.promptId || pub.id,
          title: fresh.title,
          category: (pub as any).category || 'автопостинг',
          dayOfWeek: 'Сегодня',
          requestTemplate: fresh.text,
          channel: fresh.targetChannels[0] || getDefaultChannelIdentifier(),
          channels: fresh.targetChannels,
          messageFormat: format,
          signature: fresh.signature
        };

        let res: any = { ok: false, error: 'Не удалось отправить' };
        try {
          res = await sendPromptToTelegram(
            fresh.title,
            fresh.text,
            effectiveReq,
            {
              messageFormat: format,
              uppercaseHeader: fresh.uppercaseHeader,
              signature: fresh.signature,
              linkPreviewEnabled: fresh.parentPost?.linkPreviewEnabled ?? (pub as any).linkPreviewEnabled ?? true,
              protectContent: Boolean((fresh.parentPost as any)?.protectContent ?? (pub as any).protectContent),
              attachmentType: fresh.attachmentType as any,
              audioFormat: fresh.audioFormat,
              audioTitle: (fresh.parentPost as any)?.audioTitle ?? (pub as any).audioTitle,
              audioPerformer: (fresh.parentPost as any)?.audioPerformer ?? (pub as any).audioPerformer,
              attachmentUrl: fresh.attachmentUrl,
              attachmentUrls: fresh.attachmentUrls,
              inlineButtons: fresh.inlineButtons,
              channels: fresh.targetChannels
            }
          );
        } finally {
          await finalizePublishDedup(
            [pubSlot.dedupKey],
            res?.ok ? 'sent' : 'ambiguous_timeout',
            res?.messageId
          );
        }

        const nowIso = new Date().toISOString();
        DB.updatePublication(pub.id, {
          promptTitle: fresh.title,
          text: fresh.text,
          channel: fresh.targetChannels.join(', '),
          status: res.ok,
          statusType: res.ok ? 'published' : 'failed',
          publishedAt: nowIso,
          messageId: res.messageId,
          response: res.ok ? 'Успешно отправлено по расписанию' : (res.error || 'Ошибка отправки'),
          messageFormat: format,
          attachmentType: fresh.attachmentType as any,
          audioFormat: fresh.audioFormat,
          attachmentUrl: fresh.attachmentUrl,
          attachmentUrls: fresh.attachmentUrls,
          inlineButtons: fresh.inlineButtons,
          signature: fresh.signature
        });

        if (res.ok && fresh.parentPost) {
          const parentFreq = fresh.parentPost.triggerSchedule?.frequency;
          const parentOneOff = !parentFreq || isOneOffScheduleFrequency(parentFreq);
          await DB.updateDayRequestAsync(fresh.parentPost.id, {
            publishedAt: nowIso,
            status: parentOneOff ? 'опубликован' : 'запланирован'
          });
        }

        if (res.ok && fresh.publishToSocialFeed !== false) {
          syncPublishedPostToPlatformBlog({
            sourcePostId: fresh.parentPost?.id || pub.promptId || pub.id,
            userId: fresh.parentPost?.userId || pub.userId,
            title: fresh.title,
            content: fresh.text,
            attachmentType: fresh.attachmentType,
            attachmentUrl: fresh.attachmentUrl,
            attachmentUrls: fresh.attachmentUrls,
            inlineButtons: fresh.inlineButtons,
            messageFormat: format,
            category: fresh.parentPost?.category || (pub as any).category || 'Сценарии',
            channel: fresh.targetChannels[0] || 'Telegram',
            prompt: fresh.parentPost?.requestTemplate || fresh.title
          });
        }
      } finally {
        inProgressPubIds.delete(pub.id);
        sharedScheduledPubLock.delete(pub.id);
      }
    }
  } catch (err) {
    console.error('[Centralized Cron Worker] Error in processDueScheduledPublications:', err);
  }
}

/**
 * Main Centralized Cron Worker Heartbeat Tick
 */
export async function tickCentralizedCronWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const db = await getPgDB();

    // 1. Fetch due active cron tasks from PostgreSQL in a single batched query
    const res = db.exec(`
      SELECT * FROM cron 
      WHERE status = 'active' 
        AND next_run IS NOT NULL 
        AND (next_run <= datetime('now') OR next_run <= '${new Date().toISOString()}')
      ORDER BY next_run ASC
      LIMIT 25
    `);

    if (res.length > 0 && res[0].values.length > 0) {
      const columns = res[0].columns;
      const rows = res[0].values.map((vArr: any[]) => {
        const obj: Record<string, any> = {};
        columns.forEach((c: string, i: number) => { obj[c] = vArr[i]; });
        return obj;
      });

      for (const task of rows) {
        if (task.item_type === 'post') {
          await processDuePostTask(task, db);
        } else if (task.item_type === 'backup' || task.id === 'cron_backup_daily_0600_msk') {
          await processDueBackupTask(task, db);
        } else if (task.item_type === 'tariffs' || task.id === 'cron_tariffs_checker') {
          await processDueTariffsTask(task);
        } else if (task.item_type === 'scenery') {
          await processDueScenarioCronTask(task, db);
        } else if (task.item_type === 'autopost' || task.id === 'cron_autopost_dispatcher') {
          try {
            db.run("UPDATE cron SET last_run = datetime('now'), next_run = datetime('now', '+1 minute') WHERE id = ?", [task.id]);
            savePgDB();
          } catch (e) {}
          await processDueScheduledPublications();
        }
      }
    }

    // 2. Auto-renew 30-day schedule horizon every 30 minutes (unified single scheduler)
    if (Date.now() - lastScheduleHorizonRenewalMs > 30 * 60 * 1000) {
      lastScheduleHorizonRenewalMs = Date.now();
      try {
        renewAllActiveSchedules();
      } catch (e) {}
    }

    // 3. Process Promo Folders & Selections (1-hour bot checks, publish, 72h results)
    await processDuePromoFoldersAndSelections(db);

  } catch (err) {
    console.error('[Centralized Cron Worker] Heartbeat tick error:', err);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Initializes the unified central cron heartbeat in the Node.js process
 */
export function startCentralizedCronWorker(intervalMs: number = 30000) {
  if (workerInterval) {
    clearInterval(workerInterval);
  }

  console.log(`[Centralized Cron Worker] Started! Single heartbeat running every ${intervalMs / 1000}s for all users and posts.`);

  // Initial tick after 3 seconds
  setTimeout(() => {
    tickCentralizedCronWorker().catch(() => null);
  }, 3000);

  // Recurring tick
  workerInterval = setInterval(() => {
    tickCentralizedCronWorker().catch(() => null);
  }, intervalMs);
}
