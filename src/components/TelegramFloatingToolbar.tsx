import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  Type,
  Heading,
  Link as LinkIcon, 
  Quote, 
  List,
  Sliders,
  Table as TableIcon, 
  Image as ImageIcon, 
  Anchor,
  Clock,
  Eraser, 
  Sparkles, 
  X,
  Code,
  Edit3,
  Copy,
  Check,
  MousePointerClick
} from 'lucide-react';
import { ActiveSelectionStyles, getStyleDescription } from './PostTelegramEditor';

export interface TelegramFloatingToolbarProps {
  toolbarRef: React.RefObject<HTMLDivElement>;
  toolbarPos: { top: number; left: number; arrow?: 'top' | 'bottom'; arrowLeft?: number } | null;
  selectedText: string;
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  activeStyles: ActiveSelectionStyles;
  onApplyFormat: (formatType: string) => void;
  onOpenLinkModal: () => void;
  onOpenTableModal: () => void;
  onOpenMediaModal: (tab?: 'photo' | 'video' | 'audio' | 'document' | 'collage' | 'slideshow' | 'slider') => void;
  onOpenButtonModal?: () => void;
  onOpenCarouselModal?: () => void;
  onOpenCollageModal?: () => void;
  onOpenFormulaModal: () => void;
  onOpenQuoteModal: () => void;
  onOpenEmojiTimeModal: (tab?: 'emoji' | 'time' | 'latex') => void;
  onOpenAnchorModal: (tab?: 'create' | 'link' | 'tg_ref' | 'footnote') => void;
  onClose: () => void;
  isFixed?: boolean;
  onQuote?: (text: string) => void;
  onInsertToInput?: (text: string) => void;
  onCopy?: (text: string) => void;
}

type ToolbarCategory = 
  | 'text' 
  | 'heading' 
  | 'link' 
  | 'buttons'
  | 'quote' 
  | 'list' 
  | 'breaks' 
  | 'table' 
  | 'media' 
  | 'anchors' 
  | 'emoji_time';

export const TelegramFloatingToolbar: React.FC<TelegramFloatingToolbarProps> = ({
  toolbarRef,
  toolbarPos,
  selectedText,
  messageFormat,
  activeStyles,
  onApplyFormat,
  onOpenLinkModal,
  onOpenTableModal,
  onOpenMediaModal,
  onOpenButtonModal,
  onOpenCarouselModal,
  onOpenCollageModal,
  onOpenFormulaModal,
  onOpenQuoteModal,
  onOpenEmojiTimeModal,
  onOpenAnchorModal,
  onClose,
  isFixed = false,
  onQuote,
  onInsertToInput,
  onCopy
}) => {
  const isRich = messageFormat === 'rich';
  const [activeCategory, setActiveCategory] = useState<ToolbarCategory>('text');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isRich && (activeCategory !== 'text' && activeCategory !== 'link' && activeCategory !== 'quote')) {
      setActiveCategory('text');
    }
  }, [isRich, activeCategory]);

  if (!toolbarPos) return null;

  const handleCopyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onCopy) {
      onCopy(selectedText);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selectedText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Categories config
  const categories: { id: ToolbarCategory; label: string; icon: React.ReactNode; richOnly?: boolean; hasActive?: boolean }[] = [
    {
      id: 'text',
      label: 'Текст',
      icon: <Type size={15} />,
      hasActive: Boolean(
        activeStyles.bold || 
        activeStyles.italic || 
        activeStyles.underline || 
        activeStyles.strike || 
        activeStyles.spoiler || 
        activeStyles.code || 
        activeStyles.code_block ||
        activeStyles.sup ||
        activeStyles.sub
      )
    },
    {
      id: 'heading',
      label: 'Заголовки',
      icon: <Heading size={15} />,
      richOnly: true,
      hasActive: Boolean(activeStyles.h1 || activeStyles.h2 || activeStyles.h3 || activeStyles.h4)
    },
    {
      id: 'link',
      label: 'Ссылки',
      icon: <LinkIcon size={15} />,
      hasActive: Boolean(activeStyles.link)
    },
    {
      id: 'buttons',
      label: 'Кнопки',
      icon: <MousePointerClick size={15} />,
      richOnly: true
    },
    {
      id: 'quote',
      label: 'Цитаты',
      icon: <Quote size={15} />,
      hasActive: Boolean(activeStyles.quote || activeStyles.expandable_quote || activeStyles.aside)
    },
    {
      id: 'list',
      label: 'Списки',
      icon: <List size={15} />,
      richOnly: true,
      hasActive: Boolean(activeStyles.bullet_list || activeStyles.number_list || activeStyles.checkbox || activeStyles.checkbox_done)
    },
    {
      id: 'breaks',
      label: 'Детали и разрывы',
      icon: <Sliders size={15} />,
      richOnly: true,
      hasActive: Boolean(activeStyles.details || activeStyles.page_break)
    },
    {
      id: 'table',
      label: 'Таблица',
      icon: <TableIcon size={15} />,
      richOnly: true
    },
    {
      id: 'media',
      label: 'Медиа',
      icon: <ImageIcon size={15} />,
      richOnly: true
    },
    {
      id: 'anchors',
      label: 'Якоря и сноски',
      icon: <Anchor size={15} />,
      richOnly: true
    },
    {
      id: 'emoji_time',
      label: 'Эмодзи / время',
      icon: <Clock size={15} />,
      richOnly: true
    }
  ];

  // Filter categories according to format
  const visibleCategories = categories.filter(cat => !cat.richOnly || isRich);

  const toolbarContent = (
    <div
      ref={toolbarRef}
      className={`${isFixed ? 'fixed' : 'absolute'} z-[99999] flex flex-col gap-2 p-3 rounded-2xl border-2 border-pink-400 shadow-2xl backdrop-blur-md animate-in fade-in duration-150 max-w-[calc(100%-16px)] sm:max-w-[560px] select-none overflow-visible`}
      style={{
        top: `${toolbarPos.top}px`,
        left: `${toolbarPos.left}px`,
        background: 'linear-gradient(120deg, rgba(240, 249, 255, 0.98) 0%, rgba(253, 242, 248, 0.98) 25%, rgba(255, 247, 237, 0.98) 50%, rgba(253, 242, 248, 0.98) 75%, rgba(240, 249, 255, 0.98) 100%)'
      }}
      onMouseDown={(e) => {
        // Prevent input blur while allowing click on buttons
        e.preventDefault();
      }}
    >
      {/* Pointer arrow pointing towards selection */}
      {toolbarPos.arrow === 'top' ? (
        <div
          className="absolute -top-2 w-3.5 h-3.5 rotate-45 border-t-2 border-l-2 border-pink-400"
          style={{
            left: `${toolbarPos.arrowLeft ?? 24}px`,
            background: 'rgba(253, 242, 248, 0.98)'
          }}
        />
      ) : (
        <div
          className="absolute -bottom-2 w-3.5 h-3.5 rotate-45 border-b-2 border-r-2 border-pink-400"
          style={{
            left: `${toolbarPos.arrowLeft ?? 24}px`,
            background: 'rgba(253, 242, 248, 0.98)'
          }}
        />
      )}

      {/* Header bar: Selected snippet, format pill, active style and action buttons */}
      <div className="flex items-center justify-between gap-2 text-[14px] border-b border-pink-200/80 pb-1.5 flex-wrap">
        <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-white/95 rounded-xl border border-pink-300 max-w-[180px] sm:max-w-[210px] truncate shadow-2xs">
          <Sparkles size={14} className="text-pink-600 shrink-0" />
          <span className="font-semibold text-slate-800 truncate text-[14px]">
            «{selectedText.length > 24 ? selectedText.slice(0, 22) + '…' : selectedText}»
          </span>
        </div>

        {/* Quick chat actions if enabled (Quote / Insert To Input / Copy) */}
        <div className="flex items-center gap-1">
          {onQuote && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                onQuote(selectedText);
                onClose();
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 hover:bg-pink-50 text-slate-800 font-bold border border-pink-300 transition-all cursor-pointer hover:text-pink-600 text-[14px] shadow-2xs"
              title="Ответить цитатой на этот фрагмент"
            >
              <Quote size={14} className="text-pink-600" />
              <span>Цитировать</span>
            </button>
          )}

          {onInsertToInput && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                onInsertToInput(selectedText);
                onClose();
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 hover:bg-pink-50 text-slate-800 font-bold border border-pink-300 transition-all cursor-pointer hover:text-pink-600 text-[14px] shadow-2xs"
              title="Перенести выделенный текст в поле ввода"
            >
              <Edit3 size={14} className="text-pink-600" />
              <span>В поле ввода</span>
            </button>
          )}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopyClick}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 hover:bg-pink-50 text-slate-800 font-bold border border-pink-300 transition-all cursor-pointer hover:text-pink-600 text-[14px] shadow-2xs"
            title="Скопировать выделенный текст"
          >
            {copied ? (
              <>
                <Check size={14} className="text-pink-600" />
                <span>Копия</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-pink-600" />
                <span>Копировать</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-1.5 ml-auto">
          <span className="text-[14px] font-mono px-2 py-0.5 rounded-lg font-bold bg-white/90 text-pink-700 border border-pink-300 shadow-2xs">
            {isRich ? 'Rich' : 'Markdown V2'}
          </span>
          <span className="text-[14px] text-slate-700 hidden sm:inline">
            <strong className="font-bold text-pink-600">{getStyleDescription(activeStyles, isRich)}</strong>
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="p-1 hover:bg-pink-100 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition-colors ml-1"
            title="Закрыть панель"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Row 1: Grouped Category Tabs (Icons with tooltips and active indicator) */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap pb-0.5">
        <div className="flex items-center gap-1 flex-wrap">
          {visibleCategories.map(cat => {
            const isCurrent = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveCategory(cat.id);
                }}
                className={`relative p-2 rounded-xl text-[14px] font-bold border cursor-pointer transition-all flex items-center justify-center ${
                  isCurrent
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white border-pink-400 shadow-2xs scale-105'
                    : 'bg-white/90 hover:bg-pink-50 border-pink-200 text-slate-700'
                }`}
                title={cat.label}
              >
                {cat.icon}
                {cat.hasActive && !isCurrent && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-600 border border-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action: Clear Formatting / Remove Tags */}
        <div className="flex items-center ml-1 border-l border-pink-200 pl-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              onApplyFormat('clear');
            }}
            className="px-2 py-1 bg-white/90 hover:bg-pink-50 active:scale-95 transition-transform border border-pink-300 rounded-xl text-pink-700 font-bold text-[14px] cursor-pointer flex items-center space-x-1 shadow-2xs whitespace-nowrap"
            title="Очистить форматирование выделенного фрагмента"
          >
            <Eraser size={14} />
            <span className="hidden sm:inline">снять теги</span>
          </button>
        </div>
      </div>

      {/* Row 2: Formats and Action Buttons for Selected Category */}
      <div className="p-2 rounded-xl bg-white/80 border border-pink-200/90 shadow-2xs flex items-center gap-1.5 flex-wrap">
        {/* CATEGORY: TEXT */}
        {activeCategory === 'text' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('bold'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.bold
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Жирный шрифт"
            >
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('italic'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] italic border cursor-pointer shadow-2xs transition-all ${
                activeStyles.italic
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Курсив"
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('underline'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] underline border cursor-pointer shadow-2xs transition-all ${
                activeStyles.underline
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Подчеркнутый"
            >
              U
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('strike'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] line-through border cursor-pointer shadow-2xs transition-all ${
                activeStyles.strike
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Зачеркнутый"
            >
              S
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('spoiler'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.spoiler
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Скрытый текст (спойлер)"
            >
              || спойлер ||
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('code'); }}
              className={`px-2 py-1 font-mono text-[14px] rounded-xl border cursor-pointer shadow-2xs transition-all ${
                activeStyles.code
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Моноширинный код"
            >
              `код`
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('code_block'); }}
              className={`px-2 py-1 font-mono text-[14px] rounded-xl border cursor-pointer shadow-2xs transition-all flex items-center space-x-1 ${
                activeStyles.code_block
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105 ring-2 ring-pink-300/70'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Блок кода с подсветкой синтаксиса"
            >
              <Code size={14} />
              <span>```блок```</span>
            </button>
            {isRich && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('sup'); }}
                  className={`px-2 py-1 font-mono text-[14px] rounded-xl border cursor-pointer shadow-2xs transition-all ${
                    activeStyles.sup
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105'
                      : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                  }`}
                  title="Верхний индекс (x²)"
                >
                  x²
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('sub'); }}
                  className={`px-2 py-1 font-mono text-[14px] rounded-xl border cursor-pointer shadow-2xs transition-all ${
                    activeStyles.sub
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold border-pink-400 scale-105'
                      : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                  }`}
                  title="Нижний индекс (x₂)"
                >
                  x₂
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('formula'); }}
                  className="px-2 py-1 font-mono text-[14px] rounded-xl border border-pink-300 bg-white/90 hover:bg-pink-50 text-slate-900 cursor-pointer shadow-2xs"
                  title="Математическая формула в тексте ($f$)"
                >
                  $f$
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('formula_block'); }}
                  className="px-2 py-1 font-mono text-[14px] rounded-xl border border-pink-300 bg-white/90 hover:bg-pink-50 text-slate-900 cursor-pointer shadow-2xs font-bold"
                  title="Блок формулы ($$формула$$)"
                >
                  $$формула$$
                </button>
              </>
            )}
          </>
        )}

        {/* CATEGORY: HEADINGS */}
        {activeCategory === 'heading' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('h1'); }}
              className={`px-3 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.h1
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Заголовок H1 (# Заголовок)"
            >
              H1 Главный
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('h2'); }}
              className={`px-3 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.h2
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Заголовок H2 (## Подзаголовок)"
            >
              H2 Раздел
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('h3'); }}
              className={`px-3 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.h3
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Заголовок H3 (### Подраздел)"
            >
              H3 Подраздел
            </button>
            {isRich && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.preventDefault(); onApplyFormat('h4'); }}
                className={`px-3 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                  activeStyles.h4
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                    : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                }`}
                title="Заголовок H4 (#### Мелкий)"
              >
                H4 Пункт
              </button>
            )}
          </>
        )}

        {/* CATEGORY: LINKS */}
        {activeCategory === 'link' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenLinkModal(); }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Вставить ссылку на выделенный текст"
            >
              <LinkIcon size={14} className="text-pink-600" />
              <span>вставить ссылку</span>
            </button>
          </>
        )}

        {/* CATEGORY: BUTTONS (Rich Bot API 10.3) */}
        {activeCategory === 'buttons' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                if (onOpenButtonModal) onOpenButtonModal();
                else onApplyFormat('buttons');
              }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Открыть конструктор встроенных кнопок и рядов кнопок (<tg-button>)"
            >
              <MousePointerClick size={14} className="text-pink-600" />
              <span>конструктор кнопок (&lt;tg-button&gt;)</span>
            </button>
          </>
        )}

        {/* CATEGORY: QUOTES */}
        {activeCategory === 'quote' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('quote'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all flex items-center space-x-1 ${
                activeStyles.quote
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Обычная цитата"
            >
              <Quote size={14} />
              <span>цитата</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('expandable_quote'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all flex items-center space-x-1 ${
                activeStyles.expandable_quote
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Сворачиваемая цитата"
            >
              <span>▾ свернуть</span>
            </button>
            {isRich && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('aside'); }}
                  className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                    activeStyles.aside
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                      : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                  }`}
                  title="Цитата по центру (aside)"
                >
                  <span>по центру (aside)</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onOpenQuoteModal(); }}
                  className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1"
                  title="Конструктор цитат с автором"
                >
                  <Quote size={14} className="text-pink-600" />
                  <span>конструктор цитат</span>
                </button>
              </>
            )}
          </>
        )}

        {/* CATEGORY: LISTS */}
        {activeCategory === 'list' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('bullet_list'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.bullet_list
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Маркированный список (• пункт)"
            >
              • список
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('number_list'); }}
              className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                activeStyles.number_list
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                  : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
              }`}
              title="Нумерованный список (1. пункт)"
            >
              1. список
            </button>
            {isRich && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('checkbox'); }}
                  className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                    activeStyles.checkbox
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                      : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                  }`}
                  title="Чек-бокс задача [ ]"
                >
                  ☐ задача
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.preventDefault(); onApplyFormat('checkbox_done'); }}
                  className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                    activeStyles.checkbox_done
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                      : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                  }`}
                  title="Выполненная задача [x]"
                >
                  ☑ выполнено
                </button>
              </>
            )}
          </>
        )}

        {/* CATEGORY: BREAKS AND DETAILS */}
        {activeCategory === 'breaks' && (
          <>
            {isRich && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.preventDefault(); onApplyFormat('details'); }}
                className={`px-2.5 py-1 rounded-xl text-[14px] font-bold border cursor-pointer shadow-2xs transition-all ${
                  activeStyles.details
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400 scale-105'
                    : 'bg-white/90 hover:bg-pink-50 border-pink-300 text-slate-900'
                }`}
                title="Спойлер блок <details><summary>"
              >
                ▾ детали (спойлер)
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onApplyFormat('page_break'); }}
              className="px-2.5 py-1 rounded-xl text-[14px] font-bold border border-pink-300 bg-white/90 hover:bg-pink-50 text-slate-900 cursor-pointer shadow-2xs"
              title="Разделитель страниц (---)"
            >
              — разрыв (---)
            </button>
            {isRich && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.preventDefault(); onApplyFormat('br'); }}
                className="px-2.5 py-1 rounded-xl text-[14px] font-bold border border-pink-300 bg-white/90 hover:bg-pink-50 text-slate-900 cursor-pointer shadow-2xs"
                title="Перенос строки без абзаца (<br>)"
              >
                ↵ перенос (&lt;br&gt;)
              </button>
            )}
          </>
        )}

        {/* CATEGORY: TABLE */}
        {activeCategory === 'table' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenTableModal(); }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Открыть конструктор таблиц"
            >
              <TableIcon size={14} className="text-pink-600" />
              <span>конструктор таблиц</span>
            </button>
          </>
        )}

        {/* CATEGORY: MEDIA */}
        {activeCategory === 'media' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenMediaModal('photo'); }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Открыть менеджер медиафайла"
            >
              <ImageIcon size={14} className="text-pink-600" />
              <span>медиафайл</span>
            </button>
            {isRich && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (onOpenCollageModal) onOpenCollageModal();
                    else onOpenMediaModal('collage');
                  }}
                  className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs flex items-center space-x-1"
                  title="Конструктор сетки коллажа"
                >
                  <span>▦ коллаж</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (onOpenCarouselModal) onOpenCarouselModal();
                    else onOpenMediaModal('slideshow');
                  }}
                  className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs flex items-center space-x-1"
                  title="Конструктор карусели слайдов"
                >
                  <span>☷ карусель</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenMediaModal('document');
                  }}
                  className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs flex items-center space-x-1"
                  title="Вставить документ, видео или аудио (<tg-document> / 10.4)"
                >
                  <span>📄 документ</span>
                </button>
              </>
            )}
          </>
        )}

        {/* CATEGORY: ANCHORS & FOOTNOTES */}
        {activeCategory === 'anchors' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenAnchorModal('create'); }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Открыть конструктор якорей, сносок и ссылок"
            >
              <Anchor size={14} className="text-pink-600" />
              <span>конструктор якорей и сносок</span>
            </button>
          </>
        )}

        {/* CATEGORY: EMOJI & TIME */}
        {activeCategory === 'emoji_time' && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenEmojiTimeModal('emoji'); }}
              className="px-3 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs transition-all flex items-center space-x-1.5"
              title="Открыть эмодзи и время"
            >
              <Sparkles size={14} className="text-pink-600" />
              <span>эмодзи</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenEmojiTimeModal('time'); }}
              className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs flex items-center space-x-1"
              title="Конструктор динамического времени"
            >
              <Clock size={14} className="text-pink-600" />
              <span>⏱ время</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); onOpenEmojiTimeModal('latex'); }}
              className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 rounded-xl text-[14px] font-bold border border-pink-300 text-slate-900 cursor-pointer shadow-2xs flex items-center space-x-1"
              title="Конструктор формул LaTeX"
            >
              <span>∑ формулы</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (isFixed && typeof document !== 'undefined') {
    return ReactDOM.createPortal(toolbarContent, document.body);
  }

  return toolbarContent;
};
