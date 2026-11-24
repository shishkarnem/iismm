import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  Globe,
  Plus,
  Search,
  Share2,
  TrendingUp,
  User as UserIcon
} from 'lucide-react';
import { BlogPostData, PostCardRenderer } from '../components/PostCardRenderer';
import { getOrCreateGuestUser } from '../utils/guestUser';
import { AcademyHelpButton } from '../components/academy/AcademyHelpModal';
import { GradientSelect } from '../components/ui-kit/GradientDropdown';
import { PostsWorkspaceNav } from '../components/posts-list/PostsWorkspaceNav';
import { NeurosphereLoader } from '../components/loaders/NeurosphereLoader';

interface PublicBlogPostsPageProps {
  currentUser?: any;
  currentPath: string;
  onNavigate: (path: string) => void;
  onRequireAuth?: () => void;
  isCabinetView?: boolean;
}

export const PublicBlogPostsPage: React.FC<PublicBlogPostsPageProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onRequireAuth,
  isCabinetView
}) => {
  const isCabinet =
    isCabinetView !== undefined
      ? isCabinetView
      : Boolean(currentUser?.id && currentPath && currentPath !== '/posts' && currentPath !== '/blog');

  const userPostsId = currentUser?.id || currentUser?.telegramId || '16926299042';
  const userFeedUrl = `/posts${userPostsId}`;
  const userDraftsUrl = `/posts${userPostsId}/redactor`;

  const [activeTab, setActiveTab] = useState<'recommendations' | 'yours' | 'new'>('recommendations');
  const [posts, setPosts] = useState<BlogPostData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedCategory] = useState<string>('all');

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('page', String(page));
      params.set('limit', '12');
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      const effectiveUid = currentUser?.id || getOrCreateGuestUser().id;
      if (effectiveUid) {
        params.set('userId', effectiveUid);
      }

      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(`/api/blog/posts?${params.toString()}`);
          if (res && res.ok) break;
        } catch (fetchErr) {
          if (attempt === 3) throw fetchErr;
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!res || !res.ok) return;
      const data = await res.json();

      if (data.success && Array.isArray(data.posts)) {
        let loadedPosts: BlogPostData[] = data.posts;
        if (selectedCategory !== 'all') {
          loadedPosts = loadedPosts.filter(
            (p) => p.category === selectedCategory || p.format === selectedCategory
          );
        }
        setPosts(loadedPosts);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || loadedPosts.length);
      }
    } catch (e) {
      console.error('Ошибка загрузки постов:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, selectedCategory]);

  useEffect(() => {
    fetchPosts();
  }, [activeTab, page, searchQuery, selectedCategory]);

  const handlePostUpdated = (updated: BlogPostData) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePostDeleted = (deletedPostId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

  const navSectionOptions = [
    { value: 'feed', label: 'Лента и блог', icon: <Globe className="w-4 h-4" /> },
    { value: 'drafts', label: 'Черновики и нейроплан', icon: <FileText className="w-4 h-4" /> },
    { value: 'scenarios', label: 'Сценарии автопостинга', icon: <Cpu className="w-4 h-4" /> },
    { value: 'crosspost', label: 'Кросспостинг', icon: <Share2 className="w-4 h-4" /> }
  ];

  const handleCabinetNavChange = (val: string) => {
    if (val === 'feed') onNavigate(userFeedUrl);
    else if (val === 'drafts') onNavigate(userDraftsUrl);
    else if (val === 'scenarios') onNavigate('/scenarios');
    else if (val === 'crosspost') onNavigate('/crosspost');
  };

  const feedTabOptions = [
    { value: 'recommendations', label: 'Рекомендации', icon: <TrendingUp className="w-4 h-4" /> },
    ...(isCabinet
      ? [{ value: 'yours', label: 'Ваши публикации', icon: <UserIcon className="w-4 h-4" /> }]
      : []),
    { value: 'new', label: 'Новые публикации', icon: <Clock className="w-4 h-4" /> }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 font-sans min-w-0">
      {/* Шапка раздела с фирменным прозрачным градиентом */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="p-4 sm:p-6 rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-[18px] sm:text-[22px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                Публикации и блог
              </h1>
            </div>

            <AcademyHelpButton
              sectionSlug="posts-v2-rich"
              onNavigate={onNavigate}
              showLabelOnDesktop={true}
              label="Академия"
            />
          </div>

          {isCabinet && (
            <PostsWorkspaceNav
              activeTab="blog"
              userId={currentUser?.id || '16926299042'}
              onNavigate={onNavigate}
            />
          )}

          {/* Переключатель ленты: вертикальный выпадающий список на мобильных, кнопки на десктопе */}
          <div className="sm:hidden">
            <GradientSelect
              value={activeTab}
              onChange={(val) => {
                if (val === 'yours' && !currentUser?.id) {
                  onRequireAuth?.();
                  return;
                }
                setActiveTab(val as 'recommendations' | 'yours' | 'new');
              }}
              options={feedTabOptions}
            />
          </div>

          <div
            className={`hidden sm:grid ${
              isCabinet ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-200`}
          >
            <button
              type="button"
              id="tab-recommendations"
              onClick={() => setActiveTab('recommendations')}
              className={`py-2.5 px-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'recommendations'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs'
                  : 'text-slate-800 hover:bg-white/70'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Рекомендации</span>
            </button>

            {isCabinet && (
              <button
                type="button"
                id="tab-yours"
                onClick={() => {
                  if (!currentUser?.id) {
                    onRequireAuth?.();
                    return;
                  }
                  setActiveTab('yours');
                }}
                className={`py-2.5 px-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  activeTab === 'yours'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs'
                    : 'text-slate-800 hover:bg-white/70'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Ваши</span>
              </button>
            )}

            <button
              type="button"
              id="tab-new"
              onClick={() => setActiveTab('new')}
              className={`py-2.5 px-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs'
                  : 'text-slate-800 hover:bg-white/70'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Новые</span>
            </button>
          </div>

          <div className="w-full">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-pink-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="search-posts-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию, автору или тегу..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/80 border border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 text-[14px] text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Лента публикаций */}
      {loading ? (
        <div className="p-6 text-center rounded-3xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300">
          <NeurosphereLoader variant="inline" label="Загрузка публикаций..." />
        </div>
      ) : activeTab === 'yours' && !currentUser?.id ? (
        <div className="p-8 md:p-12 text-center rounded-3xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/85 border border-pink-300 flex items-center justify-center mx-auto text-pink-600 shadow-xs">
            <UserIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              Раздел «Ваши публикации» доступен зарегистрированным пользователям
            </h3>
            <p className="text-[14px] text-slate-700 max-w-md mx-auto">
              Войдите в аккаунт, чтобы просматривать свои черновики, опубликованные статьи и управлять постами.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRequireAuth?.()}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-90 transition-all cursor-pointer inline-flex items-center space-x-2"
          >
            <span>Войти в аккаунт</span>
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-8 md:p-12 text-center rounded-3xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/85 border border-pink-300 flex items-center justify-center mx-auto text-pink-600">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {activeTab === 'yours' ? 'У вас пока нет опубликованных постов' : 'Публикации не найдены'}
            </h3>
            <p className="text-[14px] text-slate-700 max-w-md mx-auto">
              {activeTab === 'yours'
                ? 'Создайте публикацию в редакторе и отметьте дублирование в ленту профиля соцсети, чтобы она появилась в вашем блоге.'
                : 'Попробуйте изменить поисковый запрос или перейдите к списку черновиков для создания публикации.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!currentUser?.id) {
                onRequireAuth?.();
                return;
              }
              onNavigate(userDraftsUrl);
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs cursor-pointer inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Открыть черновики постов</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCardRenderer
              key={post.id}
              post={post}
              currentUser={currentUser}
              isSingleView={false}
              onNavigate={onNavigate}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onRequireAuth={onRequireAuth}
            />
          ))}

          {totalPages > 1 && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 flex items-center justify-between gap-2">
              <button
                type="button"
                id="pagination-prev"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад</span>
              </button>

              <span className="text-[14px] font-semibold text-slate-800 text-center">
                Страница {page} из {totalPages} ({totalCount})
              </span>

              <button
                type="button"
                id="pagination-next"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Вперед</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicBlogPostsPage;
