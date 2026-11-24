import dns from 'dns';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import os from 'os';
import util from 'util';
import { execFile } from 'child_process';
import { DB, DayRequest } from './db';
import { getBotTokenFromPg, getPgDB } from './db/postgres';
import { fixUtf8Filename } from './db/filesTable';
import { InlineButton } from '../types';
import { sendV2TelegramMessage } from './telegramV2';
import { sendRichTelegramMessage, prepareRichMarkdownText } from './telegramRich';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { isVideoMediaUrl } from '../utils/urlUtils';
import {
  buildTelegramBaseCandidates,
  normalizeTelegramGatewayUrl
} from './telegram/apiEndpointFallback';
import { repairMalformedInlineHtmlTags } from '../utils/formatting/postTitleAndTagHelpers';
import {
  acquireContentChannelGuard,
  acquireEntityPublishSlot,
  canonicalizeTelegramTarget,
  finalizePublishDedup,
  isDefiniteClientFailure
} from './telegram/publishDedupGuard';
import {
  PushCategoryKey,
  shouldDeliverNotificationChannel
} from './push/pushStore';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const execFileAsync = util.promisify(execFile);

// Re-export specific sending handlers for external callers
export { sendV2TelegramMessage, sendRichTelegramMessage, prepareRichMarkdownText };

// Helper to auto-crop video to square 1:1, max 60s, H.264/AAC for Telegram Video Note
export async function convertVideoToTelegramVideoNote(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inputPath = path.join(tmpDir, `vn_in_${id}.bin`);
  const outputPath = path.join(tmpDir, `vn_out_${id}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=480:480:flags=lanczos",
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-movflags', '+faststart',
      '-t', '60',
      outputPath
    ], { timeout: 30000 });

    if (fs.existsSync(outputPath)) {
      const outBuffer = await fs.promises.readFile(outputPath);
      return outBuffer;
    }
  } catch (err: any) {
    console.warn('[convertVideoToTelegramVideoNote] ffmpeg conversion warning, using raw video note:', err.message);
  } finally {
    try { if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath); } catch (e) {}
    try { if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath); } catch (e) {}
  }
  return inputBuffer;
}

// Helper to convert audio to OGG Opus for Telegram Voice Message
export async function convertAudioToTelegramVoice(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inputPath = path.join(tmpDir, `voice_in_${id}.bin`);
  const outputPath = path.join(tmpDir, `voice_out_${id}.ogg`);

  try {
    await fs.promises.writeFile(inputPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-vbr', 'on',
      outputPath
    ], { timeout: 30000 });

    if (fs.existsSync(outputPath)) {
      const outBuffer = await fs.promises.readFile(outputPath);
      return outBuffer;
    }
  } catch (err: any) {
    console.warn('[convertAudioToTelegramVoice] ffmpeg conversion warning, using raw audio:', err.message);
  } finally {
    try { if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath); } catch (e) {}
    try { if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath); } catch (e) {}
  }
  return inputBuffer;
}

export interface TelegramSendResponse {
  ok: boolean;
  messageId?: string;
  channel?: string;
  error?: string;
  simulated?: boolean;
  fallbackNotice?: string;
}

// Helper to strip HTML tags if fallback to plain text is needed
export function stripHTML(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Helper to format Markdown tables into aligned monospace blocks for Telegram
function formatMarkdownTableForTelegram(tableStr: string, isInsideBlockquote: boolean = false): string {
  const rawLines = tableStr.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const dataLines = rawLines.filter(l => !l.match(/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/) && !l.match(/^:?-+:?(\s*\|\s*:?-+:?)+$/));
  if (dataLines.length === 0) return '';

  const rows: string[][] = dataLines.map(line => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|') && !trimmed.startsWith('||')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|') && !trimmed.endsWith('||')) trimmed = trimmed.slice(0, -1);
    return trimmed.split('|').map(c => c.trim());
  });

  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths = new Array(colCount).fill(0);

  rows.forEach(r => {
    r.forEach((c, idx) => {
      if (c.length > colWidths[idx]) colWidths[idx] = Math.min(c.length, 30);
    });
  });

  const formattedRows = rows.map((r) => {
    return r.map((cell, idx) => {
      const w = colWidths[idx] || 8;
      return cell.padEnd(w, ' ');
    }).join(' | ');
  });

  if (isInsideBlockquote) {
    return formattedRows.map(r => `<code>${r}</code>`).join('\n');
  }

  const formattedText = formattedRows.join('\n');
  return `<pre>${formattedText}</pre>`;
}

// Convert rich/v2 markdown text to flawless Telegram HTML
export function convertToTelegramHTML(text: string, format: string = 'v2'): string {
  if (!text) return '';

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];
  const htmlProtected: string[] = [];

  let str = text;

  // 0a. Checkbox / Task lists (- [x] and - [ ]). Never use green colors or emojis per design rules.
  str = str.replace(/^([ \t]*)[-*+]\s+\[[xX]\]\s+/gm, '$1☑️ ');
  str = str.replace(/^([ \t]*)[-*+]\s+\[\s*\]\s+/gm, '$1◻️ ');
  str = str.replace(/^([ \t]*\d+\.)\s+\[[xX]\]\s+/gm, '$1 ☑️ ');
  str = str.replace(/^([ \t]*\d+\.)\s+\[\s*\]\s+/gm, '$1 ◻️ ');

  // 0b. Page breaks / horizontal dividers (---, ***, ___)
  str = str.replace(/^(?:[ \t]*[-*_]){3,}[ \t]*$/gm, '\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n');

  // 0c. Repair hybrid fences opened with ```lang and mistakenly closed with </code></pre>, </code>, or </pre>
  str = str.replace(/(```[a-zA-Z0-9_-]*\n(?:(?!```)[\s\S])*?)(?:<\/code>\s*<\/pre>|<\/code>|<\/pre>)/gi, (_, inner) => {
    return `${String(inner).trimEnd()}\n\`\`\``;
  });

  // 1. Triple backtick code blocks: ```lang\ncode\n``` or ```code```
  str = str.replace(/```(?:([a-zA-Z0-9_-]+)[ \t]*\n)?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escapedCode = String(code || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const tag = lang ? `<pre><code class="language-${lang}">${escapedCode}</code></pre>` : `<pre>${escapedCode}</pre>`;
    codeBlocks.push(tag);
    return `\uE000CB${idx}\uE000`;
  });

  // 2. Single backtick inline code: `code`
  str = str.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    inlineCodes.push(`<code>${escapedCode}</code>`);
    return `\uE000IC${idx}\uE000`;
  });

  // 2b. Convert <details><summary>...</summary>...</details> to Telegram expandable blockquote
  str = str.replace(/<details(?:\s+[^>]*)?>\s*<summary(?:\s+[^>]*)?>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi, (_, summary, content) => {
    const cleanSummary = (summary || 'Подробнее').trim();
    let cleanContent = (content || '').trim();
    // Format any markdown table inside the details block so it doesn't use forbidden <pre> inside <blockquote>
    cleanContent = cleanContent.replace(/((?:(?:^|\n)\|[^\n]+\|[ \t]*){2,})/g, (tableMatch) => {
      return '\n' + formatMarkdownTableForTelegram(tableMatch, true) + '\n';
    });
    return `\n<blockquote expandable><b>${cleanSummary}</b>\n\n${cleanContent}</blockquote>\n`;
  });

  // 2b.2 Convert <details>...</details> without summary
  str = str.replace(/<details(?:\s+[^>]*)?>([\s\S]*?)<\/details>/gi, (_, content) => {
    let cleanContent = (content || '').trim();
    cleanContent = cleanContent.replace(/((?:(?:^|\n)\|[^\n]+\|[ \t]*){2,})/g, (tableMatch) => {
      return '\n' + formatMarkdownTableForTelegram(tableMatch, true) + '\n';
    });
    return `\n<blockquote expandable>${cleanContent}</blockquote>\n`;
  });

  // 2c. Convert <tg-time...>Label</tg-time> to bold readable time for Telegram
  str = str.replace(/<tg-time(?:\s+[^>]*)?>([\s\S]*?)<\/tg-time>/gi, (_, timeLabel) => {
    const label = (timeLabel || '').trim();
    return label ? `<b>${label}</b>` : '';
  });

  // 2d. Convert <cite>Author</cite> to Telegram compatible <i>— Author</i>
  str = str.replace(/<cite(?:\s+[^>]*)?>([\s\S]*?)<\/cite>/gi, '\n— <i>$1</i>');

  // 2d.2 Handle Bot API 10.3/10.4 <tg-button-row>, <tg-button>, <tg-document>, <table compact> for V2/HTML fallback
  str = str.replace(/<tg-button-row\b[^>]*>([\s\S]*?)<\/tg-button-row>/gi, (_, inner) => {
    const links: string[] = [];
    const btnRe = /<tg-button\b([^>]*)>([\s\S]*?)<\/tg-button>/gi;
    let m: RegExpExecArray | null;
    while ((m = btnRe.exec(inner)) !== null) {
      const attrs = m[1] || '';
      const label = (m[2] || '').replace(/<[^>]+>/g, '').trim();
      const urlM = attrs.match(/\burl=["']([^"']+)["']/i);
      const copyM = attrs.match(/\b(?:copy-text|copy_text|text)=["']([^"']+)["']/i);
      if (urlM?.[1]) {
        links.push(`<a href="${urlM[1]}"><b>${label || urlM[1]}</b></a>`);
      } else if (copyM?.[1]) {
        links.push(`<code>${copyM[1]}</code>`);
      } else if (label) {
        links.push(`<b>${label}</b>`);
      }
    }
    return links.length > 0 ? `\n${links.join('  •  ')}\n` : '';
  });

  str = str.replace(/<tg-button\b([^>]*)>([\s\S]*?)<\/tg-button>/gi, (_, attrs, inner) => {
    const label = String(inner || '').replace(/<[^>]+>/g, '').trim();
    const urlM = String(attrs || '').match(/\burl=["']([^"']+)["']/i);
    const copyM = String(attrs || '').match(/\b(?:copy-text|copy_text|text)=["']([^"']+)["']/i);
    if (urlM?.[1]) return `<a href="${urlM[1]}"><b>${label || urlM[1]}</b></a>`;
    if (copyM?.[1]) return `<code>${copyM[1]}</code>`;
    return label ? `<b>${label}</b>` : '';
  });

  str = str.replace(
    /<figure>\s*<tg-document\b[^>]*\bsrc=["']([^"']+)["'][^>]*>(?:<\/tg-document>)?\s*(?:<figcaption>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi,
    (_, src, cap) => {
      const label = String(cap || 'Скачать файл').trim();
      return `\n<a href="${src}">📄 ${label}</a>\n`;
    }
  );
  str = str.replace(/<tg-document\b([^>]*?)(?:\/>|><\/tg-document>|>([\s\S]*?)<\/tg-document>)/gi, (_, attrs, inner) => {
    const srcM = String(attrs || '').match(/\bsrc=["']([^"']+)["']/i);
    const capM = String(attrs || '').match(/\bcaption=["']([^"']*)["']/i);
    const label = (capM?.[1] || inner || 'Скачать файл').trim();
    return srcM?.[1] ? `\n<a href="${srcM[1]}">📄 ${label}</a>\n` : '';
  });
  str = str.replace(/<table\b([^>]*)>/gi, '').replace(/<\/table>/gi, '');

  // 2e. Convert <tg-collage> and <tg-slideshow> to formatted media sections
  str = str.replace(/<tg-collage(?:\s+[^>]*)?>([\s\S]*?)<\/tg-collage>/gi, (_, inner) => {
    return `\n${inner.trim()}\n`;
  });
  str = str.replace(/<tg-slideshow(?:\s+[^>]*)?>([\s\S]*?)<\/tg-slideshow>/gi, (_, inner) => {
    return `\n${inner.trim()}\n`;
  });

  // 2f. Convert Markdown blockquotes to HTML blockquote tags before HTML escaping
  // Expandable quote syntax: **> text or > text ending with ||
  str = str.replace(/(?:^|\n)((?:>[^\n]*\n?)*>[^\n]*\|\|)/g, (match, block) => {
    let content = block.trim();
    if (content.endsWith('||')) content = content.slice(0, -2);
    const cleanLines = content.split('\n').map((l: string) => l.replace(/^>\s?/, '')).join('\n');
    return `\n<blockquote expandable>${cleanLines}</blockquote>\n`;
  });

  str = str.replace(/(?:^|\n)\*\*>\|?\|?([\s\S]*?)(?=\n\n|$)/g, (match, content) => {
    const cleanLines = content.split('\n').map((l: string) => l.replace(/^\s*\*\*>\s?/, '').replace(/\|\|$/, '').trim()).join('\n');
    return `\n<blockquote expandable>${cleanLines}</blockquote>\n`;
  });

  // Standard blockquote: > line
  str = str.replace(/(?:^|\n)((?:>[^\n]+(?:\n>[^\n]+)*))/g, (match, block) => {
    const cleanLines = block.split('\n').map((l: string) => l.replace(/^>\s?/, '')).join('\n');
    return `\n<blockquote>${cleanLines}</blockquote>\n`;
  });

  // Convert HTML headings <h1-h6>, <hr>, <details>, <summary>, <sup>, <sub> before escaping
  str = str.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n');
  str = str.replace(/<hr\s*\/?>/gi, '\n───────────────\n');
  str = str.replace(/<(?:details|summary)[^>]*>/gi, '');
  str = str.replace(/<\/(?:details|summary)>/gi, '\n');
  str = str.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '($1)');
  str = str.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '($1)');

  // 3. Repair unpaired/typo HTML tags (e.g. <b>Title<b>) before protecting valid Telegram HTML tags
  str = repairMalformedInlineHtmlTags(str);

  // Protect pre-existing valid Telegram HTML tags (e.g., tg-emoji, blockquote, custom tags)
  str = str.replace(/<(blockquote(?: expandable)?|\/blockquote|tg-emoji[^>]*|\/tg-emoji|tg-spoiler|\/tg-spoiler|b|\/b|strong|\/strong|i|\/i|em|\/em|u|\/u|ins|\/ins|s|\/s|strike|\/strike|del|\/del|a\s+href="[^"]*"|\/a|code|\/code|pre|\/pre)>/gi, (match) => {
    const idx = htmlProtected.length;
    htmlProtected.push(match);
    return `\uE000HP${idx}\uE000`;
  });

  // 4. Custom Emoji tags: ![emoji](tg://emoji?id=12345) or [emoji](tg://emoji?id=12345) or <tg-emoji id="...">
  str = str.replace(/!?\[([^\]]*)\]\(tg:\/\/emoji\?id=([0-9]+)\)/gi, (_, alt, id) => {
    const idx = htmlProtected.length;
    htmlProtected.push(`<tg-emoji emoji-id="${id}">${alt || '✨'}</tg-emoji>`);
    return `\uE000HP${idx}\uE000`;
  });

  // 5. Escape HTML special characters for the rest of normal text
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 6. Markdown Tables (| col1 | col2 |)
  str = str.replace(/((?:(?:^|\n)\|[^\n]+\|[ \t]*){2,})/g, (tableMatch) => {
    return '\n' + formatMarkdownTableForTelegram(tableMatch, false) + '\n';
  });

  // 8. Headings: # H1, ## H2, ### H3, #### H4 (strictly requiring space to avoid hashtag conflict)
  str = str.replace(/^####\s+(.*$)/gim, '<b>$1</b>');
  str = str.replace(/^###\s+(.*$)/gim, '<b>$1</b>');
  str = str.replace(/^##\s+(.*$)/gim, '<b>$1</b>');
  str = str.replace(/^#\s+(.*$)/gim, '<b>$1</b>');

  // 9. Markdown Spoiler: ||spoiler text||
  str = str.replace(/\|\|([\s\S]*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // 10. Underline & Bold/Italic combinations in Markdown V2:
  // ***bold italic***
  str = str.replace(/\*\*\*([^\*]+)\*\*\*/g, '<b><i>$1</i></b>');
  // ___underline italic___
  str = str.replace(/___([^_]+)___/g, '<u><i>$1</i></u>');
  // __*bold underline*__ or *__bold underline__*
  str = str.replace(/__\*([^\*\n]+)\*__/g, '<u><b>$1</b></u>');
  str = str.replace(/\*__([^\n_]+)__\*/g, '<b><u>$1</u></b>');

  // 11. Underline: __text__ (standard Telegram MarkdownV2) or --text-- / <u>text</u>
  str = str.replace(/(?<!_)__([^_]+)__(?!_)/g, '<u>$1</u>');
  str = str.replace(/--([^\n\-]+)--/g, '<u>$1</u>');

  // 12. Strikethrough: ~text~ (standard Telegram MarkdownV2) or ~~text~~
  str = str.replace(/~~([^\n~]+)~~/g, '<s>$1</s>');
  str = str.replace(/(?<!~)\~([^~\n]+)\~(?!~)/g, '<s>$1</s>');

  // 13. Bold: *bold* or **bold**
  str = str.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
  str = str.replace(/(?<!\*)\*([^\*\n]+)\*(?!\*)/g, '<b>$1</b>');

  // 14. Italic: _italic_
  str = str.replace(/(?<![A-Za-zА-Яа-яЁё0-9_@])_([^_\n]+?)_(?![A-Za-zА-Яа-яЁё0-9_])/g, '<i>$1</i>');

  // 14. Markdown images (strip from HTML body if remaining)
  str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');

  // 14. Links: [text](url)
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('tg://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    return `<a href="${cleanUrl}">${text}</a>`;
  });

  // 14b. Mathematical Formulas ($E = mc^2$ or $$...$$)
  str = str.replace(/\$\$([^\$\n]+)\$\$/g, '<code>$1</code>');
  str = str.replace(/(?<!\$)\$([^\$\n]+)\$(?!\$)/g, '<code>$1</code>');

  // 15. Restore protected HTML
  str = str.replace(/\uE000HP(\d+)\uE000/g, (_, idx) => htmlProtected[Number(idx)] || '');

  // 16. Restore inline codes
  str = str.replace(/\uE000IC(\d+)\uE000/g, (_, idx) => inlineCodes[Number(idx)] || '');

  // 17. Restore code blocks
  str = str.replace(/\uE000CB(\d+)\uE000/g, (_, idx) => codeBlocks[Number(idx)] || '');

  return str.trim();
}

// Convert rich-specific text to Telegram HTML (alias / specialized helper)
export function convertRichToTelegramHTML(text: string): string {
  return convertToTelegramHTML(text, 'rich');
}

// Helper to escape MarkdownV2 special characters in user text
export function sanitizeMarkdownV2(text: string): string {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// Helper to format structured MarkdownV2 posts
export function prepareTelegramMarkdownV2(title: string, content: string, signature?: string): string {
  let result = '';
  // Note: Card/post title is excluded from public output per user instructions
  if (content && content.trim()) {
    result += content.trim();
  }
  if (signature && signature.trim()) {
    result += `\n\n_${sanitizeMarkdownV2(signature.trim())}_`;
  }
  return result;
}

// Helper to detect correct file extension and MIME type from binary magic bytes
export function detectBufferMediaMeta(buffer: Buffer, originalName: string, fallbackContentType: string): {
  contentType: string;
  safeFilename: string;
  mediaType: 'photo' | 'video' | 'audio' | 'document';
} {
  const cleanName = fixUtf8Filename(originalName || 'file.bin');
  const ext = path.extname(cleanName).toLowerCase();

  let mime = fallbackContentType || 'application/octet-stream';
  let detectedExt = ext;
  let mediaType: 'photo' | 'video' | 'audio' | 'document' = 'document';

  // Check magic bytes
  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mime = 'image/png';
      detectedExt = '.png';
      mediaType = 'photo';
    }
    // JPEG: FF D8 FF
    else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      mime = 'image/jpeg';
      detectedExt = '.jpg';
      mediaType = 'photo';
    }
    // GIF: 47 49 46 38
    else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      mime = 'image/gif';
      detectedExt = '.gif';
      mediaType = 'photo';
    }
    // WEBP: RIFF....WEBP
    else if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      mime = 'image/webp';
      detectedExt = '.webp';
      mediaType = 'photo';
    }
    // MP4: ....ftyp
    else if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      mime = 'video/mp4';
      detectedExt = '.mp4';
      mediaType = 'video';
    }
    // MP3: ID3 or FF FB / FF F3
    else if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
      mime = 'audio/mpeg';
      detectedExt = '.mp3';
      mediaType = 'audio';
    }
    // OGG Opus: OggS
    else if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
      mime = 'audio/ogg';
      detectedExt = '.ogg';
      mediaType = 'audio';
    }
  }

  // If magic bytes didn't detect image/video/audio, check extension
  if (mediaType === 'document') {
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      mediaType = 'photo';
      mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    } else if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext)) {
      mediaType = 'video';
      mime = ext === '.webm' ? 'video/webm' : 'video/mp4';
    } else if (['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac'].includes(ext)) {
      mediaType = 'audio';
      mime = ext === '.ogg' ? 'audio/ogg' : ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
    }
  }

  // Ensure safe, concise filename with extension matching detected binary MIME
  let baseName = path.basename(cleanName, ext);
  if (!baseName || baseName === '.' || baseName.trim() === '' || baseName.length > 48) {
    baseName = `${mediaType}_${Date.now()}`;
  }
  const finalExt = detectedExt || ext || '.bin';
  const safeFilename = `${baseName}${finalExt}`;

  return {
    contentType: mime,
    safeFilename,
    mediaType
  };
}

// Convert Russian / Cyrillic filenames to clean ASCII for multipart headers
export function toSafeFilename(name: string): string {
  if (!name) return 'file.bin';
  const ext = path.extname(name);
  const base = path.basename(name, ext);

  const ruMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya'
  };

  let transliterated = '';
  for (const char of base.toLowerCase()) {
    transliterated += ruMap[char] !== undefined ? ruMap[char] : char;
  }

  const safe = transliterated.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_');
  return `${safe || 'file'}${ext}`;
}

/**
 * Resolves any internal file shortlink (/file/:id, /file/:key, /api/uploads/:id, or relative/internal URLs)
 * to its canonical publicly accessible URL from the PostgreSQL file_storage table.
 */
export async function resolvePublicMediaUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let cleanUrl = normalizeProTalkMediaUrl(rawUrl.trim());
  if (cleanUrl.startsWith('https://file.pro-talk.ru/tgf/')) {
    return cleanUrl;
  }

  // Check if this is a channel avatar route like /api/channel-avatar/restreamsav
  const channelAvatarMatch = cleanUrl.match(/(?:\/|^)(?:api\/)?channel-avatar\/([^\s\/\?\#\)]+)/i);
  if (channelAvatarMatch && channelAvatarMatch[1]) {
    try {
      const { ensureChannelAvatarInGallery } = await import('./channelAvatarService');
      const galleryUrl = await ensureChannelAvatarInGallery(channelAvatarMatch[1]);
      if (galleryUrl) return galleryUrl;
    } catch (e) {}
  }

  const fileKeyMatch = cleanUrl.match(/(?:\/|^)(?:file|f)\/([a-zA-Z0-9_-]+)/i);
  const apiUploadsMatch = cleanUrl.match(/(?:\/|^)api\/uploads\/([a-zA-Z0-9_-]+)/i);
  const searchKey = fileKeyMatch ? fileKeyMatch[1] : (apiUploadsMatch ? apiUploadsMatch[1] : '');

  if (searchKey) {
    try {
      const db = await getPgDB();
      if (db) {
        const isNumeric = /^\d+$/.test(searchKey);
        let stmt: any = null;
        if (isNumeric) {
          const numKey = parseInt(searchKey, 10);
          stmt = db.prepare(`SELECT original_url FROM file_storage WHERE id = ? OR legacy_id = ? LIMIT 1`);
          stmt.bind([numKey, numKey]);
        } else {
          stmt = db.prepare(`SELECT original_url FROM file_storage WHERE file_key = ? OR slug_name = ? OR short_url LIKE ? OR name = ? LIMIT 1`);
          stmt.bind([searchKey, searchKey, `%${searchKey}%`, searchKey]);
        }

        if (stmt && stmt.step()) {
          const row = stmt.getAsObject() as any;
          stmt.free();
          if (row.original_url && typeof row.original_url === 'string' && /^https?:\/\//i.test(row.original_url)) {
            return row.original_url;
          }
        } else if (stmt) {
          stmt.free();
        }
      }
    } catch (e) {
      console.warn('[resolvePublicMediaUrl] Error querying PostgreSQL file_storage:', e);
    }

    try {
      const legacyFile = DB.getFileByShortKey(searchKey);
      if (legacyFile?.fullUrl && /^https?:\/\//i.test(legacyFile.fullUrl)) {
        return legacyFile.fullUrl;
      }
    } catch (e) {}
  }

  return cleanUrl;
}

/**
 * Resolves all media URLs embedded inside Markdown or HTML tags to their public equivalents.
 */
export async function resolveAllPublicUrlsInText(text: string): Promise<string> {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  // 1. Resolve markdown images ![alt](url)
  const imgMatches = [...result.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
  for (const match of imgMatches) {
    const rawUrl = match[2]?.trim();
    if (rawUrl) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[0], `![${match[1]}](${resolved})`);
      }
    }
  }

  // 1b. Resolve zero-width space preview links [​](url)
  const zeroWidthMatches = [...result.matchAll(/\[[\u200B\s]*\]\((.*?)\)/g)];
  for (const match of zeroWidthMatches) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[0], `[\u200B](${resolved})`);
      }
    }
  }

  // 2. Resolve HTML video and audio sources
  const videoMatches = [...result.matchAll(/<video\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  for (const match of videoMatches) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[1], resolved);
      }
    }
  }

  const audioMatches = [...result.matchAll(/<audio\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  for (const match of audioMatches) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[1], resolved);
      }
    }
  }

  // 3. Resolve Bot API 10.3/10.4 <tg-document src="..."> and <tg-button url="...">
  const docMatches = [...result.matchAll(/<tg-document\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  for (const match of docMatches) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[1], resolved);
      }
    }
  }

  const btnUrlMatches = [...result.matchAll(/<tg-button\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi)];
  for (const match of btnUrlMatches) {
    const rawUrl = match[1]?.trim();
    if (rawUrl && rawUrl.startsWith('/')) {
      const resolved = await resolvePublicMediaUrl(rawUrl);
      if (resolved !== rawUrl) {
        result = result.replace(match[1], resolved);
      }
    }
  }

  return result;
}

// Helper to fetch media from URL, /file/:key, /api/uploads/:id, or local disk
export async function fetchMediaBuffer(urlStr: string): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
  mediaType: 'photo' | 'video' | 'audio' | 'document';
} | null> {
  if (!urlStr || typeof urlStr !== 'string') return null;

  try {
    let cleanUrl = normalizeProTalkMediaUrl(urlStr.trim());
    let fallbackName = '';
    let fallbackContentType = '';

    // Handle Data URL (e.g. data:image/png;base64,...)
    if (cleanUrl.startsWith('data:')) {
      const match = cleanUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const detected = detectBufferMediaMeta(buffer, 'upload.bin', mime);
        return {
          buffer,
          filename: detected.safeFilename,
          contentType: detected.contentType,
          mediaType: detected.mediaType
        };
      }
    }

    // Handle internal file storage shortlinks
    const fileKeyMatch = cleanUrl.match(/(?:\/|^)(?:file|f)\/([a-zA-Z0-9_-]+)/i);
    const apiUploadsMatch = cleanUrl.match(/(?:\/|^)api\/uploads\/([a-zA-Z0-9_-]+)/i);
    const searchKey = fileKeyMatch ? fileKeyMatch[1] : (apiUploadsMatch ? apiUploadsMatch[1] : '');

    if (searchKey) {
      try {
        const db = await getPgDB();
        if (db) {
          const isNumeric = /^\d+$/.test(searchKey);
          let stmt: any = null;
          if (isNumeric) {
            const numKey = parseInt(searchKey, 10);
            stmt = db.prepare(`SELECT original_url, name, mime_type FROM file_storage WHERE id = ? OR legacy_id = ? LIMIT 1`);
            stmt.bind([numKey, numKey]);
          } else {
            stmt = db.prepare(`SELECT original_url, name, mime_type FROM file_storage WHERE file_key = ? OR slug_name = ? OR short_url LIKE ? OR name = ? LIMIT 1`);
            stmt.bind([searchKey, searchKey, `%${searchKey}%`, searchKey]);
          }

          if (stmt && stmt.step()) {
            const row = stmt.getAsObject() as any;
            stmt.free();

            if (row.original_url && typeof row.original_url === 'string') {
              cleanUrl = row.original_url;
              fallbackName = fixUtf8Filename(row.name || '');
              fallbackContentType = row.mime_type || '';
            }
          } else if (stmt) {
            stmt.free();
          }
        }
      } catch (e) {
        console.warn('[fetchMediaBuffer] PostgreSQL file search error:', e);
      }

      // Check legacy DB files
      try {
        const legacyFile = DB.getFileByShortKey(searchKey);
        if (legacyFile) {
          if (legacyFile.fullUrl && legacyFile.fullUrl.startsWith('http')) {
            cleanUrl = legacyFile.fullUrl;
            fallbackName = fixUtf8Filename(legacyFile.name || '');
          }
        }
      } catch (e) {}
    }

    // Check if it's a relative path on local disk
    if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./')) {
      const localFilePath = path.isAbsolute(cleanUrl) ? cleanUrl : path.join(process.cwd(), cleanUrl);
      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        const fileBuf = await fs.promises.readFile(localFilePath);
        const fileName = path.basename(localFilePath);
        const detected = detectBufferMediaMeta(fileBuf, fileName, '');
        return {
          buffer: fileBuf,
          filename: detected.safeFilename,
          contentType: detected.contentType,
          mediaType: detected.mediaType
        };
      }
    }

    // Fetch from remote URL
    let fetchUrl = cleanUrl;
    if (fetchUrl.startsWith('//')) {
      fetchUrl = `https:${fetchUrl}`;
    } else if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
      if (fetchUrl.startsWith('/')) {
        const localPort = Number(process.env.PORT || 3000) || 3000;
        fetchUrl = `http://127.0.0.1:${localPort}${fetchUrl}`;
      } else {
        fetchUrl = `https://${fetchUrl}`;
      }
    }

    let response: any = null;
    try {
      response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        signal: AbortSignal.timeout(60000)
      });
    } catch (fetchErr: any) {
      console.warn(`[fetchMediaBuffer] Initial fetch failed for ${fetchUrl}:`, fetchErr.message);
    }

    // Fallback: try secondary attempt with relaxed headers or filestore mirror
    if (!response || !response.ok) {
      const mirrorUrl = /https?:\/\/file\.pro-talk\.ru\/tgf\//i.test(fetchUrl)
        ? fetchUrl.replace(/https?:\/\/file\.pro-talk\.ru\/tgf\//i, 'https://filestore.pro-talk.ru/')
        : fetchUrl;
      try {
        response = await fetch(mirrorUrl, {
          headers: {
            'User-Agent': 'TelegramBot (like TwitterBot)',
            'Accept': '*/*'
          },
          signal: AbortSignal.timeout(60000)
        });
      } catch (retryErr: any) {
        console.warn(`[fetchMediaBuffer] Retry fetch failed for ${mirrorUrl}:`, retryErr.message);
      }
    }

    if (!response || !response.ok) {
      console.warn(`[fetchMediaBuffer] HTTP ${response?.status} fetching media from ${fetchUrl}`);
      return null;
    }

    const rawContentType = response.headers.get('content-type') || fallbackContentType || 'application/octet-stream';
    if (rawContentType.includes('text/html')) {
      console.warn(`[fetchMediaBuffer] Received HTML instead of media binary from ${fetchUrl}`);
      return null;
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (!buffer || buffer.length === 0) {
      console.warn(`[fetchMediaBuffer] Received empty buffer from ${fetchUrl}`);
      return null;
    }

    let parsedName = fallbackName || '';
    if (!parsedName || parsedName === 'media.bin') {
      try {
        const parsed = new URL(fetchUrl);
        const bname = path.basename(parsed.pathname);
        if (bname && bname !== '/' && bname !== 'tgf' && bname !== 'up' && !bname.startsWith('?')) {
          parsedName = decodeURIComponent(bname);
        }
      } catch (e) {}
    }
    if (!parsedName || parsedName === 'media.bin') {
      parsedName = `file_${Date.now()}.bin`;
    }

    const detected = detectBufferMediaMeta(buffer, parsedName, rawContentType);
    return {
      buffer,
      filename: detected.safeFilename,
      contentType: detected.contentType,
      mediaType: detected.mediaType
    };
  } catch (err: any) {
    console.warn(`[fetchMediaBuffer] Error fetching ${urlStr}:`, err.message);
    return null;
  }
}

// Helper to resolve public URL from PostgreSQL or legacy DB for Telegram URL fallback
export async function resolvePublicUrl(urlStr: string): Promise<string> {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  const match = trimmed.match(/(?:\/|^)(?:file|f)\/([a-zA-Z0-9_-]+)/i);
  const searchKey = match ? match[1] : '';
  if (searchKey) {
    try {
      const db = await getPgDB();
      if (db) {
        const isNumeric = /^\d+$/.test(searchKey);
        let stmt: any = null;
        if (isNumeric) {
          stmt = db.prepare(`SELECT original_url FROM file_storage WHERE id = ? LIMIT 1`);
          stmt.bind([parseInt(searchKey, 10)]);
        } else {
          stmt = db.prepare(`SELECT original_url FROM file_storage WHERE file_key = ? OR slug_name = ? OR short_url LIKE ? OR name = ? LIMIT 1`);
          stmt.bind([searchKey, searchKey, `%${searchKey}%`, searchKey]);
        }
        if (stmt && stmt.step()) {
          const row = stmt.getAsObject() as any;
          if (row.original_url && typeof row.original_url === 'string' && row.original_url.startsWith('http')) {
            const resolved = row.original_url.trim();
            stmt.free();
            return resolved;
          }
        }
        if (stmt) stmt.free();
      }
    } catch (e) {}

    try {
      const legacy = DB.getFileByShortKey(searchKey);
      if (legacy && legacy.fullUrl && legacy.fullUrl.startsWith('http')) {
        return legacy.fullUrl;
      }
    } catch (e) {}
  }
  return trimmed;
}

// Build reply_markup for inline keyboard with styles and resilient URL/callback handling
export function buildReplyMarkup(
  inlineButtons: any,
  fallbackWebappToUrl: boolean = false,
  stripCustomFields: boolean = false
): { inline_keyboard: any[][] } | undefined {
  if (!inlineButtons || !Array.isArray(inlineButtons) || inlineButtons.length === 0) {
    return undefined;
  }

  // Normalize 1D or 2D array into 2D
  let rows: any[][] = [];
  if (Array.isArray(inlineButtons[0])) {
    rows = inlineButtons;
  } else {
    rows = inlineButtons.map(btn => [btn]);
  }

  const keyboardRows: any[][] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const mappedRow: any[] = [];
    for (const btn of row) {
      if (!btn || !btn.text) continue;
      const text = String(btn.text).trim();
      if (!text) continue;

      const btnObj: any = { text };

      // Apply button style ("primary" = blue, "success" = green, "danger" = red)
      const btnStyle = btn.style || btn.color;
      if (!stripCustomFields && btnStyle) {
        if (['primary', 'success', 'danger', 'default'].includes(btnStyle)) {
          btnObj.style = btnStyle;
          btnObj.color = btnStyle;
        } else if (btnStyle === 'green' || btnStyle === 'emerald') {
          btnObj.style = 'success';
          btnObj.color = 'success';
        } else if (btnStyle === 'red') {
          btnObj.style = 'danger';
          btnObj.color = 'danger';
        } else if (btnStyle === 'blue') {
          btnObj.style = 'primary';
          btnObj.color = 'primary';
        }
      }

      const btnType = btn.type || (btn.webAppUrl ? 'webapp' : (btn.url && btn.url.startsWith('http') ? 'url' : 'callback'));

      if (btnType === 'webapp' || btnType === 'web_app' || btn.webAppUrl) {
        let webUrl = String(btn.url || btn.webAppUrl || '').trim();
        if (webUrl && !webUrl.startsWith('http://') && !webUrl.startsWith('https://')) {
          webUrl = `https://${webUrl}`;
        }
        const validWebUrl = (webUrl && webUrl !== 'https://' && webUrl !== 'http://') ? webUrl : 'https://t.me';
        if (fallbackWebappToUrl) {
          btnObj.url = validWebUrl;
        } else {
          btnObj.web_app = { url: validWebUrl };
        }
      } else if (btnType === 'url') {
        let rawUrl = String(btn.url || '').trim();
        if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('tg://')) {
          rawUrl = `https://${rawUrl}`;
        }
        // If URL is empty or invalid ("https://"), fallback safely to callback_data to prevent BUTTON_URL_INVALID error
        if (!rawUrl || rawUrl === 'https://' || rawUrl === 'http://') {
          btnObj.callback_data = String(btn.callbackData || btn.text || 'btn_action').slice(0, 64);
        } else {
          btnObj.url = rawUrl;
        }
      } else if (btnType === 'copy_text') {
        const copyVal = String(btn.value || btn.copyText || btn.callbackData || btn.text || '').trim();
        if (copyVal) {
          btnObj.copy_text = { text: copyVal.slice(0, 256) };
        } else {
          btnObj.callback_data = 'copy_text';
        }
      } else {
        // Callback action
        const actionData = String(btn.callbackData || btn.action || btn.text || 'action').trim();
        btnObj.callback_data = (actionData || 'action').slice(0, 64);
      }

      mappedRow.push(btnObj);
    }
    if (mappedRow.length > 0) {
      keyboardRows.push(mappedRow);
    }
  }

  return keyboardRows.length > 0 ? { inline_keyboard: keyboardRows } : undefined;
}

/**
 * Extracts embedded media from post content:
 * - <tg-collage> and <tg-slideshow>
 * - Markdown images ![alt](url)
 * - Video tags <video src="..."></video>
 * - Audio tags <audio src="..."></audio>
 * - Hidden preview links <a href="url">&#8203;</a> or [\u200B](url)
 */
export function extractEmbeddedMediaFromContent(rawContent: string): {
  cleanContent: string;
  attachmentType: 'none' | 'photo' | 'video' | 'audio' | 'album';
  attachmentUrl?: string;
  attachmentUrls?: string[];
} {
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanContent: '', attachmentType: 'none' };
  }

  let text = rawContent;
  const albumUrls: string[] = [];
  let singleUrl: string | undefined = undefined;
  let detectedType: 'none' | 'photo' | 'video' | 'audio' | 'album' = 'none';

  // 1. Check for <tg-collage>...</tg-collage>
  const collageMatches = [...text.matchAll(/<tg-collage(?:\s+[^>]*)?>([\s\S]*?)<\/tg-collage>/gi)];
  for (const match of collageMatches) {
    const inner = match[1];
    const imgs = [...inner.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
    for (const img of imgs) {
      const u = img[2]?.trim();
      if (u && !albumUrls.includes(u)) albumUrls.push(u);
    }
    const vids = [...inner.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
    for (const v of vids) {
      const u = v[1]?.trim();
      if (u && !albumUrls.includes(u)) albumUrls.push(u);
    }
  }
  if (collageMatches.length > 0) {
    text = text.replace(/<tg-collage(?:\s+[^>]*)?>([\s\S]*?)<\/tg-collage>/gi, '').trim();
  }

  // 2. Check for <tg-slideshow>...</tg-slideshow>
  const slideshowMatches = [...text.matchAll(/<tg-slideshow(?:\s+[^>]*)?>([\s\S]*?)<\/tg-slideshow>/gi)];
  for (const match of slideshowMatches) {
    const inner = match[1];
    const imgs = [...inner.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
    for (const img of imgs) {
      const u = img[2]?.trim();
      if (u && !albumUrls.includes(u)) albumUrls.push(u);
    }
    const vids = [...inner.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
    for (const v of vids) {
      const u = v[1]?.trim();
      if (u && !albumUrls.includes(u)) albumUrls.push(u);
    }
  }
  if (slideshowMatches.length > 0) {
    text = text.replace(/<tg-slideshow(?:\s+[^>]*)?>([\s\S]*?)<\/tg-slideshow>/gi, '').trim();
  }

  // 3. Check for standalone markdown images ![alt](url)
  const imgMatches = [...text.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
  if (imgMatches.length > 0) {
    for (const m of imgMatches) {
      const u = m[2]?.trim();
      if (u) {
        if (!albumUrls.includes(u)) {
          albumUrls.push(u);
        }
      }
    }
    // Remove the markdown image tags, keeping clean paragraph separation
    text = text.replace(/([^\n])\s*!\[(.*?)\]\((.*?)\)\s*([^\n])/g, '$1\n\n$4')
               .replace(/!\[(.*?)\]\((.*?)\)/g, '')
               .replace(/\n{3,}/g, '\n\n')
               .trim();
  }

  // 4. Check for <video src="url"></video>
  const videoMatch = text.match(/<video\s+[^>]*src=["']([^"']+)["'][^>]*><\/video>/i) || text.match(/<video\s+src=["']([^"']+)["']\s*\/?>/i);
  if (videoMatch && albumUrls.length === 0) {
    detectedType = 'video';
    singleUrl = videoMatch[1].trim();
    text = text.replace(/<video[\s\S]*?(?:<\/video>|\/>)/gi, '').trim();
  }

  // 5. Check for <audio src="url"></audio>
  const audioMatch = text.match(/<audio\s+[^>]*src=["']([^"']+)["'][^>]*><\/audio>/i) || text.match(/<audio\s+src=["']([^"']+)["']\s*\/?>/i);
  if (audioMatch && albumUrls.length === 0 && detectedType === 'none') {
    detectedType = 'audio';
    singleUrl = audioMatch[1].trim();
    text = text.replace(/<audio[\s\S]*?(?:<\/audio>|\/>)/gi, '').trim();
  }

  // 6. Check for hidden preview link <a href="url">&#8203;</a> or [\u200B](url)
  const hiddenMatch = text.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(?:&#8203;|\u200B)<\/a>/i) || text.match(/\[[\u200B\s]*\]\(([^)]+)\)/i);
  if (hiddenMatch && albumUrls.length === 0 && detectedType === 'none') {
    detectedType = 'photo';
    singleUrl = hiddenMatch[1].trim();
    text = text.replace(/([^\n])\s*\[[\u200B\s]*\]\([^)]+\)\s*([^\n])/g, '$1\n\n$2')
               .replace(/<a\s+[^>]*href=["'][^"']+["'][^>]*>(?:&#8203;|\u200B)<\/a>/gi, '')
               .replace(/\[[\u200B\s]*\]\([^)]+\)/gi, '')
               .replace(/\n{3,}/g, '\n\n')
               .trim();
  }

  if (albumUrls.length > 1) {
    return {
      cleanContent: text,
      attachmentType: 'album',
      attachmentUrl: albumUrls[0],
      attachmentUrls: albumUrls
    };
  } else if (albumUrls.length === 1) {
    return {
      cleanContent: text,
      attachmentType: isVideoMediaUrl(albumUrls[0]) ? 'video' : 'photo',
      attachmentUrl: albumUrls[0]
    };
  } else if (detectedType !== 'none' && singleUrl) {
    return {
      cleanContent: text,
      attachmentType: detectedType,
      attachmentUrl: singleUrl
    };
  }

  return {
    cleanContent: rawContent,
    attachmentType: 'none'
  };
}

/**
 * Main Telegram Sender Dispatcher.
 * Delegates to dedicated telegramRich.ts or telegramV2.ts.
 * Note: Post/card title is NEVER included in published Telegram messages.
 */
// Global anti-spam duplicate detection cache
const recentSentMessagesCache = new Map<string, number>();

export function checkAndRegisterSentMessage(channel: string, text: string, title?: string): { isDuplicate: boolean } {
  const normChannel = (channel || '').trim().toLowerCase();
  const normText = (text || '').trim().toLowerCase();
  const normTitle = (title || '').trim().toLowerCase();
  const cacheKey = `${normChannel}:${normTitle}:${normText.slice(0, 100)}`;
  const now = Date.now();
  const lastSent = recentSentMessagesCache.get(cacheKey);

  // If identical content was sent to this channel within the last 5 minutes (300,000 ms), block duplicate!
  if (lastSent && (now - lastSent < 300000)) {
    return { isDuplicate: true };
  }

  recentSentMessagesCache.set(cacheKey, now);

  // Clean old entries (> 15 mins)
  if (recentSentMessagesCache.size > 1000) {
    for (const [k, time] of recentSentMessagesCache.entries()) {
      if (now - time > 900000) {
        recentSentMessagesCache.delete(k);
      }
    }
  }

  return { isDuplicate: false };
}

export async function sendPromptToTelegram(
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
    channels?: string[];
    telegramId?: number | string;
    dedupKey?: string;
    isTest?: boolean;
    __internalDedupClaimed?: boolean;
  }
): Promise<TelegramSendResponse> {
  const mergedOptions = {
    ...options,
    signature: options?.signature !== undefined ? options.signature : dayRequest?.signature,
    linkPreviewEnabled:
      options?.linkPreviewEnabled !== undefined
        ? options.linkPreviewEnabled
        : dayRequest?.linkPreviewEnabled,
    attachmentType: options?.attachmentType || dayRequest?.attachmentType || 'none',
    audioFormat:
      options?.audioFormat || (dayRequest as any)?.audioFormat || (dayRequest as any)?.audio_format,
    audioTitle:
      options?.audioTitle !== undefined ? options.audioTitle : (dayRequest as any)?.audioTitle,
    audioPerformer:
      options?.audioPerformer !== undefined
        ? options.audioPerformer
        : (dayRequest as any)?.audioPerformer,
    protectContent:
      options?.protectContent !== undefined
        ? options.protectContent
        : Boolean((dayRequest as any)?.protectContent),
    attachmentUrl:
      options?.attachmentUrl !== undefined ? options.attachmentUrl : dayRequest?.attachmentUrl,
    attachmentUrls:
      options?.attachmentUrls !== undefined ? options.attachmentUrls : dayRequest?.attachmentUrls,
    inlineButtons:
      options?.inlineButtons !== undefined ? options.inlineButtons : dayRequest?.inlineButtons
  };
  let effectiveContent = content !== undefined && content !== null ? String(content) : '';

  // 0. Anti-spam check: prevent publishing completely empty text without attachments
  const trimmedContent = effectiveContent.trim();
  const hasAttachmentExplicit = Boolean(
    (mergedOptions.attachmentType && mergedOptions.attachmentType !== 'none') ||
    (mergedOptions.attachmentUrl && String(mergedOptions.attachmentUrl).trim()) ||
    (Array.isArray(mergedOptions.attachmentUrls) && mergedOptions.attachmentUrls.some(Boolean))
  );

  if (!trimmedContent && !hasAttachmentExplicit) {
    console.warn(`[sendPromptToTelegram] Rejecting publication with empty text for channel(s): ${(mergedOptions.channels || [dayRequest.channel]).join(', ')}`);
    return {
      ok: false,
      error: 'Текст публикации пуст. Отправка отменена для защиты канала от спама.',
      simulated: false
    };
  }

  // 1. Resolve internal shortlinks/file URLs in content and options to public URLs
  effectiveContent = await resolveAllPublicUrlsInText(effectiveContent);
  if (mergedOptions.attachmentUrl) {
    mergedOptions.attachmentUrl = await resolvePublicMediaUrl(mergedOptions.attachmentUrl);
  }
  if (Array.isArray(mergedOptions.attachmentUrls) && mergedOptions.attachmentUrls.length > 0) {
    mergedOptions.attachmentUrls = await Promise.all(
      mergedOptions.attachmentUrls.map((u) => resolvePublicMediaUrl(u))
    );
  }

  // Check format cleanly: honor explicit messageFormat ('v2' vs 'rich'); only auto-detect Rich when format is unspecified
  const explicitFormat = mergedOptions.messageFormat || dayRequest.messageFormat;
  const hasRichTags = /<(?:tg-slideshow|tg-collage)>|!\[.*?\]\([^\)]+\)|\[[\u200B\s]*\]\(https?:\/\/[^\s\)]+\)/i.test(effectiveContent);
  const isRich = explicitFormat === 'rich' || explicitFormat === 'html' || (!explicitFormat && hasRichTags);

  if (!isRich && !hasAttachmentExplicit) {
    const extracted = extractEmbeddedMediaFromContent(effectiveContent);
    if (extracted.attachmentType !== 'none') {
      mergedOptions.attachmentType = extracted.attachmentType;
      mergedOptions.attachmentUrl = extracted.attachmentUrl ? await resolvePublicMediaUrl(extracted.attachmentUrl) : undefined;
      mergedOptions.attachmentUrls = extracted.attachmentUrls ? await Promise.all(extracted.attachmentUrls.map(u => resolvePublicMediaUrl(u))) : undefined;
      effectiveContent = extracted.cleanContent;
    }
  }

  // Anti-spam persistent + canonical duplicate check per resolved channel
  const targetChans = mergedOptions.channels && mergedOptions.channels.length > 0
    ? mergedOptions.channels
    : [dayRequest.channel || 'default'];

  const claimedDedupKeys: string[] = [];
  const allowedChannels: string[] = [];
  const duplicateChannels: string[] = [];

  if (options?.__internalDedupClaimed) {
    allowedChannels.push(...targetChans);
  } else {
    for (const ch of targetChans) {
      const canonChan = canonicalizeTelegramTarget(ch, mergedOptions.telegramId);
      let channelEntityKey: string | null = null;
      if (options?.dedupKey) {
        const slotKey = targetChans.length > 1 ? `${options.dedupKey}:${canonChan}` : options.dedupKey;
        const slotRes = await acquireEntityPublishSlot({
          slotKey,
          entityType: options?.isTest ? 'direct' : 'post',
          entityId: String(dayRequest?.id || 'post'),
          channelKey: canonChan
        });
        if (!slotRes.claimed) {
          console.warn(`[AntiSpam Protection] Entity slot blocked for ${canonChan}: "${title}" (${slotRes.reason})`);
          duplicateChannels.push(ch);
          continue;
        }
        channelEntityKey = slotRes.dedupKey;
      }

      const contentRes = await acquireContentChannelGuard({
        channel: ch,
        telegramId: mergedOptions.telegramId,
        title,
        content: effectiveContent,
        attachmentUrl: mergedOptions.attachmentUrl,
        attachmentUrls: mergedOptions.attachmentUrls,
        inlineButtons: mergedOptions.inlineButtons,
        entityType: options?.isTest ? 'direct' : 'post',
        entityId: String(dayRequest?.id || ''),
        isTest: options?.isTest
      });
      if (!contentRes.claimed) {
        if (channelEntityKey) {
          await finalizePublishDedup([channelEntityKey], 'definite_failure');
        }
        console.warn(`[AntiSpam Protection] Duplicate publication blocked for ${canonChan}: "${title}" (${contentRes.reason}).`);
        duplicateChannels.push(ch);
        continue;
      }

      if (channelEntityKey) claimedDedupKeys.push(channelEntityKey);
      claimedDedupKeys.push(contentRes.dedupKey);
      allowedChannels.push(ch);
    }

    if (allowedChannels.length === 0 && duplicateChannels.length > 0) {
      return {
        ok: true,
        messageId: 'duplicate_prevented',
        channel: duplicateChannels.join(', '),
        simulated: false,
        fallbackNotice: 'Дубликат публикации отменен для защиты канала от спама.'
      };
    }
  }

  let result: TelegramSendResponse = { ok: false, error: 'Не удалось отправить сообщение', simulated: false };
  try {
    const dispatchOptions = {
      ...mergedOptions,
      channels: allowedChannels,
      __internalDedupClaimed: true
    };
    if (isRich) {
      result = await sendRichTelegramMessage(title, effectiveContent, dayRequest, {
        ...dispatchOptions,
        messageFormat: 'rich'
      });
    } else {
      result = await sendV2TelegramMessage(title, effectiveContent, dayRequest, dispatchOptions);
    }
    return result;
  } catch (err: any) {
    result = { ok: false, error: err?.message || String(err), simulated: false };
    throw err;
  } finally {
    if (claimedDedupKeys.length > 0) {
      const outcome = result.ok
        ? 'sent'
        : isDefiniteClientFailure(result.error || '')
        ? 'definite_failure'
        : 'ambiguous_timeout';
      await finalizePublishDedup(claimedDedupKeys, outcome, result.messageId);
    }
  }
}

export interface TelegramBotConfig {
  botToken: string;
  botUsername: string;
  proxyType: 'dialog_ai' | 'custom_cloudflare' | 'direct';
  apiBaseUrl: string;
  adminTelegramId: string;
}

export const PROXY_PRESETS = {
  dialog_ai: 'https://eu1.account.dialog.ai.atiks.org',
  direct: 'https://eu1.account.dialog.ai.atiks.org'
};

// 1. Получение настроек бота и прокси из PostgreSQL
export async function getTelegramBotConfig(): Promise<TelegramBotConfig> {
  const defaultConfig: TelegramBotConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o',
    botUsername: '@IIrkiBot',
    proxyType: 'dialog_ai',
    apiBaseUrl: process.env.TELEGRAM_API_BASE || PROXY_PRESETS.dialog_ai,
    adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '169262990'
  };

  try {
    const db = await getPgDB();
    if (!db) return defaultConfig;
    const stmt = db.prepare("SELECT config_json FROM telegram_bot_config WHERE id = 'default' LIMIT 1");
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      if (row.config_json) {
        const parsed = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
        const merged = { ...defaultConfig, ...parsed };
        if (!merged.apiBaseUrl || merged.apiBaseUrl.includes('api.telegram.org')) {
          merged.apiBaseUrl = PROXY_PRESETS.dialog_ai;
        }
        if (merged.proxyType === 'direct') {
          merged.proxyType = 'dialog_ai';
        }
        return merged;
      }
    } else {
      stmt.free();
    }
  } catch (e) {
    console.warn('[getTelegramBotConfig] Fallback to default config:', e);
  }
  return defaultConfig;
}

// 2. Очистка и нормализация базового URL
export function cleanTelegramBaseUrl(rawUrl: string): string {
  return normalizeTelegramGatewayUrl(rawUrl);
}

// 3. Отправка текстовых сообщений (sendMessage)
export async function sendTelegramMessage(options: {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: any;
  botToken?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; result?: any; error?: string; usedFallback?: boolean }> {
  const config = await getTelegramBotConfig();
  const token = options.botToken || config.botToken;
  const rawBase = options.apiBaseUrl || config.apiBaseUrl || PROXY_PRESETS.dialog_ai;
  const candidates = buildTelegramBaseCandidates(rawBase, options.apiBaseUrl ? undefined : config.proxyType);
  const timeoutMs = options.timeoutMs || 15000;

  if (!token) {
    console.warn('[Telegram] Bot token is not configured.');
    return { ok: false, error: 'Bot token is missing' };
  }

  const payload: any = {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: options.parseMode || 'HTML'
  };
  if (options.replyMarkup) {
    payload.reply_markup = options.replyMarkup;
  }

  let lastErrMsg = 'Telegram network error';
  for (let i = 0; i < candidates.length; i++) {
    const base = candidates[i];
    const url = `${base}/bot${token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        return { ok: true, result: data.result, usedFallback: i > 0 };
      }
      if (data && typeof data.ok === 'boolean' && res.status < 500) {
        return { ok: false, error: data.description || `HTTP ${res.status}` };
      }
      lastErrMsg = data?.description || `HTTP ${res.status}`;
    } catch (err: any) {
      lastErrMsg = err?.message || String(err);
      console.warn(`[Telegram] sendMessage failed (${base}):`, lastErrMsg);
    }
  }

  return { ok: false, error: lastErrMsg };
}

// 4. Отправка файлов / бэкапов (sendDocument)
export async function sendTelegramDocument(options: {
  chatId: string | number;
  fileBuffer: Buffer | Uint8Array;
  filename: string;
  caption?: string;
  botToken?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; result?: any; error?: string }> {
  const config = await getTelegramBotConfig();
  const token = options.botToken || config.botToken;
  const rawBase = options.apiBaseUrl || config.apiBaseUrl || PROXY_PRESETS.dialog_ai;
  const candidates = buildTelegramBaseCandidates(rawBase, options.apiBaseUrl ? undefined : config.proxyType);
  const timeoutMs = options.timeoutMs || 30000;

  if (!token) return { ok: false, error: 'Bot token is missing' };

  const form = new FormData();
  form.append('chat_id', String(options.chatId));
  if (options.caption) form.append('caption', options.caption);
  if (options.caption) form.append('parse_mode', 'HTML');
  
  const buf = Buffer.isBuffer(options.fileBuffer) ? options.fileBuffer : Buffer.from(options.fileBuffer);
  const lowerName = String(options.filename || '').toLowerCase();
  const detectedMime = lowerName.endsWith('.gz')
    ? 'application/gzip'
    : lowerName.endsWith('.sql')
      ? 'application/sql'
      : lowerName.endsWith('.ndjson') || lowerName.endsWith('.jsonl')
        ? 'application/x-ndjson'
        : lowerName.endsWith('.csv')
          ? 'text/csv'
          : lowerName.endsWith('.json')
            ? 'application/json'
            : 'application/octet-stream';
  form.append('document', buf, { filename: options.filename, contentType: detectedMime });

  let lastErrMsg = 'Telegram sendDocument error';
  for (const base of candidates) {
    const url = `${base}/bot${token}/sendDocument`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: form.getHeaders(),
        body: form.getBuffer(),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await res.json();
      if (res.ok && data?.ok) return { ok: true, result: data.result };
      if (data && typeof data.ok === 'boolean' && res.status < 500) {
        return { ok: false, error: data.description || `HTTP ${res.status}` };
      }
      lastErrMsg = data?.description || `HTTP ${res.status}`;
    } catch (err: any) {
      lastErrMsg = err?.message || String(err);
      console.warn(`[Telegram] sendDocument failed (${base}):`, lastErrMsg);
    }
  }
  return { ok: false, error: lastErrMsg };
}

export async function sendPrivateTelegramNotification(
  telegramId: number,
  message: string,
  replyMarkup?: any,
  meta?: {
    userId?: string;
    category?: PushCategoryKey;
    type?: string;
    title?: string;
    link?: string;
    bypassPreferences?: boolean;
  }
): Promise<boolean> {
  if (!meta?.bypassPreferences) {
    try {
      let resolvedUserId = String(meta?.userId || '').trim();
      if (!resolvedUserId && telegramId) {
        const db = await getPgDB();
        const stmt = db.prepare('SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = ? LIMIT 1');
        stmt.bind([String(telegramId)]);
        if (stmt.step()) {
          const row = stmt.getAsObject() as any;
          if (row?.id) resolvedUserId = String(row.id);
        }
        stmt.free();
      }
      if (resolvedUserId) {
        const allowed = await shouldDeliverNotificationChannel(resolvedUserId, 'telegram', {
          type: meta?.type,
          title: meta?.title,
          message: stripHTML(message),
          link: meta?.link,
          explicitCategory: meta?.category,
        });
        if (!allowed) {
          return true;
        }
      }
    } catch {}
  }

  const result = await sendTelegramMessage({
    chatId: telegramId,
    text: message,
    parseMode: 'HTML',
    replyMarkup
  });
  return result.ok;
}
