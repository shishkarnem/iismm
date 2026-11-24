export interface BeautyLayoutPreset {
  id: string;
  format: 'v2' | 'rich';
  title: string;
  shortHint: string;
  rules: string[];
  fontsUsed: string[];
}

export interface FontTagReference {
  syntax: string;
  label: string;
  sample: string;
  purpose: string;
}

export const HEADING_DECOR_OPTIONS = [
  {
    value: 'sparkle',
    label: '✨ Акцент со звездочкой перед темой',
    hint: 'Жирный заголовок со сгенерированной темой и деликатным акцентом'
  },
  {
    value: 'pin',
    label: '📌 Навигационный маркер перед темой',
    hint: 'Подходит для гайдов, памяток, чек-листов и подборок'
  },
  {
    value: 'editorial',
    label: 'Газетная шапка с линией под заголовком',
    hint: 'Выделяет тему поста сверху тонким визуальным разделителем'
  },
  {
    value: 'clean',
    label: 'Чистый жирный заголовок без значков',
    hint: 'Лаконичная деловая и минималистичная подача темы'
  }
];

export const V2_LAYOUT_PRESETS: BeautyLayoutPreset[] = [
  {
    id: 'magazine_v2',
    format: 'v2',
    title: 'Журнальная подача v2',
    shortHint: 'Жирный заголовок темы <b>, курсивный лид <i>, абзацы по 2–3 строки и цитата',
    rules: [
      'Сверху жирный заголовок со сгенерированной темой через <b>...</b> (без решеток #)',
      'Второй абзац — вовлекающая курсивная подводка через <i>...</i>',
      'Короткие воздушные абзацы по 2–3 предложения с пустой строкой между ними',
      'Ключевые мысли в пунктах с жирным началом и финальная мысль в <blockquote>'
    ],
    fontsUsed: ['<b>жирный</b>', '<i>курсив</i>', '<blockquote>цитата</blockquote>']
  },
  {
    id: 'expert_cards_v2',
    format: 'v2',
    title: 'Экспертный разбор по карточкам v2',
    shortHint: 'Тезисы с цифрами, моноширинные метрики и четкий практический вывод',
    rules: [
      'Точный экспертный заголовок по сгенерированной теме в <b>...</b> (без #)',
      'Структурные карточки: 1️⃣, 2️⃣, 3️⃣ с жирным названием каждого тезиса <b>...</b>',
      'Цифры, сервисы, промокоды и формулы выделяются шрифтом <code>...</code>',
      'В конце — прикладной вывод для быстрого сохранения в избранное'
    ],
    fontsUsed: ['<b>жирный</b>', '<code>моноширинный</code>', '<u>подчеркнутый</u>']
  },
  {
    id: 'concise_digest_v2',
    format: 'v2',
    title: 'Лаконичный дайджест v2',
    shortHint: 'Быстрое чтение за 20 секунд: главное сверху, маркированный список, интрига',
    rules: [
      'Жирный заголовок <b>...</b> со сгенерированной темой первой строкой без лишней воды',
      'Сразу 3–5 емких пунктов с буллитами и жирными ключевыми словами',
      'Секретный инсайт или бонус в конце внутри тега <tg-spoiler>...</tg-spoiler>',
      'Строго компактный объем до 1 024 символов при наличии фото или альбома'
    ],
    fontsUsed: ['<b>жирный</b>', '<i>курсив</i>', '<tg-spoiler>спойлер</tg-spoiler>']
  },
  {
    id: 'story_emotion_v2',
    format: 'v2',
    title: 'Живая авторская история v2',
    shortHint: 'Личный тон, контрастные переходы, прямая речь в цитате и вопрос читателям',
    rules: [
      'Интригующий жирный заголовок <b>...</b> по сгенерированной теме в начале поста',
      'Короткая завязка курсивом <i>...</i> и живой ритм коротких и средних фраз',
      'Прямая речь или переломный момент вынесены в <blockquote>...</blockquote>',
      'Открытый вопрос аудитории в финальной строке для роста комментариев'
    ],
    fontsUsed: ['<b>жирный</b>', '<i>курсив</i>', '<blockquote>цитата</blockquote>']
  }
];

export const RICH_LAYOUT_PRESETS: BeautyLayoutPreset[] = [
  {
    id: 'editorial_longread',
    format: 'rich',
    title: 'Журнальный лонгрид Rich',
    shortHint: 'Главный заголовок # Тема, главы ##, врезки-цитаты и разделители',
    rules: [
      'Первая строка — главный заголовок статьи # со сгенерированной темой',
      'Курсивный лид-абзац, раскрывающий ценность материала для читателя',
      'Логические главы с подзаголовками ## и тонкими линиями --- между разделами',
      'Выделение ключевых идей жирным **...**, врезки > цитата и сильное резюме'
    ],
    fontsUsed: ['# Заголовок', '## Глава', '**жирный**', '*курсив*', '> цитата', '---']
  },
  {
    id: 'step_by_step_guide',
    format: 'rich',
    title: 'Пошаговый практикум и чек-лист Rich',
    shortHint: 'Пошаговые этапы, моноширинные команды и интерактивные чекбоксы [x]',
    rules: [
      'Главный заголовок # со сгенерированной темой практикума',
      'Каждый шаг оформлен подзаголовком ## Шаг 1, ## Шаг 2 с примером применения',
      'Настройки и термины выделены моноширинным шрифтом `...`',
      'Финальный блок самопроверки в виде интерактивного чек-листа - [x] и - [ ]'
    ],
    fontsUsed: ['# Заголовок', '## Шаг', '`моноширинный`', '- [x] чекбокс', '**жирный**']
  },
  {
    id: 'analytical_review',
    format: 'rich',
    title: 'Аналитический обзор с таблицей Rich',
    shortHint: 'Глубокий разбор, сравнительная таблица показателей и блок выводов',
    rules: [
      'Аналитический заголовок # по сгенерированной теме исследования',
      'Разделение на предпосылки, аргументы и практические сценарии через ##',
      'Наглядная markdown-таблица сравнения параметров и результатов',
      'Ключевой вывод аналитика в блоке цитаты > в завершении статьи'
    ],
    fontsUsed: ['# Заголовок', '## Раздел', '| Таблица |', '`цифры`', '> вывод']
  },
  {
    id: 'visual_story_rich',
    format: 'rich',
    title: 'Визуальный репортаж по главам Rich',
    shortHint: 'Воздушная верстка под иллюстрации, слайдеры и коллажи в каждой главе',
    rules: [
      'Образный главный заголовок # со сгенерированной темой истории',
      'Короткие ритмичные главы ##, удобные для вставки иллюстраций и коллажей',
      'Контраст жирных смысловых акцентов **...** и мягких курсивных ремарок *...*',
      'Чистые разделители --- для комфортного чтения с экрана телефона'
    ],
    fontsUsed: ['# Заголовок', '## Сцена', '**акцент**', '*ремарка*', '---']
  }
];

export const V2_FONT_GUIDE: FontTagReference[] = [
  { syntax: '<b>Текст</b>', label: 'Полужирный шрифт', sample: 'Главный тезис и заголовок темы', purpose: 'Заголовок и ключевые смыслы (вместо #)' },
  { syntax: '<i>Текст</i>', label: 'Курсивное начертание', sample: 'Мягкая подводка и авторский тон', purpose: 'Лид-абзац, нюансы и эмоции' },
  { syntax: '<code>Текст</code>', label: 'Моноширинный шрифт', sample: '920 симв. · +38% охват', purpose: 'Цифры, метрики, команды, коды' },
  { syntax: '<u>Текст</u>', label: 'Подчеркнутый шрифт', sample: 'Важная деталь условия', purpose: 'Точечный фокус внимания' },
  { syntax: '<blockquote>...</blockquote>', label: 'Блок цитаты Telegram', sample: 'Сильная мысль или инсайт автора', purpose: 'Выделение главной идеи рамкой' },
  { syntax: '<tg-spoiler>...</tg-spoiler>', label: 'Скрытый спойлер', sample: 'Нажмите, чтобы открыть вывод', purpose: 'Интрига и вовлечение читателя' }
];

export const RICH_FONT_GUIDE: FontTagReference[] = [
  { syntax: '# Тема статьи', label: 'Заголовок первого уровня', sample: 'Крупный заголовок со сгенерированной темой', purpose: 'Главная шапка Rich-публикации' },
  { syntax: '## Название главы', label: 'Подзаголовок раздела', sample: 'Логическая глава материала', purpose: 'Навигация по длинной статье' },
  { syntax: '**Текст** и *текст*', label: 'Жирный и курсив', sample: 'Смысловой акцент и интонация', purpose: 'Ритм чтения внутри абзацев' },
  { syntax: '`метрика`', label: 'Моноширинный акцент', sample: '15 минут · 3 шага', purpose: 'Точные данные и параметры' },
  { syntax: '- [x] Пункт', label: 'Список чекбоксов', sample: 'Готовый шаг проверки', purpose: 'Наглядные чек-листы в Rich' },
  { syntax: '| Колонка | Значение |', label: 'Таблица показателей', sample: 'Сравнение параметров по строкам', purpose: 'Структурная аналитика в Rich' }
];

export function resolveBeautyLayoutPreset(
  format: 'v2' | 'rich',
  presetId?: string
): BeautyLayoutPreset {
  if (format === 'rich') {
    return RICH_LAYOUT_PRESETS.find((p) => p.id === presetId) || RICH_LAYOUT_PRESETS[0];
  }
  return V2_LAYOUT_PRESETS.find((p) => p.id === presetId) || V2_LAYOUT_PRESETS[0];
}

export interface BeautyPostLivePreviewData {
  formatLabel: string;
  presetTitle: string;
  headingLine: string;
  showEditorialRule: boolean;
  leadLine: string;
  bodyBullets: Array<{ prefix: string; boldPart: string; restPart: string; codeChip?: string }>;
  quoteText?: string;
  spoilerText?: string;
  checklistItems?: Array<{ checked: boolean; text: string }>;
  tableRows?: Array<[string, string]>;
  rawSample: string;
}

export function buildBeautyPostLivePreview(
  config: Record<string, any>,
  format: 'v2' | 'rich',
  sampleTopic: string,
  styleTitle: string
): BeautyPostLivePreviewData {
  const cleanTopic = (sampleTopic || 'Как нейросети экономят 5 часов в неделю на контенте').trim();
  const template = String(config?.topicHeadingTemplate || '{{topic}}').trim() || '{{topic}}';
  const filledTopic = template
    .replace(/\{\{\s*topic\s*\}\}/gi, cleanTopic)
    .replace(/\{\{\s*title\s*\}\}/gi, cleanTopic);

  const includeHeading = config?.includeTopicHeading !== false;
  const decor = String(config?.headingDecor || 'sparkle');
  const prefix = decor === 'sparkle' ? '✨ ' : decor === 'pin' ? '📌 ' : '';
  const headingLine = includeHeading ? `${prefix}${filledTopic}` : '';
  const showEditorialRule = includeHeading && decor === 'editorial';

  if (format === 'v2') {
    const presetId = String(config?.v2LayoutPreset || 'magazine_v2');
    const preset = V2_LAYOUT_PRESETS.find((p) => p.id === presetId) || V2_LAYOUT_PRESETS[0];
    const useItalic = config?.v2UseItalicLead !== false;
    const useCode = config?.v2UseMonospace !== false;
    const useQuote = config?.v2UseBlockquote !== false;
    const useSpoiler = Boolean(config?.v2UseSpoiler || presetId === 'concise_digest_v2');
    const useEmoji = config?.v2UseEmojiBullets !== false;

    const rawLines: string[] = [];
    if (includeHeading) {
      rawLines.push(`<b>${prefix}${filledTopic}</b>`);
      if (showEditorialRule) rawLines.push('⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯');
    }
    if (useItalic) {
      rawLines.push(`<i>Короткий разбор в стиле «${styleTitle}»: только проверенные шаги без воды.</i>`);
    }
    rawLines.push(
      `${useEmoji ? '🔹 ' : '• '}<b>Четкая система:</b> планирование рубрик заранее экономит ${
        useCode ? '<code>3.5 часа</code>' : '3.5 часа'
      } каждую неделю.`
    );
    rawLines.push(
      `${useEmoji ? '🔹 ' : '• '}<b>Единый голос канала:</b> читатели сразу узнают вашу подачу с первых строк.`
    );
    if (useQuote) {
      rawLines.push('<blockquote>Сильное оформление удерживает внимание до последней строчки поста.</blockquote>');
    }
    if (useSpoiler) {
      rawLines.push('Секретный прием: <tg-spoiler>объединяйте генерацию темы и верстку в одну цепочку</tg-spoiler>');
    }

    return {
      formatLabel: 'Разметка Telegram v2 (HTML-теги)',
      presetTitle: preset.title,
      headingLine,
      showEditorialRule,
      leadLine: useItalic
        ? `Короткий разбор в стиле «${styleTitle}»: только проверенные шаги без воды.`
        : '',
      bodyBullets: [
        {
          prefix: useEmoji ? '🔹' : '•',
          boldPart: 'Четкая система:',
          restPart: 'планирование рубрик заранее экономит',
          codeChip: useCode ? '3.5 часа' : undefined
        },
        {
          prefix: useEmoji ? '🔹' : '•',
          boldPart: 'Единый голос канала:',
          restPart: 'читатели узнают вашу подачу с первых строк.'
        }
      ],
      quoteText: useQuote
        ? 'Сильное оформление удерживает внимание до последней строчки поста.'
        : undefined,
      spoilerText: useSpoiler
        ? 'объединяйте генерацию темы и верстку в одну цепочку'
        : undefined,
      rawSample: rawLines.join('\n\n')
    };
  }

  const presetId = String(config?.richLayoutPreset || 'editorial_longread');
  const preset = RICH_LAYOUT_PRESETS.find((p) => p.id === presetId) || RICH_LAYOUT_PRESETS[0];
  const useQuote = config?.richUseBlockquote !== false;
  const useChecklist = config?.richUseChecklist !== false;
  const useTable = Boolean(config?.richUseTable || presetId === 'analytical_review');
  const useDividers = config?.richUseDividers !== false;

  const rawRich: string[] = [];
  if (includeHeading) {
    rawRich.push(`# ${prefix}${filledTopic}`);
  }
  rawRich.push(`*Материал оформлен в стиле «${styleTitle}» с разбивкой по главам Rich.*`);
  if (useDividers) rawRich.push('---');
  rawRich.push('## Ключевые ориентиры внедрения');
  rawRich.push('Переход на системную верстку повышает дочитываемость длинных публикаций на `42%`.');
  if (useChecklist) {
    rawRich.push('- [x] Сгенерировать свежую тему выпуска\n- [x] Оформить заголовок и акценты\n- [ ] Проверить отложенное время выхода');
  }
  if (useQuote) {
    rawRich.push('> Читабельная структура превращает сложный материал в понятный маршрут.');
  }

  return {
    formatLabel: 'Формат статьи Rich (главы, чек-листы, таблицы)',
    presetTitle: preset.title,
    headingLine,
    showEditorialRule,
    leadLine: `Материал оформлен в стиле «${styleTitle}» с наглядной структурой разделов.`,
    bodyBullets: [
      {
        prefix: '##',
        boldPart: 'Ключевые ориентиры внедрения',
        restPart: 'Переход на системную верстку повышает дочитываемость на',
        codeChip: '42%'
      }
    ],
    checklistItems: useChecklist
      ? [
          { checked: true, text: 'Сгенерировать свежую тему выпуска' },
          { checked: true, text: 'Вынести тему в главный заголовок статьи' },
          { checked: false, text: 'Запланировать выход в целевой канал' }
        ]
      : undefined,
    tableRows: useTable
      ? [
          ['Параметр', 'Эффект в канале'],
          ['Заголовок с темой', 'Быстрый захват внимания'],
          ['Разбивка по главам', 'Глубокое дочитывание']
        ]
      : undefined,
    quoteText: useQuote
      ? 'Читабельная структура превращает сложный материал в понятный маршрут.'
      : undefined,
    rawSample: rawRich.join('\n\n')
  };
}
