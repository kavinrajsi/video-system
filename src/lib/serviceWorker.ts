// src/lib/serviceWorker.ts - Fixed service worker utilities
export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration?: ServiceWorkerRegistration;
  isDevelopment?: boolean;
}

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private callbacks: Set<(status: ServiceWorkerStatus) => void> = new Set();
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private async init() {
    if (!('serviceWorker' in navigator)) {
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
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered successfully');
      
      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              this.updateAvailable = true;
              console.log('🔄 Service Worker update available');
              this.notifyCallbacks(this.getStatus());
            }
          });
        }
      });

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page when a new service worker takes control
        console.log('🔄 Service Worker updated, reloading...');
        window.location.reload();
      });

      this.notifyCallbacks(this.getStatus());
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

  public onStatusChange(callback: (status: ServiceWorkerStatus) => void) {
    this.callbacks.add(callback);
    // Immediately call with current status
    callback(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public async update() {
    if (this.registration) {
      try {
        await this.registration.update();
        console.log('🔄 Service Worker update check completed');
      } catch (error) {
        console.error('❌ Service worker update failed:', error);
      }
    }
  }

  public async skipWaiting() {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      console.log('⏭️ Service Worker skip waiting triggered');
    }
  }

  public async getCacheStatus() {
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

  public async clearAllCaches() {
    if (!('caches' in window) || this.isDevelopment) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
      console.log('🗑️ All caches cleared');
      return true;
    } catch (error) {
      console.error('Error clearing caches:', error);
      return false;
    }
  }

  public async preloadVideo(url: string) {
    if (!('caches' in window) || this.isDevelopment) {
      console.log('⚠️ Video preloading skipped in development mode');
      return false;
    }

    try {
      const cache = await caches.open('video-files');
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('📹 Video preloaded:', url);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error preloading video:', error);
      return false;
    }
  }
}

// Create singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();