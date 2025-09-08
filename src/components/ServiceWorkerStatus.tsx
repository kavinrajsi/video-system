// src/components/ServiceWorkerStatus.tsx - Component to show SW status
'use client';

import { useState, useEffect } from 'react';
import { serviceWorkerManager, ServiceWorkerStatus } from '@/lib/serviceWorker';
import { Wifi, WifiOff, Download, RefreshCw, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

export default function ServiceWorkerStatusComponent() {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
  });
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Monitor service worker status
    const unsubscribe = serviceWorkerManager.onStatusChange(setStatus);

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    // Load cache status
    loadCacheStatus();

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCacheStatus = async () => {
    const cacheInfo = await serviceWorkerManager.getCacheStatus();
    setCacheStatus(cacheInfo);
  };

  const handleUpdate = async () => {
    await serviceWorkerManager.skipWaiting();
  };

  const handleClearCache = async () => {
    if (confirm('Clear all cached content? This will remove offline video files.')) {
      await serviceWorkerManager.clearAllCaches();
      await loadCacheStatus();
    }
  };

  const handleRefreshCache = async () => {
    await serviceWorkerManager.update();
    await loadCacheStatus();
  };

  if (!status.isSupported) {
    return (
      <div className="flex items-center space-x-2 text-red-600">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">Service Worker not supported</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Online/Offline Status */}
          <div className="flex items-center space-x-1">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm text-gray-600">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Service Worker Status */}
          <div className="flex items-center space-x-1">
            {status.isRegistered ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm text-gray-600">
              SW {status.isRegistered ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Cache Status */}
          {cacheStatus && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                {cacheStatus.totalCaches || 0} caches
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Update Available */}
          {status.isUpdateAvailable && (
            <button
              onClick={handleUpdate}
              className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              <Download className="w-3 h-3" />
              <span>Update</span>
            </button>
          )}

          {/* Controls */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detailed View */}
      {showDetails && (
        <div className="border-t pt-3 space-y-3">
          {/* Service Worker Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Service Worker</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Supported: {status.isSupported ? '✅' : '❌'}</div>
              <div>Registered: {status.isRegistered ? '✅' : '❌'}</div>
              <div>Update Available: {status.isUpdateAvailable ? '🔄' : '✅'}</div>
            </div>
          </div>

          {/* Cache Details */}
          {cacheStatus && cacheStatus.supported && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Cache Storage</h4>
                <div className="flex space-x-1">
                  <button
                    onClick={handleRefreshCache}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Refresh cache status"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleClearCache}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Clear all caches"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                {cacheStatus.caches.map((cache: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span className="truncate">{cache.name}</span>
                    <span>{cache.size} items</span>
                  </div>
                ))}
                {cacheStatus.error && (
                  <div className="text-red-600">Error: {cacheStatus.error}</div>
                )}
              </div>
            </div>
          )}

          {/* Usage Tips */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <strong>💡 Tips:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Videos are cached automatically for offline playback</li>
              <li>• Updates install automatically when available</li>
              <li>• Clear cache if you&apos;re having playback issues</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}