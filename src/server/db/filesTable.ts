import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { saveDatabaseToDisk } from './index';

/**
 * Fixes broken Latin1/Mojibake UTF-8 encodings and URL percent-encodings in filenames.
 */
export function fixUtf8Filename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let name = rawName.trim();

  // 1. Decode percent-encoding if present
  try {
    if (name.includes('%')) {
      const decoded = decodeURIComponent(name);
      if (decoded && !decoded.includes('\ufffd')) {
        name = decoded;
      }
    }
  } catch (e) {}

  // 2. Decode Latin1 -> UTF-8 mojibake (e.g. РћС‚С‡РµС‚ -> Отчет)
  try {
    const converted = Buffer.from(name, 'latin1').toString('utf8');
    if (!converted.includes('\ufffd') && /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(converted)) {
      name = converted;
    }
  } catch (e) {}

  // 3. Remove dangerous control characters & quotes that break HTTP headers / URLs
  name = name.replace(/[\0\r\n\t"]/g, '').replace(/[\/\\]+/g, '_');

  return name;
}

/**
 * Robust and clean slug generation for file URLs:
 * - Decodes mojibake and cleans symbols
 * - Transliterates Cyrillic and international characters to standard Latin
 * - Converts known symbols to words (№ -> no, + -> and, % -> pct, @ -> at)
 * - Removes invalid URL characters without collapsing everything into 'file'
 */
export function slugifyFilename(name: string): string {
  if (!name) return 'file.bin';
  
  const cleanName = fixUtf8Filename(name);

  const ruToEn: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g', 'ў': 'u'
  };

  const parts = cleanName.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase().replace(/[^a-z0-9]/gi, '') : '';
  const rawBase = parts.join('.');

  // Replace special characters with natural transliterated equivalents
  let base = rawBase
    .replace(/[№#]/g, ' no ')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' and ')
    .replace(/%/g, ' pct ')
    .replace(/@/g, ' at ')
    .replace(/[«»„“"''`]/g, '')
    .replace(/[()[\]{}<>|\\^~*]/g, ' ')
    .toLowerCase();

  // Transliterate Cyrillic characters
  let transliterated = '';
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    transliterated += ruToEn[ch] !== undefined ? ruToEn[ch] : ch;
  }

  // Replace any non-alphanumeric characters with a single hyphen
  let slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    slug = ext ? 'document' : 'file';
  }

  return ext ? `${slug}.${ext}` : slug;
}

export function initFilesTable(_db: Database) {
  // Schema and assets are persisted in cloud PostgreSQL ProTalk (iismm2).
}

export const ESSENTIAL_FILE_STORAGE_ITEMS: any[] = [];

export function seedEssentialFiles(_db: Database) {
  // Startup file seeding removed; assets are persisted in PostgreSQL ProTalk (iismm2).
}

export function detectFileType(filename: string, mimeType: string = ''): 'photo' | 'video' | 'audio' | 'document' {
  const mime = (mimeType || '').toLowerCase();
  const ext = (filename || '').toLowerCase().split('.').pop() || '';

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return 'photo';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  return 'document';
}

export function formatFileSize(bytes: number = 0): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Trigger: Ensure 4 default folders exist for a user
 */
export function ensureDefaultFoldersForUser(db: Database, userId: string = 'admin') {
  const normUserId = String(userId || 'admin').trim();
  const defaultCategories = [
    { name: 'Картинки', folder_type: 'photo', color: '#0284c7' },
    { name: 'Видео', folder_type: 'video', color: '#ec4899' },
    { name: 'Аудио', folder_type: 'audio', color: '#f97316' },
    { name: 'Файлы', folder_type: 'document', color: '#8b5cf6' },
  ];

  let newlyCreated = false;
  try {
    const stmt = db.prepare("SELECT * FROM file_folders WHERE user_id = ?");
    stmt.bind([normUserId]);
    const existingFolders: any[] = [];
    while (stmt.step()) {
      existingFolders.push(stmt.getAsObject());
    }
    stmt.free();

    for (const cat of defaultCategories) {
      const exists = existingFolders.some(f => f.folder_type === cat.folder_type || f.name === cat.name);
      if (!exists) {
        db.run(
          "INSERT INTO file_folders (user_id, name, color, folder_type) VALUES (?, ?, ?, ?)",
          [normUserId, cat.name, cat.color, cat.folder_type]
        );
        newlyCreated = true;
      }
    }
    if (newlyCreated) {
      try { saveDatabaseToDisk(); } catch (e) {}
    }
  } catch (err) {
    console.error('[PostgreSQL] Error ensuring default folders:', err);
  }

  return getFoldersForUser(db, normUserId);
}

export function getFoldersForUser(db: Database, userId: string = 'admin') {
  const normUserId = String(userId || 'admin').trim();
  try {
    const stmt = db.prepare("SELECT * FROM file_folders WHERE user_id = ? OR user_id = 'admin' ORDER BY id ASC");
    stmt.bind([normUserId]);
    const res: any[] = [];
    const seenIds = new Set<number>();
    while (stmt.step()) {
      const obj = stmt.getAsObject();
      if (!seenIds.has(Number(obj.id))) {
        seenIds.add(Number(obj.id));
        res.push(obj);
      }
    }
    stmt.free();
    return res;
  } catch (e) {
    return [];
  }
}

/**
 * Register file into storage with multi-folder attachment
 */
export function registerFileInStorage(
  db: Database,
  params: {
    userId?: string;
    name: string;
    originalUrl: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    folderIds?: (number | string)[];
    hostProtocol?: { host: string; protocol: string };
  }
) {
  const userId = String(params.userId || 'admin').trim();
  const name = params.name || 'file.bin';
  const originalUrl = params.originalUrl || '';
  const mimeType = params.mimeType || 'image/png';
  const fileSize = Number(params.fileSize || 0);
  const width = Number(params.width || 0);
  const height = Number(params.height || 0);

  const fileType = detectFileType(name, mimeType);
  const folders = ensureDefaultFoldersForUser(db, userId);

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let fileKey = '';
  for (let i = 0; i < 8; i++) fileKey += chars.charAt(Math.floor(Math.random() * chars.length));

  const slugName = slugifyFilename(name);

  const host = params.hostProtocol?.host || 'localhost:3000';
  const protocol = params.hostProtocol?.protocol || 'https';

  let normalizedOriginalUrl = String(originalUrl || '').replace(
    /^https?:\/\/filestore\.pro-talk\.ru\//i,
    'https://file.pro-talk.ru/tgf/'
  );
  if (normalizedOriginalUrl.startsWith('/')) {
    normalizedOriginalUrl = `${protocol}://${host}${normalizedOriginalUrl}`;
  } else if (normalizedOriginalUrl.startsWith('uploads/')) {
    normalizedOriginalUrl = `${protocol}://${host}/${normalizedOriginalUrl}`;
  }

  const shortUrl = normalizedOriginalUrl;

  // Deduplicate: if a file with the exact same permanent original_url already exists for this user (or admin), reuse it
  if (normalizedOriginalUrl && normalizedOriginalUrl.startsWith('http')) {
    try {
      const existingStmt = db.prepare(
        `SELECT * FROM file_storage
         WHERE (original_url = ? OR url = ?) AND (user_id = ? OR user_id = 'admin')
         ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, id ASC
         LIMIT 1`
      );
      existingStmt.bind([normalizedOriginalUrl, normalizedOriginalUrl, userId, userId]);
      let existingFile: any = null;
      if (existingStmt.step()) {
        existingFile = existingStmt.getAsObject();
      }
      existingStmt.free();

      if (existingFile && existingFile.id) {
        if (Array.isArray(params.folderIds) && params.folderIds.length > 0) {
          for (const fid of params.folderIds) {
            const parsed = Number(fid);
            if (!isNaN(parsed) && parsed > 0) {
              try {
                db.run("INSERT OR IGNORE INTO file_folder_relations (file_id, folder_id) VALUES (?, ?)", [existingFile.id, parsed]);
              } catch {}
            }
          }
        }
        return existingFile;
      }
    } catch {}
  }

  const targetDefaultFolder = folders.find((f: any) => f.folder_type === fileType);
  const assignedFolderIds = new Set<number>();

  if (Array.isArray(params.folderIds)) {
    params.folderIds.forEach(fid => {
      const parsed = Number(fid);
      if (!isNaN(parsed) && parsed > 0) {
        assignedFolderIds.add(parsed);
      }
    });
  }

  if (targetDefaultFolder && targetDefaultFolder.id) {
    assignedFolderIds.add(Number(targetDefaultFolder.id));
  }

  const primaryFolderId = Array.from(assignedFolderIds)[0] || (targetDefaultFolder?.id ? Number(targetDefaultFolder.id) : null);

  db.run(
    `INSERT INTO file_storage (file_key, user_id, folder_id, filename, url, name, slug_name, original_url, short_url, mime_type, file_type, size_bytes, size_formatted, file_size, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileKey,
      userId,
      primaryFolderId,
      name,
      normalizedOriginalUrl,
      name,
      slugName,
      normalizedOriginalUrl,
      shortUrl,
      mimeType,
      fileType,
      fileSize,
      formatFileSize(fileSize),
      fileSize,
      width,
      height
    ]
  );

  const stmt = db.prepare("SELECT * FROM file_storage WHERE file_key = ?");
  stmt.bind([fileKey]);
  let insertedFile: any = null;
  if (stmt.step()) {
    insertedFile = stmt.getAsObject();
  }
  stmt.free();

  if (!insertedFile) return null;

  for (const fid of assignedFolderIds) {
    try {
      db.run("INSERT OR IGNORE INTO file_folder_relations (file_id, folder_id) VALUES (?, ?)", [insertedFile.id, fid]);
    } catch (e) {}
  }

  // Sync with legacy files table
  try {
    const legacyId = 'file_' + insertedFile.id + '_' + fileKey;
    db.run(
      `INSERT OR REPLACE INTO files (id, user_id, original_name, name, full_url, short_key, short_url, file_type, mime_type, file_size, size_formatted, width, height, aspect_ratio, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        legacyId,
        userId,
        name,
        name,
        normalizedOriginalUrl,
        fileKey,
        shortUrl,
        fileType,
        mimeType,
        fileSize,
        formatFileSize(fileSize),
        width,
        height,
        width && height ? width / height : 1,
        insertedFile.created_at || new Date().toISOString()
      ]
    );
  } catch (e) {}

  return {
    ...insertedFile,
    folderIds: Array.from(assignedFolderIds)
  };
}

/**
 * Fetch storage files for a user or admin, with folder relations
 */
export function getStorageFilesForUser(
  db: Database,
  userId: string = 'admin',
  options: { folderId?: number; search?: string } = {}
) {
  const normUserId = String(userId || 'admin').trim();
  ensureDefaultFoldersForUser(db, normUserId);

  let query = "";
  const queryParams: any[] = [];

  if (normUserId === 'all' || normUserId === 'admin') {
    if (options.folderId) {
      query = `
        SELECT fs.* FROM file_storage fs
        JOIN file_folder_relations ffr ON fs.id = ffr.file_id
        WHERE ffr.folder_id = ?
      `;
      queryParams.push(options.folderId);
    } else {
      query = "SELECT fs.* FROM file_storage fs WHERE 1=1";
    }
  } else {
    if (options.folderId) {
      query = `
        SELECT fs.* FROM file_storage fs
        JOIN file_folder_relations ffr ON fs.id = ffr.file_id
        WHERE (fs.user_id = ? OR fs.user_id = 'admin') AND ffr.folder_id = ?
      `;
      queryParams.push(normUserId, options.folderId);
    } else {
      query = "SELECT fs.* FROM file_storage fs WHERE (fs.user_id = ? OR fs.user_id = 'admin')";
      queryParams.push(normUserId);
    }
  }

  if (options.search) {
    query += " AND (fs.name LIKE ? OR fs.slug_name LIKE ? OR fs.file_key LIKE ?)";
    const term = `%${options.search}%`;
    queryParams.push(term, term, term);
  }

  query += " ORDER BY fs.id DESC";

  try {
    const stmt = db.prepare(query);
    stmt.bind(queryParams);
    const files: any[] = [];
    while (stmt.step()) {
      files.push(stmt.getAsObject());
    }
    stmt.free();

    // Attach folderIds to each file
    for (const f of files) {
      const relStmt = db.prepare("SELECT folder_id FROM file_folder_relations WHERE file_id = ?");
      relStmt.bind([f.id]);
      const folderIds: number[] = [];
      while (relStmt.step()) {
        const obj = relStmt.getAsObject();
        folderIds.push(Number(obj.folder_id));
      }
      relStmt.free();
      f.folderIds = folderIds;
    }

    return files;
  } catch (e) {
    console.error('[PostgreSQL] Error fetching storage files:', e);
    return [];
  }
}

export function getAllFilesFromDb(db: Database) {
  try {
    const stmt = db.prepare("SELECT * FROM files ORDER BY created_at DESC");
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

