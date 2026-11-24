import crypto from 'crypto';
import { getPgDB, normalizeUserId, pgQuery, refreshTableCacheFromCloud } from '../db/postgres';

export type PushCategoryKey =
  | 'publish'
  | 'folders'
  | 'balance'
  | 'social'
  | 'ai'
  | 'system';

export type NotificationChannelKey = 'push' | 'telegram' | 'bell';

export interface ChannelPreferenceState {
  enabled: boolean;
  categories: Record<PushCategoryKey, boolean>;
}

export interface PushNotificationPreferences {
  userId: string;
  enabled: boolean;
  categories: Record<PushCategoryKey, boolean>;
  channels: Record<NotificationChannelKey, ChannelPreferenceState>;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  deviceLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt: string | null;
}

export const DEFAULT_PUSH_CATEGORIES: Record<PushCategoryKey, boolean> = {
  publish: true,
  folders: true,
  balance: true,
  social: true,
  ai: true,
  system: true,
};

const prefsCache = new Map<string, PushNotificationPreferences>();

function buildDefaultChannels(): Record<NotificationChannelKey, ChannelPreferenceState> {
  return {
    push: { enabled: true, categories: { ...DEFAULT_PUSH_CATEGORIES } },
    telegram: { enabled: true, categories: { ...DEFAULT_PUSH_CATEGORIES } },
    bell: { enabled: true, categories: { ...DEFAULT_PUSH_CATEGORIES } },
  };
}

function rowToPreferences(userId: string, row?: any): PushNotificationPreferences {
  const updatedAt = String(row?.updated_at || new Date().toISOString());
  if (!row) {
    const channels = buildDefaultChannels();
    return {
      userId,
      enabled: true,
      categories: { ...channels.push.categories },
      channels,
      updatedAt,
    };
  }

  const pushState: ChannelPreferenceState = {
    enabled: Number(row.enabled ?? 1) !== 0,
    categories: {
      publish: Number(row.cat_publish ?? 1) !== 0,
      folders: Number(row.cat_folders ?? 1) !== 0,
      balance: Number(row.cat_balance ?? 1) !== 0,
      social: Number(row.cat_social ?? 1) !== 0,
      ai: Number(row.cat_ai ?? 1) !== 0,
      system: Number(row.cat_system ?? 1) !== 0,
    },
  };

  const telegramState: ChannelPreferenceState = {
    enabled: Number(row.telegram_enabled ?? 1) !== 0,
    categories: {
      publish: Number(row.tg_cat_publish ?? 1) !== 0,
      folders: Number(row.tg_cat_folders ?? 1) !== 0,
      balance: Number(row.tg_cat_balance ?? 1) !== 0,
      social: Number(row.tg_cat_social ?? 1) !== 0,
      ai: Number(row.tg_cat_ai ?? 1) !== 0,
      system: Number(row.tg_cat_system ?? 1) !== 0,
    },
  };

  const bellState: ChannelPreferenceState = {
    enabled: Number(row.bell_enabled ?? 1) !== 0,
    categories: {
      publish: Number(row.bell_cat_publish ?? 1) !== 0,
      folders: Number(row.bell_cat_folders ?? 1) !== 0,
      balance: Number(row.bell_cat_balance ?? 1) !== 0,
      social: Number(row.bell_cat_social ?? 1) !== 0,
      ai: Number(row.bell_cat_ai ?? 1) !== 0,
      system: Number(row.bell_cat_system ?? 1) !== 0,
    },
  };

  return {
    userId,
    enabled: pushState.enabled,
    categories: { ...pushState.categories },
    channels: {
      push: pushState,
      telegram: telegramState,
      bell: bellState,
    },
    updatedAt,
  };
}

export function hashSubscriptionId(endpoint: string): string {
  return `psub_${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 28)}`;
}

export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return Boolean(host && host.includes('.'));
  } catch {
    return false;
  }
}

export function inferPushCategory(params: {
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  explicitCategory?: PushCategoryKey;
}): PushCategoryKey {
  if (params.explicitCategory) return params.explicitCategory;
  const type = String(params.type || '').toLowerCase();
  const title = String(params.title || '').toLowerCase();
  const message = String(params.message || '').toLowerCase();
  const link = String(params.link || '').toLowerCase();
  const combined = `${title} ${message} ${link}`;

  if (
    link.includes('/folders') ||
    combined.includes('папк') ||
    combined.includes('подборк') ||
    combined.includes('взаимн') ||
    combined.includes('напоминан') ||
    combined.includes('реанимир')
  ) {
    return 'folders';
  }
  if (
    type === 'publish' ||
    combined.includes('пост') ||
    combined.includes('публикац') ||
    combined.includes('автопост') ||
    combined.includes('ошибка отправки') ||
    combined.includes('канал')
  ) {
    return 'publish';
  }
  if (
    type === 'balance' ||
    type === 'transaction' ||
    combined.includes('баланс') ||
    combined.includes('иирк') ||
    combined.includes('тариф') ||
    combined.includes('оплат') ||
    combined.includes('списан') ||
    combined.includes('пополн') ||
    combined.includes('автопродл')
  ) {
    return 'balance';
  }
  if (
    type === 'social' ||
    combined.includes('комментар') ||
    combined.includes('чат') ||
    combined.includes('сообщен') ||
    combined.includes('подпис') ||
    combined.includes('приглаш')
  ) {
    return 'social';
  }
  if (
    combined.includes('нейро') ||
    combined.includes('сценар') ||
    combined.includes('автопилот') ||
    combined.includes('генерац') ||
    combined.includes('изображ')
  ) {
    return 'ai';
  }
  return 'system';
}

export function getUserNotificationPreferencesSync(
  db: any,
  rawUserId: string
): PushNotificationPreferences {
  const userId = normalizeUserId(String(rawUserId || ''));
  const cached = userId ? prefsCache.get(userId) : undefined;
  if (!userId) return rowToPreferences('');

  try {
    if (db) {
      const stmt = db.prepare('SELECT * FROM push_notification_settings WHERE user_id = ? LIMIT 1');
      stmt.bind([userId]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        const parsed = rowToPreferences(userId, row);
        prefsCache.set(userId, parsed);
        return parsed;
      }
      stmt.free();
    }
  } catch {}

  if (cached) return cached;
  return rowToPreferences(userId);
}

export async function getUserPushPreferences(rawUserId: string): Promise<PushNotificationPreferences> {
  const userId = normalizeUserId(String(rawUserId || ''));
  if (!userId) return rowToPreferences('');

  try {
    const cloudRes = await pgQuery<any>(
      'SELECT * FROM push_notification_settings WHERE user_id = $1 LIMIT 1',
      [userId],
      { safeMode: true }
    ).catch(() => null);

    let row = cloudRes?.rows?.[0];
    if (!row) {
      const db = await getPgDB();
      const stmt = db.prepare('SELECT * FROM push_notification_settings WHERE user_id = ? LIMIT 1');
      stmt.bind([userId]);
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
    }

    const parsed = rowToPreferences(userId, row);
    prefsCache.set(userId, parsed);
    return parsed;
  } catch (err) {
    console.warn('[PushStore] Error reading preferences:', err);
    return prefsCache.get(userId) || rowToPreferences(userId);
  }
}

export async function shouldDeliverNotificationChannel(
  rawUserId: string,
  channel: NotificationChannelKey,
  meta: {
    type?: string;
    title?: string;
    message?: string;
    link?: string;
    explicitCategory?: PushCategoryKey;
  }
): Promise<boolean> {
  const userId = normalizeUserId(String(rawUserId || ''));
  if (!userId) return true;
  const prefs = await getUserPushPreferences(userId);
  const chanState = prefs.channels[channel];
  if (!chanState || !chanState.enabled) return false;
  const cat = inferPushCategory(meta);
  return chanState.categories[cat] !== false;
}

function mergeChannelState(
  prev: ChannelPreferenceState,
  patch?: { enabled?: boolean; categories?: Partial<Record<PushCategoryKey, boolean>> }
): ChannelPreferenceState {
  if (!patch) {
    return { enabled: prev.enabled, categories: { ...prev.categories } };
  }
  return {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : prev.enabled,
    categories: {
      publish: patch.categories?.publish ?? prev.categories.publish,
      folders: patch.categories?.folders ?? prev.categories.folders,
      balance: patch.categories?.balance ?? prev.categories.balance,
      social: patch.categories?.social ?? prev.categories.social,
      ai: patch.categories?.ai ?? prev.categories.ai,
      system: patch.categories?.system ?? prev.categories.system,
    },
  };
}

export async function saveUserPushPreferences(
  rawUserId: string,
  prefs: {
    enabled?: boolean;
    categories?: Partial<Record<PushCategoryKey, boolean>>;
    channels?: Partial<
      Record<
        NotificationChannelKey,
        { enabled?: boolean; categories?: Partial<Record<PushCategoryKey, boolean>> }
      >
    >;
  }
): Promise<PushNotificationPreferences> {
  const userId = normalizeUserId(String(rawUserId || ''));
  const current = await getUserPushPreferences(userId);
  const nowIso = new Date().toISOString();

  const pushPatch = prefs.channels?.push ?? (
    prefs.enabled !== undefined || prefs.categories !== undefined
      ? { enabled: prefs.enabled, categories: prefs.categories }
      : undefined
  );

  const nextPush = mergeChannelState(current.channels.push, pushPatch);
  // Also allow legacy top-level enabled/categories to update push if channels.push didn't override them
  if (prefs.channels?.push) {
    if (typeof prefs.enabled === 'boolean') nextPush.enabled = prefs.enabled;
    if (prefs.categories) {
      nextPush.categories = mergeChannelState(nextPush, { categories: prefs.categories }).categories;
    }
  }
  const nextTelegram = mergeChannelState(current.channels.telegram, prefs.channels?.telegram);
  const nextBell = mergeChannelState(current.channels.bell, prefs.channels?.bell);

  const next: PushNotificationPreferences = {
    userId,
    enabled: nextPush.enabled,
    categories: { ...nextPush.categories },
    channels: {
      push: nextPush,
      telegram: nextTelegram,
      bell: nextBell,
    },
    updatedAt: nowIso,
  };

  prefsCache.set(userId, next);

  const cols = [
    userId,
    nextPush.enabled ? 1 : 0,
    nextPush.categories.publish ? 1 : 0,
    nextPush.categories.folders ? 1 : 0,
    nextPush.categories.balance ? 1 : 0,
    nextPush.categories.social ? 1 : 0,
    nextPush.categories.ai ? 1 : 0,
    nextPush.categories.system ? 1 : 0,
    nextTelegram.enabled ? 1 : 0,
    nextTelegram.categories.publish ? 1 : 0,
    nextTelegram.categories.folders ? 1 : 0,
    nextTelegram.categories.balance ? 1 : 0,
    nextTelegram.categories.social ? 1 : 0,
    nextTelegram.categories.ai ? 1 : 0,
    nextTelegram.categories.system ? 1 : 0,
    nextBell.enabled ? 1 : 0,
    nextBell.categories.publish ? 1 : 0,
    nextBell.categories.folders ? 1 : 0,
    nextBell.categories.balance ? 1 : 0,
    nextBell.categories.social ? 1 : 0,
    nextBell.categories.ai ? 1 : 0,
    nextBell.categories.system ? 1 : 0,
    nowIso,
  ];

  await pgQuery(
    `INSERT INTO push_notification_settings (
      user_id, enabled, cat_publish, cat_folders, cat_balance, cat_social, cat_ai, cat_system,
      telegram_enabled, tg_cat_publish, tg_cat_folders, tg_cat_balance, tg_cat_social, tg_cat_ai, tg_cat_system,
      bell_enabled, bell_cat_publish, bell_cat_folders, bell_cat_balance, bell_cat_social, bell_cat_ai, bell_cat_system,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22,
      $23
    )
    ON CONFLICT (user_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      cat_publish = EXCLUDED.cat_publish,
      cat_folders = EXCLUDED.cat_folders,
      cat_balance = EXCLUDED.cat_balance,
      cat_social = EXCLUDED.cat_social,
      cat_ai = EXCLUDED.cat_ai,
      cat_system = EXCLUDED.cat_system,
      telegram_enabled = EXCLUDED.telegram_enabled,
      tg_cat_publish = EXCLUDED.tg_cat_publish,
      tg_cat_folders = EXCLUDED.tg_cat_folders,
      tg_cat_balance = EXCLUDED.tg_cat_balance,
      tg_cat_social = EXCLUDED.tg_cat_social,
      tg_cat_ai = EXCLUDED.tg_cat_ai,
      tg_cat_system = EXCLUDED.tg_cat_system,
      bell_enabled = EXCLUDED.bell_enabled,
      bell_cat_publish = EXCLUDED.bell_cat_publish,
      bell_cat_folders = EXCLUDED.bell_cat_folders,
      bell_cat_balance = EXCLUDED.bell_cat_balance,
      bell_cat_social = EXCLUDED.bell_cat_social,
      bell_cat_ai = EXCLUDED.bell_cat_ai,
      bell_cat_system = EXCLUDED.bell_cat_system,
      updated_at = EXCLUDED.updated_at`,
    cols
  );

  const db = await getPgDB();
  db.run(
    `INSERT OR REPLACE INTO push_notification_settings (
      user_id, enabled, cat_publish, cat_folders, cat_balance, cat_social, cat_ai, cat_system,
      telegram_enabled, tg_cat_publish, tg_cat_folders, tg_cat_balance, tg_cat_social, tg_cat_ai, tg_cat_system,
      bell_enabled, bell_cat_publish, bell_cat_folders, bell_cat_balance, bell_cat_social, bell_cat_ai, bell_cat_system,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    cols
  );
  await refreshTableCacheFromCloud('push_notification_settings').catch(() => null);

  return next;
}

export async function upsertPushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  deviceLabel?: string;
}): Promise<PushSubscriptionRecord> {
  const userId = normalizeUserId(String(params.userId || ''));
  const endpoint = String(params.endpoint || '').trim();
  const p256dh = String(params.p256dh || '').trim();
  const auth = String(params.auth || '').trim();
  const userAgent = String(params.userAgent || '').slice(0, 320);
  const deviceLabel = String(params.deviceLabel || detectDeviceLabel(userAgent)).slice(0, 120);
  const id = hashSubscriptionId(endpoint);
  const nowIso = new Date().toISOString();

  await pgQuery(
    `INSERT INTO push_subscriptions (
      id, user_id, endpoint, p256dh, auth, user_agent, device_label, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      device_label = EXCLUDED.device_label,
      is_active = 1,
      updated_at = EXCLUDED.updated_at`,
    [id, userId, endpoint, p256dh, auth, userAgent, deviceLabel, nowIso, nowIso]
  );

  const db = await getPgDB();
  db.run(
    `INSERT OR REPLACE INTO push_subscriptions (
      id, user_id, endpoint, p256dh, auth, user_agent, device_label, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, userId, endpoint, p256dh, auth, userAgent, deviceLabel, nowIso, nowIso]
  );
  await refreshTableCacheFromCloud('push_subscriptions').catch(() => null);

  return {
    id,
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent,
    deviceLabel,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSuccessAt: null,
  };
}

export async function removePushSubscription(rawUserId: string, endpoint?: string, id?: string): Promise<number> {
  const userId = normalizeUserId(String(rawUserId || ''));
  if (!userId) return 0;

  let removed = 0;
  if (endpoint) {
    const res = await pgQuery(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );
    removed = res.rowCount || 0;
    const db = await getPgDB();
    db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint]);
  } else if (id) {
    const res = await pgQuery(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND id = $2',
      [userId, id]
    );
    removed = res.rowCount || 0;
    const db = await getPgDB();
    db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND id = ?', [userId, id]);
  }
  await refreshTableCacheFromCloud('push_subscriptions').catch(() => null);
  return removed;
}

export async function getUserPushSubscriptions(rawUserId: string): Promise<PushSubscriptionRecord[]> {
  const userId = normalizeUserId(String(rawUserId || ''));
  if (!userId) return [];

  try {
    const cloudRes = await pgQuery<any>(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = 1 ORDER BY updated_at DESC',
      [userId],
      { safeMode: true }
    ).catch(() => null);

    let rows = cloudRes?.rows;
    if (!rows) {
      const db = await getPgDB();
      const stmt = db.prepare(
        'SELECT * FROM push_subscriptions WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC'
      );
      stmt.bind([userId]);
      rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
    }

    return (rows || []).map((r: any) => ({
      id: String(r.id),
      userId: String(r.user_id),
      endpoint: String(r.endpoint),
      p256dh: String(r.p256dh),
      auth: String(r.auth),
      userAgent: String(r.user_agent || ''),
      deviceLabel: String(r.device_label || 'Устройство'),
      isActive: Number(r.is_active ?? 1) !== 0,
      createdAt: String(r.created_at || ''),
      updatedAt: String(r.updated_at || ''),
      lastSuccessAt: r.last_success_at ? String(r.last_success_at) : null,
    }));
  } catch (err) {
    console.warn('[PushStore] Error fetching subscriptions:', err);
    return [];
  }
}

export async function deactivateExpiredSubscriptionById(id: string): Promise<void> {
  try {
    await pgQuery('DELETE FROM push_subscriptions WHERE id = $1', [id]).catch(() => null);
    const db = await getPgDB();
    db.run('DELETE FROM push_subscriptions WHERE id = ?', [id]);
  } catch {}
}

export async function markSubscriptionSuccess(id: string): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await pgQuery(
      'UPDATE push_subscriptions SET last_success_at = $1, updated_at = $1 WHERE id = $2',
      [nowIso, id]
    ).catch(() => null);
    const db = await getPgDB();
    db.run('UPDATE push_subscriptions SET last_success_at = ?, updated_at = ? WHERE id = ?', [
      nowIso,
      nowIso,
      id,
    ]);
  } catch {}
}

function detectDeviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iPhone / iPad (iOS)';
  if (/android/.test(ua)) return 'Android устройство';
  if (/windows/.test(ua)) return 'Компьютер (Windows)';
  if (/macintosh|mac os x/.test(ua)) return 'Mac / Safari / Chrome';
  if (/linux/.test(ua)) return 'Компьютер (Linux)';
  return 'Веб-браузер';
}
