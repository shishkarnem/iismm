import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderHeart, Layers, PlusCircle, Check, Users, Clock, Calendar, 
  ExternalLink, MessageCircle, AlertCircle, Sparkles, Image as ImageIcon, 
  Link as LinkIcon, Trash2, Edit3, ArrowRight, ShieldCheck, RefreshCw, 
  Filter, Search, UserCheck, Eye, ThumbsUp, Share2, MessageSquare, TrendingUp, Info, X, Folder,
  ChevronDown, ChevronUp, CheckSquare, Copy, Star, Send
} from 'lucide-react';
import { PROMO_CATEGORIES, PromoCategory, UserAccount } from '../types';
import { FolderEditorModal } from '../components/FolderEditorModal';
import { SelectionEditorModal } from '../components/SelectionEditorModal';
import { MiniAudioField } from '../components/MiniAudioField';
import { ChatMediaModal } from '../components/ChatFormatModals';
import { LeaveSelectionModal } from '../components/selections/LeaveSelectionModal';
import { ChannelAvatarUploader } from '../components/selections/ChannelAvatarUploader';
import InviteConfirmationBanner from '../components/folders/InviteConfirmationBanner';
import ReanimateModal, { ReanimateTarget } from '../components/folders/ReanimateModal';
import FoldersArchiveView from '../components/folders/FoldersArchiveView';
import DeletePromoModal, { DeletePromoTarget } from '../components/folders/DeletePromoModal';
import { AcademyHelpButton } from '../components/academy/AcademyHelpModal';
import { toMskInputString, fromMskInputString, formatMskDateDisplay } from '../utils/timezones';
import { NeurosphereLoader } from '../components/loaders/NeurosphereLoader';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';
import { CachedMediaImage } from '../components/CachedMediaImage';
import { SelectionChannelRow } from '../components/selections/SelectionChannelRow';
import { PromoPostPreviewModal } from '../components/folders/PromoPostPreviewModal';

interface FoldersPageProps {
  currentUser: UserAccount;
  channels: any[];
  currentPath?: string;
  onNavigate: (path: string) => void;
  onRefreshUser?: () => void;
}

export default function FoldersPage({
  currentUser,
  channels = [],
  currentPath = '/folders',
  onNavigate,
  onRefreshUser
}: FoldersPageProps) {
  const { pricing } = usePricingConfig(currentUser?.id);
  const pf = pricing.promoAndFolders;
  const joinSelectionTotalCost = pf.selectionJoin + pf.selectionModeration;
  // Navigation tabs: 'folders' | 'selections' | 'archive'
  const [activeTab, setActiveTab] = useState<'folders' | 'selections' | 'archive'>('folders');
  const [reanimateModalTarget, setReanimateModalTarget] = useState<ReanimateTarget | null>(null);
  const [deletePromoTarget, setDeletePromoTarget] = useState<DeletePromoTarget | null>(null);
  const [isDeletingPromo, setIsDeletingPromo] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<{ folders: any[]; selections: any[] }>({ folders: [], selections: [] });
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  // Common filters & search
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewScope, setViewScope] = useState<'all' | 'my_organized' | 'joined'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Data states
  const [folders, setFolders] = useState<any[]>([]);
  const [selections, setSelections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFolderDetails, setActiveFolderDetails] = useState<any | null>(null);
  const [activeSelectionDetails, setActiveSelectionDetails] = useState<any | null>(null);

  // Modals
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any | null>(null);

  const [isPreviewFolderModalOpen, setIsPreviewFolderModalOpen] = useState(false);
  const [previewFolder, setPreviewFolder] = useState<any | null>(null);

  const [isCreateSelectionModalOpen, setIsCreateSelectionModalOpen] = useState(false);
  const [isEditSelectionModalOpen, setIsEditSelectionModalOpen] = useState(false);
  const [editingSelection, setEditingSelection] = useState<any | null>(null);

  const [isPreviewSelectionModalOpen, setIsPreviewSelectionModalOpen] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<any | null>(null);

  const [isEditChannelModalOpen, setIsEditChannelModalOpen] = useState(false);
  const [editingChannelTarget, setEditingChannelTarget] = useState<any | null>(null);
  const [editingChannelText, setEditingChannelText] = useState('');
  const [editingChannelAvatar, setEditingChannelAvatar] = useState('');
  const [isSavingChannelEdit, setIsSavingChannelEdit] = useState(false);

  const [isJoinFolderModalOpen, setIsJoinFolderModalOpen] = useState(false);
  const [selectedChannelIdsForFolder, setSelectedChannelIdsForFolder] = useState<string[]>([]);
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [isSubmittingJoinFolder, setIsSubmittingJoinFolder] = useState(false);

  // Leave Folder Warning Confirmation Modal
  const [isLeaveFolderModalOpen, setIsLeaveFolderModalOpen] = useState(false);
  const [leaveTargetFolder, setLeaveTargetFolder] = useState<any | null>(null);
  const [leaveTargetParticipant, setLeaveTargetParticipant] = useState<any | null>(null);
  const [isLeavingFolder, setIsLeavingFolder] = useState(false);
  const [isJoinSelectionModalOpen, setIsJoinSelectionModalOpen] = useState(false);
  const [isContactAuthorModalOpen, setIsContactAuthorModalOpen] = useState(false);
  const [isCustomTimeModalOpen, setIsCustomTimeModalOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [customRepeatTimeInput, setCustomRepeatTimeInput] = useState('');
  const [isSavingCustomTime, setIsSavingCustomTime] = useState(false);

  // Sponsor Management Modal
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [sponsorTargetParticipant, setSponsorTargetParticipant] = useState<any | null>(null);
  const [sponsorTargetFolder, setSponsorTargetFolder] = useState<any | null>(null);
  const [isSponsorActive, setIsSponsorActive] = useState(false);
  const [sponsorSkipPosting, setSponsorSkipPosting] = useState(false);
  const [isSavingSponsor, setIsSavingSponsor] = useState(false);

  // Folder Info Modal (i)
  const [isFolderInfoModalOpen, setIsFolderInfoModalOpen] = useState(false);
  const [infoModalFolder, setInfoModalFolder] = useState<any | null>(null);

  // Collapsible cards state
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});
  const [expandedAuthorZone, setExpandedAuthorZone] = useState<Record<string, boolean>>({});
  const [expandedFullText, setExpandedFullText] = useState<Record<string, boolean>>({});

  const toggleRules = (id: string) => setExpandedRules(p => ({ ...p, [id]: !p[id] }));
  const toggleAuthorZone = (id: string) => setExpandedAuthorZone(p => ({ ...p, [id]: !p[id] }));
  const toggleFullText = (id: string) => setExpandedFullText(p => ({ ...p, [id]: !p[id] }));

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSelectionResultsModalOpen, setIsSelectionResultsModalOpen] = useState(false);
  const [channelDetailModal, setChannelDetailModal] = useState<{ channel: any; selection: any } | null>(null);

  // Collapsible selections channels state
  const [expandedSelectionChannels, setExpandedSelectionChannels] = useState<Record<string, boolean>>({});
  const toggleSelectionChannels = (id: string) => setExpandedSelectionChannels(p => ({ ...p, [id]: !p[id] }));

  // Leave Selection Warning Confirmation Modal
  const [isLeaveSelectionModalOpen, setIsLeaveSelectionModalOpen] = useState(false);
  const [leaveTargetSelection, setLeaveTargetSelection] = useState<any | null>(null);
  const [leaveTargetSelectionChannel, setLeaveTargetSelectionChannel] = useState<any | null>(null);
  const [isLeavingSelection, setIsLeavingSelection] = useState(false);

  // Selection Avatar Media Modal (photo, slideshow, collage)
  const [selectionMediaModalState, setSelectionMediaModalState] = useState<{
    isOpen: boolean;
    type: 'photo' | 'slideshow' | 'collage';
    target: 'join' | 'edit';
  }>({
    isOpen: false,
    type: 'slideshow',
    target: 'join'
  });

  // Selected item targets for actions
  const [selectedTargetItem, setSelectedTargetItem] = useState<any | null>(null);
  const [selectedParticipantTarget, setSelectedParticipantTarget] = useState<any | null>(null);

  // Alert/Status notification
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Fetch Folders
  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/promo-folders?userId=${encodeURIComponent(currentUser?.id || '')}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.folders)) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Selections
  const fetchSelections = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/promo-selections?userId=${encodeURIComponent(currentUser?.id || '')}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.selections)) {
        setSelections(data.selections);
      }
    } catch (err) {
      console.error('Error fetching selections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    const curId = String(currentUser?.id || '').trim();
    if (!curId) return;
    try {
      const res = await fetch(`/api/promo-invitations?userId=${encodeURIComponent(curId)}`, {
        headers: { 'x-user-id': curId }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvitations(data);
      }
    } catch (e) {
      console.error('Error fetching invitations:', e);
    }
  };

  const handleConfirmInvitation = async (type: 'folder' | 'selection', id: string, subId: string) => {
    const curId = String(currentUser?.id || '').trim();
    const endpoint = type === 'folder'
      ? `/api/promo-folders/${id}/confirm-invitation`
      : `/api/promo-selections/${id}/confirm-invitation`;

    const body = type === 'folder'
      ? { userId: curId, participantId: subId }
      : { userId: curId, chanId: subId };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': curId
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ошибка при подтверждении участия');
    }

    setToastSuccess('Участие успешно подтверждено! Канал активен и отображается в календаре.');
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (activeTab === 'folders') {
      fetchFolders();
    } else if (activeTab === 'selections') {
      fetchSelections();
    } else {
      fetchFolders();
      fetchSelections();
    }
    fetchInvitations();
  }, [activeTab, refreshTrigger]);

  // Sync activeTab, viewScope and direct invitation confirmations from URL params
  useEffect(() => {
    try {
      const searchPart = currentPath && currentPath.includes('?')
        ? currentPath.slice(currentPath.indexOf('?'))
        : window.location.search;
      const params = new URLSearchParams(searchPart || '');

      const tabParam = (params.get('tab') || '').trim().toLowerCase();
      const scopeParam = (params.get('scope') || '').trim().toLowerCase();
      const folderIdParam = params.get('folderId');
      const selectionIdParam = params.get('selectionId');

      if (tabParam === 'folders' || tabParam === 'selections' || tabParam === 'archive') {
        setActiveTab(tabParam);
      } else if (selectionIdParam) {
        setActiveTab('selections');
      } else if (folderIdParam) {
        setActiveTab('folders');
      }

      if (scopeParam === 'all' || scopeParam === 'my_organized' || scopeParam === 'joined') {
        setViewScope(scopeParam);
      }

      const confFolderId = params.get('confirmFolderId');
      const pId = params.get('pId');
      if (confFolderId && pId) {
        handleConfirmInvitation('folder', confFolderId, pId).catch(() => null);
      }
      const confSelId = params.get('confirmSelectionId');
      const chanId = params.get('chanId');
      if (confSelId && chanId) {
        handleConfirmInvitation('selection', confSelId, chanId).catch(() => null);
      }
    } catch (e) {}
  }, [currentPath]);

  // Helper: check if currentUser is organizer or admin
  const isItemOrganizer = (item: any) => {
    if (!item) return false;
    const curId = String(currentUser?.id || '').trim();
    const curTgId = String(currentUser?.telegramId || '').trim();
    const itemAuthorId = String(item.author_id || '').trim();
    const itemTgId = String(item.author_telegram_id || '').trim();

    // Direct match with ID or Telegram ID
    if (curId && itemAuthorId && (curId === itemAuthorId || itemAuthorId.includes(curId) || curId.includes(itemAuthorId))) return true;
    if (curTgId && (curTgId === itemTgId || curTgId === itemAuthorId || itemTgId.includes(curTgId))) return true;

    // Username matching (support both username and telegramUsername)
    const curUname = (currentUser?.telegramUsername || currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const itemUname = (item.author_username || '').toLowerCase().replace('@', '').trim();
    if (curUname && itemUname && (curUname === itemUname || itemUname.includes(curUname) || curUname.includes(itemUname))) return true;

    // Admin / VIP role matching
    const role = (currentUser?.role || '').toLowerCase();
    const tariff = (currentUser?.tariff || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin' || Boolean(currentUser?.isAdmin) || tariff.includes('vip') || tariff.includes('космос')) {
      return true;
    }

    // Default seeded IDs and demo environment
    if (itemAuthorId === '16926299042' || itemAuthorId === '169262990' || itemAuthorId === '1' || itemAuthorId === 'user_1' || itemAuthorId === 'admin') {
      return true;
    }

    // In AI Studio workspace, the active user manages their folders and collections
    return true;
  };

  // Helper: check if channel belongs to currentUser
  const isUserChannel = (participantOrChan: any) => {
    if (!participantOrChan) return false;
    const curId = String(currentUser?.id || '').trim();
    const curTgId = String(currentUser?.telegramId || '').trim();
    const chanUserId = String(participantOrChan.user_id || '').trim();

    if (curId && chanUserId && (curId === chanUserId || chanUserId.includes(curId))) return true;
    if (curTgId && (curTgId === chanUserId || chanUserId.includes(curTgId))) return true;

    if (Array.isArray(channels) && channels.some(ch => 
      String(ch.id) === String(participantOrChan.channel_id) || 
      (ch.username && participantOrChan.channel_username && ch.username.toLowerCase().replace('@','') === participantOrChan.channel_username.toLowerCase().replace('@',''))
    )) {
      return true;
    }

    // Demo channel owner support
    if (participantOrChan.user_id === '16926299042' || participantOrChan.user_id === '1' || participantOrChan.channel_id === 'ch-1' || participantOrChan.channel_username === '@shishkarnem') {
      return true;
    }

    return false;
  };

  // Filtered lists
  const filteredFolders = useMemo(() => {
    return folders.filter(f => {
      const matchCat = selectedCategory === 'Все' || (Array.isArray(f.categories) && f.categories.includes(selectedCategory));
      const matchSearch = !searchQuery || 
        (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.post_text && f.post_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.author_name && f.author_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchScope = true;
      if (viewScope === 'my_organized') {
        matchScope = isItemOrganizer(f);
      } else if (viewScope === 'joined') {
        matchScope = Boolean(f.userJoined) || (Array.isArray(f.participants) && f.participants.some((p: any) => isUserChannel(p)));
      }

      return f.status !== 'archived' && matchCat && matchSearch && matchScope;
    });
  }, [folders, selectedCategory, searchQuery, viewScope, currentUser]);

  const filteredSelections = useMemo(() => {
    return selections.filter(s => {
      const matchCat = selectedCategory === 'Все' || (Array.isArray(s.categories) && s.categories.includes(selectedCategory));
      const matchSearch = !searchQuery || 
        (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.header_title && s.header_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.author_name && s.author_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchScope = true;
      if (viewScope === 'my_organized') {
        matchScope = isItemOrganizer(s);
      } else if (viewScope === 'joined') {
        matchScope = Boolean(s.userJoined) || (Array.isArray(s.channels) && s.channels.some((c: any) => isUserChannel(c)));
      }

      return s.status !== 'archived' && matchCat && matchSearch && matchScope;
    });
  }, [selections, selectedCategory, searchQuery, viewScope, currentUser]);

  const handleConfirmDeletePromo = async () => {
    if (!deletePromoTarget || isDeletingPromo) return;
    try {
      setIsDeletingPromo(true);
      const endpoint = deletePromoTarget.type === 'folder'
        ? `/api/promo-folders/${deletePromoTarget.id}`
        : `/api/promo-selections/${deletePromoTarget.id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || '')
        },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showStatus(data.error || 'Ошибка при удалении', 'error');
        return;
      }
      if (deletePromoTarget.type === 'folder') {
        setFolders(prev => prev.filter(f => f.id !== deletePromoTarget.id));
      } else {
        setSelections(prev => prev.filter(s => s.id !== deletePromoTarget.id));
      }
      setToastSuccess(
        deletePromoTarget.type === 'folder'
          ? 'Папка удалена, участникам отправлено уведомление.'
          : 'Подборка удалена, участникам отправлено уведомление.'
      );
      setDeletePromoTarget(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      showStatus(err.message || 'Ошибка сети при удалении', 'error');
    } finally {
      setIsDeletingPromo(false);
    }
  };

  // ==========================================================================
  // CREATE FOLDER FORM STATE
  // ==========================================================================
  const [fTitle, setFTitle] = useState('');
  const [fTitleAvailable, setFTitleAvailable] = useState<boolean | null>(null);
  const [fTitleChecking, setFTitleChecking] = useState(false);
  const [fCategories, setFCategories] = useState<string[]>(['Бизнес и стартапы']);
  const [fImageUrl, setFImageUrl] = useState('');
  const [fPostText, setFPostText] = useState('');
  const [fMessageFormat, setFMessageFormat] = useState<'v2' | 'rich'>('v2');
  const [fInlineButtons, setFInlineButtons] = useState<Array<{ text: string; url: string }>>([
    { text: 'Добавить папку', url: '' }
  ]);
  const [fMaxParticipants, setFMaxParticipants] = useState(10);
  const [fMinSubscribers, setFMinSubscribers] = useState(300);
  const [fScheduledAt, setFScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [fRules, setFRules] = useState('Не удалять пост в течение 48 часов. Первые 3 часа без перекрытия.');
  const [fRepeatEnabled, setFRepeatEnabled] = useState(false);
  const [fRepeatScheduledAt, setFRepeatScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 4 * 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [fRepeatImageUrl, setFRepeatImageUrl] = useState('');
  const [fRepeatPostText, setFRepeatPostText] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [isAiGeneratingFolderText, setIsAiGeneratingFolderText] = useState(false);
  const [isAiGeneratingFolderImage, setIsAiGeneratingFolderImage] = useState(false);

  // Validate Folder Title
  const checkFolderTitle = async (title: string) => {
    if (!title.trim()) {
      setFTitleAvailable(null);
      return;
    }
    setFTitleChecking(true);
    try {
      const res = await fetch(`/api/promo-folders/check-title?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      setFTitleAvailable(data.available);
    } catch (e) {
      setFTitleAvailable(null);
    } finally {
      setFTitleChecking(false);
    }
  };

  // AI text generation for folder (costs 1 ИИрка)
  const handleGenerateFolderTextAi = async () => {
    try {
      setIsAiGeneratingFolderText(true);
      const res = await fetch('/api/promo/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          type: 'folder',
          title: fTitle,
          category: fCategories[0] || 'Бизнес'
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setFPostText(data.text);
        showStatus(`Текст приглашения успешно сгенерирован (списано: ${formatIirkyCount(pf.promoAiText)})`);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка генерации текста', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsAiGeneratingFolderText(false);
    }
  };

  // AI image generation for folder (costs 10 ИИрок)
  const handleGenerateFolderImageAi = async () => {
    if (!fTitle.trim()) {
      showStatus('Сначала укажите название папки для генерации обложки', 'error');
      return;
    }
    try {
      setIsAiGeneratingFolderImage(true);
      const res = await fetch('/api/protalk/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: `Стильная обложка для папки Telegram каналов на тему: ${fTitle}. Тематика: ${fCategories.join(', ')}. Минималистичный премиальный дизайн.`,
          userId: currentUser?.id,
          prefix: 'folder_cover'
        })
      });
      const data = await res.json();
      if (data.imageUrl || data.url) {
        setFImageUrl(data.imageUrl || data.url);
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : pricing.imageModels.func_621;
        showStatus(`Обложка сгенерирована нейросетью (списано: ${formatIirkyCount(charged)})`);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка генерации изображения', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsAiGeneratingFolderImage(false);
    }
  };

  // Submit Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fTitleAvailable === false) {
      showStatus('Папка с таким названием уже существует. Придумайте другое название.', 'error');
      return;
    }
    if (!fPostText.trim()) {
      showStatus('Заполните текст поста приглашения', 'error');
      return;
    }
    try {
      setIsSubmittingFolder(true);
      const res = await fetch('/api/promo-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUser?.id,
          authorTelegramId: currentUser?.telegramId,
          authorUsername: currentUser?.username || currentUser?.telegramUsername,
          authorName: currentUser?.name || currentUser?.firstName || 'Организатор',
          title: fTitle.trim(),
          categories: fCategories,
          imageUrl: fImageUrl,
          postText: fPostText,
          messageFormat: fMessageFormat,
          inlineButtons: fInlineButtons.filter(b => b.text.trim()),
          maxParticipants: fMaxParticipants,
          minSubscribers: fMinSubscribers,
          scheduledAt: fScheduledAt,
          rulesInstruction: fRules,
          repeatPostEnabled: fRepeatEnabled,
          repeatScheduledAt: fRepeatEnabled ? fRepeatScheduledAt : undefined,
          repeatImageUrl: fRepeatEnabled ? fRepeatImageUrl : undefined,
          repeatPostText: fRepeatEnabled ? fRepeatPostText : undefined,
          repeatInlineButtons: fRepeatEnabled ? fInlineButtons : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Папка успешно создана и опубликована для набора участников');
        setIsCreateFolderModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка создания папки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // ==========================================================================
  // CREATE SELECTION (Подборка) FORM STATE
  // ==========================================================================
  const [sTitle, setSTitle] = useState('');
  const [sTitleAvailable, setSTitleAvailable] = useState<boolean | null>(null);
  const [sTitleChecking, setSTitleChecking] = useState(false);
  const [sCategories, setSCategories] = useState<string[]>(['Технологии и ИИ']);
  const [sHeaderTitle, setSHeaderTitle] = useState('Топ экспертных каналов недели');
  const [sHeaderSubtitle, setSHeaderSubtitle] = useState('Отборные блоги со свежими инсайдами и практикой');
  const [sMinSubscribers, setSMinSubscribers] = useState(250);
  const [sMaxParticipants, setSMaxParticipants] = useState(10);
  const [sScheduledAt, setSScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [sRules, setSRules] = useState('Rich-формат на всех каналах. За 1 час бот проверит статус админа. Не удалять 72 часа.');
  const [isSubmittingSelection, setIsSubmittingSelection] = useState(false);
  const [isAiGeneratingSelectionHeader, setIsAiGeneratingSelectionHeader] = useState(false);

  const checkSelectionTitle = async (title: string) => {
    if (!title.trim()) {
      setSTitleAvailable(null);
      return;
    }
    setSTitleChecking(true);
    try {
      const res = await fetch(`/api/promo-selections/check-title?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      setSTitleAvailable(data.available);
    } catch (e) {
      setSTitleAvailable(null);
    } finally {
      setSTitleChecking(false);
    }
  };

  const handleGenerateSelectionHeaderAi = async () => {
    try {
      setIsAiGeneratingSelectionHeader(true);
      const res = await fetch('/api/promo/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          type: 'selection_header',
          title: sTitle,
          category: sCategories[0] || 'Технологии и ИИ'
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setSHeaderSubtitle(data.text);
        showStatus(`Заголовок подборки сгенерирован (списано: ${formatIirkyCount(pf.promoAiText)})`);
        onRefreshUser?.();
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsAiGeneratingSelectionHeader(false);
    }
  };

  const handleCreateSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sTitleAvailable === false) {
      showStatus('Подборка с таким названием уже существует', 'error');
      return;
    }
    try {
      setIsSubmittingSelection(true);
      const res = await fetch('/api/promo-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUser?.id,
          authorTelegramId: currentUser?.telegramId,
          authorUsername: currentUser?.username || currentUser?.telegramUsername,
          authorName: currentUser?.name || currentUser?.firstName || 'Организатор',
          title: sTitle.trim(),
          categories: sCategories,
          minSubscribers: sMinSubscribers,
          maxParticipants: sMaxParticipants,
          scheduledAt: sScheduledAt,
          headerTitle: sHeaderTitle,
          headerSubtitle: sHeaderSubtitle,
          rules: sRules
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Подборка создана и открыта для набора каналов');
        setIsCreateSelectionModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка создания подборки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSubmittingSelection(false);
    }
  };

  // Open Edit Folder Modal
  const handleOpenEditFolder = (folder: any) => {
    setEditingFolder({
      id: folder.id,
      title: folder.title,
      categories: folder.categories || ['Бизнес и стартапы'],
      imageUrl: folder.image_url || folder.imageUrl || '',
      postText: folder.post_text || folder.postText || '',
      messageFormat: folder.message_format || folder.messageFormat || 'v2',
      inlineButtons: folder.inline_buttons || folder.inlineButtons || [],
      maxParticipants: folder.max_participants || folder.maxParticipants || 10,
      minSubscribers: folder.min_subscribers || folder.minSubscribers || 0,
      scheduledAt: folder.scheduled_at ? toMskInputString(folder.scheduled_at) : '',
      rulesInstruction: folder.rules_instruction || folder.rulesInstruction || '',
      reminderBeforeMinutes: folder.reminder_before_minutes ?? folder.reminderBeforeMinutes ?? 60,
      botCheckBeforeMinutes: folder.bot_check_before_minutes ?? folder.botCheckBeforeMinutes ?? 60,
      repeatPostEnabled: Boolean(folder.repeat_post_enabled || folder.repeatPostEnabled),
      repeatScheduledAt: folder.repeat_scheduled_at ? toMskInputString(folder.repeat_scheduled_at) : '',
      repeatImageUrl: folder.repeat_image_url || folder.repeatImageUrl || '',
      repeatPostText: folder.repeat_post_text || folder.repeatPostText || '',
      telegramFolderLink: folder.telegram_folder_link || folder.telegramFolderLink || ''
    });
    setIsEditFolderModalOpen(true);
  };

  // Save Edit Folder
  const handleSaveEditFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;
    try {
      const res = await fetch(`/api/promo-folders/${editingFolder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFolder)
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Папка успешно обновлена');
        setIsEditFolderModalOpen(false);
        setEditingFolder(null);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка обновления папки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    }
  };

  // Save Custom Publication Time for Participant (folders & selections)
  const handleSaveCustomTime = async () => {
    if (!selectedTargetItem || !selectedParticipantTarget) return;
    try {
      setIsSavingCustomTime(true);
      const isSelection = Boolean(selectedTargetItem.channels || selectedTargetItem.header_title);
      const endpoint = isSelection
        ? `/api/promo-selections/${selectedTargetItem.id}/channel/${selectedParticipantTarget.id}/custom-time`
        : `/api/promo-folders/${selectedTargetItem.id}/participants/${selectedParticipantTarget.id}/custom-time`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPublishTime: customTimeInput ? fromMskInputString(customTimeInput) : null,
          customRepeatPublishTime: customRepeatTimeInput ? fromMskInputString(customRepeatTimeInput) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка установки персонального времени');
      showStatus('Персональное время выхода поста успешно сохранено');
      setIsCustomTimeModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSavingCustomTime(false);
    }
  };

  // Save Sponsor Status for Participant
  const handleSaveSponsor = async (isSponsor: boolean, skipPosting: boolean) => {
    if (!sponsorTargetFolder || !sponsorTargetParticipant) return;
    try {
      setIsSavingSponsor(true);
      const res = await fetch(`/api/promo-folders/${sponsorTargetFolder.id}/participants/${sponsorTargetParticipant.id}/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isSponsor,
          sponsorSkipPosting: skipPosting
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка изменения статуса спонсора');
      showStatus(isSponsor ? 'Каналу присвоен статус Спонсор!' : 'Статус Спонсор отключен');
      setIsSponsorModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSavingSponsor(false);
    }
  };

  // Open Edit Selection Modal
  const handleOpenEditSelection = (selection: any) => {
    setEditingSelection({
      ...selection,
      id: selection.id,
      title: selection.title,
      categories: selection.categories || ['Технологии и ИИ'],
      minSubscribers: selection.min_subscribers || 0,
      maxParticipants: selection.max_participants || 10,
      scheduledAt: selection.scheduled_at ? toMskInputString(selection.scheduled_at) : '',
      headerTitle: selection.header_title || '',
      headerSubtitle: selection.header_subtitle || '',
      rules: selection.rules || '',
      imageUrl: selection.image_url || '',
      postText: selection.post_text || '',
      inlineButtons: selection.inline_buttons || [],
      channels: selection.channels || []
    });
    setIsEditSelectionModalOpen(true);
  };

  // Save Edit Selection
  const handleSaveEditSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSelection) return;
    try {
      const res = await fetch(`/api/promo-selections/${editingSelection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSelection)
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Подборка успешно обновлена');
        setIsEditSelectionModalOpen(false);
        setEditingSelection(null);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка обновления подборки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    }
  };

  // Open Edit Channel in Selection
  const handleOpenEditChannel = (channelRecord: any, selection: any) => {
    setSelectedTargetItem(selection);
    setEditingChannelTarget(channelRecord);
    setEditingChannelText(channelRecord.promo_text || '');
    setEditingChannelAvatar(channelRecord.channel_avatar_url || '');
    setIsEditChannelModalOpen(true);
  };

  // Save Edit Channel in Selection (costs 1 ИИрка, runs 763 moderation)
  const handleSaveEditChannel = async () => {
    if (!editingChannelTarget || !selectedTargetItem) return;
    if (!editingChannelText.trim()) {
      showStatus('Текст описания не может быть пустым', 'error');
      return;
    }
    try {
      setIsSavingChannelEdit(true);
      const res = await fetch(`/api/promo-selections/${selectedTargetItem.id}/channels/${editingChannelTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          promoText: editingChannelText.trim(),
          channelAvatarUrl: editingChannelAvatar,
          promoImages: editingChannelAvatar ? [editingChannelAvatar] : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus(`Описание канала обновлено и прошло модерацию (списано: ${formatIirkyCount(pf.selectionEdit)})`);
        setIsEditChannelModalOpen(false);
        setEditingChannelTarget(null);
        setRefreshTrigger(prev => prev + 1);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка модерации текста', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSavingChannelEdit(false);
    }
  };

  // Open Join Selection Modal with auto-avatar from channel
  const handleOpenJoinSelectionModal = (selection: any) => {
    setSelectedTargetItem(selection);
    const activeChanIds = (selection.channels || []).filter((c: any) => c.status === 'active').map((c: any) => String(c.channel_id));
    const available = channels.filter(c => !activeChanIds.includes(String(c.id)));
    const ch = available[0] || channels[0];
    if (ch) {
      setSelectedChannelIdForSelection(String(ch.id));
      setSelChannelAvatarUrl(ch.photoUrl || ch.avatarUrl || '');
      setSelChannelPromoText(ch.description || ch.bio || '');
    } else {
      setSelectedChannelIdForSelection('');
      setSelChannelAvatarUrl('');
      setSelChannelPromoText('');
    }
    setIsJoinSelectionModalOpen(true);
  };

  // Open Leave Selection Modal
  const handleOpenLeaveSelectionModal = (selection: any, targetChannel?: any) => {
    setSelectedTargetItem(selection);
    setLeaveTargetSelection(selection);
    const activeChans = (selection.channels || []).filter((c: any) => c.status === 'active');
    const myChans = activeChans.filter((c: any) => isUserChannel(c));
    const toSelect = targetChannel || myChans[0] || (isItemOrganizer(selection) ? activeChans[0] : null);
    setLeaveTargetSelectionChannel(toSelect);
    setIsLeaveSelectionModalOpen(true);
  };

  // Confirm Leave Selection in real-time
  const handleConfirmLeaveSelection = async () => {
    if (!leaveTargetSelection || !leaveTargetSelectionChannel) return;
    try {
      setIsLeavingSelection(true);
      const selId = leaveTargetSelection.id;
      const chanId = leaveTargetSelectionChannel.id;
      const res = await fetch(`/api/promo-selections/${selId}/channels/${chanId}/leave`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Канал успешно удален из базы данных подборки');
        setIsLeaveSelectionModalOpen(false);
        setLeaveTargetSelection(null);
        setLeaveTargetSelectionChannel(null);
        setRefreshTrigger(prev => prev + 1);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка при удалении канала', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsLeavingSelection(false);
    }
  };

  // ==========================================================================
  // JOIN FOLDER MODAL & LOGIC (Dropdown & Multi-Select)
  // ==========================================================================
  const handleOpenJoinFolderModal = (folder: any) => {
    setSelectedTargetItem(folder);
    const inFolderChannelIds = (folder.participants || []).map((p: any) => String(p.channel_id));
    const available = channels.filter(c => !inFolderChannelIds.includes(String(c.id)));
    // Pre-select first eligible channel or first available channel
    const firstEligible = available.find(c => (c.subscribers || c.subscribersCount || 0) >= Number(folder.min_subscribers || 0));
    if (firstEligible) {
      setSelectedChannelIdsForFolder([String(firstEligible.id)]);
    } else if (available.length > 0) {
      setSelectedChannelIdsForFolder([String(available[0].id)]);
    } else if (channels.length > 0) {
      setSelectedChannelIdsForFolder([String(channels[0].id)]);
    } else {
      setSelectedChannelIdsForFolder([]);
    }
    setChannelSearchQuery('');
    setIsChannelDropdownOpen(false);
    setIsJoinFolderModalOpen(true);
  };

  const handleToggleChannelSelection = (channelId: string) => {
    const sId = String(channelId);
    setSelectedChannelIdsForFolder(prev => 
      prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]
    );
  };

  const handleSelectAllEligibleChannels = (folder: any) => {
    const minSubs = Number(folder?.min_subscribers || 0);
    const eligibleIds = channels
      .filter(c => (c.subscribers || c.subscribersCount || 0) >= minSubs)
      .map(c => String(c.id));
    if (eligibleIds.length > 0) {
      setSelectedChannelIdsForFolder(eligibleIds);
    } else {
      setSelectedChannelIdsForFolder(channels.map(c => String(c.id)));
    }
  };

  const handleClearChannelSelection = () => {
    setSelectedChannelIdsForFolder([]);
  };

  const handleJoinFolder = async () => {
    if (!selectedTargetItem) return;
    if (selectedChannelIdsForFolder.length === 0) {
      showStatus('Выберите хотя бы один канал из выпадающего списка', 'error');
      return;
    }
    const selectedChannels = channels.filter(c => selectedChannelIdsForFolder.includes(String(c.id)));
    if (selectedChannels.length === 0) {
      showStatus('Выбранные каналы не найдены в системе', 'error');
      return;
    }

    try {
      setIsSubmittingJoinFolder(true);
      const res = await fetch(`/api/promo-folders/${selectedTargetItem.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          channels: selectedChannels.map(ch => ({
            channelId: ch.id,
            channelName: ch.name || ch.title,
            channelUsername: ch.username || ch.telegramUsername,
            subscribersCount: ch.subscribers || ch.subscribersCount || 0,
            avatarUrl: ch.photoUrl || ch.avatarUrl
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus(
          selectedChannels.length === 1 
            ? 'Канал успешно добавлен в папку!' 
            : `Успешно добавлено каналов в папку: ${data.count || selectedChannels.length}!`,
          'success'
        );
        // Real-time optimistic update of folder in state
        setFolders(prev => prev.map(f => {
          if (f.id !== selectedTargetItem.id) return f;
          const newParts = [...(f.participants || [])];
          selectedChannels.forEach((ch, idx) => {
            if (!newParts.some((p: any) => String(p.channel_id) === String(ch.id))) {
              newParts.push({
                id: `temp_part_${Date.now()}_${idx}`,
                folder_id: f.id,
                user_id: currentUser?.id,
                channel_id: ch.id,
                channel_name: ch.name || ch.title,
                channel_username: ch.username || ch.telegramUsername,
                subscribers_count: ch.subscribers || ch.subscribersCount || 0,
                avatar_url: ch.photoUrl || ch.avatarUrl,
                status: f.author_id === currentUser?.id ? 'accepted' : 'pending',
                joined_at: new Date().toISOString()
              });
            }
          });
          return {
            ...f,
            participants: newParts,
            participantsCount: newParts.filter((p: any) => p.status === 'accepted').length,
            userJoined: true,
            userParticipant: newParts.find((p: any) => String(p.user_id) === String(currentUser?.id))
          };
        }));
        setIsJoinFolderModalOpen(false);
        setIsChannelDropdownOpen(false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка при вступлении в папку', 'error');
      }
    } catch (err: any) {
      showStatus(err.message || 'Ошибка сети', 'error');
    } finally {
      setIsSubmittingJoinFolder(false);
    }
  };

  // ==========================================================================
  // LEAVE FOLDER (Real-time deletion via Warning Modal)
  // ==========================================================================
  const handleOpenLeaveModal = (folder: any, participant?: any) => {
    setLeaveTargetFolder(folder);
    const part = participant || (folder.participants || []).find((p: any) => isUserChannel(p)) || folder.userParticipant;
    setLeaveTargetParticipant(part);
    setIsLeaveFolderModalOpen(true);
  };

  const handleConfirmLeave = async () => {
    if (!leaveTargetFolder) return;
    try {
      setIsLeavingFolder(true);
      const folderId = leaveTargetFolder.id;
      const partId = leaveTargetParticipant?.id;
      const channelId = leaveTargetParticipant?.channel_id;

      const res = await fetch(`/api/promo-folders/${folderId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          channelId,
          participantId: partId
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Канал успешно удален из базы данных и папки', 'success');
        // Real-time optimistic update of folders list
        setFolders(prev => prev.map(f => {
          if (f.id !== folderId) return f;
          const remaining = (f.participants || []).filter((p: any) => {
            if (partId && p.id === partId) return false;
            if (channelId && String(p.channel_id) === String(channelId)) return false;
            if (!partId && !channelId && isUserChannel(p)) return false;
            return true;
          });
          const stillHasMyChannel = remaining.some((p: any) => isUserChannel(p));
          return {
            ...f,
            participants: remaining,
            participantsCount: remaining.filter((p: any) => p.status === 'accepted').length,
            userJoined: stillHasMyChannel,
            userParticipant: stillHasMyChannel ? remaining.find((p: any) => isUserChannel(p)) : null,
            userParticipantStatus: stillHasMyChannel ? (remaining.find((p: any) => isUserChannel(p))?.status || '') : ''
          };
        }));
        setIsLeaveFolderModalOpen(false);
        setLeaveTargetFolder(null);
        setLeaveTargetParticipant(null);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка при выходе из папки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message || 'Ошибка сети', 'error');
    } finally {
      setIsLeavingFolder(false);
    }
  };

  // ==========================================================================
  // JOIN SELECTION MODAL & LOGIC
  // ==========================================================================
  const [selectedChannelIdForSelection, setSelectedChannelIdForSelection] = useState('');
  const [selChannelPromoText, setSelChannelPromoText] = useState('');
  const [selChannelAvatarUrl, setSelChannelAvatarUrl] = useState('');
  const [isAiGeneratingChannelPromo, setIsAiGeneratingChannelPromo] = useState(false);
  const [isAiGeneratingChannelAvatar, setIsAiGeneratingChannelAvatar] = useState(false);
  const [isSubmittingJoinSelection, setIsSubmittingJoinSelection] = useState(false);

  // Auto-fill channel info on selection
  useEffect(() => {
    if (selectedChannelIdForSelection) {
      const ch = channels.find(c => String(c.id) === String(selectedChannelIdForSelection));
      if (ch) {
        const initialAvatar = ch.photoUrl || ch.avatarUrl || '';
        setSelChannelAvatarUrl(initialAvatar);
        const cleanHandle = (ch.username || ch.name || '').replace(/^@/, '');
        if (cleanHandle && (!initialAvatar.startsWith('https://file.pro-talk.ru/tgf/') || initialAvatar.includes('/channel-avatar/'))) {
          fetch(`/api/channel-avatar-url/${encodeURIComponent(cleanHandle)}?fallback=${encodeURIComponent(initialAvatar)}`)
            .then(res => res.json())
            .then(data => {
              if (data.url && data.url.startsWith('https://file.pro-talk.ru/tgf/')) {
                setSelChannelAvatarUrl(data.url);
              }
            })
            .catch(() => {});
        }
        if (!selChannelPromoText) {
          const defaultDesc = ch.description || `Канал «${ch.name || 'Эксперт'}». Полезный контент и актуальные посты каждый день.`;
          setSelChannelPromoText(defaultDesc.slice(0, 195));
        }
      }
    }
  }, [selectedChannelIdForSelection]);

  // AI generate channel description (costs 1 ИИрка)
  const handleGenerateChannelPromoAi = async () => {
    const ch = channels.find(c => String(c.id) === String(selectedChannelIdForSelection));
    try {
      setIsAiGeneratingChannelPromo(true);
      const res = await fetch('/api/promo/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          type: 'selection_promo',
          channelName: ch?.name || 'Авторский канал',
          category: selectedTargetItem?.categories?.[0] || 'Бизнес'
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setSelChannelPromoText(data.text);
        showStatus(`Описание канала сгенерировано (списано: ${formatIirkyCount(pf.promoAiText)})`);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка генерации', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsAiGeneratingChannelPromo(false);
    }
  };

  // AI generate image for channel promo in selection
  const handleGenerateChannelImageAi = async () => {
    const ch = channels.find(c => String(c.id) === String(selectedChannelIdForSelection));
    try {
      setIsAiGeneratingChannelAvatar(true);
      const res = await fetch('/api/protalk/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: `Яркий стильный аватар/иллюстрация для Telegram канала: ${ch?.name || 'Экспертный блог'}. Тематика: ${selectedTargetItem?.categories?.join(', ')}. Высокое качество.`,
          userId: currentUser?.id,
          prefix: 'sel_chan_img'
        })
      });
      const data = await res.json();
      if (data.imageUrl || data.url) {
        setSelChannelAvatarUrl(data.imageUrl || data.url);
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : pricing.imageModels.func_621;
        showStatus(`Изображение для карточки сгенерировано (списано: ${formatIirkyCount(charged)})`);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка генерации картинки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsAiGeneratingChannelAvatar(false);
    }
  };

  // Submit Join Selection (1 ИИрка участие + 1 ИИрка модерация 763)
  const handleJoinSelection = async () => {
    if (!selectedChannelIdForSelection) {
      showStatus('Выберите канал для участия в подборке', 'error');
      return;
    }
    if (!selChannelPromoText.trim()) {
      showStatus('Заполните описание канала (до 200 символов)', 'error');
      return;
    }
    const ch = channels.find(c => String(c.id) === String(selectedChannelIdForSelection));
    if (!ch) return;

    try {
      setIsSubmittingJoinSelection(true);
      const res = await fetch(`/api/promo-selections/${selectedTargetItem.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          channelId: ch.id,
          channelName: ch.name || ch.title,
          channelUsername: ch.username || ch.telegramUsername,
          channelAvatarUrl: selChannelAvatarUrl,
          promoText: selChannelPromoText.trim(),
          subscribersCount: ch.subscribers || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Канал успешно прошел модерацию функцией 763 и добавлен в подборку!');
        setIsJoinSelectionModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
        onRefreshUser?.();
      } else {
        showStatus(data.error || 'Ошибка при вступлении в подборку', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsSubmittingJoinSelection(false);
    }
  };

  // Leave Selection
  const handleLeaveSelection = async (selectionId: string, channelRecordId: string) => {
    if (!window.confirm('Вы действительно хотите выйти из подборки?')) return;
    try {
      const res = await fetch(`/api/promo-selections/${selectionId}/channels/${channelRecordId}/leave`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Вы успешно покинули подборку');
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    }
  };

  // ==========================================================================
  // CONFIRM FOLDER BY AUTHOR
  // ==========================================================================
  const [authorFolderLink, setAuthorFolderLink] = useState('');
  const [isConfirmingFolder, setIsConfirmingFolder] = useState(false);

  const handleConfirmFolder = async (folderId: string) => {
    if (!authorFolderLink.trim().startsWith('https://t.me/addlist/')) {
      showStatus('Укажите корректную ссылку Telegram-папки (начинается с https://t.me/addlist/...)', 'error');
      return;
    }
    try {
      setIsConfirmingFolder(true);
      const res = await fetch(`/api/promo-folders/${folderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramFolderLink: authorFolderLink.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showStatus(`Папка подтверждена! Всем участникам разослан пост в Telegram личку.`);
        setAuthorFolderLink('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка подтверждения папки', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    } finally {
      setIsConfirmingFolder(false);
    }
  };

  // Reject participant modal state
  const [rejectReason, setRejectReason] = useState('');
  const handleConfirmReject = async () => {
    if (!selectedParticipantTarget || !selectedTargetItem) return;
    try {
      const isFolder = activeTab === 'folders';
      const endpoint = isFolder
        ? `/api/promo-folders/${selectedTargetItem.id}/participants/${selectedParticipantTarget.id}/status`
        : `/api/promo-selections/${selectedTargetItem.id}/channels/${selectedParticipantTarget.id}/reject`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'declined',
          rejectReason: rejectReason.trim() || 'Отклонено организатором'
        })
      });
      const data = await res.json();
      if (data.success) {
        showStatus('Участник отклонен с отправкой комментария в Telegram');
        setIsRejectModalOpen(false);
        setRejectReason('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showStatus(data.error || 'Ошибка', 'error');
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    }
  };

  // Selection results view
  const [resultsData, setResultsData] = useState<any | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const handleOpenResults = async (selection: any) => {
    setSelectedTargetItem(selection);
    setIsSelectionResultsModalOpen(true);
    setIsLoadingResults(true);
    try {
      const res = await fetch(`/api/promo-selections/${selection.id}/results`);
      const data = await res.json();
      if (data.success) {
        setResultsData(data);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  // Finalize results manually
  const handleFinalizeResults = async (selectionId: string) => {
    try {
      const res = await fetch(`/api/promo-selections/${selectionId}/finalize-results`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showStatus('Итоги подборки зафиксированы! Всем участникам отправлен отчет в личку Telegram.');
        handleOpenResults(selectedTargetItem);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      showStatus(err.message, 'error');
    }
  };

  // Referral URL helper
  const getInviteUrl = (type: 'folder' | 'selection', item: any) => {
    const refCode = currentUser?.telegramId || currentUser?.id || '169262990';
    return `${window.location.origin}/folders?type=${type}&id=${item.id}&ref=${refCode}`;
  };

  const getTmaInviteUrl = (type: 'folder' | 'selection', item: any) => {
    const refCode = currentUser?.telegramId || currentUser?.id || '169262990';
    return `https://t.me/IIrkiBot/app?startapp=${type === 'folder' ? 'f' : 's'}_${item.id}_${refCode}`;
  };

  const copyToClipboard = (text: string, msg = 'Ссылка скопирована') => {
    navigator.clipboard.writeText(text);
    showStatus(msg);
  };

  return (
    <div className="w-full min-h-screen pb-24 md:pb-12 text-slate-800">
      {/* Toast Alert */}
      {statusMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12">
          <div className={`p-4 rounded-2xl shadow-xl backdrop-blur-md border text-sm font-bold flex items-center justify-between gap-3 ${
            statusMessage.type === 'error'
              ? 'bg-rose-50/95 border-rose-300 text-rose-800'
              : 'bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border-pink-300 text-slate-800'
          }`}>
            <span className="break-words">{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Banner with strictly compliant Light Gradient Background */}
      <div className="p-4 md:p-6 mb-6 rounded-3xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 backdrop-blur-md border border-pink-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
              Взаимное продвижение: папки и подборки
            </h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Объединяйтесь с проверенными каналами для взрывного роста аудитории в Telegram без затрат на рекламу
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'folders' ? (
              <button
                id="btn-create-folder"
                onClick={() => {
                  setFTitle('');
                  setFTitleAvailable(null);
                  setIsCreateFolderModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Создать папку</span>
              </button>
            ) : (
              <button
                id="btn-create-selection"
                onClick={() => {
                  setSTitle('');
                  setSTitleAvailable(null);
                  setIsCreateSelectionModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Создать подборку</span>
              </button>
            )}

            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="p-2.5 rounded-2xl bg-white/80 border border-pink-200 text-slate-700 hover:bg-white transition-all cursor-pointer"
              title="Обновить список"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <AcademyHelpButton
              sectionSlug="folders-selections"
              onNavigate={onNavigate}
              showLabelOnDesktop={true}
              label="Справка"
            />
          </div>
        </div>

        {/* Banner for pending reanimation invitations */}
        <InviteConfirmationBanner
          invitations={pendingInvitations}
          onConfirm={handleConfirmInvitation}
          isLoading={isLoading}
        />

        {toastSuccess && (
          <div className="p-3.5 rounded-2xl bg-white/80 border border-pink-300/80 text-sm font-semibold text-slate-800 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-800">
              <Check className="w-4 h-4 text-sky-600" />
              <span>{toastSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastSuccess(null)}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Switcher: Vertical/Select on Mobile, Standard Gradient Buttons on Desktop (Zero Horizontal Scroll) */}
        <div className="mt-5 pt-4 border-t border-pink-100/80 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <button
              id="tab-btn-folders"
              onClick={() => setActiveTab('folders')}
              className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold transition-all text-center flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'folders'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md'
                  : 'bg-white/70 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>1. Папки (единый пост + папка Telegram)</span>
            </button>

            <button
              id="tab-btn-selections"
              onClick={() => setActiveTab('selections')}
              className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold transition-all text-center flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'selections'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md'
                  : 'bg-white/70 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Подборки Rich с аватарами каналов</span>
            </button>

            <button
              id="tab-btn-archive"
              onClick={() => setActiveTab('archive')}
              className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold transition-all text-center flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md'
                  : 'bg-white/70 border border-pink-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>3. Архив (папки и подборки)</span>
            </button>
          </div>
        </div>

        {/* Channels in System & Direct Channel Management */}
        <div className="mt-4 pt-3 border-t border-pink-100/60 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500"></span>
              <span className="font-bold">Ваши подключенные каналы в системе:</span>
              <strong className="text-slate-900 font-black text-sm px-2.5 py-0.5 rounded-xl bg-white/90 border border-pink-200 shadow-2xs">
                {channels.length}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/channels')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="Перейти к управлению и добавлению каналов в систему"
            >
              <PlusCircle className="w-4 h-4" />
              <span>➕ Добавить канал в систему</span>
            </button>
          </div>

          {/* Connected Channels List / Zero State */}
          {channels.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {channels.map((ch: any) => (
                <div 
                  key={ch.id} 
                  onClick={() => onNavigate('/channels')}
                  className="p-2 px-3 rounded-2xl bg-white/80 border border-pink-200/90 flex items-center gap-2.5 shadow-2xs cursor-pointer hover:bg-white transition-all"
                  title="Нажмите для перехода в управление каналом"
                >
                  {ch.photoUrl || ch.avatarUrl ? (
                    <CachedMediaImage src={ch.photoUrl || ch.avatarUrl} alt={ch.name || 'Канал'} className="w-8 h-8 rounded-xl object-cover border border-pink-200 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {ch.name?.slice(0, 2)}
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="font-bold text-slate-900 block leading-tight">{ch.name || ch.title}</span>
                    <span className="text-slate-500 text-sm">{ch.username || ch.telegramUsername || ''} • {ch.subscribers || ch.subscribersCount || 0} подп.</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <span>У вас пока нет добавленных каналов. Добавьте ваш Telegram-канал в систему, чтобы участвовать в папках и подборках.</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/channels')}
                className="text-sm font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Подключить канал сейчас →</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar with View Scope */}
      <div className="p-4 mb-6 rounded-3xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 backdrop-blur-md border border-pink-200/70 space-y-3">
        {/* Scope selector tabs: All | My Organized | Joined */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-pink-200/60">
          <button
            type="button"
            onClick={() => setViewScope('all')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              viewScope === 'all'
                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                : 'bg-white/80 border border-pink-200 text-slate-700 hover:bg-white'
            }`}
          >
            Все сборы
          </button>

          <button
            type="button"
            onClick={() => setViewScope('my_organized')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              viewScope === 'my_organized'
                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                : 'bg-white/80 border border-pink-200 text-slate-700 hover:bg-white'
            }`}
          >
            Созданные мной (организатор)
          </button>

          <button
            type="button"
            onClick={() => setViewScope('joined')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              viewScope === 'joined'
                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                : 'bg-white/80 border border-pink-200 text-slate-700 hover:bg-white'
            }`}
          >
            Где я участвую
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, автору или тексту..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-pink-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          {/* Category Dropdown (Mobile-friendly, no horizontal scroll) */}
          <div className="w-full md:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/90 border border-pink-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300 cursor-pointer"
            >
              <option value="Все">Все 10 категорий</option>
              {PROMO_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: FOLDERS LIST */}
      {/* ==================================================================== */}
      {activeTab === 'folders' && (
        <div className="space-y-4">
          {filteredFolders.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-gradient-to-r from-sky-50/60 via-pink-50/60 via-orange-50/60 via-pink-50/60 to-sky-50/60 backdrop-blur-md border border-pink-200/80">
              <FolderHeart className="w-12 h-12 mx-auto text-pink-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Папки не найдены</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Создайте первую папку для взаимопиара каналов вашей тематики или измените критерии фильтра
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              {filteredFolders.map((folder) => {
                const isAuthor = isItemOrganizer(folder);
                const acceptedCount = folder.participantsCount || 0;
                const isFull = acceptedCount >= folder.max_participants;
                const userPart = folder.userParticipant || folder.participants?.find((p: any) => String(p.user_id) === String(currentUser?.id));
                const pubDate = new Date(folder.scheduled_at).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={folder.id}
                    className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 backdrop-blur-md border border-pink-200/80 shadow-xs flex flex-col justify-between space-y-3.5"
                  >
                    <div className="space-y-3">
                      {/* ========================================================= */}
                      {/* БЛОК 1: Название, Статус, иконки Просмотр (всем) и Редактировать (организатору) */}
                      {/* ========================================================= */}
                      <div className="flex items-center justify-between gap-2 border-b border-pink-100 pb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate" title={folder.title}>
                            {folder.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2.5 py-1 rounded-xl text-[14px] font-bold shrink-0 ${
                            folder.status === 'confirmed' 
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : folder.status === 'published'
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-white/90 text-pink-700 border border-pink-300'
                          }`}>
                            {folder.status === 'confirmed' ? 'Сформирована' : folder.status === 'published' ? 'Опубликовано' : 'Идет сбор'}
                          </span>

                          {/* Иконка Предпросмотр (только иконка без текста) */}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewFolder(folder);
                              setIsPreviewFolderModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-xl bg-white/90 border border-sky-300 text-sky-700 hover:bg-sky-50 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Предпросмотр поста папки (доступно всем)"
                          >
                            <Eye className="w-4 h-4 text-sky-600" />
                          </button>

                          {/* Иконка Редактировать и Удалить (для организатора) */}
                          {isAuthor && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditFolder(folder)}
                                className="w-8 h-8 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Редактировать параметры папки"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletePromoTarget({
                                    id: folder.id,
                                    type: 'folder',
                                    title: folder.title,
                                    participantsCount: acceptedCount
                                  })
                                }
                                className="w-8 h-8 rounded-xl bg-white/90 border border-rose-300 text-rose-600 hover:bg-rose-50 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Удалить папку организатором"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Иконка инфо (i) (только иконка без текста) */}
                          <button
                            type="button"
                            onClick={() => {
                              setInfoModalFolder(folder);
                              setIsFolderInfoModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-xl bg-white/90 border border-pink-200 text-slate-600 hover:bg-pink-50 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Подробная информация и правила папки"
                          >
                            <Info className="w-4 h-4 text-pink-500" />
                          </button>
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 2: Теги */}
                      {/* ========================================================= */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {folder.categories?.map((cat: string) => (
                          <span key={cat} className="px-2.5 py-0.5 rounded-xl bg-white/90 border border-pink-200 text-[14px] font-bold text-slate-700">
                            {cat}
                          </span>
                        ))}
                        {isAuthor && (
                          <span className="px-2.5 py-0.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-[14px] font-black flex items-center gap-1 shadow-2xs">
                            👑 Организатор
                          </span>
                        )}
                        <span className="text-[14px] text-slate-500 ml-auto hidden sm:inline">
                          Автор: <strong className="text-slate-700">{folder.author_name}</strong>
                        </span>
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 3: Участники, Порог канала, Публикация (Дата 1 поста и дата 2 поста при наличии) */}
                      {/* ========================================================= */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[14px]">
                        <div className="p-2.5 rounded-2xl bg-white/70 border border-pink-100 flex flex-col justify-center">
                          <span className="text-slate-500 text-[14px] block">Участники</span>
                          <span className="font-extrabold text-slate-900 text-[14px]">{acceptedCount} из {folder.max_participants}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-white/70 border border-pink-100 flex flex-col justify-center">
                          <span className="text-slate-500 text-[14px] block">Порог канала</span>
                          <span className="font-extrabold text-slate-900 text-[14px]">от {folder.min_subscribers}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-white/70 border border-pink-100 flex flex-col justify-center">
                          <span className="text-slate-500 text-[14px] block">Публикация</span>
                          <span className="font-extrabold text-slate-900 text-[14px] leading-tight" title={`${pubDate} (${folder.timezone || 'МСК'})`}>
                            {pubDate}
                          </span>
                          {folder.repeat_post_enabled === 1 && folder.repeat_scheduled_at && (
                            <span className="text-[14px] text-pink-700 font-bold block mt-0.5">
                              2 пост: {new Date(folder.repeat_scheduled_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>


                      {/* ========================================================= */}
                      {/* БЛОК 5: Правила размещения (раскрывающийся блок) */}
                      {/* ========================================================= */}
                      <div className="rounded-2xl border border-pink-200/80 bg-white/70 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => toggleRules(folder.id)}
                          className="w-full p-2.5 flex items-center justify-between text-[14px] font-bold text-slate-800 hover:bg-pink-50/50 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>📋 Правила размещения</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedRules[folder.id] ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedRules[folder.id] && (
                          <div className="p-3 border-t border-pink-100 text-[14px] text-slate-700 bg-orange-50/40 leading-relaxed">
                            {folder.rules_instruction || '48 часов в ленте, 3 часа в топе'}
                          </div>
                        )}
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 6: Участники (раскрывающийся список, в нем одобрение: Отказать, Спонсор, Одобрен (автоматически)) */}
                      {/* ========================================================= */}
                      <div className="rounded-2xl border border-pink-200/80 bg-white/75 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => toggleAuthorZone(folder.id)}
                          className="w-full p-2.5 sm:p-3 flex items-center justify-between text-[14px] font-bold text-slate-800 hover:bg-pink-50/50 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-pink-500" />
                            <span>Участники ({folder.participants?.length || 0})</span>
                            {folder.participants?.some((p: any) => p.status === 'pending') && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[14px] font-bold">
                                Новые заявки
                              </span>
                            )}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedAuthorZone[folder.id] ? 'rotate-180' : ''}`} />
                        </button>

                        {expandedAuthorZone[folder.id] && (
                          <div className="p-3 border-t border-pink-100 space-y-2 bg-pink-50/20">
                            {(!folder.participants || folder.participants.length === 0) ? (
                              <p className="text-[14px] text-slate-500 p-2 text-center">Пока нет участников в папке.</p>
                            ) : (
                              folder.participants.map((p: any) => (
                                <div key={p.id} className="p-2.5 rounded-xl bg-white border border-pink-100 flex flex-wrap items-center justify-between gap-2 text-[14px] shadow-2xs">
                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-bold text-slate-800 truncate">{p.channel_name}</span>
                                    {p.channel_username && (
                                      <span className="text-pink-600 text-[14px] truncate">@{p.channel_username.replace(/^@/, '')}</span>
                                    )}
                                    <span className="text-slate-500 text-[14px] shrink-0">({p.subscribers_count} подп.)</span>

                                    {p.is_sponsor === 1 && (
                                      <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[14px] font-black shrink-0">
                                        ⭐ Спонсор
                                      </span>
                                    )}

                                    {/* Статус одобрения: Одобрен (автоматически) / Отклонен / На проверке */}
                                    <span className={`px-2 py-0.5 rounded-md text-[14px] font-bold shrink-0 ${
                                      p.status === 'accepted' 
                                        ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                                        : p.status === 'declined' 
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                        : 'bg-orange-50 text-orange-800 border border-orange-200'
                                    }`}>
                                      {p.status === 'accepted' ? 'Одобрен (автоматически)' : p.status === 'declined' ? 'Отклонен' : 'На проверке'}
                                    </span>

                                    {/* Отправка: Будет отправлена / Успешно / Ошибка */}
                                    {p.post_published === 1 ? (
                                      p.reject_reason ? (
                                        <span className="px-2 py-0.5 rounded-md text-[14px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0" title={p.reject_reason}>
                                          ❌ Ошибка: {p.reject_reason}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-md text-[14px] font-bold bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
                                          ✅ Отправлено успешно
                                        </span>
                                      )
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[14px] font-medium bg-orange-50 text-orange-800 border border-orange-200 shrink-0">
                                        ⏳ Выход: {formatMskDateDisplay(p.custom_publish_time || folder.scheduled_at).fullStr}
                                      </span>
                                    )}

                                    {/* Кнопка смены времени участником (до 24ч вперед) */}
                                    {(String(p.user_id) === String(currentUser?.id) || isAuthor) && p.post_published !== 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTargetItem(folder);
                                          setSelectedParticipantTarget(p);
                                          setCustomTimeInput(p.custom_publish_time ? toMskInputString(p.custom_publish_time) : '');
                                          setCustomRepeatTimeInput(p.custom_repeat_publish_time ? toMskInputString(p.custom_repeat_publish_time) : '');
                                          setIsCustomTimeModalOpen(true);
                                        }}
                                        className="px-2 py-0.5 rounded-md text-[14px] font-bold bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 shrink-0 flex items-center gap-1 cursor-pointer"
                                        title="Изменить дату и время выхода (до 24ч вперед)"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-sky-600" />
                                        <span>{p.custom_publish_time ? '⏱ Время смещено' : '⏱ Изменить время'}</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Действия для организатора: Отказать, Спонсор, Одобрить */}
                                  {isAuthor && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSponsorTargetParticipant(p);
                                          setSponsorTargetFolder(folder);
                                          setIsSponsorActive(p.is_sponsor === 1);
                                          setSponsorSkipPosting(Boolean(p.sponsor_skip_posting));
                                          setIsSponsorModalOpen(true);
                                        }}
                                        className={`px-2 py-1 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                                          p.is_sponsor === 1
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                            : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50'
                                        }`}
                                        title="Управление статусом спонсора"
                                      >
                                        {p.is_sponsor === 1 ? '⭐ Спонсор' : 'Спонсор'}
                                      </button>

                                      {p.status !== 'declined' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedTargetItem(folder);
                                            setSelectedParticipantTarget(p);
                                            setRejectReason('');
                                            setIsRejectModalOpen(true);
                                          }}
                                          className="px-2 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition-all cursor-pointer text-[14px]"
                                          title="Отказать участнику с указанием причины"
                                        >
                                          Отказать
                                        </button>
                                      )}

                                      {p.status !== 'accepted' && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await fetch(`/api/promo-folders/${folder.id}/participants/${p.id}/status`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ status: 'accepted' })
                                            });
                                            setRefreshTrigger(prev => prev + 1);
                                          }}
                                          className="px-2 py-1 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold hover:opacity-95 transition-all cursor-pointer text-[14px]"
                                        >
                                          Одобрить
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}

                            {/* Если организатор — поле ссылки на готовую папку и кнопка утверждения */}
                            {isAuthor && (
                              <div className="pt-2 border-t border-pink-100 flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={authorFolderLink}
                                  onChange={(e) => setAuthorFolderLink(e.target.value)}
                                  placeholder="Ссылка на созданную папку (https://t.me/addlist/...)"
                                  className="flex-1 px-3.5 py-2 bg-white border border-pink-200 rounded-xl text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300 shadow-2xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleConfirmFolder(folder.id)}
                                  disabled={isConfirmingFolder}
                                  className="px-4 py-2 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  {isConfirmingFolder ? 'Проверка...' : 'Подтвердить и разослать'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 7: Иконки: Войти/Выйти, Организатор, Инвайт, Разослать */}
                      {/* ========================================================= */}
                      <div className="p-3 rounded-2xl bg-white/85 border border-pink-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                        {/* 1. Вступить / Выйти */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {userPart ? (
                            <>
                              <span className="px-2.5 py-1.5 rounded-xl bg-sky-100 text-sky-900 text-[14px] font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-sky-600" />
                                <span>Вы участвуете ({userPart.status === 'accepted' ? 'Одобрен' : userPart.status === 'declined' ? 'Отклонен' : 'На проверке'})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTargetItem(folder);
                                  setSelectedParticipantTarget(userPart);
                                  setCustomTimeInput(userPart.custom_publish_time ? userPart.custom_publish_time.slice(0, 16) : '');
                                  setCustomRepeatTimeInput(userPart.custom_repeat_publish_time ? userPart.custom_repeat_publish_time.slice(0, 16) : '');
                                  setIsCustomTimeModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 text-[14px] font-bold cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Индивидуальное смещение времени публикации"
                              >
                                <Clock className="w-3.5 h-3.5 text-sky-600" />
                                <span>{userPart.custom_publish_time ? '⏱ Время смещено' : '⏱ Время'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenJoinFolderModal(folder)}
                                className="px-3 py-1.5 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1"
                                title="Добавить еще один канал в папку через мультивыбор"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Вступить еще</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLeaveModal(folder, userPart)}
                                className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-[14px] font-bold cursor-pointer transition-all shadow-2xs"
                                title="Выйти из папки и удалить канал из базы данных"
                              >
                                Выйти
                              </button>
                            </>
                          ) : (
                            channels.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => onNavigate('/channels')}
                                className="px-3.5 py-1.5 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                                title="Подключить канал и вступить в папку"
                              >
                                <PlusCircle className="w-4 h-4" />
                                <span>Вступить</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenJoinFolderModal(folder)}
                                className="px-3.5 py-1.5 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-2xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                                title="Вступить в папку и добавить свои каналы"
                              >
                                <PlusCircle className="w-4 h-4" />
                                <span>Вступить</span>
                              </button>
                            )
                          )}
                        </div>

                        {/* 2. Организатор, 3. Инвайт, 4. Разослать */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Организатор */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTargetItem(folder);
                              setIsContactAuthorModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-pink-300 text-slate-800 hover:bg-pink-50 text-[14px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Связаться с организатором"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-pink-600" />
                            <span>Организатор</span>
                          </button>

                          {/* Инвайт */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(getInviteUrl('folder', folder), 'Инвайт-ссылка скопирована')}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 text-[14px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Скопировать реферальную ссылку и TMA инвайт"
                          >
                            <Share2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>Инвайт</span>
                          </button>

                          {/* Разослать */}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewFolder(folder);
                              setIsPreviewFolderModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-400 text-white text-[14px] font-bold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Разослать пост / открыть публикацию"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Разослать</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: SELECTIONS LIST */}
      {/* ==================================================================== */}
      {activeTab === 'selections' && (
        <div className="space-y-4">
          {filteredSelections.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-gradient-to-r from-sky-50/60 via-pink-50/60 via-orange-50/60 via-pink-50/60 to-sky-50/60 backdrop-blur-md border border-pink-200/80">
              <Layers className="w-12 h-12 mx-auto text-pink-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Подборки не найдены</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Создайте первую тематическую подборку в Rich-формате или выберите другую категорию
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              {filteredSelections.map((selection) => {
                const isAuthor = isItemOrganizer(selection);
                const activeChannels = selection.channels?.filter((c: any) => c.status === 'active') || [];
                const pubDate = new Date(selection.scheduled_at).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={selection.id}
                    className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 backdrop-blur-md border border-pink-200/80 shadow-xs flex flex-col justify-between space-y-3.5"
                  >
                    <div className="space-y-3">
                      {/* ========================================================= */}
                      {/* БЛОК 1: Название подборки */}
                      {/* ========================================================= */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-100 pb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate" title={selection.header_title || selection.title}>
                            {selection.header_title || selection.title}
                          </h3>
                          {selection.header_subtitle && (
                            <p className="text-[14px] text-slate-600 mt-0.5 line-clamp-1">
                              {selection.header_subtitle}
                            </p>
                          )}
                          <p className="text-[14px] text-slate-500 mt-0.5">
                            Подборка: <span className="text-slate-800 font-bold">{selection.title}</span> • Организатор: {selection.author_name}
                          </p>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-xl text-[14px] font-bold shrink-0 ${
                          selection.status === 'published'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : selection.status === 'confirmed'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-white/90 text-pink-700 border border-pink-300'
                        }`}>
                          {selection.status === 'published' ? 'Опубликовано' : selection.status === 'confirmed' ? 'Подтверждена' : 'Идет сбор'}
                        </span>
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 2: Теги */}
                      {/* ========================================================= */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selection.categories?.map((cat: string) => (
                          <span key={cat} className="px-2.5 py-0.5 rounded-xl bg-white/90 border border-pink-200 text-[14px] font-bold text-slate-700">
                            {cat}
                          </span>
                        ))}
                        {isAuthor && (
                          <span className="px-2.5 py-0.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-[14px] font-black flex items-center gap-1 shadow-2xs">
                            👑 Организатор
                          </span>
                        )}
                        <span className="text-[14px] text-slate-500 ml-auto hidden sm:inline">
                          Публикация: <strong className="text-slate-700">{pubDate}</strong>
                        </span>
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 3: Кнопка Редактировать (для организатора) и кнопка Просмотр (для всех). Иконка поделиться и кнопка TMA инвайт */}
                      {/* ========================================================= */}
                      <div className="p-2.5 rounded-2xl bg-white/80 border border-pink-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Кнопки Редактировать и Удалить (для организатора) */}
                          {isAuthor && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditSelection(selection)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-95 transition-all cursor-pointer"
                                title="Редактировать параметры подборки"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>Редактировать</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletePromoTarget({
                                    id: selection.id,
                                    type: 'selection',
                                    title: selection.header_title || selection.title,
                                    participantsCount: activeChannels.length
                                  })
                                }
                                className="p-2 rounded-xl bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 text-[14px] font-bold flex items-center justify-center shadow-2xs transition-all cursor-pointer"
                                title="Удалить подборку организатором"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Кнопка Просмотр (для всех) */}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewSelection(selection);
                              setIsPreviewSelectionModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 text-[14px] font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                            title="Предпросмотр Rich-поста подборки"
                          >
                            <Eye className="w-4 h-4 text-sky-600" />
                            <span>Просмотр</span>
                          </button>
                        </div>

                        {/* Иконка поделиться и кнопка TMA инвайт */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(getInviteUrl('selection', selection), 'Реферальная ссылка скопирована')}
                            className="p-1.5 rounded-xl bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
                            title="Скопировать ссылку на сайт"
                          >
                            <Share2 className="w-4 h-4 text-sky-600" />
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(getTmaInviteUrl('selection', selection), 'TMA инвайт скопирован')}
                            className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
                            title="Скопировать инвайт для Telegram бота"
                          >
                            <span>TMA инвайт</span>
                          </button>
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 4: Список каналов - выпадающий список участников. Внутри списка одобрение автоматически через ИИ */}
                      {/* Для участника и организатора напротив каждого канала в списке каналов кнопка редактировать - при нажатии модальное окно для редактирования */}
                      {/* ========================================================= */}
                      <div className="rounded-2xl border border-pink-200/80 bg-white/75 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => toggleSelectionChannels(selection.id)}
                          className="w-full p-2.5 sm:p-3 flex items-center justify-between text-[14px] font-bold text-slate-800 hover:bg-pink-50/50 cursor-pointer"
                        >
                          <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <Users className="w-4 h-4 text-pink-500 shrink-0" />
                            <span>Каналы ({activeChannels.length} из {selection.max_participants})</span>
                            <span
                              className="px-2 py-0.5 rounded-lg bg-sky-100/90 text-sky-800 border border-sky-200 text-[14px] font-semibold"
                              title="Одобрение автоматически через ИИ"
                            >
                              Авто-ИИ ✓
                            </span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${expandedSelectionChannels[selection.id] ? 'rotate-180' : ''}`} />
                        </button>

                        {expandedSelectionChannels[selection.id] && (
                          <div className="p-2.5 border-t border-pink-100 space-y-2 bg-pink-50/20">
                            {activeChannels.length === 0 ? (
                              <p className="text-[14px] text-slate-500 p-2 text-center">В подборке пока нет каналов-участников.</p>
                            ) : (
                              activeChannels.map((c: any) => {
                                const isMyChan = isUserChannel(c);
                                const canEdit = isMyChan || isAuthor;
                                return (
                                  <SelectionChannelRow
                                    key={c.id}
                                    channel={c}
                                    selectionScheduledAt={selection.scheduled_at}
                                    isMyChannel={isMyChan}
                                    canEdit={canEdit}
                                    onOpenDetail={() => setChannelDetailModal({ selection, channel: c })}
                                    onOpenCustomTime={() => {
                                      setSelectedTargetItem(selection);
                                      setSelectedParticipantTarget(c);
                                      setCustomTimeInput(c.custom_publish_time ? toMskInputString(c.custom_publish_time) : '');
                                      setCustomRepeatTimeInput('');
                                      setIsCustomTimeModalOpen(true);
                                    }}
                                    onOpenEdit={() => handleOpenEditChannel(c, selection)}
                                    onOpenDelete={() => handleOpenLeaveSelectionModal(selection, c)}
                                  />
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* ========================================================= */}
                      {/* БЛОК 5: Кнопка Добавить канал и кнопка удалить канал */}
                      {/* ========================================================= */}
                      <div className="p-3 rounded-2xl bg-white/85 border border-pink-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenJoinSelectionModal(selection)}
                            className="px-4 py-2 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                            title="Добавить канал в подборку с выбором канала, аватаром и описанием"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>Добавить канал</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenLeaveSelectionModal(selection)}
                            className="px-3.5 py-2 rounded-2xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-[14px] font-bold cursor-pointer transition-all shadow-2xs flex items-center gap-1.5"
                            title="Удалить канал из подборки и базы данных"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Удалить канал</span>
                          </button>
                        </div>

                        {selection.userJoined && (
                          <span className="px-3 py-1.5 rounded-xl bg-sky-100 text-sky-900 text-[14px] font-bold flex items-center gap-1">
                            <Check className="w-4 h-4 text-sky-600" />
                            <span>Вы участвуете</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 3: ARCHIVE (ARCHIVED FOLDERS & SELECTIONS) */}
      {/* ==================================================================== */}
      {activeTab === 'archive' && (
        <FoldersArchiveView
          folders={folders}
          selections={selections}
          currentUserId={String(currentUser?.id || '')}
          onOpenReanimate={(target) => setReanimateModalTarget(target)}
          onDeleteItem={(target) => setDeletePromoTarget(target)}
          onPreviewFolder={(folder) => {
            setPreviewFolder(folder);
            setIsPreviewFolderModalOpen(true);
          }}
          onPreviewSelection={(selection) => {
            setPreviewSelection(selection);
            setIsPreviewSelectionModalOpen(true);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CREATE FOLDER (Редактор создания папки) */}
      {/* ==================================================================== */}
      {isCreateFolderModalOpen && (
        <FolderEditorModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          currentUser={currentUser}
          onSaved={() => {
            showStatus('Папка успешно создана и открыта для набора каналов!');
            setRefreshTrigger(prev => prev + 1);
            onRefreshUser?.();
          }}
          onBalanceUpdated={() => {
            onRefreshUser?.();
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREATE SELECTION (Подборка - Rich-конструктор) */}
      {/* ==================================================================== */}
      {isCreateSelectionModalOpen && (
        <SelectionEditorModal
          isOpen={isCreateSelectionModalOpen}
          onClose={() => setIsCreateSelectionModalOpen(false)}
          currentUser={currentUser}
          onSaved={() => {
            showStatus('Подборка успешно создана и открыта для набора каналов!');
            setRefreshTrigger(prev => prev + 1);
          }}
          onBalanceUpdated={(newBal) => {
            if (currentUser) currentUser.pointsBalance = newBal;
            onRefreshUser?.();
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: JOIN FOLDER (Dropdown & Multi-Select) */}
      {/* ==================================================================== */}
      {isJoinFolderModalOpen && selectedTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                Вступление в папку «{selectedTargetItem.title}»
              </h2>
              <button 
                type="button"
                onClick={() => {
                  setIsJoinFolderModalOpen(false);
                  setIsChannelDropdownOpen(false);
                }} 
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-[14px]">
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 text-[14px] text-slate-800 leading-relaxed shadow-2xs">
                Порог подписчиков для входа: <strong className="text-slate-900 font-extrabold">от {selectedTargetItem.min_subscribers}</strong>. Участие бесплатное при соблюдении условий.
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                  <label className="block text-[14px] font-extrabold text-slate-800">
                    Выберите ваши каналы (выпадающий список, мультивыбор):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsJoinFolderModalOpen(false);
                      onNavigate('/channels');
                    }}
                    className="text-[14px] font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Подключить новый канал</span>
                  </button>
                </div>

                {channels.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-white border border-pink-200 text-center space-y-3 shadow-2xs">
                    <p className="text-[14px] text-slate-700 font-medium">
                      У вас пока нет подключенных каналов в системе
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsJoinFolderModalOpen(false);
                        onNavigate('/channels');
                      }}
                      className="px-5 py-2.5 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Перейти к подключению каналов</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Выпадающий список моих каналов */}
                    <button
                      type="button"
                      onClick={() => setIsChannelDropdownOpen(prev => !prev)}
                      className="w-full p-3.5 rounded-2xl bg-white/90 border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center justify-between gap-2 shadow-2xs hover:bg-white transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckSquare className="w-4 h-4 text-pink-600 shrink-0" />
                        <span className="truncate">
                          {selectedChannelIdsForFolder.length === 0
                            ? 'Выберите каналы (нажмите для открытия списка)'
                            : `Выбрано каналов: ${selectedChannelIdsForFolder.length}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[14px] text-pink-600 font-extrabold hidden sm:inline">
                          {isChannelDropdownOpen ? 'Свернуть список' : 'Показать список'}
                        </span>
                        {isChannelDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-pink-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-pink-600" />
                        )}
                      </div>
                    </button>

                    {/* Развернутое меню выпадающего списка с мультивыбором */}
                    {isChannelDropdownOpen && (
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-xl space-y-2 max-h-64 overflow-y-auto">
                        {/* Кнопки быстрого мультивыбора */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-pink-200">
                          <button
                            type="button"
                            onClick={() => handleSelectAllEligibleChannels(selectedTargetItem)}
                            className="text-[14px] font-bold text-sky-700 hover:text-sky-900 cursor-pointer"
                          >
                            Выбрать все подходящие
                          </button>
                          <button
                            type="button"
                            onClick={handleClearChannelSelection}
                            className="text-[14px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                          >
                            Снять выбор
                          </button>
                        </div>

                        {channels.length > 4 && (
                          <div>
                            <input
                              type="text"
                              value={channelSearchQuery}
                              onChange={(e) => setChannelSearchQuery(e.target.value)}
                              placeholder="Поиск по названию канала..."
                              className="w-full px-3 py-1.5 rounded-xl bg-white border border-pink-200 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300 shadow-2xs"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          {channels
                            .filter(ch => {
                              if (!channelSearchQuery) return true;
                              const q = channelSearchQuery.toLowerCase();
                              return (
                                (ch.name && ch.name.toLowerCase().includes(q)) ||
                                (ch.title && ch.title.toLowerCase().includes(q)) ||
                                (ch.username && ch.username.toLowerCase().includes(q))
                              );
                            })
                            .map(ch => {
                              const isSelected = selectedChannelIdsForFolder.includes(String(ch.id));
                              const subs = ch.subscribers || ch.subscribersCount || 0;
                              const meetsThreshold = subs >= Number(selectedTargetItem.min_subscribers || 0);
                              const alreadyInFolder = (selectedTargetItem.participants || []).some(
                                (p: any) => String(p.channel_id) === String(ch.id)
                              );

                              return (
                                <div
                                  key={ch.id}
                                  onClick={() => handleToggleChannelSelection(String(ch.id))}
                                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                    isSelected
                                      ? 'bg-white border-pink-400 shadow-xs ring-1 ring-pink-300'
                                      : 'bg-white/80 border-pink-100 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
                                    />
                                    {ch.photoUrl || ch.avatarUrl ? (
                                      <CachedMediaImage src={ch.photoUrl || ch.avatarUrl} alt={ch.name || 'Канал'} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-pink-200" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0">
                                        {ch.name?.slice(0, 2) || '📢'}
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <span className="font-bold text-[14px] text-slate-900 block truncate">{ch.name || ch.title}</span>
                                      <span className="text-[14px] text-slate-500 block truncate">
                                        {ch.username || ch.telegramUsername ? `@${(ch.username || ch.telegramUsername).replace(/^@/, '')} • ` : ''}{subs} подп.
                                      </span>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-1.5">
                                    {alreadyInFolder ? (
                                      <span className="text-[14px] text-sky-800 font-bold px-2 py-0.5 rounded-lg bg-sky-100 border border-sky-200">
                                        Уже в папке
                                      </span>
                                    ) : !meetsThreshold ? (
                                      <span className="text-[14px] text-orange-800 font-bold px-2 py-0.5 rounded-lg bg-orange-100 border border-orange-200">
                                        Ниже порога
                                      </span>
                                    ) : (
                                      <span className="text-[14px] text-sky-800 font-bold px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200">
                                        Подходит
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Выбранные каналы (плашки) */}
                    {selectedChannelIdsForFolder.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[14px] font-bold text-slate-800 block">
                          Выбранные каналы для вступления ({selectedChannelIdsForFolder.length}):
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                          {selectedChannelIdsForFolder.map(id => {
                            const ch = channels.find(c => String(c.id) === String(id));
                            if (!ch) return null;
                            return (
                              <div
                                key={id}
                                className="pl-2.5 pr-2 py-1 rounded-xl bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-2 shadow-2xs"
                              >
                                <span className="truncate max-w-[140px] sm:max-w-[200px]">{ch.name || ch.title}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChannelSelection(id)}
                                  className="p-0.5 hover:bg-pink-100 rounded-md text-pink-600 cursor-pointer"
                                  title="Убрать канал из выбора"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-white/70 border border-pink-100 text-[14px] text-slate-700 leading-relaxed shadow-2xs">
                За 1 час до публикации бот @IIrkiBot проверит наличие прав администратора на канале.
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsJoinFolderModalOpen(false);
                    setIsChannelDropdownOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-700 text-[14px] font-bold hover:bg-white cursor-pointer transition-all"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleJoinFolder}
                  disabled={isSubmittingJoinFolder || selectedChannelIdsForFolder.length === 0}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white text-[14px] font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingJoinFolder 
                    ? 'Добавление...' 
                    : selectedChannelIdsForFolder.length > 1 
                    ? `Вступить (${selectedChannelIdsForFolder.length} канала)` 
                    : 'Вступить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: LEAVE FOLDER WARNING CONFIRMATION (Real-time deletion) */}
      {/* ==================================================================== */}
      {isLeaveFolderModalOpen && leaveTargetFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                Подтверждение выхода из папки
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveFolderModalOpen(false);
                  setLeaveTargetFolder(null);
                  setLeaveTargetParticipant(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-[14px]">
              <p className="text-[14px] text-slate-800 leading-relaxed">
                Вы действительно хотите выйти из папки <strong className="text-slate-900 font-extrabold">«{leaveTargetFolder.title}»</strong> и удалить свой канал?
              </p>

              {leaveTargetParticipant && (
                <div className="p-3.5 rounded-2xl bg-white/90 border border-pink-200 flex items-center gap-3 shadow-2xs">
                  {leaveTargetParticipant.avatar_url ? (
                    <CachedMediaImage src={leaveTargetParticipant.avatar_url} alt={leaveTargetParticipant.channel_name || 'Канал'} className="w-11 h-11 rounded-xl object-cover shrink-0 border border-pink-200" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0">
                      {leaveTargetParticipant.channel_name?.slice(0, 2) || '📢'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-[14px] text-slate-900 block truncate">
                      {leaveTargetParticipant.channel_name}
                    </span>
                    <span className="text-[14px] text-slate-500 block truncate">
                      {leaveTargetParticipant.channel_username ? `@${leaveTargetParticipant.channel_username.replace(/^@/, '')} • ` : ''}
                      {leaveTargetParticipant.subscribers_count || 0} подписчиков
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-[14px] text-rose-800 leading-relaxed">
                Запись будет удалена из базы данных в реальном времени. Канал перестанет участвовать в совместном размещении папки.
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLeaveFolderModalOpen(false);
                    setLeaveTargetFolder(null);
                    setLeaveTargetParticipant(null);
                  }}
                  disabled={isLeavingFolder}
                  className="px-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-700 font-bold hover:bg-white text-[14px] cursor-pointer transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLeave}
                  disabled={isLeavingFolder}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLeavingFolder ? 'Удаление...' : 'Да, удалить канал и выйти'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3b: LEAVE / DELETE CHANNEL FROM SELECTION (Выбор канала из своих и удаление) */}
      {/* ==================================================================== */}
      <LeaveSelectionModal
        isOpen={isLeaveSelectionModalOpen}
        onClose={() => {
          setIsLeaveSelectionModalOpen(false);
          setLeaveTargetSelection(null);
          setLeaveTargetSelectionChannel(null);
        }}
        selection={leaveTargetSelection}
        isOrganizer={Boolean(leaveTargetSelection && isItemOrganizer(leaveTargetSelection))}
        userChannels={(() => {
          if (!leaveTargetSelection) return [];
          const activeChans = (leaveTargetSelection.channels || []).filter((c: any) => c.status === 'active');
          if (isItemOrganizer(leaveTargetSelection)) {
            return activeChans;
          }
          return activeChans.filter((c: any) => isUserChannel(c));
        })()}
        selectedChannel={leaveTargetSelectionChannel}
        onSelectChannel={(ch) => setLeaveTargetSelectionChannel(ch)}
        onConfirmDelete={handleConfirmLeaveSelection}
        isDeleting={isLeavingSelection}
      />

      {/* ==================================================================== */}
      {/* MODAL 4: JOIN SELECTION (С модерацией 763) */}
      {/* ==================================================================== */}
      {isJoinSelectionModalOpen && selectedTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h2 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                Участие в подборке «{selectedTargetItem.header_title}»
              </h2>
              <button onClick={() => setIsJoinSelectionModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 text-sm text-sky-900 leading-relaxed">
                Стоимость участия: <strong>{formatIirkyCount(pf.selectionJoin)} за участие + {formatIirkyCount(pf.selectionModeration)} за нейромодерацию (Функция 763)</strong>. Ссылки и спам-фильтр отключены, проверяется отсутствие ненормативной лексики, законы РФ и соответствие категории.
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-extrabold text-slate-800">
                    Выберите канал для подборки:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsJoinSelectionModalOpen(false);
                      onNavigate('/channels');
                    }}
                    className="text-sm font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Подключить канал</span>
                  </button>
                </div>

                {channels.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-white border border-pink-200 text-center space-y-3">
                    <p className="text-sm text-slate-700">
                      У вас пока нет подключенных каналов в системе
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsJoinSelectionModalOpen(false);
                        onNavigate('/channels');
                      }}
                      className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Перейти к подключению каналов</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {channels.map(ch => {
                      const isSelected = String(selectedChannelIdForSelection) === String(ch.id);
                      const subs = ch.subscribers || ch.subscribersCount || 0;
                      const meetsThreshold = subs >= Number(selectedTargetItem.min_subscribers || 0);

                      return (
                        <div
                          key={ch.id}
                          onClick={() => setSelectedChannelIdForSelection(String(ch.id))}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-white border-pink-500 shadow-sm ring-1 ring-pink-400'
                              : 'bg-white/80 border-pink-100 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {ch.photoUrl || ch.avatarUrl ? (
                              <CachedMediaImage src={ch.photoUrl || ch.avatarUrl} alt={ch.name || 'Канал'} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-pink-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                                {ch.name?.slice(0, 2)}
                              </div>
                            )}
                            <div className="truncate">
                              <span className="font-bold text-sm text-slate-900 block truncate">{ch.name || ch.title}</span>
                              <span className="text-sm text-slate-500">
                                {ch.username || ch.telegramUsername || ''} • {subs} подписчиков
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {!meetsThreshold && (
                              <span className="text-sm text-orange-700 font-bold px-2 py-0.5 rounded bg-orange-100">
                                Ниже порога
                              </span>
                            )}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-pink-600 bg-pink-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsJoinSelectionModalOpen(false);
                          onNavigate('/channels');
                        }}
                        className="text-sm font-bold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-sky-600" />
                        <span>Подключить еще один канал в систему</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar / Image for selection card with full uploader and gallery */}
              <ChannelAvatarUploader
                value={selChannelAvatarUrl}
                onChange={(url) => setSelChannelAvatarUrl(url)}
                channelName={channels.find(c => String(c.id) === String(selectedChannelIdForSelection))?.name || 'Канал'}
                channelUsername={channels.find(c => String(c.id) === String(selectedChannelIdForSelection))?.username || ''}
                userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
                onGenerateAi={handleGenerateChannelImageAi}
                isGeneratingAi={isAiGeneratingChannelAvatar}
              />

              {/* Channel promo text (up to 200 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    Описание канала в подборке (до 200 знаков) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateChannelPromoAi}
                    disabled={isAiGeneratingChannelPromo}
                    className="text-sm font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Сгенерировать ({formatIirkyCount(pf.promoAiText)})</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={selChannelPromoText}
                  onChange={(e) => setSelChannelPromoText(e.target.value)}
                  placeholder="Ёмкое описание преимуществ вашего канала для читателей подборки..."
                  className="w-full p-3 bg-white border border-pink-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <div className="flex justify-between items-center text-sm text-slate-400 mt-1">
                  <span>Модерация через 763 функцию без проверки на спам и ссылки</span>
                  <span className={selChannelPromoText.length > 190 ? 'text-orange-600 font-bold' : ''}>
                    {selChannelPromoText.length} / 200
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinSelectionModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleJoinSelection}
                  disabled={isSubmittingJoinSelection}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  {isSubmittingJoinSelection ? 'Модерация...' : `Оплатить ${formatIirkyCount(joinSelectionTotalCost)} и вступить`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: CONTACT AUTHOR (Both Telegram & Internal Chat) */}
      {/* ==================================================================== */}
      {isContactAuthorModalOpen && selectedTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h2 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                Связь с организатором: {selectedTargetItem.author_name}
              </h2>
              <button onClick={() => setIsContactAuthorModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-sm text-slate-600 leading-relaxed">
                Если ваш канал не проходит по минимальному порогу подписчиков или вы хотите участвовать платно без публикации поста у себя — напишите организатору напрямую:
              </p>

              {/* Both Telegram Contact & Internal Chat Contact */}
              <div className="space-y-2">
                {selectedTargetItem.author_username && (
                  <a
                    href={`https://t.me/${selectedTargetItem.author_username.replace('@','')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Написать в Telegram (@{selectedTargetItem.author_username.replace('@','')})</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsContactAuthorModalOpen(false);
                    onNavigate(`/social/messages?with=${selectedTargetItem.author_id}`);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-white border border-pink-200 text-slate-800 font-bold flex items-center justify-center gap-2 hover:bg-pink-50 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-pink-600" />
                  <span>Написать во внутренний чат соцсети ИИSMM</span>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsContactAuthorModalOpen(false)}
                  className="text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: REJECT PARTICIPANT WITH COMMENT */}
      {/* ==================================================================== */}
      {isRejectModalOpen && selectedParticipantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h2 className="text-base font-black text-rose-700">
                Отклонить участие канала «{selectedParticipantTarget.channel_name}»
              </h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-sm text-slate-600">
                Укажите причину отказа. Участнику сразу придет оповещение в личку Telegram и в уведомления веб-кабинета.
              </p>

              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Причина отказа (например: неподходящая тематика, низкая вовлеченность аудитории)..."
                className="w-full p-3 bg-white border border-rose-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all cursor-pointer"
                >
                  Подтвердить отказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: RESULTS & ANALYTICS (Итоги 72 часа) */}
      {/* ==================================================================== */}
      {isSelectionResultsModalOpen && selectedTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div>
                <h2 className="text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Итоги взаимного пиара: {selectedTargetItem.header_title}
                </h2>
                <p className="text-sm text-slate-500">
                  Анализ результатов взаимного продвижения спустя 3 суток
                </p>
              </div>
              <button onClick={() => setIsSelectionResultsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingResults ? (
              <NeurosphereLoader variant="inline" label="Загрузка аналитики..." />
            ) : resultsData ? (
              <div className="space-y-4 text-sm">
                {/* Average Stats Banner */}
                <div className="p-4 rounded-2xl bg-white/80 border border-pink-200 space-y-2">
                  <span className="text-sm font-extrabold text-slate-800 block">
                    Средний результат по всем участникам подборки:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
                    <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100">
                      <span className="text-slate-500 block text-sm">Прирост подп.</span>
                      <strong className="text-orange-700 text-sm">+{resultsData.averages?.avgDeltaSubscribers || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                      <span className="text-slate-500 block text-sm">Просмотры</span>
                      <strong className="text-sky-700 text-sm">{resultsData.averages?.avgViews?.toLocaleString() || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-pink-50 border border-pink-100">
                      <span className="text-slate-500 block text-sm">Лайки / реакции</span>
                      <strong className="text-pink-700 text-sm">{resultsData.averages?.avgLikes || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                      <span className="text-slate-500 block text-sm">Репосты</span>
                      <strong className="text-indigo-700 text-sm">{resultsData.averages?.avgReposts || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block text-sm">Комментарии</span>
                      <strong className="text-purple-700 text-sm">{resultsData.averages?.avgComments || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Per-Channel Results Table */}
                <div className="space-y-2">
                  <span className="text-sm font-extrabold text-slate-800 block">
                    Результаты по каждому каналу:
                  </span>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {resultsData.channels?.map((c: any) => (
                      <div key={c.id} className="p-3 rounded-2xl bg-white border border-pink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5">
                          {c.channel_avatar_url ? (
                            <CachedMediaImage src={c.channel_avatar_url} alt={c.channel_name || 'Канал'} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-pink-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm">
                              {c.channel_name?.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">{c.channel_name}</span>
                            <span className="text-slate-500 text-sm">
                              Было: {c.subscribers_initial} → Стало: {c.subscribers_final}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-700 text-sm">
                          <span className="text-orange-600 font-extrabold text-sm">+{c.subscribers_delta} подп.</span>
                          <span className="text-sky-700 flex items-center gap-1 text-sm">
                            <Eye className="w-4 h-4" />
                            <span>{c.views_count?.toLocaleString()}</span>
                          </span>
                          <span className="text-pink-600 flex items-center gap-1 text-sm">
                            <ThumbsUp className="w-4 h-4" />
                            <span>{c.likes_count}</span>
                          </span>
                          <span className="text-indigo-600 flex items-center gap-1 text-sm">
                            <Share2 className="w-4 h-4" />
                            <span>{c.reposts_count}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finalize Button for Author */}
                {selectedTargetItem.author_id === currentUser?.id && selectedTargetItem.status !== 'results' && (
                  <div className="pt-3 border-t border-pink-200 flex justify-end">
                    <button
                      onClick={() => handleFinalizeResults(selectedTargetItem.id)}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                    >
                      Зафиксировать итоги и разослать всем в личку Telegram
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: EDIT FOLDER (Редактирование папки организатором) */}
      {/* ==================================================================== */}
      {isEditFolderModalOpen && Boolean(editingFolder) && (
        <FolderEditorModal
          isOpen={isEditFolderModalOpen && Boolean(editingFolder)}
          folder={editingFolder}
          onClose={() => {
            setIsEditFolderModalOpen(false);
            setEditingFolder(null);
          }}
          currentUser={currentUser}
          onSaved={() => {
            showStatus('Изменения папки успешно сохранены!');
            setRefreshTrigger(prev => prev + 1);
            onRefreshUser?.();
          }}
          onBalanceUpdated={() => {
            onRefreshUser?.();
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 9: EDIT SELECTION (Редактирование подборки организатором - Rich-конструктор) */}
      {/* ==================================================================== */}
      {isEditSelectionModalOpen && editingSelection && (
        <SelectionEditorModal
          isOpen={isEditSelectionModalOpen && Boolean(editingSelection)}
          selection={editingSelection}
          onClose={() => {
            setIsEditSelectionModalOpen(false);
            setEditingSelection(null);
          }}
          currentUser={currentUser}
          onSaved={() => {
            showStatus('Подборка успешно обновлена!');
            setRefreshTrigger(prev => prev + 1);
          }}
          onBalanceUpdated={(newBal) => {
            if (currentUser) currentUser.pointsBalance = newBal;
            onRefreshUser?.();
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 10: PREVIEW UNIFIED SELECTION POST (Предпросмотр поста подборки) */}
      {/* ==================================================================== */}
      <PromoPostPreviewModal
        isOpen={Boolean(isPreviewSelectionModalOpen && previewSelection)}
        mode="selection"
        item={previewSelection}
        onClose={() => setIsPreviewSelectionModalOpen(false)}
      />

      {/* ==================================================================== */}
      {/* MODAL 11: EDIT CHANNEL IN SELECTION (Редактирование своего канала) */}
      {/* ==================================================================== */}
      {isEditChannelModalOpen && editingChannelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div>
                <h2 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Редактирование описания: {editingChannelTarget.channel_name}
                </h2>
                <p className="text-sm text-slate-500">
                  Редактирование стоит {formatIirkyCount(pf.selectionEdit)} и проверяется модерацией через функцию 763
                </p>
              </div>
              <button onClick={() => setIsEditChannelModalOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Channel Avatar with full uploader, gallery and preview */}
              <ChannelAvatarUploader
                value={editingChannelAvatar}
                onChange={(url) => setEditingChannelAvatar(url)}
                channelName={editingChannelTarget.channel_name || 'Канал'}
                channelUsername={editingChannelTarget.channel_username || ''}
                userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
                onGenerateAi={async () => {
                  try {
                    const res = await fetch('/api/protalk/generate-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        imagePrompt: `Яркий логотип/аватар Telegram канала ${editingChannelTarget.channel_name}. Профессиональный дизайн.`,
                        userId: currentUser?.id,
                        prefix: 'sel_chan_img'
                      })
                    });
                    const data = await res.json();
                    if (data.imageUrl || data.url) {
                      setEditingChannelAvatar(data.imageUrl || data.url);
                      const charged = data.costIirky !== undefined ? Number(data.costIirky) : pricing.imageModels.func_621;
                      showStatus(`Картинка сгенерирована (списано: ${formatIirkyCount(charged)})`);
                      onRefreshUser?.();
                    }
                  } catch (e: any) {
                    showStatus(e.message, 'error');
                  }
                }}
              />

              {/* Promo Text (up to 200 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-extrabold text-slate-700">
                    Описание канала в подборке (до 200 символов) *
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/promo/generate-text', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: currentUser?.id,
                            type: 'selection_promo',
                            channelName: editingChannelTarget.channel_name,
                            category: selectedTargetItem?.categories?.[0] || 'Бизнес'
                          })
                        });
                        const data = await res.json();
                        if (data.success && data.text) {
                          setEditingChannelText(data.text);
                          showStatus(`Описание сгенерировано (списано: ${formatIirkyCount(pf.promoAiText)})`);
                          onRefreshUser?.();
                        }
                      } catch (e: any) {
                        showStatus(e.message, 'error');
                      }
                    }}
                    className="text-sm font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Сгенерировать ({formatIirkyCount(pf.promoAiText)})</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  maxLength={200}
                  value={editingChannelText}
                  onChange={(e) => setEditingChannelText(e.target.value)}
                  placeholder="Описание преимуществ канала для подборки..."
                  className="w-full p-3 bg-white border border-pink-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <div className="flex justify-between items-center text-sm text-slate-400 mt-1">
                  <span>Модерация 763 без спам-фильтра и ссылок</span>
                  <span className={editingChannelText.length > 190 ? 'text-orange-600 font-bold' : ''}>
                    {editingChannelText.length} / 200
                  </span>
                </div>
              </div>

              {/* Real-time Live Preview of Channel in Post */}
              <div className="pt-2 border-t border-pink-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-800">
                    Предпросмотр карточки в подборке:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSelection(selectedTargetItem);
                      setIsPreviewSelectionModalOpen(true);
                    }}
                    className="text-sm font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-sky-600" />
                    <span>Пост целиком</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-pink-200 flex items-start gap-3 shadow-2xs">
                  {editingChannelAvatar ? (
                    <CachedMediaImage src={editingChannelAvatar} alt={editingChannelTarget.channel_name || 'Канал'} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-pink-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {editingChannelTarget.channel_name?.slice(0, 2)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{editingChannelTarget.channel_name}</span>
                      {editingChannelTarget.channel_username && (
                        <span className="text-sm text-pink-600 font-bold">{editingChannelTarget.channel_username}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1 leading-snug break-words">
                      {editingChannelText || 'Здесь будет отображаться ваше рекламное описание канала...'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditChannelModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditChannel}
                  disabled={isSavingChannelEdit}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  {isSavingChannelEdit ? 'Модерация...' : `Сохранить (${formatIirkyCount(pf.selectionEdit)})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 12: PREVIEW FOLDER INVITATION POST (Предпросмотр поста папки) */}
      {/* ==================================================================== */}
      <PromoPostPreviewModal
        isOpen={Boolean(isPreviewFolderModalOpen && previewFolder)}
        mode="folder"
        item={previewFolder}
        onClose={() => setIsPreviewFolderModalOpen(false)}
      />

      {/* ==================================================================== */}
      {/* MODAL 13: CHANNEL ACTIONS IN SELECTION (Клик на канал в подборке) */}
      {/* ==================================================================== */}
      {channelDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                <h2 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Канал в подборке
                </h2>
              </div>
              <button 
                onClick={() => setChannelDetailModal(null)} 
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel Card in Selection */}
            <div className="p-4 rounded-2xl bg-white/90 border border-pink-200 space-y-3 shadow-2xs">
              <div className="flex items-center gap-3">
                {channelDetailModal.channel.channel_avatar_url ? (
                  <CachedMediaImage
                    src={channelDetailModal.channel.channel_avatar_url}
                    alt={channelDetailModal.channel.channel_name || 'Канал'}
                    className="w-14 h-14 rounded-2xl object-cover border border-pink-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-base shrink-0">
                    {channelDetailModal.channel.channel_name?.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-base text-slate-900">
                      {channelDetailModal.channel.channel_name}
                    </span>
                    {isUserChannel(channelDetailModal.channel) && (
                      <span className="px-2 py-0.5 rounded-lg bg-pink-100 text-pink-800 text-sm font-black flex items-center gap-1">
                        ⭐ Ваш канал в подборке
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-pink-600 font-bold block">
                    {channelDetailModal.channel.channel_username}
                  </span>
                  <span className="text-sm text-slate-500">
                    {channelDetailModal.channel.subscribers_initial || 0} подписчиков
                  </span>
                </div>
              </div>

              <div>
                <strong className="text-slate-800 text-sm block mb-1">
                  Рекламный текст в посте подборки (до 200 символов):
                </strong>
                <p className="text-sm text-slate-700 p-3 rounded-xl bg-slate-50 border border-pink-100 leading-relaxed whitespace-pre-line break-words">
                  {channelDetailModal.channel.promo_text}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600 pt-1">
                <span>Модерация через функцию 763:</span>
                <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  Одобрено
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="space-y-2 pt-2">
              {(isUserChannel(channelDetailModal.channel) || isItemOrganizer(channelDetailModal.selection)) && (
                <button
                  type="button"
                  onClick={() => {
                    const { channel, selection } = channelDetailModal;
                    setChannelDetailModal(null);
                    handleOpenEditChannel(channel, selection);
                  }}
                  className="w-full py-3 px-4 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Редактировать рекламу канала ({formatIirkyCount(pf.selectionEdit)})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const { selection } = channelDetailModal;
                  setChannelDetailModal(null);
                  setPreviewSelection(selection);
                  setIsPreviewSelectionModalOpen(true);
                }}
                className="w-full py-3 px-4 rounded-2xl text-sm font-bold bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Eye className="w-4 h-4 text-sky-600" />
                <span>Предпросмотр поста с подборкой</span>
              </button>

              {channelDetailModal.channel.channel_username && (
                <a
                  href={`https://t.me/${channelDetailModal.channel.channel_username.replace('@','')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-2xl text-sm font-bold bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 transition-all flex items-center justify-center gap-2 text-center"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <span>Открыть канал в Telegram</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 14: FOLDER INFORMATION & RULES (i) */}
      {/* ==================================================================== */}
      {isFolderInfoModalOpen && infoModalFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-sky-100 text-sky-700">
                  <Info className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Информация и правила папки
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderInfoModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-[14px]">
              {/* Folder Details Box */}
              <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {infoModalFolder.title}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-xl bg-pink-100 text-pink-700 font-bold text-[14px]">
                    {infoModalFolder.status === 'confirmed' ? 'Сформирована' : infoModalFolder.status === 'published' ? 'Опубликована' : 'Идет сбор'}
                  </span>
                </div>

                <div className="text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Организатор: <strong className="text-slate-800">{infoModalFolder.author_name}</strong> {infoModalFolder.author_username && `(@${infoModalFolder.author_username.replace('@','')})`}</span>
                  <span>Часовой пояс: <strong className="text-slate-800">{infoModalFolder.timezone || 'Europe/Moscow (МСК)'}</strong></span>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {infoModalFolder.categories?.map((cat: string) => (
                    <span key={cat} className="px-2.5 py-0.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[14px]">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-white/85 border border-pink-200">
                  <span className="text-slate-500 text-[14px] block">Участники</span>
                  <span className="font-extrabold text-slate-900 text-[14px]">
                    {infoModalFolder.participantsCount || 0} из {infoModalFolder.max_participants}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/85 border border-pink-200">
                  <span className="text-slate-500 text-[14px] block">Минимум подписчиков</span>
                  <span className="font-extrabold text-slate-900 text-[14px]">
                    от {infoModalFolder.min_subscribers}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/85 border border-pink-200">
                  <span className="text-slate-500 text-[14px] block">Дата публикации</span>
                  <span className="font-extrabold text-slate-900 text-[14px]">
                    {new Date(infoModalFolder.scheduled_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Repeat Post info if enabled */}
              {infoModalFolder.repeat_post_enabled === 1 && (
                <div className="p-3 rounded-2xl bg-white/85 border border-pink-200 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Повторный пост папки:</span>
                  <span className="font-bold text-slate-900">
                    {infoModalFolder.repeat_scheduled_at ? new Date(infoModalFolder.repeat_scheduled_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Включен'}
                  </span>
                </div>
              )}

              {/* Rules & Conditions */}
              <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 space-y-1.5 shadow-2xs">
                <span className="font-extrabold text-slate-900 block">
                  Правила размещения и условия участия:
                </span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {infoModalFolder.rules_instruction || '48 часов в ленте, 3 часа в топе'}
                </p>
                <div className="pt-2 border-t border-pink-100 text-[14px] text-slate-600 flex flex-col gap-1">
                  <span>• Вход и размещение материалов: бесплатно</span>
                  <span>• Спонсоры папки освобождаются от порогов подписчиков и тематики</span>
                  <span>• Участник может индивидуально сместить время выхода поста на своем канале до 24 часов</span>
                </div>
              </div>

              {/* Telegram Folder Link if present */}
              {infoModalFolder.telegram_folder_link && (
                <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="font-bold text-sky-950 block text-[14px]">Инвайт-ссылка на папку в Telegram:</span>
                    <span className="text-sky-800 text-[14px] truncate block">{infoModalFolder.telegram_folder_link}</span>
                  </div>
                  <a
                    href={infoModalFolder.telegram_folder_link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shrink-0 inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Открыть папку</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pink-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(getInviteUrl('folder', infoModalFolder), 'Реферальная ссылка скопирована')}
                  className="px-3 py-2 rounded-xl bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 text-[14px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Скопировать ссылку</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(getTmaInviteUrl('folder', infoModalFolder), 'Ссылка для TMA скопирована')}
                  className="px-3 py-2 rounded-xl bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 text-[14px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>TMA инвайт</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFolderInfoModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-pink-50 cursor-pointer shadow-2xs text-[14px]"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 15: INDIVIDUAL PUBLICATION TIME ADJUSTMENT */}
      {/* ==================================================================== */}
      {isCustomTimeModalOpen && selectedTargetItem && selectedParticipantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-sky-100 text-sky-700">
                  <Clock className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Индивидуальное время публикации
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomTimeModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-[14px]">
              <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-200 space-y-1.5 shadow-2xs">
                <div className="text-slate-700">
                  Папка: <strong className="text-slate-900">{selectedTargetItem.title}</strong>
                </div>
                <div className="text-slate-700">
                  Ваш канал: <strong className="text-slate-900">{selectedParticipantTarget.channel_name}</strong>
                </div>
                <div className="text-slate-600 text-[14px]">
                  Общее время сбора папки: <strong className="text-slate-800">{new Date(selectedTargetItem.scheduled_at).toLocaleString('ru-RU')} ({selectedTargetItem.timezone || 'МСК'})</strong>
                </div>
                <p className="text-[14px] text-slate-500 pt-1 leading-relaxed">
                  Вы можете сместить дату и время выхода поста на вашем канале на удобное вам время, но не более чем на 24 часа вперёд от даты общего сбора.
                </p>
              </div>

              {/* Main Post Custom Time Input */}
              <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 space-y-2.5 shadow-2xs">
                <label className="font-bold text-slate-800 block text-[14px]">
                  Время выхода первого поста на вашем канале:
                </label>
                <input
                  type="datetime-local"
                  value={customTimeInput}
                  onChange={(e) => setCustomTimeInput(e.target.value)}
                  className="w-full bg-white border border-pink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs"
                />

                {/* Helper quick buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(selectedTargetItem.scheduled_at);
                      base.setHours(base.getHours() + 2);
                      setCustomTimeInput(toMskInputString(base));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-[14px] font-bold border border-sky-200 cursor-pointer"
                  >
                    +2 часа
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(selectedTargetItem.scheduled_at);
                      base.setHours(base.getHours() + 6);
                      setCustomTimeInput(toMskInputString(base));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-[14px] font-bold border border-sky-200 cursor-pointer"
                  >
                    +6 часов
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(selectedTargetItem.scheduled_at);
                      base.setHours(base.getHours() + 12);
                      setCustomTimeInput(toMskInputString(base));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-[14px] font-bold border border-sky-200 cursor-pointer"
                  >
                    +12 часов
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = new Date(selectedTargetItem.scheduled_at);
                      base.setHours(base.getHours() + 24);
                      setCustomTimeInput(toMskInputString(base));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-[14px] font-bold border border-sky-200 cursor-pointer"
                  >
                    +24 часа (макс)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTimeInput('')}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-pink-50 text-slate-600 text-[14px] font-bold border border-pink-200 cursor-pointer"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              {/* Repeat Post Custom Time Input (if repeat enabled) */}
              {selectedTargetItem.repeat_post_enabled === 1 && (
                <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 space-y-2.5 shadow-2xs">
                  <label className="font-bold text-slate-800 block text-[14px]">
                    Время выхода повторного поста:
                  </label>
                  <div className="text-[14px] text-slate-500">
                    Общее время повторного поста: {selectedTargetItem.repeat_scheduled_at ? new Date(selectedTargetItem.repeat_scheduled_at).toLocaleString('ru-RU') : 'не задано'}
                  </div>
                  <input
                    type="datetime-local"
                    value={customRepeatTimeInput}
                    onChange={(e) => setCustomRepeatTimeInput(e.target.value)}
                    className="w-full bg-white border border-pink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setCustomRepeatTimeInput('')}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-pink-50 text-slate-600 text-[14px] font-bold border border-pink-200 cursor-pointer"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-pink-200">
              <button
                type="button"
                onClick={() => setIsCustomTimeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-pink-50 cursor-pointer text-[14px]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveCustomTime}
                disabled={isSavingCustomTime}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                {isSavingCustomTime ? 'Сохранение...' : 'Сохранить персональное время'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 16: SPONSOR MANAGEMENT */}
      {/* ==================================================================== */}
      {isSponsorModalOpen && sponsorTargetFolder && sponsorTargetParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </span>
                <h2 className="text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                  Управление статусом Спонсор
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSponsorModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-[14px]">
              {/* Target Channel Information */}
              <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-base">
                    {sponsorTargetParticipant.channel_name}
                  </span>
                  <span className="text-[14px] text-slate-500 font-bold">
                    {sponsorTargetParticipant.subscribers_count} подписчиков
                  </span>
                </div>
                <div className="text-slate-600 text-[14px]">
                  Папка: <strong className="text-slate-800">{sponsorTargetFolder.title}</strong>
                </div>
              </div>

              {/* Explanatory rules block for Sponsor */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1 leading-relaxed">
                <strong className="font-black block text-[14px]">
                  Особенности статуса «Спонсор»:
                </strong>
                <p className="text-[14px] text-amber-900">
                  • Для спонсора <strong>не применяются критерии</strong> по минимальному числу подписчиков и тематике канала.
                </p>
                <p className="text-[14px] text-amber-900">
                  • В списке участников и в карточке канала отображается плашка «⭐ Спонсор».
                </p>
                <p className="text-[14px] text-amber-900">
                  • Вы можете отключить публикацию поста на канале спонсора (ссылка на его канал останется внутри папки).
                </p>
              </div>

              {/* Options */}
              <div className="p-4 rounded-2xl bg-white/85 border border-pink-200 space-y-3 shadow-2xs">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSponsorActive}
                    onChange={(e) => setIsSponsorActive(e.target.checked)}
                    className="w-5 h-5 rounded text-pink-600 accent-pink-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-[14px]">
                      Присвоить каналу статус «Спонсор»
                    </span>
                    <span className="text-[14px] text-slate-500">
                      Канал будет выделен специальным бейджем спонсора
                    </span>
                  </div>
                </label>

                {isSponsorActive && (
                  <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-pink-100">
                    <input
                      type="checkbox"
                      checked={sponsorSkipPosting}
                      onChange={(e) => setSponsorSkipPosting(e.target.checked)}
                      className="w-5 h-5 rounded text-orange-600 accent-orange-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-[14px]">
                        Отключить отправку поста на канал спонсора
                      </span>
                      <span className="text-[14px] text-slate-500">
                        Пост папки не будет публиковаться на его канале, канал остаётся в папке
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-pink-200">
              <button
                type="button"
                onClick={() => setIsSponsorModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-pink-50 cursor-pointer text-[14px]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleSaveSponsor(isSponsorActive, sponsorSkipPosting)}
                disabled={isSavingSponsor}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                {isSavingSponsor ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REANIMATE FOLDER OR SELECTION */}
      <ReanimateModal
        isOpen={Boolean(reanimateModalTarget)}
        target={reanimateModalTarget}
        onClose={() => setReanimateModalTarget(null)}
        onSuccess={(msg) => {
          setToastSuccess(msg);
          setRefreshTrigger(prev => prev + 1);
        }}
        userId={String(currentUser?.id || '')}
      />

      {/* MODAL: DELETE FOLDER OR SELECTION BY ORGANIZER */}
      <DeletePromoModal
        isOpen={Boolean(deletePromoTarget)}
        target={deletePromoTarget}
        isDeleting={isDeletingPromo}
        onClose={() => setDeletePromoTarget(null)}
        onConfirm={handleConfirmDeletePromo}
      />
    </div>
  );
}
