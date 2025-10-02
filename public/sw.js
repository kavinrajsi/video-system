// public/sw.js - Manual service worker for PWA
const CACHE_NAME = 'video-display-v1';
const VIDEO_CACHE = 'video-files-v1';
const API_CACHE = 'api-cache-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/display',
  '/admin',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error('Failed to cache static assets:', error);
      });
    }).then(() => {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== VIDEO_CACHE && 
              cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle video files from Vercel Blob
  if (url.hostname.includes('vercel-storage.com') || 
      request.destination === 'video') {
    event.respondWith(
      caches.open(VIDEO_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Serving video from cache:', url.pathname);
            return cachedResponse;
          }

          console.log('Fetching video from network:', url.pathname);
          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        // Cache successful API responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Fallback to cache if network fails
        return caches.match(request);
      })
    );
    return;
  }

  // Handle all other requests (pages, static assets)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('Serving from cache:', url.pathname);
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch((error) => {
        console.error('Fetch failed:', error);
        // Return a custom offline page if available
        return caches.match('/offline.html') || new Response('Offline');
      });
    })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_VIDEO') {
    const videoUrl = event.data.url;
    event.waitUntil(
      caches.open(VIDEO_CACHE).then((cache) => {
        return fetch(videoUrl).then((response) => {
          if (response.status === 200) {
            return cache.put(videoUrl, response);
          }
        });
      })
    );
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('Service Worker loaded');