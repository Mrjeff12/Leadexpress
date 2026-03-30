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
  const leadId = event.notification.data && event.notification.data.leadId;

  // For external URLs (like wa.me links), always open in a new window
  const isExternal = targetUrl.startsWith('http') && !targetUrl.includes(self.location.origin);

  event.waitUntil(
    isExternal
      ? clients.openWindow(targetUrl)
      : clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              // Tell the app to navigate and refresh data
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: targetUrl,
                leadId: leadId,
              });
              client.focus();
              return;
            }
          }
          // No existing window — open a new one
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
  );
});
