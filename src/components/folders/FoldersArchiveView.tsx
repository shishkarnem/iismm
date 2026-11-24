import React, { useState, useMemo } from 'react';
import {
  FolderHeart,
  Layers,
  Calendar,
  Clock,
  Users,
  Search,
  Eye,
  RotateCcw,
  Archive as ArchiveIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Tv,
  Trash2
} from 'lucide-react';
import { ReanimateTarget } from './ReanimateModal';
import { DeletePromoTarget } from './DeletePromoModal';
import { formatMskDateDisplay } from '../../utils/timezones';
import { CachedMediaImage } from '../CachedMediaImage';

interface FoldersArchiveViewProps {
  folders: any[];
  selections: any[];
  currentUserId?: string;
  onOpenReanimate: (target: ReanimateTarget) => void;
  onDeleteItem?: (target: DeletePromoTarget) => void;
  onPreviewFolder: (folder: any) => void;
  onPreviewSelection: (selection: any) => void;
}

export default function FoldersArchiveView({
  folders,
  selections,
  currentUserId,
  onOpenReanimate,
  onDeleteItem,
  onPreviewFolder,
  onPreviewSelection
}: FoldersArchiveViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'folders' | 'selections'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParticipants, setExpandedParticipants] = useState<Record<string, boolean>>({});

  const toggleParticipants = (id: string) => {
    setExpandedParticipants(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter archived folders
  const archivedFolders = useMemo(() => {
    return (folders || []).filter((f: any) => f.status === 'archived');
  }, [folders]);

  // Filter archived selections (including legacy results status)
  const archivedSelections = useMemo(() => {
    return (selections || []).filter((s: any) => s.status === 'archived' || s.status === 'results');
  }, [selections]);

  // Combined list
  const combinedItems = useMemo(() => {
    const list: Array<{
      id: string;
      rawId: string;
      itemType: 'folder' | 'selection';
      title: string;
      scheduledAt: string;
      authorId: string;
      authorName: string;
      participantsCount: number;
      postText: string;
      imageUrl: string;
      categories: string[];
      channelsList: any[];
      rawItem: any;
    }> = [];

    if (filterType === 'all' || filterType === 'folders') {
      archivedFolders.forEach((f: any) => {
        let cats: string[] = [];
        try {
          cats = typeof f.categories === 'string' ? JSON.parse(f.categories) : (f.categories || []);
        } catch (e) {
          cats = [f.categories || 'Общее'];
        }

        const parts = f.participants || [];

        list.push({
          id: `arch_f_${f.id}`,
          rawId: f.id,
          itemType: 'folder',
          title: f.title,
          scheduledAt: f.scheduled_at,
          authorId: String(f.author_id || ''),
          authorName: f.author_name || 'Организатор',
          participantsCount: f.participantsCount || parts.length || 0,
          postText: f.post_text || '',
          imageUrl: f.image_url || '',
          categories: cats,
          channelsList: parts,
          rawItem: f
        });
      });
    }

    if (filterType === 'all' || filterType === 'selections') {
      archivedSelections.forEach((s: any) => {
        let cats: string[] = [];
        try {
          cats = typeof s.categories === 'string' ? JSON.parse(s.categories) : (s.categories || []);
        } catch (e) {
          cats = [s.categories || 'Общее'];
        }

        const chans = s.channels || [];

        list.push({
          id: `arch_s_${s.id}`,
          rawId: s.id,
          itemType: 'selection',
          title: s.title,
          scheduledAt: s.scheduled_at,
          authorId: String(s.author_id || ''),
          authorName: s.author_name || 'Организатор',
          participantsCount: chans.length || 0,
          postText: s.post_text || '',
          imageUrl: s.image_url || '',
          categories: cats,
          channelsList: chans,
          rawItem: s
        });
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        item.postText.toLowerCase().includes(q)
      );
    }

    // Sort by scheduledAt descending
    return list.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [archivedFolders, archivedSelections, filterType, searchQuery]);

  return (
    <div className="space-y-6 w-full">
      {/* Search and Filter Controls (Responsive for Mobile, Vertical/Dropdown without horizontal scroll) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-100/60 via-pink-100/60 via-orange-100/60 via-pink-100/60 to-sky-100/60 backdrop-blur-md border border-pink-300/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-xs">
              <ArchiveIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Архив завершенных папок и подборок
              </h3>
              <p className="text-[14px] text-slate-700">
                Результаты отправки на каналы и возможность реанимации со всеми участниками
              </p>
            </div>
          </div>
          <span className="self-start sm:self-center px-3 py-1 rounded-xl bg-white/90 border border-pink-200 text-[14px] font-bold text-slate-800">
            В архиве: {combinedItems.length}
          </span>
        </div>

        {/* Filter Buttons & Search Input */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2 border-t border-pink-100/70">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-[14px] font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                filterType === 'all'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                  : 'bg-white/80 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <span>Все архивы ({archivedFolders.length + archivedSelections.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('folders')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-[14px] font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                filterType === 'folders'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                  : 'bg-white/80 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>Папки ({archivedFolders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('selections')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-[14px] font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                filterType === 'selections'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                  : 'bg-white/80 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Подборки ({archivedSelections.length})</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или тексту..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-[14px] text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
        </div>
      </div>

      {/* Cards Grid: 4 per row on PC (xl:grid-cols-4), 2 on md, 1 on mobile */}
      {combinedItems.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-gradient-to-r from-sky-100/60 via-pink-100/60 via-orange-100/60 via-pink-100/60 to-sky-100/60 backdrop-blur-md border border-pink-300/70 space-y-3">
          <ArchiveIcon className="w-12 h-12 mx-auto text-pink-400 opacity-80" />
          <h4 className="text-base sm:text-lg font-bold text-slate-800">
            В архиве пока ничего нет
          </h4>
          <p className="text-[14px] text-slate-600 max-w-md mx-auto">
            Когда публикации папок и подборок завершатся по расписанию, они автоматически переместятся сюда с полным отчетом по каждому каналу.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
          {combinedItems.map((item) => {
            const formattedDate = formatMskDateDisplay(item.scheduledAt);
            const isExpanded = Boolean(expandedParticipants[item.id]);
            const channels = item.channelsList || [];

            // Calculate success & failure counts
            const successCount = channels.filter((c: any) => c.post_published === 1 && !c.reject_reason).length;
            const failCount = channels.filter((c: any) => c.reject_reason || (c.post_published === 1 && c.reject_reason)).length;
            const pendingCount = channels.filter((c: any) => c.post_published !== 1 && !c.reject_reason).length;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 backdrop-blur-md border border-pink-300/70 shadow-xs flex flex-col justify-between gap-3.5 min-w-0"
              >
                <div className="space-y-3 min-w-0">
                  {/* Top Bar: Badge & Type */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl text-[14px] font-bold bg-white/90 border border-pink-300 text-slate-800">
                        {item.itemType === 'folder' ? '📁 Папка' : '📚 Подборка'}
                      </span>
                      <span className="px-2.5 py-1 rounded-xl text-[14px] font-bold bg-pink-100/90 border border-pink-300 text-pink-800">
                        В архиве
                      </span>
                    </div>

                    <span className="text-[14px] text-slate-600 font-medium truncate max-w-[150px]" title={item.authorName}>
                      {item.authorName}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-base font-bold text-slate-900 break-words leading-snug line-clamp-2" title={item.title}>
                    «{item.title}»
                  </h4>

                  {/* Categories */}
                  {item.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.categories.slice(0, 2).map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-lg text-[14px] font-semibold bg-white/80 border border-pink-200 text-slate-700 truncate max-w-full"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta: Schedule Date & Participant count */}
                  <div className="pt-2 border-t border-pink-200/80 space-y-1 text-[14px] text-slate-700">
                    <div className="flex items-center gap-1.5 break-words">
                      <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{formattedDate.dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>{formattedDate.timeStr} (МСК)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-pink-600 shrink-0" />
                      <span>Участников: {item.participantsCount}</span>
                    </div>
                  </div>

                  {/* Delivery Summary Badge */}
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-pink-200 flex flex-wrap items-center justify-between gap-1.5 text-[14px]">
                    <span className="text-sky-800 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>{successCount} отпр.</span>
                    </span>
                    {failCount > 0 && (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{failCount} ошибок</span>
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{pendingCount} ожид.</span>
                      </span>
                    )}
                  </div>

                  {/* Collapsible Participant Delivery Report */}
                  <div className="rounded-2xl border border-pink-200/90 bg-white/70 overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => toggleParticipants(item.id)}
                      className="w-full p-2.5 flex items-center justify-between text-[14px] font-bold text-slate-800 hover:bg-pink-50/50 cursor-pointer transition-all"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>📋 Кому отправлено ({channels.length})</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="p-2.5 border-t border-pink-100 space-y-2 max-h-60 overflow-y-auto bg-pink-50/30">
                        {channels.length === 0 ? (
                          <p className="text-[14px] text-slate-500 p-2 text-center">Нет участников в списке</p>
                        ) : (
                          channels.map((ch: any, idx: number) => {
                            const chName = ch.channel_name || 'Канал';
                            const chUsername = ch.channel_username ? `@${ch.channel_username.replace(/^@/, '')}` : '';
                            const avatar = ch.avatar_url || ch.channel_avatar_url;
                            const isSuccess = ch.post_published === 1 && !ch.reject_reason;
                            const hasError = Boolean(ch.reject_reason);
                            const schedTimeStr = ch.custom_publish_time
                              ? formatMskDateDisplay(ch.custom_publish_time).fullStr
                              : formattedDate.fullStr;

                            return (
                              <div
                                key={ch.id || idx}
                                className="p-2 rounded-xl bg-white border border-pink-100 space-y-1.5 text-[14px] shadow-2xs min-w-0"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {avatar ? (
                                    <CachedMediaImage
                                      src={avatar}
                                      alt={chName}
                                      className="w-7 h-7 rounded-lg object-cover border border-pink-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-lg bg-pink-100 border border-pink-200 flex items-center justify-center shrink-0">
                                      <Tv className="w-3.5 h-3.5 text-pink-600" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 truncate" title={chName}>
                                      {chName}
                                    </div>
                                    {chUsername && (
                                      <div className="text-pink-600 text-[14px] truncate" title={chUsername}>
                                        {chUsername}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[14px] text-slate-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-orange-500 shrink-0" />
                                  <span className="truncate">{schedTimeStr}</span>
                                </div>

                                {/* Status badge */}
                                {isSuccess ? (
                                  <div className="px-2 py-0.5 rounded-lg text-[14px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span className="truncate">Успешно отправлено</span>
                                  </div>
                                ) : hasError ? (
                                  <div className="p-1.5 rounded-lg text-[14px] bg-rose-50 border border-rose-200 text-rose-700 space-y-0.5">
                                    <div className="font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      <span>Не отправлено</span>
                                    </div>
                                    <div className="text-[14px] text-rose-600 break-words leading-tight">
                                      {ch.reject_reason}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="px-2 py-0.5 rounded-lg text-[14px] font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="truncate">Ожидает отправки</span>
                                  </div>
                                )}

                                {/* If folder repeat post */}
                                {item.itemType === 'folder' && item.rawItem.repeat_post_enabled === 1 && (
                                  <div className="pt-1 border-t border-pink-100/60 text-[14px] text-slate-600">
                                    {ch.repeat_post_published === 1 ? (
                                      <span className="text-sky-700 font-bold">2-й пост: отправлен</span>
                                    ) : (
                                      <span className="text-slate-500">2-й пост: ожидает</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions: View, Reanimate, Delete */}
                <div className="pt-3 border-t border-pink-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.itemType === 'folder') {
                        onPreviewFolder(item.rawItem);
                      } else {
                        onPreviewSelection(item.rawItem);
                      }
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-2xl text-[14px] font-bold bg-white/90 border border-pink-200 text-slate-700 hover:bg-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-sky-600" />
                    <span>Просмотр</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenReanimate({
                        id: item.rawId,
                        type: item.itemType,
                        title: item.title,
                        headerTitle: item.rawItem.header_title,
                        postText: item.postText,
                        scheduledAt: item.scheduledAt,
                        repeatPostEnabled: item.rawItem.repeat_post_enabled,
                        repeatScheduledAt: item.rawItem.repeat_scheduled_at,
                        imageUrl: item.imageUrl,
                        participantsCount: item.participantsCount
                      });
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Реанимировать со всеми</span>
                  </button>

                  {onDeleteItem && (!currentUserId || !item.authorId || currentUserId === item.authorId) && (
                    <button
                      type="button"
                      onClick={() =>
                        onDeleteItem({
                          id: item.rawId,
                          type: item.itemType,
                          title: item.title,
                          participantsCount: item.participantsCount
                        })
                      }
                      className="w-full sm:w-auto px-3 py-2 rounded-2xl text-[14px] font-bold bg-white/90 border border-rose-300 text-rose-700 hover:bg-rose-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      title={item.itemType === 'folder' ? 'Удалить папку' : 'Удалить подборку'}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sm:hidden">Удалить</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
