import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Folder, BellOff, CheckCircle2, User, Megaphone, Sparkles, Loader2 } from 'lucide-react';
import { InlineButton } from '../types';
import { getInlineButtonStyleClasses } from './MarkdownRenderer';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';

export interface InlineButtonsBuilderProps {
  buttons: InlineButton[][];
  onChange: (newButtons: InlineButton[][]) => void;
  folderLink?: string;
  label?: string;
  showPreview?: boolean;
  showReminderTemplates?: boolean;
  postTitle?: string;
  postText?: string;
  userId?: string;
  defaultUrl?: string;
}

// Official Telegram-supported inline button styles
export const TELEGRAM_BUTTON_COLORS: { id: 'default' | 'primary' | 'danger' | 'success'; name: string; bgClass: string }[] = [
  { id: 'default', name: 'Серый (по умолчанию)', bgClass: 'bg-slate-200/90 text-slate-900 border border-slate-300' },
  { id: 'success', name: 'Зелёный (success — целевой)', bgClass: 'bg-[#22c55e] text-white border border-[#16a34a]' },
  { id: 'primary', name: 'Синий (primary — навигация)', bgClass: 'bg-sky-500 text-white border border-sky-600' },
  { id: 'danger', name: 'Красный (danger — важный)', bgClass: 'bg-rose-500 text-white border border-rose-600' }
];

export const InlineButtonsBuilder: React.FC<InlineButtonsBuilderProps> = ({
  buttons,
  onChange,
  folderLink = '',
  label = 'Инлайн-кнопки (ряды и строки)',
  showPreview = true,
  showReminderTemplates = true,
  postTitle = '',
  postText = '',
  userId = '16926299042',
  defaultUrl = 'https://t.me/IIrkiBot'
}) => {
  const { pricing } = usePricingConfig(userId);
  const btnCost = pricing.textAi.inlineButtons;
  const btnCostLabel = formatIirkyCount(btnCost);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [aiCount, setAiCount] = useState<number>(2);

  const handleGenerateFromPostAi = async () => {
    setIsGeneratingAi(true);
    setAiNotice(null);
    try {
      const fallbackUrl =
        folderLink?.trim() ||
        buttons?.[0]?.[0]?.url ||
        defaultUrl ||
        'https://t.me/IIrkiBot';
      const res = await fetch('/api/scenarios/generate-inline-buttons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          postTitle,
          postText: postText || postTitle || label,
          buttonsCount: aiCount,
          buttonsPerRow: 1,
          defaultUrl: fallbackUrl,
          existingRows: buttons
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось сгенерировать кнопки');
      }
      if (Array.isArray(data.inlineButtons) && data.inlineButtons.length > 0) {
        onChange(data.inlineButtons);
        setAiNotice({
          type: 'ok',
          text: `Инлайн-кнопки сгенерированы по тексту поста (${btnCost === 0 ? 'бесплатно' : `списано: ${btnCostLabel}`}).`
        });
      }
    } catch (err: any) {
      setAiNotice({
        type: 'err',
        text: err?.message || 'Ошибка генерации инлайн-кнопок'
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Add a new empty row
  const handleAddRow = () => {
    const newId = `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBtn: InlineButton = {
      id: newId,
      text: 'Новая кнопка',
      type: 'url',
      url: 'https://t.me',
      style: 'default'
    };
    onChange([...buttons, [newBtn]]);
  };

  // Add button to existing row
  const handleAddButtonToRow = (rowIndex: number) => {
    const newId = `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBtn: InlineButton = {
      id: newId,
      text: 'Кнопка',
      type: 'url',
      url: 'https://t.me',
      style: 'default'
    };
    const updated = buttons.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        return [...row, newBtn];
      }
      return row;
    });
    onChange(updated);
  };

  // Update button field
  const handleUpdateButton = (rowIndex: number, btnIndex: number, field: keyof InlineButton, value: any) => {
    const updated = buttons.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      return row.map((btn, bIdx) => {
        if (bIdx !== btnIndex) return btn;
        return { ...btn, [field]: value };
      });
    });
    onChange(updated);
  };

  // Remove button
  const handleRemoveButton = (rowIndex: number, btnIndex: number) => {
    const updated = buttons
      .map((row, rIdx) => {
        if (rIdx !== rowIndex) return row;
        return row.filter((_, bIdx) => bIdx !== btnIndex);
      })
      .filter(row => row.length > 0);
    onChange(updated);
  };

  // Remove entire row
  const handleRemoveRow = (rowIndex: number) => {
    onChange(buttons.filter((_, idx) => idx !== rowIndex));
  };

  // Move row up or down
  const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    if (targetIdx < 0 || targetIdx >= buttons.length) return;
    const copy = [...buttons];
    const temp = copy[rowIndex];
    copy[rowIndex] = copy[targetIdx];
    copy[targetIdx] = temp;
    onChange(copy);
  };

  // Insert template button as a new row
  const handleInsertTemplate = (btn: InlineButton) => {
    onChange([...buttons, [btn]]);
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <label className="text-[14px] font-bold text-slate-800 block">
            {label}
          </label>
          <span className="text-[14px] text-slate-600">
            Поддерживаются стили Telegram: базовый, голубой, розово-красный и оранжевый
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 border border-pink-300 rounded-xl px-2 py-1">
            <select
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value) || 2)}
              className="bg-transparent text-[14px] font-bold text-slate-800 cursor-pointer focus:outline-none"
              title="Количество кнопок для генерации"
            >
              <option value={1}>1 кнопка</option>
              <option value={2}>2 кнопки</option>
              <option value={3}>3 кнопки</option>
              <option value={4}>4 кнопки</option>
            </select>
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={handleGenerateFromPostAi}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              title={`Сгенерировать текст инлайн-кнопок по смыслу поста (${btnCostLabel})`}
            >
              {isGeneratingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>По тексту ({btnCostLabel})</span>
            </button>
          </div>

          {folderLink && (
            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_fl_${Date.now()}`,
                text: '📁 Открыть папку в Telegram',
                type: 'url',
                url: folderLink.trim() || 'https://t.me',
                style: 'primary'
              })}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Folder className="w-4 h-4" />
              <span>Ссылка на папку</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить ряд кнопок</span>
          </button>
        </div>
      </div>

      {aiNotice && (
        <div
          className={`p-3 rounded-2xl border text-[14px] font-medium ${
            aiNotice.type === 'ok'
              ? 'bg-sky-50/90 border-sky-300 text-sky-900'
              : 'bg-rose-50/90 border-rose-300 text-rose-800'
          }`}
        >
          {aiNotice.text}
        </div>
      )}

      {/* Button Templates Bar (For reminders and folders) */}
      {showReminderTemplates && (
        <div className="p-3 rounded-2xl bg-white/70 border border-pink-200/80 space-y-2 shadow-2xs">
          <span className="text-[14px] font-bold text-slate-700 block">
            Быстрые шаблоны кнопок для напоминаний:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_fl_${Date.now()}`,
                text: '📁 Ссылка на инвайт папки',
                type: 'url',
                url: folderLink.trim() || 'https://t.me/addlist/...',
                style: 'primary'
              })}
              className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>+ Инвайт папки</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_unsub_${Date.now()}`,
                text: '🔔 Отписаться от напоминания',
                type: 'callback',
                callbackData: 'unsub_reminder',
                style: 'danger'
              })}
              className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>+ Отписаться</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_ready_${Date.now()}`,
                text: '✅ Подтвердить готовность',
                type: 'callback',
                callbackData: 'confirm_ready',
                style: 'success'
              })}
              className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>+ Готовность к выходу</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_chan_${Date.now()}`,
                text: '📢 Мой канал в папке',
                type: 'callback',
                callbackData: 'my_channel',
                style: 'default'
              })}
              className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>+ Мой канал</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertTemplate({
                id: `btn_org_${Date.now()}`,
                text: '👤 Связаться с организатором',
                type: 'url',
                url: 'https://t.me',
                style: 'default'
              })}
              className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <User className="w-3.5 h-3.5" />
              <span>+ Организатор</span>
            </button>
          </div>
        </div>
      )}

      {/* Rows List */}
      {buttons.length === 0 ? (
        <div className="p-4 rounded-2xl bg-white/70 border border-pink-200/80 text-center space-y-2 shadow-2xs">
          <p className="text-[14px] text-slate-600">
            Инлайн-кнопки пока не добавлены к посту.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer"
            >
              + Создать первый ряд кнопок
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {buttons.map((row, rIdx) => (
            <div
              key={rIdx}
              className="p-3.5 rounded-2xl bg-white/80 border border-pink-200/90 shadow-2xs space-y-3"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[14px] text-slate-800">
                    Ряд #{rIdx + 1}
                  </span>
                  <span className="text-[14px] text-slate-500">
                    ({row.length} {row.length === 1 ? 'кнопка' : row.length < 5 ? 'кнопки' : 'кнопок'})
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Move Row Up / Down */}
                  <button
                    type="button"
                    onClick={() => handleMoveRow(rIdx, 'up')}
                    disabled={rIdx === 0}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-pink-600 disabled:opacity-30 cursor-pointer"
                    title="Переместить ряд выше"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveRow(rIdx, 'down')}
                    disabled={rIdx === buttons.length - 1}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-pink-600 disabled:opacity-30 cursor-pointer"
                    title="Переместить ряд ниже"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Add button to this row */}
                  <button
                    type="button"
                    onClick={() => handleAddButtonToRow(rIdx)}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-[14px] transition-all cursor-pointer inline-flex items-center gap-1 border border-pink-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Кнопка в ряд</span>
                  </button>

                  {/* Remove row */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(rIdx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="Удалить весь ряд"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Buttons in this row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {row.map((btn, bIdx) => (
                  <div
                    key={btn.id || bIdx}
                    className="p-3 rounded-xl bg-pink-50/40 border border-pink-200/80 space-y-2.5 relative shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-slate-700">
                        Кнопка {bIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveButton(rIdx, bIdx)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        title="Удалить кнопку"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Button text */}
                    <div>
                      <label className="block text-[14px] font-medium text-slate-600 mb-0.5">
                        Текст на кнопке
                      </label>
                      <input
                        type="text"
                        value={btn.text}
                        onChange={(e) => handleUpdateButton(rIdx, bIdx, 'text', e.target.value)}
                        placeholder="Например: Вступить в канал"
                        className="w-full bg-white border border-pink-200 rounded-xl px-3 py-1.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400"
                      />
                    </div>

                    {/* Type and Color Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[14px] font-medium text-slate-600 mb-0.5">
                          Тип кнопки
                        </label>
                        <select
                          value={btn.type || 'url'}
                          onChange={(e) => handleUpdateButton(rIdx, bIdx, 'type', e.target.value as any)}
                          className="w-full bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400"
                        >
                          <option value="url">Внешняя ссылка</option>
                          <option value="callback">Callback (Действие)</option>
                          <option value="webapp">Web App (Mini App)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[14px] font-medium text-slate-600 mb-0.5">
                          Цвет кнопки (Telegram)
                        </label>
                        <select
                          value={btn.style || 'default'}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            handleUpdateButton(rIdx, bIdx, 'style', val);
                          }}
                          className="w-full bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400"
                        >
                          {TELEGRAM_BUTTON_COLORS.map((col) => (
                            <option key={col.id} value={col.id}>
                              {col.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* URL or Callback target */}
                    <div>
                      <label className="block text-[14px] font-medium text-slate-600 mb-0.5">
                        {btn.type === 'callback'
                          ? 'Значение Callback'
                          : btn.type === 'webapp'
                          ? 'Ссылка на Web App'
                          : 'Внешняя ссылка'}
                      </label>
                      <input
                        type="text"
                        value={btn.type === 'callback' ? (btn.callbackData || '') : (btn.url || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (btn.type === 'callback') {
                            handleUpdateButton(rIdx, bIdx, 'callbackData', val);
                          } else {
                            handleUpdateButton(rIdx, bIdx, 'url', val);
                          }
                        }}
                        placeholder={
                          btn.type === 'callback'
                            ? 'Например: unsub_reminder'
                            : 'https://t.me/...'
                        }
                        className="w-full bg-white border border-pink-200 rounded-xl px-3 py-1.5 text-[14px] text-slate-900 font-normal focus:outline-none focus:border-pink-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Telegram Live Keyboard Preview */}
      {showPreview && buttons.length > 0 && (
        <div className="space-y-2 pt-2">
          <label className="text-[14px] font-bold text-slate-800 block">
            Предпросмотр инлайн-кнопок в Telegram:
          </label>
          <div className="p-3.5 rounded-2xl bg-white/70 border border-pink-200/90 space-y-1.5 shadow-2xs">
            {buttons.map((row, rIdx) => (
              <div
                key={rIdx}
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map((btn, bIdx) => {
                  const colorClasses = getInlineButtonStyleClasses(btn.style || 'default', btn.style || 'default');
                  const isWebApp = btn.type === 'webapp';
                  const isUrl = btn.type === 'url' || (!btn.type && Boolean(btn.url));
                  const isCallback = btn.type === 'callback';

                  return (
                    <div
                      key={btn.id || bIdx}
                      className={`px-3 py-2.5 rounded-xl text-[14px] font-bold text-center truncate cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs ${colorClasses}`}
                      title={isWebApp ? `Web App: ${btn.url}` : isUrl ? `Ссылка: ${btn.url}` : `Callback: ${btn.callbackData}`}
                    >
                      {isWebApp && <span className="text-[14px] font-bold shrink-0">⊞</span>}
                      <span className="truncate">{btn.text || 'Кнопка'}</span>
                      {isUrl && !isWebApp && <span className="text-[14px] font-bold shrink-0">↗</span>}
                      {isCallback && <span className="text-[14px] font-bold shrink-0">⚡</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineButtonsBuilder;
