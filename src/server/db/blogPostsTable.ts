import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export function transliterateToSlug(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya'
  };
  let clean = (text || 'post').toLowerCase().trim();
  let result = '';
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (map[char] !== undefined) {
      result += map[char];
    } else {
      result += char;
    }
  }
  // replace non-alphanumeric characters with hyphens
  result = result.replace(/[^a-z0-9]+/g, '-');
  // trim leading and trailing hyphens
  result = result.replace(/^-+|-+$/g, '');
  if (!result) result = 'post-' + Date.now();
  return result;
}

export function generateUniqueSlug(db: Database, title: string, excludePostId?: string): string {
  const baseSlug = transliterateToSlug(title);
  let candidate = baseSlug;
  let counter = 1;
  while (true) {
    try {
      let query = "SELECT id FROM posts WHERE slug = ?";
      let params: any[] = [candidate];
      if (excludePostId) {
        query += " AND id != ?";
        params.push(excludePostId);
      }
      const res = db.exec(query, params);
      if (res.length === 0 || res[0].values.length === 0) {
        return candidate;
      }
    } catch (e) {
      return candidate;
    }
    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
}

export function initBlogPostsTable(db: Database) {
  // Comments table (supports replies, anonymous & registered)
  db.run(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_comment_id TEXT,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      author_user_id TEXT,
      author_username TEXT,
      text TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Reactions / Likes table (likes, love, fire, haha, wow)
  db.run(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction_type TEXT DEFAULT 'like',
      created_at TEXT NOT NULL
    );
  `);

  // Ensure unique index or constraints
  try {
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_post_reactions_unique ON post_reactions(post_id, user_id);");
  } catch (e) {}

  // Ensure all existing posts have unique slugs
  try {
    const res = db.exec("SELECT id, title, slug FROM posts");
    if (res.length > 0 && res[0].values.length > 0) {
      for (const row of res[0].values) {
        const id = String(row[0]);
        const title = String(row[1] || 'post');
        const slug = row[2] ? String(row[2]) : '';
        if (!slug || slug === 'null' || slug === 'undefined') {
          const newSlug = generateUniqueSlug(db, title, id);
          db.run("UPDATE posts SET slug = ? WHERE id = ?", [newSlug, id]);
        }
      }
    }
  } catch (e) {
    console.error('[blogPostsTable] Error ensuring slugs:', e);
  }
}

export function getAllBlogPostsFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM posts ORDER BY created_at DESC");
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

