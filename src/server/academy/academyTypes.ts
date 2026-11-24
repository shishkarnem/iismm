export interface AcademySectionMeta {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  order: number;
}

export interface AcademyInlineButton {
  text: string;
  url?: string;
  style?: string;
}

export interface AcademyArticle {
  id: string;
  sectionSlug: string;
  sectionTitle: string;
  title: string;
  summary: string;
  content: string;
  formatMode: 'rich' | 'v2';
  attachmentUrl: string;
  attachmentUrls: string[];
  inlineButtons: AcademyInlineButton[][];
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ACADEMY_SECTIONS: AcademySectionMeta[] = [
  {
    slug: 'profile-channels-teams',
    title: 'Профиль, каналы и Команды',
    shortTitle: 'Профиль и каналы',
    description: 'Настройка личного профиля, подключение каналов в систему и совместная работа в командах.',
    order: 1
  },
  {
    slug: 'tariffs-partner',
    title: 'Тарифы и Партнерка',
    shortTitle: 'Тарифы и партнерка',
    description: 'Выбор подходящего тарифа, баланс Иирок, реферальная ссылка и вознаграждения за приглашенных участников.',
    order: 2
  },
  {
    slug: 'social-chats',
    title: 'Соцсеть и Чаты',
    shortTitle: 'Соцсеть и чаты',
    description: 'Ведение авторской ленты, подписки на коллег, личные и групповые чаты с форматированием и голосовыми сообщениями.',
    order: 3
  },
  {
    slug: 'posts-v2-rich',
    title: 'Черновики постов v2 и Rich',
    shortTitle: 'Черновики v2 и Rich',
    description: 'Создание публикаций в классическом формате v2 и расширенном формате Rich, работа с кнопками, спойлерами и вложениями.',
    order: 4
  },
  {
    slug: 'automation-scenarios',
    title: 'Сценарии автоматизации',
    shortTitle: 'Сценарии',
    description: 'Пошаговая сборка цепочек автопостинга, генерация текстов и иллюстраций по расписанию с помощью Иирки.',
    order: 5
  },
  {
    slug: 'calendar-history-gallery',
    title: 'Календарь, История и Галерея',
    shortTitle: 'Календарь и галерея',
    description: 'Планирование контент-плана по дням месяца, контроль вышедших публикаций и хранение медиафайлов по папкам.',
    order: 6
  },
  {
    slug: 'folders-selections',
    title: 'Настройка Папок и Подборок',
    shortTitle: 'Папки и подборки',
    description: 'Организация взаимного продвижения каналов через общие папки и тематические подборки с карточками участников.',
    order: 7
  }
];
