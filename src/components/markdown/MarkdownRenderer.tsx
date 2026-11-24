import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MarkdownRendererProps, getInlineButtonStyleClasses } from './markdownTypesAndUtils';
import { renderMediaAttachment, renderRichMode, renderV2Mode } from './markdownRenderers';

export function MarkdownRenderer({
  content,
  format = 'auto',
  isCompact = false,
  maxLines,
  attachmentType = 'none',
  attachmentUrl,
  attachmentUrls = [],
  inlineButtons = [],
  signature,
}: MarkdownRendererProps) {
  const [slideshowIdxs, setSlideshowIdxs] = useState<Record<number, number>>({});

  const rawCleanText = (content || '').trim();
  const mediaList = attachmentUrls && attachmentUrls.length > 0 ? attachmentUrls : (attachmentUrl ? [attachmentUrl] : []);
  const hasMedia = (attachmentType !== 'none' && attachmentType !== undefined) || mediaList.length > 0;
  const hasButtons = Array.isArray(inlineButtons) && inlineButtons.length > 0;

  if (!rawCleanText && !hasMedia && !hasButtons) {
    return (
      <div className="text-slate-400 italic text-[14px] font-sans">Текст публикации отсутствует</div>
    );
  }

  const hasRichFeatures = /(?:^|\n)\s*#{1,6}\s+|<details|<tg-collage|<tg-slideshow|<tg-button|<tg-document|<video|<audio|!\[.*?\]\s*\([^\)]+\)|\[[\u200B\s]*\]\s*\(https?:|\|:?---|-(?:\s*\[[ xX]\])|<table\b|<blockquote>|<spoiler>|<\/tg-/i.test(content || '');
  const resolvedFormat: 'v2' | 'rich' = (format === 'rich' || hasRichFeatures) ? 'rich' : 'v2';

  let rawText = content || '';

  if (signature && signature.trim() && !rawText.includes(signature.trim())) {
    rawText = `${rawText}\n\n${signature.trim()}`;
  }

  const hasImageOrMedia = /!\[.*?\]|\[[\u200B\s]*\]\s*\(https?:|<tg-collage|<tg-slideshow/i.test(rawText);

  return (
    <div className="space-y-3 font-sans leading-relaxed text-slate-800 tracking-normal select-text text-[14px]">
      {renderMediaAttachment(attachmentType, mediaList, isCompact)}

      {rawCleanText && (
        <div className={`${isCompact && maxLines && !hasImageOrMedia ? `line-clamp-${maxLines}` : ''} space-y-2`}>
          {resolvedFormat === 'rich' ? (
            renderRichMode(rawText, slideshowIdxs, (bIdx, nIdx) => setSlideshowIdxs(prev => ({ ...prev, [bIdx]: nIdx })), isCompact)
          ) : (
            renderV2Mode(rawText, isCompact)
          )}
        </div>
      )}

      {inlineButtons && inlineButtons.length > 0 && (
        <div className="pt-2.5 space-y-2 border-t border-pink-200/80">
          {inlineButtons.map((row, rIdx) => (
            <div
              key={rIdx}
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
            >
              {row.map((btn, bIdx) => {
                const colorClass = getInlineButtonStyleClasses((btn as any).style, (btn as any).color);
                const hasUrl = Boolean(btn.url);
                return (
                  <a
                    key={btn.url ? `${btn.url}_${bIdx}` : bIdx}
                    href={btn.url || '#'}
                    target={hasUrl ? '_blank' : undefined}
                    rel={hasUrl ? 'noreferrer' : undefined}
                    onClick={(e) => {
                      if (!hasUrl) {
                        e.preventDefault();
                      }
                    }}
                    className={`w-full min-h-[38px] text-center px-3 py-2 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer no-underline ${colorClass}`}
                    title={btn.url || (btn as any).callbackData || btn.text}
                  >
                    <span className="truncate">{btn.text}</span>
                    {hasUrl && <ExternalLink size={14} className="shrink-0 opacity-80" />}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MarkdownRenderer;
