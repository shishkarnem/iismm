import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export function initTelegramBotConfigTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_bot_config (
      id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL
    );
  `);

  try {
    const check = db.exec("SELECT config_json FROM telegram_bot_config WHERE id = 'default'");
    if (!check[0]?.values?.[0]?.[0]) {
      const initialConfig = {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o',
        botUsername: '@IIrkiBot',
        proxyType: 'dialog_ai',
        apiBaseUrl: process.env.TELEGRAM_API_BASE || 'https://eu1.account.dialog.ai.atiks.org',
        adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '169262990'
      };
      db.run(
        "INSERT INTO telegram_bot_config (id, config_json) VALUES (?, ?)",
        ['default', JSON.stringify(initialConfig)]
      );
    }
  } catch (e) {
    console.error('[telegramBotConfigTable] Error seeding telegram_bot_config:', e);
  }
}
