import { getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { cleanAuthorName, normalizeUserId, savePgDB } from './coreSettingsRepo';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

export const BANNED_BOT_NAMES = [
  'Дмитрий Performance',
  'Анна Трафик-SMM',
  'Павел Дуров (ИИ-клон)',
  'SAV AI Developer',
  'Мария Сеошница',
  'ИИ Помощник ИИSMM',
  'Групповой Чат Синдиката'
];

export function isSubscribedInPg(
  followerId: string,
  targetId: string,
  targetTelegramId?: string | number
): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !followerId || !targetId) return false;
  try {
    const targets = [String(targetId)];
    if (targetTelegramId && String(targetTelegramId) !== String(targetId)) {
      targets.push(String(targetTelegramId));
    }
    const placeholders = targets.map(() => '?').join(',');
    const res = dbInstance.exec(
      `SELECT id FROM user_subscriptions WHERE follower_id = ? AND target_id IN (${placeholders})`,
      [String(followerId), ...targets]
    );
    return Boolean(res[0] && res[0].values.length > 0);
  } catch {
    return false;
  }
}

export function addSubscriptionInPg(
  followerId: string,
  targetId: string,
  targetName?: string,
  targetUsername?: string,
  targetAvatar?: string
): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !followerId || !targetId) return false;
  try {
    const id = `sub_${followerId}_${targetId}`;
    dbInstance.run(
      `INSERT OR REPLACE INTO user_subscriptions (id, follower_id, target_id, target_name, target_username, target_avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        String(followerId),
        String(targetId),
        cleanAuthorName(targetName) || '',
        targetUsername || '',
        targetAvatar || ''
      ]
    );
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error adding subscription:', e);
    return false;
  }
}

export function removeSubscriptionInPg(
  followerId: string,
  targetId: string,
  targetTelegramId?: string | number
): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !followerId || !targetId) return false;
  try {
    const targets = [String(targetId)];
    if (targetTelegramId && String(targetTelegramId) !== String(targetId)) {
      targets.push(String(targetTelegramId));
    }
    const placeholders = targets.map(() => '?').join(',');
    dbInstance.run(
      `DELETE FROM user_subscriptions WHERE follower_id = ? AND target_id IN (${placeholders})`,
      [String(followerId), ...targets]
    );
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error removing subscription:', e);
    return false;
  }
}

export function getSubscribersCountFromPg(targetId: string, targetTelegramId?: string | number): number {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !targetId) return 0;
  try {
    const targets = [String(targetId)];
    if (targetTelegramId && String(targetTelegramId) !== String(targetId)) {
      targets.push(String(targetTelegramId));
    }
    const placeholders = targets.map(() => '?').join(',');
    const res = dbInstance.exec(
      `SELECT COUNT(DISTINCT follower_id) FROM user_subscriptions WHERE target_id IN (${placeholders})`,
      targets
    );
    if (res[0]?.values?.[0]?.[0] !== undefined) {
      return Number(res[0].values[0][0]) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function getSubscriptionsFromPg(followerId: string): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !followerId) return [];
  try {
    const res = dbInstance.exec(
      'SELECT target_id, target_name, target_username, target_avatar, created_at FROM user_subscriptions WHERE follower_id = ? ORDER BY created_at DESC',
      [String(followerId)]
    );
    if (!res[0]) return [];
    return res[0].values.map((v: any[]) => ({
      targetId: v[0],
      targetName: cleanAuthorName(v[1]),
      targetUsername: v[2],
      targetAvatar: v[3],
      createdAt: v[4]
    }));
  } catch {
    return [];
  }
}

export function searchUsersInPg(query: string): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !query || !query.trim()) return [];
  try {
    const q = `%${query.trim().toLowerCase()}%`;
    const res = dbInstance.exec(
      `SELECT id, telegram_id, first_name, last_name, username, email, photo_url, role
       FROM users
       WHERE LOWER(COALESCE(first_name, '')) LIKE ?
          OR LOWER(COALESCE(last_name, '')) LIKE ?
          OR LOWER(COALESCE(username, '')) LIKE ?
          OR LOWER(COALESCE(email, '')) LIKE ?
          OR id LIKE ?
          OR CAST(COALESCE(telegram_id, 0) AS TEXT) LIKE ?
       LIMIT 20`,
      [q, q, q, q, q, q]
    );
    if (!res[0] || !res[0].values) return [];
    return res[0].values
      .filter((v: any[]) => {
        const fn = v[2] ? String(v[2]) : '';
        const ln = v[3] ? String(v[3]) : '';
        const fullName = `${fn} ${ln}`.trim();
        return !BANNED_BOT_NAMES.some((b) => fullName.includes(b));
      })
      .map((v: any[]) => {
        const fn = v[2] ? String(v[2]) : '';
        const ln = v[3] ? String(v[3]) : '';
        const fullName = cleanAuthorName(`${fn} ${ln}`.trim() || fn || 'Пользователь');
        const rawUsername = v[4] ? String(v[4]) : '';
        const cleanUser = rawUsername.replace(/^@/, '');
        return {
          id: String(v[0]),
          telegramId: v[1],
          name: fullName,
          username: cleanUser ? `@${cleanUser}` : `@user_${String(v[0]).slice(-4)}`,
          email: v[5] ? String(v[5]) : '',
          avatar:
            normalizeProTalkMediaUrl(v[6] ? String(v[6]) : '') ||
            (String(v[0]).startsWith('169262990') ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar),
          role: v[7] || 'user'
        };
      });
  } catch (e) {
    console.error('[PostgreSQL] Error searching users:', e);
    return [];
  }
}

export function getAuthorsCatalogFromPg(options: {
  query?: string;
  page?: number;
  limit?: number;
  currentUserId?: string;
  filter?: 'all' | 'subscribed' | 'unsubscribed';
}): { authors: any[]; total: number; page: number; limit: number; totalPages: number } {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) {
    return { authors: [], total: 0, page: 1, limit: 50, totalPages: 0 };
  }
  try {
    const q = (options.query || '').trim().toLowerCase();
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Number(options.limit) !== undefined ? Number(options.limit) : 50;
    const normUser = options.currentUserId ? normalizeUserId(options.currentUserId) : '';
    const filter = options.filter || 'all';

    const res = dbInstance.exec(`
      SELECT id, telegram_id, first_name, last_name, username, email, photo_url, role, bio, city, last_seen
      FROM users
      ORDER BY id ASC
    `);

    if (!res[0] || !res[0].values) {
      return { authors: [], total: 0, page: 1, limit, totalPages: 0 };
    }

    let mySubTargets: string[] = [];
    if (normUser) {
      try {
        const subRes = dbInstance.exec('SELECT target_id FROM user_subscriptions WHERE follower_id = ?', [normUser]);
        if (subRes[0]?.values) {
          mySubTargets = subRes[0].values.map((r: any[]) => String(r[0]));
        }
      } catch {}
    }

    const postCounts: Record<string, number> = {};
    try {
      const pRes = dbInstance.exec('SELECT user_id, COUNT(*) FROM posts GROUP BY user_id');
      if (pRes[0]?.values) {
        pRes[0].values.forEach((r: any[]) => {
          if (r[0]) postCounts[String(r[0])] = Number(r[1]) || 0;
        });
      }
    } catch {}

    const subCounts: Record<string, number> = {};
    try {
      const sRes = dbInstance.exec('SELECT target_id, COUNT(*) FROM user_subscriptions GROUP BY target_id');
      if (pHasRows(sRes)) {
        sRes[0].values.forEach((r: any[]) => {
          if (r[0]) subCounts[String(r[0])] = Number(r[1]) || 0;
        });
      }
    } catch {}

    let allAuthors = res[0].values
      .filter((v: any[]) => {
        const fn = v[2] ? String(v[2]) : '';
        const ln = v[3] ? String(v[3]) : '';
        const fullName = `${fn} ${ln}`.trim();
        return !BANNED_BOT_NAMES.some((b) => fullName.includes(b));
      })
      .map((v: any[]) => {
        const idStr = String(v[0]);
        const tgStr = v[1] ? String(v[1]) : '';
        const fn = v[2] ? String(v[2]) : '';
        const ln = v[3] ? String(v[3]) : '';
        const fullName = cleanAuthorName(`${fn} ${ln}`.trim() || fn || 'Соавтор');
        const rawUsername = v[4] ? String(v[4]) : '';
        const cleanUser = rawUsername.replace(/^@/, '');
        const username = cleanUser ? `@${cleanUser}` : `@id${tgStr || idStr}`;
        const rawAv = normalizeProTalkMediaUrl(v[6] ? String(v[6]) : '');
        const avatar =
          rawAv && !rawAv.includes('dicebear') && !rawAv.includes('/api/avatar/')
            ? rawAv
            : (idStr.startsWith('169262990') ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar);
        const posts = (postCounts[idStr] || 0) + (tgStr ? postCounts[tgStr] || 0 : 0);
        const subs = (subCounts[idStr] || 0) + (tgStr ? subCounts[tgStr] || 0 : 0);
        const isSubscribed = mySubTargets.includes(idStr) || (tgStr ? mySubTargets.includes(tgStr) : false);
        const lastSeen = v[10] ? String(v[10]) : null;

        return {
          id: idStr,
          telegramId: v[1],
          name: fullName,
          username,
          email: v[5] ? String(v[5]) : '',
          avatar,
          role: v[7] || 'Автор',
          bio: v[8] ? String(v[8]) : 'Соавтор сообщества ИИSMM',
          city: v[9] ? String(v[9]) : '',
          last_seen: lastSeen,
          lastSeen,
          postsCount: posts,
          subscribersCount: subs,
          isSubscribed
        };
      });

    if (q) {
      allAuthors = allAuthors.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (a.telegramId && String(a.telegramId).includes(q)) ||
          a.bio.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      );
    }

    if (filter === 'subscribed') {
      allAuthors = allAuthors.filter((a) => a.isSubscribed);
    } else if (filter === 'unsubscribed') {
      allAuthors = allAuthors.filter((a) => !a.isSubscribed && a.id !== normUser);
    }

    const total = allAuthors.length;
    let paginated = allAuthors;
    let totalPages = 1;

    if (limit > 0) {
      totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;
      paginated = allAuthors.slice(offset, offset + limit);
    }

    return { authors: paginated, total, page, limit, totalPages };
  } catch (e) {
    console.error('[PostgreSQL] Error fetching authors catalog:', e);
    return { authors: [], total: 0, page: 1, limit: 50, totalPages: 0 };
  }
}

function pHasRows(res: any): boolean {
  return Boolean(res && res[0] && Array.isArray(res[0].values));
}

export function getUserAutoRespondersFromPg(userId: string): {
  global: { enabled: boolean; prompt: string; mode: 'always' | 'offline' | 'online' };
  personal: Record<string, { enabled: boolean; prompt: string; mode: 'always' | 'offline' | 'online' }>;
} {
  const result = {
    global: { enabled: false, prompt: '', mode: 'always' as 'always' | 'offline' | 'online' },
    personal: {} as Record<string, { enabled: boolean; prompt: string; mode: 'always' | 'offline' | 'online' }>
  };
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId) return result;
  try {
    const rows = dbInstance.exec(
      'SELECT chat_id, enabled, prompt, mode FROM user_auto_responders WHERE user_id = ?',
      [String(userId)]
    );
    if (rows[0] && rows[0].values) {
      rows[0].values.forEach((r: any[]) => {
        const chatId = String(r[0]);
        const enabled = Number(r[1]) === 1;
        const prompt = String(r[2] || '');
        const mode = r[3] === 'offline' || r[3] === 'online' ? r[3] : 'always';
        if (chatId === 'all' || chatId === 'global') {
          result.global = { enabled, prompt, mode };
        } else {
          result.personal[chatId] = { enabled, prompt, mode };
        }
      });
    }
  } catch (e) {
    console.error('[PostgreSQL] getUserAutoResponders error:', e);
  }
  return result;
}

export function saveUserAutoResponderToPg(
  userId: string,
  chatId: string,
  enabled: boolean,
  prompt: string,
  mode: 'always' | 'offline' | 'online' = 'always'
): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId) return false;
  try {
    const targetChat = chatId || 'all';
    const id = `resp_${userId}_${targetChat}`;
    const now = new Date().toISOString();
    const safeMode = mode === 'offline' || mode === 'online' ? mode : 'always';

    dbInstance.run(
      `INSERT INTO user_auto_responders (id, user_id, chat_id, enabled, prompt, mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, chat_id) DO UPDATE SET
         enabled = excluded.enabled,
         prompt = excluded.prompt,
         mode = excluded.mode,
         updated_at = excluded.updated_at`,
      [id, String(userId), targetChat, enabled ? 1 : 0, prompt || '', safeMode, now, now]
    );
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] saveUserAutoResponder error:', e);
    return false;
  }
}

export function updateUserLastSeenInPg(userId: string, timestamp?: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId) return false;
  try {
    const now = timestamp || new Date().toISOString();
    const norm = normalizeUserId(userId);
    dbInstance.run('UPDATE users SET last_seen = ? WHERE id = ? OR telegram_id = ?', [now, norm, norm]);
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] updateUserLastSeen error:', e);
    return false;
  }
}

export function getUserLastSeenFromPg(userId: string): { isOnline: boolean; lastSeen: string | null } {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId) return { isOnline: false, lastSeen: null };
  try {
    const norm = normalizeUserId(userId);
    const res = dbInstance.exec('SELECT last_seen FROM users WHERE id = ? OR telegram_id = ? LIMIT 1', [
      norm,
      norm
    ]);
    if (res[0] && res[0].values && res[0].values[0]) {
      const lastSeen = res[0].values[0][0] ? String(res[0].values[0][0]) : null;
      if (lastSeen) {
        const diffMs = Date.now() - new Date(lastSeen).getTime();
        const isOnline = diffMs >= 0 && diffMs <= 4 * 60 * 1000;
        return { isOnline, lastSeen };
      }
    }
  } catch (e) {
    console.error('[PostgreSQL] getUserLastSeen error:', e);
  }
  return { isOnline: false, lastSeen: null };
}
