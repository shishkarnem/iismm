import FormData from 'form-data';
import {
  getPgDB,
  normalizeUserId,
  savePgDB,
  DEFAULT_TOKEN,
  getGalleryUploadTokenFromPg
} from '../db/postgres';
import { registerFileInStorage } from '../db/filesTable';
import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

const DEFAULT_TGF_UPLOAD_TOKEN = DEFAULT_TOKEN;

export function formatImageLogChatId(fnNumber: number | string, rawUserId?: string | number): string {
  const cleanFn = Number(fnNumber) || 621;
  const cleanUid = normalizeUserId(rawUserId || '16926299042');
  return `img${cleanFn}_${cleanUid}`;
}

function resolveMimeAndExt(mimeHint?: string, urlHint?: string): { mimeType: string; ext: string } {
  const m = String(mimeHint || '').toLowerCase().trim();
  if (m.includes('webp')) return { mimeType: 'image/webp', ext: 'webp' };
  if (m.includes('jpeg') || m.includes('jpg')) return { mimeType: 'image/jpeg', ext: 'jpg' };
  if (m.includes('gif')) return { mimeType: 'image/gif', ext: 'gif' };
  if (m.includes('png')) return { mimeType: 'image/png', ext: 'png' };

  const u = String(urlHint || '').split('?')[0].toLowerCase();
  if (u.endsWith('.webp')) return { mimeType: 'image/webp', ext: 'webp' };
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return { mimeType: 'image/jpeg', ext: 'jpg' };
  if (u.endsWith('.gif')) return { mimeType: 'image/gif', ext: 'gif' };
  return { mimeType: 'image/png', ext: 'png' };
}

async function uploadBufferToProTalkTgf(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', buffer, {
      filename,
      contentType: mimeType
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://file.pro-talk.ru/tgf', {
      method: 'POST',
      headers: {
        'X-Upload-Token': getGalleryUploadTokenFromPg(DEFAULT_TGF_UPLOAD_TOKEN),
        'X-Preserve-Alpha': 'true',
        ...formData.getHeaders()
      },
      body: formData.getBuffer() as any,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const resText = await response.text();
      try {
        const parsed = JSON.parse(resText);
        const url = parsed?.url || parsed?.link || (typeof parsed === 'string' ? parsed : '');
        if (url && /^https?:\/\//i.test(url)) return url.trim();
      } catch {
        const trimmed = resText.trim().replace(/^["']|["']$/g, '');
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
      }
    }
  } catch {
    // Fallback to local / original URL
  }
  return '';
}

export interface PersistGeneratedImageParams {
  imageUrl: string;
  originalUrl?: string;
  userId?: string | number;
  fnNumber: number;
  mimeTypeHint?: string;
  width?: number;
  height?: number;
  prompt?: string;
  hostProtocol?: { host: string; protocol: string };
}

export interface PersistGeneratedImageResult {
  publicUrl: string;
  galleryShortUrl?: string;
  fileId?: number;
}

/**
 * Saves every AI-generated image (787, 621, 784, 791) to disk/TGF and registers it
 * in the generating user's personal gallery (`file_storage` + `files` + folder «Картинки»).
 */
export async function persistGeneratedImageToGallery(
  params: PersistGeneratedImageParams
): Promise<PersistGeneratedImageResult> {
  const rawImageUrl = String(params.imageUrl || '').trim();
  if (!rawImageUrl) {
    return { publicUrl: '' };
  }

  const cleanUid = normalizeUserId(params.userId || '16926299042');
  const fnNum = Number(params.fnNumber) || 621;
  const stamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);

  const fallbackHost = (process.env.APP_URL || 'https://iismm.ru')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const resolvedHost = params.hostProtocol?.host && !params.hostProtocol.host.includes('localhost')
    ? params.hostProtocol.host
    : (params.hostProtocol?.host || fallbackHost || 'iismm.ru');
  const resolvedProtocol = params.hostProtocol?.protocol || (resolvedHost.includes('localhost') ? 'http' : 'https');

  let finalPublicUrl = rawImageUrl;
  let detectedMime = params.mimeTypeHint || 'image/png';
  let detectedSize = 0;
  let filename = `ai_${fnNum}_${stamp}_${rand}.png`;

  try {
    // Case 1: Base64 data URI (e.g. function 787 with response_format = b64_json)
    const dataMatch = rawImageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
    if (dataMatch) {
      const { mimeType, ext } = resolveMimeAndExt(dataMatch[1]);
      detectedMime = mimeType;
      filename = `ai_${fnNum}_${stamp}_${rand}.${ext}`;
      const buf = Buffer.from(dataMatch[2], 'base64');
      detectedSize = buf.length;

      let tgfUrl = await uploadBufferToProTalkTgf(buf, filename, mimeType);
      if (!tgfUrl) {
        await new Promise((r) => setTimeout(r, 600));
        tgfUrl = await uploadBufferToProTalkTgf(buf, filename, mimeType);
      }
      if (tgfUrl) {
        finalPublicUrl = normalizeProTalkMediaUrl(tgfUrl);
      }
    } else if (/^https?:\/\//i.test(rawImageUrl)) {
      // Case 2: Remote HTTP(S) URL (functions 791, 784, 621, or 787 URL mode)
      const { mimeType, ext } = resolveMimeAndExt(params.mimeTypeHint, rawImageUrl);
      detectedMime = mimeType;
      filename = `ai_${fnNum}_${stamp}_${rand}.${ext}`;
      finalPublicUrl = normalizeProTalkMediaUrl(rawImageUrl);

      // Measure fileSize and mirror any temporary external CDN URL to ProTalk TGF
      try {
        const dlController = new AbortController();
        const dlTimeout = setTimeout(() => dlController.abort(), 9000);
        const dlRes = await fetch(finalPublicUrl, { signal: dlController.signal });
        clearTimeout(dlTimeout);
        if (dlRes.ok) {
          const contentType = dlRes.headers.get('content-type') || mimeType;
          const resolved = resolveMimeAndExt(contentType, finalPublicUrl);
          detectedMime = resolved.mimeType;
          filename = `ai_${fnNum}_${stamp}_${rand}.${resolved.ext}`;
          const arrBuf = await dlRes.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          detectedSize = buf.length;

          if (!finalPublicUrl.includes('pro-talk.ru')) {
            const mirrored = await uploadBufferToProTalkTgf(buf, filename, detectedMime);
            if (mirrored) {
              finalPublicUrl = normalizeProTalkMediaUrl(mirrored);
            }
          }
        }
      } catch {
        // Keep normalized rawImageUrl if remote download times out
      }
    } else if (rawImageUrl.startsWith('/')) {
      finalPublicUrl = normalizeProTalkMediaUrl(rawImageUrl) || `${resolvedProtocol}://${resolvedHost}${rawImageUrl}`;
    }

    const pgDb = await getPgDB();
    const record = registerFileInStorage(pgDb, {
      userId: cleanUid,
      name: filename,
      originalUrl: finalPublicUrl,
      mimeType: detectedMime,
      fileSize: detectedSize,
      hostProtocol: { host: resolvedHost, protocol: resolvedProtocol }
    });
    savePgDB();

    return {
      publicUrl: finalPublicUrl,
      galleryShortUrl: record?.short_url,
      fileId: record?.id
    };
  } catch (err: any) {
    console.warn('[persistGeneratedImageToGallery] Warning:', err?.message || err);
    return { publicUrl: finalPublicUrl };
  }
}
