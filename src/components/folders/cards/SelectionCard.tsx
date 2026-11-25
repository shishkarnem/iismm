import React, { useState } from 'react';
import {
  Edit3,
  Trash2,
  Eye,
  Share2,
  Link2,
  Users,
  ChevronDown,
  PlusCircle,
  Calendar,
  Tag
} from 'lucide-react';
import { SelectionChannelRow } from '../../selections/SelectionChannelRow';
import { DeletePromoTarget } from '../DeletePromoModal';

interface SelectionCardProps {
  selection: any;
  isAuthor: boolean;
  isChannelsExpanded: boolean;
  isUserChannel: (c: any) => boolean;
  toMskInputString: (iso: string) => string;
  getInviteUrl: (type: 'folder' | 'selection', item: any) => string;
  getTmaInviteUrl: (type: 'folder' | 'selection', item: any) => string;
  onCopyToClipboard: (text: string, msg: string) => void;
  onToggleChannels: (selectionId: string) => void;
  onOpenEditSelection: (selection: any) => void;
  onOpenDeleteSelection: (target: DeletePromoTarget) => void;
  onOpenPreviewSelection: (selection: any) => void;
  onOpenJoinSelection: (selection: any) => void;
  onOpenLeaveSelection: (selection: any, channel?: any) => void;
  onOpenChannelDetail: (selection: any, channel: any) => void;
  onOpenCustomTime: (selection: any, channel: any) => void;
  onOpenEditChannel: (channel: any, selection: any) => void;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  selection,
  isAuthor,
  isChannelsExpanded,
  isUserChannel,
  getInviteUrl,
  getTmaInviteUrl,
  onCopyToClipboard,
  onToggleChannels,
  onOpenEditSelection,
  onOpenDeleteSelection,
  onOpenPreviewSelection,
  onOpenJoinSelection,
  onOpenLeaveSelection,
  onOpenChannelDetail,
  onOpenCustomTime,
  onOpenEditChannel
}) => {
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const allChannels = Array.isArray(selection.channels) ? selection.channels : [];
  const activeChannels = allChannels.filter((c: any) => c.status === 'active');
  const invitedChannelsCount = allChannels.filter((c: any) => c.status === 'invited').length;
  const categories: string[] = Array.isArray(selection.categories) ? selection.categories : [];

  const pubDate = new Date(selection.scheduled_at).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mainTitle = String(selection.header_title || selection.title || 'Подборка').trim();
  const secondaryTitle =
    selection.title &&
    selection.header_title &&
    selection.title.trim().toLowerCase() !== selection.header_title.trim().toLowerCase()
      ? selection.title.trim()
      : '';

  const statusLabel =
    selection.status === 'published'
      ? 'Опубликовано'
      : selection.status === 'confirmed'
      ? 'Подтверждена'
      : 'Идёт сбор';

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 backdrop-blur-md border border-pink-300/70 shadow-xs flex flex-col justify-between gap-3.5 min-w-0 overflow-hidden">
      <div className="space-y-3 min-w-0">
        {/* Верхняя строка: статус слева, кнопки Редактировать и Удалить подборку справа */}
        <div className="flex items-center justify-between gap-2 text-[14px]">
          <span
            className={`px-2.5 py-0.5 rounded-xl font-bold shrink-0 ${
              selection.status === 'published'
                ? 'bg-sky-100/90 text-sky-900 border border-sky-300'
                : selection.status === 'confirmed'
                ? 'bg-sky-50/90 text-sky-800 border border-sky-200'
                : 'bg-white/85 text-pink-800 border border-pink-300'
            }`}
          >
            {statusLabel}
          </span>

          {isAuthor && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenEditSelection(selection)}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white hover:opacity-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                title="Редактировать параметры подборки"
                aria-label="Редактировать подборку"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenDeleteSelection({
                    id: selection.id,
                    type: 'selection',
                    title: selection.header_title || selection.title,
                    participantsCount: activeChannels.length
                  })
                }
                className="w-9 h-9 rounded-xl bg-white/90 border border-rose-300 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                title="Удалить подборку"
                aria-label="Удалить подборку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Заголовок, название, роль, автор и дата публикации */}
        <div className="space-y-1.5 pb-2.5 border-b border-pink-200/80 min-w-0">
          <h3
            className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug break-words line-clamp-2"
            title={mainTitle}
          >
            {mainTitle}
          </h3>
          {secondaryTitle && (
            <p className="text-[14px] font-semibold text-slate-800 break-words leading-snug">
              {secondaryTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[14px] text-slate-700 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="break-words">{selection.author_name || 'Организатор'}</span>
              {isAuthor && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-900 text-[14px] font-bold">
                  Организатор
                </span>
              )}
              {!isAuthor && selection.userJoined && (
                <span className="px-2 py-0.5 rounded-lg bg-sky-100/90 border border-sky-300 text-sky-900 text-[14px] font-bold">
                  Участвуете
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800 shrink-0 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>{pubDate}</span>
            </span>
          </div>
        </div>

        {/* Выпадающий блок категорий (тегов) */}
        {categories.length > 0 && (
          <div className="rounded-2xl border border-pink-200/80 bg-white/75 overflow-hidden">
            <button
              type="button"
              onClick={() => setTagsExpanded((prev) => !prev)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 text-[14px] font-semibold text-slate-800 hover:bg-white/90 transition-colors cursor-pointer min-h-[40px]"
            >
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                <Tag className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="truncate">
                  {tagsExpanded
                    ? `Тематики (${categories.length})`
                    : categories.length > 1
                    ? `${categories[0]} +${categories.length - 1}`
                    : categories[0]}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${
                  tagsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {tagsExpanded && (
              <div className="px-3 pb-2.5 pt-1.5 border-t border-pink-100 flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2.5 py-0.5 rounded-xl bg-white/95 border border-pink-200 text-[14px] font-medium text-slate-800 break-words"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Утилиты: Просмотр, Поделиться, Инвайт (одна аккуратная строка) */}
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={() => onOpenPreviewSelection(selection)}
            className="flex-1 min-w-0 min-h-[40px] px-3 py-2 rounded-xl bg-white/90 border border-pink-200 text-slate-800 hover:bg-white text-[14px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Предпросмотр Rich-поста подборки"
          >
            <Eye className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="truncate">Просмотр</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onCopyToClipboard(getInviteUrl('selection', selection), 'Ссылка на подборку скопирована')
            }
            className="w-10 h-10 shrink-0 rounded-xl bg-white/90 border border-pink-200 text-sky-600 hover:bg-white transition-all cursor-pointer flex items-center justify-center shadow-2xs"
            title="Скопировать ссылку на сайт"
            aria-label="Скопировать ссылку на сайт"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              onCopyToClipboard(getTmaInviteUrl('selection', selection), 'Инвайт для бота скопирован')
            }
            className="w-10 h-10 shrink-0 rounded-xl bg-white/90 border border-pink-200 text-pink-600 hover:bg-white transition-all cursor-pointer flex items-center justify-center shadow-2xs"
            title="Скопировать инвайт для Telegram-бота"
            aria-label="Скопировать инвайт для Telegram-бота"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        {/* Выпадающий список каналов */}
        <div className="rounded-2xl border border-pink-200/80 bg-white/75 overflow-hidden">
          <button
            type="button"
            onClick={() => onToggleChannels(selection.id)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-[14px] font-bold text-slate-800 hover:bg-white/90 transition-colors cursor-pointer min-h-[40px]"
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate tabular-nums">
              <Users className="w-4 h-4 text-pink-600 shrink-0" />
              <span className="truncate">
                Каналы ({activeChannels.length} из {selection.max_participants})
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${
                isChannelsExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isChannelsExpanded && (
            <div className="p-2.5 border-t border-pink-100 space-y-2 bg-white/50">
              {invitedChannelsCount > 0 && (
                <p className="text-[14px] text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl px-2.5 py-1.5">
                  Приглашённых каналов после реанимации: {invitedChannelsCount}. Можно подтвердить повторно через «Добавить канал».
                </p>
              )}
              {activeChannels.length === 0 ? (
                <p className="text-[14px] text-slate-600 p-2 text-center">
                  Пока нет активных каналов
                </p>
              ) : (
                activeChannels.map((c: any) => {
                  const isMyChan = isUserChannel(c);
                  return (
                    <SelectionChannelRow
                      key={c.id}
                      channel={c}
                      selectionScheduledAt={selection.scheduled_at}
                      isMyChannel={isMyChan}
                      canEditContent={isMyChan}
                      canEditTime={isMyChan || isAuthor}
                      canDelete={isMyChan || isAuthor}
                      onOpenDetail={() => onOpenChannelDetail(selection, c)}
                      onOpenCustomTime={() => onOpenCustomTime(selection, c)}
                      onOpenEdit={() => onOpenEditChannel(c, selection)}
                      onOpenDelete={() => onOpenLeaveSelection(selection, c)}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя кнопка добавления канала (без дублирующей кнопки удаления) */}
      <div className="pt-2.5 border-t border-pink-200/80 w-full">
        <button
          type="button"
          onClick={() => onOpenJoinSelection(selection)}
          className="w-full min-h-[42px] px-3 py-2 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          title="Добавить канал в подборку"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">Добавить канал</span>
        </button>
      </div>
    </div>
  );
};
