import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export function initPostsTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      slug TEXT,
      user_id TEXT,
      title TEXT,
      desc TEXT,
      category TEXT DEFAULT 'general',
      request_template TEXT,
      post_text TEXT,
      content TEXT,
      channel TEXT,
      channels TEXT,
      message_format TEXT DEFAULT 'rich',
      signature TEXT,
      attachment_type TEXT DEFAULT 'none',
      attachment_url TEXT,
      attachment_urls TEXT,
      audio_format TEXT DEFAULT 'audio',
      audio_title TEXT,
      audio_performer TEXT,
      protect_content INTEGER DEFAULT 0,
      link_preview_enabled INTEGER DEFAULT 1,
      inline_buttons_json TEXT,
      status TEXT DEFAULT 'draft',
      is_post_of_day INTEGER DEFAULT 0,
      post_of_day_date TEXT,
      format TEXT DEFAULT 'photo',
      tag TEXT DEFAULT 'Пост',
      read_time TEXT DEFAULT '5 мин',
      date_str TEXT,
      author_name TEXT,
      author_avatar TEXT,
      author_role TEXT,
      views_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      image_url TEXT,
      video_url TEXT,
      album_json TEXT,
      trigger_schedule TEXT,
      published_at TEXT,
      created_at TEXT
    );
  `);

  // Run migrations safely for any added columns
  const cols = [
    'slug TEXT', 'desc TEXT', 'content TEXT', 'inline_buttons_json TEXT',
    "audio_format TEXT DEFAULT 'audio'", 'audio_title TEXT', 'audio_performer TEXT',
    'protect_content INTEGER DEFAULT 0', 'link_preview_enabled INTEGER DEFAULT 1',
    'is_post_of_day INTEGER DEFAULT 0', 'post_of_day_date TEXT', 'format TEXT DEFAULT "photo"',
    'tag TEXT DEFAULT "Пост"', 'read_time TEXT DEFAULT "5 мин"', 'date_str TEXT',
    'author_name TEXT', 'author_avatar TEXT', 'author_role TEXT',
    'views_count INTEGER DEFAULT 0', 'likes_count INTEGER DEFAULT 0', 'shares_count INTEGER DEFAULT 0',
    'image_url TEXT', 'video_url TEXT', 'album_json TEXT',
    'is_promoted INTEGER DEFAULT 0', 'promoted_at TEXT'
  ];
  for (const c of cols) {
    try { db.run(`ALTER TABLE posts ADD COLUMN ${c};`); } catch (e) {}
  }

  // Clean out legacy "Администратор" rows
  try {
    db.run("DELETE FROM posts WHERE author_name LIKE '%Администратор%' AND (user_id IS NULL OR user_id = '' OR user_id = 'null');");
  } catch (e) {}

  // Clean out legacy history and blog_posts tables and views
  try {
    db.run("DROP TABLE IF EXISTS history;");
    db.run("DROP TABLE IF EXISTS hystory;");
    db.run("DROP VIEW IF EXISTS blog_posts;");
    db.run("DROP TABLE IF EXISTS blog_posts;");
  } catch (e) {}

  try { db.run(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`); } catch (e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);`); } catch (e) {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);`); } catch (e) {}
}

export function getAllPostsFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM posts ORDER BY created_at DESC");
    const posts: any[] = [];
    while (stmt.step()) {
      posts.push(stmt.getAsObject());
    }
    stmt.free();
    return posts;
  } catch (e) {
    return [];
  }
}


