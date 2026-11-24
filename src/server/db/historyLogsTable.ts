import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export function initHistoryLogsTable(db: Database) {
  try {
    db.run("DROP TABLE IF EXISTS history;");
  } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      level TEXT,
      message TEXT,
      details TEXT,
      tokens_used INTEGER DEFAULT 0,
      cost_rub REAL DEFAULT 0.0,
      chat_id TEXT,
      user_id TEXT,
      function_id INTEGER DEFAULT 763,
      decision TEXT,
      created_at TEXT
    );
  `);

  try { db.run("ALTER TABLE logs ADD COLUMN tokens_used INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE logs ADD COLUMN cost_rub REAL DEFAULT 0.0;"); } catch (e) {}
  try { db.run("ALTER TABLE logs ADD COLUMN chat_id TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE logs ADD COLUMN user_id TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE logs ADD COLUMN function_id INTEGER DEFAULT 763;"); } catch (e) {}
  try { db.run("ALTER TABLE logs ADD COLUMN decision TEXT;"); } catch (e) {}
}

export function getAllLogsFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT 500");
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

