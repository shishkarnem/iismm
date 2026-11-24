import React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mic,
  Music,
  Save,
  Send,
  Sparkles,
  Trash2,
  Video,
  X
} from 'lucide-react';
import { InlineButtonRow } from '../../../types';
import { extractFirstUrl } from '../core/editorTypesAndTemplates';
import { TelegramLinkPreviewMockup } from './InlineFormattedRenderer';
import { RichPreviewRenderer } from './RichPreviewRenderer';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import { isVideoMediaUrl } from '../../../utils/urlUtils';
import { hasTitleOrHeadingInBody } from '../../../utils/formatting/postTitleAndTagHelpers';

function countEditorRichMedia(text: string): number {
  if (!text) return 0;
  let count = 0;
  const imgRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(text)) !== null) {
    const u = (m[1] || '').trim().toLowerCase();
    if (!u || u.startsWith('tg://emoji') || u.startsWith('tg://time')) continue;
    count++;
  }
  const tagRe = /<(?:tg-document|video|audio)\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi;
  while (tagRe.exec(text) !== null) {
    count++;
  }
  return count;
}

interface EditorPreviewColumnProps {
  title: string;
  postText: string;
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  selectedChannels: string[];
  linkPreviewEnabled: boolean;
  onDisableLinkPreview: () => void;
  attachmentType: 'none' | 'photo' | 'album' | 'video' | 'video_note' | 'audio' | 'voice' | 'document';
  attachmentUrl: string;
  attachmentUrls: string[];
  inlineButtons: InlineButtonRow[];
  publishToSocialFeed: boolean;
  onChangePublishToSocialFeed: (val: boolean) => void;
  publishedBlogSlug: string | null;
  statusMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  onClearStatusMessage: () => void;
  isSaving: boolean;
  isTestingSend: boolean;
  isPublishingNow: boolean;
  hasSelectedDraft: boolean;
  isScheduledOrAutopost?: boolean;
  onSaveDraft: () => void;
  onTestSendDm: () => void;
  onPublishNow: () => void;
  onRequestDeleteDraft?: () => void;
  onNavigate?: (path: string) => void;
}

export const EditorPreviewColumn: React.FC<EditorPreviewColumnProps> = ({
  title,
  postText,
  messageFormat,
  selectedChannels,
  linkPreviewEnabled,
  onDisableLinkPreview,
  attachmentType,
  attachmentUrl,
  attachmentUrls,
  inlineButtons,
  publishToSocialFeed,
  onChangePublishToSocialFeed,
  publishedBlogSlug,
  statusMessage,
  onClearStatusMessage,
  isSaving,
  isTestingSend,
  isPublishingNow,
  hasSelectedDraft,
  isScheduledOrAutopost = false,
  onSaveDraft,
  onTestSendDm,
  onPublishNow,
  onRequestDeleteDraft,
  onNavigate
}) => {
  const isRich = messageFormat === 'rich';
  const extractedUrl = linkPreviewEnabled ? extractFirstUrl(postText) : null;
  const charLimit = isRich ? 32000 : attachmentType !== 'none' ? 1024 : 4096;
  const hasHeadingInText = hasTitleOrHeadingInBody(postText, title);
  const currentChars = (title && !hasHeadingInText ? title.length + 2 : 0) + postText.length;
  const richMediaCount = isRich ? countEditorRichMedia(postText) : 0;

  return (
    <div className="space-y-4 lg:sticky lg:top-4 min-w-0">
      {/* Single unified status notification banner (no duplicate floating + bottom toasts) */}
      {statusMessage && (
        <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md">
          <div className="flex items-start justify-between gap-2.5 px-4 py-3 rounded-[14.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <CheckCircle2
                size={18}
                className={`mt-0.5 shrink-0 ${
                  statusMessage.type === 'error' ? 'text-rose-600' : 'text-pink-600'
                }`}
              />
              <span
                className={`text-[14px] font-semibold leading-snug break-words ${
                  statusMessage.type === 'error' ? 'text-rose-800' : 'text-slate-900'
                }`}
              >
                {statusMessage.text}
              </span>
            </div>
            <button
              type="button"
              onClick={onClearStatusMessage}
              title="Скрыть уведомление"
              className="p-1 rounded-lg hover:bg-white/70 text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Live Telegram Post Preview Card */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-lg">
        <div className="rounded-[22.5px] bg-gradient-to-br from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-pink-300/60 pb-2.5">
            <h3 className="text-[16px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
              Предпросмотр в Telegram
            </h3>
            <UnboxedMetaLine
              items={[
                isRich ? 'Rich статья' : 'Пост v2',
                selectedChannels[0] || '@IIrkiBot',
                `${currentChars} / ${charLimit} симв.`,
                isRich ? `${richMediaCount} / 50 вложений` : undefined
              ]}
            />
          </div>
          {isRich && richMediaCount > 50 && (
            <div className="px-3.5 py-2 rounded-xl bg-rose-100/90 border border-rose-300 text-[14px] font-bold text-rose-800">
              Превышен лимит Telegram для Rich-поста: {richMediaCount} из 50 вложений. Лишние вложения будут автоматически усечены при отправке.
            </div>
          )}

          {/* Telegram Message Bubble */}
          <div className="rounded-2xl bg-white/80 border border-pink-300/70 p-3.5 sm:p-4 shadow-sm space-y-3 min-w-0">
            {/* Media Attachment Preview for V2 */}
            {!isRich && attachmentType !== 'none' && (
              <div className="rounded-xl overflow-hidden border border-pink-300/70 bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90">
                {attachmentType === 'photo' && attachmentUrl && (
                  <img src={attachmentUrl} alt="Обложка поста" className="w-full max-h-72 object-cover" />
                )}
                {attachmentType === 'album' && attachmentUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 p-1.5">
                    {attachmentUrls.slice(0, 10).map((url, idx) =>
                      isVideoMediaUrl(url) ? (
                        <video
                          key={`${url}_${idx}`}
                          src={url}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-28 object-cover rounded-lg"
                        />
                      ) : (
                        <img
                          key={`${url}_${idx}`}
                          src={url}
                          alt={`Слайд ${idx + 1}`}
                          className="w-full h-28 object-cover rounded-lg"
                        />
                      )
                    )}
                  </div>
                )}
                {attachmentType === 'video' && attachmentUrl && (
                  <video src={attachmentUrl} controls className="w-full max-h-64 object-contain" />
                )}
                {attachmentType === 'video_note' && (
                  <div className="p-4 flex flex-col items-center justify-center gap-2">
                    {attachmentUrl ? (
                      <video
                        src={attachmentUrl}
                        controls
                        className="w-44 h-44 rounded-full object-cover border-2 border-pink-400 shadow-md"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-[14px] text-slate-700">
                        <Video size={18} className="text-pink-600" />
                        <span>Видеокружок появится после указания ссылки</span>
                      </div>
                    )}
                  </div>
                )}
                {(attachmentType === 'audio' || attachmentType === 'voice') && (
                  <div className="p-3 flex items-center gap-2.5">
                    {attachmentType === 'voice' ? (
                      <Mic size={18} className="text-pink-600 shrink-0" />
                    ) : (
                      <Music size={18} className="text-pink-600 shrink-0" />
                    )}
                    {attachmentUrl ? (
                      <audio src={attachmentUrl} controls className="w-full" />
                    ) : (
                      <span className="text-[14px] text-slate-700">
                        {attachmentType === 'voice' ? 'Голосовое сообщение' : 'Аудиофайл'}
                      </span>
                    )}
                  </div>
                )}
                {attachmentType === 'document' && (
                  <div className="p-3 flex items-center gap-2.5 text-[14px] text-slate-800 font-medium">
                    <FileText size={18} className="text-pink-600 shrink-0" />
                    <span className="truncate">{attachmentUrl || 'Документ прикреплен к посту'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Post Title (suppressed if postText already begins with a Markdown # heading to avoid duplicate title) */}
            {title.trim() && !hasHeadingInText && (
              <div className="text-[16px] sm:text-[17px] font-bold text-slate-950 break-words leading-snug">
                {title}
              </div>
            )}

            {/* Post Body */}
            <RichPreviewRenderer content={postText} isRich={isRich} />

            {/* Link Preview Card */}
            {extractedUrl && (
              <TelegramLinkPreviewMockup info={extractedUrl} onDisable={onDisableLinkPreview} />
            )}

            <div className="flex items-center justify-end text-[14px] text-slate-500 pt-1">
              <span>{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Inline Buttons Preview */}
          {inlineButtons.length > 0 && (
            <div className="space-y-1.5">
              {inlineButtons.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, row.buttons.length)}, minmax(0, 1fr))` }}
                >
                  {row.buttons.map((btn) => {
                    const isSuccess = btn.style === 'success';
                    const btnStyleClass =
                      btn.style === 'primary'
                        ? 'bg-sky-500 text-white border-sky-600'
                        : btn.style === 'danger'
                        ? 'bg-rose-500 text-white border-rose-600'
                        : isSuccess
                        ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white border-pink-400'
                        : 'bg-slate-200/90 text-slate-800 border-slate-300';
                    return (
                      <div
                        key={btn.id}
                        className={`px-3 py-2 rounded-xl border text-center text-[14px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs break-words ${btnStyleClass}`}
                      >
                        {btn.iconEmoji && <span>{btn.iconEmoji}</span>}
                        <span className="truncate">{btn.text || 'Кнопка'}</span>
                        {btn.type === 'url' && <ExternalLink size={13} className="shrink-0 opacity-85" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Publication Controls Card */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md">
        <div className="rounded-[22.5px] bg-gradient-to-br from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl p-4 sm:p-5 space-y-3.5 min-w-0">
          <div
            onClick={() => onChangePublishToSocialFeed(!publishToSocialFeed)}
            role="switch"
            aria-checked={publishToSocialFeed}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChangePublishToSocialFeed(!publishToSocialFeed);
              }
            }}
            className="flex items-start gap-3 p-3 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300/80 cursor-pointer select-none transition-all hover:border-pink-400"
          >
            <span
              className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all ${
                publishToSocialFeed
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 shadow-xs'
                  : 'bg-white/90 border border-pink-300'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full transition-transform shadow-xs ${
                  publishToSocialFeed
                    ? 'translate-x-5 bg-white'
                    : 'translate-x-0 bg-pink-300'
                }`}
              />
            </span>
            <span className="text-[14px] text-slate-900 font-medium leading-snug break-words min-w-0">
              Дублировать публикацию в открытую ленту блога платформы{' '}
              <a
                href="/posts"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate('/posts');
                  }
                }}
                className="font-bold text-pink-700 hover:text-sky-700 underline underline-offset-2"
              >
                iismm.ru/posts
              </a>
            </span>
          </div>

          {publishedBlogSlug && (
            <a
              href={`/posts/${publishedBlogSlug}`}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(`/posts/${publishedBlogSlug}`);
                }
              }}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-pink-700 hover:text-sky-700 underline"
            >
              <Globe size={15} />
              <span>Открыть опубликованную запись в ленте iismm.ru/posts</span>
            </a>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isScheduledOrAutopost ? (
              <ResponsiveActionBtn
                icon={isSaving ? <Loader2 size={17} className="animate-spin" /> : <CalendarClock size={17} />}
                label="Сохранить в отложку"
                title="Сохранить публикацию и активировать расписание отложенного постинга"
                variant="vivid"
                alwaysShowLabel
                onClick={onSaveDraft}
                disabled={isSaving}
                className="flex-1 min-w-[180px]"
              />
            ) : (
              <ResponsiveActionBtn
                icon={isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                label="Сохранить"
                title="Сохранить черновик и расписание"
                variant="outline"
                onClick={onSaveDraft}
                disabled={isSaving}
              />
            )}

            <ResponsiveActionBtn
              icon={isTestingSend ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              label="Тест в личку"
              title="Отправить тестовый пост себе в личные сообщения от @IIrkiBot"
              variant="outline"
              onClick={onTestSendDm}
              disabled={isTestingSend}
            />

            {!isScheduledOrAutopost && (
              <ResponsiveActionBtn
                icon={isPublishingNow ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                label="Опубликовать"
                title="Опубликовать пост в выбранные каналы прямо сейчас"
                variant="vivid"
                alwaysShowLabel
                onClick={onPublishNow}
                disabled={isPublishingNow}
                className="flex-1 min-w-[150px]"
              />
            )}

            {hasSelectedDraft && onRequestDeleteDraft && (
              <ResponsiveActionBtn
                icon={<Trash2 size={17} />}
                label="Удалить"
                title="Удалить текущий черновик"
                variant="danger"
                showLabelFrom="lg"
                onClick={onRequestDeleteDraft}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
