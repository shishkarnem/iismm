import { useCallback, useEffect, useState } from 'react';

export type PushCategoryKey =
  | 'publish'
  | 'folders'
  | 'balance'
  | 'social'
  | 'ai'
  | 'system';

export type NotificationChannelKey = 'push' | 'telegram' | 'bell';

export interface PushPreferencesState {
  enabled: boolean;
  categories: Record<PushCategoryKey, boolean>;
}

export type UnifiedNotificationChannelsState = Record<NotificationChannelKey, PushPreferencesState>;

export interface ConnectedPushDevice {
  id: string;
  deviceLabel: string;
  createdAt: string;
  updatedAt?: string;
  lastSuccessAt?: string | null;
}

const DEFAULT_PREFS: PushPreferencesState = {
  enabled: true,
  categories: {
    publish: true,
    folders: true,
    balance: true,
    social: true,
    ai: true,
    system: true,
  },
};

function createDefaultChannels(): UnifiedNotificationChannelsState {
  return {
    push: { enabled: true, categories: { ...DEFAULT_PREFS.categories } },
    telegram: { enabled: true, categories: { ...DEFAULT_PREFS.categories } },
    bell: { enabled: true, categories: { ...DEFAULT_PREFS.categories } },
  };
}

function normalizeChannelsResponse(rawPrefs: any): UnifiedNotificationChannelsState {
  const fallback = createDefaultChannels();
  if (!rawPrefs) return fallback;

  const pushLegacy: PushPreferencesState = {
    enabled: typeof rawPrefs.enabled === 'boolean' ? rawPrefs.enabled : fallback.push.enabled,
    categories: {
      ...DEFAULT_PREFS.categories,
      ...(rawPrefs.categories || {}),
    },
  };

  const rawChans = rawPrefs.channels || {};
  return {
    push: {
      enabled: typeof rawChans.push?.enabled === 'boolean' ? rawChans.push.enabled : pushLegacy.enabled,
      categories: {
        ...pushLegacy.categories,
        ...(rawChans.push?.categories || {}),
      },
    },
    telegram: {
      enabled: typeof rawChans.telegram?.enabled === 'boolean' ? rawChans.telegram.enabled : true,
      categories: {
        ...DEFAULT_PREFS.categories,
        ...(rawChans.telegram?.categories || {}),
      },
    },
    bell: {
      enabled: typeof rawChans.bell?.enabled === 'boolean' ? rawChans.bell.enabled : true,
      categories: {
        ...DEFAULT_PREFS.categories,
        ...(rawChans.bell?.categories || {}),
      },
    },
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing?.active) return existing;

  try {
    const reg = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    return reg;
  } catch {
    return null;
  }
}

export function usePushNotifications(userId: string) {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribedOnThisDevice, setIsSubscribedOnThisDevice] = useState<boolean>(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [channels, setChannels] = useState<UnifiedNotificationChannelsState>(() => createDefaultChannels());
  const [devices, setDevices] = useState<ConnectedPushDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const preferences = channels.push;

  const syncLocalSubscriptionState = useCallback(async () => {
    if (!isSupported) return;
    setPermission(Notification.permission);
    try {
      const reg = await getReadyServiceWorkerRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribedOnThisDevice(Boolean(sub));
      setCurrentEndpoint(sub?.endpoint || null);
    } catch {
      setIsSubscribedOnThisDevice(false);
      setCurrentEndpoint(null);
    }
  }, [isSupported]);

  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/push/preferences?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
      });
      const data = await res.json();
      if (res.ok && data.success && data.preferences) {
        setChannels(normalizeChannelsResponse(data.preferences));
        setDevices(Array.isArray(data.devices) ? data.devices : []);
      }
    } catch {
      // keep existing preferences fallback
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPreferences();
    void syncLocalSubscriptionState();
  }, [loadPreferences, syncLocalSubscriptionState]);

  const enableDevicePush = useCallback(async () => {
    if (!isSupported) {
      setStatusMessage({
        type: 'error',
        text: 'Этот браузер или встроенное окно не поддерживает системные push-уведомления. На iPhone установите приложение на экран Домой через Safari.',
      });
      return false;
    }

    setActionBusy(true);
    setStatusMessage(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage({
          type: 'error',
          text:
            perm === 'denied'
              ? 'Уведомления заблокированы в настройках браузера. Разрешите уведомления для сайта iismm.ru в настройках браузера или телефона.'
              : 'Разрешение на отправку push-уведомлений не было выдано.',
        });
        return false;
      }

      const reg = await getReadyServiceWorkerRegistration();
      if (!reg) {
        setStatusMessage({
          type: 'error',
          text: 'Сервис-воркер еще активируется. Обновите страницу или откройте установленное PWA-приложение и повторите попытку.',
        });
        return false;
      }

      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData?.publicKey) {
        throw new Error(keyData?.error || 'Не удалось получить VAPID-ключ сервера');
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }

      const subJson = sub.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          userId,
          subscription: subJson,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData?.error || 'Сервер не смог сохранить push-подписку');
      }

      setIsSubscribedOnThisDevice(true);
      setCurrentEndpoint(sub.endpoint);
      await loadPreferences();
      setStatusMessage({
        type: 'success',
        text: 'Push-уведомления на этом устройстве успешно подключены!',
      });
      return true;
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Не удалось подключить push-уведомления на устройстве.',
      });
      return false;
    } finally {
      setActionBusy(false);
    }
  }, [isSupported, loadPreferences, userId]);

  const disableThisDevicePush = useCallback(async () => {
    setActionBusy(true);
    setStatusMessage(null);
    try {
      const reg = await getReadyServiceWorkerRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const endpoint = sub?.endpoint || currentEndpoint;

      if (sub) {
        await sub.unsubscribe().catch(() => null);
      }

      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({ userId, endpoint }),
        });
      }

      setIsSubscribedOnThisDevice(false);
      setCurrentEndpoint(null);
      await loadPreferences();
      setStatusMessage({
        type: 'info',
        text: 'Push-уведомления на этом устройстве отключены.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Ошибка при отключении устройства.',
      });
    } finally {
      setActionBusy(false);
    }
  }, [currentEndpoint, loadPreferences, userId]);

  const removeDeviceById = useCallback(
    async (deviceId: string) => {
      setActionBusy(true);
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({ userId, deviceId }),
        });
        await loadPreferences();
      } finally {
        setActionBusy(false);
      }
    },
    [loadPreferences, userId]
  );

  const persistChannelsPatch = useCallback(
    async (
      patchChannels: Partial<
        Record<
          NotificationChannelKey,
          { enabled?: boolean; categories?: Partial<Record<PushCategoryKey, boolean>> }
        >
      >
    ) => {
      const nextChannels: UnifiedNotificationChannelsState = {
        push: {
          enabled:
            typeof patchChannels.push?.enabled === 'boolean'
              ? patchChannels.push.enabled
              : channels.push.enabled,
          categories: {
            ...channels.push.categories,
            ...(patchChannels.push?.categories || {}),
          },
        },
        telegram: {
          enabled:
            typeof patchChannels.telegram?.enabled === 'boolean'
              ? patchChannels.telegram.enabled
              : channels.telegram.enabled,
          categories: {
            ...channels.telegram.categories,
            ...(patchChannels.telegram?.categories || {}),
          },
        },
        bell: {
          enabled:
            typeof patchChannels.bell?.enabled === 'boolean'
              ? patchChannels.bell.enabled
              : channels.bell.enabled,
          categories: {
            ...channels.bell.categories,
            ...(patchChannels.bell?.categories || {}),
          },
        },
      };
      setChannels(nextChannels);

      try {
        const res = await fetch('/api/push/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            userId,
            enabled: nextChannels.push.enabled,
            categories: nextChannels.push.categories,
            channels: nextChannels,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.preferences) {
          setChannels(normalizeChannelsResponse(data.preferences));
        }
      } catch {
        // Keep optimistic state on transient network failure
      }
    },
    [channels, userId]
  );

  const updatePreferences = useCallback(
    async (patch: { enabled?: boolean; categories?: Partial<Record<PushCategoryKey, boolean>> }) => {
      await persistChannelsPatch({ push: patch });
    },
    [persistChannelsPatch]
  );

  const updateChannelMaster = useCallback(
    async (channel: NotificationChannelKey, enabled: boolean) => {
      await persistChannelsPatch({ [channel]: { enabled } });
    },
    [persistChannelsPatch]
  );

  const updateChannelCategory = useCallback(
    async (channel: NotificationChannelKey, category: PushCategoryKey, enabled: boolean) => {
      await persistChannelsPatch({
        [channel]: { categories: { [category]: enabled } },
      });
    },
    [persistChannelsPatch]
  );

  const sendTestPush = useCallback(async () => {
    setActionBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Тестовое push-уведомление отправлено (доставлено устройств: ${data.delivered || 1}).`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data?.error || 'Не удалось доставить тестовый push.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Сбой сети при отправке тестового push.',
      });
    } finally {
      setActionBusy(false);
    }
  }, [userId]);

  return {
    isSupported,
    permission,
    isSubscribedOnThisDevice,
    preferences,
    channels,
    devices,
    loading,
    actionBusy,
    statusMessage,
    enableDevicePush,
    disableThisDevicePush,
    removeDeviceById,
    updatePreferences,
    updateChannelMaster,
    updateChannelCategory,
    sendTestPush,
    refresh: loadPreferences,
  };
}
