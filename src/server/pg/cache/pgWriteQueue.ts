import { pgQuery } from '../client/pgHttpClient';

interface PendingWriteTask {
  sql: string;
  params: any[];
  targetTable?: string;
  onResult?: (rows: any[]) => void;
  resolve: () => void;
}

const queue: PendingWriteTask[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT_WRITES = 4;

async function drainQueue(): Promise<void> {
  while (activeWorkers < MAX_CONCURRENT_WRITES && queue.length > 0) {
    const task = queue.shift()!;
    activeWorkers++;
    (async () => {
      try {
        const res = await pgQuery(task.sql, task.params, { safeMode: false, retries: 3 });
        if (task.onResult && res.rows) {
          task.onResult(res.rows);
        }
      } catch (err: any) {
        console.error(
          `[PostgreSQL WriteQueue] Failed write on ${task.targetTable || 'query'}: ${err?.message || err}\nSQL: ${task.sql.slice(0, 220)}`
        );
      } finally {
        activeWorkers--;
        task.resolve();
        if (queue.length > 0) {
          void drainQueue();
        }
      }
    })();
  }
}

/**
 * Enqueues a parameterized PostgreSQL mutation (INSERT / UPDATE / DELETE)
 * to execute immediately against ProTalk PostgreSQL (iismm2).
 */
export function enqueuePgWrite(
  sql: string,
  params: any[] = [],
  targetTable?: string,
  onResult?: (rows: any[]) => void
): Promise<void> {
  return new Promise<void>((resolve) => {
    queue.push({ sql, params, targetTable, onResult, resolve });
    void drainQueue();
  });
}

/**
 * Waits until all in-flight and queued PostgreSQL mutations have completed.
 * Used before backups, snapshots, exports, and integration tests.
 */
export async function flushPendingPgWrites(timeoutMs: number = 15000): Promise<void> {
  const start = Date.now();
  while ((queue.length > 0 || activeWorkers > 0) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 40));
  }
}

export function getPendingPgWriteCount(): number {
  return queue.length + activeWorkers;
}
