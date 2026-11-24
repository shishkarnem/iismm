import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getAllSceneriesFromDb, upsertScenarioInDb } from '../db/sceneriesTable';
import {
  computeMultiScheduleNextRun,
  computeMultiScheduleSlotKey
} from './schedule/multiScheduleEngine';

const MSK_OFFSET_MS = 3 * 3600 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getMskDateParts(date: Date): {
  year: number;
  month0: number;
  day: number;
  isoDay: number;
  hour: number;
  minute: number;
  dateKey: string;
} {
  const shifted = new Date(date.getTime() + MSK_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month0 = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const rawDow = shifted.getUTCDay();
  const isoDay = rawDow === 0 ? 7 : rawDow;
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const dateKey = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
  return { year, month0, day, isoDay, hour, minute, dateKey };
}

export function buildMskTimestampUtc(
  year: number,
  month0: number,
  day: number,
  mskHour: number,
  mskMinute: number
): Date {
  return new Date(Date.UTC(year, month0, day, mskHour, mskMinute, 0, 0) - MSK_OFFSET_MS);
}

export function parseSqlTimestampMs(raw: any): number {
  if (!raw) return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  const iso = str.includes('T') ? str : `${str.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

export function computeScenarioSlotKey(scenario: any, refDate: Date = new Date()): string {
  return computeMultiScheduleSlotKey(scenario, refDate);
}

export function computeScenarioNextRunFromTrigger(
  scenario: any,
  fromDate: Date = new Date()
): {
  hasScheduleTrigger: boolean;
  isOnce: boolean;
  isCompletedOnce: boolean;
  nextRunIso: string | null;
  humanSchedule: string;
  cronExpr: string;
} {
  return computeMultiScheduleNextRun(scenario, fromDate);
}

/**
 * Reconciles all scenario cron entries on startup / DB restore so that:
 * 1) Duplicate or orphaned scenario cron rows are removed.
 * 2) Scenarios that already executed today or completed once have their slot/sent status persisted.
 * 3) Any past/overdue next_run from before server startup is advanced to the NEXT future slot
 *    so deploying or restarting the server NEVER triggers an automatic catch-up run.
 */
export function reconcileScenarioCronsInDb(db: Database): void {
  try {
    // Remove legacy non-canonical duplicate scenario rows
    db.run(`
      DELETE FROM cron
      WHERE item_type = 'scenery'
        AND id != 'cron_scenarios_runner'
        AND id NOT LIKE 'cron_scen_%';
    `);

    const scenarios = getAllSceneriesFromDb(db);
    const validCronIds = new Set<string>(['cron_scenarios_runner']);
    const now = new Date();
    const nowMs = now.getTime();
    const todayMskKey = getMskDateParts(now).dateKey;

    for (const scen of scenarios) {
      if (!scen?.id) continue;
      const cronId = `cron_scen_${scen.id}`;
      const calc = computeScenarioNextRunFromTrigger(scen, now);

      if (!calc.hasScheduleTrigger) {
        db.run('DELETE FROM cron WHERE id = ?', [cronId]);
        if (scen.nextRunAt) {
          upsertScenarioInDb(db, {
            ...scen,
            schedule: 'Ручной запуск',
            nextRunAt: null
          });
        }
        continue;
      }

      validCronIds.add(cronId);

      // Backfill today's slot key if scenario already ran today in MSK
      let effectiveLastRunSlot = scen.lastRunSlot;
      let effectiveIsSent = Boolean(scen.isSent);
      if (scen.lastRunAt) {
        const lastRunMs = parseSqlTimestampMs(scen.lastRunAt);
        if (lastRunMs > 0) {
          const lastMskKey = getMskDateParts(new Date(lastRunMs)).dateKey;
          if (lastMskKey === todayMskKey && !effectiveLastRunSlot) {
            effectiveLastRunSlot = computeScenarioSlotKey(scen, new Date(lastRunMs));
          }
          if (scen.lastStatus === 'success' || scen.lastStatus === 'completed') {
            effectiveIsSent = true;
          }
        }
      }

      if (calc.isCompletedOnce) {
        db.run(
          `INSERT OR REPLACE INTO cron (
            id, item_type, item_id, title, cron_expression, schedule_human, next_run, last_run, status, created_at
          ) VALUES (?, 'scenery', ?, ?, ?, ?, NULL, ?, 'completed', ?)`,
          [
            cronId,
            String(scen.id),
            `Автосценарий: ${scen.name || 'Сценарий'}`,
            calc.cronExpr,
            calc.humanSchedule,
            scen.lastRunAt || null,
            scen.createdAt || now.toISOString()
          ]
        );
        upsertScenarioInDb(db, {
          ...scen,
          enabled: false,
          isSent: true,
          lastRunSlot: 'once',
          lastStatus: 'completed',
          schedule: calc.humanSchedule,
          nextRunAt: null
        });
        continue;
      }

      // Check existing cron row
      let existingNextMs = 0;
      let existingStatus = '';
      let existingLastRun: string | null = scen.lastRunAt || null;
      const existingRes = db.exec(
        `SELECT next_run, status, last_run FROM cron WHERE id = '${cronId.replace(/'/g, "''")}'`
      );
      if (existingRes.length > 0 && existingRes[0].values.length > 0) {
        const [rawNext, rawStatus, rawLast] = existingRes[0].values[0];
        existingNextMs = parseSqlTimestampMs(rawNext);
        existingStatus = String(rawStatus || '');
        if (rawLast) existingLastRun = String(rawLast);
      }

      const trigCfg = (Array.isArray(scen.nodes) ? scen.nodes : []).find(
        (n: any) => n.type === 'trigger_schedule' && n.enabled !== false
      )?.config;
      const isRelativeInterval = ['15m', '30m', '1h', '2h', '4h', '6h', '12h'].includes(
        String(trigCfg?.cronInterval || 'daily')
      );
      const targetStatus = scen.enabled !== false ? 'active' : 'paused';
      const effectiveNextRunIso =
        isRelativeInterval && existingNextMs > nowMs && existingStatus !== 'processing'
          ? new Date(existingNextMs).toISOString()
          : calc.nextRunIso;

      db.run(
        `INSERT OR REPLACE INTO cron (
          id, item_type, item_id, title, cron_expression, schedule_human, next_run, last_run, status, created_at
        ) VALUES (?, 'scenery', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cronId,
          String(scen.id),
          `Автосценарий: ${scen.name || 'Сценарий'}`,
          calc.cronExpr,
          calc.humanSchedule,
          effectiveNextRunIso,
          existingLastRun,
          targetStatus,
          scen.createdAt || now.toISOString()
        ]
      );

      if (
        scen.nextRunAt !== effectiveNextRunIso ||
        scen.lastRunSlot !== effectiveLastRunSlot ||
        Boolean(scen.isSent) !== effectiveIsSent
      ) {
        upsertScenarioInDb(db, {
          ...scen,
          schedule: calc.humanSchedule,
          nextRunAt: effectiveNextRunIso,
          lastRunSlot: effectiveLastRunSlot,
          isSent: effectiveIsSent
        });
      }
    }

    // Delete orphaned cron_scen_* rows for deleted scenarios
    const allCronScen = db.exec(`SELECT id FROM cron WHERE item_type = 'scenery'`);
    if (allCronScen.length > 0 && allCronScen[0].values.length > 0) {
      for (const [rawId] of allCronScen[0].values) {
        const cid = String(rawId || '');
        if (cid && !validCronIds.has(cid)) {
          db.run('DELETE FROM cron WHERE id = ?', [cid]);
        }
      }
    }
  } catch (err) {
    console.error('[Scenario Cron Reconcile] Error reconciling scenario crons:', err);
  }
}
