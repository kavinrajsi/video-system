// src/lib/serviceWorker.ts - Complete service worker utilities (Fixed)
export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration?: ServiceWorkerRegistration;
  isDevelopment?: boolean;
}

interface CacheInfo {
  name: string;
  size: number;
  urls: string[];
}

export interface CacheStatus {
  supported: boolean;
  caches: CacheInfo[];
  totalCaches?: number;
  error?: string;
  developmentMode?: boolean;
  message?: string;
}

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private callbacks: Set<(status: ServiceWorkerStatus) => void> = new Set();
  private isDevelopment = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Check if we're in development based on hostname
      this.isDevelopment = window.location.hostname === 'localhost';
      this.init();
    }
  }

  private async init() {
    if (!('serviceWorker' in navigator)) {
      console.log('❌ Service Worker not supported in this browser');
      this.notifyCallbacks({
        isSupported: false,
        isRegistered: false,
        isUpdateAvailable: false,
        isDevelopment: this.isDevelopment,
      });
      return;
    }

    // In development, service worker is disabled by default
    if (this.isDevelopment) {
      console.log('🔧 Service Worker disabled in development mode');
      this.notifyCallbacks({
        isSupported: true,
        isRegistered: false,
        isUpdateAvailable: false,
        isDevelopment: this.isDevelopment,
      });
      return;
    }

    try {
      // Register the service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('✅ Service Worker registered successfully');
      console.log('Service Worker scope:', this.registration.scope);
      
      // Check if there's an update immediately
      await this.registration.update();
      
      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        console.log('🔄 Service Worker update found');
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('Service Worker state changed to:', newWorker.state);
            
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              this.updateAvailable = true;
              console.log('🔄 Service Worker update available - ready to install');
              this.notifyCallbacks(this.getStatus());
            }
            
            if (newWorker.state === 'activated') {
              console.log('✅ Service Worker activated');
              this.notifyCallbacks(this.getStatus());
            }
          });
        }
      });

      // Listen for controller changes (when a new service worker takes control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page when a new service worker takes control
        console.log('🔄 Service Worker updated and took control - reloading page...');
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
        
        if (event.data.type === 'CACHE_UPDATED') {
          console.log('Cache updated:', event.data.url);
        }
      });

      // Notify initial status
      this.notifyCallbacks(this.getStatus());
      
      // Log current service worker state
      if (this.registration.active) {
        console.log('Active Service Worker state:', this.registration.active.state);
      }
      if (this.registration.waiting) {
        console.log('Waiting Service Worker detected');
        this.updateAvailable = true;
        this.notifyCallbacks(this.getStatus());
      }
      if (this.registration.installing) {
        console.log('Installing Service Worker detected');
      }
      
    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
      this.notifyCallbacks({
        isSupported: true,
        isRegistered: false,
        isUpdateAvailable: false,
        isDevelopment: this.isDevelopment,
      });
    }
  }

  private getStatus(): ServiceWorkerStatus {
    return {
      isSupported: 'serviceWorker' in navigator,
      isRegistered: !!this.registration,
      isUpdateAvailable: this.updateAvailable,
      registration: this.registration || undefined,
      isDevelopment: this.isDevelopment,
    };
  }

  private notifyCallbacks(status: ServiceWorkerStatus) {
    this.callbacks.forEach(callback => callback(status));
  }

  /**
   * Subscribe to service worker status changes
   * @param callback Function to call when status changes
   * @returns Unsubscribe function
   */
  public onStatusChange(callback: (status: ServiceWorkerStatus) => void): () => void {
    this.callbacks.add(callback);
    // Immediately call with current status
    callback(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Check for service worker updates
   */
  public async update(): Promise<void> {
    if (this.registration) {
      try {
        console.log('🔄 Checking for Service Worker updates...');
        await this.registration.update();
        console.log('✅ Service Worker update check completed');
      } catch (error) {
        console.error('❌ Service worker update failed:', error);
      }
    } else {
      console.warn('⚠️ No service worker registration found');
    }
  }

  /**
   * Skip waiting and activate the new service worker immediately
   */
  public async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      console.log('⏭️ Triggering skip waiting on new Service Worker');
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // The page will reload automatically when the new SW takes control
    } else {
      console.warn('⚠️ No waiting service worker found');
    }
  }

  /**
   * Get current cache status
   */
  public async getCacheStatus(): Promise<CacheStatus> {
    if (!('caches' in window)) {
      return { supported: false, caches: [] };
    }

    // In development mode, caches might not be available
    if (this.isDevelopment) {
      return { 
        supported: true, 
        caches: [], 
        developmentMode: true,
        message: 'Caches disabled in development mode'
      };
    }

    try {
      const cacheNames = await caches.keys();
      console.log('Available caches:', cacheNames);
      
      const cacheStatus = await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          return {
            name,
            size: keys.length,
            urls: keys.map(req => req.url).slice(0, 5), // Show first 5 URLs
          };
        })
      );

      return {
        supported: true,
        caches: cacheStatus,
        totalCaches: cacheNames.length,
      };
    } catch (error) {
      console.error('Error getting cache status:', error);
      return { 
        supported: true, 
        caches: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      console.warn('⚠️ Cannot clear caches in development mode');
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      console.log(`🗑️ Clearing ${cacheNames.length} caches...`);
      
      await Promise.all(
        cacheNames.map(name => {
          console.log(`Deleting cache: ${name}`);
          return caches.delete(name);
        })
      );
      
      console.log('✅ All caches cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      return false;
    }
  }

  /**
   * Preload a video for offline viewing
   * @param url URL of the video to preload
   */
  public async preloadVideo(url: string): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      console.log('⚠️ Video preloading skipped in development mode');
      return false;
    }

    try {
      console.log('📹 Preloading video:', url);
      
      const cache = await caches.open('video-files-v1');
      
      // Check if already cached
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        console.log('✅ Video already cached:', url);
        return true;
      }
      
      // Fetch and cache the video
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
      });
      
      if (response.ok) {
        await cache.put(url, response);
        console.log('✅ Video preloaded successfully:', url);
        return true;
      } else {
        console.error('❌ Failed to fetch video:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error preloading video:', error);
      return false;
    }
  }

  /**
   * Check if a video is cached
   * @param url URL of the video to check
   */
  public async isVideoCached(url: string): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      return false;
    }

    try {
      const cache = await caches.open('video-files-v1');
      const cachedResponse = await cache.match(url);
      return !!cachedResponse;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Get the size of all caches in bytes
   */
  public async getCacheSize(): Promise<number> {
    if (!('caches' in window) || this.isDevelopment) {
      return 0;
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  /**
   * Clear a specific cache by name
   * @param cacheName Name of the cache to clear
   */
  public async clearCache(cacheName: string): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      return false;
    }

    try {
      console.log(`🗑️ Clearing cache: ${cacheName}`);
      const deleted = await caches.delete(cacheName);
      
      if (deleted) {
        console.log(`✅ Cache cleared: ${cacheName}`);
      } else {
        console.log(`⚠️ Cache not found: ${cacheName}`);
      }
      
      return deleted;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get detailed information about all caches
   */
  public async getDetailedCacheInfo(): Promise<{
    cacheName: string;
    entries: Array<{ url: string; size: number; type: string }>;
    totalSize: number;
  }[]> {
    if (!('caches' in window) || this.isDevelopment) {
      return [];
    }

    try {
      const cacheNames = await caches.keys();
      const detailedInfo = await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          
          const entries = await Promise.all(
            keys.map(async (request) => {
              const response = await cache.match(request);
              if (response) {
                const blob = await response.blob();
                return {
                  url: request.url,
                  size: blob.size,
                  type: blob.type,
                };
              }
              return { url: request.url, size: 0, type: 'unknown' };
            })
          );

          const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

          return {
            cacheName,
            entries,
            totalSize,
          };
        })
      );

      return detailedInfo;
    } catch (error) {
      console.error('Error getting detailed cache info:', error);
      return [];
    }
  }

  /**
   * Unregister the service worker
   */
  public async unregister(): Promise<boolean> {
    if (this.registration) {
      try {
        console.log('🗑️ Unregistering Service Worker...');
        const success = await this.registration.unregister();
        
        if (success) {
          console.log('✅ Service Worker unregistered successfully');
          this.registration = null;
          this.notifyCallbacks(this.getStatus());
        } else {
          console.warn('⚠️ Failed to unregister Service Worker');
        }
        
        return success;
      } catch (error) {
        console.error('❌ Error unregistering Service Worker:', error);
        return false;
      }
    }
    
    console.warn('⚠️ No service worker registration to unregister');
    return false;
  }
}

// Create singleton instance and export it
export const serviceWorkerManager = new ServiceWorkerManager();