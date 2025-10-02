// src/lib/serviceWorker.ts - Simplified for manual SW
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
      this.isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
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
        updateViaCache: 'none', // Always check for updates
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

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker updated and took control - reloading page...');
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
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

  public onStatusChange(callback: (status: ServiceWorkerStatus) => void): () => void {
    this.callbacks.add(callback);
    callback(this.getStatus());
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public async update(): Promise<void> {
    if (this.registration) {
      try {
        console.log('🔄 Checking for Service Worker updates...');
        await this.registration.update();
        console.log('✅ Service Worker update check completed');
      } catch (error) {
        console.error('❌ Service worker update failed:', error);
      }
    }
  }

  public async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      console.log('⏭️ Triggering skip waiting on new Service Worker');
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  public async getCacheStatus(): Promise<CacheStatus> {
    if (!('caches' in window)) {
      return { supported: false, caches: [] };
    }

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
            urls: keys.map(req => req.url).slice(0, 5),
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

  public async clearAllCaches(): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('✅ All caches cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      return false;
    }
  }

  public async preloadVideo(url: string): Promise<boolean> {
    if (!('caches' in window) || this.isDevelopment) {
      console.log('⚠️ Video preloading skipped in development mode');
      return false;
    }

    try {
      console.log('📹 Preloading video:', url);
      
      // Send message to service worker to cache the video
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_VIDEO',
          url: url,
        });
        return true;
      }
      
      // Fallback: cache directly
      const cache = await caches.open('video-files-v1');
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        console.log('✅ Video already cached');
        return true;
      }
      
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      
      if (response.ok) {
        await cache.put(url, response);
        console.log('✅ Video preloaded successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error preloading video:', error);
      return false;
    }
  }

  public async unregister(): Promise<boolean> {
    if (this.registration) {
      try {
        const success = await this.registration.unregister();
        if (success) {
          this.registration = null;
          this.notifyCallbacks(this.getStatus());
        }
        return success;
      } catch (error) {
        console.error('Error unregistering:', error);
        return false;
      }
    }
    return false;
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();