import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { ExtractedUrlInfo } from '../core/editorTypesAndTemplates';
import { RichButtonChip, parseTgButtonElement } from './RichButtonsAndMediaPreview';
import { repairMalformedInlineHtmlTags } from '../../../utils/formatting/postTitleAndTagHelpers';
import { CachedMediaImage } from '../../CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../../../constants/proTalkStorage';

export const RenderMathPreview: React.FC<{ formula: string; block?: boolean }> = ({
  formula,
  block = false
}) => {
  const pretty = (formula || '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sum/g, '∑')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\approx/g, '≈')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³');

  if (block) {
    return (
      <div className="my-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300/80 font-mono text-[15px] text-slate-900 text-center overflow-x-auto">
        {pretty}
      </div>
    );
  }

  return (
    <span className="inline-block px-1.5 py-0.5 mx-0.5 rounded-lg bg-pink-100/80 border border-pink-300/70 font-mono text-[14px] text-pink-900">
      {pretty}
    </span>
  );
};

export const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Копировать' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-semibold shadow-2xs hover:brightness-105 cursor-pointer"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Скопировано' : label}</span>
    </button>
  );
};

export const TelegramCodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  return (
    <div className="my-2.5 rounded-2xl border border-pink-300/80 bg-gradient-to-br from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 overflow-hidden shadow-2xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-pink-300/60 bg-white/55">
        <span className="text-[14px] font-mono font-bold text-pink-700">
          {lang || 'код'}
        </span>
        <CopyButton text={code} label="Копировать" />
      </div>
      <pre className="p-3 text-[14px] font-mono text-slate-900 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
        {code}
      </pre>
    </div>
  );
};

export const TelegramSpoiler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed((p) => !p)}
      title={revealed ? 'Нажмите, чтобы скрыть спойлер' : 'Нажмите, чтобы раскрыть спойлер'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg cursor-pointer transition-all select-none ${
        revealed
          ? 'bg-pink-100/80 text-slate-900 border border-pink-300/70'
          : 'bg-gradient-to-r from-sky-300/85 via-pink-300/85 via-orange-300/85 to-sky-300/85 text-transparent hover:brightness-105 border border-pink-400/70'
      }`}
    >
      <span className={revealed ? 'select-text' : 'blur-[4px]'}>{children}</span>
      {revealed ? (
        <EyeOff size={13} className="text-pink-600 shrink-0" />
      ) : (
        <Eye size={13} className="text-pink-800 shrink-0" />
      )}
    </span>
  );
};

function renderPlainTextWithLinks(segment: string, keyPrefix: string): React.ReactNode {
  if (!segment || !/https?:\/\//i.test(segment)) return segment;
  const parts = segment.split(/(https?:\/\/[^\s<>"')]+)/g);
  if (parts.length <= 1) return segment;
  return parts.map((sub, idx) =>
    /^https?:\/\//i.test(sub) ? (
      <a
        key={`${keyPrefix}_u_${idx}`}
        href={sub}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-700 hover:text-pink-600 underline decoration-pink-400 font-semibold break-all"
      >
        {sub}
      </a>
    ) : (
      <React.Fragment key={`${keyPrefix}_t_${idx}`}>{sub}</React.Fragment>
    )
  );
}

export function renderFormattedText(raw: string, isRich = true): React.ReactNode {
  if (!raw) return null;

  // Unescape MarkdownV2 backslashes for visual preview and repair unclosed/paired same tags (e.g. <b>Title<b>)
  const unescaped = isRich
    ? raw
    : raw.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1');
  const prepared = repairMalformedInlineHtmlTags(unescaped);

  const safeTokenRegex =
    /(```[\s\S]*?```|\|\|[\s\S]+?\|\||<tg-spoiler>[\s\S]+?<\/tg-spoiler>|\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`\n]+`|<tg-button\b[^>]*>[\s\S]*?<\/tg-button>|<a\s+[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|<sup>[\s\S]+?<\/sup>|<sub>[\s\S]+?<\/sub>|<b>[\s\S]+?<\/b>|<strong>[\s\S]+?<\/strong>|<i>[\s\S]+?<\/i>|<em>[\s\S]+?<\/em>|<u>[\s\S]+?<\/u>|<ins>[\s\S]+?<\/ins>|<s>[\s\S]+?<\/s>|<del>[\s\S]+?<\/del>|<strike>[\s\S]+?<\/strike>|<br\s*\/?>|\[\^[^\]]+\]|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|(?<!~)~[^~\n]+~(?!~))/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = safeTokenRegex.exec(prepared)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`pre_${keyCounter}`}>
          {renderPlainTextWithLinks(prepared.slice(lastIndex, match.index), `pre_${keyCounter}`)}
        </React.Fragment>
      );
    }

    const tok = match[0];
    const k = `fmt_${keyCounter++}`;

    if (tok.startsWith('```') && tok.endsWith('```') && tok.length >= 6) {
      const innerCode = tok.slice(3, -3);
      const langMatch = innerCode.match(/^([a-zA-Z0-9_-]+)[ \t]*\n([\s\S]*)$/);
      const codeLang = langMatch ? langMatch[1] : undefined;
      const codeBody = (langMatch ? langMatch[2] : innerCode).replace(/^\n+|\n+$/g, '');
      parts.push(<TelegramCodeBlock key={k} code={codeBody} lang={codeLang} />);
    } else if ((tok.startsWith('||') && tok.endsWith('||')) || /^<tg-spoiler>/i.test(tok)) {
      const inner = tok.startsWith('||')
        ? tok.slice(2, -2)
        : tok.replace(/^<tg-spoiler>/i, '').replace(/<\/tg-spoiler>$/i, '');
      parts.push(<TelegramSpoiler key={k}>{renderFormattedText(inner, isRich)}</TelegramSpoiler>);
    } else if (tok.startsWith('$$') && tok.endsWith('$$')) {
      parts.push(<RenderMathPreview key={k} formula={tok.slice(2, -2)} block />);
    } else if (tok.startsWith('$') && tok.endsWith('$')) {
      parts.push(<RenderMathPreview key={k} formula={tok.slice(1, -1)} />);
    } else if (tok.startsWith('`') && tok.endsWith('`')) {
      parts.push(
        <code
          key={k}
          className="px-1.5 py-0.5 rounded-md bg-pink-100/80 border border-pink-300/70 font-mono text-[14px] text-pink-900 break-words"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (/^<tg-button\b/i.test(tok)) {
      const parsedBtn = parseTgButtonElement(tok);
      if (parsedBtn) {
        parts.push(<RichButtonChip key={k} btn={parsedBtn} inline />);
      } else {
        parts.push(tok);
      }
    } else if (/^<a\s+/i.test(tok)) {
      const hm = tok.match(/^<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>$/i);
      if (hm) {
        parts.push(
          <a
            key={k}
            href={hm[1]}
            target={hm[1].startsWith('#') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="text-sky-700 hover:text-pink-600 underline decoration-pink-400 font-semibold break-words"
          >
            {renderFormattedText(hm[2], isRich)}
          </a>
        );
      } else {
        parts.push(tok);
      }
    } else if (tok.startsWith('![')) {
      const im = tok.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (im) {
        const imgUrl = normalizeProTalkMediaUrl(im[2].trim()) || im[2].trim();
        parts.push(
          <span key={k} className="block my-2 rounded-2xl overflow-hidden border border-pink-200/80 bg-white/80 p-1">
            <CachedMediaImage
              src={imgUrl}
              alt={im[1] || 'Иллюстрация'}
              className="w-auto max-w-full max-h-80 object-contain rounded-xl mx-auto"
            />
          </span>
        );
      } else {
        parts.push(tok);
      }
    } else if (tok.startsWith('[')) {
      if (tok.startsWith('[^') && tok.endsWith(']')) {
        const fnId = tok.slice(2, -1);
        parts.push(
          <sup key={k} className="text-[14px] font-bold text-pink-600 ml-0.5">
            [{fnId}]
          </sup>
        );
      } else {
        const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (lm) {
          const [, label, href] = lm;
          parts.push(
            <a
              key={k}
              href={href}
              target={href.startsWith('#') ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="text-sky-700 hover:text-pink-600 underline decoration-pink-400 font-semibold break-words"
            >
              {renderFormattedText(label, isRich)}
            </a>
          );
        } else {
          parts.push(tok);
        }
      }
    } else if ((tok.startsWith('**') && tok.endsWith('**')) || /^<(b|strong)>/i.test(tok)) {
      const inner = tok.startsWith('**')
        ? tok.slice(2, -2)
        : tok.replace(/^<(?:b|strong)>/i, '').replace(/<\/(?:b|strong)>$/i, '');
      parts.push(
        <strong key={k} className="font-bold text-slate-950">
          {renderFormattedText(inner, isRich)}
        </strong>
      );
    } else if ((tok.startsWith('__') && tok.endsWith('__')) || /^<(u|ins)>/i.test(tok)) {
      const inner = tok.startsWith('__')
        ? tok.slice(2, -2)
        : tok.replace(/^<(?:u|ins)>/i, '').replace(/<\/(?:u|ins)>$/i, '');
      parts.push(
        <span key={k} className="underline decoration-pink-500 underline-offset-2">
          {renderFormattedText(inner, isRich)}
        </span>
      );
    } else if ((tok.startsWith('~~') && tok.endsWith('~~')) || /^<(s|del|strike)>/i.test(tok)) {
      const inner = tok.startsWith('~~')
        ? tok.slice(2, -2)
        : tok.replace(/^<(?:s|del|strike)>/i, '').replace(/<\/(?:s|del|strike)>$/i, '');
      parts.push(
        <span key={k} className="line-through text-slate-500">
          {renderFormattedText(inner, isRich)}
        </span>
      );
    } else if (/^<sup>/i.test(tok)) {
      parts.push(
        <sup key={k} className="text-[14px] font-semibold">
          {tok.replace(/^<sup>/i, '').replace(/<\/sup>$/i, '')}
        </sup>
      );
    } else if (/^<sub>/i.test(tok)) {
      parts.push(
        <sub key={k} className="text-[14px] font-semibold">
          {tok.replace(/^<sub>/i, '').replace(/<\/sub>$/i, '')}
        </sub>
      );
    } else if (/^<br\s*\/?>$/i.test(tok)) {
      parts.push(<br key={k} />);
    } else if (tok.startsWith('*') && tok.endsWith('*')) {
      const inner = tok.slice(1, -1);
      parts.push(
        isRich ? (
          <em key={k} className="italic">
            {renderFormattedText(inner, isRich)}
          </em>
        ) : (
          <strong key={k} className="font-bold text-slate-950">
            {renderFormattedText(inner, isRich)}
          </strong>
        )
      );
    } else if ((tok.startsWith('_') && tok.endsWith('_')) || /^<(i|em)>/i.test(tok)) {
      const inner = tok.startsWith('_')
        ? tok.slice(1, -1)
        : tok.replace(/^<(?:i|em)>/i, '').replace(/<\/(?:i|em)>$/i, '');
      parts.push(
        <em key={k} className="italic">
          {renderFormattedText(inner, isRich)}
        </em>
      );
    } else if (tok.startsWith('~') && tok.endsWith('~')) {
      parts.push(
        <span key={k} className="line-through text-slate-500">
          {renderFormattedText(tok.slice(1, -1), isRich)}
        </span>
      );
    } else {
      parts.push(tok);
    }

    lastIndex = safeTokenRegex.lastIndex;
  }

  if (lastIndex < prepared.length) {
    parts.push(
      <React.Fragment key="tail">
        {renderPlainTextWithLinks(prepared.slice(lastIndex), 'tail')}
      </React.Fragment>
    );
  }

  return parts;
}

export const TelegramLinkPreviewMockup: React.FC<{
  info: ExtractedUrlInfo;
  onDisable?: () => void;
}> = ({ info, onDisable }) => {
  return (
    <div className="mt-2.5 p-3 rounded-2xl border-l-4 border-pink-500 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-pink-700 flex items-center gap-1 break-words">
          <ExternalLink size={14} className="shrink-0" />
          {info.siteName}
        </span>
        {onDisable && (
          <button
            type="button"
            onClick={onDisable}
            className="text-[14px] font-semibold text-slate-600 hover:text-pink-700 cursor-pointer"
            title="Скрыть превью ссылки"
          >
            Скрыть превью
          </button>
        )}
      </div>
      <div className="text-[14px] font-bold text-slate-900 mt-0.5 break-words">{info.title}</div>
      <div className="text-[14px] text-slate-700 mt-0.5 leading-snug break-words">{info.description}</div>
    </div>
  );
};
