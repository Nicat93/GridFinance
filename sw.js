





const CACHE_NAME = 'grid-finance-v65';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com'
];

// Install Event: Cache assets
self.addEventListener('install', (event) => {
  // Force this SW to become the active one immediately
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Robust caching: try caching one by one so one failure doesn't break all
      for (const asset of CORE_ASSETS) {
        try {
            await cache.add(asset);
        } catch (err) {
            console.log('SW: Failed to cache core asset', asset, err);
        }
      }
      
      // Try to cache the build output JS. 
      // In development mode, this file might not exist, so we catch the error 
      // to prevent the Service Worker from failing to install completely.
      try {
        await cache.add('./assets/index.js');
      } catch (e) {
        console.log('SW: Build asset ./assets/index.js not found (expected in dev mode)');
      }
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
          // Check multiple paths to ensure we hit the cache
          return caches.match('./index.html').then(response => {
            return response || caches.match('index.html');
          });
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
