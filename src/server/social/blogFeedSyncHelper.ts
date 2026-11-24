import { DB } from '../db';
import { createBlogPostInPg, savePgDB } from '../db/postgres';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

export interface SyncToPlatformBlogParams {
  sourcePostId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  title: string;
  content: string;
  attachmentType?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: any[];
  messageFormat?: string;
  category?: string;
  channel?: string;
  prompt?: string;
}

/**
 * Дублирует опубликованный пост в открытую ленту блога платформы (/posts)
 * и сохраняет запись в PostgreSQL ProTalk на диск.
 */
export function syncPublishedPostToPlatformBlog(params: SyncToPlatformBlogParams) {
  try {
    const cleanUid = String(params.userId || '').trim();
    const user = cleanUid
      ? DB.getUsers().find(
          (u) =>
            String(u.id) === cleanUid ||
            (u.telegramId && String(u.telegramId) === cleanUid)
        )
      : null;

    const authorName =
      params.userName ||
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      user?.username ||
      'Команда ИИSMM (@IIrkiBot)';
    const authorAvatar =
      normalizeProTalkMediaUrl(
        params.userAvatar || user?.userAvatar || user?.avatarUrl || user?.photoUrl
      ) || BRAND_ASSETS.logo;
    const authorRole = user?.role || 'Пользователь';

    const cleanUrls = Array.isArray(params.attachmentUrls)
      ? params.attachmentUrls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
    const primaryImage = String(params.attachmentUrl || cleanUrls[0] || '').trim();

    const created = createBlogPostInPg({
      sourcePostId: params.sourcePostId,
      userId: cleanUid || undefined,
      title: (params.title || '').trim() || 'Новая публикация',
      desc:
        params.prompt ||
        (params.content ? String(params.content).replace(/\s+/g, ' ').slice(0, 160) : ''),
      content: params.content || '',
      category: params.category || 'news',
      format:
        params.attachmentType === 'video'
          ? 'video'
          : params.attachmentType === 'album' || cleanUrls.length > 1
          ? 'gallery'
          : params.attachmentType === 'photo' || Boolean(primaryImage)
          ? 'photo'
          : 'article',
      attachmentType: params.attachmentType || (primaryImage ? 'photo' : 'none'),
      attachmentUrl: primaryImage || undefined,
      attachmentUrls: cleanUrls.length > 0 ? cleanUrls : undefined,
      inlineButtons: params.inlineButtons,
      messageFormat: params.messageFormat === 'rich' ? 'rich' : 'v2',
      tag: params.channel ? `Канал ${params.channel}` : 'Telegram',
      dateStr: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      author: {
        name: authorName,
        avatar: authorAvatar,
        role: authorRole
      },
      image: primaryImage || undefined,
      album:
        cleanUrls.length > 1
          ? cleanUrls.map((url, idx) => ({ id: `img_${idx}`, url, caption: '' }))
          : undefined
    });

    savePgDB();
    return created;
  } catch (err) {
    console.error('[Blog Feed Sync Helper] Error:', err);
    return null;
  }
}
