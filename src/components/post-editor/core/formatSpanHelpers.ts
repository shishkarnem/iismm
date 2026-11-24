export interface ActiveSelectionStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  spoiler?: boolean;
  code?: boolean;
  code_block?: boolean;
  quote?: boolean;
  expandable_quote?: boolean;
  aside?: boolean;
  link?: string;
  h1?: boolean;
  h2?: boolean;
  h3?: boolean;
  h4?: boolean;
  sup?: boolean;
  sub?: boolean;
  details?: boolean;
  bullet_list?: boolean;
  number_list?: boolean;
  checkbox?: boolean;
  checkbox_done?: boolean;
  page_break?: boolean;
}

export interface FormatSpan {
  type: keyof ActiveSelectionStyles;
  outerStart: number;
  outerEnd: number;
  innerStart: number;
  innerEnd: number;
  meta?: string;
}

export function getAllFormatSpans(text: string, isRich: boolean): FormatSpan[] {
  const spans: FormatSpan[] = [];

  const addRegexSpans = (
    regex: RegExp,
    type: keyof ActiveSelectionStyles,
    openLenFn: (m: RegExpExecArray) => number,
    closeLenFn: (m: RegExpExecArray) => number,
    metaFn?: (m: RegExpExecArray) => string
  ) => {
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const openLen = openLenFn(m);
      const closeLen = closeLenFn(m);
      spans.push({
        type,
        outerStart: m.index,
        outerEnd: m.index + m[0].length,
        innerStart: m.index + openLen,
        innerEnd: m.index + m[0].length - closeLen,
        meta: metaFn ? metaFn(m) : undefined
      });
    }
  };

  addRegexSpans(/```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```/g, 'code_block', (m) => m[0].indexOf(m[1]), () => 3);
  addRegexSpans(/(?<!`)`([^`\n]+)`(?!`)/g, 'code', () => 1, () => 1);
  addRegexSpans(/\|\|([\s\S]+?)\|\|/g, 'spoiler', () => 2, () => 2);

  if (isRich) {
    addRegexSpans(/\*\*([\s\S]+?)\*\*/g, 'bold', () => 2, () => 2);
    addRegexSpans(/<b>([\s\S]+?)<\/b>/gi, 'bold', () => 3, () => 4);
    addRegexSpans(/<strong>([\s\S]+?)<\/strong>/gi, 'bold', () => 8, () => 9);
    addRegexSpans(/__(.+?)__/gs, 'underline', () => 2, () => 2);
    addRegexSpans(/<u>([\s\S]+?)<\/u>/gi, 'underline', () => 3, () => 4);
    addRegexSpans(/~~([\s\S]+?)~~/g, 'strike', () => 2, () => 2);
    addRegexSpans(/<s>([\s\S]+?)<\/s>/gi, 'strike', () => 3, () => 4);
    addRegexSpans(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, 'italic', () => 1, () => 1);
    addRegexSpans(/(?<!_)_([^_\n]+)_(?!_)/g, 'italic', () => 1, () => 1);
    addRegexSpans(/<i>([\s\S]+?)<\/i>/gi, 'italic', () => 3, () => 4);
    addRegexSpans(/<sup>([\s\S]+?)<\/sup>/gi, 'sup', () => 5, () => 6);
    addRegexSpans(/<sub>([\s\S]+?)<\/sub>/gi, 'sub', () => 5, () => 6);
    addRegexSpans(/<aside>([\s\S]+?)<\/aside>/gi, 'aside', () => 7, () => 8);
    addRegexSpans(
      /<details>\s*<summary>[\s\S]*?<\/summary>\n?([\s\S]*?)<\/details>/gi,
      'details',
      (m) => m[0].indexOf(m[1]),
      () => 10
    );
  } else {
    addRegexSpans(/__(.+?)__/gs, 'underline', () => 2, () => 2);
    addRegexSpans(/<u>([\s\S]+?)<\/u>/gi, 'underline', () => 3, () => 4);
    addRegexSpans(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, 'bold', () => 1, () => 1);
    addRegexSpans(/\*\*([\s\S]+?)\*\*/g, 'bold', () => 2, () => 2);
    addRegexSpans(/<b>([\s\S]+?)<\/b>/gi, 'bold', () => 3, () => 4);
    addRegexSpans(/<strong>([\s\S]+?)<\/strong>/gi, 'bold', () => 8, () => 9);
    addRegexSpans(/(?<!_)_([^_\n]+)_(?!_)/g, 'italic', () => 1, () => 1);
    addRegexSpans(/<i>([\s\S]+?)<\/i>/gi, 'italic', () => 3, () => 4);
    addRegexSpans(/<em>([\s\S]+?)<\/em>/gi, 'italic', () => 4, () => 5);
    addRegexSpans(/(?<!~)~([^~\n]+)~(?!~)/g, 'strike', () => 1, () => 1);
    addRegexSpans(/~~([\s\S]+?)~~/g, 'strike', () => 2, () => 2);
    addRegexSpans(/<s>([\s\S]+?)<\/s>/gi, 'strike', () => 3, () => 4);
  }

  addRegexSpans(
    /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g,
    'link',
    () => 1,
    (m) => 3 + m[2].length,
    (m) => m[2]
  );

  let pos = 0;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = pos;
    const lineEnd = pos + line.length;

    if (/^####\s+/.test(line)) {
      const pLen = line.match(/^####\s+/)![0].length;
      spans.push({ type: 'h4', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^###\s+/.test(line)) {
      const pLen = line.match(/^###\s+/)![0].length;
      spans.push({ type: 'h3', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^##\s+/.test(line)) {
      const pLen = line.match(/^##\s+/)![0].length;
      spans.push({ type: 'h2', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^#\s+/.test(line)) {
      const pLen = line.match(/^#\s+/)![0].length;
      spans.push({ type: 'h1', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    }

    if (/^\s*(?:(?:•|-|\*|\+)\s+)?\[[xX✓✔]\]\s+/.test(line)) {
      const pLen = line.match(/^\s*(?:(?:•|-|\*|\+)\s+)?\[[xX✓✔]\]\s+/)![0].length;
      spans.push({ type: 'checkbox_done', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^\s*(?:(?:•|-|\*|\+)\s+)?\[\s?\]\s+/.test(line)) {
      const pLen = line.match(/^\s*(?:(?:•|-|\*|\+)\s+)?\[\s?\]\s+/)![0].length;
      spans.push({ type: 'checkbox', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^(?:•|-|\*)\s+/.test(line)) {
      const pLen = line.match(/^(?:•|-|\*)\s+/)![0].length;
      spans.push({ type: 'bullet_list', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    } else if (/^\d+\.\s+/.test(line)) {
      const pLen = line.match(/^\d+\.\s+/)![0].length;
      spans.push({ type: 'number_list', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart + pLen, innerEnd: lineEnd });
    }

    if (/^\s*(?:---|===|\*\*\*)\s*$/.test(line)) {
      spans.push({ type: 'page_break', outerStart: lineStart, outerEnd: lineEnd, innerStart: lineStart, innerEnd: lineEnd });
    }

    if (line.startsWith('**>') || line.startsWith('>')) {
      const blockStart = lineStart;
      let j = i;
      let endPos = lineEnd;
      let isExpandable = line.startsWith('**>');
      while (j + 1 < lines.length && (lines[j + 1].startsWith('>') || lines[j + 1].startsWith('**>'))) {
        j++;
        endPos += 1 + lines[j].length;
      }
      if (lines[j].endsWith('||')) isExpandable = true;
      const firstPrefixLen = line.startsWith('**>') ? (line.startsWith('**> ') ? 4 : 3) : (line.startsWith('> ') ? 2 : 1);
      const closeSuffixLen = lines[j].endsWith('||') ? 2 : 0;
      spans.push({
        type: isExpandable ? 'expandable_quote' : 'quote',
        outerStart: blockStart,
        outerEnd: endPos,
        innerStart: blockStart + firstPrefixLen,
        innerEnd: endPos - closeSuffixLen
      });
      for (let k = i + 1; k <= j; k++) {
        pos += 1 + lines[k].length;
      }
      i = j;
    }

    pos += line.length + 1;
  }

  return spans;
}

export function findMatchingFormatSpan(
  text: string,
  selStart: number,
  selEnd: number,
  type: keyof ActiveSelectionStyles,
  isRich: boolean
): FormatSpan | null {
  const spans = getAllFormatSpans(text, isRich).filter((s) => s.type === type);
  for (const sp of spans) {
    if (selStart >= sp.outerStart && selEnd <= sp.outerEnd) {
      return sp;
    }
    if (sp.outerStart >= selStart && sp.outerEnd <= selEnd) {
      return sp;
    }
  }
  return null;
}

export function detectStylesAtRange(
  text: string,
  selStart: number,
  selEnd: number,
  isRich: boolean
): ActiveSelectionStyles {
  const styles: ActiveSelectionStyles = {};
  if (selStart === selEnd) return styles;
  const spans = getAllFormatSpans(text, isRich);
  for (const sp of spans) {
    const enclosesSelection = selStart >= sp.outerStart && selEnd <= sp.outerEnd;
    const exactWrappedInsideSelection = sp.outerStart >= selStart && sp.outerEnd <= selEnd;
    if (enclosesSelection || exactWrappedInsideSelection) {
      if (sp.type === 'link') {
        styles.link = sp.meta || 'url';
      } else {
        (styles as Record<string, boolean | string | undefined>)[sp.type] = true;
      }
    }
  }
  return styles;
}

export function getStyleDescription(styles: ActiveSelectionStyles, isRich: boolean): string {
  const labels: string[] = [];
  if (styles.h1) labels.push('Заголовок H1');
  if (styles.h2) labels.push('Заголовок H2');
  if (styles.h3) labels.push('Заголовок H3');
  if (styles.h4) labels.push('Заголовок H4');
  if (styles.bold) labels.push(isRich ? 'Жирный' : 'Жирный (*текст*)');
  if (styles.italic) labels.push('Курсив');
  if (styles.underline) labels.push('Подчеркнутый');
  if (styles.strike) labels.push('Зачеркнутый');
  if (styles.spoiler) labels.push('Спойлер');
  if (styles.code_block) labels.push('Блок кода');
  else if (styles.code) labels.push('Моноширинный код');
  if (styles.expandable_quote) labels.push('Сворачиваемая цитата');
  else if (styles.quote) labels.push('Цитата');
  if (styles.aside) labels.push('Выноска по центру');
  if (styles.details) labels.push('Скрытый блок');
  if (styles.sup) labels.push('Верхний индекс');
  if (styles.sub) labels.push('Нижний индекс');
  if (styles.bullet_list) labels.push('Маркированный список');
  if (styles.number_list) labels.push('Нумерованный список');
  if (styles.checkbox_done) labels.push('Задача выполнена');
  else if (styles.checkbox) labels.push('Чек-бокс');
  if (styles.link) labels.push('Ссылка');
  return labels.length > 0 ? labels.join(' + ') : 'Обычный текст';
}

export function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number; lineHeight: number } {
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  const properties = [
    'direction',
    'boxSizing',
    'width',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize'
  ] as const;

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.top = '0px';
  div.style.left = '-9999px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  for (const prop of properties) {
    div.style[prop as any] = style.getPropertyValue(
      prop.replace(/([A-Z])/g, '-$1').toLowerCase()
    );
  }

  div.textContent = textarea.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position, position + 1) || '.';
  div.appendChild(span);
  document.body.appendChild(div);

  const top = span.offsetTop - textarea.scrollTop;
  const left = span.offsetLeft - textarea.scrollLeft;
  const lineHeight = parseFloat(style.lineHeight) || 22;

  document.body.removeChild(div);
  return { top, left, lineHeight };
}
