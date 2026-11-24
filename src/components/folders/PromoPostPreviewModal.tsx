import React, { useState } from 'react';
import { X, ExternalLink, Clock } from 'lucide-react';
import MarkdownRenderer, {
  getInlineButtonStyleClasses,
  renderMediaAttachment
} from '../MarkdownRenderer';
import { RichPreviewRenderer } from '../post-editor/preview/RichPreviewRenderer';
import { CachedMediaImage } from '../CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

interface PromoPostPreviewModalProps {
  isOpen: boolean;
  mode: 'folder' | 'selection';
  item: any;
  onClose: () => void;
}

function parseButtonRows(raw: any): any[][] {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  return Array.isArray(parsed[0]) ? parsed : [parsed];
}

function parseUrlArray(raw: any): string[] {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((u) => normalizeProTalkMediaUrl(String(u || '').trim()))
    .filter(Boolean);
}

function isMediaAlreadyEmbedded(text: string, mediaUrl: string): boolean {
  if (!text || !mediaUrl) return false;
  const normalized = normalizeProTalkMediaUrl(mediaUrl) || mediaUrl;
  if (text.includes(mediaUrl) || text.includes(normalized)) return true;
  const fileSegment = normalized.split('/').pop()?.split('?')[0];
  return Boolean(fileSegment && fileSegment.length > 8 && text.includes(fileSegment));
}

export const PromoPostPreviewModal: React.FC<PromoPostPreviewModalProps> = ({
  isOpen,
  mode,
  item,
  onClose,
}) => {
  const [folderTab, setFolderTab] = useState<'main' | 'repeat'>('main');

  if (!isOpen || !item) return null;

  const isFolder = mode === 'folder';
  const hasRepeat = isFolder && Number(item.repeat_post_enabled || 0) === 1;
  const activeTab = hasRepeat ? folderTab : 'main';

  const rawText = isFolder
    ? (activeTab === 'main' ? item.post_text : item.repeat_post_text) || ''
    : item.post_text || '';

  const activeFormat = isFolder
    ? ((activeTab === 'main' ? item.message_format : item.repeat_message_format) === 'rich' ? 'rich' : 'v2')
    : 'rich';

  const rawImageUrl = isFolder
    ? (activeTab === 'main' ? item.image_url : item.repeat_image_url) || ''
    : item.image_url || '';

  const normalizedImageUrl = normalizeProTalkMediaUrl(rawImageUrl) || rawImageUrl;
  const showCoverImage = Boolean(normalizedImageUrl) && !isMediaAlreadyEmbedded(rawText, normalizedImageUrl);

  const attachmentType = isFolder
    ? (activeTab === 'main' ? item.attachment_type : item.repeat_attachment_type) || 'none'
    : 'none';
  const attachmentUrls = isFolder
    ? parseUrlArray(activeTab === 'main' ? item.attachment_urls : item.repeat_attachment_urls)
    : [];

  const showSeparateAttachment =
    isFolder &&
    attachmentType &&
    attachmentType !== 'none' &&
    (attachmentUrls.length > 0 || (attachmentType !== 'photo' && Boolean(normalizedImageUrl)));

  const buttonRows = parseButtonRows(
    isFolder
      ? (activeTab === 'main' ? item.inline_buttons : item.repeat_inline_buttons)
      : item.inline_buttons
  );

  const activeChannels = Array.isArray(item.channels)
    ? item.channels.filter((c: any) => !c.status || c.status === 'active')
    : [];

  const titleText = isFolder
    ? item.title || 'Папка каналов'
    : item.header_title || item.title || 'Подборка каналов';

  const showSelectionSubtitle =
    !isFolder &&
    Boolean(item.header_subtitle) &&
    !rawText.includes(String(item.header_subtitle).trim());

  const rulesText = isFolder ? item.rules_instruction : item.rules;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-sky-100/55 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] sm:max-h-[90vh] flex flex-col rounded-3xl bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md border border-pink-300 shadow-2xl overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-pink-200/80 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent leading-snug break-words">
              {isFolder ? 'Предпросмотр поста-приглашения в папку' : 'Предпросмотр единого Rich-поста подборки'}
            </h2>
            <p className="text-[14px] text-slate-700 mt-0.5 break-words">
              {isFolder
                ? 'Так единый пост папки выглядит при публикации в каналах участников'
                : 'Так публикация выглядит в Telegram на всех каналах участников'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть предпросмотр"
            className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-white/85 border border-pink-200 text-slate-700 hover:text-slate-950 hover:bg-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
          {hasRepeat && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-pink-200/70">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFolderTab('main')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                    activeTab === 'main'
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-2xs'
                      : 'bg-white/90 border border-pink-200 text-slate-800 hover:bg-white'
                  }`}
                >
                  Основной пост папки
                </button>
                <button
                  type="button"
                  onClick={() => setFolderTab('repeat')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-[14px] transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'repeat'
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-2xs'
                      : 'bg-white/90 border border-pink-200 text-slate-800 hover:bg-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Повторный пост</span>
                </button>
              </div>
            </div>
          )}

          {/* Simulated Telegram Post Card */}
          <div className="p-3.5 sm:p-5 rounded-3xl bg-white/95 border border-pink-200 shadow-sm space-y-4 min-w-0">
            {/* Meta Header */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-xl bg-pink-100/90 text-pink-800 border border-pink-200 text-[14px] font-bold">
                  {activeFormat === 'rich' ? 'Формат: Rich Markdown' : 'Формат: Markdown V2'}
                </span>
                {item.author_name && (
                  <span className="text-[14px] text-slate-600 font-medium break-words">
                    Организатор: {item.author_name}
                  </span>
                )}
              </div>

              <h1 className="text-base sm:text-lg font-black text-slate-950 leading-snug break-words">
                {titleText}
              </h1>

              {showSelectionSubtitle && (
                <div className="text-[14px] font-medium text-slate-700 leading-relaxed">
                  <RichPreviewRenderer content={item.header_subtitle} isRich={true} hideEmptyPlaceholder />
                </div>
              )}
            </div>

            {/* Cover Image (only if not duplicated inside post_text) */}
            {showCoverImage && (
              <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 border border-pink-200 p-1.5 flex justify-center">
                <CachedMediaImage
                  src={normalizedImageUrl}
                  alt={titleText}
                  className="max-h-72 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                />
              </div>
            )}

            {/* Additional Folder Attachment (album / video / document / audio) */}
            {showSeparateAttachment && (
              <div className="space-y-2">
                {renderMediaAttachment(
                  attachmentType,
                  attachmentUrls.length > 0 ? attachmentUrls : normalizedImageUrl ? [normalizedImageUrl] : [],
                  false
                )}
              </div>
            )}

            {/* Main Formatted Body */}
            <div className="text-[14px] text-slate-900 leading-relaxed p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-sky-50/60 via-pink-50/50 to-orange-50/60 border border-pink-100 font-sans min-w-0 break-words">
              {rawText.trim() ? (
                activeFormat === 'rich' ? (
                  <RichPreviewRenderer content={rawText} isRich={true} hideEmptyPlaceholder />
                ) : (
                  <MarkdownRenderer content={rawText} format="v2" />
                )
              ) : !isFolder && activeChannels.length > 0 ? (
                <div className="space-y-4">
                  {activeChannels.map((c: any, idx: number) => {
                    const cleanUser = (c.channel_username || '').replace(/^@/, '');
                    const directUrl = cleanUser ? `https://t.me/${cleanUser}` : 'https://t.me/';
                    return (
                      <div key={c.id || idx} className="space-y-1.5 border-b border-pink-100 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.channel_avatar_url && (
                            <CachedMediaImage
                              src={c.channel_avatar_url}
                              alt={c.channel_name || 'Канал'}
                              className="w-10 h-10 rounded-xl object-cover border border-pink-200 shrink-0"
                            />
                          )}
                          <h3 className="text-base font-bold text-sky-700 truncate">
                            <a href={directUrl} target="_blank" rel="noreferrer" className="hover:underline">
                              {c.channel_name}
                            </a>
                          </h3>
                        </div>
                        {c.promo_text && (
                          <p className="italic text-slate-700 text-[14px] break-words">
                            {c.promo_text}
                          </p>
                        )}
                        <div>
                          <a
                            href={directUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-pink-600 hover:underline text-[14px]"
                          >
                            <span>Подписаться на канал</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[14px] text-slate-600 italic">
                  Текст поста пока не заполнен.
                </p>
              )}
            </div>

            {/* Inline Buttons Row-by-Row */}
            {buttonRows.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[14px] font-extrabold text-slate-800 block">
                  Инлайн-кнопки под постом:
                </span>
                {buttonRows.map((row: any[], rIdx: number) => (
                  <div
                    key={rIdx}
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, row.length)}, minmax(0, 1fr))` }}
                  >
                    {row.map((btn: any, bIdx: number) => {
                      const colorKey =
                        btn.color ||
                        (btn.style === 'danger' ? 'danger' : btn.style === 'primary' ? 'primary' : 'gradient');
                      const colorClasses = getInlineButtonStyleClasses(btn.style, colorKey);
                      const href = btn.url || '#';
                      return (
                        <a
                          key={btn.id || bIdx}
                          href={href}
                          target={btn.url ? '_blank' : undefined}
                          rel={btn.url ? 'noreferrer' : undefined}
                          onClick={(e) => {
                            if (!btn.url) e.preventDefault();
                          }}
                          className={`py-2 px-3 rounded-xl font-bold text-[14px] text-center shadow-2xs flex items-center justify-center gap-1.5 min-w-0 ${colorClasses}`}
                        >
                          <span className="truncate">{btn.text || 'Кнопка'}</span>
                          {btn.url && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Rules / Conditions */}
            {rulesText && (
              <div className="p-3 rounded-2xl bg-orange-50/90 border border-orange-200 text-[14px] text-slate-800 break-words">
                <span className="font-bold text-slate-950 block mb-0.5">
                  {isFolder ? 'Правила размещения:' : 'Условия взаимного размещения:'}
                </span>
                <span>{rulesText}</span>
              </div>
            )}

            {/* Telegram Folder Link */}
            {isFolder && item.telegram_folder_link && (
              <div className="p-3 rounded-2xl bg-sky-50/90 border border-sky-200 text-[14px] text-sky-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold break-all">
                  Ссылка на папку: {item.telegram_folder_link}
                </span>
                <a
                  href={item.telegram_folder_link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white font-bold text-[14px] shrink-0 text-center"
                >
                  Открыть
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-pink-200/80 flex justify-end bg-white/40">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:opacity-95 cursor-pointer"
          >
            Закрыть предпросмотр
          </button>
        </div>
      </div>
    </div>
  );
};
