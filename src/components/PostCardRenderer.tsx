import React, { useState, useEffect, useRef } from 'react';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { stripDuplicateTitleFromPostContent } from '../utils/formatting/postTitleAndTagHelpers';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  Send, 
  Paperclip, 
  Volume2, 
  Film, 
  Video, 
  Sparkles, 
  Copy, 
  Check, 
  CornerDownRight, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Lock
} from 'lucide-react';
import { TelegramAlbumCollage } from './TelegramAlbumCollage';
import MarkdownRenderer, { renderV2Mode, getInlineButtonStyleClasses } from './MarkdownRenderer';
import { motion, AnimatePresence } from 'motion/react';
import EditPostModal from './EditPostModal';
import RepostModal from './RepostModal';
import ModerationAlertModal from './ModerationAlertModal';
import AudioField from './AudioField';
import GradientAudioPlayer from './GradientAudioPlayer';
import { getOrCreateGuestUser, updateGuestUserName } from '../utils/guestUser';
import { canUseOtryv, hasRainbowHeart } from '../utils/tariff/tariffUtils';
import { TariffGateModal } from './tariffs/TariffGateBanner';

export interface BlogPostComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorName: string;
  authorAvatar?: string;
  authorUserId?: string;
  authorUsername?: string;
  text: string;
  audioUrl?: string;
  audio_url?: string;
  createdAt: string;
  replies?: BlogPostComment[];
}

export interface BlogPostData {
  id: string;
  sourcePostId?: string;
  slug?: string;
  userId?: string;
  title: string;
  desc?: string;
  content: string;
  category?: string;
  tag?: string;
  format?: 'article' | 'video' | 'gallery' | 'photo';
  attachmentType?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: Array<Array<{ text: string; url?: string; style?: string; callback_data?: string }>>;
  messageFormat?: 'v2' | 'rich';
  image?: string;
  album?: Array<{ id: string; url: string; caption?: string }>;
  date?: string;
  dateStr?: string;
  readTime?: string;
  views?: number;
  likes?: number;
  shares?: number;
  sharesCount?: number;
  reactions?: { [key: string]: number };
  myReaction?: string;
  commentsCount?: number;
  isPromoted?: boolean;
  promotedAt?: string | null;
  signature?: string;
  author?: {
    name: string;
    role?: string;
    tariff?: string;
    hasRainbowHeart?: boolean;
    avatar?: string;
    telegramId?: number;
    id?: string;
  };
}

interface PostCardRendererProps {
  post: BlogPostData;
  currentUser?: any;
  isSingleView?: boolean;
  onNavigate?: (path: string) => void;
  onPostUpdated?: (updated: BlogPostData) => void;
  onPostDeleted?: (postId: string) => void;
  onEditInRedactor?: (postId: string) => void;
  onRequireAuth?: (reason?: string) => void;
}

const REACTION_CONFIG: Array<{ key: string; emoji: string; label: string }> = [
  { key: 'like', emoji: '👍', label: 'Нравится' },
  { key: 'love', emoji: '❤️', label: 'Супер' },
  { key: 'fire', emoji: '🔥', label: 'Огонь' },
  { key: 'haha', emoji: '😂', label: 'Ха-ха' },
  { key: 'wow', emoji: '😮', label: 'Вау' },
];

export const PostCardRenderer: React.FC<PostCardRendererProps> = ({
  post,
  currentUser,
  isSingleView = false,
  onNavigate,
  onPostUpdated,
  onPostDeleted,
  onEditInRedactor,
  onRequireAuth
}) => {
  const [reactions, setReactions] = useState<{ [key: string]: number }>(post.reactions || { like: post.likes || 0 });
  const [myReaction, setMyReaction] = useState<string | undefined>(post.myReaction);
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [viewsCount, setViewsCount] = useState<number>(post.views || 0);
  const [sharesCount, setSharesCount] = useState<number>((post as any).shares || post.sharesCount || 0);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [isPromoted, setIsPromoted] = useState<boolean>(Boolean(post.isPromoted || (post as any).is_promoted));
  const [isPromoting, setIsPromoting] = useState<boolean>(false);
  const [isPromoteGateOpen, setIsPromoteGateOpen] = useState<boolean>(false);
  const [promoteFeedback, setPromoteFeedback] = useState<string | null>(null);

  const hasOtryvAccess = canUseOtryv(currentUser?.tariff, currentUser?.role);
  const showAuthorRainbowHeart = Boolean(
    post.author?.hasRainbowHeart || hasRainbowHeart(post.author?.tariff, post.author?.role)
  );

  const postRef = useRef<HTMLElement>(null);
  const hasViewedRef = useRef<boolean>(false);

  // Real View Counting via IntersectionObserver (persists to PostgreSQL database)
  useEffect(() => {
    if (isSingleView) {
      // In single view, increment view once per session
      const singleKey = `viewed_single_${post.id}`;
      if (!sessionStorage.getItem(singleKey)) {
        sessionStorage.setItem(singleKey, '1');
        fetch(`/api/blog/posts/${post.id}/view`, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success && typeof data.views === 'number') {
              setViewsCount(data.views);
            }
          })
          .catch(() => null);
      }
      return;
    }

    const sessionKey = `viewed_feed_${post.id}`;
    if (sessionStorage.getItem(sessionKey)) {
      hasViewedRef.current = true;
      return;
    }

    const el = postRef.current;
    if (!el) return;

    let viewTimeout: any = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasViewedRef.current) {
            // Must dwell on post in feed for at least 500ms to count as real view
            viewTimeout = setTimeout(async () => {
              if (hasViewedRef.current) return;
              hasViewedRef.current = true;
              try {
                sessionStorage.setItem(sessionKey, '1');
                const res = await fetch(`/api/blog/posts/${post.id}/view`, { method: 'POST' });
                const data = await res.json();
                if (data.success && typeof data.views === 'number') {
                  setViewsCount(data.views);
                } else {
                  setViewsCount(prev => prev + 1);
                }
              } catch (e) {
                setViewsCount(prev => prev + 1);
              }
            }, 500);
          } else {
            if (viewTimeout) clearTimeout(viewTimeout);
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(el);

    return () => {
      if (viewTimeout) clearTimeout(viewTimeout);
      observer.disconnect();
    };
  }, [post.id, isSingleView]);

  // Update views/shares if post prop changes
  useEffect(() => {
    if (typeof post.views === 'number' && post.views > viewsCount) {
      setViewsCount(post.views);
    }
    const propShares = (post as any).shares || post.sharesCount;
    if (typeof propShares === 'number') {
      setSharesCount(propShares);
    }
    setIsPromoted(Boolean(post.isPromoted || (post as any).is_promoted));
  }, [post.views, (post as any).shares, post.sharesCount, post.isPromoted, (post as any).is_promoted]);

  const handleTogglePromote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      onRequireAuth?.('Для продвижения поста в топ ленты войдите в аккаунт');
      return;
    }
    if (!hasOtryvAccess) {
      setIsPromoteGateOpen(true);
      return;
    }
    setIsPromoting(true);
    setPromoteFeedback(null);
    try {
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(post.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: String(currentUser.id),
          promoted: !isPromoted
        })
      });
      const data = await res.json();
      if (res.status === 403 && data?.requiredTariff) {
        setIsPromoteGateOpen(true);
        return;
      }
      if (!res.ok || !data?.success) {
        setPromoteFeedback(data?.error || 'Не удалось обновить статус продвижения');
        return;
      }
      const nextVal = Boolean(data.isPromoted);
      setIsPromoted(nextVal);
      setPromoteFeedback(data.message || (nextVal ? 'Пост выведен в топ ленты!' : 'Продвижение отключено.'));
      onPostUpdated?.({ ...post, isPromoted: nextVal });
      setTimeout(() => setPromoteFeedback(null), 4000);
    } catch {
      setPromoteFeedback('Сетевая ошибка при изменении продвижения поста');
    } finally {
      setIsPromoting(false);
    }
  };

  // Comments state
  const [showComments, setShowComments] = useState<boolean>(isSingleView);
  const [comments, setComments] = useState<BlogPostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [guestName, setGuestName] = useState<string>(() => {
    try {
      const g = getOrCreateGuestUser();
      return g.name || '';
    } catch (e) {
      return '';
    }
  });
  const [commentAudioUrl, setCommentAudioUrl] = useState<string>('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);

  // Moderation Alert Modal state
  const [moderationAlert, setModerationAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'comment' | 'review' | 'general';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'comment'
  });

  // Check subscription status
  useEffect(() => {
    if (currentUser?.id && post?.userId && String(currentUser.id) !== String(post.userId)) {
      fetch(`/api/subscriptions/check?followerId=${encodeURIComponent(String(currentUser.id))}&targetId=${encodeURIComponent(String(post.userId))}`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.isSubscribed === 'boolean') {
            setIsSubscribed(data.isSubscribed);
          }
        })
        .catch(() => null);
    }
  }, [currentUser?.id, post?.userId]);

  const handleToggleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    setIsSubscribing(true);
    try {
      if (isSubscribed) {
        await fetch(`/api/subscriptions?followerId=${encodeURIComponent(String(currentUser.id))}&targetId=${encodeURIComponent(String(post.userId))}`, {
          method: 'DELETE'
        });
        setIsSubscribed(false);
      } else {
        await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: String(currentUser.id),
            targetId: String(post.userId),
            targetName: post.author?.name,
            targetUsername: (post as any).authorUsername,
            targetAvatar: post.author?.avatar
          })
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Subscription error:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const cleanAuthorName = (name?: string): string => {
    if (!name) return 'Команда ИИSMM';
    let cleaned = name.trim();
    cleaned = cleaned.replace(/Dr\.White\s+SAV\s+AI\s+SAV\s+AI/gi, 'Dr.White SAV AI');
    cleaned = cleaned.replace(/SAV\s+AI\s+SAV\s+AI/gi, 'SAV AI');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const deduped: string[] = [];
      tokens.forEach(tok => {
        if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== tok.toLowerCase()) {
          deduped.push(tok);
        }
      });
      cleaned = deduped.join(' ');
    }
    return cleaned || 'Команда ИИSMM';
  };

  const postSlugOrId = post.slug || post.id;
  const postUrl = `/posts/${postSlugOrId}`;

  // Load comments when opened
  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/blog/posts/${postSlugOrId}/comments`);
      const data = await res.json();
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments);
      }
    } catch (e) {
      console.error('Ошибка загрузки комментариев:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  // Auto-load comments on single post view
  useEffect(() => {
    if (isSingleView) {
      loadComments();
    }
  }, [isSingleView, postSlugOrId]);

  // Auto-scroll and highlight comment if linked via hash #comment-...
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      if (hash.startsWith('#comment-')) {
        setShowComments(true);
        if (comments.length === 0) {
          loadComments();
        }
        const timer = setTimeout(() => {
          const targetId = hash.replace('#', '');
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-pink-400');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-pink-400');
            }, 3000);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [comments.length]);

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(prev => !prev);
  };

  // Reactions toggle (supports registered and guest users without registration)
  const handleReaction = async (reactionType: string) => {
    if (isReacting) return;
    setIsReacting(true);

    const guestUser = getOrCreateGuestUser();
    const effectiveUserId = currentUser?.id ? String(currentUser.id) : guestUser.id;

    // Optimistic update
    const previousReaction = myReaction;
    const isRemoving = previousReaction === reactionType;
    const newReaction = isRemoving ? undefined : reactionType;
    
    setReactions(prev => {
      const copy = { ...prev };
      if (previousReaction && copy[previousReaction]) {
        copy[previousReaction] = Math.max(0, copy[previousReaction] - 1);
      }
      if (!isRemoving) {
        copy[reactionType] = (copy[reactionType] || 0) + 1;
      }
      return copy;
    });
    setMyReaction(newReaction);

    try {
      const res = await fetch(`/api/blog/posts/${postSlugOrId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactionType,
          userId: effectiveUserId
        })
      });
      const data = await res.json();
      if (data.success) {
        setReactions(data.counts || {});
        setMyReaction(data.myReaction || undefined);
        if (onPostUpdated) {
          onPostUpdated({
            ...post,
            reactions: data.counts,
            myReaction: data.myReaction,
            likes: data.totalLikes
          });
        }
      }
    } catch (e) {
      console.error('Ошибка реакции:', e);
      // Revert optimistic update
      setMyReaction(previousReaction);
    } finally {
      setIsReacting(false);
    }
  };

  // Submit comment (Registered or Guest with AI Moderation and Voice support)
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const guestUser = getOrCreateGuestUser();
    const effectiveAuthorName = currentUser?.name || currentUser?.telegramUsername || guestName.trim() || guestUser.name;
    if (!effectiveAuthorName) {
      setModerationAlert({
        isOpen: true,
        title: 'Укажите ваше имя',
        message: 'Пожалуйста, укажите ваше имя, чтобы опубликовать комментарий.',
        type: 'comment'
      });
      return;
    }

    if (!newCommentText.trim() && !commentAudioUrl) return;

    setIsSubmittingComment(true);
    const authorAvatar = currentUser?.avatarUrl || undefined;
    const authorUserId = currentUser?.id ? String(currentUser.id) : guestUser.id;
    const authorUsername = currentUser?.telegramUsername || undefined;

    try {
      const res = await fetch(`/api/blog/posts/${postSlugOrId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newCommentText.trim() || '🎤 Голосовой комментарий',
          authorName: effectiveAuthorName,
          authorAvatar,
          authorUserId,
          authorUsername,
          parentCommentId: replyingToCommentId,
          audioUrl: commentAudioUrl || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setModerationAlert({
          isOpen: true,
          title: 'Комментарий отклонен модерацией нейросети',
          message: data.error || data.reason || 'Нейросеть (Функция 763) отклонила публикацию комментария: обнаружены недопустимые выражения или нарушения правил сообщества.',
          type: 'comment'
        });
        return;
      }
      if (data.success && data.comment) {
        setComments(prev => [...prev, data.comment]);
        setNewCommentText('');
        setCommentAudioUrl('');
        setReplyingToCommentId(null);
        try {
          if (!currentUser?.id && effectiveAuthorName) {
            updateGuestUserName(effectiveAuthorName);
          }
        } catch (e) {}
        if (onPostUpdated) {
          onPostUpdated({
            ...post,
            commentsCount: (post.commentsCount || 0) + 1
          });
        }
      }
    } catch (e: any) {
      console.error('Ошибка добавления комментария:', e);
      setModerationAlert({
        isOpen: true,
        title: 'Ошибка отправки комментария',
        message: e?.message || 'Сетевая ошибка при отправке комментария. Попробуйте еще раз.',
        type: 'comment'
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Copy post link
  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/posts/${postSlugOrId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Extract attachment details
  const effectiveAttachmentType = post.attachmentType || (post.format === 'video' ? 'video' : (post.format === 'gallery' ? 'album' : (post.image ? 'photo' : 'none')));
  const effectiveAttachmentUrl = post.attachmentUrl || post.image;
  const effectiveAttachmentUrls = post.attachmentUrls || (post.album ? post.album.map(a => a.url) : (effectiveAttachmentUrl ? [effectiveAttachmentUrl] : []));

  // Total reactions count
  const totalReactionsCount = Object.values(reactions).reduce<number>((a, b) => a + Number(b || 0), 0);

  // Group comments into root and replies
  const rootComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentCommentId === parentId);

  // Determine if current user is the author or admin
  const isAuthor = Boolean(
    currentUser && (
      (post.userId && (String(post.userId) === String(currentUser.id) || String(post.userId) === String(currentUser.telegramId))) ||
      (currentUser.role === 'admin') ||
      (post.author?.name && (
        post.author.name === currentUser.name || 
        post.author.name === currentUser.firstName || 
        (currentUser.telegramUsername && post.author.name === currentUser.telegramUsername) ||
        (currentUser.username && post.author.name === currentUser.username)
      )) ||
      (post.author?.id && (String(post.author.id) === String(currentUser.id) || String(post.author.id) === String(currentUser.telegramId))) ||
      (post.author?.telegramId && (String(post.author.telegramId) === String(currentUser.telegramId) || String(post.author.telegramId) === String(currentUser.id)))
    )
  );

  // Author identifier for profile navigation
  const authorIdentifier = post.author?.telegramId || post.author?.id || post.userId || (post.author?.name ? encodeURIComponent(post.author.name) : '');
  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }
    if (authorIdentifier) {
      const p = `/social/${authorIdentifier}`;
      if (onNavigate) {
        onNavigate(p);
      } else {
        window.history.pushState(null, '', p);
        window.dispatchEvent(new Event('popstate'));
      }
    }
  };

  // Delete post handler
  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/blog/posts/${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setIsDeleteModalOpen(false);
        if (onPostDeleted) {
          onPostDeleted(post.id);
        }
      } else {
        setModerationAlert({
          isOpen: true,
          title: 'Ошибка удаления публикации',
          message: data.error || 'Не удалось удалить публикацию',
          type: 'general'
        });
      }
    } catch (e) {
      console.error('Ошибка удаления публикации:', e);
      setModerationAlert({
        isOpen: true,
        title: 'Сетевая ошибка',
        message: 'Произошла сетевая ошибка при удалении публикации',
        type: 'general'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article 
      ref={postRef as any}
      id={`post-${post.id}`}
      className={`w-full rounded-2xl md:rounded-3xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border ${isPromoted ? 'border-2 border-pink-400 shadow-md' : 'border-pink-300 shadow-sm'} transition-all duration-200 overflow-hidden`}
    >
      {/* Header bar: Author, date, channel/tag & share */}
      <div className="p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-pink-200/70">
        <div className="flex items-center space-x-3 min-w-0">
          <div 
            onClick={handleAuthorClick}
            className="flex items-center space-x-3 min-w-0 cursor-pointer group"
            title="Открыть профиль соавтора"
          >
            <div className="relative shrink-0">
              <img 
                src={normalizeProTalkMediaUrl(post.author?.avatar) || BRAND_ASSETS.logo} 
                alt={cleanAuthorName(post.author?.name)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BRAND_ASSETS.logo;
                }}
                className="w-10 h-10 rounded-full object-cover border-2 border-pink-300 p-0.5 bg-white group-hover:scale-105 transition-transform"
              />
              {showAuthorRainbowHeart && (
                <img
                  src={BRAND_ASSETS.heartAvatar}
                  alt="Значок радужного сердца"
                  title="Значок радужного сердца (тариф Разгон+)"
                  className="w-4 h-4 object-contain absolute -top-1 -right-1 drop-shadow-xs pointer-events-none"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-[14px] font-bold text-slate-800 truncate group-hover:text-pink-600 transition-colors">
                  {cleanAuthorName(post.author?.name)}
                </span>
                {post.author?.role && (
                  <span className="hidden sm:inline text-[14px] font-semibold text-pink-700">
                    · {post.author.role}
                  </span>
                )}
                {isPromoted && (
                  <span className="inline-flex items-center gap-1 text-[14px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                    <TrendingUp className="w-4 h-4 text-pink-600 shrink-0" />
                    <span>В топе ленты</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[14px] text-slate-500">
                <span>{post.dateStr || post.date || 'Сегодня'}</span>
                {post.tag && (
                  <>
                    <span>·</span>
                    <span className="text-pink-600 font-medium truncate max-w-[150px]">{post.tag}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Subscribe Button */}
          {!isAuthor && post.userId && currentUser && String(currentUser.id) !== String(post.userId) && (
            <button
              type="button"
              id={`sub-post-${post.id}`}
              onClick={handleToggleSubscribe}
              disabled={isSubscribing}
              className={`ml-2 px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                isSubscribed
                  ? 'bg-pink-100 text-pink-700 border border-pink-300 hover:bg-pink-200'
                  : 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs hover:opacity-90'
              }`}
            >
              <span>{isSubscribed ? 'Вы подписаны' : 'Подписаться'}</span>
            </button>
          )}
        </div>

        {/* Action icons: Link, Copy, Author controls (Promote/Edit/Delete), Views */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Author controls: Promote, Edit & Delete */}
          {isAuthor && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                type="button"
                id={`promote-post-${post.id}`}
                onClick={handleTogglePromote}
                disabled={isPromoting}
                title="Продвижение публикации в топ Ленты соцсети ИИрки (тариф Отрыв+)"
                className={`px-3 py-2 rounded-xl text-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isPromoted
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                    : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
                }`}
              >
                {!hasOtryvAccess ? (
                  <Lock className="w-4 h-4 text-pink-600 shrink-0" />
                ) : (
                  <TrendingUp className={`w-4 h-4 shrink-0 ${isPromoted ? 'text-white' : 'text-pink-600'}`} />
                )}
                <span>{isPromoted ? 'В топе' : 'В топ ленты'}</span>
              </button>

              <button
                type="button"
                id={`edit-post-${post.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const resolvedEditId =
                    post.sourcePostId ||
                    (post.id.startsWith('blog_') ? `req_${post.id.slice(5)}` : post.id);
                  const targetUrl = resolvedEditId.startsWith('req_')
                    ? `/posts/${resolvedEditId}`
                    : `/posts/${resolvedEditId}/edit`;
                  if (onNavigate) {
                    onNavigate(targetUrl);
                  } else {
                    window.history.pushState(null, '', targetUrl);
                    window.dispatchEvent(new Event('popstate'));
                  }
                }}
                title="Редактировать публикацию в редакторе"
                className="p-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-pink-600 border border-pink-200 transition-all cursor-pointer flex items-center space-x-1"
              >
                <Edit3 className="w-4 h-4 text-pink-500" />
                <span className="text-[14px] font-medium hidden md:inline">Редактировать</span>
              </button>

              <button
                type="button"
                id={`delete-post-${post.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
                title="Удалить публикацию"
                className="p-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-rose-600 border border-pink-200 transition-all cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span className="text-[14px] font-medium hidden md:inline">Удалить</span>
              </button>
            </div>
          )}

          <button
            type="button"
            id={`copy-link-${post.id}`}
            onClick={handleCopyLink}
            title="Скопировать ссылку на публикацию"
            className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 border border-pink-200 transition-all cursor-pointer flex items-center space-x-1"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-pink-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600" />
            )}
            <span className="text-[14px] font-medium hidden sm:inline">
              {copiedLink ? 'Скопировано' : 'Ссылка'}
            </span>
          </button>

          {!isSingleView && onNavigate && (
            <button
              type="button"
              id={`open-single-${post.id}`}
              onClick={() => onNavigate(postUrl)}
              title="Открыть отдельную страницу поста"
              className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-medium transition-all shadow-xs cursor-pointer flex items-center space-x-1"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-[14px] hidden md:inline">Открыть</span>
            </button>
          )}
        </div>
      </div>

      {promoteFeedback && (
        <div className="mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 text-[14px] font-bold text-slate-800">
          {promoteFeedback}
        </div>
      )}

      {/* Main post body */}
      <div className="p-4 md:p-6 space-y-4">
        {/* Post Title */}
        {post.title && (
          <h2 
            onClick={() => !isSingleView && onNavigate && onNavigate(postUrl)}
            className={`text-lg md:text-xl font-bold text-slate-900 leading-snug tracking-tight ${!isSingleView ? 'cursor-pointer hover:text-pink-600 transition-colors' : ''}`}
          >
            {post.title}
          </h2>
        )}

        {/* Media Attachments Section (rendered identically to Telegram preview) */}
        {effectiveAttachmentType !== 'none' && (
          <div className="rounded-xl overflow-hidden border border-pink-200/80 bg-white/40">
            {/* Photo */}
            {effectiveAttachmentType === 'photo' && effectiveAttachmentUrl && !imageError && (
              <div className="w-full flex justify-center bg-black/5">
                <img 
                  src={effectiveAttachmentUrl} 
                  alt={post.title || 'Вложение'} 
                  className="max-h-[500px] w-full object-contain rounded-lg"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* Video */}
            {effectiveAttachmentType === 'video' && effectiveAttachmentUrl && (
              <video 
                src={effectiveAttachmentUrl} 
                controls 
                className="max-h-[460px] w-full object-contain rounded-lg bg-black"
                preload="metadata"
              />
            )}

            {/* Circular Video Note */}
            {effectiveAttachmentType === 'video_note' && effectiveAttachmentUrl && (
              <div className="w-40 h-40 rounded-full overflow-hidden border-2 border-pink-400 shadow-lg bg-black mx-auto my-3 shrink-0">
                <video 
                  src={effectiveAttachmentUrl} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            )}

            {/* Album Collage */}
            {effectiveAttachmentType === 'album' && effectiveAttachmentUrls.length > 0 && (
              <TelegramAlbumCollage urls={effectiveAttachmentUrls} />
            )}

            {/* Audio */}
            {effectiveAttachmentType === 'audio' && effectiveAttachmentUrl && (
              <div className="p-3 flex items-center space-x-3">
                <Volume2 className="w-6 h-6 text-pink-600 shrink-0" />
                <audio src={effectiveAttachmentUrl} controls className="w-full h-9" />
              </div>
            )}

            {/* Document */}
            {effectiveAttachmentType === 'document' && effectiveAttachmentUrl && (
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <Paperclip className="w-5 h-5 text-pink-600 shrink-0" />
                  <span className="text-[14px] text-slate-800 font-medium truncate">
                    {effectiveAttachmentUrl.split('/').pop() || 'Документ к публикации'}
                  </span>
                </div>
                <a 
                  href={effectiveAttachmentUrl} 
                  download 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-1.5 text-[14px] font-bold text-pink-600 bg-white border border-pink-300 rounded-lg hover:bg-pink-50"
                >
                  Скачать
                </a>
              </div>
            )}
          </div>
        )}

        {/* Text Content Rendering (Supports V2, Rich Markdown, Spoilers, Quotes, Links) */}
        <div className="text-[14px] md:text-[15px] leading-relaxed font-sans text-slate-800">
          <MarkdownRenderer
            content={stripDuplicateTitleFromPostContent(
              post.content || (post as any).post_text || (post as any).postText || post.desc || '',
              post.title
            )}
            format={(post.messageFormat === 'v2' || post.messageFormat === 'rich') ? post.messageFormat : 'auto'}
            isCompact={false}
            attachmentType="none"
            signature={post.signature}
          />
        </div>

        {/* Inline Keyboard Buttons if present */}
        {Array.isArray(post.inlineButtons) && post.inlineButtons.length > 0 && (
          <div className="pt-2.5 space-y-2 border-t border-pink-200/60">
            {post.inlineButtons.map((row, rIdx) => (
              <div 
                key={rIdx} 
                className="grid gap-2" 
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map((btn, bIdx) => {
                  const colorClass = getInlineButtonStyleClasses((btn as any).style, (btn as any).color);
                  const hasUrl = Boolean(btn.url);
                  return (
                    <a
                      key={btn.url ? `${btn.url}_${bIdx}` : bIdx}
                      href={btn.url || '#'}
                      target={hasUrl ? '_blank' : '_self'}
                      rel={hasUrl ? 'noreferrer' : undefined}
                      onClick={(e) => {
                        if (!hasUrl) {
                          e.preventDefault();
                        }
                      }}
                      className={`min-h-[38px] p-2.5 rounded-xl text-[14px] font-bold text-center transition-all flex items-center justify-center space-x-1.5 cursor-pointer no-underline ${colorClass}`}
                      title={btn.url || (btn as any).callbackData || btn.text}
                    >
                      <span className="truncate">{btn.text}</span>
                      {hasUrl && <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />}
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Footer info: views counter, Telegram double check */}
        <div className="pt-2 flex items-center justify-between text-[14px] text-slate-500 border-t border-pink-200/60">
          <div className="flex items-center space-x-1.5">
            <Eye className="w-4 h-4 text-pink-500" />
            <span>{viewsCount} просмотров</span>
          </div>

          <div className="flex items-center space-x-3">
            {sharesCount > 0 && (
              <div className="flex items-center space-x-1 text-slate-500">
                <Share2 className="w-4 h-4 text-pink-500" />
                <span>{sharesCount} репостов</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <span>{post.dateStr || 'Сегодня'}</span>
              <span className="text-pink-600 font-bold text-[14px]">✓✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Reactions & Social Actions Bar */}
      <div className="px-4 py-3 bg-white/40 border-t border-pink-200/70 flex flex-wrap items-center justify-between gap-2">
        {/* Reactions Picker */}
        <div className="flex items-center flex-wrap gap-1.5">
          {REACTION_CONFIG.map(({ key, emoji, label }) => {
            const count = reactions[key] || 0;
            const isSelected = myReaction === key;
            return (
              <button
                key={key}
                type="button"
                id={`reaction-${key}-${post.id}`}
                onClick={() => handleReaction(key)}
                className={`px-3 py-1.5 rounded-xl text-[14px] font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-xs scale-105'
                    : 'bg-white/70 hover:bg-white text-slate-700 border border-pink-200/80 hover:border-pink-300'
                }`}
                title={label}
              >
                <span className="text-[16px]">{emoji}</span>
                {count > 0 && <span className="font-bold">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comments toggle & Repost button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            id={`repost-btn-${post.id}`}
            onClick={() => {
              setIsRepostModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl text-[14px] font-medium flex items-center space-x-1.5 bg-white/70 hover:bg-white text-slate-700 border border-pink-200 transition-all cursor-pointer"
            title="Сделать репост публикации"
          >
            <Share2 className="w-4 h-4 text-pink-600" />
            <span>Репост</span>
            {sharesCount > 0 && (
              <span className="px-1.5 py-0.5 text-[14px] rounded-full bg-pink-200 text-pink-800 font-bold">
                {sharesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id={`toggle-comments-${post.id}`}
            onClick={handleToggleComments}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-medium flex items-center space-x-1.5 border transition-all cursor-pointer ${
              showComments 
                ? 'bg-pink-100/70 border-pink-300 text-pink-700 font-bold' 
                : 'bg-white/70 hover:bg-white text-slate-700 border-pink-200'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-pink-600" />
            <span>Комментарии</span>
            {(post.commentsCount || comments.length) > 0 && (
              <span className="px-1.5 py-0.5 text-[14px] rounded-full bg-pink-200 text-pink-800 font-bold">
                {post.commentsCount || comments.length}
              </span>
            )}
            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 md:p-6 bg-white/60 border-t border-pink-200/80 space-y-4"
          >
            <h3 className="text-[15px] font-bold text-slate-900 flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-pink-600" />
              <span>Комментарии к публикации ({comments.length})</span>
            </h3>

            {/* Comment Form (for Registered & Unregistered Users with AI Moderation & Voice support) */}
            <form onSubmit={handleSubmitComment} className="space-y-3 p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-pink-300 shadow-2xs">
              {!currentUser?.id && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-1 border-b border-pink-200/80">
                  <label htmlFor={`guest-name-${post.id}`} className="text-[14px] font-bold text-slate-800 shrink-0">
                    Ваше имя: <span className="text-pink-600">*</span>
                  </label>
                  <input
                    id={`guest-name-${post.id}`}
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Представьтесь (например, Анна)"
                    required
                    className="w-full sm:max-w-xs text-[14px] px-3.5 py-1.5 rounded-xl bg-white/95 border border-pink-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-300/40 text-slate-900 font-medium"
                  />
                </div>
              )}

              {replyingToCommentId && (
                <div className="flex items-center justify-between text-[14px] text-pink-700 bg-white/90 p-2.5 rounded-xl border border-pink-300">
                  <div className="flex items-center space-x-1.5">
                    <CornerDownRight className="w-4 h-4 text-pink-500" />
                    <span className="font-semibold">Ответ на комментарий</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setReplyingToCommentId(null)}
                    className="text-slate-600 hover:text-pink-700 font-bold cursor-pointer transition-colors"
                  >
                    ✕ Отмена
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <AudioField
                  id={`comment-textarea-${post.id}`}
                  value={newCommentText}
                  onChange={setNewCommentText}
                  audioUrl={commentAudioUrl}
                  onAudioChange={setCommentAudioUrl}
                  placeholder={replyingToCommentId ? "Напишите ответ или надиктуйте голосом..." : "Написать комментарий или надиктовать голосом..."}
                  rows={2}
                  voiceFriendName="Модератор комментариев"
                  titleVoice="Голосовой ввод комментария (распознавание речи)"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[14px] text-slate-500 font-medium hidden sm:inline">
                    Проверка ИИ-модерацией
                  </span>
                  <button
                    type="submit"
                    id={`submit-comment-${post.id}`}
                    disabled={isSubmittingComment || (!newCommentText.trim() && !commentAudioUrl)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold text-[14px] shadow-xs hover:opacity-90 disabled:opacity-50 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border border-white/40"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmittingComment ? 'Проверка...' : 'Отправить'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="py-6 text-center text-[14px] text-slate-500">
                Загрузка комментариев...
              </div>
            ) : comments.length === 0 ? (
              <div className="py-4 text-center text-[14px] text-slate-500 italic">
                Пока нет комментариев. Будьте первыми!
              </div>
            ) : (
              <div className="space-y-3">
                {rootComments.map(comment => {
                  const replies = getReplies(comment.id);
                  const handleCommentAuthor = (c: BlogPostComment) => {
                    if (!currentUser?.id) {
                      onRequireAuth?.();
                      return;
                    }
                    const targetProfile = c.authorUserId || c.authorUsername;
                    if (targetProfile) {
                      const p = `/social/${targetProfile}`;
                      if (onNavigate) onNavigate(p);
                      else {
                        window.history.pushState(null, '', p);
                        window.dispatchEvent(new Event('popstate'));
                      }
                    }
                  };

                  return (
                    <div key={comment.id} className="space-y-2">
                      {/* Root Comment Card */}
                      <div id={`comment-${comment.id}`} className="p-3 rounded-2xl bg-white/90 border border-pink-100 space-y-1.5 shadow-2xs transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {comment.authorAvatar ? (
                              <img 
                                src={comment.authorAvatar} 
                                alt={comment.authorName} 
                                className="w-7 h-7 rounded-full object-cover border border-pink-300 cursor-pointer"
                                onClick={() => handleCommentAuthor(comment)}
                              />
                            ) : (
                              <div 
                                onClick={() => handleCommentAuthor(comment)}
                                className="w-7 h-7 rounded-full bg-gradient-to-r from-sky-300 via-pink-300 to-orange-300 flex items-center justify-center text-white text-[14px] font-bold cursor-pointer"
                              >
                                {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : 'П'}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCommentAuthor(comment)}
                              className="text-[14px] font-bold text-slate-800 hover:text-pink-600 transition-colors text-left cursor-pointer"
                            >
                              {comment.authorName}
                            </button>
                            {comment.authorUsername && (
                              <button
                                type="button"
                                onClick={() => handleCommentAuthor(comment)}
                                className="text-[14px] text-pink-600 font-medium hover:underline cursor-pointer"
                              >
                                @{comment.authorUsername}
                              </button>
                            )}
                          </div>
                          <span className="text-[14px] text-slate-500">
                            {new Date(comment.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[14px] text-slate-800 pl-9 whitespace-pre-wrap">
                          {comment.text}
                        </p>

                        {/* Audio Player in brand gradient if voice comment */}
                        {(comment.audioUrl || comment.audio_url) && (
                          <div className="pl-9 pt-1.5 max-w-md">
                            <GradientAudioPlayer
                              src={comment.audioUrl || comment.audio_url || ''}
                              title="Голосовой комментарий"
                              compact
                            />
                          </div>
                        )}

                        <div className="pl-9 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToCommentId(comment.id);
                              const ta = document.getElementById(`comment-textarea-${post.id}`);
                              ta?.focus();
                            }}
                            className="text-[14px] font-medium text-pink-600 hover:text-pink-700 flex items-center space-x-1 cursor-pointer"
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>Ответить</span>
                          </button>
                        </div>
                      </div>

                      {/* Nested Replies */}
                      {replies.length > 0 && (
                        <div className="pl-6 md:pl-9 space-y-2 border-l-2 border-pink-200">
                          {replies.map(reply => (
                            <div id={`comment-${reply.id}`} key={reply.id} className="p-2.5 rounded-xl bg-white/70 border border-pink-100 space-y-1 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {reply.authorAvatar ? (
                                    <img 
                                      src={reply.authorAvatar} 
                                      alt={reply.authorName} 
                                      className="w-6 h-6 rounded-full object-cover border border-pink-300 cursor-pointer"
                                      onClick={() => handleCommentAuthor(reply)}
                                    />
                                  ) : (
                                    <div 
                                      onClick={() => handleCommentAuthor(reply)}
                                      className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-300 via-orange-300 to-sky-300 flex items-center justify-center text-white text-[14px] font-bold cursor-pointer"
                                    >
                                      {reply.authorName ? reply.authorName.charAt(0).toUpperCase() : 'П'}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCommentAuthor(reply)}
                                    className="text-[14px] font-bold text-slate-800 hover:text-pink-600 transition-colors text-left cursor-pointer"
                                  >
                                    {reply.authorName}
                                  </button>
                                  {reply.authorUsername && (
                                    <button
                                      type="button"
                                      onClick={() => handleCommentAuthor(reply)}
                                      className="text-[14px] text-pink-600 hover:underline cursor-pointer"
                                    >
                                      @{reply.authorUsername}
                                    </button>
                                  )}
                                </div>
                                <span className="text-[14px] text-slate-500">
                                  {new Date(reply.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[14px] text-slate-800 pl-8 whitespace-pre-wrap">
                                {reply.text}
                              </p>

                              {/* Audio Player in brand gradient if reply has voice */}
                              {(reply.audioUrl || reply.audio_url) && (
                                <div className="pl-8 pt-1.5 max-w-sm">
                                  <GradientAudioPlayer
                                    src={reply.audioUrl || reply.audio_url || ''}
                                    title="Голосовой ответ"
                                    compact
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Post Modal */}
      {isEditModalOpen && (
        <EditPostModal
          post={post}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updated) => {
            if (onPostUpdated) {
              onPostUpdated(updated);
            }
          }}
        />
      )}

      {/* Repost Modal */}
      {isRepostModalOpen && (
        <RepostModal
          isOpen={isRepostModalOpen}
          onClose={() => setIsRepostModalOpen(false)}
          currentUser={currentUser}
          post={{
            id: post.id,
            slug: post.slug,
            title: post.title || '',
            content: post.content || post.desc || '',
            image: post.attachmentUrl || post.image,
            author: post.author
          } as any}
          onRepostSuccess={() => {
            setSharesCount(prev => prev + 1);
            if (onPostUpdated) {
              onPostUpdated({
                ...post,
                sharesCount: (sharesCount || 0) + 1,
                shares: (sharesCount || 0) + 1
              });
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal (light gradient, transparent, minimum 14px text) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-100/60 via-pink-100/60 to-orange-100/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 border border-pink-300 shadow-xl p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[16px] font-bold text-slate-900">Удалить публикацию?</h3>
                <p className="text-[14px] text-slate-700 leading-relaxed">
                  Публикация «{post.title || 'Без названия'}» будет полностью удалена из базы данных. Это действие необратимо.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-pink-200/70">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 font-medium text-[14px] border border-pink-200 cursor-pointer transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeletePost}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-orange-500 hover:opacity-95 text-white font-bold text-[14px] shadow-xs cursor-pointer flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Удаление...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Да, удалить</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Alert Modal */}
      <ModerationAlertModal
        isOpen={moderationAlert.isOpen}
        onClose={() => setModerationAlert(prev => ({ ...prev, isOpen: false }))}
        title={moderationAlert.title}
        message={moderationAlert.message}
        type={moderationAlert.type}
      />

      <TariffGateModal
        isOpen={isPromoteGateOpen}
        onClose={() => setIsPromoteGateOpen(false)}
        requiredTariff="Отрыв"
        featureTitle="Продвижение постов в соцсети ИИрки"
        description="Приоритетное размещение и вывод ваших публикаций в топ Ленты социальной сети платформы доступны с тарифа Отрыв."
      />
    </article>
  );
};
