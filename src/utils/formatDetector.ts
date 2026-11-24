/**
 * Universal Post and Message Format Detector
 * Distinguishes between 'rich' (Rich HTML/Markdown with collages, checklists, spoilers, headers)
 * and 'v2' (Telegram Markdown V2)
 */

export function detectPostFormat(text?: string, explicitFormat?: string): 'rich' | 'v2' {
  if (explicitFormat === 'rich' || explicitFormat === 'html') return 'rich';
  if (explicitFormat === 'v2') {
    // If explicitly marked v2 but contains Rich-only tags like <tg-collage> or <tg-slideshow>
    if (text && /<(?:tg-collage|tg-slideshow|details|summary|table|blockquote|tg-spoiler|tg-emoji)/i.test(text)) {
      return 'rich';
    }
    return 'v2';
  }
  if (!text) return 'v2';

  // Check for rich components and explicit rich HTML tags
  const hasRichTags = /<(?:tg-collage|tg-slideshow|details|summary|table|blockquote|tg-spoiler|tg-emoji|b|strong|i|em|u|ins|s|strike|del|pre|code|a\s+)/i.test(text);
  
  // Check for Rich markdown constructs (Headings, Checklists, Tables, Collages)
  const hasRichMarkdown = /(?:^|\n)(?:#{1,6}\s+|-\s*\[[ xX]\]|\*\s*\[[ xX]\]|\s*>\s+)/m.test(text);

  if (hasRichTags || hasRichMarkdown) {
    return 'rich';
  }

  return 'v2';
}
