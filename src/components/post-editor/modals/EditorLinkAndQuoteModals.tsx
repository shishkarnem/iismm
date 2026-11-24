import React, { useEffect, useState } from 'react';
import { Check, Link as LinkIcon, Quote } from 'lucide-react';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  onInsertLink: (markdownLink: string) => void;
}

export const EditorLinkModal: React.FC<LinkModalProps> = ({
  open,
  onClose,
  initialText = '',
  onInsertLink
}) => {
  const [linkText, setLinkText] = useState(initialText);
  const [linkUrl, setLinkUrl] = useState('https://t.me/IIrkiBot');

  useEffect(() => {
    if (open) {
      setLinkText(initialText || 'Перейти по ссылке');
    }
  }, [open, initialText]);

  const handleConfirm = () => {
    const cleanUrl = linkUrl.trim() || 'https://t.me/IIrkiBot';
    const cleanLabel = linkText.trim() || cleanUrl;
    onInsertLink(`[${cleanLabel}](${cleanUrl})`);
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Вставить ссылку в текст"
      subtitle="Оформление кликабельной ссылки для поста Telegram"
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ResponsiveActionBtn
            icon={<LinkIcon size={16} />}
            label="Вставить ссылку"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-[14px] font-bold mb-1 text-slate-900">
            Текст ссылки
          </label>
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Например: Открыть бота @IIrkiBot"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="block text-[14px] font-bold mb-1 text-slate-900">
            Адрес ссылки (URL или #якорь)
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://t.me/IIrkiBot"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
          />
        </div>
      </div>
    </GradientModalShell>
  );
};

interface QuoteModalProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  isRich: boolean;
  onInsertQuote: (formattedQuote: string) => void;
}

export const EditorQuoteModal: React.FC<QuoteModalProps> = ({
  open,
  onClose,
  initialText = '',
  isRich,
  onInsertQuote
}) => {
  const [quoteStyle, setQuoteStyle] = useState<'normal' | 'expandable' | 'aside'>('normal');
  const [quoteBody, setQuoteBody] = useState('');
  const [quoteAuthor, setQuoteAuthor] = useState('');

  useEffect(() => {
    if (open) {
      setQuoteBody(initialText || '');
    }
  }, [open, initialText]);

  const styleOptions = [
    { value: 'normal', label: 'Стандартная цитата', sublabel: 'Аккуратный вертикальный акцент слева' },
    { value: 'expandable', label: 'Сворачиваемая цитата', sublabel: 'Длинный текст раскрывается по клику в Telegram' },
    ...(isRich
      ? [{ value: 'aside', label: 'Выноска по центру (Rich)', sublabel: 'Крупная редакторская врезка в статье' }]
      : [])
  ];

  const handleConfirm = () => {
    const text = quoteBody.trim() || 'Важная мысль публикации';
    const cite = quoteAuthor.trim();

    if (quoteStyle === 'aside' && isRich) {
      onInsertQuote(`\n<aside>${text}${cite ? ` — ${cite}` : ''}</aside>\n`);
    } else if (isRich && cite) {
      const attr = quoteStyle === 'expandable' ? ' expandable' : '';
      onInsertQuote(`\n<blockquote${attr}>\n${text}\n<cite>${cite}</cite>\n</blockquote>\n`);
    } else if (quoteStyle === 'expandable') {
      const lines = text.split('\n');
      const withCite = cite ? [...lines, `— ${cite}`] : lines;
      const out = withCite.map((l, idx) => (idx === 0 ? `**> ${l}` : `> ${l}`)).join('\n') + '||';
      onInsertQuote(`\n${out}\n`);
    } else {
      const lines = text.split('\n');
      const withCite = cite ? [...lines, `— ${cite}`] : lines;
      onInsertQuote(`\n${withCite.map((l) => `> ${l}`).join('\n')}\n`);
    }
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Конструктор цитаты"
      subtitle="Выберите формат подачи цитаты и при необходимости укажите автора"
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Вставить цитату"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-3.5">
        <GradientSelect
          label="Формат цитаты"
          value={quoteStyle}
          onChange={(v) => setQuoteStyle(v as 'normal' | 'expandable' | 'aside')}
          options={styleOptions}
        />

        <div>
          <label className="block text-[14px] font-bold mb-1 text-slate-900">
            Текст цитаты
          </label>
          <textarea
            rows={4}
            value={quoteBody}
            onChange={(e) => setQuoteBody(e.target.value)}
            placeholder="Введите текст цитаты или ключевой вывод..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500 resize-y"
          />
        </div>

        {quoteStyle !== 'aside' && (
          <div>
            <label className="block text-[14px] font-bold mb-1 text-slate-900 flex items-center gap-1.5">
              <Quote size={14} className="text-pink-600" />
              <span>Автор или источник (необязательно)</span>
            </label>
            <input
              type="text"
              value={quoteAuthor}
              onChange={(e) => setQuoteAuthor(e.target.value)}
              placeholder="Например: Редакция канала"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>
        )}
      </div>
    </GradientModalShell>
  );
};
