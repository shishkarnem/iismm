import { BRAND_ASSETS } from '../../constants/proTalkStorage';

export const IISMM_TEST_LOGO_URL = BRAND_ASSETS.logo;

export interface OnboardingInlineButtonItem {
  id: string;
  text: string;
  type: 'url';
  url: string;
  style?: 'default' | 'primary' | 'brand' | 'orange';
}

export interface OnboardingStateRecord {
  userId: string;
  currentStep: number;
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  tourCompleted: boolean;
  dismissed: boolean;
  selectedChannelId: string;
  createdPostId: string;
  createdScenarioId: string;
  updatedAt: string;
}

export interface OnboardingAccountInfo {
  userId: string;
  hasEmail: boolean;
  hasTelegram: boolean;
  email: string;
  telegramId?: number;
  username: string;
  balance: number;
  tariff: string;
  startEmailGranted: boolean;
  startTmaGranted: boolean;
  channelsCount: number;
  postsCount: number;
  scenariosCount: number;
}

export interface OnboardingPostStarterTemplate {
  id: string;
  format: 'v2' | 'rich';
  label: string;
  badge: string;
  title: string;
  content: string;
  attachmentType?: 'photo' | 'none';
  attachmentUrl?: string;
  inlineButtons?: OnboardingInlineButtonItem[][];
}

export const STEP2_CHANNEL_LOGO_TEST_TEMPLATES: OnboardingPostStarterTemplate[] = [
  {
    id: 'step2_logo_v2',
    format: 'v2',
    label: 'Тест с нашим логотипом (формат Telegram v2)',
    badge: 'Обложка с логотипом · v2',
    title: 'Проверка связи и оформления в формате Telegram v2',
    attachmentType: 'photo',
    attachmentUrl: IISMM_TEST_LOGO_URL,
    content: [
      '<b>✨ Канал успешно подключен и готов к автопубликациям!</b>',
      'Это тестовое сообщение с фирменным логотипом платформы в качестве тестовой картинки для проверки верстки <b>Telegram v2</b>.',
      '• Жирный акцент и чистые отступы между абзацами\n• Поддержка фотографий по прямой ссылке из галереи\n• Интерактивные инлайн-кнопки под публикацией',
      '<blockquote>Если вы видите логотип над текстом и кнопку ниже — права бота и медиа-доставка работают отлично!</blockquote>'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'btn_step2_v2_bot',
          text: '✨ Открыть бота платформы',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'primary'
        }
      ]
    ]
  },
  {
    id: 'step2_logo_rich',
    format: 'rich',
    label: 'Тест с нашим логотипом (журнальный формат Rich)',
    badge: 'Встроенный логотип · Rich',
    title: 'Проверка журнальной верстки Rich с нашим логотипом',
    attachmentType: 'none',
    attachmentUrl: '',
    content: [
      '# ✨ Проверка журнальной верстки Rich',
      `![Тестовая картинка с нашим логотипом](${IISMM_TEST_LOGO_URL})`,
      'Каждый абзац и каждый переход между типами блоков отделен пустой строкой, чтобы статья легко читалась с экрана смартфона.',
      '## Что проверяет этот шаблон',
      '- Корректную загрузку иллюстрации с логотипом внутри Rich-статьи',
      '- Разделение заголовков, списков, цитат и абзацев',
      '- Отображение инлайн-кнопок под материалом',
      '---',
      '> Поздравляем: ваш канал полностью готов к выпуску экспертных публикаций и автоматических сценариев!'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'btn_step2_rich_bot',
          text: '🚀 Перейти в Telegram-бота',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'brand'
        }
      ]
    ]
  }
];

export const ONBOARDING_POST_TEMPLATES: OnboardingPostStarterTemplate[] = [
  {
    id: 'welcome_expert_v2',
    format: 'v2',
    label: 'Приветственный экспертный пост с логотипом (формат Telegram v2)',
    badge: 'С тестовым логотипом · v2',
    title: 'Добро пожаловать в наш обновленный канал',
    attachmentType: 'photo',
    attachmentUrl: IISMM_TEST_LOGO_URL,
    content: [
      '<b>✨ Рады видеть вас на канале!</b>',
      'Мы подготовили удобный формат выпусков с наглядными примерами и четким разделением мыслей по абзацам.',
      '• Практические разборы и готовые решения без лишней воды\n• Свежие идеи и проверенные инструменты для роста\n• Ответы на ваши вопросы и живые примеры из практики',
      '<blockquote>Напишите в комментариях, какая тема интересна вам прямо сейчас — подготовим подробный выпуск!</blockquote>'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'tpl_v2_1',
          text: '💬 Написать вопрос в бота',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'primary'
        }
      ]
    ]
  },
  {
    id: 'checklist_value_v2',
    format: 'v2',
    label: 'Полезный чек-лист из 3 шагов с логотипом (формат Telegram v2)',
    badge: 'Чек-лист + логотип · v2',
    title: 'Три простых шага, которые экономят часы работы каждую неделю',
    attachmentType: 'photo',
    attachmentUrl: IISMM_TEST_LOGO_URL,
    content: [
      '<b>📌 Три шага к системному контент-плану</b>',
      'Системный выпуск постов начинается с понятной структуры, где каждый шаг читается легко и отдельно.',
      '1. <b>Соберите ключевые вопросы аудитории</b> — именно они дают самый живой отклик.',
      '2. <b>Оформите единый визуальный стиль</b> — читатели сразу узнают ваши публикации в ленте.',
      '3. <b>Автоматизируйте рутину по расписанию</b> — освободите время для стратегии и общения.',
      'Сохраняйте пост в закладки, чтобы применить уже сегодня!'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'tpl_v2_check_1',
          text: '✨ Запустить помощника',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'primary'
        },
        {
          id: 'tpl_v2_check_2',
          text: '📱 Открыть мини-приложение',
          type: 'url',
          url: 'https://t.me/IIrkiBot/app',
          style: 'default'
        }
      ]
    ]
  },
  {
    id: 'editorial_rich_article',
    format: 'rich',
    label: 'Структурированная мини-статья с логотипом (формат Rich)',
    badge: 'С логотипом · Rich',
    title: 'Как превратить экспертный блог в системный источник клиентов',
    attachmentType: 'none',
    attachmentUrl: '',
    content: [
      '# ✨ Как выстроить доверие через регулярный контент',
      `![Тестовая обложка с нашим логотипом](${IISMM_TEST_LOGO_URL})`,
      'Сильный авторский канал строится на понятной структуре, живом языке и уважении ко времени читателя.',
      '## На что обратить внимание в первую очередь',
      '- Четкий заголовок, который сразу передает главную пользу материала',
      '- Короткие абзацы и пустые строки при каждой смене типа блока для удобного чтения с телефона',
      '- Регулярный график выхода публикаций без выгорания автора',
      '---',
      '> Главное правило: один пост — одна ясная мысль и конкретный практический вывод для подписчика.'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'tpl_rich_1',
          text: '🚀 Попробовать в Telegram',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'brand'
        }
      ]
    ]
  },
  {
    id: 'brand_showcase_rich',
    format: 'rich',
    label: 'Гайд по шагам с чек-листом и логотипом (формат Rich)',
    badge: 'Чек-лист + логотип · Rich',
    title: 'Пошаговый запуск контент-системы за один вечер',
    attachmentType: 'none',
    attachmentUrl: '',
    content: [
      '# 📌 Пошаговый запуск контент-системы',
      `![Фирменный логотип в формате Rich](${IISMM_TEST_LOGO_URL})`,
      'В формате Rich вы можете сочетать заголовки, иллюстрации, чек-листы и цитаты в одной красивой публикации.',
      '### Проверьте готовность перед стартом',
      '- [x] Подключен аккаунт и начислены стартовые бонусы',
      '- [x] Проверена тестовая картинка с нашим логотипом',
      '- [ ] Запущен первый автоматический сценарий',
      '> Нажмите на кнопку отправки теста ниже, чтобы увидеть результат в реальном Telegram и в окне предпросмотра.'
    ].join('\n\n'),
    inlineButtons: [
      [
        {
          id: 'tpl_rich_guide_1',
          text: '✨ Открыть @IIrkiBot',
          type: 'url',
          url: 'https://t.me/IIrkiBot',
          style: 'primary'
        }
      ]
    ]
  }
];

export interface OnboardingTariffCard {
  name: string;
  priceLabel: string;
  iirkiPerMonth: string;
  highlight: string;
  features: string[];
}

export const ONBOARDING_TARIFF_CARDS: OnboardingTariffCard[] = [
  {
    name: 'Старт',
    priceLabel: 'Бесплатно',
    iirkiPerMonth: '300 Иирок при старте',
    highlight: 'Для знакомства с платформой и первых публикаций',
    features: [
      'До +600 стартовых Иирок (300 за почту и 300 за Telegram)',
      'Конструктор постов v2 и Rich с предпросмотром',
      'Генерация картинок нейросетью (модели 621, 784 и Про 791)',
      'Генерация и красивое оформление поста в сценариях по 1 Иирке'
    ]
  },
  {
    name: 'Разгон',
    priceLabel: 'Выгодный старт роста',
    iirkiPerMonth: 'Ежемесячное начисление Иирок',
    highlight: 'Для авторов и экспертов с регулярным ведением каналов',
    features: [
      'Увеличенный пакет Иирок каждый месяц на генерации и обложки',
      'Автоматические сценарии по расписанию и нейроплан',
      'Стилизация постов под живой почерк вашего канала',
      'Кросспостинг и расширенная медиа-галерея'
    ]
  },
  {
    name: 'Отрыв',
    priceLabel: 'Командная работа',
    iirkiPerMonth: 'Большой запас Иирок в месяц',
    highlight: 'Для продюсеров, редакций и сетки Telegram-каналов',
    features: [
      'Совместный доступ к каналам для участников вашей команды',
      'Параллельные цепочки сценариев с инфографикой и кнопками',
      'Приоритетная обработка очередей автопубликаций',
      'Полный доступ к аналитике и партнерским инструментам'
    ]
  },
  {
    name: 'Космос',
    priceLabel: 'Максимум возможностей',
    iirkiPerMonth: 'Максимальный пакет Иирок',
    highlight: 'Для агентств, медиа-сетей и масштабной автоматизации',
    features: [
      'Максимальные лимиты на каналы, команды и сценарии',
      'Генерация обложек, карточек и кириллической инфографики (791)',
      'Индивидуальные стили, шаблоны и премиальная поддержка',
      'Полная свобода масштабирования всех проектов в одном окне'
    ]
  }
];
