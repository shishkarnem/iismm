import React from 'react';
import { Eye, CheckCircle2, Sparkles, Send, Image as ImageIcon } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface OnboardingTelegramPreviewCardProps {
  mode: 'draft_preview' | 'sent_result';
  format: 'v2' | 'rich';
  title?: string;
  content: string;
  attachmentType?: string;
  attachmentUrl?: string;
  inlineButtons?: Array<
    Array<{
      text: string;
      url?: string;
      callback_data?: string;
      style?: string;
      color?: string;
      type?: string;
    }>
  >;
  targetLabel?: string;
  messageId?: string | number;
  sentAtLabel?: string;
  deliverySummary?: string;
}

export const OnboardingTelegramPreviewCard: React.FC<OnboardingTelegramPreviewCardProps> = ({
  mode,
  format,
  title,
  content,
  attachmentType = 'none',
  attachmentUrl = '',
  inlineButtons = [],
  targetLabel,
  messageId,
  sentAtLabel,
  deliverySummary
}) => {
  const isSentResult = mode === 'sent_result';
  const effectiveAttachmentType =
    format === 'v2' && attachmentUrl ? attachmentType || 'photo' : 'none';
  const effectiveAttachmentUrl = format === 'v2' ? attachmentUrl : '';

  const hasRichEmbeddedImage =
    format === 'rich' && /!\[[^\]]*\]\([^)]+\)/.test(content || '');
  const displayContent = (() => {
    const trimmed = String(content || '').trim();
    if (format === 'rich' && attachmentUrl && !hasRichEmbeddedImage) {
      const headingMatch = trimmed.match(/^(#{1,4}\s+[^\n]+)\n+([\s\S]*)$/);
      if (headingMatch) {
        return `${headingMatch[1]}\n\n![](${attachmentUrl})\n\n${headingMatch[2].trim()}`;
      }
      return `![](${attachmentUrl})\n\n${trimmed}`;
    }
    return trimmed;
  })();

  const timeString =
    sentAtLabel ||
    new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-sm min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 backdrop-blur-md p-3.5 sm:p-4 space-y-3 min-w-0">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-200/80 pb-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              {isSentResult ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                {isSentResult
                  ? 'Предпоказ по результату: в каком виде отправлено сообщение'
                  : 'Живой предпоказ верстки перед отправкой'}
              </div>
              {deliverySummary && (
                <div className="text-[14px] text-slate-700 font-medium break-words">
                  {deliverySummary}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-extrabold">
              {format === 'rich' ? 'Формат Rich' : 'Формат Telegram v2'}
            </span>
            {(attachmentUrl || hasRichEmbeddedImage) && (
              <span className="px-2.5 py-1 rounded-xl bg-white/90 border border-pink-300 text-pink-700 text-[14px] font-bold flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Картинка</span>
              </span>
            )}
            {targetLabel && (
              <span className="px-2.5 py-1 rounded-xl bg-white/90 border border-sky-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 max-w-full">
                <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="truncate max-w-[200px]">{targetLabel}</span>
              </span>
            )}
          </div>
        </div>

        {/* Telegram Bubble Simulation (Light translucent gradient, readable 14px+ text) */}
        <div className="p-[1px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-400 via-orange-400 via-pink-400 to-sky-400 min-w-0">
          <div className="rounded-[15px] bg-gradient-to-br from-sky-50/92 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/92 p-3.5 sm:p-4 space-y-2.5 min-w-0 overflow-hidden">
            {title &&
              format === 'v2' &&
              !displayContent.toLowerCase().includes(title.trim().toLowerCase().slice(0, 18)) && (
                <div className="text-[15px] font-extrabold text-slate-900 break-words">
                  {title}
                </div>
              )}

            <div className="text-[14px] text-slate-900 leading-relaxed break-words min-w-0">
              <MarkdownRenderer
                content={displayContent || 'Текст публикации появится здесь...'}
                format={format}
                attachmentType={effectiveAttachmentType}
                attachmentUrl={effectiveAttachmentUrl}
                inlineButtons={inlineButtons}
                uppercaseHeader={false}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-pink-200/60 text-[14px] text-slate-600 font-medium flex-wrap">
              <span className="flex items-center gap-1 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                <span className="break-words">
                  {isSentResult
                    ? messageId
                      ? `Доставлено · сообщение #${messageId}`
                      : 'Сформировано и проверено'
                    : 'Предпросмотр с разделением абзацев'}
                </span>
              </span>
              <span>{timeString}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
