import { transliterateToSlug, generateUniqueSlug } from '../db/blogPostsTable';
import { createNotificationInDb } from '../db/notificationsTable';
import { getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { cleanAuthorName, savePgDB } from './coreSettingsRepo';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

import {
  isOneOffScheduleFrequency,
  isPublishedPostStatus,
  parseScheduleDateTimeInTimezone,
  getZonedPartsInTimezone
} from '../domains/posts/postStatusHelpers';

export function fetchAllBlogPostsFromPg(options?: {
  tab?: 'recommendations' | 'subscriptions' | 'yours' | 'new';
  userId?: string;
  limit?: number;
  offset?: number;
}): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec('SELECT * FROM posts ORDER BY created_at DESC');
    if (!res[0]) return [];
    const columns = res[0].columns;
    const rawRows = res[0].values
      .map((valArr: any[]) => {
        const rowObj: Record<string, any> = {};
        columns.forEach((col: string, idx: number) => {
          rowObj[col] = valArr[idx];
        });
        return rowObj;
      })
      .filter((r) => {
        const rawId = String(r.id || '').trim();
        const rawChan = String(r.channel || '').trim();
        if (
          !rawId ||
          rawId.startsWith('sched_') ||
          rawId.startsWith('pub_cron_') ||
          rawId.startsWith('pub_') ||
          rawChan.startsWith('DM:')
        ) {
          return false;
        }
        if (!isPublishedPostStatus(r.status)) return false;
        const hasAuthorName = Boolean(r.author_name && String(r.author_name).trim());
        return hasAuthorName || rawId.startsWith('blog_') || /^\d{12,}$/.test(rawId);
      });

    for (const r of rawRows) {
      if (!r.slug) {
        const generated = generateUniqueSlug(dbInstance as any, r.title || 'post', String(r.id));
        r.slug = generated;
        try {
          dbInstance.run('UPDATE posts SET slug = ? WHERE id = ?', [generated, r.id]);
        } catch {}
      }
    }

    const hasExplicitDayPost = rawRows.some((r) => Number(r.is_post_of_day) === 1);
    let dayPostId = '';
    if (hasExplicitDayPost) {
      dayPostId = rawRows.find((r) => Number(r.is_post_of_day) === 1)?.id || rawRows[0]?.id;
    } else if (rawRows.length > 0) {
      const sortedByPopularity = [...rawRows].sort((a, b) => {
        const popA = (a.views_count || 0) + (a.likes_count || 0) * 5;
        const popB = (b.views_count || 0) + (b.likes_count || 0) * 5;
        return popB - popA;
      });
      dayPostId = sortedByPopularity[0]?.id || rawRows[0]?.id;
    }

    const userMap = new Map<string, any>();
    try {
      const uRes = dbInstance.exec(
        'SELECT id, telegram_id, first_name, last_name, username, photo_url, role, tariff FROM users'
      );
      if (uRes[0] && uRes[0].values) {
        uRes[0].values.forEach((row: any[]) => {
          const uId = String(row[0]);
          const tgId = row[1] ? String(row[1]) : '';
          const fName = String(row[2] || '');
          const lName = String(row[3] || '');
          const rawUsername = String(row[4] || '');
          const rawPhoto = String(row[5] || '');
          const role = String(row[6] || 'Автор');
          const tariff = String(row[7] || 'Старт');

          const cleanAvatar = normalizeProTalkMediaUrl(rawPhoto) || BRAND_ASSETS.heartAvatar;

          const uObj = {
            id: uId,
            telegramId: tgId,
            name: `${fName} ${lName}`.trim() || rawUsername || 'Соавтор',
            username: rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : `@id${uId}`,
            avatar: cleanAvatar,
            role,
            tariff
          };

          userMap.set(uId, uObj);
          if (tgId) userMap.set(tgId, uObj);
          if (rawUsername) {
            userMap.set(rawUsername.toLowerCase().replace('@', ''), uObj);
          }
          if (uObj.name) {
            userMap.set(uObj.name.toLowerCase(), uObj);
          }
        });
      }
    } catch {}

    const reqIdSet = new Set<string>();
    try {
      const reqRes = dbInstance.exec("SELECT id FROM posts WHERE id LIKE 'req_%'");
      if (reqRes[0]?.values) {
        reqRes[0].values.forEach((v: any[]) => {
          if (v[0]) reqIdSet.add(String(v[0]).trim());
        });
      }
    } catch {}

    let posts = rawRows.map((r: any) => {
      const rawIdStr = String(r.id || '').trim();
      const candidateReqId = rawIdStr.startsWith('blog_') ? `req_${rawIdStr.slice(5)}` : '';
      const resolvedSourcePostId = candidateReqId && reqIdSet.has(candidateReqId) ? candidateReqId : rawIdStr;
      const isDay = r.id === dayPostId;
      let album = [];
      if (r.album_json) {
        try {
          album = JSON.parse(r.album_json);
        } catch {}
      }
      let inlineButtons = [];
      if (r.inline_buttons_json) {
        try {
          inlineButtons = JSON.parse(r.inline_buttons_json);
        } catch {}
      }
      let attachmentUrls: string[] = [];
      if (r.attachment_urls_json) {
        try {
          attachmentUrls = JSON.parse(r.attachment_urls_json);
        } catch {}
      } else if (r.attachment_url) {
        attachmentUrls = [r.attachment_url];
      }

      let commentsCount = 0;
      try {
        const cRes = dbInstance.exec('SELECT COUNT(*) FROM post_comments WHERE post_id = ? OR post_id = ?', [
          r.id,
          r.slug || r.id
        ]);
        if (cRes[0] && cRes[0].values[0]) {
          commentsCount = Number(cRes[0].values[0][0]) || 0;
        }
      } catch {}

      const reactions: Record<string, number> = { like: 0, love: 0, fire: 0, haha: 0, wow: 0 };
      try {
        const rRes = dbInstance.exec(
          'SELECT reaction_type, COUNT(*) FROM post_reactions WHERE post_id = ? OR post_id = ? GROUP BY reaction_type',
          [r.id, r.slug || r.id]
        );
        if (rRes[0]) {
          rRes[0].values.forEach((row: any[]) => {
            const rType = String(row[0]);
            reactions[rType] = Number(row[1]) || 0;
          });
        }
      } catch {}

      const effectiveContent = r.post_text || r.content || r.desc || '';
      let detectedFormat = r.message_format || 'rich';
      const hasRichMarkers =
        /<(?:tg-collage|tg-slideshow|details|summary|table|blockquote|tg-spoiler|tg-emoji|b|strong|i|em|u|ins|s|strike|del|pre|code|a\s+)/i.test(
          effectiveContent
        ) || /(?:^|\n)(?:#{1,6}\s+|-\s*\[[ xX]\]|\*\s*\[[ xX]\]|\s*>\s+)/m.test(effectiveContent);
      if (hasRichMarkers || r.message_format === 'rich' || r.message_format === 'html') {
        detectedFormat = 'rich';
      } else if (r.message_format === 'v2' || r.message_format === 'markdown') {
        detectedFormat = 'v2';
      }

      return {
        id: String(r.id),
        sourcePostId: resolvedSourcePostId,
        slug: r.slug || transliterateToSlug(r.title || 'post'),
        userId: r.user_id ? String(r.user_id) : undefined,
        category: isDay ? 'day' : r.category || 'article',
        isPostOfDay: isDay,
        isPromoted: Number(r.is_promoted || 0) === 1,
        promotedAt: r.promoted_at || undefined,
        title: r.title,
        desc: r.desc || '',
        content: effectiveContent,
        format: r.format || 'photo',
        attachmentType: r.attachment_type || r.format || 'photo',
        attachmentUrl: r.attachment_url || r.image_url || undefined,
        attachmentUrls,
        inlineButtons,
        messageFormat: detectedFormat,
        tag: isDay
          ? 'Пост дня'
          : Number(r.is_promoted || 0) === 1
            ? 'Продвигается'
            : r.tag || (r.category === 'news' ? 'Новости ИИSMM' : r.category === 'blogger' ? 'Пост Блогера' : 'Статья'),
        readTime: r.read_time || '5 мин',
        date: r.date_str || new Date(r.created_at || Date.now()).toLocaleDateString('ru-RU'),
        createdAt: r.created_at || new Date().toISOString(),
        author: (() => {
          const matchedUser =
            (r.user_id && userMap.get(String(r.user_id))) ||
            (r.author_name && userMap.get(String(r.author_name).toLowerCase())) ||
            null;
          const postAvatar =
            normalizeProTalkMediaUrl(matchedUser?.avatar || r.author_avatar) || BRAND_ASSETS.heartAvatar;
          return {
            id: matchedUser?.id || (r.user_id ? String(r.user_id) : undefined),
            name: cleanAuthorName(matchedUser?.name || r.author_name) || 'Соавтор',
            username: matchedUser?.username || (r.user_id ? `@id${r.user_id}` : '@author'),
            avatar: postAvatar,
            role: matchedUser?.role || r.author_role || 'Автор',
            tariff: matchedUser?.tariff || 'Старт'
          };
        })(),
        views: r.views_count || 0,
        likes: r.likes_count || 0,
        shares: r.shares_count || 0,
        sharesCount: r.shares_count || 0,
        reactions,
        commentsCount,
        image: r.image_url || undefined,
        videoUrl: r.video_url || undefined,
        album: album.length > 0 ? album : undefined
      };
    });

    if (options?.tab === 'recommendations') {
      posts = posts.sort((a, b) => {
        if (Boolean(a.isPromoted) !== Boolean(b.isPromoted)) return a.isPromoted ? -1 : 1;
        const scoreA = (a.views || 0) * 0.5 + (a.likes || 0) * 2 + (a.commentsCount || 0) * 3;
        const scoreB = (b.views || 0) * 0.5 + (b.likes || 0) * 2 + (b.commentsCount || 0) * 3;
        return scoreB - scoreA;
      });
    } else if (options?.tab === 'subscriptions') {
      if (options?.userId) {
        try {
          const subRes = dbInstance.exec('SELECT target_id FROM user_subscriptions WHERE follower_id = ?', [
            String(options.userId)
          ]);
          const targetIds = (subRes[0]?.values || []).map((v) => String(v[0]));
          posts = posts.filter((p) => targetIds.includes(String(p.userId)));
        } catch {
          posts = [];
        }
      } else {
        posts = [];
      }
    } else if (options?.tab === 'yours') {
      if (options?.userId) {
        posts = posts.filter((p) => p.userId === String(options.userId));
      }
    } else {
      posts = posts.sort((a, b) => {
        if (Boolean(a.isPromoted) !== Boolean(b.isPromoted)) return a.isPromoted ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    if (options?.offset !== undefined && options?.limit !== undefined) {
      posts = posts.slice(options.offset, options.offset + options.limit);
    } else if (options?.limit !== undefined) {
      posts = posts.slice(0, options.limit);
    }

    return posts;
  } catch (e) {
    console.error('[PostgreSQL] Error fetching blog posts:', e);
    return [];
  }
}

export function fetchBlogPostByIdFromPg(id: string): any | null {
  return fetchBlogPostBySlugOrIdFromPg(id);
}

export function fetchBlogPostBySlugOrIdFromPg(slugOrId: string, currentUserId?: string): any | null {
  const posts = fetchAllBlogPostsFromPg();
  const found = posts.find((p) => String(p.slug) === String(slugOrId) || String(p.id) === String(slugOrId));
  if (!found) return null;

  const comments = fetchCommentsForPostFromPg(found.id, found.slug);
  const reactionsData = fetchReactionsForPostFromPg(found.id, found.slug, currentUserId);

  return {
    ...found,
    comments,
    reactions: reactionsData.counts,
    myReaction: reactionsData.myReaction
  };
}

export function createBlogPostInPg(post: any): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return null;
  const cleanSource = post.sourcePostId
    ? String(post.sourcePostId).replace(/^(blog_|req_)/, '')
    : '';
  const newId = post.id
    ? String(post.id)
    : cleanSource
      ? `blog_${cleanSource}`
      : String(Date.now());
  const title = post.title || 'Новая публикация';
  const slug = post.slug ? post.slug.trim() : generateUniqueSlug(dbInstance as any, title, newId);
  const category = post.category || 'article';
  const isPostOfDay = post.isPostOfDay ? 1 : 0;
  const albumJson = post.album ? JSON.stringify(post.album) : null;
  const inlineButtonsJson = post.inlineButtons ? JSON.stringify(post.inlineButtons) : null;
  const attachmentUrlsJson = post.attachmentUrls
    ? JSON.stringify(post.attachmentUrls)
    : post.attachmentUrl
      ? JSON.stringify([post.attachmentUrl])
      : null;

  if (isPostOfDay) {
    try {
      dbInstance.run('UPDATE posts SET is_post_of_day = 0');
    } catch {}
  }

  dbInstance.run(
    `INSERT OR REPLACE INTO posts (
      id, slug, user_id, category, is_post_of_day, title, "desc", content, post_text, request_template,
      format, tag, read_time, date_str, author_name, author_avatar, author_role,
      views_count, likes_count, image_url, video_url, album_json,
      attachment_type, attachment_url, attachment_urls, inline_buttons_json, message_format,
      status, channel, channels, published_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      slug,
      post.userId ? String(post.userId) : null,
      category,
      isPostOfDay,
      title,
      post.desc || '',
      post.content || post.post_text || '',
      post.content || post.post_text || '',
      post.desc || '',
      post.format || post.attachmentType || 'photo',
      post.tag || 'Публикация',
      post.readTime || '3 мин',
      post.date || new Date().toLocaleDateString('ru-RU'),
      post.author?.name || 'Соавтор',
      normalizeProTalkMediaUrl(post.author?.avatar) || BRAND_ASSETS.heartAvatar,
      post.author?.role || 'Автор',
      post.views || 10,
      post.likes || 1,
      post.image || post.attachmentUrl || null,
      post.videoUrl || null,
      albumJson,
      post.attachmentType || 'photo',
      post.attachmentUrl || null,
      attachmentUrlsJson,
      inlineButtonsJson,
      post.messageFormat || 'rich',
      'published',
      post.channel || '@general',
      post.channels ? JSON.stringify(post.channels) : '["@general"]',
      new Date().toISOString(),
      post.createdAt || new Date().toISOString()
    ]
  );

  savePgDB();
  return fetchBlogPostBySlugOrIdFromPg(newId);
}

export function incrementBlogPostViewsInPg(slugOrId: string): number {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return 0;
  try {
    dbInstance.run('UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ? OR slug = ?', [
      slugOrId,
      slugOrId
    ]);
    savePgDB();
    const res = dbInstance.exec('SELECT views_count FROM posts WHERE id = ? OR slug = ?', [slugOrId, slugOrId]);
    if (res[0] && res[0].values && res[0].values[0]) {
      return Number(res[0].values[0][0]);
    }
  } catch (e) {
    console.error('[PostgreSQL] Error incrementing views:', e);
  }
  return 0;
}

export function incrementBlogPostSharesInPg(slugOrId: string, shareData?: any): number {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return 0;
  try {
    dbInstance.run('UPDATE posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = ? OR slug = ?', [
      slugOrId,
      slugOrId
    ]);
    if (shareData) {
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(
        'INSERT INTO post_shares (id, post_id, user_id, user_name, target_type, target_id, target_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          shareId,
          slugOrId,
          String(shareData.userId || 'anonymous'),
          shareData.userName || 'Пользователь',
          shareData.targetType || 'profile',
          shareData.targetId ? String(shareData.targetId) : null,
          shareData.targetName || '',
          new Date().toISOString()
        ]
      );
    }
    savePgDB();
    const res = dbInstance.exec('SELECT shares_count FROM posts WHERE id = ? OR slug = ?', [slugOrId, slugOrId]);
    if (res[0] && res[0].values && res[0].values[0]) {
      return Number(res[0].values[0][0]);
    }
  } catch (e) {
    console.error('[PostgreSQL] Error incrementing shares:', e);
  }
  return 0;
}

export function fetchCommentsForPostFromPg(postId: string, postSlug?: string): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(
      'SELECT id, post_id, parent_comment_id, author_name, author_avatar, author_user_id, author_username, text, likes_count, created_at, audio_url FROM post_comments WHERE post_id = ? OR post_id = ? ORDER BY created_at ASC',
      [postId, postSlug || postId]
    );
    if (!res[0]) return [];
    const columns = res[0].columns;

    const userMap: Record<string, { name: string; avatar: string; username?: string }> = {};
    try {
      const uRes = dbInstance.exec('SELECT id, first_name, last_name, photo_url, username, telegram_id FROM users');
      if (uRes[0] && uRes[0].values) {
        uRes[0].values.forEach((uRow: any[]) => {
          const fullName = `${uRow[1] || ''} ${uRow[2] || ''}`.trim();
          const uInfo = {
            name: fullName || uRow[4] || 'Пользователь',
            avatar: normalizeProTalkMediaUrl(uRow[3]) || BRAND_ASSETS.heartAvatar,
            username: uRow[4] || undefined
          };
          if (uRow[0]) userMap[String(uRow[0])] = uInfo;
          if (uRow[5]) userMap[String(uRow[5])] = uInfo;
        });
      }
    } catch {}

    return res[0].values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      const matchedUser = obj.author_user_id ? userMap[String(obj.author_user_id)] : null;
      const effectiveName = matchedUser?.name || obj.author_name || 'Пользователь';
      const effectiveAvatar =
        normalizeProTalkMediaUrl(matchedUser?.avatar || obj.author_avatar) || BRAND_ASSETS.heartAvatar;
      const effectiveUserId = obj.author_user_id || undefined;
      const effectiveUsername = matchedUser?.username || obj.author_username || undefined;

      return {
        id: obj.id,
        postId: obj.post_id,
        parentCommentId: obj.parent_comment_id || null,
        author: {
          name: effectiveName,
          avatar: effectiveAvatar,
          userId: effectiveUserId,
          username: effectiveUsername
        },
        authorName: effectiveName,
        authorAvatar: effectiveAvatar,
        authorUserId: effectiveUserId,
        authorUsername: effectiveUsername,
        text: obj.text,
        audioUrl: obj.audio_url || undefined,
        audio_url: obj.audio_url || undefined,
        likesCount: obj.likes_count || 0,
        createdAt: obj.created_at
      };
    });
  } catch {
    return [];
  }
}

export function addCommentToPostInPg(params: {
  postId: string;
  parentCommentId?: string | null;
  authorName: string;
  authorAvatar?: string;
  authorUserId?: string;
  authorUsername?: string;
  text: string;
  audioUrl?: string;
  audio_url?: string;
}): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return null;
  const newId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const createdAt = new Date().toISOString();
  const effectiveAudioUrl = params.audioUrl || params.audio_url || null;

  let effectiveAuthorName = params.authorName || 'Пользователь';
  let effectiveAuthorAvatar = normalizeProTalkMediaUrl(params.authorAvatar) || BRAND_ASSETS.heartAvatar;
  let effectiveAuthorUserId = params.authorUserId || null;
  let effectiveAuthorUsername = params.authorUsername || null;

  if (params.authorUserId) {
    try {
      const uRes = dbInstance.exec(
        'SELECT id, first_name, last_name, username, photo_url, telegram_id FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
        [params.authorUserId, params.authorUserId]
      );
      if (uRes[0] && uRes[0].values && uRes[0].values[0]) {
        const uRow = uRes[0].values[0];
        effectiveAuthorUserId = String(uRow[0]);
        const fullName = `${uRow[1] || ''} ${uRow[2] || ''}`.trim();
        if (fullName) effectiveAuthorName = fullName;
        if (uRow[3]) effectiveAuthorUsername = String(uRow[3]);
        if (uRow[4]) effectiveAuthorAvatar = String(uRow[4]);
      }
    } catch {}
  }

  dbInstance.run(
    `INSERT INTO post_comments (
      id, post_id, parent_comment_id, author_name, author_avatar, author_user_id, author_username, text, likes_count, created_at, audio_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      params.postId,
      params.parentCommentId || null,
      effectiveAuthorName,
      effectiveAuthorAvatar,
      effectiveAuthorUserId,
      effectiveAuthorUsername,
      params.text,
      0,
      createdAt,
      effectiveAudioUrl
    ]
  );

  let postAuthorId: string | null = null;
  let postTitle = 'публикация';
  let postSlug = params.postId;

  try {
    const pRes = dbInstance.exec('SELECT id, slug, user_id, title FROM posts WHERE id = ? OR slug = ? LIMIT 1', [
      params.postId,
      params.postId
    ]);
    if (pRes[0] && pRes[0].values && pRes[0].values[0]) {
      const row = pRes[0].values[0];
      const pId = String(row[0]);
      postSlug = row[1] ? String(row[1]) : pId;
      postAuthorId = row[2] ? String(row[2]) : null;
      postTitle = row[3] ? String(row[3]) : 'публикация';
    }
  } catch {}

  let parentAuthorId: string | null = null;
  if (params.parentCommentId) {
    try {
      const cRes = dbInstance.exec('SELECT author_user_id FROM post_comments WHERE id = ? LIMIT 1', [
        params.parentCommentId
      ]);
      if (cRes[0] && cRes[0].values && cRes[0].values[0]) {
        parentAuthorId = cRes[0].values[0][0] ? String(cRes[0].values[0][0]) : null;
      }
    } catch {}
  }

  if (params.parentCommentId && parentAuthorId && String(parentAuthorId) !== String(effectiveAuthorUserId)) {
    try {
      createNotificationInDb(dbInstance as any, {
        userId: String(parentAuthorId),
        type: 'social',
        title: '💬 Ответ на ваш комментарий',
        message: `${effectiveAuthorName} ответил(а) на ваш комментарий к публикации "${postTitle}": "${params.text.slice(0, 100)}"`,
        link: `/posts/${postSlug}#comment-${newId}`
      });
    } catch {}
  }

  if (
    postAuthorId &&
    String(postAuthorId) !== String(effectiveAuthorUserId) &&
    String(postAuthorId) !== String(parentAuthorId)
  ) {
    try {
      createNotificationInDb(dbInstance as any, {
        userId: String(postAuthorId),
        type: 'social',
        title: '💬 Новый комментарий к публикации',
        message: `${effectiveAuthorName} оставил(а) комментарий к вашей публикации "${postTitle}": "${params.text.slice(0, 100)}"`,
        link: `/posts/${postSlug}#comment-${newId}`
      });
    } catch {}
  }

  savePgDB();
  return {
    id: newId,
    postId: params.postId,
    parentCommentId: params.parentCommentId || null,
    author: {
      name: effectiveAuthorName,
      avatar: effectiveAuthorAvatar,
      userId: effectiveAuthorUserId,
      username: effectiveAuthorUsername
    },
    authorName: effectiveAuthorName,
    authorAvatar: effectiveAuthorAvatar,
    authorUserId: effectiveAuthorUserId,
    authorUsername: effectiveAuthorUsername,
    text: params.text,
    audioUrl: effectiveAudioUrl || undefined,
    audio_url: effectiveAudioUrl || undefined,
    likesCount: 0,
    createdAt
  };
}

export function fetchReactionsForPostFromPg(
  postId: string,
  postSlug?: string,
  currentUserId?: string
): {
  counts: Record<string, number>;
  myReaction?: string;
} {
  const counts: Record<string, number> = { like: 0, love: 0, fire: 0, haha: 0, wow: 0 };
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return { counts };

  try {
    const res = dbInstance.exec(
      'SELECT user_id, reaction_type FROM post_reactions WHERE post_id = ? OR post_id = ?',
      [postId, postSlug || postId]
    );
    let myReaction: string | undefined;
    if (res[0]) {
      res[0].values.forEach((row: any[]) => {
        const uId = String(row[0]);
        const rType = String(row[1] || 'like');
        counts[rType] = (counts[rType] || 0) + 1;
        if (currentUserId && uId === String(currentUserId)) {
          myReaction = rType;
        }
      });
    }
    return { counts, myReaction };
  } catch {
    return { counts };
  }
}

export function toggleReactionForPostInPg(
  postId: string,
  userId: string,
  reactionType: string = 'like'
): {
  myReaction: string | null;
  counts: Record<string, number>;
  totalLikes: number;
} {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return { myReaction: null, counts: {}, totalLikes: 0 };
  try {
    const existing = dbInstance.exec(
      'SELECT reaction_type FROM post_reactions WHERE (post_id = ? OR post_id = (SELECT slug FROM posts WHERE id = ?)) AND user_id = ?',
      [postId, postId, userId]
    );

    let newReaction: string | null = reactionType;
    if (existing[0] && existing[0].values.length > 0) {
      const curType = String(existing[0].values[0][0]);
      if (curType === reactionType) {
        dbInstance.run(
          'DELETE FROM post_reactions WHERE (post_id = ? OR post_id = (SELECT slug FROM posts WHERE id = ?)) AND user_id = ?',
          [postId, postId, userId]
        );
        newReaction = null;
      } else {
        dbInstance.run(
          'UPDATE post_reactions SET reaction_type = ? WHERE (post_id = ? OR post_id = (SELECT slug FROM posts WHERE id = ?)) AND user_id = ?',
          [reactionType, postId, postId, userId]
        );
      }
    } else {
      const rId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      dbInstance.run(
        'INSERT INTO post_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)',
        [rId, postId, userId, reactionType, new Date().toISOString()]
      );
    }

    const totalRes = dbInstance.exec(
      'SELECT COUNT(*) FROM post_reactions WHERE post_id = ? OR post_id = (SELECT slug FROM posts WHERE id = ?)',
      [postId, postId]
    );
    const totalLikes = totalRes[0] && totalRes[0].values[0] ? Number(totalRes[0].values[0][0]) : 0;
    try {
      dbInstance.run('UPDATE posts SET likes_count = ? WHERE id = ? OR slug = ?', [totalLikes, postId, postId]);
    } catch {}

    savePgDB();
    const { counts } = fetchReactionsForPostFromPg(postId, undefined, userId);
    return { myReaction: newReaction, counts, totalLikes };
  } catch (err) {
    console.error('[PostgreSQL] Error toggling reaction:', err);
    return { myReaction: reactionType, counts: {}, totalLikes: 0 };
  }
}

export function fetchAllLandingReviewsFromPg(): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return [];
  try {
    const res = dbInstance.exec(
      `SELECT * FROM landing_reviews
       WHERE status = 'approved'
       ORDER BY created_at DESC`
    );
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map((valArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        rowObj[col] = valArr[idx];
      });
      return rowObj;
    });
  } catch (e) {
    console.error('[PostgreSQL] Error fetching landing reviews:', e);
    return [];
  }
}

export function addLandingReviewToPg(review: {
  name: string;
  rating?: number;
  text: string;
  role?: string;
  avatar?: string;
  status?: string;
  audio_url?: string;
  audioUrl?: string;
  ai_reply?: string | null;
  ai_replied_at?: string | null;
  admin_reply?: string | null;
  admin_replied_at?: string | null;
  moderation_status?: string;
}): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return null;
  const newId = 'rev_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  const audioUrl = review.audio_url || review.audioUrl || null;
  const aiReply = review.ai_reply ?? null;
  const aiRepliedAt = review.ai_replied_at || (aiReply ? now : null);
  const adminReply = review.admin_reply ?? null;
  const adminRepliedAt = review.admin_replied_at || (adminReply ? now : null);
  const modStatus = review.moderation_status || 'approved';

  dbInstance.run(
    `INSERT INTO landing_reviews
      (id, name, rating, text, role, avatar, status, created_at, audio_url, ai_reply, ai_replied_at, admin_reply, admin_replied_at, moderation_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      review.name || 'Пользователь',
      review.rating || 5,
      review.text,
      review.role || 'Пользователь платформы',
      review.avatar || '👤',
      review.status || 'approved',
      now,
      audioUrl,
      aiReply,
      aiRepliedAt,
      adminReply,
      adminRepliedAt,
      modStatus
    ]
  );
  savePgDB();
  return {
    id: newId,
    name: review.name || 'Пользователь',
    rating: review.rating || 5,
    text: review.text,
    role: review.role || 'Пользователь платформы',
    avatar: review.avatar || '👤',
    status: review.status || 'approved',
    audio_url: audioUrl,
    audioUrl,
    ai_reply: aiReply,
    ai_replied_at: aiRepliedAt,
    admin_reply: adminReply,
    admin_replied_at: adminRepliedAt,
    moderation_status: modStatus,
    created_at: now
  };
}

export function deleteLandingReviewFromPg(id: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return false;
  try {
    dbInstance.run('DELETE FROM landing_reviews WHERE id = ?', [id]);
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error deleting landing review:', e);
    return false;
  }
}

export function updateBlogPostInPg(id: string, post: any): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return null;

  if (post.isPostOfDay) {
    try {
      dbInstance.run('UPDATE posts SET is_post_of_day = 0');
    } catch {}
  }

  const albumJson = post.album ? JSON.stringify(post.album) : null;
  const inlineButtonsJson = post.inlineButtons !== undefined ? JSON.stringify(post.inlineButtons) : null;

  dbInstance.run(
    `UPDATE posts SET
      category = COALESCE(?, category),
      is_post_of_day = COALESCE(?, is_post_of_day),
      title = COALESCE(?, title),
      "desc" = COALESCE(?, "desc"),
      content = COALESCE(?, content),
      post_text = COALESCE(?, post_text),
      format = COALESCE(?, format),
      tag = COALESCE(?, tag),
      read_time = COALESCE(?, read_time),
      image_url = COALESCE(?, image_url),
      video_url = COALESCE(?, video_url),
      album_json = COALESCE(?, album_json),
      attachment_type = COALESCE(?, attachment_type),
      attachment_url = COALESCE(?, attachment_url),
      inline_buttons_json = COALESCE(?, inline_buttons_json),
      message_format = COALESCE(?, message_format)
    WHERE id = ?`,
    [
      post.category ?? null,
      post.isPostOfDay !== undefined ? (post.isPostOfDay ? 1 : 0) : null,
      post.title ?? null,
      post.desc ?? null,
      (post.content || post.postText) ?? null,
      (post.content || post.postText) ?? null,
      (post.format || post.attachmentType) ?? null,
      post.tag ?? null,
      post.readTime ?? null,
      (post.image || post.attachmentUrl) ?? null,
      post.videoUrl ?? null,
      albumJson,
      (post.attachmentType || post.format) ?? null,
      (post.attachmentUrl || post.image) ?? null,
      inlineButtonsJson,
      post.messageFormat ?? null,
      id
    ]
  );

  savePgDB();
  return fetchAllBlogPostsFromPg().find((p) => p.id === id);
}

export function deleteBlogPostFromPg(id: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return false;
  try {
    dbInstance.run('DELETE FROM posts WHERE id = ?', [id]);
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error deleting blog post:', e);
    return false;
  }
}

export function incrementBlogPostLikesInPg(id: string): number {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return 0;
  try {
    dbInstance.run('UPDATE posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = ?', [id]);
    savePgDB();
    const res = dbInstance.exec('SELECT likes_count FROM posts WHERE id = ?', [id]);
    if (res[0] && res[0].values && res[0].values[0]) {
      return Number(res[0].values[0][0]);
    }
  } catch (e) {
    console.error('[PostgreSQL] Error incrementing likes:', e);
  }
  return 0;
}

export function syncPostCronTask(postId: string, postData: any, userId?: string): void {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return;

  const cleanPostId = String(postId || '').trim();
  const cronId = `cron_post_${cleanPostId}`;
  if (
    !cleanPostId ||
    cleanPostId.startsWith('pub_cron_') ||
    cleanPostId.startsWith('pub_') ||
    cleanPostId.startsWith('sched_') ||
    cleanPostId.startsWith('blog_') ||
    /^\d{12,}$/.test(cleanPostId)
  ) {
    try {
      dbInstance.run('DELETE FROM cron WHERE id = ? OR item_id = ?', [cronId, cleanPostId]);
      savePgDB();
    } catch {}
    return;
  }

  const scheduleRaw = postData.triggerSchedule || postData.trigger_schedule;
  let parsedSchedule: Record<string, any> = { enabled: false };
  try {
    parsedSchedule = typeof scheduleRaw === 'string' ? JSON.parse(scheduleRaw) : (scheduleRaw || { enabled: false });
  } catch {
    parsedSchedule = { enabled: false };
  }

  const freq = String(
    parsedSchedule.frequency || (parsedSchedule.exactDateTime ? 'once' : 'daily')
  ).toLowerCase().trim();
  const statusLower = String(postData.status || '').toLowerCase().trim();
  const alreadyFinishedOneOff =
    (isPublishedPostStatus(postData.status) ||
      statusLower === 'ошибка' ||
      statusLower === 'failed' ||
      statusLower === 'error') &&
    isOneOffScheduleFrequency(freq);

  if (!parsedSchedule || parsedSchedule.enabled !== true || alreadyFinishedOneOff) {
    try {
      dbInstance.run("UPDATE cron SET status = 'paused' WHERE id = ?", [cronId]);
      savePgDB();
    } catch {}
    return;
  }

  let userTimezone = String(parsedSchedule.timezone || '').trim() || 'Europe/Moscow';
  if (!parsedSchedule.timezone && userId) {
    try {
      const uRes = dbInstance.exec('SELECT timezone FROM users WHERE id = ? OR telegram_id = ?', [userId, userId]);
      if (uRes.length > 0 && uRes[0].values.length > 0 && uRes[0].values[0][0]) {
        userTimezone = String(uRes[0].values[0][0]);
      }
    } catch {}
  }

  let cronExpr = '0 9 * * *';
  let scheduleHuman = '';
  const now = new Date();
  let nextRun = now.toISOString();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (isOneOffScheduleFrequency(freq)) {
    const rawDT = String(parsedSchedule.exactDateTime || '').trim();
    const parsedDt = parseScheduleDateTimeInTimezone(rawDT, userTimezone);
    cronExpr = `exact:${rawDT || now.toISOString()}`;
    scheduleHuman = `Отложенная публикация ${rawDT.replace('T', ' ')} (${userTimezone})`;
    nextRun = parsedDt ? parsedDt.toISOString() : new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (freq === 'daily') {
    const timeStr = String(parsedSchedule.time || '09:00');
    const [hh, mm] = timeStr.split(':').map((v) => Number(v));
    const h = Number.isNaN(hh) ? 9 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    cronExpr = `${m} ${h} * * *`;
    scheduleHuman = `Ежедневно в ${timeStr} (${userTimezone})`;
    const zNow = getZonedPartsInTimezone(now, userTimezone);
    let slot = parseScheduleDateTimeInTimezone(
      `${zNow.year}-${pad(zNow.month)}-${pad(zNow.day)}T${pad(h)}:${pad(m)}`,
      userTimezone
    );
    if (slot && slot.getTime() <= now.getTime()) {
      slot = new Date(slot.getTime() + 24 * 60 * 60 * 1000);
    }
    nextRun = slot ? slot.toISOString() : now.toISOString();
  } else if (freq === 'interval_minutes' || freq === 'minutes') {
    const mins = Math.max(1, Number(parsedSchedule.intervalMinutes || 15));
    cronExpr = `*/${mins} * * * *`;
    const sleepNote = parsedSchedule.sleepModeEnabled
      ? ` (Сон ${parsedSchedule.sleepStartTime || '23:00'}-${parsedSchedule.sleepEndTime || '08:00'})`
      : '';
    scheduleHuman = `Каждые ${mins} мин.${sleepNote} (${userTimezone})`;
    nextRun = new Date(now.getTime() + mins * 60 * 1000).toISOString();
  } else if (freq === 'interval_hours' || freq === 'hours') {
    const hrs = Math.max(1, Number(parsedSchedule.intervalHours || 2));
    cronExpr = `0 */${hrs} * * *`;
    const sleepNote = parsedSchedule.sleepModeEnabled
      ? ` (Сон ${parsedSchedule.sleepStartTime || '23:00'}-${parsedSchedule.sleepEndTime || '08:00'})`
      : '';
    scheduleHuman = `Каждые ${hrs} час.${sleepNote} (${userTimezone})`;
    nextRun = new Date(now.getTime() + hrs * 3600 * 1000).toISOString();
  } else if (freq === 'dayOfWeek' || freq === 'dayofweek' || freq === 'weekly') {
    const timeStr = String(parsedSchedule.time || '09:00');
    const [hh, mm] = timeStr.split(':').map((v) => Number(v));
    const h = Number.isNaN(hh) ? 9 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    cronExpr = `${m} ${h} * * 1`;
    scheduleHuman = `Еженедельно в ${timeStr} (${userTimezone})`;
    const zNow = getZonedPartsInTimezone(now, userTimezone);
    let slot = parseScheduleDateTimeInTimezone(
      `${zNow.year}-${pad(zNow.month)}-${pad(zNow.day)}T${pad(h)}:${pad(m)}`,
      userTimezone
    );
    if (slot && slot.getTime() <= now.getTime()) {
      slot = new Date(slot.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    nextRun = slot ? slot.toISOString() : now.toISOString();
  } else if (freq === 'monthly') {
    const timeStr = String(parsedSchedule.time || '09:00');
    const dom = Math.min(28, Math.max(1, Number(parsedSchedule.dayOfMonth || 1)));
    const [hh, mm] = timeStr.split(':').map((v) => Number(v));
    const h = Number.isNaN(hh) ? 9 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    cronExpr = `${m} ${h} ${dom} * *`;
    scheduleHuman = `Ежемесячно ${dom}-го числа в ${timeStr} (${userTimezone})`;
    const zNow = getZonedPartsInTimezone(now, userTimezone);
    let targetMonth = zNow.month;
    let targetYear = zNow.year;
    let slot = parseScheduleDateTimeInTimezone(
      `${targetYear}-${pad(targetMonth)}-${pad(dom)}T${pad(h)}:${pad(m)}`,
      userTimezone
    );
    if (slot && slot.getTime() <= now.getTime()) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      slot = parseScheduleDateTimeInTimezone(
        `${targetYear}-${pad(targetMonth)}-${pad(dom)}T${pad(h)}:${pad(m)}`,
        userTimezone
      );
    }
    nextRun = slot ? slot.toISOString() : now.toISOString();
  }

  const title = `Автопостинг: ${postData.title || 'Пост ' + cleanPostId}`;

  try {
    const existing = dbInstance.exec('SELECT id FROM cron WHERE id = ?', [cronId]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      dbInstance.run(
        `UPDATE cron SET title = ?, cron_expression = ?, schedule_human = ?, next_run = ?, status = 'active' WHERE id = ?`,
        [title, cronExpr, scheduleHuman, nextRun, cronId]
      );
    } else {
      dbInstance.run(
        `INSERT INTO cron (id, item_type, item_id, title, cron_expression, schedule_human, next_run, status, created_at)
         VALUES (?, 'post', ?, ?, ?, ?, ?, 'active', datetime('now'))`,
        [cronId, cleanPostId, title, cronExpr, scheduleHuman, nextRun]
      );
    }
    savePgDB();
  } catch (e) {
    console.error('[PostgreSQL] Error syncing post cron task:', e);
  }
}

