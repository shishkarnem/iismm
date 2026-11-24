import { Scenario, Channel, WorkflowNode, WorkflowEdge } from '../../../types';

export interface ScenarioStarterTemplate {
  id: string;
  format: 'v2' | 'rich';
  title: string;
  description: string;
  badge: string;
}

export const SCENARIO_STARTER_TEMPLATES: ScenarioStarterTemplate[] = [
  {
    id: 'v2_fast_autopost',
    format: 'v2',
    title: 'Экспресс-пост v2 с оформлением в одном шаге и картинкой',
    description:
      'Быстрая тема -> параллельно красиво оформленный пост v2 и иллюстрация -> системная сборка медиа/лимитов и отложенный выход.',
    badge: 'Рекомендуем для v2'
  },
  {
    id: 'v2_deep_history',
    format: 'v2',
    title: 'Авторский пост v2 с историей 30 дней, оформлением и кнопками',
    description:
      'Тема без повторов за 30 дней -> параллельно оформленный пост v2 и фото -> инлайн-кнопки -> системная сборка и публикация.',
    badge: 'Глубокая аналитика'
  },
  {
    id: 'rich_parts_pipeline',
    format: 'rich',
    title: 'Rich-статья с разделением на части, сборкой и красивой версткой',
    description:
      'Тема -> Rich-статья -> разделение на части -> промпт и визуал к каждой части -> сборка -> красивое оформление Rich с заголовком темы -> публикация.',
    badge: 'Флагман Rich'
  },
  {
    id: 'rich_classic_longread',
    format: 'rich',
    title: 'Классический лонгрид Rich с параллельной обложкой, версткой и кнопками',
    description:
      'Быстрая тема -> параллельно статья Rich и обложка -> красивое оформление Rich с заголовком темы -> инлайн-кнопки -> публикация.',
    badge: 'Быстрый старт Rich'
  }
];

export function createDefaultWorkflow(
  name: string,
  category: string,
  channels: Channel[],
  format: 'v2' | 'rich' = 'v2',
  templateId?: string,
  selectedChannelIds?: string[]
): Scenario {
  const fallbackChannel = (channels[0] as any)?.channel_id || channels[0]?.username || '';
  const targetChs =
    Array.isArray(selectedChannelIds) && selectedChannelIds.length > 0
      ? selectedChannelIds
      : fallbackChannel
      ? [fallbackChannel]
      : [];
  const primaryCh = targetChs[0] || '';
  const cat = category || 'Технологии и нейросети';

  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];

  if (format === 'rich' && templateId === 'rich_parts_pipeline') {
    nodes = [
      {
        id: 'node_trigger',
        type: 'trigger_schedule',
        title: 'Запуск по расписанию',
        subtitle: 'Ежедневно • 10:00',
        x: 320,
        y: 35,
        enabled: true,
        cost: 0,
        config: { cronInterval: 'daily', cronTime: '10:00', cronDays: [1, 2, 3, 4, 5, 6, 7] }
      },
      {
        id: 'node_topic_fast',
        type: 'ai_generate_topic_fast',
        title: 'Быстрая тема / идея',
        subtitle: cat,
        x: 320,
        y: 205,
        enabled: true,
        cost: 1,
        config: { topicCategory: cat, topicAngle: 'Глубокий экспертный разбор по шагам' }
      },
      {
        id: 'node_rich_text',
        type: 'ai_generate_text',
        title: 'Генератор текста Rich',
        subtitle: 'Rich • до 10000 симв.',
        x: 320,
        y: 375,
        enabled: true,
        cost: 1,
        config: {
          postStyle: '🧠 Экспертный и аналитический',
          postStyleId: 'expert',
          styleDesc: 'Экспертная статья с заголовком темы, подзаголовками и выводами',
          messageFormat: 'rich',
          maxChars: 10000,
          userPrompt:
            'Напиши насыщенную Rich-статью по сгенерированной теме «{{topic}}»: начни с заголовка темы, раскрой смысловые главы и практические примеры'
        }
      },
      {
        id: 'node_split',
        type: 'rich_split_parts',
        title: 'Разделение Rich по смыслу',
        subtitle: 'По смыслу • 3 ч.',
        x: 320,
        y: 545,
        enabled: true,
        cost: 1,
        config: { partsCount: 3, splitMode: 'ai_semantic', keepPartHeadings: true, handoffMode: 'parts_stream' }
      },
      {
        id: 'node_part_prompt',
        type: 'ai_generate_image_prompt',
        title: 'Промпты к частям Rich',
        subtitle: 'По прошлому шагу • 1 Иирка',
        x: 320,
        y: 715,
        enabled: true,
        cost: 1,
        config: {
          promptVisualStyle: 'Редакционная иллюстрация, чистые детали, мягкий свет',
          inputScope: 'upstream',
          handoffMode: 'parts_stream'
        }
      },
      {
        id: 'node_part_img',
        type: 'rich_part_image',
        title: 'Картинка к каждой части',
        subtitle: '621 • Фотореализм • по 1 фото к частям',
        x: 320,
        y: 885,
        enabled: true,
        cost: 15,
        config: {
          applyToParts: 'all',
          partVisualPosition: 'after_heading',
          functionMode: 'func_621',
          imageCount: 1,
          mediaType: 'photo',
          aspectRatio: '16:9',
          size: '1024x1024',
          quality: 'auto',
          output_format: 'png'
        }
      },
      {
        id: 'node_assemble',
        type: 'rich_assemble_post',
        title: 'Сборка в единый Rich-пост',
        subtitle: 'Единый Rich-пост из частей',
        x: 320,
        y: 1055,
        enabled: true,
        cost: 0,
        config: { includeMainTitle: true, partSeparator: 'line', appendSignatureInAssemble: false }
      },
      {
        id: 'node_beauty',
        type: 'format_beauty_post',
        title: 'Красивое оформление поста',
        subtitle: 'Rich • Заголовок темы • Нейростиль • 1 Иирка',
        x: 320,
        y: 1225,
        enabled: true,
        cost: 1,
        config: {
          formattingEngine: 'ai_stylist',
          includeTopicHeading: true,
          headingDecor: 'sparkle',
          topicHeadingTemplate: '{{topic}}',
          postStyleId: 'expert',
          postStyle: '🧠 Экспертный и аналитический',
          richLayoutPreset: 'editorial_longread',
          richUseSubheadings: true,
          richUseBoldItalic: true,
          richUseBlockquote: true,
          richUseChecklist: true,
          richUseDividers: true
        }
      },
      {
        id: 'node_publish',
        type: 'publish_post',
        title: 'Публикация (черновик и Telegram)',
        subtitle: `${targetChs.length} кан. • Через 2 ч. 0 м.`,
        x: 320,
        y: 1395,
        enabled: true,
        cost: 0,
        config: {
          channelId: primaryCh,
          channels: targetChs,
          publishTimingMode: 'delay_after_start',
          delayHours: 2,
          delayMinutesAfterStart: 0,
          publishTimeOfDay: '14:00',
          offsetDays: 1,
          sameDayFallback: 'plus_15m',
          publishToSocialFeed: true
        }
      }
    ];
    edges = [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_topic_fast', branch: 'default' },
      { id: 'e2', sourceNodeId: 'node_topic_fast', targetNodeId: 'node_rich_text', branch: 'default' },
      { id: 'e3', sourceNodeId: 'node_rich_text', targetNodeId: 'node_split', branch: 'default' },
      { id: 'e4', sourceNodeId: 'node_split', targetNodeId: 'node_part_prompt', branch: 'default' },
      { id: 'e5', sourceNodeId: 'node_part_prompt', targetNodeId: 'node_part_img', branch: 'default' },
      { id: 'e6', sourceNodeId: 'node_part_img', targetNodeId: 'node_assemble', branch: 'default' },
      { id: 'e7', sourceNodeId: 'node_assemble', targetNodeId: 'node_beauty', branch: 'default' },
      { id: 'e8', sourceNodeId: 'node_beauty', targetNodeId: 'node_publish', branch: 'default' }
    ];
  } else if (format === 'rich') {
    nodes = [
      {
        id: 'node_trigger',
        type: 'trigger_schedule',
        title: 'Запуск по расписанию',
        subtitle: 'Ежедневно • 10:00',
        x: 320,
        y: 40,
        enabled: true,
        cost: 0,
        config: { cronInterval: 'daily', cronTime: '10:00', cronDays: [1, 2, 3, 4, 5, 6, 7] }
      },
      {
        id: 'node_topic_fast',
        type: 'ai_generate_topic_fast',
        title: 'Быстрая тема / идея',
        subtitle: cat,
        x: 320,
        y: 215,
        enabled: true,
        cost: 1,
        config: { topicCategory: cat }
      },
      {
        id: 'node_rich_text',
        type: 'ai_generate_text',
        title: 'Генератор текста Rich',
        subtitle: 'Rich • до 8000 симв.',
        x: 165,
        y: 395,
        enabled: true,
        cost: 1,
        config: {
          postStyle: '📚 Обучающий гайд / туториал',
          postStyleId: 'educational',
          styleDesc: 'Структурированная статья Rich с заголовком темы, главами и чек-листом',
          messageFormat: 'rich',
          maxChars: 8000,
          userPrompt:
            'Напиши глубокую Rich-публикацию по теме «{{topic}}»: обязательно вынеси тему в заголовок, раскрой главы, списки и выводы'
        }
      },
      {
        id: 'node_image',
        type: 'ai_generate_image',
        title: 'Генерация обложки / слайдера',
        subtitle: '791 • Про · Инфографика и кириллица • 1 фото',
        x: 475,
        y: 395,
        enabled: true,
        cost: 15,
        config: {
          functionMode: 'func_791',
          promptMode: 'auto_context',
          messageFormat: 'rich',
          imageCount: 1,
          mediaType: 'photo',
          aspectRatio: 'auto',
          ai_model: 'gpt-image-2.5-sunburst',
          quality: 'auto',
          output_format: 'png'
        }
      },
      {
        id: 'node_beauty',
        type: 'format_beauty_post',
        title: 'Красивое оформление поста',
        subtitle: 'Rich • Заголовок темы • Нейростиль • 1 Иирка',
        x: 320,
        y: 575,
        enabled: true,
        cost: 1,
        config: {
          formattingEngine: 'ai_stylist',
          includeTopicHeading: true,
          headingDecor: 'pin',
          topicHeadingTemplate: '{{topic}}',
          postStyleId: 'educational',
          postStyle: '📚 Обучающий гайд / туториал',
          richLayoutPreset: 'step_by_step_guide',
          richUseSubheadings: true,
          richUseBoldItalic: true,
          richUseBlockquote: true,
          richUseChecklist: true,
          richUseDividers: true
        }
      },
      {
        id: 'node_buttons',
        type: 'format_inline_buttons',
        title: 'Инлайн-кнопки по тексту',
        subtitle: 'Нейрогенерация (2 шт.) • 1 Иирка',
        x: 320,
        y: 755,
        enabled: true,
        cost: 1,
        config: {
          buttonsMode: 'ai_from_post',
          aiButtonsCount: 2,
          aiButtonsPerRow: 1,
          defaultButtonUrl: primaryCh.startsWith('@') ? `https://t.me/${primaryCh.slice(1)}` : 'https://t.me/IIrkiBot',
          inlineButtons: []
        }
      },
      {
        id: 'node_publish',
        type: 'publish_post',
        title: 'Публикация (черновик и Telegram)',
        subtitle: `${targetChs.length} кан. • Через 2 ч. 0 м.`,
        x: 320,
        y: 935,
        enabled: true,
        cost: 0,
        config: {
          channelId: primaryCh,
          channels: targetChs,
          publishTimingMode: 'delay_after_start',
          delayHours: 2,
          delayMinutesAfterStart: 0,
          publishTimeOfDay: '14:00',
          offsetDays: 1,
          sameDayFallback: 'plus_15m',
          publishToSocialFeed: true
        }
      }
    ];
    edges = [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_topic_fast', branch: 'default' },
      { id: 'e2', sourceNodeId: 'node_topic_fast', targetNodeId: 'node_rich_text', branch: 'default' },
      { id: 'e3', sourceNodeId: 'node_topic_fast', targetNodeId: 'node_image', branch: 'default' },
      { id: 'e4', sourceNodeId: 'node_rich_text', targetNodeId: 'node_beauty', branch: 'default' },
      { id: 'e5', sourceNodeId: 'node_image', targetNodeId: 'node_beauty', branch: 'default' },
      { id: 'e6', sourceNodeId: 'node_beauty', targetNodeId: 'node_buttons', branch: 'default' },
      { id: 'e7', sourceNodeId: 'node_buttons', targetNodeId: 'node_publish', branch: 'default' }
    ];
  } else if (templateId === 'v2_deep_history') {
    nodes = [
      {
        id: 'node_trigger',
        type: 'trigger_schedule',
        title: 'Запуск по расписанию',
        subtitle: 'Ежедневно • 10:00',
        x: 320,
        y: 40,
        enabled: true,
        cost: 0,
        config: { cronInterval: 'daily', cronTime: '10:00', cronDays: [1, 2, 3, 4, 5, 6, 7] }
      },
      {
        id: 'node_topic',
        type: 'ai_generate_topic',
        title: 'Тема с анализом истории (30 дней)',
        subtitle: 'Анализ архива 30 дней • 10 Иирок',
        x: 320,
        y: 215,
        enabled: true,
        cost: 10,
        config: { topicCategory: cat, historyDaysLimit: 30, excludeHistory: true }
      },
      {
        id: 'node_text',
        type: 'ai_generate_text',
        title: 'Генератор текста и оформления v2',
        subtitle: 'Оформление v2 • до 900 симв.',
        x: 165,
        y: 395,
        enabled: true,
        cost: 1,
        config: {
          postStyle: '🧠 Экспертный и аналитический',
          postStyleId: 'expert',
          styleDesc: 'Экспертный аналитический стиль',
          stylePromptOverride: 'Экспертный аналитический стиль',
          messageFormat: 'v2',
          maxChars: 900,
          includeTopicHeading: true,
          headingDecor: 'editorial',
          topicHeadingTemplate: '{{topic}}',
          v2LayoutPreset: 'expert_cards_v2',
          v2UseBoldAccents: true,
          v2UseItalicLead: true,
          v2UseMonospace: true,
          v2UseBlockquote: true,
          v2UseEmojiBullets: true,
          userPrompt:
            'Напиши экспертный пост по сгенерированной теме «{{topic}}» с заголовком темы, цифрами и выводами'
        }
      },
      {
        id: 'node_image',
        type: 'ai_generate_image',
        title: 'Генерация картинки',
        subtitle: '784 • Постер с текстом • 1 фото',
        x: 475,
        y: 395,
        enabled: true,
        cost: 10,
        config: {
          functionMode: 'func_784',
          promptMode: 'auto_context',
          messageFormat: 'v2',
          imageCount: 1,
          mediaType: 'photo',
          aspectRatio: '16:9',
          size: '1024x1024',
          quality: 'auto',
          output_format: 'png'
        }
      },
      {
        id: 'node_buttons',
        type: 'format_inline_buttons',
        title: 'Инлайн-кнопки по тексту',
        subtitle: 'Нейрогенерация (2 шт.) • 1 Иирка',
        x: 320,
        y: 575,
        enabled: true,
        cost: 1,
        config: {
          buttonsMode: 'ai_from_post',
          aiButtonsCount: 2,
          aiButtonsPerRow: 1,
          defaultButtonUrl: primaryCh.startsWith('@') ? `https://t.me/${primaryCh.slice(1)}` : 'https://t.me/IIrkiBot',
          inlineButtons: []
        }
      },
      {
        id: 'node_publish',
        type: 'publish_post',
        title: 'Сборка и публикация (черновик и Telegram)',
        subtitle: `${targetChs.length} кан. • Через 2 ч. 0 м.`,
        x: 320,
        y: 755,
        enabled: true,
        cost: 0,
        config: {
          channelId: primaryCh,
          channels: targetChs,
          publishTimingMode: 'delay_after_start',
          delayHours: 2,
          delayMinutesAfterStart: 0,
          publishTimeOfDay: '14:00',
          offsetDays: 1,
          sameDayFallback: 'plus_15m',
          publishToSocialFeed: true
        }
      }
    ];
    edges = [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_topic', branch: 'default' },
      { id: 'e2', sourceNodeId: 'node_topic', targetNodeId: 'node_text', branch: 'default' },
      { id: 'e3', sourceNodeId: 'node_topic', targetNodeId: 'node_image', branch: 'default' },
      { id: 'e4', sourceNodeId: 'node_text', targetNodeId: 'node_buttons', branch: 'default' },
      { id: 'e5', sourceNodeId: 'node_image', targetNodeId: 'node_buttons', branch: 'default' },
      { id: 'e6', sourceNodeId: 'node_buttons', targetNodeId: 'node_publish', branch: 'default' }
    ];
  } else {
    nodes = [
      {
        id: 'node_trigger',
        type: 'trigger_schedule',
        title: 'Запуск по расписанию',
        subtitle: 'Ежедневно • 10:00',
        x: 320,
        y: 40,
        enabled: true,
        cost: 0,
        config: { cronInterval: 'daily', cronTime: '10:00', cronDays: [1, 2, 3, 4, 5, 6, 7] }
      },
      {
        id: 'node_topic_fast',
        type: 'ai_generate_topic_fast',
        title: 'Быстрая тема / идея',
        subtitle: cat,
        x: 320,
        y: 215,
        enabled: true,
        cost: 1,
        config: { topicCategory: cat }
      },
      {
        id: 'node_text',
        type: 'ai_generate_text',
        title: 'Генератор текста и оформления v2',
        subtitle: 'Оформление v2 • до 900 симв.',
        x: 165,
        y: 395,
        enabled: true,
        cost: 1,
        config: {
          postStyle: '📖 Сторителлинг и живая история',
          postStyleId: 'storytelling',
          styleDesc: 'Живой увлекательный стиль с заголовком темы',
          stylePromptOverride: 'Живой увлекательный стиль с заголовком темы',
          messageFormat: 'v2',
          maxChars: 900,
          includeTopicHeading: true,
          headingDecor: 'sparkle',
          topicHeadingTemplate: '{{topic}}',
          v2LayoutPreset: 'magazine_v2',
          v2UseBoldAccents: true,
          v2UseItalicLead: true,
          v2UseMonospace: true,
          v2UseBlockquote: true,
          v2UseEmojiBullets: true,
          userPrompt:
            'Напиши структурированный пост по сгенерированной теме «{{topic}}» с заголовком темы и практической пользой'
        }
      },
      {
        id: 'node_img_prompt',
        type: 'ai_generate_image_prompt',
        title: 'Генератор промпта картинки',
        subtitle: 'По прошлому шагу • 1 Иирка',
        x: 475,
        y: 395,
        enabled: true,
        cost: 1,
        config: {
          promptVisualStyle: 'Современная иллюстрация к посту, мягкий свет, высокая детализация',
          inputScope: 'upstream',
          handoffMode: 'summary'
        }
      },
      {
        id: 'node_image',
        type: 'ai_generate_image',
        title: 'Генерация картинки',
        subtitle: '621 • Фотореализм • 1 фото',
        x: 475,
        y: 570,
        enabled: true,
        cost: 5,
        config: {
          functionMode: 'func_621',
          promptMode: 'auto_context',
          messageFormat: 'v2',
          imageCount: 1,
          mediaType: 'photo',
          aspectRatio: '16:9',
          size: '1024x1024',
          quality: 'auto',
          output_format: 'png'
        }
      },
      {
        id: 'node_publish',
        type: 'publish_post',
        title: 'Сборка и публикация (черновик и Telegram)',
        subtitle: `${targetChs.length} кан. • Через 2 ч. 0 м.`,
        x: 320,
        y: 745,
        enabled: true,
        cost: 0,
        config: {
          channelId: primaryCh,
          channels: targetChs,
          publishTimingMode: 'delay_after_start',
          delayHours: 2,
          delayMinutesAfterStart: 0,
          publishTimeOfDay: '14:00',
          offsetDays: 1,
          sameDayFallback: 'plus_15m',
          publishToSocialFeed: true
        }
      }
    ];
    edges = [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_topic_fast', branch: 'default' },
      { id: 'e2', sourceNodeId: 'node_topic_fast', targetNodeId: 'node_text', branch: 'default' },
      { id: 'e3', sourceNodeId: 'node_topic_fast', targetNodeId: 'node_img_prompt', branch: 'default' },
      { id: 'e4', sourceNodeId: 'node_img_prompt', targetNodeId: 'node_image', branch: 'default' },
      { id: 'e5', sourceNodeId: 'node_text', targetNodeId: 'node_publish', branch: 'default' },
      { id: 'e6', sourceNodeId: 'node_image', targetNodeId: 'node_publish', branch: 'default' }
    ];
  }

  return {
    id: `scen_${Date.now()}`,
    name: name || 'Автопостинг под ключ',
    description:
      format === 'rich'
        ? 'Сценарий формата Rich с заголовком темы, красивым оформлением, визуальными блоками и публикацией'
        : 'Сценарий формата v2 с генерацией темы, оформлением поста в одном шаге, системной сборкой медиа/лимитов и публикацией',
    category: cat,
    topicCategory: cat,
    enabled: true,
    schedule: 'Ежедневно в 10:00',
    targetChannels: targetChs,
    messageFormat: format,
    steps: [],
    nodes,
    edges,
    testResults: {},
    workflowLayout: 'canvas',
    createdAt: new Date().toISOString()
  };
}
