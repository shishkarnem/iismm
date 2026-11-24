import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Anchor,
  Image as ImageIcon,
  Redo2,
  Sparkles,
  Table as TableIcon,
  Undo2
} from 'lucide-react';
import { MiniAudioField } from '../MiniAudioField';
import { TelegramFloatingToolbar } from '../TelegramFloatingToolbar';
import { useEditorFormattingActions } from '../post-editor/core/useEditorFormattingActions';
import {
  EditorLinkModal,
  EditorQuoteModal
} from '../post-editor/modals/EditorLinkAndQuoteModals';
import {
  EditorMediaModal,
  RichMediaInsertTab
} from '../post-editor/modals/EditorMediaModal';
import { EditorRichButtonModal } from '../post-editor/modals/rich-constructors/EditorRichButtonModal';
import { EditorTableModal } from '../post-editor/modals/EditorTableModal';
import {
  EditorAnchorsModal,
  EditorEmojiTimeModal
} from '../post-editor/modals/EditorEmojiFormulaAnchorModals';
import { GallerySelectModal } from '../GallerySelectModal';
import { ImageBuilderModal } from '../image-builder/ImageBuilderModal';

export interface OnboardingFormattedTextFieldProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  format: 'v2' | 'rich';
  userId?: string;
  minRows?: number;
  placeholder?: string;
  hintText?: string;
  onBlur?: () => void;
  extraHeaderActions?: React.ReactNode;
}

/**
 * Текстовое поле с поддержкой:
 * - всплывающей панели форматирования при выделении текста по правилам V2 и Rich (как в редакторе поста)
 * - голосового ввода и распознавания речи MiniAudioField
 * - автоматического и ручного увеличения высоты поля
 */
export const OnboardingFormattedTextField: React.FC<OnboardingFormattedTextFieldProps> = ({
  label,
  value,
  onChange,
  format,
  userId,
  minRows = 4,
  placeholder,
  hintText,
  onBlur,
  extraHeaderActions
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const manualMinHeightRef = useRef<number>(0);
  const isAdjustingRef = useRef<boolean>(false);

  const editorFormat: 'rich' | 'markdown_v2' = format === 'rich' ? 'rich' : 'markdown_v2';
  const isRich = format === 'rich';

  const setPostTextCompat = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (updater) => {
      const nextVal = typeof updater === 'function' ? updater(value) : updater;
      onChange(nextVal);
    },
    [onChange, value]
  );

  const {
    canUndo,
    canRedo,
    pushToHistory,
    handleUndo,
    handleRedo,
    selectedText,
    getSelectionTextSnapshot,
    replaceSelectionWithSnippet,
    activeStyles,
    toolbarPos,
    setToolbarPos,
    updateFloatingToolbarFromSelection,
    applySmartFormat,
    handleTextareaKeyDown
  } = useEditorFormattingActions({
    postText: value,
    setPostText: setPostTextCompat,
    messageFormat: editorFormat,
    textareaRef,
    toolbarRef
  });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState<RichMediaInsertTab>('photo');
  const [mediaSelectionSeed, setMediaSelectionSeed] = useState('');
  const [showEmojiTimeModal, setShowEmojiTimeModal] = useState(false);
  const [emojiTimeTab, setEmojiTimeTab] = useState<'emoji' | 'time' | 'latex'>('emoji');
  const [showAnchorsModal, setShowAnchorsModal] = useState(false);
  const [anchorsTab, setAnchorsTab] = useState<'create' | 'link' | 'tg_ref' | 'footnote'>('create');

  const [galleryState, setGalleryState] = useState<{
    open: boolean;
    multiple: boolean;
    onPicked?: (urls: string[]) => void;
  }>({ open: false, multiple: false });

  const [imageBuilderCb, setImageBuilderCb] = useState<((url: string) => void) | null>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    isAdjustingRef.current = true;
    const baseMinPx = Math.max(2, minRows) * 24 + 24;
    const targetFloor = Math.max(baseMinPx, manualMinHeightRef.current);
    el.style.height = 'auto';
    const nextHeight = Math.max(targetFloor, el.scrollHeight + 4);
    el.style.height = `${nextHeight}px`;
    requestAnimationFrame(() => {
      isAdjustingRef.current = false;
    });
  }, [minRows]);

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleMouseUp = () => {
    updateFloatingToolbarFromSelection();
    const el = textareaRef.current;
    if (!el || isAdjustingRef.current) return;
    const currentPx = el.getBoundingClientRect().height;
    const baseMinPx = Math.max(2, minRows) * 24 + 24;
    if (currentPx > baseMinPx + 4) {
      manualMinHeightRef.current = Math.round(currentPx);
    }
  };

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
        <label className="text-[14px] font-extrabold text-slate-900 leading-snug break-words min-w-0 flex-1">
          {label}
        </label>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {isRich && (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMediaSelectionSeed(getSelectionTextSnapshot());
                  setMediaModalTab('photo');
                  setShowMediaModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer"
                title="Вставить иллюстрацию, коллаж или карусель Rich"
              >
                <ImageIcon className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="hidden sm:inline">Медиа</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowTableModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer"
                title="Вставить таблицу Rich"
              >
                <TableIcon className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="hidden sm:inline">Таблица</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAnchorsTab('create');
                  setShowAnchorsModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer"
                title="Вставить якорь или сноску Rich"
              >
                <Anchor className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="hidden sm:inline">Якорь</span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={!canUndo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUndo}
            className="p-1.5 rounded-xl bg-white/85 hover:bg-white disabled:opacity-40 border border-pink-300 text-slate-800 cursor-pointer"
            title="Отменить действие"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={!canRedo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleRedo}
            className="p-1.5 rounded-xl bg-white/85 hover:bg-white disabled:opacity-40 border border-pink-300 text-slate-800 cursor-pointer"
            title="Повторить действие"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {extraHeaderActions}

          <MiniAudioField
            currentValue={value}
            size="sm"
            buttonText="Голос"
            onTranscript={(combinedText) => {
              onChange(combinedText);
              pushToHistory(combinedText);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[14px] text-pink-700 font-semibold">
        <Sparkles className="w-4 h-4 shrink-0 text-pink-600" />
        <span className="break-words">
          {hintText ||
            (isRich
              ? 'Выделите любой фрагмент текста, чтобы открыть панель форматирования Rich (заголовки, цитаты, списки, ссылки, медиа)'
              : 'Выделите любой фрагмент текста, чтобы открыть панель форматирования Telegram V2 (жирный, курсив, спойлер, цитата, ссылка)')}
        </span>
      </div>

      <div className="relative">
        <TelegramFloatingToolbar
          toolbarRef={toolbarRef as React.RefObject<HTMLDivElement>}
          toolbarPos={toolbarPos}
          selectedText={selectedText}
          messageFormat={editorFormat}
          activeStyles={activeStyles}
          onApplyFormat={applySmartFormat}
          onOpenLinkModal={() => setShowLinkModal(true)}
          onOpenTableModal={() => setShowTableModal(true)}
          onOpenMediaModal={(tab) => {
            setMediaSelectionSeed(getSelectionTextSnapshot());
            setMediaModalTab(tab || 'photo');
            setShowMediaModal(true);
          }}
          onOpenButtonModal={() => setShowButtonModal(true)}
          onOpenFormulaModal={() => {
            setEmojiTimeTab('latex');
            setShowEmojiTimeModal(true);
          }}
          onOpenQuoteModal={() => setShowQuoteModal(true)}
          onOpenEmojiTimeModal={(tab) => {
            setEmojiTimeTab(tab || 'emoji');
            setShowEmojiTimeModal(true);
          }}
          onOpenAnchorModal={(tab) => {
            setAnchorsTab(tab || 'create');
            setShowAnchorsModal(true);
          }}
          onClose={() => setToolbarPos(null)}
          isFixed
        />

        <textarea
          ref={textareaRef}
          rows={Math.max(2, minRows)}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            pushToHistory(e.target.value);
          }}
          onSelect={updateFloatingToolbarFromSelection}
          onKeyUp={updateFloatingToolbarFromSelection}
          onMouseUp={handleMouseUp}
          onKeyDown={handleTextareaKeyDown}
          onBlur={onBlur}
          placeholder={
            placeholder ||
            (isRich
              ? 'Введите или отредактируйте Rich-текст. Выделите слова мышкой или пальцем для открытия панели разметки...'
              : 'Введите или отредактируйте текст V2. Выделите слова мышкой или пальцем для открытия панели разметки...')
          }
          className="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 leading-relaxed placeholder:text-slate-500 focus:outline-none focus:border-pink-500 resize-y"
        />
      </div>

      <EditorLinkModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        initialText={selectedText}
        onInsertLink={(mdLink) => replaceSelectionWithSnippet(mdLink)}
      />

      <EditorQuoteModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        initialText={selectedText}
        isRich={isRich}
        onInsertQuote={(q) => replaceSelectionWithSnippet(q)}
      />

      <EditorTableModal
        open={showTableModal}
        onClose={() => setShowTableModal(false)}
        onInsertTable={(tbl) => replaceSelectionWithSnippet(tbl)}
      />

      <EditorMediaModal
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        initialTab={mediaModalTab}
        selectedText={mediaSelectionSeed}
        userId={userId}
        onInsertMediaMarkup={(markup) => replaceSelectionWithSnippet(markup)}
        onOpenGalleryForItem={(cb) =>
          setGalleryState({
            open: true,
            multiple: false,
            onPicked: (urls) => {
              if (urls[0]) cb(urls[0]);
            }
          })
        }
        onOpenGalleryMultiple={(cb) =>
          setGalleryState({
            open: true,
            multiple: true,
            onPicked: (urls) => {
              if (urls.length > 0) cb(urls);
            }
          })
        }
        onOpenImageBuilderForItem={(cb) => setImageBuilderCb(() => cb)}
      />

      <EditorRichButtonModal
        open={showButtonModal}
        onClose={() => setShowButtonModal(false)}
        initialText={selectedText}
        onInsertButtonMarkup={(markup) => replaceSelectionWithSnippet(markup)}
      />

      <EditorEmojiTimeModal
        open={showEmojiTimeModal}
        onClose={() => setShowEmojiTimeModal(false)}
        initialTab={emojiTimeTab}
        onInsertSnippet={(snip) => replaceSelectionWithSnippet(snip)}
      />

      <EditorAnchorsModal
        open={showAnchorsModal}
        onClose={() => setShowAnchorsModal(false)}
        initialTab={anchorsTab}
        postText={value}
        onInsertAnchorMarkup={(snip, appendAtEnd) => {
          replaceSelectionWithSnippet(snip);
          if (appendAtEnd) {
            onChange(`${value}${appendAtEnd}`);
          }
        }}
      />

      <GallerySelectModal
        isOpen={galleryState.open}
        onClose={() => setGalleryState((prev) => ({ ...prev, open: false }))}
        multiple={galleryState.multiple}
        maxCount={10}
        userId={userId}
        onSelect={(urls) => {
          galleryState.onPicked?.(urls);
          setGalleryState((prev) => ({ ...prev, open: false }));
        }}
      />

      {imageBuilderCb && (
        <ImageBuilderModal
          isOpen={Boolean(imageBuilderCb)}
          onClose={() => setImageBuilderCb(null)}
          userId={userId}
          initialPrompt={label}
          onSelectResult={(urls) => {
            if (urls[0]) {
              imageBuilderCb(urls[0]);
            }
            setImageBuilderCb(null);
          }}
        />
      )}
    </div>
  );
};
