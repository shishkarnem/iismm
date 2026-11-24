const DEFAULT_PROTALK_USER_ID = 'recTWyxN1GrSPlSxc';
const DEFAULT_PROTALK_UPLOAD_TOKEN =
  'YGNcVnFsW1lhalh3GH0rBkQgeRQzDS4ZBFAzayQnKgEJcCFwdSdKASYfHRQHPRQYaGtdWGtjUgVvAH9YAmk';

function resolveProTalkUserId(): string {
  const raw = (process.env.PROTALK_DB_USER_ID || '').trim();
  if (!raw) return DEFAULT_PROTALK_USER_ID;
  if (raw.startsWith('rec')) return raw;
  if (raw.startsWith('eyJ')) {
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      if (decoded?.ruid && String(decoded.ruid).startsWith('rec')) {
        return String(decoded.ruid).trim();
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_PROTALK_USER_ID;
  }
  return DEFAULT_PROTALK_USER_ID;
}

function resolveProTalkBaseUrl(): string {
  const raw = (process.env.PROTALK_DB_BASE_URL || '').trim();
  if (!raw) return 'https://db.pro-talk.ru';
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return parsed.origin;
  } catch {
    return raw.replace(/\/api\/.*$/i, '').replace(/\/+$/, '') || 'https://db.pro-talk.ru';
  }
}

export const PROTALK_DB_CONFIG = {
  get database(): string {
    return (process.env.PROTALK_DB_NAME || '').trim() || 'iismm2';
  },
  get userId(): string {
    return resolveProTalkUserId();
  },
  get baseUrl(): string {
    return resolveProTalkBaseUrl();
  },
  get tgfUploadUrl(): string {
    return (process.env.PROTALK_TGF_URL || '').trim() || 'https://file.pro-talk.ru/tgf';
  },
  get defaultTgfUploadToken(): string {
    return (process.env.PROTALK_UPLOAD_TOKEN || '').trim() || DEFAULT_PROTALK_UPLOAD_TOKEN;
  },
  get telegramProxyBase(): string {
    return ((process.env.TELEGRAM_PROXY_BASE_URL || '').trim() || 'https://eu1.account.dialog.ai.atiks.org').replace(
      /\/+$/,
      ''
    );
  },
  telegramDirectBase: 'https://eu1.account.dialog.ai.atiks.org'
};

export function getProTalkDbHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': PROTALK_DB_CONFIG.userId,
    ...(extra || {})
  };
}

export function getProTalkQueryUrl(): string {
  return `${PROTALK_DB_CONFIG.baseUrl}/api/proxy/query`;
}

export function getProTalkMcpUrl(): string {
  return `${PROTALK_DB_CONFIG.baseUrl}/api/databases/${PROTALK_DB_CONFIG.database}/mcp`;
}

export function getProTalkDbApiUrl(subPath: string): string {
  const clean = subPath.replace(/^\/+/, '');
  return `${PROTALK_DB_CONFIG.baseUrl}/api/databases/${PROTALK_DB_CONFIG.database}/${clean}`;
}
