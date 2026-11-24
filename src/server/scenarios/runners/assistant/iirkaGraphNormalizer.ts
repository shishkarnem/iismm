import { Channel, Scenario, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '../../../../types';
import { computeSingleNodeExecutionCost } from '../../scenarioGraphHelpers';
import { IirkaStepDiff } from './iirkaPromptBuilder';
import { applyParallelAwareGraphLayout } from './iirkaGraphLayout';

const RICH_ONLY_TYPES = new Set<string>([
  'rich_split_parts',
  'rich_part_image',
  'rich_part_slideshow',
  'rich_part_collage',
  'rich_assemble_post'
]);

const V2_ONLY_TYPES = new Set<string>(['v2_media_attachment']);
const BLOCKED_TYPES = new Set<string>(['ai_rewrite', 'publish_crosspost']);

const ALLOWED_NODE_TYPES = new Set<string>([
  'trigger_schedule',
  'trigger_manual',
  'ai_generate_topic_fast',
  'ai_generate_topic',
  'ai_generate_text',
  'ai_generate_image_prompt',
  'ai_generate_image',
  'rich_split_parts',
  'rich_part_image',
  'rich_part_slideshow',
  'rich_part_collage',
  'rich_assemble_post',
  'v2_media_attachment',
  'format_beauty_post',
  'format_inline_buttons',
  'format_signature',
  'logic_filter',
  'logic_delay',
  'publish_post',
  'notify_author'
]);

const DEFAULT_TITLES: Record<string, string> = {
  trigger_schedule: 'Запуск по расписанию',
  trigger_manual: 'Ручной запуск',
  ai_generate_topic_fast: 'Быстрая тема / идея',
  ai_generate_topic: 'Тема с анализом истории (30 дней)',
  ai_generate_text: 'Генератор текста поста',
  ai_generate_image_prompt: 'Генератор промпта картинки',
  ai_generate_image: 'Генерация картинки',
  rich_split_parts: 'Разделение Rich по смыслу',
  rich_part_image: 'Картинка к частям Rich',
  rich_part_slideshow: 'Слайдер к частям Rich',
  rich_part_collage: 'Коллаж к частям Rich',
  rich_assemble_post: 'Сборка частей в единый Rich-пост',
  v2_media_attachment: 'Медиа-вложение v2',
  format_beauty_post: 'Красивое оформление поста',
  format_inline_buttons: 'Инлайн-кнопки',
  format_signature: 'Шаблон и подпись',
  logic_filter: 'Условие (если / иначе)',
  logic_delay: 'Задержка по времени',
  publish_post: 'Публикация (черновик и Telegram)',
  notify_author: 'Уведомление автору'
};

/**
 * Нормализация текста с сохранением авторского регистра и аббревиатур
 */
export function sanitizeProseNoCaps(raw: string): string {
  return String(raw || '');
}

export function resolveChannelsFromIntent(
  taskText: string,
  selectedChannels: string[],
  availableChannels: Channel[],
  defaultChannel: string
): string[] {
  const lower = taskText.toLowerCase();
  const matchedFromVoice: string[] = [];

  for (const ch of availableChannels) {
    const chAny = ch as any;
    const identifier = String(chAny.channel_id || ch.username || ch.id || '').trim();
    const title = String(chAny.title || ch.name || '').trim().toLowerCase();
    const cleanUser = String(ch.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!identifier) continue;
    if ((title && title.length >= 3 && lower.includes(title)) || (cleanUser && cleanUser.length >= 3 && lower.includes(cleanUser))) {
      if (!matchedFromVoice.includes(identifier)) {
        matchedFromVoice.push(identifier);
      }
    }
  }

  if (matchedFromVoice.length > 0) return matchedFromVoice;
  const validSelected = (selectedChannels || []).map((c) => String(c || '').trim()).filter(Boolean);
  if (validSelected.length > 0) return validSelected;
  return [defaultChannel || '@SAV_AI'];
}

function inferFormatFromTask(
  taskText: string,
  preferredFormat: 'auto' | 'v2' | 'rich',
  existingScenario?: Scenario | null
): 'v2' | 'rich' {
  if (preferredFormat === 'rich' || preferredFormat === 'v2') return preferredFormat;
  const lower = taskText.toLowerCase();
  if (
    /rich|рич|лонгрид|стать[яиюей]|раздел\w*\s+на\s+\d*\s*част|по\s+частям|слайдер|коллаж|глав[ыам]/i.test(
      lower
    )
  ) {
    return 'rich';
  }
  if (/\bv2\b|кружок|видео-кружок|голосов\w+\s+сообщ|аудиозапис|документ|файл/i.test(lower)) {
    return 'v2';
  }
  if (existingScenario?.messageFormat === 'rich') return 'rich';
  return 'v2';
}

function extractTimeFromTask(taskText: string, fallback = '10:00'): string {
  const hhmm = taskText.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (hhmm) {
    return `${String(Number(hhmm[1])).padStart(2, '0')}:${hhmm[2]}`;
  }
  const hourWord = taskText.match(/в\s+([01]?\d|2[0-3])\s*(?:час|ч\b|утра|дня|вечера)/i);
  if (hourWord) {
    let h = Number(hourWord[1]);
    if (/вечера/i.test(hourWord[0]) && h < 12) h += 12;
    return `${String(h).padStart(2, '0')}:00`;
  }
  return fallback;
}

export function buildServerNodeSubtitle(node: WorkflowNode, fmt: 'v2' | 'rich'): string {
  const cfg: any = node.config || {};
  switch (node.type) {
    case 'trigger_schedule': {
      const interval = cfg.cronInterval || 'daily';
      const lbl =
        interval === 'daily'
          ? 'Ежедневно'
          : interval === 'weekly'
          ? 'По дням недели'
          : `Интервал ${interval}`;
      return `${lbl} • ${cfg.cronTime || '10:00'}`;
    }
    case 'trigger_manual':
      return 'Запуск вручную по кнопке';
    case 'ai_generate_topic_fast':
      return `${cfg.topicCategory || 'Быстрая идея'} • 1 Иирка`;
    case 'ai_generate_topic':
      return 'Анализ архива 30 дней • 10 Иирок';
    case 'ai_generate_text':
      return fmt === 'rich'
        ? `Rich • до ${cfg.maxChars || 7000} симв.`
        : `Разметка v2 • до ${cfg.maxChars || 2500} симв.`;
    case 'ai_generate_image_prompt':
      return cfg.promptSourceMode === 'each_rich_part'
        ? 'Для каждой части Rich'
        : 'По прошлому шагу • 1 Иирка';
    case 'ai_generate_image': {
      const fn = cfg.functionMode || 'func_621';
      const fnLbl = fn === 'func_791' ? '791 (про)' : fn === 'func_784' ? '784 (с текстом)' : fn === 'func_787' ? '787 (без текста)' : '621 (нейро)';
      return `${fnLbl} · ${cfg.imageCount || 1} шт.`;
    }
    case 'rich_split_parts':
      return `По смыслу • ${cfg.partsCount || 3} ч.`;
    case 'rich_part_image':
      return `Картинка к частям (${cfg.applyToParts === 'selected' ? 'выбр.' : 'все'})`;
    case 'rich_part_slideshow':
      return `Слайдер • ${cfg.slidesPerPart || 3} кадр.`;
    case 'rich_part_collage':
      return `Коллаж • ${cfg.slidesPerPart || 3} кадр.`;
    case 'rich_assemble_post':
      return 'Единый Rich-пост из частей';
    case 'v2_media_attachment':
      return `Вложение v2 • ${cfg.v2AttachmentKind || 'photo'}`;
    case 'format_beauty_post': {
      const eng = cfg.formattingEngine === 'smart_rules' ? 'Правила • 0 Иирок' : 'Нейростиль • 1 Иирка';
      return `${fmt === 'rich' ? 'Rich' : 'v2'} • Заголовок темы • ${eng}`;
    }
    case 'format_inline_buttons':
      return cfg.buttonsMode === 'ai_from_post'
        ? `Нейрогенерация (${cfg.aiButtonsCount || 2} шт.) • 1 Иирка`
        : 'Кнопки под постом';
    case 'format_signature':
      return 'Подпись и хэштеги';
    case 'logic_filter':
      return `Ветки Да / Нет • правил: ${Array.isArray(cfg.conditionRules) ? cfg.conditionRules.length : 1}`;
    case 'logic_delay': {
      const totalM = Math.max(1, Number(cfg.delayMinutes || 15));
      const h = Math.floor(totalM / 60);
      const m = totalM % 60;
      return h > 0 ? `Пауза ${h} ч. ${m} мин.` : `Пауза ${m} мин.`;
    }
    case 'publish_post': {
      const chs = Array.isArray(cfg.channels) && cfg.channels.length > 0 ? cfg.channels : [cfg.channelId || '@SAV_AI'];
      const m = cfg.publishTimingMode || 'delay_after_start';
      const dH = Math.max(0, Number(cfg.delayHours ?? cfg.publishDelayHours ?? 2));
      const dM = Math.min(59, Math.max(0, Number(cfg.delayMinutesAfterStart ?? cfg.publishDelayMinutes ?? 0)));
      const mLbl =
        m === 'draft_only'
          ? 'Только черновик'
          : m === 'immediate'
          ? 'Сразу в канал'
          : m === 'same_day_time'
          ? `В ${cfg.publishTimeOfDay || '14:00'}`
          : m === 'offset_days_time'
          ? `+${cfg.offsetDays || 1} дн. в ${cfg.publishTimeOfDay || '12:00'}`
          : `Через ${dH} ч. ${dM} мин.`;
      return `${chs.length} кан. • ${mLbl}`;
    }
    case 'notify_author':
      return 'Отчет автору в Telegram';
    default:
      return DEFAULT_TITLES[node.type] || 'Шаг сценария';
  }
}

/**
 * Умный детерминированный сборщик/редактор на случай недоступности внешней модели
 */
export function buildFallbackScenarioFromIntent(params: {
  mode: 'create' | 'edit';
  taskText: string;
  preferredFormat: 'auto' | 'v2' | 'rich';
  channels: string[];
  existingScenario?: Scenario | null;
}): {
  assistantSummary: string;
  highlights: string[];
  scenario: Partial<Scenario>;
} {
  const { mode, taskText, preferredFormat, channels, existingScenario } = params;
  const lower = taskText.toLowerCase();
  const fmt = inferFormatFromTask(taskText, preferredFormat, existingScenario);
  const timeStr = extractTimeFromTask(taskText, '10:00');
  const isManual = /вручную|ручной\s+запуск|по\s+кнопке/i.test(lower);
  const isWeekdays = /будн/i.test(lower);
  const isDraftOnly = /только\s+в?\s*черновик|без\s+публикац|сохраня\w*\s+в\s+черновик/i.test(lower);
  const isImmediate = /сразу\s+публик|мгновенн|моментальн/i.test(lower);
  const hmMatch = lower.match(/через\s+(\d{1,2})\s*(?:час[а-яё]*|ч\.?)(?:\s*(?:и|,)?\s*(\d{1,2})\s*(?:минут[а-яё]*|мин\.?|м\.?))?/i);
  const minOnlyMatch = !hmMatch ? lower.match(/через\s+(\d{1,3})\s*(?:минут[а-яё]*|мин\.?)/i) : null;
  const hasExplicitDelay = Boolean(hmMatch || minOnlyMatch);
  const parsedDelayHours = hmMatch
    ? Math.min(72, Math.max(0, Number(hmMatch[1]) || 0))
    : minOnlyMatch
    ? Math.floor((Number(minOnlyMatch[1]) || 0) / 60)
    : 2;
  const parsedDelayMinutes = hmMatch
    ? Math.min(59, Math.max(0, Number(hmMatch[2] || 0)))
    : minOnlyMatch
    ? Math.min(59, Math.max(0, (Number(minOnlyMatch[1]) || 0) % 60))
    : 0;

  const rubricMatch = taskText.match(/(?:на\s+тему|про|рубрик\w*|категори\w*)\s+«?([а-яёa-z0-9\s\-]{3,40})»?/i);
  const category = sanitizeProseNoCaps(
    rubricMatch?.[1]?.trim() || existingScenario?.category || 'Технологии и нейросети'
  );

  if (mode === 'edit' && existingScenario && Array.isArray(existingScenario.nodes) && existingScenario.nodes.length > 0) {
    let nodes = existingScenario.nodes.map((n) => ({ ...n, config: { ...(n.config || {}) } }));
    const highlights: string[] = [];

    // Update schedule if mentioned
    if (/расписан|врем|утра|вечера|будн|ежедневн|\b\d{1,2}[:.]\d{2}\b/i.test(lower)) {
      const trig = nodes.find((n) => n.type === 'trigger_schedule');
      if (trig) {
        trig.config.cronTime = timeStr;
        if (isWeekdays) {
          trig.config.cronInterval = 'weekly';
          trig.config.cronDays = [1, 2, 3, 4, 5];
        }
        highlights.push(`Обновлено время запуска на ${timeStr}`);
      }
    }

    // Add buttons if asked
    if (/кнопк/i.test(lower) && !/удал\w*\s+кнопк|убер\w*\s+кнопк/i.test(lower)) {
      if (!nodes.some((n) => n.type === 'format_inline_buttons')) {
        const pubIdx = nodes.findIndex((n) => n.type === 'publish_post');
        const btnNode: WorkflowNode = {
          id: `node_btn_${Date.now()}`,
          type: 'format_inline_buttons',
          title: 'Инлайн-кнопки',
          x: 320,
          y: 0,
          enabled: true,
          cost: 1,
          config: {
            buttonsMode: 'ai_from_post',
            aiButtonsCount: 2,
            aiButtonsPerRow: 1,
            defaultButtonUrl: 'https://t.me/IIrkiBot'
          }
        };
        if (pubIdx >= 0) nodes.splice(pubIdx, 0, btnNode);
        else nodes.push(btnNode);
        highlights.push('Добавлен блок автогенерации инлайн-кнопок по тексту поста');
      }
    }

    if (/удал\w*\s+кнопк|убер\w*\s+кнопк/i.test(lower)) {
      nodes = nodes.filter((n) => n.type !== 'format_inline_buttons');
      highlights.push('Блок инлайн-кнопок удален из цепочки');
    }

    if (/фильтр|услови|стоп-слов/i.test(lower) && !nodes.some((n) => n.type === 'logic_filter')) {
      const pubIdx = nodes.findIndex((n) => n.type === 'publish_post');
      const fltNode: WorkflowNode = {
        id: `node_flt_${Date.now()}`,
        type: 'logic_filter',
        title: 'Условие (если / иначе)',
        x: 320,
        y: 0,
        enabled: true,
        cost: 0,
        config: {
          conditionLogic: 'all',
          conditionRules: [{ id: 'rule_1', field: 'has_text', value: 'true' }]
        }
      };
      if (pubIdx >= 0) nodes.splice(pubIdx, 0, fltNode);
      else nodes.push(fltNode);
      highlights.push('Добавлена логическая проверка текста перед публикацией');
    }

    if (/уведомлен/i.test(lower) && !nodes.some((n) => n.type === 'notify_author')) {
      nodes.push({
        id: `node_ntf_${Date.now()}`,
        type: 'notify_author',
        title: 'Уведомление автору',
        x: 320,
        y: 0,
        enabled: true,
        cost: 0,
        config: {}
      });
      highlights.push('Добавлено уведомление автору в конце цепочки');
    }

    const pub = nodes.find((n) => n.type === 'publish_post');
    if (pub) {
      pub.config.channels = channels;
      pub.config.channelId = channels[0];
      if (isDraftOnly) {
        pub.config.publishTimingMode = 'draft_only';
        highlights.push('Режим доставки переключен на сохранение только в черновики');
      } else if (isImmediate) {
        pub.config.publishTimingMode = 'immediate';
        highlights.push('Режим доставки переключен на мгновенную публикацию');
      } else if (hasExplicitDelay) {
        pub.config.publishTimingMode = 'delay_after_start';
        pub.config.delayHours = parsedDelayHours;
        pub.config.publishDelayHours = parsedDelayHours;
        pub.config.delayMinutesAfterStart = parsedDelayMinutes;
        pub.config.publishDelayMinutes = parsedDelayMinutes;
        highlights.push(`Задержка отправки настроена: через ${parsedDelayHours} ч. ${parsedDelayMinutes} мин.`);
      }
    }

    if (highlights.length === 0) {
      const txtNode = nodes.find((n) => n.type === 'ai_generate_text');
      if (txtNode) {
        txtNode.config.userPrompt = sanitizeProseNoCaps(
          `Напиши структурированный пост по теме {{topic}}. Учти пожелание: ${taskText}`
        );
        highlights.push('Обновлены инструкции генерации текста поста по вашему запросу');
      }
    }

    return {
      assistantSummary: `Иирка аккуратно обновила сценарий «${existingScenario.name}» по вашей задаче и перестроила связи между блоками.`,
      highlights,
      scenario: {
        ...existingScenario,
        category,
        messageFormat: fmt,
        targetChannels: channels,
        nodes,
        edges: []
      }
    };
  }

  // Create mode fallback
  const partsMatch = lower.match(/(\d+)\s*част/);
  const partsCount = partsMatch ? Math.min(10, Math.max(2, Number(partsMatch[1]))) : 3;
  const useHistory30 = /истори\w*|30\s*дн|архив/i.test(lower);
  const needButtons = /кнопк/i.test(lower);
  const needSignature = /подпис|хэштег|хештег/i.test(lower);
  const needFilter = /фильтр|услови|проверк/i.test(lower);
  const needNotify = /уведомлен|отчет/i.test(lower);
  const needSlideshow = /слайдер|карусел/i.test(lower);
  const needCollage = /коллаж/i.test(lower);
  const skipImages = /без\s+картин|без\s+фото|только\s+текст/i.test(lower);

  const createdNodes: Partial<WorkflowNode>[] = [
    isManual
      ? { type: 'trigger_manual', title: 'Ручной запуск', config: {} }
      : {
          type: 'trigger_schedule',
          title: 'Запуск по расписанию',
          config: {
            cronInterval: isWeekdays ? 'weekly' : 'daily',
            cronTime: timeStr,
            cronDays: isWeekdays ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7]
          }
        },
    useHistory30
      ? {
          type: 'ai_generate_topic',
          title: 'Тема с анализом истории (30 дней)',
          config: { topicCategory: category, historyDaysLimit: 30, excludeHistory: true }
        }
      : {
          type: 'ai_generate_topic_fast',
          title: 'Быстрая тема / идея',
          config: { topicCategory: category, topicAngle: 'guide' }
        },
    {
      type: 'ai_generate_text',
      title: 'Генератор текста поста',
      config: {
        postStyleId: 'expert',
        postStyle: '🧠 Экспертный и аналитический',
        styleDesc: 'Живой и полезный авторский стиль',
        messageFormat: fmt,
        minChars: fmt === 'rich' ? 2500 : 800,
        maxChars: fmt === 'rich' ? 7500 : 2500,
        userPrompt: sanitizeProseNoCaps(
          `Напиши ценный структурированный материал по теме {{topic}}. Учти задачу: ${taskText.slice(0, 260)}`
        ),
        richIncludeHeadings: true,
        richIncludeLists: true,
        ...(fmt === 'v2'
          ? {
              includeTopicHeading: true,
              headingDecor: 'sparkle',
              topicHeadingTemplate: '{{topic}}',
              v2LayoutPreset: 'magazine_v2',
              v2UseBoldAccents: true,
              v2UseItalicLead: true,
              v2UseMonospace: true,
              v2UseBlockquote: true,
              v2UseSpoiler: false,
              v2UseEmojiBullets: true
            }
          : {})
      }
    }
  ];

  if (fmt === 'rich') {
    createdNodes.push({
      type: 'rich_split_parts',
      title: `Разделение Rich на ${partsCount} ч.`,
      config: { partsCount, splitMode: 'ai_semantic', keepPartHeadings: true, handoffMode: 'parts_stream' }
    });
    if (!skipImages) {
      createdNodes.push({
        type: 'ai_generate_image_prompt',
        title: 'Промпты иллюстраций к частям',
        config: {
          promptSourceMode: 'each_rich_part',
          handoffMode: 'parts_stream',
          promptVisualStyle: 'Современная редакционная иллюстрация, мягкий объемный свет'
        }
      });
      if (needSlideshow) {
        createdNodes.push({
          type: 'rich_part_slideshow',
          title: 'Слайдер к частям Rich',
          config: { applyToParts: 'selected', selectedPartNumbers: [1], slidesPerPart: 3, functionMode: 'func_621' }
        });
      } else if (needCollage) {
        createdNodes.push({
          type: 'rich_part_collage',
          title: 'Коллаж к частям Rich',
          config: { applyToParts: 'selected', selectedPartNumbers: [1], slidesPerPart: 3, functionMode: 'func_621' }
        });
      } else {
        createdNodes.push({
          type: 'rich_part_image',
          title: 'Картинка к частям Rich',
          config: { applyToParts: 'all', partVisualPosition: 'after_heading', functionMode: 'func_621' }
        });
      }
    }
    createdNodes.push({
      type: 'rich_assemble_post',
      title: 'Сборка частей в единый Rich-пост',
      config: { includeMainTitle: true, partSeparator: 'line' }
    });
  } else if (!skipImages) {
    createdNodes.push(
      {
        type: 'ai_generate_image_prompt',
        title: 'Генератор промпта картинки',
        config: {
          promptSourceMode: 'previous_step',
          handoffMode: 'summary',
          promptVisualStyle: 'Современная редакционная иллюстрация, мягкий свет'
        }
      },
      {
        type: 'ai_generate_image',
        title: 'Генерация картинки',
        config: {
          functionMode: 'func_621',
          promptMode: 'auto_context',
          imageCount: 1,
          mediaType: 'photo',
          aspectRatio: '16:9'
        }
      }
    );
  }

  if (fmt === 'rich') {
    createdNodes.push({
      type: 'format_beauty_post',
      title: 'Красивое оформление поста',
      config: {
        formattingEngine: 'ai_stylist',
        includeTopicHeading: true,
        headingDecor: 'sparkle',
        topicHeadingTemplate: '{{topic}}',
        postStyleId: 'expert',
        postStyle: '🧠 Экспертный и аналитический',
        richLayoutPreset: 'editorial_longread'
      }
    });
  }

  if (needSignature) {
    createdNodes.push({
      type: 'format_signature',
      title: 'Шаблон и подпись',
      config: { signature: `Подписывайтесь на ${channels[0] || '@IIrkiBot'}` }
    });
  }

  if (needButtons) {
    createdNodes.push({
      type: 'format_inline_buttons',
      title: 'Инлайн-кнопки',
      config: {
        buttonsMode: 'ai_from_post',
        aiButtonsCount: 2,
        aiButtonsPerRow: 1,
        defaultButtonUrl: 'https://t.me/IIrkiBot'
      }
    });
  }

  if (needFilter) {
    createdNodes.push({
      type: 'logic_filter',
      title: 'Условие (если / иначе)',
      config: {
        conditionLogic: 'all',
        conditionRules: [{ id: 'rule_1', field: 'has_text', value: 'true' }]
      }
    });
  }

  createdNodes.push({
    type: 'publish_post',
    title: 'Публикация (черновик и Telegram)',
    config: {
      channels,
      channelId: channels[0] || '@SAV_AI',
      publishTimingMode: isDraftOnly ? 'draft_only' : isImmediate ? 'immediate' : 'delay_after_start',
      delayHours: parsedDelayHours,
      publishDelayHours: parsedDelayHours,
      delayMinutesAfterStart: parsedDelayMinutes,
      publishDelayMinutes: parsedDelayMinutes
    }
  });

  if (needNotify) {
    createdNodes.push({
      type: 'notify_author',
      title: 'Уведомление автору',
      config: {}
    });
  }

  return {
    assistantSummary: `Иирка создала новый сценарий формата ${fmt === 'rich' ? 'Rich' : 'v2'} для рубрики «${category}» и настроила все шаги цепочки.`,
    highlights: [
      `Формат конструктора: ${fmt === 'rich' ? 'Rich (статьи по частям)' : 'v2 (посты и медиа)'}`,
      isManual ? 'Запуск по кнопке вручную' : `Расписание запуска: в ${timeStr}`,
      `Целевые каналы: ${channels.join(', ')}`
    ],
    scenario: {
      name: `Сценарий: ${category}`,
      description: sanitizeProseNoCaps(taskText.slice(0, 180)),
      category,
      messageFormat: fmt,
      targetChannels: channels,
      nodes: createdNodes as WorkflowNode[]
    }
  };
}

function makeUniqueScenarioName(
  desiredName: string,
  existingNames: string[],
  allowSameName?: string
): string {
  const base = sanitizeProseNoCaps(String(desiredName || 'Автосценарий Иирки').trim()) || 'Автосценарий Иирки';
  const takenSet = new Set(
    existingNames
      .map((n) => String(n || '').trim().toLowerCase())
      .filter((n) => n && (!allowSameName || n !== allowSameName.trim().toLowerCase()))
  );
  if (!takenSet.has(base.toLowerCase())) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base} (${i})`;
    if (!takenSet.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now().toString().slice(-4)})`;
}

export function normalizeIirkaScenarioOutput(params: {
  mode: 'create' | 'edit';
  rawAiPayload: any;
  taskText: string;
  preferredFormat: 'auto' | 'v2' | 'rich';
  resolvedChannels: string[];
  existingScenario?: Scenario | null;
  existingNames: string[];
  settings: any;
  cleanUserId: string;
}): {
  assistantSummary: string;
  highlights: string[];
  estimatedRunCost: number;
  scenario: Scenario;
  stepDiffs: IirkaStepDiff[];
} {
  const {
    mode,
    rawAiPayload,
    taskText,
    preferredFormat,
    resolvedChannels,
    existingScenario,
    existingNames,
    settings,
    cleanUserId
  } = params;

  const rawScen = rawAiPayload?.scenario || rawAiPayload || {};
  const activeFormat: 'v2' | 'rich' =
    preferredFormat === 'rich' || preferredFormat === 'v2'
      ? preferredFormat
      : rawScen.messageFormat === 'rich'
      ? 'rich'
      : rawScen.messageFormat === 'v2'
      ? 'v2'
      : inferFormatFromTask(taskText, preferredFormat, existingScenario);

  const channels: string[] =
    Array.isArray(rawScen.targetChannels) && rawScen.targetChannels.length > 0
      ? rawScen.targetChannels.map((c: any) => String(c || '').trim()).filter(Boolean)
      : resolvedChannels;

  let rawNodes: any[] = Array.isArray(rawScen.nodes) ? rawScen.nodes : [];

  // Filter & adapt nodes strictly to activeFormat
  const cleanedNodes: WorkflowNode[] = [];
  rawNodes.forEach((n, idx) => {
    if (!n || typeof n !== 'object') return;
    let type = String(n.type || '').trim();
    if (BLOCKED_TYPES.has(type)) return;

    // Remap legacy aliases
    if (type === 'publish_telegram' || type === 'save_draft') {
      type = 'publish_post';
    }
    if (type === 'format_media' && activeFormat === 'v2') {
      type = 'v2_media_attachment';
    }

    if (activeFormat === 'v2' && RICH_ONLY_TYPES.has(type)) {
      if (type === 'rich_part_image' || type === 'rich_part_slideshow' || type === 'rich_part_collage') {
        type = 'ai_generate_image';
      } else {
        return;
      }
    }
    if (activeFormat === 'rich' && V2_ONLY_TYPES.has(type)) {
      type = 'rich_part_image';
    }
    if (!ALLOWED_NODE_TYPES.has(type)) return;

    const cfg = { ...(n.config || {}) };
    if (type === 'ai_generate_text') {
      cfg.messageFormat = activeFormat;
      if (!cfg.maxChars) cfg.maxChars = activeFormat === 'rich' ? 7500 : 2500;
      if (cfg.userPrompt) cfg.userPrompt = sanitizeProseNoCaps(cfg.userPrompt);
      if (activeFormat === 'v2') {
        if (cfg.includeTopicHeading === undefined) {
          cfg.includeTopicHeading = cfg.richIncludeHeadings !== false;
        }
        if (!cfg.headingDecor) cfg.headingDecor = 'sparkle';
        if (!cfg.topicHeadingTemplate) cfg.topicHeadingTemplate = '{{topic}}';
        if (!cfg.v2LayoutPreset) cfg.v2LayoutPreset = 'magazine_v2';
        if (cfg.v2UseBoldAccents === undefined) cfg.v2UseBoldAccents = true;
        if (cfg.v2UseItalicLead === undefined) cfg.v2UseItalicLead = true;
        if (cfg.v2UseMonospace === undefined) cfg.v2UseMonospace = true;
        if (cfg.v2UseBlockquote === undefined) cfg.v2UseBlockquote = true;
        if (cfg.v2UseEmojiBullets === undefined) cfg.v2UseEmojiBullets = true;
      }
    }
    if (['ai_generate_image', 'rich_part_image', 'rich_part_slideshow', 'rich_part_collage'].includes(type)) {
      if (!['func_787', 'func_621', 'func_784', 'func_791'].includes(cfg.functionMode)) cfg.functionMode = 'func_621';
      if (!cfg.ai_model && cfg.functionMode === 'func_787') cfg.ai_model = 'am/flux.2-klein-4b';
    }
    if (type === 'publish_post') {
      cfg.channels = Array.isArray(cfg.channels) && cfg.channels.length > 0 ? cfg.channels : channels;
      cfg.channelId = cfg.channels[0] || channels[0] || '@SAV_AI';
      if (!cfg.publishTimingMode) cfg.publishTimingMode = 'delay_after_start';
      const dH = Math.min(72, Math.max(0, Number(cfg.delayHours ?? cfg.publishDelayHours ?? 2)));
      const dM = Math.min(59, Math.max(0, Number(cfg.delayMinutesAfterStart ?? cfg.publishDelayMinutes ?? 0)));
      cfg.delayHours = dH;
      cfg.publishDelayHours = dH;
      cfg.delayMinutesAfterStart = dM;
      cfg.publishDelayMinutes = dM;
    }
    if (type === 'format_beauty_post') {
      if (cfg.includeTopicHeading === undefined) cfg.includeTopicHeading = true;
      if (!cfg.topicHeadingTemplate) cfg.topicHeadingTemplate = '{{topic}}';
      if (!cfg.formattingEngine) cfg.formattingEngine = 'ai_stylist';
      if (!cfg.v2LayoutPreset) cfg.v2LayoutPreset = 'magazine_v2';
      if (!cfg.richLayoutPreset) cfg.richLayoutPreset = 'editorial_longread';
    }
    if (cfg.topicCategory) cfg.topicCategory = sanitizeProseNoCaps(cfg.topicCategory);
    if (cfg.signature) cfg.signature = sanitizeProseNoCaps(cfg.signature);

    const nodeId = String(n.id || `node_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`);
    cleanedNodes.push({
      id: nodeId,
      type: type as WorkflowNodeType,
      title: sanitizeProseNoCaps(String(n.title || DEFAULT_TITLES[type] || 'Шаг сценария').trim()),
      x: 320,
      y: 40 + cleanedNodes.length * 185,
      enabled: n.enabled !== false,
      cost: 0,
      config: cfg
    });
  });

  // In v2 format, fold any AI-emitted format_beauty_post config into ai_generate_text and remove format_beauty_post
  const droppedBeautyEdgesBypass = new Map<string, string[]>();
  const rawEdgesPre: any[] = Array.isArray(rawScen.edges) ? rawScen.edges : [];
  if (activeFormat === 'v2') {
    const v2BeautyNodes = cleanedNodes.filter((n) => n.type === 'format_beauty_post');
    if (v2BeautyNodes.length > 0) {
      const targetTextNode = cleanedNodes.find((n) => n.type === 'ai_generate_text');
      const bCfg = v2BeautyNodes[0].config || {};
      if (targetTextNode) {
        const tCfg = targetTextNode.config || {};
        targetTextNode.config = {
          ...tCfg,
          includeTopicHeading:
            bCfg.includeTopicHeading !== undefined ? bCfg.includeTopicHeading : tCfg.includeTopicHeading,
          richIncludeHeadings:
            bCfg.includeTopicHeading !== undefined ? bCfg.includeTopicHeading : tCfg.richIncludeHeadings,
          headingDecor: bCfg.headingDecor || tCfg.headingDecor || 'sparkle',
          topicHeadingTemplate: bCfg.topicHeadingTemplate || tCfg.topicHeadingTemplate || '{{topic}}',
          v2LayoutPreset: bCfg.v2LayoutPreset || tCfg.v2LayoutPreset || 'magazine_v2',
          v2UseBoldAccents: bCfg.v2UseBoldAccents ?? tCfg.v2UseBoldAccents ?? true,
          v2UseItalicLead: bCfg.v2UseItalicLead ?? tCfg.v2UseItalicLead ?? true,
          v2UseMonospace: bCfg.v2UseMonospace ?? tCfg.v2UseMonospace ?? true,
          v2UseBlockquote: bCfg.v2UseBlockquote ?? tCfg.v2UseBlockquote ?? true,
          v2UseSpoiler: bCfg.v2UseSpoiler ?? tCfg.v2UseSpoiler ?? false,
          v2UseEmojiBullets: bCfg.v2UseEmojiBullets ?? tCfg.v2UseEmojiBullets ?? true,
          formatExampleV2: bCfg.formatExampleV2 || bCfg.formatExample || tCfg.formatExampleV2 || '',
          customFormatNotes: bCfg.customFormatNotes || tCfg.customFormatNotes || '',
          stylePromptOverride: bCfg.stylePromptOverride || tCfg.stylePromptOverride || tCfg.styleDesc || '',
          postStyleId: bCfg.postStyleId || tCfg.postStyleId,
          postStyle: bCfg.postStyle || tCfg.postStyle
        };
      }
      const removedIds = new Set(v2BeautyNodes.map((n) => n.id));
      removedIds.forEach((remId) => {
        const outgoing = rawEdgesPre
          .filter((e) => String(e?.sourceNodeId) === remId && e?.targetNodeId)
          .map((e) => String(e.targetNodeId));
        droppedBeautyEdgesBypass.set(remId, outgoing);
      });
      for (let i = cleanedNodes.length - 1; i >= 0; i--) {
        if (removedIds.has(cleanedNodes[i].id)) {
          cleanedNodes.splice(i, 1);
        }
      }
    }
  }

  // Guarantee trigger at index 0
  const hasTriggerAtStart =
    cleanedNodes.length > 0 &&
    (cleanedNodes[0].type === 'trigger_schedule' || cleanedNodes[0].type === 'trigger_manual');
  if (!hasTriggerAtStart) {
    const existingTrigIdx = cleanedNodes.findIndex(
      (n) => n.type === 'trigger_schedule' || n.type === 'trigger_manual'
    );
    if (existingTrigIdx > 0) {
      const [trig] = cleanedNodes.splice(existingTrigIdx, 1);
      cleanedNodes.unshift(trig);
    } else {
      cleanedNodes.unshift({
        id: `node_trig_${Date.now()}`,
        type: 'trigger_schedule',
        title: 'Запуск по расписанию',
        x: 320,
        y: 40,
        enabled: true,
        cost: 0,
        config: {
          cronInterval: 'daily',
          cronTime: extractTimeFromTask(taskText, '10:00'),
          cronDays: [1, 2, 3, 4, 5, 6, 7]
        }
      });
    }
  }

  // Guarantee at least text generation if graph only had trigger
  if (cleanedNodes.length < 2) {
    cleanedNodes.push({
      id: `node_txt_${Date.now()}`,
      type: 'ai_generate_text',
      title: 'Генератор текста поста',
      x: 320,
      y: 225,
      enabled: true,
      cost: 1,
      config: {
        postStyle: 'Стандартный экспертный',
        messageFormat: activeFormat,
        maxChars: activeFormat === 'rich' ? 7000 : 2500,
        userPrompt: 'Напиши полезный структурированный пост по теме {{topic}}'
      }
    });
  }

  // Ensure complete Rich multi-part pipeline when rich_part_* or rich_split_parts is present
  if (
    activeFormat === 'rich' &&
    cleanedNodes.some((n) => ['rich_part_image', 'rich_part_slideshow', 'rich_part_collage'].includes(n.type))
  ) {
    for (let i = cleanedNodes.length - 1; i >= 0; i--) {
      if (cleanedNodes[i].type === 'ai_generate_image' || cleanedNodes[i].type === 'ai_generate_image_prompt') {
        cleanedNodes.splice(i, 1);
      }
    }
    if (!cleanedNodes.some((n) => n.type === 'rich_split_parts')) {
      const txtIdx = cleanedNodes.findIndex((n) => n.type === 'ai_generate_text');
      cleanedNodes.splice(txtIdx >= 0 ? txtIdx + 1 : 1, 0, {
        id: `node_spl_${Date.now()}`,
        type: 'rich_split_parts',
        title: 'Разделение Rich по смыслу',
        x: 320,
        y: 0,
        enabled: true,
        cost: 0,
        config: { partsCount: 3, splitMode: 'ai_semantic' }
      });
    }
  }
  if (
    activeFormat === 'rich' &&
    cleanedNodes.some((n) => n.type === 'rich_split_parts') &&
    !cleanedNodes.some((n) => n.type === 'rich_assemble_post')
  ) {
    const beforeIdx = cleanedNodes.findIndex((n) =>
      ['format_inline_buttons', 'format_signature', 'publish_post'].includes(n.type)
    );
    const assembleNode: WorkflowNode = {
      id: `node_asm_${Date.now()}`,
      type: 'rich_assemble_post',
      title: 'Сборка частей в единый Rich-пост',
      x: 320,
      y: 0,
      enabled: true,
      cost: 0,
      config: { includeMainTitle: true, partSeparator: 'line' }
    };
    if (beforeIdx >= 0) cleanedNodes.splice(beforeIdx, 0, assembleNode);
    else cleanedNodes.push(assembleNode);
  }

  // Guarantee publish_post delivery node
  if (!cleanedNodes.some((n) => n.type === 'publish_post')) {
    const notifyIdx = cleanedNodes.findIndex((n) => n.type === 'notify_author');
    const pubNode: WorkflowNode = {
      id: `node_pub_${Date.now()}`,
      type: 'publish_post',
      title: 'Публикация (черновик и Telegram)',
      x: 320,
      y: 0,
      enabled: true,
      cost: 0,
      config: {
        channels,
        channelId: channels[0] || '@SAV_AI',
        publishTimingMode: 'delay_after_start',
        delayHours: 2,
        delayMinutesAfterStart: 0
      }
    };
    if (notifyIdx >= 0) cleanedNodes.splice(notifyIdx, 0, pubNode);
    else cleanedNodes.push(pubNode);
  }

  // Deduplicate node IDs
  const seenIds = new Set<string>();
  cleanedNodes.forEach((n, idx) => {
    if (seenIds.has(n.id)) {
      n.id = `${n.id}_${idx + 1}`;
    }
    seenIds.add(n.id);
  });

  // Compute parts count for accurate Rich cost estimation
  const splitNode = cleanedNodes.find((n) => n.type === 'rich_split_parts' && n.enabled !== false);
  const activePartsCount = splitNode
    ? Math.min(10, Math.max(1, Number(splitNode.config?.partsCount || 3)))
    : 1;

  // Validate edges (preserving parallel branches + rewiring around dropped v2 beauty nodes)
  const validNodeIdSet = new Set(cleanedNodes.map((n) => n.id));
  const rawEdges: any[] = [];
  rawEdgesPre.forEach((e) => {
    if (!e || !e.sourceNodeId || !e.targetNodeId) return;
    const srcId = String(e.sourceNodeId);
    const dstId = String(e.targetNodeId);
    if (droppedBeautyEdgesBypass.has(srcId)) return;
    if (droppedBeautyEdgesBypass.has(dstId)) {
      const targets = droppedBeautyEdgesBypass.get(dstId) || [];
      targets.forEach((tId, ti) => {
        rawEdges.push({
          ...e,
          id: `${e.id || 'edge'}_rewire_${ti}`,
          targetNodeId: tId
        });
      });
    } else {
      rawEdges.push(e);
    }
  });
  const candidateEdges: WorkflowEdge[] = rawEdges
    .filter(
      (e) =>
        e &&
        e.sourceNodeId &&
        e.targetNodeId &&
        e.sourceNodeId !== e.targetNodeId &&
        validNodeIdSet.has(String(e.sourceNodeId)) &&
        validNodeIdSet.has(String(e.targetNodeId))
    )
    .map((e, i) => {
      const src = cleanedNodes.find((n) => n.id === String(e.sourceNodeId));
      const branch: 'yes' | 'no' | 'default' =
        src?.type === 'logic_filter' ? (e.branch === 'no' ? 'no' : 'yes') : 'default';
      return {
        id: String(e.id || `edge_${i + 1}_${Date.now()}`),
        sourceNodeId: String(e.sourceNodeId),
        targetNodeId: String(e.targetNodeId),
        branch
      };
    });

  const laidOut = applyParallelAwareGraphLayout(cleanedNodes, candidateEdges);
  const finalEdges = laidOut.edges;

  let estimatedRunCost = 0;
  cleanedNodes.forEach((n) => {
    n.cost = computeSingleNodeExecutionCost(n.type, n.config, settings, activePartsCount);
    n.subtitle = buildServerNodeSubtitle(n, activeFormat);
    if (n.enabled !== false) {
      estimatedRunCost += n.cost;
    }
  });

  const desiredName =
    rawScen.name ||
    (mode === 'edit' && existingScenario?.name ? existingScenario.name : `Сценарий: ${rawScen.category || 'Контент'}`);
  const finalName = makeUniqueScenarioName(
    desiredName,
    existingNames,
    mode === 'edit' ? existingScenario?.name : undefined
  );

  const trigNode = cleanedNodes.find((n) => n.type === 'trigger_schedule');
  const humanSched = trigNode
    ? buildServerNodeSubtitle(trigNode, activeFormat).replace(' • ', ' в ')
    : 'Ручной запуск';

  const finalCategory = sanitizeProseNoCaps(
    String(
      rawScen.category ||
        existingScenario?.category ||
        cleanedNodes.find((n) => n.config?.topicCategory)?.config?.topicCategory ||
        'Автопостинг'
    ).trim()
  );

  const finalScenario: Scenario = {
    id:
      mode === 'edit' && existingScenario?.id
        ? existingScenario.id
        : `scen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: cleanUserId,
    name: finalName,
    description: sanitizeProseNoCaps(
      String(rawScen.description || existingScenario?.description || taskText.slice(0, 180)).trim()
    ),
    category: finalCategory,
    topicCategory: finalCategory,
    enabled: existingScenario ? existingScenario.enabled !== false : true,
    schedule: humanSched,
    targetChannels: channels,
    messageFormat: activeFormat,
    steps: existingScenario?.steps || [],
    nodes: cleanedNodes,
    edges: finalEdges,
    workflowLayout: existingScenario?.workflowLayout || 'canvas',
    testResults: mode === 'edit' ? existingScenario?.testResults || {} : {},
    createdAt: existingScenario?.createdAt || new Date().toISOString()
  };

  // Compute human-friendly step diffs
  const prevNodes = mode === 'edit' && existingScenario?.nodes ? existingScenario.nodes : [];
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  const nextIdSet = new Set(cleanedNodes.map((n) => n.id));

  const stepDiffs: IirkaStepDiff[] = cleanedNodes.map((n) => {
    if (mode === 'create' || !prevById.has(n.id)) {
      return {
        nodeId: n.id,
        nodeType: n.type,
        title: n.title,
        subtitle: n.subtitle || '',
        status: 'added',
        cost: n.cost
      };
    }
    const oldNode = prevById.get(n.id)!;
    const oldSig = JSON.stringify({ type: oldNode.type, title: oldNode.title, cfg: oldNode.config || {} });
    const newSig = JSON.stringify({ type: n.type, title: n.title, cfg: n.config || {} });
    return {
      nodeId: n.id,
      nodeType: n.type,
      title: n.title,
      subtitle: n.subtitle || '',
      status: oldSig === newSig ? 'unchanged' : 'modified',
      cost: n.cost
    };
  });

  if (mode === 'edit') {
    prevNodes.forEach((oldN) => {
      if (!nextIdSet.has(oldN.id)) {
        stepDiffs.push({
          nodeId: oldN.id,
          nodeType: oldN.type,
          title: oldN.title,
          subtitle: oldN.subtitle || 'Удален из цепочки',
          status: 'removed',
          cost: 0
        });
      }
    });
  }

  const rawSummary = sanitizeProseNoCaps(
    String(
      rawAiPayload?.assistantSummary ||
        (mode === 'edit'
          ? `Иирка обновила сценарий «${finalName}» и проверила совместимость всех шагов.`
          : `Иирка создала сценарий «${finalName}» (${activeFormat === 'rich' ? 'Rich' : 'v2'}) из ${cleanedNodes.length} шагов.`)
    ).trim()
  );

  const rawHighlights: string[] = Array.isArray(rawAiPayload?.highlights)
    ? rawAiPayload.highlights
        .map((h: any) => sanitizeProseNoCaps(String(h || '').trim()))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (rawHighlights.length === 0) {
    rawHighlights.push(
      `Формат цепочки: ${activeFormat === 'rich' ? 'Rich' : 'v2'} (${cleanedNodes.length} шагов)`,
      `Расписание: ${humanSched}`,
      `Стоимость одного запуска: ${estimatedRunCost} Иирок`
    );
  }

  return {
    assistantSummary: rawSummary,
    highlights: rawHighlights,
    estimatedRunCost,
    scenario: finalScenario,
    stepDiffs
  };
}
