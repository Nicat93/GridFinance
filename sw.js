
const CACHE_NAME = 'grid-finance-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/index.js',
  // Cache the CDN for offline use
  'https://cdn.tailwindcss.com',
  // Cache the icon so PWA install check passes offline
  'https://cdn-icons-png.flaticon.com/512/2344/2344132.png'
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

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Navigation Requests (HTML) - SPA Pattern
  // Always try network first, fallback to cached index.html if offline or 404
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network fails, return the cached index.html to load the app
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. Critical Assets (Main JS) - Network First to ensure updates
  if (url.pathname.endsWith('index.js')) {
     event.respondWith(
      fetch(event.request)
        .then((response) => {
           // Update cache if valid
           if (response && response.status === 200) {
             const responseToCache = response.clone();
             caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
           }
           return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Static Assets / Images - Cache First
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});
