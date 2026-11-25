import React from 'react';
import { Clock, Edit3, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CachedMediaImage } from '../CachedMediaImage';
import { formatMskDateDisplay } from '../../utils/timezones';

interface SelectionChannelRowProps {
  channel: any;
  selectionScheduledAt: string;
  isMyChannel: boolean;
  canEditContent: boolean;
  canEditTime: boolean;
  canDelete: boolean;
  onOpenDetail: () => void;
  onOpenCustomTime: () => void;
  onOpenEdit: () => void;
  onOpenDelete: () => void;
}

function formatFullCompactMskDate(isoOrDate?: string): string {
  if (!isoOrDate) return 'По расписанию';
  const info = formatMskDateDisplay(isoOrDate);
  const parsed = new Date(isoOrDate);
  if (isNaN(parsed.getTime())) {
    return info.fullStr || 'По расписанию';
  }
  const datePart = parsed.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
  });
  const timePart = parsed.toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart}, ${timePart} (МСК)`;
}

export const SelectionChannelRow: React.FC<SelectionChannelRowProps> = ({
  channel,
  selectionScheduledAt,
  isMyChannel,
  canEditContent,
  canEditTime,
  canDelete,
  onOpenDetail,
  onOpenCustomTime,
  onOpenEdit,
  onOpenDelete,
}) => {
  const cleanUsername = (channel.channel_username || '').replace(/^@/, '');
  const subscribersCount = Number(channel.subscribers_initial || channel.subscribers_count || 0);
  const isPublishedSuccess = channel.post_published === 1 && !channel.reject_reason;
  const isPublishedError = Boolean(channel.reject_reason);
  const hasCustomTime = Boolean(channel.custom_publish_time);
  const scheduledSource = channel.custom_publish_time || selectionScheduledAt;
  const fullMskDate = formatMskDateDisplay(scheduledSource).fullStr;
  const compactMskDate = formatFullCompactMskDate(scheduledSource);

  const showTimeButton = canEditTime && channel.post_published !== 1;
  const showActionRow = showTimeButton || canEditContent;

  return (
    <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 backdrop-blur-sm border border-pink-200/80 shadow-2xs space-y-2 min-w-0 transition-colors hover:border-pink-300">
      {/* Row 1: Channel identity + Delete icon neatly in top-right corner */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
          title={channel.promo_text ? `${channel.channel_name} — ${channel.promo_text}` : channel.channel_name}
        >
          {channel.channel_avatar_url ? (
            <CachedMediaImage
              src={channel.channel_avatar_url}
              alt={channel.channel_name || 'Канал'}
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-pink-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 via-pink-100 to-orange-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0 border border-pink-200">
              {(channel.channel_name || 'Кн').slice(0, 2)}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-bold text-[14px] text-slate-900 group-hover:text-pink-700 break-words leading-snug">
              {channel.channel_name}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] leading-snug">
              {cleanUsername && (
                <span className="text-pink-600 font-semibold break-all">
                  @{cleanUsername}
                </span>
              )}
              <span className="text-slate-700 shrink-0">
                {subscribersCount} подп.
              </span>
            </div>
          </div>
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={onOpenDelete}
            className="w-8 h-8 shrink-0 rounded-xl bg-white/90 border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer shadow-2xs flex items-center justify-center"
            title="Удалить канал из подборки"
            aria-label="Удалить канал из подборки"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Row 2: Role / Custom-time badges + Full Publish Date & Time */}
      <div className="pt-1.5 border-t border-pink-200/70 space-y-1.5 min-w-0">
        {(isMyChannel || hasCustomTime) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[14px]">
            {isMyChannel && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-100/90 text-amber-900 border border-amber-300 text-[14px] font-bold leading-snug">
                Ваш канал
              </span>
            )}
            {hasCustomTime && (
              <span className="px-2 py-0.5 rounded-lg bg-sky-100/90 text-sky-900 border border-sky-300 text-[14px] font-semibold leading-snug">
                Своё время
              </span>
            )}
          </div>
        )}

        <div className="text-[14px] leading-snug min-w-0">
          {isPublishedError ? (
            <div
              className="flex items-start gap-1.5 text-rose-700 font-bold break-words"
              title={channel.reject_reason}
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Ошибка: {channel.reject_reason}</span>
            </div>
          ) : isPublishedSuccess ? (
            <div className="flex items-center gap-1.5 text-sky-900 font-bold">
              <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Опубликовано</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 text-slate-800 font-semibold tabular-nums flex-wrap"
              title={`Запланировано: ${fullMskDate}`}
            >
              <Clock className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Выход: {compactMskDate}</span>
            </div>
          )}
        </div>

        {/* Row 3: Action buttons on one clean line (Время for owner/organizer, Ред. strictly for channel owner) */}
        {showActionRow && (
          <div className="flex items-center gap-1.5 pt-1">
            {showTimeButton && (
              <button
                type="button"
                onClick={onOpenCustomTime}
                className={`flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 rounded-xl border text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors ${
                  hasCustomTime
                    ? 'bg-sky-100/90 border-sky-300 text-sky-900'
                    : 'bg-white/90 border-sky-200 text-sky-800 hover:bg-white'
                }`}
                title="Указать индивидуальное время выхода в течение суток (до 24ч вперёд)"
              >
                <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="truncate">{hasCustomTime ? 'Смещено' : 'Время'}</span>
              </button>
            )}

            {canEditContent && (
              <button
                type="button"
                onClick={onOpenEdit}
                className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] flex items-center justify-center gap-1.5 shadow-2xs hover:opacity-95 transition-all cursor-pointer"
                title="Редактировать описание и аватар канала"
              >
                <Edit3 className="w-4 h-4 shrink-0" />
                <span className="truncate">Ред.</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
