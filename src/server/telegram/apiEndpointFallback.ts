import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in current Node runtime
}

export const TELEGRAM_GATEWAY_PRESETS = {
  dialog_ai: 'https://eu1.account.dialog.ai.atiks.org',
  direct: 'https://eu1.account.dialog.ai.atiks.org'
} as const;

export function normalizeTelegramGatewayUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return TELEGRAM_GATEWAY_PRESETS.dialog_ai;
  let u = rawUrl.trim().replace(/\/+$/, '');
  u = u.replace(/\/bot[^/]+.*$/i, '');
  if (!u || u.includes('api.telegram.org')) return TELEGRAM_GATEWAY_PRESETS.dialog_ai;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

/**
 * Returns an ordered, deduplicated list of Telegram Bot API gateway URLs.
 * Always routes all Telegram Bot API & file requests through https://eu1.account.dialog.ai.atiks.org
 * (or a user-configured custom Cloudflare/reverse proxy first, falling back to dialog.ai).
 * Never sends requests to blocked https://api.telegram.org.
 */
export function buildTelegramBaseCandidates(
  configuredBase?: string,
  proxyType?: string
): string[] {
  const candidates: string[] = [];
  const pushUnique = (url?: string) => {
    if (!url || !url.trim()) return;
    if (url.includes('api.telegram.org')) return;
    const norm = normalizeTelegramGatewayUrl(url);
    if (!candidates.includes(norm)) candidates.push(norm);
  };

  if (
    proxyType === 'custom_cloudflare' &&
    configuredBase &&
    !configuredBase.includes('api.telegram.org')
  ) {
    pushUnique(configuredBase);
  } else if (
    configuredBase &&
    !configuredBase.includes('api.telegram.org') &&
    configuredBase !== TELEGRAM_GATEWAY_PRESETS.dialog_ai
  ) {
    pushUnique(configuredBase);
  }

  pushUnique(TELEGRAM_GATEWAY_PRESETS.dialog_ai);
  return candidates;
}

export async function fetchTelegramBotApi(params: {
  primaryBase?: string;
  proxyType?: string;
  token: string;
  endpoint: string;
  buildInit?: () => RequestInit;
  timeoutMs?: number;
}): Promise<any> {
  const { primaryBase, proxyType, token, endpoint, buildInit, timeoutMs = 25000 } = params;
  const candidates = buildTelegramBaseCandidates(primaryBase, proxyType);
  let lastError: any = null;

  for (let idx = 0; idx < candidates.length; idx++) {
    const base = candidates[idx];
    const hasMoreFallbacks = idx < candidates.length - 1;
    const attemptTimeout = hasMoreFallbacks ? Math.min(timeoutMs, 14000) : timeoutMs;
    const cleanEp = String(endpoint || '').replace(/^\/+/, '');
    const url = `${base}/bot${token}/${cleanEp}`;

    const init = buildInit ? buildInit() : { method: 'GET' };
    const isMutatingPost = String(init?.method || 'GET').toUpperCase() === 'POST' && /^send/i.test(cleanEp);

    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(attemptTimeout)
      });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed.ok === 'boolean') {
        if (parsed.ok || res.status < 500) {
          return parsed;
        }
        lastError = new Error(parsed.description || `HTTP ${res.status}`);
      } else if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      } else {
        return { ok: false, description: 'Пустой или некорректный ответ от Telegram API' };
      }
    } catch (err: any) {
      lastError = err;
      const isTimeoutErr = err?.name === 'TimeoutError' || err?.name === 'AbortError' || /timeout|timed out|abort/i.test(String(err?.message || ''));
      if (isMutatingPost && isTimeoutErr) {
        throw err;
      }
    }

    if (hasMoreFallbacks) {
      console.warn(
        `[telegramApi] Endpoint failed (${base}/${cleanEp}), switching to fallback:`,
        lastError?.message || lastError
      );
    }
  }

  throw lastError || new Error('Ошибка сети Telegram API');
}

export async function fetchTelegramBotFileBuffer(params: {
  primaryBase?: string;
  proxyType?: string;
  token: string;
  filePath: string;
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { primaryBase, proxyType, token, filePath, timeoutMs = 12000 } = params;
  const cleanFilePath = String(filePath || '').replace(/^\/+/, '');
  if (!cleanFilePath) return null;

  const candidates = buildTelegramBaseCandidates(primaryBase, proxyType);
  for (const base of candidates) {
    try {
      const downloadUrl = `${base}/file/bot${token}/${cleanFilePath}`;
      const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuf),
          mimeType: res.headers.get('content-type') || 'image/jpeg'
        };
      }
    } catch {}
  }
  return null;
}
