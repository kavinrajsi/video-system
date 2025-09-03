'use client';

import { useState, useEffect } from 'react';
import { videoApi, Video, scheduleUtils } from '@/lib/supabase';
import { Upload, Play, Trash2, Eye, EyeOff, Calendar, Clock } from 'lucide-react';
import VideoSchedule from '@/components/VideoSchedule';

export default function AdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [schedulingVideo, setSchedulingVideo] = useState<Video | null>(null);

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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('video/')) {
        alert(`${file.name} is not a video file`);
        continue;
      }
      
      try {
        // Upload file
        const fileUrl = await videoApi.uploadVideo(file);
        
        // Get video duration
        const duration = await getVideoDuration(file);
        
        // Add to database with default schedule
        const maxOrder = Math.max(...videos.map(v => v.sequence_order), 0);
        await videoApi.addVideo({
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          duration: duration,
          sequence_order: maxOrder + 1,
          is_active: true,
          schedule_type: 'always',
          schedule_timezone: 'UTC',
        });
        
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        alert(`Error uploading ${file.name}`);
      }
    }
    
    setUploading(false);
    loadVideos();
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(Math.round(video.duration));
      video.src = URL.createObjectURL(file);
    });
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
      console.error('Error toggling video:', error);
    }
  };

  const deleteVideo = async (video: Video) => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    
    try {
      // Extract filename from URL for local storage
      const fileName = video.file_url.startsWith('/uploads/') 
        ? video.file_url 
        : video.file_name;
      
      await videoApi.deleteVideoFile(fileName);
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
            <p className="text-sm text-gray-400 mb-4">Maximum file size: 100MB per video</p>
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Select Videos
            </label>
            {uploading && (
              <p className="mt-4 text-blue-600">Uploading videos...</p>
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
                  <div key={video.id} className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <Play className="w-6 h-6 text-gray-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {video.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {video.file_size && formatFileSize(video.file_size)} • 
                            {video.duration && ` ${formatDuration(video.duration)} • `}
                            Order: {video.sequence_order}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleVideoActive(video)}
                          className={`p-2 rounded ${
                            video.is_active 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={video.is_active ? 'Active' : 'Inactive'}
                        >
                          {video.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        
                        <button
                          onClick={() => moveVideo(video.id, 'up')}
                          disabled={index === 0}
                          className="p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        
                        <button
                          onClick={() => moveVideo(video.id, 'down')}
                          disabled={index === videos.length - 1}
                          className="p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                          title="Move down"
                        >
                          ↓
                        </button>
                        
                        <button
                          onClick={() => setSchedulingVideo(video)}
                          className="p-2 text-blue-600 hover:bg-blue-50"
                          title="Schedule"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => deleteVideo(video)}
                          className="p-2 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Schedule Information */}
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Schedule:</span>
                          <span className="text-sm text-gray-600">{scheduleStatus.description}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{scheduleStatus.icon}</span>
                          <span className={`text-sm font-medium ${
                            scheduleStatus.isScheduled ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {scheduleStatus.isScheduled ? 'Currently Scheduled' : 'Not Scheduled'}
                          </span>
                        </div>
                      </div>
                      {video.schedule_timezone !== 'UTC' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Timezone: {video.schedule_timezone}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Display App Link */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Display App</h3>
          <p className="text-blue-700 mb-3">
            Share this link with your display devices. Videos will automatically show based on their schedules:
          </p>
          <a 
            href="/display" 
            target="_blank"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-4"
          >
            Open Display App
          </a>
          <a 
            href="/debug" 
            target="_blank"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Debug & Test
          </a>
        </div>

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