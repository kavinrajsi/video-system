'use client';

import { useState, useEffect, useRef } from 'react';
import { videoApi, Video } from '@/lib/supabase';
import { Wifi, WifiOff, Loader } from 'lucide-react';

export default function DisplayPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Set body class for fullscreen styling
  useEffect(() => {
    document.body.classList.add('display-page');
    return () => {
      document.body.classList.remove('display-page');
    };
  }, []);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
    
    // Set up real-time subscription
    const subscription = videoApi.subscribeToVideos((payload) => {
      console.log('Video update received:', payload);
      loadVideos(); // Reload videos when changes occur
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      // Move to next video or loop back to first
      const nextIndex = (currentVideoIndex + 1) % videos.length;
      setCurrentVideoIndex(nextIndex);
      setVideoError(false);
    };

    const handleVideoError = () => {
      console.error('Video playback error');
      setVideoError(true);
      
      // Auto-skip to next video after 3 seconds on error
      setTimeout(() => {
        const nextIndex = (currentVideoIndex + 1) % videos.length;
        setCurrentVideoIndex(nextIndex);
        setVideoError(false);
      }, 3000);
    };

    const handleCanPlay = () => {
      video.play().catch(console.error);
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('error', handleVideoError);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('error', handleVideoError);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [currentVideoIndex, videos.length]);

  // Auto-play when video changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && videos.length > 0) {
      video.load(); // Reload the video element
    }
  }, [currentVideoIndex, videos]);

  const loadVideos = async () => {
    try {
      setError(null);
      const data = await videoApi.getActiveVideos();
      
      if (data.length === 0) {
        setError('No active videos found. Please add some videos in the admin panel.');
        setLoading(false);
        return;
      }
      
      setVideos(data);
      setCurrentVideoIndex(0);
      setLoading(false);
    } catch (err) {
      console.error('Error loading videos:', err);
      setError('Failed to load videos. Check your internet connection.');
      setLoading(false);
    }
  };

  const currentVideo = videos[currentVideoIndex];

  // Loading screen
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-xl">Loading videos...</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">📺</div>
          <h1 className="text-2xl mb-4">Display Not Ready</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={loadVideos}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No videos available
  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl mb-4">No Scheduled Videos</h1>
          <p className="text-gray-300 mb-2">No videos are scheduled to play right now.</p>
          <p className="text-gray-300">Check back later or update schedules in admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Connection Status Indicator */}
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        {isOnline ? (
          <div className="flex items-center space-x-1 text-green-400 text-sm">
            <Wifi className="w-4 h-4" />
            <span>Online</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-red-400 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </div>
        )}
      </div>

      {/* Video Info (top-left) */}
      <div className="absolute top-4 left-4 z-10 text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
        <div>Playing: {currentVideo?.title}</div>
        <div className="text-gray-300">
          {currentVideoIndex + 1} of {videos.length}
        </div>
      </div>

      {/* Video Player */}
      <div className="w-full h-full flex items-center justify-center rotate-180">
        {videoError ? (
          <div className="text-center text-white">
            <div className="text-4xl mb-4">⚠️</div>
            <p>Video playback error</p>
            <p className="text-sm text-gray-300">Skipping to next video...</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            preload="auto"
          >
            <source src={currentVideo?.file_url} type="video/mp4" />
            <source src={currentVideo?.file_url} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* Loading indicator for next video */}
      {videos.length > 1 && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
            Next: {videos[(currentVideoIndex + 1) % videos.length]?.title}
          </div>
        </div>
      )}

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 z-10 text-white text-xs bg-black bg-opacity-50 p-2 rounded">
          <div>Current Index: {currentVideoIndex}</div>
          <div>Total Videos: {videos.length}</div>
          <div>Video URL: {currentVideo?.file_url.substring(0, 50)}...</div>
        </div>
      )}
    </div>
  );
}