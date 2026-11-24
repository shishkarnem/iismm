/**
 * Безопасное усечение Telegram HTML до заданного лимита видимых символов (например, 1024 для caption)
 * с сохранением целостности HTML-тегов и HTML-сущностей.
 */
const VOID_OR_SELF_CLOSING = new Set<string>([]);
const ALLOWED_TELEGRAM_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'a',
  'code',
  'pre',
  'blockquote',
  'tg-spoiler',
  'tg-emoji'
]);

function decodeHtmlEntityLength(): number {
  return 1;
}

export function truncateTelegramHtmlSafe(html: string, maxVisibleChars: number = 1024): string {
  if (!html || maxVisibleChars <= 0) return '';

  const openStack: string[] = [];
  let visibleCount = 0;
  let i = 0;
  let lastSafeIndex = 0;
  let lastSafeStack: string[] = [];
  let truncated = false;

  const limit = Math.max(10, maxVisibleChars - 1); // reserve 1 char for '…' if truncated

  while (i < html.length) {
    if (html[i] === '<') {
      const closeIdx = html.indexOf('>', i);
      if (closeIdx !== -1) {
        const rawTag = html.slice(i + 1, closeIdx).trim();
        const isClosing = rawTag.startsWith('/');
        const tagNameMatch = rawTag.replace(/^\/+/, '').match(/^([a-zA-Z0-9-]+)/);
        const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';

        if (tagName && ALLOWED_TELEGRAM_TAGS.has(tagName) && !VOID_OR_SELF_CLOSING.has(tagName)) {
          if (isClosing) {
            const idx = openStack.lastIndexOf(tagName);
            if (idx !== -1) {
              openStack.splice(idx, 1);
            }
          } else if (!rawTag.endsWith('/')) {
            openStack.push(tagName);
          }
        }
        i = closeIdx + 1;
        if (visibleCount <= limit) {
          lastSafeIndex = i;
          lastSafeStack = [...openStack];
        }
        continue;
      }
    }

    if (html[i] === '&') {
      const semiIdx = html.indexOf(';', i);
      if (semiIdx !== -1 && semiIdx - i <= 10) {
        const entityLen = decodeHtmlEntityLength();
        if (visibleCount + entityLen > limit) {
          truncated = true;
          break;
        }
        visibleCount += entityLen;
        i = semiIdx + 1;
        lastSafeIndex = i;
        lastSafeStack = [...openStack];
        continue;
      }
    }

    if (visibleCount + 1 > limit) {
      truncated = true;
      break;
    }

    visibleCount += 1;
    i += 1;
    // Prefer cutting on whitespace or sentence boundary when close to limit
    if (html[i - 1] === ' ' || html[i - 1] === '\n' || visibleCount <= limit - 20) {
      lastSafeIndex = i;
      lastSafeStack = [...openStack];
    }
  }

  if (!truncated) {
    return html;
  }

  const cutAt = lastSafeIndex > 0 ? lastSafeIndex : i;
  let result = html.slice(0, cutAt).replace(/\s+$/, '');
  result += '…';

  // Close any open tags still on stack at cut point (or after all characters if cutAt === i)
  const stackToClose = lastSafeIndex > 0 ? lastSafeStack : openStack;
  for (let k = stackToClose.length - 1; k >= 0; k--) {
    result += `</${stackToClose[k]}>`;
  }

  return result;
}
