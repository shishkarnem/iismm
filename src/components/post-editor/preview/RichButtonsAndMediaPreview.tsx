import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, FileText, Mic, Music, Play, Video } from 'lucide-react';

export interface ParsedRichButton {
  text: string;
  type: 'url' | 'copy_text' | 'callback_data' | 'web_app' | 'disabled' | string;
  style?: 'primary' | 'success' | 'danger' | 'link' | string;
  url?: string;
  copyText?: string;
  callbackData?: string;
}

export function decodeHtmlAttr(val?: string): string {
  if (!val) return '';
  return val
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractTagAttr(tagStr: string, attrName: string): string {
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tagStr.match(regex);
  return decodeHtmlAttr((m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim());
}

export function parseTgButtonElement(rawTag: string): ParsedRichButton | null {
  const m = rawTag.match(/^<tg-button\b([^>]*)>([\s\S]*?)<\/tg-button>$/i);
  if (!m) return null;
  const attrs = m[1] || '';
  const inner = (m[2] || '').replace(/<[^>]+>/g, '').trim() || 'Кнопка';
  const type = (extractTagAttr(attrs, 'type') || (extractTagAttr(attrs, 'url') ? 'url' : 'callback_data')).toLowerCase();
  const style = (extractTagAttr(attrs, 'style') || '').toLowerCase();
  const url = extractTagAttr(attrs, 'url') || extractTagAttr(attrs, 'href');
  const copyText = extractTagAttr(attrs, 'copy-text') || extractTagAttr(attrs, 'copy_text');
  const callbackData = extractTagAttr(attrs, 'callback-data') || extractTagAttr(attrs, 'callback_data');

  return {
    text: inner,
    type,
    style: style || undefined,
    url: url || undefined,
    copyText: copyText || undefined,
    callbackData: callbackData || undefined
  };
}

/**
 * Strictly follows NO-GREEN palette rule:
 * Telegram's protocol attribute `style="success"` is rendered with the brand sky-pink-orange vivid gradient.
 */
export function getRichButtonVariantClasses(style?: string, disabled = false): string {
  if (disabled) {
    return 'bg-white/55 text-slate-500 border border-pink-200/80 cursor-not-allowed opacity-70';
  }
  const s = String(style || '').toLowerCase().trim();
  switch (s) {
    case 'primary':
      return 'bg-gradient-to-r from-sky-500 via-blue-500 to-sky-600 text-white border border-sky-400 shadow-2xs hover:brightness-105';
    case 'danger':
      return 'bg-gradient-to-r from-rose-500 via-pink-600 to-orange-500 text-white border border-rose-400 shadow-2xs hover:brightness-105';
    case 'link':
      return 'bg-white/85 hover:bg-white text-pink-700 border border-pink-300 shadow-2xs';
    case 'success':
    default:
      return 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-400 via-pink-500 to-sky-500 text-white border border-pink-300 shadow-2xs hover:brightness-105';
  }
}

export const RichButtonChip: React.FC<{
  btn: ParsedRichButton;
  inline?: boolean;
}> = ({ btn, inline = false }) => {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const isDisabled = btn.type === 'disabled';
  const variantCls = getRichButtonVariantClasses(btn.style, isDisabled);

  const handleClick = (e: React.MouseEvent) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    if (btn.type === 'copy_text') {
      e.preventDefault();
      const val = btn.copyText || btn.text;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(val).catch(() => {});
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      return;
    }
    if (btn.type === 'callback_data') {
      e.preventDefault();
      setNotice(`Действие: ${btn.callbackData || btn.text}`);
      setTimeout(() => setNotice(''), 1800);
      return;
    }
    if (!btn.url || btn.url === '#') {
      e.preventDefault();
    }
  };

  const sizeCls = inline
    ? 'inline-flex items-center gap-1.5 px-2.5 py-1 mx-0.5 rounded-xl text-[14px] font-bold align-middle max-w-full'
    : 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-[14px] font-bold flex-1 min-w-[120px] max-w-full';

  const content = (
    <>
      <span className="break-words text-center leading-snug">
        {copied ? 'Скопировано' : notice || btn.text}
      </span>
      {btn.type === 'copy_text' ? (
        copied ? <Check size={14} className="shrink-0" /> : <Copy size={14} className="shrink-0 opacity-90" />
      ) : (btn.type === 'url' || btn.type === 'web_app') && btn.url ? (
        <ExternalLink size={14} className="shrink-0 opacity-90" />
      ) : null}
    </>
  );

  if ((btn.type === 'url' || btn.type === 'web_app') && btn.url && !isDisabled) {
    return (
      <a
        href={btn.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`${sizeCls} ${variantCls} no-underline transition-all cursor-pointer`}
        title={btn.url}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      className={`${sizeCls} ${variantCls} transition-all ${isDisabled ? '' : 'cursor-pointer'}`}
      title={btn.copyText || btn.callbackData || btn.text}
    >
      {content}
    </button>
  );
};

export const RichButtonRowPreview: React.FC<{
  align?: 'left' | 'center' | 'right' | string;
  buttons: ParsedRichButton[];
}> = ({ align = 'left', buttons }) => {
  if (!buttons || buttons.length === 0) return null;
  const justifyCls =
    align === 'center'
      ? 'justify-center'
      : align === 'right'
      ? 'justify-end'
      : 'justify-start';

  return (
    <div className={`my-2.5 flex flex-wrap items-center gap-2 ${justifyCls}`}>
      {buttons.map((btn, idx) => (
        <RichButtonChip key={`${btn.text}_${idx}`} btn={btn} />
      ))}
    </div>
  );
};

function extractFilenameFromUrl(url: string): string {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const last = clean.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {}
  return 'Вложенный документ';
}

export const RichDocumentPreview: React.FC<{
  url: string;
  caption?: string;
}> = ({ url, caption }) => {
  const filename = extractFilenameFromUrl(url);
  return (
    <div className="my-2.5 p-3 rounded-2xl border border-pink-300/80 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900 break-words">
            {caption?.trim() || filename}
          </div>
          <div className="text-[14px] text-slate-600 truncate font-mono">{url}</div>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-pink-700 font-bold text-[14px] no-underline shrink-0 shadow-2xs"
      >
        <Download size={15} />
        <span>Открыть файл</span>
      </a>
    </div>
  );
};

export const RichVideoPreview: React.FC<{
  url: string;
  caption?: string;
}> = ({ url, caption }) => (
  <figure className="my-2.5 rounded-2xl overflow-hidden border border-pink-300/80 bg-gradient-to-br from-sky-100/75 via-pink-100/75 via-orange-100/75 to-sky-100/75 shadow-2xs">
    <div className="px-3 py-2 flex items-center gap-2 border-b border-pink-200/70 text-[14px] font-bold text-slate-900">
      <Video size={16} className="text-pink-600 shrink-0" />
      <span className="truncate">{caption?.trim() || 'Видеоролик в статье'}</span>
    </div>
    <video src={url} controls className="w-full max-h-72 object-contain bg-sky-50/70" />
  </figure>
);

export const RichAudioPreview: React.FC<{
  url: string;
  caption?: string;
  isVoice?: boolean;
}> = ({ url, caption, isVoice = false }) => (
  <div className="my-2.5 p-3 rounded-2xl border border-pink-300/80 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 space-y-2 shadow-2xs">
    <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
      <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shrink-0">
        {isVoice ? <Mic size={15} /> : <Music size={15} />}
      </span>
      <span className="break-words">
        {caption?.trim() || (isVoice ? 'Голосовое сообщение' : 'Аудиодорожка')}
      </span>
      <Play size={14} className="text-pink-600 ml-auto shrink-0" />
    </div>
    <audio src={url} controls className="w-full h-9" />
  </div>
);
