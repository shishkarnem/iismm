import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Zap
} from 'lucide-react';
import { InlineButtonItem, InlineButtonRow } from '../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { GradientDropdownOption, GradientSelect } from './GradientDropdown';
import { ResponsiveActionBtn } from './ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from './AutoGrowVoiceTextarea';

export type InlineButtonsLayoutRuleOption =
  | '1_per_row'
  | '2_per_row'
  | '3_per_row'
  | '1_then_2'
  | '2_then_1';

export const INLINE_LAYOUT_RULE_OPTIONS: GradientDropdownOption[] = [
  {
    value: '1_per_row',
    label: 'По 1 кнопке в строке',
    sublabel: 'Каждая кнопка на отдельной строке на всю ширину'
  },
  {
    value: '2_per_row',
    label: 'По 2 кнопки в строке',
    sublabel: 'Кнопки располагаются парами в два столбца'
  },
  {
    value: '3_per_row',
    label: 'По 3 кнопки в строке',
    sublabel: 'Компактный ряд по три короткие кнопки в строке'
  },
  {
    value: '1_then_2',
    label: '1 главная сверху + по 2 ниже',
    sublabel: 'Первая целевая кнопка на всю ширину, остальные парами'
  },
  {
    value: '2_then_1',
    label: 'По 2 в строке + 1 итоговая снизу',
    sublabel: 'Верхние кнопки парами, финальная кнопка на всю ширину'
  }
];

export const TELEGRAM_STYLE_OPTIONS: GradientDropdownOption[] = [
  {
    value: 'default',
    label: 'Серый (по умолчанию)',
    sublabel: 'Без style — стандартный серый цвет кнопки в Telegram'
  },
  {
    value: 'success',
    label: 'Зелёный (success)',
    sublabel: 'Целевые действия: Оплатить, Подтвердить, Записаться'
  },
  {
    value: 'primary',
    label: 'Синий (primary)',
    sublabel: 'Нейтральная навигация: Меню, Справка, Назад'
  },
  {
    value: 'danger',
    label: 'Красный (danger)',
    sublabel: 'Важные или деструктивные действия: Удалить, Отменить, Выйти'
  }
];

export const INLINE_BUTTON_TYPE_OPTIONS: GradientDropdownOption[] = [
  { value: 'url', label: 'Внешняя ссылка' },
  { value: 'copy_text', label: 'Копировать текст / промокод' },
  { value: 'web_app', label: 'Открыть мини-приложение' },
  { value: 'callback', label: 'Callback-действие бота' }
];

function getTelegramTileClasses(style?: string): string {
  if (style === 'success') {
    return 'bg-[#22c55e] text-white border-[#16a34a]';
  }
  if (style === 'primary') {
    return 'bg-sky-500 text-white border-sky-600';
  }
  if (style === 'danger') {
    return 'bg-rose-500 text-white border-rose-600';
  }
  return 'bg-slate-200/95 text-slate-900 border-slate-300';
}

function renderButtonTypeIcon(type?: string) {
  if (type === 'copy_text') return <Copy size={13} className="shrink-0 opacity-85" />;
  if (type === 'web_app') return <Smartphone size={13} className="shrink-0 opacity-85" />;
  if (type === 'callback') return <Zap size={13} className="shrink-0 opacity-85" />;
  return <ExternalLink size={13} className="shrink-0 opacity-85" />;
}

interface InlineKeyboardVisualGridProps {
  rows: InlineButtonRow[];
  onChangeRows: (nextRows: InlineButtonRow[]) => void;
  defaultUrl?: string;
  allowButtonTypes?: boolean;
  maxButtonsPerRow?: number;
}

export const InlineKeyboardVisualGrid: React.FC<InlineKeyboardVisualGridProps> = ({
  rows,
  onChangeRows,
  defaultUrl = 'https://t.me/IIrkiBot',
  allowButtonTypes = true,
  maxButtonsPerRow = 3
}) => {
  const [selectedPos, setSelectedPos] = useState<{ rowIdx: number; btnIdx: number }>({
    rowIdx: 0,
    btnIdx: 0
  });

  useEffect(() => {
    if (rows.length === 0) return;
    const r = rows[selectedPos.rowIdx];
    if (!r || !r.buttons[selectedPos.btnIdx]) {
      setSelectedPos({ rowIdx: 0, btnIdx: 0 });
    }
  }, [rows, selectedPos.btnIdx, selectedPos.rowIdx]);

  const makeBtn = (text: string): InlineButtonItem => ({
    id: `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    type: 'url',
    value: defaultUrl || 'https://t.me/IIrkiBot',
    url: defaultUrl || 'https://t.me/IIrkiBot',
    style: 'default'
  });

  const handleAddRow = () => {
    const newRowIdx = rows.length;
    const nextRows: InlineButtonRow[] = [
      ...rows,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        buttons: [makeBtn(newRowIdx === 0 ? 'Перейти в бота' : 'Новая кнопка')]
      }
    ];
    onChangeRows(nextRows);
    setSelectedPos({ rowIdx: newRowIdx, btnIdx: 0 });
  };

  const handleAddButtonInRow = (rowIdx: number) => {
    const targetRow = rows[rowIdx];
    if (!targetRow || targetRow.buttons.length >= maxButtonsPerRow) return;
    const newBtnIdx = targetRow.buttons.length;
    const nextRows = rows.map((r, ri) =>
      ri !== rowIdx ? r : { ...r, buttons: [...r.buttons, makeBtn('Подробнее')] }
    );
    onChangeRows(nextRows);
    setSelectedPos({ rowIdx, btnIdx: newBtnIdx });
  };

  const handleUpdateSelected = (patch: Partial<InlineButtonItem>) => {
    const { rowIdx, btnIdx } = selectedPos;
    const nextRows = rows.map((r, ri) =>
      ri !== rowIdx
        ? r
        : {
            ...r,
            buttons: r.buttons.map((b, bi) =>
              bi !== btnIdx
                ? b
                : {
                    ...b,
                    ...patch,
                    ...(patch.value !== undefined ? { url: patch.value } : {})
                  }
            )
          }
    );
    onChangeRows(nextRows);
  };

  const handleDeleteButton = (rowIdx: number, btnIdx: number) => {
    const nextRows = rows
      .map((r, ri) =>
        ri !== rowIdx ? r : { ...r, buttons: r.buttons.filter((_, bi) => bi !== btnIdx) }
      )
      .filter((r) => r.buttons.length > 0);
    onChangeRows(nextRows);
    setSelectedPos({ rowIdx: Math.max(0, Math.min(rowIdx, nextRows.length - 1)), btnIdx: 0 });
  };

  const handleMoveRow = (rowIdx: number, dir: -1 | 1) => {
    const targetIdx = rowIdx + dir;
    if (targetIdx < 0 || targetIdx >= rows.length) return;
    const copy = [...rows];
    const [moved] = copy.splice(rowIdx, 1);
    copy.splice(targetIdx, 0, moved);
    onChangeRows(copy);
    if (selectedPos.rowIdx === rowIdx) {
      setSelectedPos({ rowIdx: targetIdx, btnIdx: selectedPos.btnIdx });
    }
  };

  const handleMoveBtnInRow = (rowIdx: number, btnIdx: number, dir: -1 | 1) => {
    const row = rows[rowIdx];
    if (!row) return;
    const targetBtnIdx = btnIdx + dir;
    if (targetBtnIdx < 0 || targetBtnIdx >= row.buttons.length) return;
    const nextBtns = [...row.buttons];
    const [moved] = nextBtns.splice(btnIdx, 1);
    nextBtns.splice(targetBtnIdx, 0, moved);
    const nextRows = rows.map((r, ri) => (ri !== rowIdx ? r : { ...r, buttons: nextBtns }));
    onChangeRows(nextRows);
    setSelectedPos({ rowIdx, btnIdx: targetBtnIdx });
  };

  const activeRow = rows[selectedPos.rowIdx];
  const activeBtn = activeRow?.buttons[selectedPos.btnIdx] || null;

  return (
    <div className="space-y-3 min-w-0">
      {/* Visual Telegram Inline Keyboard Layout */}
      <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-3 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[14px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
              Макет инлайн-клавиатуры (кликните по кнопке для настройки)
            </span>
            {rows.length > 0 && (
              <ResponsiveActionBtn
                icon={<Trash2 size={14} />}
                label="Очистить все"
                variant="danger"
                onClick={() => onChangeRows([])}
              />
            )}
          </div>

          {rows.length === 0 ? (
            <div className="py-3 px-3 rounded-xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-dashed border-pink-300 text-[14px] text-slate-700 text-center">
              Пока нет ни одной строки кнопок. Добавьте первую строку ниже или сгенерируйте через ИИ.
            </div>
          ) : (
            <div className="space-y-2 min-w-0">
              {rows.map((row, rIdx) => (
                <div
                  key={row.id || `r_${rIdx}`}
                  className="flex items-center gap-1.5 min-w-0"
                >
                  {/* Row reorder controls */}
                  {rows.length > 1 && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={rIdx === 0}
                        onClick={() => handleMoveRow(rIdx, -1)}
                        title="Поднять строку выше"
                        className="p-1 rounded-lg bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 text-pink-700 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={rIdx === rows.length - 1}
                        onClick={() => handleMoveRow(rIdx, 1)}
                        title="Опустить строку ниже"
                        className="p-1 rounded-lg bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 text-pink-700 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  )}

                  {/* Horizontal row of Telegram buttons */}
                  <div className="flex-1 min-w-0 flex items-stretch gap-1.5">
                    {row.buttons.map((btn, bIdx) => {
                      const isSelected =
                        selectedPos.rowIdx === rIdx && selectedPos.btnIdx === bIdx;
                      const tileColor = getTelegramTileClasses(btn.style);
                      return (
                        <button
                          key={btn.id || `b_${rIdx}_${bIdx}`}
                          type="button"
                          onClick={() => setSelectedPos({ rowIdx: rIdx, btnIdx: bIdx })}
                          title={`${btn.text || 'Кнопка'} — нажмите для редактирования`}
                          className={`flex-1 min-w-0 min-h-[42px] px-2.5 py-2 rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${tileColor} ${
                            isSelected
                              ? 'ring-2 ring-pink-500 ring-offset-1 scale-[1.01] shadow-md'
                              : 'opacity-95 hover:opacity-100'
                          }`}
                        >
                          <span className="truncate">{btn.text || 'Кнопка'}</span>
                          {renderButtonTypeIcon(btn.type)}
                        </button>
                      );
                    })}

                    {/* Add button into this horizontal row */}
                    {row.buttons.length < maxButtonsPerRow && (
                      <button
                        type="button"
                        onClick={() => handleAddButtonInRow(rIdx)}
                        title="Добавить кнопку в эту строку справа"
                        className="shrink-0 min-h-[42px] px-2.5 sm:px-3 py-2 rounded-xl border border-dashed border-pink-400 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 hover:brightness-105 text-slate-900 font-semibold text-[14px] inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus size={15} className="text-pink-600 shrink-0" />
                        <span className="hidden sm:inline">В строку</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new row underneath */}
          <button
            type="button"
            onClick={handleAddRow}
            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-dashed border-sky-400 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm hover:brightness-105 transition-all cursor-pointer"
          >
            <Plus size={16} className="shrink-0" />
            <span>Добавить строку кнопок</span>
          </button>
        </div>
      </div>

      {/* Selected Button Properties Editor */}
      {activeBtn && activeRow && (
        <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
          <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-3.5 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[14px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Настройка кнопки: строка {selectedPos.rowIdx + 1}, позиция {selectedPos.btnIdx + 1}
              </span>

              <div className="flex items-center gap-1.5">
                {activeRow.buttons.length > 1 && (
                  <>
                    <ResponsiveActionBtn
                      icon={<ArrowLeft size={14} />}
                      label="Левее"
                      showLabelFrom="never"
                      variant="outline"
                      disabled={selectedPos.btnIdx === 0}
                      onClick={() =>
                        handleMoveBtnInRow(selectedPos.rowIdx, selectedPos.btnIdx, -1)
                      }
                    />
                    <ResponsiveActionBtn
                      icon={<ArrowRight size={14} />}
                      label="Правее"
                      showLabelFrom="never"
                      variant="outline"
                      disabled={selectedPos.btnIdx === activeRow.buttons.length - 1}
                      onClick={() =>
                        handleMoveBtnInRow(selectedPos.rowIdx, selectedPos.btnIdx, 1)
                      }
                    />
                  </>
                )}
                <ResponsiveActionBtn
                  icon={<Trash2 size={14} />}
                  label="Удалить кнопку"
                  variant="danger"
                  onClick={() => handleDeleteButton(selectedPos.rowIdx, selectedPos.btnIdx)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
              <div className="min-w-0">
                <label className="block text-[14px] font-bold mb-1 text-slate-900">
                  Текст на кнопке
                </label>
                <input
                  type="text"
                  value={activeBtn.text}
                  onChange={(e) => handleUpdateSelected({ text: e.target.value })}
                  placeholder="Например: Перейти в канал"
                  className="w-full min-w-0 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 text-[14px] font-semibold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[14px] font-bold mb-1 text-slate-900">
                  {activeBtn.type === 'copy_text'
                    ? 'Текст или промокод для копирования'
                    : activeBtn.type === 'callback'
                    ? 'Callback-данные кнопки'
                    : 'Целевая ссылка'}
                </label>
                <input
                  type="text"
                  value={activeBtn.value ?? activeBtn.url ?? ''}
                  onChange={(e) => handleUpdateSelected({ value: e.target.value })}
                  placeholder={
                    activeBtn.type === 'copy_text'
                      ? 'Промокод2026'
                      : 'https://t.me/IIrkiBot'
                  }
                  className="w-full min-w-0 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div
              className={`grid grid-cols-1 ${
                allowButtonTypes ? 'sm:grid-cols-2' : ''
              } gap-2.5 min-w-0`}
            >
              {allowButtonTypes && (
                <GradientSelect
                  compact
                  label="Тип действия кнопки"
                  value={activeBtn.type || 'url'}
                  onChange={(val) =>
                    handleUpdateSelected({ type: val as InlineButtonItem['type'] })
                  }
                  options={INLINE_BUTTON_TYPE_OPTIONS}
                />
              )}

              <GradientSelect
                compact
                label="Цвет кнопки в Telegram"
                value={
                  activeBtn.style === 'success' ||
                  activeBtn.style === 'danger' ||
                  activeBtn.style === 'primary'
                    ? activeBtn.style
                    : 'default'
                }
                onChange={(val) =>
                  handleUpdateSelected({ style: val as InlineButtonItem['style'] })
                }
                options={TELEGRAM_STYLE_OPTIONS}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AiInlineButtonsDbPromptSectionProps {
  userId?: string;
  layoutRule: InlineButtonsLayoutRuleOption;
  onChangeLayoutRule: (next: InlineButtonsLayoutRuleOption) => void;
  customInstruction: string;
  onChangeCustomInstruction: (next: string) => void;
  promptText: string;
  onChangePromptText: (next: string) => void;
}

export const AiInlineButtonsDbPromptSection: React.FC<AiInlineButtonsDbPromptSectionProps> = ({
  userId,
  layoutRule,
  onChangeLayoutRule,
  customInstruction,
  onChangeCustomInstruction,
  promptText,
  onChangePromptText
}) => {
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptNotice, setPromptNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (loadedOnce) return;
    let cancelled = false;
    setIsLoadingPrompt(true);
    fetch(`/api/inline-buttons/prompt?userId=${encodeURIComponent(userId || '16926299042')}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data) return;
        if (data.promptText) {
          onChangePromptText(String(data.promptText));
        }
        if (data.layoutRule && !layoutRule) {
          onChangeLayoutRule(data.layoutRule as InlineButtonsLayoutRuleOption);
        }
        setLoadedOnce(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingPrompt(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layoutRule, loadedOnce, onChangeLayoutRule, onChangePromptText, userId]);

  const handleSavePromptToDb = async () => {
    setIsSavingPrompt(true);
    setPromptNotice(null);
    try {
      const res = await fetch('/api/inline-buttons/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || '16926299042',
          promptText,
          layoutRule,
          customInstruction
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Не удалось сохранить промпт в базу данных');
      }
      if (data.promptText) onChangePromptText(data.promptText);
      setPromptNotice({
        type: 'ok',
        text: 'Промпт и правило раскладки зафиксированы в базе данных на сервере'
      });
    } catch (err: any) {
      setPromptNotice({
        type: 'err',
        text: err?.message || 'Ошибка сохранения промпта'
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleResetPromptInDb = async () => {
    setIsSavingPrompt(true);
    setPromptNotice(null);
    try {
      const res = await fetch('/api/inline-buttons/reset-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || '16926299042' })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Не удалось сбросить промпт');
      }
      if (data.promptText) onChangePromptText(data.promptText);
      setPromptNotice({
        type: 'ok',
        text: 'Восстановлен базовый системный промпт генерации кнопок'
      });
    } catch (err: any) {
      setPromptNotice({
        type: 'err',
        text: err?.message || 'Ошибка сброса промпта'
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <AutoGrowVoiceTextarea
        label="Пожелания для ИИ к генерации кнопок"
        value={customInstruction}
        onChange={(val) => onChangeCustomInstruction(val)}
        minRows={2}
        showClearButton
        placeholder="Например: сделай первую кнопку зелёной с призывом записаться на разбор, а вторую синей для перехода в канал"
      />

      <CollapsibleSection
        title="Промпт генератора кнопок в базе данных"
        summary={
          isLoadingPrompt
            ? 'Загрузка промпта из базы данных...'
            : 'Свой системный промпт в базе данных, по которому работает ИИ'
        }
        icon={<Database size={16} />}
        defaultOpen={false}
      >
        <div className="space-y-2.5 min-w-0">
          <div className="text-[14px] text-slate-700 leading-snug break-words">
            Доступные подстановки: {'{count}'}, {'{title}'}, {'{text}'}, {'{urls}'},{' '}
            {'{layout_rule}'}, {'{custom_instruction}'}. Изменения сохраняются в базу данных на
            сервере и применяются в редакторе и сценариях.
          </div>

          <AutoGrowVoiceTextarea
            label="Системный промпт генерации инлайн-кнопок"
            value={promptText}
            onChange={(val) => onChangePromptText(val)}
            minRows={4}
            placeholder="Введите системный промпт генерации инлайн-кнопок..."
          />

          <div className="flex items-center gap-2 flex-wrap">
            <ResponsiveActionBtn
              icon={isSavingPrompt ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              label="Сохранить промпт в базу"
              alwaysShowLabel
              variant="vivid"
              disabled={isSavingPrompt || !promptText.trim()}
              onClick={handleSavePromptToDb}
            />
            <ResponsiveActionBtn
              icon={<RotateCcw size={15} />}
              label="Сбросить к базовому"
              variant="outline"
              disabled={isSavingPrompt}
              onClick={handleResetPromptInDb}
            />
          </div>

          {promptNotice && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 to-sky-100/85 border border-pink-300 text-[14px] font-semibold text-slate-900">
              <Check size={15} className="text-pink-600 shrink-0" />
              <span className="break-words">{promptNotice.text}</span>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
