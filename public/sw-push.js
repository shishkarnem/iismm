/* ИИSMM Web Push Service Worker Handler (loaded via Workbox importScripts) */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'ИИSMM',
    body: 'Новое уведомление в вашем кабинете',
    url: '/profile',
    icon: '/pwa/icon-192x192.png',
    badge: '/tiles/push-badge-72x72.png',
    tag: 'iismm-notification'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || parsed.message || payload.body,
        url: parsed.url || parsed.link || payload.url,
        icon: parsed.icon || payload.icon,
        badge: parsed.badge || payload.badge,
        tag: parsed.tag || payload.tag
      };
    } catch {
      try {
        const text = event.data.text();
        if (text) payload.body = text;
      } catch {}
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    vibrate: [120, 60, 120],
    data: {
      url: payload.url || '/profile'
    }
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/profile';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const normalizedTarget = targetUrl.startsWith('/') ? targetUrl : '/';
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(normalizedTarget);
          }
          client.postMessage({ type: 'PUSH_NAVIGATE', url: normalizedTarget });
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedTarget);
      }
      return undefined;
    })
  );
});
