import { ParsedRichButton, extractTagAttr, parseTgButtonElement } from '../preview/RichButtonsAndMediaPreview';
import { extractClosedCodeFence } from '../../../utils/formatting/postTitleAndTagHelpers';

export function isTableDelimiterRow(row: string): boolean {
  const trimmed = row.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export type ParsedRichBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'h4'; text: string; slug: string }
  | { type: 'hr' }
  | { type: 'code'; lang: string; content: string }
  | { type: 'math'; formula: string }
  | { type: 'quote'; expandable: boolean; text: string; cite?: string }
  | { type: 'aside'; text: string }
  | { type: 'details'; summary: string; body: string }
  | { type: 'button_row'; align: string; buttons: ParsedRichButton[] }
  | { type: 'collage' | 'slideshow'; items: { caption: string; url: string }[] }
  | { type: 'media'; mediaKind: 'image' | 'video' | 'audio' | 'voice' | 'document'; caption: string; url: string }
  | { type: 'table'; headers: string[]; alignments: ('left' | 'center' | 'right')[]; rows: string[][] }
  | { type: 'checklist'; items: { checked: boolean; text: string }[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'footnote_def'; id: string; text: string }
  | { type: 'anchor'; name: string }
  | { type: 'paragraph'; text: string };

function makeHeadingSlug(raw: string): string {
  return raw
    .replace(/[*_~`[\]()]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function parseButtonsInsideRow(rawRowHtml: string): ParsedRichButton[] {
  const buttons: ParsedRichButton[] = [];
  const btnRe = /<tg-button\b[^>]*>[\s\S]*?<\/tg-button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(rawRowHtml)) !== null) {
    const parsed = parseTgButtonElement(m[0]);
    if (parsed) buttons.push(parsed);
  }
  return buttons;
}

export function parseRichBlocks(rawText: string): ParsedRichBlock[] {
  const blocks: ParsedRichBlock[] = [];
  const normalized = (rawText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Anchor tag standalone line
    const standaloneAnchor = trimmed.match(/^<a\s+name="([^"]+)"\s*><\/a>$/i);
    if (standaloneAnchor) {
      blocks.push({ type: 'anchor', name: standaloneAnchor[1] });
      i++;
      continue;
    }

    // <tg-button-row ...>...</tg-button-row>
    if (/^<tg-button-row\b/i.test(trimmed)) {
      const rowLines: string[] = [line];
      while (i + 1 < lines.length && !rowLines[rowLines.length - 1].toLowerCase().includes('</tg-button-row>')) {
        i++;
        rowLines.push(lines[i]);
      }
      i++;
      const fullRow = rowLines.join('\n');
      const openTagMatch = fullRow.match(/<tg-button-row\b([^>]*)>/i);
      const align = extractTagAttr(openTagMatch?.[1] || '', 'align') || 'left';
      const buttons = parseButtonsInsideRow(fullRow);
      if (buttons.length > 0) {
        blocks.push({ type: 'button_row', align, buttons });
      }
      continue;
    }

    // <figure><tg-document ...><figcaption>...</figcaption></figure>
    if (/^<figure>\s*<tg-document\b/i.test(trimmed)) {
      const figLines: string[] = [line];
      while (i + 1 < lines.length && !figLines[figLines.length - 1].toLowerCase().includes('</figure>')) {
        i++;
        figLines.push(lines[i]);
      }
      i++;
      const fullFig = figLines.join('\n');
      const docMatch = fullFig.match(/<tg-document\b([^>]*)>/i);
      const src = extractTagAttr(docMatch?.[1] || '', 'src');
      const capMatch = fullFig.match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
      if (src) {
        blocks.push({
          type: 'media',
          mediaKind: 'document',
          caption: (capMatch?.[1] || '').trim(),
          url: src
        });
      }
      continue;
    }

    // Standalone <tg-document ... /> or <tg-document ...>...</tg-document>
    if (/^<tg-document\b/i.test(trimmed)) {
      const docLines: string[] = [line];
      if (!/\/>$|><\/tg-document>$|<\/tg-document>/i.test(trimmed)) {
        while (i + 1 < lines.length && !docLines[docLines.length - 1].toLowerCase().includes('</tg-document>')) {
          i++;
          docLines.push(lines[i]);
        }
      }
      i++;
      const fullDoc = docLines.join('\n');
      const openM = fullDoc.match(/<tg-document\b([^>]*?)(?:\/>|>([\s\S]*?)<\/tg-document>|>)/i);
      const attrs = openM?.[1] || '';
      const src = extractTagAttr(attrs, 'src');
      const caption = extractTagAttr(attrs, 'caption') || (openM?.[2] || '').replace(/<[^>]+>/g, '').trim();
      if (src) {
        blocks.push({ type: 'media', mediaKind: 'document', caption, url: src });
      }
      continue;
    }

    // Standalone <video ...>...</video> or <audio ...>...</audio>
    if (/^<(video|audio)\b/i.test(trimmed)) {
      const tagKind = /^<video\b/i.test(trimmed) ? 'video' : 'audio';
      const avLines: string[] = [line];
      const closeTag = `</${tagKind}>`;
      if (!trimmed.toLowerCase().includes(closeTag) && !/\/>$/.test(trimmed)) {
        while (i + 1 < lines.length && !avLines[avLines.length - 1].toLowerCase().includes(closeTag)) {
          i++;
          avLines.push(lines[i]);
        }
      }
      i++;
      const fullAv = avLines.join('\n');
      const openM = fullAv.match(new RegExp(`<${tagKind}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tagKind}>|>)`, 'i'));
      const attrs = openM?.[1] || '';
      const src = extractTagAttr(attrs, 'src');
      const caption =
        extractTagAttr(attrs, 'title') ||
        extractTagAttr(attrs, 'caption') ||
        (openM?.[2] || '').replace(/<[^>]+>/g, '').trim();
      const isVoice = tagKind === 'audio' && (/\bdata-voice=["']?true/i.test(attrs) || /\.ogg(\?|$)/i.test(src));
      if (src) {
        blocks.push({
          type: 'media',
          mediaKind: isVoice ? 'voice' : tagKind,
          caption,
          url: src
        });
      }
      continue;
    }

    // Code block ```lang
    if (trimmed.startsWith('```')) {
      const extracted = extractClosedCodeFence(lines, i);
      if (extracted) {
        blocks.push({ type: 'code', lang: extracted.lang, content: extracted.code });
        if (extracted.trailingLine) {
          lines[extracted.nextIndex - 1] = extracted.trailingLine;
          i = extracted.nextIndex - 1;
        } else {
          i = extracted.nextIndex;
        }
        continue;
      }
    }

    // Math block $$...$$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        blocks.push({ type: 'math', formula: trimmed.slice(2, -2).trim() });
        i++;
        continue;
      }
      const mathLines: string[] = [trimmed.slice(2)];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i].trim().slice(0, -2));
        i++;
      }
      blocks.push({ type: 'math', formula: mathLines.join('\n').trim() });
      continue;
    }

    // Stray closing or empty collage/slideshow tags — never render raw tag text
    if (/^<\/(?:tg-)?(?:collage|slideshow|carousel|button-row)\b[^>]*>$/i.test(trimmed)) {
      i++;
      continue;
    }

    // Collage / Slideshow <tg-collage>, <collage>, <tg-slideshow>, <slideshow>, <tg-carousel>, <carousel>
    const mediaGroupOpen = trimmed.match(/^<((?:tg-)?(?:collage|slideshow|carousel))\b[^>]*>/i);
    if (mediaGroupOpen) {
      const rawTagName = mediaGroupOpen[1].toLowerCase();
      const baseKind: 'collage' | 'slideshow' = rawTagName.includes('collage') ? 'collage' : 'slideshow';
      const closeRegex = new RegExp(`</(?:tg-)?(?:collage|slideshow|carousel)\\b[^>]*>`, 'i');
      const stripTagsRegex = /<\/?(?:tg-)?(?:collage|slideshow|carousel)\b[^>]*>/gi;

      const rawInner: string[] = [];
      if (closeRegex.test(trimmed)) {
        rawInner.push(trimmed.replace(stripTagsRegex, ''));
        i++;
      } else {
        const afterOpen = trimmed.replace(stripTagsRegex, '').trim();
        if (afterOpen) rawInner.push(afterOpen);
        i++;
        while (i < lines.length && !closeRegex.test(lines[i])) {
          rawInner.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const beforeClose = lines[i].replace(stripTagsRegex, '').trim();
          if (beforeClose) rawInner.push(beforeClose);
          i++;
        }
      }

      const items: { caption: string; url: string }[] = [];
      const seenUrls = new Set<string>();
      for (const rawLine of rawInner) {
        const l = rawLine.trim();
        if (!l) continue;

        let matchedOnLine = false;
        const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let m: RegExpExecArray | null;
        while ((m = mdImgRegex.exec(l)) !== null) {
          const url = m[2].trim();
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            items.push({ caption: (m[1] || '').trim(), url });
          }
          matchedOnLine = true;
        }

        const htmlImgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
        while ((m = htmlImgRegex.exec(l)) !== null) {
          const url = m[1].trim();
          const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            items.push({ caption: (altMatch?.[1] || '').trim(), url });
          }
          matchedOnLine = true;
        }

        const htmlVideoRegex = /<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>(?:[\s\S]*?<\/video>)?/gi;
        while ((m = htmlVideoRegex.exec(l)) !== null) {
          const url = m[1].trim();
          const capMatch = m[0].match(/\b(?:title|caption|alt)=["']([^"']*)["']/i);
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            items.push({ caption: (capMatch?.[1] || '').trim(), url });
          }
          matchedOnLine = true;
        }

        if (!matchedOnLine) {
          const bareUrlRegex = /(https?:\/\/[^\s<>")\]]+|\/(?:file|uploads)\/[^\s<>")\]]+)/g;
          while ((m = bareUrlRegex.exec(l)) !== null) {
            const url = m[1].replace(/[,;]+$/, '').trim();
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              items.push({ caption: '', url });
            }
          }
        }
      }

      if (items.length > 0) {
        blocks.push({ type: baseKind, items });
      }
      continue;
    }

    // Details <details><summary>...</summary>...</details>
    if (/^<details>/i.test(trimmed)) {
      const detLines: string[] = [line];
      while (i + 1 < lines.length && !detLines[detLines.length - 1].toLowerCase().includes('</details>')) {
        i++;
        detLines.push(lines[i]);
      }
      i++;
      const fullDetails = detLines.join('\n');
      const sumMatch = fullDetails.match(/<summary>([\s\S]*?)<\/summary>/i);
      const summary = sumMatch ? sumMatch[1].trim() : 'Подробнее';
      const body = fullDetails
        .replace(/<details>/i, '')
        .replace(/<\/details>/i, '')
        .replace(/<summary>[\s\S]*?<\/summary>/i, '')
        .trim();
      blocks.push({ type: 'details', summary, body });
      continue;
    }

    // Aside <aside>...</aside>
    if (/^<aside>/i.test(trimmed)) {
      const asideLines: string[] = [line];
      while (i + 1 < lines.length && !asideLines[asideLines.length - 1].toLowerCase().includes('</aside>')) {
        i++;
        asideLines.push(lines[i]);
      }
      i++;
      const text = asideLines.join('\n').replace(/<\/?aside>/gi, '').trim();
      blocks.push({ type: 'aside', text });
      continue;
    }

    // Blockquote HTML <blockquote>...<cite>...</cite></blockquote>
    if (/^<blockquote/i.test(trimmed)) {
      const bqLines: string[] = [line];
      while (i + 1 < lines.length && !bqLines[bqLines.length - 1].toLowerCase().includes('</blockquote>')) {
        i++;
        bqLines.push(lines[i]);
      }
      i++;
      const fullBq = bqLines.join('\n');
      const expandable = /expandable/i.test(fullBq);
      const citeMatch = fullBq.match(/<cite>([\s\S]*?)<\/cite>/i);
      const cite = citeMatch ? citeMatch[1].trim() : undefined;
      const body = fullBq
        .replace(/<blockquote[^>]*>/i, '')
        .replace(/<\/blockquote>/i, '')
        .replace(/<cite>[\s\S]*?<\/cite>/i, '')
        .trim();
      blocks.push({ type: 'quote', expandable, text: body, cite });
      continue;
    }

    // Strip pure HTML <table> wrappers if they wrap Markdown table, or leave text intact
    if (/^<\/?table\b[^>]*>$/i.test(trimmed)) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(?:---|===|\*\*\*)$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings H1..H4
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const lvl = hMatch[1].length as 1 | 2 | 3 | 4;
      const titleText = hMatch[2].trim();
      blocks.push({
        type: `h${lvl}` as 'h1' | 'h2' | 'h3' | 'h4',
        text: titleText,
        slug: makeHeadingSlug(titleText)
      });
      i++;
      continue;
    }

    // Standalone Markdown media ![caption](url)
    const mediaMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (mediaMatch) {
      const caption = mediaMatch[1] || '';
      const url = mediaMatch[2].trim();
      const lower = url.toLowerCase();
      const mediaKind: 'image' | 'video' | 'audio' | 'voice' | 'document' =
        /\.(mp4|webm|mov)(\?.*)?$/.test(lower) || lower.startsWith('tg://video')
          ? 'video'
          : /\.ogg(\?.*)?$/.test(lower) || lower.startsWith('tg://voice')
          ? 'voice'
          : /\.(mp3|wav|m4a)(\?.*)?$/.test(lower) || lower.startsWith('tg://audio')
          ? 'audio'
          : /\.(pdf|docx?|xlsx?|csv|zip|rar|txt)(\?.*)?$/.test(lower) || lower.startsWith('tg://document')
          ? 'document'
          : 'image';
      blocks.push({ type: 'media', mediaKind, caption, url });
      i++;
      continue;
    }

    // Markdown table
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && isTableDelimiterRow(lines[i + 1])) {
      const headers = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      const delimCells = lines[i + 1]
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      const alignments: ('left' | 'center' | 'right')[] = delimCells.map((c) => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        rows.push(rowCells);
        i++;
      }
      blocks.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    // Markdown quote > or **>
    if (trimmed.startsWith('>') || trimmed.startsWith('**>')) {
      const qLines: string[] = [];
      let expandable = trimmed.startsWith('**>');
      while (i < lines.length && (lines[i].trim().startsWith('>') || lines[i].trim().startsWith('**>'))) {
        let cur = lines[i].trim();
        if (cur.startsWith('**>')) {
          expandable = true;
          cur = cur.slice(3).trimStart();
        } else if (cur.startsWith('>')) {
          cur = cur.slice(1).trimStart();
        }
        if (cur.endsWith('||')) {
          expandable = true;
          cur = cur.slice(0, -2);
        }
        qLines.push(cur);
        i++;
      }
      blocks.push({ type: 'quote', expandable, text: qLines.join('\n') });
      continue;
    }

    // Checklist: - [ ] / - [x] / * [x] / • [ ] / [ ] / [x]
    const checklistRegex = /^(?:(?:•|-|\*|\+)\s+)?\[([ xX✓✔]?)\]\s+(.*)$/;
    if (checklistRegex.test(trimmed)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length && checklistRegex.test(lines[i].trim())) {
        const m = lines[i].trim().match(checklistRegex)!;
        const mark = (m[1] || '').trim().toLowerCase();
        items.push({
          checked: mark === 'x' || mark === '✓' || mark === '✔',
          text: m[2]
        });
        i++;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // Bullet list
    if (/^(?:•|-|\*)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        /^(?:•|-|\*)\s+/.test(lines[i].trim()) &&
        !checklistRegex.test(lines[i].trim())
      ) {
        items.push(lines[i].trim().replace(/^(?:•|-|\*)\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Footnote definition [^1]: text
    const fnMatch = trimmed.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (fnMatch) {
      blocks.push({ type: 'footnote_def', id: fnMatch[1], text: fnMatch[2] });
      i++;
      continue;
    }

    // Paragraph (gather consecutive plain lines)
    const pLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('**>') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^(?:---|===|\*\*\*)$/.test(lines[i].trim()) &&
      !/^<\/?(?:tg-)?(?:collage|slideshow|carousel|details|aside|blockquote|button-row|document|figure|video|audio|table)\b/i.test(lines[i].trim()) &&
      !/^!\[([^\]]*)\]\(([^)]+)\)$/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('|') && i + 1 < lines.length && isTableDelimiterRow(lines[i + 1])) &&
      !checklistRegex.test(lines[i].trim()) &&
      !/^(?:•|-|\*)\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^\[\^([^\]]+)\]:\s+/.test(lines[i].trim())
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: pLines.join('\n') });
  }

  return blocks;
}
