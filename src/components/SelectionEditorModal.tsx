import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Sparkles,
  Send,
  Upload,
  Image as ImageIcon,
  Calendar,
  Trash2,
  ChevronDown,
  Check,
  Eye,
  Loader2,
  CheckCircle2,
  Users,
  PlusCircle,
  Edit3,
  ExternalLink,
  Layers,
  FileText
} from 'lucide-react';
import { GallerySelectModal } from './GallerySelectModal';
import { PROMO_CATEGORIES, InlineButton } from '../types';
import { TelegramPostTextEditor } from './TelegramPostTextEditor';
import { InlineButtonsBuilder } from './InlineButtonsBuilder';
import { RichPreviewRenderer } from './PostTelegramEditor';
import { ChatMediaModal } from './ChatFormatModals';
import { MiniAudioField } from './MiniAudioField';
import { getInlineButtonStyleClasses } from './MarkdownRenderer';
import { toMskInputString, fromMskInputString } from '../utils/timezones';
import { ImageBuilderModal } from './image-builder';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';
import { CachedMediaImage } from './CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

export interface SelectionParticipantItem {
  id: string;
  channel_id?: string;
  channel_name: string;
  channel_username: string;
  channel_avatar_url: string;
  promo_text: string;
  subscribers_count?: number;
  promo_images?: string[];
  status?: string;
}

export interface SelectionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection?: any | null; // null => creation, object => editing
  currentUser?: any | null;
  onSaved: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

function normalizeToRows(raw: any): InlineButton[][] {
  if (!raw || !Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (Array.isArray(raw[0])) return raw as InlineButton[][];
  return [raw as InlineButton[]];
}

/**
 * Requirement 5: Exact Markdown structure for each channel block in Rich selection post
 * ## [Название канала из базы данных](ссылка на канал телеграм прямая)
 * ![](ссылка на картинку канала полная)
 * <i>описание какнала из био канала до 200 символов</i>
 * <b>[✅ Подписаться на канал](ссылка на канал телеграм прямая)</b>
 */
export function formatSelectionChannelMarkdown(channel: {
  channel_name?: string;
  channel_username?: string;
  channel_avatar_url?: string;
  promo_text?: string;
}, includeAvatar = true): string {
  const name = (channel.channel_name || 'Канал').trim();
  const rawUser = (channel.channel_username || '').replace(/^@/, '').trim();
  const directLink = rawUser ? `https://t.me/${rawUser}` : 'https://t.me/';
  const avatar = includeAvatar ? (channel.channel_avatar_url || '').trim() : '';
  const bio = (channel.promo_text || '').trim().slice(0, 200);

  const topLines = [
    `## [${name}](${directLink})`,
    avatar ? `![](${avatar})` : '',
    bio ? `<i>${bio}</i>` : ''
  ].filter(Boolean);

  const subscribeLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${directLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;

  // Requirement: Дополнительный абзац перед текстом подписаться
  return `${topLines.join('\n')}\n\n${subscribeLine}`;
}

/**
 * Helper to build the combined Rich text according to Requirement 8 (respecting Telegram's 50-media Rich limit):
 * 1. Обложка и медиа-конструктор подборки (![](imageUrl) или слайдер)
 * 2. Главный заголовок Rich-поста (# headerTitle)
 * 3. Подзаголовок / вводная часть (headerSubtitle)
 * 4. Блоки каналов-участников (до 50 каналов, всего <= 50 медиавложений)
 */
export function buildUnifiedSelectionRichText(params: {
  imageUrl?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  channels: SelectionParticipantItem[];
}): string {
  const parts: string[] = [];
  let remainingMediaBudget = 50;

  const cleanImg = (params.imageUrl || '').trim();
  if (cleanImg) {
    parts.push(`![](${cleanImg})`);
    remainingMediaBudget = Math.max(0, remainingMediaBudget - 1);
  }

  const cleanTitle = (params.headerTitle || '').trim();
  if (cleanTitle) {
    parts.push(`# ${cleanTitle}`);
  }

  const cleanSubtitle = (params.headerSubtitle || '').trim();
  if (cleanSubtitle) {
    parts.push(cleanSubtitle);
  }

  if (params.channels && params.channels.length > 0) {
    const channelBlocks = params.channels
      .filter(c => c.status !== 'declined' && c.status !== 'left')
      .slice(0, 50)
      .map(c => {
        const hasAvatar = Boolean((c.channel_avatar_url || '').trim());
        const canIncludeAvatar = hasAvatar && remainingMediaBudget > 0;
        if (canIncludeAvatar) {
          remainingMediaBudget--;
        }
        return formatSelectionChannelMarkdown(c, canIncludeAvatar);
      })
      .filter(Boolean);

    if (channelBlocks.length > 0) {
      parts.push(channelBlocks.join('\n\n'));
    }
  }

  return parts.join('\n\n');
}

export const SelectionEditorModal: React.FC<SelectionEditorModalProps> = ({
  isOpen,
  onClose,
  selection,
  currentUser,
  onSaved,
  onBalanceUpdated
}) => {
  const { pricing } = usePricingConfig(currentUser?.id);
  const promoImgCost = pricing.promoAndFolders.promoAiImage;
  const promoTextCost = pricing.promoAndFolders.promoAiText;
  const isEdit = Boolean(selection && selection.id);

  // Core fields
  const [title, setTitle] = useState<string>(selection?.title || '');
  const [headerTitle, setHeaderTitle] = useState<string>(
    selection?.header_title || selection?.headerTitle || 'Подборка авторских каналов'
  );
  const [headerSubtitle, setHeaderSubtitle] = useState<string>(
    selection?.header_subtitle || selection?.headerSubtitle || ''
  );
  const [categories, setCategories] = useState<string[]>(() => {
    let parsed: string[] = [];
    if (selection?.categories) {
      if (Array.isArray(selection.categories)) parsed = selection.categories;
      else {
        try { parsed = JSON.parse(selection.categories); } catch (e) {}
      }
    }
    return parsed.length > 0 ? parsed : ['Бизнес и стартапы'];
  });
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Image & Media
  const [imageUrl, setImageUrl] = useState<string>(selection?.image_url || selection?.imageUrl || '');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isChannelGalleryOpen, setIsChannelGalleryOpen] = useState(false);
  const [isLoadingChannelAvatar, setIsLoadingChannelAvatar] = useState(false);

  // Rich Media Constructor Modal state (Photo, Slideshow, Collage)
  const [mediaModalState, setMediaModalState] = useState<{
    isOpen: boolean;
    type: 'photo' | 'slideshow' | 'collage';
    target: 'cover' | 'channel' | 'text';
  }>({
    isOpen: false,
    type: 'photo',
    target: 'text'
  });

  // Post Text & Format (strictly Rich as per requirement 4 & 8)
  const [postText, setPostText] = useState<string>(selection?.post_text || selection?.postText || '');
  const [isEnhancingText, setIsEnhancingText] = useState(false);

  // Inline Buttons
  const [inlineButtons, setInlineButtons] = useState<InlineButton[][]>(() =>
    normalizeToRows(selection?.inline_buttons || selection?.inlineButtons)
  );

  // Participant channels list (Requirement 4 & 5)
  const [participants, setParticipants] = useState<SelectionParticipantItem[]>(() => {
    if (selection?.channels && Array.isArray(selection.channels)) {
      return selection.channels.map((c: any) => ({
        id: c.id || `chan_${Date.now()}_${Math.random()}`,
        channel_id: c.channel_id,
        channel_name: c.channel_name || c.name || 'Канал',
        channel_username: c.channel_username || c.username || '',
        channel_avatar_url: c.channel_avatar_url || c.avatar_url || c.photoUrl || '',
        promo_text: c.promo_text || c.bio || '',
        subscribers_count: c.subscribers_initial || c.subscribers_count || 0,
        status: c.status || 'active'
      }));
    }
    return [];
  });

  // Channel edit sub-modal state (inside selection editor)
  const [editingChannel, setEditingChannel] = useState<SelectionParticipantItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNewChannel, setIsAddingNewChannel] = useState(false);

  // Selection Conditions & Schedule
  const [minSubscribers, setMinSubscribers] = useState<number>(
    Number(selection?.min_subscribers ?? selection?.minSubscribers ?? 0)
  );
  const [maxParticipants, setMaxParticipants] = useState<number>(
    Math.min(50, Math.max(2, Number(selection?.max_participants ?? selection?.maxParticipants ?? 10)))
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (selection?.scheduled_at || selection?.scheduledAt) {
      return toMskInputString(selection.scheduled_at || selection.scheduledAt);
    }
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 2);
    defaultDate.setHours(18, 0, 0, 0);
    return toMskInputString(defaultDate);
  });
  const [rules, setRules] = useState<string>(
    selection?.rules || '24 часа в ленте, 2 часа в топе без перекрытия'
  );

  // UI state
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [imageBuilderTarget, setImageBuilderTarget] = useState<'cover' | 'channel' | null>(null);

  // Requirement 5: Fetch fresh selection channels from DB when opening existing selection
  useEffect(() => {
    if (isOpen && selection?.id) {
      fetch(`/api/promo-selections/${selection.id}`)
        .then(res => res.json())
        .then(async data => {
          if (data.success && data.selection) {
            const sel = data.selection;
            if (sel.channels && Array.isArray(sel.channels)) {
              const mapped: SelectionParticipantItem[] = sel.channels.map((c: any) => ({
                id: c.id || `chan_${Date.now()}_${Math.random()}`,
                channel_id: c.channel_id,
                channel_name: c.channel_name || c.name || 'Канал',
                channel_username: c.channel_username || c.username || '',
                channel_avatar_url: c.channel_avatar_url || c.avatar_url || c.photoUrl || '',
                promo_text: c.promo_text || c.bio || '',
                subscribers_count: c.subscribers_initial || c.subscribers_count || 0,
                status: c.status || 'active'
              }));

              // Automatically resolve and upload any channel avatars to the permanent ProTalk gallery
              const resolved = await Promise.all(mapped.map(async (c) => {
                const curAvatar = (c.channel_avatar_url || '').trim();
                const cleanU = (c.channel_username || c.channel_name || '').replace(/^@/, '');
                if (cleanU && (!curAvatar.startsWith('https://file.pro-talk.ru/tgf/') || curAvatar.includes('/channel-avatar/'))) {
                  try {
                    const r = await fetch(`/api/channel-avatar-url/${encodeURIComponent(cleanU)}?fallback=${encodeURIComponent(curAvatar)}`);
                    const d = await r.json();
                    if (d.url && d.url.startsWith('https://file.pro-talk.ru/tgf/')) {
                      return { ...c, channel_avatar_url: d.url };
                    }
                  } catch (e) {}
                }
                return c;
              }));

              setParticipants(resolved);

              // Requirement 8: If postText is empty or default, pre-populate unified text,
              // and replace any legacy /channel-avatar/ URLs with canonical ProTalk gallery URLs
              setPostText(prev => {
                let updated = prev;
                resolved.forEach(rc => {
                  const cleanU = rc.channel_username?.replace(/^@/, '');
                  if (cleanU && rc.channel_avatar_url) {
                    updated = updated.replace(
                      new RegExp(`!\\[\\]\\([^\\)]*channel-avatar\\/${cleanU}[^\\)]*\\)`, 'g'),
                      `![](${rc.channel_avatar_url})`
                    );
                  }
                });

                if (!updated || !updated.trim()) {
                  return buildUnifiedSelectionRichText({
                    imageUrl: sel.image_url || imageUrl,
                    headerTitle: sel.header_title || headerTitle,
                    headerSubtitle: sel.header_subtitle || headerSubtitle,
                    channels: resolved
                  });
                }
                return updated;
              });
            }
          }
        })
        .catch(err => console.error('[SelectionEditorModal] Error fetching channels from DB:', err));
    }
  }, [isOpen, selection?.id]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mediaModalState.isOpen && !isGalleryOpen && !editingChannel) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, mediaModalState.isOpen, isGalleryOpen, editingChannel, onClose]);

  if (!isOpen) return null;

  // Media Insertion handler (Requirement 4: also inserts into postText)
  const handleApplyMediaBlock = (generatedCode: string) => {
    if (mediaModalState.target === 'cover') {
      const match = generatedCode.match(/\((.*?)\)/);
      if (match && match[1]) {
        setImageUrl(match[1]);
      }
      // Insert into Rich text too
      setPostText(prev => prev ? `${generatedCode}\n\n${prev}` : generatedCode);
    } else if (mediaModalState.target === 'channel' && editingChannel) {
      const match = generatedCode.match(/\((.*?)\)/);
      const url = match && match[1] ? match[1] : generatedCode;
      setEditingChannel({ ...editingChannel, channel_avatar_url: url });
    } else {
      setPostText(prev => prev ? `${prev}\n\n${generatedCode}` : generatedCode);
    }
    setMediaModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Toggle category
  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      if (categories.length > 1) {
        setCategories(categories.filter(c => c !== cat));
      }
    } else {
      setCategories([...categories, cat]);
    }
  };

  // Image Upload handler (Requirement 4: sets cover and inserts into postText)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', String(currentUser?.id || currentUser?.telegramId || '16926299042'));

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Ошибка загрузки файла');
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
        // Requirement 4: insert cover image into Rich text
        setPostText(prev => {
          const md = `![](${data.url})`;
          if (prev.includes(data.url)) return prev;
          return prev ? `${md}\n\n${prev}` : md;
        });
        setFeedbackMessage({ type: 'success', text: 'Обложка подборки загружена и добавлена в текст Rich-поста!' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка загрузки фото' });
    }
  };

  // AI Image generation (Requirement 4: sets cover and inserts into postText)
  const handleGenerateAiImage = async () => {
    const userBalance = Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0);
    if (userBalance < promoImgCost) {
      setFeedbackMessage({
        type: 'error',
        text: `Недостаточно ИИрок для генерации обложки! Требуется ${formatIirkyCount(promoImgCost)}, ваш баланс: ${userBalance}.`
      });
      return;
    }

    setIsGeneratingImage(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || '16926299042',
          title: headerTitle || title || 'Подборка каналов',
          category: categories[0] || 'Бизнес'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации картинки');
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setPostText(prev => {
          const md = `![](${data.imageUrl})`;
          if (prev.includes(data.imageUrl)) return prev;
          return prev ? `${md}\n\n${prev}` : md;
        });
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : promoImgCost;
        setFeedbackMessage({
          type: 'success',
          text: `Обложка создана и вставлена в текст Rich-поста (${charged === 0 ? 'бесплатно' : `списано ${formatIirkyCount(charged)}`})!`
        });
        onBalanceUpdated?.(Math.max(0, userBalance - charged));
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка при вызове ИИ генератора' });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // AI Text Enhancement
  const handleEnhanceText = async () => {
    const userBalance = Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0);
    if (userBalance < promoTextCost) {
      setFeedbackMessage({
        type: 'error',
        text: `Недостаточно ИИрок для улучшения текста! Требуется ${formatIirkyCount(promoTextCost)}, ваш баланс: ${userBalance}.`
      });
      return;
    }

    setIsEnhancingText(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || '16926299042',
          type: 'selection_enhance',
          title: headerTitle || title || 'Подборка каналов',
          category: categories.join(', '),
          text: postText || headerSubtitle,
          format: 'rich'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка улучшения текста');
      if (data.text) {
        setPostText(data.text);
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : promoTextCost;
        setFeedbackMessage({
          type: 'success',
          text: `Текст подборки улучшен ИИ (${charged === 0 ? 'бесплатно' : `списано ${formatIirkyCount(charged)}`})!`
        });
        onBalanceUpdated?.(Math.max(0, userBalance - charged));
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка улучшения текста' });
    } finally {
      setIsEnhancingText(false);
    }
  };

  // Requirement 5 & 8: Insert single channel block into postText
  const handleInsertChannelBlockToText = (channel: SelectionParticipantItem) => {
    const formatted = formatSelectionChannelMarkdown(channel);
    setPostText(prev => prev ? `${prev}\n\n${formatted}` : formatted);
    setFeedbackMessage({
      type: 'success',
      text: `Блок канала «${channel.channel_name}» добавлен в текст подборки!`
    });
  };

  // Requirement 4, 5 & 8: Assemble full Rich post from cover, header, subtitle, and all participant blocks
  const handleAssembleFullPost = () => {
    const cappedCount = Math.min(50, participants.length);
    const assembled = buildUnifiedSelectionRichText({
      imageUrl,
      headerTitle,
      headerSubtitle,
      channels: participants
    });
    setPostText(assembled);
    setFeedbackMessage({
      type: participants.length > 50 ? 'info' : 'success',
      text:
        participants.length > 50
          ? `Текст собран для первых 50 из ${participants.length} каналов (лимит Telegram Rich — 50 вложений).`
          : `Текст подборки успешно собран: обложка, заголовок, подзаголовок и ${cappedCount} каналов!`
    });
  };

  // Open participant editor
  const handleOpenEditParticipant = (channel: SelectionParticipantItem, index: number) => {
    setEditingChannel({ ...channel });
    setEditingIndex(index);
    setIsAddingNewChannel(false);
  };

  const handleOpenAddNewParticipant = () => {
    if (participants.length >= 50) {
      setFeedbackMessage({
        type: 'error',
        text: 'Достигнут максимум 50 каналов в подборке (ограничение Telegram Rich: до 50 вложений в посте).'
      });
      return;
    }
    setEditingChannel({
      id: `chan_${Date.now()}_${Math.random()}`,
      channel_name: '',
      channel_username: '',
      channel_avatar_url: '',
      promo_text: '',
      subscribers_count: 0,
      status: 'active'
    });
    setEditingIndex(null);
    setIsAddingNewChannel(true);
  };

  // Fetch channel avatar from Telegram and upload to ProTalk gallery
  const handleFetchChannelAvatarFromTelegram = async (usernameOverride?: string) => {
    const rawU = usernameOverride || editingChannel?.channel_username || '';
    const cleanU = rawU.replace(/^@/, '').trim();
    if (!cleanU) {
      setFeedbackMessage({ type: 'error', text: 'Сначала укажите юзернейм канала' });
      return;
    }
    setIsLoadingChannelAvatar(true);
    try {
      const res = await fetch(`/api/channel-avatar-url/${encodeURIComponent(cleanU)}`);
      const data = await res.json();
      if (data.url && data.url.startsWith('https://file.pro-talk.ru/tgf/')) {
        if (editingChannel) {
          setEditingChannel(prev => prev ? { ...prev, channel_avatar_url: data.url } : null);
        }
        setFeedbackMessage({ type: 'success', text: 'Аватар канала успешно синхронизирован в галерею!' });
      } else {
        setFeedbackMessage({ type: 'info', text: 'У канала нет открытого фото в Telegram или канал приватный' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка загрузки аватара' });
    } finally {
      setIsLoadingChannelAvatar(false);
    }
  };

  // Requirement 8: When saving a channel participant, update participants and append to postText if not already there
  const handleSaveParticipant = async () => {
    if (!editingChannel) return;
    if (!editingChannel.channel_name.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Укажите название канала' });
      return;
    }
    if (editingChannel.promo_text.length > 200) {
      setFeedbackMessage({ type: 'error', text: 'Описание канала не должно превышать 200 символов' });
      return;
    }

    let channelToSave = { ...editingChannel };
    const curAvatar = (channelToSave.channel_avatar_url || '').trim();
    const cleanU = (channelToSave.channel_username || channelToSave.channel_name || '').replace(/^@/, '');
    if (cleanU && (!curAvatar.startsWith('https://file.pro-talk.ru/tgf/') || curAvatar.includes('/channel-avatar/'))) {
      try {
        const r = await fetch(`/api/channel-avatar-url/${encodeURIComponent(cleanU)}?fallback=${encodeURIComponent(curAvatar)}`);
        const d = await r.json();
        if (d.url && d.url.startsWith('https://file.pro-talk.ru/tgf/')) {
          channelToSave.channel_avatar_url = d.url;
        }
      } catch (e) {}
    }

    let updatedList: SelectionParticipantItem[] = [];
    if (isAddingNewChannel) {
      updatedList = [...participants, channelToSave];
      setParticipants(updatedList);
      setFeedbackMessage({ type: 'success', text: `Канал «${channelToSave.channel_name}» добавлен в список участников!` });
    } else if (editingIndex !== null) {
      updatedList = [...participants];
      updatedList[editingIndex] = channelToSave;
      setParticipants(updatedList);
      setFeedbackMessage({ type: 'success', text: `Канал «${channelToSave.channel_name}» успешно обновлен!` });
    }

    // Auto-update or assemble unified post text
    setPostText(prev => {
      const channelMd = formatSelectionChannelMarkdown(channelToSave);
      if (!prev || !prev.trim()) {
        return buildUnifiedSelectionRichText({
          imageUrl,
          headerTitle,
          headerSubtitle,
          channels: updatedList
        });
      }
      if (!prev.includes(channelToSave.channel_name)) {
        return `${prev}\n\n${channelMd}`;
      }
      const escapedName = channelToSave.channel_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`##\\s*\\[${escapedName}\\]\\([^\\)]*\\)[\\s\\S]*?(?=(?:##\\s*\\[|$))`, 'i');
      if (regex.test(prev)) {
        return prev.replace(regex, channelMd + '\n\n').trim();
      }
      return prev;
    });

    setEditingChannel(null);
    setEditingIndex(null);
    setIsAddingNewChannel(false);
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
    setFeedbackMessage({ type: 'info', text: 'Канал удален из списка участников подборки' });
  };

  // Test sending directly to Telegram PM
  const handleSendTestToSelf = async () => {
    const tgId = currentUser?.telegram_id || currentUser?.telegramId || '169262990';

    setIsSendingTest(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo-selections/test-send-pm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          selectionId: selection?.id,
          title: title || 'Подборка',
          headerTitle: headerTitle || title || 'Подборка каналов',
          headerSubtitle,
          postText,
          imageUrl,
          inlineButtons,
          rules,
          messageFormat: 'rich'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки теста');
      setFeedbackMessage({
        type: 'success',
        text: 'Тестовый Rich-пост подборки успешно отправлен вам в Telegram!'
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка отправки теста в Telegram' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Submit Save/Create Selection
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, укажите название подборки' });
      return;
    }
    if (!headerTitle.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, заполните главный заголовок Rich-поста' });
      return;
    }
    if (!scheduledAt) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, выберите дату и время публикации' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    // If postText is empty, build unified text before saving
    const effectivePostText = postText && postText.trim()
      ? postText
      : buildUnifiedSelectionRichText({
          imageUrl,
          headerTitle,
          headerSubtitle,
          channels: participants
        });

    const payload = {
      authorId: currentUser?.id || '16926299042',
      authorTelegramId: currentUser?.telegram_id || currentUser?.telegramId || '169262990',
      authorUsername: currentUser?.username || '',
      authorName: currentUser?.name || 'Организатор',
      title: cleanTitle,
      categories,
      minSubscribers: Number(minSubscribers) || 0,
      maxParticipants: Number(maxParticipants) || 10,
      scheduledAt: fromMskInputString(scheduledAt),
      headerTitle: headerTitle.trim(),
      headerSubtitle: headerSubtitle.trim(),
      rules: rules.trim(),
      imageUrl,
      postText: effectivePostText,
      messageFormat: 'rich',
      inlineButtons,
      channels: participants,
      status: 'confirmed'
    };

    try {
      const endpoint = isEdit ? `/api/promo-selections/${selection.id}` : '/api/promo-selections';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения подборки');

      setFeedbackMessage({
        type: 'success',
        text: isEdit ? 'Подборка успешно обновлена!' : 'Подборка успешно создана и открыта для набора каналов!'
      });
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка сохранения подборки' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
      {/* Modal Container: Light transparent gradient, no darkening */}
      <div 
        className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300/80 shadow-2xl overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-pink-200/80 flex items-center justify-between gap-3 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent truncate">
                {isEdit ? `Редактирование подборки: ${selection?.title || ''}` : 'Конструктор подборки Rich с аватарами каналов'}
              </h2>
              <p className="text-[14px] text-slate-600 truncate">
                Настройка Rich-поста, аватаров участников, инлайн-кнопок и графика
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switch */}
            <div className="flex rounded-2xl bg-white/80 p-1 border border-pink-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Конструктор
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Предпросмотр</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/80 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedbackMessage && (
          <div
            className={`px-4 py-2.5 text-[14px] font-semibold flex items-center justify-between gap-2 border-b transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-sky-50/90 text-sky-900 border-sky-200'
                : feedbackMessage.type === 'error'
                ? 'bg-rose-50/90 text-rose-900 border-rose-200'
                : 'bg-orange-50/90 text-orange-900 border-orange-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
              <span className="truncate">{feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'editor' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* SECTION 1: TITLE & CATEGORY */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-4 shadow-2xs relative z-30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1.5">
                      Название подборки *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Например: Эксперты бизнеса и маркетинга"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px] focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1.5">
                      Главный заголовок Rich-поста *
                    </label>
                    <input
                      type="text"
                      required
                      value={headerTitle}
                      onChange={(e) => setHeaderTitle(e.target.value)}
                      placeholder="Например: 🌟 Топ-каналы для предпринимателей"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px] focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                </div>

                {/* Subtitle / Intro as full Rich editor & Categories */}
                <div className="space-y-4">
                  {/* Requirement 2: Full Rich editor for Subtitle / Intro */}
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-pink-200/80 space-y-2">
                    <TelegramPostTextEditor
                      text={headerSubtitle}
                      onChange={setHeaderSubtitle}
                      formatMode="rich"
                      onFormatModeChange={() => {}}
                      showModeSwitch={false}
                      label="Подзаголовок / вводная часть (полноценный Rich-редактор)"
                      placeholder="Вводный абзац перед списком каналов: ключевые преимущества, призыв подписаться, ссылки..."
                      minRows={3}
                    />
                  </div>

                  {/* Requirement 3: Categories Module exactly like in Folder editor (with selected badges and multi-select dropdown) */}
                  <div className="relative z-40">
                    <label className="text-[14px] font-bold text-slate-800 block mb-1.5">
                      Тематические категории подборки (мультивыбор как в папках)
                    </label>
                    
                    {/* Selected category badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-3 py-1 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <span>{cat}</span>
                          {categories.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleCategory(cat)}
                              className="text-white/80 hover:text-white cursor-pointer"
                              title="Удалить категорию"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Dropdown toggle button */}
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full bg-white/90 border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-800 font-medium flex items-center justify-between shadow-2xs cursor-pointer hover:border-pink-300"
                    >
                      <span>Выбрать категории из списка ({categories.length} выбрано)</span>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isCategoryDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-pink-300 shadow-2xl z-50 max-h-56 overflow-y-auto space-y-1">
                        {PROMO_CATEGORIES.map((cat) => {
                          const isSelected = categories.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => toggleCategory(cat)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-[14px] font-bold flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-r from-sky-400/20 via-pink-500/20 to-orange-400/20 text-slate-900 border border-pink-300'
                                  : 'text-slate-700 hover:bg-pink-50/60'
                              }`}
                            >
                              <span>{cat}</span>
                              {isSelected && <Check className="w-4 h-4 text-pink-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: MEDIA CONSTRUCTOR (Requirement 4: Inserts into postText) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-4 shadow-2xs relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-200/70 pb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-pink-600" />
                    <span className="text-[14px] font-bold text-slate-900">
                      Обложка и медиа-конструктор подборки (автоматически вставляются в Rich-пост)
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-pink-800 bg-white/80 px-2.5 py-0.5 rounded-xl border border-pink-200">
                    Формат: Rich Markdown
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Upload photo */}
                  <label className="px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all">
                    <Upload className="w-4 h-4 text-pink-600" />
                    <span>Загрузить фото</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>

                  {/* From Gallery */}
                  <button
                    type="button"
                    onClick={() => setIsGalleryOpen(true)}
                    className="px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all"
                  >
                    <ImageIcon className="w-4 h-4 text-pink-600" />
                    <span>Из галереи</span>
                  </button>

                  {/* AI Generation Constructor */}
                  <button
                    type="button"
                    onClick={() => setImageBuilderTarget('cover')}
                    className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Генерация картинки</span>
                  </button>

                  {/* Rich Insert Buttons */}
                  <button
                    type="button"
                    onClick={() => setMediaModalState({ isOpen: true, type: 'photo', target: 'text' })}
                    className="px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all"
                    title="Вставить изображение ![](url) в текст"
                  >
                    <ImageIcon className="w-4 h-4 text-sky-600" />
                    <span>+ Картинка</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaModalState({ isOpen: true, type: 'slideshow', target: 'text' })}
                    className="px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all"
                    title="Вставить карусель/слайдер <tg-slideshow> в текст"
                  >
                    <ImageIcon className="w-4 h-4 text-orange-600" />
                    <span>+ Карусель</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaModalState({ isOpen: true, type: 'collage', target: 'text' })}
                    className="px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all"
                    title="Вставить сетку фото <tg-collage> в текст"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>+ Коллаж</span>
                  </button>
                </div>

                {/* Cover Image Preview */}
                {imageUrl && (
                  <div className="mt-2 p-2 rounded-2xl bg-white/80 border border-pink-200/80 relative inline-block">
                    <img
                      src={imageUrl}
                      alt="Обложка подборки"
                      className="max-h-56 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs cursor-pointer"
                      title="Удалить обложку"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: PARTICIPANTS LIST EDITOR (Requirement 4, 5 & 8) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-200/70 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-pink-600" />
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900 leading-tight">
                        Редактор списка каналов-участников ({participants.length})
                      </h3>
                      <p className="text-[14px] text-slate-600 mt-0.5">
                        Каналы из базы данных: аватар, описание и кнопка подписки
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAddNewParticipant}
                      className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Добавить канал</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAssembleFullPost}
                      className="px-3.5 py-1.5 rounded-2xl bg-white/90 border border-sky-300 text-sky-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:bg-white transition-all"
                      title="Собрать весь пост: обложка, заголовок, подзаголовок и каналы"
                    >
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>Собрать весь пост</span>
                    </button>
                  </div>
                </div>

                {/* Participant Blocks */}
                {participants.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-white/70 border border-pink-200/80 space-y-2">
                    <Users className="w-10 h-10 mx-auto text-pink-400" />
                    <p className="text-[14px] font-bold text-slate-800">
                      В этой подборке пока нет вступивших каналов в базе данных
                    </p>
                    <p className="text-[14px] text-slate-600 max-w-md mx-auto">
                      Нажмите «Добавить канал» выше или используйте кнопку вступления в карточке подборки
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participants.map((chan, idx) => {
                      const directUrl = chan.channel_username
                        ? `https://t.me/${chan.channel_username.replace(/^@/, '')}`
                        : '';
                      return (
                        <div
                          key={chan.id || idx}
                          className="p-3.5 rounded-2xl bg-white/85 border border-pink-200/90 shadow-2xs flex flex-col md:flex-row md:items-start justify-between gap-3.5"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            {chan.channel_avatar_url ? (
                              <img
                                src={chan.channel_avatar_url}
                                alt=""
                                className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-pink-200 shadow-2xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0 border border-pink-200">
                                {chan.channel_name?.slice(0, 2) || '📢'}
                              </div>
                            )}

                            {/* Info */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-[14px] text-slate-900 truncate">
                                  {idx + 1}. {chan.channel_name}
                                </span>
                                {chan.channel_username && (
                                  <a
                                    href={directUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[14px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1"
                                  >
                                    <span>@{chan.channel_username.replace(/^@/, '')}</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[14px] font-bold">
                                  Одобрен ИИ
                                </span>
                              </div>

                              <p className="text-[14px] text-slate-700 leading-relaxed break-words italic">
                                {chan.promo_text ? `«${chan.promo_text}»` : 'Описание отсутствует'}
                              </p>

                              {/* Standard Markdown Block Snippet */}
                              <div className="p-2 rounded-xl bg-orange-50/60 border border-orange-200/70 text-[14px] font-mono text-slate-700 space-y-0.5 mt-1 overflow-x-auto">
                                <div>## [{chan.channel_name}]({directUrl || 'https://t.me/'})</div>
                                <div>![]({chan.channel_avatar_url || 'https://...'})</div>
                                <div>&lt;i&gt;{chan.promo_text || 'описание'}&lt;/i&gt;</div>
                                <div className="h-2" />
                                <div>&lt;tg-button-row align=&quot;center&quot;&gt;&lt;tg-button type=&quot;url&quot; style=&quot;primary&quot; url=&quot;{directUrl || 'https://t.me/'}&quot;&gt;✅ Подписаться на канал&lt;/tg-button&gt;&lt;/tg-button-row&gt;</div>
                              </div>
                            </div>
                          </div>

                          {/* Channel Action Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-start pt-2 md:pt-0 border-t md:border-t-0 border-pink-100 w-full md:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleInsertChannelBlockToText(chan)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 text-[14px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                              title="Вставить этот блок в текст Rich-поста"
                            >
                              <FileText className="w-3.5 h-3.5 text-sky-600" />
                              <span>Вставить блок</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditParticipant(chan, idx)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-pink-300 text-slate-800 hover:bg-pink-50 text-[14px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                              title="Редактировать описание и аватар канала"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-pink-600" />
                              <span>Изменить</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(idx)}
                              className="p-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[14px] cursor-pointer shadow-2xs"
                              title="Удалить канал из подборки"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 4: TEXT EDITOR (Strictly Rich mode, showModeSwitch=false, Requirement 8) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-3 shadow-2xs">
                <TelegramPostTextEditor
                  text={postText}
                  onChange={setPostText}
                  formatMode="rich"
                  onFormatModeChange={() => {}}
                  showModeSwitch={false}
                  label="Основной текст подборки (Rich markdown)"
                  placeholder="Вставьте блоки участников подборки, введение и призыв к подписке..."
                  minRows={8}
                  onAIEnhance={handleEnhanceText}
                  isEnhancing={isEnhancingText}
                />
              </div>

              {/* SECTION 5: INLINE BUTTONS BUILDER */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-3 shadow-2xs">
                <InlineButtonsBuilder
                  buttons={inlineButtons}
                  onChange={setInlineButtons}
                  label="Инлайн-кнопки подборки (ряды и строки)"
                />
              </div>

              {/* SECTION 6: CONDITIONS & SCHEDULING */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-pink-200/70 pb-2">
                  <Calendar className="w-4 h-4 text-pink-600" />
                  <span className="text-[14px] font-bold text-slate-900">
                    Условия участия и график публикации
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Мин. подписчиков
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minSubscribers}
                      onChange={(e) => setMinSubscribers(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px]"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Макс. участников (до 50 каналов)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="50"
                      value={maxParticipants}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        setMaxParticipants(Number.isFinite(raw) ? Math.min(50, Math.max(2, raw)) : 10);
                      }}
                      className="w-full px-3 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px]"
                    />
                    <span className="block mt-1 text-[14px] text-slate-600">
                      Лимит Telegram Rich: до 50 вложений в посте
                    </span>
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Дата и время публикации *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[14px] font-bold text-slate-800 block mb-1">
                    Правила размещения в каналах-участниках
                  </label>
                  <input
                    type="text"
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder="Например: 24 часа в ленте, 2 часа в топе без перекрытия"
                    className="w-full px-3.5 py-2 rounded-2xl bg-white/90 border border-pink-200 text-slate-900 font-medium text-[14px]"
                  />
                </div>
              </div>

              {/* ACTION BUTTONS (Test Send + Save) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendTestToSelf}
                  disabled={isSendingTest}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center justify-center gap-2 shadow-2xs hover:bg-white transition-all disabled:opacity-50"
                  title="Отправить готовый Rich-пост подборки прямо в личные сообщения Telegram для проверки"
                >
                  {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin text-pink-600" /> : <Send className="w-4 h-4 text-pink-600" />}
                  <span>Тестовая отправка в личные сообщения Telegram</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-2xl bg-white/90 border border-pink-200 text-slate-700 font-bold text-[14px] hover:bg-white cursor-pointer transition-all"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 hover:opacity-95 text-white font-black text-[14px] shadow-md cursor-pointer transition-all disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>{isEdit ? 'Сохранить изменения' : 'Опубликовать подборку'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* PREVIEW TAB (Requirement 9: Full Rich layout matching folder preview) */
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-400/15 via-pink-400/15 via-orange-400/15 via-pink-400/15 to-sky-400/15 backdrop-blur-md border border-pink-200/80 space-y-3">
                <div className="text-[14px] text-slate-800 font-bold">
                  Живой предварительный просмотр Rich-поста подборки в Telegram:
                </div>
                <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-pink-200 shadow-inner space-y-4">
                  {/* Media Cover if not already in post text */}
                  {imageUrl && !postText.includes(imageUrl) && !postText.includes(normalizeProTalkMediaUrl(imageUrl)) && (
                    <div className="w-full flex justify-center bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 rounded-2xl overflow-hidden p-1 border border-pink-100">
                      <CachedMediaImage src={imageUrl} alt="Обложка подборки" className="max-h-80 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs" />
                    </div>
                  )}

                  {/* Header title */}
                  <h3 className="text-lg font-black text-slate-900">
                    {headerTitle || title || 'Подборка каналов'}
                  </h3>

                  {/* Header Subtitle */}
                  {headerSubtitle && !postText.includes(headerSubtitle) && (
                    <div className="text-[14px] text-slate-700 font-medium">
                      <RichPreviewRenderer
                        postText={headerSubtitle}
                        hideEmptyPlaceholder
                      />
                    </div>
                  )}

                  {/* Rich Post Text */}
                  <div className="prose prose-sm max-w-none text-slate-800">
                    <RichPreviewRenderer
                      postText={postText || 'Текст описания подборки появится здесь...'}
                    />
                  </div>

                  {/* Inline Buttons rendered row-by-row */}
                  {inlineButtons && inlineButtons.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-pink-100">
                      <span className="text-[14px] font-extrabold text-slate-700 block">
                        Инлайн-кнопки под постом:
                      </span>
                      {inlineButtons.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          className="grid gap-1.5"
                          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                        >
                          {row.map((btn, bIdx) => {
                            const colorKey = (btn as any).color || (btn.style === 'danger' ? 'danger' : btn.style === 'primary' ? 'primary' : 'gradient');
                            const colorClasses = getInlineButtonStyleClasses(btn.style, colorKey);
                            const isWebApp = btn.type === 'webapp';
                            const isUrl = btn.type === 'url' || (!btn.type && Boolean(btn.url));

                            return (
                              <a
                                key={btn.id || bIdx}
                                href={btn.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`px-3 py-2 rounded-xl text-[14px] font-bold text-center truncate cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs ${colorClasses}`}
                              >
                                {isWebApp && <span className="text-[14px] font-bold shrink-0">⊞</span>}
                                <span className="truncate">{btn.text || 'Кнопка'}</span>
                                {isUrl && !isWebApp && <span className="text-[14px] font-bold shrink-0">↗</span>}
                              </a>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUB-MODAL: EDIT OR ADD PARTICIPANT CHANNEL (Requirement 7: No darkening, light transparent backdrop) */}
      {editingChannel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-pink-200">
              <h3 className="text-base font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                {isAddingNewChannel ? 'Добавить канал в подборку' : `Редактирование канала «${editingChannel.channel_name}»`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingChannel(null);
                  setEditingIndex(null);
                  setIsAddingNewChannel(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-[14px]">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">
                  Название канала *
                </label>
                <input
                  type="text"
                  value={editingChannel.channel_name}
                  onChange={(e) => setEditingChannel({ ...editingChannel, channel_name: e.target.value })}
                  placeholder="Например: Бизнес инсайты"
                  className="w-full px-3.5 py-2 bg-white rounded-xl border border-pink-200 text-slate-900 font-medium text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">
                  Юзернейм канала (без @)
                </label>
                <input
                  type="text"
                  value={editingChannel.channel_username}
                  onChange={(e) => setEditingChannel({ ...editingChannel, channel_username: e.target.value.replace(/^@/, '') })}
                  onBlur={() => {
                    if (editingChannel.channel_username && !editingChannel.channel_avatar_url) {
                      handleFetchChannelAvatarFromTelegram(editingChannel.channel_username);
                    }
                  }}
                  placeholder="channel_username"
                  className="w-full px-3.5 py-2 bg-white rounded-xl border border-pink-200 text-slate-900 font-medium text-[14px]"
                />
              </div>

              {/* Avatar Picture with custom replace or slideshow constructor */}
              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <label className="text-[14px] font-bold text-slate-800">
                    Аватар / картинка канала
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={isLoadingChannelAvatar}
                      onClick={() => handleFetchChannelAvatarFromTelegram()}
                      className="text-[14px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingChannelAvatar ? 'Синхронизация...' : 'Загрузить из Telegram'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setIsChannelGalleryOpen(true)}
                      className="text-[14px] font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                    >
                      Из галереи
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setMediaModalState({ isOpen: true, type: 'slideshow', target: 'channel' })}
                      className="text-[14px] font-bold text-orange-600 hover:text-orange-800 cursor-pointer"
                    >
                      + Слайдер
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setImageBuilderTarget('channel')}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs hover:opacity-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Генерация картинки</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingChannel.channel_avatar_url}
                    onChange={(e) => setEditingChannel({ ...editingChannel, channel_avatar_url: e.target.value })}
                    placeholder="URL картинки аватара"
                    className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-pink-200 text-slate-900 text-[14px]"
                  />
                  {editingChannel.channel_avatar_url && (
                    <CachedMediaImage
                      src={editingChannel.channel_avatar_url}
                      alt={editingChannel.channel_name || 'Аватар канала'}
                      className="w-10 h-10 rounded-xl object-cover border border-pink-200 shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* Promo Text with limit 200 chars and MiniAudioField */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[14px] font-bold text-slate-800">
                    Описание канала (до 200 символов)
                  </label>
                  <MiniAudioField
                    currentValue={editingChannel.promo_text}
                    onTranscript={(text) => {
                      setEditingChannel({ ...editingChannel, promo_text: text.slice(0, 200) });
                    }}
                    size="sm"
                    buttonText="Голос"
                  />
                </div>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={editingChannel.promo_text}
                  onChange={(e) => setEditingChannel({ ...editingChannel, promo_text: e.target.value })}
                  placeholder="Краткое емкое описание преимуществ канала..."
                  className="w-full p-3 bg-white rounded-2xl border border-pink-200 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <div className="flex justify-end text-[14px] text-slate-500 mt-0.5">
                  <span className={editingChannel.promo_text.length > 190 ? 'text-orange-600 font-bold' : ''}>
                    {editingChannel.promo_text.length} / 200
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-pink-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingChannel(null);
                    setEditingIndex(null);
                    setIsAddingNewChannel(false);
                  }}
                  className="px-4 py-2 rounded-2xl bg-white border border-pink-200 text-slate-700 font-bold text-[14px] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticipant}
                  className="px-5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-xs cursor-pointer hover:opacity-95"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: GALLERY SELECT MODAL */}
      <GallerySelectModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
        title="Выбор обложки для подборки из галереи"
        onSelect={(urls) => {
          if (urls.length > 0) {
            setImageUrl(urls[0]);
            setPostText(prev => {
              const md = `![](${urls[0]})`;
              if (prev.includes(urls[0])) return prev;
              return prev ? `${md}\n\n${prev}` : md;
            });
          }
        }}
      />

      {/* MODAL 1b: CHANNEL AVATAR GALLERY SELECT MODAL */}
      <GallerySelectModal
        isOpen={isChannelGalleryOpen}
        onClose={() => setIsChannelGalleryOpen(false)}
        userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
        title="Выбор аватара канала из галереи"
        onSelect={(urls) => {
          if (urls.length > 0 && editingChannel) {
            setEditingChannel({ ...editingChannel, channel_avatar_url: urls[0] });
          }
          setIsChannelGalleryOpen(false);
        }}
      />

      {/* MODAL 2: RICH MEDIA CONSTRUCTOR MODAL (Photo, Slideshow, Collage) */}
      {mediaModalState.isOpen && (
        <ChatMediaModal
          isOpen={mediaModalState.isOpen}
          onClose={() => setMediaModalState(prev => ({ ...prev, isOpen: false }))}
          onApply={handleApplyMediaBlock}
          initialType={mediaModalState.type}
        />
      )}

      {/* MODAL 3: UNIFIED IMAGE BUILDER MODAL */}
      <ImageBuilderModal
        isOpen={imageBuilderTarget !== null}
        onClose={() => setImageBuilderTarget(null)}
        title="Генерация картинки"
        editorFormat="rich"
        defaultTargetMode="photo"
        allowMultiple={imageBuilderTarget !== 'channel'}
        initialPrompt={
          imageBuilderTarget === 'channel'
            ? `Аватар или иллюстрация для Telegram канала "${editingChannel?.channel_name || categories[0] || 'Бизнес'}"`
            : headerTitle
            ? `Стильная обложка для подборки каналов Telegram: "${headerTitle}". Категория: ${categories[0] || 'Бизнес'}.`
            : `Стильная обложка для подборки каналов Telegram. Категория: ${categories[0] || 'Бизнес'}.`
        }
        userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
        userBalance={Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0)}
        onRefreshUser={() => onBalanceUpdated?.(Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0))}
        onSelectImage={(url) => {
          if (imageBuilderTarget === 'channel' && editingChannel) {
            setEditingChannel({ ...editingChannel, channel_avatar_url: url });
            setFeedbackMessage({ type: 'success', text: 'Картинка канала сгенерирована!' });
          } else {
            setImageUrl(url);
            setPostText(prev => {
              const md = `![](${url})`;
              if (prev.includes(url)) return prev;
              return prev ? `${md}\n\n${prev}` : md;
            });
            setFeedbackMessage({ type: 'success', text: 'Обложка подборки создана и вставлена в публикацию!' });
          }
          setImageBuilderTarget(null);
        }}
        onSelectImages={(urls, targetMode) => {
          if (!urls || urls.length === 0) return;
          if (imageBuilderTarget === 'channel' && editingChannel) {
            setEditingChannel({ ...editingChannel, channel_avatar_url: urls[0] });
            setFeedbackMessage({ type: 'success', text: 'Картинка канала сгенерирована!' });
            setImageBuilderTarget(null);
            return;
          }

          if (targetMode === 'slideshow') {
            const snippet = `<tg-slideshow>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-slideshow>`;
            if (!imageUrl) setImageUrl(urls[0]);
            setPostText(prev => (prev ? `${snippet}\n\n${prev}` : snippet));
            setFeedbackMessage({ type: 'success', text: `Слайдер (${urls.length} фото) создан и вставлен в подборку!` });
          } else if (targetMode === 'collage') {
            const snippet = `<tg-collage>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-collage>`;
            if (!imageUrl) setImageUrl(urls[0]);
            setPostText(prev => (prev ? `${snippet}\n\n${prev}` : snippet));
            setFeedbackMessage({ type: 'success', text: `Коллаж (${urls.length} фото) создан и вставлен в подборку!` });
          } else {
            setImageUrl(urls[0]);
            setPostText(prev => {
              const md = `![](${urls[0]})`;
              if (prev.includes(urls[0])) return prev;
              return prev ? `${md}\n\n${prev}` : md;
            });
            setFeedbackMessage({ type: 'success', text: 'Обложка подборки создана и вставлена в публикацию!' });
          }
          setImageBuilderTarget(null);
        }}
      />
    </div>,
    document.body
  );
};

export default SelectionEditorModal;
