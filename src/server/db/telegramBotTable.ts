import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export function initTelegramBotTable(_db: Database) {
  // Bot settings are persisted in cloud PostgreSQL ProTalk (iismm2); startup token seeds removed
}

export function getTelegramBotSettingsFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM telegram_bot WHERE id = 'bot_1' LIMIT 1");
    let bot: any = null;
    if (stmt.step()) {
      bot = stmt.getAsObject();
    }
    stmt.free();
    return bot;
  } catch (e) {
    return null;
  }
}
