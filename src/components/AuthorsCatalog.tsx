import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserMinus, MessageSquare, Users, ChevronLeft, ChevronRight, Sparkles, FileText } from 'lucide-react';
import { UserAccount } from '../types';
import { formatUserOnlineStatus } from '../utils/userStatus';

interface AuthorItem {
  id: string;
  telegramId?: number;
  name: string;
  username: string;
  email?: string;
  avatar: string;
  role: string;
  bio: string;
  city?: string;
  last_seen?: string | null;
  lastSeen?: string | null;
  postsCount: number;
  subscribersCount: number;
  isSubscribed: boolean;
}

interface AuthorsCatalogProps {
  currentUser: UserAccount;
  onNavigateToChat?: (partnerId: string) => void;
}

export default function AuthorsCatalog({ currentUser, onNavigateToChat }: AuthorsCatalogProps) {
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(50); // 20, 50, 200, 0 (all)
  const [subFilter, setSubFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [warningModalAuthor, setWarningModalAuthor] = useState<AuthorItem | null>(null);

  const currentUserId = String(currentUser.id || currentUser.telegramId || '16926299042');

  const fetchAuthors = async (q: string, p: number, l: number, filter: 'all' | 'subscribed' | 'unsubscribed') => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/authors/catalog?q=${encodeURIComponent(q)}&page=${p}&limit=${l}&currentUserId=${encodeURIComponent(currentUserId)}&filter=${encodeURIComponent(filter)}`
      );
      const data = await res.json();
      if (data.success) {
        setAuthors(data.authors || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching authors catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuthors(searchQuery, page, limit, subFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, page, limit, subFilter]);

  const handleToggleSubscribe = async (author: AuthorItem) => {
    if (subscribingId === author.id) return;
    setSubscribingId(author.id);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: currentUserId,
          targetId: author.id,
          targetTelegramId: author.telegramId,
          targetName: author.name,
          targetUsername: author.username,
          targetAvatar: author.avatar,
          action: author.isSubscribed ? 'unsubscribe' : 'subscribe'
        })
      });
      const data = await res.json();
      if (data.success) {
        const newIsSubscribed = typeof data.isSubscribed === 'boolean' ? data.isSubscribed : !author.isSubscribed;
        const realCount = typeof data.subscribersCount === 'number'
          ? data.subscribersCount
          : (newIsSubscribed ? author.subscribersCount + 1 : Math.max(0, author.subscribersCount - 1));
        setAuthors(prev =>
          prev.map(a =>
            a.id === author.id
              ? { 
                  ...a, 
                  isSubscribed: newIsSubscribed, 
                  subscribersCount: realCount 
                }
              : a
          )
        );
      }
    } catch (err) {
      console.error('Error subscribing to author:', err);
    } finally {
      setSubscribingId(null);
    }
  };

  const handleOpenDirectChat = async (author: AuthorItem) => {
    if (!author.isSubscribed) {
      setWarningModalAuthor(author);
      return;
    }
    try {
      const res = await fetch('/api/user/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          partnerId: author.id,
          partnerName: author.name,
          partnerUsername: author.username,
          partnerAvatar: author.avatar
        })
      });
      const data = await res.json();
      const targetChatId = data?.chat?.id || author.id;
      
      if (onNavigateToChat) {
        onNavigateToChat(targetChatId);
      } else {
        window.history.pushState(null, '', `/social/messages/${targetChatId}`);
        window.dispatchEvent(new Event('popstate'));
      }
    } catch (err) {
      console.error('Error opening chat with author:', err);
      window.history.pushState(null, '', `/social/messages/${author.id}`);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner and Search Bar Card */}
      <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-pink-300 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Каталог авторов
              </h2>
            </div>
            <p className="text-sm text-slate-700 mt-1 font-medium">
              Поиск и подписка на соавторов сообщества ИИSMM. Всего авторов: <strong className="text-slate-900 font-bold">{total}</strong>
            </p>
          </div>

          {/* Display limit selector: 20, 50, 200, Все */}
          <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-sm p-1.5 rounded-2xl border border-pink-200 shadow-xs">
            <span className="text-sm font-bold text-slate-700 px-2">Показывать по:</span>
            {[
              { label: '20', value: 20 },
              { label: '50', value: 50 },
              { label: '200', value: 200 },
              { label: 'Все', value: 0 }
            ].map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setLimit(opt.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  limit === opt.value
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-pink-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="mt-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-500" />
          <input
            id="authors-catalog-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск авторов по имени, логину, городу или ID..."
            className="w-full bg-white/90 backdrop-blur-sm border border-pink-300 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-xs"
          />
        </div>

        {/* Subscription Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Все авторы', icon: Users },
            { id: 'subscribed', label: 'Мои подписки', icon: UserMinus },
            { id: 'unsubscribed', label: 'Не подписан', icon: UserPlus }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = subFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSubFilter(tab.id as any);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border border-white/30 shadow-md'
                    : 'bg-white/85 hover:bg-white text-slate-700 border border-pink-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-pink-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Authors Grid / List */}
      {loading ? (
        <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-12 border border-pink-300 shadow-md text-center">
          <div className="inline-block w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-800">Загрузка авторов...</p>
        </div>
      ) : authors.length === 0 ? (
        <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-12 border border-pink-300 shadow-md text-center">
          <Users className="w-10 h-10 text-pink-400 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-900">Авторы не найдены</p>
          <p className="text-sm text-slate-600 mt-1">Попробуйте изменить поисковый запрос</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author) => {
            const isMe = author.id === currentUserId || (author.telegramId && String(author.telegramId) === currentUserId);
            return (
              <div
                key={author.id}
                className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-4 border border-pink-300 shadow-md flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={author.avatar}
                        alt={author.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-pink-300 shadow-xs"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-sky-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          const identifier = author.id;
                          window.history.pushState(null, '', `/social/${identifier}`);
                          window.dispatchEvent(new Event('popstate'));
                        }}
                        className="text-left font-bold text-slate-900 text-sm hover:text-pink-600 transition-colors truncate block max-w-full cursor-pointer"
                        title="Открыть профиль соавтора"
                      >
                        {author.name}
                      </button>
                      <p className="text-sm text-slate-600 font-mono truncate">
                        {author.username}
                      </p>
                      {(() => {
                        const status = formatUserOnlineStatus(author.last_seen || author.lastSeen);
                        return (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${status.isOnline ? 'bg-sky-500' : 'bg-slate-300'}`} />
                            <span className={`text-[12px] font-medium truncate ${status.isOnline ? 'text-sky-700 font-semibold' : 'text-slate-500'}`}>
                              {status.text}
                            </span>
                          </div>
                        );
                      })()}
                      {author.city && (
                        <p className="text-sm text-slate-600 truncate mt-0.5">
                          📍 {author.city}
                        </p>
                      )}

                      {/* Mobile action icons transferred under name on the right */}
                      {!isMe && (
                        <div className="flex sm:hidden items-center justify-end gap-2 mt-2">
                          {author.isSubscribed ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDirectChat(author)}
                                className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border border-white/20 active:scale-95 transition-all cursor-pointer"
                                title="Чат"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={subscribingId === author.id}
                                onClick={() => handleToggleSubscribe(author)}
                                className="p-2 rounded-xl bg-white text-pink-600 border border-pink-300 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                title="Отписаться"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={subscribingId === author.id}
                              onClick={() => handleToggleSubscribe(author)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border border-white/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-sm font-bold"
                              title="Подписаться"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>Подписаться</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {author.bio && (
                    <p className="text-sm text-slate-700 mt-3 line-clamp-2 font-normal">
                      {author.bio}
                    </p>
                  )}

                  {/* Stats: Posts & Subscribers */}
                  <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-pink-200 text-sm text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-pink-500" />
                      Публикаций: <strong className="text-slate-900 font-bold">{author.postsCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                      Подписчиков: <strong className="text-slate-900 font-bold">{author.subscribersCount}</strong>
                    </span>
                  </div>
                </div>

                {/* Actions: Desktop view */}
                <div className="mt-4 pt-2 hidden sm:block">
                  {isMe ? (
                    <span className="inline-block text-sm font-bold text-slate-600 py-1.5">
                      Это ваш профиль
                    </span>
                  ) : author.isSubscribed ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDirectChat(author)}
                        className="flex-1 py-2 px-3 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-md border border-white/20 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        title="Перейти в чат"
                      >
                        <MessageSquare className="w-4 h-4 text-white" />
                        <span>Чат</span>
                      </button>
                      <button
                        type="button"
                        disabled={subscribingId === author.id}
                        onClick={() => handleToggleSubscribe(author)}
                        className="py-2 px-3 rounded-xl text-sm font-bold bg-white text-pink-600 border border-pink-300 hover:bg-pink-50 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Отписаться от соавтора"
                      >
                        <UserMinus className="w-4 h-4 text-pink-600" />
                        <span>Отписаться</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={subscribingId === author.id}
                        onClick={() => handleToggleSubscribe(author)}
                        className="w-full py-2 px-3 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-md border border-white/20 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        title="Подписаться на соавтора"
                      >
                        <UserPlus className="w-4 h-4 text-white" />
                        <span>{subscribingId === author.id ? 'Подписка...' : 'Подписаться'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls (when limit > 0) */}
      {limit > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-3 border border-pink-300 shadow-md">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-2 rounded-xl bg-white/90 text-slate-800 hover:bg-white border border-pink-200 disabled:opacity-40 cursor-pointer shadow-xs"
            title="Предыдущая страница"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-slate-800 px-3">
            Страница <strong className="text-pink-600">{page}</strong> из {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="p-2 rounded-xl bg-white/90 text-slate-800 hover:bg-white border border-pink-200 disabled:opacity-40 cursor-pointer shadow-xs"
            title="Следующая страница"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Warning Modal: Chat only available after subscription */}
      {warningModalAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-3xl p-6 border border-pink-300 shadow-xl space-y-4 text-left">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
                <MessageSquare className="w-5 h-5 text-white" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Чат доступен после подписки</h3>
                <p className="text-sm text-slate-600 font-medium">Для начала диалога необходимо подписаться</p>
              </div>
            </div>

            <div className="p-3 bg-white/80 rounded-2xl border border-pink-200 flex items-center gap-3">
              <img src={warningModalAuthor.avatar} alt={warningModalAuthor.name} className="w-11 h-11 rounded-full object-cover border-2 border-pink-300" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm truncate">{warningModalAuthor.name}</p>
                <p className="text-sm font-mono text-slate-600 truncate">{warningModalAuthor.username}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed font-normal">
              Чтобы начать переписку в чате с соавтором, сначала оформите подписку на его профиль.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const targetAuthor = warningModalAuthor;
                  setWarningModalAuthor(null);
                  await handleToggleSubscribe(targetAuthor);
                  handleOpenDirectChat({ ...targetAuthor, isSubscribed: true });
                }}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-md border border-white/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer text-center"
              >
                Подписаться и открыть чат
              </button>
              <button
                type="button"
                onClick={() => setWarningModalAuthor(null)}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-sm font-bold bg-white text-slate-700 border border-pink-200 hover:bg-pink-50/50 shadow-xs cursor-pointer text-center"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
