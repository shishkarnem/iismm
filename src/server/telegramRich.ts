import { DB, DayRequest, getDefaultChannelIdentifier } from './db';
import { getBotTokenFromPg } from './db/postgres';
import { InlineButton } from '../types';
import { 
  buildReplyMarkup, 
  getTelegramBotConfig, 
  resolvePublicMediaUrl,
  resolveAllPublicUrlsInText
} from './telegram';
import { buildTelegramBaseCandidates } from './telegram/apiEndpointFallback';
import { sendV2TelegramMessage } from './telegramV2';
import { enforceParagraphsAndRichBlocks } from './formatting/textParagraphFormatter';
import {
  buildRichAttachmentMarkdownBlock,
  buildRichMultipartFormData,
  compileRichInlineMediaAndBlocks,
  containsBotApi103Features,
  enforceRichMediaLimit,
  extractRichButtonsForV2Fallback,
  isRichCompanionNativeAttachment,
  MAX_RICH_MEDIA_ATTACHMENTS,
  normalizeBotApi103ButtonAttrs,
  resolveRichPublicBaseUrl,
  toCanonicalRichMediaUrl,
  type InputRichMessageMediaItem,
  type TelegramAttachmentKind
} from './telegram/richMediaHelper';
import {
  acquireContentChannelGuard,
  acquireEntityPublishSlot,
  canonicalizeTelegramTarget,
  finalizePublishDedup,
  isDefiniteClientFailure
} from './telegram/publishDedupGuard';

export interface TelegramRichSendResponse {
  ok: boolean;
  messageId?: string;
  channel?: string;
  error?: string;
  simulated?: boolean;
  fallbackNotice?: string;
  mode?: 'rich_message' | 'send_message';
}

/**
 * Подготовка текста для Telegram Rich Message:
 * RichMessage НЕ требует экранирования спецсимволов и поддерживает до 32 000 символов.
 * Поддерживает заголовки H1-4, медиа ![](url), <tg-slideshow>, <tg-collage>,
 * <tg-document>, <tg-button>, <tg-button-row>, <blockquote expandable>, <table compact>.
 */
function normalizeProTalkRichMediaUrl(rawUrl: string): string {
  return toCanonicalRichMediaUrl(rawUrl);
}

export function prepareRichMarkdownWithMedia(
  value: string,
  options?: {
    attachmentUrl?: string;
    attachmentUrls?: string[];
    attachmentType?: TelegramAttachmentKind;
    preserveCompactSpacing?: boolean;
    audioTitle?: string;
    audioPerformer?: string;
  }
): { markdown: string; media: InputRichMessageMediaItem[] } {
  const effectiveAttachmentType: TelegramAttachmentKind =
    options?.attachmentType ||
    (Array.isArray(options?.attachmentUrls) && options.attachmentUrls.filter(Boolean).length > 1
      ? 'album'
      : options?.attachmentUrl?.trim()
      ? 'photo'
      : 'none');

  if (typeof value !== 'string' || value.trim().length === 0) {
    const attachmentOnly = buildRichAttachmentMarkdownBlock({
      attachmentType: effectiveAttachmentType,
      attachmentUrl: options?.attachmentUrl,
      attachmentUrls: options?.attachmentUrls,
      existingMarkdown: '',
      audioTitle: options?.audioTitle,
      audioPerformer: options?.audioPerformer
    });
    return {
      markdown: attachmentOnly.markdownBlock,
      media: attachmentOnly.mediaItems
    };
  }

  let md = value.trim();

  // Convert legacy invisible link preview [​](url) to native Rich image embed ![](url), protecting existing ![]
  md = md.replace(/(?<!\!)\[[\u200B\s]*\]\((https?:\/\/[^\s\)]+)\)/gi, '![]($1)');

  // Convert any HeroCard formats to markdown image attachments ![alt](url)
  md = md.replace(/(?:!\[HeroCard\]|HeroCard)\s*\((https?:\/\/[^\s\)]+)\)/gi, '![alt]($1)');

  // Normalize any /file/... or https://.../file/... links to canonical ProTalk TGF URLs
  md = md.replace(/!\[(.*?)\]\(((?:https?:\/\/[^/\s)]+)?\/file\/[^\s\)]+)\)/gi, (_, alt, u) => {
    return `![${alt}](${normalizeProTalkRichMediaUrl(u)})`;
  });

  // Always preserve canonical file.pro-talk.ru/tgf/ (Dialog AI fails on filestore.pro-talk.ru/)
  md = md.replace(/https?:\/\/filestore\.pro-talk\.ru\//gi, 'https://file.pro-talk.ru/tgf/');

  // Ensure relative or localhost URLs inside markdown media or <tg-document>/<video>/<audio> resolve cleanly
  const publicBase = resolveRichPublicBaseUrl();
  md = md.replace(/!\[(.*?)\]\(\/([^\s\)]+)\)/g, `![$1](${publicBase}/$2)`);
  md = md.replace(
    /!\[(.*?)\]\(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/([^\s\)]+)\)/g,
    `![$1](${publicBase}/$2)`
  );
  md = md.replace(
    /(<(?:tg-document|video|audio)\b[^>]*\bsrc=["'])\/([^"']+)(["'])/gi,
    `$1${publicBase}/$2$3`
  );

  // Protect stray unclosed <tg-slideshow> / <tg-collage> mentions in prose that lack a closing tag
  md = md.replace(/<tg-(slideshow|collage)>(?![\s\S]*?<\/tg-\1>)/gi, '`tg-$1`');

  // Normalize <tg-slideshow>, <tg-collage>, and <tg-button-row> blocks with clean blank lines
  md = md.replace(/<tg-slideshow>([\s\S]*?)<\/tg-slideshow>/gi, (_, inner) => {
    const lines = inner.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    return `\n\n<tg-slideshow>\n${lines.join('\n')}\n</tg-slideshow>\n\n`;
  });
  md = md.replace(/<tg-collage>([\s\S]*?)<\/tg-collage>/gi, (_, inner) => {
    const lines = inner.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    return `\n\n<tg-collage>\n${lines.join('\n')}\n</tg-collage>\n\n`;
  });
  md = md.replace(/<tg-button-row([^>]*)>([\s\S]*?)<\/tg-button-row>/gi, (_, attrs, inner) => {
    const lines = inner.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    return `\n\n<tg-button-row${attrs}>\n  ${lines.join('\n  ')}\n</tg-button-row>\n\n`;
  });

  // If a heading is immediately followed on the same line by an image or media tag, separate them with clean blank lines
  md = md.replace(/^(#{1,4}\s+[^\n!<\(\[]+?)\s*(!\[[^\n]*\]\([^\n]+\))\s*([^\n]*)$/gm, '$1\n\n$2\n\n$3');
  md = md.replace(/^(#{1,4}\s+[^\n!<\(\[]+?)\s*(<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>)\s*([^\n]*)$/gm, '$1\n\n$2\n\n$3');

  // Ensure headings have a blank line before and after
  md = md.replace(/([^\n])\n(#{1,4}\s+[^\n]+)/g, '$1\n\n$2');
  md = md.replace(/(#{1,4}\s+[^\n]+)\n([^\n#])/g, '$1\n\n$2');

  if (!options?.preserveCompactSpacing) {
    md = enforceParagraphsAndRichBlocks(md, 'rich');
  }

  // Ensure extra blank line before subscribe link or <tg-button-row> in selection cards
  md = md.replace(/([^\n])\n(<b>\[(?:✅|🔍|📱|💎|🚀)?\s*Подписаться[^\n]*<\/b>)/gi, '$1\n\n$2');
  md = md.replace(/([^\n])\n(<tg-button-row\b)/gi, '$1\n\n$2');

  // Compile inline <tg-document>, <video>, <audio> tags into InputRichMessageMedia items
  const compiledInline = compileRichInlineMediaAndBlocks(md);
  md = compiledInline.markdown;

  // Embed external attachment (photo, album -> slideshow, video/audio/voice/document -> InputRichMessageMedia)
  const attachmentResult = buildRichAttachmentMarkdownBlock({
    attachmentType: effectiveAttachmentType,
    attachmentUrl: options?.attachmentUrl,
    attachmentUrls: options?.attachmentUrls,
    existingMarkdown: md,
    audioTitle: options?.audioTitle,
    audioPerformer: options?.audioPerformer
  });
  if (attachmentResult.markdownBlock) {
    md = md ? `${attachmentResult.markdownBlock}\n\n${md}` : attachmentResult.markdownBlock;
  }

  const combinedMedia: InputRichMessageMediaItem[] = [
    ...attachmentResult.mediaItems,
    ...compiledInline.media
  ];

  // Normalize Bot API 10.3 <tg-button> attributes (copy-text -> text, callback-data -> callback_data)
  md = normalizeBotApi103ButtonAttrs(md);

  // Deduplicate excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  // Enforce Telegram Bot API official 50-attachment limit per Rich message
  const enforced = enforceRichMediaLimit(md, combinedMedia, MAX_RICH_MEDIA_ATTACHMENTS);
  if (enforced.trimmedCount > 0) {
    console.warn(
      `[prepareRichMarkdownWithMedia] Trimmed ${enforced.trimmedCount} extra media attachments (${enforced.totalBefore} -> ${MAX_RICH_MEDIA_ATTACHMENTS}) to respect Telegram Rich limit.`
    );
  }

  return { markdown: enforced.markdown, media: enforced.media };
}

export function prepareRichMarkdown(
  value: string,
  options?: {
    attachmentUrl?: string;
    attachmentUrls?: string[];
    attachmentType?: TelegramAttachmentKind;
    preserveCompactSpacing?: boolean;
    audioTitle?: string;
    audioPerformer?: string;
  }
): string {
  return prepareRichMarkdownWithMedia(value, options).markdown;
}

export function buildInlineKeyboard(buttonsString: string): { inline_keyboard: Array<Array<{ text: string; url: string }>> } {
  const inlineKeyboard: Array<Array<{ text: string; url: string }>> = [];
  if (!buttonsString || typeof buttonsString !== 'string') {
    return { inline_keyboard: [] };
  }
  const buttonPairs = buttonsString.split(';');
  for (let i = 0; i < buttonPairs.length; i++) {
    const rawPair = buttonPairs[i].trim();
    if (!rawPair) continue;
    const pair = rawPair.split('|');
    if (pair.length >= 2) {
      const text = pair[0].trim();
      let url = pair.slice(1).join('|').trim();
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        url = url.replace(/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, resolveRichPublicBaseUrl());
      }
      if (text && url) {
        inlineKeyboard.push([{ text, url }]);
      }
    }
  }
  return { inline_keyboard: inlineKeyboard };
}

export const prepareRichMarkdownText = prepareRichMarkdown;

/**
 * Dedicated Global Telegram Rich Message Sender
 * Uses Telegram /sendRichMessage endpoint with { chat_id, rich_message: { markdown, media? } }
 * Directly supports native rich images ![](url), carousels <tg-slideshow>, collages <tg-collage>,
 * native Bot API 10.3/10.4 inline media (<tg-document>, video, audio, voice_note), and <tg-button>/<tg-button-row>.
 */
export async function sendRichTelegramMessage(
  title: string,
  content: string,
  dayRequest: DayRequest,
  options?: {
    messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
    uppercaseHeader?: boolean;
    signature?: string;
    linkPreviewEnabled?: boolean;
    attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note' | 'voice';
    audioFormat?: 'audio' | 'voice';
    audioTitle?: string;
    audioPerformer?: string;
    protectContent?: boolean;
    attachmentUrl?: string;
    attachmentUrls?: string[];
    inlineButtons?: InlineButton[][] | InlineButton[];
    buttons?: string;
    channels?: string[];
    telegramId?: number | string;
    dedupKey?: string;
    isTest?: boolean;
    __internalDedupClaimed?: boolean;
  }
): Promise<TelegramRichSendResponse> {
  const mergedOptions = { ...options };
  let effectiveContent = content !== undefined && content !== null ? content : '';

  // Resolve internal shortlinks /file/... in content and options to canonical public URLs
  effectiveContent = await resolveAllPublicUrlsInText(effectiveContent);
  const rawAttachmentUrlOption = (mergedOptions.attachmentUrl || dayRequest.attachmentUrl || '').trim();
  const rawAttachmentUrlsOption = Array.isArray(mergedOptions.attachmentUrls) && mergedOptions.attachmentUrls.length > 0
    ? mergedOptions.attachmentUrls
    : Array.isArray(dayRequest.attachmentUrls)
    ? dayRequest.attachmentUrls
    : [];

  if (rawAttachmentUrlOption) {
    mergedOptions.attachmentUrl = await resolvePublicMediaUrl(rawAttachmentUrlOption);
  }
  if (rawAttachmentUrlsOption.length > 0) {
    mergedOptions.attachmentUrls = await Promise.all(rawAttachmentUrlsOption.map(u => resolvePublicMediaUrl(u)));
  }

  const effectiveAttachmentUrls = (mergedOptions.attachmentUrls || [])
    .map(u => toCanonicalRichMediaUrl(u))
    .filter(Boolean);
  const effectiveImageUrl = toCanonicalRichMediaUrl(
    mergedOptions.attachmentUrl || effectiveAttachmentUrls[0] || ''
  );

  const rawAttachmentType = mergedOptions.attachmentType || dayRequest.attachmentType || 'none';
  const effectiveAudioFormat = mergedOptions.audioFormat || (dayRequest as any).audioFormat;
  const effectiveAttachmentType: TelegramAttachmentKind =
    rawAttachmentType === 'audio' && effectiveAudioFormat === 'voice'
      ? 'voice'
      : rawAttachmentType === 'none' && effectiveAttachmentUrls.length > 1
      ? 'album'
      : rawAttachmentType === 'none' && effectiveImageUrl
      ? 'photo'
      : (rawAttachmentType as TelegramAttachmentKind);

  const needsCompanionNativeAttachment =
    isRichCompanionNativeAttachment(effectiveAttachmentType) &&
    Boolean(effectiveImageUrl || effectiveAttachmentUrls.length > 0);

  if (!effectiveContent.trim() && title && title.trim() && !needsCompanionNativeAttachment && !effectiveImageUrl) {
    effectiveContent = `# ${title.trim()}`;
  }

  const botConfig = await getTelegramBotConfig();
  const settings = DB.getSettings();
  const token = botConfig.botToken || getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  // Ordered gateway candidates: respects configured proxyType with automatic fallback
  const endpointsToTry = buildTelegramBaseCandidates(botConfig.apiBaseUrl, botConfig.proxyType);

  const defaultFallbackChannel = getDefaultChannelIdentifier();
  const targetChannels = mergedOptions.channels && mergedOptions.channels.length > 0
    ? mergedOptions.channels
    : (dayRequest.channels && dayRequest.channels.length > 0 ? dayRequest.channels : [dayRequest.channel || settings.channelId || defaultFallbackChannel]);

  const inlineButtons = mergedOptions.inlineButtons || dayRequest.inlineButtons || [];

  const richSig = String(mergedOptions.signature ?? dayRequest?.signature ?? '').trim();
  if (richSig) {
    const normWs = (s: string) => s.replace(/\s+/g, ' ').trim();
    const preparedSig = prepareRichMarkdown(richSig);
    const alreadyHasSig =
      effectiveContent.includes(richSig) ||
      (preparedSig && normWs(effectiveContent).includes(normWs(preparedSig)));
    if (!alreadyHasSig && (effectiveContent.trim() || !needsCompanionNativeAttachment)) {
      effectiveContent = effectiveContent.trim()
        ? `${effectiveContent.trim()}\n\n${richSig}`
        : richSig;
    }
  }

  // Strictly prepare rich markdown + Bot API 10.3/10.4 InputRichMessageMedia[]
  const prepared = prepareRichMarkdownWithMedia(effectiveContent, {
    attachmentType: needsCompanionNativeAttachment ? 'none' : effectiveAttachmentType,
    attachmentUrl: needsCompanionNativeAttachment ? undefined : effectiveImageUrl,
    attachmentUrls: needsCompanionNativeAttachment ? undefined : effectiveAttachmentUrls,
    audioTitle: mergedOptions.audioTitle ?? (dayRequest as any)?.audioTitle,
    audioPerformer: mergedOptions.audioPerformer ?? (dayRequest as any)?.audioPerformer
  });
  const postText = prepared.markdown;
  const richMediaItems = prepared.media;

  if (!token || token.trim() === '') {
    return {
      ok: false,
      error: 'Не указан токен Telegram бота в настройках.',
      simulated: true
    };
  }

  const successChannels: string[] = [];
  const duplicateChannels: string[] = [];
  const errors: string[] = [];
  let lastMessageId = '1';

  for (const rawCh of targetChannels) {
    let channel = rawCh;

    if (channel === 'bot_dm' || channel === '@bot_dm' || channel === 'direct_message') {
      const numericTgId = options?.telegramId || settings.channelId;
      if (!numericTgId) {
        errors.push(`Не указан Telegram ID для отправки в личные сообщения`);
        continue;
      }
      channel = String(numericTgId);
    } else {
      const dbChannels = DB.getChannels() || [];
      const cleanTarget = String(channel || '').replace(/^@/, '').toLowerCase().trim();
      const found = dbChannels.find((c: any) => 
        String(c.id || '').toLowerCase() === cleanTarget ||
        String(c.channelId || '').toLowerCase() === cleanTarget ||
        String(c.username || '').replace(/^@/, '').toLowerCase() === cleanTarget ||
        String(c.name || '').toLowerCase() === cleanTarget ||
        String(c.title || '').toLowerCase() === cleanTarget
      );
      if (found) {
        if (found.telegramId && /^-?\d+$/.test(String(found.telegramId))) {
          channel = String(found.telegramId);
        } else if (found.username && /^[a-zA-Z0-9_]{4,32}$/.test(found.username.replace(/^@/, '').trim())) {
          channel = `@${found.username.replace(/^@/, '').trim()}`;
        }
      }

      const isNumeric = /^-?\d+$/.test(String(channel).trim());
      const cleanUname = String(channel).replace(/^@/, '').trim();
      const isValidUname = /^[a-zA-Z0-9_]{4,32}$/.test(cleanUname);

      if (isNumeric) {
        channel = String(channel).trim();
      } else if (isValidUname) {
        channel = `@${cleanUname}`;
      } else {
        const softMatch = dbChannels.find((c: any) =>
          (c.name && cleanTarget.includes(String(c.name).toLowerCase())) ||
          (c.title && cleanTarget.includes(String(c.title).toLowerCase()))
        );
        if (softMatch?.telegramId && /^-?\d+$/.test(String(softMatch.telegramId))) {
          channel = String(softMatch.telegramId);
        } else if (softMatch?.username && /^[a-zA-Z0-9_]{4,32}$/.test(softMatch.username.replace(/^@/, '').trim())) {
          channel = `@${softMatch.username.replace(/^@/, '').trim()}`;
        } else {
          channel = settings.channelId || defaultFallbackChannel;
        }
      }
    }

    let replyMarkup = buildReplyMarkup(inlineButtons, false);
    if (!replyMarkup && mergedOptions.buttons && typeof mergedOptions.buttons === 'string' && mergedOptions.buttons.trim()) {
      replyMarkup = buildInlineKeyboard(mergedOptions.buttons);
    }

    const effectiveMarkdown = (postText || '').trim();
    if (!effectiveMarkdown && !effectiveImageUrl && !needsCompanionNativeAttachment) {
      console.warn(`[sendRichTelegramMessage] Empty markdown text for channel ${channel}. Cancelling to prevent channel spam.`);
      errors.push(`Текст публикации для ${channel} пуст. Отправка отменена.`);
      continue;
    }

    const claimedDedupKeys: string[] = [];
    if (!options?.__internalDedupClaimed) {
      const canonChan = canonicalizeTelegramTarget(channel, options?.telegramId);
      if (options?.dedupKey) {
        const slotKey = targetChannels.length > 1 ? `${options.dedupKey}:${canonChan}` : options.dedupKey;
        const slotClaim = await acquireEntityPublishSlot({
          slotKey,
          entityType: options?.isTest ? 'direct' : 'post',
          entityId: String(dayRequest?.id || 'rich'),
          channelKey: canonChan
        });
        if (!slotClaim.claimed) {
          console.warn(`[AntiSpam Protection] Rich entity slot blocked for ${canonChan} (${slotClaim.reason})`);
          duplicateChannels.push(channel);
          continue;
        }
        claimedDedupKeys.push(slotClaim.dedupKey);
      }

      const contentClaim = await acquireContentChannelGuard({
        channel,
        telegramId: options?.telegramId,
        title,
        content: effectiveContent,
        attachmentUrl: effectiveImageUrl || undefined,
        attachmentUrls: effectiveAttachmentUrls,
        inlineButtons,
        entityType: options?.isTest ? 'direct' : 'post',
        entityId: String(dayRequest?.id || ''),
        isTest: options?.isTest
      });
      if (!contentClaim.claimed) {
        if (claimedDedupKeys.length > 0) {
          await finalizePublishDedup(claimedDedupKeys, 'definite_failure');
        }
        console.warn(`[AntiSpam Protection] Rich content duplicate blocked for ${canonChan} (${contentClaim.reason})`);
        duplicateChannels.push(channel);
        continue;
      }
      claimedDedupKeys.push(contentClaim.dedupKey);
    }

    let sendSuccess = false;
    let channelErrMsg = '';
    let channelMsgId: string | undefined;
    let hadTransportTimeout = false;

    try {
      let resultData: any = null;
      let usedV2Fallback = false;

      // Companion native delivery for document / audio / voice / video_note
      if (needsCompanionNativeAttachment) {
        if (effectiveMarkdown) {
          const textPayload: any = {
            chat_id: String(channel).trim(),
            rich_message: { markdown: effectiveMarkdown }
          };
          if (replyMarkup) textPayload.reply_markup = replyMarkup;
          for (let epIdx = 0; epIdx < endpointsToTry.length; epIdx++) {
            const epBase = endpointsToTry[epIdx];
            const attemptTimeout = epIdx < endpointsToTry.length - 1 ? 15000 : 28000;
            try {
              const richRes = await fetch(`${epBase}/bot${token}/sendRichMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(textPayload),
                signal: AbortSignal.timeout(attemptTimeout)
              });
              resultData = await richRes.json();
              if (resultData?.ok) break;
            } catch {}
          }
          if (!resultData?.ok) {
            // Fallback Rich text to V2 HTML text if /sendRichMessage failed
            const textV2Res = await sendV2TelegramMessage(title, effectiveContent, dayRequest, {
              ...mergedOptions,
              channels: [channel],
              messageFormat: 'rich',
              attachmentType: 'none',
              attachmentUrl: undefined,
              attachmentUrls: undefined,
              __internalDedupClaimed: true
            });
            if (!textV2Res.ok) {
              channelErrMsg = textV2Res.error || resultData?.description || 'Ошибка отправки текста';
              errors.push(`${channel}: ${channelErrMsg}`);
              continue;
            }
          }
        }

        const companionCaption = effectiveMarkdown ? '' : '';
        const mediaRes = await sendV2TelegramMessage(title, companionCaption, dayRequest, {
          ...mergedOptions,
          channels: [channel],
          messageFormat: 'v2',
          signature: '',
          attachmentType: effectiveAttachmentType as any,
          audioFormat: effectiveAudioFormat,
          audioTitle: mergedOptions.audioTitle ?? (dayRequest as any)?.audioTitle,
          audioPerformer: mergedOptions.audioPerformer ?? (dayRequest as any)?.audioPerformer,
          protectContent: mergedOptions.protectContent ?? (dayRequest as any)?.protectContent,
          attachmentUrl: effectiveImageUrl || undefined,
          attachmentUrls: effectiveAttachmentUrls.length > 0 ? effectiveAttachmentUrls : undefined,
          inlineButtons: effectiveMarkdown ? undefined : inlineButtons,
          __internalDedupClaimed: true
        });

        if (mediaRes.ok) {
          sendSuccess = true;
          usedV2Fallback = true;
          channelMsgId = mediaRes.messageId || lastMessageId;
          lastMessageId = channelMsgId;
          successChannels.push(channel);
        } else {
          channelErrMsg = mediaRes.error || 'Не удалось доставить вложение';
          errors.push(`${channel}: ${channelErrMsg}`);
        }
        continue;
      }

      // 1. Формируем PAYLOAD для /sendRichMessage (поддержка Bot API 10.3/10.4 media[] и <tg-button>)
      const payload: any = {
        chat_id: String(channel).trim(),
        rich_message: {
          markdown: postText,
          ...(richMediaItems.length > 0 ? { media: richMediaItems } : {})
        }
      };

      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }
      if (mergedOptions.protectContent ?? (dayRequest as any)?.protectContent) {
        payload.protect_content = true;
      }

      const has103Features = containsBotApi103Features(postText, richMediaItems);
      void has103Features;

      // Отправка через шлюз: при таймауте ответа не переключаемся на другой шлюз и не делаем V2 fallback,
      // чтобы исключить дубликат поста на канале.
      for (let epIdx = 0; epIdx < endpointsToTry.length; epIdx++) {
        const epBase = endpointsToTry[epIdx];
        const attemptTimeout = endpointsToTry.length === 1 ? 45000 : (epIdx < endpointsToTry.length - 1 ? 30000 : 45000);
        try {
          const richRes = await fetch(`${epBase}/bot${token}/sendRichMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(attemptTimeout)
          });
          resultData = await richRes.json();
          if (resultData?.ok) break;
        } catch (err: any) {
          const msg = String(err?.message || err || '');
          const isTimeoutErr = err?.name === 'TimeoutError' || err?.name === 'AbortError' || /timeout|timed out|abort/i.test(msg);
          console.warn(`[sendRichTelegramMessage] Endpoint failed (${epBase}):`, msg);
          if (isTimeoutErr) {
            hadTransportTimeout = true;
            resultData = { ok: false, description: `Таймаут ожидания ответа Telegram Gateway (${msg})` };
            break;
          }
        }
      }

      // Если Telegram не смог скачать файл по HTTP URL (failed to get HTTP URL content / RICH_MESSAGE_*_NO_MEDIA_FOUND),
      // пробуем нативную multipart-загрузку FormData (attach://...) прямо в /sendRichMessage!
      const rawDesc = String(resultData?.description || '');
      const isMediaFetchFailure =
        !hadTransportTimeout &&
        !resultData?.ok &&
        (/failed to get HTTP URL content/i.test(rawDesc) ||
          /RICH_MESSAGE_(?:PHOTO|VIDEO|AUDIO|DOCUMENT)_NO_MEDIA_FOUND/i.test(rawDesc) ||
          /RICH_MESSAGE_(?:PHOTO|VIDEO|AUDIO|DOCUMENT)_URL_INVALID/i.test(rawDesc));

      if (isMediaFetchFailure) {
        const includeInlinePhotos =
          /RICH_MESSAGE_(?:PHOTO|VIDEO)/i.test(rawDesc) || /!\[[^\]]*\]\(https?:\/\//i.test(postText);
        try {
          const mp = await buildRichMultipartFormData({
            chatId: String(channel).trim(),
            markdown: postText,
            mediaItems: richMediaItems,
            replyMarkup,
            protectContent: Boolean(mergedOptions.protectContent ?? (dayRequest as any)?.protectContent),
            includeMarkdownPhotos: includeInlinePhotos
          });
          if (mp.attachedCount > 0) {
            for (let epIdx = 0; epIdx < endpointsToTry.length; epIdx++) {
              const epBase = endpointsToTry[epIdx];
              const attemptTimeout = endpointsToTry.length === 1 ? 45000 : (epIdx < endpointsToTry.length - 1 ? 30000 : 45000);
              try {
                const mpRes = await fetch(`${epBase}/bot${token}/sendRichMessage`, {
                  method: 'POST',
                  body: mp.formData,
                  signal: AbortSignal.timeout(attemptTimeout)
                });
                const mpJson = await mpRes.json();
                if (mpJson?.ok) {
                  resultData = mpJson;
                  break;
                }
                resultData = mpJson;
              } catch (mpErr: any) {
                const mpMsg = String(mpErr?.message || mpErr || '');
                const isMpTimeout = mpErr?.name === 'TimeoutError' || mpErr?.name === 'AbortError' || /timeout|timed out|abort/i.test(mpMsg);
                console.warn(`[sendRichTelegramMessage] Multipart /sendRichMessage failed (${epBase}):`, mpMsg);
                if (isMpTimeout) {
                  hadTransportTimeout = true;
                  resultData = { ok: false, description: `Таймаут ожидания multipart-ответа (${mpMsg})` };
                  break;
                }
              }
            }
          }
        } catch (mpPrepErr: any) {
          console.warn(`[sendRichTelegramMessage] Multipart prep error:`, mpPrepErr.message);
        }
      }

      // Если в кнопках были WebApp / нестандартные URL, пробуем с fallback URL
      if (!hadTransportTimeout && !resultData?.ok && (resultData?.description?.includes('BUTTON_TYPE_INVALID') || resultData?.description?.includes('BUTTON_URL_INVALID'))) {
        const fallbackMarkup = buildReplyMarkup(inlineButtons, true);
        payload.reply_markup = fallbackMarkup;
        for (let epIdx = 0; epIdx < endpointsToTry.length; epIdx++) {
          const epBase = endpointsToTry[epIdx];
          const attemptTimeout = 30000;
          try {
            const retryRes = await fetch(`${epBase}/bot${token}/sendRichMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(attemptTimeout)
            });
            resultData = await retryRes.json();
            if (resultData?.ok) break;
          } catch (btnErr: any) {
            if (btnErr?.name === 'TimeoutError' || btnErr?.name === 'AbortError') {
              hadTransportTimeout = true;
              break;
            }
          }
        }
      }

      if (resultData && resultData.ok) {
        sendSuccess = true;
        channelMsgId = Array.isArray(resultData.result)
          ? resultData.result[0]?.message_id?.toString()
          : resultData.result?.message_id?.toString() || '1';
        lastMessageId = channelMsgId || lastMessageId;
        successChannels.push(channel);
      } else {
        const errorDescRaw = resultData?.description || 'Unknown error';
        console.warn(`[sendRichTelegramMessage] /sendRichMessage failed for ${channel}: ${errorDescRaw}`);

        const isMemberOrChatError = errorDescRaw.includes('bot is not a member') ||
          errorDescRaw.includes('chat not found') ||
          errorDescRaw.includes('bot was kicked') ||
          errorDescRaw.includes('Forbidden') ||
          errorDescRaw.includes('not enough rights');

        if (!hadTransportTimeout && !isMemberOrChatError && (effectiveAttachmentType !== 'none' || !/<tg-(?:slideshow|collage)>/i.test(postText))) {
          // Extract <tg-button-row> / <tg-button> into V2 inline_keyboard so buttons survive fallback cleanly
          const { cleanedText: buttonsExtractedText, extractedRows } = extractRichButtonsForV2Fallback(effectiveContent);
          const existingRows: InlineButton[][] = Array.isArray(inlineButtons)
            ? (Array.isArray(inlineButtons[0])
                ? (inlineButtons as InlineButton[][])
                : [(inlineButtons as InlineButton[])])
            : [];
          const combinedButtons: InlineButton[][] = [...existingRows, ...extractedRows].filter(
            (r) => Array.isArray(r) && r.length > 0
          );

          // Fallback to native Bot API multipart upload preserving actual attachmentType & all URLs
          const cleanedForV2 = buttonsExtractedText
            .replace(/<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>/gi, '')
            .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
            .replace(/<video[\s\S]*?(?:<\/video>|\/>)/gi, '')
            .replace(/<audio[\s\S]*?(?:<\/audio>|\/>)/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          try {
            const fallbackRes = await sendV2TelegramMessage(title, cleanedForV2 || buttonsExtractedText, dayRequest, {
              ...mergedOptions,
              channels: [channel],
              messageFormat: 'rich',
              attachmentType: effectiveAttachmentType as any,
              audioFormat: effectiveAudioFormat,
              audioTitle: mergedOptions.audioTitle ?? (dayRequest as any)?.audioTitle,
              audioPerformer: mergedOptions.audioPerformer ?? (dayRequest as any)?.audioPerformer,
              protectContent: mergedOptions.protectContent ?? (dayRequest as any)?.protectContent,
              attachmentUrl: effectiveImageUrl || undefined,
              attachmentUrls: effectiveAttachmentUrls.length > 0 ? effectiveAttachmentUrls : undefined,
              inlineButtons: combinedButtons.length > 0 ? combinedButtons : inlineButtons,
              __internalDedupClaimed: true
            });

            if (fallbackRes.ok) {
              sendSuccess = true;
              usedV2Fallback = true;
              channelMsgId = fallbackRes.messageId || '1';
              lastMessageId = channelMsgId;
              successChannels.push(channel);
            } else {
              channelErrMsg = fallbackRes.error || errorDescRaw;
              errors.push(`${channel}: ${channelErrMsg}`);
            }
          } catch (fbErr: any) {
            channelErrMsg = fbErr.message || errorDescRaw;
            errors.push(`${channel}: ${channelErrMsg}`);
          }
        } else {
          const userFriendlyError = isMemberOrChatError
            ? `Бот не является администратором канала ${channel}. Добавьте бота @${botConfig.botUsername?.replace(/^@/, '') || 'IIrkiBot'} в канал с правами публикации.`
            : errorDescRaw;
          channelErrMsg = userFriendlyError;
          errors.push(`${channel}: ${userFriendlyError}`);
        }
      }
      if (sendSuccess && usedV2Fallback) {
        // fallback tracked
      }
    } catch (sendErr: any) {
      channelErrMsg = String(sendErr?.message || sendErr || '');
      errors.push(`${channel}: ${channelErrMsg}`);
    } finally {
      if (claimedDedupKeys.length > 0) {
        const outcome = sendSuccess
          ? 'sent'
          : !hadTransportTimeout && isDefiniteClientFailure(channelErrMsg)
          ? 'definite_failure'
          : 'ambiguous_timeout';
        await finalizePublishDedup(claimedDedupKeys, outcome, channelMsgId);
      }
    }
  }

  if (successChannels.length > 0) {
    return {
      ok: true,
      messageId: lastMessageId,
      channel: successChannels.join(', '),
      mode: 'rich_message'
    };
  }

  if (duplicateChannels.length > 0 && errors.length === 0) {
    return {
      ok: true,
      messageId: 'duplicate_prevented',
      channel: duplicateChannels.join(', '),
      simulated: false,
      fallbackNotice: 'Дубликат публикации заблокирован защитой от повторной отправки.'
    };
  }

  return {
    ok: false,
    error: errors.join('; ') || 'Не удалось отправить сообщение в Telegram',
    simulated: false
  };
}

/**
 * Global direct helper for sending Telegram Rich Message
 * Matches Google Apps Script /sendRichMessage signature:
 * { chat_id, rich_message: { markdown }, reply_markup }
 */
export async function sendTelegramRichMessage(params: {
  chatId: string | number;
  markdown: string;
  buttons?: string;
  replyMarkup?: any;
  reply_markup?: any;
  botToken?: string;
  apiBaseUrl?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; result?: any }> {
  const dummyReq: any = {
    id: `rich_direct_${Date.now()}`,
    channel: String(params.chatId),
    channels: [String(params.chatId)],
    title: 'Rich Message',
    messageFormat: 'rich'
  };

  const res = await sendRichTelegramMessage(
    'Rich Message',
    params.markdown,
    dummyReq,
    {
      channels: [String(params.chatId)],
      telegramId: params.chatId,
      messageFormat: 'rich',
      buttons: params.buttons,
      inlineButtons: params.replyMarkup?.inline_keyboard || params.reply_markup?.inline_keyboard
    }
  );

  return {
    ok: res.ok,
    messageId: res.messageId,
    error: res.error
  };
}

