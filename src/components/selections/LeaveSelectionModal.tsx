import React from 'react';
import { X, Trash2, Check, AlertCircle } from 'lucide-react';

export interface LeaveSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection: any;
  userChannels: any[]; // list of active channels in this selection that user can delete (or all channels if user is organizer)
  isOrganizer: boolean;
  selectedChannel: any | null;
  onSelectChannel: (channel: any) => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export const LeaveSelectionModal: React.FC<LeaveSelectionModalProps> = ({
  isOpen,
  onClose,
  selection,
  userChannels,
  isOrganizer,
  selectedChannel,
  onSelectChannel,
  onConfirmDelete,
  isDeleting
}) => {
  if (!isOpen || !selection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4 text-slate-800">
        {/* Header with standard gradient */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-200">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs">
              <Trash2 className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
              {isOrganizer ? 'Удаление канала из подборки' : 'Удалить свой канал из подборки'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-[14px]">
          <p className="text-[14px] text-slate-800 leading-relaxed">
            Подборка: <strong className="text-slate-900 font-extrabold">«{selection.header_title || selection.title}»</strong>
          </p>

          {/* List of channels to choose from if multiple */}
          <div>
            <label className="block text-[14px] font-bold text-slate-800 mb-2">
              {isOrganizer
                ? 'Выберите канал для исключения из подборки:'
                : 'Выберите канал, который хотите удалить из текущей подборки:'}
            </label>

            {userChannels.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/90 border border-pink-200 text-center text-slate-600 text-[14px]">
                В этой подборке нет доступных каналов для удаления.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {userChannels.map((c: any) => {
                  const isSelected = selectedChannel && String(selectedChannel.id) === String(c.id);
                  const cleanU = c.channel_username ? String(c.channel_username).replace(/^@/, '') : '';

                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectChannel(c)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-white border-pink-500 shadow-sm ring-1 ring-pink-400'
                          : 'bg-white/85 border-pink-100 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {c.channel_avatar_url ? (
                          <img
                            src={c.channel_avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-pink-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0">
                            {c.channel_name?.slice(0, 2) || '📢'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-extrabold text-[14px] text-slate-900 block truncate">
                            {c.channel_name}
                          </span>
                          <span className="text-[14px] text-slate-500 block truncate">
                            {cleanU ? `@${cleanU} • ` : ''}
                            {c.subscribers_count || c.subscribers_initial || 0} подписчиков
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-pink-600 bg-pink-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warning banner */}
          <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-[14px] text-rose-800 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Что произойдет при удалении:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[14px]">
              <li>Запись канала будет удалена из базы данных подборки в реальном времени.</li>
              <li>Блок канала будет удален из единого рекламного Rich-поста.</li>
              <li>Организатору и владельцу канала будет отправлено уведомление в Telegram с указанием инициатора удаления.</li>
            </ul>
          </div>

          {/* Action buttons with custom gradient */}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-700 font-bold hover:bg-white text-[14px] cursor-pointer transition-all disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={isDeleting || !selectedChannel}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Удаление...' : 'Да, удалить канал'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
