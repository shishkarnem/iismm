import React, { useState, useEffect, useMemo } from 'react';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { 
  Send, 
  Radio, 
  User as UserIcon, 
  Users, 
  MessageSquare, 
  Check, 
  AlertCircle, 
  Share2, 
  X,
  Search,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  Copy,
  Smartphone,
  Globe,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { detectPostFormat } from '../utils/formatDetector';
import { getOrCreateGuestUser } from '../utils/guestUser';
import { formatChatLastMessagePreview } from '../utils/chat/chatPreviewFormatter';

export interface RepostTargetPost {
  id: string;
  title: string;
  content: string;
  image?: string;
  images?: string[];
  authorName?: string;
  authorAvatar?: string;
  author?: {
    id?: string;
    name?: string;
    avatar?: string;
    username?: string;
    isVip?: boolean;
    role?: string;
  };
  url?: string;
  messageFormat?: 'v2' | 'rich' | string;
  inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string; callbackData?: string; style?: string; color?: string; type?: string }>>;
}

interface RepostModalProps {
  isOpen: boolean;
  post: RepostTargetPost | null;
  currentUser?: any;
  userChats?: Array<{
    id: string;
    name: string;
    username: string;
    avatar: string;
    isGroup?: boolean;
    status?: string;
  }>;
  onClose: () => void;
  onSuccess?: (destination: string, newSharesCount: number) => void;
  onRepostSuccess?: (destination?: string, newSharesCount?: number) => void;
}

export default function RepostModal({
  isOpen,
  post,
  currentUser,
  userChats,
  onClose,
  onSuccess,
  onRepostSuccess
}: RepostModalProps) {
  const [activeTab, setActiveTab] = useState<'social' | 'channels' | 'profile' | 'chat' | 'direct'>('social');
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Channels state
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  // Existing user chats state (multi-select)
  const [chatsList, setChatsList] = useState<any[]>(userChats || []);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  // Subscriptions state (multi-select, только те, на кого подписан)
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [selectedSubTargetIds, setSelectedSubTargetIds] = useState<string[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState<boolean>(false);

  // Common form state
  const [commentText, setCommentText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUserId = String(currentUser?.id || '16926299042');
  const currentUserName = currentUser?.name || currentUser?.firstName || 'Вы';
  const currentUserAvatar = normalizeProTalkMediaUrl(currentUser?.avatarUrl) || BRAND_ASSETS.heartAvatar;

  // Accurate format detection of the target post: 'rich' or 'v2'
  const resolvedFormat = useMemo(() => {
    return detectPostFormat(post?.content, post?.messageFormat);
  }, [post?.content, post?.messageFormat]);

  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/posts/${(post as any)?.slug || post?.id || ''}`
    : `/posts/${(post as any)?.slug || post?.id || ''}`;

  const handleShareToSocialNetwork = async (networkName: string, shareUrl?: string) => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
    try {
      const guestUser = getOrCreateGuestUser();
      const repEndpoint = (post?.id && post.id.startsWith('post-'))
        ? `/api/social/posts/${post.id}/repost`
        : `/api/blog/posts/${post?.id}/repost`;

      const res = await fetch(repEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || guestUser.id,
          userName: currentUser?.name || currentUser?.firstName || guestUser.name,
          targetType: `social_${networkName.toLowerCase()}`,
          targetName: networkName,
          count: 1
        })
      });
      const data = await res.json().catch(() => ({}));
      const newShares = data.shares || 1;
      setSuccessMessage(`Успешный репост в ${networkName}!`);
      setTimeout(() => setSuccessMessage(null), 3500);
      if (onRepostSuccess) onRepostSuccess(`social_${networkName}`, newShares);
      if (onSuccess) onSuccess(`social_${networkName}`, newShares);
    } catch (e) {
      console.warn('Social share error:', e);
    }
  };

  const handleNativeShare = async () => {
    const title = post?.title || 'Публикация в ИИSMM';
    const text = (post?.content || '').slice(0, 300);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `${title}\n\n${text}`,
          url: postUrl
        });
        await handleShareToSocialNetwork('system');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    handleCopyFull();
  };

  const handleCopyFull = async () => {
    const title = post?.title || 'Публикация в ИИSMM';
    const content = post?.content || '';
    const textToCopy = `${title}\n\n${content}\n\nСсылка на публикацию:\n${postUrl}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
      await handleShareToSocialNetwork('clipboard');
    } catch (e) {
      console.warn('Copy error:', e);
    }
  };

  const handleCopyLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      await handleShareToSocialNetwork('link');
    } catch (e) {
      console.warn('Copy link error:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSuccessMessage(null);
      setErrorMessage(null);
      setCommentText('');
      setChatSearchQuery('');
      setSubSearchQuery('');
      return;
    }

    // 1. Load user channels for Telegram
    fetch('/api/channels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChannels(data);
          if (data.length > 0 && !selectedChannel) {
            setSelectedChannel(data[0].username || data[0].title || '');
          }
        }
      })
      .catch(() => {
        setChannels([{ id: 'sav_ai', username: '@SAV_AI', title: 'Официальный канал ИИSMM' }]);
        setSelectedChannel('@SAV_AI');
      });

    // 2. Load existing user chats from PostgreSQL
    fetch(`/api/user/chats?userId=${encodeURIComponent(currentUserId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.chats) && data.chats.length > 0) {
          setChatsList(data.chats);
          if (selectedChatIds.length === 0) {
            setSelectedChatIds([data.chats[0].id]);
          }
        } else if (userChats && userChats.length > 0) {
          setChatsList(userChats);
          if (selectedChatIds.length === 0) {
            setSelectedChatIds([userChats[0].id]);
          }
        }
      })
      .catch(() => {
        if (userChats && userChats.length > 0) {
          setChatsList(userChats);
          if (selectedChatIds.length === 0) {
            setSelectedChatIds([userChats[0].id]);
          }
        }
      });

    // 3. Load user's subscriptions ONLY (Только те, на кого подписан)
    setIsLoadingSubs(true);
    fetch(`/api/subscriptions?followerId=${encodeURIComponent(currentUserId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.subscriptions)) {
          setSubscriptions(data.subscriptions);
          if (data.subscriptions.length > 0 && selectedSubTargetIds.length === 0) {
            setSelectedSubTargetIds([String(data.subscriptions[0].targetId)]);
          }
        }
      })
      .catch(err => {
        console.warn('Failed to load subscriptions:', err);
      })
      .finally(() => {
        setIsLoadingSubs(false);
      });
  }, [isOpen, currentUserId, userChats]);

  // Filter existing chats by query
  const filteredChats = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return chatsList;
    return chatsList.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.username || '').toLowerCase().includes(q)
    );
  }, [chatsList, chatSearchQuery]);

  // Filter subscriptions by query (поиск по подпискам)
  const filteredSubscriptions = useMemo(() => {
    const q = subSearchQuery.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter(s => 
      (s.targetName || '').toLowerCase().includes(q) || 
      (s.targetUsername || '').toLowerCase().includes(q)
    );
  }, [subscriptions, subSearchQuery]);

  // Multi-select toggle helpers for chats
  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds(prev => 
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSelectAllChats = () => {
    if (selectedChatIds.length === filteredChats.length) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(filteredChats.map(c => c.id));
    }
  };

  // Multi-select toggle helpers for subscriptions
  const toggleSubSelection = (targetId: string) => {
    setSelectedSubTargetIds(prev => 
      prev.includes(targetId) ? prev.filter(id => id !== targetId) : [...prev, targetId]
    );
  };

  const handleSelectAllSubs = () => {
    if (selectedSubTargetIds.length === filteredSubscriptions.length) {
      setSelectedSubTargetIds([]);
    } else {
      setSelectedSubTargetIds(filteredSubscriptions.map(s => String(s.targetId)));
    }
  };

  if (!isOpen || !post) return null;

  // Gather all attachments from post
  const allAttachments: string[] = [];
  if (Array.isArray(post.images) && post.images.length > 0) {
    allAttachments.push(...post.images);
  } else if (post.image) {
    allAttachments.push(post.image);
  }

  // Full unshortened text of the post
  const fullPostBody = (post.content || '').trim();
  const fullPostTitle = (post.title || '').trim();
  
  let fullMessageText = '';
  if (commentText.trim()) {
    fullMessageText += `${commentText.trim()}\n\n---\n\n`;
  }
  if (fullPostTitle) {
    fullMessageText += resolvedFormat === 'rich' ? `<b>${fullPostTitle}</b>\n\n` : `*${fullPostTitle}*\n\n`;
  }
  fullMessageText += fullPostBody;

  const handleExecuteRepost = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let targetType: 'channel' | 'profile' | 'group_chat' | 'direct_chat' = 'profile';
      let targetId = '';
      let targetName = '';
      let successfulCount = 0;

      // TAB 1: TELEGRAM CHANNELS (Respecting V2 vs Rich format of original post)
      if (activeTab === 'channels') {
        targetType = 'channel';
        targetId = selectedChannel;
        targetName = selectedChannel;

        const captionWithComment = commentText.trim() 
          ? `${commentText.trim()}\n\nРепост: ${post.title}\n\n${fullPostBody}`
          : `${post.title}\n\n${fullPostBody}`;

        const tgRes = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: selectedChannel,
            title: post.title,
            content: captionWithComment,
            attachmentUrl: allAttachments[0] || post.image,
            format: resolvedFormat,
            inlineButtons: post.inlineButtons || (post as any).inline_buttons
          })
        });
        const tgData = await tgRes.json();
        if (!tgRes.ok && !tgData.success) {
          throw new Error(tgData.error || 'Не удалось опубликовать в канал');
        }
        successfulCount = 1;
      } 
      // TAB 2: PERSONAL WALL / PROFILE
      else if (activeTab === 'profile') {
        targetType = 'profile';
        targetId = currentUserId;
        targetName = 'Личный профиль';

        const res = await fetch('/api/blog/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            userName: currentUserName,
            userAvatar: currentUserAvatar,
            title: `Репост: ${post.title || 'Публикация'}`,
            content: fullMessageText,
            image: allAttachments[0] || post.image,
            attachmentUrl: allAttachments[0] || post.image,
            tag: 'Репост',
            format: allAttachments.length > 0 ? 'photo' : 'article',
            messageFormat: resolvedFormat
          })
        });
        const data = await res.json();
        if (!res.ok && !data.success) {
          throw new Error(data.error || 'Не удалось опубликовать на стену профиля');
        }
        successfulCount = 1;
      } 
      // TAB 3: EXISTING USER CHATS (MULTI-SELECT)
      else if (activeTab === 'chat') {
        targetType = 'group_chat';
        if (selectedChatIds.length === 0) {
          throw new Error('Пожалуйста, выберите хотя бы один чат для репоста');
        }

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const origAuthorName = post.authorName || post.author?.name || 'Автор публикации';

        for (const cid of selectedChatIds) {
          const chatRes = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `fwd-rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              chatId: cid,
              text: fullMessageText,
              sender: 'me',
              userId: currentUserId,
              senderId: currentUserId,
              senderName: currentUserName,
              forwardedFrom: {
                senderName: origAuthorName,
                originalId: post.id,
                title: post.title,
                text: fullMessageText,
                images: allAttachments
              },
              inlineButtons: post.inlineButtons || (post as any).inline_buttons,
              messageFormat: resolvedFormat,
              images: allAttachments.length > 0 ? JSON.stringify(allAttachments) : null,
              time: nowTime
            })
          });
          if (chatRes.ok) {
            successfulCount++;
          }
        }

        if (successfulCount === 0) {
          throw new Error('Не удалось отправить репост в выбранные чаты');
        }

        targetId = selectedChatIds[0];
        targetName = `${successfulCount} ${successfulCount === 1 ? 'чат' : 'чатов'}`;
      } 
      // TAB 4: DIRECT MESSAGES TO SUBSCRIBED AUTHORS (MULTI-SELECT)
      else if (activeTab === 'direct') {
        targetType = 'direct_chat';
        if (selectedSubTargetIds.length === 0) {
          throw new Error('Пожалуйста, выберите хотя бы одного соавтора из ваших подписок');
        }

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const origAuthorName = post.authorName || post.author?.name || 'Автор публикации';

        for (const tid of selectedSubTargetIds) {
          const targetSub = subscriptions.find(s => String(s.targetId) === tid);
          const rName = targetSub?.targetName || 'Соавтор';

          // 1. Ensure personal chat exists in PostgreSQL
          await fetch('/api/user/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUserId,
              partnerId: tid,
              partnerName: rName,
              partnerUsername: targetSub?.targetUsername || '',
              partnerAvatar: normalizeProTalkMediaUrl(targetSub?.targetAvatar) || BRAND_ASSETS.heartAvatar
            })
          }).catch(() => {});

          // 2. Send complete unshortened message
          const chatRes = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `fwd-rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              chatId: tid,
              text: fullMessageText,
              sender: 'me',
              userId: currentUserId,
              senderId: currentUserId,
              senderName: currentUserName,
              recipientName: rName,
              forwardedFrom: {
                senderName: origAuthorName,
                originalId: post.id,
                title: post.title,
                text: fullMessageText,
                images: allAttachments
              },
              inlineButtons: post.inlineButtons || (post as any).inline_buttons,
              messageFormat: resolvedFormat,
              images: allAttachments.length > 0 ? JSON.stringify(allAttachments) : null,
              time: nowTime
            })
          });

          if (chatRes.ok) {
            successfulCount++;
          }
        }

        if (successfulCount === 0) {
          throw new Error('Не удалось отправить в личные сообщения');
        }

        targetId = selectedSubTargetIds[0];
        targetName = `${successfulCount} ${successfulCount === 1 ? 'соавтора' : 'соавторов'}`;
      }

      // Record repost counter in PostgreSQL
      const repostEndpoint = post.id.startsWith('post-') 
        ? `/api/social/posts/${post.id}/repost` 
        : `/api/blog/posts/${post.id}/repost`;

      const repRes = await fetch(repostEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          userName: currentUserName,
          targetType,
          targetId,
          targetName,
          count: successfulCount || 1
        })
      });
      const repData = await repRes.json().catch(() => ({}));
      const updatedCount = repData.shares || 1;

      setSuccessMessage(`Публикация успешно отправлена (${targetName})`);
      setTimeout(() => {
        if (onSuccess) onSuccess(targetType, updatedCount);
        if (onRepostSuccess) onRepostSuccess(targetType, updatedCount);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Repost error:', err);
      setErrorMessage(err.message || 'Ошибка выполнения репоста');
    } finally {
      setIsLoading(false);
    }
  };

  const getTargetCount = () => {
    if (activeTab === 'chat') return selectedChatIds.length;
    if (activeTab === 'direct') return selectedSubTargetIds.length;
    return 1;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-sky-950/25 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl rounded-3xl p-5 sm:p-6 border-2 border-pink-400 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'linear-gradient(135deg, rgba(224,242,254,0.94) 0%, rgba(252,231,243,0.94) 25%, rgba(254,237,213,0.94) 50%, rgba(252,231,243,0.94) 75%, rgba(224,242,254,0.94) 100%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-pink-200/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 flex items-center justify-center text-white shadow-xs shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 leading-tight">
                Поделиться публикацией
              </h3>
              <p className="text-[14px] text-slate-600 font-medium">
                Выберите направление отправки репоста
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/80 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="mt-3.5 space-y-3.5 overflow-y-auto pr-1 flex-1">
          {/* Post preview snippet */}
          <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 space-y-1 text-left shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-pink-600 truncate">
                {post.title || 'Публикация'}
              </span>
              <span className={`text-[14px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                resolvedFormat === 'rich' 
                  ? 'bg-purple-100 text-purple-700 border-purple-200' 
                  : 'bg-sky-100 text-sky-700 border-sky-200'
              }`}>
                Формат: {resolvedFormat === 'rich' ? 'Rich' : 'V2'}
              </span>
            </div>
            <p className="text-[14px] text-slate-700 line-clamp-2 leading-snug">
              {formatChatLastMessagePreview({
                text: post.content,
                images: allAttachments,
                fallback: post.title || 'Публикация с вложением',
                maxLength: 140
              })}
            </p>
            {allAttachments.length > 0 && (
              <span className="text-[14px] text-slate-500 font-medium block">
                Вложений: {allAttachments.length}
              </span>
            )}
          </div>

          {/* Navigation tabs (mobile-friendly, minimum 14px text) */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'social', label: 'В соцсети', icon: Share2 },
              ...(currentUser?.id ? [
                { id: 'channels', label: 'В каналы', icon: Radio },
                { id: 'profile', label: 'На стену', icon: UserIcon },
                { id: 'chat', label: 'В чат', icon: Users, badge: selectedChatIds.length > 0 ? selectedChatIds.length : undefined },
                { id: 'direct', label: 'В личку', icon: MessageSquare, badge: selectedSubTargetIds.length > 0 ? selectedSubTargetIds.length : undefined }
              ] : [])
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer relative shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                      : 'bg-white/80 hover:bg-white text-slate-700 border border-pink-200 hover:border-pink-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-[14px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white text-pink-600' : 'bg-pink-500 text-white'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 0: 1-CLICK SOCIAL NETWORKS SHARE & SYSTEM SHARE */}
          {activeTab === 'social' && (
            <div className="space-y-3 text-left">
              {/* Quick actions: System Share Dialog and Copy Full Post */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="p-3 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Открыть системное окно «Поделиться» вашего устройства"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Системное окно «Поделиться»</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFull}
                  className="p-3 rounded-2xl bg-white/90 border border-pink-300 text-slate-800 hover:bg-white font-bold text-[14px] shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Скопировать заголовок, текст поста и ссылку в буфер обмена"
                >
                  {copiedFull ? (
                    <>
                      <Check className="w-4 h-4 text-pink-600 shrink-0" />
                      <span className="text-pink-600">Скопировано в буфер!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>Копировать текст и ссылку</span>
                    </>
                  )}
                </button>
              </div>

              {/* 1-Click Social Networks Selection */}
              <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-extrabold text-slate-900 block">
                    Выбор соцсети в 1 клик:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLinkOnly}
                    className="text-[14px] font-bold text-pink-600 hover:text-pink-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Ссылка скопирована' : 'Только ссылка'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Telegram */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(`${post?.title || 'Публикация в ИИSMM'}\n\n${(post?.content || '').slice(0, 300)}`)}`;
                      handleShareToSocialNetwork('Telegram', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-800 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Send className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Telegram</span>
                  </button>

                  {/* ВКонтакте */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://vk.com/share.php?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post?.title || '')}&comment=${encodeURIComponent((post?.content || '').slice(0, 300))}`;
                      handleShareToSocialNetwork('ВКонтакте', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>ВКонтакте</span>
                  </button>

                  {/* WhatsApp (NO green, styled in soft amber/orange) */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${post?.title || 'Публикация'}\n\n${postUrl}`)}`;
                      handleShareToSocialNetwork('WhatsApp', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Одноклассники */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://connect.ok.ru/offer?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post?.title || '')}`;
                      handleShareToSocialNetwork('Одноклассники', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-orange-50 border border-orange-300 hover:bg-orange-100 text-orange-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Users className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>ОК</span>
                  </button>

                  {/* Twitter / X */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post?.title || '')}`;
                      handleShareToSocialNetwork('X (Twitter)', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-purple-50 border border-purple-300 hover:bg-purple-100 text-purple-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>X (Twitter)</span>
                  </button>

                  {/* Viber */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `viber://forward?text=${encodeURIComponent(`${post?.title || 'Публикация'}\n\n${postUrl}`)}`;
                      handleShareToSocialNetwork('Viber', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-pink-50 border border-pink-300 hover:bg-pink-100 text-pink-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4 text-pink-600 shrink-0" />
                    <span>Viber</span>
                  </button>

                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
                      handleShareToSocialNetwork('Facebook', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Facebook</span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
                      handleShareToSocialNetwork('LinkedIn', shareLink);
                    }}
                    className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 text-indigo-900 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>LinkedIn</span>
                  </button>
                </div>
              </div>

              {!currentUser?.id && (
                <div className="p-3 rounded-2xl bg-white/70 border border-pink-200 text-[14px] text-slate-700 leading-relaxed shadow-2xs">
                  Репост выполняется без регистрации. Счётчик репостов обновится в реальном времени.
                </div>
              )}
            </div>
          )}

          {/* TAB 1: TELEGRAM CHANNELS */}
          {activeTab === 'channels' && (
            <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-200 space-y-2 text-left shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[14px] font-bold text-slate-800">
                  Выберите подключенный канал:
                </label>
                <span className="text-[14px] font-bold text-pink-600">
                  Режим: {resolvedFormat === 'rich' ? 'Rich' : 'V2'}
                </span>
              </div>

              {channels.length > 0 ? (
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  {channels.map((ch, idx) => (
                    <option key={idx} value={ch.username || ch.title}>
                      {ch.title || ch.name} ({ch.username || ch.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-white/70 border border-pink-200 text-[14px] text-slate-600">
                  Каналы загружаются или не подключены. Будет отправлено в основной канал @SAV_AI.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE / WALL */}
          {activeTab === 'profile' && (
            <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-200 text-slate-800 space-y-1.5 text-left shadow-2xs">
              <div className="flex items-center gap-2">
                <img 
                  src={currentUserAvatar} 
                  alt="avatar" 
                  className="w-7 h-7 rounded-full object-cover border border-pink-300 shrink-0" 
                />
                <span className="text-[14px] font-bold text-slate-900">
                  {currentUserName} (ваша страница)
                </span>
              </div>
              <p className="text-[14px] text-slate-600 leading-snug">
                Публикация появится в вашей персональной ленте на стене профиля со ссылкой на первоисточник.
              </p>
            </div>
          )}

          {/* TAB 3: EXISTING USER CHATS (MULTI-SELECT) */}
          {activeTab === 'chat' && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[14px] font-bold text-slate-800">
                  Выберите один или несколько чатов:
                </label>
                {filteredChats.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllChats}
                    className="text-[14px] font-bold text-pink-600 hover:text-pink-700 transition-colors cursor-pointer"
                  >
                    {selectedChatIds.length === filteredChats.length ? 'Снять выбор' : 'Выбрать все'}
                  </button>
                )}
              </div>

              {/* Chat search */}
              <div className="relative">
                <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Поиск по существующим чатам..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>

              {/* Chats list */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredChats.length > 0 ? (
                  filteredChats.map((c) => {
                    const isSelected = selectedChatIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleChatSelection(c.id)}
                        className={`flex items-center justify-between p-2 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-pink-100/90 border-pink-400 shadow-2xs'
                            : 'bg-white/80 border-pink-100 hover:border-pink-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img 
                            src={normalizeProTalkMediaUrl(c.avatar) || BRAND_ASSETS.heartAvatar} 
                            alt={c.name} 
                            className="w-8 h-8 rounded-full object-cover border border-pink-300 shrink-0" 
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[14px] font-bold text-slate-900 truncate block leading-tight">
                              {c.name}
                            </span>
                            <span className="text-[14px] font-medium text-slate-500 truncate block">
                              {c.username || 'чат'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-pink-500" />
                          ) : (
                            <Square className="w-5 h-5 text-pink-300" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-[14px] text-slate-500 bg-white/70 rounded-2xl border border-pink-200">
                    Чаты не найдены
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DIRECT MESSAGE TO SUBSCRIBED ONLY (MULTI-SELECT) */}
          {activeTab === 'direct' && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[14px] font-bold text-slate-800">
                  Выберите соавторов из ваших подписок:
                </label>
                {filteredSubscriptions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllSubs}
                    className="text-[14px] font-bold text-pink-600 hover:text-pink-700 transition-colors cursor-pointer"
                  >
                    {selectedSubTargetIds.length === filteredSubscriptions.length ? 'Снять выбор' : 'Выбрать всех'}
                  </button>
                )}
              </div>

              {/* Subscriptions search field */}
              <div className="relative">
                <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  placeholder="Поиск по подпискам..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>

              {/* Subscriptions list */}
              {isLoadingSubs ? (
                <div className="p-4 text-center text-[14px] text-slate-500 bg-white/70 rounded-2xl border border-pink-200">
                  Загрузка ваших подписок...
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 text-center space-y-2">
                  <p className="text-[14px] font-bold text-slate-800">
                    У вас пока нет подписок
                  </p>
                  <p className="text-[14px] text-slate-600">
                    Вы можете подписаться на соавторов в каталоге авторов, чтобы отправлять им публикации в личные сообщения.
                  </p>
                  <a
                    href="/social/users"
                    onClick={(e) => {
                      e.preventDefault();
                      window.history.pushState(null, '', '/social/users');
                      window.dispatchEvent(new Event('popstate'));
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all"
                  >
                    <span>Перейти в каталог авторов</span>
                  </a>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((sub) => {
                      const subIdStr = String(sub.targetId);
                      const isSelected = selectedSubTargetIds.includes(subIdStr);
                      return (
                        <div
                          key={sub.targetId}
                          onClick={() => toggleSubSelection(subIdStr)}
                          className={`flex items-center justify-between p-2 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-pink-100/90 border-pink-400 shadow-2xs'
                              : 'bg-white/80 border-pink-100 hover:border-pink-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img 
                              src={normalizeProTalkMediaUrl(sub.targetAvatar) || BRAND_ASSETS.heartAvatar} 
                              alt={sub.targetName} 
                              className="w-8 h-8 rounded-full object-cover border border-pink-300 shrink-0" 
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[14px] font-bold text-slate-900 truncate block leading-tight">
                                {sub.targetName}
                              </span>
                              <span className="text-[14px] font-medium text-slate-500 truncate block">
                                {sub.targetUsername ? `@${sub.targetUsername.replace('@', '')}` : 'соавтор'}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 pl-2">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-pink-500" />
                            ) : (
                              <Square className="w-5 h-5 text-pink-300" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-[14px] text-slate-500 bg-white/70 rounded-2xl border border-pink-200">
                      По запросу "{subSearchQuery}" среди ваших подписок никто не найден
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Optional comment text (only for internal tabs) */}
          {activeTab !== 'social' && (
            <div className="space-y-1 text-left">
              <label className="block text-[14px] font-bold text-slate-800">
                Комментарий к репосту (опционально):
              </label>
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Добавьте пару слов от себя к репосту..."
                className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
              />
            </div>
          )}

          {/* Error & Success Alerts */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-pink-100/90 border border-pink-300 text-rose-700 text-[14px] font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-sky-100/90 border border-sky-300 text-sky-800 text-[14px] font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-600" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-3.5 pt-3 border-t border-pink-200/80 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 font-bold text-[14px] border border-pink-200 transition-colors cursor-pointer"
          >
            {activeTab === 'social' ? 'Закрыть' : 'Отмена'}
          </button>

          {activeTab === 'social' ? (
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Поделиться</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecuteRepost}
              disabled={
                isLoading || 
                (activeTab === 'chat' && selectedChatIds.length === 0) ||
                (activeTab === 'direct' && selectedSubTargetIds.length === 0)
              }
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Отправка...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <Send className="w-4 h-4 shrink-0" />
                  <span>
                    Выполнить репост
                    {(activeTab === 'chat' && selectedChatIds.length > 0) ? ` (${selectedChatIds.length})` : ''}
                    {(activeTab === 'direct' && selectedSubTargetIds.length > 0) ? ` (${selectedSubTargetIds.length})` : ''}
                  </span>
                </span>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
