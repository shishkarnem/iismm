import React from 'react';
import {
  AlertTriangle,
  Clock,
  Copy,
  Edit3,
  Layers,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Plus,
  Radio,
  Search,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { Channel, DayRequest } from '../../types';
import MarkdownRenderer from '../MarkdownRenderer';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../ui-kit/CollapsibleSection';
import { stripDuplicateTitleFromPostContent } from '../../utils/formatting/postTitleAndTagHelpers';
import {
  GradientModalShell,
  ResponsiveActionBtn,
  UnboxedMetaLine
} from '../ui-kit/ResponsiveActionBtn';
import {
  formatCollapsedExactDateTime,
  parseLocalDateTimeInput
} from '../../utils/schedule/localDateTime';

const formatScheduleText = (schedule: any) => {
  if (!schedule || !schedule.enabled) return null;
  const freq = String(schedule.frequency || 'daily').toLowerCase();
  if (freq === 'interval_minutes' || freq === 'minutes') return `Каждые ${schedule.intervalMinutes || 15} мин`;
  if (freq === 'interval_hours' || freq === 'hours') return `Каждые ${schedule.intervalHours || 2} ч`;
  if (freq === 'daily') return `Ежедневно в ${schedule.time || '09:00'}`;
  if (freq === 'dayofweek' || freq === 'weekly') return `Еженедельно в ${schedule.time || '09:00'}`;
  if (freq === 'monthly') return `${schedule.dayOfMonth || 1}-го числа в ${schedule.time || '09:00'}`;
  if (freq === 'once' || freq === 'exact_date') {
    const formatted = formatCollapsedExactDateTime(schedule.exactDateTime);
    return formatted ? formatted : 'не задана';
  }
  return 'Автопостинг';
};

function resolvePostStatusLine(post: DayRequest): string {
  const rawStatus = String(post.status || '').toLowerCase().trim();
  const isPub =
    rawStatus === 'опубликован' ||
    rawStatus === 'опубликовано' ||
    rawStatus === 'отправлен' ||
    rawStatus === 'отправлено' ||
    rawStatus === 'published' ||
    rawStatus === 'sent' ||
    rawStatus === 'успешно' ||
    Boolean(post.isPublished) ||
    Boolean(post.published);

  const pubDate = post.publishedAt || post.publishedDate;

  if (isPub) {
    if (pubDate) {
      const formattedPub = formatCollapsedExactDateTime(String(pubDate));
      if (formattedPub) return `Отправлен ${formattedPub}`;
      const d = new Date(pubDate);
      if (!isNaN(d.getTime())) {
        return `Отправлен ${d.toLocaleDateString('ru-RU')} в ${d.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
    }
    return 'Отправлен';
  }

  if (rawStatus === 'ошибка' || rawStatus === 'failed' || rawStatus === 'error') {
    return 'Ошибка отправки';
  }

  const isSched =
    Boolean(post.triggerSchedule?.enabled) ||
    rawStatus === 'запланирован' ||
    rawStatus === 'запланировано' ||
    rawStatus === 'отложено' ||
    rawStatus === 'scheduled';

  if (isSched) {
    const rawExact = post.triggerSchedule?.exactDateTime;
    const rawSched =
      rawExact ||
      post.scheduledTime ||
      (post.triggerSchedule?.time ? `${post.triggerSchedule?.date || ''} ${post.triggerSchedule.time}`.trim() : null);

    if (rawSched && typeof rawSched === 'string' && !rawSched.trim().startsWith('{')) {
      const exactFormatted = formatCollapsedExactDateTime(rawSched);
      if (exactFormatted) return `Запланирован ${exactFormatted}`;
      const parsed = parseLocalDateTimeInput(rawSched);
      if (parsed) {
        return `Запланирован ${parsed.toLocaleDateString('ru-RU')} в ${parsed.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
    }
    const human = formatScheduleText(post.triggerSchedule);
    return human ? `Запланирован: ${human}` : 'Запланирован';
  }

  const draftDate = post.createdAt || post.updatedAt;
  if (draftDate) {
    const d = new Date(draftDate);
    if (!isNaN(d.getTime())) {
      const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `Создается · от ${d.toLocaleDateString('ru-RU')} в ${timeStr}`;
    }
  }
  return 'Создается';
}

interface PostsCardsAndTableListProps {
  processedPosts: DayRequest[];
  channels: Channel[];
  uniqueTopics: string[];
  searchQuery: string;
  onChangeSearchQuery: (v: string) => void;
  selectedTopic: string;
  onChangeSelectedTopic: (v: string) => void;
  formatFilter: 'all' | 'v2' | 'rich';
  onChangeFormatFilter: (v: 'all' | 'v2' | 'rich') => void;
  scheduleFilter: 'all' | 'auto' | 'manual';
  onChangeScheduleFilter: (v: 'all' | 'auto' | 'manual') => void;
  statusFilter: 'all' | 'scheduled' | 'error' | 'published';
  onChangeStatusFilter: (v: 'all' | 'scheduled' | 'error' | 'published') => void;
  statusCounts: { scheduled: number; error: number; published: number };
  sortBy: 'newest' | 'oldest' | 'title' | 'category';
  onChangeSortBy: (v: 'newest' | 'oldest' | 'title' | 'category') => void;
  viewMode: 'cards' | 'list';
  onChangeViewMode: (v: 'cards' | 'list') => void;
  onCreateNewPost: () => Promise<void>;
  onSelectPost: (id: string) => void;
  postToCopy: DayRequest | null;
  onChangePostToCopy: (post: DayRequest | null) => void;
  isCopying: boolean;
  onConfirmCopy: () => Promise<void>;
  postToDelete: DayRequest | null;
  onChangePostToDelete: (post: DayRequest | null) => void;
  isDeleting: boolean;
  onConfirmDelete: () => Promise<void>;
}

export const PostsCardsAndTableList: React.FC<PostsCardsAndTableListProps> = ({
  processedPosts,
  channels,
  uniqueTopics,
  searchQuery,
  onChangeSearchQuery,
  selectedTopic,
  onChangeSelectedTopic,
  formatFilter,
  onChangeFormatFilter,
  scheduleFilter,
  onChangeScheduleFilter,
  statusFilter,
  onChangeStatusFilter,
  statusCounts,
  sortBy,
  onChangeSortBy,
  viewMode,
  onChangeViewMode,
  onCreateNewPost,
  onSelectPost,
  postToCopy,
  onChangePostToCopy,
  isCopying,
  onConfirmCopy,
  postToDelete,
  onChangePostToDelete,
  isDeleting,
  onConfirmDelete
}) => {
  const activeFilterSummary = [
    selectedTopic ? `#${selectedTopic}` : 'Все темы',
    formatFilter === 'all' ? 'Все форматы' : formatFilter === 'rich' ? 'Формат Rich' : 'Формат V2',
    scheduleFilter === 'all'
      ? 'Любой режим'
      : scheduleFilter === 'auto'
      ? 'Автопостинг'
      : 'Ручной запуск'
  ].join(' · ');

  return (
    <div className="space-y-4 min-w-0">
      {/* Панель поиска, сортировки и переключения вида */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 space-y-3 min-w-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="flex items-center gap-2 rounded-[14.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 px-3.5 py-2.5">
                <Search size={17} className="text-orange-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  placeholder="Поиск по названию или тексту поста..."
                  className="w-full bg-transparent text-[14px] text-slate-900 font-medium focus:outline-none placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onChangeSearchQuery('')}
                    className="text-slate-500 hover:text-slate-900 text-[14px] font-bold px-1 cursor-pointer"
                    title="Очистить поиск"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:w-auto md:min-w-[360px]">
              <GradientSelect
                compact
                value={sortBy}
                onChange={(v) => onChangeSortBy(v as any)}
                options={[
                  { value: 'newest', label: 'Сначала новые' },
                  { value: 'oldest', label: 'Сначала старые' },
                  { value: 'title', label: 'По названию (А–Я)' },
                  { value: 'category', label: 'По темам' }
                ]}
              />

              <GradientSelect
                compact
                value={viewMode}
                onChange={(v) => onChangeViewMode(v as 'cards' | 'list')}
                options={[
                  { value: 'cards', label: 'Вид: Карточки', icon: <LayoutGrid size={16} /> },
                  { value: 'list', label: 'Вид: Таблица', icon: <ListIcon size={16} /> }
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 min-w-0">
            {(
              [
                {
                  key: 'scheduled',
                  label: 'Отложенные',
                  count: statusCounts.scheduled,
                  icon: <Clock size={16} className="shrink-0" />
                },
                {
                  key: 'error',
                  label: 'Ошибки',
                  count: statusCounts.error,
                  icon: <AlertTriangle size={16} className="shrink-0" />
                },
                {
                  key: 'published',
                  label: 'Отправленные',
                  count: statusCounts.published,
                  icon: <Send size={16} className="shrink-0" />
                }
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  title={`${tab.label}: ${tab.count}`}
                  aria-label={`${tab.label}: ${tab.count}`}
                  aria-pressed={isActive}
                  onClick={() => onChangeStatusFilter(isActive ? 'all' : tab.key)}
                  className={`min-h-[42px] px-2.5 sm:px-3 py-2 rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                      : 'bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300/80 text-slate-900 hover:brightness-103'
                  }`}
                >
                  <span className={isActive ? 'text-white shrink-0' : 'text-pink-600 shrink-0'}>
                    {tab.icon}
                  </span>
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[14px] font-bold leading-none shrink-0 ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-gradient-to-r from-sky-100 via-pink-100 to-orange-100 text-slate-900 border border-pink-200/80'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <CollapsibleSection
            title="Фильтры по темам, формату и расписанию"
            summary={activeFilterSummary}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GradientSelect
                label="Тема публикации"
                value={selectedTopic}
                onChange={onChangeSelectedTopic}
                options={[
                  { value: '', label: `Все темы (${uniqueTopics.length})` },
                  ...uniqueTopics.map((t) => ({ value: String(t), label: `#${t}` }))
                ]}
              />

              <GradientSelect
                label="Формат сообщения"
                value={formatFilter}
                onChange={(v) => onChangeFormatFilter(v as any)}
                options={[
                  { value: 'all', label: 'Все форматы' },
                  { value: 'v2', label: 'Формат V2' },
                  { value: 'rich', label: 'Формат Rich' }
                ]}
              />

              <GradientSelect
                label="Режим публикации"
                value={scheduleFilter}
                onChange={(v) => onChangeScheduleFilter(v as any)}
                options={[
                  { value: 'all', label: 'Любой режим' },
                  { value: 'auto', label: 'Автопостинг по расписанию' },
                  { value: 'manual', label: 'Ручной запуск' }
                ]}
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Сетка карточек или таблица */}
      {processedPosts.length === 0 ? (
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-10 text-center space-y-4">
            <Layers className="mx-auto text-pink-500" size={36} />
            <div className="space-y-1">
              <p className="text-[16px] text-slate-900 font-bold">Публикации не найдены</p>
              <p className="text-[14px] text-slate-700">
                Измените условия поиска или создайте новую публикацию.
              </p>
            </div>
            <div className="flex justify-center">
              <ResponsiveActionBtn
                icon={<Plus size={17} />}
                label="Создать первый пост"
                onClick={onCreateNewPost}
                variant="vivid"
                alwaysShowLabel={true}
              />
            </div>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 min-w-0">
          {processedPosts.map((post, idx) => {
            const postChannels =
              post.channels && post.channels.length > 0
                ? post.channels
                : [post.channel || channels[0]?.username || '@IIrkiBot'];

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm min-w-0"
              >
                <div className="h-full rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0">
                  <div className="space-y-3 min-w-0">
                    <UnboxedMetaLine
                      items={[
                        `#${post.category || 'общий'}`,
                        post.messageFormat === 'rich' ? 'Rich' : 'V2',
                        resolvePostStatusLine(post)
                      ]}
                    />

                    <h3 className="text-[16px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent line-clamp-2 break-words">
                      {post.title || 'Пост без названия'}
                    </h3>

                    <div className="bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-200/80 p-3.5 rounded-2xl overflow-hidden max-h-48 overflow-y-auto min-w-0">
                      <MarkdownRenderer
                        content={stripDuplicateTitleFromPostContent(
                          post.postText || post.requestTemplate || '',
                          post.title
                        )}
                        format={(post.messageFormat as any) || 'v2'}
                        isCompact={true}
                        maxLines={4}
                        attachmentType={post.attachmentType}
                        attachmentUrl={post.attachmentUrl}
                        attachmentUrls={post.attachmentUrls}
                        inlineButtons={post.inlineButtons}
                        signature={post.signature}
                        uppercaseHeader={false}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[14px] text-slate-700 font-medium pt-1">
                      <Radio size={15} className="text-orange-500 shrink-0" />
                      <span className="break-words">{postChannels.join(' · ')}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-pink-300/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ResponsiveActionBtn
                        icon={<Copy size={16} />}
                        label="Копировать"
                        showLabelFrom="never"
                        title="Создать копию поста"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangePostToCopy(post);
                        }}
                        variant="outline"
                      />
                      <ResponsiveActionBtn
                        icon={<Trash2 size={16} />}
                        label="Удалить"
                        showLabelFrom="never"
                        title="Удалить пост"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangePostToDelete(post);
                        }}
                        variant="danger"
                      />
                    </div>

                    <ResponsiveActionBtn
                      icon={<Edit3 size={16} />}
                      label="Открыть"
                      title="Открыть публикацию в редакторе"
                      onClick={() => onSelectPost(post.id)}
                      variant="vivid"
                      className="flex-1"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 overflow-hidden shadow-sm">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md overflow-x-auto">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border-b border-pink-300/70 text-slate-900 font-bold">
                  <th className="py-3.5 px-4">Название и предпросмотр</th>
                  <th className="py-3.5 px-4">Тема и формат</th>
                  <th className="py-3.5 px-4">Каналы</th>
                  <th className="py-3.5 px-4">Статус</th>
                  <th className="py-3.5 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-200/70">
                {processedPosts.map((post) => {
                  const postChannels =
                    post.channels && post.channels.length > 0
                      ? post.channels
                      : [post.channel || channels[0]?.username || '@IIrkiBot'];

                  return (
                    <tr
                      key={post.id}
                      onClick={() => onSelectPost(post.id)}
                      className="hover:bg-white/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-bold text-[15px] text-slate-900 truncate">
                          {post.title || 'Пост без названия'}
                        </div>
                        <div className="mt-1.5 p-2.5 rounded-xl bg-white/85 border border-pink-200/80 max-h-24 overflow-hidden">
                          <MarkdownRenderer
                            content={stripDuplicateTitleFromPostContent(
                              post.postText || post.requestTemplate || '',
                              post.title
                            )}
                            format={(post.messageFormat as any) || 'v2'}
                            isCompact={true}
                            maxLines={2}
                            attachmentType={post.attachmentType}
                            attachmentUrl={post.attachmentUrl}
                            inlineButtons={post.inlineButtons}
                            signature={post.signature}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        #{post.category || 'общий'} · {post.messageFormat === 'rich' ? 'Rich' : 'V2'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {postChannels.join(', ')}
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {resolvePostStatusLine(post)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ResponsiveActionBtn
                            icon={<Edit3 size={16} />}
                            label="Изменить"
                            showLabelFrom="never"
                            onClick={() => onSelectPost(post.id)}
                            variant="vivid"
                          />
                          <ResponsiveActionBtn
                            icon={<Copy size={16} />}
                            label="Копировать"
                            showLabelFrom="never"
                            onClick={() => onChangePostToCopy(post)}
                            variant="outline"
                          />
                          <ResponsiveActionBtn
                            icon={<Trash2 size={16} />}
                            label="Удалить"
                            showLabelFrom="never"
                            onClick={() => onChangePostToDelete(post)}
                            variant="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно создания копии */}
      <GradientModalShell
        open={Boolean(postToCopy)}
        onClose={() => onChangePostToCopy(null)}
        title="Создание копии публикации"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <ResponsiveActionBtn
              icon={<X size={16} />}
              label="Отмена"
              onClick={() => onChangePostToCopy(null)}
              variant="outline"
              alwaysShowLabel={true}
            />
            <ResponsiveActionBtn
              icon={isCopying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
              label="Создать копию"
              disabled={isCopying}
              onClick={onConfirmCopy}
              variant="vivid"
              alwaysShowLabel={true}
            />
          </div>
        }
      >
        <p className="text-[14px] text-slate-800 font-medium leading-relaxed">
          Создать копию публикации «{postToCopy?.title || 'Пост без названия'}»?
        </p>
      </GradientModalShell>

      {/* Модальное окно удаления */}
      <GradientModalShell
        open={Boolean(postToDelete)}
        onClose={() => onChangePostToDelete(null)}
        title="Удаление публикации"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <ResponsiveActionBtn
              icon={<X size={16} />}
              label="Отмена"
              onClick={() => onChangePostToDelete(null)}
              variant="outline"
              alwaysShowLabel={true}
            />
            <ResponsiveActionBtn
              icon={
                isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />
              }
              label="Удалить"
              disabled={isDeleting}
              onClick={onConfirmDelete}
              variant="danger"
              alwaysShowLabel={true}
            />
          </div>
        }
      >
        <p className="text-[14px] text-slate-800 font-medium leading-relaxed">
          Вы действительно хотите безвозвратно удалить публикацию «{postToDelete?.title || 'Пост без названия'}» из базы данных?
        </p>
      </GradientModalShell>
    </div>
  );
};
