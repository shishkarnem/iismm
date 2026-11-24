// Общие чистые хелперы для разбора блоков кода (```), починки непарных HTML-тегов (<b>...<b>)
// и дедупликации заголовков постов в предпросмотрах, лентах и на сервере.

export interface ExtractedCodeFence {
  lang: string;
  code: string;
  nextIndex: number;
  trailingLine?: string;
}

/**
 * Извлекает fenced code block начиная с lines[startIndex], который начинается с ```.
 * Корректно обрабатывает:
 * 1) Однострочные блоки ```код``` (опционально с текстом после закрывающих ```)
 * 2) Многострочные блоки, где закрывающие ``` стоят на отдельной строке
 * 3) Многострочные блоки, где закрывающие ``` приклеены к концу контентной строки (например `...шаблонов.````)
 */
export function extractClosedCodeFence(lines: string[], startIndex: number): ExtractedCodeFence | null {
  if (startIndex < 0 || startIndex >= lines.length) return null;
  const trimmed = lines[startIndex].trim();
  if (!trimmed.startsWith('```')) return null;

  const afterOpen = trimmed.slice(3);
  const sameLineCloseIdx = afterOpen.indexOf('```');
  if (sameLineCloseIdx !== -1) {
    const rawCode = afterOpen.slice(0, sameLineCloseIdx);
    const trailingLine = afterOpen.slice(sameLineCloseIdx + 3).trim() || undefined;
    return {
      lang: '',
      code: rawCode.replace(/^\n+|\n+$/g, ''),
      nextIndex: startIndex + 1,
      trailingLine,
    };
  }

  const lang = afterOpen.trim();
  const codeLines: string[] = [];
  let j = startIndex + 1;
  let trailingLine: string | undefined;

  while (j < lines.length) {
    const curLine = lines[j];
    const closeIdx = curLine.indexOf('```');
    if (closeIdx !== -1) {
      const beforeClose = curLine.slice(0, closeIdx);
      if (beforeClose.trim().length > 0) {
        codeLines.push(beforeClose.replace(/\s+$/, ''));
      }
      const afterClose = curLine.slice(closeIdx + 3).trim();
      if (afterClose) {
        trailingLine = afterClose;
      }
      j++;
      break;
    }
    codeLines.push(curLine);
    j++;
  }

  return {
    lang,
    code: codeLines.join('\n'),
    nextIndex: j,
    trailingLine,
  };
}

const INLINE_HTML_CANONICAL: Record<string, string> = {
  b: 'b',
  strong: 'b',
  i: 'i',
  em: 'i',
  u: 'u',
  ins: 'u',
  s: 's',
  del: 's',
  strike: 's',
  'tg-spoiler': 'tg-spoiler',
  sup: 'sup',
  sub: 'sub',
};

interface HtmlTagMatch {
  index: number;
  length: number;
  raw: string;
  isClose: boolean;
  rawTag: string;
  canon: string;
}

/**
 * Чинит опечатки в HTML-разметке постов внутри каждого абзаца (вне блоков кода ``` и `...`):
 * - парный открывающий тег вместо закрывающего: `<b>Заголовок<b>` -> `<b>Заголовок</b>`
 * - незакрытый перед новым таким же тегом в соседней строке: `<b>Первая\n<b>Вторая</b>` -> `<b>Первая</b>\n<b>Вторая</b>`
 * - незакрытый к концу абзаца тег закрывается автоматически, не протекая на следующие абзацы
 * - лишние закрывающие теги без пары удаляются
 */
export function repairMalformedInlineHtmlTags(text: string): string {
  if (!text || !text.includes('<')) return text;

  const masked: string[] = [];
  const stash = (m: string) => {
    const idx = masked.length;
    masked.push(m);
    return `\uE002M${idx}\uE002`;
  };

  let safeText = text
    .replace(/```[\s\S]*?```/g, stash)
    .replace(/`[^`\n]+`/g, stash)
    .replace(/<tg-emoji\b[^>]*>[\s\S]*?<\/tg-emoji>/gi, stash)
    .replace(/<tg-time\b[^>]*>[\s\S]*?<\/tg-time>/gi, stash)
    .replace(/<tg-button\b[^>]*>[\s\S]*?<\/tg-button>/gi, stash)
    .replace(/<tg-document\b[^>]*>(?:[\s\S]*?<\/tg-document>)?/gi, stash)
    .replace(/<\/?(?:tg-)?(?:collage|slideshow|carousel|button-row|details|summary|aside|blockquote|cite|figure|video|audio|table)\b[^>]*>/gi, stash)
    .replace(/<a\b[^>]*>|<\/a>/gi, stash)
    .replace(/<br\s*\/?>/gi, stash);

  const segments = safeText.split(/((?:\r?\n){2,})/);
  const tagRegex = /<(\/?)(b|strong|i|em|u|ins|s|del|strike|tg-spoiler|sup|sub)(?:\s[^>]*)?>/gi;

  const repairedSegments = segments.map((seg, segIdx) => {
    if (segIdx % 2 === 1 || !seg.includes('<')) return seg;

    const matches: HtmlTagMatch[] = [];
    tagRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(seg)) !== null) {
      const rawTag = m[2].toLowerCase();
      const canon = INLINE_HTML_CANONICAL[rawTag] || rawTag;
      matches.push({
        index: m.index,
        length: m[0].length,
        raw: m[0],
        isClose: m[1] === '/',
        rawTag,
        canon,
      });
    }

    if (matches.length === 0) return seg;

    const openStack: { rawTag: string; canon: string }[] = [];
    let out = '';
    let cursor = 0;

    for (let idx = 0; idx < matches.length; idx++) {
      const cur = matches[idx];
      out += seg.slice(cursor, cur.index);
      cursor = cur.index + cur.length;

      if (!cur.isClose) {
        let alreadyOpenPos = -1;
        for (let k = openStack.length - 1; k >= 0; k--) {
          if (openStack[k].canon === cur.canon) {
            alreadyOpenPos = k;
            break;
          }
        }

        if (alreadyOpenPos === -1) {
          openStack.push({ rawTag: cur.rawTag, canon: cur.canon });
          out += `<${cur.rawTag}>`;
        } else {
          // Ищем следующий тег того же канонического типа в текущем абзаце
          const nextSame = matches.slice(idx + 1).find((nm) => nm.canon === cur.canon);
          if (nextSame && nextSame.isClose) {
            // Первый тег забыли закрыть перед новой открытой парой: закрываем всё вплоть до alreadyOpenPos и открываем новый
            while (openStack.length > alreadyOpenPos) {
              const popped = openStack.pop()!;
              out += `</${popped.rawTag}>`;
            }
            openStack.push({ rawTag: cur.rawTag, canon: cur.canon });
            out += `<${cur.rawTag}>`;
          } else {
            // Повторный открывающий тег без пары закрытия: это опечатка вроде `<b>Заголовок<b>`
            while (openStack.length > alreadyOpenPos) {
              const popped = openStack.pop()!;
              out += `</${popped.rawTag}>`;
            }
          }
        }
      } else {
        let matchPos = -1;
        for (let k = openStack.length - 1; k >= 0; k--) {
          if (openStack[k].canon === cur.canon) {
            matchPos = k;
            break;
          }
        }
        if (matchPos !== -1) {
          while (openStack.length > matchPos) {
            const popped = openStack.pop()!;
            out += `</${popped.rawTag}>`;
          }
        }
        // Лишний закрывающий тег без пары пропускается
      }
    }

    out += seg.slice(cursor);
    while (openStack.length > 0) {
      const popped = openStack.pop()!;
      out += `</${popped.rawTag}>`;
    }
    return out;
  });

  safeText = repairedSegments.join('');
  return safeText.replace(/\uE002M(\d+)\uE002/g, (_, idxStr) => masked[Number(idxStr)] || '');
}

function normalizeTitleForComparison(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\([_*\[\]()~`>#+\-=|{}.!\\])/g, '$1')
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*(?:\*\*>|>)\s*/, '')
    .replace(/<\/?[a-z0-9-]+(?:\s+[^>]*)?>/gi, '')
    .replace(/\|\|/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\s"'«»“”„]+|[\s"'«»“”„.:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function titlesLookEquivalent(lineNorm: string, titleNorm: string): boolean {
  if (!lineNorm || !titleNorm || titleNorm.length < 3) return false;
  if (lineNorm === titleNorm) return true;
  // Учитываем усечённые заголовки с многоточием (например из календаря/архива)
  const cleanTitlePrefix = titleNorm.replace(/\.{2,}$/, '').trim();
  if (cleanTitlePrefix.length >= 12 && lineNorm.startsWith(cleanTitlePrefix)) {
    return true;
  }
  const cleanLinePrefix = lineNorm.replace(/\.{2,}$/, '').trim();
  if (cleanLinePrefix.length >= 12 && titleNorm.startsWith(cleanLinePrefix)) {
    return true;
  }
  return false;
}

function findDuplicateTitleLineIndex(lines: string[], title?: string): number {
  const titleNorm = normalizeTitleForComparison(title || '');
  if (!titleNorm) return -1;

  let nonEmptySeen = 0;
  for (let i = 0; i < lines.length && nonEmptySeen < 4; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('```') || /^<(?:tg-)?(?:collage|slideshow|carousel|details|table)\b/i.test(trimmed)) {
      break;
    }
    nonEmptySeen++;
    const lineNorm = normalizeTitleForComparison(trimmed);
    if (titlesLookEquivalent(lineNorm, titleNorm)) {
      return i;
    }
  }
  return -1;
}

/**
 * Проверяет, содержит ли начало текста публикации (# заголовок или дублирующий title)
 * в первых нескольких строках (например после строки рубрики).
 */
export function hasTitleOrHeadingInBody(content: string, title?: string): boolean {
  if (!content) return false;
  if (/^\s*#{1,4}\s+/.test(content)) return true;
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return findDuplicateTitleLineIndex(lines, title) !== -1;
}

/**
 * Удаляет дублирующуюся строку заголовка из начала тела поста при рендеринге карточек/модалок,
 * где заголовок поста уже выведен отдельной шапкой `title`. Сохраняет строку рубрики над ним.
 */
export function stripDuplicateTitleFromPostContent(content: string, title?: string): string {
  if (!content || !title) return content;
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const matchIdx = findDuplicateTitleLineIndex(lines, title);
  if (matchIdx === -1) return content;

  const remaining = [...lines.slice(0, matchIdx), ...lines.slice(matchIdx + 1)];
  // Убираем лишнюю пустую строку, оставшуюся после вырезанного заголовка
  const joined = remaining.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');
  return joined;
}
