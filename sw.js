const CACHE = 'lux-canis-v10';
const CORE = ['./','./index.html','./styles.css','./script.js','./product.html','./product.css','./product-enhancements.css','./product.js','./account.html','./account.css','./account-polish.css','./visibility.css','./account.js','./contact.html','./contact.css','./contact.js','./guide.html','./guide.css','./privacy.html','./privacy.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
