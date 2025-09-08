// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { videoApi, Video, scheduleUtils } from '@/lib/supabase';
import { upload, type PutBlobResult } from '@vercel/blob/client';
import { Upload, Play, Trash2, Eye, EyeOff, Calendar, AlertCircle } from 'lucide-react';
import VideoSchedule from '@/components/VideoSchedule';

export default function AdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [schedulingVideo, setSchedulingVideo] = useState<Video | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await videoApi.getAllVideos();
      setVideos(data);
    } catch (error) {
      console.error('Error loading videos:', error);
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

  const handleFileUpload = async (files: FileList | null) => {
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
          const blob: PutBlobResult = await upload(file.name, file, {
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
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  };

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
            <p className="text-xl mb-2">Drop video files here or click to upload</p>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Uploaded Videos ({videos.length})
            </h2>
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
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveVideo(video.id, 'down')}
                            disabled={index === videos.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            ↓
                          </button>
                        </div>
                        
                        {/* Schedule */}
                        <button
                          onClick={() => setSchedulingVideo(video)}
                          className="p-2 text-gray-400 hover:text-blue-600"
                          title="Edit Schedule"
                        >
                          <Calendar className="h-5 w-5" />
                        </button>
                        
                        {/* Active Toggle */}
                        <button
                          onClick={() => toggleVideoActive(video)}
                          className={`p-2 ${video.is_active ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-green-600'}`}
                          title={video.is_active ? 'Active' : 'Inactive'}
                        >
                          {video.is_active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                        </button>
                        
                        {/* Preview */}
                        {video.file_url && (
                          <button
                            onClick={() => window.open(video.file_url, '_blank')}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Preview Video"
                          >
                            <Play className="h-5 w-5" />
                          </button>
                        )}
                        
                        {/* Delete */}
                        <button
                          onClick={() => deleteVideo(video)}
                          className="p-2 text-gray-400 hover:text-red-600"
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

        {/* Schedule Modal */}
        {schedulingVideo && (
          <VideoSchedule
            video={schedulingVideo}
            isOpen={true}
            onClose={() => setSchedulingVideo(null)}
            onSave={handleScheduleUpdate}
          />
        )}
      </div>
    </div>
  );
}