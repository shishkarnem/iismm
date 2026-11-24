import {
  ParsedRichButton,
  extractTagAttr,
  parseTgButtonElement
} from '../post-editor/preview/RichButtonsAndMediaPreview';
import {
  ParsedRichBlock,
  V2Block,
  isTableDelimiterRow
} from './markdownTypesAndUtils';
import {
  extractClosedCodeFence,
  repairMalformedInlineHtmlTags
} from '../../utils/formatting/postTitleAndTagHelpers';

export function parseRichBlocks(text: string): ParsedRichBlock[] {
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: ParsedRichBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    if (trimmedLine.startsWith('<details') || trimmedLine.includes('<details')) {
      const detailsLines = [rawLine];
      i++;
      while (i < lines.length) {
        detailsLines.push(lines[i]);
        if (lines[i].includes('</details>')) {
          i++;
          break;
        }
        i++;
      }
      const fullDetailsText = detailsLines.join('\n');
      const summaryMatch = fullDetailsText.match(/<summary>(.*?)<\/summary>/i);
      const summary = summaryMatch ? summaryMatch[1] : 'Раскрыть подробности';
      const content = fullDetailsText
        .replace(/<details.*?>/gi, '')
        .replace(/<\/details>/gi, '')
        .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
        .trim();
      blocks.push({ type: 'details', summary, content });
      continue;
    }

    if (trimmedLine.startsWith('<blockquote') || trimmedLine.includes('<blockquote')) {
      const quoteLines = [rawLine];
      i++;
      while (i < lines.length) {
        quoteLines.push(lines[i]);
        if (lines[i].includes('</blockquote>')) {
          i++;
          break;
        }
        i++;
      }
      const fullQuoteText = quoteLines.join('\n');
      let citeAuthor = '';
      const citeMatch = fullQuoteText.match(/<cite>(.*?)<\/cite>/i);
      if (citeMatch) citeAuthor = citeMatch[1].trim();
      const cleanQuote = fullQuoteText
        .replace(/<\/?blockquote[^>]*>/gi, '')
        .replace(/<cite>[\s\S]*?<\/cite>/gi, '')
        .trim();
      blocks.push({ type: 'blockquote', content: cleanQuote, cite: citeAuthor });
      continue;
    }

    if (/^<tg-button-row\b/i.test(trimmedLine)) {
      const rowLines = [rawLine];
      if (!trimmedLine.toLowerCase().includes('</tg-button-row>')) {
        i++;
        while (i < lines.length) {
          rowLines.push(lines[i]);
          if (lines[i].toLowerCase().includes('</tg-button-row>')) {
            i++;
            break;
          }
          i++;
        }
      } else {
        i++;
      }
      const fullRow = rowLines.join('\n');
      const openM = fullRow.match(/<tg-button-row\b([^>]*)>/i);
      const align = extractTagAttr(openM?.[1] || '', 'align') || 'left';
      const buttons: ParsedRichButton[] = [];
      const btnRe = /<tg-button\b[^>]*>[\s\S]*?<\/tg-button>/gi;
      let bm: RegExpExecArray | null;
      while ((bm = btnRe.exec(fullRow)) !== null) {
        const parsed = parseTgButtonElement(bm[0]);
        if (parsed) buttons.push(parsed);
      }
      if (buttons.length > 0) {
        blocks.push({ type: 'button_row', align, buttons });
      }
      continue;
    }

    if (/^<figure>\s*<tg-document\b/i.test(trimmedLine) || /^<tg-document\b/i.test(trimmedLine)) {
      const isFig = /^<figure>/i.test(trimmedLine);
      const closeTok = isFig ? '</figure>' : '</tg-document>';
      const docLines = [rawLine];
      if (!trimmedLine.toLowerCase().includes(closeTok) && !/\/>$/.test(trimmedLine)) {
        i++;
        while (i < lines.length) {
          docLines.push(lines[i]);
          if (lines[i].toLowerCase().includes(closeTok)) {
            i++;
            break;
          }
          i++;
        }
      } else {
        i++;
      }
      const fullDoc = docLines.join('\n');
      const openM = fullDoc.match(/<tg-document\b([^>]*?)(?:\/>|>([\s\S]*?)<\/tg-document>|>)/i);
      const src = extractTagAttr(openM?.[1] || '', 'src');
      const figCapM = fullDoc.match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
      const caption = figCapM?.[1]?.trim() || extractTagAttr(openM?.[1] || '', 'caption') || (openM?.[2] || '').replace(/<[^>]+>/g, '').trim();
      if (src) {
        blocks.push({ type: 'document', url: src, caption });
      }
      continue;
    }

    if (/^<(video|audio)\b/i.test(trimmedLine)) {
      const tagKind = /^<video\b/i.test(trimmedLine) ? 'video' : 'audio';
      const closeTok = `</${tagKind}>`;
      const avLines = [rawLine];
      if (!trimmedLine.toLowerCase().includes(closeTok) && !/\/>$/.test(trimmedLine)) {
        i++;
        while (i < lines.length) {
          avLines.push(lines[i]);
          if (lines[i].toLowerCase().includes(closeTok)) {
            i++;
            break;
          }
          i++;
        }
      } else {
        i++;
      }
      const fullAv = avLines.join('\n');
      const openM = fullAv.match(new RegExp(`<${tagKind}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tagKind}>|>)`, 'i'));
      const attrs = openM?.[1] || '';
      const src = extractTagAttr(attrs, 'src');
      const caption = extractTagAttr(attrs, 'title') || extractTagAttr(attrs, 'caption') || (openM?.[2] || '').replace(/<[^>]+>/g, '').trim();
      const isVoice = tagKind === 'audio' && (/\bdata-voice=["']?true/i.test(attrs) || /\.ogg(\?|$)/i.test(src));
      if (src) {
        blocks.push({ type: tagKind, url: src, caption, isVoice });
      }
      continue;
    }

    if (trimmedLine.startsWith('<tg-collage') || trimmedLine.includes('<tg-collage')) {
      const collageLines = [rawLine];
      i++;
      while (i < lines.length) {
        collageLines.push(lines[i]);
        if (lines[i].includes('</tg-collage>')) {
          i++;
          break;
        }
        i++;
      }
      const collageText = collageLines.join('\n');
      const mediaUrls: string[] = [];
      for (const m of collageText.matchAll(/!\[(.*?)\]\((.*?)\)/g)) {
        if (m[2]?.trim()) mediaUrls.push(m[2].trim());
      }
      for (const m of collageText.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
        if (m[1]?.trim() && !mediaUrls.includes(m[1].trim())) mediaUrls.push(m[1].trim());
      }
      blocks.push({ type: 'collage', urls: mediaUrls });
      continue;
    }

    if (trimmedLine.startsWith('<tg-slideshow') || trimmedLine.includes('<tg-slideshow')) {
      const slideshowLines = [rawLine];
      i++;
      while (i < lines.length) {
        slideshowLines.push(lines[i]);
        if (lines[i].includes('</tg-slideshow>')) {
          i++;
          break;
        }
        i++;
      }
      const slideshowText = slideshowLines.join('\n');
      const mediaUrls: string[] = [];
      for (const m of slideshowText.matchAll(/!\[(.*?)\]\((.*?)\)/g)) {
        if (m[2]?.trim()) mediaUrls.push(m[2].trim());
      }
      for (const m of slideshowText.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
        if (m[1]?.trim() && !mediaUrls.includes(m[1].trim())) mediaUrls.push(m[1].trim());
      }
      blocks.push({ type: 'slideshow', urls: mediaUrls });
      continue;
    }

    if (trimmedLine.startsWith('```')) {
      const extracted = extractClosedCodeFence(lines, i);
      if (extracted) {
        blocks.push({ type: 'codeblock', code: extracted.code, lang: extracted.lang });
        if (extracted.trailingLine) {
          lines[extracted.nextIndex - 1] = extracted.trailingLine;
          i = extracted.nextIndex - 1;
        } else {
          i = extracted.nextIndex;
        }
        continue;
      }
    }

    if (trimmedLine.startsWith('$$')) {
      if (trimmedLine.endsWith('$$') && trimmedLine.length > 2) {
        const mathContent = trimmedLine.slice(2, -2).trim();
        blocks.push({ type: 'formula_block', formula: mathContent });
        i++;
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i].trim().startsWith('$$')) {
          i++;
          break;
        }
        mathLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'formula_block', formula: mathLines.join('\n').trim() });
      continue;
    }

    const imgMatch = trimmedLine.match(/^!\[(.*?)\]\s*\((https?:\/\/[^\s\)]+)(?:\s+"(.*?)")?\)$/) ||
                     trimmedLine.match(/^!\[(.*?)\]\s*\(([^\)]+)\)$/) ||
                     trimmedLine.match(/^\[[\u200B\s]*\]\s*\((https?:\/\/[^\s\)]+)\)$/);
    if (imgMatch) {
      const url = imgMatch[2] || (imgMatch[1]?.startsWith('http') ? imgMatch[1] : '');
      const alt = imgMatch[2] ? (imgMatch[1] || '') : '';
      if (url && !url.startsWith('tg://emoji')) {
        blocks.push({ type: 'image', url, alt, title: imgMatch[3] });
        i++;
        continue;
      }
    }

    if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('# #')) {
      blocks.push({ type: 'h1', content: trimmedLine.slice(2).trim() });
      i++;
      continue;
    }
    if (trimmedLine.startsWith('## ')) {
      blocks.push({ type: 'h2', content: trimmedLine.slice(3).trim() });
      i++;
      continue;
    }
    if (trimmedLine.startsWith('### ')) {
      blocks.push({ type: 'h3', content: trimmedLine.slice(4).trim() });
      i++;
      continue;
    }
    if (trimmedLine.startsWith('#### ')) {
      blocks.push({ type: 'h4', content: trimmedLine.slice(5).trim() });
      i++;
      continue;
    }

    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    const hasTablePipes = trimmedLine.includes('|') && !trimmedLine.startsWith('||') && !trimmedLine.endsWith('||');
    const isTableStart = hasTablePipes && isTableDelimiterRow(nextLine);

    if (isTableStart) {
      const tableLines: string[] = [rawLine, nextLine];
      i += 2;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (nextTrimmed && (nextTrimmed.startsWith('|') || nextTrimmed.includes('|')) && !nextTrimmed.startsWith('#')) {
          tableLines.push(lines[i]);
          i++;
        } else {
          break;
        }
      }

      const splitCells = (line: string): string[] => {
        let t = line.trim();
        if (t.startsWith('|') && !t.startsWith('||')) t = t.slice(1);
        if (t.endsWith('|') && !t.endsWith('||')) t = t.slice(0, -1);
        return t.split('|').map(c => c.trim());
      };

      const rawRows = tableLines.map(splitCells).filter(cells => cells.length > 0);
      if (rawRows.length >= 2) {
        const headers = rawRows[0];
        const secondRow = rawRows[1];
        let alignments: ('left' | 'center' | 'right')[] = secondRow.map(c => {
          if (c.startsWith(':') && c.endsWith(':')) return 'center';
          if (c.endsWith(':')) return 'right';
          return 'left';
        });
        while (alignments.length < headers.length) alignments.push('left');

        const dataRows = rawRows.slice(2).map(r => {
          const rowCopy = [...r];
          while (rowCopy.length < headers.length) rowCopy.push('');
          return rowCopy.slice(0, headers.length);
        });

        blocks.push({
          type: 'table',
          headers,
          alignments: alignments.slice(0, headers.length),
          rows: dataRows
        });
        continue;
      }
    }

    if (trimmedLine.startsWith('>')) {
      const quoteLines = [trimmedLine.replace(/^>\s?/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const rawQuote = quoteLines.join('\n');
      const isExpandable = rawQuote.endsWith('||') || trimmedLine.startsWith('**>');
      const cleanQuote = isExpandable ? rawQuote.replace(/\|\|$/, '').replace(/^\*\*>\s?/, '') : rawQuote;
      blocks.push({ type: 'blockquote', content: cleanQuote, expandable: isExpandable });
      continue;
    }

    const isListItem = trimmedLine.startsWith('- [') || trimmedLine.startsWith('* [') ||
                       trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') ||
                       /^\d+\.\s/.test(trimmedLine);
    if (isListItem) {
      const listItems: { kind: 'task' | 'task-done' | 'bullet' | 'ordered'; num?: string; text: string }[] = [];
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        if (currentTrim.startsWith('- [ ] ') || currentTrim.startsWith('* [ ] ')) {
          listItems.push({ kind: 'task', text: currentTrim.slice(6) });
          i++;
        } else if (currentTrim.startsWith('- [x] ') || currentTrim.startsWith('* [x] ') ||
                   currentTrim.startsWith('- [X] ') || currentTrim.startsWith('* [X] ')) {
          listItems.push({ kind: 'task-done', text: currentTrim.slice(6) });
          i++;
        } else if (currentTrim.startsWith('- ') || currentTrim.startsWith('* ')) {
          listItems.push({ kind: 'bullet', text: currentTrim.slice(2) });
          i++;
        } else {
          const numMatch = currentTrim.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            listItems.push({ kind: 'ordered', num: numMatch[1], text: numMatch[2] });
            i++;
          } else {
            break;
          }
        }
      }
      if (listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems });
        continue;
      }
    }

    const paragraphLines = [rawLine];
    i++;
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (!nextTrimmed) break;
      if (nextTrimmed.startsWith('![') ||
          nextTrimmed.startsWith('![](') ||
          /^\[[\u200B\s]*\]\(https?:/.test(nextTrimmed) ||
          nextTrimmed.startsWith('#') ||
          nextTrimmed.startsWith('<details') ||
          nextTrimmed.startsWith('<blockquote') ||
          nextTrimmed.startsWith('<tg-collage') ||
          nextTrimmed.startsWith('<tg-slideshow') ||
          nextTrimmed.startsWith('<tg-button-row') ||
          nextTrimmed.startsWith('<tg-document') ||
          nextTrimmed.startsWith('<figure') ||
          nextTrimmed.startsWith('<video') ||
          nextTrimmed.startsWith('<audio') ||
          nextTrimmed.startsWith('```') ||
          nextTrimmed.startsWith('>') ||
          nextTrimmed.startsWith('- ') ||
          nextTrimmed.startsWith('* ') ||
          nextTrimmed.startsWith('- [') ||
          /^\d+\.\s/.test(nextTrimmed) ||
          (i + 1 < lines.length && isTableDelimiterRow(lines[i + 1]) && nextTrimmed.includes('|') && !nextTrimmed.startsWith('||'))) {
        break;
      }
      paragraphLines.push(lines[i]);
      i++;
    }

    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

export function parseV2Blocks(text: string): V2Block[] {
  const repairedText = repairMalformedInlineHtmlTags((text || '').replace(/\r\n/g, '\n'));
  const lines = repairedText.split('\n');
  const blocks: V2Block[] = [];
  let i = 0;

  const hasUnclosedInlineHtml = (chunk: string): boolean => {
    const tagRe = /<(\/?)(b|strong|i|em|u|ins|s|del|strike|tg-spoiler|a)(?:\s[^>]*)?>/gi;
    const stack: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(chunk)) !== null) {
      const tag = m[2].toLowerCase();
      if (m[1] === '/') {
        const idx = stack.lastIndexOf(tag);
        if (idx !== -1) stack.splice(idx, 1);
      } else {
        stack.push(tag);
      }
    }
    return stack.length > 0;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const extracted = extractClosedCodeFence(lines, i);
      if (extracted) {
        blocks.push({ type: 'codeblock', code: extracted.code, lang: extracted.lang });
        if (extracted.trailingLine) {
          lines[extracted.nextIndex - 1] = extracted.trailingLine;
          i = extracted.nextIndex - 1;
        } else {
          i = extracted.nextIndex;
        }
        continue;
      }
    }

    if (/^<blockquote\b/i.test(trimmed)) {
      const quoteLines = [rawLine];
      let isExpandable = /expandable/i.test(trimmed);
      if (!/<\/blockquote\s*>/i.test(trimmed)) {
        i++;
        while (i < lines.length) {
          quoteLines.push(lines[i]);
          if (/<\/blockquote\s*>/i.test(lines[i])) {
            i++;
            break;
          }
          i++;
        }
      } else {
        i++;
      }
      const cleanQuote = quoteLines
        .join('\n')
        .replace(/<\/?blockquote[^>]*>/gi, '')
        .trim();
      blocks.push({
        type: isExpandable ? 'expandable_quote' : 'quote',
        content: cleanQuote,
      });
      continue;
    }

    const imgMatch = trimmed.match(/^!\[(.*?)\]\s*\((https?:\/\/[^\s\)]+)(?:\s+"(.*?)")?\)$/) ||
                     trimmed.match(/^!\[(.*?)\]\s*\(([^\)]+)\)$/) ||
                     trimmed.match(/^\[[\u200B\s]*\]\s*\((https?:\/\/[^\s\)]+)\)$/);
    if (imgMatch) {
      const url = imgMatch[2] || (imgMatch[1]?.startsWith('http') ? imgMatch[1] : '');
      const alt = imgMatch[2] ? (imgMatch[1] || '') : '';
      if (url && !url.startsWith('tg://emoji')) {
        blocks.push({ type: 'image', url, alt });
        i++;
        continue;
      }
    }

    if (trimmed.startsWith('>') || trimmed.startsWith('**>')) {
      const quoteLines: string[] = [];
      let isExpandable = false;
      while (i < lines.length && (lines[i].trim().startsWith('>') || lines[i].trim().startsWith('**>'))) {
        const qTrim = lines[i].trim();
        if (qTrim.endsWith('||') || qTrim.startsWith('**>') || qTrim.includes('||')) {
          isExpandable = true;
        }
        let clean = qTrim.replace(/^>\s?/, '').replace(/^\*\*>\s?/, '');
        if (clean.endsWith('||')) {
          clean = clean.slice(0, -2);
        }
        quoteLines.push(clean);
        i++;
      }
      blocks.push({
        type: isExpandable ? 'expandable_quote' : 'quote',
        content: quoteLines.join('\n')
      });
      continue;
    }

    // Если строка содержит незакрытый многострочный HTML-тег (например <b>Строка 1\nСтрока 2</b>),
    // объединяем смежные непустые строки до закрытия тега.
    let combinedLine = rawLine;
    while (
      hasUnclosedInlineHtml(combinedLine) &&
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !lines[i + 1].trim().startsWith('```') &&
      !lines[i + 1].trim().startsWith('>') &&
      !lines[i + 1].trim().startsWith('**>') &&
      !/^<blockquote\b/i.test(lines[i + 1].trim())
    ) {
      i++;
      combinedLine += '\n' + lines[i];
    }

    blocks.push({ type: 'line', content: combinedLine });
    i++;
  }

  return blocks;
}
