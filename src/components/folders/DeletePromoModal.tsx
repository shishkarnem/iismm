import React from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';

export interface DeletePromoTarget {
  id: string;
  type: 'folder' | 'selection';
  title: string;
  participantsCount?: number;
}

interface DeletePromoModalProps {
  isOpen: boolean;
  target: DeletePromoTarget | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeletePromoModal({
  isOpen,
  target,
  isDeleting,
  onClose,
  onConfirm
}: DeletePromoModalProps) {
  if (!isOpen || !target) return null;

  const isFolder = target.type === 'folder';
  const entityTitle = isFolder ? 'папки' : 'подборки';
  const entityAccusative = isFolder ? 'папку' : 'подборку';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-pink-200 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent truncate">
              Удаление {entityTitle} организатором
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 rounded-xl bg-white/80 hover:bg-white border border-pink-200 text-slate-600 hover:text-slate-900 cursor-pointer transition-all shrink-0"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-[14px] text-slate-800 leading-relaxed">
          <p>
            Вы действительно хотите удалить {entityAccusative}{' '}
            <strong className="font-bold text-slate-900">«{target.title}»</strong>?
          </p>

          <div className="p-3.5 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[14px] text-slate-800">
              <p>
                {isFolder ? 'Папка' : 'Подборка'} будет полностью удалена из списка и расписания публикаций.
              </p>
              <p className="text-slate-700">
                Всем участникам{typeof target.participantsCount === 'number' && target.participantsCount > 0 ? ` (${target.participantsCount})` : ''} автоматически придёт уведомление в Telegram и в центр уведомлений о том, что {isFolder ? 'папка' : 'подборка'} удалена организатором.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white/85 border border-pink-200 text-slate-800 font-bold hover:bg-white text-[14px] cursor-pointer transition-all disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Удаление...' : `Удалить ${entityAccusative}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
