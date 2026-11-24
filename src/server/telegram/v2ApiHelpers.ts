import { DB } from '../db';
import type { TelegramV2SendOptions } from '../telegramV2';
import { getTelegramBotConfig } from '../telegram';
import { fetchTelegramBotApi } from './apiEndpointFallback';

export function resolveTargetChannelIdentifier(
  rawCh: string,
  options: TelegramV2SendOptions | undefined,
  channelIdFromSettings: string,
  defaultFallbackChannel: string
): { channel?: string; error?: string } {
  if (rawCh === 'bot_dm' || rawCh === '@bot_dm' || rawCh === 'direct_message') {
    const numericTgId = options?.telegramId || channelIdFromSettings;
    if (!numericTgId) {
      return { error: 'Не указан идентификатор Telegram для отправки в личные сообщения' };
    }
    return { channel: String(numericTgId) };
  }

  let channel = rawCh;
  const dbChannels = DB.getChannels() || [];
  const cleanTarget = String(channel || '').replace(/^@/, '').toLowerCase().trim();
  const found = dbChannels.find(
    (c: any) =>
      String(c.id || '').toLowerCase() === cleanTarget ||
      String(c.channelId || '').toLowerCase() === cleanTarget ||
      String(c.username || '').replace(/^@/, '').toLowerCase() === cleanTarget ||
      String(c.name || '').toLowerCase() === cleanTarget ||
      String(c.title || '').toLowerCase() === cleanTarget
  );

  if (found) {
    if (found.telegramId && /^-?\d+$/.test(String(found.telegramId))) {
      channel = String(found.telegramId);
    } else if (
      found.username &&
      /^[a-zA-Z0-9_]{4,32}$/.test(found.username.replace(/^@/, '').trim())
    ) {
      channel = `@${found.username.replace(/^@/, '').trim()}`;
    }
  }

  const isNumeric = /^-?\d+$/.test(String(channel).trim());
  const cleanUname = String(channel).replace(/^@/, '').trim();
  const isInternalDbId = /^ch_[a-z0-9]+$/i.test(cleanUname);
  const isValidUname = !isInternalDbId && /^[a-zA-Z0-9_]{4,32}$/.test(cleanUname);

  if (isNumeric) {
    return { channel: String(channel).trim() };
  }
  if (isValidUname) {
    return { channel: `@${cleanUname}` };
  }

  const softMatch = dbChannels.find(
    (c: any) =>
      (c.name && cleanTarget.includes(String(c.name).toLowerCase())) ||
      (c.title && cleanTarget.includes(String(c.title).toLowerCase()))
  );
  if (softMatch?.telegramId && /^-?\d+$/.test(String(softMatch.telegramId))) {
    return { channel: String(softMatch.telegramId) };
  }
  if (
    softMatch?.username &&
    /^[a-zA-Z0-9_]{4,32}$/.test(softMatch.username.replace(/^@/, '').trim())
  ) {
    return { channel: `@${softMatch.username.replace(/^@/, '').trim()}` };
  }
  return { channel: channelIdFromSettings || defaultFallbackChannel };
}

export async function fetchTelegramV2Api(params: {
  apiBase: string;
  token: string;
  endpoint: string;
  buildInit: () => RequestInit;
  timeoutMs?: number;
  proxyType?: string;
}): Promise<any> {
  let effectiveProxyType = params.proxyType;
  if (!effectiveProxyType) {
    try {
      const cfg = await getTelegramBotConfig();
      effectiveProxyType = cfg.proxyType;
    } catch {}
  }

  return fetchTelegramBotApi({
    primaryBase: params.apiBase,
    proxyType: effectiveProxyType,
    token: params.token,
    endpoint: params.endpoint,
    buildInit: params.buildInit,
    timeoutMs: params.timeoutMs ?? 25000
  });
}

export async function sendFollowUpMessageIfNeeded(params: {
  apiBase: string;
  token: string;
  channel: string;
  fullHtmlText: string;
  hasShortCaption: boolean;
  replyMarkup: any;
  protectContent: boolean;
}) {
  const { apiBase, token, channel, fullHtmlText, hasShortCaption, replyMarkup, protectContent } =
    params;
  if (hasShortCaption) {
    return;
  }
  try {
    const bodyStr = JSON.stringify({
      chat_id: channel,
      text: fullHtmlText || 'Подробнее:',
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      protect_content: protectContent || undefined
    });
    await fetchTelegramV2Api({
      apiBase,
      token,
      endpoint: 'sendMessage',
      buildInit: () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      })
    });
  } catch {}
}
