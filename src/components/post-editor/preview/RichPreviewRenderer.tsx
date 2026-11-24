import React, { useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseRichBlocks } from '../core/richBlockParser';
import { RenderMathPreview, TelegramCodeBlock, renderFormattedText } from './InlineFormattedRenderer';
import {
  RichAudioPreview,
  RichButtonRowPreview,
  RichDocumentPreview,
  RichVideoPreview
} from './RichButtonsAndMediaPreview';
import { isVideoMediaUrl } from '../../../utils/urlUtils';
import { CachedMediaImage } from '../../CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../../../constants/proTalkStorage';

const ExpandableQuoteBlock: React.FC<{
  text: string;
  cite?: string;
  expandable: boolean;
  isRich: boolean;
}> = ({ text, cite, expandable, isRich }) => {
  const [expanded, setExpanded] = useState(!expandable);

  return (
    <blockquote className="my-2.5 pl-3.5 pr-3 py-2.5 rounded-r-2xl border-l-4 border-pink-500 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 text-slate-900">
      <div className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${!expanded ? 'line-clamp-3' : ''}`}>
        {renderFormattedText(text, isRich)}
      </div>
      {cite && (
        <cite className="block mt-1.5 text-[14px] font-semibold not-italic text-pink-700">
          — {cite}
        </cite>
      )}
      {expandable && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="mt-1.5 inline-flex items-center gap-1 text-[14px] font-bold text-pink-700 hover:text-sky-700 cursor-pointer"
        >
          <span>{expanded ? 'Свернуть цитату' : 'Развернуть цитату'}</span>
          <ChevronDown size={15} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      )}
    </blockquote>
  );
};

const SlideshowPreviewBlock: React.FC<{ items: { caption: string; url: string }[] }> = ({ items }) => {
  const [idx, setIdx] = useState(0);
  if (items.length === 0) return null;
  const safeIdx = Math.min(idx, items.length - 1);
  const current = items[safeIdx];
  const currentUrl = normalizeProTalkMediaUrl(current.url) || current.url;

  return (
    <div className="my-3 rounded-2xl border border-pink-300/80 bg-gradient-to-br from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 overflow-hidden shadow-sm">
      <div className="relative aspect-video bg-white/60 flex items-center justify-center overflow-hidden">
        {isVideoMediaUrl(currentUrl) ? (
          <video
            src={currentUrl}
            controls
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        ) : (
          <CachedMediaImage
            src={currentUrl}
            alt={current.caption || `Слайд ${safeIdx + 1}`}
            className="w-full h-full object-cover"
          />
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx((p) => (p - 1 + items.length) % items.length)}
              title="Предыдущий слайд"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shadow-md cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIdx((p) => (p + 1) % items.length)}
              title="Следующий слайд"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shadow-md cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2 text-[14px]">
        <span className="text-slate-800 font-medium break-words">
          {current.caption || `Слайд ${safeIdx + 1}`}
        </span>
        <span className="text-pink-700 font-bold shrink-0">
          {safeIdx + 1} / {items.length}
        </span>
      </div>
    </div>
  );
};

export const RichPreviewRenderer: React.FC<{
  content?: string;
  postText?: string;
  isRich?: boolean;
  hideEmptyPlaceholder?: boolean;
}> = ({ content, postText, isRich = true, hideEmptyPlaceholder = false }) => {
  const effectiveContent = content ?? postText ?? '';
  const blocks = parseRichBlocks(effectiveContent);

  if (blocks.length === 0) {
    if (hideEmptyPlaceholder) {
      return effectiveContent.trim() ? (
        <p className="whitespace-pre-wrap text-[14px] text-slate-900 leading-relaxed break-words">
          {effectiveContent}
        </p>
      ) : null;
    }
    return (
      <p className="text-[14px] text-slate-500 italic">
        Текст публикации пока пуст — введите текст или сгенерируйте пост с помощью нейрогенератора.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 text-[14px] text-slate-900 leading-relaxed break-words min-w-0">
      {blocks.map((block, bIdx) => {
        const key = `rb_${bIdx}`;
        switch (block.type) {
          case 'anchor':
            return <div key={key} id={block.name} />;
          case 'h1':
            return (
              <h1
                key={key}
                id={block.slug}
                className="text-[20px] sm:text-[22px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent pt-1"
              >
                {renderFormattedText(block.text, isRich)}
              </h1>
            );
          case 'h2':
            return (
              <h2
                key={key}
                id={block.slug}
                className="text-[18px] sm:text-[19px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent pt-1"
              >
                {renderFormattedText(block.text, isRich)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={key} id={block.slug} className="text-[16px] font-bold text-slate-900 pt-0.5">
                {renderFormattedText(block.text, isRich)}
              </h3>
            );
          case 'h4':
            return (
              <h4 key={key} id={block.slug} className="text-[15px] font-bold text-slate-800">
                {renderFormattedText(block.text, isRich)}
              </h4>
            );
          case 'hr':
            return (
              <hr
                key={key}
                className="my-3 h-[2px] border-0 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 rounded-full"
              />
            );
          case 'code':
            return <TelegramCodeBlock key={key} code={block.content} lang={block.lang} />;
          case 'math':
            return <RenderMathPreview key={key} formula={block.formula} block />;
          case 'quote':
            return (
              <ExpandableQuoteBlock
                key={key}
                text={block.text}
                cite={block.cite}
                expandable={block.expandable}
                isRich={isRich}
              />
            );
          case 'aside':
            return (
              <aside
                key={key}
                className="my-3 px-4 py-3 rounded-2xl text-center font-semibold text-[15px] text-slate-900 border border-pink-300/80 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80"
              >
                {renderFormattedText(block.text, isRich)}
              </aside>
            );
          case 'details':
            return (
              <details
                key={key}
                className="my-2.5 rounded-2xl border border-pink-300/80 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 px-3.5 py-2.5"
              >
                <summary className="font-bold text-[14px] text-pink-700 cursor-pointer">
                  {block.summary}
                </summary>
                <div className="mt-2 text-[14px] text-slate-800 whitespace-pre-wrap">
                  {renderFormattedText(block.body, isRich)}
                </div>
              </details>
            );
          case 'collage':
            return (
              <div
                key={key}
                className={`my-3 grid gap-2 ${
                  block.items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {block.items.map((it, idx) => {
                  const spanFull = block.items.length === 3 && idx === 0;
                  const itemUrl = normalizeProTalkMediaUrl(it.url) || it.url;
                  return (
                    <figure
                      key={`${it.url}_${idx}`}
                      className={`rounded-2xl overflow-hidden border border-pink-300/80 bg-white/75 shadow-2xs ${
                        spanFull ? 'col-span-2' : ''
                      }`}
                    >
                      {isVideoMediaUrl(itemUrl) ? (
                        <video
                          src={itemUrl}
                          controls
                          playsInline
                          muted
                          preload="metadata"
                          className={`w-full object-cover ${
                            block.items.length === 1 ? 'max-h-80' : spanFull ? 'h-48' : 'h-40'
                          }`}
                        />
                      ) : (
                        <CachedMediaImage
                          src={itemUrl}
                          alt={it.caption || `Фото ${idx + 1}`}
                          className={`w-full object-cover ${
                            block.items.length === 1 ? 'max-h-80' : spanFull ? 'h-48' : 'h-40'
                          }`}
                        />
                      )}
                      {it.caption && (
                        <figcaption className="px-2.5 py-1.5 text-[14px] text-slate-700 border-t border-pink-200/60">
                          {it.caption}
                        </figcaption>
                      )}
                    </figure>
                  );
                })}
              </div>
            );
          case 'button_row':
            return <RichButtonRowPreview key={key} align={block.align} buttons={block.buttons} />;
          case 'slideshow':
            return <SlideshowPreviewBlock key={key} items={block.items} />;
          case 'media': {
            const cleanMediaUrl = normalizeProTalkMediaUrl(block.url) || block.url;
            if (block.mediaKind === 'document') {
              return <RichDocumentPreview key={key} url={cleanMediaUrl} caption={block.caption} />;
            }
            if (block.mediaKind === 'video') {
              return <RichVideoPreview key={key} url={cleanMediaUrl} caption={block.caption} />;
            }
            if (block.mediaKind === 'audio' || block.mediaKind === 'voice') {
              return (
                <RichAudioPreview
                  key={key}
                  url={cleanMediaUrl}
                  caption={block.caption}
                  isVoice={block.mediaKind === 'voice'}
                />
              );
            }
            return (
              <figure
                key={key}
                className="my-3 rounded-2xl overflow-hidden border border-pink-200/80 bg-white/80 shadow-2xs p-1 flex flex-col items-center"
              >
                <CachedMediaImage
                  src={cleanMediaUrl}
                  alt={block.caption || 'Иллюстрация'}
                  className="w-auto max-w-full max-h-80 object-contain rounded-xl mx-auto"
                />
                {block.caption && (
                  <figcaption className="w-full px-3 py-1.5 text-[14px] text-slate-700 border-t border-pink-200/70 text-center">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }
          case 'table':
            return (
              <div key={key} className="my-3 overflow-x-auto rounded-2xl border border-pink-300/80">
                <table className="w-full text-[14px] border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-sky-200/80 via-pink-200/80 via-orange-200/80 to-sky-200/80 text-slate-900">
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          className={`px-3 py-2 font-bold border-b border-pink-300/70 ${
                            block.alignments[hIdx] === 'center'
                              ? 'text-center'
                              : block.alignments[hIdx] === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {renderFormattedText(h, isRich)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((r, rIdx) => (
                      <tr key={rIdx} className="odd:bg-white/75 even:bg-pink-50/55">
                        {r.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 border-b border-pink-200/60 ${
                              block.alignments[cIdx] === 'center'
                                ? 'text-center'
                                : block.alignments[cIdx] === 'right'
                                ? 'text-right'
                                : 'text-left'
                            }`}
                          >
                            {renderFormattedText(cell, isRich)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'checklist':
            return (
              <div key={key} className="space-y-2 my-2.5">
                {block.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 border ${
                        item.checked
                          ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 border-pink-500 text-white shadow-2xs'
                          : 'bg-white/90 border-pink-300 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className={item.checked ? 'line-through text-slate-600' : 'text-slate-900'}>
                      {renderFormattedText(item.text, isRich)}
                    </span>
                  </div>
                ))}
              </div>
            );
          case 'ul':
            return (
              <ul key={key} className="space-y-1 my-2 pl-4 list-disc marker:text-pink-600">
                {block.items.map((it, idx) => (
                  <li key={idx} className="text-[14px]">
                    {renderFormattedText(it, isRich)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="space-y-1 my-2 pl-5 list-decimal marker:text-pink-600 marker:font-bold">
                {block.items.map((it, idx) => (
                  <li key={idx} className="text-[14px]">
                    {renderFormattedText(it, isRich)}
                  </li>
                ))}
              </ol>
            );
          case 'footnote_def':
            return (
              <div
                key={key}
                className="text-[14px] text-slate-700 pl-3 border-l-2 border-pink-300 bg-white/55 py-1 rounded-r-lg"
              >
                <strong className="text-pink-700 mr-1.5">[{block.id}]</strong>
                {renderFormattedText(block.text, isRich)}
              </div>
            );
          case 'paragraph':
          default:
            return (
              <div key={key} className="whitespace-pre-wrap text-[14px] leading-relaxed">
                {renderFormattedText(block.text, isRich)}
              </div>
            );
        }
      })}
    </div>
  );
};
