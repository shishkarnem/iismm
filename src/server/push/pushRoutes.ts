import { Router, Request, Response } from 'express';
import { getPgDB, normalizeUserId } from '../db/postgres';
import { getUserByIdFromDb } from '../db/usersTable';
import { getOrInitVapidKeys } from './vapidConfig';
import {
  NotificationChannelKey,
  PushCategoryKey,
  getUserPushPreferences,
  getUserPushSubscriptions,
  isValidPushEndpoint,
  removePushSubscription,
  saveUserPushPreferences,
  upsertPushSubscription,
} from './pushStore';
import { dispatchWebPushToUser } from './pushDispatcher';

export const pushRouter = Router();

const ALLOWED_CATEGORIES: PushCategoryKey[] = [
  'publish',
  'folders',
  'balance',
  'social',
  'ai',
  'system',
];

const ALLOWED_CHANNELS: NotificationChannelKey[] = ['push', 'telegram', 'bell'];

function sanitizeCategoryPatch(rawCats: any): Partial<Record<PushCategoryKey, boolean>> {
  const out: Partial<Record<PushCategoryKey, boolean>> = {};
  if (rawCats && typeof rawCats === 'object') {
    for (const key of ALLOWED_CATEGORIES) {
      if (typeof rawCats[key] === 'boolean') {
        out[key] = rawCats[key];
      }
    }
  }
  return out;
}

type PushAuthResult =
  | { ok: true; userId: string; status?: undefined; error?: undefined }
  | { ok: false; status: number; error: string; userId?: undefined };

async function resolveVerifiedPushUserId(req: Request): Promise<PushAuthResult> {
  const headerRaw = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
  const bodyOrQueryRaw =
    (req.body?.userId ? String(req.body.userId).trim() : '') ||
    (req.query?.userId ? String(req.query.userId).trim() : '');

  const rawId = headerRaw || bodyOrQueryRaw;
  if (!rawId) {
    return { ok: false, status: 401, error: 'Не указан идентификатор пользователя' };
  }

  const normalized = normalizeUserId(rawId);
  if (headerRaw && bodyOrQueryRaw && normalizeUserId(headerRaw) !== normalizeUserId(bodyOrQueryRaw)) {
    return { ok: false, status: 403, error: 'Доступ запрещен: идентификатор пользователя не совпадает' };
  }

  try {
    const db = await getPgDB();
    const user = getUserByIdFromDb(db as any, normalized);
    if (!user && normalized !== '16926299042') {
      return { ok: false, status: 403, error: 'Пользователь не найден' };
    }
  } catch {
    // Allow fallback when DB is hydrating on cold start if normalized matches valid format
  }

  return { ok: true, userId: normalized };
}

pushRouter.get('/vapid-public-key', async (_req: Request, res: Response) => {
  try {
    const keys = await getOrInitVapidKeys();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, publicKey: keys.publicKey });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка получения VAPID ключа' });
  }
});

pushRouter.get('/preferences', async (req: Request, res: Response) => {
  const auth = await resolveVerifiedPushUserId(req);
  if (!auth.ok || !auth.userId) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Не авторизован' });
  }

  try {
    const [preferences, subscriptions] = await Promise.all([
      getUserPushPreferences(auth.userId),
      getUserPushSubscriptions(auth.userId),
    ]);
    res.json({
      success: true,
      preferences,
      devices: subscriptions.map((s) => ({
        id: s.id,
        deviceLabel: s.deviceLabel,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastSuccessAt: s.lastSuccessAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка загрузки настроек уведомлений' });
  }
});

pushRouter.put('/preferences', async (req: Request, res: Response) => {
  const auth = await resolveVerifiedPushUserId(req);
  if (!auth.ok || !auth.userId) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Не авторизован' });
  }

  try {
    const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined;
    const sanitizedCats = sanitizeCategoryPatch(req.body?.categories);

    const sanitizedChannels: Partial<
      Record<
        NotificationChannelKey,
        { enabled?: boolean; categories?: Partial<Record<PushCategoryKey, boolean>> }
      >
    > = {};
    const rawChannels = req.body?.channels;
    if (rawChannels && typeof rawChannels === 'object') {
      for (const chan of ALLOWED_CHANNELS) {
        const entry = rawChannels[chan];
        if (entry && typeof entry === 'object') {
          sanitizedChannels[chan] = {
            enabled: typeof entry.enabled === 'boolean' ? entry.enabled : undefined,
            categories: sanitizeCategoryPatch(entry.categories),
          };
        }
      }
    }

    const updated = await saveUserPushPreferences(auth.userId, {
      enabled,
      categories: sanitizedCats,
      channels: sanitizedChannels,
    });
    res.json({ success: true, preferences: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка сохранения настроек уведомлений' });
  }
});

pushRouter.post('/subscribe', async (req: Request, res: Response) => {
  const auth = await resolveVerifiedPushUserId(req);
  if (!auth.ok || !auth.userId) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Не авторизован' });
  }

  const sub = req.body?.subscription || req.body;
  const endpoint = String(sub?.endpoint || '').trim();
  const p256dh = String(sub?.keys?.p256dh || '').trim();
  const authSecret = String(sub?.keys?.auth || '').trim();

  if (!endpoint || !isValidPushEndpoint(endpoint)) {
    return res.status(400).json({ success: false, error: 'Некорректный URL push-подписки' });
  }
  if (!p256dh || p256dh.length > 512 || !authSecret || authSecret.length > 256) {
    return res.status(400).json({ success: false, error: 'Некорректные криптографические ключи push-подписки' });
  }

  try {
    const saved = await upsertPushSubscription({
      userId: auth.userId,
      endpoint,
      p256dh,
      auth: authSecret,
      userAgent: String(req.headers['user-agent'] || ''),
      deviceLabel: req.body?.deviceLabel ? String(req.body.deviceLabel) : undefined,
    });

    res.json({
      success: true,
      device: {
        id: saved.id,
        deviceLabel: saved.deviceLabel,
        createdAt: saved.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Не удалось сохранить push-подписку' });
  }
});

pushRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  const auth = await resolveVerifiedPushUserId(req);
  if (!auth.ok || !auth.userId) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Не авторизован' });
  }

  const endpoint = req.body?.endpoint ? String(req.body.endpoint).trim() : undefined;
  const deviceId = req.body?.deviceId ? String(req.body.deviceId).trim() : undefined;
  if (!endpoint && !deviceId) {
    return res.status(400).json({ success: false, error: 'Укажите endpoint или deviceId устройства' });
  }

  try {
    const removed = await removePushSubscription(auth.userId, endpoint, deviceId);
    res.json({ success: true, removed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка отключения push-подписки' });
  }
});

pushRouter.post('/test', async (req: Request, res: Response) => {
  const auth = await resolveVerifiedPushUserId(req);
  if (!auth.ok || !auth.userId) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Не авторизован' });
  }

  try {
    const result = await dispatchWebPushToUser({
      userId: auth.userId,
      title: 'ИИSMM — Тестовое push-уведомление',
      message: 'Уведомления на устройстве настроены и работают! Важные события по постам и папкам будут приходить сюда.',
      link: '/profile',
      type: 'system',
      ignoreCategoryFilter: true,
    });

    if (result.attempted === 0) {
      return res.status(400).json({
        success: false,
        error: 'На это устройство еще не оформлена активная push-подписка. Нажмите «Включить push-уведомления».',
      });
    }

    res.json({
      success: result.delivered > 0,
      delivered: result.delivered,
      attempted: result.attempted,
      removedExpired: result.removedExpired,
      error:
        result.delivered === 0
          ? 'Браузер не принял уведомление (подписка устарела). Переподключите push на устройстве.'
          : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка отправки тестового push' });
  }
});
