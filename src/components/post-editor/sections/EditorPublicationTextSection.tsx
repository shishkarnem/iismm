import React from 'react';
import {
  Anchor,
  Eraser,
  FileText,
  Image as ImageIcon,
  Redo2,
  Table as TableIcon,
  Undo2
} from 'lucide-react';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import { BUILTIN_DRAFTS, BuiltinTemplateItem } from '../core/editorTypesAndTemplates';
import { TelegramFloatingToolbar } from '../../TelegramFloatingToolbar';
import { ActiveSelectionStyles } from '../core/formatSpanHelpers';

interface EditorPublicationTextSectionProps {
  postText: string;
  onChangePostText: (val: string) => void;
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  hasAttachment: boolean;
  linkPreviewEnabled: boolean;
  onChangeLinkPreviewEnabled: (val: boolean) => void;
  onApplyTemplate: (tpl: BuiltinTemplateItem) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  toolbarPos: { top: number; left: number; arrow?: 'top' | 'bottom'; arrowLeft?: number } | null;
  selectedText: string;
  activeStyles: ActiveSelectionStyles;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearText: () => void;
  onApplyFormat: (fmt: string) => void;
  onSelectionChange: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCloseToolbar: () => void;
  onOpenLinkModal: () => void;
  onOpenQuoteModal: () => void;
  onOpenTableModal: () => void;
  onOpenMediaModal: (tab?: 'photo' | 'video' | 'audio' | 'document' | 'collage' | 'slideshow' | 'slider') => void;
  onOpenButtonModal?: () => void;
  onOpenEmojiTimeModal: (tab?: 'emoji' | 'time' | 'latex') => void;
  onOpenAnchorModal: (tab?: 'create' | 'link' | 'tg_ref' | 'footnote') => void;
}

export const EditorPublicationTextSection: React.FC<EditorPublicationTextSectionProps> = ({
  postText,
  onChangePostText,
  messageFormat,
  hasAttachment,
  linkPreviewEnabled,
  onChangeLinkPreviewEnabled,
  onApplyTemplate,
  textareaRef,
  toolbarRef,
  toolbarPos,
  selectedText,
  activeStyles,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearText,
  onApplyFormat,
  onSelectionChange,
  onKeyDown,
  onCloseToolbar,
  onOpenLinkModal,
  onOpenQuoteModal,
  onOpenTableModal,
  onOpenMediaModal,
  onOpenButtonModal,
  onOpenEmojiTimeModal,
  onOpenAnchorModal
}) => {
  const isRich = messageFormat === 'rich';
  const maxChars = isRich ? 32000 : hasAttachment ? 1024 : 4096;
  const summary = `${postText.length} / ${maxChars} симв. · Выделите фрагмент текста для панели форматирования`;

  const templateOptions = BUILTIN_DRAFTS.map((tpl) => ({
    value: tpl.id,
    label: tpl.title,
    meta: tpl.format === 'rich' ? 'Rich' : 'Пост v2'
  }));

  return (
    <CollapsibleSection
      title="Текст публикации"
      summary={summary}
      icon={<FileText size={17} />}
      defaultOpen
    >
      <div className="space-y-3 min-w-0">
        {/* Full-width Template Dropdown so placeholder/labels never wrap vertically */}
        <div className="w-full min-w-0">
          <GradientSelect
            compact
            value=""
            placeholder="Подставить готовый шаблон структуры поста..."
            onChange={(tplId) => {
              const found = BUILTIN_DRAFTS.find((t) => t.id === tplId);
              if (found) onApplyTemplate(found);
            }}
            options={templateOptions}
          />
        </div>

        {/* Block-level inserts (Rich: Медиа, Таблица, Якорь) + Undo / Redo / Clear */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isRich && (
              <>
                <ResponsiveActionBtn
                  icon={<ImageIcon size={16} />}
                  label="Медиа"
                  title="Вставить иллюстрацию, коллаж, карусель, видео или аудио"
                  showLabelFrom="sm"
                  variant="outline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onOpenMediaModal('photo')}
                />
                <ResponsiveActionBtn
                  icon={<TableIcon size={16} />}
                  label="Таблица"
                  title="Вставить таблицу в статью"
                  showLabelFrom="sm"
                  variant="outline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onOpenTableModal}
                />
                <ResponsiveActionBtn
                  icon={<Anchor size={16} />}
                  label="Якорь"
                  title="Вставить якорь оглавления или сноску"
                  showLabelFrom="sm"
                  variant="outline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onOpenAnchorModal('create')}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <ResponsiveActionBtn
              icon={<Undo2 size={16} />}
              label="Отменить"
              showLabelFrom="never"
              variant="outline"
              disabled={!canUndo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onUndo}
            />
            <ResponsiveActionBtn
              icon={<Redo2 size={16} />}
              label="Повторить"
              showLabelFrom="never"
              variant="outline"
              disabled={!canRedo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onRedo}
            />
            {postText.length > 0 && (
              <ResponsiveActionBtn
                icon={<Eraser size={16} />}
                label="Очистить"
                showLabelFrom="never"
                title="Очистить поле текста"
                variant="danger"
                onClick={onClearText}
              />
            )}
          </div>
        </div>

        {/* Textarea with Floating Selection Toolbar */}
        <div className="relative">
          <TelegramFloatingToolbar
            toolbarRef={toolbarRef as React.RefObject<HTMLDivElement>}
            toolbarPos={toolbarPos}
            selectedText={selectedText}
            messageFormat={messageFormat}
            activeStyles={activeStyles}
            onApplyFormat={onApplyFormat}
            onOpenLinkModal={onOpenLinkModal}
            onOpenTableModal={onOpenTableModal}
            onOpenMediaModal={onOpenMediaModal}
            onOpenButtonModal={onOpenButtonModal}
            onOpenFormulaModal={() => onOpenEmojiTimeModal('latex')}
            onOpenQuoteModal={onOpenQuoteModal}
            onOpenEmojiTimeModal={onOpenEmojiTimeModal}
            onOpenAnchorModal={onOpenAnchorModal}
            onClose={onCloseToolbar}
            isFixed
          />

          <textarea
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            rows={12}
            value={postText}
            onChange={(e) => onChangePostText(e.target.value)}
            onSelect={onSelectionChange}
            onKeyUp={onSelectionChange}
            onMouseUp={onSelectionChange}
            onKeyDown={onKeyDown}
            placeholder={
              isRich
                ? 'Введите текст статьи... Выделите любое слово или абзац, чтобы открыть всплывающую панель форматирования Rich / Instant View.'
                : 'Введите текст поста... Выделите фрагмент текста для быстрого оформления жирного шрифта, курсива, спойлера, цитаты или ссылки.'
            }
            className="w-full min-h-[260px] px-4 py-3 rounded-2xl bg-white/85 border border-pink-300/80 text-[15px] text-slate-900 leading-relaxed placeholder:text-slate-500 focus:outline-none focus:border-pink-500 resize-y"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={linkPreviewEnabled}
              onChange={(e) => onChangeLinkPreviewEnabled(e.target.checked)}
              className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
            />
            <span className="text-[14px] text-slate-800 font-medium">
              Показывать превью первой ссылки под текстом поста
            </span>
          </label>

          <UnboxedMetaLine
            items={[
              `${postText.length} / ${maxChars} симв.`,
              postText.length > maxChars ? 'Превышен лимит Telegram' : undefined
            ]}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
};
