import { PgCloudDatabase, getPgDB, getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { flushPendingPgWrites } from '../pg/cache/pgWriteQueue';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

export type Database = PgCloudDatabase;

export const DEFAULT_TOKEN =
  process.env.PROTALK_UPLOAD_TOKEN ||
  'YGNcVnFsW1lhalh3GH0rBkQgeRQzDS4ZBFAzayQnKgEJcCFwdSdKASYfHRQHPRQYaGtdWGtjUgVvAH9YAmk';

const DEPRECATED_UPLOAD_TOKENS = new Set([
  'b2VcU3NrVVttYlh3GHM_AEQ4eA8yDR4FGREODwsaLyUqQjpTEA8HGzMdFB8aORQYaG9dWGpkVQRvAXM'
]);

export function cleanAuthorName(name?: string): string {
  if (!name) return 'Соавтор';
  let cleaned = name.trim();
  if (cleaned.toLowerCase().includes('администратор')) return 'Соавтор';
  cleaned = cleaned.replace(/Dr\.White\s+SAV\s+AI\s+SAV\s+AI/gi, 'Dr.White SAV AI');
  cleaned = cleaned.replace(/SAV\s+AI\s+SAV\s+AI/gi, 'SAV AI');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const deduped: string[] = [];
    tokens.forEach((tok) => {
      if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== tok.toLowerCase()) {
        deduped.push(tok);
      }
    });
    cleaned = deduped.join(' ');
  }
  return cleaned || 'Соавтор';
}

export function normalizeUserId(userId?: string | number): string {
  if (!userId) return '16926299042';
  const str = String(userId).trim();
  if (str === '169262990' || str === '16926299042') return '16926299042';
  if (str === '8092697980' || str === '80926979801') return '80926979801';
  if (str === '1618738722' || str === '16187387221') return '16187387221';
  return str;
}

export function savePgDB(): void {
  void flushPendingPgWrites();
}

export const getDatabase = getPgDB;
export const getSyncDatabase = getSyncPgDB;

export function fetchAllPostsFromPg(): any[] {
  const db = getSyncPgDB();
  if (!db) return [];
  try {
    const res = db.exec('SELECT * FROM posts ORDER BY created_at ASC');
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map((valArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        rowObj[col] = valArr[idx];
      });
      return rowObj;
    });
  } catch (e) {
    console.error('[PostgreSQL] Error fetching posts:', e);
    return [];
  }
}

export function fetchAllChannelsFromPg(): any[] {
  const db = getSyncPgDB();
  if (!db) return [];
  try {
    const res = db.exec('SELECT * FROM channels ORDER BY created_at ASC');
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map((valArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        rowObj[col] = valArr[idx];
      });
      return rowObj;
    });
  } catch (e) {
    console.error('[PostgreSQL] Error fetching channels:', e);
    return [];
  }
}

export function fetchAllUsersFromPg(): any[] {
  const db = getSyncPgDB();
  if (!db) return [];
  try {
    const res = db.exec('SELECT * FROM users ORDER BY created_at ASC');
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map((valArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        rowObj[col] = valArr[idx];
      });
      return rowObj;
    });
  } catch (e) {
    console.error('[PostgreSQL] Error fetching users:', e);
    return [];
  }
}

export function getUserFromPg(userId: string): any | null {
  const db = getSyncPgDB();
  if (!db || !userId) return null;
  try {
    const norm = normalizeUserId(userId);
    const res = db.exec(
      'SELECT id, telegram_id, first_name, last_name, username, email, photo_url, role FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
      [norm, norm]
    );
    if (!res[0] || !res[0].values[0]) return null;
    const row = res[0].values[0];
    return {
      id: String(row[0]),
      telegramId: row[1],
      firstName: row[2] || '',
      lastName: row[3] || '',
      username: row[4] || '',
      email: row[5] || '',
      photoUrl: row[6] || '',
      role: row[7] || 'user'
    };
  } catch {
    return null;
  }
}

export function fetchAllFilesFromPg(): any[] {
  const db = getSyncPgDB();
  if (!db) return [];
  try {
    const res = db.exec('SELECT * FROM file_storage ORDER BY id DESC');
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map((valArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        rowObj[col] = valArr[idx];
      });
      return rowObj;
    });
  } catch {
    try {
      const res = db.exec('SELECT * FROM files ORDER BY created_at DESC');
      if (!res[0]) return [];
      const columns = res[0].columns;
      return res[0].values.map((valArr: any[]) => {
        const rowObj: Record<string, any> = {};
        columns.forEach((col: string, idx: number) => {
          rowObj[col] = valArr[idx];
        });
        return rowObj;
      });
    } catch (err) {
      console.error('[PostgreSQL] Error fetching files:', err);
      return [];
    }
  }
}

export function getBotDetailsFromPg(): any {
  const fallbackBot = {
    id: 'bot_1',
    bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    bot_name: 'ИИрки Постинг Бот',
    bot_username: '@IIrkiBot',
    bot_id: '8142466188',
    description: 'Официальный Telegram бот сервиса ИИSMM для автопостинга и генерации контента.',
    avatar_url: BRAND_ASSETS.logo,
    default_chat_id: '@SAV_AI',
    api_url: 'https://eu1.api.pro-talk.ru/api/v1.0',
    is_active: 1
  };
  const db = getSyncPgDB();
  if (!db) return fallbackBot;
  try {
    const res = db.exec(
      'SELECT id, bot_token, bot_name, bot_username, bot_id, description, avatar_url, default_chat_id, api_url, is_active FROM telegram_bot LIMIT 1'
    );
    if (res.length > 0 && res[0].values.length > 0) {
      const row = res[0].values[0];
      return {
        id: String(row[0] || 'bot_1'),
        bot_token: String(row[1] || fallbackBot.bot_token),
        bot_name: String(row[2] || fallbackBot.bot_name),
        bot_username: String(row[3] || fallbackBot.bot_username),
        bot_id: String(row[4] || fallbackBot.bot_id),
        description: String(row[5] || fallbackBot.description),
        avatar_url: normalizeProTalkMediaUrl(String(row[6] || '')) || fallbackBot.avatar_url,
        default_chat_id: String(row[7] || fallbackBot.default_chat_id),
        api_url: String(row[8] || fallbackBot.api_url),
        is_active: Number(row[9]) === 1 ? 1 : 0
      };
    }
  } catch {}
  return fallbackBot;
}

export function getBotTokenFromPg(): string {
  const details = getBotDetailsFromPg();
  return details.bot_token;
}

export function insertModerationLog(data: {
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: string;
  tokens_used?: number;
  cost_rub?: number;
  chat_id?: string;
  user_id?: string;
  function_id?: number;
  decision?: string;
}): void {
  const db = getSyncPgDB();
  if (!db) return;
  try {
    const id = `log_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO logs (id, level, message, details, tokens_used, cost_rub, chat_id, user_id, function_id, decision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.level,
        data.message,
        data.details || '',
        data.tokens_used || 0,
        data.cost_rub || 0,
        data.chat_id || '',
        data.user_id || '',
        data.function_id || 763,
        data.decision || '',
        now
      ]
    );
    savePgDB();
  } catch (err) {
    console.error('[PostgreSQL] Error inserting moderation log:', err);
  }
}

export function getModerationLogUrlFromPg(): string {
  const db = getSyncPgDB();
  if (!db) return '';
  try {
    const res = db.exec("SELECT moderation_log_url FROM protalk_settings WHERE id = 'setting_1' LIMIT 1;");
    if (res[0] && res[0].values && res[0].values[0]) {
      const val = res[0].values[0][0];
      return val !== null && val !== undefined ? String(val) : '';
    }
  } catch (e) {
    console.error('[PostgreSQL] Error reading moderation_log_url:', e);
  }
  return '';
}

export function setModerationLogUrlInPg(url: string): void {
  const db = getSyncPgDB();
  if (!db) return;
  try {
    db.run("UPDATE protalk_settings SET moderation_log_url = ? WHERE id = 'setting_1';", [url]);
    savePgDB();
  } catch (e) {
    console.error('[PostgreSQL] Error updating moderation_log_url:', e);
  }
}

export function getGalleryUploadTokenFromPg(candidateToken?: string | null): string {
  const cleanCandidate = typeof candidateToken === 'string' ? candidateToken.trim() : '';
  if (cleanCandidate && !DEPRECATED_UPLOAD_TOKENS.has(cleanCandidate)) {
    return cleanCandidate;
  }

  const db = getSyncPgDB();
  if (db) {
    try {
      const appRes = db.exec(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'gallery_upload_token' LIMIT 1;"
      );
      const fromApp = String(appRes[0]?.values?.[0]?.[0] || '').trim();
      if (fromApp && !DEPRECATED_UPLOAD_TOKENS.has(fromApp)) {
        return fromApp;
      }
    } catch {}

    try {
      const ptRes = db.exec(
        "SELECT upload_token FROM protalk_settings WHERE id = 'setting_1' LIMIT 1;"
      );
      const fromPt = String(ptRes[0]?.values?.[0]?.[0] || '').trim();
      if (fromPt && !DEPRECATED_UPLOAD_TOKENS.has(fromPt)) {
        return fromPt;
      }
    } catch {}
  }

  return DEFAULT_TOKEN;
}

export function setBotTokenInPg(token: string): void {
  const db = getSyncPgDB();
  if (!db) return;
  try {
    db.run("UPDATE telegram_bot SET bot_token = ? WHERE id = 'bot_1'", [token]);
    savePgDB();
  } catch (e) {
    console.error('[PostgreSQL] Error updating bot_token:', e);
  }
}

