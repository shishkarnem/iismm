import FormData from 'form-data';
import { DB, DayRequest, getDefaultChannelIdentifier } from './db';
import { getBotTokenFromPg, getPgDB } from './db/postgres';
import { InlineButton } from '../types';
import {
  convertToTelegramHTML, stripHTML, fetchMediaBuffer, resolvePublicUrl, resolvePublicMediaUrl,
  buildReplyMarkup, convertAudioToTelegramVoice, convertVideoToTelegramVideoNote,
  getTelegramBotConfig, cleanTelegramBaseUrl
} from './telegram';
import { truncateTelegramHtmlSafe } from './telegram/htmlCaptionHelper';
import {
  resolveTargetChannelIdentifier,
  fetchTelegramV2Api,
  sendFollowUpMessageIfNeeded
} from './telegram/v2ApiHelpers';
import { isVideoMediaUrl } from '../utils/urlUtils';
import {
  acquireContentChannelGuard,
  acquireEntityPublishSlot,
  canonicalizeTelegramTarget,
  finalizePublishDedup,
  isDefiniteClientFailure
} from './telegram/publishDedupGuard';

export interface TelegramV2SendResponse {
  ok: boolean; messageId?: string; channel?: string; error?: string; simulated?: boolean; fallbackNotice?: string;
}

export interface TelegramV2SendOptions {
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
  uppercaseHeader?: boolean; signature?: string; linkPreviewEnabled?: boolean;
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note' | 'voice';
  audioFormat?: 'audio' | 'voice'; audioTitle?: string; audioPerformer?: string; protectContent?: boolean;
  attachmentUrl?: string; attachmentUrls?: string[];
  inlineButtons?: InlineButton[][] | InlineButton[];
  channels?: string[]; telegramId?: number | string;
  dedupKey?: string;
  isTest?: boolean;
  __internalDedupClaimed?: boolean;
}

type FetchedBufferItem = { buffer: Buffer; filename: string; contentType: string; mediaType: 'photo' | 'video' | 'audio' | 'document' };



async function sendSingleMediaAttachment(params: {
  apiBase: string;
  token: string;
  channel: string;
  endpoint: 'sendPhoto' | 'sendVideo' | 'sendAudio' | 'sendDocument';
  fieldName: 'photo' | 'video' | 'audio' | 'document';
  targetUrl: string;
  captionToSend: string;
  hasShortCaption: boolean;
  replyMarkup: any;
  inlineButtons: any;
  protectContent: boolean;
  audioTitle?: string;
  audioPerformer?: string;
}): Promise<{ ok: boolean; resultData: any }> {
  const {
    apiBase,
    token,
    channel,
    endpoint,
    fieldName,
    targetUrl,
    captionToSend,
    hasShortCaption,
    replyMarkup,
    inlineButtons,
    protectContent,
    audioTitle,
    audioPerformer
  } = params;

  let resultData: any = null;
  const mediaFile = await fetchMediaBuffer(targetUrl);

  const buildSingleForm = (captionVal: string, parseHtml: boolean, markupVal: any) => {
    const form = new FormData();
    form.append('chat_id', channel);
    if (mediaFile) {
      form.append(fieldName, mediaFile.buffer, {
        filename: mediaFile.filename,
        contentType: mediaFile.contentType
      });
    }
    if (captionVal) {
      form.append('caption', captionVal);
      if (parseHtml) form.append('parse_mode', 'HTML');
    }
    if (fieldName === 'audio') {
      if (audioTitle?.trim()) form.append('title', audioTitle.trim());
      if (audioPerformer?.trim()) form.append('performer', audioPerformer.trim());
    }
    if (protectContent) {
      form.append('protect_content', 'true');
    }
    if (markupVal && (hasShortCaption || fieldName === 'audio' || fieldName === 'document')) {
      form.append('reply_markup', JSON.stringify(markupVal));
    }
    return form;
  };

  if (mediaFile) {
    const buildBody = (capVal: string, parseHtml: boolean, markupVal: any) => () => {
      const form = buildSingleForm(capVal, parseHtml, markupVal);
      return {
        method: 'POST',
        headers: form.getHeaders(),
        body: new Uint8Array(form.getBuffer())
      };
    };

    resultData = await fetchTelegramV2Api({
      apiBase,
      token,
      endpoint,
      buildInit: buildBody(captionToSend, Boolean(captionToSend), replyMarkup),
      timeoutMs: 35000
    });

    if (
      !resultData?.ok &&
      resultData?.description?.includes('MEDIA_CAPTION_TOO_LONG') &&
      captionToSend
    ) {
      const compactPlainCaption = stripHTML(captionToSend).slice(0, 1020).trim();
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint,
        buildInit: buildBody(compactPlainCaption, false, replyMarkup),
        timeoutMs: 35000
      });
    }

    if (
      !resultData?.ok &&
      (resultData?.description?.includes('BUTTON_TYPE_INVALID') ||
        resultData?.description?.includes('BUTTON_URL_INVALID'))
    ) {
      const fallbackMarkup = buildReplyMarkup(inlineButtons, true, true);
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint,
        buildInit: buildBody(captionToSend, Boolean(captionToSend), fallbackMarkup),
        timeoutMs: 35000
      });
    }

    if (
      !resultData?.ok &&
      resultData?.description &&
      (resultData.description.includes('entities') ||
        resultData.description.includes('tag') ||
        resultData.description.includes('HTML'))
    ) {
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint,
        buildInit: buildBody(stripHTML(captionToSend), false, replyMarkup),
        timeoutMs: 35000
      });
    }

    if (resultData?.ok) {
      return { ok: true, resultData };
    }
  }

  const publicUrl = await resolvePublicUrl(targetUrl);
  if (publicUrl && (publicUrl.startsWith('http://') || publicUrl.startsWith('https://'))) {
    try {
      const payload: Record<string, any> = {
        chat_id: channel,
        [fieldName]: publicUrl,
        caption: captionToSend || undefined,
        parse_mode: captionToSend ? 'HTML' : undefined,
        protect_content: protectContent || undefined,
        reply_markup:
          hasShortCaption || fieldName === 'audio' || fieldName === 'document'
            ? replyMarkup
            : undefined
      };
      if (fieldName === 'audio') {
        if (audioTitle?.trim()) payload.title = audioTitle.trim();
        if (audioPerformer?.trim()) payload.performer = audioPerformer.trim();
      }
      const payloadStr = JSON.stringify(payload);
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint,
        buildInit: () => ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        }),
        timeoutMs: 30000
      });
      if (resultData?.ok) {
        return { ok: true, resultData };
      }
    } catch {}
  }

  return { ok: false, resultData };
}

async function sendMediaGroupAttachment(params: {
  apiBase: string;
  token: string;
  channel: string;
  urlsToProcess: string[];
  groupKind: 'album' | 'audio' | 'document';
  captionToSend: string;
  hasShortCaption: boolean;
  protectContent: boolean;
  audioTitle?: string;
  audioPerformer?: string;
}): Promise<{ ok: boolean; resultData: any; singleFallbackItem?: FetchedBufferItem }> {
  const {
    apiBase,
    token,
    channel,
    urlsToProcess,
    groupKind,
    captionToSend,
    hasShortCaption,
    protectContent,
    audioTitle,
    audioPerformer
  } = params;

  const mediaBuffers = await Promise.all(
    urlsToProcess.slice(0, 10).map((u) => fetchMediaBuffer(u))
  );
  const validBuffers = mediaBuffers.filter((b): b is FetchedBufferItem => b !== null);

  if (validBuffers.length === 1) {
    return { ok: false, resultData: null, singleFallbackItem: validBuffers[0] };
  }

  let resultData: any = null;
  if (validBuffers.length >= 2) {
    const buildGroupForm = (plainOnly: boolean) => {
      const form = new FormData();
      form.append('chat_id', channel);
      if (protectContent) form.append('protect_content', 'true');

      const mediaArray = validBuffers.map((item, idx) => {
        const fieldName = `${groupKind}_${idx}`;
        const isVideo =
          groupKind === 'album' &&
          (item.mediaType === 'video' ||
            Boolean(item.filename.match(/\.(mp4|mov|avi|webm|m4v|mkv)$/i)) ||
            item.contentType.includes('video'));
        const itemType =
          groupKind === 'audio'
            ? 'audio'
            : groupKind === 'document'
            ? 'document'
            : isVideo
            ? 'video'
            : 'photo';

        const safeName =
          item.filename ||
          (itemType === 'audio'
            ? `track_${idx + 1}.mp3`
            : itemType === 'document'
            ? `document_${idx + 1}.bin`
            : `media_${idx}.${isVideo ? 'mp4' : 'jpg'}`);

        const mimeType =
          itemType === 'audio'
            ? item.contentType?.includes('audio')
              ? item.contentType
              : 'audio/mpeg'
            : itemType === 'document'
            ? item.contentType || 'application/octet-stream'
            : isVideo
            ? item.contentType.includes('video')
              ? item.contentType
              : 'video/mp4'
            : item.contentType.startsWith('image/')
            ? item.contentType
            : 'image/jpeg';

        form.append(fieldName, item.buffer, { filename: safeName, contentType: mimeType });
        const entry: Record<string, any> = {
          type: itemType,
          media: `attach://${fieldName}`,
          caption:
            idx === 0 && hasShortCaption && captionToSend
              ? plainOnly
                ? stripHTML(captionToSend)
                : captionToSend
              : undefined,
          parse_mode: idx === 0 && hasShortCaption && captionToSend && !plainOnly ? 'HTML' : undefined
        };
        if (itemType === 'audio') {
          if (audioTitle?.trim()) {
            entry.title = validBuffers.length > 1 ? `${audioTitle.trim()} (${idx + 1})` : audioTitle.trim();
          }
          if (audioPerformer?.trim()) entry.performer = audioPerformer.trim();
        }
        return entry;
      });

      form.append('media', JSON.stringify(mediaArray));
      return form;
    };

    resultData = await fetchTelegramV2Api({
      apiBase,
      token,
      endpoint: 'sendMediaGroup',
      buildInit: () => {
        const form = buildGroupForm(false);
        return {
          method: 'POST',
          headers: form.getHeaders(),
          body: new Uint8Array(form.getBuffer())
        };
      },
      timeoutMs: 40000
    });

    if (
      !resultData?.ok &&
      resultData?.description &&
      (resultData.description.includes('entities') ||
        resultData.description.includes('tag') ||
        resultData.description.includes('HTML'))
    ) {
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint: 'sendMediaGroup',
        buildInit: () => {
          const retryForm = buildGroupForm(true);
          return {
            method: 'POST',
            headers: retryForm.getHeaders(),
            body: new Uint8Array(retryForm.getBuffer())
          };
        },
        timeoutMs: 40000
      });
    }

    if (resultData?.ok) {
      return { ok: true, resultData };
    }
  }

  const resolvedUrls = (await Promise.all(urlsToProcess.map((u) => resolvePublicUrl(u)))).filter(
    (u) => u && (u.startsWith('http://') || u.startsWith('https://'))
  );
  if (resolvedUrls.length >= 2) {
    try {
      const mediaArray = resolvedUrls.slice(0, 10).map((url, idx) => {
        const itemType =
          groupKind === 'audio'
            ? 'audio'
            : groupKind === 'document'
            ? 'document'
            : isVideoMediaUrl(url)
            ? 'video'
            : 'photo';
        return {
          type: itemType,
          media: url,
          caption: idx === 0 && hasShortCaption ? captionToSend : undefined,
          parse_mode: idx === 0 && hasShortCaption && captionToSend ? 'HTML' : undefined,
          ...(itemType === 'audio' && audioTitle?.trim() ? { title: audioTitle.trim() } : {}),
          ...(itemType === 'audio' && audioPerformer?.trim()
            ? { performer: audioPerformer.trim() }
            : {})
        };
      });
      const grpBodyStr = JSON.stringify({
        chat_id: channel,
        media: mediaArray,
        protect_content: protectContent || undefined
      });
      resultData = await fetchTelegramV2Api({
        apiBase,
        token,
        endpoint: 'sendMediaGroup',
        buildInit: () => ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: grpBodyStr
        }),
        timeoutMs: 35000
      });
      if (resultData?.ok) return { ok: true, resultData };
    } catch {}
  }

  return { ok: false, resultData };
}

/**
 * Dedicated Telegram v2 Sender (standard Bot API workflow with 7 attachment types)
 * Post/card title is never prepended to the published Telegram body.
 */
export async function sendV2TelegramMessage(
  _title: string,
  content: string,
  dayRequest: DayRequest,
  options?: TelegramV2SendOptions
): Promise<TelegramV2SendResponse> {
  await getPgDB().catch(() => null);
  const botConfig = await getTelegramBotConfig();
  const settings = DB.getSettings();
  const token = botConfig.botToken || getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
  const apiBase = cleanTelegramBaseUrl(botConfig.apiBaseUrl || 'https://eu1.account.dialog.ai.atiks.org');

  const defaultFallbackChannel = getDefaultChannelIdentifier();
  const targetChannels = options?.channels?.length
    ? options.channels
    : dayRequest.channels?.length
    ? dayRequest.channels
    : [dayRequest.channel || settings.channelId || defaultFallbackChannel];

  const linkPreviewEnabled = options?.linkPreviewEnabled !== undefined ? options.linkPreviewEnabled : dayRequest.linkPreviewEnabled !== false;
  const attachmentType = options?.attachmentType || dayRequest.attachmentType || 'none';
  const protectContent = Boolean(options?.protectContent ?? (dayRequest as any)?.protectContent);
  const audioTitle = options?.audioTitle ?? (dayRequest as any)?.audioTitle ?? '';
  const audioPerformer = options?.audioPerformer ?? (dayRequest as any)?.audioPerformer ?? '';

  const isVoiceMode =
    attachmentType === 'voice' ||
    (attachmentType === 'audio' &&
      (options?.audioFormat === 'voice' || (dayRequest as any)?.audioFormat === 'voice' || (dayRequest as any)?.audio_format === 'voice'));

  const rawAttachmentUrlInput = (options?.attachmentUrl || dayRequest.attachmentUrl || '').trim();
  const rawAttachmentUrlsInput = (options?.attachmentUrls || dayRequest.attachmentUrls || [])
    .map((u) => (u || '').trim())
    .filter(Boolean);
  const rawAttachmentUrl = rawAttachmentUrlInput
    ? await resolvePublicMediaUrl(rawAttachmentUrlInput)
    : '';
  const rawAttachmentUrls = rawAttachmentUrlsInput.length
    ? await Promise.all(rawAttachmentUrlsInput.map((u) => resolvePublicMediaUrl(u)))
    : [];
  const inlineButtons = options?.inlineButtons || dayRequest.inlineButtons || [];

  let rawText = content !== undefined && content !== null ? content : '';
  const sig = String(options?.signature ?? dayRequest?.signature ?? '').trim();
  if (sig && !rawText.includes(sig)) {
    rawText = rawText.trim() ? `${rawText.trim()}\n\n${sig}` : sig;
  }

  const formatMode = options?.messageFormat || 'v2';
  const hasAnyAttachment =
    attachmentType !== 'none' &&
    attachmentType !== 'video_note' &&
    Boolean(rawAttachmentUrl || rawAttachmentUrls.length > 0);
  const rawFullHtmlText = convertToTelegramHTML(rawText, formatMode);
  const fullHtmlText =
    formatMode === 'v2'
      ? truncateTelegramHtmlSafe(rawFullHtmlText, hasAnyAttachment ? 1024 : 4096)
      : rawFullHtmlText;

  if (!token || token.trim() === '') {
    return { ok: false, error: 'Не указан токен Telegram бота в настройках.', simulated: true };
  }

  const successChannels: string[] = [];
  const duplicateChannels: string[] = [];
  const errors: string[] = [];
  let lastMessageId = '1';

  for (const rawCh of targetChannels) {
    const resolvedCh = resolveTargetChannelIdentifier(
      rawCh,
      options,
      settings.channelId,
      defaultFallbackChannel
    );
    if (resolvedCh.error || !resolvedCh.channel) {
      errors.push(resolvedCh.error || 'Не удалось определить канал');
      continue;
    }
    const channel = resolvedCh.channel;

    const claimedDedupKeys: string[] = [];
    if (!options?.__internalDedupClaimed) {
      const canonChan = canonicalizeTelegramTarget(channel, options?.telegramId);
      if (options?.dedupKey) {
        const slotKey = targetChannels.length > 1 ? `${options.dedupKey}:${canonChan}` : options.dedupKey;
        const slotClaim = await acquireEntityPublishSlot({
          slotKey,
          entityType: options?.isTest ? 'direct' : 'post',
          entityId: String(dayRequest?.id || 'v2'),
          channelKey: canonChan
        });
        if (!slotClaim.claimed) {
          console.warn(`[AntiSpam Protection] V2 entity slot blocked for ${canonChan} (${slotClaim.reason})`);
          duplicateChannels.push(channel);
          continue;
        }
        claimedDedupKeys.push(slotClaim.dedupKey);
      }

      const contentClaim = await acquireContentChannelGuard({
        channel,
        telegramId: options?.telegramId,
        title: _title,
        content: rawText,
        attachmentUrl: rawAttachmentUrl,
        attachmentUrls: rawAttachmentUrls,
        inlineButtons,
        entityType: options?.isTest ? 'direct' : 'post',
        entityId: String(dayRequest?.id || ''),
        isTest: options?.isTest
      });
      if (!contentClaim.claimed) {
        if (claimedDedupKeys.length > 0) {
          await finalizePublishDedup(claimedDedupKeys, 'definite_failure');
        }
        console.warn(`[AntiSpam Protection] V2 content duplicate blocked for ${canonChan} (${contentClaim.reason})`);
        duplicateChannels.push(channel);
        continue;
      }
      claimedDedupKeys.push(contentClaim.dedupKey);
    }

    let replyMarkup = buildReplyMarkup(inlineButtons, false);
    const allAttachmentUrls = (
      rawAttachmentUrls.length > 0 ? rawAttachmentUrls : [rawAttachmentUrl]
    ).filter((u) => Boolean(u && typeof u === 'string' && u.trim()));

    const isMultiAttachment =
      attachmentType === 'album' ||
      ((attachmentType === 'audio' || attachmentType === 'document') &&
        allAttachmentUrls.length > 1);

    if (formatMode === 'v2' && isMultiAttachment) {
      replyMarkup = undefined;
    }

    let sendSuccess = false;
    let channelErrMsg = '';
    let sentMsgId: string | undefined;

    try {
      let resultData: any = null;
      const visibleTextLen = stripHTML(fullHtmlText).length;
      const hasShortCaption = visibleTextLen <= 1024;
      const captionToSend = hasShortCaption ? fullHtmlText : '';

      // 1. ALBUM
      if (attachmentType === 'album' && allAttachmentUrls.length > 0) {
        const grp = await sendMediaGroupAttachment({
          apiBase,
          token,
          channel,
          urlsToProcess: allAttachmentUrls,
          groupKind: 'album',
          captionToSend,
          hasShortCaption,
          protectContent
        });
        resultData = grp.resultData;
        if (grp.ok) {
          sendSuccess = true;
          await sendFollowUpMessageIfNeeded({
            apiBase,
            token,
            channel,
            fullHtmlText,
            hasShortCaption,
            replyMarkup,
            protectContent
          });
        } else if (grp.singleFallbackItem) {
          const isVid = grp.singleFallbackItem.mediaType === 'video';
          const singleRes = await sendSingleMediaAttachment({
            apiBase,
            token,
            channel,
            endpoint: isVid ? 'sendVideo' : 'sendPhoto',
            fieldName: isVid ? 'video' : 'photo',
            targetUrl: allAttachmentUrls[0],
            captionToSend,
            hasShortCaption,
            replyMarkup,
            inlineButtons,
            protectContent
          });
          sendSuccess = singleRes.ok;
          resultData = singleRes.resultData;
          if (sendSuccess) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          }
        }
      }

      // 2. SINGLE PHOTO OR VIDEO
      else if (
        (attachmentType === 'photo' || attachmentType === 'video') &&
        allAttachmentUrls.length > 0
      ) {
        const isVideo = attachmentType === 'video';
        const singleRes = await sendSingleMediaAttachment({
          apiBase,
          token,
          channel,
          endpoint: isVideo ? 'sendVideo' : 'sendPhoto',
          fieldName: isVideo ? 'video' : 'photo',
          targetUrl: allAttachmentUrls[0],
          captionToSend,
          hasShortCaption,
          replyMarkup,
          inlineButtons,
          protectContent
        });
        sendSuccess = singleRes.ok;
        resultData = singleRes.resultData;
        if (sendSuccess && !hasShortCaption) {
          await sendFollowUpMessageIfNeeded({
            apiBase,
            token,
            channel,
            fullHtmlText,
            hasShortCaption,
            replyMarkup,
            protectContent
          });
        }
      }

      // 3. VIDEO NOTE (Кружок — кнопки прикрепляются только один раз)
      else if (attachmentType === 'video_note' && allAttachmentUrls.length > 0) {
        const mediaFile = await fetchMediaBuffer(allAttachmentUrls[0]);
        if (mediaFile) {
          const processedVideoNote = await convertVideoToTelegramVideoNote(mediaFile.buffer);
          const form = new FormData();
          form.append('chat_id', channel);
          form.append('video_note', processedVideoNote, {
            filename: 'video_note.mp4',
            contentType: 'video/mp4'
          });
          if (protectContent) form.append('protect_content', 'true');
          // Attach buttons directly to the video_note ONLY when there is no follow-up text
          if (!fullHtmlText.trim() && replyMarkup) {
            form.append('reply_markup', JSON.stringify(replyMarkup));
          }

          resultData = await fetchTelegramV2Api({
            apiBase,
            token,
            endpoint: 'sendVideoNote',
            buildInit: () => ({
              method: 'POST',
              headers: form.getHeaders(),
              body: new Uint8Array(form.getBuffer())
            }),
            timeoutMs: 40000
          });

          if (resultData?.ok) {
            sendSuccess = true;
            if (fullHtmlText.trim()) {
              try {
                const vnMsgBody = JSON.stringify({
                  chat_id: channel,
                  text: fullHtmlText,
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
                    body: vnMsgBody
                  })
                });
              } catch {}
            }
          }
        }
      }

      // 4. AUDIO OR VOICE
      else if (
        (attachmentType === 'audio' || attachmentType === 'voice') &&
        allAttachmentUrls.length > 0
      ) {
        if (isVoiceMode) {
          for (let i = 0; i < allAttachmentUrls.length; i++) {
            const mediaFile = await fetchMediaBuffer(allAttachmentUrls[i]);
            const isFirst = i === 0;
            const isLast = i === allAttachmentUrls.length - 1;
            if (mediaFile) {
              const voiceBuffer = await convertAudioToTelegramVoice(mediaFile.buffer);
              const form = new FormData();
              form.append('chat_id', channel);
              form.append('voice', voiceBuffer, {
                filename: `voice_${i}.ogg`,
                contentType: 'audio/ogg'
              });
              if (protectContent) form.append('protect_content', 'true');
              if (isFirst && hasShortCaption && captionToSend) {
                form.append('caption', captionToSend);
                form.append('parse_mode', 'HTML');
              }
              if (isLast && replyMarkup) {
                form.append('reply_markup', JSON.stringify(replyMarkup));
              }
              resultData = await fetchTelegramV2Api({
                apiBase,
                token,
                endpoint: 'sendVoice',
                buildInit: () => ({
                  method: 'POST',
                  headers: form.getHeaders(),
                  body: new Uint8Array(form.getBuffer())
                }),
                timeoutMs: 40000
              });
              if (resultData?.ok) sendSuccess = true;
            }
          }
          if (sendSuccess && !hasShortCaption) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          }
        } else if (allAttachmentUrls.length === 1) {
          const singleRes = await sendSingleMediaAttachment({
            apiBase,
            token,
            channel,
            endpoint: 'sendAudio',
            fieldName: 'audio',
            targetUrl: allAttachmentUrls[0],
            captionToSend,
            hasShortCaption,
            replyMarkup,
            inlineButtons,
            protectContent,
            audioTitle,
            audioPerformer
          });
          sendSuccess = singleRes.ok;
          resultData = singleRes.resultData;
          if (sendSuccess && !hasShortCaption) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          }
        } else {
          const grp = await sendMediaGroupAttachment({
            apiBase,
            token,
            channel,
            urlsToProcess: allAttachmentUrls,
            groupKind: 'audio',
            captionToSend,
            hasShortCaption,
            protectContent,
            audioTitle,
            audioPerformer
          });
          sendSuccess = grp.ok;
          resultData = grp.resultData;
          if (sendSuccess) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          } else if (grp.singleFallbackItem) {
            const singleRes = await sendSingleMediaAttachment({
              apiBase,
              token,
              channel,
              endpoint: 'sendAudio',
              fieldName: 'audio',
              targetUrl: allAttachmentUrls[0],
              captionToSend,
              hasShortCaption,
              replyMarkup,
              inlineButtons,
              protectContent,
              audioTitle,
              audioPerformer
            });
            sendSuccess = singleRes.ok;
            resultData = singleRes.resultData;
          }
        }
      }

      // 5. DOCUMENTS
      else if (attachmentType === 'document' && allAttachmentUrls.length > 0) {
        if (allAttachmentUrls.length === 1) {
          const singleRes = await sendSingleMediaAttachment({
            apiBase,
            token,
            channel,
            endpoint: 'sendDocument',
            fieldName: 'document',
            targetUrl: allAttachmentUrls[0],
            captionToSend,
            hasShortCaption,
            replyMarkup,
            inlineButtons,
            protectContent
          });
          sendSuccess = singleRes.ok;
          resultData = singleRes.resultData;
          if (sendSuccess && !hasShortCaption) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          }
        } else {
          const grp = await sendMediaGroupAttachment({
            apiBase,
            token,
            channel,
            urlsToProcess: allAttachmentUrls,
            groupKind: 'document',
            captionToSend,
            hasShortCaption,
            protectContent
          });
          sendSuccess = grp.ok;
          resultData = grp.resultData;
          if (sendSuccess) {
            await sendFollowUpMessageIfNeeded({
              apiBase,
              token,
              channel,
              fullHtmlText,
              hasShortCaption,
              replyMarkup,
              protectContent
            });
          } else if (grp.singleFallbackItem) {
            const singleRes = await sendSingleMediaAttachment({
              apiBase,
              token,
              channel,
              endpoint: 'sendDocument',
              fieldName: 'document',
              targetUrl: allAttachmentUrls[0],
              captionToSend,
              hasShortCaption,
              replyMarkup,
              inlineButtons,
              protectContent
            });
            sendSuccess = singleRes.ok;
            resultData = singleRes.resultData;
          }
        }
      }

      // 6. STANDARD TEXT MESSAGE (strictly only when attachmentType === 'none' — never silently drop media)
      if (!sendSuccess) {
        if (attachmentType !== 'none') {
          const mediaErr =
            resultData?.description ||
            (allAttachmentUrls.length === 0
              ? `Не указана ссылка на медиафайл (${attachmentType})`
              : `Не удалось скачать или отправить медиафайл (${attachmentType})`);
          errors.push(`Ошибка медиа для ${channel}: ${mediaErr}`);
          continue;
        }

        const effectiveText = (fullHtmlText || '').trim();
        const fallbackText = stripHTML(rawText || '').trim();
        const textToSend = effectiveText || fallbackText;

        if (!textToSend) {
          errors.push(`Текст публикации для ${channel} пуст. Отправка отменена.`);
          continue;
        }

        const baseSendPayload = JSON.stringify({
          chat_id: channel,
          text: textToSend,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
          protect_content: protectContent || undefined,
          disable_web_page_preview: !linkPreviewEnabled,
          link_preview_options: { is_disabled: !linkPreviewEnabled }
        });
        resultData = await fetchTelegramV2Api({
          apiBase,
          token,
          endpoint: 'sendMessage',
          buildInit: () => ({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: baseSendPayload
          })
        });

        if (
          !resultData?.ok &&
          (resultData?.description?.includes('BUTTON_TYPE_INVALID') ||
            resultData?.description?.includes('BUTTON_URL_INVALID'))
        ) {
          const urlFallbackMarkup = buildReplyMarkup(inlineButtons, true, true);
          const urlFallbackPayload = JSON.stringify({
            chat_id: channel,
            text: textToSend,
            parse_mode: 'HTML',
            reply_markup: urlFallbackMarkup,
            protect_content: protectContent || undefined,
            disable_web_page_preview: !linkPreviewEnabled,
            link_preview_options: { is_disabled: !linkPreviewEnabled }
          });
          resultData = await fetchTelegramV2Api({
            apiBase,
            token,
            endpoint: 'sendMessage',
            buildInit: () => ({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: urlFallbackPayload
            })
          });
        }

        if (
          !resultData?.ok &&
          (resultData?.description?.includes("can't parse entities") ||
            resultData?.description?.includes('tag'))
        ) {
          const plainPayload = JSON.stringify({
            chat_id: channel,
            text: fallbackText || textToSend,
            reply_markup: replyMarkup,
            protect_content: protectContent || undefined,
            disable_web_page_preview: !linkPreviewEnabled,
            link_preview_options: { is_disabled: !linkPreviewEnabled }
          });
          resultData = await fetchTelegramV2Api({
            apiBase,
            token,
            endpoint: 'sendMessage',
            buildInit: () => ({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: plainPayload
            })
          });
        }

        if (resultData?.ok) sendSuccess = true;
      }

      if (sendSuccess && resultData?.ok) {
        sentMsgId = Array.isArray(resultData.result)
          ? resultData.result[0]?.message_id?.toString()
          : resultData.result?.message_id?.toString() || '1';
        lastMessageId = sentMsgId || lastMessageId;
        successChannels.push(channel);
      } else {
        const errorDesc = resultData?.description?.includes('bot is not a member')
          ? `Бот не является администратором канала ${channel}. Добавьте бота @${
              botConfig.botUsername?.replace(/^@/, '') || 'IIrkiBot'
            } в канал с правами публикации.`
          : resultData?.description || 'Ошибка отправки в Telegram';
        channelErrMsg = errorDesc;
        errors.push(`Ошибка для ${channel}: ${errorDesc}`);
      }
    } catch (err: any) {
      channelErrMsg = String(err?.message || err || '');
      errors.push(`Ошибка сети для ${channel}: ${channelErrMsg}`);
    } finally {
      if (claimedDedupKeys.length > 0) {
        const outcome = sendSuccess
          ? 'sent'
          : isDefiniteClientFailure(channelErrMsg)
          ? 'definite_failure'
          : 'ambiguous_timeout';
        await finalizePublishDedup(claimedDedupKeys, outcome, sentMsgId);
      }
    }
  }

  if (successChannels.length > 0) {
    return {
      ok: true,
      messageId: lastMessageId,
      channel: successChannels.join(', '),
      simulated: false,
      fallbackNotice:
        errors.length > 0 ? `Частичная отправка. Ошибки: ${errors.join('; ')}` : undefined
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
    error: errors.join('; ') || 'Не удалось отправить сообщение ни в один канал',
    simulated: false
  };
}
