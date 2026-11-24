import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, FileText, Plus, Sparkles } from 'lucide-react';
import { Channel, DayRequest, PostTemplate, User } from '../types';
import { canUseRazgon } from '../utils/tariff/tariffUtils';

const PostTelegramEditor = lazy(() => import('../components/PostTelegramEditor'));
const ScenariosPage = lazy(() =>
  import('../components/ScenariosPage').then((m) => ({ default: m.ScenariosPage }))
);
const FreeCrosspostingView = lazy(() => import('../components/FreeCrosspostingView'));

import { NeurosphereLoader } from '../components/loaders/NeurosphereLoader';

const PostsSubViewFallback = () => <NeurosphereLoader variant="viewport" />;
import { TariffGateModal } from '../components/tariffs/TariffGateBanner';
import { AcademyHelpButton } from '../components/academy/AcademyHelpModal';
import { ResponsiveActionBtn } from '../components/ui-kit/ResponsiveActionBtn';
import {
  NeuroplanGeneratorSection,
  NeuroplanTopicItem
} from '../components/posts-list/NeuroplanGeneratorSection';
import { PostsCardsAndTableList } from '../components/posts-list/PostsCardsAndTableList';
import {
  PostsWorkspaceNav,
  PostsWorkspaceTabKey
} from '../components/posts-list/PostsWorkspaceNav';
import { isNeuroplanPath } from '../hooks/useAppRouting';

interface PostsProps {
  dayRequests: DayRequest[];
  channels: Channel[];
  templates?: PostTemplate[];
  currentUser?: User | null;
  onAddDayRequest: (req: Partial<DayRequest>) => Promise<any>;
  onUpdateDayRequest: (id: string, updated: Partial<DayRequest>) => Promise<any>;
  onDeleteDayRequest: (id: string) => Promise<void>;
  onSaveDayRequest: (request: Partial<DayRequest>) => Promise<any>;
  onPublishToTelegram: (
    title: string,
    content: string,
    dayRequestId: string,
    formattingOptions?: any
  ) => Promise<void>;
  onSaveTemplate?: (template: {
    type: 'header' | 'postText' | 'signature' | 'full';
    name: string;
    category?: string;
    content: string;
  }) => Promise<void>;
  selectedPostId?: string | null;
  onSelectPostId?: (id: string | null) => void;
  telegramId?: number;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export default function Posts({
  dayRequests,
  channels,
  templates = [],
  currentUser,
  onAddDayRequest,
  onDeleteDayRequest,
  onSaveDayRequest,
  onPublishToTelegram,
  onSaveTemplate,
  selectedPostId: externalSelectedPostId,
  onSelectPostId: externalOnSelectPostId,
  telegramId,
  currentPath,
  onNavigate,
  onRefresh
}: PostsProps) {
  const [internalSelectedPostId, setInternalSelectedPostId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<DayRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [postToCopy, setPostToCopy] = useState<DayRequest | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const activePostId =
    externalSelectedPostId !== undefined ? externalSelectedPostId : internalSelectedPostId;

  const userProfilePostsId = currentUser?.id || currentUser?.telegramId || '16926299042';
  const userFeedUrl = `/posts${userProfilePostsId}`;
  const userRedactorUrl = `/posts${userProfilePostsId}/redactor`;

  const getSubTabFromPath = (
    path?: string
  ): 'posts' | 'neuroplan' | 'scenarios' | 'crosspost' => {
    if (!path) return 'posts';
    if (isNeuroplanPath(path)) return 'neuroplan';
    if (path.startsWith('/scenarios')) return 'scenarios';
    if (path.startsWith('/crosspost')) return 'crosspost';
    return 'posts';
  };

  const [localSubTab, setLocalSubTab] = useState<
    'posts' | 'neuroplan' | 'scenarios' | 'crosspost'
  >('posts');
  const currentSubTab = currentPath ? getSubTabFromPath(currentPath) : localSubTab;

  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const [isFallbackFetching, setIsFallbackFetching] = useState(false);
  const [fallbackPost, setFallbackPost] = useState<DayRequest | null>(null);
  const [fallbackNotFound, setFallbackNotFound] = useState(false);

  useEffect(() => {
    void import('../components/PostTelegramEditor');
  }, []);

  useEffect(() => {
    if (currentPath && (currentPath.includes('/redactor') || isNeuroplanPath(currentPath))) {
      setInternalSelectedPostId(null);
      if (externalOnSelectPostId) {
        externalOnSelectPostId(null);
      }
    }
  }, [currentPath, externalOnSelectPostId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activePostId]);

  useEffect(() => {
    if (currentSubTab === 'posts' && !activePostId && onRefresh) {
      void onRefresh();
    }
  }, [currentSubTab, activePostId]);

  const setActivePostId = (id: string | null) => {
    if (externalOnSelectPostId) {
      externalOnSelectPostId(id);
    } else {
      setInternalSelectedPostId(id);
    }
    if (onNavigate) {
      onNavigate(id ? `/posts/${id}` : userRedactorUrl);
    } else {
      window.history.pushState(null, '', id ? `/posts/${id}` : userRedactorUrl);
    }
  };
  const [neuroplanIdea, setNeuroplanIdea] = useState<string>('');
  const [isGeneratingNeuroplan, setIsGeneratingNeuroplan] = useState<boolean>(false);
  const [generatedTopics, setGeneratedTopics] = useState<NeuroplanTopicItem[]>([]);
  const [isApprovingNeuroplan, setIsApprovingNeuroplan] = useState<boolean>(false);
  const [neuroplanStatus, setNeuroplanStatus] = useState<string | null>(null);
  const [isNeuroplanGateOpen, setIsNeuroplanGateOpen] = useState<boolean>(false);

  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'v2' | 'rich'>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'auto' | 'manual'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'error' | 'published'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'category'>('newest');

  const hasRazgonAccess = canUseRazgon(currentUser?.tariff, (currentUser as any)?.role);

  const uniqueTopics = useMemo(
    () => Array.from(new Set(dayRequests.map((r) => r.category).filter(Boolean))) as string[],
    [dayRequests]
  );

  const getPostStatusBucket = (post: DayRequest): 'scheduled' | 'error' | 'published' | 'other' => {
    const raw = String(post.status || '').toLowerCase().trim();
    if (raw === 'ошибка' || raw === 'failed' || raw === 'error') return 'error';
    if (
      raw === 'опубликован' ||
      raw === 'опубликовано' ||
      raw === 'отправлен' ||
      raw === 'отправлено' ||
      raw === 'published' ||
      raw === 'sent' ||
      raw === 'успешно' ||
      Boolean(post.isPublished) ||
      Boolean(post.published)
    ) {
      return 'published';
    }
    if (
      raw === 'запланирован' ||
      raw === 'запланировано' ||
      raw === 'отложено' ||
      raw === 'scheduled' ||
      raw === 'pending' ||
      (raw !== 'отменено' && raw !== 'cancelled' && Boolean(post.triggerSchedule?.enabled))
    ) {
      return 'scheduled';
    }
    return 'other';
  };

  const baseFilteredPosts = useMemo(() => {
    return dayRequests.filter((post) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.postText && post.postText.toLowerCase().includes(q)) ||
        (post.requestTemplate && post.requestTemplate.toLowerCase().includes(q));

      const matchesTopic = !selectedTopic || post.category === selectedTopic;

      const textContent = post.postText || post.requestTemplate || '';
      const isRich =
        post.messageFormat === 'rich' ||
        (/(?:^|\n)\s*#{1,6}\s+[^\s#]|<details|<tg-collage|<tg-slideshow|\|:?---|`{3}|-\s*\[[ xX]\]|<table>|<blockquote>|<spoiler>|<\/tg-/i.test(
          textContent
        ) &&
          post.messageFormat !== 'v2');

      const matchesFormat =
        formatFilter === 'all' ||
        (formatFilter === 'rich' && isRich) ||
        (formatFilter === 'v2' && !isRich);

      const matchesSchedule =
        scheduleFilter === 'all' ||
        (scheduleFilter === 'auto' && post.triggerSchedule?.enabled) ||
        (scheduleFilter === 'manual' && !post.triggerSchedule?.enabled);

      return matchesSearch && matchesTopic && matchesFormat && matchesSchedule;
    });
  }, [dayRequests, searchQuery, selectedTopic, formatFilter, scheduleFilter]);

  const statusCounts = useMemo(() => {
    let scheduled = 0;
    let error = 0;
    let published = 0;
    for (const post of baseFilteredPosts) {
      const b = getPostStatusBucket(post);
      if (b === 'scheduled') scheduled += 1;
      else if (b === 'error') error += 1;
      else if (b === 'published') published += 1;
    }
    return { scheduled, error, published };
  }, [baseFilteredPosts]);

  const processedPosts = useMemo(() => {
    const result =
      statusFilter === 'all'
        ? [...baseFilteredPosts]
        : baseFilteredPosts.filter((p) => getPostStatusBucket(p) === statusFilter);

    const getCreatedTime = (item: DayRequest) => {
      const ts = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
      if (!Number.isNaN(ts)) return ts;
      const numericId = Number(item.id);
      if (Number.isFinite(numericId) && numericId > 1e11) return numericId;
      return 0;
    };

    return result.sort((a, b) => {
      if (sortBy === 'newest') {
        const diff = getCreatedTime(b) - getCreatedTime(a);
        return diff !== 0 ? diff : (b.id || '').localeCompare(a.id || '');
      }
      if (sortBy === 'oldest') {
        const diff = getCreatedTime(a) - getCreatedTime(b);
        return diff !== 0 ? diff : (a.id || '').localeCompare(b.id || '');
      }
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });
  }, [baseFilteredPosts, statusFilter, sortBy]);

  const handleConfirmCopy = async () => {
    if (!postToCopy) return;
    setIsCopying(true);
    try {
      const copyData: Partial<DayRequest> = {
        title: postToCopy.title ? `${postToCopy.title} (копия)` : 'Копия поста',
        category: postToCopy.category || 'общий',
        requestTemplate: postToCopy.requestTemplate || '',
        postText: postToCopy.postText || '',
        imagePrompt: postToCopy.imagePrompt || '',
        signature: postToCopy.signature || '',
        messageFormat: postToCopy.messageFormat || 'v2',
        uppercaseHeader: false,
        linkPreviewEnabled: postToCopy.linkPreviewEnabled !== false,
        attachmentType: postToCopy.attachmentType || 'none',
        attachmentUrl: postToCopy.attachmentUrl || '',
        attachmentUrls: postToCopy.attachmentUrls ? [...postToCopy.attachmentUrls] : [],
        audioFormat: postToCopy.audioFormat,
        channel: postToCopy.channel || '',
        channels: postToCopy.channels ? [...postToCopy.channels] : [],
        inlineButtons: postToCopy.inlineButtons
          ? JSON.parse(JSON.stringify(postToCopy.inlineButtons))
          : [],
        uniquenessMemoryCount: postToCopy.uniquenessMemoryCount || 0,
        triggerSchedule: postToCopy.triggerSchedule
          ? JSON.parse(JSON.stringify(postToCopy.triggerSchedule))
          : { enabled: false }
      };
      const created = await onAddDayRequest(copyData);
      setPostToCopy(null);
      if (created && created.id) {
        setActivePostId(created.id);
      }
    } catch (err) {
      console.error('Failed to copy post:', err);
    } finally {
      setIsCopying(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteDayRequest(postToDelete.id);
      if (activePostId === postToDelete.id) {
        setActivePostId(null);
      }
      setPostToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNewPost = async () => {
    if (isCreatingPost) return;
    setIsCreatingPost(true);
    setCreateError(null);
    try {
      const defaultChannel =
        channels[0]?.username || (channels[0]?.telegramId ? String(channels[0].telegramId) : '');
      const created = await onAddDayRequest({
        title: 'Новый пост без названия',
        category: selectedTopic || 'общее',
        channel: defaultChannel,
        channels: defaultChannel ? [defaultChannel] : [],
        status: 'создается',
        requestTemplate: '',
        postText: '',
        signature: '',
        messageFormat: 'v2',
        uppercaseHeader: false,
        inlineButtons: [],
        triggerSchedule: {
          enabled: false,
          frequency: 'daily',
          time: '09:00'
        }
      });

      if (created && created.id) {
        setFallbackPost(created);
        setFallbackNotFound(false);
        setActivePostId(created.id);
      } else {
        throw new Error('База данных не вернула идентификатор созданного поста');
      }
    } catch (e: any) {
      setCreateError(e.message || 'Не удалось создать публикацию в базе данных.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleGenerateNeuroplanTopics = async () => {
    if (!hasRazgonAccess) {
      setIsNeuroplanGateOpen(true);
      return;
    }
    if (!neuroplanIdea.trim()) {
      setNeuroplanStatus('Укажите идею или тему для генерации нейроплана');
      return;
    }
    setIsGeneratingNeuroplan(true);
    setNeuroplanStatus(null);
    try {
      const cleanUserId = currentUser?.id || currentUser?.telegramId || '16926299042';
      const recentTitles = (dayRequests || []).map((r) => r.title?.trim()).filter(Boolean);
      const res = await fetch('/api/protalk/neuroplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicIdea: neuroplanIdea.trim(),
          userId: cleanUserId,
          telegramId: telegramId || currentUser?.telegramId,
          historyTitles: recentTitles
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания нейроплана');
      if (data.topics && Array.isArray(data.topics)) {
        setGeneratedTopics(
          data.topics.map((t: any, idx: number) => ({
            id: t.id || `np_top_${Date.now()}_${idx}`,
            title: t.title || (typeof t === 'string' ? t : 'Тема поста'),
            postText: t.postText || '',
            imagePrompt: t.imagePrompt || '',
            scheduledDate: t.scheduledDate || '',
            scheduledTime: t.scheduledTime || '10:00',
            selected: true,
            expanded: false
          }))
        );
        setNeuroplanStatus(
          'Нейросеть сгенерировала 15 уникальных тем с готовыми текстами, промптами для обложек и датами публикаций'
        );
      }
    } catch (e: any) {
      setNeuroplanStatus(e.message || 'Ошибка создания нейроплана');
    } finally {
      setIsGeneratingNeuroplan(false);
    }
  };

  const handleApproveNeuroplanDrafts = async () => {
    const selected = generatedTopics
      .filter((t) => t.selected && t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        postText: t.postText || '',
        imagePrompt: t.imagePrompt || '',
        scheduledDate: t.scheduledDate || '',
        scheduledTime: t.scheduledTime || '10:00'
      }));

    if (selected.length === 0) {
      setNeuroplanStatus('Выберите хотя бы одну тему для сохранения');
      return;
    }
    setIsApprovingNeuroplan(true);
    setNeuroplanStatus(null);
    try {
      const cleanUserId = currentUser?.id || currentUser?.telegramId || '16926299042';
      const targetChannel =
        channels[0]?.username || (channels[0]?.telegramId ? String(channels[0].telegramId) : '');
      const res = await fetch('/api/protalk/neuroplan/create-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: selected,
          userId: cleanUserId,
          channel: targetChannel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания публикаций');
      await onRefresh?.();
      setGeneratedTopics([]);
      setNeuroplanIdea('');
      setNeuroplanStatus(`Создано ${selected.length} публикаций с расписанием в разделе Черновики`);
      if (onNavigate) {
        onNavigate(userRedactorUrl);
      }
    } catch (e: any) {
      setNeuroplanStatus(e.message || 'Ошибка сохранения публикаций');
    } finally {
      setIsApprovingNeuroplan(false);
    }
  };

  const dayRequestsWithFallback = useMemo(() => {
    if (!fallbackPost) return dayRequests;
    if (dayRequests.some((p) => p.id === fallbackPost.id)) return dayRequests;
    return [fallbackPost, ...dayRequests];
  }, [dayRequests, fallbackPost]);

  const activePost = dayRequestsWithFallback.find((p) => p.id === activePostId);

  useEffect(() => {
    if (!activePostId) {
      setFallbackPost(null);
      setFallbackNotFound(false);
      setIsFallbackFetching(false);
      return;
    }
    if (activePost) {
      setFallbackNotFound(false);
      setIsFallbackFetching(false);
      return;
    }
    let cancelled = false;
    setIsFallbackFetching(true);
    setFallbackNotFound(false);
    const uid = currentUser?.id ? `?userId=${encodeURIComponent(currentUser.id)}` : '';
    fetch(`/api/day-requests/${encodeURIComponent(activePostId)}${uid}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found');
        return await r.json();
      })
      .then((item) => {
        if (cancelled) return;
        if (item && item.id) {
          setFallbackPost(item);
          void onRefresh?.();
        } else {
          setFallbackNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFallbackNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsFallbackFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePostId, Boolean(activePost), currentUser?.id]);

  if (activePostId && !activePost && !isCreatingPost) {
    return (
      <div className="space-y-4">
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-6 text-center space-y-4">
            {fallbackNotFound && !isFallbackFetching ? (
              <>
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <p className="text-[14px] font-bold text-slate-800">
                  Публикация не найдена в базе данных или была удалена.
                </p>
              </>
            ) : (
              <NeurosphereLoader
                variant="inline"
                label="Загрузка публикации из базы данных..."
              />
            )}
            <div className="flex justify-center">
              <ResponsiveActionBtn
                icon={<ArrowLeft size={16} />}
                label="Назад к списку постов"
                onClick={() => setActivePostId(null)}
                variant="outline"
                alwaysShowLabel={true}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Режим редактирования выбранного поста — единый компактный редактор без дублирующей шапки
  if (activePostId && activePost) {
    return (
      <Suspense fallback={<PostsSubViewFallback />}>
        <PostTelegramEditor
          dayRequests={dayRequestsWithFallback}
          templates={templates}
          channels={channels}
          currentUser={currentUser}
          onSaveDayRequest={onSaveDayRequest}
          onDeleteDayRequest={async (id) => {
            await onDeleteDayRequest(id);
            setFallbackPost(null);
            setActivePostId(null);
          }}
          onPublishToTelegram={onPublishToTelegram}
          onSaveTemplate={onSaveTemplate}
          initialDayRequestId={activePostId}
          telegramId={telegramId}
          onBackToPosts={() => setActivePostId(null)}
          onNavigate={onNavigate}
        />
      </Suspense>
    );
  }

  const activeWorkspaceTab: PostsWorkspaceTabKey =
    currentPath === userFeedUrl || currentPath === '/posts' || currentPath === '/posts16926299042'
      ? 'blog'
      : currentSubTab === 'neuroplan'
      ? 'neuroplan'
      : currentSubTab === 'scenarios'
      ? 'scenarios'
      : currentSubTab === 'crosspost'
      ? 'crosspost'
      : 'drafts';

  const handleWorkspaceNavigate = (targetPath: string) => {
    if (isNeuroplanPath(targetPath)) setLocalSubTab('neuroplan');
    else if (targetPath.startsWith('/scenarios')) setLocalSubTab('scenarios');
    else if (targetPath.startsWith('/crosspost')) setLocalSubTab('crosspost');
    else if (targetPath.includes('/redactor')) setLocalSubTab('posts');

    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
    }
  };

  const pageHeadingTitle =
    currentSubTab === 'scenarios'
      ? 'Сценарии автопостинга'
      : currentSubTab === 'crosspost'
      ? 'Кросспостинг публикаций'
      : currentSubTab === 'neuroplan'
      ? 'Нейроплан контент-выходов'
      : 'Черновики публикаций';

  return (
    <div className="space-y-5 text-left min-w-0">
      {isCreatingPost && (
        <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center p-4 bg-gradient-to-br from-sky-100/50 via-pink-100/50 via-orange-100/50 via-pink-100/50 to-sky-100/50 backdrop-blur-sm">
          <NeurosphereLoader
            variant="inline"
            label="Создание публикации в базе данных..."
          />
        </div>
      )}

      {createError && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-[14px] font-semibold text-rose-900 break-words">{createError}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-[14px] px-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Единая шапка разделов: Блог, Черновики, Нейроплан, Сценарии, Кросспостинг */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm shrink-0">
                {currentSubTab === 'neuroplan' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </span>
              <h1 className="text-[18px] sm:text-[22px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                {pageHeadingTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <AcademyHelpButton
                sectionSlug={currentSubTab === 'scenarios' ? 'automation-scenarios' : 'posts-v2-rich'}
                onNavigate={onNavigate}
              />
              {currentSubTab === 'posts' && (
                <ResponsiveActionBtn
                  icon={<Plus size={18} />}
                  label="Создать новый пост"
                  onClick={handleCreateNewPost}
                  variant="vivid"
                />
              )}
            </div>
          </div>

          <PostsWorkspaceNav
            activeTab={activeWorkspaceTab}
            userId={String(userProfilePostsId)}
            onNavigate={handleWorkspaceNavigate}
          />
        </div>
      </div>

      {currentSubTab === 'scenarios' && (
        <Suspense fallback={<PostsSubViewFallback />}>
          <ScenariosPage
            currentUser={currentUser}
            channels={channels}
            onRefreshPosts={onRefresh}
          />
        </Suspense>
      )}

      {currentSubTab === 'crosspost' && (
        <Suspense fallback={<PostsSubViewFallback />}>
          <FreeCrosspostingView channels={channels} currentUser={currentUser} />
        </Suspense>
      )}

      {currentSubTab === 'neuroplan' && (
        <div className="space-y-4 min-w-0">
          <NeuroplanGeneratorSection
            hasRazgonAccess={hasRazgonAccess}
            neuroplanIdea={neuroplanIdea}
            onChangeNeuroplanIdea={setNeuroplanIdea}
            isGeneratingNeuroplan={isGeneratingNeuroplan}
            onGenerateTopics={handleGenerateNeuroplanTopics}
            generatedTopics={generatedTopics}
            onChangeGeneratedTopics={setGeneratedTopics}
            isApprovingNeuroplan={isApprovingNeuroplan}
            onApproveDrafts={handleApproveNeuroplanDrafts}
            onCancel={() => handleWorkspaceNavigate(userRedactorUrl)}
            neuroplanStatus={neuroplanStatus}
          />
        </div>
      )}

      {currentSubTab === 'posts' && (
        <div className="space-y-4 min-w-0">
          <PostsCardsAndTableList
            processedPosts={processedPosts}
            channels={channels}
            uniqueTopics={uniqueTopics}
            searchQuery={searchQuery}
            onChangeSearchQuery={setSearchQuery}
            selectedTopic={selectedTopic}
            onChangeSelectedTopic={setSelectedTopic}
            formatFilter={formatFilter}
            onChangeFormatFilter={setFormatFilter}
            scheduleFilter={scheduleFilter}
            onChangeScheduleFilter={setScheduleFilter}
            statusFilter={statusFilter}
            onChangeStatusFilter={setStatusFilter}
            statusCounts={statusCounts}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            onCreateNewPost={handleCreateNewPost}
            onSelectPost={(id) => setActivePostId(id)}
            postToCopy={postToCopy}
            onChangePostToCopy={setPostToCopy}
            isCopying={isCopying}
            onConfirmCopy={handleConfirmCopy}
            postToDelete={postToDelete}
            onChangePostToDelete={setPostToDelete}
            isDeleting={isDeleting}
            onConfirmDelete={handleConfirmDelete}
          />
        </div>
      )}

      <TariffGateModal
        isOpen={isNeuroplanGateOpen}
        onClose={() => setIsNeuroplanGateOpen(false)}
        requiredTariff="Разгон"
        featureTitle="Нейроплан (15 постов наперед)"
        description="Генерация контент-плана на 15 дней вперед по вашей теме с готовыми текстами, датами выходов и русскими промптами для обложек доступна с тарифа Разгон."
      />
    </div>
  );
}
