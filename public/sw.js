// public/sw.js - Fixed service worker for PWA
const CACHE_NAME = 'video-display-v1';
const VIDEO_CACHE = 'video-files-v1';
const API_CACHE = 'api-cache-v1';

// Minimal static assets - only cache what we know exists
const STATIC_ASSETS = [
  '/manifest.json',
];

// Install event - cache static assets with error handling
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      // Cache each asset individually to avoid failing all if one fails
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => {
          return cache.add(url).catch((error) => {
            console.warn(`Failed to cache ${url}:`, error);
          });
        })
      );
    }).then(() => {
      console.log('Service Worker installed successfully');
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Service Worker installation failed:', error);
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
          // Delete old caches but keep current ones
          if (cacheName !== CACHE_NAME && 
              cacheName !== VIDEO_CACHE && 
              cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated successfully');
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

  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Skip Supabase realtime WebSocket connections
  if (url.pathname.includes('/realtime/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // Skip authentication and API requests that need fresh data
  if (url.pathname.includes('/auth/') || 
      url.pathname.includes('/api/upload') ||
      url.pathname.includes('/api/delete')) {
    return;
  }

  // Handle video files from Vercel Blob - Cache First strategy
  if (url.hostname.includes('vercel-storage.com') || 
      url.hostname.includes('blob.vercel-storage.com') ||
      request.destination === 'video') {
    event.respondWith(
      caches.open(VIDEO_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('✅ Serving video from cache:', url.pathname);
            return cachedResponse;
          }

          console.log('📥 Fetching video from network:', url.pathname);
          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response && response.status === 200) {
              // Clone the response before caching
              const responseClone = response.clone();
              cache.put(request, responseClone).catch((error) => {
                console.warn('Failed to cache video:', error);
              });
            }
            return response;
          }).catch((error) => {
            console.error('Failed to fetch video:', error);
            // Return cached version if network fails
            return cachedResponse || new Response('Video unavailable offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        });
      })
    );
    return;
  }

  // Handle API requests - Network First strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        // Cache successful API responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn('Failed to cache API response:', error);
            });
          });
        }
        return response;
      }).catch(() => {
        // Fallback to cache if network fails
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
    return;
  }

  // Handle Next.js data requests
  if (url.pathname.includes('/_next/data/') || 
      url.pathname.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch((error) => {
                console.warn('Failed to cache Next.js asset:', error);
              });
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Handle all other requests (pages, static assets) - Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        console.log('✅ Serving from cache:', url.pathname);
        // Update cache in background
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response).catch((error) => {
                console.warn('Failed to update cache:', error);
              });
            });
          }
        }).catch(() => {
          // Ignore background update errors
        });
        return cachedResponse;
      }

      // Fetch from network if not in cache
      console.log('📥 Fetching from network:', url.pathname);
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn('Failed to cache response:', error);
            });
          });
        }
        return response;
      }).catch((error) => {
        console.error('Fetch failed:', error);
        // Return a basic offline page
        return new Response(
          `<!DOCTYPE html>
          <html>
            <head>
              <title>Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: #000;
                  color: #fff;
                  text-align: center;
                }
                h1 { font-size: 2em; margin-bottom: 0.5em; }
                p { font-size: 1.2em; color: #999; }
              </style>
            </head>
            <body>
              <div>
                <h1>📴 You're Offline</h1>
                <p>Please check your internet connection</p>
                <button onclick="location.reload()" 
                        style="margin-top: 20px; padding: 10px 20px; font-size: 1em; 
                               background: #0070f3; color: white; border: none; 
                               border-radius: 5px; cursor: pointer;">
                  Retry
                </button>
              </div>
            </body>
          </html>`,
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html' }
          }
        );
      });
    })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_VIDEO') {
    const videoUrl = event.data.url;
    console.log('Caching video on request:', videoUrl);
    
    event.waitUntil(
      caches.open(VIDEO_CACHE).then((cache) => {
        return fetch(videoUrl).then((response) => {
          if (response && response.status === 200) {
            return cache.put(videoUrl, response).then(() => {
              console.log('✅ Video cached successfully:', videoUrl);
            });
          }
        }).catch((error) => {
          console.error('Failed to cache video:', error);
        });
      })
    );
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Clearing all caches');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('✅ All caches cleared');
      })
    );
  }
});

console.log('Service Worker loaded successfully');