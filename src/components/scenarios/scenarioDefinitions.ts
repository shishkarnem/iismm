import {
  Clock,
  Play,
  Sparkles,
  Zap,
  FileText,
  Wand2,
  RefreshCw,
  Scissors,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Combine,
  Paperclip,
  Sliders,
  Edit3,
  GitBranch,
  Send,
  Calendar,
  MessageSquare,
  Share2
} from 'lucide-react';
import {
  Scenario,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  ScenarioTestProgressState,
  ScenarioNodeTestRecord
} from '../../types';
import {
  isScenarioImageNodeType,
  isScenarioRichVisualNodeType,
  computeScenarioImageCost,
  buildScenarioImageSubtitle,
  ScenarioImageCosts
} from './ScenarioImageNodeConfig';
import { buildTriggerScheduleSubtitle } from './schedule/scheduleTypes';
import { startLiveScenarioStatusPoller } from './edges/edgeOperations';
import { formatIirkyCount } from '../../shared/pricingConfig';

export {
  SCENARIO_STARTER_TEMPLATES,
  createDefaultWorkflow,
  type ScenarioStarterTemplate
} from './views/scenarioTemplates';

export const CANVAS_CARD_WIDTH = 270;
export const CANVAS_CARD_HEIGHT = 142;

export interface NodeTypeDefinition {
  type: WorkflowNodeType;
  category: 'trigger' | 'ai' | 'format' | 'logic' | 'delivery';
  categoryTitle: string;
  title: string;
  description: string;
  cost: number;
  supportedFormats?: Array<'v2' | 'rich'>;
  isUnderDevelopment?: boolean;
  isLegacyHidden?: boolean;
  icon: any;
  defaultConfig: Record<string, any>;
}

export const NODE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    type: 'trigger_schedule',
    category: 'trigger',
    categoryTitle: 'Триггеры запуска',
    title: 'Запуск по расписанию',
    description: 'Автоматический старт сценария по расписанию, дням недели или интервалу с синхронизацией в крон',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Clock,
    defaultConfig: {
      cronInterval: 'daily',
      cronTime: '10:00',
      cronDays: [1, 2, 3, 4, 5, 6, 7],
      sleepMode: false,
      sleepStartTime: '23:00',
      sleepEndTime: '08:00'
    }
  },
  {
    type: 'trigger_manual',
    category: 'trigger',
    categoryTitle: 'Триггеры запуска',
    title: 'Ручной запуск',
    description: 'Запуск цепочки сценария вручную по кнопке в один клик',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Play,
    defaultConfig: {}
  },
  {
    type: 'ai_generate_topic_fast',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Быстрая тема / идея',
    description: 'Мгновенная генерация свежей темы и угла подачи без анализа архива за 30 дней (1 Иирка)',
    cost: 1,
    supportedFormats: ['v2', 'rich'],
    icon: Zap,
    defaultConfig: {
      topicCategory: 'Технологии и нейросети',
      topicSeed: '',
      topicAngle: 'Практическая польза и живой интерес аудитории',
      inputScope: 'upstream',
      handoffMode: 'full'
    }
  },
  {
    type: 'ai_generate_topic',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Тема с анализом истории (30 дней)',
    description: 'Создает уникальную тему с проверкой архива публикаций за 30 дней без дубликатов (10 Иирок)',
    cost: 10,
    supportedFormats: ['v2', 'rich'],
    icon: Sparkles,
    defaultConfig: {
      topicCategory: 'Технологии и нейросети',
      historyDaysLimit: 30,
      excludeHistory: true,
      inputScope: 'upstream',
      handoffMode: 'full'
    }
  },
  {
    type: 'ai_generate_text',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Генератор текста поста',
    description:
      'В формате v2 сразу пишет и красиво оформляет пост (макет, заголовок темы, теги, эталонный пример, лимит 1 024/4 096 симв.) за 1 Иирку; в Rich пишет статью до 32 000 симв.',
    cost: 1,
    supportedFormats: ['v2', 'rich'],
    icon: FileText,
    defaultConfig: {
      postStyle: 'Стандартный экспертный',
      styleDesc: 'Экспертный и увлекательный стиль',
      messageFormat: 'v2',
      minChars: 800,
      maxChars: 2500,
      includeTopicHeading: true,
      headingDecor: 'sparkle',
      topicHeadingTemplate: '{{topic}}',
      v2LayoutPreset: 'magazine_v2',
      v2UseBoldAccents: true,
      v2UseItalicLead: true,
      v2UseMonospace: true,
      v2UseBlockquote: true,
      v2UseEmojiBullets: true,
      userPrompt: 'Напиши ценный структурированный пост с аргументами и абзацами',
      inputScope: 'upstream',
      handoffMode: 'full'
    }
  },
  {
    type: 'ai_generate_image_prompt',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Генератор промпта картинки',
    description: 'Создает детальный визуальный промпт на основании прошлого шага, цепочки шагов или каждой части Rich (1 Иирка)',
    cost: 1,
    supportedFormats: ['v2', 'rich'],
    icon: Wand2,
    defaultConfig: {
      promptVisualStyle: 'Фотореализм, чистая композиция, выразительный мягкий свет',
      promptExtraNotes: '',
      inputScope: 'upstream',
      handoffMode: 'summary'
    }
  },
  {
    type: 'ai_generate_image',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Генерация картинки',
    description: 'Единый блок генерации иллюстраций с выбором функции (621 / 784 / 791 / 787), альбомами, слайдерами и коллажами',
    cost: 5,
    supportedFormats: ['v2', 'rich'],
    icon: Sparkles,
    defaultConfig: {
      functionMode: 'func_621',
      promptMode: 'auto_context',
      styleHint: 'Современный чистый визуал, мягкий свет, высокое качество',
      imagePrompt: '',
      imageCount: 1,
      mediaType: 'photo',
      aspectRatio: '16:9',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'url',
      background: 'auto',
      mode: 'sync',
      debug: false,
      referenceUrl: '',
      inputScope: 'upstream',
      handoffMode: 'summary'
    }
  },
  {
    type: 'ai_rewrite',
    category: 'ai',
    categoryTitle: 'Нейрогенерация контента',
    title: 'Рерайт и уникализация',
    description: 'В разработке: для рерайта требуется указание ссылки на внешний источник поста, чтение внешних ссылок нейросетью готовится к запуску',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    isUnderDevelopment: true,
    icon: RefreshCw,
    defaultConfig: {
      rewriteInstructions: 'Сделай свежий авторский пересказ текста, разбив на четкие пункты',
      messageFormat: 'v2'
    }
  },
  {
    type: 'rich_split_parts',
    category: 'format',
    categoryTitle: 'Конструктор частей Rich',
    title: 'Разделение Rich по смыслу (1–10 частей)',
    description: 'Делит Rich-текст по смыслу на 1–10 логических частей и передает каждую часть дальше для промптов и визуала',
    cost: 1,
    supportedFormats: ['rich'],
    icon: Scissors,
    defaultConfig: {
      partsCount: 3,
      splitMode: 'ai_semantic',
      keepPartHeadings: true,
      inputScope: 'upstream',
      handoffMode: 'parts_stream'
    }
  },
  {
    type: 'rich_part_image',
    category: 'format',
    categoryTitle: 'Конструктор частей Rich',
    title: 'Картинка к частям Rich',
    description: 'Генерирует одиночную иллюстрацию к каждой смысловой части (или выбранным частям) Rich-сообщения',
    cost: 5,
    supportedFormats: ['rich'],
    icon: ImageIcon,
    defaultConfig: {
      applyToParts: 'all',
      selectedPartNumbers: [1, 2, 3],
      partVisualPosition: 'after_heading',
      functionMode: 'func_621',
      imageCount: 1,
      mediaType: 'photo',
      aspectRatio: '16:9',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      styleHint: 'Чистая редакционная иллюстрация по смыслу раздела'
    }
  },
  {
    type: 'rich_part_slideshow',
    category: 'format',
    categoryTitle: 'Конструктор частей Rich',
    title: 'Слайдер к частям Rich',
    description: 'Создает интерактивный слайдер из 2–10 картинок для выбранных или всех частей Rich-статьи',
    cost: 15,
    supportedFormats: ['rich'],
    icon: Images,
    defaultConfig: {
      applyToParts: 'selected',
      selectedPartNumbers: [1],
      slidesPerPart: 3,
      partVisualPosition: 'after_text',
      functionMode: 'func_621',
      imageCount: 3,
      mediaType: 'slideshow',
      aspectRatio: '16:9',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      styleHint: 'Серия связанных кадров для слайдера раздела'
    }
  },
  {
    type: 'rich_part_collage',
    category: 'format',
    categoryTitle: 'Конструктор частей Rich',
    title: 'Коллаж к частям Rich',
    description: 'Создает фото-коллаж из 2–10 кадров для выбранных или всех смысловых частей Rich-статьи',
    cost: 15,
    supportedFormats: ['rich'],
    icon: LayoutGrid,
    defaultConfig: {
      applyToParts: 'selected',
      selectedPartNumbers: [2],
      slidesPerPart: 3,
      partVisualPosition: 'after_text',
      functionMode: 'func_621',
      imageCount: 3,
      mediaType: 'collage',
      aspectRatio: '1:1',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      styleHint: 'Гармоничный визуальный сет для коллажа'
    }
  },
  {
    type: 'rich_assemble_post',
    category: 'format',
    categoryTitle: 'Конструктор частей Rich',
    title: 'Сборка частей в единый Rich-пост',
    description: 'Соединяет заголовок, все смысловые части 1–10 с картинками, слайдерами и коллажами в готовое Rich-сообщение',
    cost: 0,
    supportedFormats: ['rich'],
    icon: Combine,
    defaultConfig: {
      includeMainTitle: true,
      partSeparator: 'line',
      appendSignatureInAssemble: false,
      signature: ''
    }
  },
  {
    type: 'v2_media_attachment',
    category: 'format',
    categoryTitle: 'Оформление и сборка',
    title: 'Медиа-вложение v2 (7 типов)',
    description: 'Вставка медиа для формата v2: фото, альбом, видео, кружок, аудио, голосовое сообщение или файлы',
    cost: 0,
    supportedFormats: ['v2'],
    icon: Paperclip,
    defaultConfig: {
      v2AttachmentKind: 'photo',
      mediaType: 'photo',
      attachmentUrls: [],
      imageUrls: [],
      audioTitle: '',
      audioPerformer: '',
      protectContent: false
    }
  },
  {
    type: 'format_beauty_post',
    category: 'format',
    categoryTitle: 'Оформление и сборка',
    title: 'Красивое оформление поста (Rich)',
    description: 'Для формата Rich: заголовок со сгенерированной темой, стили из конструктора и канала, правила и шрифты Rich (1 Иирка). В v2 оформление встроено в генератор текста.',
    cost: 1,
    supportedFormats: ['rich'],
    icon: Wand2,
    defaultConfig: {
      formattingEngine: 'ai_stylist',
      includeTopicHeading: true,
      headingDecor: 'sparkle',
      topicHeadingTemplate: '{{topic}}',
      postStyleId: 'expert',
      postStyle: '🧠 Экспертный и аналитический',
      maxCharsV2: 2500,
      maxCharsRich: 8000,
      v2LayoutPreset: 'magazine_v2',
      richLayoutPreset: 'editorial_longread',
      v2UseBoldAccents: true,
      v2UseItalicLead: true,
      v2UseMonospace: true,
      v2UseBlockquote: true,
      v2UseEmojiBullets: true,
      richUseSubheadings: true,
      richUseBoldItalic: true,
      richUseBlockquote: true,
      richUseChecklist: true,
      richUseDividers: true
    }
  },
  {
    type: 'format_inline_buttons',
    category: 'format',
    categoryTitle: 'Оформление и сборка',
    title: 'Инлайн-кнопки',
    description: 'Ручная настройка рядов кнопок или автогенерация кнопок нейросетью по тексту поста за 1 Иирку',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Sliders,
    defaultConfig: {
      buttonsMode: 'manual',
      aiButtonsCount: 2,
      aiButtonsPerRow: 1,
      defaultButtonUrl: 'https://t.me/IIrkiBot',
      aiButtonsTone: 'Лаконичный призыв к действию по теме поста',
      inlineButtons: [[{ text: 'Читать продолжение', url: 'https://t.me/IIrkiBot', style: 'primary' }]]
    }
  },
  {
    type: 'format_signature',
    category: 'format',
    categoryTitle: 'Оформление и сборка',
    title: 'Шаблон и подпись',
    description: 'Автоматическая вставка авторской подписи, хэштегов канала и постоянных ссылок',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Edit3,
    defaultConfig: {
      signature: 'Подписывайтесь на канал: @SAV_AI\n#новости #нейросети #контент'
    }
  },
  {
    type: 'logic_filter',
    category: 'logic',
    categoryTitle: 'Логика и ветвление',
    title: 'Условие (если / иначе)',
    description: 'Проверка правил (медиа, длина, ключевые слова, день недели) с разветвлением на ветки «Да» и «Нет»',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: GitBranch,
    defaultConfig: {
      conditionLogic: 'all',
      conditionRules: [{ id: 'rule_1', field: 'has_media', value: 'true' }],
      filterCondition: 'has_image'
    }
  },
  {
    type: 'logic_delay',
    category: 'logic',
    categoryTitle: 'Логика и ветвление',
    title: 'Задержка по времени',
    description: 'Дополнительная пауза в минутах перед переходом к следующему шагу цепочки',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Clock,
    defaultConfig: {
      delayMinutes: 15
    }
  },
  {
    type: 'publish_post',
    category: 'delivery',
    categoryTitle: 'Публикация и доставка',
    title: 'Публикация (черновик и Telegram)',
    description: 'Системно собирает медиа из предыдущих шагов, проверяет лимиты длины (1 024 с медиа / 4 096 без медиа), склеивает подпись и инлайн-кнопки в единый пост, сохраняет в черновики и публикует',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: Send,
    defaultConfig: {
      channelId: '@SAV_AI',
      channels: ['@SAV_AI'],
      publishTimingMode: 'delay_after_start',
      delayHours: 2,
      delayMinutesAfterStart: 0,
      publishTimeOfDay: '14:00',
      offsetDays: 1,
      sameDayFallback: 'plus_15m'
    }
  },
  {
    type: 'notify_author',
    category: 'delivery',
    categoryTitle: 'Публикация и доставка',
    title: 'Уведомление автору',
    description: 'Личное сообщение в Telegram автору с отчетом о генерации, черновике и времени выхода поста',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    icon: MessageSquare,
    defaultConfig: {}
  },
  {
    type: 'publish_crosspost',
    category: 'delivery',
    categoryTitle: 'Публикация и доставка',
    title: 'Кросспостинг (ВКонтакте, Сетка, Одноклассники)',
    description: 'Синхронная публикация поста в социальные сети ВКонтакте, Сетка и Одноклассники',
    cost: 0,
    supportedFormats: ['v2', 'rich'],
    isUnderDevelopment: true,
    icon: Share2,
    defaultConfig: {}
  },
  /* Legacy hidden definitions for backward compatibility */
  { type: 'format_media', category: 'format', categoryTitle: 'Оформление и сборка', title: 'Медиа-вложения', description: 'Настройка вложений публикации', cost: 0, isLegacyHidden: true, icon: Paperclip, defaultConfig: { mediaType: 'photo', imageUrls: [] } },
  { type: 'publish_telegram', category: 'delivery', categoryTitle: 'Публикация и доставка', title: 'Публикация в Telegram', description: 'Отправка готового поста в каналы Telegram', cost: 0, isLegacyHidden: true, icon: Send, defaultConfig: { channelId: '@SAV_AI', channels: ['@SAV_AI'] } },
  { type: 'save_draft', category: 'delivery', categoryTitle: 'Публикация и доставка', title: 'Сохранение в черновики', description: 'Сохранение поста в черновики редактора', cost: 0, isLegacyHidden: true, icon: Calendar, defaultConfig: { channelId: '@SAV_AI' } }
];

export function resolveNodeDef(type: string): NodeTypeDefinition | undefined {
  const exact = NODE_DEFINITIONS.find((d) => d.type === type);
  if (exact) return exact;
  if (isScenarioImageNodeType(type)) {
    return NODE_DEFINITIONS.find((d) => d.type === 'ai_generate_image');
  }
  return undefined;
}

export function getScenarioActiveFormat(scen?: Scenario | null): 'v2' | 'rich' {
  if (scen?.messageFormat === 'rich') return 'rich';
  if (scen?.messageFormat === 'v2') {
    const hasRichOnly = scen?.nodes?.some((n) =>
      ['rich_split_parts', 'rich_part_image', 'rich_part_slideshow', 'rich_part_collage', 'rich_assemble_post'].includes(
        n.type
      )
    );
    if (hasRichOnly) return 'rich';
    const textFmt = scen?.nodes?.find((n) => n.type === 'ai_generate_text')?.config?.messageFormat;
    if (textFmt === 'rich') return 'rich';
    return 'v2';
  }
  const textFmt = scen?.nodes?.find((n) => n.type === 'ai_generate_text')?.config?.messageFormat;
  if (textFmt === 'rich') return 'rich';
  return 'v2';
}

export function estimateRichTargetPartsCount(
  node: WorkflowNode,
  scen?: Scenario | null
): number {
  const splitNode = scen?.nodes?.find((n) => n.type === 'rich_split_parts' && n.enabled !== false);
  const totalParts = Math.min(10, Math.max(1, Number(splitNode?.config?.partsCount || 3)));
  if (node.config?.applyToParts === 'selected' && Array.isArray(node.config?.selectedPartNumbers)) {
    const valid = node.config.selectedPartNumbers.filter((num: number) => num >= 1 && num <= totalParts);
    return Math.max(1, valid.length);
  }
  return totalParts;
}

export function getDynamicNodeCost(
  node: WorkflowNode,
  costs: ScenarioImageCosts,
  scen?: Scenario | null
): number {
  if (node.isUnderDevelopment || node.type === 'ai_rewrite') return 0;
  const sAi = costs.pricingConfig?.scenarioAi;
  const tAi = costs.pricingConfig?.textAi;
  if (node.type === 'ai_generate_topic') return sAi?.topicArchive ?? 10;
  if (node.type === 'ai_generate_topic_fast') return sAi?.topicFast ?? 1;
  if (node.type === 'ai_generate_text') return sAi?.textGeneration ?? 1;
  if (node.type === 'ai_generate_image_prompt') {
    const unit = sAi?.imagePromptPerItem ?? 1;
    const splitNode = scen?.nodes?.find((n) => n.type === 'rich_split_parts' && n.enabled !== false);
    if (splitNode && node.config?.promptSourceMode !== 'whole_post') {
      return unit * Math.min(10, Math.max(1, Number(splitNode.config?.partsCount || 1)));
    }
    return unit;
  }
  if (node.type === 'rich_split_parts') {
    return node.config?.splitMode === 'headings_paragraphs' ? 0 : (sAi?.richSplitAi ?? 1);
  }
  if (isScenarioRichVisualNodeType(node.type)) {
    return computeScenarioImageCost(node, costs) * estimateRichTargetPartsCount(node, scen);
  }
  if (node.type === 'format_beauty_post') {
    const isV2 = (scen && getScenarioActiveFormat(scen) === 'v2') || node.config?.messageFormat === 'v2';
    if (isV2 || node.config?.formattingEngine === 'smart_rules') return 0;
    return tAi?.beautyPostAi ?? 1;
  }
  if (node.type === 'format_inline_buttons') {
    return node.config?.buttonsMode === 'ai_from_post' ? (tAi?.inlineButtons ?? 1) : 0;
  }
  if (isScenarioImageNodeType(node.type)) {
    return computeScenarioImageCost(node, costs);
  }
  return node.cost || 0;
}

const V2_KIND_LABELS: Record<string, string> = {
  photo: 'Одиночное фото',
  album: 'Альбом (до 10 фото)',
  video: 'Видеофайл',
  video_note: 'Видео-кружок',
  audio: 'Аудиозапись',
  voice: 'Голосовое сообщение',
  document: 'Файлы и документы'
};

export function scenarioHasV2MediaInChain(scen?: Scenario | null): boolean {
  if (!scen || getScenarioActiveFormat(scen) !== 'v2' || !Array.isArray(scen.nodes)) return false;
  return scen.nodes.some((n) => {
    if (n.enabled === false) return false;
    if (isScenarioImageNodeType(n.type)) return true;
    if (n.type === 'v2_media_attachment' || n.type === 'format_media') {
      const kind = String(n.config?.v2AttachmentKind || n.config?.mediaType || 'photo');
      return kind !== 'none' && kind !== 'video_note';
    }
    return false;
  });
}

export function buildBasicNodeSubtitle(
  node: WorkflowNode,
  scen?: Scenario | null,
  costs?: ScenarioImageCosts
): string {
  const fmt = getScenarioActiveFormat(scen);
  const sAi = costs?.pricingConfig?.scenarioAi;
  const tAi = costs?.pricingConfig?.textAi;
  if (isScenarioImageNodeType(node.type) || isScenarioRichVisualNodeType(node.type)) {
    return buildScenarioImageSubtitle(node, fmt);
  }
  if (node.type === 'trigger_schedule') {
    return buildTriggerScheduleSubtitle(node.config);
  }
  if (node.type === 'ai_generate_topic_fast') {
    return node.config?.topicCategory || `Быстрая идея • ${formatIirkyCount(sAi?.topicFast ?? 1)}`;
  }
  if (node.type === 'ai_generate_topic') {
    return `Анализ архива 30 дней • ${formatIirkyCount(sAi?.topicArchive ?? 10)}`;
  }
  if (node.type === 'ai_generate_text') {
    const hasMedia = scenarioHasV2MediaInChain(scen);
    const rawMax = Number(node.config?.maxChars || (fmt === 'rich' ? 8000 : hasMedia ? 900 : 2500));
    const maxCh = fmt === 'v2' && hasMedia ? Math.min(1024, rawMax) : rawMax;
    if (fmt === 'rich') return `Rich • до ${maxCh} симв.`;
    return node.config?.formatExampleV2
      ? `Оформление v2 по эталону • до ${maxCh} симв.`
      : `Оформление v2 • до ${maxCh} симв.`;
  }
  if (node.type === 'ai_generate_image_prompt') {
    const prLbl = formatIirkyCount(sAi?.imagePromptPerItem ?? 1);
    return node.config?.inputScope === 'full_chain' ? `По всей цепочке • ${prLbl}` : `По прошлому шагу • ${prLbl}`;
  }
  if (node.type === 'ai_rewrite') {
    return 'В разработке (чтение ссылок)';
  }
  if (node.type === 'rich_split_parts') {
    const cnt = Math.min(10, Math.max(1, Number(node.config?.partsCount || 3)));
    const modeLbl = node.config?.splitMode === 'headings_paragraphs' ? 'По структуре' : 'По смыслу';
    return `${modeLbl} • ${cnt} ч.`;
  }
  if (node.type === 'rich_assemble_post') {
    return 'Единый Rich-пост из частей';
  }
  if (node.type === 'v2_media_attachment') {
    const kind = node.config?.v2AttachmentKind || node.config?.mediaType || 'photo';
    const urlsCount = Array.isArray(node.config?.attachmentUrls)
      ? node.config.attachmentUrls.filter(Boolean).length
      : Array.isArray(node.config?.imageUrls)
      ? node.config.imageUrls.filter(Boolean).length
      : 0;
    return `${V2_KIND_LABELS[kind] || 'Фото'}${urlsCount > 0 ? ` • ${urlsCount} шт.` : ''}`;
  }
  if (node.type === 'format_beauty_post') {
    if (fmt === 'v2') {
      return 'Системная проверка v2 • 0 Иирок';
    }
    const rawLimit = Number(
      node.config?.maxCharsRich ?? node.config?.maxChars ?? 8000
    );
    const eng = node.config?.formattingEngine === 'smart_rules'
      ? 'Правила • 0 Иирок'
      : `Нейростиль • ${formatIirkyCount(tAi?.beautyPostAi ?? 1)}`;
    return `Rich • до ${rawLimit} симв. • ${eng}`;
  }
  if (node.type === 'format_inline_buttons') {
    return node.config?.buttonsMode === 'ai_from_post'
      ? `Нейрогенерация (${node.config?.aiButtonsCount || 2} шт.) • ${formatIirkyCount(tAi?.inlineButtons ?? 1)}`
      : 'Кнопки под постом';
  }
  if (node.type === 'logic_filter') {
    const rulesCount = Array.isArray(node.config?.conditionRules)
      ? node.config.conditionRules.length
      : 1;
    return `Ветки Да / Нет • правил: ${rulesCount}`;
  }
  if (node.type === 'logic_delay') {
    const totalM = Math.max(1, Number(node.config?.delayMinutes || 15));
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    return h > 0 ? `Пауза ${h} ч. ${m} мин.` : `Пауза ${m} мин.`;
  }
  if (node.type === 'publish_post') {
    const chList: string[] = Array.isArray(node.config?.channels) && node.config.channels.length > 0
      ? node.config.channels
      : [node.config?.channelId || '@SAV_AI'];
    const mode = node.config?.publishTimingMode || 'immediate';
    const dHours = Math.max(0, Number(node.config?.delayHours ?? node.config?.publishDelayHours ?? 2));
    const dMins = Math.min(59, Math.max(0, Number(node.config?.delayMinutesAfterStart ?? node.config?.publishDelayMinutes ?? 0)));
    const modeText =
      mode === 'draft_only'
        ? 'Только в черновик'
        : mode === 'delay_after_start'
        ? `Через ${dHours} ч. ${dMins} мин.`
        : mode === 'same_day_time'
        ? `В ${node.config?.publishTimeOfDay || '14:00'} того же дня`
        : mode === 'offset_days_time'
        ? `+${node.config?.offsetDays || 1} дн. в ${node.config?.publishTimeOfDay || '12:00'}`
        : 'Сразу + черновик';
    return `${chList.length} кан. • ${modeText}`;
  }
  if (node.type === 'publish_telegram') {
    return node.config?.channelId || '@SAV_AI';
  }
  const def = resolveNodeDef(node.type);
  return def?.categoryTitle || 'Шаг сценария';
}

export function calculateTotalCost(scen: Scenario | null, costs: ScenarioImageCosts): number {
  if (!scen || !Array.isArray(scen.nodes)) return 0;
  return scen.nodes.reduce((acc, node) => {
    if (node.enabled !== false && !node.isUnderDevelopment && node.type !== 'ai_rewrite') {
      return acc + getDynamicNodeCost(node, costs, scen);
    }
    return acc;
  }, 0);
}

export function computeChainToTarget(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  targetNodeId: string
): WorkflowNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const targetIdx = nodes.findIndex((n) => n.id === targetNodeId);
  if (targetIdx === -1) return [];
  const targetNode = nodes[targetIdx];

  const validEdges = Array.isArray(edges) ? edges : [];
  const hasIncoming = validEdges.some((e) => e.targetNodeId === targetNodeId);
  if (!hasIncoming) {
    return nodes
      .slice(0, targetIdx + 1)
      .filter((n) => n.id === targetNodeId || (n.enabled !== false && !n.isUnderDevelopment && n.type !== 'ai_rewrite'));
  }

  const visited = new Set<string>([targetNodeId]);
  const queue: string[] = [targetNodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    validEdges
      .filter((e) => e.targetNodeId === cur)
      .forEach((e) => {
        if (e.sourceNodeId && !visited.has(e.sourceNodeId)) {
          const src = nodes.find((n) => n.id === e.sourceNodeId);
          if (src && src.enabled !== false && !src.isUnderDevelopment && src.type !== 'ai_rewrite') {
            visited.add(e.sourceNodeId);
            queue.push(e.sourceNodeId);
          }
        }
      });
  }

  const subNodes = nodes.filter((n) => visited.has(n.id));
  const subEdges = validEdges.filter(
    (e) => visited.has(e.sourceNodeId) && visited.has(e.targetNodeId)
  );
  const inDegree = new Map<string, number>();
  subNodes.forEach((n) => inDegree.set(n.id, 0));
  subEdges.forEach((e) => {
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
  });

  const ordered: WorkflowNode[] = [];
  const ready = subNodes
    .filter((n) => (inDegree.get(n.id) || 0) === 0)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  while (ready.length > 0) {
    const cur = ready.shift()!;
    if (cur.id !== targetNodeId) ordered.push(cur);
    subEdges
      .filter((e) => e.sourceNodeId === cur.id)
      .forEach((e) => {
        const nextDeg = (inDegree.get(e.targetNodeId) || 1) - 1;
        inDegree.set(e.targetNodeId, nextDeg);
        if (nextDeg === 0) {
          const nextNode = subNodes.find((n) => n.id === e.targetNodeId);
          if (nextNode) {
            ready.push(nextNode);
            ready.sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
          }
        }
      });
  }

  subNodes.forEach((n) => {
    if (n.id !== targetNodeId && !ordered.some((o) => o.id === n.id)) {
      ordered.push(n);
    }
  });
  ordered.push(targetNode);
  return ordered;
}

export function generateUniqueScenarioName(existingScenarios: Scenario[], baseName = 'Новый сценарий'): string {
  const taken = new Set(
    (existingScenarios || []).map((s) => String(s.name || '').trim().toLowerCase())
  );
  if (!taken.has(baseName.trim().toLowerCase())) {
    return baseName;
  }
  let counter = 2;
  while (taken.has(`${baseName} ${counter}`.trim().toLowerCase())) {
    counter += 1;
  }
  return `${baseName} ${counter}`;
}

export function validateScenarioWorkflow(scen?: Scenario | null): string[] {
  if (!scen || !Array.isArray(scen.nodes)) return [];
  const warnings: string[] = [];
  const nodes = scen.nodes.filter((n) => n.enabled !== false);
  const edges = scen.edges || [];
  const fmt = getScenarioActiveFormat(scen);

  const hasSplit = nodes.some((n) => n.type === 'rich_split_parts');
  const hasAssemble = nodes.some((n) => n.type === 'rich_assemble_post');
  if (fmt === 'rich' && hasSplit && !hasAssemble) {
    warnings.push(
      'Добавлен блок «Разделение Rich по смыслу», но нет замыкающего блока «Сборка частей в единый Rich-пост» перед публикацией.'
    );
  }

  nodes
    .filter((n) => n.type === 'logic_filter')
    .forEach((lf) => {
      const outEdges = edges.filter((e) => e.sourceNodeId === lf.id);
      if (outEdges.length === 0) {
        warnings.push(`У блока условия «${lf.title}» не подключены выходные ветки «Да» / «Нет».`);
      }
    });

  const scheduleTrigger = nodes.find((n) => n.type === 'trigger_schedule');
  const startStr = scheduleTrigger?.config?.cronTime || '10:00';
  const [sh, sm] = String(startStr).split(':').map((v) => parseInt(v, 10) || 0);
  const startMins = sh * 60 + sm;

  nodes
    .filter((n) => n.type === 'publish_post')
    .forEach((pub) => {
      if (pub.config?.publishTimingMode === 'same_day_time' && scheduleTrigger) {
        const pubStr = pub.config?.publishTimeOfDay || '14:00';
        const [ph, pm] = String(pubStr).split(':').map((v) => parseInt(v, 10) || 0);
        const pubMins = ph * 60 + pm;
        if (pubMins < startMins) {
          warnings.push(
            `В блоке «${pub.title}» время выхода (${pubStr}) раньше старта сценария (${startStr}). При запуске сработает резервное правило (+15 мин. или следующий день).`
          );
        }
      }
    });

  if (fmt === 'v2') {
    const v2Media = nodes.find((n) => n.type === 'v2_media_attachment');
    const inlineBtnNode = nodes.find((n) => n.type === 'format_inline_buttons');
    const kind = v2Media?.config?.v2AttachmentKind;
    if (inlineBtnNode && (kind === 'album' || kind === 'video_note')) {
      warnings.push(
        `В формате v2 Telegram не прикрепляет инлайн-кнопки напрямую к ${
          kind === 'album' ? 'медиа-альбому' : 'видео-кружку'
        }. Выберите одиночное медиа или формат Rich.`
      );
    }
  }

  return warnings;
}

export async function runScenarioNodeStreamClient(params: {
  endpoint?: string;
  scenarioId?: string;
  payload: Record<string, any>;
  onProgressUpdate: (
    updater: (prev: ScenarioTestProgressState | null) => ScenarioTestProgressState | null
  ) => void;
  onStepRecord: (nodeId: string, record: ScenarioNodeTestRecord) => void;
}): Promise<any> {
  const {
    endpoint = '/api/scenarios/test-node-stream',
    scenarioId,
    payload,
    onProgressUpdate,
    onStepRecord
  } = params;
  const resolvedScenarioId = String(
    scenarioId || payload?.scenarioId || payload?.scenarioSnapshot?.id || ''
  ).trim();
  const stopLivePoller = startLiveScenarioStatusPoller({
    scenarioId: resolvedScenarioId,
    onProgressUpdate,
    onStepRecord
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Ошибка выполнения сценария');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData: any = null;

    const processEvent = (evt: any) => {
      if (!evt || typeof evt !== 'object') return;
      if (evt.type === 'error') {
        throw new Error(evt.error || 'Ошибка выполнения сценария');
      }
      if (evt.type === 'init' && Array.isArray(evt.steps)) {
        onProgressUpdate((prev) =>
          prev
            ? {
                ...prev,
                percent: Math.max(prev.percent, Number(evt.percent || 4)),
                steps: evt.steps
              }
            : prev
        );
      } else if (evt.type === 'step_start') {
        onProgressUpdate((prev) =>
          prev
            ? {
                ...prev,
                percent: Math.max(prev.percent, Number(evt.percent || prev.percent)),
                activeNodeId: evt.nodeId,
                activeNodeTitle: evt.nodeTitle || '',
                statusText: evt.detail || `Работает: ${evt.nodeTitle}`,
                steps: prev.steps.map((s) =>
                  s.nodeId === evt.nodeId
                    ? {
                        ...s,
                        status: 'running',
                        stepPercent: Math.max(s.stepPercent || 0, Number(evt.stepPercent || 10))
                      }
                    : s
                )
              }
            : prev
        );
      } else if (evt.type === 'step_progress') {
        onProgressUpdate((prev) =>
          prev
            ? {
                ...prev,
                percent: Math.max(prev.percent, Number(evt.percent || prev.percent)),
                activeNodeId: evt.nodeId,
                activeNodeTitle: evt.nodeTitle || prev.activeNodeTitle,
                statusText: evt.detail || prev.statusText,
                steps: prev.steps.map((s) =>
                  s.nodeId === evt.nodeId
                    ? {
                        ...s,
                        status: 'running',
                        stepPercent: Math.max(s.stepPercent || 0, Number(evt.stepPercent || s.stepPercent))
                      }
                    : s
                )
              }
            : prev
        );
      } else if (evt.type === 'step_done') {
        if (evt.record) onStepRecord(evt.nodeId, evt.record);
        onProgressUpdate((prev) =>
          prev
            ? {
                ...prev,
                percent: Math.max(prev.percent, Number(evt.percent || prev.percent)),
                statusText: evt.message || `Готово: ${evt.nodeTitle}`,
                steps: prev.steps.map((s) =>
                  s.nodeId === evt.nodeId
                    ? { ...s, status: 'done', stepPercent: 100, cost: evt.cost, message: evt.message }
                    : s
                )
              }
            : prev
        );
      } else if (evt.type === 'step_skipped' && Array.isArray(evt.skippedIds)) {
        onProgressUpdate((prev) =>
          prev
            ? {
                ...prev,
                statusText: evt.detail || prev.statusText,
                steps: prev.steps.map((s) =>
                  evt.skippedIds.includes(s.nodeId)
                    ? { ...s, status: 'skipped', message: evt.detail }
                    : s
                )
              }
            : prev
        );
      } else if (evt.type === 'complete') {
        finalData = evt.result;
        onProgressUpdate((prev) =>
          prev ? { ...prev, percent: 100, statusText: 'Выполнение завершено (100%)' } : prev
        );
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) processEvent(JSON.parse(trimmed));
      }
    }
    if (buffer.trim()) {
      processEvent(JSON.parse(buffer.trim()));
    }
    if (!finalData) {
      throw new Error('Не получен итоговый ответ тестирования от сервера');
    }
    return finalData;
  } finally {
    stopLivePoller();
  }
}
