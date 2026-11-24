import { InlineButtonRow, ScheduleFrequency } from '../../types';
import { ensureTitleHeadingInPostText } from './core/editorTypesAndTemplates';
import { PostAttachmentType } from './sections/EditorAttachmentsSection';
import { GenerateAiButtonsPayload } from './sections/EditorInlineButtonsSection';
import { PostStructureFlags } from '../post-generator/UnifiedPostGeneratorPanel';
import { isPastLocalDateTime, parseLocalDateTimeInput } from '../../utils/schedule/localDateTime';

let isDraftSaveInFlight = false;

function normalizeButtonStyle(style: any): 'default' | 'primary' | 'success' | 'danger' {
  if (style === 'success' || style === 'danger' || style === 'primary') {
    return style;
  }
  return 'default';
}

export function normalizeToButtonRows(raw: any): InlineButtonRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw[0] && typeof raw[0] === 'object' && Array.isArray(raw[0].buttons)) {
    return raw.map((r: any, rIdx: number) => ({
      id: r.id || `row_${rIdx}`,
      buttons: (r.buttons || []).map((b: any, bIdx: number) => ({
        id: b.id || `btn_${rIdx}_${bIdx}`,
        text: b.text || 'Кнопка',
        type: b.type || 'url',
        value: b.value || b.url || b.callbackData || 'https://t.me/IIrkiBot',
        url: b.url || b.value,
        iconEmoji: b.iconEmoji,
        style: normalizeButtonStyle(b.style)
      }))
    }));
  }
  if (Array.isArray(raw[0])) {
    return raw
      .filter((row: any) => Array.isArray(row) && row.length > 0)
      .map((row: any[], rIdx: number) => ({
        id: `row_${rIdx}_${Date.now()}`,
        buttons: row.map((b: any, bIdx: number) => ({
          id: b.id || `btn_${rIdx}_${bIdx}`,
          text: b.text || 'Кнопка',
          type: b.type || 'url',
          value: b.value || b.url || b.callbackData || 'https://t.me/IIrkiBot',
          url: b.url || b.value,
          iconEmoji: b.iconEmoji,
          style: normalizeButtonStyle(b.style)
        }))
      }));
  }
  return raw.map((b: any, idx: number) => ({
    id: `row_${idx}_${Date.now()}`,
    buttons: [
      {
        id: b.id || `btn_${idx}`,
        text: b.text || 'Кнопка',
        type: b.type || 'url',
        value: b.value || b.url || b.callbackData || 'https://t.me/IIrkiBot',
        url: b.url || b.value,
        iconEmoji: b.iconEmoji,
        style: normalizeButtonStyle(b.style)
      }
    ]
  }));
}

export function serializeButtonRowsTo2D(rows: InlineButtonRow[]) {
  return rows
    .filter((r) => Array.isArray(r.buttons) && r.buttons.length > 0)
    .map((r) =>
      r.buttons.map((b) => {
        const hasTelegramColorStyle =
          b.style === 'success' || b.style === 'danger' || b.style === 'primary';
        return {
          id: b.id,
          text: b.text || 'Кнопка',
          type: (b.type === 'web_app' ? 'webapp' : b.type === 'copy_text' ? 'callback' : b.type) as
            | 'url'
            | 'callback'
            | 'webapp',
          url: b.value || b.url || 'https://t.me/IIrkiBot',
          callbackData: b.type === 'callback' || b.type === 'copy_text' ? b.value : undefined,
          ...(hasTelegramColorStyle ? { style: b.style } : {})
        };
      })
    );
}

interface UsePostEditorPersistenceArgs {
  currentUser: any;
  telegramId?: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  title: string;
  setTitle: (v: string) => void;
  topic: string;
  postText: string;
  setPostText: (v: string) => void;
  pushToHistory: (v: string) => void;
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  requestTemplate: string;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  maxCharsLimit: number;
  uniquenessMemoryCount: number;
  hasRazgonTariff: boolean;
  structureFlags: PostStructureFlags;
  linkPreviewEnabled: boolean;
  publishToSocialFeed: boolean;
  setPublishedBlogSlug: (slug: string | null) => void;
  selectedChannels: string[];
  attachmentType: PostAttachmentType;
  attachmentUrl: string;
  attachmentUrls: string[];
  audioFormat: 'audio' | 'voice';
  inlineButtons: InlineButtonRow[];
  setInlineButtons: (rows: InlineButtonRow[]) => void;
  scheduleConfig: {
    frequency: ScheduleFrequency;
    intervalMinutes: number;
    intervalHours: number;
    triggerTime: string;
    exactDateTime: string;
    selectedTimezone: string;
    selectedDaysOfWeek: number[];
    selectedDayOfMonth: number;
    triggerEnabled: boolean;
    notifyUser: boolean;
    sleepModeEnabled: boolean;
    sleepStartTime: string;
    sleepEndTime: string;
  };
  onSaveDayRequest: (req: any) => Promise<any>;
  onPublishToTelegram: (title: string, content: string, id: string, opts?: any) => Promise<any>;
  onBalanceRefresh?: () => Promise<void> | void;
  onMarkDraftLoaded?: (id: string) => void;
  selectedPostStatus?: string;
  setStatusMessage: (msg: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
  setIsGeneratingPost: (v: boolean) => void;
  setIsGeneratingButtons: (v: boolean) => void;
  setIsSaving: (v: boolean) => void;
  setIsTestingSend: (v: boolean) => void;
  setIsPublishingNow: (v: boolean) => void;
}

export function createPostEditorPersistenceHandlers(args: UsePostEditorPersistenceArgs) {
  const syncToBlogIfEnabled = async () => {
    if (!args.publishToSocialFeed || !args.currentUser?.id) return;
    try {
      const res = await fetch('/api/blog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: args.currentUser.id,
          userName: args.currentUser.firstName || args.currentUser.username || 'Автор',
          userAvatar: args.currentUser.photoUrl || '',
          title: args.title || 'Публикация',
          content: args.postText,
          attachmentType: args.attachmentType,
          attachmentUrl: args.attachmentUrl,
          attachmentUrls: args.attachmentUrls,
          inlineButtons: serializeButtonRowsTo2D(args.inlineButtons),
          messageFormat: args.messageFormat === 'rich' ? 'rich' : 'v2',
          category: args.topic,
          channel: args.selectedChannels[0] || '',
          prompt: args.requestTemplate
        })
      });
      const data = await res.json();
      if (data?.post?.slug) {
        args.setPublishedBlogSlug(data.post.slug);
      }
    } catch (err) {
      console.error('Blog sync error:', err);
    }
  };

  const handleGeneratePostNow = async (resolvedStyleTitle: string, resolvedStylePrompt: string) => {
    if (!args.requestTemplate.trim() && !args.title.trim()) {
      args.setStatusMessage({
        type: 'error',
        text: 'Укажите тему, идею или заголовок поста для запуска нейрогенерации.'
      });
      return;
    }

    args.setIsGeneratingPost(true);
    args.setStatusMessage(null);
    try {
      const structHints: string[] = [];
      if (args.structureFlags.includeHeading) structHints.push('выразительный заголовок # и подзаголовки ##');
      if (args.structureFlags.includeLists) structHints.push('структурированные списки');
      if (args.structureFlags.includeChecklist) structHints.push('чек-лист с галочками (- [ ] / - [x])');
      if (args.structureFlags.includeQuotes) {
        structHints.push(
          args.messageFormat === 'rich'
            ? 'цитату (> или <blockquote expandable>...</blockquote>)'
            : 'цитату с ключевой мыслью'
        );
      }
      if (args.structureFlags.includeSpoilers) {
        structHints.push(
          args.messageFormat === 'rich'
            ? 'скрытый спойлер (<details><summary>...</summary>...</details>)'
            : 'интригующий спойлер ||...||'
        );
      }
      if (args.messageFormat === 'rich' && args.structureFlags.includeTable) {
        structHints.push('сводную markdown-таблицу');
      }
      if (args.structureFlags.includeCallout) {
        structHints.push(
          args.messageFormat === 'rich'
            ? 'акцентную выноску (<aside>...</aside>) и вывод'
            : 'сильный практический вывод'
        );
      }
      if (args.messageFormat === 'rich' && args.structureFlags.includeRichButtons) {
        structHints.push('инлайн-кнопки внутри текста (<tg-button-row align="center">...</tg-button-row>)');
      }

      const enrichedTemplate =
        structHints.length > 0
          ? `${args.requestTemplate || args.title}\n\nТребования к структуре: добавь ${structHints.join(', ')}.`
          : args.requestTemplate || args.title;

      const res = await fetch('/api/protalk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: args.topic || 'Блог',
          dayOfWeek: 'Сегодня',
          requestTemplate: enrichedTemplate,
          title: args.title,
          currentText: args.postText,
          maxChars: args.maxCharsLimit,
          messageFormat: args.messageFormat,
          postStyle: resolvedStyleTitle,
          styleDesc: resolvedStylePrompt,
          structureFlags: args.structureFlags,
          uniquenessMemoryCount: args.hasRazgonTariff ? args.uniquenessMemoryCount : 0,
          userId: args.currentUser?.id,
          telegramId: args.telegramId || args.currentUser?.telegramId
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Не удалось сгенерировать текст публикации');
      }

      const resolvedTitle = args.title.trim() ? args.title : data.title || '';
      if (data.title && !args.title.trim()) {
        args.setTitle(data.title);
      }
      if (data.content) {
        const withHeading = ensureTitleHeadingInPostText(data.content, resolvedTitle);
        args.setPostText(withHeading);
        args.pushToHistory(withHeading);
      }
      if (data.imagePrompt) {
        args.setImagePrompt(data.imagePrompt);
      }

      await args.onBalanceRefresh?.();
      args.setStatusMessage({
        type: 'success',
        text: 'Текст публикации готов! При желании откройте нейроконструктор картинки ниже.'
      });
    } catch (err: any) {
      args.setStatusMessage({
        type: 'error',
        text: err?.message || 'Ошибка при обращении к сервису генерации'
      });
    } finally {
      args.setIsGeneratingPost(false);
    }
  };

  const handleGenerateAiButtons = async (payload: GenerateAiButtonsPayload) => {
    if (!args.postText.trim() && !args.title.trim()) {
      args.setStatusMessage({
        type: 'error',
        text: 'Сначала напишите или сгенерируйте текст поста, чтобы подобрать кнопки по смыслу.'
      });
      return;
    }

    const perRow =
      payload.layoutRule === '3_per_row' ? 3 : payload.layoutRule === '2_per_row' ? 2 : 1;

    args.setIsGeneratingButtons(true);
    try {
      const res = await fetch('/api/scenarios/generate-inline-buttons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: args.currentUser?.id,
          postTitle: args.title,
          postText: args.postText,
          buttonsCount: payload.count,
          buttonsPerRow: perRow,
          layoutRule: payload.layoutRule,
          customInstruction: payload.customInstruction,
          customPrompt: payload.customPrompt,
          defaultUrl: payload.defaultUrl || 'https://t.me/IIrkiBot',
          existingRows: serializeButtonRowsTo2D(args.inlineButtons)
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Не удалось сгенерировать кнопки');
      }
      if (Array.isArray(data.inlineButtons)) {
        args.setInlineButtons(normalizeToButtonRows(data.inlineButtons));
      }
      await args.onBalanceRefresh?.();
      args.setStatusMessage({
        type: 'success',
        text: 'Инлайн-кнопки успешно подобраны и разложены по строкам'
      });
    } catch (err: any) {
      args.setStatusMessage({
        type: 'error',
        text: err?.message || 'Ошибка генерации инлайн-кнопок'
      });
    } finally {
      args.setIsGeneratingButtons(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isDraftSaveInFlight) return;
    const sc = args.scheduleConfig;
    const isOneOff = sc.frequency === 'once' || (sc.frequency as string) === 'exact_date';

    const isPreservedPublished =
      sc.triggerEnabled &&
      isOneOff &&
      args.selectedPostStatus === 'опубликован' &&
      isPastLocalDateTime(sc.exactDateTime);

    if (sc.triggerEnabled && isOneOff && isPastLocalDateTime(sc.exactDateTime) && !isPreservedPublished) {
      args.setStatusMessage({
        type: 'error',
        text: 'Нельзя запланировать публикацию на прошедшие дату и время. Выберите дату и время в будущем.'
      });
      return;
    }

    isDraftSaveInFlight = true;
    args.setIsSaving(true);
    args.setStatusMessage(null);
    try {
      const effectivePostText = ensureTitleHeadingInPostText(args.postText, args.title, args.messageFormat);
      if (effectivePostText !== args.postText) {
        args.setPostText(effectivePostText);
        args.pushToHistory(effectivePostText);
      }
      const parsedExact = isOneOff ? parseLocalDateTimeInput(sc.exactDateTime) : null;
      const savedRes = await args.onSaveDayRequest({
        id: args.selectedId || undefined,
        status: isPreservedPublished ? 'опубликован' : sc.triggerEnabled ? 'запланирован' : 'создается',
        category: (args.topic || 'Блог').slice(0, 15),
        title: args.title.trim() || 'Черновик поста',
        signature: '',
        requestTemplate: args.requestTemplate,
        imagePrompt: args.imagePrompt,
        postText: effectivePostText,
        messageFormat: args.messageFormat === 'rich' ? 'rich' : 'v2',
        uppercaseHeader: false,
        linkPreviewEnabled: args.linkPreviewEnabled,
        channel: args.selectedChannels[0] || '',
        channels: args.selectedChannels,
        attachmentType: args.attachmentType,
        attachmentUrl: args.attachmentUrl,
        attachmentUrls: args.attachmentUrls,
        audioFormat: args.audioFormat,
        inlineButtons: serializeButtonRowsTo2D(args.inlineButtons),
        uniquenessMemoryCount: args.uniquenessMemoryCount,
        publishToSocialFeed: args.publishToSocialFeed,
        exactDateEpochMs: parsedExact ? parsedExact.getTime() : undefined,
        triggerSchedule: {
          frequency: sc.frequency,
          intervalMinutes: sc.intervalMinutes,
          intervalHours: sc.intervalHours,
          time: sc.triggerTime,
          exactDateTime: sc.exactDateTime,
          timezone: sc.selectedTimezone,
          daysOfWeek: sc.selectedDaysOfWeek,
          dayOfMonth: sc.selectedDayOfMonth,
          enabled: sc.triggerEnabled,
          notifyUser: sc.notifyUser,
          sleepModeEnabled: sc.sleepModeEnabled,
          sleepStartTime: sc.sleepStartTime,
          sleepEndTime: sc.sleepEndTime
        }
      });
      const resolvedId = typeof savedRes === 'string' ? savedRes : savedRes?.id;
      if (resolvedId) {
        args.onMarkDraftLoaded?.(resolvedId);
        args.setSelectedId(resolvedId);
      }
      args.setStatusMessage({
        type: 'success',
        text: sc.triggerEnabled
          ? 'Публикация сохранена в отложенный постинг'
          : 'Публикация и настройки расписания сохранены'
      });
    } catch (err: any) {
      args.setStatusMessage({ type: 'error', text: err?.message || 'Не удалось сохранить черновик' });
    } finally {
      isDraftSaveInFlight = false;
      args.setIsSaving(false);
    }
  };

  const handleTestSendDm = async () => {
    if (!args.postText.trim() && args.attachmentType === 'none') {
      args.setStatusMessage({ type: 'error', text: 'Добавьте текст или вложение перед тестовой отправкой' });
      return;
    }
    args.setIsTestingSend(true);
    args.setStatusMessage(null);
    try {
      const effectivePostText = ensureTitleHeadingInPostText(args.postText, args.title, args.messageFormat);
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: args.telegramId || args.currentUser?.telegramId || 169262990,
          title: args.title.trim(),
          content: effectivePostText,
          text: effectivePostText,
          format: args.messageFormat === 'rich' ? 'rich' : 'v2',
          signature: '',
          messageFormat: args.messageFormat === 'rich' ? 'rich' : 'v2',
          uppercaseHeader: false,
          linkPreviewEnabled: args.linkPreviewEnabled,
          attachmentType: args.attachmentType,
          audioFormat: args.audioFormat,
          attachmentUrl: args.attachmentUrl,
          attachmentUrls: args.attachmentUrls,
          inlineButtons: serializeButtonRowsTo2D(args.inlineButtons)
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка тестовой отправки в личные сообщения');
      }
      args.setStatusMessage({
        type: 'success',
        text: 'Тестовое сообщение отправлено вам в личные сообщения от @IIrkiBot'
      });
    } catch (err: any) {
      args.setStatusMessage({ type: 'error', text: err?.message || 'Ошибка тестовой отправки' });
    } finally {
      args.setIsTestingSend(false);
    }
  };

  const handlePublishNow = async () => {
    if (!args.selectedChannels || args.selectedChannels.length === 0) {
      args.setStatusMessage({
        type: 'error',
        text: 'Выберите хотя бы один ваш подключенный канал для отправки публикации'
      });
      return;
    }
    if (!args.postText.trim() && args.attachmentType === 'none') {
      args.setStatusMessage({ type: 'error', text: 'Добавьте текст или медиавложение для публикации' });
      return;
    }
    args.setIsPublishingNow(true);
    args.setStatusMessage(null);
    try {
      const effectiveTitle = args.title.trim() || 'Новая публикация';
      const effectivePostText = ensureTitleHeadingInPostText(args.postText, effectiveTitle, args.messageFormat);
      if (effectivePostText !== args.postText) {
        args.setPostText(effectivePostText);
        args.pushToHistory(effectivePostText);
      }
      const pubRes = await args.onPublishToTelegram(
        effectiveTitle,
        effectivePostText,
        args.selectedId || 'req_1',
        {
          messageFormat: args.messageFormat === 'rich' ? 'rich' : 'v2',
          uppercaseHeader: false,
          signature: '',
          linkPreviewEnabled: args.linkPreviewEnabled,
          attachmentType: args.attachmentType,
          attachmentUrl: args.attachmentUrl,
          attachmentUrls: args.attachmentUrls,
          audioFormat: args.audioFormat,
          inlineButtons: serializeButtonRowsTo2D(args.inlineButtons),
          channels: args.selectedChannels,
          publishToSocialFeed: args.publishToSocialFeed
        }
      );
      if (pubRes?.blogPost?.slug || pubRes?.blogPost?.id) {
        args.setPublishedBlogSlug(pubRes.blogPost.slug || pubRes.blogPost.id);
      }
      args.setStatusMessage({
        type: 'success',
        text: `Пост успешно отправлен в ${args.selectedChannels.join(', ')}`
      });
    } catch (err: any) {
      args.setStatusMessage({ type: 'error', text: err?.message || 'Ошибка публикации в канал' });
    } finally {
      args.setIsPublishingNow(false);
    }
  };

  return {
    handleGeneratePostNow,
    handleGenerateAiButtons,
    handleSaveDraft,
    handleTestSendDm,
    handlePublishNow
  };
}
