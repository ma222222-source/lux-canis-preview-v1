const CACHE = 'lux-canis-v14';
const CORE = ['./','./index.html','./styles.css','./script.js','./product.html','./product.css','./product-enhancements.css','./product.js','./account.html','./account.css','./account-polish.css','./visibility.css','./account.js','./contact.html','./contact.css','./contact.js','./guide.html','./guide.css','./privacy.html','./privacy.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  const cacheKey = url.pathname;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE).then((cache) => cache.put(cacheKey, response.clone())));
      return response;
    }).catch(async () => (await caches.match(cacheKey)) || caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(cacheKey);
    const network = fetch(event.request).then((response) => {
      if (response.ok) event.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    });
    if (cached) { event.waitUntil(network.catch(() => undefined)); return cached; }
    return network;
  }));
});
