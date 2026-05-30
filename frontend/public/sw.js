// Minimal service worker — kept light on purpose since the app is data-heavy
// and we always want fresh API responses.
// Bump CACHE_NAME on EVERY deploy that touches the JS bundle so engineers'
// PWAs auto-pick up fixes (otherwise they'd be stuck on the old bundle).
const CACHE_NAME = 'cc-shell-v6-20260530c';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Never cache or intercept the API or PDF download endpoints — the engineer
  // needs the freshest response, and intercepting the public PDF link breaks
  // the synchronous <a download> flow on mobile PWAs.
  if (req.url.includes('/api/')) return;
  if (req.url.includes('/uploads/')) return;
  if (req.url.endsWith('.pdf')) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
  }
});

// ---------- Web Push ----------
// Fires when the push service delivers a message from our backend.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (_e) {
    data = { title: 'Creator Consultant', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Creator Consultant';
  const options = {
    body: data.body || '',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag: data.tag || 'creator-consultant',
    data: { url: data.url || '/site-visits' },
    requireInteraction: false,
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Bring the app to the foreground when the user taps the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
