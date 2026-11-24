/**
 * Постобработчик структуры текста для форматов Telegram v2 и Rich.
 * Правила абзацев для промптов ИИ хранятся исключительно в таблице PostgreSQL scenario_block_prompts.
 */

export function sanitizeV2NoMarkdownHeadings(text: string): string {
  if (!text) return '';
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  let inCodeFence = false;

  return lines
    .map((line) => {
      const fenceCount = (line.match(/```/g) || []).length;
      if (fenceCount > 0) {
        const wasInside = inCodeFence;
        if (fenceCount % 2 === 1) {
          inCodeFence = !inCodeFence;
        }
        if (wasInside || /^\s*```/.test(line)) {
          return line;
        }
      }
      if (inCodeFence) return line;
      const headingMatch = line.match(/^\s*#{1,6}\s+(.+?)\s*#*$/);
      if (headingMatch && headingMatch[1]) {
        const inner = headingMatch[1]
          .replace(/^\*\*([\s\S]+)\*\*$/, '$1')
          .replace(/^\*([\s\S]+)\*$/, '$1')
          .trim();
        if (!inner) return '';
        if (/^<b>[\s\S]*<\/b>$/i.test(inner)) return inner;
        return `<b>${inner}</b>`;
      }
      return line;
    })
    .join('\n');
}

export function ensureTitleHeadingInPostText(
  text: string,
  title?: string,
  format: 'v2' | 'rich' | string = 'rich'
): string {
  const rawText = String(text || '');
  if (!rawText.trim()) return rawText;
  const isRich = String(format).toLowerCase() === 'rich';
  const cleanTitle = String(title || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/<\/?(?:b|strong)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !cleanTitle ||
    /^новый\s+пост\s+без\s+названия(?:\s*\(\d+\))?$/i.test(cleanTitle) ||
    /^черновик\s+поста$/i.test(cleanTitle) ||
    /^новая\s+публикация$/i.test(cleanTitle)
  ) {
    return isRich ? rawText : sanitizeV2NoMarkdownHeadings(rawText);
  }

  const normalizedRaw = isRich ? rawText : sanitizeV2NoMarkdownHeadings(rawText);
  const lines = normalizedRaw.replace(/\r\n/g, '\n').split('\n');
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx === -1) return normalizedRaw;

  const firstLine = lines[firstIdx].trim();
  if (isRich && /^#{1,4}\s+/.test(firstLine)) {
    return normalizedRaw;
  }

  const stripDecor = (s: string) =>
    s
      .replace(/<\/?(?:b|strong|i|em|u|s)>/gi, '')
      .replace(/[*_~`]/g, '')
      .replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const formattedHeading = isRich ? `# ${cleanTitle}` : `<b>${cleanTitle}</b>`;
  if (stripDecor(firstLine) === stripDecor(cleanTitle)) {
    lines[firstIdx] = formattedHeading;
    return lines.join('\n');
  }

  if (!isRich && /^<b>[^<\n]{3,110}<\/b>$/i.test(firstLine)) {
    return normalizedRaw;
  }

  return `${formattedHeading}\n\n${normalizedRaw.trimStart()}`;
}

type RichLineKind =
  | 'empty'
  | 'code_fence'
  | 'atomic_open'
  | 'atomic_close'
  | 'inside_atomic'
  | 'heading'
  | 'divider'
  | 'image'
  | 'quote'
  | 'checklist'
  | 'bullet_list'
  | 'ordered_list'
  | 'table'
  | 'paragraph';

type AtomicTagKind = 'media' | 'button_row' | 'details' | 'aside' | 'blockquote' | 'figure';

function detectAtomicOpenTag(trimmed: string): AtomicTagKind | null {
  if (/^<(?:tg-)?(?:slideshow|collage|carousel)\b/i.test(trimmed)) return 'media';
  if (/^<tg-button-row\b/i.test(trimmed)) return 'button_row';
  if (/^<details\b/i.test(trimmed)) return 'details';
  if (/^<aside\b/i.test(trimmed)) return 'aside';
  if (/^<blockquote\b/i.test(trimmed)) return 'blockquote';
  if (/^<figure\b/i.test(trimmed)) return 'figure';
  return null;
}

function detectAtomicCloseMatch(trimmed: string, activeTag: AtomicTagKind): boolean {
  switch (activeTag) {
    case 'media':
      return /<\/(?:tg-)?(?:slideshow|collage|carousel)\s*>/i.test(trimmed);
    case 'button_row':
      return /<\/tg-button-row\s*>/i.test(trimmed);
    case 'details':
      return /<\/details\s*>/i.test(trimmed);
    case 'aside':
      return /<\/aside\s*>/i.test(trimmed);
    case 'blockquote':
      return /<\/blockquote\s*>/i.test(trimmed);
    case 'figure':
      return /<\/figure\s*>/i.test(trimmed);
  }
}

function classifyRichLine(
  line: string,
  inCodeFence: boolean,
  activeAtomicTag: AtomicTagKind | null
): RichLineKind {
  const trimmed = line.trim();
  if (/^```/.test(trimmed)) return 'code_fence';
  if (inCodeFence) return 'code_fence';
  if (activeAtomicTag) {
    return detectAtomicCloseMatch(trimmed, activeAtomicTag) ? 'atomic_close' : 'inside_atomic';
  }
  const openTag = detectAtomicOpenTag(trimmed);
  if (openTag) {
    return detectAtomicCloseMatch(trimmed, openTag) ? 'atomic_close' : 'atomic_open';
  }
  if (!trimmed) return 'empty';
  if (/^#{1,6}\s+/.test(trimmed)) return 'heading';
  if (/^(?:---+|\*\*\*+|___+)\s*$/.test(trimmed)) return 'divider';
  if (/^!\[[^\]]*\]\([^\)]+\)\s*$/.test(trimmed)) return 'image';
  if (/^>\s*/.test(trimmed)) return 'quote';
  if (/^[-*•]\s+\[[ xX]\]\s+/.test(trimmed)) return 'checklist';
  if (/^[-*•]\s+/.test(trimmed)) return 'bullet_list';
  if (/^\d{1,2}[.)]\s+/.test(trimmed)) return 'ordered_list';
  if (/^\|.*\|\s*$/.test(trimmed)) return 'table';
  return 'paragraph';
}

/**
 * Разбивает склеенные «простыни» текста на читаемые абзацы:
 * - Выносит склеенные шаги (например: "...подряд. 🎙 *Шаг 1. Получите...*") на отдельные абзацы \n\n
 * - Выносит склеенные нумерованные и эмодзи-пункты на новые абзацы
 * - Если весь текст пришел одним монолитным блоком без переносов (> 280 симв.), делит по 2 предложения на абзац
 */
function splitGluedProseWalls(input: string): string {
  if (!input) return '';

  const protectedBlocks: string[] = [];
  const stashBlock = (match: string) => {
    const idx = protectedBlocks.length;
    protectedBlocks.push(match);
    return `@@PROTECTED_BLOCK_${idx}@@`;
  };

  let working = input
    .replace(/```[\s\S]*?```/g, stashBlock)
    .replace(/<tg-button-row\b[^>]*>[\s\S]*?<\/tg-button-row>/gi, stashBlock)
    .replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, stashBlock)
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, stashBlock)
    .replace(/<(?:tg-)?(?:slideshow|collage|carousel)\b[^>]*>[\s\S]*?<\/(?:tg-)?(?:slideshow|collage|carousel)>/gi, stashBlock);

  // 1. Separate glued HTML blockquotes / protected tags onto clean paragraphs
  working = working
    .replace(/([^\n])\s*(<blockquote\b|@@PROTECTED_BLOCK_\d+@@)/gi, '$1\n\n$2')
    .replace(/(<\/blockquote>|@@PROTECTED_BLOCK_\d+@@)\s*([^\n])/gi, '$1\n\n$2');

  // 2. Separate glued inline markdown headings ("...текст. ## Глава")
  working = working.replace(/([^\n#])\s+(#{1,6}\s+[^\n]+)/g, '$1\n\n$2');

  // 3. Separate glued step headers / bold emoji lead-ins after sentence end
  working = working.replace(
    /([.!?»”])\s+((?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*)+(?:(?:\*\*|\*|<b>)?(?:Шаг|Этап|Пункт|Часть|Правило|Совет|Ошибка|Вывод|Итог|Пример|Факт|Миф)\b[^\n]{0,60}|(?:\*\*[^*\n]{2,80}\*\*|\*[^*\n]{2,80}\*|<b>[^<\n]{2,80}<\/b>)))/giu,
    '$1\n\n$2'
  );

  // Also separate glued step markers without leading emoji: "...подряд. *Шаг 1...*" or "...подряд. Шаг 1."
  working = working.replace(
    /([.!?»”])\s+((?:\*\*|\*|<b>)?(?:Шаг|Этап|Пункт|Часть|Правило|Совет)\s*\d+\b)/giu,
    '$1\n\n$2'
  );

  // 4. Separate glued numbered list items after sentence end
  working = working.replace(
    /([.!?»”:])\s+(\d{1,2}[.)]\s+(?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*)?(?:\*\*|\*|<b>)?[А-ЯЁA-Z])/gu,
    '$1\n\n$2'
  );

  // 5. Separate glued bullet markers after sentence end / colon
  working = working.replace(
    /([.!?»”:])\s+([•🔹🔸▪️▫️⚡👉📌✅]\s+)/gu,
    '$1\n\n$2'
  );

  // 6. If any single line paragraph is still a monolithic wall (> 300 chars, >= 4 sentences), split every 2 sentences
  const blocks = working.split(/\n{2,}/);
  const refinedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (
      trimmed.length <= 300 ||
      trimmed.includes('\n') ||
      trimmed.startsWith('@@PROTECTED_BLOCK_') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<tg-') ||
      trimmed.startsWith('<details') ||
      trimmed.startsWith('<aside') ||
      trimmed.startsWith('![') ||
      trimmed.startsWith('|') ||
      /^[-*•\d]/.test(trimmed)
    ) {
      return block;
    }

    const sentences = trimmed
      .split(/(?<=[.!?])\s+(?=(?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*)?[А-ЯЁA-Z«"*<])/u)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length < 4) return block;

    const grouped: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      grouped.push(sentences.slice(i, i + 2).join(' '));
    }
    return grouped.join('\n\n');
  });

  working = refinedBlocks.join('\n\n');

  // Restore protected blocks
  working = working.replace(/@@PROTECTED_BLOCK_(\d+)@@/g, (_, idxStr) => {
    return protectedBlocks[Number(idxStr)] || '';
  });

  return working;
}

/**
 * Гарантирует для формата Rich обязательные пустые строки (\n\n) на каждой строчке/абзаце
 * и при любой смене типов строк оформления (заголовок, текст, цитата, список, чек-лист, таблица, картинка, код, кнопки, спойлер, выноска).
 */
export function enforceRichLineTypeTransitions(input: string): string {
  if (!input) return '';

  // Separate inline markdown images glued to prose on the same line
  const text = input
    .replace(/([^\n!])\s+(!\[[^\]]*\]\([^\)]+\))/g, '$1\n\n$2')
    .replace(/(!\[[^\]]*\]\([^\)]+\))\s+([^\n])/g, '$1\n\n$2');

  const rawLines = text.split('\n');
  const outLines: string[] = [];

  let inCodeFence = false;
  let activeAtomicTag: AtomicTagKind | null = null;
  let prevNonEmptyKind: RichLineKind | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const kind = classifyRichLine(rawLine, inCodeFence, activeAtomicTag);

    if (kind === 'empty') {
      if (inCodeFence) {
        outLines.push(rawLine);
      } else if (!activeAtomicTag && outLines.length > 0 && outLines[outLines.length - 1] !== '') {
        outLines.push('');
      }
      continue;
    }

    const needBlankLineBefore = (() => {
      if (outLines.length === 0) return false;
      if (outLines[outLines.length - 1] === '') return false;
      if (!prevNonEmptyKind) return false;

      // Keep lines inside code fences & multi-line atomic Rich tags (<tg-button-row>, <details>, <aside>, <blockquote>, <tg-slideshow>) tight
      if (inCodeFence || activeAtomicTag !== null) return false;
      if (kind === 'code_fence' && !inCodeFence) return true;

      // Keep consecutive markdown table rows together as a single table
      if (prevNonEmptyKind === 'table' && kind === 'table') {
        return false;
      }

      // Keep multi-line blockquote lines (> ...) together
      if (prevNonEmptyKind === 'quote' && kind === 'quote') {
        return false;
      }

      // For ALL other transitions (any change of line type, consecutive paragraphs, headings, lists, images, dividers, atomic blocks):
      // Rich requires an explicit blank line (\n\n)!
      return true;
    })();

    if (needBlankLineBefore) {
      outLines.push('');
    }

    outLines.push(inCodeFence ? rawLine : rawLine.trimEnd());

    const trimmed = rawLine.trim();
    if (inCodeFence) {
      if (trimmed.includes('```')) {
        inCodeFence = false;
        prevNonEmptyKind = 'divider';
      } else {
        prevNonEmptyKind = 'code_fence';
      }
    } else if (/^```/.test(trimmed)) {
      const afterOpen = trimmed.slice(3);
      if (afterOpen.includes('```')) {
        inCodeFence = false;
        prevNonEmptyKind = 'divider';
      } else {
        inCodeFence = true;
        prevNonEmptyKind = 'code_fence';
      }
    } else if (activeAtomicTag) {
      if (detectAtomicCloseMatch(trimmed, activeAtomicTag)) {
        activeAtomicTag = null;
        prevNonEmptyKind = 'atomic_close';
      } else {
        prevNonEmptyKind = 'inside_atomic';
      }
    } else {
      const opened = detectAtomicOpenTag(trimmed);
      if (opened) {
        if (detectAtomicCloseMatch(trimmed, opened)) {
          activeAtomicTag = null;
          prevNonEmptyKind = 'atomic_close';
        } else {
          activeAtomicTag = opened;
          prevNonEmptyKind = 'atomic_open';
        }
      } else {
        prevNonEmptyKind = kind;
      }
    }
  }

  return outLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function repairAiCodeFences(raw: string): string {
  let out = String(raw || '')
    .replace(
      /<pre[^>]*>\s*<code(?:\s+class=["']language-([^"']+)["'])?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_, lang, code) => {
        const cleanCode = String(code || '').replace(/^\n+|\n+$/g, '');
        return `\n\`\`\`${lang || ''}\n${cleanCode}\n\`\`\`\n`;
      }
    )
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
      const cleanCode = String(code || '').replace(/^\n+|\n+$/g, '');
      return `\n\`\`\`\n${cleanCode}\n\`\`\`\n`;
    });

  out = out.replace(
    /(```[A-Za-z0-9_-]*\n(?:(?!```)[\s\S])*?)(?:<\/code>\s*<\/pre>|<\/code>|<\/pre>)/gi,
    (_, body) => `${body.trimEnd()}\n\`\`\``
  );
  return out;
}

/**
 * Универсальная нормализация абзацев после генерации ИИ (для v2 и Rich).
 */
export function enforceParagraphsAndRichBlocks(
  rawText: string,
  format: 'v2' | 'rich' | string = 'v2'
): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // Unescape literal "\n" sequences if an LLM double-escaped newlines inside JSON
  let text = repairAiCodeFences(
    rawText
      .replace(/\r\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/[\u2028\u2029]/g, '\n')
      .trim()
  );

  text = splitGluedProseWalls(text);

  if (String(format).toLowerCase() === 'rich') {
    text = enforceRichLineTypeTransitions(text);
  } else {
    // In v2: forbid markdown #/##/### headings (convert to <b>...</b>) and keep clean spacing
    text = sanitizeV2NoMarkdownHeadings(text)
      .replace(/([^\n])\n(>\s+)/g, '$1\n\n$2')
      .replace(/(>\s+[^\n]+)\n([^\n>])/g, '$1\n\n$2')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return text;
}
