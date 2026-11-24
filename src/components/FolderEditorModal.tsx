import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Sparkles,
  Send,
  Upload,
  Image as ImageIcon,
  Folder,
  Calendar,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Eye,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Bot,
  Bell,
  Palette,
  ExternalLink,
  Copy,
  Globe,
  Bookmark,
  FileText,
  Save,
  Paperclip,
  Video,
  Film,
  Volume2,
  Layers,
  Mic,
  Download,
  File as FileIcon
} from 'lucide-react';
import { GallerySelectModal } from './GallerySelectModal';
import { PROMO_CATEGORIES, InlineButton } from '../types';
import { TelegramPostTextEditor } from './TelegramPostTextEditor';
import { InlineButtonsBuilder } from './InlineButtonsBuilder';
import { MiniAudioField } from './MiniAudioField';
import MarkdownRenderer, { renderV2Mode, getInlineButtonStyleClasses } from './MarkdownRenderer';
import { RichPreviewRenderer, BUILTIN_DRAFTS } from './PostTelegramEditor';
import { ChatMediaModal } from './ChatFormatModals';
import { FileUpload } from './FileUpload';
import { VoiceRecorderModal } from './VoiceRecorderModal';
import { toMskInputString, fromMskInputString } from '../utils/timezones';
import { ImageBuilderModal } from './image-builder';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';
import { CachedMediaImage } from './CachedMediaImage';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

export interface FolderEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: any | null; // null/undefined => creation; object => editing
  currentUser?: any | null;
  onSaved?: (folder: any) => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'UTC+3 (Москва, Санкт-Петербург) - по умолчанию' },
  { value: 'Europe/Kaliningrad', label: 'UTC+2 (Калининград)' },
  { value: 'Europe/Samara', label: 'UTC+4 (Самара)' },
  { value: 'Asia/Yekaterinburg', label: 'UTC+5 (Екатеринбург)' },
  { value: 'Asia/Omsk', label: 'UTC+6 (Омск)' },
  { value: 'Asia/Novosibirsk', label: 'UTC+7 (Новосибирск, Красноярск)' },
  { value: 'Asia/Irkutsk', label: 'UTC+8 (Иркутск)' },
  { value: 'Asia/Yakutsk', label: 'UTC+9 (Якутск)' },
  { value: 'Asia/Vladivostok', label: 'UTC+10 (Владивосток)' },
  { value: 'UTC', label: 'UTC+0 (Гринвич / UTC)' },
  { value: 'Europe/Berlin', label: 'UTC+1 (Берлин, Париж)' }
];

export function embedImageInRichText(currentText: string, imgUrl: string): string {
  if (!imgUrl || !imgUrl.trim()) return currentText;
  const cleanUrl = imgUrl.trim();
  if (currentText.includes(cleanUrl)) return currentText;
  // If only public HTTP(S) URL, prepend cleanly
  if (/^https?:\/\//i.test(cleanUrl) && !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1')) {
    return currentText.trim() ? `![](${cleanUrl})\n\n${currentText.trim()}` : `![](${cleanUrl})`;
  }
  return currentText;
}

export function removeImageFromText(currentText: string, imgUrlToRemove?: string): string {
  if (!currentText) return '';
  if (imgUrlToRemove && imgUrlToRemove.trim()) {
    const escaped = imgUrlToRemove.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return currentText
      .replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n?`, 'g'), '')
      .replace(new RegExp(`\\[[\\u200B\\s]*\\]\\(${escaped}\\)\\n?`, 'g'), '')
      .trim();
  }
  return currentText;
}

const REMINDER_OPTIONS = [
  { value: 15, label: 'За 15 минут до публикации' },
  { value: 30, label: 'За 30 минут до публикации' },
  { value: 60, label: 'За 1 час до публикации (рекомендуется)' },
  { value: 120, label: 'За 2 часа до публикации' },
  { value: 180, label: 'За 3 часа до публикации' },
  { value: 360, label: 'За 6 часов до публикации' },
  { value: 720, label: 'За 12 часов до публикации' },
  { value: 1440, label: 'За 24 часа до публикации' }
];

const BOT_CHECK_OPTIONS = [
  { value: 15, label: 'За 15 минут до старта' },
  { value: 30, label: 'За 30 минут до старта' },
  { value: 60, label: 'За 1 час до старта (рекомендуется)' },
  { value: 120, label: 'За 2 часа до старта' },
  { value: 180, label: 'За 3 часа до старта' }
];

const QUICK_RULES_TEMPLATES = [
  '48 часов в ленте, 3 часа в топе',
  'Без удаления 72 часа',
  'Взаимная подписка всех каналов',
  'Закреп на 24 часа в канале',
  'Не перекрывать другими постами 2 часа'
];

// Helper to normalize any incoming buttons (1D or 2D) to InlineButton[][]
function normalizeToRows(raw: any): InlineButton[][] {
  if (!raw || !Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (Array.isArray(raw[0])) {
    return raw as InlineButton[][];
  }
  // If it's a flat array of buttons, put them in a single row or rows
  return [raw as InlineButton[]];
}

export const FolderEditorModal: React.FC<FolderEditorModalProps> = ({
  isOpen,
  onClose,
  folder,
  currentUser,
  onSaved,
  onBalanceUpdated
}) => {
  const { pricing } = usePricingConfig(currentUser?.id);
  const promoImgCost = pricing.promoAndFolders.promoAiImage;
  const promoTextCost = pricing.promoAndFolders.promoAiText;
  const isEdit = Boolean(folder && folder.id);

  // Core fields
  const [title, setTitle] = useState<string>(folder?.title || '');
  const [categories, setCategories] = useState<string[]>(
    Array.isArray(folder?.categories) && folder.categories.length > 0
      ? folder.categories
      : ['Бизнес и стартапы']
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Primary post fields
  const [imageUrl, setImageUrl] = useState<string>(folder?.image_url || folder?.imageUrl || '');
  const [messageFormat, setMessageFormat] = useState<'v2' | 'rich'>(
    folder?.message_format || folder?.messageFormat || 'rich'
  );
  const [postText, setPostText] = useState<string>(
    folder?.post_text || folder?.postText || ''
  );
  const [telegramFolderLink, setTelegramFolderLink] = useState<string>(
    folder?.telegram_folder_link || folder?.telegramFolderLink || ''
  );
  const [inlineButtons, setInlineButtons] = useState<InlineButton[][]>(() =>
    normalizeToRows(folder?.inline_buttons || folder?.inlineButtons)
  );

  // Parameters
  const [minSubscribers, setMinSubscribers] = useState<number>(
    folder?.min_subscribers ?? folder?.minSubscribers ?? 0
  );
  const [maxParticipants, setMaxParticipants] = useState<number>(
    folder?.max_participants ?? folder?.maxParticipants ?? 10
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (folder?.scheduled_at || folder?.scheduledAt) {
      return toMskInputString(folder.scheduled_at || folder.scheduledAt);
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return toMskInputString(d);
  });
  const [timezone, setTimezone] = useState<string>(folder?.timezone || 'Europe/Moscow');
  const [rulesInstruction, setRulesInstruction] = useState<string>(
    folder?.rules_instruction || folder?.rulesInstruction || '48 часов в ленте, 3 часа в топе'
  );

  // Reminders and Bot check
  const [reminderBeforeMinutes, setReminderBeforeMinutes] = useState<number>(
    folder?.reminder_before_minutes ?? folder?.reminderBeforeMinutes ?? 60
  );
  const [botCheckBeforeMinutes, setBotCheckBeforeMinutes] = useState<number>(
    folder?.bot_check_before_minutes ?? folder?.botCheckBeforeMinutes ?? 60
  );

  // Repeat post
  const [repeatPostEnabled, setRepeatPostEnabled] = useState<boolean>(
    Boolean(folder?.repeat_post_enabled ?? folder?.repeatPostEnabled)
  );
  const [repeatScheduledAt, setRepeatScheduledAt] = useState<string>(() => {
    const val = folder?.repeat_scheduled_at || folder?.repeatScheduledAt;
    return val ? toMskInputString(val) : '';
  });
  const [repeatMessageFormat, setRepeatMessageFormat] = useState<'v2' | 'rich'>(
    folder?.repeat_message_format || folder?.repeatMessageFormat || 'rich'
  );
  const [repeatImageUrl, setRepeatImageUrl] = useState<string>(
    folder?.repeat_image_url || folder?.repeatImageUrl || ''
  );
  const [repeatPostText, setRepeatPostText] = useState<string>(
    folder?.repeat_post_text || folder?.repeatPostText || ''
  );
  const [repeatInlineButtons, setRepeatInlineButtons] = useState<InlineButton[][]>(() =>
    normalizeToRows(folder?.repeat_inline_buttons || folder?.repeatInlineButtons)
  );

  // Rich Media Constructor Modal state (Photo, Slideshow, Collage)
  const [mediaModalState, setMediaModalState] = useState<{
    isOpen: boolean;
    target: 'main' | 'repeat';
    type: 'photo' | 'slideshow' | 'collage';
    caption?: string;
  }>({
    isOpen: false,
    target: 'main',
    type: 'photo',
    caption: ''
  });

  const [mainSelectedText, setMainSelectedText] = useState<string>('');
  const [repeatSelectedText, setRepeatSelectedText] = useState<string>('');
  const [mainCaretRange, setMainCaretRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [repeatCaretRange, setRepeatCaretRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Post Editor DB Templates
  const [dbPostTemplates, setDbPostTemplates] = useState<any[]>([]);
  const [imageBuilderTarget, setImageBuilderTarget] = useState<'main' | 'main_album' | 'repeat' | null>(null);

  // Collapsible Attachments Block (Requirement 5)
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState<boolean>(true);
  const [attachmentType, setAttachmentType] = useState<
    'none' | 'photo' | 'inline_media' | 'album' | 'video' | 'video_note' | 'audio' | 'document'
  >(() => (folder?.image_url || folder?.imageUrl ? 'photo' : 'none'));

  const [photoUrl, setPhotoUrl] = useState<string>(folder?.image_url || folder?.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoNoteUrl, setVideoNoteUrl] = useState<string>('');
  const [albumUrls, setAlbumUrls] = useState<string[]>(['', '']);
  const [audioUrls, setAudioUrls] = useState<string[]>(['']);
  const [audioFormat, setAudioFormat] = useState<'audio' | 'voice'>('audio');
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const [documentUrls, setDocumentUrls] = useState<string[]>(['']);
  const [inlineImageUrl, setInlineImageUrl] = useState<string>('');
  const [inlineImageAlt, setInlineImageAlt] = useState<string>('');
  const [uploadingAttachmentType, setUploadingAttachmentType] = useState<string | null>(null);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState<boolean>(false);

  // Caret-aware media insertion (Requirement 4):
  // In Rich mode: ONLY into text at cursor position, NEVER into cover imageUrl!
  // In V2 mode: ONLY into cover imageUrl, NEVER into text postText!
  const insertMediaUrl = (url: string, target: 'main' | 'repeat' = 'main') => {
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();

    if (target === 'main') {
      if (messageFormat === 'v2') {
        setImageUrl(cleanUrl);
        setPhotoUrl(cleanUrl);
        setAttachmentType('photo');
        setPostText(prev => removeImageFromText(prev, cleanUrl));
      } else {
        setImageUrl('');
        setPhotoUrl('');
        setPostText(prev => {
          if (prev.includes(cleanUrl)) return prev;
          const snippet = `![](${cleanUrl})\n\n`;
          const start = mainCaretRange.start;
          const end = mainCaretRange.end;
          if (start >= 0 && end <= prev.length && (start > 0 || end > 0)) {
            return prev.substring(0, start) + snippet + prev.substring(end);
          }
          return prev ? `${prev}\n\n${snippet.trim()}` : snippet.trim();
        });
      }
    } else {
      if (repeatMessageFormat === 'v2') {
        setRepeatImageUrl(cleanUrl);
        setRepeatPostText(prev => removeImageFromText(prev, cleanUrl));
      } else {
        setRepeatImageUrl('');
        setRepeatPostText(prev => {
          if (prev.includes(cleanUrl)) return prev;
          const snippet = `![](${cleanUrl})\n\n`;
          const start = repeatCaretRange.start;
          const end = repeatCaretRange.end;
          if (start >= 0 && end <= prev.length && (start > 0 || end > 0)) {
            return prev.substring(0, start) + snippet + prev.substring(end);
          }
          return prev ? `${prev}\n\n${snippet.trim()}` : snippet.trim();
        });
      }
    }
  };

  const openMediaConstructor = (target: 'main' | 'repeat', type: 'photo' | 'slideshow' | 'collage') => {
    let sel = (target === 'main' ? mainSelectedText : repeatSelectedText) || '';
    if (!sel) {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLInputElement) {
        const start = activeEl.selectionStart ?? 0;
        const end = activeEl.selectionEnd ?? 0;
        if (start !== end) {
          sel = activeEl.value.substring(Math.min(start, end), Math.max(start, end)).trim();
        }
      }
    }
    if (!sel) {
      const winSel = window.getSelection()?.toString()?.trim();
      if (winSel) sel = winSel;
    }
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLInputElement) {
      const s = activeEl.selectionStart ?? 0;
      const e = activeEl.selectionEnd ?? 0;
      if (target === 'main') {
        setMainCaretRange({ start: s, end: e });
      } else {
        setRepeatCaretRange({ start: s, end: e });
      }
    }
    setMediaModalState({
      isOpen: true,
      target,
      type,
      caption: sel
    });
  };

  const handleApplyMediaBlock = (generatedCode: string) => {
    const trimmedCode = generatedCode.trim();
    if (mediaModalState.target === 'main') {
      if (mediaModalState.caption && postText.includes(mediaModalState.caption)) {
        setPostText(prev => prev.replace(mediaModalState.caption!, trimmedCode));
      } else {
        const start = mainCaretRange.start;
        const end = mainCaretRange.end;
        if (start >= 0 && end <= postText.length && (start > 0 || end > 0)) {
          setPostText(prev => prev.substring(0, start) + trimmedCode + prev.substring(end));
        } else {
          setPostText(prev => prev ? `${prev}\n\n${trimmedCode}` : trimmedCode);
        }
      }
      setMessageFormat('rich');
      setImageUrl('');
      setPhotoUrl('');
    } else {
      if (mediaModalState.caption && repeatPostText.includes(mediaModalState.caption)) {
        setRepeatPostText(prev => prev.replace(mediaModalState.caption!, trimmedCode));
      } else {
        const start = repeatCaretRange.start;
        const end = repeatCaretRange.end;
        if (start >= 0 && end <= repeatPostText.length && (start > 0 || end > 0)) {
          setRepeatPostText(prev => prev.substring(0, start) + trimmedCode + prev.substring(end));
        } else {
          setRepeatPostText(prev => prev ? `${prev}\n\n${trimmedCode}` : trimmedCode);
        }
      }
      setRepeatMessageFormat('rich');
      setRepeatImageUrl('');
    }
    setMediaModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Multi-File Manager for Album, Audio, Document (up to 10 slots)
  const renderMultiFileManager = (
    typeTitle: string,
    typeLabel: string,
    acceptFilter: string,
    urls: string[],
    setUrls: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const updateSlot = (idx: number, val: string) => {
      setUrls(prev => {
        const copy = [...prev];
        copy[idx] = val;
        return copy;
      });
    };

    const removeSlot = (idx: number) => {
      setUrls(prev => {
        const copy = prev.filter((_, i) => i !== idx);
        return copy.length > 0 ? copy : [''];
      });
    };

    const handleBatchUpload = (key: string, url: string) => {
      setUrls(prev => {
        const copy = [...prev];
        const emptyIdx = copy.findIndex(u => !u || !u.trim());
        if (emptyIdx !== -1) {
          copy[emptyIdx] = url;
        } else if (copy.length < 10) {
          copy.push(url);
        }
        return copy;
      });
    };

    const activeCount = urls.filter(u => u && u.trim()).length;

    return (
      <div className="space-y-3 pt-2 border-t border-pink-200/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-[14px] font-bold text-slate-800">{typeTitle}</span>
            <span className="text-[14px] font-mono font-extrabold bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 to-sky-100 text-pink-700 border border-pink-300 px-2 py-0.5 rounded-lg shadow-2xs">
              {activeCount} / 10 заполнено
            </span>
            {uploadingAttachmentType === typeTitle && (
              <span className="text-[14px] text-pink-600 font-semibold animate-pulse flex items-center gap-1">
                <Loader2 size={14} className="animate-spin" />
                Выгружается в Галерею
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FileUpload
              variant="button"
              buttonLabel="Массовая загрузка (до 10)"
              multiple={true}
              accept={acceptFilter}
              onUploadStateChange={(up) => setUploadingAttachmentType(up ? typeTitle : null)}
              onUploaded={handleBatchUpload}
              onBatchUploaded={(items) => {
                if (items && items.length > 0) {
                  setUrls(prev => {
                    const copy = [...prev].filter(u => u && u.trim());
                    for (const item of items) {
                      if (item.url && !copy.includes(item.url) && copy.length < 10) {
                        copy.push(item.url);
                      }
                    }
                    while (copy.length < 2 && typeTitle.includes('Альбом')) {
                      copy.push('');
                    }
                    return copy;
                  });
                }
              }}
            />
            {typeTitle.includes('Альбом') && (
              <button
                type="button"
                onClick={() => setImageBuilderTarget('main_album')}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-xl text-[14px] font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Sparkles size={16} />
                <span>Генерация картинки</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {urls.map((u, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <span className="text-[14px] font-mono text-slate-400 w-5 shrink-0">#{idx + 1}</span>
              <input
                type="url"
                value={u}
                onChange={(e) => updateSlot(idx, e.target.value)}
                placeholder={`URL ${typeLabel} #${idx + 1}`}
                className="flex-1 bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500 font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard?.writeText && u) {
                    navigator.clipboard.writeText(u);
                  }
                }}
                disabled={!u}
                className="p-2 text-slate-500 hover:text-slate-800 bg-white/80 border border-pink-200 rounded-xl cursor-pointer disabled:opacity-40"
                title="Копировать"
              >
                <Copy size={16} />
              </button>
              <FileUpload
                variant="compact"
                buttonLabel="Файл"
                accept={acceptFilter}
                onUploadStateChange={(up) => setUploadingAttachmentType(up ? `${typeTitle}_${idx}` : null)}
                onUploaded={(key, uploadedUrl) => updateSlot(idx, uploadedUrl)}
              />
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Удалить слот"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {urls.length < 10 && (
          <button
            type="button"
            onClick={() => setUrls(prev => [...prev, ''])}
            className="w-full py-2 border-2 border-dashed border-pink-300 rounded-xl text-pink-600 hover:bg-pink-50/50 text-[14px] font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Добавить еще слот для {typeLabel} (макс 10)</span>
          </button>
        )}
      </div>
    );
  };

  // UI state
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewPostTab, setPreviewPostTab] = useState<'main' | 'repeat'>('main');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<'main' | 'repeat'>('main');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingRepeatImage, setIsGeneratingRepeatImage] = useState(false);
  const [isEnhancingText, setIsEnhancingText] = useState(false);
  const [isEnhancingRepeatText, setIsEnhancingRepeatText] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Template Management (Requirement 4: Folder Templates & Text Templates in DB)
  const [folderTemplates, setFolderTemplates] = useState<any[]>([]);
  const [textTemplates, setTextTemplates] = useState<any[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [templateSaveType, setTemplateSaveType] = useState<'folder' | 'text'>('folder');
  const [templateSaveName, setTemplateSaveName] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [isFolderTemplatesOpen, setIsFolderTemplatesOpen] = useState<boolean>(false);
  const [isTextTemplatesOpen, setIsTextTemplatesOpen] = useState<boolean>(false);
  const [isRepeatTextTemplatesOpen, setIsRepeatTextTemplatesOpen] = useState<boolean>(false);

  // Load user templates from PostgreSQL database
  const loadTemplates = async () => {
    try {
      const uId = currentUser?.id || '16926299042';
      const [fRes, tRes, postTplRes] = await Promise.all([
        fetch(`/api/promo-folders/templates?userId=${encodeURIComponent(uId)}&type=folder`),
        fetch(`/api/promo-folders/templates?userId=${encodeURIComponent(uId)}&type=text`),
        fetch('/api/templates')
      ]);
      if (fRes.ok) {
        const data = await fRes.json();
        setFolderTemplates(data.templates || []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTextTemplates(data.templates || []);
      }
      if (postTplRes.ok) {
        const pData = await postTplRes.json();
        setDbPostTemplates(Array.isArray(pData) ? pData : (pData.templates || []));
      }
    } catch (e) {
      console.warn('Failed to load templates:', e);
    }
  };

  // Save folder or text template into DB
  const handleSaveTemplate = async () => {
    const cleanName = templateSaveName.trim();
    if (!cleanName) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, введите название шаблона' });
      return;
    }
    setIsSavingTemplate(true);
    try {
      const uId = currentUser?.id || '16926299042';
      const payload: any = {
        userId: uId,
        templateType: templateSaveType,
        name: cleanName,
        title: title || cleanName,
        categories,
        imageUrl,
        postText,
        messageFormat,
        inlineButtons,
        rulesInstruction,
        minSubscribers,
        maxParticipants,
        timezone
      };

      const res = await fetch('/api/promo-folders/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения шаблона');
      setFeedbackMessage({
        type: 'success',
        text: templateSaveType === 'folder'
          ? `Шаблон папки «${cleanName}» успешно сохранен в базе данных!`
          : `Шаблон текста «${cleanName}» успешно сохранен в базе данных!`
      });
      setIsTemplateModalOpen(false);
      setTemplateSaveName('');
      loadTemplates();
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e.message || 'Ошибка сохранения шаблона' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Delete saved template
  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/promo-folders/templates/${templateId}`, { method: 'DELETE' });
      if (res.ok) {
        loadTemplates();
        setFeedbackMessage({ type: 'success', text: 'Шаблон успешно удален из базы данных' });
      }
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: 'Не удалось удалить шаблон' });
    }
  };

  // Apply folder template
  const handleApplyFolderTemplate = (tmpl: any) => {
    if (tmpl.title || tmpl.name) {
      setTitle(tmpl.title || tmpl.name);
      checkTitleUniqueness(tmpl.title || tmpl.name);
    }
    if (Array.isArray(tmpl.categories) && tmpl.categories.length > 0) {
      setCategories(tmpl.categories);
    }
    if (tmpl.image_url) setImageUrl(tmpl.image_url);
    if (tmpl.post_text) setPostText(tmpl.post_text);
    if (tmpl.message_format) setMessageFormat(tmpl.message_format);
    if (tmpl.inline_buttons) setInlineButtons(normalizeToRows(tmpl.inline_buttons));
    if (tmpl.rules_instruction) setRulesInstruction(tmpl.rules_instruction);
    if (tmpl.min_subscribers !== undefined) setMinSubscribers(tmpl.min_subscribers);
    if (tmpl.max_participants !== undefined) setMaxParticipants(tmpl.max_participants);
    if (tmpl.timezone) setTimezone(tmpl.timezone);

    setIsFolderTemplatesOpen(false);
    setFeedbackMessage({ type: 'success', text: `Шаблон папки «${tmpl.name}» успешно загружен!` });
  };

  // Apply text template (built-in drafts, database templates, or folder saved templates)
  const handleApplyTextTemplate = (tmpl: any, target: 'main' | 'repeat' = 'main', mode: 'replace' | 'append' = 'replace') => {
    const incomingText = tmpl.post_text ?? tmpl.content ?? '';
    const name = tmpl.name || tmpl.title || 'Текст';
    const fmt = tmpl.message_format || tmpl.format;

    if (target === 'main') {
      if (mode === 'append' && postText.trim()) {
        setPostText(prev => `${prev}\n\n${incomingText}`);
      } else {
        setPostText(incomingText);
      }
      if (fmt) setMessageFormat(fmt as any);
    } else {
      if (mode === 'append' && repeatPostText.trim()) {
        setRepeatPostText(prev => `${prev}\n\n${incomingText}`);
      } else {
        setRepeatPostText(incomingText);
      }
      if (fmt) setRepeatMessageFormat(fmt as any);
    }
    setIsTextTemplatesOpen(false);
    setFeedbackMessage({ type: 'success', text: `Шаблон «${name}» успешно применен!` });
  };

  // Title validation
  const [titleAvailable, setTitleAvailable] = useState<boolean | null>(null);
  const [titleChecking, setTitleChecking] = useState<boolean>(false);
  const titleTimerRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Title uniqueness check with debounce
  const checkTitleUniqueness = (val: string) => {
    const clean = val.trim();
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    if (!clean) {
      setTitleAvailable(null);
      return;
    }
    if (isEdit && clean.toLowerCase() === String(folder.title || '').trim().toLowerCase()) {
      setTitleAvailable(true);
      return;
    }
    setTitleChecking(true);
    titleTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/promo-folders/check-title?title=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          setTitleAvailable(Boolean(data.available));
        }
      } catch (e) {
        setTitleAvailable(null);
      } finally {
        setTitleChecking(false);
      }
    }, 400);
  };

  // Sync state when modal opens or folder changes
  useEffect(() => {
    if (isOpen) {
      setTitle(folder?.title || '');
      setCategories(
        Array.isArray(folder?.categories) && folder.categories.length > 0
          ? folder.categories
          : ['Бизнес и стартапы']
      );
      const img = folder?.image_url || folder?.imageUrl || '';
      setImageUrl(img);
      setPhotoUrl(img);
      const rawLoadedType = folder?.attachment_type || folder?.attachmentType || (img ? 'photo' : 'none');
      const loadedAttType = rawLoadedType === 'voice' ? 'audio' : rawLoadedType;
      setAttachmentType(loadedAttType);
      setAudioFormat(folder?.audio_format || folder?.audioFormat || (rawLoadedType === 'voice' ? 'voice' : 'audio'));

      let rawUrls = folder?.attachment_urls || folder?.attachmentUrls || [];
      if (typeof rawUrls === 'string') {
        try { rawUrls = JSON.parse(rawUrls); } catch { rawUrls = []; }
      }
      const urlsArr = Array.isArray(rawUrls) ? rawUrls : [];
      if (loadedAttType === 'album') {
        setAlbumUrls(urlsArr.length >= 2 ? urlsArr : [...urlsArr, '', ''].slice(0, 2));
      } else if (loadedAttType === 'video') {
        setVideoUrl(urlsArr[0] || folder?.attachment_url || folder?.attachmentUrl || '');
      } else if (loadedAttType === 'video_note') {
        setVideoNoteUrl(urlsArr[0] || folder?.attachment_url || folder?.attachmentUrl || '');
      } else if (rawLoadedType === 'voice' || folder?.audio_format === 'voice') {
        setVoiceUrl(urlsArr[0] || folder?.attachment_url || folder?.attachmentUrl || '');
      } else if (loadedAttType === 'audio') {
        setAudioUrls(urlsArr.length >= 1 ? urlsArr : ['']);
      } else if (loadedAttType === 'document') {
        setDocumentUrls(urlsArr.length >= 1 ? urlsArr : ['']);
      }

      setMessageFormat(folder?.message_format || folder?.messageFormat || 'rich');
      setPostText(folder?.post_text || folder?.postText || '');
      setTelegramFolderLink(folder?.telegram_folder_link || folder?.telegramFolderLink || '');
      setMinSubscribers(folder?.min_subscribers ?? folder?.minSubscribers ?? 0);
      setMaxParticipants(folder?.max_participants ?? folder?.maxParticipants ?? 10);
      setTimezone(folder?.timezone || 'Europe/Moscow');
      setRulesInstruction(folder?.rules_instruction || folder?.rulesInstruction || '48 часов в ленте, 3 часа в топе');
      setReminderBeforeMinutes(folder?.reminder_before_minutes ?? folder?.reminderBeforeMinutes ?? 60);
      setBotCheckBeforeMinutes(folder?.bot_check_before_minutes ?? folder?.botCheckBeforeMinutes ?? 60);
      setRepeatPostEnabled(Boolean(folder?.repeat_post_enabled ?? folder?.repeatPostEnabled));
      setRepeatScheduledAt(folder?.repeat_scheduled_at || folder?.repeatScheduledAt || '');
      setRepeatImageUrl(folder?.repeat_image_url || folder?.repeatImageUrl || '');
      setRepeatPostText(folder?.repeat_post_text || folder?.repeatPostText || '');
      setRepeatMessageFormat(folder?.repeat_message_format || folder?.repeatMessageFormat || 'v2');
      setInlineButtons(normalizeToRows(folder?.inline_buttons || folder?.inlineButtons));
      setRepeatInlineButtons(normalizeToRows(folder?.repeat_inline_buttons || folder?.repeatInlineButtons));
      setFeedbackMessage(null);
      setActiveTab('editor');
      loadTemplates();
    }
  }, [isOpen, folder]);

  if (!isOpen) return null;

  // Auto embed image in rich text or remove when switching to v2
  const handleMessageFormatChange = (newMode: 'v2' | 'rich') => {
    setMessageFormat(newMode);
    if (newMode === 'rich') {
      if (imageUrl || photoUrl) {
        const u = imageUrl || photoUrl;
        setPostText(prev => embedImageInRichText(prev, u));
        setImageUrl('');
        setPhotoUrl('');
      }
    } else {
      const imgMatch = postText.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
      if (imgMatch) {
        setImageUrl(imgMatch[1]);
        setPhotoUrl(imgMatch[1]);
        setAttachmentType('photo');
      }
      setPostText(prev => removeImageFromText(prev));
    }
  };

  const handleSetImageUrl = (newUrl: string) => {
    if (!newUrl) {
      setImageUrl('');
      setPhotoUrl('');
      setPostText(prev => removeImageFromText(prev));
      return;
    }
    insertMediaUrl(newUrl, 'main');
  };

  const handleRepeatMessageFormatChange = (newMode: 'v2' | 'rich') => {
    setRepeatMessageFormat(newMode);
    if (newMode === 'rich') {
      if (repeatImageUrl) {
        setRepeatPostText(prev => embedImageInRichText(prev, repeatImageUrl));
        setRepeatImageUrl('');
      }
    } else {
      const imgMatch = repeatPostText.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
      if (imgMatch) {
        setRepeatImageUrl(imgMatch[1]);
      }
      setRepeatPostText(prev => removeImageFromText(prev));
    }
  };

  const handleSetRepeatImageUrl = (newUrl: string) => {
    if (!newUrl) {
      setRepeatImageUrl('');
      setRepeatPostText(prev => removeImageFromText(prev));
      return;
    }
    insertMediaUrl(newUrl, 'repeat');
  };

  // Duplicate inline buttons, image, text, and format from primary post
  const handleDuplicateFromMainPost = () => {
    setRepeatPostText(postText);
    setRepeatImageUrl(imageUrl);
    setRepeatMessageFormat(messageFormat);
    setRepeatInlineButtons(JSON.parse(JSON.stringify(inlineButtons)));
    setFeedbackMessage({
      type: 'success',
      text: 'Контент успешно скопирован из основного поста (текст, обложка, формат и инлайн-кнопки)!'
    });
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

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'repeat') => {
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
        if (target === 'main') {
          handleSetImageUrl(data.url);
        } else {
          handleSetRepeatImageUrl(data.url);
        }
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка загрузки фото' });
    }
  };

  // AI Image generation
  const handleGenerateAiImage = async (target: 'main' | 'repeat') => {
    const userBalance = Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0);
    if (userBalance < promoImgCost) {
      setFeedbackMessage({
        type: 'error',
        text: `Недостаточно ИИрок для генерации картинки! Требуется ${formatIirkyCount(promoImgCost)}, ваш баланс: ${userBalance}.`
      });
      return;
    }

    if (target === 'main') setIsGeneratingImage(true);
    else setIsGeneratingRepeatImage(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || '16926299042',
          title: title || 'Бизнес папка',
          category: categories[0] || 'Бизнес'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации картинки');
      if (data.imageUrl) {
        if (target === 'main') {
          handleSetImageUrl(data.imageUrl);
        } else {
          handleSetRepeatImageUrl(data.imageUrl);
        }
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : promoImgCost;
        setFeedbackMessage({
          type: 'success',
          text: `Обложка успешно сгенерирована через ИИ (${charged === 0 ? 'бесплатно' : `списано ${formatIirkyCount(charged)}`})!`
        });
        onBalanceUpdated?.(Math.max(0, userBalance - charged));
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка при вызове ИИ генератора' });
    } finally {
      if (target === 'main') setIsGeneratingImage(false);
      else setIsGeneratingRepeatImage(false);
    }
  };

  // AI Text Enhancement
  const handleEnhanceText = async (target: 'main' | 'repeat') => {
    const currentText = target === 'main' ? postText : repeatPostText;
    const currentFormat = target === 'main' ? messageFormat : repeatMessageFormat;
    const userBalance = Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0);

    if (userBalance < promoTextCost) {
      setFeedbackMessage({
        type: 'error',
        text: `Недостаточно ИИрок для улучшения текста! Требуется ${formatIirkyCount(promoTextCost)}, ваш баланс: ${userBalance}.`
      });
      return;
    }

    if (target === 'main') setIsEnhancingText(true);
    else setIsEnhancingRepeatText(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || '16926299042',
          type: 'folder_enhance',
          title: title || 'Папка каналов',
          category: categories.join(', '),
          text: currentText,
          format: currentFormat
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка улучшения текста');
      if (data.text) {
        if (target === 'main') {
          setPostText(data.text);
        } else {
          setRepeatPostText(data.text);
        }
        const charged = data.costIirky !== undefined ? Number(data.costIirky) : promoTextCost;
        setFeedbackMessage({
          type: 'success',
          text: `Текст улучшен ИИ для высокой конверсии (${charged === 0 ? 'бесплатно' : `списано ${formatIirkyCount(charged)}`})!`
        });
        onBalanceUpdated?.(Math.max(0, userBalance - charged));
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка улучшения текста' });
    } finally {
      if (target === 'main') setIsEnhancingText(false);
      else setIsEnhancingRepeatText(false);
    }
  };

  // Test sending to user's Telegram PM
  const handleSendTestToSelf = async (target: 'main' | 'repeat') => {
    const tgId = currentUser?.telegram_id || currentUser?.telegramId;
    if (!tgId) {
      setFeedbackMessage({
        type: 'error',
        text: 'У вас в профиле не указан Telegram ID! Подключите Telegram в настройках профиля для отправки тестов.'
      });
      return;
    }

    const currentText = target === 'main' ? postText : repeatPostText;
    const currentImg = target === 'main' ? (imageUrl || photoUrl) : repeatImageUrl;
    const currentBtns = target === 'main' ? inlineButtons : repeatInlineButtons;
    const currentFormat = target === 'main' ? messageFormat : repeatMessageFormat;

    const resolvedAttType = target === 'main'
      ? (attachmentType === 'audio' && audioFormat === 'voice' ? 'voice' : attachmentType)
      : (currentImg ? 'photo' : 'none');
    const resolvedAttUrls = target === 'main'
      ? (
          attachmentType === 'album' ? albumUrls.filter(u => u && u.trim()) :
          attachmentType === 'audio' ? (audioFormat === 'voice' ? [voiceUrl] : audioUrls.filter(u => u && u.trim())).filter(Boolean) :
          attachmentType === 'document' ? documentUrls.filter(u => u && u.trim()) :
          attachmentType === 'video' ? [videoUrl].filter(Boolean) :
          attachmentType === 'video_note' ? [videoNoteUrl].filter(Boolean) :
          attachmentType === 'photo' ? [currentImg].filter(Boolean) : []
        )
      : (currentImg ? [currentImg] : []);

    setIsSendingTest(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/promo-folders/test-send-pm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          text: currentText,
          content: currentText,
          imageUrl: currentImg,
          attachmentUrl: resolvedAttUrls[0] || currentImg || '',
          attachmentUrls: resolvedAttUrls,
          attachmentType: resolvedAttType,
          audioFormat: target === 'main' ? audioFormat : 'audio',
          inlineButtons: currentBtns,
          messageFormat: currentFormat,
          title: title || 'Папка',
          linkPreviewEnabled: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки теста');
      setFeedbackMessage({
        type: 'success',
        text: data.message || 'Тестовый пост папки успешно отправлен в ваши личные сообщения Telegram!'
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Не удалось отправить тестовое сообщение' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Submit Save Folder
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, введите название папки' });
      return;
    }
    if (!postText.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Пожалуйста, заполните текст поста папки' });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedbackMessage(null);

    const effectiveImageUrl = imageUrl || photoUrl || '';
    const savedAttType = attachmentType === 'audio' && audioFormat === 'voice' ? 'voice' : attachmentType;
    const savedAttUrls =
      attachmentType === 'album' ? albumUrls.filter(u => u && u.trim()) :
      attachmentType === 'audio' ? (audioFormat === 'voice' ? [voiceUrl] : audioUrls.filter(u => u && u.trim())).filter(Boolean) :
      attachmentType === 'document' ? documentUrls.filter(u => u && u.trim()) :
      attachmentType === 'video' ? [videoUrl].filter(Boolean) :
      attachmentType === 'video_note' ? [videoNoteUrl].filter(Boolean) :
      attachmentType === 'photo' ? [effectiveImageUrl].filter(Boolean) : [];

    const payload = {
      userId: currentUser?.id || '16926299042',
      title: cleanTitle,
      categories,
      imageUrl: effectiveImageUrl,
      attachmentType: savedAttType,
      attachmentUrls: savedAttUrls,
      audioFormat,
      postText,
      messageFormat,
      inlineButtons,
      minSubscribers: Number(minSubscribers) || 0,
      maxParticipants: Number(maxParticipants) || 10,
      scheduledAt: fromMskInputString(scheduledAt),
      timezone: timezone || 'Europe/Moscow',
      rulesInstruction,
      telegramFolderLink,
      reminderBeforeMinutes: Number(reminderBeforeMinutes) || 60,
      botCheckBeforeMinutes: Number(botCheckBeforeMinutes) || 60,
      repeatPostEnabled,
      repeatScheduledAt: repeatPostEnabled && repeatScheduledAt ? fromMskInputString(repeatScheduledAt) : null,
      repeatMessageFormat: repeatPostEnabled ? repeatMessageFormat : messageFormat,
      repeatImageUrl: repeatPostEnabled ? (repeatImageUrl || '') : null,
      repeatAttachmentType: repeatPostEnabled && repeatImageUrl ? 'photo' : 'none',
      repeatAttachmentUrls: repeatPostEnabled && repeatImageUrl ? [repeatImageUrl] : [],
      repeatPostText: repeatPostEnabled ? repeatPostText : null,
      repeatInlineButtons: repeatPostEnabled ? repeatInlineButtons : [],
      status: 'confirmed'
    };

    try {
      const url = isEdit ? `/api/promo-folders/${folder.id}` : '/api/promo-folders';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения папки');

      onSaved?.(data.folder || data);
      onClose();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Ошибка сохранения папки' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[94vh] overflow-y-auto p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border border-pink-300 shadow-2xl space-y-5">
        
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                {isEdit ? 'Редактирование папки каналов' : 'Создание новой папки каналов'}
              </h2>
              <p className="text-[14px] text-slate-500">
                Настройте рекламный пост, инлайн-кнопки по рядам и расписание выхода
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-[14px] ${
              feedbackMessage.type === 'success'
                ? 'bg-sky-50/90 border-sky-300 text-sky-900'
                : 'bg-rose-50/90 border-rose-300 text-rose-900'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-bold flex-1">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Mode Tabs: Editor vs Live Preview */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/80 border border-pink-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50/50'
            }`}
          >
            Параметры и редактор
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-[14px] transition-all cursor-pointer inline-flex items-center justify-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Предпросмотр поста</span>
          </button>
        </div>

        {/* FORM CONTENT */}
        <div className="space-y-6">
          {activeTab === 'editor' ? (
            <>
              {/* QUICK TEMPLATES BAR FOR FOLDERS */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-pink-50 via-orange-50 via-pink-50 to-sky-50 border border-pink-200/90 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-pink-500 shrink-0" />
                  <span className="text-[14px] font-bold text-slate-800">
                    Шаблоны папок:
                  </span>
                  <span className="text-[14px] text-slate-500 hidden md:inline">
                    (сохраняйте готовые наборы параметров для быстрой загрузки)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Dropdown to select saved folder template */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFolderTemplatesOpen(prev => !prev)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50/50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Folder className="w-4 h-4 text-sky-500" />
                      <span>Загрузить шаблон ({folderTemplates.length})</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFolderTemplatesOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFolderTemplatesOpen && (
                      <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-72 sm:w-80 max-h-72 overflow-y-auto bg-white border border-pink-200 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                        {folderTemplates.length === 0 ? (
                          <div className="p-3 text-center text-[14px] text-slate-500">
                            У вас пока нет сохраненных шаблонов папок. Настройте поля и нажмите «Сохранить как шаблон».
                          </div>
                        ) : (
                          folderTemplates.map(tmpl => (
                            <div
                              key={tmpl.id}
                              onClick={() => handleApplyFolderTemplate(tmpl)}
                              className="p-2.5 rounded-xl hover:bg-pink-50/60 cursor-pointer border border-transparent hover:border-pink-200 transition-all flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-[14px] text-slate-800 truncate">{tmpl.name}</div>
                                <div className="text-[14px] text-slate-500 truncate">
                                  {tmpl.title || 'Без названия'} • от {tmpl.min_subscribers || 0} подп.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                                title="Удалить шаблон"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Save Current as Folder Template */}
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateSaveType('folder');
                      setTemplateSaveName(title ? `Шаблон: ${title}` : 'Новый шаблон папки');
                      setIsTemplateModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Сохранить как шаблон папки</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: TITLE & CATEGORIES */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 border border-pink-200 space-y-4 shadow-2xs">
                <h3 className="text-[14px] font-black text-slate-800 border-b border-pink-100 pb-2">
                  1. Основная информация папки
                </h3>

                {/* Title with uniqueness check */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[14px] font-bold text-slate-800">
                      Название папки *
                    </label>
                    {titleChecking ? (
                      <span className="text-[14px] text-pink-600 flex items-center gap-1 font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Проверка...
                      </span>
                    ) : titleAvailable === true ? (
                      <span className="text-[14px] text-sky-600 flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        Название свободно
                      </span>
                    ) : titleAvailable === false ? (
                      <span className="text-[14px] text-rose-500 font-bold">
                        Папка с таким названием уже существует
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      checkTitleUniqueness(e.target.value);
                    }}
                    placeholder="Например: Топ IT & AI каналов 2026"
                    className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-pink-400 shadow-2xs"
                    required
                  />
                </div>

                {/* Categories Multi-Select Dropdown with external badge tabs */}
                <div ref={dropdownRef} className="relative">
                  <label className="text-[14px] font-bold text-slate-800 block mb-1">
                    Категории папки (мультивыбор)
                  </label>
                  
                  {/* Selected badges displayed externally */}
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
                    className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-800 font-medium flex items-center justify-between shadow-2xs cursor-pointer hover:border-pink-300"
                  >
                    <span>Выбрать категории из списка ({categories.length} выбрано)</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isCategoryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-2xl bg-white border border-pink-300 shadow-xl z-30 max-h-56 overflow-y-auto space-y-1">
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

                {/* Telegram Folder Link */}
                <div>
                  <label className="text-[14px] font-bold text-slate-800 block mb-1">
                    Готовая ссылка на папку в Telegram
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={telegramFolderLink}
                      onChange={(e) => setTelegramFolderLink(e.target.value)}
                      placeholder="https://t.me/addlist/..."
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs pr-10"
                    />
                    <Folder className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  </div>
                  <span className="text-[14px] text-slate-500 mt-1 block">
                    Вы можете создать папку в Telegram, получить ссылку «Добавить папку» и вставить её сюда.
                  </span>
                </div>
              </div>

              {/* SECTION 2: PRIMARY POST EDITOR */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 border border-pink-200 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-100 pb-2">
                  <h3 className="text-[14px] font-black text-slate-800">
                    2. Основной пост папки (редактор, форматирование и кнопки)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleSendTestToSelf('main')}
                    disabled={isSendingTest}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Тест себе в Telegram</span>
                  </button>
                </div>

                {/* MEDIA & ATTACHMENTS MODULE */}
                {messageFormat === 'v2' ? (
                  /* V2 Mode: Full Collapsible Attachments Block matching Post Editor */
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-pink-200/90 space-y-4 shadow-2xs backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setIsAttachmentsOpen(!isAttachmentsOpen)}
                      className="w-full flex items-center justify-between text-left cursor-pointer group"
                    >
                      <div className="flex items-center space-x-2">
                        <Paperclip className="text-pink-500 shrink-0" size={20} />
                        <h4 className="text-[14px] font-black bg-gradient-to-r from-sky-500 via-pink-600 via-orange-500 via-pink-600 to-sky-500 bg-clip-text text-transparent">
                          Вложения к посту
                        </h4>
                        <span className="text-[14px] font-semibold text-slate-600 hidden sm:inline">
                          — {
                            attachmentType === 'none' ? 'Без медиа' :
                            attachmentType === 'photo' ? 'Фото' :
                            attachmentType === 'album' ? 'Альбом (до 10)' :
                            attachmentType === 'video' ? 'Видео' :
                            attachmentType === 'video_note' ? 'Кружок' :
                            attachmentType === 'audio' ? 'Аудио (до 10)' : 'Файл (до 10)'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[14px] font-mono text-pink-700 font-extrabold bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 to-sky-100 px-2.5 py-0.5 rounded-xl border border-pink-300 shadow-2xs">
                          {attachmentType === 'none' ? 'Выкл' : 'Включено'}
                        </span>
                        <ChevronDown size={18} className={`text-pink-600 transition-transform duration-200 ${isAttachmentsOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isAttachmentsOpen && (
                      <div className="space-y-4 pt-3 border-t border-pink-200/80">
                        <label className="block text-[14px] font-bold text-slate-800">
                          Тип вложения Telegram:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {[
                            { id: 'none', label: 'Без медиа', icon: FileIcon },
                            { id: 'photo', label: 'Фото', icon: ImageIcon },
                            { id: 'album', label: 'Альбом (до 10)', icon: Layers },
                            { id: 'video', label: 'Видео', icon: Video },
                            { id: 'video_note', label: 'Кружок', icon: Film },
                            { id: 'audio', label: 'Аудио (до 10)', icon: Volume2 },
                            { id: 'document', label: 'Файл (до 10)', icon: Paperclip }
                          ].map((type) => {
                            const Icon = type.icon;
                            const isSelected = attachmentType === type.id;
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  setAttachmentType(type.id as any);
                                  if (type.id === 'photo') {
                                    handleSetImageUrl(photoUrl || '');
                                  } else if (type.id === 'none') {
                                    handleSetImageUrl('');
                                  }
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white border-transparent shadow-xs'
                                    : 'bg-white/80 border-pink-200 text-slate-800 hover:bg-white'
                                }`}
                              >
                                <Icon size={18} className={isSelected ? 'text-white' : 'text-pink-500'} />
                                <span className="text-[14px] font-semibold mt-1 text-center">{type.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* None Notice */}
                        {attachmentType === 'none' && (
                          <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 text-[14px] text-slate-600">
                            Текст рекламного поста папки будет опубликован в Telegram без прикрепленных медиафайлов.
                          </div>
                        )}

                        {/* Photo Field */}
                        {attachmentType === 'photo' && (
                          <div className="space-y-2.5 pt-2 border-t border-pink-200/60">
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[14px] text-slate-800 font-bold">
                              <span>Ссылка на фотографию:</span>
                              {uploadingAttachmentType === 'photo' && (
                                <span className="text-[14px] text-pink-600 font-semibold animate-pulse flex items-center gap-1">
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Выгружается в галерею</span>
                                </span>
                              )}
                            </div>
                            <div className="w-full">
                              <input
                                type="url"
                                value={photoUrl}
                                onChange={(e) => {
                                  setPhotoUrl(e.target.value);
                                  handleSetImageUrl(e.target.value);
                                }}
                                placeholder="https://... ссылка на фото"
                                className="w-full bg-white border border-pink-200 rounded-2xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-400 font-mono shadow-2xs"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <FileUpload
                                variant="compact"
                                hideLabelOnMobile
                                buttonLabel="Загрузить фото"
                                accept="image/*"
                                onUploadStateChange={(up) => setUploadingAttachmentType(up ? 'photo' : null)}
                                onUploaded={(key, url) => {
                                  setPhotoUrl(url);
                                  handleSetImageUrl(url);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setGalleryTarget('main');
                                  setIsGalleryOpen(true);
                                }}
                                className="p-2.5 sm:px-3 sm:py-2 bg-white hover:bg-pink-50/50 text-slate-800 border border-pink-300 rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                                title="Из галереи"
                              >
                                <ImageIcon size={16} className="text-pink-600 shrink-0" />
                                <span className="hidden sm:inline">Из галереи</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setImageBuilderTarget('main')}
                                className="p-2.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                                title="Генерация картинки"
                              >
                                <Sparkles size={16} className="shrink-0" />
                                <span className="hidden sm:inline">Генерация картинки</span>
                              </button>
                              {photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhotoUrl('');
                                    handleSetImageUrl('');
                                  }}
                                  className="p-2.5 text-rose-600 bg-white/85 hover:bg-rose-50 border border-pink-200 rounded-xl transition-colors cursor-pointer shrink-0"
                                  title="Очистить"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            {imageUrl && (
                              <div className="mt-2 p-2 rounded-2xl bg-white/80 border border-pink-200 relative inline-block">
                                <img
                                  src={imageUrl}
                                  alt="Обложка поста"
                                  className="max-h-72 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhotoUrl('');
                                    handleSetImageUrl('');
                                  }}
                                  className="absolute top-3 right-3 p-1 rounded-lg bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs cursor-pointer"
                                  title="Удалить картинку"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Video Field */}
                        {attachmentType === 'video' && (
                          <div className="space-y-3 pt-2 border-t border-pink-200/60">
                            <div className="flex items-center justify-between text-[14px] text-slate-700 font-semibold">
                              <span>URL видеофайла (.mp4):</span>
                              {uploadingAttachmentType === 'video' && (
                                <span className="text-[14px] text-pink-600 font-semibold animate-pulse flex items-center gap-1">
                                  <Loader2 size={14} className="animate-spin" />
                                  Выгружается в Галерею
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://... ссылка на видео"
                                className="flex-1 min-w-[200px] bg-white border border-pink-200 rounded-2xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-400 font-mono shadow-2xs"
                              />
                              <FileUpload
                                variant="compact"
                                buttonLabel="Загрузить видео"
                                accept="video/*"
                                onUploadStateChange={(up) => setUploadingAttachmentType(up ? 'video' : null)}
                                onUploaded={(key, url) => setVideoUrl(url)}
                              />
                              {videoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setVideoUrl('')}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Очистить"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Telegram Video Note Field (Кружок) */}
                        {attachmentType === 'video_note' && (
                          <div className="space-y-3 pt-2 border-t border-pink-200/60">
                            <div className="flex items-center justify-between text-[14px] text-slate-700 font-semibold">
                              <span>URL круглого видеосообщения Telegram (.mp4 1:1):</span>
                              <span className="text-[14px] text-pink-700 font-mono font-bold bg-pink-100 px-2 py-0.5 rounded-lg border border-pink-200">Кружок 1:1</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="url"
                                value={videoNoteUrl}
                                onChange={(e) => setVideoNoteUrl(e.target.value)}
                                placeholder="https://... (квадратное короткое видео 1:1)"
                                className="flex-1 min-w-[200px] bg-white border border-pink-200 rounded-2xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-400 font-mono shadow-2xs"
                              />
                              <FileUpload
                                variant="compact"
                                buttonLabel="Загрузить кружок"
                                accept="video/*"
                                onUploadStateChange={(up) => setUploadingAttachmentType(up ? 'video_note' : null)}
                                onUploaded={(key, url) => setVideoNoteUrl(url)}
                              />
                              {videoNoteUrl && (
                                <button
                                  type="button"
                                  onClick={() => setVideoNoteUrl('')}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Очистить"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <p className="text-[14px] text-slate-500">
                              Круглое видеосообщение отправляется через официальный метод Telegram sendVideoNote. Рекомендуется использовать квадратное короткое видео (соотношение 1:1, до 1 мин).
                            </p>
                          </div>
                        )}

                        {/* Album Multi-File Manager */}
                        {attachmentType === 'album' && renderMultiFileManager(
                          'Альбом файлов (Фото / Видео):',
                          'элемента альбома',
                          'image/*,video/*',
                          albumUrls,
                          setAlbumUrls
                        )}

                        {/* Audio Multi-File or Voice Message Manager */}
                        {attachmentType === 'audio' && (
                          <div className="space-y-4 pt-2 border-t border-pink-200/80">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="block text-[14px] font-bold text-slate-800">
                                Формат отправки аудио:
                              </label>
                              <button
                                type="button"
                                onClick={() => setIsVoiceRecorderOpen(true)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 transition-all cursor-pointer"
                                title="Записать голос с микрофона"
                              >
                                <Mic size={16} />
                                <span>Записать голос</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setAudioFormat('audio')}
                                className={`flex items-center justify-center space-x-2 p-2.5 rounded-2xl border text-[14px] font-bold transition-all cursor-pointer ${
                                  audioFormat === 'audio'
                                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-transparent shadow-xs'
                                    : 'bg-white/80 border-pink-200 text-slate-700 hover:bg-white'
                                }`}
                              >
                                <Volume2 size={16} />
                                <span>Аудиофайл (до 10 файлов)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAudioFormat('voice')}
                                className={`flex items-center justify-center space-x-2 p-2.5 rounded-2xl border text-[14px] font-bold transition-all cursor-pointer ${
                                  audioFormat === 'voice'
                                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-transparent shadow-xs'
                                    : 'bg-white/80 border-pink-200 text-slate-700 hover:bg-white'
                                }`}
                              >
                                <Mic size={16} />
                                <span>Голосовое сообщение (OGG Opus)</span>
                              </button>
                            </div>

                            {audioFormat === 'voice' ? (
                              <div className="space-y-3 p-3.5 bg-white/90 border border-pink-200/90 rounded-2xl shadow-2xs">
                                <div className="flex items-center justify-between text-[14px] text-slate-700 font-semibold">
                                  <span>Ссылка на аудиофайл для голосового:</span>
                                  <span className="text-[14px] text-slate-500">Автоконвертация в OGG Telegram</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="url"
                                    value={voiceUrl}
                                    onChange={(e) => setVoiceUrl(e.target.value)}
                                    placeholder="https://... ссылка на аудио или запишите голос"
                                    className="flex-1 min-w-[200px] bg-white border border-pink-200 rounded-2xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-400 font-mono shadow-2xs"
                                  />
                                  <FileUpload
                                    variant="compact"
                                    buttonLabel="Загрузить"
                                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                                    convertVoiceOgg={true}
                                    onUploaded={(key, url) => {
                                      setVoiceUrl(url);
                                      setAudioFormat('voice');
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setIsVoiceRecorderOpen(true)}
                                    className="p-2 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white rounded-xl shadow-2xs hover:opacity-90 transition-all cursor-pointer shrink-0"
                                    title="Записать голос через микрофон"
                                  >
                                    <Mic size={16} />
                                  </button>
                                  {voiceUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setVoiceUrl('')}
                                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                      title="Очистить"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              renderMultiFileManager(
                                'Аудиозаписи (до 10 файлов):',
                                'аудиофайла',
                                'audio/*,.mp3,.wav,.ogg,.m4a',
                                audioUrls,
                                setAudioUrls
                              )
                            )}
                          </div>
                        )}

                        {/* Document Multi-File Manager */}
                        {attachmentType === 'document' && renderMultiFileManager(
                          'Документы / Файлы (до 10):',
                          'файла',
                          '*/*',
                          documentUrls,
                          setDocumentUrls
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Rich Mode: Article Media & Inline Insertion Block */
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 border border-pink-200/90 space-y-3 shadow-2xs backdrop-blur-md">
                    <label className="text-[14px] font-bold text-slate-800 block">
                      Медиа статьи и иллюстрации лонгрида:
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50/50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                        <Upload className="w-4 h-4 text-pink-500" />
                        <span>Обложка (фото)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, 'main')}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setGalleryTarget('main');
                          setIsGalleryOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50/50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <ImageIcon className="w-4 h-4 text-pink-500" />
                        <span>Из галереи</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageBuilderTarget('main')}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Генерация картинки</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openMediaConstructor('main', 'photo')}
                        className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        title="Вставить изображение ![](url) в позицию курсора статьи"
                      >
                        <ImageIcon className="w-4 h-4 text-pink-500" />
                        <span>+ Картинка в статью</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openMediaConstructor('main', 'slideshow')}
                        className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        title="Вставить слайдер карусели <tg-slideshow> в текст"
                      >
                        <ImageIcon className="w-4 h-4 text-orange-500" />
                        <span>+ Карусель (слайды)</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openMediaConstructor('main', 'collage')}
                        className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        title="Вставить сетку фото <tg-collage> в текст"
                      >
                        <ImageIcon className="w-4 h-4 text-sky-500" />
                        <span>+ Коллаж</span>
                      </button>
                    </div>

                    {imageUrl && (
                      <div className="mt-2 p-2 rounded-2xl bg-white/80 border border-pink-200 relative inline-block">
                        <img
                          src={imageUrl}
                          alt="Обложка поста"
                          className="max-h-72 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSetImageUrl('')}
                          className="absolute top-3 right-3 p-1 rounded-lg bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs cursor-pointer"
                          title="Удалить картинку"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TEXT TEMPLATES BAR (BUILT-IN + POST DB + FOLDER SAVED) */}
                {(() => {
                  const builtinDraftsForMode = BUILTIN_DRAFTS.filter(d => (d.format || 'v2') === messageFormat);
                  const totalTemplatesCount = textTemplates.length + dbPostTemplates.length + builtinDraftsForMode.length;
                  return (
                    <div className="p-3.5 rounded-3xl bg-gradient-to-r from-sky-50 via-pink-50 via-orange-50 via-pink-50 to-sky-50 border border-pink-200/90 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-pink-500 shrink-0" />
                        <span className="text-[14px] font-bold text-slate-800">
                          Шаблоны текстов:
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsTextTemplatesOpen(prev => !prev)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>Вставить шаблон текста ({totalTemplatesCount})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTextTemplatesOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isTextTemplatesOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsTextTemplatesOpen(false)}
                              />
                              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white/95 border border-pink-300 rounded-3xl shadow-2xl z-50 p-3 space-y-3 backdrop-blur-md">
                                <div className="flex items-center justify-between border-b border-pink-200 pb-2 px-1">
                                  <span className="font-extrabold text-[14px] text-slate-800">
                                    Шаблоны для {messageFormat === 'rich' ? 'Rich' : 'Markdown V2'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setIsTextTemplatesOpen(false)}
                                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Section 1: Built-in Draft Templates */}
                                {builtinDraftsForMode.length > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="text-[14px] font-bold text-pink-600 px-1">
                                      Встроенные шаблоны ({builtinDraftsForMode.length}):
                                    </div>
                                    {builtinDraftsForMode.map(draft => (
                                      <div
                                        key={draft.id}
                                        onClick={() => handleApplyTextTemplate({ content: draft.content, name: draft.title, format: draft.format }, 'main', 'replace')}
                                        className="p-2.5 rounded-2xl bg-white/80 hover:bg-pink-50/80 cursor-pointer border border-pink-100 hover:border-pink-300 transition-all flex items-center justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="text-lg">{draft.badge}</span>
                                          <div className="min-w-0">
                                            <div className="font-bold text-[14px] text-slate-800 truncate">{draft.title}</div>
                                            <div className="text-[14px] text-slate-500 truncate">{draft.subtitle}</div>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApplyTextTemplate({ content: draft.content, name: draft.title, format: draft.format }, 'main', 'append');
                                          }}
                                          className="px-2 py-0.5 rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-700 text-[14px] font-bold cursor-pointer shrink-0"
                                          title="Добавить в конец текущего текста"
                                        >
                                          +В конец
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Section 2: Post Templates from DB */}
                                {dbPostTemplates.length > 0 && (
                                  <div className="space-y-1.5 pt-2 border-t border-pink-100">
                                    <div className="text-[14px] font-bold text-sky-600 px-1">
                                      Шаблоны из постов ({dbPostTemplates.length}):
                                    </div>
                                    {dbPostTemplates.map(pt => (
                                      <div
                                        key={pt.id}
                                        onClick={() => handleApplyTextTemplate({ content: pt.content, name: pt.name || pt.title }, 'main', 'replace')}
                                        className="p-2.5 rounded-2xl bg-white/80 hover:bg-sky-50/80 cursor-pointer border border-sky-100 hover:border-sky-300 transition-all flex items-center justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-bold text-[14px] text-slate-800 truncate">{pt.name || pt.title || 'Шаблон поста'}</div>
                                          <div className="text-[14px] text-slate-500 truncate">{pt.content?.slice(0, 50)}...</div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApplyTextTemplate({ content: pt.content, name: pt.name || pt.title }, 'main', 'append');
                                          }}
                                          className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 text-[14px] font-bold cursor-pointer shrink-0"
                                          title="Добавить в конец текущего текста"
                                        >
                                          +В конец
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Section 3: User Saved Folder Text Templates */}
                                <div className="space-y-1.5 pt-2 border-t border-pink-100">
                                  <div className="text-[14px] font-bold text-orange-600 px-1">
                                    Сохраненные шаблоны папок ({textTemplates.length}):
                                  </div>
                                  {textTemplates.length === 0 ? (
                                    <div className="p-2.5 text-center text-[14px] text-slate-500 bg-white/60 rounded-xl">
                                      Пока нет сохраненных текстов. Введите текст и нажмите «Сохранить текст в шаблоны».
                                    </div>
                                  ) : (
                                    textTemplates.map(tmpl => (
                                      <div
                                        key={tmpl.id}
                                        onClick={() => handleApplyTextTemplate(tmpl, 'main', 'replace')}
                                        className="p-2.5 rounded-2xl bg-white/80 hover:bg-orange-50/80 cursor-pointer border border-orange-100 hover:border-orange-300 transition-all flex items-center justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-bold text-[14px] text-slate-800 truncate">{tmpl.name}</div>
                                          <div className="text-[14px] text-slate-500 truncate">{tmpl.post_text?.slice(0, 50)}...</div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApplyTextTemplate(tmpl, 'main', 'append');
                                            }}
                                            className="px-2 py-0.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-[14px] font-bold cursor-pointer"
                                            title="Добавить в конец текущего текста"
                                          >
                                            +В конец
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                            title="Удалить шаблон"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!postText.trim()) {
                              setFeedbackMessage({ type: 'error', text: 'Сначала введите текст поста для сохранения в шаблоны!' });
                              return;
                            }
                            setTemplateSaveType('text');
                            setTemplateSaveName('Шаблон: ' + (postText.trim().split('\n')[0]?.slice(0, 30) || 'Новый текст'));
                            setIsTemplateModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-pink-300 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Save className="w-3.5 h-3.5 text-pink-500" />
                          <span>Сохранить текст в шаблоны</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Reusable Text Editor (Rich vs V2 + Selection Popup + MiniAudioField voice input) */}
                <TelegramPostTextEditor
                  text={postText}
                  onChange={setPostText}
                  formatMode={messageFormat}
                  onFormatModeChange={handleMessageFormatChange}
                  onSelectionChange={setMainSelectedText}
                  label="Текст основного поста"
                  placeholder="Введите рекламный текст поста папки... Выделите текст для применения стилей (жирный, курсив, ссылки, цитаты, спойлеры) или используйте голосовой ввод"
                  minRows={6}
                  onAIEnhance={() => handleEnhanceText('main')}
                  isEnhancing={isEnhancingText}
                />

                {/* Reusable Inline Buttons Builder (Rows, Columns, Colors) */}
                <InlineButtonsBuilder
                  buttons={inlineButtons}
                  onChange={setInlineButtons}
                  folderLink={telegramFolderLink}
                  label="Инлайн-кнопки основного поста (ряды и строки)"
                />
              </div>

              {/* SECTION 3: REPEAT POST (НАПОМИНАНИЕ И ПОВТОРНЫЙ ПОСТ) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 border border-pink-200 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-100 pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="repeatPostCheck"
                      checked={repeatPostEnabled}
                      onChange={(e) => setRepeatPostEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-pink-600 focus:ring-pink-400 cursor-pointer"
                    />
                    <label htmlFor="repeatPostCheck" className="text-[14px] font-black text-slate-800 cursor-pointer">
                      3. Повторный пост (напоминание участникам и повторный выход)
                    </label>
                  </div>

                  {repeatPostEnabled && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDuplicateFromMainPost}
                        className="px-3 py-1.5 rounded-xl bg-white/90 border border-pink-200 text-slate-800 hover:bg-pink-50/50 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs transition-all"
                        title="Скопировать обложку, текст, формат и инлайн-кнопки из основного поста"
                      >
                        <Copy className="w-4 h-4 text-pink-500" />
                        <span>Скопировать из основного поста</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendTestToSelf('repeat')}
                        disabled={isSendingTest}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Тест повторного поста</span>
                      </button>
                    </div>
                  )}
                </div>

                {repeatPostEnabled ? (
                  <div className="space-y-4 pt-1">
                    {/* Repeat scheduled time */}
                    <div>
                      <label className="text-[14px] font-bold text-slate-800 block mb-1">
                        Дата и время повторного поста
                      </label>
                      <input
                        type="datetime-local"
                        value={repeatScheduledAt}
                        onChange={(e) => setRepeatScheduledAt(e.target.value)}
                        className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-pink-400 shadow-2xs"
                      />
                    </div>

                    {/* Repeat Image */}
                    <div>
                      <label className="text-[14px] font-bold text-slate-800 block mb-1.5">
                        Обложка повторного поста
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50/50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-4 h-4 text-pink-500" />
                          <span>Загрузить фото</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageFileChange(e, 'repeat')}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setGalleryTarget('repeat');
                            setIsGalleryOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50/50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <ImageIcon className="w-4 h-4 text-pink-500" />
                          <span>Из галереи</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImageBuilderTarget('repeat')}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Генерация картинки</span>
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openMediaConstructor('repeat', 'photo')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          title="Вставить изображение ![](url) в повторный пост"
                        >
                          <ImageIcon className="w-4 h-4 text-pink-500" />
                          <span>+ Картинка</span>
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openMediaConstructor('repeat', 'slideshow')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          title="Вставить карусель/слайдер <tg-slideshow> в повторный пост"
                        >
                          <ImageIcon className="w-4 h-4 text-orange-500" />
                          <span>+ Карусель (слайды)</span>
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openMediaConstructor('repeat', 'collage')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:bg-pink-50 text-slate-800 font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          title="Вставить сетку фото <tg-collage> в повторный пост"
                        >
                          <ImageIcon className="w-4 h-4 text-sky-500" />
                          <span>+ Коллаж</span>
                        </button>
                      </div>

                      {repeatImageUrl && (
                        <div className="mt-3 p-2 rounded-2xl bg-white/70 border border-pink-200 relative inline-block">
                          <img
                            src={repeatImageUrl}
                            alt="Обложка повторного поста"
                            className="max-h-72 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSetRepeatImageUrl('')}
                            className="absolute top-3 right-3 p-1 rounded-lg bg-white/90 text-rose-500 hover:text-rose-700 shadow-2xs cursor-pointer"
                            title="Удалить картинку"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Fully duplicated Reusable Text Editor for Repeat Post */}
                    <TelegramPostTextEditor
                      text={repeatPostText}
                      onChange={setRepeatPostText}
                      formatMode={repeatMessageFormat}
                      onFormatModeChange={handleRepeatMessageFormatChange}
                      onSelectionChange={setRepeatSelectedText}
                      label="Текст повторного поста"
                      placeholder="Введите текст повторного рекламного поста... Выделите текст для форматирования или используйте голосовой ввод"
                      minRows={5}
                      onAIEnhance={() => handleEnhanceText('repeat')}
                      isEnhancing={isEnhancingRepeatText}
                    />

                    {/* Fully duplicated Reusable Inline Buttons Builder for Repeat Post */}
                    <InlineButtonsBuilder
                      buttons={repeatInlineButtons}
                      onChange={setRepeatInlineButtons}
                      folderLink={telegramFolderLink}
                      label="Инлайн-кнопки повторного поста (ряды и строки)"
                    />
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-500">
                    Повторный пост отключен. Включите галочку, чтобы настроить отдельный напоминающий пост для участников.
                  </p>
                )}
              </div>

              {/* SECTION 4: CONDITIONS, REMINDERS & RULES */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/80 border border-pink-200 space-y-4 shadow-2xs">
                <h3 className="text-[14px] font-black text-slate-800 border-b border-pink-100 pb-2">
                  4. Параметры папки, часовой пояс, напоминания и правила
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Минимум подписчиков
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minSubscribers}
                      onChange={(e) => setMinSubscribers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-pink-400 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Максимум каналов в папке
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="100"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Math.max(2, parseInt(e.target.value, 10) || 10))}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-pink-400 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Дата и время выхода *
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-pink-400 shadow-2xs"
                      required
                    />
                  </div>
                </div>

                {/* Timezone Selector (Defaults to Europe/Moscow UTC+3) */}
                <div>
                  <label className="text-[14px] font-bold text-slate-800 block mb-1">
                    Часовой пояс папки (по умолчанию UTC+3 МСК)
                  </label>
                  <div className="relative">
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs pr-10"
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                    <Globe className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Reminder and Bot Check Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Напоминание участникам перед стартом
                    </label>
                    <select
                      value={reminderBeforeMinutes}
                      onChange={(e) => setReminderBeforeMinutes(Number(e.target.value))}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs"
                    >
                      {REMINDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[14px] font-bold text-slate-800 block mb-1">
                      Проверка бота в каналах перед стартом
                    </label>
                    <select
                      value={botCheckBeforeMinutes}
                      onChange={(e) => setBotCheckBeforeMinutes(Number(e.target.value))}
                      className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs"
                    >
                      {BOT_CHECK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rules & Instructions with MiniAudioField Voice Dictation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[14px] font-bold text-slate-800">
                      Инструкции и правила размещения
                    </label>
                    <MiniAudioField
                      onTranscript={(t) => setRulesInstruction(t)}
                      currentValue={rulesInstruction}
                      buttonText="Голос"
                      title="Наговорить правила голосом"
                      size="sm"
                    />
                  </div>

                  {/* Quick templates */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_RULES_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl}
                        type="button"
                        onClick={() => setRulesInstruction(tmpl)}
                        className="px-2.5 py-1 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 text-[14px] font-medium border border-pink-200 cursor-pointer transition-all"
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={rulesInstruction}
                    onChange={(e) => setRulesInstruction(e.target.value)}
                    placeholder="Например: Пост должен находиться 48 часов в ленте и 3 часа в топе без перекрытия другими публикациями."
                    rows={2}
                    className="w-full bg-white border border-pink-200 rounded-2xl p-3 text-[14px] text-slate-900 leading-relaxed focus:outline-none focus:border-pink-400 shadow-2xs"
                  />
                </div>
              </div>
            </>
          ) : (
            /* PREVIEW TAB: Accurate live simulated rendering for Telegram */
            <div className="p-4 sm:p-6 rounded-3xl bg-white/80 border border-pink-200 space-y-4 shadow-2xs">
              {/* Switch preview between main post and repeat post */}
              <div className="flex items-center justify-between border-b border-pink-100 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPostTab('main')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                      previewPostTab === 'main'
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                        : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50/50'
                    }`}
                  >
                    Основной пост папки
                  </button>
                  {repeatPostEnabled && (
                    <button
                      type="button"
                      onClick={() => setPreviewPostTab('repeat')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                        previewPostTab === 'repeat'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                          : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50/50'
                      }`}
                    >
                      Повторный пост (напоминание)
                    </button>
                  )}
                </div>

                <span className="text-[14px] font-bold text-slate-500">
                  {previewPostTab === 'main'
                    ? messageFormat === 'v2' ? 'Формат: Markdown V2' : 'Формат: Rich'
                    : repeatMessageFormat === 'v2' ? 'Формат: Markdown V2' : 'Формат: Rich'}
                </span>
              </div>

              {/* Simulated Telegram Message Bubble */}
              <div className="max-w-lg mx-auto rounded-3xl bg-white border border-pink-200 shadow-md p-4 space-y-3">
                {/* Image in natural aspect ratio (deduped if already inside text) */}
                {(() => {
                  const activeImg = previewPostTab === 'main' ? imageUrl : repeatImageUrl;
                  const activeBody = previewPostTab === 'main' ? postText : repeatPostText;
                  const normalizedImg = normalizeProTalkMediaUrl(activeImg) || activeImg;
                  if (!normalizedImg) return null;
                  if (activeBody && (activeBody.includes(activeImg) || activeBody.includes(normalizedImg))) return null;
                  return (
                    <div className="w-full flex justify-center bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 rounded-2xl overflow-hidden p-1 border border-pink-100">
                      <CachedMediaImage
                        src={normalizedImg}
                        alt="Обложка поста"
                        className="max-h-80 w-auto max-w-full rounded-xl object-contain mx-auto shadow-2xs"
                      />
                    </div>
                  );
                })()}

                {/* Formatted Text */}
                <div className="text-[14px] text-slate-900 leading-relaxed font-sans">
                  {previewPostTab === 'main' ? (
                    messageFormat === 'v2' ? (
                      <div className="whitespace-pre-wrap">
                        {renderV2Mode(postText || 'Текст рекламного поста еще не заполнен...', false)}
                      </div>
                    ) : (
                      <RichPreviewRenderer
                        postText={postText || 'Текст рекламного поста еще не заполнен...'}
                      />
                    )
                  ) : (
                    repeatMessageFormat === 'v2' ? (
                      <div className="whitespace-pre-wrap">
                        {renderV2Mode(repeatPostText || 'Текст повторного поста еще не заполнен...', false)}
                      </div>
                    ) : (
                      <RichPreviewRenderer
                        postText={repeatPostText || 'Текст повторного поста еще не заполнен...'}
                      />
                    )
                  )}
                </div>

                {/* Inline Buttons rendered by rows with true styles */}
                {((previewPostTab === 'main' ? inlineButtons : repeatInlineButtons).length > 0) && (
                  <div className="space-y-1.5 pt-2 border-t border-pink-100">
                    {(previewPostTab === 'main' ? inlineButtons : repeatInlineButtons).map((row, rIdx) => (
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

                {/* Timestamp */}
                <div className="flex justify-end text-[14px] text-slate-400 font-medium pt-1">
                  {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-pink-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-white border border-pink-200 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer text-[14px]"
            >
              Отмена
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-7 py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-black shadow-md hover:opacity-95 transition-all cursor-pointer text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <span>{isEdit ? 'Сохранить изменения' : 'Опубликовать папку'}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Select Modal */}
      <GallerySelectModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
        title="Выбор картинки для папки из галереи"
        onSelect={(urls) => {
          if (urls.length > 0) {
            if (galleryTarget === 'main') {
              handleSetImageUrl(urls[0]);
            } else {
              handleSetRepeatImageUrl(urls[0]);
            }
          }
        }}
      />

      {/* Save Template Modal (Requirement 4) */}
      {isTemplateModalOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-sky-950/20 backdrop-blur-md">
          <div className="w-full max-w-md p-5 rounded-3xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 backdrop-blur-md border border-pink-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-pink-200 pb-2">
              <h3 className="text-[16px] font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-600 to-sky-600 bg-clip-text text-transparent">
                {templateSaveType === 'folder' ? 'Сохранить шаблон папки' : 'Сохранить шаблон текста'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/80 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">
                  Название шаблона *
                </label>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={(e) => setTemplateSaveName(e.target.value)}
                  placeholder={templateSaveType === 'folder' ? 'Например: Бизнес папка 10 каналов' : 'Например: Приветственный текст'}
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 font-medium focus:outline-none focus:border-pink-400 shadow-2xs"
                  autoFocus
                />
              </div>

              <p className="text-[14px] text-slate-700 leading-relaxed">
                {templateSaveType === 'folder'
                  ? 'Все параметры папки (название, категории, обложка, текст поста, формат Rich/V2, инлайн-кнопки и правила) будут зафиксированы в базе данных на сервере для быстрого ввода.'
                  : 'Текст поста и выбранный формат разметки будут зафиксированы в базе данных на сервере для быстрой вставки в один клик.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-pink-200">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/90 border border-pink-300 text-slate-700 font-bold text-[14px] hover:bg-pink-50 transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSavingTemplate && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Сохранить в базу данных</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {mediaModalState.isOpen && (
        <ChatMediaModal
          isOpen={mediaModalState.isOpen}
          onClose={() => setMediaModalState(prev => ({ ...prev, isOpen: false }))}
          onApply={handleApplyMediaBlock}
          initialType={mediaModalState.type}
          initialCaption={mediaModalState.caption}
        />
      )}

      {/* UNIFIED IMAGE BUILDER MODAL */}
      <ImageBuilderModal
        isOpen={imageBuilderTarget !== null}
        onClose={() => setImageBuilderTarget(null)}
        title="Генерация картинки"
        editorFormat={imageBuilderTarget === 'repeat' ? repeatMessageFormat : messageFormat}
        defaultTargetMode={imageBuilderTarget === 'main_album' ? 'album' : 'photo'}
        initialPrompt={`Стильная обложка для папки Telegram каналов: "${title || 'Бизнес папка'}". Категория: ${categories[0] || 'Бизнес'}.`}
        userId={String(currentUser?.id || currentUser?.telegramId || '16926299042')}
        userBalance={Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0)}
        onRefreshUser={() => onBalanceUpdated?.(Number(currentUser?.pointsBalance ?? currentUser?.balance ?? 0))}
        onSelectImage={(url) => {
          if (imageBuilderTarget === 'repeat') {
            handleSetRepeatImageUrl(url);
          } else if (imageBuilderTarget === 'main_album') {
            setAlbumUrls(prev => {
              const next = Array.from(new Set([...prev.filter(u => u && u.trim()), url])).slice(0, 10);
              while (next.length < 2) next.push('');
              return next;
            });
            setAttachmentType('album');
            setIsAttachmentsOpen(true);
            setImageUrl(url);
          } else {
            handleSetImageUrl(url);
          }
          setFeedbackMessage({ type: 'success', text: 'Картинка создана и добавлена!' });
          setImageBuilderTarget(null);
        }}
        onSelectImages={(urls, targetMode) => {
          if (!urls || urls.length === 0) return;

          if (imageBuilderTarget === 'repeat') {
            if (repeatMessageFormat === 'rich') {
              let snippet = `![](${urls[0]})`;
              if (targetMode === 'slideshow') {
                snippet = `<tg-slideshow>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-slideshow>`;
              } else if (targetMode === 'collage') {
                snippet = `<tg-collage>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-collage>`;
              }
              setRepeatPostText(prev => (prev.trim() ? `${prev.trim()}\n\n${snippet}` : snippet));
              if (targetMode === 'photo') setRepeatImageUrl(urls[0]);
            } else {
              handleSetRepeatImageUrl(urls[0]);
            }
            setFeedbackMessage({ type: 'success', text: 'Медиа успешно добавлено в повторный пост!' });
            setImageBuilderTarget(null);
            return;
          }

          if (messageFormat === 'v2' || imageBuilderTarget === 'main_album') {
            if (targetMode === 'album' || urls.length > 1 || imageBuilderTarget === 'main_album') {
              const existing = albumUrls.filter(u => u && u.trim());
              const base = existing.length > 0 ? existing : (photoUrl && photoUrl.trim() ? [photoUrl.trim()] : []);
              const updatedAlbum = Array.from(new Set([...base, ...urls])).slice(0, 10);
              while (updatedAlbum.length < 2) updatedAlbum.push('');
              setAlbumUrls(updatedAlbum);
              setAttachmentType('album');
              setPhotoUrl('');
              setImageUrl(updatedAlbum[0] || urls[0]);
              setIsAttachmentsOpen(true);
              setFeedbackMessage({ type: 'success', text: `Альбом папки обновлен (${updatedAlbum.filter(Boolean).length}/10 фото)!` });
            } else {
              setPhotoUrl(urls[0]);
              setAttachmentType('photo');
              handleSetImageUrl(urls[0]);
              setFeedbackMessage({ type: 'success', text: 'Обложка папки установлена!' });
            }
          } else {
            let snippet = `![](${urls[0]})`;
            if (targetMode === 'slideshow') {
              snippet = `<tg-slideshow>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-slideshow>`;
            } else if (targetMode === 'collage') {
              snippet = `<tg-collage>\n${urls.map(u => `![](${u})`).join('\n')}\n</tg-collage>`;
            }
            setPostText(prev => (prev.trim() ? `${prev.trim()}\n\n${snippet}` : snippet));
            setFeedbackMessage({
              type: 'success',
              text:
                targetMode === 'slideshow'
                  ? `Слайдер (${urls.length} фото) вставлен в пост папки!`
                  : targetMode === 'collage'
                  ? `Коллаж (${urls.length} фото) вставлен в пост папки!`
                  : 'Картинка вставлена в пост папки!'
            });
          }
          setImageBuilderTarget(null);
        }}
      />
    </div>
  );
};

export default FolderEditorModal;
