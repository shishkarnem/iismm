export interface ChatPreviewFormatInput {
  text?: string | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  images?: unknown;
  forwardedFrom?: unknown;
  fallback?: string;
  maxLength?: number;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…'
};

export function decodeHtmlEntitiesForPreview(raw: string): string {
  if (!raw) return '';
  let decoded = raw.replace(
    /&(?:nbsp|amp|lt|gt|quot|#39|apos|laquo|raquo|mdash|ndash|hellip);/gi,
    (match) => NAMED_HTML_ENTITIES[match.toLowerCase()] ?? match
  );
  decoded = decoded.replace(/&#(\d+);/g, (_, numStr) => {
    const code = parseInt(numStr, 10);
    return !isNaN(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hexStr) => {
    const code = parseInt(hexStr, 16);
    return !isNaN(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  return decoded;
}

function parseAttachmentsCount(images: unknown): number {
  if (!images) return 0;
  if (Array.isArray(images)) {
    return images.filter((item) => typeof item === 'string' && item.trim().length > 0).length;
  }
  if (typeof images === 'string') {
    const trimmed = images.trim();
    if (!trimmed) return 0;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0).length;
        }
      } catch {
        return 0;
      }
    }
    return 1;
  }
  return 0;
}

/**
 * Превращает любой текст сообщения с вложениями, Rich-тегами (<tg-slideshow>, <tg-collage>, ![](url)),
 * HTML-сущностями и Markdown-разметкой в аккуратный читабельный однострочный предпоказ для списка чатов и групп.
 */
export function formatChatLastMessagePreview(input: ChatPreviewFormatInput): string {
  const maxLen = input.maxLength ?? 92;
  const fallbackText = (input.fallback ?? '').trim();

  let parsedFwd: { senderName?: string; title?: string; text?: string; images?: unknown } | null = null;
  if (input.forwardedFrom && typeof input.forwardedFrom === 'object') {
    parsedFwd = input.forwardedFrom as any;
  } else if (typeof input.forwardedFrom === 'string' && input.forwardedFrom.trim().startsWith('{')) {
    try {
      parsedFwd = JSON.parse(input.forwardedFrom);
    } catch {
      parsedFwd = null;
    }
  }

  const rawCandidate =
    (input.text && String(input.text).trim()) ||
    (parsedFwd?.text && String(parsedFwd.text).trim()) ||
    (parsedFwd?.title && String(parsedFwd.title).trim()) ||
    '';

  let hasSlideshow = /<tg-slideshow[\s>]/i.test(rawCandidate);
  let hasCollage = /<tg-collage[\s>]/i.test(rawCandidate);
  let hasSlider = /<tg-slider[\s>]/i.test(rawCandidate);
  let inlineImagesCount = 0;

  let text = decodeHtmlEntitiesForPreview(rawCandidate);

  // Extract captions from Rich <tg-slideshow> / <tg-collage> / <tg-slider> blocks and strip image URLs
  text = text.replace(/<tg-slideshow[^>]*>([\s\S]*?)<\/tg-slideshow>/gi, (_, inner: string) => {
    hasSlideshow = true;
    const captions: string[] = [];
    inner.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, cap: string) => {
      inlineImagesCount += 1;
      if (cap && cap.trim()) captions.push(cap.trim());
      return '';
    });
    return captions.length > 0 ? ` ${captions[0]} ` : ' ';
  });

  text = text.replace(/<tg-collage[^>]*>([\s\S]*?)<\/tg-collage>/gi, (_, inner: string) => {
    hasCollage = true;
    const captions: string[] = [];
    inner.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, cap: string) => {
      inlineImagesCount += 1;
      if (cap && cap.trim()) captions.push(cap.trim());
      return '';
    });
    return captions.length > 0 ? ` ${captions[0]} ` : ' ';
  });

  text = text.replace(/<tg-slider[^>]*>([\s\S]*?)<\/tg-slider>/gi, (_, inner: string) => {
    hasSlider = true;
    const captions: string[] = [];
    inner.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, cap: string) => {
      inlineImagesCount += 1;
      if (cap && cap.trim()) captions.push(cap.trim());
      return '';
    });
    return captions.length > 0 ? ` ${captions[0]} ` : ' ';
  });

  // Handle unclosed <tg-slideshow> or <tg-collage> tags (e.g. previously sliced to 50 chars in DB!)
  if (/<\/?tg-slideshow[^>]*>/i.test(text)) {
    hasSlideshow = true;
    text = text.replace(/<\/?tg-slideshow[^>]*>/gi, ' ');
  }
  if (/<\/?tg-collage[^>]*>/i.test(text)) {
    hasCollage = true;
    text = text.replace(/<\/?tg-collage[^>]*>/gi, ' ');
  }
  if (/<\/?tg-slider[^>]*>/i.test(text)) {
    hasSlider = true;
    text = text.replace(/<\/?tg-slider[^>]*>/gi, ' ');
  }

  // Strip complete Markdown image syntax ![caption](url) and truncated ![caption](http...
  text = text.replace(/!\[([^\]]*)\]\([^)\n]*\)?/g, (_, cap: string) => {
    inlineImagesCount += 1;
    const cleanCap = (cap || '').trim();
    if (
      cleanCap &&
      !/^(?:image|photo|img|attached|обложка|слайд|фото)$/i.test(cleanCap) &&
      !cleanCap.startsWith('http')
    ) {
      return ` ${cleanCap} `;
    }
    return ' ';
  });

  // Replace Markdown links [label](url) with readable label
  text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/|#|tg:\/\/)[^)\s]*\)?/g, '$1');

  // Remove HTML anchors / custom tags and standard HTML formatting tags
  text = text
    .replace(/<a\s+name=["'][^"']*["']\s*><\/a>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:p|div|h[1-6]|blockquote|aside|details|summary|ul|ol|li|table|thead|tbody|tr|th|td|hr)[^>]*>/gi, ' ')
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*[^>]*>/g, '');

  // Strip Markdown V2 & Rich formatting markers while keeping readable words
  text = text
    .replace(/```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/~~([\s\S]+?)~~/g, '$1')
    .replace(/\|\|([\s\S]+?)\|\|/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?:;])/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?:;])/g, '$1$2')
    .replace(/(^|\s)~([^~\n]+)~(?=\s|$|[.,!?:;])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^(?:\*\*>|>)\s?/gm, '')
    .replace(/^(?:[-*•]\s+)?\[[ xX✓✔]?\]\s+/gm, '')
    .replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1');

  // Remove standalone media URLs left over from truncated markdown
  text = text.replace(/https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif|mp4|webm|ogg|mp3)(?:\?[^\s)]*)?/gi, ' ');
  // Remove broken trailing markdown image fragments like "![](http://ais-dev-..."
  text = text.replace(/!\[\]\(https?:\/\/[^\s)]*/gi, ' ');

  // Normalize all line breaks and tabs into a clean single line (take first meaningful line or collapsed line)
  const meaningfulLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && line !== '---' && line !== '***' && !/^\|[\s:-]+\|$/.test(line));

  const firstCleanLine = meaningfulLines.length > 0 ? meaningfulLines.join(' · ') : '';

  const attachedCount =
    parseAttachmentsCount(input.images) + parseAttachmentsCount(parsedFwd?.images);
  const mediaType = String(input.mediaType || '').toLowerCase();
  const hasMediaUrl = Boolean(input.mediaUrl && String(input.mediaUrl).trim());

  let mediaBadge = '';
  if (mediaType === 'voice') {
    mediaBadge = '🎤 Голосовое сообщение';
  } else if (mediaType === 'audio') {
    mediaBadge = '🎵 Аудиозапись';
  } else if (mediaType === 'video' || mediaType === 'video_note') {
    mediaBadge = '🎬 Видео';
  } else if (mediaType === 'document') {
    mediaBadge = '📎 Файл';
  } else if (hasSlideshow || hasSlider) {
    mediaBadge = '🖼 Слайд-шоу';
  } else if (hasCollage) {
    mediaBadge = '🖼 Коллаж';
  } else if (attachedCount > 1 || inlineImagesCount > 1) {
    mediaBadge = '🖼 Альбом';
  } else if (mediaType === 'photo' || attachedCount === 1 || inlineImagesCount === 1 || hasMediaUrl) {
    mediaBadge = '📷 Фото';
  }

  let combined = '';
  if (firstCleanLine && mediaBadge) {
    // Avoid duplicating badge if text already starts with an emoji media label
    if (firstCleanLine.startsWith('🎤') || firstCleanLine.startsWith('📷') || firstCleanLine.startsWith('🖼')) {
      combined = firstCleanLine;
    } else {
      combined = `${mediaBadge}: ${firstCleanLine}`;
    }
  } else if (firstCleanLine) {
    combined = firstCleanLine;
  } else if (mediaBadge) {
    combined = mediaBadge;
  } else if (parsedFwd?.senderName) {
    combined = `Переслано от ${parsedFwd.senderName}`;
  } else {
    combined = fallbackText;
  }

  combined = combined.replace(/\s+/g, ' ').trim();
  if (combined.length > maxLen) {
    return `${combined.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return combined;
}
