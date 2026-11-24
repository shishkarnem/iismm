import { getPgDB, savePgDB } from '../../db/postgres';
import { POST_STYLES, PostStyleItem } from '../../../components/post-editor/core/postStylesData';

let tableInitialized = false;

export async function ensureUserPostStylesTable() {
  const db = await getPgDB();
  if (!tableInitialized) {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_post_styles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        desc TEXT DEFAULT '',
        prompt TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    tableInitialized = true;
    savePgDB();
  }
  return db;
}

export async function listUserPostStylesFromDb(userId?: string): Promise<PostStyleItem[]> {
  const db = await ensureUserPostStylesTable();
  const cleanUid = String(userId || '').trim();
  const items: PostStyleItem[] = [];
  try {
    const stmt = cleanUid
      ? db.prepare(
          `SELECT id, user_id, title, "desc", prompt FROM user_post_styles
           WHERE user_id = ? OR user_id = 'global'
           ORDER BY created_at DESC`
        )
      : db.prepare(
          `SELECT id, user_id, title, "desc", prompt FROM user_post_styles
           ORDER BY created_at DESC`
        );
    if (cleanUid) stmt.bind([cleanUid]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      items.push({
        id: String(row.id),
        title: String(row.title || 'Стиль канала'),
        desc: String(row.desc || 'Фирменный стиль на основе постов канала'),
        prompt: String(row.prompt || ''),
        isCustom: true
      });
    }
    stmt.free();
  } catch (err) {
    console.error('listUserPostStylesFromDb error:', err);
  }
  return items;
}

export async function upsertUserPostStyleInDb(params: {
  id?: string;
  userId?: string;
  title: string;
  desc?: string;
  prompt: string;
}): Promise<PostStyleItem> {
  const db = await ensureUserPostStylesTable();
  const styleId = String(params.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const cleanUid = String(params.userId || 'global').trim() || 'global';
  const rawTitle = String(params.title || 'Фирменный стиль канала').trim();
  const formattedTitle = rawTitle.startsWith('👑') ? rawTitle : `👑 ${rawTitle}`;
  const desc = String(params.desc || 'Фирменный стиль на основе примеров канала').trim();
  const prompt = String(params.prompt || '').trim();
  const nowIso = new Date().toISOString();

  db.run(
    `INSERT OR REPLACE INTO user_post_styles (id, user_id, title, "desc", prompt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [styleId, cleanUid, formattedTitle, desc, prompt, nowIso]
  );
  savePgDB();

  return {
    id: styleId,
    title: formattedTitle,
    desc,
    prompt,
    isCustom: true
  };
}

export async function deleteUserPostStyleFromDb(id: string, userId?: string): Promise<boolean> {
  const db = await ensureUserPostStylesTable();
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;
  if (userId) {
    db.run(`DELETE FROM user_post_styles WHERE id = ? AND (user_id = ? OR user_id = 'global')`, [
      cleanId,
      String(userId)
    ]);
  } else {
    db.run(`DELETE FROM user_post_styles WHERE id = ?`, [cleanId]);
  }
  savePgDB();
  return true;
}

export async function resolvePostStyleForScenario(params: {
  styleId?: string;
  styleTitle?: string;
  stylePromptOverride?: string;
  userId?: string;
}): Promise<{ id: string; title: string; prompt: string }> {
  const customList = await listUserPostStylesFromDb(params.userId);
  const all = [...POST_STYLES, ...customList];

  const byId = params.styleId ? all.find((s) => s.id === params.styleId) : undefined;
  const byTitle =
    !byId && params.styleTitle
      ? all.find(
          (s) =>
            s.title.toLowerCase() === String(params.styleTitle).trim().toLowerCase() ||
            s.id === params.styleTitle
        )
      : undefined;
  const matched = byId || byTitle || POST_STYLES[0];
  const finalPrompt = String(params.stylePromptOverride || matched.prompt || '').trim();

  return {
    id: matched.id,
    title: matched.title,
    prompt: finalPrompt
  };
}
