import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

export interface GradientDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  hint?: string;
  meta?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

function useFloatingDropdownPortal(
  open: boolean,
  setOpen: (next: boolean) => void,
  rootRef: React.RefObject<HTMLDivElement | null>,
  triggerRef: React.RefObject<HTMLDivElement | null>,
  options?: { fixedWidth?: number; alignRight?: boolean }
) {
  const portalRef = useRef<HTMLDivElement>(null);

  const syncPosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const portalEl = portalRef.current;
    if (!triggerEl || !portalEl || typeof window === 'undefined') return;

    const rect = triggerEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredWidth = options?.fixedWidth
      ? Math.min(options.fixedWidth, vw - 16)
      : Math.min(Math.max(rect.width, 180), vw - 16);

    const rawLeft = options?.alignRight ? rect.right - desiredWidth : rect.left;
    const clampedLeft = Math.max(8, Math.min(rawLeft, vw - desiredWidth - 8));

    const spaceBelow = vh - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const shouldFlipUp = spaceBelow < 250 && spaceAbove > spaceBelow;

    portalEl.style.width = `${desiredWidth}px`;
    portalEl.style.left = `${clampedLeft}px`;

    if (shouldFlipUp) {
      portalEl.style.top = 'auto';
      portalEl.style.bottom = `${Math.max(8, vh - rect.top + 6)}px`;
    } else {
      portalEl.style.bottom = 'auto';
      portalEl.style.top = `${Math.max(8, rect.bottom + 6)}px`;
    }
  }, [options?.alignRight, options?.fixedWidth, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    syncPosition();
    const raf = window.requestAnimationFrame(syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    window.addEventListener('resize', syncPosition);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', syncPosition, true);
      window.removeEventListener('resize', syncPosition);
    };
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || portalRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, rootRef, setOpen]);

  return portalRef;
}

interface GradientSelectProps {
  value: string;
  onChange: (nextValue: string) => void;
  options: GradientDropdownOption[];
  label?: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  buttonVariant?: 'vivid' | 'translucent';
  compact?: boolean;
}

export const GradientSelect: React.FC<GradientSelectProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = 'Выберите вариант',
  searchable = false,
  searchPlaceholder = 'Поиск по списку...',
  disabled = false,
  className = '',
  buttonVariant = 'translucent',
  compact = false
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useFloatingDropdownPortal(open, setOpen, rootRef, triggerRef);

  const selectedOpt = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.trim().toLowerCase();
        const desc = o.sublabel || o.hint || '';
        return (
          o.label.toLowerCase().includes(q) ||
          (desc && desc.toLowerCase().includes(q)) ||
          (o.group && o.group.toLowerCase().includes(q))
        );
      })
    : options;

  const menuNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={portalRef}
            className="fixed z-[99999] p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl"
          >
            <div className="rounded-[14.5px] bg-gradient-to-br from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-xl overflow-hidden">
              {searchable && (
                <div className="p-2 border-b border-pink-300/60">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/75 border border-pink-300/70">
                    <Search size={15} className="text-pink-600 shrink-0" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="w-full min-w-0 bg-transparent text-[14px] text-slate-900 placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-[14px] text-slate-600 text-center">
                    Ничего не найдено
                  </div>
                ) : (
                  filtered.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const prevGroup = idx > 0 ? filtered[idx - 1].group : undefined;
                    const showGroupHeader = Boolean(opt.group && opt.group !== prevGroup);

                    return (
                      <React.Fragment key={opt.value}>
                        {showGroupHeader && (
                          <div className="px-2.5 pt-2 pb-1 text-[14px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                            {opt.group}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            if (opt.disabled) return;
                            onChange(opt.value);
                            setOpen(false);
                            setQuery('');
                          }}
                          className={`w-full min-w-0 flex items-start justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                              : 'hover:bg-white/70 text-slate-900'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {opt.icon && <span className="mt-0.5 shrink-0">{opt.icon}</span>}
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-semibold leading-snug break-words">
                                {opt.label}
                                {opt.meta && (
                                  <span
                                    className={`ml-1.5 font-normal ${
                                      isSelected ? 'text-white/90' : 'text-slate-600'
                                    }`}
                                  >
                                    · {opt.meta}
                                  </span>
                                )}
                              </div>
                              {(opt.sublabel || opt.hint) && (
                                <div
                                  className={`text-[14px] leading-snug mt-0.5 break-words ${
                                    isSelected ? 'text-white/90' : 'text-slate-600'
                                  }`}
                                >
                                  {opt.sublabel || opt.hint}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check size={16} className="shrink-0 mt-0.5 text-white" />}
                        </button>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0 ${className}`}>
      {label && (
        <label className="block text-[14px] font-bold mb-1.5 bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
          {label}
        </label>
      )}

      <div
        ref={triggerRef}
        className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((p) => !p)}
          className={`w-full min-w-0 flex items-center justify-between gap-2 text-left rounded-[10.5px] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            compact ? 'px-3 py-2 min-h-[40px]' : 'px-3.5 py-2.5 min-h-[42px]'
          } ${
            buttonVariant === 'vivid'
              ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold'
              : 'bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md text-slate-900 font-semibold hover:from-sky-100/95 hover:to-sky-100/95'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {selectedOpt?.icon && <span className="shrink-0">{selectedOpt.icon}</span>}
            <span className="min-w-0 flex-1 truncate text-[14px] leading-snug">
              {selectedOpt ? selectedOpt.label : placeholder}
              {selectedOpt?.meta && (
                <span
                  className={`ml-1.5 font-normal ${
                    buttonVariant === 'vivid' ? 'text-white/90' : 'text-slate-600'
                  }`}
                >
                  · {selectedOpt.meta}
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            } ${buttonVariant === 'vivid' ? 'text-white' : 'text-pink-600'}`}
          />
        </button>
      </div>

      {menuNode}
    </div>
  );
};

interface GradientMultiSelectProps {
  values: string[];
  onChange: (nextValues: string[]) => void;
  options: GradientDropdownOption[];
  label?: string;
  placeholder?: string;
  className?: string;
  selectAllLabel?: string;
}

export const GradientMultiSelect: React.FC<GradientMultiSelectProps> = ({
  values,
  onChange,
  options,
  label,
  placeholder = 'Выберите элементы',
  className = '',
  selectAllLabel
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useFloatingDropdownPortal(open, setOpen, rootRef, triggerRef);

  const toggleVal = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);

  const summaryText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 3
      ? selectedLabels.join(', ')
      : `Выбрано: ${selectedLabels.length} из ${options.length}`;

  const menuNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={portalRef}
            className="fixed z-[99999] p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl"
          >
            <div className="rounded-[14.5px] bg-gradient-to-br from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-xl p-1.5 max-h-72 overflow-y-auto space-y-1">
              {selectAllLabel && options.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (values.length === options.length) {
                      onChange([]);
                    } else {
                      onChange(options.filter((o) => !o.disabled).map((o) => o.value));
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-bold text-pink-700 hover:bg-white/70 cursor-pointer border-b border-pink-300/50"
                >
                  <span>{selectAllLabel}</span>
                  <span>{values.length === options.length ? 'Снять все' : 'Выбрать все'}</span>
                </button>
              )}

              {options.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => !opt.disabled && toggleVal(opt.value)}
                    className={`w-full min-w-0 flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                      checked
                        ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-semibold shadow-sm'
                        : 'hover:bg-white/70 text-slate-900 font-medium'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] leading-snug break-words">{opt.label}</div>
                      {(opt.sublabel || opt.hint) && (
                        <div
                          className={`text-[14px] leading-snug ${
                            checked ? 'text-white/90' : 'text-slate-600'
                          }`}
                        >
                          {opt.sublabel || opt.hint}
                        </div>
                      )}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                        checked
                          ? 'bg-white/25 border-white text-white'
                          : 'bg-white/70 border-pink-400 text-transparent'
                      }`}
                    >
                      <Check size={14} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0 ${className}`}>
      {label && (
        <label className="block text-[14px] font-bold mb-1.5 bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
          {label}
        </label>
      )}

      <div
        ref={triggerRef}
        className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm"
      >
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="w-full min-w-0 flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[42px] rounded-[10.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md text-slate-900 font-semibold text-left cursor-pointer"
        >
          <span className="min-w-0 flex-1 break-words text-[14px] leading-snug">
            {summaryText}
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-pink-600 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {menuNode}
    </div>
  );
};

export interface VariableTokenOption {
  token: string;
  label: string;
  hint?: string;
}

export type ScenarioVariableOption = VariableTokenOption;

export const DEFAULT_SCENARIO_VARIABLES: VariableTokenOption[] = [
  { token: '{{topic}}', label: 'Тема шага {{topic}}', hint: 'Название или рубрика из предыдущего шага' },
  { token: '{{category}}', label: 'Рубрика {{category}}', hint: 'Текущая категория или тематика' },
  { token: '{{summary}}', label: 'Краткая выжимка {{summary}}', hint: 'Сжатая суть предыдущего шага' },
  { token: '{{text}}', label: 'Полный текст {{text}}', hint: 'Весь готовый текст поста' },
  { token: '{{image_prompt}}', label: 'Промпт картинки {{image_prompt}}', hint: 'Готовое описание визуала' },
  { token: '{{channel}}', label: 'Канал {{channel}}', hint: 'Целевой канал публикации' },
  { token: '{{date}}', label: 'Дата {{date}}', hint: 'Текущая дата в часовом поясе сценария' },
  { token: '{{time}}', label: 'Время {{time}}', hint: 'Текущее время в часовом поясе сценария' }
];

export const VariableInsertDropdown: React.FC<{
  onInsert: (token: string) => void;
  variables?: VariableTokenOption[];
  buttonLabel?: string;
}> = ({
  onInsert,
  variables = DEFAULT_SCENARIO_VARIABLES,
  buttonLabel = 'Переменная'
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useFloatingDropdownPortal(open, setOpen, rootRef, triggerRef, {
    fixedWidth: 288,
    alignRight: true
  });

  const menuNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={portalRef}
            className="fixed z-[99999] p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl"
          >
            <div className="rounded-[14.5px] bg-gradient-to-br from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-xl p-1.5 space-y-1 max-h-72 overflow-y-auto">
              {variables.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => {
                    onInsert(v.token);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/75 transition-colors cursor-pointer"
                >
                  <div className="text-[14px] font-bold text-slate-900 break-words">{v.label}</div>
                  {v.hint && <div className="text-[14px] text-slate-600 leading-snug">{v.hint}</div>}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative inline-block">
      <div ref={triggerRef} className="inline-block">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          title="Вставить переменную цепочки"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-semibold shadow-sm hover:brightness-105 cursor-pointer"
        >
          <Plus size={15} />
          <span>{buttonLabel}</span>
          <ChevronDown
            size={14}
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>
      </div>

      {menuNode}
    </div>
  );
};
