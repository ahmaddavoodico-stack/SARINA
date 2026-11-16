const CACHE = 'sarina-farmer-v13';
const CORE = ['./', './index.html', './styles.css', './app.js', './admin.js', './admin.css', './experts.js', './operations.js', './weather.js', './manifest.webmanifest', './icon.svg'];
const STATIC_PATHS = new Set(CORE.map(path => new URL(path, self.registration.scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('sarina-farmer-') && key !== CACHE)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Only cache this app's static shell. Never cache Supabase/API responses,
  // authenticated requests, or any cross-origin content.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      request.headers.has('authorization') || !STATIC_PATHS.has(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});