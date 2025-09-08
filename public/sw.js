// public/sw.js - Custom Service Worker for Video Display System
const CACHE_NAME = 'video-display-v1';
const STATIC_CACHE = 'static-assets-v1';
const VIDEO_CACHE = 'video-files-v1';
const API_CACHE = 'api-responses-v1';

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/admin',
  '/display',
  '/debug',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== VIDEO_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (isVideoRequest(url)) {
    event.respondWith(handleVideoRequest(request));
  } else if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Video file requests - Cache First strategy
async function handleVideoRequest(request) {
  try {
    const cache = await caches.open(VIDEO_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving video from cache', request.url);
      return cachedResponse;
    }
    
    console.log('Service Worker: Fetching video from network', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful video responses
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      console.log('Service Worker: Video cached', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Video request failed', error);
    
    // Try to return cached version as fallback
    const cache = await caches.open(VIDEO_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response if no cache available
    return new Response('Video not available offline', { 
      status: 503,
      statusText: 'Service Unavailable' 
    });
  }
}

// API requests - Network First with cache fallback
async function handleApiRequest(request) {
  try {
    const cache = await caches.open(API_CACHE);
    
    // Try network first for fresh data
    try {
      console.log('Service Worker: Fetching API from network', request.url);
      const networkResponse = await fetch(request, {
        timeout: 5000 // 5 second timeout
      });
      
      if (networkResponse.ok) {
        // Cache successful API responses
        const responseToCache = networkResponse.clone();
        await cache.put(request, responseToCache);
        console.log('Service Worker: API response cached', request.url);
      }
      
      return networkResponse;
    } catch (networkError) {
      console.log('Service Worker: Network failed, trying cache', request.url);
      
      // Network failed, try cache
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        console.log('Service Worker: Serving API from cache', request.url);
        return cachedResponse;
      }
      
      throw networkError;
    }
  } catch (error) {
    console.error('Service Worker: API request failed', error);
    return new Response(JSON.stringify({ 
      error: 'Data not available offline',
      cached: false 
    }), { 
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Static assets - Cache First strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving static asset from cache', request.url);
      return cachedResponse;
    }
    
    console.log('Service Worker: Fetching static asset from network', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static asset request failed', error);
    return fetch(request);
  }
}

// Navigation requests - Network First with offline fallback
async function handleNavigationRequest(request) {
  try {
    console.log('Service Worker: Handling navigation request', request.url);
    
    // Try network first
    const networkResponse = await fetch(request, {
      timeout: 3000 // 3 second timeout for navigation
    });
    
    if (networkResponse.ok) {
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('Service Worker: Navigation network failed, serving offline page');
    
    // Check if we have a cached version of the page
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for display page
    if (request.url.includes('/display')) {
      return cache.match('/display') || cache.match('/');
    }
    
    // Return cached home page as fallback
    return cache.match('/') || new Response('Offline - Please check your connection', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Helper functions
function isVideoRequest(url) {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.ogv'];
  const pathname = url.pathname.toLowerCase();
  return videoExtensions.some(ext => pathname.endsWith(ext)) || 
         url.hostname.includes('blob.vercel-storage.com');
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || 
         url.hostname.includes('supabase.co');
}

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2'];
  const pathname = url.pathname.toLowerCase();
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname.includes('/icons/') ||
         pathname === '/manifest.json';
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'video-sync') {
    event.waitUntil(syncVideoData());
  }
});

async function syncVideoData() {
  try {
    console.log('Service Worker: Syncing video data...');
    
    // Sync any pending video uploads or updates
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    
    for (const request of keys) {
      if (request.url.includes('/api/')) {
        try {
          await fetch(request);
          console.log('Service Worker: Synced', request.url);
        } catch (error) {
          console.error('Service Worker: Sync failed for', request.url, error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event);
  
  const options = {
    body: 'Video display system update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      url: '/admin'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Video Display System', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.openWindow(url)
  );
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    getCacheInfo().then(info => {
      event.ports[0].postMessage(info);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    clearAllCaches().then(result => {
      event.ports[0].postMessage({ success: result });
    });
  }
});

// Get cache information
async function getCacheInfo() {
  try {
    const cacheNames = await caches.keys();
    const cacheInfo = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo[cacheName] = {
        size: keys.length,
        urls: keys.map(req => req.url).slice(0, 5) // First 5 URLs
      };
    }
    
    return {
      caches: cacheInfo,
      totalCaches: cacheNames.length
    };
  } catch (error) {
    console.error('Service Worker: Error getting cache info', error);
    return { error: error.message };
  }
}

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Service Worker: All caches cleared');
    return true;
  } catch (error) {
    console.error('Service Worker: Error clearing caches', error);
    return false;
  }
}

// Preload critical videos
async function preloadVideo(url) {
  try {
    const cache = await caches.open(VIDEO_CACHE);
    const response = await fetch(url);
    
    if (response.ok) {
      await cache.put(url, response);
      console.log('Service Worker: Video preloaded', url);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker: Video preload failed', error);
    return false;
  }
}

console.log('Service Worker: Script loaded');