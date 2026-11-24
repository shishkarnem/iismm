import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, FileEdit, Image as ImageIcon, Plus, Sparkles } from 'lucide-react';
import { InlineButtonRow, ScheduleFrequency } from '../types';
import { POST_STYLES, PostStyleItem } from './post-editor/core/postStylesData';
import {
  AI_IMAGE_MODELS,
  BUILTIN_DRAFTS,
  BuiltinTemplateItem,
  DEFAULT_MARKDOWN_V2_TEMPLATE,
  ExtractedUrlInfo,
  PostTelegramEditorProps,
  PromptEditorProps,
  escapeMarkdownV2,
  extractFirstUrl,
  extractHeadingsFromPost
} from './post-editor/core/editorTypesAndTemplates';
import {
  ActiveSelectionStyles,
  FormatSpan,
  detectStylesAtRange,
  findMatchingFormatSpan,
  getAllFormatSpans,
  getStyleDescription
} from './post-editor/core/formatSpanHelpers';
import { isTableDelimiterRow } from './post-editor/core/richBlockParser';
import { useEditorFormattingActions } from './post-editor/core/useEditorFormattingActions';
import {
  RenderMathPreview,
  TelegramLinkPreviewMockup,
  TelegramSpoiler,
  renderFormattedText
} from './post-editor/preview/InlineFormattedRenderer';
import { RichPreviewRenderer } from './post-editor/preview/RichPreviewRenderer';
import { EditorPreviewColumn } from './post-editor/preview/EditorPreviewColumn';
import { EditorBasicParamsSection } from './post-editor/sections/EditorBasicParamsSection';
import {
  EditorAttachmentsSection,
  PostAttachmentType
} from './post-editor/sections/EditorAttachmentsSection';
import { EditorPublicationTextSection } from './post-editor/sections/EditorPublicationTextSection';
import { EditorInlineButtonsSection } from './post-editor/sections/EditorInlineButtonsSection';
import { EditorScheduleSection } from './post-editor/sections/EditorScheduleSection';
import {
  EditorLinkModal,
  EditorQuoteModal
} from './post-editor/modals/EditorLinkAndQuoteModals';
import { EditorMediaModal, RichMediaInsertTab } from './post-editor/modals/EditorMediaModal';
import { EditorRichButtonModal } from './post-editor/modals/rich-constructors/EditorRichButtonModal';
import { EditorTableModal } from './post-editor/modals/EditorTableModal';
import {
  EditorAnchorsModal,
  EditorEmojiTimeModal
} from './post-editor/modals/EditorEmojiFormulaAnchorModals';
import {
  EditorAiProgressOverlay,
  EditorDeleteConfirmModal
} from './post-editor/modals/EditorConfirmAndOverlayModals';
import {
  PostStructureFlags,
  UnifiedPostGeneratorPanel
} from './post-generator/UnifiedPostGeneratorPanel';
import { ImageBuilderModal } from './image-builder/ImageBuilderModal';
import { GallerySelectModal } from './GallerySelectModal';
import { CollapsibleSection } from './ui-kit/CollapsibleSection';
import { GradientSelect } from './ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from './ui-kit/ResponsiveActionBtn';
import {
  createPostEditorPersistenceHandlers,
  normalizeToButtonRows
} from './post-editor/usePostEditorPersistence';
import { NeurosphereLoader } from './loaders/NeurosphereLoader';
import { canUseRazgon } from '../utils/tariff/tariffUtils';
import { getDefaultLocalPlusOneHour, normalizeToLocalDateTimeInput } from '../utils/schedule/localDateTime';
import { usePricingConfig } from '../hooks/usePricingConfig';

function normalizeChannelMatchKey(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^-?\d+$/.test(s)) return s;
  return `@${s.replace(/^@+/, '').toLowerCase()}`;
}

// Public re-exports for external consumers across the codebase
export {
  AI_IMAGE_MODELS,
  DEFAULT_MARKDOWN_V2_TEMPLATE,
  BUILTIN_DRAFTS,
  POST_STYLES,
  escapeMarkdownV2,
  extractFirstUrl,
  extractHeadingsFromPost,
  TelegramLinkPreviewMockup,
  RenderMathPreview,
  TelegramSpoiler,
  renderFormattedText,
  isTableDelimiterRow,
  RichPreviewRenderer,
  getAllFormatSpans,
  findMatchingFormatSpan,
  detectStylesAtRange,
  getStyleDescription
};
export type {
  PostTelegramEditorProps,
  PromptEditorProps,
  ExtractedUrlInfo,
  PostStyleItem,
  ActiveSelectionStyles,
  FormatSpan
};

export const PostTelegramEditor: React.FC<PostTelegramEditorProps> = ({
  currentUser = null,
  telegramId,
  dayRequests,
  channels: externalChannels,
  selectedPostId,
  initialDayRequestId,
  initialNeuroPlanData,
  onClearInitialNeuroPlanData,
  onSaveDayRequest,
  onDeleteDayRequest,
  onPublishToTelegram,
  onBalanceRefresh,
  onBackToPosts,
  onNavigate
}) => {
  const { pricing: dynamicPricing } = usePricingConfig(currentUser?.id);
  const effectiveSelectedPostId = initialDayRequestId ?? selectedPostId ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(effectiveSelectedPostId);
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');

  const [title, setTitle] = useState<string>('');
  const [topic, setTopic] = useState<string>('Блог');
  const [postText, setPostText] = useState<string>('');
  const [messageFormat, setMessageFormat] = useState<'rich' | 'markdown_v2' | 'html'>('markdown_v2');
  const [linkPreviewEnabled, setLinkPreviewEnabled] = useState<boolean>(true);
  const [publishToSocialFeed, setPublishToSocialFeed] = useState<boolean>(true);
  const [publishedBlogSlug, setPublishedBlogSlug] = useState<string | null>(null);

  const defaultUserChannels = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title?: string; username?: string; telegramId?: string; isTeamChannel?: boolean }
    >();
    const currentNormUid = String(currentUser?.id || '').trim();
    if (Array.isArray(externalChannels)) {
      for (const ch of externalChannels) {
        const id = ch.username || (ch.telegramId ? String(ch.telegramId) : ch.id);
        if (!id) continue;
        const cleanLower = String(id).replace(/^@+/, '').toLowerCase();
        if ((cleanLower === 'sav_ai' || cleanLower === 'iirkibot') && !ch.id) continue;
        const isTeamChannel = Boolean(
          currentNormUid &&
            (ch as any).userId &&
            String((ch as any).userId) !== currentNormUid &&
            !(currentNormUid === '16926299042' && String((ch as any).userId) === '169262990')
        );
        map.set(id, {
          id,
          title: ch.name || id,
          username: ch.username,
          telegramId: ch.telegramId ? String(ch.telegramId) : undefined,
          isTeamChannel
        });
      }
    }
    return Array.from(map.values());
  }, [currentUser?.id, externalChannels]);

  const filterToAllowedChannelIds = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const ch of defaultUserChannels) {
      const k1 = normalizeChannelMatchKey(ch.id);
      const k2 = normalizeChannelMatchKey(ch.username);
      const k3 = normalizeChannelMatchKey(ch.telegramId);
      if (k1) lookup.set(k1, ch.id);
      if (k2) lookup.set(k2, ch.id);
      if (k3) lookup.set(k3, ch.id);
    }
    return (candidates: string[]): string[] => {
      const res: string[] = [];
      for (const raw of candidates) {
        const key = normalizeChannelMatchKey(raw);
        const canonical = key ? lookup.get(key) : undefined;
        if (canonical && !res.includes(canonical)) {
          res.push(canonical);
        }
      }
      return res;
    };
  }, [defaultUserChannels]);

  const [selectedChannels, setSelectedChannels] = useState<string[]>(() =>
    defaultUserChannels[0]?.id ? [defaultUserChannels[0].id] : []
  );

  const [attachmentType, setAttachmentType] = useState<PostAttachmentType>('none');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [audioFormat, setAudioFormat] = useState<'audio' | 'voice'>('audio');

  const [inlineButtons, setInlineButtons] = useState<InlineButtonRow[]>([]);
  const [isGeneratingButtons, setIsGeneratingButtons] = useState<boolean>(false);

  const [selectedStyleId, setSelectedStyleId] = useState<string>(POST_STYLES[0]?.id || 'expert');
  const [stylePromptOverride, setStylePromptOverride] = useState<string>('');
  const [requestTemplate, setRequestTemplate] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [maxCharsLimit, setMaxCharsLimit] = useState<number>(1500);
  const [uniquenessMemoryCount, setUniquenessMemoryCount] = useState<number>(5);
  const [structureFlags, setStructureFlags] = useState<PostStructureFlags>({
    includeHeading: true,
    includeLists: true,
    includeChecklist: false,
    includeQuotes: false,
    includeSpoilers: false,
    includeTable: false,
    includeCallout: false,
    includeRichButtons: false
  });
  const [isGeneratingPost, setIsGeneratingPost] = useState<boolean>(false);

  const [triggerEnabled, setTriggerEnabled] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [intervalHours, setIntervalHours] = useState<number>(4);
  const [triggerTime, setTriggerTime] = useState<string>('10:00');
  const [exactDateTime, setExactDateTime] = useState<string>(() =>
    getDefaultLocalPlusOneHour()
  );
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<number>(1);
  const [selectedTimezone, setSelectedTimezone] = useState<string>('Europe/Moscow');
  const [notifyUser, setNotifyUser] = useState<boolean>(true);
  const [sleepModeEnabled, setSleepModeEnabled] = useState<boolean>(false);
  const [sleepStartTime, setSleepStartTime] = useState<string>('23:00');
  const [sleepEndTime, setSleepEndTime] = useState<string>('08:00');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingSend, setIsTestingSend] = useState<boolean>(false);
  const [isPublishingNow, setIsPublishingNow] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState<RichMediaInsertTab>('photo');
  const [mediaSelectionSeed, setMediaSelectionSeed] = useState('');
  const [showEmojiTimeModal, setShowEmojiTimeModal] = useState(false);
  const [emojiTimeTab, setEmojiTimeTab] = useState<'emoji' | 'time' | 'latex'>('emoji');
  const [showAnchorsModal, setShowAnchorsModal] = useState(false);
  const [anchorsTab, setAnchorsTab] = useState<'create' | 'link' | 'tg_ref' | 'footnote'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [imageBuilderState, setImageBuilderState] = useState<{
    open: boolean;
    targetContext: 'cover' | 'album' | 'custom_cb';
    customCallback?: (url: string) => void;
  }>({ open: false, targetContext: 'cover' });

  const [galleryModalState, setGalleryModalState] = useState<{
    open: boolean;
    multiple: boolean;
    allowedMediaTypes?: 'images' | 'images_and_videos' | 'all';
    onPicked?: (urls: string[]) => void;
  }>({ open: false, multiple: false, allowedMediaTypes: 'images' });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const loadedDraftIdRef = useRef<string | null>(null);

  const {
    canUndo,
    canRedo,
    pushToHistory,
    resetHistory,
    handleUndo,
    handleRedo,
    selectedText,
    getSelectionTextSnapshot,
    replaceSelectionWithSnippet,
    activeStyles,
    toolbarPos,
    setToolbarPos,
    updateFloatingToolbarFromSelection,
    applySmartFormat,
    handleTextareaKeyDown
  } = useEditorFormattingActions({
    postText,
    setPostText,
    messageFormat,
    textareaRef,
    toolbarRef
  });

  const existingTopics = useMemo(() => {
    const set = new Set<string>();
    for (const r of dayRequests) {
      if (r.category && r.category.trim()) set.add(r.category.trim().slice(0, 15));
    }
    return Array.from(set);
  }, [dayRequests]);

  useEffect(() => {
    loadedDraftIdRef.current = null;
    setSelectedId(effectiveSelectedPostId);
  }, [effectiveSelectedPostId]);

  useEffect(() => {
    if (!selectedId || loadedDraftIdRef.current === selectedId) return;
    const found = dayRequests.find((d) => d.id === selectedId);
    if (!found) return;
    loadedDraftIdRef.current = found.id;

    setTitle(found.title || '');
    setTopic((found.category || 'Блог').slice(0, 15));
    setPostText(found.postText || '');
    resetHistory(found.postText || '');
    setMessageFormat(found.messageFormat === 'rich' ? 'rich' : 'markdown_v2');
    setRequestTemplate(found.requestTemplate || '');
    setImagePrompt(found.imagePrompt || '');
    setLinkPreviewEnabled(found.linkPreviewEnabled !== false);
    setPublishToSocialFeed(found.publishToSocialFeed !== false);
    setAttachmentType((found.attachmentType as PostAttachmentType) || 'none');
    setAttachmentUrl(found.attachmentUrl || '');
    setAttachmentUrls(Array.isArray(found.attachmentUrls) ? found.attachmentUrls : []);
    setInlineButtons(normalizeToButtonRows(found.inlineButtons));
    if (typeof found.uniquenessMemoryCount === 'number') {
      setUniquenessMemoryCount(found.uniquenessMemoryCount);
    }
    const rawDraftChannels =
      Array.isArray(found.channels) && found.channels.length > 0
        ? found.channels
        : found.channel
        ? [found.channel]
        : [];
    const allowedFromDraft = filterToAllowedChannelIds(rawDraftChannels);
    if (allowedFromDraft.length > 0) {
      setSelectedChannels(allowedFromDraft);
    } else if (defaultUserChannels.length > 0 && rawDraftChannels.length === 0) {
      setSelectedChannels([defaultUserChannels[0].id]);
    } else {
      setSelectedChannels([]);
    }
    if (found.triggerSchedule) {
      const ts = found.triggerSchedule;
      const normalizedExact = normalizeToLocalDateTimeInput(ts.exactDateTime || found.scheduledTime || ((found.status === 'ошибка' || found.status === 'опубликован') ? (found.publishedAt || found.createdAt) : ''));
      setTriggerEnabled(Boolean(ts.enabled || ((found.status === 'опубликован' || found.status === 'ошибка') && Boolean(normalizedExact))));
      if (ts.frequency) setFrequency(ts.frequency);
      if (ts.intervalMinutes) setIntervalMinutes(ts.intervalMinutes);
      if (ts.intervalHours) setIntervalHours(ts.intervalHours);
      if (ts.time) setTriggerTime(ts.time);
      if (normalizedExact) setExactDateTime(normalizedExact);
      if (Array.isArray(ts.daysOfWeek)) setSelectedDaysOfWeek(ts.daysOfWeek);
      if (ts.dayOfMonth) setSelectedDayOfMonth(ts.dayOfMonth);
      if (ts.timezone) setSelectedTimezone(ts.timezone);
      if (typeof ts.notifyUser === 'boolean') setNotifyUser(ts.notifyUser);
      setSleepModeEnabled(Boolean(ts.sleepModeEnabled));
      if (ts.sleepStartTime) setSleepStartTime(ts.sleepStartTime);
      if (ts.sleepEndTime) setSleepEndTime(ts.sleepEndTime);
    }
  }, [selectedId, dayRequests, resetHistory]);

  useEffect(() => {
    if (!initialNeuroPlanData) return;
    setSelectedId(initialNeuroPlanData.id || null);
    setTopic((initialNeuroPlanData.topic || 'Нейроплан').slice(0, 15));
    setTitle(initialNeuroPlanData.title || '');
    setRequestTemplate(initialNeuroPlanData.prompt || '');
    if (initialNeuroPlanData.messageFormat) {
      setMessageFormat(initialNeuroPlanData.messageFormat === 'rich' ? 'rich' : 'markdown_v2');
    }
    if (initialNeuroPlanData.postStyle) {
      setSelectedStyleId(initialNeuroPlanData.postStyle);
    }
    if (initialNeuroPlanData.channels?.length) {
      const validNp = filterToAllowedChannelIds(initialNeuroPlanData.channels);
      setSelectedChannels(validNp);
    }
    if (initialNeuroPlanData.time) {
      setTriggerTime(initialNeuroPlanData.time);
      setTriggerEnabled(true);
    }
    onClearInitialNeuroPlanData?.();
  }, [initialNeuroPlanData, onClearInitialNeuroPlanData, filterToAllowedChannelIds]);

  // Keep selectedChannels synchronized with user/team owned channels
  useEffect(() => {
    setSelectedChannels((prev) => {
      const filtered = filterToAllowedChannelIds(prev);
      if (filtered.length !== prev.length || filtered.some((v, idx) => v !== prev[idx])) {
        return filtered;
      }
      if (filtered.length === 0 && !selectedId && defaultUserChannels.length > 0 && prev.length === 0) {
        return [defaultUserChannels[0].id];
      }
      return prev;
    });
  }, [defaultUserChannels, filterToAllowedChannelIds, selectedId]);

  const hasRazgonTariff = Boolean(
    currentUser?.id === '16926299042' ||
      canUseRazgon(currentUser?.tariff, currentUser?.role)
  );

  const handleCreateFreshPost = () => {
    loadedDraftIdRef.current = '__fresh__';
    setSelectedId(null);
    setTitle('');
    setPostText('');
    resetHistory('');
    setAttachmentType('none');
    setAttachmentUrl('');
    setAttachmentUrls([]);
    setInlineButtons([]);
    setTriggerEnabled(false);
    setExactDateTime(getDefaultLocalPlusOneHour());
    setPublishToSocialFeed(true);
    setPublishedBlogSlug(null);
    setStatusMessage({ type: 'info', text: 'Открыт чистый бланк новой публикации' });
  };

  const {
    handleGeneratePostNow,
    handleGenerateAiButtons,
    handleSaveDraft,
    handleTestSendDm,
    handlePublishNow
  } = createPostEditorPersistenceHandlers({
    currentUser,
    telegramId,
    selectedId,
    setSelectedId,
    title,
    setTitle,
    topic,
    postText,
    setPostText,
    pushToHistory,
    messageFormat,
    requestTemplate,
    imagePrompt,
    setImagePrompt,
    maxCharsLimit,
    uniquenessMemoryCount,
    hasRazgonTariff,
    structureFlags,
    linkPreviewEnabled,
    publishToSocialFeed,
    setPublishedBlogSlug,
    selectedChannels,
    attachmentType,
    attachmentUrl,
    attachmentUrls,
    audioFormat,
    inlineButtons,
    setInlineButtons,
    scheduleConfig: {
      frequency,
      intervalMinutes,
      intervalHours,
      triggerTime,
      exactDateTime,
      selectedTimezone,
      selectedDaysOfWeek,
      selectedDayOfMonth,
      triggerEnabled,
      notifyUser,
      sleepModeEnabled,
      sleepStartTime,
      sleepEndTime
    },
    onSaveDayRequest,
    onPublishToTelegram,
    onBalanceRefresh,
    onMarkDraftLoaded: (id: string) => {
      loadedDraftIdRef.current = id;
    },
    selectedPostStatus: dayRequests.find((d) => d.id === selectedId)?.status,
    setStatusMessage,
    setIsGeneratingPost,
    setIsGeneratingButtons,
    setIsSaving,
    setIsTestingSend,
    setIsPublishingNow
  });

  const handleConfirmDelete = async () => {
    if (!selectedId || !onDeleteDayRequest) return;
    setIsDeleting(true);
    try {
      await onDeleteDayRequest(selectedId);
      setShowDeleteModal(false);
      handleCreateFreshPost();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8 min-w-0">
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToPosts && (
              <ResponsiveActionBtn
                icon={<ArrowLeft size={17} />}
                label="К списку постов"
                variant="outline"
                onClick={onBackToPosts}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-[17px] sm:text-[19px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent truncate">
                Конструктор публикации
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dayRequests.length > 0 && (
              <div className="w-48 sm:w-64">
                <GradientSelect
                  compact
                  value={selectedId || ''}
                  placeholder="Выбрать черновик..."
                  onChange={(id) => {
                    const found = dayRequests.find((d) => d.id === id);
                    if (found) setSelectedId(found.id);
                  }}
                  options={dayRequests.map((d) => ({
                    value: d.id,
                    label: d.title || d.category || 'Без названия',
                    meta: d.category
                  }))}
                />
              </div>
            )}
            <ResponsiveActionBtn
              icon={<Plus size={17} />}
              label="Новый пост"
              title="Очистить форму для создания нового поста"
              variant="vivid"
              onClick={handleCreateFreshPost}
            />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <GradientSelect
          value={mobilePane}
          onChange={(v) => setMobilePane(v as 'editor' | 'preview')}
          buttonVariant="vivid"
          options={[
            {
              value: 'editor',
              label: 'Режим: Настройка и текст поста',
              icon: <FileEdit size={16} />
            },
            {
              value: 'preview',
              label: 'Режим: Предпросмотр и отправка',
              icon: <Eye size={16} />
            }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start min-w-0">
        <div
          className={`lg:col-span-7 space-y-4 min-w-0 ${
            mobilePane === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          <EditorBasicParamsSection
            title={title}
            onChangeTitle={setTitle}
            topic={topic}
            onChangeTopic={setTopic}
            existingTopics={existingTopics}
            messageFormat={messageFormat}
            onChangeMessageFormat={(fmt) => {
              setMessageFormat(fmt);
              if (fmt === 'rich' && maxCharsLimit <= 1500) setMaxCharsLimit(5000);
              else if (fmt !== 'rich' && maxCharsLimit > (attachmentType !== 'none' ? 1024 : 4096)) {
                setMaxCharsLimit(attachmentType !== 'none' ? 1024 : 2500);
              }
            }}
            selectedChannels={selectedChannels}
            onChangeSelectedChannels={(chs) => setSelectedChannels(filterToAllowedChannelIds(chs))}
            availableChannels={defaultUserChannels}
            onNavigateToChannels={onNavigate ? () => onNavigate('/channels') : undefined}
          />

          <CollapsibleSection
            title="Нейрогенератор поста и картинки"
            summary="Единый модуль генерации текста и визуала (модели 787, 621, 784, 791)"
            icon={<Sparkles size={17} />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <UnifiedPostGeneratorPanel
                messageFormat={messageFormat === 'rich' ? 'rich' : 'v2'}
                hasMediaAttachment={attachmentType !== 'none'}
                selectedStyleId={selectedStyleId}
                onSelectStyleId={setSelectedStyleId}
                stylePromptOverride={stylePromptOverride}
                onStylePromptOverrideChange={setStylePromptOverride}
                promptValue={requestTemplate}
                onPromptValueChange={setRequestTemplate}
                maxChars={maxCharsLimit}
                onMaxCharsChange={setMaxCharsLimit}
                uniquenessMemoryCount={uniquenessMemoryCount}
                onUniquenessMemoryCountChange={setUniquenessMemoryCount}
                hasRazgonTariff={hasRazgonTariff}
                onRequireRazgon={() => onNavigate?.('/tarif')}
                structureFlags={structureFlags}
                onStructureFlagsChange={setStructureFlags}
                onGenerateNow={handleGeneratePostNow}
                isGenerating={isGeneratingPost}
                costIirky={dynamicPricing.textAi.postGeneration}
                userId={currentUser?.id}
                telegramId={telegramId || currentUser?.telegramId}
              />

              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-slate-900">
                    Единый нейроконструктор картинок и инфографики
                  </div>
                  <div className="text-[14px] text-slate-700 leading-snug">
                    Модели 787 · 621 · 784 · 791 (кириллица без ограничений и до 16 референсов)
                  </div>
                </div>
                <ResponsiveActionBtn
                  icon={<ImageIcon size={17} />}
                  label="Открыть генератор картинок"
                  alwaysShowLabel
                  variant="vivid"
                  onClick={() =>
                    setImageBuilderState({
                      open: true,
                      targetContext: attachmentType === 'album' ? 'album' : 'cover'
                    })
                  }
                />
              </div>
            </div>
          </CollapsibleSection>

          <EditorAttachmentsSection
            messageFormat={messageFormat}
            attachmentType={attachmentType}
            onChangeAttachmentType={setAttachmentType}
            attachmentUrl={attachmentUrl}
            onChangeAttachmentUrl={setAttachmentUrl}
            attachmentUrls={attachmentUrls}
            onChangeAttachmentUrls={setAttachmentUrls}
            audioFormat={audioFormat}
            onChangeAudioFormat={setAudioFormat}
            onOpenGallerySingle={() =>
              setGalleryModalState({
                open: true,
                multiple: false,
                allowedMediaTypes:
                  attachmentType === 'photo'
                    ? 'images'
                    : attachmentType === 'album'
                    ? 'images_and_videos'
                    : 'all',
                onPicked: (urls) => {
                  if (urls[0]) setAttachmentUrl(urls[0]);
                }
              })
            }
            onOpenGalleryAlbum={() =>
              setGalleryModalState({
                open: true,
                multiple: true,
                allowedMediaTypes: 'images_and_videos',
                onPicked: (urls) => {
                  setAttachmentUrls((prev) => [...prev, ...urls].slice(0, 10));
                }
              })
            }
            onOpenImageBuilderForCover={() =>
              setImageBuilderState({ open: true, targetContext: 'cover' })
            }
            onOpenImageBuilderForAlbum={() =>
              setImageBuilderState({ open: true, targetContext: 'album' })
            }
          />

          <EditorPublicationTextSection
            postText={postText}
            onChangePostText={(next) => {
              setPostText(next);
              pushToHistory(next);
            }}
            messageFormat={messageFormat}
            hasAttachment={attachmentType !== 'none'}
            linkPreviewEnabled={linkPreviewEnabled}
            onChangeLinkPreviewEnabled={setLinkPreviewEnabled}
            onApplyTemplate={(tpl: BuiltinTemplateItem) => {
              setMessageFormat(tpl.format);
              setTopic(tpl.category.slice(0, 15));
              setTitle(tpl.postTitle);
              setPostText(tpl.content);
              pushToHistory(tpl.content);
            }}
            textareaRef={textareaRef}
            toolbarRef={toolbarRef}
            toolbarPos={toolbarPos}
            selectedText={selectedText}
            activeStyles={activeStyles}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearText={() => {
              setPostText('');
              pushToHistory('');
            }}
            onApplyFormat={applySmartFormat}
            onSelectionChange={updateFloatingToolbarFromSelection}
            onKeyDown={handleTextareaKeyDown}
            onCloseToolbar={() => setToolbarPos(null)}
            onOpenLinkModal={() => setShowLinkModal(true)}
            onOpenQuoteModal={() => setShowQuoteModal(true)}
            onOpenTableModal={() => setShowTableModal(true)}
            onOpenMediaModal={(tab) => {
              setMediaSelectionSeed(getSelectionTextSnapshot());
              setMediaModalTab(tab || 'photo');
              setShowMediaModal(true);
            }}
            onOpenButtonModal={() => setShowButtonModal(true)}
            onOpenEmojiTimeModal={(tab) => {
              setEmojiTimeTab(tab || 'emoji');
              setShowEmojiTimeModal(true);
            }}
            onOpenAnchorModal={(tab) => {
              setAnchorsTab(tab || 'create');
              setShowAnchorsModal(true);
            }}
          />

          <EditorInlineButtonsSection
            userId={currentUser?.id}
            inlineButtons={inlineButtons}
            onChangeInlineButtons={setInlineButtons}
            isGeneratingButtons={isGeneratingButtons}
            onGenerateAiButtons={handleGenerateAiButtons}
          />

          <EditorScheduleSection
            triggerEnabled={triggerEnabled}
            onChangeTriggerEnabled={setTriggerEnabled}
            frequency={frequency}
            onChangeFrequency={setFrequency}
            intervalMinutes={intervalMinutes}
            onChangeIntervalMinutes={setIntervalMinutes}
            intervalHours={intervalHours}
            onChangeIntervalHours={setIntervalHours}
            triggerTime={triggerTime}
            onChangeTriggerTime={setTriggerTime}
            exactDateTime={exactDateTime}
            onChangeExactDateTime={setExactDateTime}
            selectedDaysOfWeek={selectedDaysOfWeek}
            onChangeSelectedDaysOfWeek={setSelectedDaysOfWeek}
            selectedDayOfMonth={selectedDayOfMonth}
            onChangeSelectedDayOfMonth={setSelectedDayOfMonth}
            selectedTimezone={selectedTimezone}
            onChangeSelectedTimezone={setSelectedTimezone}
            notifyUser={notifyUser}
            onChangeNotifyUser={setNotifyUser}
            sleepModeEnabled={sleepModeEnabled}
            onChangeSleepModeEnabled={setSleepModeEnabled}
            sleepStartTime={sleepStartTime}
            onChangeSleepStartTime={setSleepStartTime}
            sleepEndTime={sleepEndTime}
            onChangeSleepEndTime={setSleepEndTime}
          />
        </div>

        <div
          className={`lg:col-span-5 min-w-0 ${
            mobilePane === 'editor' ? 'hidden lg:block' : 'block'
          }`}
        >
          <EditorPreviewColumn
            title={title}
            postText={postText}
            messageFormat={messageFormat}
            selectedChannels={selectedChannels}
            linkPreviewEnabled={linkPreviewEnabled}
            onDisableLinkPreview={() => setLinkPreviewEnabled(false)}
            attachmentType={attachmentType}
            attachmentUrl={attachmentUrl}
            attachmentUrls={attachmentUrls}
            inlineButtons={inlineButtons}
            publishToSocialFeed={publishToSocialFeed}
            onChangePublishToSocialFeed={setPublishToSocialFeed}
            publishedBlogSlug={publishedBlogSlug}
            onNavigate={onNavigate}
            statusMessage={statusMessage}
            onClearStatusMessage={() => setStatusMessage(null)}
            isSaving={isSaving}
            isTestingSend={isTestingSend}
            isPublishingNow={isPublishingNow}
            hasSelectedDraft={Boolean(selectedId)}
            isScheduledOrAutopost={triggerEnabled}
            onSaveDraft={handleSaveDraft}
            onTestSendDm={handleTestSendDm}
            onPublishNow={handlePublishNow}
            onRequestDeleteDraft={
              selectedId && onDeleteDayRequest ? () => setShowDeleteModal(true) : undefined
            }
          />
        </div>
      </div>

      <ImageBuilderModal
        isOpen={imageBuilderState.open}
        onClose={() => setImageBuilderState((prev) => ({ ...prev, open: false }))}
        editorFormat={messageFormat === 'rich' ? 'rich' : 'v2'}
        defaultTargetMode={imageBuilderState.targetContext === 'album' ? 'album' : 'photo'}
        initialPrompt={imagePrompt || title || requestTemplate}
        userId={currentUser?.id}
        userBalance={currentUser?.balance}
        onRefreshUser={onBalanceRefresh}
        onSelectImage={(url) => {
          if (imageBuilderState.targetContext === 'custom_cb' && imageBuilderState.customCallback) {
            imageBuilderState.customCallback(url);
            return;
          }
          if (messageFormat === 'rich') {
            replaceSelectionWithSnippet(`\n![${title || 'Иллюстрация'}](${url})\n`);
          } else {
            setAttachmentType('photo');
            setAttachmentUrl(url);
          }
        }}
        onSelectImages={(urls, targetMode) => {
          if (!urls.length) return;
          if (imageBuilderState.targetContext === 'custom_cb' && imageBuilderState.customCallback) {
            imageBuilderState.customCallback(urls[0]);
            return;
          }
          if (messageFormat === 'rich') {
            if (urls.length === 1 || targetMode === 'photo') {
              replaceSelectionWithSnippet(`\n![${title || 'Иллюстрация'}](${urls[0]})\n`);
            } else {
              const tag = targetMode === 'collage' ? 'tg-collage' : 'tg-slideshow';
              const body = urls.map((u, idx) => `![Кадр ${idx + 1}](${u})`).join('\n');
              replaceSelectionWithSnippet(`\n<${tag}>\n${body}\n</${tag}>\n`);
            }
          } else if (urls.length > 1 || targetMode === 'album') {
            setAttachmentType('album');
            setAttachmentUrls((prev) => [...prev, ...urls].slice(0, 10));
          } else {
            setAttachmentType('photo');
            setAttachmentUrl(urls[0]);
          }
        }}
      />

      <GallerySelectModal
        isOpen={galleryModalState.open}
        onClose={() => setGalleryModalState((prev) => ({ ...prev, open: false }))}
        multiple={galleryModalState.multiple}
        allowedMediaTypes={galleryModalState.allowedMediaTypes || 'images'}
        maxCount={10}
        userId={currentUser?.id}
        onSelect={(urls) => {
          galleryModalState.onPicked?.(urls);
          setGalleryModalState((prev) => ({ ...prev, open: false }));
        }}
      />

      <EditorLinkModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        initialText={selectedText}
        onInsertLink={(mdLink) => replaceSelectionWithSnippet(mdLink)}
      />

      <EditorQuoteModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        initialText={selectedText}
        isRich={messageFormat === 'rich'}
        onInsertQuote={(q) => replaceSelectionWithSnippet(q)}
      />

      <EditorTableModal
        open={showTableModal}
        onClose={() => setShowTableModal(false)}
        onInsertTable={(tbl) => replaceSelectionWithSnippet(tbl)}
      />

      <EditorMediaModal
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        initialTab={mediaModalTab}
        selectedText={mediaSelectionSeed}
        userId={currentUser?.id}
        onInsertMediaMarkup={(markup) => replaceSelectionWithSnippet(markup)}
        onOpenGalleryForItem={(cb, filter) =>
          setGalleryModalState({
            open: true,
            multiple: false,
            allowedMediaTypes: filter || 'images',
            onPicked: (urls) => {
              if (urls[0]) cb(urls[0]);
            }
          })
        }
        onOpenGalleryMultiple={(cb, filter) =>
          setGalleryModalState({
            open: true,
            multiple: true,
            allowedMediaTypes: filter || 'images_and_videos',
            onPicked: (urls) => {
              if (urls.length > 0) cb(urls);
            }
          })
        }
        onOpenImageBuilderForItem={(cb) =>
          setImageBuilderState({
            open: true,
            targetContext: 'custom_cb',
            customCallback: cb
          })
        }
      />

      <EditorRichButtonModal
        open={showButtonModal}
        onClose={() => setShowButtonModal(false)}
        initialText={selectedText}
        onInsertButtonMarkup={(markup) => replaceSelectionWithSnippet(markup)}
      />

      <EditorEmojiTimeModal
        open={showEmojiTimeModal}
        onClose={() => setShowEmojiTimeModal(false)}
        initialTab={emojiTimeTab}
        onInsertSnippet={(snip) => replaceSelectionWithSnippet(snip)}
      />

      <EditorAnchorsModal
        open={showAnchorsModal}
        onClose={() => setShowAnchorsModal(false)}
        initialTab={anchorsTab}
        postText={postText}
        onInsertAnchorMarkup={(snip, appendAtEnd) => {
          replaceSelectionWithSnippet(snip);
          if (appendAtEnd) {
            setPostText((prev) => prev + appendAtEnd);
          }
        }}
      />

      <EditorDeleteConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        postTitle={title}
        isDeleting={isDeleting}
        onConfirmDelete={handleConfirmDelete}
      />

      <EditorAiProgressOverlay open={isGeneratingPost} />
      {(isSaving || isPublishingNow || isGeneratingButtons) && (
        <NeurosphereLoader
          variant="viewport"
          label={
            isPublishingNow
              ? 'Отправка публикации в каналы...'
              : isGeneratingButtons
              ? 'Нейросеть подбирает инлайн-кнопки...'
              : 'Сохранение публикации в базу данных...'
          }
        />
      )}
    </div>
  );
};

export { PostTelegramEditor as PromptEditor };
export default PostTelegramEditor;
