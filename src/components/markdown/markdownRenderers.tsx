import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Film,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  RichAudioPreview,
  RichButtonRowPreview,
  RichDocumentPreview,
  RichVideoPreview
} from '../post-editor/preview/RichButtonsAndMediaPreview';
import { isVideoMediaUrl } from '../../utils/urlUtils';
import { CachedMediaImage } from '../CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';
import { LightTelegramCodeBlock, formatTelegramInline } from './markdownTypesAndUtils';
import { parseRichBlocks, parseV2Blocks } from './markdownParsers';

export function renderV2Mode(text: string, isCompact: boolean = false) {
  const blocks = parseV2Blocks(text);
  const displayBlocks = isCompact ? blocks.slice(0, 5) : blocks;

  return (
    <div className={isCompact ? 'space-y-1' : 'space-y-1.5'}>
      {displayBlocks.map((block, bIdx) => {
        if (block.type === 'empty') {
          return <div key={bIdx} className={isCompact ? 'h-1' : 'h-2'} />;
        }

        if (block.type === 'codeblock') {
          return <LightTelegramCodeBlock key={bIdx} code={block.code || ''} lang={block.lang} isCompact={isCompact} />;
        }

        if (block.type === 'expandable_quote') {
          return (
            <details
              key={bIdx}
              className="group border-l-3 border-orange-400 pl-3 py-1 my-1 bg-gradient-to-r from-sky-50/70 via-pink-50/70 to-orange-50/70 text-slate-800 italic rounded-r-xl font-medium shadow-2xs text-[14px]"
            >
              <summary className="cursor-pointer select-none font-bold text-pink-700 flex items-center justify-between text-[14px] py-0.5">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="text-orange-500 font-bold text-[14px] shrink-0">▼</span>
                  <span className="truncate">{block.content || 'свернутая цитата'}</span>
                </span>
                <span className="text-[14px] text-pink-500 font-semibold px-2 py-0.5 rounded-lg bg-pink-100/70 shrink-0 ml-2">свернуто</span>
              </summary>
              <div className="mt-1 pt-1 border-t border-pink-100 text-slate-800 not-italic">
                {formatTelegramInline(block.content || '', 'v2')}
              </div>
            </details>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={bIdx}
              className="border-l-3 border-pink-500 pl-3 py-1 my-1 bg-white/70 text-slate-800 italic rounded-r-xl font-medium shadow-2xs text-[14px]"
            >
              {formatTelegramInline(block.content || '', 'v2')}
            </blockquote>
          );
        }

        if (block.type === 'image' && block.url) {
          const cleanUrl = normalizeProTalkMediaUrl(block.url) || block.url;
          return (
            <div key={bIdx} className="my-2 max-w-full rounded-2xl overflow-hidden bg-white/90 border border-pink-200 shadow-2xs p-1 text-center">
              <CachedMediaImage
                src={cleanUrl}
                alt={block.alt || 'Изображение'}
                className={isCompact
                  ? "w-auto max-w-full max-h-36 sm:max-h-44 object-contain rounded-lg mx-auto shadow-2xs block"
                  : "w-auto max-w-full max-h-80 sm:max-h-96 object-contain rounded-xl mx-auto shadow-2xs block"}
              />
              {!isCompact && block.alt && block.alt.trim() && block.alt !== 'alt' && (
                <div className="text-center text-[14px] text-slate-700 font-medium py-1 px-3">
                  {block.alt}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={bIdx} className="leading-relaxed text-slate-900 break-words font-sans text-[14px]">
            {formatTelegramInline(block.content || '', 'v2')}
          </div>
        );
      })}
      {isCompact && blocks.length > 5 && (
        <div className="text-[14px] text-pink-600 font-medium italic pt-0.5">...ещё {blocks.length - 5} блоков</div>
      )}
    </div>
  );
}

export function renderRichMode(
  text: string,
  slideshowIdxs: Record<number, number>,
  setSlideIdx: (bIdx: number, nIdx: number) => void,
  isCompact: boolean
) {
  const blocks = parseRichBlocks(text);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'empty':
            return <div key={idx} className="h-1.5" />;

          case 'h1':
            return (
              <h1 key={idx} className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent pt-2 pb-0.5">
                {formatTelegramInline(block.content, 'rich')}
              </h1>
            );

          case 'h2':
            return (
              <h2 key={idx} className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent pt-1.5 pb-0.5">
                {formatTelegramInline(block.content, 'rich')}
              </h2>
            );

          case 'h3':
            return (
              <h3 key={idx} className="text-[15px] sm:text-[16px] font-bold text-pink-700 pt-1 pb-0.5">
                {formatTelegramInline(block.content, 'rich')}
              </h3>
            );

          case 'h4':
            return (
              <h4 key={idx} className="text-[14px] sm:text-[15px] font-bold text-sky-700 pt-0.5 pb-0.5">
                {formatTelegramInline(block.content, 'rich')}
              </h4>
            );

          case 'details':
            return (
              <details key={idx} open className="bg-white/90 border border-pink-300 rounded-2xl p-3 my-2 group cursor-pointer shadow-2xs">
                <summary className="font-bold text-pink-700 select-none flex items-center justify-between text-[14px] sm:text-[15px]">
                  <span>{block.summary}</span>
                </summary>
                <div className="mt-2.5 pt-2 border-t border-pink-100 text-slate-800 space-y-1.5 leading-relaxed text-[14px]">
                  {formatTelegramInline(block.content, 'rich')}
                </div>
              </details>
            );

          case 'blockquote':
            if (block.expandable) {
              return (
                <details key={idx} className="group border-l-3 border-orange-400 pl-3 py-2 my-2 bg-gradient-to-r from-sky-50/80 via-pink-50/80 to-orange-50/80 rounded-r-2xl shadow-2xs text-[14px]">
                  <summary className="cursor-pointer font-bold text-pink-700 select-none flex items-center justify-between text-[14px] py-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-orange-500 font-bold text-[14px]">▼</span>
                      <span>{block.content.split('\n')[0] || 'Цитата (свернуто)'}</span>
                    </span>
                    <span className="text-[14px] text-pink-500 font-semibold px-2 py-0.5 rounded-lg bg-pink-100/80">развернуть</span>
                  </summary>
                  <div className="mt-2 pt-2 border-t border-pink-100 text-slate-800 italic space-y-1">
                    <div>{formatTelegramInline(block.content, 'rich')}</div>
                    {block.cite && (
                      <div className="not-italic text-[14px] font-bold text-pink-700 pt-1 border-t border-pink-100 flex items-center space-x-1">
                        <span>—</span>
                        <span>{block.cite}</span>
                      </div>
                    )}
                  </div>
                </details>
              );
            }
            return (
              <div key={idx} className="border-l-3 border-pink-500 pl-3 py-2 my-2 bg-white/80 rounded-r-2xl text-slate-800 italic space-y-1 shadow-2xs text-[14px]">
                <div>{formatTelegramInline(block.content, 'rich')}</div>
                {block.cite && (
                  <div className="not-italic text-[14px] font-bold text-pink-700 pt-1 border-t border-pink-100 flex items-center space-x-1">
                    <span>—</span>
                    <span>{block.cite}</span>
                  </div>
                )}
              </div>
            );

          case 'collage':
            if (!block.urls || block.urls.length === 0) return null;
            return (
              <div key={idx} className="my-2.5 space-y-1">
                <div className="text-[14px] text-pink-700 font-mono font-bold flex items-center space-x-1">
                  <ImageIcon size={14} />
                  <span>Коллаж ({block.urls.length} медиа):</span>
                </div>
                <div className={`grid gap-1.5 rounded-2xl overflow-hidden ${
                  block.urls.length === 1 ? 'grid-cols-1' : block.urls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                }`}>
                  {block.urls.map((url: string, i: number) => {
                    const cleanUrl = normalizeProTalkMediaUrl(url) || url;
                    return (
                      <div key={i} className="aspect-video bg-white/90 overflow-hidden relative rounded-xl border border-pink-200">
                        {isVideoMediaUrl(cleanUrl) ? (
                          <video src={cleanUrl} controls muted playsInline preload="metadata" className="w-full h-full object-cover" />
                        ) : (
                          <CachedMediaImage src={cleanUrl} alt={`collage-${i}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );

          case 'button_row':
            return <RichButtonRowPreview key={idx} align={block.align} buttons={block.buttons} />;

          case 'document':
            return <RichDocumentPreview key={idx} url={block.url} caption={block.caption} />;

          case 'video':
            return <RichVideoPreview key={idx} url={block.url} caption={block.caption} />;

          case 'audio':
            return <RichAudioPreview key={idx} url={block.url} caption={block.caption} isVoice={Boolean(block.isVoice)} />;

          case 'image': {
            const cleanUrl = normalizeProTalkMediaUrl(block.url) || block.url;
            return (
              <div key={idx} className="my-2 max-w-full rounded-2xl overflow-hidden bg-white/90 border border-pink-200 shadow-2xs p-1 text-center">
                <CachedMediaImage
                  src={cleanUrl}
                  alt={block.alt || 'Изображение'}
                  className={isCompact
                    ? "w-auto max-w-full max-h-36 sm:max-h-44 object-contain rounded-lg mx-auto shadow-2xs block"
                    : "w-auto max-w-full max-h-80 sm:max-h-96 object-contain rounded-xl mx-auto shadow-2xs block"}
                />
                {!isCompact && block.alt && block.alt.trim() && block.alt !== 'alt' && (
                  <div className="text-center text-[14px] text-slate-700 font-medium py-1 px-3">
                    {block.alt}
                  </div>
                )}
              </div>
            );
          }

          case 'slideshow': {
            if (!block.urls || block.urls.length === 0) return null;
            const currentIdx = slideshowIdxs[idx] || 0;
            const currentSlideUrl = normalizeProTalkMediaUrl(block.urls[currentIdx]) || block.urls[currentIdx];
            return (
              <div key={idx} className="my-2.5 space-y-1.5 bg-white/90 p-2.5 rounded-2xl border border-pink-300 shadow-2xs">
                <div className="flex items-center justify-between text-[14px] text-pink-700 font-mono">
                  <span className="flex items-center space-x-1 font-bold">
                    <ImageIcon size={14} />
                    <span>Слайдер фото и видео</span>
                  </span>
                  <span className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded-lg border border-pink-200 font-bold">
                    {currentIdx + 1} / {block.urls.length}
                  </span>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-sky-50/80 via-pink-50/80 to-orange-50/80 flex items-center justify-center border border-pink-200">
                  {isVideoMediaUrl(currentSlideUrl) ? (
                    <video src={currentSlideUrl} controls muted playsInline className="w-full h-full object-contain" />
                  ) : (
                    <CachedMediaImage src={currentSlideUrl} alt="slide" className="w-full h-full object-contain" />
                  )}
                  {block.urls.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideIdx(idx, (currentIdx - 1 + block.urls.length) % block.urls.length);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-1.5 rounded-full cursor-pointer shadow-md border border-pink-200"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideIdx(idx, (currentIdx + 1) % block.urls.length);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-1.5 rounded-full cursor-pointer shadow-md border border-pink-200"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          }

          case 'codeblock':
            return <LightTelegramCodeBlock key={idx} code={block.code} lang={block.lang} />;

          case 'formula_block':
            return (
              <div key={idx} className="my-2.5 p-3 rounded-2xl border border-pink-300 bg-white/95 text-pink-700 font-mono text-[14px] text-center shadow-2xs font-bold overflow-x-auto">
                $${block.formula}$$
              </div>
            );

          case 'table':
            return (
              <div key={idx} className="overflow-x-auto my-2.5 rounded-2xl border border-pink-300 bg-white/95 shadow-2xs">
                <table className="w-full text-[14px] border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 to-sky-100 font-black text-slate-900 border-b border-pink-300">
                      {block.headers.map((h: string, hIdx: number) => {
                        const align = block.alignments?.[hIdx] || 'left';
                        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                        return (
                          <th key={hIdx} className={`p-2.5 border-r border-pink-200 last:border-r-0 font-bold text-slate-900 ${alignClass}`}>
                            {formatTelegramInline(h, 'rich')}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-t border-pink-100 hover:bg-pink-50/40 transition-colors even:bg-pink-50/20">
                        {row.map((cell: string, cIdx: number) => {
                          const align = block.alignments?.[cIdx] || 'left';
                          const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                          return (
                            <td key={cIdx} className={`p-2.5 border-r border-pink-100 last:border-r-0 text-slate-800 ${alignClass}`}>
                              {formatTelegramInline(cell, 'rich')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'list':
            return (
              <div key={idx} className="space-y-1.5 my-1.5 pl-1">
                {block.items.map((it: any, iIdx: number) => {
                  if (it.kind === 'task-done') {
                    return (
                      <div key={iIdx} className="flex items-start space-x-2 text-slate-900 font-medium">
                        <CheckSquare size={16} className="text-pink-600 shrink-0 mt-0.5" />
                        <span className="line-through text-slate-500">{formatTelegramInline(it.text, 'rich')}</span>
                      </div>
                    );
                  }
                  if (it.kind === 'task') {
                    return (
                      <div key={iIdx} className="flex items-start space-x-2 text-slate-900 font-medium">
                        <Square size={16} className="text-pink-400 shrink-0 mt-0.5" />
                        <span>{formatTelegramInline(it.text, 'rich')}</span>
                      </div>
                    );
                  }
                  if (it.kind === 'ordered') {
                    return (
                      <div key={iIdx} className="flex items-start space-x-2 text-slate-900 font-medium pl-1">
                        <span className="font-mono font-bold text-pink-600 shrink-0">{it.num}.</span>
                        <span>{formatTelegramInline(it.text, 'rich')}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={iIdx} className="flex items-start space-x-2 text-slate-900 font-medium pl-1">
                      <span className="text-pink-500 font-bold shrink-0">•</span>
                      <span>{formatTelegramInline(it.text, 'rich')}</span>
                    </div>
                  );
                })}
              </div>
            );

          case 'paragraph':
          default:
            return (
              <div key={idx} className="space-y-1">
                {block.lines.map((line: string, lIdx: number) => (
                  <div key={lIdx} className="leading-relaxed text-slate-900 break-words font-sans">
                    {formatTelegramInline(line, 'rich')}
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}

export function renderMediaAttachment(type: string, mediaList: string[], isCompact: boolean) {
  if (type === 'none' || !mediaList || mediaList.length === 0) return null;

  if (type === 'photo') {
    const cleanPhoto = normalizeProTalkMediaUrl(mediaList[0]) || mediaList[0];
    return (
      <div className={`overflow-hidden rounded-2xl border border-pink-200/80 bg-white/90 shadow-2xs flex justify-center p-1 ${
        isCompact ? 'max-h-36' : 'max-h-80'
      }`}>
        <CachedMediaImage
          src={cleanPhoto}
          alt="Вложение"
          className={`w-auto max-w-full object-contain rounded-xl mx-auto ${isCompact ? 'max-h-32' : 'max-h-72'}`}
        />
      </div>
    );
  }

  if (type === 'album') {
    return (
      <div className={`grid gap-1.5 rounded-2xl overflow-hidden border border-pink-200/80 p-1 bg-white/90 shadow-2xs ${
        mediaList.length === 2 ? 'grid-cols-2' : mediaList.length >= 3 ? 'grid-cols-3' : 'grid-cols-1'
      }`}>
        {mediaList.slice(0, isCompact ? 3 : 6).map((mediaUrl, i) => {
          const cleanMediaUrl = normalizeProTalkMediaUrl(mediaUrl) || mediaUrl;
          return (
            <div key={i} className={`relative overflow-hidden rounded-xl bg-sky-50/70 ${
              isCompact ? 'h-20' : 'h-32'
            }`}>
              {isVideoMediaUrl(cleanMediaUrl) ? (
                <video
                  src={cleanMediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              ) : (
                <CachedMediaImage
                  src={cleanMediaUrl}
                  alt={`Медиа ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              {isCompact && i === 2 && mediaList.length > 3 && (
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/80 via-pink-500/80 to-orange-500/80 flex items-center justify-center text-white font-bold text-[14px]">
                  +{mediaList.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'video') {
    return isCompact ? (
      <div className="flex items-center space-x-2 p-2 bg-pink-50/90 border border-pink-200/80 rounded-xl text-[14px] text-pink-700 font-bold">
        <Video size={14} className="text-pink-600 shrink-0" />
        <span className="truncate">Видеозапись</span>
      </div>
    ) : (
      <div className="rounded-2xl overflow-hidden border border-pink-200/80 bg-gradient-to-br from-sky-50/80 via-pink-50/80 to-orange-50/80 shadow-2xs max-h-80">
        <video controls src={mediaList[0]} className="w-full h-full max-h-80 object-contain" />
      </div>
    );
  }

  if (type === 'video_note' || type === 'round') {
    return (
      <div className="flex items-center space-x-2.5 p-2 bg-sky-50/90 border border-sky-200/80 rounded-2xl">
        <div className="w-10 h-10 rounded-full border-2 border-pink-400 overflow-hidden shrink-0 bg-gradient-to-br from-sky-100 via-pink-100 to-orange-100 flex items-center justify-center">
          {mediaList[0] ? (
            <video src={mediaList[0]} className="w-full h-full object-cover" />
          ) : (
            <Film size={16} className="text-pink-500" />
          )}
        </div>
        <div className="min-w-0">
          <span className="text-[14px] font-bold text-slate-800 block">Кружок (Video Note)</span>
          <span className="text-[14px] text-pink-600 truncate block">Круглое видеосообщение</span>
        </div>
      </div>
    );
  }

  if (type === 'audio' || type === 'voice') {
    return isCompact ? (
      <div className="flex items-center space-x-2 p-2 bg-orange-50/90 border border-orange-200/80 rounded-xl text-[14px] text-orange-800 font-bold">
        <Music size={14} className="text-orange-500 shrink-0" />
        <span className="truncate">Аудиозапись / Голос ({mediaList.length} шт.)</span>
      </div>
    ) : (
      <div className="p-3 bg-white/90 border border-pink-200/80 rounded-2xl shadow-2xs space-y-2">
        <span className="text-[14px] font-bold text-pink-700 flex items-center space-x-1.5">
          <Music size={14} className="text-pink-500" />
          <span>Аудиовложения ({mediaList.length}):</span>
        </span>
        <div className="space-y-1.5">
          {mediaList.map((aud, idx) => (
            <audio key={idx} controls src={aud} className="w-full h-8" />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'document' || type === 'file') {
    return (
      <div className="p-2.5 bg-white/90 border border-pink-200/80 rounded-xl flex items-center space-x-2.5 text-[14px] text-slate-800 shadow-2xs">
        <FileText size={16} className="text-pink-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-bold truncate block">Документ ({mediaList.length} шт.)</span>
          <span className="text-[14px] text-slate-500 truncate block font-mono">{mediaList[0]}</span>
        </div>
      </div>
    );
  }

  return null;
}
