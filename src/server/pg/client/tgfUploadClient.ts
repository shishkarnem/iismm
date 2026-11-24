import FormData from 'form-data';
import { PROTALK_DB_CONFIG } from './protalkConfig';

export interface TgfUploadResult {
  url: string;
  sizeBytes: number;
  filename: string;
  mimeType: string;
}

/**
 * Uploads binary buffer or Base64 data URI to ProTalk Storage (https://file.pro-talk.ru/tgf)
 * so binary/Base64 payloads are never written directly into PostgreSQL columns.
 */
export async function uploadBufferToProTalkTgf(params: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  uploadToken?: string;
  preserveAlpha?: boolean;
}): Promise<TgfUploadResult> {
  const token = (params.uploadToken || PROTALK_DB_CONFIG.defaultTgfUploadToken).trim();
  const mimeType = params.mimeType || 'application/octet-stream';
  const filename = params.filename || `file_${Date.now()}.bin`;

  // Use native Web FormData + Blob when available in Node 22+, fallback to form-data buffer
  const form = new globalThis.FormData();
  const blob = new Blob([new Uint8Array(params.buffer)], { type: mimeType });
  form.append('file', blob, filename);

  const response = await fetch(PROTALK_DB_CONFIG.tgfUploadUrl, {
    method: 'POST',
    headers: {
      'X-Upload-Token': token,
      'X-Preserve-Alpha': 'true'
    },
    body: form as any
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Ошибка ответа ProTalk Storage (${response.status}): ${text.slice(0, 200)}`);
  }

  const uploadedUrl = json?.url || json?.file_url || json?.data?.url;
  if (!response.ok || !uploadedUrl) {
    // Fallback via form-data package if native FormData failed
    const legacyForm = new FormData();
    legacyForm.append('file', params.buffer, { filename, contentType: mimeType });
    const fallbackRes = await fetch(PROTALK_DB_CONFIG.tgfUploadUrl, {
      method: 'POST',
      headers: {
        ...legacyForm.getHeaders(),
        'X-Upload-Token': token,
        'X-Preserve-Alpha': 'true'
      },
      body: legacyForm.getBuffer() as any
    });
    const fallbackJson: any = await fallbackRes.json().catch(() => null);
    const fallbackUrl = fallbackJson?.url || fallbackJson?.file_url || fallbackJson?.data?.url;
    if (!fallbackRes.ok || !fallbackUrl) {
      throw new Error(
        `Не удалось загрузить файл в ProTalk Storage: ${json?.error || fallbackJson?.error || response.status}`
      );
    }
    return {
      url: String(fallbackUrl),
      sizeBytes: params.buffer.length,
      filename,
      mimeType
    };
  }

  return {
    url: String(uploadedUrl),
    sizeBytes: params.buffer.length,
    filename,
    mimeType
  };
}

/**
 * Checks if a string is a data:...;base64,... URI and converts it into a clean ProTalk TGF URL.
 */
export async function sanitizePotentialBase64Media(
  value: string,
  defaultPrefix: string = 'asset',
  uploadToken?: string
): Promise<string> {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/);
  if (!match) return value;

  const mimeType = match[1] || 'image/png';
  const b64 = match[2].replace(/\s+/g, '');
  const ext = (mimeType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '') || 'bin';
  const buffer = Buffer.from(b64, 'base64');
  const uploaded = await uploadBufferToProTalkTgf({
    buffer,
    filename: `${defaultPrefix}_${Date.now()}.${ext}`,
    mimeType,
    uploadToken
  });
  return uploaded.url;
}
