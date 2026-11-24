import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';
import { isVideoMediaUrl } from '../../utils/urlUtils';
import type { InlineButton } from '../../types';

export const MAX_RICH_MEDIA_ATTACHMENTS = 50;

export type TelegramAttachmentKind =
  | 'none'
  | 'photo'
  | 'document'
  | 'video'
  | 'audio'
  | 'album'
  | 'video_note'
  | 'voice';

export interface InputRichMessageMediaItem {
  id: string;
  media: {
    type: 'photo' | 'video' | 'audio' | 'voice_note' | 'document' | 'animation';
    media: string;
    caption?: string;
    title?: string;
    performer?: string;
  };
}

export function resolveRichPublicBaseUrl(): string {
  const envUrl = String(
    process.env.APP_URL || process.env.PUBLIC_APP_URL || process.env.BASE_URL || ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  return 'http://127.0.0.1:3000';
}

/**
 * Normalizes any ProTalk or legacy URL for Dialog AI / Telegram /sendRichMessage.
 * Preserves canonical `https://file.pro-talk.ru/tgf/...` and rewrites broken `filestore.pro-talk.ru`.
 */
export function toCanonicalRichMediaUrl(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  let normalized = normalizeProTalkMediaUrl(trimmed);
  if (normalized.startsWith('/')) {
    normalized = `${resolveRichPublicBaseUrl()}${normalized}`;
  } else if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(normalized)) {
    const base = resolveRichPublicBaseUrl();
    normalized = normalized.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, base);
  }
  return normalized;
}

/**
 * Telegram Bot API Rich Message supports photo, video, audio, voice_note, document, and animation natively.
 * Only circular video notes (`video_note`) still require a native V2 companion `sendVideoNote` message.
 */
export function isRichCompanionNativeAttachment(attachmentType?: string): boolean {
  return attachmentType === 'video_note';
}

/**
 * Detects whether a Rich payload uses Telegram Bot API 10.3 / 10.4 formatting constructs
 * (<tg-button>, <tg-button-row>, <tg-document>, <blockquote expandable>, compact tables, or explicit media[]).
 */
export function containsBotApi103Features(markdown: string, mediaArray?: InputRichMessageMediaItem[]): boolean {
  if (Array.isArray(mediaArray) && mediaArray.length > 0) return true;
  if (!markdown) return false;
  return /<tg-button(?:-row)?\b|<tg-document\b|<blockquote\s+expandable\b|<table\b[^>]*\bcompact\b/i.test(
    markdown
  );
}

/**
 * Escapes double quotes cleanly for Markdown media titles / HTML attributes.
 */
function escapeAttr(val: string): string {
  return String(val || '').replace(/"/g, '&quot;').trim();
}

/**
 * Converts <tg-document ...>, <video src="...">, and <audio src="..."> tags inside Rich Markdown
 * into Telegram Bot API `InputRichMessageMedia` items + `tg://<type>?id=...` references
 * (or standard `![](url)` Markdown links) so /sendRichMessage handles them natively without RICH_MESSAGE_*_NO_MEDIA_FOUND.
 */
export function compileRichInlineMediaAndBlocks(rawMarkdown: string): {
  markdown: string;
  media: InputRichMessageMediaItem[];
} {
  let md = rawMarkdown || '';
  const media: InputRichMessageMediaItem[] = [];
  let seq = 1;

  const pushMedia = (
    type: InputRichMessageMediaItem['media']['type'],
    rawUrl: string,
    caption?: string,
    extra?: { title?: string; performer?: string }
  ): string => {
    const cleanUrl = toCanonicalRichMediaUrl(rawUrl);
    if (!cleanUrl) return '';
    const existing = media.find((m) => m.media.media === cleanUrl && m.media.type === type);
    if (existing) {
      return existing.id;
    }
    const id = `m${seq++}_${type}`;
    const item: InputRichMessageMediaItem = {
      id,
      media: {
        type,
        media: cleanUrl
      }
    };
    if (caption && caption.trim()) {
      item.media.caption = caption.trim();
    }
    if (extra?.title?.trim()) {
      item.media.title = extra.title.trim();
    }
    if (extra?.performer?.trim()) {
      item.media.performer = extra.performer.trim();
    }
    media.push(item);
    return id;
  };

  const formatStandaloneMediaMd = (scheme: 'document' | 'video' | 'audio' | 'photo', id: string, caption?: string) => {
    const cleanCap = String(caption || '').replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
    return cleanCap
      ? `\n\n![](tg://${scheme}?id=${id} "${cleanCap}")\n\n`
      : `\n\n![](tg://${scheme}?id=${id})\n\n`;
  };

  // 0. Normalize <video src="..."> inside <tg-collage> / <tg-slideshow> before general standalone block pass
  md = md.replace(/<(tg-(?:collage|slideshow))([^>]*)>([\s\S]*?)<\/\1>/gi, (_, tag, attrs, inner) => {
    let nextInner = String(inner || '');
    nextInner = nextInner.replace(/<video\b([^>]*?)>([\s\S]*?)<\/video>/gi, (__, vAttrs, vInner) => {
      const srcM = String(vAttrs || '').match(/\bsrc=["']([^"']+)["']/i);
      if (!srcM?.[1]) return '';
      const capM = String(vAttrs || '').match(/\b(?:title|caption|alt)=["']([^"']*)["']/i);
      const cap = (capM?.[1] || vInner || '').replace(/<[^>]+>/g, '').trim();
      const id = pushMedia('video', srcM[1], cap);
      if (!id) return '';
      const cleanCap = cap.replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
      return cleanCap ? `![${cleanCap}](tg://video?id=${id} "${cleanCap}")` : `![](tg://video?id=${id})`;
    });
    const cleanLines = nextInner.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return `<${tag}${attrs}>\n${cleanLines.join('\n')}\n</${tag}>`;
  });

  // 1. <figure><tg-document src="..."></tg-document><figcaption>...</figcaption></figure>
  md = md.replace(
    /<figure>\s*<tg-document\b[^>]*\bsrc=["']([^"']+)["'][^>]*>(?:<\/tg-document>)?\s*(?:<figcaption>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi,
    (_, src, caption) => {
      const cap = String(caption || '').replace(/<[^>]+>/g, '').trim();
      const id = pushMedia('document', src, cap);
      if (!id) return '';
      return formatStandaloneMediaMd('document', id, cap);
    }
  );

  // 2. Standalone <tg-document src="..." caption="..."></tg-document> or self-closing <tg-document ... />
  md = md.replace(
    /<tg-document\b([^>]*?)(?:\/>|><\/tg-document>|>([\s\S]*?)<\/tg-document>)/gi,
    (_, attrs, inner) => {
      const srcMatch = String(attrs || '').match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch?.[1]) return '';
      const capMatch = String(attrs || '').match(/\bcaption=["']([^"']*)["']/i);
      const cap = (capMatch?.[1] || inner || '').replace(/<[^>]+>/g, '').trim();
      const id = pushMedia('document', srcMatch[1], cap);
      if (!id) return '';
      return formatStandaloneMediaMd('document', id, cap);
    }
  );

  // 3. Legacy <video src="...">...</video> -> standalone block ![](tg://video?id=...)
  md = md.replace(
    /<video\b([^>]*?)>([\s\S]*?)<\/video>/gi,
    (_, attrs, inner) => {
      const srcMatch = String(attrs || '').match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch?.[1]) return '';
      const capMatch = String(attrs || '').match(/\b(?:title|caption|alt)=["']([^"']*)["']/i);
      const cap = (capMatch?.[1] || inner || '').replace(/<[^>]+>/g, '').trim();
      const id = pushMedia('video', srcMatch[1], cap);
      if (!id) return '';
      return formatStandaloneMediaMd('video', id, cap);
    }
  );

  // 4. <audio src="...">...</audio> -> standalone block ![](tg://audio?id=...)
  // Note: Telegram Bot API uses tg://audio?id=... for BOTH audio and voice_note InputRichMessageMedia types!
  md = md.replace(
    /<audio\b([^>]*?)>([\s\S]*?)<\/audio>/gi,
    (_, attrs, inner) => {
      const srcMatch = String(attrs || '').match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch?.[1]) return '';
      const capMatch = String(attrs || '').match(/\b(?:title|caption)=["']([^"']*)["']/i);
      const perfMatch = String(attrs || '').match(/\bperformer=["']([^"']*)["']/i);
      const isVoice = /\bdata-voice=["']?true/i.test(attrs) || /\.ogg(\?|$)/i.test(srcMatch[1]);
      const cap = (capMatch?.[1] || inner || '').replace(/<[^>]+>/g, '').trim();
      const id = pushMedia(isVoice ? 'voice_note' : 'audio', srcMatch[1], cap, {
        title: capMatch?.[1],
        performer: perfMatch?.[1]
      });
      if (!id) return '';
      return formatStandaloneMediaMd('audio', id, cap);
    }
  );

  // 5. Compile Markdown ![](videoUrl) (both inside <tg-collage>/<tg-slideshow> and standalone) to InputRichMessageMedia video
  md = md.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)"]+)(?:\s+"([^"]*)")?\)/gi, (full, alt, url, titleCap) => {
    if (!isVideoMediaUrl(url)) return full;
    const cap = String(titleCap || alt || '').trim();
    const id = pushMedia('video', url, cap);
    if (!id) return full;
    const cleanCap = cap.replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
    return cleanCap ? `![${alt}](tg://video?id=${id} "${cleanCap}")` : `![${alt}](tg://video?id=${id})`;
  });

  // Safely ensure any line outside collage/slideshow starting with standalone ![](...) media block has blank lines before/after
  const mdLines = md.split('\n');
  const spacedLines: string[] = [];
  let inGroup = false;
  for (let i = 0; i < mdLines.length; i++) {
    const line = mdLines[i];
    const trimmed = line.trim();
    if (/^<tg-(?:collage|slideshow)\b/i.test(trimmed)) inGroup = true;
    const isMediaLine =
      !inGroup &&
      /^!\[[^\]]*\]\((?:tg:\/\/(?:photo|video|document|audio)\?id=|https?:\/\/).+\)$/.test(trimmed);
    if (isMediaLine && spacedLines.length > 0 && spacedLines[spacedLines.length - 1].trim() !== '') {
      spacedLines.push('');
    }
    spacedLines.push(line);
    if (isMediaLine && i + 1 < mdLines.length && mdLines[i + 1].trim() !== '') {
      spacedLines.push('');
    }
    if (/<\/tg-(?:collage|slideshow)>/i.test(trimmed)) inGroup = false;
  }
  md = spacedLines.join('\n');

  return { markdown: md, media };
}

export function countRichMediaAttachments(
  markdown: string,
  mediaItems?: InputRichMessageMediaItem[]
): number {
  const md = markdown || '';
  let count = 0;
  const referencedIds = new Set<string>();

  const mdImgRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdImgRe.exec(md)) !== null) {
    const rawTarget = (m[1] || '').trim();
    const lower = rawTarget.toLowerCase();
    if (!lower || lower.startsWith('tg://emoji') || lower.startsWith('tg://time')) continue;
    const idM = rawTarget.match(/^tg:\/\/(?:photo|video|document|audio|voice)\?id=([^&\s]+)/i);
    if (idM?.[1]) referencedIds.add(idM[1]);
    count++;
  }

  const tagRe = /<(?:tg-document|video|audio)\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi;
  while (tagRe.exec(md) !== null) {
    count++;
  }

  if (Array.isArray(mediaItems)) {
    for (const item of mediaItems) {
      if (item?.id && !referencedIds.has(item.id)) {
        count++;
      }
    }
  }
  return count;
}

export function enforceRichMediaLimit(
  markdown: string,
  mediaItems: InputRichMessageMediaItem[],
  maxAttachments: number = MAX_RICH_MEDIA_ATTACHMENTS
): {
  markdown: string;
  media: InputRichMessageMediaItem[];
  trimmedCount: number;
  totalBefore: number;
} {
  const totalBefore = countRichMediaAttachments(markdown, mediaItems);
  if (totalBefore <= maxAttachments) {
    return { markdown, media: mediaItems, trimmedCount: 0, totalBefore };
  }

  let used = 0;
  const keptIds = new Set<string>();

  let nextMd = (markdown || '').replace(
    /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (full, _alt, target) => {
      const lower = String(target || '').trim().toLowerCase();
      if (!lower || lower.startsWith('tg://emoji') || lower.startsWith('tg://time')) {
        return full;
      }
      if (used < maxAttachments) {
        used++;
        const idM = String(target).match(/^tg:\/\/(?:photo|video|document|audio|voice)\?id=([^&\s]+)/i);
        if (idM?.[1]) keptIds.add(idM[1]);
        return full;
      }
      return '';
    }
  );

  nextMd = nextMd.replace(
    /<(?:figure>\s*<tg-document\b[^>]*>[\s\S]*?<\/figure>|<tg-document\b[^>]*>(?:<\/tg-document>)?|<video\b[^>]*>[\s\S]*?<\/video>|<audio\b[^>]*>[\s\S]*?<\/audio>)/gi,
    (full) => {
      if (used < maxAttachments) {
        used++;
        return full;
      }
      return '';
    }
  );

  // Clean up empty collage/slideshow tags if all items inside were dropped
  nextMd = nextMd
    .replace(/<(tg-(?:collage|slideshow))\b[^>]*>\s*<\/\1>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const nextMedia = (mediaItems || []).filter((item) => {
    if (keptIds.has(item.id)) return true;
    const isReferencedInOriginal = new RegExp(`tg://[a-z_]+\\?id=${item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(markdown || '');
    if (isReferencedInOriginal) return false;
    if (used < maxAttachments) {
      used++;
      return true;
    }
    return false;
  });

  return {
    markdown: nextMd,
    media: nextMedia,
    trimmedCount: Math.max(0, totalBefore - maxAttachments),
    totalBefore
  };
}

/**
 * Infers Rich-compatible visual embedding for photo, album, video, audio, voice, or document attachments.
 * Uses Bot API 10.3 `InputRichMessageMedia` + standalone `![](tg://<type>?id=...)` blocks
 * for video/audio/voice/document, and `![](url)` / `<tg-slideshow>` for photo & album.
 */
export function buildRichAttachmentMarkdownBlock(params: {
  attachmentType?: TelegramAttachmentKind;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  existingMarkdown: string;
  audioTitle?: string;
  audioPerformer?: string;
}): { markdownBlock: string; mediaItems: InputRichMessageMediaItem[] } {
  const {
    attachmentType = 'none',
    attachmentUrl = '',
    attachmentUrls = [],
    existingMarkdown,
    audioTitle,
    audioPerformer
  } = params;
  const md = existingMarkdown || '';

  if (attachmentType === 'none' || isRichCompanionNativeAttachment(attachmentType)) {
    return { markdownBlock: '', mediaItems: [] };
  }

  const normalizedList = Array.from(
    new Set(
      [...(Array.isArray(attachmentUrls) ? attachmentUrls : []), attachmentUrl]
        .map((u) => toCanonicalRichMediaUrl(u))
        .filter(Boolean)
    )
  );

  if (normalizedList.length === 0) {
    return { markdownBlock: '', mediaItems: [] };
  }

  const first = normalizedList[0];

  if (attachmentType === 'video') {
    if (md.includes(first) || /tg:\/\/video\?id=/i.test(md)) {
      return { markdownBlock: '', mediaItems: [] };
    }
    const id = 'att_video';
    return {
      markdownBlock: `![](tg://video?id=${id})`,
      mediaItems: [{ id, media: { type: 'video', media: first } }]
    };
  }

  if (attachmentType === 'document') {
    if (md.includes(first) || /tg:\/\/document\?id=/i.test(md)) {
      return { markdownBlock: '', mediaItems: [] };
    }
    const id = 'att_doc';
    return {
      markdownBlock: `![](tg://document?id=${id})`,
      mediaItems: [{ id, media: { type: 'document', media: first } }]
    };
  }

  if (attachmentType === 'voice') {
    if (md.includes(first) || /tg:\/\/audio\?id=att_voice/i.test(md)) {
      return { markdownBlock: '', mediaItems: [] };
    }
    const id = 'att_voice';
    return {
      markdownBlock: `![](tg://audio?id=${id})`,
      mediaItems: [{ id, media: { type: 'voice_note', media: first } }]
    };
  }

  if (attachmentType === 'audio') {
    if (md.includes(first) || /tg:\/\/audio\?id=att_audio/i.test(md)) {
      return { markdownBlock: '', mediaItems: [] };
    }
    const id = 'att_audio';
    const captionParts = [audioPerformer?.trim(), audioTitle?.trim()].filter(Boolean);
    const audioMeta: InputRichMessageMediaItem['media'] = {
      type: 'audio',
      media: first
    };
    if (audioTitle?.trim()) audioMeta.title = audioTitle.trim();
    if (audioPerformer?.trim()) audioMeta.performer = audioPerformer.trim();
    if (captionParts.length > 0) audioMeta.caption = captionParts.join(' — ');
    const cleanTitle = captionParts.join(' — ').replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
    return {
      markdownBlock: cleanTitle
        ? `![](tg://audio?id=${id} "${cleanTitle}")`
        : `![](tg://audio?id=${id})`,
      mediaItems: [{ id, media: audioMeta }]
    };
  }

  const alreadyHasRichVisual =
    /<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>|!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/i.test(
      md
    );

  if (attachmentType === 'album' && normalizedList.length >= 2) {
    if (/<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>/i.test(md)) {
      return { markdownBlock: '', mediaItems: [] };
    }
    const missingUrls = normalizedList.filter((u) => !md.includes(u));
    if (missingUrls.length === 0) return { markdownBlock: '', mediaItems: [] };
    const mediaItems: InputRichMessageMediaItem[] = [];
    const lines = normalizedList.slice(0, 10).map((u, idx) => {
      if (isVideoMediaUrl(u)) {
        const vidId = `att_vid_${idx + 1}`;
        mediaItems.push({ id: vidId, media: { type: 'video', media: u } });
        return `![](tg://video?id=${vidId})`;
      }
      return `![](${u})`;
    });
    return {
      markdownBlock: `<tg-slideshow>\n${lines.join('\n')}\n</tg-slideshow>`,
      mediaItems
    };
  }

  // Single photo (or 1-item album)
  if (alreadyHasRichVisual || md.includes(first)) {
    return { markdownBlock: '', mediaItems: [] };
  }
  return { markdownBlock: `![](${first})`, mediaItems: [] };
}

/**
 * Extracts Bot API 10.3 `<tg-button-row>` and `<tg-button>` elements when degrading a Rich message
 * to V2 HTML so raw `<tg-button>` tags never leak and clickable buttons/links remain functional.
 */
export function extractRichButtonsForV2Fallback(markdown: string): {
  cleanedText: string;
  extractedRows: InlineButton[][];
} {
  if (!markdown) return { cleanedText: '', extractedRows: [] };

  const extractedRows: InlineButton[][] = [];
  let text = markdown;

  const parseSingleButton = (attrs: string, label: string): InlineButton | null => {
    const cleanLabel = String(label || '').replace(/<[^>]+>/g, '').trim();
    if (!cleanLabel) return null;
    const typeM = attrs.match(/\btype=["']([^"']+)["']/i);
    const styleM = attrs.match(/\bstyle=["']([^"']+)["']/i);
    const urlM = attrs.match(/\burl=["']([^"']+)["']/i);
    const dataM = attrs.match(/\b(?:callback-data|callback_data|data)=["']([^"']+)["']/i);
    const copyM = attrs.match(/\b(?:copy-text|copy_text|text)=["']([^"']+)["']/i);

    const btnType = (typeM?.[1] || (urlM ? 'url' : copyM ? 'copy_text' : 'callback_data')).toLowerCase();
    const rawStyle = (styleM?.[1] || '').toLowerCase();
    const style: InlineButton['style'] =
      rawStyle === 'primary' || rawStyle === 'success' || rawStyle === 'danger' ? rawStyle : undefined;

    if (btnType === 'url' && urlM?.[1]) {
      return {
        id: `rb_${Math.random().toString(36).slice(2, 7)}`,
        text: cleanLabel,
        type: 'url',
        url: urlM[1],
        style
      };
    }
    if (btnType === 'web_app' && urlM?.[1]) {
      return {
        id: `rb_${Math.random().toString(36).slice(2, 7)}`,
        text: cleanLabel,
        type: 'web_app',
        url: urlM[1],
        style
      };
    }
    if (btnType === 'copy_text' && copyM?.[1]) {
      return {
        id: `rb_${Math.random().toString(36).slice(2, 7)}`,
        text: cleanLabel,
        type: 'copy_text',
        value: copyM[1],
        style
      };
    }
    if (btnType === 'callback_data' && dataM?.[1]) {
      return {
        id: `rb_${Math.random().toString(36).slice(2, 7)}`,
        text: cleanLabel,
        type: 'callback',
        callbackData: dataM[1],
        style
      };
    }
    return null;
  };

  // Extract <tg-button-row>...</tg-button-row>
  text = text.replace(/<tg-button-row\b[^>]*>([\s\S]*?)<\/tg-button-row>/gi, (_, inner) => {
    const rowBtns: InlineButton[] = [];
    const btnRe = /<tg-button\b([^>]*)>([\s\S]*?)<\/tg-button>/gi;
    let m: RegExpExecArray | null;
    while ((m = btnRe.exec(inner)) !== null) {
      const parsed = parseSingleButton(m[1] || '', m[2] || '');
      if (parsed) rowBtns.push(parsed);
    }
    if (rowBtns.length > 0) {
      extractedRows.push(rowBtns);
    }
    return '';
  });

  // Replace inline <tg-button> not inside a row with readable Markdown link / bold text
  text = text.replace(/<tg-button\b([^>]*)>([\s\S]*?)<\/tg-button>/gi, (_, attrs, label) => {
    const cleanLabel = String(label || '').trim();
    const urlM = String(attrs || '').match(/\burl=["']([^"']+)["']/i);
    if (urlM?.[1]) {
      return `[${cleanLabel || urlM[1]}](${urlM[1]})`;
    }
    const copyM = String(attrs || '').match(/\b(?:copy-text|copy_text|text)=["']([^"']+)["']/i);
    if (copyM?.[1]) {
      return `\`${copyM[1]}\``;
    }
    return `**${cleanLabel}**`;
  });

  // Clean <tg-document> in V2 text fallback
  text = text.replace(/<tg-document\b([^>]*?)(?:\/>|><\/tg-document>|>([\s\S]*?)<\/tg-document>)/gi, (_, attrs, inner) => {
    const srcM = String(attrs || '').match(/\bsrc=["']([^"']+)["']/i);
    const capM = String(attrs || '').match(/\bcaption=["']([^"']*)["']/i);
    const label = (capM?.[1] || inner || 'Файл').trim();
    return srcM?.[1] ? `[📄 ${label}](${srcM[1]})` : '';
  });

  return {
    cleanedText: text.replace(/\n{3,}/g, '\n\n').trim(),
    extractedRows
  };
}

/**
 * Ensures `<tg-button type="copy_text" ...>` uses Telegram Bot API 10.3's required `text="..."` attribute
 * rather than `copy-text="..."` or `copy_text="..."`.
 */
export function normalizeBotApi103ButtonAttrs(markdown: string): string {
  if (!markdown) return '';
  return markdown.replace(/<tg-button\b([^>]*)>/gi, (_full, attrs) => {
    let updated = attrs.replace(/\b(?:callback-data|callback_data)=/gi, 'data=');
    if (/\btype=["']copy_text["']/i.test(updated)) {
      updated = updated.replace(/\b(?:copy-text|copy_text)=("[^"]*"|'[^']*')/i, 'text=$1');
    }
    return `<tg-button${updated}>`;
  });
}

function guessMimeAndExt(url: string, contentType: string | null, kind: string): { mime: string; ext: string } {
  const cleanCt = String(contentType || '').split(';')[0].trim().toLowerCase();
  const cleanPath = String(url || '').split('?')[0].toLowerCase();
  const extMatch = cleanPath.match(/\.([a-z0-9]{2,5})$/);
  const extFromUrl = extMatch ? extMatch[1] : '';

  if (kind === 'photo') {
    if (extFromUrl === 'png' || cleanCt === 'image/png') return { mime: 'image/png', ext: 'png' };
    if (extFromUrl === 'webp' || cleanCt === 'image/webp') return { mime: 'image/webp', ext: 'webp' };
    return { mime: cleanCt.startsWith('image/') ? cleanCt : 'image/jpeg', ext: extFromUrl || 'jpg' };
  }
  if (kind === 'video') {
    return { mime: cleanCt.startsWith('video/') ? cleanCt : 'video/mp4', ext: extFromUrl || 'mp4' };
  }
  if (kind === 'voice_note') {
    return { mime: 'audio/ogg', ext: extFromUrl || 'ogg' };
  }
  if (kind === 'audio') {
    return { mime: cleanCt.startsWith('audio/') ? cleanCt : 'audio/mpeg', ext: extFromUrl || 'mp3' };
  }
  return {
    mime: cleanCt && cleanCt !== 'application/octet-stream' ? cleanCt : 'application/octet-stream',
    ext: extFromUrl || 'bin'
  };
}

/**
 * Downloads remote HTTP media URLs (including optional inline markdown photos) and builds a FormData
 * payload with `attach://...` references so /sendRichMessage works natively even when Telegram's remote
 * URL fetcher cannot retrieve ProTalk/proxied URLs directly.
 */
export async function buildRichMultipartFormData(params: {
  chatId: string;
  markdown: string;
  mediaItems: InputRichMessageMediaItem[];
  replyMarkup?: any;
  protectContent?: boolean;
  includeMarkdownPhotos?: boolean;
}): Promise<{ formData: FormData; attachedCount: number }> {
  const { chatId, markdown, mediaItems, replyMarkup, protectContent, includeMarkdownPhotos = false } = params;
  const fd = new FormData();
  fd.append('chat_id', chatId);

  let nextMd = markdown;
  const clonedMedia: InputRichMessageMediaItem[] = mediaItems.map((item) => ({
    id: item.id,
    media: { ...item.media }
  }));

  let attachIdx = 0;

  const downloadToBlob = async (
    url: string,
    kind: 'photo' | 'video' | 'audio' | 'voice_note' | 'document' | 'animation',
    preferredTitle?: string
  ): Promise<{ blob: Blob; filename: string; resolvedKind: 'photo' | 'video' | 'audio' | 'voice_note' | 'document' | 'animation' } | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      if (!arr || arr.byteLength === 0) return null;
      const rawCt = String(res.headers.get('content-type') || '').toLowerCase();
      let resolvedKind = kind;
      if (kind === 'photo' && (rawCt.startsWith('video/') || isVideoMediaUrl(url))) {
        resolvedKind = 'video';
      }
      const { mime, ext } = guessMimeAndExt(url, rawCt, resolvedKind);
      const disp = res.headers.get('content-disposition') || '';
      const dispMatch = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      const rawDispName = dispMatch?.[1] ? decodeURIComponent(dispMatch[1].trim()) : '';
      const safeTitle = String(preferredTitle || '')
        .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
        .trim()
        .slice(0, 48);
      const idx = ++attachIdx;
      const filename =
        rawDispName ||
        (safeTitle ? `${safeTitle}.${ext}` : `${resolvedKind || 'media'}_${idx}.${ext}`);
      return {
        blob: new Blob([arr], { type: mime }),
        filename,
        resolvedKind
      };
    } catch {
      return null;
    }
  };

  for (const item of clonedMedia) {
    const rawUrl = item.media?.media || '';
    if (!/^https?:\/\//i.test(rawUrl)) continue;
    const downloaded = await downloadToBlob(rawUrl, item.media.type, item.media.title || item.media.caption);
    if (downloaded) {
      const fieldKey = `rich_file_${attachIdx}`;
      fd.append(fieldKey, downloaded.blob, downloaded.filename);
      item.media.media = `attach://${fieldKey}`;
    }
  }

  if (includeMarkdownPhotos) {
    const urlToTargetRef = new Map<string, { id: string; kind: 'photo' | 'video' }>();
    const photoMatches = Array.from(nextMd.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g));
    for (const m of photoMatches) {
      const mediaUrl = m[2];
      if (!mediaUrl || urlToTargetRef.has(mediaUrl)) continue;
      if (clonedMedia.length >= MAX_RICH_MEDIA_ATTACHMENTS) break;
      const initialKind = isVideoMediaUrl(mediaUrl) ? 'video' : 'photo';
      const downloaded = await downloadToBlob(mediaUrl, initialKind);
      if (downloaded) {
        const finalKind: 'photo' | 'video' = downloaded.resolvedKind === 'video' ? 'video' : 'photo';
        const mediaId = `${finalKind === 'video' ? 'vd' : 'ph'}_${attachIdx}`;
        const fieldKey = `rich_file_${attachIdx}`;
        fd.append(fieldKey, downloaded.blob, downloaded.filename);
        clonedMedia.push({
          id: mediaId,
          media: { type: finalKind, media: `attach://${fieldKey}` }
        });
        urlToTargetRef.set(mediaUrl, { id: mediaId, kind: finalKind });
      }
    }
    if (urlToTargetRef.size > 0) {
      nextMd = nextMd.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (full, alt, url) => {
        const ref = urlToTargetRef.get(url);
        return ref ? `![${alt}](tg://${ref.kind}?id=${ref.id})` : full;
      });
    }
  }

  const richObj: any = { markdown: nextMd };
  if (clonedMedia.length > 0) {
    richObj.media = clonedMedia;
  }
  fd.append('rich_message', JSON.stringify(richObj));
  if (replyMarkup) {
    fd.append('reply_markup', JSON.stringify(replyMarkup));
  }
  if (protectContent) {
    fd.append('protect_content', 'true');
  }

  return { formData: fd, attachedCount: attachIdx };
}

