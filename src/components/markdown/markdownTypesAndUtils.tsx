import React, { useState } from 'react';
import { Code, Copy, Check, Clock, ExternalLink } from 'lucide-react';
import {
  RichButtonChip,
  parseTgButtonElement
} from '../post-editor/preview/RichButtonsAndMediaPreview';
import { CachedMediaImage } from '../CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';
import { repairMalformedInlineHtmlTags } from '../../utils/formatting/postTitleAndTagHelpers';

export interface MarkdownRendererProps {
  content: string;
  format?: 'v2' | 'rich' | 'markdown' | 'html' | 'auto';
  isCompact?: boolean;
  maxLines?: number;
  attachmentType?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string; callbackData?: string; style?: string; color?: string; type?: string }>>;
  signature?: string;
  uppercaseHeader?: boolean;
}

export interface ParsedRichBlock {
  type: string;
  [key: string]: any;
}

export interface V2Block {
  type: 'empty' | 'quote' | 'expandable_quote' | 'codeblock' | 'line' | 'image';
  content?: string;
  code?: string;
  lang?: string;
  url?: string;
  alt?: string;
}

export function getInlineButtonStyleClasses(style?: string, color?: string): string {
  const s = String(style || color || 'default').toLowerCase().trim();
  switch (s) {
    case 'primary':
    case 'blue':
      return 'bg-sky-500 hover:bg-sky-600 text-white border border-sky-600 shadow-2xs';
    case 'danger':
    case 'red':
      return 'bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 shadow-2xs';
    case 'success':
    case 'green':
      return 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 hover:brightness-105 text-white border border-pink-300 shadow-2xs';
    case 'orange':
    case 'amber':
      return 'bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 shadow-2xs';
    case 'brand':
    case 'gradient':
      return 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white border border-pink-300 shadow-2xs';
    case 'default':
    default:
      return 'bg-slate-200/90 hover:bg-slate-200 text-slate-900 border border-slate-300 shadow-2xs';
  }
}

export function LightTelegramSpoiler({ children }: { children: React.ReactNode; [key: string]: any }) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setIsRevealed(prev => !prev);
      }}
      className={`relative inline-block cursor-pointer select-none transition-all duration-200 rounded-md align-middle mx-0.5 ${
        isRevealed
          ? 'bg-pink-100/90 border border-pink-300 text-slate-900 px-1.5 py-0.5'
          : 'bg-gradient-to-r from-sky-200 via-pink-200 to-orange-200 text-transparent border border-pink-300 px-2 py-0.5 overflow-hidden shadow-2xs'
      }`}
      title={isRevealed ? 'Спойлер открыт (нажмите, чтобы скрыть)' : 'Нажмите, чтобы прочитать спойлер'}
    >
      {!isRevealed && (
        <span
          className="absolute inset-0 pointer-events-none opacity-80 animate-pulse flex items-center justify-center text-pink-600 text-[14px] font-bold"
          style={{
            backgroundImage: 'radial-gradient(#ec4899 1.5px, transparent 1.5px)',
            backgroundSize: '5px 5px',
          }}
        >
          🔒
        </span>
      )}
      <span className={isRevealed ? '' : 'invisible'}>
        {children}
      </span>
    </span>
  );
}

export function LightTelegramCodeBlock({ code, lang, isCompact = false }: { code: string; lang?: string; isCompact?: boolean; [key: string]: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleCopy}
      title="нажмите на блок для копирования кода"
      className={`${isCompact ? 'my-1.5' : 'my-2.5'} rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 backdrop-blur-xs overflow-hidden shadow-2xs cursor-pointer hover:border-pink-400 transition-all group`}
    >
      <div className={`flex items-center justify-between ${isCompact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'} bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 to-sky-100/90 border-b border-pink-200 text-[14px] font-mono text-slate-800 font-bold`}>
        <span className="flex items-center space-x-1.5">
          <Code size={14} className="text-pink-600 shrink-0" />
          <span className="text-[14px] font-bold text-slate-800 lowercase">{lang || 'код'}</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1.5 text-pink-700 hover:text-pink-900 font-bold cursor-pointer px-2.5 py-0.5 rounded-xl bg-white/90 hover:bg-white border border-pink-200 shadow-2xs transition-all text-[14px]"
        >
          {copied ? (
            <>
              <Check size={14} className="text-pink-600 shrink-0" />
              <span className="text-pink-700 font-bold text-[14px]">скопировано</span>
            </>
          ) : (
            <>
              <Copy size={14} className="text-pink-600 shrink-0" />
              <span className="text-[14px]">копировать</span>
            </>
          )}
        </button>
      </div>
      <pre className={`${isCompact ? 'p-2.5 max-h-24' : 'p-3.5'} text-[14px] font-mono text-slate-900 overflow-x-auto whitespace-pre-wrap select-all bg-white/80 leading-relaxed font-medium`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function isTableDelimiterRow(lineStr?: string): boolean {
  if (!lineStr) return false;
  const trimmed = lineStr.trim();
  if (!trimmed) return false;
  if (!/^\|?(\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?$/.test(trimmed) &&
      !/^:?-{1,}:?(\s*\|\s*:?-{1,}:?)+$/.test(trimmed)) {
    return false;
  }
  return true;
}

export function formatTelegramInline(text: string, format: 'v2' | 'rich' = 'rich'): React.ReactNode {
  if (!text) return null;

  let cleaned = text;
  if (format === 'v2') {
    cleaned = cleaned.replace(/\\([_*\[\]()~`>#+\-=|{}.!\\])/g, '$1');
  }
  cleaned = repairMalformedInlineHtmlTags(cleaned);

  const regex =
    /(```[\s\S]*?```|`[^`\n]+`|\|\|[\s\S]+?\|\||<tg-spoiler>[\s\S]*?<\/tg-spoiler>|__[^_\n]+__|<u>[\s\S]+?<\/u>|<ins>[\s\S]+?<\/ins>|(?:\*\*[^*\n]+\*\*|\*[^*\n]+\*)|<b>[\s\S]+?<\/b>|<strong>[\s\S]+?<\/strong>|(?:~~[^~\n]+~~|~[^~\n]+~)|<s>[\s\S]+?<\/s>|<del>[\s\S]+?<\/del>|<strike>[\s\S]+?<\/strike>|(?<!\w)_[^_\n]+_(?!\w)|<i>[\s\S]+?<\/i>|<em>[\s\S]+?<\/em>|!?\[[^\]]*\]\(tg:\/\/emoji\?[^\)]+\)|<tg-emoji[\s\S]*?<\/tg-emoji>|<tg-time[\s\S]*?<\/tg-time>|<tg-button\b[^>]*>[\s\S]*?<\/tg-button>|!\[[^\]]*\]\([^\)]+\)|\[[\u200B\s]*\]\(https?:\/\/[^\s\)]+\)|\[[^\]]+\]\([^\)]+\)|<a\s+[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>|\$\$[\s\S]+?\$\$|\$[^\$\n]+\$)/gi;

  const parts = cleaned.split(regex);

  return (
    <span className={cleaned.includes('\n') ? 'whitespace-pre-wrap' : undefined}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
          const innerCode = part.slice(3, -3);
          const langMatch = innerCode.match(/^([a-zA-Z0-9_-]+)[ \t]*\n([\s\S]*)$/);
          const codeLang = langMatch ? langMatch[1] : undefined;
          const rawCode = (langMatch ? langMatch[2] : innerCode).replace(/^\n+|\n+$/g, '');
          return <LightTelegramCodeBlock key={index} code={rawCode} lang={codeLang} />;
        }

        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          const content = part.slice(1, -1);
          return (
            <code key={index} className="bg-white/80 text-pink-700 font-mono text-[14px] px-2 py-0.5 rounded-lg border border-pink-300 shadow-2xs select-all font-semibold mx-0.5">
              {content}
            </code>
          );
        }

        const spoilerHtmlM = part.match(/^<tg-spoiler>([\s\S]*)<\/tg-spoiler>$/i);
        if ((part.startsWith('||') && part.endsWith('||') && part.length >= 4) || spoilerHtmlM) {
          const content = spoilerHtmlM ? spoilerHtmlM[1] : part.slice(2, -2);
          return (
            <LightTelegramSpoiler key={index}>
              {formatTelegramInline(content, format)}
            </LightTelegramSpoiler>
          );
        }

        const underlineHtmlM = part.match(/^<(u|ins)>([\s\S]*)<\/\1>$/i);
        if ((part.startsWith('__') && part.endsWith('__') && part.length >= 4) || underlineHtmlM) {
          const content = underlineHtmlM ? underlineHtmlM[2] : part.slice(2, -2);
          return (
            <span key={index} className="underline decoration-pink-500 decoration-2 font-medium">
              {formatTelegramInline(content, format)}
            </span>
          );
        }

        const boldHtmlM = part.match(/^<(b|strong)>([\s\S]*)<\/\1>$/i);
        if (
          (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
          boldHtmlM ||
          (part.startsWith('*') && part.endsWith('*') && part.length >= 2)
        ) {
          const content = boldHtmlM
            ? boldHtmlM[2]
            : part.startsWith('**')
            ? part.slice(2, -2)
            : part.slice(1, -1);
          return (
            <strong key={index} className="font-extrabold text-slate-950">
              {formatTelegramInline(content, format)}
            </strong>
          );
        }

        const strikeHtmlM = part.match(/^<(s|del|strike)>([\s\S]*)<\/\1>$/i);
        if (
          (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) ||
          strikeHtmlM ||
          (part.startsWith('~') && part.endsWith('~') && part.length >= 2)
        ) {
          const content = strikeHtmlM
            ? strikeHtmlM[2]
            : part.startsWith('~~')
            ? part.slice(2, -2)
            : part.slice(1, -1);
          return (
            <del key={index} className="line-through text-slate-500 font-medium">
              {formatTelegramInline(content, format)}
            </del>
          );
        }

        const italicHtmlM = part.match(/^<(i|em)>([\s\S]*)<\/\1>$/i);
        if ((part.startsWith('_') && part.endsWith('_') && part.length >= 2) || italicHtmlM) {
          const content = italicHtmlM ? italicHtmlM[2] : part.slice(1, -1);
          return (
            <em key={index} className="italic text-slate-800 font-medium">
              {formatTelegramInline(content, format)}
            </em>
          );
        }

        if (part.includes('tg://emoji') || part.includes('<tg-emoji')) {
          let emojiChar = '✨';
          let emojiId = '';
          const mdEmojiMatch = part.match(/^!?\[(.*?)\]\(tg:\/\/emoji\?id=(\d+)\)$/);
          if (mdEmojiMatch) {
            emojiChar = mdEmojiMatch[1] || '✨';
            emojiId = mdEmojiMatch[2] || '';
          } else {
            const htmlEmojiMatch = part.match(/<tg-emoji.*?emoji-id=["']?(\d+)["']?>(.*?)<\/tg-emoji>/i);
            if (htmlEmojiMatch) {
              emojiId = htmlEmojiMatch[1] || '';
              emojiChar = htmlEmojiMatch[2] || '✨';
            }
          }

          return (
            <span
              key={index}
              className="inline-flex items-center space-x-1 bg-white/95 border border-pink-300 px-1.5 py-0.5 rounded-lg text-pink-700 font-bold text-[14px] shadow-2xs mx-0.5 align-middle"
              title={`Telegram Premium Emoji ID: ${emojiId}`}
            >
              <span>{emojiChar}</span>
              <span className="text-[14px] text-pink-500">💎</span>
            </span>
          );
        }

        if (part.includes('<tg-time')) {
          const timeMatch = part.match(/<tg-time.*?>(.*?)<\/tg-time>/i);
          const timeLabel = timeMatch ? timeMatch[1] : 'Время';
          return (
            <span key={index} className="inline-flex items-center space-x-1 bg-white/95 border border-pink-300 px-2 py-0.5 rounded-lg text-pink-700 font-mono text-[14px] font-semibold shadow-2xs mx-0.5 align-middle">
              <Clock size={14} className="text-pink-600 shrink-0" />
              <span>{timeLabel}</span>
            </span>
          );
        }

        if (/^<tg-button\b/i.test(part)) {
          const parsedBtn = parseTgButtonElement(part);
          if (parsedBtn) {
            return <RichButtonChip key={index} btn={parsedBtn} inline />;
          }
        }

        if (part.startsWith('![') || /^\[[\u200B\s]*\]\(https?:/i.test(part)) {
          const imgMatch = part.match(/^!\[(.*?)\]\s*\((https?:\/\/[^\s\)]+)(?:\s+"(.*?)")?\)$/) ||
                           part.match(/^!\[(.*?)\]\s*\(([^\)]+)\)$/) ||
                           part.match(/^\[[\u200B\s]*\]\s*\((https?:\/\/[^\s\)]+)\)$/);
          if (imgMatch) {
            const url = normalizeProTalkMediaUrl(imgMatch[2] || (imgMatch[1]?.startsWith('http') ? imgMatch[1] : '')) || '';
            const alt = imgMatch[2] ? (imgMatch[1] || '') : '';
            if (url && !url.startsWith('tg://emoji')) {
              return (
                <div key={index} className="my-2 max-w-full rounded-2xl overflow-hidden bg-white/90 border border-pink-200 shadow-2xs p-1 text-center">
                  <CachedMediaImage
                    src={url}
                    alt={alt || 'Изображение'}
                    className="w-auto max-w-full max-h-80 sm:max-h-96 object-contain rounded-xl mx-auto shadow-2xs block"
                  />
                  {alt && alt.trim() && alt !== 'alt' && (
                    <div className="text-center text-[14px] text-slate-700 font-medium py-1 px-3">
                      {alt}
                    </div>
                  )}
                </div>
              );
            }
          }
        }

        if ((part.startsWith('[') && part.includes('](') && part.endsWith(')')) ||
            (part.startsWith('<a') && part.includes('href=') && part.endsWith('</a>'))) {
          let label = '';
          let url = '';
          const mdLinkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
          if (mdLinkMatch) {
            label = mdLinkMatch[1];
            url = mdLinkMatch[2];
          } else {
            const htmlLinkMatch = part.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
            if (htmlLinkMatch) {
              url = htmlLinkMatch[1];
              label = htmlLinkMatch[2];
            }
          }

          if (url) {
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-pink-600 font-bold underline decoration-pink-300 hover:text-pink-800 hover:decoration-pink-600 transition-colors inline-flex items-center gap-0.5"
              >
                <span>{label || url}</span>
                <ExternalLink size={12} className="shrink-0 text-pink-500" />
              </a>
            );
          }
        }

        if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
          const content = part.slice(2, -2).trim();
          return (
            <span key={index} className="my-1.5 px-3 py-1.5 rounded-xl bg-white/95 border border-pink-300 font-mono text-[14px] text-pink-700 shadow-2xs font-bold inline-block overflow-x-auto text-center">
              $${content}$$
            </span>
          );
        }

        if (part.startsWith('$') && part.endsWith('$') && part.length >= 2 && !part.startsWith('$$')) {
          const content = part.slice(1, -1);
          return (
            <code key={index} className="bg-pink-50 text-pink-700 font-mono text-[14px] px-2 py-0.5 rounded-lg border border-pink-300 shadow-2xs font-semibold mx-0.5">
              ${content}$
            </code>
          );
        }

        const urlSegments = part.split(/(https?:\/\/[^\s<>"')]+)/g);
        if (urlSegments.length > 1) {
          return (
            <React.Fragment key={index}>
              {urlSegments.map((seg, sIdx) =>
                /^https?:\/\//i.test(seg) ? (
                  <a
                    key={sIdx}
                    href={seg}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 hover:text-pink-600 underline decoration-pink-300 font-semibold break-all"
                  >
                    {seg}
                  </a>
                ) : (
                  <React.Fragment key={sIdx}>{seg}</React.Fragment>
                )
              )}
            </React.Fragment>
          );
        }

        return part;
      })}
    </span>
  );
}
