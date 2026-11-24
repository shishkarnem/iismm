import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { reconcileScenarioCronsInDb } from '../scenarios/scenarioScheduleCalc';

export function getNextMsk0600Iso(): string {
  const now = new Date();
  // Moscow is UTC+3. So 06:00 MSK is 03:00 UTC.
  const targetUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    3, 0, 0, 0
  ));
  if (targetUtc.getTime() <= now.getTime()) {
    targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
  }
  return targetUtc.toISOString();
}

export function getNextMskTimeIso(hour: number, minute: number = 0): string {
  const now = new Date();
  // Moscow is UTC+3. Target UTC hour is (hour - 3 + 24) % 24
  const utcHour = (hour - 3 + 24) % 24;
  const targetUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    utcHour, minute, 0, 0
  ));
  if (targetUtc.getTime() <= now.getTime()) {
    targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
  }
  return targetUtc.toISOString();
}

export function initCronTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS cron (
      id TEXT PRIMARY KEY,
      item_type TEXT,
      item_id TEXT,
      title TEXT,
      cron_expression TEXT,
      schedule_human TEXT,
      next_run TEXT,
      last_run TEXT,
      status TEXT,
      created_at TEXT
    );
  `);

  try {
    // 1. Clean up obsolete, redundant or legacy cron jobs
    db.run(`
      DELETE FROM cron 
      WHERE id IN ('cron_1', 'cron_2', 'cron_3', 'cron_4', 'cron_5', 'cron_6', 'cron_referrals_and_balances', 'cron_social_feed_sync', 'cron_notifications_dispatcher')
         OR title LIKE '%ВКонтакте%'
         OR title LIKE '%recalculate_engagement_rates%'
         OR title LIKE '%Маркетинговый пост по расписанию%'
         OR title LIKE '%реферальных связей%'
         OR title LIKE '%социальную ленту%'
         OR title LIKE '%системных уведомлений%';
    `);

    // Remove any duplicate backup cron rows so only cron_backup_daily_0600_msk exists
    db.run(`DELETE FROM cron WHERE item_type = 'backup' AND id != 'cron_backup_daily_0600_msk';`);

    // 2. Define core genuine system cron tasks
    const systemCronTasks = [
      {
        id: 'cron_backup_daily_0600_msk',
        item_type: 'backup',
        item_id: 'sys_backup_0600',
        title: 'Ежедневный бэкап базы данных PostgreSQL ProTalk в Telegram',
        cron_expression: '0 06 * * *',
        schedule_human: 'Каждый день в 06:00 MSK',
        next_run: getNextMsk0600Iso(),
        status: 'active'
      },
      {
        id: 'cron_autopost_dispatcher',
        item_type: 'autopost',
        item_id: 'sys_autopost_dispatcher',
        title: 'Отправка отложенных постов и публикаций в Telegram',
        cron_expression: '* * * * *',
        schedule_human: 'Каждую минуту (проверка очереди публикаций)',
        next_run: new Date(Date.now() + 60000).toISOString(),
        status: 'active'
      },
      {
        id: 'cron_tariffs_checker',
        item_type: 'tariffs',
        item_id: 'sys_tariffs_checker',
        title: 'Проверка сроков тарифов и автопродление',
        cron_expression: '5 0 * * *',
        schedule_human: 'Каждый день в 00:05 MSK',
        next_run: getNextMskTimeIso(0, 5),
        status: 'active'
      },
      {
        id: 'cron_scenarios_runner',
        item_type: 'scenery',
        item_id: 'sys_scenarios_runner',
        title: 'Автоматическое выполнение активных маркетинговых ИИ-сценариев',
        cron_expression: '0 12 * * *',
        schedule_human: 'Каждый день в 12:00 MSK',
        next_run: getNextMskTimeIso(12, 0),
        status: 'active'
      }
    ];

    const nowMs = Date.now();
    for (const task of systemCronTasks) {
      const existing = db.exec(`SELECT id, next_run FROM cron WHERE id = '${task.id}'`);
      if (existing.length === 0 || existing[0].values.length === 0) {
        db.run(
          `INSERT INTO cron (id, item_type, item_id, title, cron_expression, schedule_human, next_run, last_run, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.id,
            task.item_type,
            task.item_id,
            task.title,
            task.cron_expression,
            task.schedule_human,
            task.next_run,
            null,
            task.status,
            new Date().toISOString()
          ]
        );
      } else {
        const rawExistingNext = existing[0].values[0][1];
        const parsedNext = rawExistingNext
          ? new Date(String(rawExistingNext).includes('T') ? String(rawExistingNext) : `${String(rawExistingNext).replace(' ', 'T')}Z`).getTime()
          : 0;
        const effectiveNextRun = (!rawExistingNext || isNaN(parsedNext) || parsedNext <= nowMs)
          ? task.next_run
          : String(rawExistingNext);

        db.run(
          `UPDATE cron 
           SET title = ?,
               cron_expression = ?,
               schedule_human = ?,
               item_type = ?,
               item_id = ?,
               next_run = ?,
               status = ?
           WHERE id = ?`,
          [
            task.title,
            task.cron_expression,
            task.schedule_human,
            task.item_type,
            task.item_id,
            effectiveNextRun,
            task.status,
            task.id
          ]
        );
      }
    }

    // 3. Reconcile all scenario cron entries synchronously so overdue next_run never fires on deploy
    reconcileScenarioCronsInDb(db);

    // 4. Clean up any broken recursive post cron entries and stale >15m overdue runs
    try {
      db.run(
        `DELETE FROM cron WHERE item_type = 'post' AND (id LIKE 'cron_post_pub_cron_%' OR item_id LIKE 'pub_cron_%' OR item_id LIKE 'pub_%' OR item_id LIKE 'blog_%' OR item_id LIKE 'sched_%')`
      );
      const postRows = db.exec(`SELECT id, next_run, status FROM cron WHERE item_type = 'post'`);
      if (postRows.length > 0 && postRows[0].values.length > 0) {
        const staleCutoffMs = nowMs - 15 * 60 * 1000;
        for (const [rawId, rawNext, rawStatus] of postRows[0].values) {
          const parsedPostNext = rawNext
            ? Date.parse(String(rawNext).includes('T') ? String(rawNext) : `${String(rawNext).replace(' ', 'T')}Z`)
            : 0;
          if (rawStatus === 'processing') {
            db.run(`UPDATE cron SET status = 'active' WHERE id = ?`, [String(rawId)]);
          } else if (!parsedPostNext || Number.isNaN(parsedPostNext) || parsedPostNext < staleCutoffMs) {
            db.run(
              `UPDATE cron SET status = CASE WHEN cron_expression LIKE 'exact:%' THEN 'paused' ELSE status END WHERE id = ?`,
              [String(rawId)]
            );
          }
        }
      }
    } catch (e) {}

    // 5. Sync any existing scheduled posts into cron table
    try {
      import('../db').then(async ({ DB }) => {
        const posts = DB.getDayRequests ? DB.getDayRequests() : [];
        const { syncPostCronTask } = await import('../repos/blogPostsRepo');
        for (const p of posts) {
          if (p.triggerSchedule && p.triggerSchedule.enabled) {
            syncPostCronTask(p.id, p, p.userId);
          }
        }
      }).catch(() => {});
    } catch (e) {}

  } catch (e) {
    console.error('[PostgreSQL] Error configuring cron table in cronTable.ts:', e);
  }
}

export function getAllCronJobsFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM cron ORDER BY created_at DESC");
    const res: any[] = [];
    while (stmt.step()) {
      res.push(stmt.getAsObject());
    }
    stmt.free();
    return res;
  } catch (e) {
    return [];
  }
}


