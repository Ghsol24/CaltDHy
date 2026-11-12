// Loaded into the generated service worker (see vite.config.js > workbox.importScripts).
// The server sends pushes with no payload, so the reminder text lives here: the page saves the
// user's language version into a cache when they turn the reminder on.
const COPY_CACHE = 'caltdhy-push-copy';
const COPY_KEY = '/__push-copy';
const FALLBACK = { title: 'CaltDHy', body: 'Hôm nay bạn chưa ghi khoản nào. Dành một phút ghi lại nhé.' };

async function reminderCopy() {
  try {
    const cache = await caches.open(COPY_CACHE);
    const stored = await cache.match(COPY_KEY);
    const copy = stored ? await stored.json() : null;
    if (copy && typeof copy.title === 'string' && typeof copy.body === 'string') return copy;
  } catch { /* fall through to the default text */ }
  return FALLBACK;
}

self.addEventListener('push', (event) => {
  event.waitUntil(reminderCopy().then((copy) => self.registration.showNotification(copy.title, {
    body: copy.body, icon: '/app-icon-192.png', badge: '/app-icon-192.png', tag: 'daily-reminder', renotify: false,
  })));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
    return open ? open.focus() : self.clients.openWindow('/spending/home');
  }));
});
