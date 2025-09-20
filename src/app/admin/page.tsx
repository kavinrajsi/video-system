// src/app/admin/page.tsx - Fixed with better error handling and debugging
'use client';

import { useState, useEffect, useCallback } from 'react';
import { videoApi, Video, scheduleUtils } from '@/lib/supabase';
import { upload } from '@vercel/blob/client';
import { Upload, Play, Trash2, Eye, EyeOff, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import VideoSchedule from '@/components/VideoSchedule';
import DatabaseDebug from '@/components/DatabaseDebug';

// Define the blob result type to match what Vercel Blob actually returns
interface BlobResult {
  url: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

export default function AdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [schedulingVideo, setSchedulingVideo] = useState<Video | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoadingVideos(true);
    setLoadError('');
    setDebugInfo('');
    
    try {
      console.log('🔄 Starting to load videos...');
      
      // Add debug information
      const envCheck = videoApi.checkEnvironment();
      console.log('Environment check:', envCheck);
      setDebugInfo(`Environment: ${JSON.stringify(envCheck, null, 2)}`);
      
      // Test the database connection first
      console.log('🔌 Testing database connection...');
      const schemaCheck = await videoApi.checkVideoTableSchema();
      console.log('Schema check result:', schemaCheck);
      
      if (schemaCheck.error) {
        throw new Error(`Database connection failed: ${schemaCheck.error.message} (Code: ${schemaCheck.error.code})`);
      }
      
      if (schemaCheck.testInsertError) {
        throw new Error(`Database schema issue: ${schemaCheck.testInsertError.message} (Code: ${schemaCheck.testInsertError.code})`);
      }
      
      console.log('✅ Database connection successful');
      
      // Now try to load videos
      console.log('📹 Loading videos from database...');
      const data = await videoApi.getAllVideos();
      console.log('Videos loaded successfully:', data);
      
      setVideos(data);
      setLoadError('');
      console.log(`✅ Loaded ${data.length} videos successfully`);
      
    } catch (error) {
      console.error('❌ Error loading videos:', error);
      
      let errorMessage = 'Unknown error occurred';
      let debugDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        debugDetails = `Error: ${error.name}\nMessage: ${error.message}\nStack: ${error.stack}`;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = 'Database connection error';
        debugDetails = `Error object: ${JSON.stringify(error, null, 2)}`;
      } else {
        errorMessage = String(error);
        debugDetails = `Error type: ${typeof error}\nValue: ${error}`;
      }
      
      setLoadError(errorMessage);
      setDebugInfo(debugDetails);
      
      // Set empty array so the UI doesn't break
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  // Helper function to get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => {
        resolve(0); // Default to 0 if we can't get duration
      };
      video.src = URL.createObjectURL(file);
    });
  };

const handleFileUpload = useCallback(async (files: FileList | null) => {
  if (!files || files.length === 0) return;
  
  setUploading(true);
  setUploadError('');
  setUploadProgress('');
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('video/')) {
        setUploadError(`${file.name} is not a video file`);
        continue;
      }

      // Check file size (500MB limit for Vercel Blob client uploads)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        setUploadError(`${file.name} is too large. Maximum size is 500MB`);
        continue;
      }
      
      setUploadProgress(`Uploading ${file.name}... (${i + 1}/${files.length})`);
      
      try {
        setUploadProgress(`Getting video duration for ${file.name}...`);
        
        // Get video duration before upload
        const duration = await getVideoDuration(file);
        console.log(`Duration for ${file.name}:`, duration);
        
        setUploadProgress(`Uploading ${file.name} to Vercel Blob...`);
        
        // Upload directly to Vercel Blob
        const blob: BlobResult = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({
            fileSize: file.size,
            fileType: file.type,
            fileName: file.name,
          }),
        });
        
        console.log(`Blob upload successful for ${file.name}:`, blob);
        setUploadProgress(`Adding ${file.name} to database...`);
        
        // Add video to database with blob URL
        const maxOrder = Math.max(...videos.map(v => v.sequence_order), 0);
        const videoData = {
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
          file_url: blob.url,
          file_name: file.name,
          file_size: file.size,
          duration,
          is_active: true,
          sequence_order: maxOrder + 1,
          schedule_type: 'always' as const,
          schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        
        console.log(`Adding video to database:`, videoData);
        await videoApi.addVideo(videoData);
        
        setUploadProgress(`Successfully uploaded ${file.name}`);
        console.log(`Upload complete for ${file.name}`);
        
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        
        // More detailed error reporting
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
          console.error(`Error details:`, {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        } else if (typeof error === 'object' && error !== null) {
          console.error(`Error object:`, error);
          errorMessage = JSON.stringify(error);
        } else {
          console.error(`Error type:`, typeof error, error);
          errorMessage = String(error);
        }
        
        setUploadError(`Failed to upload ${file.name}: ${errorMessage}`);
      }
    }
    
    // Reload videos after all uploads
    await loadVideos();
    setUploadProgress(`Upload complete! Uploaded ${files.length} video(s)`);
    
  } catch (error) {
    console.error('Upload error:', error);
    setUploadError('Upload failed. Please try again.');
  } finally {
    setUploading(false);
    // Clear messages after 5 seconds
    setTimeout(() => {
      setUploadProgress('');
      setUploadError('');
    }, 5000);
  }
}, [videos]);

// Handle file opening from OS file handlers
useEffect(() => {
  const handleFileOpen = async () => {
    if ('launchQueue' in window) {
      // @ts-expect-error - launchQueue is experimental API
      window.launchQueue.setConsumer(async (launchParams: {
        files?: Array<{ getFile(): Promise<File> }>;
      }) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const fileHandles = launchParams.files;
          console.log('Files opened from OS:', fileHandles);
          
          // Convert file handles to files and upload
          const files = await Promise.all(
            fileHandles.map(async (fileHandle) => {
              return await fileHandle.getFile();
            })
          );
          
          if (files.length > 0) {
            const fileList = new DataTransfer();
            files.forEach(file => fileList.items.add(file));
            handleFileUpload(fileList.files);
          }
        }
      });
    }
  };

  handleFileOpen();
}, [handleFileUpload]);

// Handle share target from OS
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('share') === 'true') {
    // Handle shared content
    const title = urlParams.get('title');
    const description = urlParams.get('description');
    const url = urlParams.get('url');
    
    console.log('Content shared to app:', { title, description, url });
    
    // You can use this data to pre-fill forms or show notification
    if (title) {
      // Pre-fill video title or show notification
      setUploadProgress(`Shared: ${title}`);
    }
  }
  
  if (urlParams.get('upload') === 'true') {
    // App was opened to handle file upload
    setUploadProgress('Ready to upload files...');
  }
}, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const toggleVideoActive = async (video: Video) => {
    try {
      await videoApi.updateVideo(video.id, { is_active: !video.is_active });
      loadVideos();
    } catch (error) {
      console.error('Error toggling video active state:', error);
    }
  };

  const deleteVideo = async (video: Video) => {
    if (!confirm(`Are you sure you want to delete "${video.title}"?`)) return;
    
    try {
      // For Vercel Blob, we don't need to delete the file manually
      // The blob will remain but won't be referenced in our app
      await videoApi.deleteVideo(video.id);
      loadVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const moveVideo = async (videoId: string, direction: 'up' | 'down') => {
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return;
    
    const targetIndex = direction === 'up' ? videoIndex - 1 : videoIndex + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;
    
    try {
      const video = videos[videoIndex];
      const targetVideo = videos[targetIndex];
      
      await videoApi.updateVideo(video.id, { sequence_order: targetVideo.sequence_order });
      await videoApi.updateVideo(targetVideo.id, { sequence_order: video.sequence_order });
      
      loadVideos();
    } catch (error) {
      console.error('Error moving video:', error);
    }
  };

  const handleScheduleUpdate = async (videoId: string, updates: Partial<Video>) => {
    try {
      await videoApi.updateVideo(videoId, updates);
      loadVideos();
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Error updating schedule');
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScheduleStatus = (video: Video) => {
    const isScheduled = scheduleUtils.isVideoScheduledNow(video);
    const description = scheduleUtils.formatScheduleDescription(video);
    
    return {
      isScheduled,
      description,
      icon: isScheduled ? '🟢' : '🔴'
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Management Portal</h1>
          <p className="text-gray-600">Upload and manage videos with scheduling for global display</p>
          <div className="mt-2 text-sm text-blue-600">
            ✓ Using Vercel Blob storage - supports videos up to 500MB
          </div>
        </div>

        {/* Error Display */}
        {loadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-red-800 font-medium">Failed to load videos</h3>
                  <p className="text-red-700 text-sm mt-1">{loadError}</p>
                </div>
              </div>
              <button
                onClick={loadVideos}
                className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
            
            {/* Debug info toggle */}
            {process.env.NODE_ENV === 'development' && debugInfo && (
              <details className="mt-4">
                <summary className="text-red-600 cursor-pointer text-sm">Debug Info</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 whitespace-pre-wrap">
                  {debugInfo}
                </pre>
              </details>
            )}
            
            {/* Interactive Debug Component */}
            <div className="mt-4">
              <DatabaseDebug />
            </div>
            
            <div className="mt-3 text-sm text-red-600">
              <p>Possible solutions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Check your internet connection</li>
                <li>Verify Supabase environment variables</li>
                <li>Visit the <a href="/debug" className="underline">debug page</a> for more details</li>
                <li>Check the browser console for additional errors</li>
              </ul>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingVideos && (
          <div className="mb-6 flex items-center justify-center p-8">
            <div className="flex items-center space-x-3 text-gray-600">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading videos...</span>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-xl mb-2 text-gray-900">Drop video files here or click to upload</p>
            <p className="text-gray-500 mb-2">Supports MP4, WebM, MOV, AVI formats</p>
            <p className="text-sm text-gray-400 mb-4">Maximum file size: 500MB per video</p>
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="video-upload"
              disabled={uploading}
            />
            <label
              htmlFor="video-upload"
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                uploading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {uploading ? 'Uploading...' : 'Select Videos'}
            </label>
            
            {/* Upload Progress */}
            {uploadProgress && (
              <p className="mt-4 text-blue-600 font-medium">{uploadProgress}</p>
            )}
            
            {/* Upload Error */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <p className="text-red-700">{uploadError}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Videos List */}
        {!loadingVideos && !loadError && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Uploaded Videos ({videos.length})
                </h2>
                <button
                  onClick={loadVideos}
                  className="flex items-center space-x-1 px-3 py-1 text-gray-500 hover:text-gray-700"
                  title="Refresh videos"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-sm">Refresh</span>
                </button>
              </div>
            </div>
            
            {videos.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No videos uploaded yet. Upload your first video above.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {videos.map((video, index) => {
                  const scheduleStatus = getScheduleStatus(video);
                  
                  return (
                    <div key={video.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {video.file_url && (
                                <video
                                  src={video.file_url}
                                  className="h-16 w-24 object-cover rounded"
                                  muted
                                  onMouseEnter={(e) => e.currentTarget.play()}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.pause();
                                    e.currentTarget.currentTime = 0;
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-medium text-gray-900 truncate">
                                {video.title}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(video.file_size || 0)} • {formatDuration(video.duration || 0)}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs">{scheduleStatus.icon}</span>
                                <span className="text-xs text-gray-500">{scheduleStatus.description}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* Move Up/Down */}
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveVideo(video.id, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 text-sm font-bold"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveVideo(video.id, 'down')}
                              disabled={index === videos.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 text-sm font-bold"
                            >
                              ↓
                            </button>
                          </div>
                          
                          {/* Schedule */}
                          <button
                            onClick={() => setSchedulingVideo(video)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit Schedule"
                          >
                            <Calendar className="h-5 w-5" />
                          </button>
                          
                          {/* Active Toggle */}
                          <button
                            onClick={() => toggleVideoActive(video)}
                            className={`p-2 transition-colors ${
                              video.is_active 
                                ? 'text-green-600 hover:text-green-700' 
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                            title={video.is_active ? 'Active' : 'Inactive'}
                          >
                            {video.is_active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                          </button>
                          
                          {/* Preview */}
                          {video.file_url && (
                            <button
                              onClick={() => window.open(video.file_url, '_blank')}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Preview Video"
                            >
                              <Play className="h-5 w-5" />
                            </button>
                          )}
                          
                          {/* Delete */}
                          <button
                            onClick={() => deleteVideo(video)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Video"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Schedule Modal */}
        {schedulingVideo && (
          <VideoSchedule
            video={schedulingVideo}
            onUpdate={handleScheduleUpdate}
            onClose={() => setSchedulingVideo(null)}
          />
        )}
      </div>
    </div>
  );
}