// apps/dashboard/public/sw.js
// Minimal push-only service worker — no caching logic

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '🔔 New Lead', body: event.data.text() };
  }

  const title = payload.title || '🔔 New Lead Available';
  const options = {
    body: payload.body || 'A new lead matched your profile. Tap to view.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.leadId || 'lead-notification',
    renotify: true,
    data: {
      url: payload.url || '/',
      leadId: payload.leadId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
