import { InlineButton } from '../../types';

export interface AcademySectionInfo {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  order: number;
}

export interface AcademyArticleItem {
  id: string;
  sectionSlug: string;
  sectionTitle: string;
  title: string;
  summary: string;
  content: string;
  formatMode: 'rich' | 'v2';
  attachmentUrl: string;
  attachmentUrls: string[];
  inlineButtons: InlineButton[][];
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AcademySectionSlug =
  | 'profile-channels-teams'
  | 'tariffs-partner'
  | 'social-chats'
  | 'posts-v2-rich'
  | 'automation-scenarios'
  | 'calendar-history-gallery'
  | 'folders-selections';

export const ACADEMY_SECTIONS: AcademySectionInfo[] = [
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

export const ACADEMY_BLOCK_GRADIENT =
  'bg-gradient-to-r from-sky-100/65 via-pink-100/65 via-orange-100/65 via-pink-100/65 to-sky-100/65 backdrop-blur-md';

export const ACADEMY_VIBRANT_GRADIENT =
  'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400';

export const ACADEMY_TEXT_GRADIENT =
  'bg-gradient-to-r from-sky-500 via-pink-600 via-orange-500 via-pink-600 to-sky-500 bg-clip-text text-transparent';

export async function fetchAcademyArticles(includeDrafts = false): Promise<{
  sections: AcademySectionInfo[];
  articles: AcademyArticleItem[];
}> {
  const qs = includeDrafts ? '?includeDrafts=true' : '';
  const res = await fetch(`/api/academy/articles${qs}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Не удалось загрузить материалы Академии');
  }
  return {
    sections: Array.isArray(data.sections) && data.sections.length > 0 ? data.sections : ACADEMY_SECTIONS,
    articles: Array.isArray(data.articles) ? data.articles : []
  };
}
