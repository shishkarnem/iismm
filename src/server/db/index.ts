import { PgCloudDatabase, getPgDB, getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { flushPendingPgWrites } from '../pg/cache/pgWriteQueue';
import { addTransactionWithBalanceUpdate } from './transactionsTable';
import { fixErroneousDefaultCosmosUsers, processTariffsCronLifecycle } from '../tariffs/tariffLifecycle';

export type Database = PgCloudDatabase;

let tariffTimerInitialized = false;

function schedulePeriodicTariffChecks() {
  if (tariffTimerInitialized) return;
  tariffTimerInitialized = true;

  setInterval(() => {
    try {
      const db = getSyncPgDB();
      if (db) {
        checkAndApplyMonthlyTariffs(db);
      }
    } catch (err) {
      console.error('[Tariff Timer] Periodic check failed:', err);
    }
  }, 60 * 1000);
}

export function checkAndApplyMonthlyTariffs(db: PgCloudDatabase) {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare(`
      SELECT u.id, u.tariff, u.balance_time, u.tariff_accrued_at
      FROM users u
      WHERE (u.tariff IS NULL OR u.tariff = '' OR u.tariff = 'Старт')
        AND (COALESCE(u.tariff_accrued_at, u.balance_time) IS NULL OR COALESCE(u.tariff_accrued_at, u.balance_time) < ?)
    `);
    stmt.bind([thirtyDaysAgo]);
    const eligibleStartUsers: Array<{ id: string }> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      eligibleStartUsers.push({ id: String(row.id) });
    }
    stmt.free();

    for (const u of eligibleStartUsers) {
      addTransactionWithBalanceUpdate(db as any, {
        userId: u.id,
        type: 'tarif',
        balanceType: 'tarif',
        amount: 300,
        description: 'Ежемесячное начисление по тарифу «Старт»: +300 ИИрок',
        createdAt: nowIso
      });
      db.run('UPDATE users SET tariff_accrued_at = ? WHERE id = ?', [nowIso, u.id]);
    }
    if (eligibleStartUsers.length > 0) {
      console.log(`[Tariff Cron] Applied monthly Start 300 Iirky accruals for ${eligibleStartUsers.length} users.`);
      saveDatabaseToDisk();
    }
  } catch (e) {
    console.error('[Tariff Cron] Error processing monthly tariffs:', e);
  }
}

export const getSyncDatabase = getSyncPgDB;

let lifecycleInitialized = false;

export async function getDatabase(): Promise<PgCloudDatabase> {
  const db = await getPgDB();
  if (!lifecycleInitialized) {
    lifecycleInitialized = true;
    try {
      fixErroneousDefaultCosmosUsers(db as any);
      await processTariffsCronLifecycle(db as any);
      checkAndApplyMonthlyTariffs(db);
    } catch (e) {
      console.warn('[PostgreSQL DB] Lifecycle check warning:', e);
    }
    schedulePeriodicTariffChecks();
  }
  return db;
}

export const getPgDBWithLifecycle = getDatabase;

export function saveDatabaseToDisk(): void {
  void flushPendingPgWrites();
}

export const savePgDB = saveDatabaseToDisk;
