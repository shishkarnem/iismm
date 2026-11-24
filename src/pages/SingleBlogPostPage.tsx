import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  Copy, 
  Check, 
  FileText, 
  ExternalLink,
  MessageCircle,
  Eye,
  Send
} from 'lucide-react';
import { PostCardRenderer, BlogPostData } from '../components/PostCardRenderer';
import { getOrCreateGuestUser } from '../utils/guestUser';
import { NeurosphereLoader } from '../components/loaders/NeurosphereLoader';

interface SingleBlogPostPageProps {
  slugOrId: string;
  currentUser?: any;
  onNavigate: (path: string) => void;
  onRequireAuth?: (reason?: string) => void;
}

export const SingleBlogPostPage: React.FC<SingleBlogPostPageProps> = ({
  slugOrId,
  currentUser,
  onNavigate,
  onRequireAuth
}) => {
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchPost = async () => {
      try {
        const effectiveUid = currentUser?.id || getOrCreateGuestUser().id;
        const userIdParam = effectiveUid ? `?userId=${encodeURIComponent(effectiveUid)}` : '';
        const res = await fetch(`/api/blog/posts/${slugOrId}${userIdParam}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.post) {
          setPost(data.post);
          // Update client document title dynamically
          if (data.post.title) {
            document.title = `${data.post.title} — Публикация ИИSMM`;
          }
          // Ensure URL in browser is the canonical /posts/slug if post has a slug
          if (data.post.slug && slugOrId !== data.post.slug) {
            window.history.replaceState(null, '', `/posts/${data.post.slug}`);
          }
        } else {
          setError(data.error || 'Публикация не найдена');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Ошибка загрузки публикации');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (slugOrId) {
      fetchPost();
    }

    return () => {
      isMounted = false;
    };
  }, [slugOrId, currentUser?.id]);

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/posts/${post?.slug || slugOrId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareTelegram = () => {
    const fullUrl = `${window.location.origin}/posts/${post?.slug || slugOrId}`;
    const text = encodeURIComponent(`${post?.title || 'Публикация в ИИSMM'}\n\n${fullUrl}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${text}`, '_blank');
  };

  const handleShareVK = () => {
    const fullUrl = `${window.location.origin}/posts/${post?.slug || slugOrId}`;
    window.open(`https://vk.com/share.php?url=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(post?.title || '')}`, '_blank');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      {/* Navigation Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-pink-300 shadow-2xs">
        {(() => {
          const backPath = currentUser?.id ? `/posts${currentUser.id}` : '/posts';
          return (
            <button
              type="button"
              id="back-to-posts-btn"
              onClick={() => onNavigate(backPath)}
              className="px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-800 text-[14px] font-bold border border-pink-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-pink-600" />
              <span>Назад к списку постов</span>
            </button>
          );
        })()}

        {/* Share buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-pink-50 text-slate-700 text-[14px] font-medium border border-pink-200 transition-all flex items-center space-x-1 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-pink-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>{copiedLink ? 'Скопировано' : 'Копировать ссылку'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareTelegram}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[14px] font-bold transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
            title="Поделиться в Telegram"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Telegram</span>
          </button>

          <button
            type="button"
            onClick={handleShareVK}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-bold transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
            title="Поделиться во ВКонтакте"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">ВКонтакте</span>
          </button>
        </div>
      </div>

      {/* Main Single Post Card */}
      {loading ? (
        <div className="p-6 text-center rounded-3xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300">
          <NeurosphereLoader variant="inline" label="Загрузка публикации..." />
        </div>
      ) : error || !post ? (
        <div className="p-10 text-center rounded-3xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-pink-300 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/90 border border-pink-300 flex items-center justify-center mx-auto text-pink-500">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {error || 'Публикация не найдена'}
          </h2>
          <p className="text-[14px] text-slate-600 max-w-sm mx-auto">
            Возможно, ссылка устарела или публикация была удалена автором.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/posts')}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold text-[14px] shadow-xs cursor-pointer inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться к списку публикаций</span>
          </button>
        </div>
      ) : (
        <PostCardRenderer
          post={post}
          currentUser={currentUser}
          isSingleView={true}
          onNavigate={onNavigate}
          onPostUpdated={setPost}
          onRequireAuth={onRequireAuth}
        />
      )}
    </div>
  );
};
export default SingleBlogPostPage;
