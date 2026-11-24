import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { normalizeUserId, savePgDB } from '../db/postgres';

export interface ConsultantMessageRecord {
  id: string;
  chatId: string;
  userId: string;
  sender: 'user' | 'assistant';
  text: string;
  images: string[];
  dbSource?: string;
  dbSummary?: string;
  createdAt: string;
}

export function initConsultantTable(db: Database) {
  if (!db) return;
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS consultant_messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        images_json TEXT DEFAULT '[]',
        db_source TEXT DEFAULT '',
        db_summary TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_consultant_messages_chat_id ON consultant_messages(chat_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_consultant_messages_user_id ON consultant_messages(user_id);`);
  } catch (err) {
    console.error('[PostgreSQL] Error initializing consultant_messages table:', err);
  }
}

export function buildUnifiedConsultantChatId(userId?: string, sessionKey?: string): string {
  const rawUser = String(userId || '').trim();
  if (rawUser && rawUser !== 'guest' && rawUser !== 'anonymous' && rawUser !== 'unknown') {
    const cleanUid = normalizeUserId(rawUser).replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanUid) {
      return `iismm_consultant_${cleanUid}`;
    }
  }

  const cleanSession = String(sessionKey || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);

  return `iismm_consultant_guest_${cleanSession || 'default'}`;
}

function parseSafeImages(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || '').trim()).filter(Boolean);
      }
    } catch {}
  }
  return [];
}

export function getConsultantMessagesFromDb(
  db: Database,
  chatId: string,
  limit: number = 60
): ConsultantMessageRecord[] {
  const cleanChatId = String(chatId || '').trim();
  if (!cleanChatId) return [];

  try {
    const stmt = db.prepare(`
      SELECT id, chat_id, user_id, sender, text, images_json, db_source, db_summary, created_at
      FROM consultant_messages
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    stmt.bind([cleanChatId, limit]);

    const rows: ConsultantMessageRecord[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject() as Record<string, any>;
      rows.push({
        id: String(r.id || ''),
        chatId: String(r.chat_id || cleanChatId),
        userId: String(r.user_id || 'guest'),
        sender: r.sender === 'assistant' ? 'assistant' : 'user',
        text: String(r.text || ''),
        images: parseSafeImages(r.images_json),
        dbSource: r.db_source ? String(r.db_source) : undefined,
        dbSummary: r.db_summary ? String(r.db_summary) : undefined,
        createdAt: String(r.created_at || new Date().toISOString())
      });
    }
    stmt.free();

    return rows.reverse();
  } catch (err) {
    console.error('[PostgreSQL] Error reading consultant_messages:', err);
    return [];
  }
}

export function insertConsultantMessageInDb(
  db: Database,
  record: ConsultantMessageRecord
): ConsultantMessageRecord {
  try {
    db.run(
      `INSERT OR REPLACE INTO consultant_messages (
        id, chat_id, user_id, sender, text, images_json, db_source, db_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.chatId,
        record.userId,
        record.sender,
        record.text,
        JSON.stringify(record.images || []),
        record.dbSource || '',
        record.dbSummary || '',
        record.createdAt
      ]
    );
    savePgDB();
  } catch (err) {
    console.error('[PostgreSQL] Error inserting consultant message:', err);
  }
  return record;
}

export function clearConsultantMessagesInDb(db: Database, chatId: string): void {
  const cleanChatId = String(chatId || '').trim();
  if (!cleanChatId) return;
  try {
    db.run(`DELETE FROM consultant_messages WHERE chat_id = ?`, [cleanChatId]);
    savePgDB();
  } catch (err) {
    console.error('[PostgreSQL] Error clearing consultant messages:', err);
  }
}
