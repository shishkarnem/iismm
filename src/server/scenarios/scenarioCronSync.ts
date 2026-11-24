import { DB, getDefaultChannelIdentifier } from '../db';
import { flushPendingPgWrites, getPgDB, pgQuery, savePgDB } from '../db/postgres';
import { getScenarioByIdFromDb, upsertScenarioInDb } from '../db/sceneriesTable';
import { runFullScenarioGraphExecution } from './scenarioGraphRunner';
import {
  computeScenarioNextRunFromTrigger,
  computeScenarioSlotKey,
  parseSqlTimestampMs,
  reconcileScenarioCronsInDb
} from './scenarioScheduleCalc';
import { markDueOnceRulesCompletedOnScenario } from './schedule/multiScheduleEngine';
import { isOneOffScheduleFrequency, isPublishedPostStatus } from '../domains/posts/postStatusHelpers';

export {
  computeScenarioNextRunFromTrigger,
  computeScenarioSlotKey,
  reconcileScenarioCronsInDb
};

const SERVER_BOOT_TIMESTAMP_MS = Date.now();
const MAX_CRON_LATENESS_MS = 15 * 60 * 1000;
const inFlightScenarioIds = new Set<string>();
export const sharedScheduledPubLock = new Set<string>();

export async function syncScenarioCronEntry(scenario: any): Promise<void> {
  if (!scenario?.id) return;
  try {
    const db = await getPgDB();
    const existing = getScenarioByIdFromDb(db, String(scenario.id));
    const merged = existing ? { ...existing, ...scenario } : scenario;
    const calc = computeScenarioNextRunFromTrigger(merged, new Date());
    const cronId = `cron_scen_${merged.id}`;

    // Clean any legacy non-canonical cron rows for the same scenario ID
    db.run(
      'DELETE FROM cron WHERE item_type = ? AND item_id = ? AND id != ?',
      ['scenery', String(merged.id), cronId]
    );

    if (!calc.hasScheduleTrigger) {
      db.run('DELETE FROM cron WHERE id = ?', [cronId]);
      upsertScenarioInDb(db, {
        ...merged,
        schedule: 'Ручной запуск',
        nextRunAt: null
      });
      savePgDB();
      return;
    }

    if (calc.isCompletedOnce) {
      db.run(
        `INSERT OR REPLACE INTO cron (
          id, item_type, item_id, title, cron_expression, schedule_human, next_run, last_run, status, created_at
        ) VALUES (?, 'scenery', ?, ?, ?, ?, NULL, ?, 'completed', ?)`,
        [
          cronId,
          String(merged.id),
          `Автосценарий: ${merged.name || 'Сценарий'}`,
          calc.cronExpr,
          calc.humanSchedule,
          merged.lastRunAt || null,
          merged.createdAt || new Date().toISOString()
        ]
      );
      upsertScenarioInDb(db, {
        ...merged,
        enabled: false,
        isSent: true,
        lastRunSlot: 'once',
        lastStatus: 'completed',
        schedule: calc.humanSchedule,
        nextRunAt: null
      });
      savePgDB();
      return;
    }

    const isActive = merged.enabled !== false && calc.hasScheduleTrigger;

    db.run(
      `INSERT OR REPLACE INTO cron (
        id, item_type, item_id, title, cron_expression, schedule_human, next_run, last_run, status, created_at
      ) VALUES (?, 'scenery', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cronId,
        String(merged.id),
        `Автосценарий: ${merged.name || 'Сценарий'}`,
        calc.cronExpr,
        calc.humanSchedule,
        calc.nextRunIso,
        merged.lastRunAt || null,
        isActive ? 'active' : 'paused',
        merged.createdAt || new Date().toISOString()
      ]
    );

    upsertScenarioInDb(db, {
      ...merged,
      schedule: calc.humanSchedule,
      nextRunAt: calc.nextRunIso
    });
    savePgDB();

    try {
      DB.updateScenario(merged.id, {
        schedule: calc.humanSchedule,
        nextRunAt: calc.nextRunIso || undefined
      });
    } catch {}
  } catch (err) {
    console.error('[Scenario Cron Sync] Error syncing scenario cron entry:', err);
  }
}

export async function removeScenarioCronEntry(scenarioId: string): Promise<void> {
  if (!scenarioId) return;
  try {
    const db = await getPgDB();
    db.run('DELETE FROM cron WHERE id = ? OR (item_type = ? AND item_id = ?)', [
      `cron_scen_${scenarioId}`,
      'scenery',
      scenarioId
    ]);
    savePgDB();
  } catch (err) {
    console.error('[Scenario Cron Sync] Error removing scenario cron entry:', err);
  }
}

export async function processDueScenarioCronTask(cronRow: any, db: any): Promise<void> {
  const cronId = String(cronRow?.id || '');
  const itemId = String(cronRow?.item_id || '');

  // Maintenance scenarios runner row: reconcile without resetting future next_run slots
  if (itemId === 'sys_scenarios_runner' || cronId === 'cron_scenarios_runner') {
    reconcileScenarioCronsInDb(db);
    const nextCheck = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run(
      "UPDATE cron SET last_run = datetime('now'), next_run = ?, status = 'active' WHERE id = ?",
      [nextCheck, cronId]
    );
    savePgDB();
    return;
  }

  if (!itemId || inFlightScenarioIds.has(itemId)) return;
  inFlightScenarioIds.add(itemId);

  try {
    const scen =
      getScenarioByIdFromDb(db, itemId) ||
      DB.getScenarios().find((s) => s.id === itemId);

    if (!scen || scen.enabled === false) {
      db.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
      savePgDB();
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const scheduledMs = parseSqlTimestampMs(cronRow?.next_run);
    const futureCalc = computeScenarioNextRunFromTrigger(
      scen,
      new Date(nowMs + 65 * 1000)
    );

    if (!futureCalc.hasScheduleTrigger) {
      db.run("UPDATE cron SET status = 'paused', next_run = NULL WHERE id = ?", [cronId]);
      savePgDB();
      return;
    }

    if (futureCalc.isCompletedOnce) {
      db.run("UPDATE cron SET status = 'completed', next_run = NULL WHERE id = ?", [cronId]);
      upsertScenarioInDb(db, {
        ...scen,
        enabled: false,
        isSent: true,
        lastRunSlot: 'once',
        lastStatus: 'completed',
        nextRunAt: null
      });
      savePgDB();
      return;
    }

    // 1. Never run catch-up scenarios whose scheduled time was BEFORE server boot or > 15m stale
    if (
      !scheduledMs ||
      scheduledMs < SERVER_BOOT_TIMESTAMP_MS ||
      nowMs - scheduledMs > MAX_CRON_LATENESS_MS
    ) {
      db.run(
        "UPDATE cron SET next_run = ?, status = 'active' WHERE id = ?",
        [futureCalc.nextRunIso, cronId]
      );
      upsertScenarioInDb(db, {
        ...scen,
        nextRunAt: futureCalc.nextRunIso
      });
      savePgDB();
      console.log(
        `[Scenario Cron] Skipped pre-boot/stale schedule for "${scen.name}" (${itemId}); next run set to ${futureCalc.nextRunIso}`
      );
      return;
    }

    // 2. Persistent DB completion & slot deduplication check
    const slotKey = computeScenarioSlotKey(scen, new Date(scheduledMs));
    const alreadyRanThisSlot = Boolean(scen.lastRunSlot && scen.lastRunSlot === slotKey);

    if (alreadyRanThisSlot) {
      db.run(
        "UPDATE cron SET next_run = ?, status = 'active' WHERE id = ?",
        [futureCalc.nextRunIso, cronId]
      );
      upsertScenarioInDb(db, {
        ...scen,
        lastRunSlot: slotKey,
        nextRunAt: futureCalc.nextRunIso
      });
      savePgDB();
      console.log(
        `[Scenario Cron] Scenario "${scen.name}" (${itemId}) already executed for slot ${slotKey}; rescheduled to ${futureCalc.nextRunIso}`
      );
      return;
    }

    // 3. Mark any due 'once' rules completed and compute next run across remaining active rules
    const scenAfterOnceMark = markDueOnceRulesCompletedOnScenario(scen, new Date(scheduledMs));
    const postOnceCalc = computeScenarioNextRunFromTrigger(
      scenAfterOnceMark,
      new Date(nowMs + 65 * 1000)
    );

    const startedIso = now.toISOString();
    const allDoneOnce = postOnceCalc.isCompletedOnce || futureCalc.isOnce;
    const postRunCronStatus = allDoneOnce ? 'completed' : 'active';
    const postRunNextIso = allDoneOnce ? null : postOnceCalc.nextRunIso;

    try {
      const claimRes = await pgQuery<{ id: string }>(
        `UPDATE sceneries
         SET last_run_slot = $1, next_run_at = $2, last_run_at = $3
         WHERE id = $4 AND (last_run_slot IS NULL OR last_run_slot <> $1)
         RETURNING id`,
        [slotKey, postRunNextIso, startedIso, itemId],
        { safeMode: false, retries: 1 }
      );
      const existsRes =
        claimRes.rows.length > 0
          ? { rows: claimRes.rows }
          : await pgQuery<{ id: string }>('SELECT id FROM sceneries WHERE id = $1 LIMIT 1', [itemId], {
              safeMode: false,
              retries: 1
            });
      if (existsRes.rows.length > 0 && claimRes.rows.length === 0) {
        db.run('UPDATE cron SET next_run = ?, status = ? WHERE id = ?', [
          postRunNextIso,
          postRunCronStatus,
          cronId
        ]);
        upsertScenarioInDb(db, {
          ...scenAfterOnceMark,
          lastRunSlot: slotKey,
          nextRunAt: postRunNextIso
        });
        savePgDB();
        console.log(
          `[Scenario Cron] Slot ${slotKey} for "${scen.name}" (${itemId}) already claimed in PostgreSQL; skipping duplicate run.`
        );
        return;
      }
    } catch (claimErr: any) {
      console.warn(`[Scenario Cron] PG slot claim skipped (${itemId}):`, claimErr?.message);
    }

    db.run(
      'UPDATE cron SET last_run = ?, next_run = ?, status = ? WHERE id = ?',
      [startedIso, postRunNextIso, postRunCronStatus, cronId]
    );
    upsertScenarioInDb(db, {
      ...scenAfterOnceMark,
      enabled: allDoneOnce ? false : scenAfterOnceMark.enabled,
      lastRunAt: startedIso,
      lastRunSlot: slotKey,
      schedule: postOnceCalc.humanSchedule || futureCalc.humanSchedule,
      nextRunAt: postRunNextIso,
      lastStatus: 'running'
    });
    savePgDB();
    await flushPendingPgWrites(5000);

    await runFullScenarioGraphExecution(itemId, scen.userId, undefined, undefined, {
      scheduledSlotKey: slotKey,
      nextRunIsoAfter: postRunNextIso
    });
  } catch (err: any) {
    console.error(`[Scenario Cron Sync] Error running scheduled scenario ${itemId}:`, err?.message);
    try {
      const fallbackNext = computeScenarioNextRunFromTrigger(
        getScenarioByIdFromDb(db, itemId) || { nodes: [] },
        new Date(Date.now() + 65 * 1000)
      ).nextRunIso || new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.run(
        "UPDATE cron SET last_run = datetime('now'), next_run = ?, status = 'active' WHERE id = ?",
        [fallbackNext, cronId]
      );
      savePgDB();
    } catch {}
  } finally {
    inFlightScenarioIds.delete(itemId);
  }
}

/**
 * Извлекает самые свежие данные черновика из dayRequests перед отправкой отложенной публикации!
 * Если автор отредактировал текст, медиа, кнопки или подпись в Черновиках в течение дня до времени публикации,
 * в Telegram уйдет именно свежая отредактированная версия.
 */
export function resolveFreshScheduledPublicationPayload(pub: any): {
  cancelled: boolean;
  cancelReason?: string;
  parentPost: any | null;
  title: string;
  text: string;
  targetChannels: string[];
  messageFormat: 'v2' | 'rich';
  attachmentType: string;
  audioFormat?: 'audio' | 'voice';
  attachmentUrl: string;
  attachmentUrls: string[];
  inlineButtons: any[];
  signature: string;
  uppercaseHeader: boolean;
  publishToSocialFeed: boolean;
} {
  const defaultChan = getDefaultChannelIdentifier();
  const dayRequests = DB.getDayRequests();
  const parentPost = pub.promptId
    ? dayRequests.find((r) => String(r.id) === String(pub.promptId)) || null
    : null;

  const parentSt = String(parentPost?.status || '').toLowerCase().trim();
  const parentFreq = parentPost?.triggerSchedule?.frequency;
  if (
    parentPost &&
    (!parentFreq || isOneOffScheduleFrequency(parentFreq)) &&
    (isPublishedPostStatus(parentSt) || parentSt === 'ошибка' || parentSt === 'failed' || parentSt === 'error')
  ) {
    return {
      cancelled: true,
      cancelReason: 'Публикация уже завершена',
      parentPost,
      title: pub.promptTitle || '',
      text: '',
      targetChannels: [defaultChan],
      messageFormat: 'v2',
      attachmentType: 'none',
      attachmentUrl: '',
      attachmentUrls: [],
      inlineButtons: [],
      signature: '',
      uppercaseHeader: false,
      publishToSocialFeed: false
    };
  }

  if (parentPost && parentPost.triggerSchedule?.enabled === false) {
    return {
      cancelled: true,
      cancelReason: 'Отменено пользователем в настройках поста',
      parentPost,
      title: pub.promptTitle || '',
      text: '',
      targetChannels: [defaultChan],
      messageFormat: 'v2',
      attachmentType: 'none',
      attachmentUrl: '',
      attachmentUrls: [],
      inlineButtons: [],
      signature: '',
      uppercaseHeader: false,
      publishToSocialFeed: false
    };
  }

  if (parentPost && (parentPost.status === 'отменен' || parentPost.status === 'cancelled')) {
    return {
      cancelled: true,
      cancelReason: 'Черновик отменен автором до момента публикации',
      parentPost,
      title: pub.promptTitle || '',
      text: '',
      targetChannels: [defaultChan],
      messageFormat: 'v2',
      attachmentType: 'none',
      attachmentUrl: '',
      attachmentUrls: [],
      inlineButtons: [],
      signature: '',
      uppercaseHeader: false,
      publishToSocialFeed: false
    };
  }

  const freshTitle = String(parentPost?.title || parentPost?.postTitle || pub.promptTitle || 'Пост');
  const freshText =
    parentPost && parentPost.postText !== undefined && parentPost.postText !== null
      ? String(parentPost.postText)
      : String(pub.text || '');

  const rawChannelsFromPost =
    Array.isArray(parentPost?.channels) && parentPost.channels.length > 0
      ? parentPost.channels
      : null;
  const targetChannels = rawChannelsFromPost
    ? rawChannelsFromPost.map((s: string) => String(s).trim()).filter(Boolean)
    : pub.channel
    ? String(pub.channel)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [defaultChan];

  const fmtRaw = parentPost?.messageFormat || pub.messageFormat || 'v2';
  const messageFormat: 'v2' | 'rich' = fmtRaw === 'rich' ? 'rich' : 'v2';

  const parentUrls =
    Array.isArray(parentPost?.attachmentUrls) && parentPost.attachmentUrls.length > 0
      ? parentPost.attachmentUrls
      : Array.isArray((parentPost as any)?.albumUrls) && (parentPost as any).albumUrls.length > 0
      ? (parentPost as any).albumUrls
      : null;

  const attachmentUrls: string[] = (parentUrls || pub.attachmentUrls || [])
    .map((u: any) => String(u || '').trim())
    .filter(Boolean);
  const attachmentUrl: string = String(
    (parentPost && parentPost.attachmentUrl !== undefined
      ? parentPost.attachmentUrl
      : pub.attachmentUrl) ||
      attachmentUrls[0] ||
      ''
  ).trim();

  const attachmentType = String(
    (parentPost && parentPost.attachmentType ? parentPost.attachmentType : pub.attachmentType) ||
      'none'
  );
  const audioFormat =
    (parentPost as any)?.audioFormat ||
    (parentPost as any)?.audio_format ||
    (pub as any)?.audioFormat ||
    undefined;

  const inlineButtons =
    parentPost && Array.isArray(parentPost.inlineButtons)
      ? parentPost.inlineButtons
      : pub.inlineButtons || [];

  const signature =
    parentPost && parentPost.signature !== undefined
      ? String(parentPost.signature || '')
      : String(pub.signature || '');

  const uppercaseHeader =
    parentPost && parentPost.uppercaseHeader !== undefined
      ? Boolean(parentPost.uppercaseHeader)
      : pub.uppercaseHeader !== false;

  const publishToSocialFeed =
    parentPost && parentPost.publishToSocialFeed !== undefined
      ? parentPost.publishToSocialFeed !== false
      : (pub as any).publishToSocialFeed !== false;

  return {
    cancelled: false,
    parentPost,
    title: freshTitle,
    text: freshText,
    targetChannels,
    messageFormat,
    attachmentType,
    audioFormat,
    attachmentUrl,
    attachmentUrls,
    inlineButtons,
    signature,
    uppercaseHeader,
    publishToSocialFeed
  };
}
