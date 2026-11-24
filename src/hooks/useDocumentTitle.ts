import { useEffect } from 'react';
import { cleanRoutePath, isDraftsListPath, isNeuroplanPath } from './useAppRouting';
import { DayRequest } from '../types';

export function resolveDocumentTitle(
  currentPath: string,
  dayRequests: DayRequest[] = [],
  selectedPostId?: string | null
): string | null {
  const path = cleanRoutePath(currentPath || '/');

  if (path === '/' || path === '/main') {
    return 'ИИSMM — Сервис ИИ Автопостинга, Нейросетей и Управления Соцсетями';
  }
  if (path === '/academy' || path.startsWith('/academy/')) {
    return 'Академия ИИSMM — Пошаговое обучение автопостингу';
  }
  if (isNeuroplanPath(path)) {
    return 'Нейроплан контент-выходов — ИИSMM';
  }
  if (isDraftsListPath(path) || path === '/posts/redactor') {
    return 'Черновики публикаций — ИИSMM';
  }
  if (path.startsWith('/scenarios')) {
    return 'Сценарии автопостинга — ИИSMM';
  }
  if (path.startsWith('/crosspost')) {
    return 'Кросспостинг публикаций — ИИSMM';
  }
  if (path.startsWith('/posts/')) {
    const rawSub = decodeURIComponent(path.slice('/posts/'.length).replace(/\/+$/, ''));
    const activeId = selectedPostId || rawSub;
    const matched = dayRequests.find((d) => d.id === activeId || d.id === rawSub);
    if (matched) {
      const cleanTitle = (matched.title || '').trim();
      return cleanTitle && cleanTitle !== 'Новый пост без названия'
        ? `${cleanTitle} — Редактор ИИSMM`
        : 'Редактор нового поста — ИИSMM';
    }
    if (rawSub.startsWith('req_')) {
      return 'Редактор поста — ИИSMM';
    }
    // Публичный пост блога сам выставит заголовок в SingleBlogPostPage
    return null;
  }
  if (path.startsWith('/blog/')) {
    return null;
  }
  if (path === '/blog' || path === '/posts' || /^\/posts[^/]+$/.test(path)) {
    return 'Публикации и блог — ИИSMM';
  }
  if (path.startsWith('/channels')) {
    return 'Каналы и группы — ИИSMM';
  }
  if (path.startsWith('/calendar')) {
    return 'Календарь публикаций — ИИSMM';
  }
  if (path.startsWith('/history')) {
    return 'История публикаций — ИИSMM';
  }
  if (path.startsWith('/gallery')) {
    return 'Галерея файлов — ИИSMM';
  }
  if (path.startsWith('/folders')) {
    return 'Папки взаимного пиара — ИИSMM';
  }
  if (path.startsWith('/social')) {
    return 'Социальный профиль — ИИSMM';
  }
  if (path.startsWith('/market')) {
    return 'Биржа рекламы — ИИSMM';
  }
  if (path.startsWith('/bundles')) {
    return 'Подборки каналов — ИИSMM';
  }
  if (path.startsWith('/tarif')) {
    return 'Тарифы и баланс ИИрок — ИИSMM';
  }
  if (path.startsWith('/partner')) {
    return 'Партнёрская программа — ИИSMM';
  }
  if (path.startsWith('/teams')) {
    return 'Команды и доступы — ИИSMM';
  }
  if (path.startsWith('/brand')) {
    return 'Брендирование — ИИSMM';
  }
  if (path.startsWith('/api-keys')) {
    return 'API-ключи — ИИSMM';
  }
  if (path.startsWith('/roundtable')) {
    return 'Круглый стол ИИ — ИИSMM';
  }
  if (path.startsWith('/enterprise')) {
    return 'Корпоративные решения — ИИSMM';
  }
  if (path.startsWith('/profile')) {
    return 'Личный кабинет — ИИSMM';
  }
  if (path.startsWith('/dashboard')) {
    return 'Панель управления — ИИSMM';
  }
  if (path.startsWith('/admin/prompts')) {
    return 'Промпты и шаблоны ИИ — Админ-панель ИИSMM';
  }
  if (path.startsWith('/admin') || path.startsWith('/system-admin')) {
    return 'Администрирование — ИИSMM';
  }
  if (path.startsWith('/oferta') || path.startsWith('/payment/oferta')) {
    return 'Публичная оферта — ИИSMM';
  }
  if (path.startsWith('/privacy') || path.startsWith('/policy')) {
    return 'Политика конфиденциальности — ИИSMM';
  }
  if (path.startsWith('/agreement')) {
    return 'Пользовательское соглашение — ИИSMM';
  }
  if (path.startsWith('/consent') || path.startsWith('/personal-data')) {
    return 'Согласие на обработку данных — ИИSMM';
  }
  if (path.startsWith('/payment/success') || path.startsWith('/payment/robokassa/success')) {
    return 'Оплата выполнена — ИИSMM';
  }
  if (path.startsWith('/payment/fail') || path.startsWith('/payment/fall') || path.startsWith('/payment/robokassa/fail')) {
    return 'Ошибка оплаты — ИИSMM';
  }
  if (path.startsWith('/reset-password')) {
    return 'Сброс пароля — ИИSMM';
  }

  return 'ИИSMM — Умный автопостинг и управление соцсетями';
}

export function useDocumentTitle(
  currentPath: string,
  dayRequests: DayRequest[] = [],
  selectedPostId?: string | null
): void {
  const activePost = selectedPostId
    ? dayRequests.find((d) => d.id === selectedPostId)
    : undefined;
  const activePostTitle = activePost?.title || '';

  useEffect(() => {
    const resolved = resolveDocumentTitle(currentPath, dayRequests, selectedPostId);
    if (resolved) {
      document.title = resolved;
    }
  }, [currentPath, selectedPostId, activePostTitle, dayRequests.length]);
}
