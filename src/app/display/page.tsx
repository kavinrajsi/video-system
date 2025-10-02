// src/app/display/page.tsx - Complete fixed version
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { videoApi, Video, scheduleUtils } from '@/lib/supabase';
import { Wifi, WifiOff, Loader, AlertCircle } from 'lucide-react';

// Import types from serviceWorker
import type { ServiceWorkerStatus, ServiceWorkerManager } from '@/lib/serviceWorker';

// Safely import service worker manager
let serviceWorkerManager: ServiceWorkerManager | null = null;

interface DebugInfo {
  totalVideos: number;
  activeVideos: number;
  scheduledVideos: number;
  currentTime: string;
  timezone: string;
  serviceWorkerStatus: ServiceWorkerStatus | null;
}

if (typeof window !== 'undefined') {
  import('@/lib/serviceWorker').then(module => {
    serviceWorkerManager = module.serviceWorkerManager;
  }).catch(error => {
    console.warn('Service worker not available:', error);
  });
}

export default function DisplayPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Set body class for fullscreen styling
  useEffect(() => {
    document.body.classList.add('display-page');
    return () => {
      document.body.classList.remove('display-page');
    };
  }, []);

  // Initialize service worker monitoring
  useEffect(() => {
    const initServiceWorker = async () => {
      if (serviceWorkerManager) {
        const unsubscribe = serviceWorkerManager.onStatusChange((status: ServiceWorkerStatus) => {
          setSwStatus(status);
          console.log('Service Worker status:', status);
        });

        return unsubscribe;
      }
    };

    initServiceWorker();
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      setError(null);
      console.log('Loading active videos...');
      
      // Get all videos first for debugging
      const allVideos = await videoApi.getAllVideos();
      console.log('All videos from database:', allVideos);
      
      // Filter for currently scheduled videos
      const scheduledVideos = allVideos.filter(video => 
        video.is_active && scheduleUtils.isVideoScheduledNow(video)
      );
      
      console.log('Scheduled videos:', scheduledVideos);
      
      setDebugInfo({
        totalVideos: allVideos.length,
        activeVideos: allVideos.filter(v => v.is_active).length,
        scheduledVideos: scheduledVideos.length,
        currentTime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        serviceWorkerStatus: swStatus
      });
      
      if (scheduledVideos.length === 0) {
        if (allVideos.length === 0) {
          setError('No videos found. Please upload some videos in the admin panel.');
        } else if (allVideos.filter(v => v.is_active).length === 0) {
          setError('No active videos found. Please activate some videos in the admin panel.');
        } else {
          setError('No videos are currently scheduled to play. Check the video schedules in the admin panel.');
        }
        setLoading(false);
        return;
      }
      
      // Sort by sequence order
      scheduledVideos.sort((a, b) => a.sequence_order - b.sequence_order);
      
      setVideos(scheduledVideos);
      setCurrentVideoIndex(0);
      setLoading(false);
    } catch (err) {
      console.error('Error loading videos:', err);
      setError('Failed to load videos. Check your internet connection.');
      setLoading(false);
    }
  }, [swStatus]);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
    
    // Set up real-time subscription
    const subscription = videoApi.subscribeToVideos(() => {
      console.log('Video update received');
      loadVideos(); // Reload videos when changes occur
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadVideos]);

  // Preload videos for offline viewing when videos are loaded
  useEffect(() => {
    const preloadVideos = async () => {
      if (videos.length === 0 || !serviceWorkerManager) return;
      
      try {
        console.log('Preloading videos for offline viewing...');
        
        let preloadedCount = 0;
        for (const video of videos) {
          try {
            const success = await serviceWorkerManager.preloadVideo(video.file_url);
            if (success) preloadedCount++;
          } catch (error) {
            console.warn('Failed to preload video:', video.title, error);
          }
        }
        
        console.log(`Video preloading completed: ${preloadedCount}/${videos.length} videos cached`);
      } catch (error) {
        console.error('Error preloading videos:', error);
        // Don't break the app if preloading fails
      }
    };

    // Only preload if we have videos and service worker is available
    if (videos.length > 0) {
      // Delay preloading to let the page load first
      setTimeout(preloadVideos, 2000);
    }
  }, [videos]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-play next video when current one ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videos.length === 0) return;

    const handleVideoEnd = () => {
      console.log('Video ended, moving to next');
      // Move to next video or loop back to first
      const nextIndex = (currentVideoIndex + 1) % videos.length;
      setCurrentVideoIndex(nextIndex);
      setVideoError(false);
      setVideoLoadError(null);
    };

    const handleVideoError = (e: Event) => {
      const videoElement = e.target as HTMLVideoElement;
      const error = videoElement.error;
      
      console.error('Video playback error:', {
        code: error?.code,
        message: error?.message,
        src: videoElement.src,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState
      });
      
      let errorMessage = 'Unknown video error';
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = 'Video decoding error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported';
            break;
        }
      }
      
      setVideoError(true);
      setVideoLoadError(errorMessage);
      
      // Auto-skip to next video after 5 seconds on error
      setTimeout(() => {
        const nextIndex = (currentVideoIndex + 1) % videos.length;
        setCurrentVideoIndex(nextIndex);
        setVideoError(false);
        setVideoLoadError(null);
      }, 5000);
    };

    const handleCanPlay = () => {
      console.log('Video can play, attempting to start playback');
      setVideoError(false);
      setVideoLoadError(null);
      video.play().catch((playError) => {
        console.error('Error playing video:', playError);
        setVideoLoadError(`Playback error: ${playError.message}`);
      });
    };

    const handleLoadStart = () => {
      console.log('Video load started for:', video.src);
    };

    const handleLoadedData = () => {
      console.log('Video data loaded successfully');
      setVideoLoadError(null);
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('error', handleVideoError);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('error', handleVideoError);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [currentVideoIndex, videos.length]);

  // Auto-play when video changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && videos.length > 0 && videos[currentVideoIndex]) {
      console.log('Loading new video:', videos[currentVideoIndex]);
      setVideoLoadError(null);
      video.load(); // Reload the video element
    }
  }, [currentVideoIndex, videos]);

  // Manual retry function
  const retryVideo = () => {
    setVideoError(false);
    setVideoLoadError(null);
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };

  // Skip to next video manually
  const skipToNext = () => {
    const nextIndex = (currentVideoIndex + 1) % videos.length;
    setCurrentVideoIndex(nextIndex);
    setVideoError(false);
    setVideoLoadError(null);
  };

  const currentVideo = videos[currentVideoIndex];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader className="w-12 h-12 animate-spin mb-4 mx-auto" />
          <p className="text-xl">Loading videos...</p>
          {swStatus && (
            <p className="text-sm text-gray-400 mt-2">
              SW: {swStatus.isRegistered ? 'Active' : 'Inactive'} | 
              Mode: {swStatus.isDevelopment ? 'Dev' : 'Prod'}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-2xl px-8">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4 mx-auto" />
          <h1 className="text-2xl font-bold mb-4">No Videos to Display</h1>
          <p className="text-lg mb-6">{error}</p>
          <div className="space-y-4">
            <button
              onClick={loadVideos}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
            >
              Retry
            </button>
            <div className="text-sm text-gray-400">
              <a href="/admin" className="text-blue-400 hover:text-blue-300">
                Go to Admin Panel
              </a>
              {' | '}
              <a href="/debug" className="text-blue-400 hover:text-blue-300">
                Debug Panel
              </a>
            </div>
          </div>
          
          {/* Debug information */}
          {debugInfo && process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-800 rounded-lg text-left text-sm">
              <h3 className="font-bold mb-2">Debug Info:</h3>
              <pre className="text-xs">{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="w-16 h-16 text-yellow-500 mb-4 mx-auto" />
          <p className="text-xl">No video selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Connection status indicator */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="w-6 h-6 text-green-500" />
          ) : (
            <WifiOff className="w-6 h-6 text-red-500" />
          )}
          
          {/* Service Worker status indicator */}
          {swStatus && (
            <div className={`w-3 h-3 rounded-full ${
              swStatus.isRegistered ? 'bg-green-500' : 
              swStatus.isDevelopment ? 'bg-yellow-500' : 'bg-red-500'
            }`} title={`Service Worker: ${swStatus.isRegistered ? 'Active' : 'Inactive'}`} />
          )}
        </div>
      </div>

      {/* Video progress indicator */}
      {videos.length > 1 && (
        <div className="absolute top-4 right-4 z-10">
          <div className="text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
            {currentVideoIndex + 1} / {videos.length}
          </div>
        </div>
      )}

      {/* Main video container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {videoError || videoLoadError ? (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">Video Error</h2>
            <p className="mb-4">{videoLoadError || 'Video playback error'}</p>
            <p className="text-sm text-gray-300 mb-6">
              {videos.length > 1 ? 'Skipping to next video...' : 'Will retry automatically...'}
            </p>
            <div className="space-x-4">
              <button
                onClick={retryVideo}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Retry
              </button>
              {videos.length > 1 && (
                <button
                  onClick={skipToNext}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Skip
                </button>
              )}
            </div>

            {/* Video details for debugging */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-3 bg-gray-800 rounded text-xs text-left">
                <p><strong>Video:</strong> {currentVideo.title}</p>
                <p><strong>URL:</strong> {currentVideo.file_url}</p>
                <p><strong>Size:</strong> {currentVideo.file_size ? (currentVideo.file_size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}</p>
                <p><strong>SW Status:</strong> {swStatus?.isRegistered ? 'Registered' : 'Not Registered'}</p>
              </div>
            )}
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain rotate-180"
            autoPlay
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          >
            <source src={currentVideo.file_url} type="video/mp4" />
            <source src={currentVideo.file_url} type="video/webm" />
            <source src={currentVideo.file_url} type="video/quicktime" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* Video title overlay */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="text-white text-lg bg-black bg-opacity-50 px-4 py-2 rounded">
          {currentVideo.title}
        </div>
      </div>

      {/* Next video indicator */}
      {videos.length > 1 && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
            Next: {videos[(currentVideoIndex + 1) % videos.length]?.title}
          </div>
        </div>
      )}

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-16 left-4 z-10 text-white text-xs bg-black bg-opacity-75 p-3 rounded max-w-md">
          <div><strong>Current:</strong> {currentVideoIndex + 1}/{videos.length}</div>
          <div><strong>Video:</strong> {currentVideo.title}</div>
          <div><strong>File:</strong> {currentVideo.file_name}</div>
          <div><strong>URL Type:</strong> {currentVideo.file_url.includes('blob.vercel-storage.com') ? 'Vercel Blob' : 'Local/Other'}</div>
          <div><strong>Size:</strong> {currentVideo.file_size ? `${(currentVideo.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}</div>
          <div><strong>Duration:</strong> {currentVideo.duration ? `${Math.floor(currentVideo.duration / 60)}:${(currentVideo.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}</div>
          <div><strong>Schedule:</strong> {currentVideo.schedule_type}</div>
          <div><strong>SW:</strong> {swStatus?.isRegistered ? '✅ Active' : swStatus?.isDevelopment ? '🔧 Dev Mode' : '❌ Inactive'}</div>
          {videoRef.current && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div><strong>Video State:</strong></div>
              <div>Network: {videoRef.current.networkState}</div>
              <div>Ready: {videoRef.current.readyState}</div>
              <div>Current Time: {videoRef.current.currentTime?.toFixed(1)}s</div>
              <div>Duration: {videoRef.current.duration?.toFixed(1)}s</div>
            </div>
          )}
        </div>
      )}

      {/* Manual controls (only visible on hover in development) */}
      {process.env.NODE_ENV === 'development' && videos.length > 1 && (
        <div className="absolute bottom-16 right-4 z-10 opacity-0 hover:opacity-100 transition-opacity">
          <div className="space-x-2">
            <button
              onClick={() => setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1))}
              disabled={currentVideoIndex === 0}
              className="bg-black bg-opacity-50 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={skipToNext}
              className="bg-black bg-opacity-50 text-white px-3 py-1 rounded"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}