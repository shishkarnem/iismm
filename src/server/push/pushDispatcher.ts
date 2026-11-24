import * as webPushModule from 'web-push';
import { getOrInitVapidKeys } from './vapidConfig';

const webPush = ((webPushModule as any).default || webPushModule) as typeof import('web-push');
import {
  PushCategoryKey,
  deactivateExpiredSubscriptionById,
  getUserPushPreferences,
  getUserPushSubscriptions,
  inferPushCategory,
  markSubscriptionSuccess,
} from './pushStore';

export interface DispatchPushResult {
  attempted: number;
  delivered: number;
  removedExpired: number;
  skippedReason?: string;
}

export async function dispatchWebPushToUser(params: {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  category?: PushCategoryKey;
  ignoreCategoryFilter?: boolean;
}): Promise<DispatchPushResult> {
  const userId = String(params.userId || '').trim();
  if (!userId) {
    return { attempted: 0, delivered: 0, removedExpired: 0, skippedReason: 'missing_user_id' };
  }

  try {
    const [prefs, subs] = await Promise.all([
      getUserPushPreferences(userId),
      getUserPushSubscriptions(userId),
    ]);

    if (subs.length === 0) {
      return { attempted: 0, delivered: 0, removedExpired: 0, skippedReason: 'no_subscriptions' };
    }

    if (!params.ignoreCategoryFilter) {
      const pushPrefs = prefs.channels?.push || { enabled: prefs.enabled, categories: prefs.categories };
      if (!pushPrefs.enabled) {
        return { attempted: 0, delivered: 0, removedExpired: 0, skippedReason: 'push_disabled_by_user' };
      }
      const category = inferPushCategory({
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        explicitCategory: params.category,
      });
      if (!pushPrefs.categories[category]) {
        return {
          attempted: 0,
          delivered: 0,
          removedExpired: 0,
          skippedReason: `category_${category}_disabled`,
        };
      }
    }

    await getOrInitVapidKeys();

    const safeTargetUrl =
      params.link && params.link.startsWith('/') ? params.link : '/profile';

    const payload = JSON.stringify({
      title: String(params.title || 'ИИSMM').slice(0, 120),
      body: String(params.message || '').slice(0, 260),
      url: safeTargetUrl,
      icon: '/pwa/icon-192x192.png',
      badge: '/tiles/push-badge-72x72.png',
      tag: `iismm-${params.type || 'notif'}-${Date.now()}`,
    });

    let delivered = 0;
    let removedExpired = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload,
            { TTL: 60 * 60 * 12 }
          );
          delivered++;
          await markSubscriptionSuccess(sub.id);
        } catch (err: any) {
          const statusCode = Number(err?.statusCode || 0);
          if (statusCode === 404 || statusCode === 410) {
            removedExpired++;
            await deactivateExpiredSubscriptionById(sub.id);
          } else {
            console.warn(
              `[WebPush] Delivery error (${statusCode || 'unknown'}) for sub ${sub.id}:`,
              err?.body || err?.message || err
            );
          }
        }
      })
    );

    return {
      attempted: subs.length,
      delivered,
      removedExpired,
    };
  } catch (err) {
    console.warn('[WebPush] Dispatch error:', err);
    return { attempted: 0, delivered: 0, removedExpired: 0, skippedReason: 'dispatch_error' };
  }
}
