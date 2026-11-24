import React, { useState } from 'react';
import { Sparkles, Calendar, Clock, CheckCircle, Radio } from 'lucide-react';

interface InviteItem {
  id: string;
  type: 'folder' | 'selection';
  parentId: string;
  title: string;
  scheduledAt: string;
  channelName: string;
  channelId: string;
  authorName: string;
  subId: string; // participant_id or chan_id
}

interface InviteConfirmationBannerProps {
  invitations: {
    folders: any[];
    selections: any[];
  };
  onConfirm: (type: 'folder' | 'selection', id: string, subId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function InviteConfirmationBanner({
  invitations,
  onConfirm,
  isLoading = false
}: InviteConfirmationBannerProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const folderInvites: InviteItem[] = (invitations.folders || []).map((f: any) => ({
    id: `f_${f.folder_id}_${f.participant_id}`,
    type: 'folder',
    parentId: f.folder_id,
    title: f.title,
    scheduledAt: f.scheduled_at,
    channelName: f.channel_name,
    channelId: f.channel_id,
    authorName: f.author_name || 'Организатор',
    subId: f.participant_id
  }));

  const selectionInvites: InviteItem[] = (invitations.selections || []).map((s: any) => ({
    id: `s_${s.selection_id}_${s.chan_id}`,
    type: 'selection',
    parentId: s.selection_id,
    title: s.title,
    scheduledAt: s.scheduled_at,
    channelName: s.channel_name,
    channelId: s.channel_id,
    authorName: s.author_name || 'Организатор',
    subId: s.chan_id
  }));

  const allInvites = [...folderInvites, ...selectionInvites];

  if (allInvites.length === 0) return null;

  const handleConfirmItem = async (item: InviteItem) => {
    try {
      setConfirmingId(item.id);
      await onConfirm(item.type, item.parentId, item.subId);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-200/40 via-pink-200/40 via-orange-200/40 via-pink-200/40 to-sky-200/40 backdrop-blur-md border border-pink-300/70 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Приглашения в реанимированные папки и подборки
            </h3>
            <p className="text-sm text-slate-700">
              Организаторы запустили новый сбор. Подтвердите участие ваших каналов для включения в публикацию и календарь.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-center px-3 py-1 rounded-xl bg-white/80 border border-pink-200/80 text-[14px] font-bold text-slate-800">
          Ожидают: {allInvites.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {allInvites.map((item) => {
          let dateStr = 'Не указана';
          let timeStr = 'Не указано';
          try {
            if (item.scheduledAt) {
              const d = new Date(item.scheduledAt);
              dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
              timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
          } catch (e) {}

          const isProcessing = confirmingId === item.id || isLoading;

          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-white/70 border border-pink-200/80 shadow-2xs flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg text-[14px] font-bold bg-pink-100/80 border border-pink-300 text-slate-800">
                    {item.type === 'folder' ? '📁 Папка' : '📚 Подборка'}
                  </span>
                  <span className="text-[14px] text-slate-600 font-medium">
                    Организатор: {item.authorName}
                  </span>
                </div>

                <h4 className="text-[14px] sm:text-base font-bold text-slate-900 break-words leading-snug">
                  «{item.title}»
                </h4>

                <div className="text-[14px] text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-800">Канал: {item.channelName}</span>
                </div>

                <div className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    {dateStr}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-orange-600" />
                    {timeStr} (МСК)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-pink-100/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirmItem(item)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isProcessing ? 'Подтверждение...' : 'Подтвердить участие'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
