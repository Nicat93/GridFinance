
const CACHE_NAME = 'grid-finance-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/index.js',
  // Cache the CDN for offline use
  'https://cdn.tailwindcss.com'
];

// Install Event: Cache assets
self.addEventListener('install', (event) => {
  // Force this SW to become the active one immediately
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network First for HTML/JS (to ensure updates), Cache First for others
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy: Network First -> Fallback to Cache
  // Applies to HTML navigation and our main JS bundle to ensure the latest version is seen.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('index.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
            return response;
          }

          // Clone the response to update the cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // Strategy: Cache First -> Fallback to Network
    // Applies to images, styles, external CDNs (like Tailwind)
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
    );
  }
});
