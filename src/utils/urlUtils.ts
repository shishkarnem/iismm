import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

/**
 * Ensures a URL is an original direct URL (preferring https://file.pro-talk.ru/tgf/...).
 */
export function formatAbsoluteUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = normalizeProTalkMediaUrl(url);
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/${trimmed}`;
    }
    return `/${trimmed}`;
  }
  return trimmed;
}

export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('tg://video')) return true;
  const clean = trimmed.split('?')[0].split('#')[0];
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.mkv') ||
    clean.endsWith('.avi') ||
    trimmed.includes('video/mp4') ||
    trimmed.includes('video/webm') ||
    trimmed.includes('/video/')
  );
}

