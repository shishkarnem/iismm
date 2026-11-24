import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BRAND_ASSETS, GALLERY_STOCK_IMAGES, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { 
  Users, MessageSquare, Heart, Send, Trash2, Smile, Sparkles, UserPlus, 
  Globe, Image, Share2, Award, ThumbsUp, MoreHorizontal, X, ArrowRight,
  ExternalLink, Bookmark, Shield, Radio, Check, CheckCircle2, MessageCircle, 
  SendHorizontal, Coins, FolderPlus, Settings, AlertCircle, Search, HelpCircle, 
  Lock, RefreshCw, Star, CheckSquare, ChevronLeft, ChevronRight, Paperclip, Bot, Edit3, Mic,
  Bold, Italic, Strikethrough, Code, Eye, EyeOff, Quote, Link2, Compass, FolderHeart, Clock, TrendingUp, LogOut,
  Table, Sliders, Hash, Layers, Reply, Forward, Download, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAccount } from '../types';
import VoiceRecorderModal from './VoiceRecorderModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import MarkdownRenderer, { getInlineButtonStyleClasses } from './MarkdownRenderer';
import RepostModal from './RepostModal';
import ForwardMessageModal, { ForwardMessageData } from './ForwardMessageModal';
import AuthorsCatalog from './AuthorsCatalog';
import CreateGroupChatModal from './CreateGroupChatModal';
import GroupInfoModal from './GroupInfoModal';
import { V2MediaUploadModal, V2MediaAttachment } from './V2MediaUploadModal';
import { ChatGlobalTextToolbar } from './ChatGlobalTextToolbar';
import { RichPreviewRenderer } from './PostTelegramEditor';
import AutoResponderModal from './AutoResponderModal';
import ChatPreviewModal from './ChatPreviewModal';
import ModerationAlertModal from './ModerationAlertModal';
import AudioField from './AudioField';
import { detectPostFormat } from '../utils/formatDetector';
import { formatUserOnlineStatus } from '../utils/userStatus';
import { encryptMessageWithEmoji, decryptMessageWithEmoji, isEmojiEncrypted } from '../utils/cryptoEmoji';
import { 
  ChatTableModal, 
  ChatMediaModal, 
  ChatCarouselModal, 
  ChatCollageModal, 
  ChatAnchorModal, 
  ChatFormulaModal,
  ChatModalType 
} from './ChatFormatModals';
import { ImageBuilderModal } from './image-builder';
import { canUseOtryv, hasRainbowHeart } from '../utils/tariff/tariffUtils';
import { TariffGateModal } from './tariffs/TariffGateBanner';
import { formatChatLastMessagePreview } from '../utils/chat/chatPreviewFormatter';

const BANNED_BOT_NAMES = [
  'дмитрий performance',
  'анна трафик-smm',
  'павел дуров (ии-клон)',
  'павел дуров',
  'sav ai developer',
  'мария сеошница',
  'групповой чат синдиката',
  '@dima_smm',
  '@anna_traffic',
  '@durov_ai',
  '@sav_ai',
  '@mariya_seo',
  '@syndicate_group'
];

export const isBannedAuthor = (name?: string, username?: string) => {
  const n = (name || '').toLowerCase().trim();
  const u = (username || '').toLowerCase().trim();
  return BANNED_BOT_NAMES.some(b => (n && n.includes(b)) || (u && u.includes(b)));
};

export const RainbowHeartIcon = ({ className = "w-5 h-5", id = "rainbow-heart-grad" }: { className?: string; id?: string }) => (
  <img 
    src={BRAND_ASSETS.heartAvatar} 
    alt="Сердечко" 
    className={`${className} object-contain inline-block shrink-0`} 
  />
);

export const parseSafeImagesList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(img => (typeof img === 'string' ? img : (img?.url || '')))
      .filter(img => typeof img === 'string' && img.trim().length > 0);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(img => (typeof img === 'string' ? img : (img?.url || '')))
            .filter(img => typeof img === 'string' && img.trim().length > 0);
        }
      } catch (e) {}
    }
    if (trimmed.length > 0) {
      return [trimmed];
    }
  }
  return [];
};

interface IirkySocialNetworkProps {
  user: UserAccount;
  currentUser?: UserAccount;
  onUpdateUser?: (updated: UserAccount) => void;
  currentPath?: string;
}

interface SocialPost {
  id: string;
  title?: string;
  userId?: string;
  author: {
    id?: string;
    name: string;
    avatar: string;
    username: string;
    isVip?: boolean;
    role?: string;
    tariff?: string;
    hasRainbowHeart?: boolean;
  };
  isPromoted?: boolean;
  content: string;
  image?: string;
  images?: string[];
  backgroundGradient?: string;
  feeling?: string;
  taggedFriends?: string[];
  createdAt: string;
  likes: { [type: string]: number };
  myReaction?: string;
  comments: Array<{
    id: string;
    author: string;
    avatar: string;
    text: string;
    createdAt: string;
  }>;
  sharesCount: number;
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html' | 'auto';
  views?: number;
  inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string; callbackData?: string; style?: string; color?: string; type?: string }>>;
}

const AlbumGrid = ({ images }: { images?: string[] }) => {
  if (!images || images.length === 0) return null;
  
  const count = images.length;
  let gridCols = "grid-cols-2";
  if (count === 1) gridCols = "grid-cols-1";
  else if (count === 3) gridCols = "grid-cols-3";
  else if (count >= 4) gridCols = "grid-cols-2";

  return (
    <div className={`mt-2.5 grid ${gridCols} gap-2 rounded-xl overflow-hidden max-w-lg border border-slate-200 p-1 bg-slate-50`}>
      {images.slice(0, 4).map((img, index) => {
        const isLastAndMore = index === 3 && count > 4;
        return (
          <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200">
            <img src={img} className="w-full h-full object-cover" alt="Attached album detail" />
            {isLastAndMore && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-black text-sm select-none">
                +{count - 4}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface Story {
  id: string;
  authorName: string;
  authorAvatar: string;
  image: string;
  isMe?: boolean;
}

interface VirtualFriend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
  isFriend: boolean;
  isPendingMe?: boolean;
  isPendingThem?: boolean;
  partnerId?: string;
  isGroup?: boolean;
  lastMessage?: string;
  lastTime?: string;
}

interface FloatingChat {
  friendId: string;
  friendName: string;
  friendAvatar: string;
  messages: Array<{
    id: string;
    sender: 'me' | 'them';
    text: string;
    time: string;
    images?: string[];
    senderName?: string;
  }>;
  isMinimized?: boolean;
}

interface EscrowDeal {
  id: string;
  title: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  amount: number;
  description: string;
  status: 'pending_funding' | 'funded' | 'completed' | 'disputed' | 'refunded';
  date: string;
  logs: string[];
}

export default function IirkySocialNetwork({ user, currentUser, onUpdateUser, currentPath = '/social' }: IirkySocialNetworkProps) {
  const activeUser = currentUser || user;
  // --- Active Tab determination from routing path ---
  const getTabFromPath = (path: string) => {
    if (path.includes('/social/users')) return 'users';
    if (path.includes('/social/messages')) return 'messages';
    if (path.includes('/social/deals')) return 'deals';
    if (path.includes('/social/coauthors')) return 'coauthors';
    if (path.includes('/social/saved')) return 'saved';
    return 'feed';
  };

  const activeSocialTab = getTabFromPath(currentPath);

  // Push tab changes back to App.tsx
  const navigateToTab = (tab: 'feed' | 'users' | 'messages' | 'deals' | 'coauthors' | 'saved') => {
    window.history.pushState(null, '', `/social/${tab}`);
    window.dispatchEvent(new Event('popstate'));
  };

  // --- Feed Mode & Sorting States ---
  const [feedMode, setFeedMode] = useState<'all' | 'subscriptions'>('all');
  const [feedSort, setFeedSort] = useState<'date' | 'popularity' | 'author'>('date');
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);

  // Check URL query for tab=subscriptions or /social/feeds
  useEffect(() => {
    if (window.location.search.includes('tab=subscriptions') || currentPath.includes('tab=subscriptions') || currentPath.includes('/social/feeds')) {
      setFeedMode('subscriptions');
    }
  }, [currentPath]);

  // --- Dynamic posts state (only real posts from DB) ---
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isPromoteGateOpen, setIsPromoteGateOpen] = useState(false);
  const [promotingPostId, setPromotingPostId] = useState<string | null>(null);
  const hasOtryvSocialAccess = canUseOtryv(activeUser?.tariff, (activeUser as any)?.role);

  const handleTogglePromoteSocialPost = async (targetPost: SocialPost) => {
    if (!hasOtryvSocialAccess) {
      setIsPromoteGateOpen(true);
      return;
    }
    setPromotingPostId(targetPost.id);
    try {
      const uid = String(activeUser?.id || user.id || '16926299042');
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(targetPost.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          promoted: !targetPost.isPromoted
        })
      });
      const data = await res.json();
      if (res.status === 403 && data?.requiredTariff) {
        setIsPromoteGateOpen(true);
        return;
      }
      if (res.ok && data?.success) {
        const nextPromoted = Boolean(data.isPromoted);
        setPosts(prev =>
          prev.map(p => (p.id === targetPost.id ? { ...p, isPromoted: nextPromoted } : p))
        );
      }
    } catch (err) {
      console.error('Failed to promote post in social feed:', err);
    } finally {
      setPromotingPostId(null);
    }
  };

  // --- Subscriptions Feed States ---
  const [subscribedTargetIds, setSubscribedTargetIds] = useState<Set<string>>(new Set());
  const [subscriptionsSort, setSubscriptionsSort] = useState<'date' | 'author' | 'popularity'>('date');

  // Load subscriptions of current user
  useEffect(() => {
    const fetchMySubscriptions = async () => {
      try {
        const viewerId = currentUser?.id || user.id || '16926299042';
        const res = await fetch(`/api/subscriptions?followerId=${encodeURIComponent(viewerId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.subscriptions)) {
          const ids = new Set<string>(data.subscriptions.map((s: any) => String(s.targetId)));
          setSubscribedTargetIds(ids);
        }
      } catch (err) {
        console.error('Error fetching subscriptions:', err);
      }
    };
    fetchMySubscriptions();
  }, [currentUser?.id, user.id]);

  // Load duplicated and public blog posts into social feed (excluding banned bots)
  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const res = await fetch('/api/blog/posts?limit=50');
        const data = await res.json();
        if (data.success && Array.isArray(data.posts) && data.posts.length > 0) {
          const mappedPosts: SocialPost[] = data.posts
            .filter((p: any) => !isBannedAuthor(p.author?.name, p.author?.username))
            .map((p: any) => {
              const authorName = p.author?.name || 'Автор ИИSMM';
              let authorUsername = p.author?.username;
              if (authorUsername) {
                authorUsername = authorUsername.startsWith('@') ? authorUsername : `@${authorUsername}`;
              } else {
                authorUsername = `@${authorName.toLowerCase().replace(/\s+/g, '_')}`;
              }

              return {
                id: p.id,
                title: p.title || p.promptTitle || '',
                userId: p.author?.id || p.author_id || p.userId,
                slug: p.slug,
                isPromoted: Boolean(p.isPromoted || p.is_promoted),
                author: {
                  id: p.author?.id || p.author_id,
                  name: authorName,
                  username: authorUsername,
                  avatar: normalizeProTalkMediaUrl(p.author?.avatar) || BRAND_ASSETS.logo,
                  role: p.author?.role,
                  tariff: p.author?.tariff,
                  hasRainbowHeart: Boolean(p.author?.hasRainbowHeart)
                },
                content: p.content || p.desc || '',
                image: p.attachmentUrl || p.image,
                images: p.attachmentUrls || (p.album ? p.album.map((a: any) => a.url) : undefined),
                createdAt: p.dateStr || 'Недавно',
                likes: p.reactions || { like: p.likes || 1 },
                myReaction: p.myReaction,
                comments: (p.comments || []).filter((c: any) => !isBannedAuthor(c.author)),
                sharesCount: Number(p.sharesCount || p.shares || 0),
                views: Number(p.views || 0),
                messageFormat: detectPostFormat(p.content || p.desc, p.messageFormat),
                inlineButtons: p.inlineButtons || p.inline_buttons || (p.inline_buttons_json ? (typeof p.inline_buttons_json === 'string' ? JSON.parse(p.inline_buttons_json) : p.inline_buttons_json) : undefined)
              };
            });

          setPosts(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const newOnes = mappedPosts.filter(m => !existingIds.has(m.id));
            return [...newOnes, ...prev];
          });
        }
      } catch (err) {
        console.error('Failed to load blog posts into social feed:', err);
      }
    };
    fetchBlogPosts();
  }, []);

  // --- Friends and Chats Database ---
  const [virtualFriends, setVirtualFriends] = useState<VirtualFriend[]>([
    {
      id: 'group-smm',
      name: 'ИИSMM',
      username: '@iismm_chat',
      avatar: BRAND_ASSETS.logo,
      status: 'online',
      bio: 'Общий чат всех пользователей платформы ИИSMM (@iismm_chat)',
      isFriend: true,
      isGroup: true
    }
  ]);

  // Load user chats from PostgreSQL
  const fetchUserChats = useCallback(async () => {
    const myId = String(currentUser?.id || user.id || '16926299042');
    try {
      const res = await fetch(`/api/user/chats?userId=${encodeURIComponent(myId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        const validChats = data.chats.filter((c: any) => !isBannedAuthor(c.name, c.username));
        setVirtualFriends(validChats.map((c: any) => {
          const isSaved = c.username === 'saved_messages' || (c.name && c.name.includes('Избранное'));
          const resolvedAvatar = isSaved
            ? (normalizeProTalkMediaUrl(currentUser?.avatarUrl || user.avatarUrl || c.avatar) || BRAND_ASSETS.heartAvatar)
            : (normalizeProTalkMediaUrl(c.avatar) || BRAND_ASSETS.logo);
          return {
            id: c.id,
            name: c.name,
            username: c.username,
            avatar: resolvedAvatar,
            status: c.status || 'online',
            bio: c.bio || '',
            isFriend: true,
            partnerId: c.partnerId || c.id,
            isGroup: Boolean(c.isGroup || c.id.startsWith('gr') || c.id.includes('group')),
            lastMessage: c.lastMessage || '',
            lastTime: c.lastTime || ''
          };
        }));
      }
    } catch (err) {
      console.error('Failed to load chats from DB:', err);
    }
  }, [currentUser?.id, user.id, currentUser?.avatarUrl, user.avatarUrl]);

  useEffect(() => {
    fetchUserChats();
  }, [fetchUserChats]);

  // Subscription warning modal state for direct chats
  const [chatSubscriptionWarning, setChatSubscriptionWarning] = useState<{
    targetId: string;
    name: string;
    username: string;
    avatar: string;
  } | null>(null);

  // Select chat and update browser URL to /social/messages/:chatId
  const handleSelectChat = async (buddy: VirtualFriend) => {
    const isGroupOrSpecial = buddy.isGroup || 
      buddy.id.startsWith('gr') || 
      buddy.id === 'group-smm' || 
      buddy.username === 'saved_messages' ||
      buddy.id === activeUser.id ||
      buddy.partnerId === activeUser.id;

    if (!isGroupOrSpecial) {
      const myId = String(currentUser?.id || user.id || '16926299042');
      const partnerTargetId = buddy.partnerId || buddy.id;
      try {
        const checkRes = await fetch(`/api/subscriptions/check?followerId=${encodeURIComponent(myId)}&targetId=${encodeURIComponent(partnerTargetId)}`);
        const checkData = await checkRes.json();
        if (checkData && checkData.success && !checkData.isSubscribed) {
          setChatSubscriptionWarning({
            targetId: partnerTargetId,
            name: buddy.name,
            username: buddy.username,
            avatar: buddy.avatar
          });
          return;
        }
      } catch (e) {
        console.warn('Subscription check failed:', e);
      }
    }

    setActiveChatFriendId(buddy.id);
    const chatUrlId = (buddy.isGroup || buddy.id.startsWith('gr'))
      ? (buddy.id.startsWith('gr') ? buddy.id : `gr${buddy.id.replace(/\D/g, '') || 'iismm'}`)
      : (buddy.partnerId || buddy.id);
    window.history.pushState(null, '', `/social/messages/${chatUrlId}`);
    window.dispatchEvent(new Event('popstate'));
  };

  // Sync active chat when user navigates directly to /social/messages/:chatId
  useEffect(() => {
    if (currentPath.includes('/social/messages')) {
      const match = currentPath.match(/\/social\/messages\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] && match[1] !== 'messages') {
        const routeChatId = match[1];
        const existing = virtualFriends.find(f => 
          f.id === routeChatId || 
          f.partnerId === routeChatId || 
          f.username.replace('@', '').toLowerCase() === routeChatId.toLowerCase()
        );
        if (existing) {
          setActiveChatFriendId(existing.id);
        } else if (routeChatId.startsWith('gr')) {
          const grFriend: VirtualFriend = {
            id: routeChatId,
            name: `Групповой чат #${routeChatId}`,
            username: `@${routeChatId}`,
            avatar: BRAND_ASSETS.logo,
            status: 'online',
            bio: 'Групповой чат соавторов',
            isFriend: true,
            isGroup: true
          };
          setVirtualFriends(prev => [grFriend, ...prev.filter(p => p.id !== routeChatId)]);
          setActiveChatFriendId(routeChatId);
        } else {
          const myId = String(currentUser?.id || user.id || '16926299042');

          if (routeChatId !== myId && !routeChatId.startsWith('gr') && routeChatId !== 'group-smm' && routeChatId !== 'saved_messages') {
            fetch(`/api/subscriptions/check?followerId=${encodeURIComponent(myId)}&targetId=${encodeURIComponent(routeChatId)}`)
              .then(res => res.json())
              .then(subData => {
                if (subData && subData.success && !subData.isSubscribed) {
                  fetch(`/api/authors/catalog?page=1&limit=100`)
                    .then(r => r.json())
                    .then(catData => {
                      const foundAuthor = catData?.authors?.find((a: any) => 
                        String(a.id) === routeChatId || 
                        (a.telegramId && String(a.telegramId) === routeChatId) ||
                        a.username?.replace('@', '').toLowerCase() === routeChatId.toLowerCase()
                      );
                      setChatSubscriptionWarning({
                        targetId: routeChatId,
                        name: foundAuthor?.name || 'Соавтор',
                        username: foundAuthor?.username || `@${routeChatId}`,
                        avatar: normalizeProTalkMediaUrl(foundAuthor?.avatar) || BRAND_ASSETS.heartAvatar
                      });
                    })
                    .catch(() => {
                      setChatSubscriptionWarning({
                        targetId: routeChatId,
                        name: 'Соавтор',
                        username: `@${routeChatId}`,
                        avatar: BRAND_ASSETS.heartAvatar
                      });
                    });
                }
              })
              .catch(console.warn);
          }

          fetch('/api/user/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId, partnerId: routeChatId })
          })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.chat) {
                const newFriend: VirtualFriend = {
                  id: data.chat.id,
                  partnerId: data.chat.partnerId || routeChatId,
                  name: data.chat.name,
                  username: data.chat.username,
                  avatar: normalizeProTalkMediaUrl(data.chat.avatar) || BRAND_ASSETS.heartAvatar,
                  status: 'online',
                  bio: 'Личный диалог с соавтором',
                  isFriend: true
                };
                setVirtualFriends(prev => [newFriend, ...prev.filter(p => p.id !== newFriend.id)]);
                setActiveChatFriendId(newFriend.id);
              }
            })
            .catch(() => {
              setActiveChatFriendId(routeChatId);
            });
        }
      }
    }
  }, [currentPath, virtualFriends.length]);

  // --- Stories Database ---
  const stories: Story[] = [
    {
      id: 's-me',
      authorName: 'Вы',
      authorAvatar: normalizeProTalkMediaUrl(user.userAvatar || user.photoUrl || user.avatarUrl) || BRAND_ASSETS.heartAvatar,
      image: BRAND_ASSETS.socialLight,
      isMe: true
    }
  ];

  // --- Page - Interactive Full Messaging System ---
  const [activeChatFriendId, setActiveChatFriendId] = useState<string>('group-smm');
  const [chatHistories, setChatHistories] = useState<{ [friendId: string]: Array<{ id: string; sender: 'me' | 'them' | 'system'; text: string; time: string; images?: string[]; senderName?: string; senderAvatar?: string; mediaUrl?: string; mediaType?: string; replyTo?: any; forwardedFrom?: any; inlineButtons?: any; messageFormat?: string; reactions?: any[]; moderationStatus?: 'checking' | 'approved' | 'violation' }> }>({
    'group-smm': []
  });
  const [currentMessageInputText, setCurrentMessageInputText] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyPrompt, setAutoReplyPrompt] = useState('Я сейчас немного занят. Напишу через пару минут!');
  const [isTyping, setIsTyping] = useState(false);
  const [messagesSubTab, setMessagesSubTab] = useState<'all' | 'unread'>('all');
  const [unreadChatIds, setUnreadChatIds] = useState<string[]>([]);
  
  // Mobile drawer for chat list per user requirement
  const [isMobileChatsDrawerOpen, setIsMobileChatsDrawerOpen] = useState(false);

  // Chat AI image generation state (Function 621, 10 AI coins)
  const [isChatAiImageModalOpen, setIsChatAiImageModalOpen] = useState(false);
  const [chatAiImagePrompt, setChatAiImagePrompt] = useState('');
  const [isGeneratingChatAiImage, setIsGeneratingChatAiImage] = useState(false);
  const [chatAiImageStatus, setChatAiImageStatus] = useState<string | null>(null);
  const [chatAiImageDownloadUrl, setChatAiImageDownloadUrl] = useState<string | null>(null);

  const handleGenerateChatImage = async () => {
    if (!chatAiImagePrompt.trim()) {
      setChatAiImageStatus('Пожалуйста, укажите промпт для генерации');
      return;
    }
    setIsGeneratingChatAiImage(true);
    setChatAiImageStatus(null);
    try {
      const cleanUserId = currentUser?.id || user?.id || '16926299042';
      const res = await fetch('/api/protalk/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: chatAiImagePrompt.trim(),
          userId: cleanUserId,
          telegramId: currentUser?.telegramId || user?.telegramId,
          prefix: 'chat_img_'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации картинки');
      const imgUrl = data.imageUrl;
      setChatAiImageDownloadUrl(data.downloadUrl || imgUrl);
      setChatAttachedImages(prev => [...prev, imgUrl]);
      setIsChatAiImageModalOpen(false);
      setChatAiImagePrompt('');
    } catch (e: any) {
      setChatAiImageStatus(e.message || 'Ошибка при генерации изображения');
    } finally {
      setIsGeneratingChatAiImage(false);
    }
  };

  // Dual search state for messages
  const [authorsSearchText, setAuthorsSearchText] = useState('');
  const [chatsSearchText, setChatsSearchText] = useState('');
  const [searchedAuthors, setSearchedAuthors] = useState<Array<{ id: string; name: string; username: string; avatar: string; email?: string }>>([]);
  const [isSearchingAuthors, setIsSearchingAuthors] = useState(false);

  // Search authors across platform users in DB
  const handleAuthorsSearch = async (val: string) => {
    setAuthorsSearchText(val);
    if (!val.trim()) {
      setSearchedAuthors([]);
      return;
    }
    setIsSearchingAuthors(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(val.trim())}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const filtered = data.users.filter((u: any) => !isBannedAuthor(u.name, u.username));
        setSearchedAuthors(filtered);
      } else {
        setSearchedAuthors([]);
      }
    } catch (e) {
      console.error('Authors search error:', e);
    } finally {
      setIsSearchingAuthors(false);
    }
  };

  // Start direct chat with selected author
  const handleSelectAuthorForChat = async (targetUser: { id: string; name: string; username: string; avatar: string }) => {
    try {
      const myId = String(currentUser?.id || user.id || '16926299042');
      const res = await fetch('/api/chat/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1Id: myId,
          user2Id: targetUser.id,
          user2Name: targetUser.name,
          user2Username: targetUser.username,
          user2Avatar: targetUser.avatar
        })
      });
      const data = await res.json();
      if (data.success && data.chat) {
        const chatId = data.chat.id;
        setVirtualFriends(prev => {
          if (prev.some(b => b.id === chatId)) return prev;
          return [
            ...prev,
            {
              id: chatId,
              name: data.chat.name || targetUser.name,
              username: data.chat.username || (targetUser.username.startsWith('@') ? targetUser.username : `@${targetUser.username}`),
              avatar: normalizeProTalkMediaUrl(data.chat.avatar || targetUser.avatar) || BRAND_ASSETS.heartAvatar,
              status: 'online',
              bio: 'Личный чат',
              isFriend: true
            }
          ];
        });
        setActiveChatFriendId(chatId);
        setAuthorsSearchText('');
        setSearchedAuthors([]);
      }
    } catch (err) {
      console.error('Failed to open direct chat:', err);
    }
  };

  // Repost modal state
  const [repostModalPost, setRepostModalPost] = useState<SocialPost | null>(null);

  // Group Info Modal state
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [activeGroupModalId, setActiveGroupModalId] = useState<string>('');

  // Personal Chat Privacy / Status state
  const [activePersonalChatBlocked, setActivePersonalChatBlocked] = useState(false);
  const [activePersonalChatBlockedByThem, setActivePersonalChatBlockedByThem] = useState(false);

  // Check personal chat block status when active chat changes
  useEffect(() => {
    const buddy = virtualFriends.find(f => f.id === activeChatFriendId);
    if (!buddy || buddy.isGroup || buddy.id.startsWith('gr') || buddy.id === 'group-smm' || buddy.username === 'saved_messages') {
      setActivePersonalChatBlocked(false);
      setActivePersonalChatBlockedByThem(false);
      return;
    }
    const myId = String(currentUser?.id || user.id || '16926299042');
    const partnerId = buddy.partnerId || buddy.id;
    fetch(`/api/user/chats/personal/status?userId=${encodeURIComponent(myId)}&partnerId=${encodeURIComponent(partnerId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setActivePersonalChatBlocked(Boolean(data.blockedByMe));
          setActivePersonalChatBlockedByThem(Boolean(data.blockedByThem));
        }
      })
      .catch(e => console.error('Personal chat status error:', e));
  }, [activeChatFriendId, virtualFriends, currentUser?.id, user.id]);

  // Periodic user heartbeat for online presence
  useEffect(() => {
    const myId = String(currentUser?.id || user.id || '16926299042');
    if (!myId) return;
    const sendHeartbeat = () => {
      fetch('/api/user/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId })
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [currentUser?.id, user.id]);

  const handleToggleBlockPersonalChat = async () => {
    const buddy = virtualFriends.find(f => f.id === activeChatFriendId);
    if (!buddy) return;
    const myId = String(currentUser?.id || user.id || '16926299042');
    const partnerId = buddy.partnerId || buddy.id;
    try {
      const res = await fetch('/api/user/chats/personal/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, partnerId })
      });
      const data = await res.json();
      if (data.success) {
        setActivePersonalChatBlocked(Boolean(data.isBlocked));
      }
    } catch (e) {
      console.error('Toggle block error:', e);
    }
  };

  const handleLeavePersonalChat = async () => {
    const buddy = virtualFriends.find(f => f.id === activeChatFriendId);
    if (!buddy) return;
    if (!window.confirm('Скрыть этот диалог из списка чатов?')) return;
    const myId = String(currentUser?.id || user.id || '16926299042');
    const partnerId = buddy.partnerId || buddy.id;
    try {
      const res = await fetch('/api/user/chats/personal/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, partnerId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchUserChats();
        setActiveChatFriendId('group-smm');
      }
    } catch (e) {
      console.error('Leave personal chat error:', e);
    }
  };

  // Chat message formatting state (Markdown V2 / Rich)
  const [chatFormatMode, setChatFormatMode] = useState<'v2' | 'rich'>('v2');
  const [showChatFormatToolbar, setShowChatFormatToolbar] = useState<boolean>(true);
  const [activeChatFormatModal, setActiveChatFormatModal] = useState<ChatModalType | null>(null);

  const handleApplyChatConstructorSnippet = (snippet: string) => {
    if (!snippet) {
      setActiveChatFormatModal(null);
      return;
    }
    const input = document.getElementById('chat-message-input') as HTMLInputElement;
    const text = currentMessageInputText;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const nextText = before + snippet + after;
    setCurrentMessageInputText(nextText);
    setActiveChatFormatModal(null);
    setTimeout(() => {
      if (input) {
        input.focus();
        const cursor = start + snippet.length;
        input.setSelectionRange(cursor, cursor);
      }
    }, 30);
  };

  // Helper for applying Markdown formatting in chat input
  const applyChatFormat = (formatType: 'bold' | 'italic' | 'strike' | 'code' | 'spoiler' | 'quote' | 'link') => {
    const input = document.getElementById('chat-message-input') as HTMLInputElement;
    const text = currentMessageInputText;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const selected = text.substring(start, end) || 'текст';

    let formatted = '';
    if (chatFormatMode === 'v2') {
      switch (formatType) {
        case 'bold': formatted = `*${selected}*`; break;
        case 'italic': formatted = `_${selected}_`; break;
        case 'strike': formatted = `~${selected}~`; break;
        case 'code': formatted = `\`${selected}\``; break;
        case 'spoiler': formatted = `||${selected}||`; break;
        case 'quote': formatted = `\n> ${selected}\n`; break;
        case 'link': formatted = `[${selected}](https://)`; break;
      }
    } else {
      switch (formatType) {
        case 'bold': formatted = `**${selected}**`; break;
        case 'italic': formatted = `*${selected}*`; break;
        case 'strike': formatted = `~~${selected}~~`; break;
        case 'code': formatted = `\`${selected}\``; break;
        case 'spoiler': formatted = `||${selected}||`; break;
        case 'quote': formatted = `\n> ${selected}\n`; break;
        case 'link': formatted = `[${selected}](https://)`; break;
      }
    }

    const nextText = text.substring(0, start) + formatted + text.substring(end);
    setCurrentMessageInputText(nextText);
    setTimeout(() => {
      if (input) {
        input.focus();
        const cursor = start + formatted.length;
        input.setSelectionRange(cursor, cursor);
      }
    }, 10);
  };

  // Premium In-App Toast Notification state
  const [premiumToast, setPremiumToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<any>(null);

  const customAlertShadow = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    let derivedType = type;
    const lower = message.toLowerCase();
    if (lower.includes('ошиб') || lower.includes('недостаточно') || lower.includes('огранич') || lower.includes('отклонена') || lower.includes('неверн')) {
      derivedType = 'error';
    } else if (lower.includes('удален') || lower.includes('отмен') || lower.includes('отклонен')) {
      derivedType = 'info';
    }

    setPremiumToast({ message, type: derivedType });
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    const tid = setTimeout(() => {
      setPremiumToast(null);
    }, 4500);
    setToastTimeoutId(tid);
  };

  // Shadow standard window.alert
  const alert = (msg: string) => {
    customAlertShadow(msg);
  };

  // SMM grid premium attachments preview, replies and forwarding states
  const [activeImagePreviewUrl, setActiveImagePreviewUrl] = useState<string | null>(null);
  const [activePreviewAlbum, setActivePreviewAlbum] = useState<string[]>([]);
  const [currentAlbumIndex, setCurrentAlbumIndex] = useState<number>(0);

  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string; sender: 'me' | 'them'; text: string; senderName?: string } | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ForwardMessageData | null>(null);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<{ id: string; sender: 'me' | 'them'; text: string; senderName?: string; images?: string[]; reactions?: any[] } | null>(null);
  const [reactionsModalPage, setReactionsModalPage] = useState<number>(1);
  const [msgClickPos, setMsgClickPos] = useState<{ x: number; y: number } | null>(null);
  const [showAutoReplyModal, setShowAutoReplyModal] = useState(false);
  const [isChatPreviewOpen, setIsChatPreviewOpen] = useState(false);

  // Real-time Chat Message Reactions toggle & DB persistence
  const handleToggleMessageReaction = async (msgId: string, reactionType: string) => {
    const myId = String(currentUser?.id || user?.id || '16926299042');
    const myName = currentUser?.name || user?.name || 'Вы';
    const myAvatar = normalizeProTalkMediaUrl(currentUser?.avatar || user?.avatar) || BRAND_ASSETS.heartAvatar;

    // 1. Optimistic update local chat history
    setChatHistories(prev => {
      const list = prev[activeChatFriendId] || [];
      const updated = list.map(m => {
        if (m.id === msgId) {
          const currentReactions: any[] = (m as any).reactions || [];
          const existingIdx = currentReactions.findIndex((r: any) => {
            const rUserId = typeof r === 'string' ? '' : r.userId;
            const rType = typeof r === 'string' ? r : r.type;
            return String(rUserId) === String(myId) && rType === reactionType;
          });

          let newReactions: any[];
          if (existingIdx >= 0) {
            newReactions = currentReactions.filter((_, i) => i !== existingIdx);
          } else {
            const withoutMyOther = currentReactions.filter((r: any) => {
              const rUserId = typeof r === 'string' ? '' : r.userId;
              return String(rUserId) !== String(myId);
            });
            newReactions = [
              ...withoutMyOther,
              {
                type: reactionType,
                userId: myId,
                userName: myName,
                userAvatar: myAvatar,
                time: new Date().toISOString()
              }
            ];
          }
          return { ...m, reactions: newReactions };
        }
        return m;
      });
      return { ...prev, [activeChatFriendId]: updated };
    });

    // 2. Optimistic update selectedMessageForAction popup
    setSelectedMessageForAction(prev => {
      if (!prev || prev.id !== msgId) return prev;
      const currentReactions: any[] = (prev as any).reactions || [];
      const existingIdx = currentReactions.findIndex((r: any) => {
        const rUserId = typeof r === 'string' ? '' : r.userId;
        const rType = typeof r === 'string' ? r : r.type;
        return String(rUserId) === String(myId) && rType === reactionType;
      });

      let newReactions: any[];
      if (existingIdx >= 0) {
        newReactions = currentReactions.filter((_, i) => i !== existingIdx);
      } else {
        const withoutMyOther = currentReactions.filter((r: any) => {
          const rUserId = typeof r === 'string' ? '' : r.userId;
          return String(rUserId) !== String(myId);
        });
        newReactions = [
          ...withoutMyOther,
          {
            type: reactionType,
            userId: myId,
            userName: myName,
            userAvatar: myAvatar,
            time: new Date().toISOString()
          }
        ];
      }
      return { ...prev, reactions: newReactions };
    });

    // 3. Save to database via API
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(msgId)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatFriendId,
          type: reactionType,
          userId: myId,
          userName: myName,
          userAvatar: myAvatar
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.reactions)) {
        setChatHistories(prev => {
          const list = prev[activeChatFriendId] || [];
          const updated = list.map(m => m.id === msgId ? { ...m, reactions: data.reactions } : m);
          return { ...prev, [activeChatFriendId]: updated };
        });
        setSelectedMessageForAction(prev => {
          if (!prev || prev.id !== msgId) return prev;
          return { ...prev, reactions: data.reactions };
        });
      }
    } catch (err) {
      console.error('Error saving reaction to PostgreSQL DB:', err);
    }
  };

  const handleOpenImagePreview = (clickedImg: string, album: string[] = []) => {
    setActiveImagePreviewUrl(clickedImg);
    setActivePreviewAlbum(album.length > 0 ? album : [clickedImg]);
    const idx = album.indexOf(clickedImg);
    setCurrentAlbumIndex(idx >= 0 ? idx : 0);
  };

  // Protalk Media Loader state for photos, videos, voice messages, files
  const [isV2MediaModalOpen, setIsV2MediaModalOpen] = useState(false);
  const chatMessageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  const adjustChatTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 44), 220);
    el.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustChatTextareaHeight(chatMessageInputRef.current);
  }, [currentMessageInputText]);

  const handleChatTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter: Send message immediately
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendFullChatMessage(e);
      return;
    }

    // Enter without Ctrl/Cmd: Inserts newline (paragraph) without sending the message!
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.stopPropagation();
      setTimeout(() => {
        adjustChatTextareaHeight(chatMessageInputRef.current);
      }, 0);
    }
  };

  const [protalkMediaFile, setProtalkMediaFile] = useState<{
    url: string;
    type: 'photo' | 'video' | 'voice' | 'file';
    name: string;
    progress: number;
    isUploading: boolean;
  } | null>(null);

  const handleV2MediaAttached = (attachment: V2MediaAttachment) => {
    if (attachment.type === 'album' && attachment.urls) {
      setChatAttachedImages(prev => [...prev, ...attachment.urls!].slice(0, 10));
    } else if (attachment.files && attachment.files.length > 0) {
      // If multiple audio tracks or documents selected
      const firstFile = attachment.files[0];
      const mappedType: 'photo' | 'video' | 'voice' | 'file' = 
        attachment.type === 'video' ? 'video' : 
        attachment.type === 'audio' ? 'voice' : 'file';
      
      setProtalkMediaFile({
        url: firstFile.url,
        type: mappedType,
        name: attachment.files.length > 1 ? `${firstFile.name} (+${attachment.files.length - 1} файлов)` : firstFile.name,
        progress: 100,
        isUploading: false
      });

      // If user selected multiple, append subsequent files as text links in input
      if (attachment.files.length > 1) {
        const otherFilesText = attachment.files.slice(1).map(f => `[${f.name}](${f.url})`).join('\n');
        setCurrentMessageInputText(prev => prev ? `${prev}\n${otherFilesText}` : otherFilesText);
      }
    } else if (attachment.url) {
      if (attachment.type === 'photo') {
        setChatAttachedImages(prev => [...prev, attachment.url!].slice(0, 10));
      } else {
        const mappedType: 'photo' | 'video' | 'voice' | 'file' = 
          attachment.type === 'video' ? 'video' : 
          attachment.type === 'audio' ? 'voice' : 'file';
        setProtalkMediaFile({
          url: attachment.url,
          type: mappedType,
          name: attachment.name || 'Медиа файл',
          progress: 100,
          isUploading: false
        });
      }
    }
    setIsV2MediaModalOpen(false);
  };

  const handleProtalkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let mediaType: 'photo' | 'video' | 'voice' | 'file' = 'file';
    if (file.type.startsWith('image/')) mediaType = 'photo';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'voice';

    const objectUrl = URL.createObjectURL(file);
    setProtalkMediaFile({
      url: objectUrl,
      type: mediaType,
      name: file.name,
      progress: 15,
      isUploading: true
    });

    let p = 15;
    const interval = setInterval(() => {
      p += 25;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setProtalkMediaFile(prev => prev ? { ...prev, progress: 100, isUploading: false } : null);
      } else {
        setProtalkMediaFile(prev => prev ? { ...prev, progress: p } : null);
      }
    }, 150);
  };

  // Fetch persisted chat messages from PostgreSQL DB
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = () => {
      fetch(`/api/chat/messages?chatId=${encodeURIComponent(activeChatFriendId)}`)
        .then(res => res.json())
        .then(dbMsgs => {
          if (isMounted && Array.isArray(dbMsgs)) {
            const formatted = dbMsgs.map((m: any) => ({
              id: String(m.id),
              sender: m.sender as 'me' | 'them',
              senderName: m.senderName || m.sender_name || undefined,
              senderAvatar: m.senderAvatar || m.sender_avatar || undefined,
              text: m.text || '',
              time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              images: parseSafeImagesList(m.images || m.images_json),
              mediaUrl: m.mediaUrl || m.media_url || undefined,
              mediaType: m.mediaType || m.media_type || undefined,
              messageFormat: m.messageFormat || m.message_format || 'v2',
              replyTo: m.replyTo || (m.reply_to_json ? (typeof m.reply_to_json === 'string' ? JSON.parse(m.reply_to_json) : m.reply_to_json) : undefined),
              forwardedFrom: m.forwardedFrom || (m.forwarded_json ? (typeof m.forwarded_json === 'string' ? JSON.parse(m.forwarded_json) : m.forwarded_json) : undefined),
              inlineButtons: m.inlineButtons || (m.inline_buttons_json ? (typeof m.inline_buttons_json === 'string' ? JSON.parse(m.inline_buttons_json) : m.inline_buttons_json) : (m.inline_buttons ? (typeof m.inline_buttons === 'string' ? JSON.parse(m.inline_buttons) : m.inline_buttons) : undefined)),
              reactions: Array.isArray(m.reactions) ? m.reactions : (m.reactions_json ? (typeof m.reactions_json === 'string' ? JSON.parse(m.reactions_json) : m.reactions_json) : [])
            }));
            setChatHistories(prev => {
              const currentList = prev[activeChatFriendId] || [];
              const now = Date.now();
              const checkingMsgs = currentList.filter(c => {
                if (c.moderationStatus !== 'checking') return false;
                const ts = (c as any).createdAtTimestamp || 0;
                return ts === 0 || (now - ts < 20000);
              });
              const combined = [...formatted];
              checkingMsgs.forEach(c => {
                // Check by ID or matching sender + text to prevent duplicate bubbles during moderation
                const alreadyExists = combined.some(item => item.id === c.id || (item.sender === 'me' && item.text === c.text));
                if (!alreadyExists) {
                  combined.push(c);
                }
              });
              return {
                ...prev,
                [activeChatFriendId]: combined
              };
            });
          }
        })
        .catch(err => console.error('Error fetching chat messages from DB:', err));
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);

    return () => { 
      isMounted = false; 
      clearInterval(interval);
    };
  }, [activeChatFriendId]);

  // Clear unread mark on opening chat
  useEffect(() => {
    if (activeChatFriendId) {
      setUnreadChatIds(prev => prev.filter(id => id !== activeChatFriendId));
    }
  }, [activeChatFriendId]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Handle Voice Recording Processed from ProTalk STT Modal
  const handleVoiceProcessed = (result: { url: string; text: string }) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userText = result.text ? result.text : '🎤 Голосовое сообщение';
    const targetChatId = activeChatFriendId;
    const clientTempId = `full-m-voice-${Date.now()}`;
    
    const newMsg = {
      id: clientTempId,
      sender: 'me' as const,
      senderName: user?.name || 'Вы',
      text: userText,
      time: timeNow,
      mediaUrl: result.url,
      mediaType: 'voice' as const,
      moderationStatus: 'checking' as const,
      createdAtTimestamp: Date.now()
    };

    setChatHistories(prev => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), newMsg]
    }));

    // Save voice message to PostgreSQL DB and trigger moderation
    const userUid = currentUser?.id || user?.id || '16926299042';
    fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: clientTempId,
        chatId: targetChatId,
        sender: 'me',
        userId: userUid,
        senderId: userUid,
        senderName: user?.name || 'Вы',
        text: userText,
        mediaUrl: result.url,
        mediaType: 'voice',
        time: timeNow
      })
    })
      .then(async (res) => {
        const saved = await res.json().catch(() => null);
        if (!res.ok || saved?.deleted || saved?.status === 'violation') {
          // Immediately remove rejected message from chat without stuck spinner
          setChatHistories(prev => ({
            ...prev,
            [targetChatId]: (prev[targetChatId] || []).filter(m => m.id !== clientTempId)
          }));
          customAlertShadow(saved?.error || 'Сообщение удалено ИИ-модератором за нарушение правил', 'error');
          return;
        }

        const savedId = saved?.id ? String(saved.id) : clientTempId;
        setChatHistories(prev => ({
          ...prev,
          [targetChatId]: (prev[targetChatId] || []).map(m => 
            (m.id === clientTempId || m.id === savedId)
              ? { ...m, id: savedId, moderationStatus: 'approved' as const }
              : m
          )
        }));
      })
      .catch((e) => {
        console.error('Failed to save voice message to DB:', e);
        setChatHistories(prev => ({
          ...prev,
          [targetChatId]: (prev[targetChatId] || []).map(m => 
            m.id === clientTempId ? { ...m, moderationStatus: 'approved' as const } : m
          )
        }));
      });
  };

  // Handle send message on full page messaging
  const handleSendFullChatMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentMessageInputText.trim() && chatAttachedImages.length === 0 && !protalkMediaFile) return;

    const userMessageText = currentMessageInputText;
    const targetChatId = activeChatFriendId;
    const clientTempId = `full-m-${Date.now()}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const attached = chatAttachedImages.length > 0 ? chatAttachedImages : undefined;

    const mediaUrl = protalkMediaFile?.url;
    const mediaType = protalkMediaFile?.type;

    const replyData = replyingToMessage 
      ? {
          text: replyingToMessage.text,
          senderName: replyingToMessage.senderName || (replyingToMessage.sender === 'me' ? 'Вы' : (virtualFriends.find(f => f.id === targetChatId)?.name || 'Соавтор'))
        }
      : undefined;

    const newMsg = {
      id: clientTempId, 
      sender: 'me' as const, 
      senderName: user?.name || 'Вы',
      text: userMessageText, 
      time: timeNow, 
      images: attached,
      mediaUrl,
      mediaType,
      messageFormat: chatFormatMode,
      replyTo: replyData,
      moderationStatus: 'checking' as const,
      createdAtTimestamp: Date.now()
    };

    setChatHistories(prev => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), newMsg]
    }));

    // Save to PostgreSQL DB and run ProTalk AI moderation
    const userUid = currentUser?.id || user?.id || '16926299042';
    fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: clientTempId,
        chatId: targetChatId,
        sender: 'me',
        userId: userUid,
        senderId: userUid,
        senderName: user?.name || 'Вы',
        text: userMessageText,
        messageFormat: chatFormatMode,
        images: attached ? JSON.stringify(attached) : null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        replyTo: replyData ? JSON.stringify(replyData) : null,
        time: timeNow
      })
    })
      .then(async (res) => {
        const saved = await res.json().catch(() => null);
        if (!res.ok || saved?.deleted || saved?.status === 'violation') {
          // Immediately remove rejected message from chat without stuck spinner!
          setChatHistories(prev => ({
            ...prev,
            [targetChatId]: (prev[targetChatId] || []).filter(m => m.id !== clientTempId)
          }));
          customAlertShadow(saved?.error || 'Сообщение удалено ИИ-модератором за нарушение правил', 'error');
          return;
        }

        const savedId = saved?.id ? String(saved.id) : clientTempId;
        setChatHistories(prev => ({
          ...prev,
          [targetChatId]: (prev[targetChatId] || []).map(m => 
            (m.id === clientTempId || m.id === savedId)
              ? { ...m, id: savedId, moderationStatus: 'approved' as const }
              : m
          )
        }));
      })
      .catch((e) => {
        console.error('Failed to save chat message to DB:', e);
        setChatHistories(prev => ({
          ...prev,
          [targetChatId]: (prev[targetChatId] || []).map(m => 
            m.id === clientTempId ? { ...m, moderationStatus: 'approved' as const } : m
          )
        }));
      });

    setCurrentMessageInputText('');
    if (chatMessageInputRef.current) {
      chatMessageInputRef.current.style.height = '44px';
    }
    setChatAttachedImages([]);
    setChatAttachedImagesError('');
    setReplyingToMessage(null);
    setProtalkMediaFile(null);

    // If autoreply is explicitly turned ON by the user in settings for 1-on-1 personal chats with other users
    const isGroup = targetChatId === 'group-smm' || targetChatId.startsWith('group') || targetChatId.startsWith('gr');
    const isSaved = targetChatId === 'saved_messages' || targetChatId === 'saved' || targetChatId === (currentUser?.id || user?.id);
    if (autoReplyEnabled && !isGroup && !isSaved) {
      setTimeout(() => {
        const autoReplyMsg = { 
          id: `full-m-auto-${Date.now()}`, 
          sender: 'me' as const, 
          text: `[ИИ-Автоответчик]: ${autoReplyPrompt || 'Здравствуйте! Я сейчас не на связи, отвечу позже.'}`, 
          time: timeNow 
        };
        setChatHistories(prev => ({
          ...prev,
          [activeChatFriendId]: [
            ...(prev[activeChatFriendId] || []),
            autoReplyMsg
          ]
        }));
      }, 600);
    }
  };

  // --- Page - Escrow / Secure Deals state & simulation ---
  const [escrowDeals, setEscrowDeals] = useState<EscrowDeal[]>([]);

  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealBuddyId, setNewDealBuddyId] = useState('group-smm');
  const [newDealAmount, setNewDealAmount] = useState('50000');
  const [newDealDesc, setNewDealDesc] = useState('');
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);

  // Arbitration Chat State Mock
  const [arbitrationDealId, setArbitrationDealId] = useState<string | null>(null);
  const [arbitrationLog, setArbitrationLog] = useState<string[]>([]);
  const [arbitrationVerdict, setArbitrationVerdict] = useState<string | null>(null);

  // Trigger Escrow Deal simulation
  const handleCreateEscrowDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealTitle.trim() || !newDealAmount) return;

    const amountNum = parseInt(newDealAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Пожалуйста, введите корректную сумму ИИрок!');
      return;
    }

    if (user.iirky < amountNum) {
      alert(`Недостаточно ИИрок на балансе! Ваш баланс: ${user.iirky.toLocaleString()} 🪙`);
      return;
    }

    setIsSubmittingDeal(true);
    setTimeout(() => {
      const selectedBuddy = virtualFriends.find(f => f.id === newDealBuddyId) || virtualFriends[0];
      const newDeal: EscrowDeal = {
        id: `deal-${Date.now()}`,
        title: newDealTitle,
        partnerId: selectedBuddy.id,
        partnerName: selectedBuddy.name,
        partnerAvatar: selectedBuddy.avatar,
        amount: amountNum,
        description: newDealDesc || 'Информационное сопровождение в союзе соавторов.',
        status: 'funded',
        date: 'Только что',
        logs: [
          'Сделка инициирована', 
          `Списано ${amountNum.toLocaleString()} 🪙 из вашего кошелька`, 
          'ИИрки благополучно переведены на защищенный смарт-эскроу адрес'
        ]
      };

      // Deduct ИИрки from real state
      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          iirky: user.iirky - amountNum
        });
      }

      setEscrowDeals([newDeal, ...escrowDeals]);
      setNewDealTitle('');
      setNewDealDesc('');
      setNewDealAmount('50000');
      setIsSubmittingDeal(false);

      alert('Сделка успешно открыта! ИИрки заморожены на эскроу контракте.');
    }, 1000);
  };

  // Complete Escrow Deal (Release funds)
  const handleReleaseEscrowFunds = (dealId: string) => {
    setEscrowDeals(prev => prev.map(deal => {
      if (deal.id === dealId) {
        return {
          ...deal,
          status: 'completed' as const,
          logs: [...deal.logs, 'Заказчик подтвердил успешную приемку!', 'ИИрки отправлены получателю. Сделка благополучно закрыта! ✔️']
        };
      }
      return deal;
    }));
    alert('Средства успешно высвобождены и отправлены вашему соавтору! Спасибо за безопасную работу.');
  };

  // Request Arbitration (AI-Durov Referee)
  const handleRequestArbitration = (dealId: string) => {
    const targetDeal = escrowDeals.find(d => d.id === dealId);
    if (!targetDeal) return;

    setArbitrationDealId(dealId);
    setArbitrationLog([
      'Инициализирован протокол умного ИИ-Арбитража.',
      'Анализ условий сделки и переписки в чате...',
      'Вызов независимого авторитетного арбитра Павла Дурова...'
    ]);
    setArbitrationVerdict(null);

    setTimeout(() => {
      setArbitrationLog(prev => [...prev, 'Павел Дуров подключился к арбитражной сессии.']);
      
      setTimeout(() => {
        const verdicts = [
          `Решение арбитра: Условия сделки со стороны '${targetDeal.partnerName}' признаны выполненными. ИИрки переводятся исполнителю за вычетом 1% стандартной комиссии экосистемы Сетки.`,
          `Решение арбитра: Обнаружены грубые нарушения сроков рекламы. Сделка отменена. Сумма в размере ${targetDeal.amount.toLocaleString()} 🪙 возвращена обратно на баланс соавтора.`
        ];
        const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
        setArbitrationVerdict(verdict);

        // If returned, add to balance
        if (verdict.includes('возвращена обратно') && onUpdateUser) {
          onUpdateUser({
            ...user,
            iirky: user.iirky + targetDeal.amount
          });
        }

        setEscrowDeals(prev => prev.map(deal => {
          if (deal.id === dealId) {
            const hasRefunded = verdict.includes('возвращена обратно');
            return {
              ...deal,
              status: hasRefunded ? ('refunded' as const) : ('completed' as const),
              logs: [...deal.logs, 'Запущен ИИ-Арбитраж платформы', `Павел Дуров вынес официальный вердикт: ${verdict}`]
            };
          }
          return deal;
        }));
      }, 2000);

    }, 1500);
  };

  // --- Page - competitive leaderboards & tips ---
  const [tippingBuddyId, setTippingBuddyId] = useState<string | null>(null);
  const [tipQuantityInput, setTipQuantityInput] = useState('25000');
  const [isSendingTip, setIsSendingTip] = useState(false);
  const [tipResponse, setTipResponse] = useState<string | null>(null);

  const handleSendTip = () => {
    const amt = parseInt(tipQuantityInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Укажите верное количество ИИрок!');
      return;
    }
    if (user.iirky < amt) {
      alert('Недостаточно ИИрок для поощрения соавтора!');
      return;
    }

    setIsSendingTip(true);
    setTimeout(() => {
      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          iirky: user.iirky - amt
        });
      }

      const buddy = virtualFriends.find(f => f.id === tippingBuddyId);
      setIsSendingTip(false);
      setTipResponse(`Вы успешно поддержали ${buddy?.name || 'соавтора'} переводом в ${amt.toLocaleString()} 🪙 ИИрок! Получено автоматическое "Спасибо!" в ЛС.`);
      
      // Auto close and clean
      setTimeout(() => {
        setTippingBuddyId(null);
        setTipResponse(null);
        setTipQuantityInput('25000');
      }, 3500);
    }, 1200);
  };

  // --- Page - Saved folders & templates ---
  const [savedFolders, setSavedFolders] = useState([
    {
      id: 'fol-1',
      name: '🚀 Топ Копирайтеры',
      channelsCount: 3,
      estimatedCoverage: 32500,
      utmActive: true,
      category: 'SMM & Копирайтинг',
      channelsList: ['@IIrkiBot']
    },
    {
      id: 'fol-2',
      name: '📈 Трафик & Performance',
      channelsCount: 2,
      estimatedCoverage: 18000,
      utmActive: false,
      category: 'Performance Marketing',
      channelsList: ['@IIrkiBot']
    },
    {
      id: 'fol-3',
      name: '🔥 Кроспиар 10k+ Сетка',
      channelsCount: 2,
      estimatedCoverage: 24500,
      utmActive: true,
      category: 'Взаимный Пиар',
      channelsList: ['@IIrkiBot']
    }
  ]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCategory, setNewFolderCategory] = useState('SMM & Копирайтинг');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    setTimeout(() => {
      const folder = {
        id: `fol-${Date.now()}`,
        name: newFolderName,
        channelsCount: Math.floor(Math.random() * 5) + 2,
        estimatedCoverage: (Math.floor(Math.random() * 15) + 5) * 1000,
        utmActive: true,
        category: newFolderCategory,
        channelsList: ['@IIrkiBot']
      };

      setSavedFolders([...savedFolders, folder]);
      setNewFolderName('');
      setIsCreatingFolder(false);
      alert('Новая рекламная папка соавторства создана!');
    }, 800);
  };

  const toggleUtmOnFolder = (id: string) => {
    setSavedFolders(savedFolders.map(f => f.id === id ? { ...f, utmActive: !f.utmActive } : f));
  };

  // --- Coauthors/Friends Action Helpers ---
  const handleSendRequest = (id: string) => {
    setVirtualFriends(prev => prev.map(f => f.id === id ? { ...f, isPendingThem: true } : f));
    
    // Auto-accept request in 3 seconds to keep it dynamic and fun!
    setTimeout(() => {
      setVirtualFriends(prev => prev.map(f => {
        if (f.id === id && f.isPendingThem) {
          return { ...f, isFriend: true, isPendingThem: false };
        }
        return f;
      }));
    }, 3000);
  };

  const handleCancelRequest = (id: string) => {
    setVirtualFriends(prev => prev.map(f => f.id === id ? { ...f, isPendingThem: false } : f));
  };

  const handleAcceptProposal = (id: string) => {
    setVirtualFriends(prev => prev.map(f => f.id === id ? { ...f, isFriend: true, isPendingMe: false } : f));
  };

  const handleRemoveOrDecline = (id: string) => {
    setVirtualFriends(prev => prev.map(f => f.id === id ? { ...f, isFriend: false, isPendingMe: false, isPendingThem: false } : f));
  };


  // --- Original Feed Code logic ---
  // Active floating chat windows (Facebook-style persistent boxes)
  const [floatingChats, setFloatingChats] = useState<FloatingChat[]>([]);

  // Post Creator States
  const [inputText, setInputText] = useState('');
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<string>('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [imagesError, setImagesError] = useState<string>('');
  const [chatAttachedImages, setChatAttachedImages] = useState<string[]>([]);
  const [chatAttachedImagesError, setChatAttachedImagesError] = useState<string>('');
  const [floatingAttachedImages, setFloatingAttachedImages] = useState<{ [friendId: string]: string[] }>({});
  const [floatingAttachedImagesError, setFloatingAttachedImagesError] = useState<{ [friendId: string]: string }>({});
  const [taggedFriendId, setTaggedFriendId] = useState<string>('');
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);

  // --- Coauthors (Friends) Page States ---
  const [coauthorActiveSubTab, setCoauthorActiveSubTab] = useState<'my' | 'incoming' | 'search'>('my');
  const [coauthorSearchText, setCoauthorSearchText] = useState('');
  const [feedFilterUser, setFeedFilterUser] = useState<VirtualFriend | null>(null);

  // Synchronize currentPath with the app states & sub-routes
  useEffect(() => {
    if (currentPath.includes('/social/messages/')) {
      const parts = currentPath.split('/social/messages/');
      const possibleIdOrUsername = parts[parts.length - 1];
      if (possibleIdOrUsername) {
        const pureQuery = possibleIdOrUsername.trim().toLowerCase();
        const found = virtualFriends.find(f => {
          const fid = f.id.toLowerCase();
          const fusername = f.username.toLowerCase().replace('@', '');
          return fid === pureQuery || fusername === pureQuery;
        });
        if (found) {
          setActiveChatFriendId(found.id);
        }
      }
    } else if (currentPath.includes('/social/feed/')) {
      const parts = currentPath.split('/social/feed/');
      const possibleIdOrUsername = parts[parts.length - 1];
      if (possibleIdOrUsername) {
        const pureQuery = possibleIdOrUsername.trim().toLowerCase();
        const found = virtualFriends.find(f => {
          const fid = f.id.toLowerCase();
          const fusername = f.username.toLowerCase().replace('@', '');
          return fid === pureQuery || fusername === pureQuery;
        });
        if (found) {
          setFeedFilterUser(found);
        } else {
          // Fallback if not found in virtualFriends database: represent as guest or temp author filter
          const rawName = possibleIdOrUsername.charAt(0).toUpperCase() + possibleIdOrUsername.slice(1);
          setFeedFilterUser({
            id: `temp-${possibleIdOrUsername}`,
            name: rawName,
            username: `@${possibleIdOrUsername}`,
            avatar: BRAND_ASSETS.heartAvatar,
            status: 'offline',
            bio: 'Автор Сетки соавторов',
            isFriend: false
          });
        }
      }
    } else if (currentPath === '/social/feed' || currentPath === '/social/' || currentPath === '/social') {
      setFeedFilterUser(null);
    } else {
      const matchUserRoute = currentPath.match(/^\/social(?:(?:\/user\/|\/)?([0-9a-zA-Z_]+))?$/);
      if (matchUserRoute && matchUserRoute[1] && !['feed', 'messages', 'deals', 'coauthors', 'saved'].includes(matchUserRoute[1])) {
        const pureQuery = matchUserRoute[1].trim().toLowerCase();
        const currentUserId = String(user.id || '').toLowerCase();
        const currentTgId = String(user.telegramId || '').toLowerCase();
        const currentUsername = (user.telegramUsername || user.username || '').replace('@','').toLowerCase();

        if (pureQuery === currentUserId || pureQuery === currentTgId || (currentUsername && pureQuery === currentUsername)) {
          setFeedFilterUser({
            id: user.id || String(user.telegramId || '169262990'),
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Тимошенко Денис',
            username: user.telegramUsername || `@${user.username || 'shishkarnem'}`,
            avatar: normalizeProTalkMediaUrl(user.userAvatar || (user as any).user_avatar || user.avatarUrl || user.photoUrl) || BRAND_ASSETS.ownerAvatar,
            status: 'online',
            bio: user.bio || 'Моя страница в Сетке Соавторов',
            isFriend: true
          });
        } else {
          const found = virtualFriends.find(f => {
            const fid = f.id.toLowerCase();
            const fusername = f.username.toLowerCase().replace('@', '');
            return fid === pureQuery || fusername === pureQuery;
          });
          if (found) {
            setFeedFilterUser(found);
          } else {
            setFeedFilterUser({
              id: pureQuery,
              name: `Профиль #${pureQuery}`,
              username: `@id${pureQuery}`,
              avatar: BRAND_ASSETS.heartAvatar,
              status: 'online',
              bio: 'Участник Сетки Соавторов',
              isFriend: false
            });
          }
        }
      }
    }
  }, [currentPath, virtualFriends]);

  // Active hovering post ID for reaction bar
  const [hoveringPostId, setHoveringPostId] = useState<string | null>(null);

  // Temp comment states per post
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [commentSubmitting, setCommentSubmitting] = useState<{ [postId: string]: boolean }>({});

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

  const handleDeletePost = async (postId: string, isAuthor: boolean = true) => {
    const confirmMsg = isAuthor
      ? 'Вы действительно хотите удалить свою публикацию из ленты?'
      : 'Вы обладаете правами администратора. Вы действительно хотите удалить эту публикацию?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const activeUserId = currentUser?.id || user?.id || '';
      const res = await fetch(`/api/blog/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(activeUserId)
        },
        body: JSON.stringify({ userId: activeUserId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось удалить публикацию');
        return;
      }
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e: any) {
      console.error('Error deleting post:', e);
      alert('Ошибка при удалении поста: ' + (e.message || 'Сетевая ошибка'));
    }
  };

  // Gradients for text posts
  const postGradients = [
    'from-sky-400 via-pink-500 to-orange-400',
    'from-pink-500 via-rose-500 to-orange-400',
    'from-sky-500 to-indigo-500',
    'from-orange-400 to-pink-600',
    'from-sky-400 via-fuchsia-500 to-orange-400'
  ];

  // Mood options
  const moods = [
    { label: '😊 Счастлив(а)', value: 'счастлив(а)' },
    { label: '🚀 Запускает таргет', value: 'запускает таргет' },
    { label: '💡 Генерирует посты', value: 'генерирует посты' },
    { label: '🍕 Вкушает пиццу', value: 'вкушает пиццу' },
    { label: '🪙 Зарабатывает ИИрки', value: 'зарабатывает ИИрки' },
    { label: '⚡ Полн(а) сил', value: 'на амфе ИИ контента' }
  ];

  // Demo stock images for attachment quick selection
  const stockImages = [
    GALLERY_STOCK_IMAGES[0],
    GALLERY_STOCK_IMAGES[2],
    GALLERY_STOCK_IMAGES[3],
    GALLERY_STOCK_IMAGES[4]
  ];

  // Publish dynamic post
  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let taggedNames: string[] = [];
    if (taggedFriendId) {
      const fr = virtualFriends.find(f => f.id === taggedFriendId);
      if (fr) taggedNames.push(fr.name);
    }

    const newPost: SocialPost = {
      id: `my-post-${Date.now()}`,
      author: {
        name: user.name,
        username: user.telegramUsername || '@user',
        avatar: normalizeProTalkMediaUrl(user.userAvatar || user.photoUrl || user.avatarUrl) || BRAND_ASSETS.heartAvatar,
        isVip: user.tariff === 'vip' || user.tariff === 'pro'
      },
      content: inputText,
      image: selectedGradient ? undefined : attachedImage || undefined,
      images: selectedGradient ? undefined : (attachedImages.length > 0 ? attachedImages : undefined),
      backgroundGradient: selectedGradient || undefined,
      feeling: selectedMood || undefined,
      taggedFriends: taggedNames.length > 0 ? taggedNames : undefined,
      createdAt: 'Только что',
      likes: { 'like': 1 },
      myReaction: 'like',
      comments: [],
      sharesCount: 0
    };

    setPosts([newPost, ...posts]);
    setInputText('');
    setSelectedGradient(null);
    setSelectedMood('');
    setAttachedImage('');
    setAttachedImages([]);
    setImagesError('');
    setTaggedFriendId('');
    setShowMoodDropdown(false);

    // Auto mock comments from virtual buddies
    setTimeout(() => {
      const commenter = virtualFriends[Math.floor(Math.random() * virtualFriends.length)];
      const templates = [
        'Вау, прекрасная мысль! Буду тестировать у себя.',
        'Лови мои ИИрки в виде лайка! 🪙 Полностью солидарен!',
        'Записал этот инсайд. Завтра запущу в рассылку бота!',
        'Круто! SMM комбайн выходит на новый галактический уровень!'
      ];
      const commentText = templates[Math.floor(Math.random() * templates.length)];

      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === newPost.id) {
          return {
            ...p,
            likes: { ...p.likes, 'love': 1, 'like': (p.likes['like'] || 0) + 1 },
            comments: [
              ...p.comments,
              {
                id: `rep-${Date.now()}`,
                author: commenter.name,
                avatar: commenter.avatar,
                text: commentText,
                createdAt: '1 мин. назад'
              }
            ]
          };
        }
        return p;
      }));
    }, 4000);
  };

  // Algorithmic interleaving helper for Feed (Popular - New - Own)
  const buildInterleavedFeed = (): SocialPost[] => {
    const ownPosts = posts.filter(p => 
      p.id.startsWith('my-post-') || 
      p.author.username === user.telegramUsername || 
      p.author.username === '@user'
    );
    
    const restPosts = posts.filter(p => !ownPosts.some(op => op.id === p.id));
    
    // Define popular as sorted by total reactions count desc
    const getReactionsCount = (p: SocialPost) => {
      return Object.values(p.likes).reduce<number>((acc, cur) => acc + (cur as number), 0);
    };
    const popularSorted = [...restPosts].sort((a, b) => getReactionsCount(b) - getReactionsCount(a));
    
    // Define new as sorted/retained by chronological order
    const newSorted = [...restPosts];
    
    const interleaved: SocialPost[] = [];
    const addedIds = new Set<string>();
    
    let popularIdx = 0;
    let newIdx = 0;
    let ownIdx = 0;
    
    let turn = 0; // 0 = popular, 1 = new, 2 = own
    
    while (addedIds.size < posts.length) {
      let addedInThisStep = false;
      
      if (turn === 0) {
        while (popularIdx < popularSorted.length) {
          const p = popularSorted[popularIdx++];
          if (!addedIds.has(p.id)) {
            interleaved.push(p);
            addedIds.add(p.id);
            addedInThisStep = true;
            break;
          }
        }
        turn = 1;
      } else if (turn === 1) {
        while (newIdx < newSorted.length) {
          const p = newSorted[newIdx++];
          if (!addedIds.has(p.id)) {
            interleaved.push(p);
            addedIds.add(p.id);
            addedInThisStep = true;
            break;
          }
        }
        turn = 2;
      } else if (turn === 2) {
        while (ownIdx < ownPosts.length) {
          const p = ownPosts[ownIdx++];
          if (!addedIds.has(p.id)) {
            interleaved.push(p);
            addedIds.add(p.id);
            addedInThisStep = true;
            break;
          }
        }
        turn = 0;
      }
      
      if (!addedInThisStep) {
        let fallbackSearchSuccess = false;
        for (let i = 0; i < 3; i++) {
          turn = (turn + 1) % 3;
          if (turn === 0) {
            while (popularIdx < popularSorted.length) {
              const p = popularSorted[popularIdx++];
              if (!addedIds.has(p.id)) {
                interleaved.push(p);
                addedIds.add(p.id);
                fallbackSearchSuccess = true;
                break;
              }
            }
          } else if (turn === 1) {
            while (newIdx < newSorted.length) {
              const p = newSorted[newIdx++];
              if (!addedIds.has(p.id)) {
                interleaved.push(p);
                addedIds.add(p.id);
                fallbackSearchSuccess = true;
                break;
              }
            }
          } else if (turn === 2) {
            while (ownIdx < ownPosts.length) {
              const p = ownPosts[ownIdx++];
              if (!addedIds.has(p.id)) {
                interleaved.push(p);
                addedIds.add(p.id);
                fallbackSearchSuccess = true;
                break;
              }
            }
          }
          if (fallbackSearchSuccess) break;
        }
        
        if (!fallbackSearchSuccess) {
          break;
        }
      }
    }
    
    return [
      ...interleaved.filter(p => p.isPromoted),
      ...interleaved.filter(p => !p.isPromoted)
    ];
  };

  // Subscribed Feed builder (filtered by user_subscriptions, sorted by date / author / popularity)
  const buildSubscribedFeed = (): SocialPost[] => {
    const subPosts = posts.filter(p => {
      if (isBannedAuthor(p.author?.name, p.author?.username)) return false;
      const authorId = String((p as any).userId || (p as any).authorId || p.author?.id || '');
      const authorUsername = (p.author?.username || '').replace('@', '').toLowerCase();
      const authorName = (p.author?.name || '').toLowerCase();
      
      for (const subId of subscribedTargetIds) {
        const s = String(subId).toLowerCase();
        if (s === authorId || s === authorUsername || s === authorName) return true;
      }
      return false;
    });

    if (subscriptionsSort === 'author') {
      return [...subPosts].sort((a, b) => (a.author?.name || '').localeCompare(b.author?.name || ''));
    }
    if (subscriptionsSort === 'popularity') {
      const getReactionsCount = (p: SocialPost) => {
        const likesSum = Object.values(p.likes || {}).reduce<number>((acc, cur) => acc + (cur as number), 0);
        return likesSum + (p.views || 0);
      };
      return [...subPosts].sort((a, b) => getReactionsCount(b) - getReactionsCount(a));
    }
    // Default 'date'
    return [...subPosts];
  };

  // Image upload handlers with strict image validation
  const handleFeedImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImagesError('');
    const files = e.target.files;
    if (!files) return;

    let containsInvalid = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        containsInvalid = true;
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImages((prev) => {
            if (prev.length >= 10) {
              setImagesError('Максимум 10 картинок в альбоме!');
              return prev;
            }
            return [...prev, event.target!.result as string].slice(0, 10);
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (containsInvalid) {
      setImagesError('Только картинки! Файлы, видео и аудио файлы нельзя!');
    }
  };

  const handleChatImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatAttachedImagesError('');
    const files = e.target.files;
    if (!files) return;

    let containsInvalid = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        containsInvalid = true;
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setChatAttachedImages((prev) => {
            if (prev.length >= 10) {
              setChatAttachedImagesError('Максимум 10 картинок!');
              return prev;
            }
            return [...prev, event.target!.result as string].slice(0, 10);
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (containsInvalid) {
      setChatAttachedImagesError('Только картинки! Файлы, видео и аудио файлы нельзя!');
    }
  };

  const handleFloatingImagesChange = (friendId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setFloatingAttachedImagesError(prev => ({ ...prev, [friendId]: '' }));
    const files = e.target.files;
    if (!files) return;

    let containsInvalid = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        containsInvalid = true;
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFloatingAttachedImages(prev => {
            const list = prev[friendId] || [];
            if (list.length >= 10) {
              setFloatingAttachedImagesError(err => ({ ...err, [friendId]: 'Максимум 10 картинок!' }));
              return prev;
            }
            return {
              ...prev,
              [friendId]: [...list, event.target!.result as string].slice(0, 10)
            };
          });
        }
      };
      reader.readAsDataURL(file);
    }

    if (containsInvalid) {
      setFloatingAttachedImagesError(prev => ({ ...prev, [friendId]: 'Только картинки! Файлы, видео и аудио нельзя.' }));
    }
  };

  // Add comments live with Function 763 AI moderation
  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim() || commentSubmitting[postId]) return;

    const trimmedText = text.trim();
    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));

    try {
      const activeUserId = currentUser?.id || user?.id || '16926299042';
      const activeUserName = currentUser?.name || user?.name || 'Пользователь';
      const activeUserAvatar = currentUser?.avatarUrl || user?.avatarUrl || '';
      const activeUserUsername = currentUser?.username || user?.username || '';

      const res = await fetch(`/api/blog/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(activeUserId)
        },
        body: JSON.stringify({
          text: trimmedText,
          authorUserId: String(activeUserId),
          authorName: activeUserName,
          authorAvatar: activeUserAvatar,
          authorUsername: activeUserUsername
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setModerationAlert({
          isOpen: true,
          title: 'Комментарий отклонен модерацией нейросети',
          message: data.error || data.reason || 'Нейросеть (Функция 763) отклонила публикацию комментария: обнаружены недопустимые выражения или нарушения правил платформы.',
          type: 'comment'
        });
        return;
      }

      const createdComm = {
        id: data.comment?.id || `c-me-${Date.now()}`,
        author: activeUserName,
        avatar: normalizeProTalkMediaUrl(activeUserAvatar) || BRAND_ASSETS.heartAvatar,
        text: trimmedText,
        createdAt: 'Только что'
      };

      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...(p.comments || []), createdComm]
          };
        }
        return p;
      }));

      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setModerationAlert({
        isOpen: true,
        title: 'Ошибка добавления комментария',
        message: err.message || 'Сетевая ошибка при отправке комментария. Попробуйте еще раз.',
        type: 'comment'
      });
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Open Chat persistent box click
  const openChatWith = (friend: VirtualFriend) => {
    // Check if already open
    const openIndex = floatingChats.findIndex(c => c.friendId === friend.id);
    if (openIndex >= 0) {
      setFloatingChats(
        floatingChats.map((c, idx) => idx === openIndex ? { ...c, isMinimized: false } : c)
      );
      return;
    }

    // Limit to max 3 floating chats
    let currentChats = [...floatingChats];
    if (currentChats.length >= 3) {
      currentChats.shift(); // remove first
    }

    const initialMsgs = [
      { id: '1', sender: 'them' as const, text: `Привет! Как твои дела в SMM комбайне? Твои ИИрки копятся?`, time: '10:20' }
    ];

    setFloatingChats([
      ...currentChats,
      {
        friendId: friend.id,
        friendName: friend.name,
        friendAvatar: friend.avatar,
        messages: initialMsgs,
        isMinimized: false
      }
    ]);
  };

  // Send msg in floating box
  const sendFloatingMessage = (friendId: string, text: string) => {
    const attached = floatingAttachedImages[friendId] || [];
    if (!text.trim() && attached.length === 0) return;

    setFloatingChats(floatingChats.map(c => {
      if (c.friendId === friendId) {
        return {
          ...c,
          messages: [
            ...c.messages,
            {
              id: `m-f-${Date.now()}`,
              sender: 'me',
              text: text,
              time: 'Только что',
              images: attached.length > 0 ? attached : undefined
            }
          ]
        };
      }
      return c;
    }));

    // Clear attachments for this friendId
    setFloatingAttachedImages(prev => ({ ...prev, [friendId]: [] }));
    setFloatingAttachedImagesError(prev => ({ ...prev, [friendId]: '' }));

    // Simulated reply based on content
    setTimeout(() => {
      const answers = [
        'Потрясающий расклад! Я закину эти требования в нашу VIP папку продвижения 🤝',
        'Инструменты ИИSMM просто космос! Сэкономил кучу времени на копирайтинге.',
        'Держу кулачки за твою следующую подборку. Давай устроим взаимный пиар!',
        'Отправил тебе 50,000 ИИрок в качестве депонирования сделки.'
      ];
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

      setFloatingChats(currentChats => currentChats.map(chat => {
        if (chat.friendId === friendId) {
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                id: `m-rep-${Date.now()}`,
                sender: 'them',
                text: randomAnswer,
                time: 'Только что'
              }
            ]
          };
        }
        return chat;
      }));
    }, 1500);
  };

  // Accept Friend requests
  const handleAcceptFriendRequest = (id: string) => {
    setVirtualFriends(virtualFriends.map(f => {
      if (f.id === id) {
        return { ...f, isFriend: true, isPendingMe: false };
      }
      return f;
    }));
    alert('Вы приняли предложение дружбы и соавторства! Теперь можете переписываться.');
  };

  // Helper reaction symbol
  const getReactionSymbol = (type: string) => {
    switch (type) {
      case 'rainbow_heart': return <RainbowHeartIcon className="w-4.5 h-4.5 inline-block drop-shadow-xs" />;
      case 'like': return '👍';
      case 'love': return '❤️';
      case 'haha': return '😆';
      case 'wow': return '😮';
      case 'sad': return '😢';
      case 'angry': return '😡';
      case 'fire': return '🔥';
      default: return '👍';
    }
  };

  // Add Reaction Hover Popover Handler
  const handleReact = (postId: string, reactionType: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const reactions = { ...post.likes };
        
        // Remove previous reaction if same, or update
        if (post.myReaction) {
          reactions[post.myReaction] = Math.max(0, (reactions[post.myReaction] || 0) - 1);
        }

        reactions[reactionType] = (reactions[reactionType] || 0) + 1;

        return {
          ...post,
          likes: reactions,
          myReaction: reactionType
        };
      }
      return post;
    }));
    setHoveringPostId(null);
  };


  return (
    <div className="iirky-social-container min-h-screen bg-slate-50 font-sans text-slate-800 rounded-3xl overflow-hidden shadow-xl relative">
      
      {/* 3. Main Facebook Grid (Adapts based on layout active subpage) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-1 md:gap-6 p-1 md:p-5 items-start pb-24">
        
        {/* ================= CENTRAL & RIGHT CONTENT - ADAPTS ACCORDING TO SELECTED TAB ================= */}
        
        {/* VIEW 1: NEWS FEED WITH SUBSCRIPTIONS & SORTING */}
        {activeSocialTab === 'feed' && (
          <section className="col-span-12 max-w-4xl mx-auto w-full space-y-5">
            {/* Central Block: Write Post button for own profile only */}
            {(!currentPath.includes('/social/') || currentPath === '/social' || currentPath === '/social/feed' || (user && currentUser && (user.id === currentUser.id || String(user.telegramId) === String(currentUser.telegramId)))) && (
              <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-5 text-left space-y-3 relative overflow-hidden border border-pink-300 shadow-md">
                <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={normalizeProTalkMediaUrl(currentUser?.avatarUrl || user.avatarUrl) || BRAND_ASSETS.heartAvatar} 
                      alt="Me" 
                      className="w-12 h-12 rounded-full object-cover border-2 border-pink-300 shadow-sm shrink-0"
                    />
                    <div>
                      <h3 className="text-base font-bold text-slate-800">Создать новую публикацию</h3>
                      <p className="text-sm text-slate-600 font-medium">Перейдите в редактор постов для подготовки контента</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const myPostsPath = `/posts${currentUser?.id || user.id || '16926299042'}/redactor`;
                      window.history.pushState(null, '', myPostsPath);
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md border border-white/40 cursor-pointer hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Edit3 className="w-4 h-4 text-white" />
                    <span>Написать пост</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter and Sort Control Bar */}
            {!feedFilterUser && (
              <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-pink-300 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-left">
                {/* Feed Mode: Все публикации vs Подписки */}
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-1 rounded-xl border border-pink-200">
                  <button
                    type="button"
                    onClick={() => setFeedMode('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                      feedMode === 'all'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    Все публикации
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedMode('subscriptions')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      feedMode === 'subscriptions'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    <FolderHeart className="w-4 h-4 text-pink-500" />
                    <span>Подписки</span>
                    {subscribedTargetIds.size > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-bold bg-pink-500 text-white leading-none">
                        {subscribedTargetIds.size}
                      </span>
                    )}
                  </button>
                </div>

                {/* Sorting options */}
                <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm p-1 rounded-xl border border-pink-200 overflow-x-auto no-scrollbar">
                  <span className="text-sm font-bold text-slate-700 px-2 shrink-0">Сортировка:</span>
                  <button
                    type="button"
                    onClick={() => setFeedSort('date')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer shrink-0 ${
                      feedSort === 'date'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    По новизне
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedSort('popularity')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer shrink-0 ${
                      feedSort === 'popularity'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    По популярности
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedSort('author')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer shrink-0 ${
                      feedSort === 'author'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    По авторам
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Posts */}
            <div className="space-y-5">
              {(() => {
                let rawList: SocialPost[] = [];
                if (feedFilterUser) {
                  const filterUsername = (feedFilterUser.username || '').replace('@', '').toLowerCase();
                  const filterName = (feedFilterUser.name || '').toLowerCase();
                  const filterId = String(feedFilterUser.id || '').toLowerCase();

                  rawList = posts.filter(p => {
                    const pUsername = (p.author?.username || '').replace('@', '').toLowerCase();
                    const pName = (p.author?.name || '').toLowerCase();
                    const pUserId = String((p as any).userId || p.author?.id || '').toLowerCase();

                    const matchUsername = filterUsername && pUsername && (filterUsername === pUsername || filterUsername.includes(pUsername) || pUsername.includes(filterUsername));
                    const matchName = filterName && pName && (filterName === pName || filterName.includes(pName) || pName.includes(filterName));
                    const matchId = filterId && pUserId && (filterId === pUserId || filterId.includes(pUserId) || pUserId.includes(filterId));

                    return matchUsername || matchName || matchId;
                  });
                } else if (feedMode === 'subscriptions') {
                  rawList = buildSubscribedFeed();
                } else {
                  rawList = buildInterleavedFeed();
                }

                rawList = rawList.filter(p => !isBannedAuthor(p.author?.name, p.author?.username));

                if (feedSort === 'popularity') {
                  const getReactionsCount = (p: SocialPost) => {
                    const likesSum = Object.values(p.likes || {}).reduce<number>((acc, cur) => acc + (cur as number), 0);
                    return likesSum * 2 + (p.views || 0) + (p.comments?.length || 0) * 3;
                  };
                  rawList = [...rawList].sort((a, b) => getReactionsCount(b) - getReactionsCount(a));
                } else if (feedSort === 'author') {
                  rawList = [...rawList].sort((a, b) => (a.author?.name || '').localeCompare(b.author?.name || ''));
                }

                const postsToRender = rawList;

                if (postsToRender.length === 0) {
                  if (feedMode === 'subscriptions') {
                    return (
                      <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-10 text-center border border-pink-300 shadow-md space-y-4">
                        <FolderHeart className="w-12 h-12 text-pink-500 mx-auto" />
                        <p className="font-bold text-slate-800 text-base">В вашей ленте подписок пока нет публикаций.</p>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                          Подписывайтесь на авторов в каталоге авторов, чтобы следить за их новыми публикациями.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigateToTab('users')}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 cursor-pointer shadow-md hover:opacity-95"
                        >
                          Перейти в каталог авторов
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-2xl p-10 text-center text-slate-600 text-sm border border-pink-200">
                      У этого соавтора пока нет опубликованных записей в ленте.
                    </div>
                  );
                }

                return postsToRender.map((post) => {
                  const reactionIcons = Object.keys(post.likes).filter(k => post.likes[k] > 0);
                  const totalReactions = Object.values(post.likes).reduce<number>((acc, cur) => acc + (cur as number), 0);
                  const hasLiked = !!post.myReaction;

                  const isCurrentUserAuthor = Boolean(
                    (currentUser?.username && post.author?.username && post.author.username.replace('@', '').toLowerCase() === currentUser.username.replace('@', '').toLowerCase()) ||
                    (user?.username && post.author?.username && post.author.username.replace('@', '').toLowerCase() === user.username.replace('@', '').toLowerCase()) ||
                    (currentUser?.name && post.author?.name && post.author.name.toLowerCase() === currentUser.name.toLowerCase()) ||
                    (user?.name && post.author?.name && post.author.name.toLowerCase() === user.name.toLowerCase()) ||
                    (currentUser?.id && (post as any).userId && String((post as any).userId) === String(currentUser.id)) ||
                    (user?.id && (post as any).userId && String((post as any).userId) === String(user.id))
                  );

                  const isUserAdmin = Boolean(
                    (currentUser as any)?.role === 'admin' ||
                    (currentUser as any)?.role === 'superadmin' ||
                    (user as any)?.role === 'admin' ||
                    (user as any)?.role === 'superadmin' ||
                    String(currentUser?.id) === '16926299042' ||
                    String(currentUser?.id) === '169262990' ||
                    String(user?.id) === '16926299042' ||
                    String(user?.id) === '169262990' ||
                    (currentUser?.email && (currentUser.email === 'shishkarnem@gmail.com' || currentUser.email === 'airoborent@gmail.com')) ||
                    (user?.email && (user.email === 'shishkarnem@gmail.com' || user.email === 'airoborent@gmail.com'))
                  );

                  const canDeletePost = isCurrentUserAuthor || isUserAdmin;

                  const showAuthorHeart = Boolean(
                    post.author.hasRainbowHeart || hasRainbowHeart(post.author.tariff, post.author.role)
                  );

                  return (
                    <div key={post.id} className={`iirky-card-block rounded-2xl p-5 pt-7 text-left space-y-4 relative overflow-hidden ${post.isPromoted ? 'ring-2 ring-pink-400/80' : ''}`}>
                      <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                      
                      {/* Post Header Info */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div 
                          className="flex items-center gap-3 cursor-pointer group min-w-0"
                          onClick={() => {
                            const identifier = post.author.username ? post.author.username.replace('@', '') : post.id;
                            window.history.pushState(null, '', `/social/${identifier}`);
                            window.dispatchEvent(new Event('popstate'));
                          }}
                          title="Посмотреть персональную страницу соавтора"
                        >
                          <div className="relative shrink-0">
                            <img src={post.author.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border group-hover:border-pink-500 transition-colors" />
                            {showAuthorHeart && (
                              <img
                                src={BRAND_ASSETS.heartAvatar}
                                alt="Сердечко"
                                title="Значок радужного сердца (тариф Разгон+)"
                                className="w-4 h-4 object-contain absolute -top-1 -right-1 drop-shadow-xs pointer-events-none"
                              />
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-extrabold text-slate-800 text-[14px] leading-none group-hover:text-pink-600 transition-colors truncate">{post.author.name}</span>
                              {post.author.isVip && (
                                <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
                              )}
                              {post.isPromoted && (
                                <span className="inline-flex items-center gap-1 text-[14px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                                  <TrendingUp className="w-4 h-4 text-pink-600 shrink-0" />
                                  <span>В топе ленты</span>
                                </span>
                              )}
                              {post.feeling && (
                                <span className="text-[14px] text-slate-500 font-medium">чувствует себя <strong className="text-slate-700 font-bold">{post.feeling}</strong></span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[14px] text-slate-500 font-mono mt-0.5 font-medium">
                              <span className="group-hover:underline truncate">{post.author.username}</span>
                              <span>·</span>
                              <span>{post.createdAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-2">
                          {post.taggedFriends && post.taggedFriends.length > 0 && (
                            <span className="text-[14px] text-slate-600 font-semibold">
                              с {post.taggedFriends.join(', ')}
                            </span>
                          )}

                          {canDeletePost && !post.id.startsWith('my-post-') && (
                            <button
                              type="button"
                              disabled={promotingPostId === post.id}
                              onClick={() => handleTogglePromoteSocialPost(post)}
                              title="Вывести публикацию в топ Ленты соцсети ИИрки (тариф Отрыв+)"
                              className={`px-3 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                post.isPromoted
                                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-2xs'
                                  : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
                              }`}
                            >
                              {!hasOtryvSocialAccess ? (
                                <Lock className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                              ) : (
                                <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${post.isPromoted ? 'text-white' : 'text-pink-600'}`} />
                              )}
                              <span>{post.isPromoted ? 'В топе' : 'В топ ленты'}</span>
                            </button>
                          )}

                          {canDeletePost && (
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id, isCurrentUserAuthor)}
                              title={isCurrentUserAuthor ? "Удалить свой пост" : "Удалить публикацию (модерация администратора)"}
                              className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-pink-600 hover:bg-white transition-colors border border-pink-200 cursor-pointer shadow-2xs flex items-center gap-1 text-[14px]"
                            >
                              <Trash2 className="w-4 h-4 text-pink-500 shrink-0" />
                              {!isCurrentUserAuthor && isUserAdmin && (
                                <span className="text-[14px] font-bold text-pink-600">Админ</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content Section */}
                      {post.backgroundGradient ? (
                        <div className={`p-8 text-center text-white font-extrabold bg-gradient-to-r ${post.backgroundGradient} rounded-2xl text-[16px] shadow-sm font-sans flex items-center justify-center leading-relaxed select-none min-h-[140px]`}>
                          {post.content}
                        </div>
                      ) : (
                        <div className="text-[14px] md:text-[15px] text-slate-800 leading-relaxed font-normal whitespace-pre-wrap px-1">
                          <MarkdownRenderer 
                            content={post.content} 
                            format={post.messageFormat || 'v2'} 
                            inlineButtons={post.inlineButtons}
                          />
                        </div>
                      )}

                      {/* Attached visual */}
                      {post.image && (
                        <div className="rounded-2xl overflow-hidden border max-h-80 shadow-xs">
                          <img src={post.image} alt="Attachment" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Album Grid Support */}
                      {post.images && post.images.length > 0 && (
                        <AlbumGrid images={post.images} />
                      )}

                      {/* Counts row */}
                      <div className="flex items-center justify-between border-b pb-2 text-[11px] text-slate-400 font-bold">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center -space-x-1.5 pl-0.5">
                            {reactionIcons.map((recType, idx) => (
                              <span key={idx} className="w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[11px] shadow-xs">
                                {getReactionSymbol(recType)}
                              </span>
                            ))}
                          </div>
                          <span>{totalReactions} соавторов оценили</span>
                        </div>
                        <div className="flex gap-2 text-[10px]">
                          <span>{post.comments.length} комм.</span>
                          <span>•</span>
                          <span>{post.sharesCount} репостов</span>
                        </div>
                      </div>

                      {/* Action buttons row with icon-only controls and informative popover windows */}
                      <div className="flex items-center justify-around py-1.5 px-2 bg-slate-50/70 rounded-2xl border border-slate-100/90 relative">
                        {/* 1. Respect Icon (React) */}
                        <div 
                          className="relative group flex-1 flex justify-center"
                          onMouseEnter={() => setHoveringPostId(post.id)}
                          onMouseLeave={() => setHoveringPostId(null)}
                        >
                          <button 
                            type="button"
                            onClick={() => handleReact(post.id, 'like')}
                            className={`p-2 hover:bg-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                              hasLiked ? 'bg-pink-50 text-pink-600 scale-105' : 'text-slate-600'
                            }`}
                            title="Респект (Наведите или нажмите для реакций)"
                          >
                            {post.myReaction ? (
                              <span className="text-base">{getReactionSymbol(post.myReaction)}</span>
                            ) : (
                              <ThumbsUp className="w-4.5 h-4.5 text-sky-500" />
                            )}
                            <span className="text-[10px] font-black text-slate-700 font-mono">{totalReactions}</span>
                          </button>

                          {/* Info popover + reactions window */}
                          <AnimatePresence>
                            {hoveringPostId === post.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: -50, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-pink-100 space-y-1.5 min-w-[220px]"
                              >
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider text-center border-b pb-1">
                                  👍 Респект автора (Инфо-окно)
                                </div>
                                <div className="flex justify-center gap-1.5 items-center">
                                  {[
                                    { type: 'rainbow_heart', isCustom: true, label: 'Радужное Сердечко ❤️ (Премиум)' },
                                    { type: 'like', icon: '👍', label: 'Красава' },
                                    { type: 'love', icon: '❤️', label: 'Обожаю' },
                                    { type: 'fire', icon: '🔥', label: 'Огонь' },
                                    { type: 'haha', icon: '😆', label: 'Жара' },
                                    { type: 'wow', icon: '😮', label: 'Шок' }
                                  ].map(rec => (
                                    <button
                                      key={rec.type}
                                      type="button"
                                      onClick={() => handleReact(post.id, rec.type)}
                                      className="transform hover:scale-130 active:scale-95 transition-transform duration-100 p-1 rounded-lg hover:bg-pink-50 cursor-pointer"
                                      title={rec.label}
                                    >
                                      {rec.isCustom ? (
                                        <RainbowHeartIcon className="w-5 h-5 animate-pulse" />
                                      ) : (
                                        <span className="text-lg block">{rec.icon}</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 2. Discuss Icon (Comments) */}
                        <div className="relative group flex-1 flex justify-center">
                          <button 
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`cmt-full-${post.id}`);
                              if (el) {
                                el.focus();
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                            className="p-2 hover:bg-white text-slate-600 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Обсудить (Комментарии)"
                          >
                            <MessageCircle className="w-4.5 h-4.5 text-orange-500" />
                            <span className="text-[10px] font-black text-slate-700 font-mono">{post.comments.length}</span>
                          </button>

                          {/* Info popover tooltip */}
                          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none">
                            <div className="bg-slate-900/90 text-white text-[10px] font-bold py-1 px-2.5 rounded-xl shadow-lg whitespace-nowrap border border-slate-700">
                              💬 Обсудить — открыть поле комментариев
                            </div>
                            <div className="w-2 h-2 bg-slate-900/90 rotate-45 -mt-1" />
                          </div>
                        </div>

                        {/* 3. Repost Icon (Share) */}
                        <div className="relative group flex-1 flex justify-center">
                          <button 
                            type="button"
                            onClick={() => setRepostModalPost(post)}
                            className="p-2 hover:bg-white text-slate-600 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Поделиться или репостнуть публикацию"
                          >
                            <Share2 className="w-4.5 h-4.5 text-pink-500" />
                            <span className="text-[12px] font-bold text-slate-700 font-mono">{post.sharesCount || 0}</span>
                          </button>

                          {/* Info popover tooltip */}
                          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none">
                            <div className="bg-slate-900/90 text-white text-[10px] font-bold py-1 px-2.5 rounded-xl shadow-lg whitespace-nowrap border border-slate-700">
                              📢 Репостнуть публикацию
                            </div>
                            <div className="w-2 h-2 bg-slate-900/90 rotate-45 -mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Comments list box */}
                      <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        {post.comments.length > 0 && (
                          <div className="space-y-2.5 max-h-48 overflow-y-auto no-scrollbar pt-1">
                            {post.comments.map(comm => (
                              <div key={comm.id} className="flex gap-2.5 text-[14px] text-left leading-normal">
                                <img 
                                  src={comm.avatar} 
                                  alt="Author" 
                                  onClick={() => {
                                    const cId = comm.author ? encodeURIComponent(comm.author.replace('@', '')) : '';
                                    if (cId) {
                                      window.history.pushState(null, '', `/social/${cId}`);
                                      window.dispatchEvent(new Event('popstate'));
                                    }
                                  }}
                                  className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border cursor-pointer hover:border-pink-400 transition-colors" 
                                  title="Открыть страницу соавтора"
                                />
                                <div className="flex-1 bg-white p-3 rounded-xl shadow-2xs border border-pink-100/70">
                                  <div className="flex justify-between items-baseline mb-1">
                                    <span 
                                      onClick={() => {
                                        const cId = comm.author ? encodeURIComponent(comm.author.replace('@', '')) : '';
                                        if (cId) {
                                          window.history.pushState(null, '', `/social/${cId}`);
                                          window.dispatchEvent(new Event('popstate'));
                                        }
                                      }}
                                      className="font-extrabold text-[13px] text-pink-700 hover:underline cursor-pointer"
                                    >
                                      {comm.author}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-mono">{comm.createdAt}</span>
                                  </div>
                                  <p className="text-[14px] text-slate-800 font-medium leading-relaxed">{comm.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment Input with AudioField */}
                        <div className="flex gap-2.5 items-start pt-2">
                          <img 
                            src={normalizeProTalkMediaUrl(user.avatarUrl) || BRAND_ASSETS.heartAvatar} 
                            alt="Avatar" 
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-pink-200 mt-1 shadow-2xs" 
                          />
                          <div className="flex-1 space-y-2">
                            <AudioField
                              id={`cmt-full-${post.id}`}
                              placeholder="Ваш комментарий... Нажмите на микрофон для записи речи"
                              value={commentInputs[post.id] || ''}
                              onChange={(val) => setCommentInputs(prev => ({ ...prev, [post.id]: val }))}
                              rows={2}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  handleAddComment(post.id, commentInputs[post.id] || '');
                                }
                              }}
                              voiceFriendName="Модератор комментариев"
                              titleVoice="Голосовой ввод комментария (распознавание речи)"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] text-slate-500 font-medium hidden sm:inline">
                                Нажмите Enter с Ctrl или кнопку
                              </span>
                              <button 
                                type="button"
                                disabled={commentSubmitting[post.id] || !((commentInputs[post.id] || '').trim())}
                                onClick={() => handleAddComment(post.id, commentInputs[post.id] || '')}
                                className="ml-auto px-4 py-2 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white rounded-xl text-[14px] font-bold hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                              >
                                <SendHorizontal className="w-4 h-4" />
                                <span>{commentSubmitting[post.id] ? 'Проверка...' : 'Отправить'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                });
              })()}
              </div>
            </section>
        )}

        {/* VIEW 2: DEDICATED MESSAGES PAGE (TAKES FULL WIDTH FOR SPACE AND COMFORT) */}
        {activeSocialTab === 'messages' && (
          <section className="col-span-12 lg:col-span-12 flex flex-col md:grid md:grid-cols-3 rounded-2xl overflow-hidden h-[calc(100vh-80px)] min-h-[680px] relative iirky-card-block bg-white w-full flex-1 mb-2">
            <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient shrink-0" />
            
            {/* Left Col: Contact Selectors list (Desktop: column, Mobile: slide-out drawer) */}
            <div className="hidden md:flex md:col-span-1 border-r border-slate-200 bg-slate-50/50 flex-col h-full overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b bg-white/80 backdrop-blur-sm space-y-3 shrink-0">
                  {/* Кнопка создания группового чата */}
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border border-white/40 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    title="Создать группу из соавторов, на которых вы подписаны"
                  >
                    <Users className="w-4 h-4 text-white" />
                    <span>Создать группу</span>
                  </button>

                  {/* Поиск по чатам и авторам переписок */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                    <input 
                      type="text" 
                      placeholder="Поиск по чатам и авторам переписок..." 
                      value={chatsSearchText}
                      onChange={(e) => setChatsSearchText(e.target.value)}
                      className="w-full bg-white/90 border border-pink-300 pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 transition-shadow text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  {/* Chat Sub-Tab selection bar */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { value: 'all', label: 'Все' },
                      { value: 'unread', label: 'Новые', count: unreadChatIds.length }
                    ].map((tabObj) => (
                      <button
                        key={tabObj.value}
                        onClick={() => setMessagesSubTab(tabObj.value as any)}
                        className={`px-3 py-1.5 text-sm font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                          messagesSubTab === tabObj.value
                            ? 'bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-300 shadow-2xs'
                            : 'bg-white/80 hover:bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{tabObj.label}</span>
                          {tabObj.count !== undefined && tabObj.count > 0 && (
                            <span className="bg-pink-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-mono font-bold animate-pulse leading-none">
                              {tabObj.count}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 flex-1 min-h-0 overflow-y-auto no-scrollbar">
                  {(() => {
                    const filtered = virtualFriends.filter((buddy) => {
                      // 0. Filter out banned fake bots
                      if (isBannedAuthor(buddy.name, buddy.username)) return false;

                      // 1. Text filter by chatsSearchText: matches partner name, username, id, partnerId or message text
                      const query = chatsSearchText.trim().toLowerCase();
                      if (query) {
                        const matchesName = (buddy.name || '').toLowerCase().includes(query) || 
                                            (buddy.username || '').toLowerCase().includes(query) ||
                                            (buddy.id || '').toLowerCase().includes(query) ||
                                            (buddy.partnerId && String(buddy.partnerId).toLowerCase().includes(query));
                        const history = chatHistories[buddy.id] || [];
                        const matchesMsg = history.some(m => (m.text || '').toLowerCase().includes(query));
                        if (!matchesName && !matchesMsg) {
                          return false;
                        }
                      }
                      
                      // 2. Tab filter
                      if (messagesSubTab === 'unread') {
                        return unreadChatIds.includes(buddy.id);
                      }
                      return true; // 'all'
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center text-sm text-slate-500 font-semibold bg-white/60 border border-dashed border-pink-300 rounded-xl m-3">
                          Активных чатов не найдено
                        </div>
                      );
                    }

                    return filtered.map((buddy) => {
                      const isSelected = activeChatFriendId === buddy.id;
                      const isUnread = unreadChatIds.includes(buddy.id);
                      const history = chatHistories[buddy.id] || [];
                      const lastMsgObj = history.length > 0 ? history[history.length - 1] : null;
                      const lastMsgText = formatChatLastMessagePreview({
                        text: lastMsgObj ? lastMsgObj.text : (buddy.lastMessage || ''),
                        mediaType: lastMsgObj?.mediaType,
                        mediaUrl: lastMsgObj?.mediaUrl,
                        images: lastMsgObj?.images,
                        forwardedFrom: lastMsgObj?.forwardedFrom,
                        fallback:
                          buddy.bio ||
                          (buddy.isGroup
                            ? 'Групповой чат сообщества @iismm_chat'
                            : 'Личная переписка')
                      });
                      const displayTime = (lastMsgObj?.time || buddy.lastTime || '').trim();

                      return (
                        <div
                          key={buddy.id}
                          onClick={() => handleSelectChat(buddy)}
                          className={`w-full p-3.5 text-left flex gap-3 transition-colors cursor-pointer select-none items-center relative ${
                            isSelected ? 'bg-pink-50/80 border-l-4 border-pink-500' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!buddy.isGroup) {
                                const target = buddy.partnerId || buddy.id;
                                if (target && !target.startsWith('group')) {
                                  window.history.pushState(null, '', `/social/${target}`);
                                  window.dispatchEvent(new Event('popstate'));
                                }
                              }
                            }}
                            title={buddy.isGroup ? buddy.name : "Перейти в профиль пользователя"}
                            className="relative shrink-0 cursor-pointer group hover:scale-105 transition-transform"
                          >
                            <img src={buddy.avatar} alt="Buddy photo" className="w-11 h-11 rounded-full object-cover border border-pink-200" />
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              buddy.status === 'online' ? 'bg-sky-500' : 'bg-slate-300'
                            }`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2 mb-0.5">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectChat(buddy);
                                }}
                                className={`text-[14px] truncate block hover:text-pink-600 transition-colors ${isUnread ? 'font-black text-pink-600' : 'font-bold text-slate-800'}`}
                              >
                                {buddy.name}
                              </span>
                              {displayTime && (
                                <span className="text-[14px] text-slate-500 font-mono shrink-0">{displayTime}</span>
                              )}
                            </div>
                            <p className={`text-[14px] truncate leading-normal ${isUnread ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                              {lastMsgText}
                            </p>
                          </div>

                          {isUnread && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Right Cols: Complete Active Chat Area (Takes full width on mobile, 2 cols on desktop) */}
            <div className="flex-1 md:col-span-2 flex flex-col h-full bg-slate-50/50 overflow-hidden relative">
              {/* Active Chat Header */}
              {(() => {
                const currentBuddy = virtualFriends.find(f => f.id === activeChatFriendId) || virtualFriends[0];
                return (
                  <>
                    <div className="p-3.5 bg-white border-b flex items-center justify-between shadow-xs shrink-0">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => {
                            if (!currentBuddy.isGroup) {
                              const target = currentBuddy.partnerId || currentBuddy.id;
                              if (target && !target.startsWith('group')) {
                                window.history.pushState(null, '', `/social/${target}`);
                                window.dispatchEvent(new Event('popstate'));
                              }
                            }
                          }}
                          className={`shrink-0 ${!currentBuddy.isGroup ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
                          title={!currentBuddy.isGroup ? "Перейти в профиль пользователя" : undefined}
                        >
                          <img src={currentBuddy.avatar} alt="Buddy Avatar" className="w-9 h-9 rounded-full object-cover border border-pink-200" />
                        </div>
                        <div className="text-left">
                          <span 
                            onClick={() => {
                              if (!currentBuddy.isGroup) {
                                const target = currentBuddy.partnerId || currentBuddy.id;
                                if (target && !target.startsWith('group')) {
                                  window.history.pushState(null, '', `/social/${target}`);
                                  window.dispatchEvent(new Event('popstate'));
                                }
                              }
                            }}
                            className="font-extrabold text-[14px] text-slate-800 block leading-tight cursor-pointer hover:text-pink-600 transition-colors"
                          >
                            {currentBuddy.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[14px] text-slate-500">
                            <span className="font-mono font-bold">{currentBuddy.username}</span>
                            <span>•</span>
                            {(() => {
                              if (currentBuddy.isGroup || currentBuddy.id.startsWith('gr') || currentBuddy.id === 'group-smm') {
                                return <span className="text-slate-600 font-medium">Группа</span>;
                              }
                              const onlineInfo = formatUserOnlineStatus(
                                (currentBuddy as any).lastSeen || (currentBuddy as any).last_seen,
                                currentBuddy.status === 'online'
                              );
                              return (
                                <span className={`flex items-center gap-1 font-medium ${onlineInfo.isOnline ? 'text-sky-700 font-semibold' : 'text-slate-500'}`}>
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${onlineInfo.isOnline ? 'bg-sky-500 animate-pulse' : 'bg-slate-300'}`} />
                                  <span>{onlineInfo.text}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 items-center flex-wrap">
                        {/* Group Info / Settings button */}
                        {(currentBuddy.isGroup || currentBuddy.id.startsWith('gr') || currentBuddy.id === 'group-smm') && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveGroupModalId(currentBuddy.id);
                              setIsGroupInfoModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold rounded-xl text-[14px] flex items-center gap-1.5 shadow-xs border border-white/20 transition-all cursor-pointer shrink-0"
                            title="Информация о группе и участники"
                          >
                            <Users className="w-4 h-4 text-white" />
                            <span className="hidden sm:inline">Инфо группы</span>
                          </button>
                        )}

                        {/* Personal chat actions (Block & Leave/Hide) */}
                        {!currentBuddy.isGroup && !currentBuddy.id.startsWith('gr') && currentBuddy.id !== 'group-smm' && currentBuddy.username !== 'saved_messages' && (
                          <>
                            <button
                              type="button"
                              onClick={handleToggleBlockPersonalChat}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[14px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 border ${
                                activePersonalChatBlocked
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                  : 'bg-white/90 hover:bg-white text-slate-700 hover:text-pink-600 border-pink-200'
                              }`}
                              title={activePersonalChatBlocked ? "Разблокировать собеседника" : "Заблокировать собеседника"}
                            >
                              <Shield className="w-4 h-4 text-pink-500" />
                              <span className="hidden sm:inline">{activePersonalChatBlocked ? 'Разблокировать' : 'Заблокировать'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleLeavePersonalChat}
                              className="px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-600 hover:text-pink-600 border border-pink-200 font-bold rounded-xl text-[14px] flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
                              title="Скрыть диалог"
                            >
                              <LogOut className="w-4 h-4 text-pink-500" />
                              <span className="hidden sm:inline">Скрыть чат</span>
                            </button>
                          </>
                        )}

                        {/* Auto-responder button ONLY in personal chats with other users, NOT in group chats and NOT in favorites/saved messages */}
                        {!currentBuddy.isGroup && !currentBuddy.id.startsWith('gr') && currentBuddy.id !== 'group-smm' && currentBuddy.id !== 'group-iismm' && currentBuddy.id !== 'gr_iismm_chat' && currentBuddy.username !== 'saved_messages' && currentBuddy.id !== 'saved_messages' && currentBuddy.id !== (currentUser?.id || user?.id) && (
                          <button
                            type="button"
                            onClick={() => setShowAutoReplyModal(true)}
                            className="px-3 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold rounded-xl text-[14px] flex items-center gap-1.5 shadow-md border border-white/20 transition-all cursor-pointer active:scale-95 shrink-0"
                            title="Настройки ИИ-автоответчика в этом личном диалоге"
                          >
                            <Bot className="w-4 h-4 text-white" />
                            <span className="hidden sm:inline">ИИ-автоответчик</span>
                          </button>
                        )}

                        {/* Mobile Drawer Trigger Button for Chat List */}
                        <button
                          type="button"
                          onClick={() => setIsMobileChatsDrawerOpen(true)}
                          className="md:hidden px-3 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold rounded-xl text-[14px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                          title="Открыть список чатов"
                        >
                          <MessageSquare className="w-4 h-4 text-white" />
                          <span>Чаты</span>
                          {unreadChatIds.length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Messages Body */}
                    <div ref={chatMessagesContainerRef} id="chat-messages-container" data-chat-message-list="true" className="flex-1 min-h-0 pt-1 px-4 pb-4 overflow-y-auto space-y-3.5 relative">
                      {(chatHistories[activeChatFriendId] || [])
                        .filter((msg) => {
                          const txt = String(
                            msg.text || msg.forwardedFrom?.text || msg.forwardedFrom?.title || ''
                          ).trim();
                          const imgs = parseSafeImagesList(
                            msg.images && msg.images.length > 0 ? msg.images : msg.forwardedFrom?.images
                          );
                          const mUrl = msg.mediaUrl || msg.forwardedFrom?.mediaUrl;
                          return Boolean(txt || imgs.length > 0 || mUrl || msg.mediaType === 'voice');
                        })
                        .map((msg) => {
                        const isMe = msg.sender === 'me';
                        const isGroup = activeChatFriendId === 'group-smm' || activeChatFriendId.startsWith('group') || activeChatFriendId.startsWith('gr') || Boolean(currentBuddy.isGroup);
                        const effectiveMsgText = String(
                          msg.text || msg.forwardedFrom?.text || msg.forwardedFrom?.title || ''
                        );
                        const safeImages = parseSafeImagesList(
                          msg.images && msg.images.length > 0 ? msg.images : msg.forwardedFrom?.images
                        );
                        const effectiveMediaUrl = msg.mediaUrl || msg.forwardedFrom?.mediaUrl;
                        const effectiveMediaType = msg.mediaType || msg.forwardedFrom?.mediaType;
                        return (
                          <div key={msg.id} className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto text-left items-start'}`}>
                            {isGroup && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetBuddy = virtualFriends.find(f => f.name === msg.senderName || f.id === msg.sender);
                                  const targetId = targetBuddy ? (targetBuddy.partnerId || targetBuddy.id) : (isMe ? (currentUser?.id || user.id) : null);
                                  if (targetId && !targetId.startsWith('group') && !targetId.startsWith('gr')) {
                                    window.history.pushState(null, '', `/social/${targetId}`);
                                    window.dispatchEvent(new Event('popstate'));
                                  }
                                }}
                                className={`flex items-center gap-1.5 mb-1 cursor-pointer group transition-opacity hover:opacity-80 ${isMe ? 'mr-1 flex-row-reverse' : 'pl-1'}`}
                                title="Перейти в профиль"
                              >
                                <img 
                                  src={isMe ? (normalizeProTalkMediaUrl(currentUser?.avatar) || BRAND_ASSETS.heartAvatar) : (normalizeProTalkMediaUrl(msg.senderAvatar || (virtualFriends.find(f => f.name === msg.senderName || f.id === msg.sender)?.avatar)) || BRAND_ASSETS.heartAvatar)} 
                                  alt={isMe ? 'Вы' : (msg.senderName || 'Участник')} 
                                  className="w-5 h-5 rounded-full object-cover border border-pink-300 shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
                                />
                                <span className="text-[14px] font-bold text-slate-800 group-hover:text-pink-600 transition-colors">
                                  {isMe ? 'Вы' : (msg.senderName || 'Участник')}
                                </span>
                              </div>
                            )}
                            {!isGroup && !isMe && msg.senderName && (
                              <span className="text-[14px] font-mono font-bold text-pink-600 mb-0.5">{msg.senderName}</span>
                            )}
                            <div 
                              data-chat-bubble="true"
                              onClick={(e) => {
                                if (window.getSelection()?.toString().trim()) {
                                  return;
                                }
                                e.stopPropagation();
                                const clickX = Math.min(e.clientX, window.innerWidth - 300);
                                const clickY = Math.min(e.clientY, window.innerHeight - 300);
                                setMsgClickPos({ x: Math.max(10, clickX), y: Math.max(10, clickY) });
                                setSelectedMessageForAction(msg);
                              }}
                              className={`p-3 rounded-2xl cursor-pointer hover:scale-[1.01] transition-transform duration-100 select-text relative min-w-0 max-w-full break-words ${
                                isMe 
                                  ? 'msg-bubble-sent text-slate-800 rounded-tr-none shadow-md' 
                                  : 'msg-bubble-received text-slate-800 rounded-tl-none shadow-sm'
                              }`}
                              title="Кликните для действий или выделите текст для форматирования"
                            >
                              {/* Forwarded from banner with original author */}
                              {msg.forwardedFrom && (
                                <div className="mb-2 p-2 rounded-xl bg-sky-100/80 border-l-4 border-sky-400 text-[14px] leading-snug text-slate-800 max-w-full text-left flex items-center gap-1.5 shadow-2xs flex-wrap">
                                  <Forward className="w-4 h-4 text-sky-600 shrink-0" />
                                  <span className="text-slate-600 font-medium">Переслано от:</span>
                                  <span className="text-slate-900 font-bold break-words">{msg.forwardedFrom.senderName || 'Соавтор'}</span>
                                </div>
                              )}

                              {/* Replied to section */}
                              {msg.replyTo && (
                                <div className="mb-2 p-2 rounded-xl bg-pink-100/80 border-l-4 border-pink-500 text-[14px] leading-snug text-slate-800 max-w-full text-left">
                                  <span className="text-slate-800 font-medium line-clamp-1 block text-[14px]">
                                    {formatChatLastMessagePreview({
                                      text: msg.replyTo.text || '',
                                      fallback: 'Сообщение'
                                    })}
                                  </span>
                                </div>
                              )}

                              {effectiveMsgText.trim() && effectiveMediaType !== 'voice' && (
                                <div className="text-[14px] leading-relaxed select-text chat-message-text min-w-0 break-words">
                                  {(chatFormatMode === 'rich' || (msg as any).messageFormat === 'rich') ? (
                                    <RichPreviewRenderer content={effectiveMsgText} hideEmptyPlaceholder />
                                  ) : (
                                    <MarkdownRenderer content={effectiveMsgText} format="v2" isCompact />
                                  )}
                                </div>
                              )}
                              
                              {/* Attached chat images album list */}
                              {safeImages.length > 0 && (
                                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-pink-200/80">
                                  {safeImages.map((img, i) => (
                                    <div 
                                      key={i} 
                                      className="aspect-video relative overflow-hidden bg-sky-50/70 cursor-zoom-in"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenImagePreview(img, safeImages);
                                      }}
                                    >
                                      <img src={img} className="w-full h-full object-cover" alt="Chat attachment detail" />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Protalk media attachments rendering */}
                              {effectiveMediaUrl && (
                                <div className="mt-1.5">
                                  {effectiveMediaType === 'photo' && (
                                    <img src={effectiveMediaUrl} className="max-w-xs rounded-xl border border-pink-200 object-cover" alt="Protalk photo" />
                                  )}
                                  {effectiveMediaType === 'video' && (
                                    <video src={effectiveMediaUrl} controls className="max-w-xs rounded-xl border border-pink-200" />
                                  )}
                                  {msg.mediaType === 'voice' && (
                                    <VoiceMessagePlayer 
                                      audioUrl={msg.mediaUrl} 
                                      initialText={msg.text} 
                                      sender={msg.sender} 
                                      onTextUpdated={(newText) => {
                                        setChatHistories(prev => ({
                                          ...prev,
                                          [activeChatFriendId]: (prev[activeChatFriendId] || []).map(m => m.id === msg.id ? { ...m, text: newText } : m)
                                        }));
                                      }}
                                    />
                                  )}
                                  {msg.mediaType === 'file' && (
                                    <a href={msg.mediaUrl} download className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 rounded-xl font-bold text-xs hover:bg-pink-100 transition-colors">
                                      📁 Скачать документ / медиа
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Inline Buttons attached to message/post with their formats and colors */}
                              {msg.inlineButtons && Array.isArray(msg.inlineButtons) && msg.inlineButtons.length > 0 && (
                                <div className="mt-2.5 flex flex-col gap-1.5 w-full">
                                  {msg.inlineButtons.map((row: any, rIdx: number) => {
                                    const btnRow = Array.isArray(row) ? row : [row];
                                    return (
                                      <div key={rIdx} className="flex items-center gap-1.5 w-full">
                                        {btnRow.map((btn: any, bIdx: number) => {
                                          if (!btn || !btn.text) return null;
                                          const styleClasses = getInlineButtonStyleClasses(btn.style, btn.color);
                                          const btnUrl = btn.url || btn.webAppUrl;
                                          return btnUrl ? (
                                            <a
                                              key={bIdx}
                                              href={btnUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className={`flex-1 py-1.5 px-3 rounded-xl text-[14px] font-bold text-center transition-all flex items-center justify-center gap-1.5 truncate cursor-pointer shadow-xs ${styleClasses}`}
                                              title={btn.text}
                                            >
                                              <span className="truncate">{btn.text}</span>
                                              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                            </a>
                                          ) : (
                                            <button
                                              key={bIdx}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                customAlertShadow(`Нажата кнопка: "${btn.text}"`, 'info');
                                              }}
                                              className={`flex-1 py-1.5 px-3 rounded-xl text-[14px] font-bold text-center transition-all flex items-center justify-center gap-1.5 truncate cursor-pointer shadow-xs ${styleClasses}`}
                                              title={btn.text}
                                            >
                                              <span className="truncate">{btn.text}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Attached Message Reactions rendering */}
                              {(msg as any).reactions && (msg as any).reactions.length > 0 && (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const clickX = Math.min(e.clientX, window.innerWidth - 320);
                                    const clickY = Math.min(e.clientY, window.innerHeight - 380);
                                    setMsgClickPos({ x: Math.max(10, clickX), y: Math.max(10, clickY) });
                                    setSelectedMessageForAction(msg);
                                  }}
                                  className="group relative flex items-center gap-1.5 mt-2 flex-wrap cursor-pointer"
                                  title="Кликните, чтобы посмотреть кто поставил реакции или добавить свою"
                                >
                                  {/* Group reactions by type and display badges with counts */}
                                  {Array.from(new Set(((msg as any).reactions as any[]).map(r => typeof r === 'string' ? r : r.type))).map((type, idx) => {
                                    const usersForType = ((msg as any).reactions as any[]).filter(r => (typeof r === 'string' ? r : r.type) === type);
                                    return (
                                      <span 
                                        key={idx} 
                                        className="px-2 py-0.5 bg-white/95 border border-pink-200 rounded-full text-[14px] shadow-2xs flex items-center gap-1.5 hover:border-pink-400 hover:scale-105 transition-all font-bold text-slate-700"
                                      >
                                        <span>{getReactionSymbol(type)}</span>
                                        <span className="text-[14px] font-mono text-pink-600">{usersForType.length}</span>
                                      </span>
                                    );
                                  })}

                                  {/* Hover list popover on desktop */}
                                  <div className="hidden group-hover:block absolute bottom-full mb-1.5 left-0 z-50 p-2.5 bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-pink-300 min-w-48 max-w-xs text-left pointer-events-none">
                                    <div className="text-[14px] font-bold text-pink-700 mb-1.5 flex items-center gap-1">
                                      <Smile size={14} className="text-pink-600" />
                                      <span>Поставили реакции:</span>
                                    </div>
                                    <div className="space-y-1.5 max-h-36 overflow-hidden">
                                      {((msg as any).reactions as any[]).map((r: any, rIdx: number) => {
                                        const rType = typeof r === 'string' ? r : r.type;
                                        const rName = typeof r === 'string' ? 'Соавтор' : (r.userName || 'Соавтор');
                                        const rAvatar = (typeof r === 'object' && r.userAvatar) ? (normalizeProTalkMediaUrl(r.userAvatar) || BRAND_ASSETS.heartAvatar) : BRAND_ASSETS.heartAvatar;
                                        return (
                                          <div key={rIdx} className="flex items-center justify-between gap-2 text-[14px] bg-white/80 p-1 rounded-xl border border-pink-100">
                                            <div className="flex items-center gap-1.5 truncate">
                                              <img src={rAvatar} alt={rName} className="w-5 h-5 rounded-full object-cover border border-pink-300 shrink-0" />
                                              <span className="truncate font-bold text-slate-800 text-[14px]">{rName}</span>
                                            </div>
                                            <span className="shrink-0 text-base">{getReactionSymbol(rType)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="text-[12px] opacity-70 text-right mt-1 font-mono font-bold">{msg.time}</div>

                              {/* Real-time AI Moderation Indicator */}
                              {msg.moderationStatus === 'checking' && (
                                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 border border-pink-300 text-pink-700 text-[14px] font-semibold animate-pulse shadow-2xs">
                                  <Sparkles className="w-4 h-4 text-pink-600 animate-spin shrink-0" />
                                  <span>проверяется через ИИ...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input form with Image attachments */}
                    <div className="border-t border-pink-100 bg-white p-3 text-left shrink-0 w-full mt-auto">
                      {(activePersonalChatBlocked || activePersonalChatBlockedByThem) ? (
                        <div className="p-4 text-center rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-900 text-[14px] font-semibold space-y-2">
                          <p>
                            {activePersonalChatBlocked 
                              ? 'Вы заблокировали этого пользователя. Отправка сообщений отключена.'
                              : 'Собеседник ограничил возможность отправки сообщений в этот чат.'}
                          </p>
                          {activePersonalChatBlocked && (
                            <button
                              type="button"
                              onClick={handleToggleBlockPersonalChat}
                              className="px-4 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold rounded-xl text-[14px] inline-block cursor-pointer transition-all shadow-xs"
                            >
                              Разблокировать собеседника
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                      {replyingToMessage && (
                        <div className="flex items-center justify-between bg-gradient-to-r from-pink-50 to-sky-50 border-l-4 border-pink-500 p-2.5 text-[14px] rounded-xl mb-2">
                          <div className="min-w-0">
                            <span className="font-bold text-pink-700 block text-[14px]">{replyingToMessage.senderName || 'Соавтор'}:</span>
                            <p className="text-slate-700 truncate font-medium text-[14px]">{(replyingToMessage.text || '').split('\n')[0].trim() || 'Сообщение'}</p>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setReplyingToMessage(null)}
                            className="text-slate-405 hover:text-pink-600 font-extrabold text-base px-2 shrink-0 leading-none cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      )}

                      {/* Chat attached images previews */}
                      {chatAttachedImages.length > 0 && (
                        <div className="flex gap-2 p-1.5 overflow-x-auto no-scrollbar max-h-16 mb-2 border-b">
                          {chatAttachedImages.map((img, idx) => (
                            <div key={idx} className="relative w-11 h-11 rounded-lg overflow-hidden border group shrink-0">
                              <img src={img} className="w-full h-full object-cover" alt="Selected attachment thumbnail" />
                              <button 
                                type="button" 
                                onClick={() => setChatAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {chatAttachedImagesError && (
                        <p className="text-[10px] text-red-500 font-bold mb-1.5 px-1">{chatAttachedImagesError}</p>
                      )}

                      {/* ИИSMM Loader Progress Indicator */}
                      {protalkMediaFile && (
                        <div className="p-2 mb-2 bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 border border-pink-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-pink-600 font-black">⚡ ИИSMM Загрузчик:</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[140px]">{protalkMediaFile.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">({protalkMediaFile.progress}%)</span>
                          </div>
                          {protalkMediaFile.isUploading ? (
                            <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden shrink-0">
                              <div className="bg-gradient-to-r from-sky-400 to-pink-500 h-full transition-all duration-150" style={{ width: `${protalkMediaFile.progress}%` }} />
                            </div>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => setProtalkMediaFile(null)}
                              className="text-rose-500 hover:text-rose-700 font-bold text-sm px-1 cursor-pointer shrink-0"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )}

                      {/* Chat Format Bar: Mode switch & Selection Hint */}
                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-pink-100 flex-wrap">
                        <div className="text-[14px] text-slate-500 font-medium flex items-center gap-1.5">
                          <span>Выделите текст для открытия редактора форматирования</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Format Mode Switch: V2 vs Rich */}
                          <div className="flex items-center gap-1 bg-pink-50/70 p-0.5 rounded-xl border border-pink-200">
                            <button
                              type="button"
                              onClick={() => setChatFormatMode('v2')}
                              className={`px-3 py-1 rounded-lg text-[14px] font-bold transition-all cursor-pointer ${
                                chatFormatMode === 'v2'
                                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-pink-600'
                              }`}
                            >
                              V2
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatFormatMode('rich')}
                              className={`px-3 py-1 rounded-lg text-[14px] font-bold transition-all cursor-pointer ${
                                chatFormatMode === 'rich'
                                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-pink-600'
                              }`}
                            >
                              Rich
                            </button>
                          </div>

                          {/* Preview button */}
                          <button
                            type="button"
                            onClick={() => setIsChatPreviewOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                            title="Предпросмотр сообщения"
                          >
                            <Eye size={16} />
                            <span>Предпросмотр</span>
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleSendFullChatMessage} className="flex gap-2 items-end">
                        {/* In Rich mode: upload icons are hidden. In V2 mode: paperclip opens V2 modal */}
                        {chatFormatMode === 'v2' && (
                          <button 
                            type="button"
                            id="upload-protalk-media-btn" 
                            onClick={() => setIsV2MediaModalOpen(true)}
                            title="Прикрепить медиа или файлы" 
                            className="p-2.5 bg-pink-50 border border-pink-200 text-pink-600 rounded-xl hover:bg-pink-100 transition-colors cursor-pointer shrink-0 shadow-2xs mb-0.5"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                        )}

                        <div className="relative flex-1">
                          <textarea 
                            ref={chatMessageInputRef}
                            id="chat-message-input"
                            rows={1}
                            placeholder={`Написать личное сообщение ${currentBuddy.name}... (Enter — новый абзац, Ctrl+Enter — отправить)`}
                            value={currentMessageInputText}
                            onChange={(e) => {
                              setCurrentMessageInputText(e.target.value);
                              adjustChatTextareaHeight(e.currentTarget);
                            }}
                            onKeyDown={handleChatTextareaKeyDown}
                            className="w-full bg-slate-50 border border-slate-205 px-4 py-2.5 rounded-xl text-[14px] focus:outline-none focus:ring-1 focus:ring-pink-300 font-normal resize-none overflow-y-auto min-h-[44px] max-h-[220px] leading-relaxed transition-all"
                          />
                        </div>

                        {/* Voice recording button (AI STT) */}
                        <button 
                          type="button"
                          onClick={() => setIsVoiceModalOpen(true)}
                          title="Записать голосовое сообщение (ИИ-Распознавание)"
                          className="p-2.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs active:scale-95 mb-0.5"
                        >
                          <Mic className="w-4 h-4 text-white" />
                        </button>

                        <button 
                          type="submit"
                          className="p-2.5 iirky-social-bg-gradient text-white rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center shrink-0 mb-0.5"
                          title="Отправить сообщение (Ctrl+Enter)"
                        >
                          <SendHorizontal className="w-4 h-4" />
                        </button>
                      </form>

                      {/* Unified Selection Toolbar for both Chat Input and Chat Messages */}
                      <ChatGlobalTextToolbar
                        inputRef={chatMessageInputRef}
                        inputText={currentMessageInputText}
                        onInputTextChange={(newText) => {
                          setCurrentMessageInputText(newText);
                          setTimeout(() => adjustChatTextareaHeight(chatMessageInputRef.current), 0);
                        }}
                        containerRef={chatMessagesContainerRef}
                        formatMode={chatFormatMode}
                        onQuote={(quotedText) => {
                          setReplyingToMessage({
                            id: `quote-${Date.now()}`,
                            sender: 'them',
                            senderName: currentBuddy.name,
                            text: quotedText,
                            time: ''
                          });
                          chatMessageInputRef.current?.focus();
                        }}
                        onInsertToInput={(insertText) => {
                          setCurrentMessageInputText(prev => prev ? `${prev}\n${insertText}` : insertText);
                          chatMessageInputRef.current?.focus();
                          setTimeout(() => adjustChatTextareaHeight(chatMessageInputRef.current), 0);
                        }}
                      />
                      </>
                    )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Mobile Slide-Out Drawer from Right for Chats List */}
            {isMobileChatsDrawerOpen && (
              <div className="fixed inset-0 z-50 md:hidden">
                <div 
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                  onClick={() => setIsMobileChatsDrawerOpen(false)}
                />
                <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-85 max-w-[88vw] bg-gradient-to-b from-sky-50/95 via-pink-50/95 via-orange-50/95 to-sky-50/95 backdrop-blur-md shadow-2xl flex flex-col border-l-2 border-pink-300 animate-in slide-in-from-right duration-200 overflow-hidden text-left">
                  {/* Drawer Header */}
                  <div className="p-3.5 bg-white/95 border-b border-pink-200 flex items-center justify-between shrink-0 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-pink-600" />
                      <span className="font-bold text-[15px] text-slate-800">Список чатов</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileChatsDrawerOpen(false)}
                      className="p-1.5 rounded-xl hover:bg-pink-100 text-slate-600 hover:text-pink-600 cursor-pointer transition-colors"
                      title="Закрыть"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Drawer Search & Tabs & Create Group */}
                  <div className="p-3 bg-white/80 border-b border-pink-200 space-y-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileChatsDrawerOpen(false);
                        setIsCreateGroupModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-white" />
                      <span>Создать группу</span>
                    </button>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                      <input 
                        type="text" 
                        placeholder="Поиск по чатам..." 
                        value={chatsSearchText}
                        onChange={(e) => setChatsSearchText(e.target.value)}
                        className="w-full bg-white border border-pink-300 pl-9 pr-3 py-1.5 rounded-xl text-[14px] font-medium focus:outline-none focus:ring-1 focus:ring-pink-400 text-slate-800 placeholder-slate-400"
                      />
                    </div>

                    <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                      {[
                        { value: 'all', label: 'Все' },
                        { value: 'unread', label: 'Новые', count: unreadChatIds.length }
                      ].map((tabObj) => (
                        <button
                          key={tabObj.value}
                          onClick={() => setMessagesSubTab(tabObj.value as any)}
                          className={`px-3 py-1 text-[13px] font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                            messagesSubTab === tabObj.value
                              ? 'bg-pink-100 text-pink-700 border-pink-300 shadow-2xs'
                              : 'bg-white/80 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{tabObj.label}</span>
                            {tabObj.count !== undefined && tabObj.count > 0 && (
                              <span className="bg-pink-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-mono font-bold leading-none">
                                {tabObj.count}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Drawer Contacts List */}
                  <div className="divide-y divide-pink-100 flex-1 min-h-0 overflow-y-auto no-scrollbar bg-white/70">
                    {(() => {
                      const filtered = virtualFriends.filter((buddy) => {
                        if (isBannedAuthor(buddy.name, buddy.username)) return false;
                        const query = chatsSearchText.trim().toLowerCase();
                        if (query) {
                          const matchesName = (buddy.name || '').toLowerCase().includes(query) || 
                                              (buddy.username || '').toLowerCase().includes(query) ||
                                              (buddy.id || '').toLowerCase().includes(query) ||
                                              (buddy.partnerId && String(buddy.partnerId).toLowerCase().includes(query));
                          const history = chatHistories[buddy.id] || [];
                          const matchesMsg = history.some(m => (m.text || '').toLowerCase().includes(query));
                          if (!matchesName && !matchesMsg) return false;
                        }
                        if (messagesSubTab === 'unread') {
                          return unreadChatIds.includes(buddy.id);
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-[14px] text-slate-500 font-semibold bg-white/60 border border-dashed border-pink-300 rounded-xl m-3">
                            Активных чатов не найдено
                          </div>
                        );
                      }

                      return filtered.map((buddy) => {
                        const isSelected = activeChatFriendId === buddy.id;
                        const isUnread = unreadChatIds.includes(buddy.id);
                        const history = chatHistories[buddy.id] || [];
                        const lastMsgObj = history.length > 0 ? history[history.length - 1] : null;
                        const lastMsgText = formatChatLastMessagePreview({
                          text: lastMsgObj ? lastMsgObj.text : (buddy.lastMessage || ''),
                          mediaType: lastMsgObj?.mediaType,
                          mediaUrl: lastMsgObj?.mediaUrl,
                          images: lastMsgObj?.images,
                          forwardedFrom: lastMsgObj?.forwardedFrom,
                          fallback:
                            buddy.bio ||
                            (buddy.isGroup
                              ? 'Групповой чат сообщества @iismm_chat'
                              : 'Личная переписка')
                        });
                        const displayTime = (lastMsgObj?.time || buddy.lastTime || '').trim();

                        return (
                          <div
                            key={`mobile-drawer-${buddy.id}`}
                            onClick={() => {
                              handleSelectChat(buddy);
                              setIsMobileChatsDrawerOpen(false);
                            }}
                            className={`w-full p-3.5 text-left flex gap-3 transition-colors cursor-pointer select-none items-center relative ${
                              isSelected ? 'bg-pink-50/90 border-l-4 border-pink-500' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <img src={buddy.avatar} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-pink-200" />
                              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                buddy.status === 'online' ? 'bg-sky-500' : 'bg-slate-300'
                              }`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-2 mb-0.5">
                                <span className={`text-[14px] truncate block ${isUnread ? 'font-black text-pink-600' : 'font-bold text-slate-800'}`}>
                                  {buddy.name}
                                </span>
                                {displayTime && (
                                  <span className="text-[14px] text-slate-500 font-mono shrink-0">{displayTime}</span>
                                )}
                              </div>
                              <p className={`text-[14px] truncate leading-normal ${isUnread ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                                {lastMsgText}
                              </p>
                            </div>

                            {isUnread && (
                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* VIEW: AUTHORS CATALOG PAGE (/social/users) */}
        {activeSocialTab === 'users' && (
          <section className="col-span-12 max-w-5xl mx-auto w-full space-y-6">
            <AuthorsCatalog 
              currentUser={activeUser}
              onNavigateToChat={(targetChatId) => {
                window.history.pushState(null, '', `/social/messages/${targetChatId}`);
                window.dispatchEvent(new Event('popstate'));
              }}
            />
          </section>
        )}

        {/* VIEW 3: DEDICATED ESCROW & DEALS PAGE */}
        {activeSocialTab === 'deals' && (
          <section className="col-span-12 lg:col-span-12 space-y-6 text-left">
            
            {/* Module Banner: В разработке и соцсети */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-50 via-pink-50 via-orange-50 to-sky-50 border border-pink-200/80 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider mb-2 shadow-xs">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>🚧 В разработке и соцсети</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Модуль "В разработке и соцсети"</h2>
                  <p className="text-xs text-slate-600 font-medium mt-1 max-w-2xl leading-relaxed">
                    Здесь разрабатываются новые автономные интеграции с соцсетями (Telegram, ВК, YouTube, TenChat), совместный смарт-кросспостинг и партнерские соглашения.
                  </p>
                </div>
                <div className="shrink-0 p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/80 shadow-2xs text-center">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Статус модуля</span>
                  <span className="text-xs font-black text-sky-600 flex items-center justify-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                    Активное тестирование
                  </span>
                </div>
              </div>
            </div>

            {/* Create secure deal block */}
            <div className="iirky-card-block rounded-2xl p-5 pt-7 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-1 bg-gradient-to-r from-orange-600 to-pink-650 bg-clip-text text-transparent">
                <Shield className="w-5 h-5 text-orange-500 animate-pulse" />
                <span>Офис взаимных интеграций и соглашений Синдиката</span>
              </h2>
              <p className="text-[14px] text-slate-600 font-medium mb-4">
                Заполните форму, чтобы депонировать монеты ИИрки 🪙 под выполнение рекламного обязательства. Деньги поступят исполнителю только после вашего подтверждения!
              </p>

              <form onSubmit={handleCreateEscrowDeal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Название соглашения / Цель:</label>
                    <input 
                      type="text"
                      placeholder="Например: Пин папки через @IIrkiBot"
                      className="w-full bg-slate-50 border px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none"
                      value={newDealTitle}
                      onChange={(e) => setNewDealTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Сумма вознаграждения ИИрок (🪙):</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs">🪙</span>
                      <input 
                        type="number"
                        placeholder="50000"
                        className="w-full bg-slate-50 border pl-8 pr-3 py-2 rounded-xl text-xs font-mono font-bold text-orange-655 focus:outline-none"
                        value={newDealAmount}
                        onChange={(e) => setNewDealAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Исполнитель проекта:</label>
                    <select 
                      className="w-full bg-slate-50 border px-3 py-2 rounded-xl text-xs font-bold focus:outline-none"
                      value={newDealBuddyId}
                      onChange={(e) => setNewDealBuddyId(e.target.value)}
                    >
                      {virtualFriends.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.username})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Подробные условия сделки (Что должен сделать соавтор):</label>
                    <textarea 
                      rows={4}
                      placeholder="Опишите обязательства, сроки и необходимый UTM-трекинг..."
                      className="w-full bg-slate-50 border p-3 rounded-xl text-xs font-medium focus:outline-none"
                      value={newDealDesc}
                      onChange={(e) => setNewDealDesc(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingDeal}
                    className="w-full iirky-social-bg-gradient hover:opacity-90 text-white font-black text-xs py-3 rounded-xl uppercase shadow-md flex items-center justify-center gap-2 cursor-pointer transition-opacity"
                  >
                    {isSubmittingDeal ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Регистрация контракта...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-orange-200" />
                        <span>Депонировать ИИрки и открыть сделку</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Arbitration Live Panel (Mock Modal built inline) */}
            {arbitrationDealId && (
              <div className="bg-gradient-to-b from-slate-905 to-slate-950 text-white rounded-2xl p-5 border-2 border-orange-500 shadow-xl space-y-3.5 relative">
                <button 
                  onClick={() => setArbitrationDealId(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold"
                >
                  &times; Close
                </button>
                <div className="flex gap-2 items-center">
                  <Star className="w-5 h-5 text-yellow-300 animate-pulse animate-spin-slow" />
                  <h3 className="font-black text-sm uppercase text-orange-405">Заседание ИИ-Арбитража Сетки</h3>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto no-scrollbar space-y-1 text-slate-300">
                  {arbitrationLog.map((log, idx) => (
                    <div key={idx} className="flex gap-1.5">
                      <span className="text-orange-500">&gt;&gt;</span>
                      <p>{log}</p>
                    </div>
                  ))}
                </div>

                {arbitrationVerdict ? (
                  <div className="bg-sky-500/10 border border-sky-400/30 p-4.5 rounded-xl text-xs space-y-1.5 text-left">
                    <p className="font-extrabold text-sky-600 uppercase tracking-wider text-[10px]">⚖️ Вердикт арбитра получен:</p>
                    <p className="text-slate-100 italic leading-relaxed">"{arbitrationVerdict}"</p>
                    <span className="text-[9px] text-slate-400 block font-bold">Решение окончательное и обжалованию в союзе не подлежит.</span>
                  </div>
                ) : (
                  <div className="text-center font-mono text-xs text-orange-300 animate-pulse">
                    Павел Дуров выносит решение...
                  </div>
                )}
              </div>
            )}

            {/* Existing Active Deals list */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest">Мои активные сделки:</h3>
              
              {escrowDeals.length === 0 ? (
                <div className="iirky-card-block p-8 rounded-2xl text-center text-slate-400 text-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                  У вас пока нет зарегистрированных сделок в Сетке.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {escrowDeals.map((deal) => {
                    const isFunded = deal.status === 'funded';
                    const isCompleted = deal.status === 'completed';
                    const isRefunded = deal.status === 'refunded';
                    const isDisputed = deal.status === 'disputed';

                    return (
                      <div key={deal.id} className="iirky-card-block rounded-2xl p-4 pt-6 flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                        <div className="space-y-2 text-xs">
                          {/* Top Status */}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold">{deal.date}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              isFunded ? 'bg-orange-100 text-orange-850 border border-orange-200' :
                              isCompleted ? 'bg-sky-100 text-sky-800' : 
                              isRefunded ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'
                            }`}>
                              {isFunded ? '🪙 Выполнено & Депонировано' :
                               isCompleted ? '✔️ Исполнено & Выплачено' :
                               isRefunded ? '↩️ Возвращено заказчику' : '⚖️ Арбитраж Сетки'}
                            </span>
                          </div>

                          <h4 className="font-black text-slate-800 leading-tight text-[13px]">{deal.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-normal">{deal.description}</p>

                          {/* Buddy row */}
                          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                            <img src={deal.partnerAvatar} alt="Partner" className="w-6.5 h-6.5 rounded-full object-cover border" />
                            <div className="text-[10px]">
                              <span className="font-extrabold text-slate-700 block leading-tight">{deal.partnerName}</span>
                              <span className="text-slate-400 font-mono tracking-wider">Соавтор сделки</span>
                            </div>
                            <div className="ml-auto font-mono text-xs font-black text-orange-605">
                              {deal.amount.toLocaleString()} 🪙
                            </div>
                          </div>

                          {/* Collapsable Action logs history */}
                          <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-mono text-[9px] text-slate-400 leading-relaxed">
                            <span className="font-bold text-slate-500 uppercase block text-[8px] tracking-wider mb-0.5">История логов:</span>
                            {deal.logs.map((log, i) => (
                              <div key={i} className="flex gap-1">
                                <span className="text-pink-500">•</span>
                                <p>{log}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions available only on pending funded deal */}
                        {isFunded && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button 
                              onClick={() => handleReleaseEscrowFunds(deal.id)}
                              className="py-2.5 bg-sky-500 hover:opacity-90 text-white font-extrabold text-[10px] rounded-xl uppercase cursor-pointer text-center"
                            >
                              Выплатить ИИрки
                            </button>
                            <button 
                              onClick={() => handleRequestArbitration(deal.id)}
                              className="py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] rounded-xl uppercase cursor-pointer text-center"
                            >
                              ИИ-Арбитраж (Паша)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </section>
        )}

        {/* VIEW 4: COAUTHORS / FRIENDS FLOW PAGE */}
        {activeSocialTab === 'coauthors' && (
          <section className="col-span-12 lg:col-span-12 space-y-6 text-left">
            
            {/* Direct Tipping Modal inside tab */}
            {tippingBuddyId && (
              <div className="iirky-card-block p-5 pt-7 rounded-2xl relative overflow-hidden space-y-4">
                <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xs uppercase text-slate-800 flex items-center gap-1">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span>Поощрить соавтора ИИрками напрямую</span>
                  </h3>
                  <button onClick={() => setTippingBuddyId(null)} className="text-slate-400 font-bold">&times; Close</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="text-xs space-y-1">
                    <p className="font-extrabold">Кому перевод:</p>
                    <div className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border">
                      <img 
                        src={virtualFriends.find(f => f.id === tippingBuddyId)?.avatar} 
                        className="w-8 h-8 rounded-full object-cover" 
                        alt="Receiver" 
                      />
                      <div>
                        <span className="font-black block">{virtualFriends.find(f => f.id === tippingBuddyId)?.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{virtualFriends.find(f => f.id === tippingBuddyId)?.username}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="font-extrabold">Количество 🪙 ИИрок:</p>
                    <input 
                      type="number"
                      value={tipQuantityInput}
                      onChange={(e) => setTipQuantityInput(e.target.value)}
                      className="w-full bg-slate-50 border px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-orange-600 focus:outline-none"
                    />
                  </div>
                </div>

                {tipResponse ? (
                  <div className="bg-sky-50 text-sky-800 p-3 rounded-xl border border-pink-200 text-xs font-semibold">
                    {tipResponse}
                  </div>
                ) : (
                  <button 
                    onClick={handleSendTip}
                    disabled={isSendingTip}
                    className="w-full py-2.5 iirky-social-bg-gradient text-white text-[14px] font-bold rounded-xl select-none shadow-md cursor-pointer transition-opacity"
                  >
                    {isSendingTip ? 'Передаем монеты Сетки...' : 'Перевести монеты'}
                  </button>
                )}
              </div>
            )}

            {/* Main Friends Panel */}
            <div className="iirky-card-block rounded-2xl p-5 pt-7 relative overflow-hidden space-y-6">
              <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider bg-gradient-to-r from-pink-500 through-orange-500 to-sky-400 bg-clip-text text-transparent">
                    👥 Соавторы & Партнеры Сетки
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                    Управление вашим профессиональным содружеством. Ищите соавторов, обменивайтесь заявками и читайте их ленты.
                  </p>
                </div>
              </div>

              {/* Sub-tab Selection bar */}
              <div className="flex border-b border-slate-100 pb-px gap-1 bg-slate-50 p-1.5 rounded-xl border">
                {[
                  { value: 'my', label: 'Мои Соавторы', count: virtualFriends.filter(f => f.isFriend && f.id !== 'group-smm').length, color: 'text-sky-600 bg-sky-50' },
                  { value: 'incoming', label: 'Входящие предложения', count: virtualFriends.filter(f => f.isPendingMe && !f.isFriend).length, alertPulse: virtualFriends.some(f => f.isPendingMe && !f.isFriend), color: 'text-pink-600 bg-pink-50 animate-pulse-subtle' },
                  { value: 'search', label: 'Найти соавторов', count: null, color: 'text-orange-600 bg-orange-50' }
                ].map((st) => (
                  <button 
                    key={st.value}
                    onClick={() => {
                      setCoauthorActiveSubTab(st.value as any);
                      setCoauthorSearchText('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 sm:px-2 text-[10px] sm:text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                      coauthorActiveSubTab === st.value 
                        ? `${st.color} shadow-xs border border-black/5` 
                        : 'text-slate-500 hover:bg-white hover:text-slate-800'
                    }`}
                  >
                    <span>{st.label}</span>
                    {st.alertPulse && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                    {st.count !== null && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white border font-bold">
                        {st.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search text input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder={
                    coauthorActiveSubTab === 'my' ? 'Быстрый поиск среди соавторов по имени или юзернейму...' :
                    coauthorActiveSubTab === 'incoming' ? 'Поиск во входящих предложениях...' :
                    'Искать соавторов во всей базе Сетки...'
                  }
                  value={coauthorSearchText}
                  onChange={(e) => setCoauthorSearchText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-pink-350 transition-colors"
                />
              </div>

              {/* Dynamic list rendering */}
              <div className="space-y-3.5">
                {(() => {
                  let filteredList = virtualFriends;

                  // Filter by current active tab status
                  if (coauthorActiveSubTab === 'my') {
                    filteredList = virtualFriends.filter(f => f.isFriend && f.id !== 'group-smm');
                  } else if (coauthorActiveSubTab === 'incoming') {
                    filteredList = virtualFriends.filter(f => f.isPendingMe && !f.isFriend);
                  } else {
                    // Search tab displays co-authors not in friend list and not group
                    filteredList = virtualFriends.filter(f => f.id !== 'group-smm');
                  }

                  // Filter by text query
                  if (coauthorSearchText.trim()) {
                    const q = coauthorSearchText.toLowerCase();
                    filteredList = filteredList.filter(f => 
                      f.name.toLowerCase().includes(q) || 
                      f.username.toLowerCase().includes(q)
                    );
                  }

                  if (filteredList.length === 0) {
                    return (
                      <div className="p-10 text-center bg-slate-50 border border-dashed rounded-xl space-y-2 text-slate-400 font-semibold text-xs">
                        <UserPlus className="w-8 h-8 text-slate-300 mx-auto" />
                        <p>Никого не найдено с такими критериями.</p>
                        {coauthorActiveSubTab === 'search' && (
                          <p className="text-[10px] text-slate-400 font-normal">
                            Попробуйте ввести другое имя, зарегистрировать нового автора кнопкой выше или сбросить поисковый запрос!
                          </p>
                        )}
                      </div>
                    );
                  }

                  return filteredList.map(buddy => {
                    const isFriend = buddy.isFriend;
                    const isPendingMe = buddy.isPendingMe;
                    const isPendingThem = buddy.isPendingThem;

                    return (
                      <div 
                        key={buddy.id} 
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                          isFriend ? 'bg-sky-50/10 hover:border-pink-300 border-slate-100' : 'bg-white hover:border-pink-200 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="relative shrink-0">
                            <img src={buddy.avatar} className="w-11 h-11 rounded-full object-cover border" alt={buddy.name} />
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              buddy.status === 'online' ? 'bg-sky-500' : 'bg-slate-350'
                            }`} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold text-slate-800 text-sm leading-snug">{buddy.name}</span>
                              <span className="font-mono text-[10px] font-bold text-pink-600">{buddy.username}</span>
                              {isFriend && (
                                <span className="bg-sky-100 text-sky-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                  Соавтор
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-[11px] font-semibold mt-1 leading-normal max-w-md">{buddy.bio}</p>
                          </div>
                        </div>

                        {/* Interactive Buttons for co-author management */}
                        <div className="flex flex-wrap gap-2 shrink-0 self-end sm:self-center">
                          
                          {/* Viewing Feed always allowed */}
                          <button 
                            onClick={() => {
                              setFeedFilterUser(buddy);
                              const identifier = buddy.username ? buddy.username.replace('@', '') : buddy.id;
                              window.history.pushState(null, '', `/social/feed/${identifier}`);
                              window.dispatchEvent(new Event('popstate'));
                            }}
                            className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 transition-colors border border-pink-100 cursor-pointer"
                            title="Смотреть авторскую ленту"
                          >
                            Смотреть Ленту
                          </button>

                          {/* Friends actions */}
                          {isFriend && (
                            <>
                              <button 
                                onClick={() => {
                                  openChatWith(buddy);
                                  setActiveChatFriendId(buddy.id);
                                  const identifier = buddy.username ? buddy.username.replace('@', '') : buddy.id;
                                  window.history.pushState(null, '', `/social/messages/${identifier}`);
                                  window.dispatchEvent(new Event('popstate'));
                                }}
                                className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors border border-sky-100 cursor-pointer"
                              >
                                Написать
                              </button>

                              <button 
                                onClick={() => {
                                  setTippingBuddyId(buddy.id);
                                  setTipResponse(null);
                                }}
                                className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 transition-colors border border-yellow-250 cursor-pointer flex items-center gap-0.5 font-mono"
                              >
                                <span>🪙 Перевести</span>
                              </button>

                              <button 
                                onClick={() => {
                                  if (confirm(`Вы уверены, что хотите прекратить соавторство с ${buddy.name}?`)) {
                                    handleRemoveOrDecline(buddy.id);
                                  }
                                }}
                                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Прекратить соавторство"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Inbound request management */}
                          {!isFriend && isPendingMe && (
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => handleAcceptProposal(buddy.id)}
                                className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-gradient-to-r from-sky-400 via-pink-400 via-orange-400 via-pink-400 to-sky-400 hover:opacity-90 text-white transition-colors cursor-pointer"
                              >
                                Принять
                              </button>
                              <button 
                                onClick={() => handleRemoveOrDecline(buddy.id)}
                                className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              >
                                Отклонить
                              </button>
                            </div>
                          )}

                          {/* Outbound request management */}
                          {!isFriend && !isPendingMe && isPendingThem && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider bg-slate-50 px-2 py-1 rounded border">
                                Заявка отправлена
                              </span>
                              <button 
                                onClick={() => handleCancelRequest(buddy.id)}
                                className="p-1 px-2.5 text-[9px] uppercase font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer border"
                              >
                                Отменить
                              </button>
                            </div>
                          )}

                          {/* Invite/Add Co-author action */}
                          {!isFriend && !isPendingMe && !isPendingThem && (
                            <button 
                              onClick={() => handleSendRequest(buddy.id)}
                              className="p-2 px-3 text-[10px] uppercase font-black tracking-wider rounded-lg bg-gradient-to-r from-pink-500 via-orange-500 to-sky-400 hover:opacity-90 active:scale-95 text-white transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Предложить соавторство</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Smart assistance sidebar-type tips */}
            <div className="iirky-card-block p-5 rounded-2xl text-left bg-gradient-to-tr from-sky-50 to-pink-50 relative overflow-hidden text-xs leading-relaxed border border-pink-100/40">
              <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-pink-500" />
                <span>Зачем объединяться с другими соавторами?</span>
              </h4>
              <p className="text-slate-605 font-semibold leading-normal">
                SMM Сетка построена на принципах децентрализованного взаимного пиара и защищенных эскроу-сделок. Объединяясь со взаимными партнерами, вы можете моментально формировать рекламные папки, раздавать репосты со своей стены и наливать органический SMM-трафик. Индивидуальный траст соавторов напрямую зависит от количества завершенных коллабораций.
              </p>
            </div>
          </section>
        )}

        {/* VIEW 5: SAVED FOLDERS PAGE */}
        {activeSocialTab === 'saved' && (
          <section className="col-span-12 lg:col-span-12 space-y-6 text-left">
            {/* Create dynamic promo bundle folder */}
            <div className="iirky-card-block rounded-2xl p-5 pt-7 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 bg-gradient-to-r from-pink-500 to-sky-400 bg-clip-text text-transparent">
                <FolderPlus className="w-5 h-5 text-pink-500" />
                <span>Создать новую папку соавторов взаимного пиара</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-bold mb-4">
                Категоризируйте любимых партнеров и рассчитывайте суммарный SMM охват папки для ваших Telegram/VK ботов-интеграторов.
              </p>

              <form onSubmit={handleCreateFolder} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text"
                  placeholder="Назовите вашу тематическую папку..."
                  className="flex-1 bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                />

                <select 
                  className="bg-slate-50 border px-3 py-2 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                  value={newFolderCategory}
                  onChange={(e) => setNewFolderCategory(e.target.value)}
                >
                  <option value="SMM & Копирайтинг">SMM & Копирайтинг</option>
                  <option value="Performance Marketing">Performance Marketing</option>
                  <option value="Взаимный Пиар">Взаимный Пиар</option>
                  <option value="Крипта & Финансы">Крипта & Финансы</option>
                </select>

                <button 
                  type="submit"
                  disabled={isCreatingFolder}
                  className="px-6 py-2.5 iirky-social-bg-gradient text-white font-black text-xs uppercase rounded-xl shadow-md cursor-pointer transition-opacity"
                >
                  Создать папку
                </button>
              </form>
            </div>

            {/* List folders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedFolders.map((fol) => {
                return (
                  <div key={fol.id} className="iirky-card-block rounded-2xl p-4.5 pt-6 text-left space-y-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 iirky-social-bg-gradient" />
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">{fol.category}</span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold">UTM-трекер:</span>
                          <button 
                            type="button"
                            onClick={() => toggleUtmOnFolder(fol.id)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                              fol.utmActive ? 'bg-pink-600' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-xs transform transition-transform ${
                              fol.utmActive ? 'translate-x-4.5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-black text-slate-800 text-sm leading-tight">{fol.name}</h4>
                      
                      {/* Estimate row */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2.5 bg-slate-50 rounded-xl border">
                        <div>
                          <span className="text-slate-400 uppercase block">Соавторы:</span>
                          <span className="text-slate-700 font-bold text-xs">{fol.channelsCount} SMM союзов</span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase block">Суммарный охват:</span>
                          <span className="text-pink-605 font-bold text-xs">{fol.estimatedCoverage.toLocaleString()} просмотров/ч</span>
                        </div>
                      </div>

                      {/* Partners usernames */}
                      <div className="space-y-1">
                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block">Участники папки:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {fol.channelsList.map((ch, idx) => (
                            <span key={idx} className="bg-sky-50 text-sky-700 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center gap-1.5 text-xs">
                      <button 
                        onClick={() => {
                          alert(`Экспортировано ${fol.channelsCount} ссылок соавторов в формат JSON папки взаимного пиара для публикации!`);
                        }}
                        className="text-[9px] uppercase font-black text-pink-650 hover:underline"
                      >
                        Экспорт ссылок
                      </button>
                      <button 
                        onClick={() => {
                          setSavedFolders(savedFolders.filter(f => f.id !== fol.id));
                          alert('Папка удалена');
                        }}
                        className="text-[9px] uppercase font-black text-rose-500 hover:underline"
                      >
                        Удалить папку
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* 4. BACKGROUND PERSISTENT CHAT POPUPS (Floating messenger windows like Facebook) */}
      <div className="fixed bottom-0 right-4 z-50 flex gap-4 items-end justify-end pointer-events-none">
        {floatingChats.map(chat => (
          <div 
            key={chat.friendId}
            className="w-72 bg-white rounded-t-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col justify-between iirky-card-block"
            style={{ height: chat.isMinimized ? '40px' : '360px' }}
          >
            {/* Header chat row */}
            <div className="iirky-social-bg-gradient text-white p-2.5 flex items-center justify-between shrink-0 select-none cursor-pointer">
              <div 
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => setFloatingChats(
                  floatingChats.map(c => c.friendId === chat.friendId ? { ...c, isMinimized: !c.isMinimized } : c)
                )}
              >
                <img src={chat.friendAvatar} alt="Friend avatar" className="w-6 h-6 rounded-full object-cover border" />
                <span className="text-[11px] font-black truncate">{chat.friendName}</span>
              </div>

              <div className="flex gap-1.5 text-xs text-white/90 font-bold">
                <button 
                  onClick={() => setFloatingChats(
                    floatingChats.map(c => c.friendId === chat.friendId ? { ...c, isMinimized: !c.isMinimized } : c)
                  )}
                  className="hover:text-white"
                >
                  _
                </button>
                <button 
                  onClick={() => setFloatingChats(
                    floatingChats.filter(c => c.friendId !== chat.friendId)
                  )}
                  className="hover:text-white pl-1 font-bold text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            {!chat.isMinimized && (
              <>
                <div className="flex-1 p-3 overflow-y-auto no-scrollbar space-y-2 text-[11px] leading-relaxed max-h-[220px] bg-slate-50">
                  {chat.messages.map(msg => {
                    const isMe = msg.sender === 'me';
                    return (
                      <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto text-left items-start'}`}>
                        {msg.senderName && !isMe && (
                          <span className="text-[8px] font-mono text-pink-655 font-bold mb-0.5">{msg.senderName}</span>
                        )}
                        <div 
                          onClick={() => setSelectedMessageForAction(msg)}
                          className={`p-2.5 rounded-xl cursor-pointer hover:scale-[1.01] transition-transform duration-100 select-none ${
                            isMe 
                              ? 'msg-bubble-sent text-slate-800 rounded-tr-none shadow-sm' 
                              : 'msg-bubble-received text-slate-800 rounded-tl-none shadow-xs'
                          }`}
                          title="Кликните, чтобы ответить или переслать"
                        >
                          {/* Replied to section */}
                          {msg.replyTo && (
                            <div className="mb-1 p-1.5 rounded bg-pink-100/60 border-l-2 border-pink-500 text-[9px] leading-snug text-slate-800 italic max-w-full truncate">
                              <span className="font-extrabold text-[8px] text-pink-700 block not-italic uppercase mb-0.5">{msg.replyTo.senderName}:</span>
                              {msg.replyTo.text}
                            </div>
                          )}

                          {msg.text && <p className="font-semibold leading-normal">{msg.text}</p>}
                          
                          {/* Attached visual list */}
                          {(() => {
                            const safeImages = parseSafeImagesList(msg.images);
                            if (safeImages.length === 0) return null;
                            return (
                              <div className="mt-1 grid grid-cols-2 gap-0.5 rounded overflow-hidden">
                                {safeImages.map((img, i) => (
                                  <img 
                                    key={i} 
                                    src={img} 
                                    className="w-full h-8 object-cover border border-black/10 cursor-zoom-in" 
                                    alt="Floating thumbnail" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenImagePreview(img, safeImages);
                                    }}
                                  />
                                ))}
                              </div>
                            );
                          })()}

                          <span className="block text-[8px] opacity-60 text-right mt-1 font-mono font-bold">{msg.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Send chat entry */}
                <div className="border-t bg-white p-1 shrink-0">
                  {/* Selected images list */}
                  {floatingAttachedImages[chat.friendId] && floatingAttachedImages[chat.friendId].length > 0 && (
                    <div className="flex gap-1 p-1 bg-slate-50 border-b max-h-11 overflow-x-auto no-scrollbar">
                      {floatingAttachedImages[chat.friendId].map((img, idx) => (
                        <div key={idx} className="relative w-8 h-8 rounded overflow-hidden border group shrink-0">
                          <img src={img} className="w-full h-full object-cover" alt="Thumb" />
                          <button 
                            type="button"
                            onClick={() => setFloatingAttachedImages(prev => ({
                              ...prev,
                              [chat.friendId]: prev[chat.friendId].filter((_, i) => i !== idx)
                            }))}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {floatingAttachedImagesError[chat.friendId] && (
                    <p className="text-[8px] text-red-500 font-bold px-1 mb-1">{floatingAttachedImagesError[chat.friendId]}</p>
                  )}

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem('chat-msg') as HTMLInputElement;
                      sendFloatingMessage(chat.friendId, input.value);
                      form.reset();
                    }}
                    className="flex gap-1.5 bg-white shrink-0 items-center px-1"
                  >
                    {/* Visual attachment label */}
                    <label className="p-1 px-1.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg hover:border-pink-400 hover:text-pink-600 transition-colors cursor-pointer shrink-0">
                      <Image className="w-3.5 h-3.5" />
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => handleFloatingImagesChange(chat.friendId, e)} 
                        className="hidden" 
                      />
                    </label>

                    <input 
                      name="chat-msg"
                      autoComplete="off"
                      type="text" 
                      placeholder="Ваш ответ соавтору..." 
                      className="flex-1 bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] rounded-lg focus:outline-none"
                    />
                    <button 
                      type="submit"
                      className="p-1 px-2.5 iirky-social-bg-gradient text-white rounded-lg text-[9px] font-black uppercase transition-colors shrink-0"
                    >
                      Отпр.
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Premium Toast Notification Banner */}
      <AnimatePresence>
        {premiumToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[calc(100%-2.5rem)] text-left select-none pointer-events-none"
          >
            <div className={`p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 pointer-events-auto ${
              premiumToast.type === 'error' 
                ? 'bg-red-50/95 border-red-200 text-red-900' 
                : premiumToast.type === 'info'
                  ? 'bg-sky-50/95 border-sky-200 text-sky-900' 
                  : 'bg-white/95 border-pink-200 text-slate-800'
            }`}>
              <div className="shrink-0 mt-0.5">
                {premiumToast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {premiumToast.type === 'info' && <HelpCircle className="w-5 h-5 text-sky-500" />}
                {premiumToast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-pink-500" />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold leading-relaxed">{premiumToast.message}</p>
              </div>
              <button
                onClick={() => setPremiumToast(null)}
                className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Image Carousel Preview Modal (Light Theme & Ambient Gradient Style) */}
      {activeImagePreviewUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-tr from-pink-200/50 via-white/80 to-sky-200/50 backdrop-blur-md"
          onClick={() => {
            setActiveImagePreviewUrl(null);
            setActivePreviewAlbum([]);
          }}
        >
          <div 
            className="relative max-w-4xl w-full bg-white/95 p-6 rounded-3xl shadow-2xl border border-white flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex justify-between items-center pb-2 border-b border-pink-100">
              <span className="text-xs font-black tracking-wider text-pink-700 bg-pink-50 px-3 py-1 rounded-full uppercase">
                Просмотр фото {activePreviewAlbum.length > 1 && `(${currentAlbumIndex + 1} из ${activePreviewAlbum.length})`}
              </span>
              <button 
                onClick={() => {
                  setActiveImagePreviewUrl(null);
                  setActivePreviewAlbum([]);
                }}
                className="p-1.5 h-8 w-8 flex items-center justify-center bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-full cursor-pointer transition-colors"
                title="Закрыть просмотр"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Image Slider Area */}
            <div className="relative w-full flex items-center justify-between bg-gradient-to-tr from-pink-50/20 via-white/50 to-sky-50/20 rounded-2xl p-4 min-h-[250px] max-h-[60vh] overflow-hidden group">
              {/* Navigation Arrows if album */}
              {activePreviewAlbum.length > 1 && (
                <button 
                  onClick={() => {
                    const prevIdx = (currentAlbumIndex - 1 + activePreviewAlbum.length) % activePreviewAlbum.length;
                    setCurrentAlbumIndex(prevIdx);
                    setActiveImagePreviewUrl(activePreviewAlbum[prevIdx]);
                  }}
                  className="p-2.5 bg-white/90 hover:bg-white text-pink-700 rounded-full cursor-pointer transition-colors shadow-md border hover:scale-110 active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img 
                src={activeImagePreviewUrl} 
                alt="Premium attachment preview" 
                className="max-w-[70vw] max-h-[50vh] object-contain rounded-xl shadow-lg border border-slate-100/50 mx-auto transition-all duration-300"
                referrerPolicy="no-referrer"
              />

              {activePreviewAlbum.length > 1 && (
                <button 
                  onClick={() => {
                    const nextIdx = (currentAlbumIndex + 1) % activePreviewAlbum.length;
                    setCurrentAlbumIndex(nextIdx);
                    setActiveImagePreviewUrl(activePreviewAlbum[nextIdx]);
                  }}
                  className="p-2.5 bg-white/90 hover:bg-white text-pink-700 rounded-full cursor-pointer transition-colors shadow-md border hover:scale-110 active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Dots indicator */}
            {activePreviewAlbum.length > 1 && (
              <div className="flex gap-1.5 justify-center">
                {activePreviewAlbum.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentAlbumIndex(i);
                      setActiveImagePreviewUrl(activePreviewAlbum[i]);
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      currentAlbumIndex === i ? 'bg-pink-500 scale-125 w-4' : 'bg-pink-200 hover:bg-pink-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Message Actions Dialog Menu */}
      {selectedMessageForAction && (
        <div 
          className="fixed inset-0 z-[100] bg-sky-950/20 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => {
            setSelectedMessageForAction(null);
            setMsgClickPos(null);
          }}
        >
          <div 
            style={{
              position: 'fixed',
              top: msgClickPos ? `${Math.min(Math.max(10, msgClickPos.y - 40), window.innerHeight - 560)}px` : '50%',
              left: msgClickPos && window.innerWidth >= 640 ? `${Math.min(Math.max(10, msgClickPos.x - 290), window.innerWidth - 640)}px` : '50%',
              transform: (msgClickPos && window.innerWidth >= 640) ? 'none' : 'translate(-50%, -50%)',
              background: 'linear-gradient(135deg, rgba(224,242,254,0.96) 0%, rgba(252,231,243,0.96) 25%, rgba(254,237,213,0.96) 50%, rgba(252,231,243,0.96) 75%, rgba(224,242,254,0.96) 100%)'
            }}
            className="z-[101] w-[580px] max-w-[95vw] sm:w-[620px] backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-2xl border-2 border-pink-400 flex flex-col gap-3 text-left animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-pink-200/80">
              <h3 className="font-bold text-[16px] text-slate-800">Реакции и действия</h3>
              <button 
                onClick={() => {
                  setSelectedMessageForAction(null);
                  setMsgClickPos(null);
                }}
                className="p-1.5 rounded-full hover:bg-white/80 text-slate-500 hover:text-pink-600 transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reactions Row */}
            <div className="bg-white/90 p-2.5 rounded-2xl border border-pink-200 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shadow-2xs">
              {[
                { type: 'rainbow_heart', isCustom: true, label: 'Радужное сердечко' },
                { type: 'like', icon: '👍', label: 'Красава' },
                { type: 'love', icon: '❤️', label: 'Любовь' },
                { type: 'fire', icon: '🔥', label: 'Огонь' },
                { type: 'haha', icon: '😆', label: 'Смех' },
                { type: 'wow', icon: '😮', label: 'Шок' }
              ].map(rec => {
                const myId = String(currentUser?.id || user?.id || '16926299042');
                const hasReacted = (selectedMessageForAction.reactions || []).some((r: any) => {
                  const rUserId = typeof r === 'string' ? '' : r.userId;
                  const rType = typeof r === 'string' ? r : r.type;
                  return String(rUserId) === String(myId) && rType === rec.type;
                });

                return (
                  <button
                    key={rec.type}
                    type="button"
                    onClick={() => handleToggleMessageReaction(selectedMessageForAction.id, rec.type)}
                    className={`p-2 rounded-xl transition-all cursor-pointer transform hover:scale-125 active:scale-95 flex items-center justify-center shrink-0 ${
                      hasReacted ? 'bg-pink-200/80 ring-2 ring-pink-400' : 'hover:bg-pink-100/70'
                    }`}
                    title={rec.label}
                  >
                    {rec.isCustom ? (
                      <RainbowHeartIcon className="w-6 h-6 animate-pulse" />
                    ) : (
                      <span className="text-xl leading-none">{rec.icon}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected message preview snippet */}
            <div className="bg-white/80 p-3 rounded-2xl border border-pink-200 max-h-24 overflow-y-auto shadow-2xs space-y-1">
              <span className="text-[14px] font-bold text-pink-600 block">
                {selectedMessageForAction.sender === 'me' ? 'Вы' : (selectedMessageForAction.senderName || 'Соавтор')}
              </span>
              <p className="text-[14px] text-slate-700 font-medium leading-relaxed break-words">
                {selectedMessageForAction.text || '(Медиафайл или изображение)'}
              </p>
            </div>

            {/* Action buttons - in 1 single row with arrow icons and tooltips */}
            <div className="flex items-center gap-2.5 w-full">
              <button 
                type="button"
                onClick={() => {
                  setReplyingToMessage({
                    id: selectedMessageForAction.id,
                    sender: selectedMessageForAction.sender,
                    text: selectedMessageForAction.text || '(Изображение)',
                    senderName: selectedMessageForAction.senderName
                  });
                  setSelectedMessageForAction(null);
                  setMsgClickPos(null);
                }}
                title="Ответить на сообщение"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white/90 hover:bg-pink-50 text-slate-800 hover:text-pink-600 text-[14px] font-bold border-2 border-pink-300 hover:border-pink-400 shadow-2xs transition-all cursor-pointer group"
              >
                <Reply className="w-5 h-5 text-pink-500 group-hover:scale-110 transition-transform shrink-0" />
                <span>Ответить</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setForwardingMessage({
                    id: selectedMessageForAction.id,
                    text: selectedMessageForAction.text || '',
                    images: selectedMessageForAction.images,
                    mediaUrl: (selectedMessageForAction as any).mediaUrl,
                    mediaType: (selectedMessageForAction as any).mediaType,
                    messageFormat: (selectedMessageForAction as any).messageFormat || 'v2',
                    originalSenderName: (selectedMessageForAction as any).forwardedFrom?.senderName || selectedMessageForAction.senderName || (selectedMessageForAction.sender === 'me' ? (currentUser?.name || user?.name || 'Вы') : 'Соавтор'),
                    inlineButtons: (selectedMessageForAction as any).inlineButtons
                  });
                  setSelectedMessageForAction(null);
                  setMsgClickPos(null);
                }}
                title="Переслать сообщение в другой чат"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white/90 hover:bg-sky-50 text-slate-800 hover:text-sky-600 text-[14px] font-bold border-2 border-pink-300 hover:border-sky-400 shadow-2xs transition-all cursor-pointer group"
              >
                <Forward className="w-5 h-5 text-sky-500 group-hover:scale-110 transition-transform shrink-0" />
                <span>Переслать</span>
              </button>
            </div>

            {/* List of Users Who Reacted - at the very bottom, 10 per page with pagination */}
            {(() => {
              const reactionsList = selectedMessageForAction.reactions || [];
              const totalReactions = reactionsList.length;
              const pageSize = 10;
              const totalPages = Math.max(1, Math.ceil(totalReactions / pageSize));
              const currentPage = Math.min(reactionsModalPage, totalPages);
              const pagedReactions = reactionsList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              return (
                <div className="bg-white/85 p-3 rounded-2xl border border-pink-200 text-left space-y-2 shadow-2xs">
                  <div className="text-[14px] font-bold text-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Smile size={16} className="text-pink-600" />
                      <span>Поставили реакции:</span>
                    </div>
                    <span className="text-[14px] font-mono font-bold text-pink-600 bg-pink-100/80 px-2 py-0.5 rounded-full border border-pink-200">
                      {totalReactions}
                    </span>
                  </div>

                  {totalReactions === 0 ? (
                    <div className="py-2.5 text-center text-[14px] text-slate-500">
                      Пока никто не поставил реакцию — вы можете быть первым!
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                        {pagedReactions.map((rec: any, idx: number) => {
                          const recType = typeof rec === 'string' ? rec : rec.type;
                          const recName = typeof rec === 'string' ? 'Соавтор' : (rec.userName || 'Соавтор');
                          const recAvatar = (typeof rec === 'object' && rec.userAvatar) ? (normalizeProTalkMediaUrl(rec.userAvatar) || BRAND_ASSETS.heartAvatar) : BRAND_ASSETS.heartAvatar;
                          const recUserId = typeof rec === 'object' ? rec.userId : '';

                          return (
                            <div 
                              key={idx} 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (recUserId) {
                                  window.history.pushState(null, '', `/social/${recUserId}`);
                                  window.dispatchEvent(new Event('popstate'));
                                  setSelectedMessageForAction(null);
                                  setMsgClickPos(null);
                                }
                              }}
                              className="flex items-center justify-between gap-2 p-2 bg-pink-50/70 hover:bg-pink-100/80 rounded-xl border border-pink-200/80 cursor-pointer transition-colors group"
                              title="Перейти в профиль соавтора"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <img 
                                  src={recAvatar} 
                                  alt={recName} 
                                  className="w-7 h-7 rounded-full object-cover border border-pink-300 shrink-0 group-hover:scale-105 transition-transform" 
                                />
                                <span className="text-[14px] font-bold text-slate-800 truncate group-hover:text-pink-600 transition-colors">
                                  {recName}
                                </span>
                              </div>
                              <span className="text-lg shrink-0 flex items-center justify-center pl-1">
                                {getReactionSymbol(recType)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-pink-100 text-[13px]">
                          <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionsModalPage(p => Math.max(1, p - 1));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-pink-200 text-slate-700 font-bold hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Назад</span>
                          </button>
                          <span className="text-[14px] font-bold text-slate-600">
                            Страница {currentPage} из {totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionsModalPage(p => Math.min(totalPages, p + 1));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-pink-200 text-slate-700 font-bold hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                          >
                            <span>Вперед</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Chat Message Preview Modal */}
      <ChatPreviewModal
        isOpen={isChatPreviewOpen}
        onClose={() => setIsChatPreviewOpen(false)}
        onSend={() => {
          handleSendFullChatMessage();
        }}
        formatMode={chatFormatMode}
        text={currentMessageInputText}
        attachedImages={chatAttachedImages}
        mediaFile={protalkMediaFile ? {
          url: protalkMediaFile.url,
          type: protalkMediaFile.type,
          name: protalkMediaFile.name,
          size: protalkMediaFile.size
        } : null}
        replyingTo={replyingToMessage}
        currentUser={currentUser || user}
      />

      {/* Centralized AI Auto-Responder Modal */}
      <AutoResponderModal
        isOpen={showAutoReplyModal}
        onClose={() => setShowAutoReplyModal(false)}
        currentUser={currentUser || user}
        activeChatId={activeChatFriendId}
        activeChatPartnerName={virtualFriends.find(f => f.id === activeChatFriendId)?.name}
        activeChatPartnerId={activeChatFriendId}
      />

      {/* V2 Media Upload Modal */}
      <V2MediaUploadModal
        isOpen={isV2MediaModalOpen}
        onClose={() => setIsV2MediaModalOpen(false)}
        onAttach={handleV2MediaAttached}
      />

      {/* Chat AI Image Builder Modal */}
      <ImageBuilderModal
        isOpen={isChatAiImageModalOpen}
        onClose={() => setIsChatAiImageModalOpen(false)}
        title="Генерация картинки"
        editorFormat={chatFormatMode}
        defaultTargetMode={chatFormatMode === 'v2' && chatAttachedImages.length > 0 ? 'album' : 'photo'}
        initialPrompt={chatAiImagePrompt}
        userId={String(activeUser?.id || activeUser?.telegramId || '16926299042')}
        userBalance={Number(activeUser?.pointsBalance ?? activeUser?.balance ?? 0)}
        onRefreshUser={() => onUpdateUser?.({ ...user })}
        onSelectImage={(url) => {
          if (chatFormatMode === 'rich') {
            handleApplyChatConstructorSnippet(`\n![](${url})\n`);
          } else {
            setChatAttachedImages(prev => Array.from(new Set([...prev, url])).slice(0, 10));
          }
          setIsChatAiImageModalOpen(false);
          setChatAiImagePrompt('');
        }}
        onSelectImages={(urls, targetMode) => {
          if (!urls || urls.length === 0) return;
          if (chatFormatMode === 'rich') {
            let snippet = `\n![](${urls[0]})\n`;
            if (targetMode === 'slideshow') {
              snippet = `\n<tg-slideshow>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-slideshow>\n`;
            } else if (targetMode === 'collage') {
              snippet = `\n<tg-collage>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-collage>\n`;
            }
            handleApplyChatConstructorSnippet(snippet);
          } else {
            setChatAttachedImages(prev => Array.from(new Set([...prev, ...urls])).slice(0, 10));
          }
          setIsChatAiImageModalOpen(false);
          setChatAiImagePrompt('');
        }}
      />

      {/* Rich Format Modals for Chat Input */}
      <ChatTableModal
        isOpen={activeChatFormatModal === 'table'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      <ChatMediaModal
        isOpen={activeChatFormatModal === 'media'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      <ChatCarouselModal
        isOpen={activeChatFormatModal === 'carousel'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      <ChatCollageModal
        isOpen={activeChatFormatModal === 'collage'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      <ChatAnchorModal
        isOpen={activeChatFormatModal === 'anchors'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      <ChatFormulaModal
        isOpen={activeChatFormatModal === 'formula'}
        onClose={() => setActiveChatFormatModal(null)}
        formatMode={chatFormatMode}
        onApply={handleApplyChatConstructorSnippet}
      />

      {/* 3. Forward Message Target Selection Modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          isOpen={Boolean(forwardingMessage)}
          onClose={() => setForwardingMessage(null)}
          message={forwardingMessage}
          chats={virtualFriends}
          currentUser={currentUser || user}
          onForwardSuccess={(targetChatIds, firstChatId) => {
            const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const fwdMsg = {
              id: `full-m-fwd-${Date.now()}`,
              sender: 'me' as const,
              senderName: user?.name || currentUser?.name || 'Вы',
              forwardedFrom: {
                senderName: forwardingMessage.originalSenderName || 'Соавтор',
                originalId: forwardingMessage.id
              },
              inlineButtons: forwardingMessage.inlineButtons,
              text: forwardingMessage.text,
              time: timeNow,
              images: forwardingMessage.images,
              mediaUrl: forwardingMessage.mediaUrl,
              mediaType: forwardingMessage.mediaType,
              messageFormat: (forwardingMessage.messageFormat as any) || 'v2'
            };

            const myId = String(currentUser?.id || user?.id || '16926299042');
            const isSaved = firstChatId === 'saved_messages' || firstChatId === 'saved' || firstChatId === myId;
            const targetChatKey = isSaved ? 'saved_messages' : firstChatId;

            setChatHistories(prev => {
              const next = { ...prev };
              targetChatIds.forEach(chatId => {
                const isTargetSaved = chatId === 'saved_messages' || chatId === 'saved' || chatId === myId;
                const key = isTargetSaved ? 'saved_messages' : chatId;
                next[key] = [...(next[key] || []), fwdMsg];
                if (isTargetSaved && myId !== 'saved_messages') {
                  next[myId] = [...(next[myId] || []), fwdMsg];
                }
              });
              return next;
            });

            // Refresh user chats to make sure any new chat is in virtualFriends
            fetchUserChats();

            // Switch to the first target chat
            const firstFriend = virtualFriends.find(f => f.id === firstChatId || (isSaved && (f.username === 'saved_messages' || f.id === myId || (f as any).partnerId === myId)));
            if (firstFriend) {
              handleSelectChat(firstFriend);
            } else {
              setActiveChatFriendId(targetChatKey);
              window.history.pushState(null, '', `/social/messages/${targetChatKey}`);
              window.dispatchEvent(new Event('popstate'));
            }

            customAlertShadow(`Сообщение успешно переслано в ${targetChatIds.length > 1 ? `${targetChatIds.length} чата` : 'чат'}!`, 'success');
            setForwardingMessage(null);
          }}
        />
      )}

      {/* 4. ProTalk Voice Recording Modal */}
      <VoiceRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onVoiceProcessed={handleVoiceProcessed}
        activeFriendName={virtualFriends.find(f => f.id === activeChatFriendId)?.name || 'Соавтор'}
      />

      {/* 5. Repost Modal for Feed Posts */}
      {repostModalPost && (
        <RepostModal
          isOpen={Boolean(repostModalPost)}
          onClose={() => setRepostModalPost(null)}
          post={{
            id: repostModalPost.id,
            title: repostModalPost.title || repostModalPost.content.slice(0, 50) || 'Публикация',
            content: repostModalPost.content,
            image: repostModalPost.image || (repostModalPost.images ? repostModalPost.images[0] : undefined),
            images: repostModalPost.images,
            authorName: repostModalPost.authorName || repostModalPost.author?.name || 'Автор публикации',
            authorAvatar: repostModalPost.authorAvatar || repostModalPost.author?.avatar,
            author: repostModalPost.author,
            inlineButtons: repostModalPost.inlineButtons || (repostModalPost as any).inline_buttons,
            messageFormat: detectPostFormat(repostModalPost.content, repostModalPost.messageFormat)
          }}
          currentUser={currentUser || user}
          userChats={virtualFriends}
          onRepostSuccess={(destination, newShares) => {
            if (repostModalPost) {
              setPosts(prev => prev.map(p => p.id === repostModalPost.id ? { ...p, sharesCount: newShares || (p.sharesCount || 0) + 1 } : p));
              fetch(`/api/blog/posts/${repostModalPost.id}/repost`, { method: 'POST' }).catch(() => {});
            }
            setRepostModalPost(null);
            customAlertShadow('Публикация успешно отправлена!', 'success');
          }}
        />
      )}

      {/* 6. Create Group Chat Modal */}
      <CreateGroupChatModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        currentUser={activeUser}
        onChatCreated={(newChat) => {
          const groupFriend: VirtualFriend = {
            id: newChat.id,
            name: newChat.name || 'Новая группа',
            username: `@${newChat.id}`,
            avatar: normalizeProTalkMediaUrl(newChat.avatar) || BRAND_ASSETS.logo,
            status: 'online',
            bio: 'Групповой чат соавторов',
            isFriend: true,
            isGroup: true
          };
          setVirtualFriends(prev => [groupFriend, ...prev.filter(p => p.id !== groupFriend.id)]);
          setActiveChatFriendId(groupFriend.id);
          fetchUserChats();
          window.history.pushState(null, '', `/social/messages/${groupFriend.id}`);
          window.dispatchEvent(new Event('popstate'));
        }}
      />

      {/* 7. Group Info and Management Modal */}
      <GroupInfoModal
        isOpen={isGroupInfoModalOpen}
        onClose={() => {
          setIsGroupInfoModalOpen(false);
          setActiveGroupModalId('');
        }}
        groupId={activeGroupModalId}
        currentUser={activeUser}
        onGroupUpdated={(updatedGroup) => {
          setVirtualFriends(prev => prev.map(f => {
            if (f.id === updatedGroup.id) {
              return {
                ...f,
                name: updatedGroup.title || f.name,
                avatar: updatedGroup.avatarUrl || f.avatar,
                bio: updatedGroup.description || f.bio
              };
            }
            return f;
          }));
          fetchUserChats();
        }}
        onLeftGroup={async (leftGroupId) => {
          await fetchUserChats();
          setVirtualFriends(prev => {
            const next = prev.filter(f => f.id !== leftGroupId);
            if (activeChatFriendId === leftGroupId) {
              const fallback = next[0]?.id || 'group-smm';
              setActiveChatFriendId(fallback);
              window.history.pushState(null, '', `/social/messages/${fallback}`);
              window.dispatchEvent(new Event('popstate'));
            }
            return next;
          });
        }}
      />

      {/* 8. Chat Subscription Warning Modal */}
      {chatSubscriptionWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-100/60 via-pink-100/60 to-orange-100/60 backdrop-blur-sm animate-in fade-in duration-150">
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
              <img 
                src={chatSubscriptionWarning.avatar} 
                alt={chatSubscriptionWarning.name} 
                className="w-11 h-11 rounded-full object-cover border-2 border-pink-300 shrink-0" 
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm truncate">{chatSubscriptionWarning.name}</p>
                <p className="text-sm font-mono text-slate-600 truncate">{chatSubscriptionWarning.username}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed font-normal">
              Чтобы отправлять сообщения соавтору в личном чате, сначала оформите подписку на его профиль.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const target = chatSubscriptionWarning;
                  const myId = String(currentUser?.id || user.id || '16926299042');
                  try {
                    await fetch('/api/subscriptions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        followerId: myId,
                        targetId: target.targetId,
                        targetName: target.name,
                        targetUsername: target.username,
                        targetAvatar: target.avatar,
                        action: 'subscribe'
                      })
                    });
                  } catch (e) {
                    console.error('Subscription error:', e);
                  }
                  setChatSubscriptionWarning(null);
                  setActiveChatFriendId(target.targetId);
                  window.history.pushState(null, '', `/social/messages/${target.targetId}`);
                  window.dispatchEvent(new Event('popstate'));
                }}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-md border border-white/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer text-center"
              >
                Подписаться и открыть чат
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatSubscriptionWarning(null);
                  window.history.pushState(null, '', '/social/users');
                  window.dispatchEvent(new Event('popstate'));
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-sm font-bold bg-white text-slate-700 border border-pink-200 hover:bg-pink-50/50 shadow-xs cursor-pointer text-center"
              >
                К авторам
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
        description="Приоритетное размещение и вывод публикаций в топ Ленты социальной сети платформы доступны с тарифа Отрыв."
      />

    </div>
  );
}
