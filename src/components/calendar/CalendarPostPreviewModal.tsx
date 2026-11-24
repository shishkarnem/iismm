import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Clock,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  Edit3,
  X
} from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import { UnifiedPublicationItem } from '../../utils/calendar/calendarStatusHelpers';
import { stripDuplicateTitleFromPostContent } from '../../utils/formatting/postTitleAndTagHelpers';

interface CalendarPostPreviewModalProps {
  publication: UnifiedPublicationItem | null;
  format: 'v2' | 'rich';
  onClose: () => void;
  onSelectPostForEdit?: (postId: string) => void;
  onDeletePublication?: (id: string) => Promise<void>;
}

export const CalendarPostPreviewModal: React.FC<CalendarPostPreviewModalProps> = ({
  publication,
  format,
  onClose,
  onSelectPostForEdit,
  onDeletePublication,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setCopiedId(false);
    setCopiedText(false);
    setConfirmingDelete(false);
    setIsDeleting(false);
  }, [publication?.id]);

  if (!publication) return null;

  const status = publication.normStatus;

  const handleConfirmDelete = async () => {
    if (!onDeletePublication) return;
    setIsDeleting(true);
    try {
      await onDeletePublication(publication.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-sky-100/55 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] sm:max-h-[90vh] flex flex-col justify-between bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md border border-pink-300 rounded-3xl shadow-2xl overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Header: close button strictly shrink-0 so long post IDs never push it off-screen */}
        <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-pink-200/80 flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {status === 'creating' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-amber-200 text-slate-900 border border-amber-300 shadow-2xs shrink-0">
                  <FileEdit size={14} />
                  <span>Создается</span>
                </span>
              ) : status === 'scheduled' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs shrink-0">
                  <Clock size={14} />
                  <span>Запланирован</span>
                </span>
              ) : status === 'failed' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs shrink-0">
                  <AlertCircle size={14} />
                  <span>Ошибка</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-sky-100 text-sky-900 border border-sky-300 shadow-2xs shrink-0">
                  <CheckCircle2 size={14} />
                  <span>Отправлено</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(publication.postId).catch(() => {});
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[14px] font-mono font-bold bg-white/90 text-pink-700 border border-pink-200 hover:bg-white transition-all cursor-pointer shadow-2xs max-w-full min-w-0"
                title={`Скопировать код поста: #${publication.postId}`}
              >
                <span className="truncate">#{publication.postId}</span>
                {copiedId ? <Check size={14} className="text-pink-600 shrink-0" /> : <Copy size={14} className="text-pink-500 shrink-0" />}
              </button>
            </div>

            <h3 className="text-base font-black text-slate-900 leading-snug break-words">
              {publication.promptTitle}
            </h3>
            <p className="text-[14px] text-slate-700 font-medium break-words">
              Канал: <span className="text-pink-700 font-bold">{publication.channel}</span> •{' '}
              {new Date(publication.displayDate).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 hover:text-slate-950 bg-white/90 hover:bg-white rounded-2xl border border-pink-200 transition-colors cursor-pointer shadow-2xs"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Post Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3.5 space-y-3">
          <div className="bg-white/95 border border-pink-200/80 rounded-2xl p-3.5 sm:p-5 space-y-3 font-sans text-[14px] text-slate-800 leading-relaxed select-text shadow-2xs break-words min-w-0">
            <MarkdownRenderer
              content={stripDuplicateTitleFromPostContent(publication.text, publication.promptTitle)}
              format={format}
              attachmentType={publication.attachmentType}
              attachmentUrl={publication.attachmentUrl}
              attachmentUrls={publication.attachmentUrls}
              inlineButtons={publication.inlineButtons}
              signature={publication.signature}
              uppercaseHeader={publication.uppercaseHeader}
            />
          </div>

          {publication.response && (
            <div className="bg-white/90 p-3 rounded-2xl border border-pink-200/80 text-[14px] text-slate-800 break-words">
              <span className="text-slate-950 font-bold">Статус ответа: </span>
              <span>{publication.response}</span>
            </div>
          )}
        </div>

        {/* Sticky Responsive Footer: zero horizontal clipping on mobile */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-pink-200/80 bg-white/45 space-y-2">
          {confirmingDelete ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-2xl bg-rose-50/95 border border-rose-300">
              <span className="text-[14px] font-bold text-rose-900">
                Удалить публикацию из базы данных?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white border border-pink-200 text-slate-800 text-[14px] font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-rose-600 text-white text-[14px] font-bold cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? 'Удаление...' : 'Да, удалить'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(publication.text).catch(() => {});
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 2000);
                }}
                className="px-3 py-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl text-[14px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-pink-200 shadow-2xs"
              >
                <Copy size={15} className="text-pink-600 shrink-0" />
                <span className="truncate">{copiedText ? 'Скопировано!' : 'Копировать'}</span>
              </button>

              {onDeletePublication && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[14px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={15} className="shrink-0" />
                  <span>Удалить</span>
                </button>
              )}

              {onSelectPostForEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPostForEdit(publication.postId);
                    onClose();
                  }}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-xs hover:opacity-95"
                >
                  <Edit3 size={15} className="shrink-0" />
                  <span>Открыть в редакторе</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="col-span-2 sm:col-span-1 px-4 py-2 bg-white/90 hover:bg-white border border-pink-200 text-slate-800 rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-2xs text-center"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
