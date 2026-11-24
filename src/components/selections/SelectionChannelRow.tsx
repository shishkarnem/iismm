import React from 'react';
import { Clock, Edit3, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CachedMediaImage } from '../CachedMediaImage';
import { formatMskDateDisplay } from '../../utils/timezones';

interface SelectionChannelRowProps {
  channel: any;
  selectionScheduledAt: string;
  isMyChannel: boolean;
  canEdit: boolean;
  onOpenDetail: () => void;
  onOpenCustomTime: () => void;
  onOpenEdit: () => void;
  onOpenDelete: () => void;
}

function formatCompactMskDate(isoOrDate?: string): string {
  if (!isoOrDate) return 'По расписанию';
  const info = formatMskDateDisplay(isoOrDate);
  const parsed = new Date(isoOrDate);
  if (isNaN(parsed.getTime())) {
    return info.fullStr || 'По расписанию';
  }
  const mskStr = parsed.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${mskStr} Мск`;
}

export const SelectionChannelRow: React.FC<SelectionChannelRowProps> = ({
  channel,
  selectionScheduledAt,
  isMyChannel,
  canEdit,
  onOpenDetail,
  onOpenCustomTime,
  onOpenEdit,
  onOpenDelete,
}) => {
  const cleanUsername = (channel.channel_username || '').replace(/^@/, '');
  const subscribersCount = Number(channel.subscribers_initial || channel.subscribers_count || 0);
  const isPublishedSuccess = channel.post_published === 1 && !channel.reject_reason;
  const isPublishedError = Boolean(channel.reject_reason);
  const scheduledSource = channel.custom_publish_time || selectionScheduledAt;
  const fullMskDate = formatMskDateDisplay(scheduledSource).fullStr;
  const compactMskDate = formatCompactMskDate(scheduledSource);

  return (
    <div className="p-2.5 rounded-2xl bg-white/85 border border-pink-200/80 shadow-2xs space-y-1.5 min-w-0 transition-colors hover:bg-white">
      {/* Line 1: Avatar + Channel name / @username / subscribers + compact badges */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
          title={channel.promo_text ? `${channel.channel_name} — ${channel.promo_text}` : channel.channel_name}
        >
          {channel.channel_avatar_url ? (
            <CachedMediaImage
              src={channel.channel_avatar_url}
              alt={channel.channel_name || 'Канал'}
              className="w-9 h-9 rounded-xl object-cover shrink-0 border border-pink-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-100 via-pink-100 to-orange-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0 border border-pink-200">
              {(channel.channel_name || 'Кн').slice(0, 2)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="font-bold text-[14px] text-slate-900 group-hover:text-pink-700 truncate leading-tight">
              {channel.channel_name}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 text-[14px] leading-tight mt-0.5">
              {cleanUsername && (
                <span className="text-pink-600 font-semibold truncate">
                  @{cleanUsername}
                </span>
              )}
              <span className="text-slate-600 shrink-0">
                {subscribersCount} подп.
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {isMyChannel && (
            <span className="px-1.5 py-0.5 rounded-lg bg-amber-100/90 text-amber-900 border border-amber-200 text-[14px] font-bold leading-none">
              Ваш
            </span>
          )}
          <span
            className="px-1.5 py-0.5 rounded-lg bg-sky-100/80 text-sky-800 border border-sky-200 text-[14px] font-semibold leading-none"
            title="Одобрен автоматически через нейромодерацию"
          >
            Авто ✓
          </span>
        </div>
      </div>

      {/* Line 2: Schedule / Delivery Status + Compact Action Controls */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-pink-100/80 min-w-0">
        <div className="min-w-0 flex-1 text-[14px]">
          {isPublishedError ? (
            <span
              className="inline-flex items-center gap-1 text-rose-700 font-bold max-w-full truncate"
              title={channel.reject_reason}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">Ошибка: {channel.reject_reason}</span>
            </span>
          ) : isPublishedSuccess ? (
            <span className="inline-flex items-center gap-1 text-sky-800 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="truncate">Отправлено</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-orange-800 font-medium max-w-full truncate"
              title={`Запланировано: ${fullMskDate}`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="truncate">{compactMskDate}</span>
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            {channel.post_published !== 1 && (
              <button
                type="button"
                onClick={onOpenCustomTime}
                className={`px-2 py-1 rounded-xl border text-[14px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors ${
                  channel.custom_publish_time
                    ? 'bg-sky-100/90 border-sky-300 text-sky-900'
                    : 'bg-white/90 border-sky-200 text-sky-800 hover:bg-sky-50'
                }`}
                title="Изменить индивидуальное время публикации (до 24ч вперед)"
              >
                <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="hidden sm:inline">{channel.custom_publish_time ? 'Смещено' : 'Время'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenEdit}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] flex items-center gap-1 shadow-2xs hover:opacity-95 transition-all cursor-pointer"
              title="Редактировать описание и аватар канала"
            >
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Ред.</span>
            </button>

            <button
              type="button"
              onClick={onOpenDelete}
              className="p-1.5 rounded-xl bg-white/90 border border-rose-200 text-rose-600 hover:bg-rose-50 text-[14px] cursor-pointer shadow-2xs"
              title="Удалить канал из подборки"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
