import React, { useEffect, useState } from 'react';
import { Anchor, Check, Clock, Sparkles } from 'lucide-react';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { RenderMathPreview } from '../preview/InlineFormattedRenderer';
import { extractHeadingsFromPost } from '../core/editorTypesAndTemplates';

const EMOJI_PRESETS = [
  '🚀', '✨', '🔥', '💡', '📌', '⚡', '🎯', '📈',
  '💎', '🎉', '💬', '📣', '🌟', '🧠', '🛠️', '🤝',
  '📚', '🎁', '🏆', '⏰', '🔔', '❤️', '🙌', '👉'
];

const LATEX_PRESETS = [
  { label: 'Формула конверсии CR', code: 'CR = \\frac{Leads}{Clicks} \\times 100\\%' },
  { label: 'Окупаемость ROI', code: 'ROI = \\frac{Revenue - Cost}{Cost} \\times 100\\%' },
  { label: 'Сумма ряда', code: '\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\dots + x_n' },
  { label: 'Квадратный корень', code: '\\sigma = \\sqrt{\\frac{1}{N} \\sum (x_i - \\mu)^2}' }
];

interface EditorEmojiTimeModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'emoji' | 'time' | 'latex';
  onInsertSnippet: (snippet: string) => void;
}

export const EditorEmojiTimeModal: React.FC<EditorEmojiTimeModalProps> = ({
  open,
  onClose,
  initialTab = 'emoji',
  onInsertSnippet
}) => {
  const [section, setSection] = useState<'emoji' | 'time' | 'latex'>('emoji');
  const [dateTimeVal, setDateTimeVal] = useState(() => new Date().toISOString().slice(0, 16));
  const [timeStyle, setTimeStyle] = useState<'full' | 'relative' | 'short'>('full');
  const [formulaMode, setFormulaMode] = useState<'inline' | 'block'>('block');
  const [formulaText, setFormulaText] = useState('ROI = \\frac{Profit}{Investment} \\times 100\\%');

  useEffect(() => {
    if (open) setSection(initialTab);
  }, [open, initialTab]);

  const sectionOptions = [
    { value: 'emoji', label: 'Набор эмодзи для постов', sublabel: 'Быстрая вставка популярных акцентов' },
    { value: 'time', label: 'Динамическая метка времени', sublabel: 'Форматированная дата и время события' },
    { value: 'latex', label: 'Математическая формула LaTeX', sublabel: 'Формулы аналитики, метрик и расчетов' }
  ];

  const handleInsertTime = () => {
    const dt = new Date(dateTimeVal);
    if (isNaN(dt.getTime())) return;
    const formatted =
      timeStyle === 'short'
        ? dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : timeStyle === 'relative'
        ? `${dt.toLocaleDateString('ru-RU')} в ${dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (МСК)`
        : dt.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
    onInsertSnippet(formatted);
    onClose();
  };

  const handleInsertFormula = () => {
    if (!formulaText.trim()) return;
    const out =
      formulaMode === 'block'
        ? `\n$$\n${formulaText.trim()}\n$$\n`
        : `$${formulaText.trim()}$`;
    onInsertSnippet(out);
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Эмодзи, дата и формулы"
      subtitle="Выберите нужный инструмент в выпадающем списке"
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <GradientSelect
          label="Инструмент вставки"
          value={section}
          onChange={(v) => setSection(v as 'emoji' | 'time' | 'latex')}
          options={sectionOptions}
        />

        {section === 'emoji' && (
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 rounded-2xl bg-white/70 border border-pink-300/70">
            {EMOJI_PRESETS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  onInsertSnippet(em);
                  onClose();
                }}
                className="min-h-[42px] rounded-xl bg-white/90 hover:bg-pink-100/80 border border-pink-200 text-[20px] flex items-center justify-center shadow-2xs cursor-pointer transition-transform active:scale-95"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {section === 'time' && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/70 border border-pink-300/70">
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Дата и время события
              </label>
              <input
                type="datetime-local"
                value={dateTimeVal}
                onChange={(e) => setDateTimeVal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900"
              />
            </div>

            <GradientSelect
              label="Формат отображения"
              value={timeStyle}
              onChange={(v) => setTimeStyle(v as 'full' | 'relative' | 'short')}
              options={[
                { value: 'full', label: 'Полная дата и время (12 октября 2026, 18:00)' },
                { value: 'relative', label: 'Краткая дата с часовым поясом МСК' },
                { value: 'short', label: 'Только часы и минуты (18:00)' }
              ]}
            />

            <div className="flex justify-end">
              <ResponsiveActionBtn
                icon={<Clock size={16} />}
                label="Вставить дату"
                alwaysShowLabel
                variant="vivid"
                onClick={handleInsertTime}
              />
            </div>
          </div>
        )}

        {section === 'latex' && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/70 border border-pink-300/70">
            <GradientSelect
              label="Расположение формулы"
              value={formulaMode}
              onChange={(v) => setFormulaMode(v as 'inline' | 'block')}
              options={[
                { value: 'block', label: 'Отдельный блок по центру ($$...$$)' },
                { value: 'inline', label: 'Внутри строки текста ($...$)' }
              ]}
            />

            <GradientSelect
              label="Готовый шаблон формулы"
              value=""
              placeholder="Выбрать шаблон для подстановки..."
              onChange={(code) => {
                if (code) setFormulaText(code);
              }}
              options={LATEX_PRESETS.map((p) => ({
                value: p.code,
                label: p.label,
                sublabel: p.code
              }))}
            />

            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Код формулы LaTeX
              </label>
              <textarea
                rows={3}
                value={formulaText}
                onChange={(e) => setFormulaText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/90 border border-pink-300 font-mono text-[14px] text-slate-900"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-pink-200">
              <div className="text-[14px] font-semibold text-slate-600 mb-1">Предпросмотр:</div>
              <RenderMathPreview formula={formulaText} block={formulaMode === 'block'} />
            </div>

            <div className="flex justify-end">
              <ResponsiveActionBtn
                icon={<Sparkles size={16} />}
                label="Вставить формулу"
                alwaysShowLabel
                variant="vivid"
                onClick={handleInsertFormula}
              />
            </div>
          </div>
        )}
      </div>
    </GradientModalShell>
  );
};

interface EditorAnchorsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'create' | 'link' | 'tg_ref' | 'footnote';
  postText: string;
  onInsertAnchorMarkup: (snippet: string, appendAtEnd?: string) => void;
}

export const EditorAnchorsModal: React.FC<EditorAnchorsModalProps> = ({
  open,
  onClose,
  initialTab = 'create',
  postText,
  onInsertAnchorMarkup
}) => {
  const [tab, setTab] = useState<'create' | 'link' | 'tg_ref' | 'footnote'>('create');
  const [anchorSlug, setAnchorSlug] = useState('razdel-1');
  const [linkLabel, setLinkLabel] = useState('Перейти к разделу');
  const [targetSlug, setTargetSlug] = useState('');
  const [tgHandle, setTgHandle] = useState('IIrkiBot');
  const [footnoteId, setFootnoteId] = useState('1');
  const [footnoteText, setFootnoteText] = useState('');

  const headings = extractHeadingsFromPost(postText);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (headings.length > 0 && !targetSlug) {
        setTargetSlug(headings[0].slug);
      }
    }
  }, [open, initialTab]);

  const tabOptions = [
    { value: 'create', label: 'Создать невидимый якорь', sublabel: 'Точка перехода внутри длинной статьи' },
    { value: 'link', label: 'Ссылка на заголовок или якорь', sublabel: 'Оглавление с быстрым переходом' },
    { value: 'tg_ref', label: 'Упоминание Telegram-бота или канала', sublabel: 'Прямая ссылка вида https://t.me/IIrkiBot' },
    { value: 'footnote', label: 'Сноска с пояснением внизу статьи', sublabel: 'Индекс [1] в тексте и расшифровка в подвале' }
  ];

  const handleConfirm = () => {
    if (tab === 'create') {
      const clean = anchorSlug.trim().replace(/[^a-zA-Z0-9_-]/g, '-') || 'section';
      onInsertAnchorMarkup(`\n<a name="${clean}"></a>\n`);
    } else if (tab === 'link') {
      const slug = targetSlug.trim().replace(/^#/, '') || 'section';
      onInsertAnchorMarkup(`[${linkLabel.trim() || 'К разделу'}](#${slug})`);
    } else if (tab === 'tg_ref') {
      const handle = tgHandle.trim().replace(/^@/, '') || 'IIrkiBot';
      onInsertAnchorMarkup(`[@${handle}](https://t.me/${handle})`);
    } else {
      const id = footnoteId.trim() || '1';
      const note = footnoteText.trim() || 'Примечание редакции';
      onInsertAnchorMarkup(`[^${id}]`, `\n\n[^${id}]: ${note}`);
    }
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Якоря, оглавление и сноски"
      subtitle="Навигация внутри статьи и аккуратные примечания"
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end">
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Вставить в текст"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-3.5">
        <GradientSelect
          label="Тип элемента"
          value={tab}
          onChange={(v) => setTab(v as 'create' | 'link' | 'tg_ref' | 'footnote')}
          options={tabOptions}
        />

        {tab === 'create' && (
          <div>
            <label className="block text-[14px] font-bold mb-1 text-slate-900 flex items-center gap-1.5">
              <Anchor size={14} className="text-pink-600" />
              <span>Идентификатор якоря (латиницей)</span>
            </label>
            <input
              type="text"
              value={anchorSlug}
              onChange={(e) => setAnchorSlug(e.target.value)}
              placeholder="part-1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
            />
          </div>
        )}

        {tab === 'link' && (
          <div className="space-y-3">
            {headings.length > 0 && (
              <GradientSelect
                label="Выбрать существующий заголовок статьи"
                value={targetSlug}
                onChange={(slug) => setTargetSlug(slug)}
                options={headings.map((h) => ({
                  value: h.slug,
                  label: h.title,
                  meta: `#${h.slug}`
                }))}
              />
            )}
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Текст кликабельной ссылки
              </label>
              <input
                type="text"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Целевой якорь (без #)
              </label>
              <input
                type="text"
                value={targetSlug}
                onChange={(e) => setTargetSlug(e.target.value)}
                placeholder="razdel-1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
              />
            </div>
          </div>
        )}

        {tab === 'tg_ref' && (
          <div>
            <label className="block text-[14px] font-bold mb-1 text-slate-900">
              Юзернейм бота или канала (без @)
            </label>
            <input
              type="text"
              value={tgHandle}
              onChange={(e) => setTgHandle(e.target.value)}
              placeholder="IIrkiBot"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
            />
          </div>
        )}

        {tab === 'footnote' && (
          <div className="space-y-3">
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Номер или код сноски
              </label>
              <input
                type="text"
                value={footnoteId}
                onChange={(e) => setFootnoteId(e.target.value)}
                placeholder="1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Текст расшифровки внизу статьи
              </label>
              <textarea
                rows={3}
                value={footnoteText}
                onChange={(e) => setFootnoteText(e.target.value)}
                placeholder="Пояснение или источник данных..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
              />
            </div>
          </div>
        )}
      </div>
    </GradientModalShell>
  );
};
