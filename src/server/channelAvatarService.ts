import FormData from 'form-data';
import {
  getPgDB,
  savePgDB,
  getBotTokenFromPg,
  DEFAULT_TOKEN,
  getGalleryUploadTokenFromPg
} from './db/postgres';
import { DB } from './db';
import { registerFileInStorage } from './db/filesTable';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { getTelegramBotConfig } from './telegram';
import { fetchTelegramBotApi, fetchTelegramBotFileBuffer } from './telegram/apiEndpointFallback';

const PROTALK_UPLOAD_URL = 'https://file.pro-talk.ru/tgf';
const PROTALK_DEFAULT_TOKEN = DEFAULT_TOKEN;

// Memory cache & in-flight deduplication to prevent redundant Telegram and ProTalk network calls
const avatarMemoryCache = new Map<string, { url: string; timestamp: number }>();
const userAvatarMemoryCache = new Map<string, { url: string; timestamp: number }>();
const inFlightChannelAvatars = new Map<string, Promise<string>>();
const inFlightUserAvatars = new Map<string, Promise<string>>();

/**
 * Checks whether a URL is already a full direct permanent URL from our ProTalk gallery storage.
 */
export function isFullGalleryDirectUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const clean = rawUrl.trim();
  return clean.startsWith('https://file.pro-talk.ru/tgf/');
}

/**
 * Resolves any shortened (/f/<key>, /file/<id_or_key>/..., or filestore) URL stored in DB
 * into its full permanent original_url (https://file.pro-talk.ru/tgf/...).
 */
export function expandShortGalleryUrlToFull(db: any, rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const normalized = normalizeProTalkMediaUrl(rawUrl);
  if (!normalized) return '';
  if (isFullGalleryDirectUrl(normalized)) return normalized;

  // Match /f/<shortKey> or https://.../f/<shortKey>
  const fMatch = normalized.match(/(?:^|https?:\/\/[^/]+)\/f\/([^/?#.]+)/i);
  if (fMatch && fMatch[1]) {
    const shortKey = fMatch[1];
    try {
      const legacy = DB.getFileByShortKey(shortKey);
      if (legacy?.fullUrl && legacy.fullUrl.startsWith('https://')) {
        return normalizeProTalkMediaUrl(legacy.fullUrl);
      }
    } catch {}
    if (db) {
      try {
        const rows = db.exec(
          'SELECT original_url FROM file_storage WHERE file_key = ? LIMIT 1',
          [shortKey]
        );
        const found = normalizeProTalkMediaUrl(String(rows[0]?.values?.[0]?.[0] || ''));
        if (found.startsWith('https://')) return found;
      } catch {}
      try {
        const rows2 = db.exec(
          'SELECT full_url FROM files WHERE short_key = ? LIMIT 1',
          [shortKey]
        );
        const found2 = normalizeProTalkMediaUrl(String(rows2[0]?.values?.[0]?.[0] || ''));
        if (found2.startsWith('https://')) return found2;
      } catch {}
    }
  }

  // Match /file/<idOrKey> or /file/<idOrKey>/<slug>
  const fileMatch = normalized.match(/(?:^|https?:\/\/[^/]+)\/file\/([^/?#]+)(?:\/([^/?#]+))?/i);
  if (fileMatch && fileMatch[1] && db) {
    const paramId = fileMatch[1];
    const paramSlug = fileMatch[2] || '';
    try {
      if (paramSlug) {
        const bySlug = db.exec(
          'SELECT original_url FROM file_storage WHERE LOWER(slug_name) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1',
          [paramSlug, paramSlug]
        );
        const foundBySlug = normalizeProTalkMediaUrl(String(bySlug[0]?.values?.[0]?.[0] || ''));
        if (foundBySlug.startsWith('https://')) return foundBySlug;
      }
      if (/^\d+$/.test(paramId)) {
        const num = parseInt(paramId, 10);
        const byId = db.exec(
          'SELECT original_url FROM file_storage WHERE legacy_id = ? OR id = ? ORDER BY CASE WHEN legacy_id = ? THEN 0 ELSE 1 END LIMIT 1',
          [num, num, num]
        );
        const foundById = normalizeProTalkMediaUrl(String(byId[0]?.values?.[0]?.[0] || ''));
        if (foundById.startsWith('https://')) return foundById;
      }
      const byKey = db.exec(
        'SELECT original_url FROM file_storage WHERE file_key = ? OR slug_name = ? LIMIT 1',
        [paramId, paramId]
      );
      const foundByKey = normalizeProTalkMediaUrl(String(byKey[0]?.values?.[0]?.[0] || ''));
      if (foundByKey.startsWith('https://')) return foundByKey;
    } catch {}
  }

  return '';
}

/**
 * Uploads any binary image buffer to ProTalk gallery (https://file.pro-talk.ru/tgf),
 * registers it in file_storage for the given userId, and returns the full direct URL.
 */
export async function uploadImageBufferToGallery(
  imgBuffer: Buffer,
  filename: string,
  mimeType: string = 'image/jpeg',
  userId: string = 'admin'
): Promise<string> {
  if (!imgBuffer || imgBuffer.length === 0) return '';

  const form = new FormData();
  form.append('file', imgBuffer, {
    filename: filename || 'avatar.jpg',
    contentType: mimeType || 'image/jpeg'
  });

  const uploadRes = await fetch(PROTALK_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'X-Upload-Token': getGalleryUploadTokenFromPg(PROTALK_DEFAULT_TOKEN),
      'X-Preserve-Alpha': 'true',
      ...form.getHeaders()
    },
    body: form.getBuffer(),
    signal: AbortSignal.timeout(15000)
  });

  if (!uploadRes.ok) return '';

  const resText = await uploadRes.text();
  let upData: any = {};
  try {
    upData = JSON.parse(resText);
  } catch {
    const trimmed = resText.trim().replace(/^["']|["']$/g, '');
    if (trimmed.startsWith('http')) {
      upData = { url: trimmed };
    }
  }

  const uploadedUrl = String(
    upData.url || upData.link || (typeof upData === 'string' ? upData : '')
  ).trim();

  if (uploadedUrl && uploadedUrl.startsWith('https://')) {
    try {
      const db = await getPgDB();
      registerFileInStorage(db, {
        userId: String(userId || 'admin').trim() || 'admin',
        name: filename || 'avatar.jpg',
        originalUrl: uploadedUrl,
        mimeType: mimeType || 'image/jpeg',
        fileSize: imgBuffer.length
      });
      savePgDB();
    } catch (regErr: any) {
      console.warn('[uploadImageBufferToGallery] file_storage registration warning:', regErr?.message);
    }
    return uploadedUrl;
  }

  return '';
}

/**
 * Downloads channel avatar from Telegram or external source,
 * uploads it to our ProTalk media gallery (https://file.pro-talk.ru/tgf),
 * registers it in file_storage under ownerUserId, updates channels and promo_selection_channels,
 * and returns the full permanent public ProTalk URL.
 */
export async function ensureChannelAvatarInGallery(
  identifier: string,
  fallbackUrl?: string,
  ownerUserId?: string,
  forceRefresh: boolean = false
): Promise<string> {
  const rawId = (identifier || '').trim();
  const cleanHandle = rawId.replace(/^@/, '').replace(/\.(jpg|png|jpeg|webp)$/i, '').trim();
  const cacheKey = cleanHandle.toLowerCase();

  if (!forceRefresh && cacheKey && inFlightChannelAvatars.has(cacheKey)) {
    return inFlightChannelAvatars.get(cacheKey)!;
  }

  const runPromise = (async (): Promise<string> => {
    const db = await getPgDB();

    // If fallback URL is already a ProTalk permanent URL, use it directly
    if (!forceRefresh && fallbackUrl && typeof fallbackUrl === 'string') {
      const expandedFallback = expandShortGalleryUrlToFull(db, fallbackUrl);
      if (expandedFallback && isFullGalleryDirectUrl(expandedFallback)) {
        return expandedFallback;
      }
    }

    if (!forceRefresh && cacheKey) {
      const cached = avatarMemoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000 * 24 && isFullGalleryDirectUrl(cached.url)) {
        return cached.url;
      }
    }

    let resolvedOwnerId = String(ownerUserId || '').trim();

    // 1. Check if DB already has a ProTalk URL (or expandable short URL) for this channel
    if (cleanHandle) {
      try {
        const rows = db.exec(
          `SELECT photo_url, user_id, id FROM channels WHERE username = ? OR username = ? OR id = ? OR telegram_id = ? LIMIT 1`,
          [cleanHandle, '@' + cleanHandle, cleanHandle, cleanHandle]
        );
        if (rows[0]?.values?.[0]) {
          const dbPhoto = String(rows[0].values[0][0] || '').trim();
          const dbUserId = String(rows[0].values[0][1] || '').trim();
          const dbChanId = String(rows[0].values[0][2] || '').trim();
          if (!resolvedOwnerId && dbUserId) resolvedOwnerId = dbUserId;

          if (!forceRefresh && dbPhoto) {
            const expanded = expandShortGalleryUrlToFull(db, dbPhoto);
            if (expanded && isFullGalleryDirectUrl(expanded)) {
              if (expanded !== dbPhoto && dbChanId) {
                try {
                  db.run('UPDATE channels SET photo_url = ? WHERE id = ?', [expanded, dbChanId]);
                  DB.updateChannel(dbChanId, { photoUrl: expanded });
                  savePgDB();
                } catch {}
              }
              avatarMemoryCache.set(cacheKey, { url: expanded, timestamp: Date.now() });
              return expanded;
            }
          }
        }
      } catch {}

      // 1b. Also check if file_storage already has this channel's avatar registered
      if (!forceRefresh) {
        try {
          const expectedFilename = `${cleanHandle.replace(/[^a-zA-Z0-9_-]/g, '') || 'channel'}_avatar.jpg`;
          const fsRows = db.exec(
            `SELECT original_url FROM file_storage WHERE LOWER(filename) = LOWER(?) AND original_url LIKE 'https://file.pro-talk.ru/tgf/%' ORDER BY id ASC LIMIT 1`,
            [expectedFilename]
          );
          const existingStoredUrl = String(fsRows[0]?.values?.[0]?.[0] || '').trim();
          if (existingStoredUrl && isFullGalleryDirectUrl(existingStoredUrl)) {
            avatarMemoryCache.set(cacheKey, { url: existingStoredUrl, timestamp: Date.now() });
            return existingStoredUrl;
          }
        } catch {}
      }
    }

    // 2. Fetch image buffer from Telegram Bot API
    let imgBuffer: Buffer | null = null;
    const filename = `${cleanHandle.replace(/[^a-zA-Z0-9_-]/g, '') || 'channel'}_avatar.jpg`;
    let mimeType = 'image/jpeg';

  const settings = DB.getSettings();
  const token =
    getBotTokenFromPg() ||
    settings.telegramBotToken ||
    '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  if (token && cleanHandle) {
    try {
      let chatId = cleanHandle;
      if (!chatId.startsWith('-') && !chatId.startsWith('@') && !/^\d+$/.test(chatId)) {
        chatId = '@' + chatId;
      }

      const tgConfig = await getTelegramBotConfig().catch(() => null);
      const chatData = await fetchTelegramBotApi({
        primaryBase: tgConfig?.apiBaseUrl,
        proxyType: tgConfig?.proxyType,
        token,
        endpoint: `getChat?chat_id=${encodeURIComponent(chatId)}`,
        timeoutMs: 8000
      });

      if (chatData.ok && chatData.result?.photo) {
        const fileId = chatData.result.photo.big_file_id || chatData.result.photo.small_file_id;
        if (fileId) {
          const fileData = await fetchTelegramBotApi({
            primaryBase: tgConfig?.apiBaseUrl,
            proxyType: tgConfig?.proxyType,
            token,
            endpoint: `getFile?file_id=${encodeURIComponent(fileId)}`,
            timeoutMs: 8000
          });

          if (fileData.ok && fileData.result?.file_path) {
            const downloaded = await fetchTelegramBotFileBuffer({
              primaryBase: tgConfig?.apiBaseUrl,
              proxyType: tgConfig?.proxyType,
              token,
              filePath: fileData.result.file_path,
              timeoutMs: 12000
            });
            if (downloaded) {
              imgBuffer = downloaded.buffer;
              mimeType = downloaded.mimeType;
            }
          }
        }
      }
    } catch (tgErr: any) {
      console.warn(`[ensureChannelAvatarInGallery] Telegram fetch failed for ${cleanHandle}:`, tgErr?.message);
    }
  }

  // 2b. Fallback external HTTP source if Telegram didn't return a photo
  if (!imgBuffer && fallbackUrl && typeof fallbackUrl === 'string') {
    const cleanFb = fallbackUrl.trim();
    if (
      (cleanFb.startsWith('http://') || cleanFb.startsWith('https://')) &&
      !cleanFb.includes('/channel-avatar/') &&
      !cleanFb.includes('/api/avatar/')
    ) {
      try {
        const fbRes = await fetch(cleanFb, { signal: AbortSignal.timeout(8000) });
        if (fbRes.ok) {
          const arrayBuf = await fbRes.arrayBuffer();
          imgBuffer = Buffer.from(arrayBuf);
          mimeType = fbRes.headers.get('content-type') || 'image/jpeg';
        }
      } catch (fbErr: any) {
        console.warn('[ensureChannelAvatarInGallery] External fetch failed:', fbErr?.message);
      }
    }
  }

  // 3. Upload buffer to ProTalk Gallery and persist full URL
  if (imgBuffer && imgBuffer.length > 0) {
    try {
      const uploadedUrl = await uploadImageBufferToGallery(
        imgBuffer,
        filename,
        mimeType,
        resolvedOwnerId || 'admin'
      );

      if (uploadedUrl && isFullGalleryDirectUrl(uploadedUrl)) {
        if (cleanHandle) {
          try {
            db.run(
              `UPDATE channels SET photo_url = ? WHERE username = ? OR username = ? OR id = ? OR telegram_id = ?`,
              [uploadedUrl, cleanHandle, '@' + cleanHandle, cleanHandle, cleanHandle]
            );
            db.run(
              `UPDATE promo_selection_channels SET channel_avatar_url = ? WHERE channel_username = ? OR channel_username = ? OR channel_id = ?`,
              [uploadedUrl, cleanHandle, '@' + cleanHandle, cleanHandle]
            );
            const allCh = DB.getChannels();
            for (const ch of allCh) {
              const uClean = String(ch.username || '').replace(/^@/, '');
              if (
                uClean.toLowerCase() === cleanHandle.toLowerCase() ||
                ch.id === cleanHandle ||
                String(ch.telegramId || '') === cleanHandle
              ) {
                DB.updateChannel(ch.id, { photoUrl: uploadedUrl });
              }
            }
            savePgDB();
          } catch (dbErr: any) {
            console.warn('[ensureChannelAvatarInGallery] DB update warning:', dbErr?.message);
          }
        }

        if (cacheKey) {
          avatarMemoryCache.set(cacheKey, { url: uploadedUrl, timestamp: Date.now() });
        }
        return uploadedUrl;
      }
    } catch (upErr: any) {
      console.warn('[ensureChannelAvatarInGallery] ProTalk upload failed:', upErr?.message);
    }
  }

    return '';
  })();

  if (cacheKey) {
    inFlightChannelAvatars.set(cacheKey, runPromise);
  }
  try {
    return await runPromise;
  } finally {
    if (cacheKey) {
      inFlightChannelAvatars.delete(cacheKey);
    }
  }
}

/**
 * Downloads a Telegram user's profile avatar via Bot API (getUserProfilePhotos / getChat),
 * uploads it into our ProTalk media gallery (https://file.pro-talk.ru/tgf),
 * registers it in file_storage under userId, saves the full permanent URL in users.photo_url,
 * and returns the full direct gallery URL.
 */
export async function ensureUserTelegramAvatarInGallery(
  telegramId: number | string,
  userId?: string,
  fallbackUrl?: string,
  forceRefresh: boolean = false
): Promise<string> {
  const tgNum = parseInt(String(telegramId || '').replace(/\D/g, ''), 10);
  if (!tgNum || isNaN(tgNum) || tgNum <= 0) return '';

  const cacheKey = String(tgNum);
  if (!forceRefresh && inFlightUserAvatars.has(cacheKey)) {
    return inFlightUserAvatars.get(cacheKey)!;
  }

  const runUserPromise = (async (): Promise<string> => {
    const db = await getPgDB();

    if (!forceRefresh) {
      const cached = userAvatarMemoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000 * 12 && isFullGalleryDirectUrl(cached.url)) {
        return cached.url;
      }
    }

    let resolvedUserId = String(userId || '').trim();
    let existingUserAvatar = '';
    let existingPhotoUrl = '';

    try {
      const rows = db.exec(
        `SELECT id, photo_url, user_avatar FROM users WHERE telegram_id = ? OR id = ? LIMIT 1`,
        [tgNum, resolvedUserId || String(tgNum)]
      );
      if (rows[0]?.values?.[0]) {
        const dbId = String(rows[0].values[0][0] || '').trim();
        existingPhotoUrl = String(rows[0].values[0][1] || '').trim();
        existingUserAvatar = String(rows[0].values[0][2] || '').trim();
        if (!resolvedUserId && dbId) resolvedUserId = dbId;
      }
    } catch {}

    if (!forceRefresh) {
      const expandedCustom = expandShortGalleryUrlToFull(db, existingUserAvatar);
      if (expandedCustom && isFullGalleryDirectUrl(expandedCustom)) {
        userAvatarMemoryCache.set(cacheKey, { url: expandedCustom, timestamp: Date.now() });
        return expandedCustom;
      }
      const expandedPhoto = expandShortGalleryUrlToFull(db, existingPhotoUrl);
      if (expandedPhoto && isFullGalleryDirectUrl(expandedPhoto)) {
        userAvatarMemoryCache.set(cacheKey, { url: expandedPhoto, timestamp: Date.now() });
        return expandedPhoto;
      }
      try {
        const fsRows = db.exec(
          `SELECT original_url FROM file_storage WHERE LOWER(filename) = LOWER(?) AND original_url LIKE 'https://file.pro-talk.ru/tgf/%' ORDER BY id ASC LIMIT 1`,
          [`tg_profile_${tgNum}.jpg`]
        );
        const storedUrl = String(fsRows[0]?.values?.[0]?.[0] || '').trim();
        if (storedUrl && isFullGalleryDirectUrl(storedUrl)) {
          userAvatarMemoryCache.set(cacheKey, { url: storedUrl, timestamp: Date.now() });
          return storedUrl;
        }
      } catch {}
    }

  const settings = DB.getSettings();
  const token =
    getBotTokenFromPg() ||
    settings.telegramBotToken ||
    '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  let imgBuffer: Buffer | null = null;
  let mimeType = 'image/jpeg';

  if (token) {
    try {
      const tgConfig = await getTelegramBotConfig().catch(() => null);
      let fileId = '';
      // 1. Try getUserProfilePhotos first
      const photosData = await fetchTelegramBotApi({
        primaryBase: tgConfig?.apiBaseUrl,
        proxyType: tgConfig?.proxyType,
        token,
        endpoint: `getUserProfilePhotos?user_id=${tgNum}&limit=1`,
        timeoutMs: 8000
      });
      if (photosData.ok && photosData.result?.total_count > 0 && Array.isArray(photosData.result.photos?.[0])) {
        const sizes = photosData.result.photos[0];
        const largest = sizes[sizes.length - 1];
        if (largest?.file_id) fileId = String(largest.file_id);
      }

      // 2. Fallback to getChat photo if getUserProfilePhotos returned empty
      if (!fileId) {
        const chatData = await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token,
          endpoint: `getChat?chat_id=${tgNum}`,
          timeoutMs: 8000
        });
        if (chatData.ok && chatData.result?.photo) {
          fileId = String(chatData.result.photo.big_file_id || chatData.result.photo.small_file_id || '');
        }
      }

      if (fileId) {
        const fileData = await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token,
          endpoint: `getFile?file_id=${encodeURIComponent(fileId)}`,
          timeoutMs: 8000
        });
        if (fileData.ok && fileData.result?.file_path) {
          const downloaded = await fetchTelegramBotFileBuffer({
            primaryBase: tgConfig?.apiBaseUrl,
            proxyType: tgConfig?.proxyType,
            token,
            filePath: fileData.result.file_path,
            timeoutMs: 12000
          });
          if (downloaded) {
            imgBuffer = downloaded.buffer;
            mimeType = downloaded.mimeType;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[ensureUserTelegramAvatarInGallery] Telegram photo fetch warning (${tgNum}):`, err?.message);
    }
  }

  // Fallback external HTTP avatar (e.g. from Telegram WebApp photo_url) if Bot API had none
  if (!imgBuffer && fallbackUrl && typeof fallbackUrl === 'string') {
    const cleanFb = fallbackUrl.trim();
    if (
      (cleanFb.startsWith('http://') || cleanFb.startsWith('https://')) &&
      !cleanFb.includes('/api/avatar/') &&
      !cleanFb.includes('unsplash.com')
    ) {
      try {
        const fbRes = await fetch(cleanFb, { signal: AbortSignal.timeout(8000) });
        if (fbRes.ok) {
          const arrayBuf = await fbRes.arrayBuffer();
          imgBuffer = Buffer.from(arrayBuf);
          mimeType = fbRes.headers.get('content-type') || 'image/jpeg';
        }
      } catch {}
    }
  }

  if (imgBuffer && imgBuffer.length > 0) {
    try {
      const filename = `tg_profile_${tgNum}.jpg`;
      const uploadedUrl = await uploadImageBufferToGallery(
        imgBuffer,
        filename,
        mimeType,
        resolvedUserId || String(tgNum)
      );

      if (uploadedUrl && isFullGalleryDirectUrl(uploadedUrl)) {
        const shouldUpdateCustomAvatar =
          !existingUserAvatar ||
          existingUserAvatar.startsWith('/f/') ||
          existingUserAvatar.includes('/file/') ||
          existingUserAvatar.includes('/api/avatar/') ||
          existingUserAvatar.includes('api.telegram.org/file/');

        try {
          if (shouldUpdateCustomAvatar) {
            db.run(
              `UPDATE users SET photo_url = ?, user_avatar = ? WHERE telegram_id = ? OR id = ?`,
              [uploadedUrl, uploadedUrl, tgNum, resolvedUserId || String(tgNum)]
            );
          } else {
            db.run(
              `UPDATE users SET photo_url = ? WHERE telegram_id = ? OR id = ?`,
              [uploadedUrl, tgNum, resolvedUserId || String(tgNum)]
            );
          }
          const legacyUser =
            (resolvedUserId ? DB.getUserById(resolvedUserId) : undefined) ||
            DB.getUserByTelegramId(tgNum);
          if (legacyUser) {
            DB.updateUser(legacyUser.id, {
              photoUrl: uploadedUrl,
              ...(shouldUpdateCustomAvatar ? { userAvatar: uploadedUrl } : {})
            });
          }
          savePgDB();
        } catch {}

        userAvatarMemoryCache.set(cacheKey, { url: uploadedUrl, timestamp: Date.now() });
        return uploadedUrl;
      }
    } catch (err: any) {
      console.warn('[ensureUserTelegramAvatarInGallery] Gallery upload failed:', err?.message);
    }
  }

    return '';
  })();

  inFlightUserAvatars.set(cacheKey, runUserPromise);
  try {
    return await runUserPromise;
  } finally {
    inFlightUserAvatars.delete(cacheKey);
  }
}

/**
 * Self-healing startup routine: converts any shortened (/f/..., /file/...) URLs
 * in users and channels tables into their full permanent gallery original_url.
 */
export async function normalizeStoredGalleryAvatarUrlsInDb(): Promise<void> {
  try {
    const db = await getPgDB();
    let changed = false;

    const userRows = db.exec(`SELECT id, photo_url, user_avatar FROM users`);
    if (userRows[0]?.values) {
      for (const vals of userRows[0].values) {
        const id = String(vals[0] || '');
        const photoUrl = String(vals[1] || '').trim();
        const userAvatar = String(vals[2] || '').trim();

        const fullPhoto = expandShortGalleryUrlToFull(db, photoUrl);
        const fullAvatar = expandShortGalleryUrlToFull(db, userAvatar);

        const nextPhoto = fullPhoto || photoUrl;
        const nextAvatar = fullAvatar || userAvatar;

        if (nextPhoto !== photoUrl || nextAvatar !== userAvatar) {
          db.run(`UPDATE users SET photo_url = ?, user_avatar = ? WHERE id = ?`, [
            nextPhoto,
            nextAvatar,
            id
          ]);
          try {
            DB.updateUser(id, {
              ...(nextPhoto ? { photoUrl: nextPhoto } : {}),
              ...(nextAvatar ? { userAvatar: nextAvatar } : {})
            });
          } catch {}
          changed = true;
        }
      }
    }

    const chanRows = db.exec(`SELECT id, photo_url FROM channels`);
    if (chanRows[0]?.values) {
      for (const vals of chanRows[0].values) {
        const id = String(vals[0] || '');
        const photoUrl = String(vals[1] || '').trim();
        const fullPhoto = expandShortGalleryUrlToFull(db, photoUrl);
        if (fullPhoto && fullPhoto !== photoUrl) {
          db.run(`UPDATE channels SET photo_url = ? WHERE id = ?`, [fullPhoto, id]);
          try {
            DB.updateChannel(id, { photoUrl: fullPhoto });
          } catch {}
          changed = true;
        }
      }
    }

    if (changed) {
      savePgDB();
    }
  } catch (err: any) {
    console.warn('[normalizeStoredGalleryAvatarUrlsInDb] Warning:', err?.message);
  }
}
