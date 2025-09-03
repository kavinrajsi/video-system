'use client';

import { useState, useEffect } from 'react';
import { supabase, videoApi, Video, scheduleUtils } from '@/lib/supabase';

export default function DebugPage() {
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [activeVideos, setActiveVideos] = useState<Video[]>([]);
  const [scheduledVideos, setScheduledVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<string>('Testing...');
  const [uploadTest, setUploadTest] = useState<string>('');
  const [fileSystemCheck, setFileSystemCheck] = useState<string>('Checking...');
  const [videoFileStatus, setVideoFileStatus] = useState<any[]>([]);

  useEffect(() => {
    testConnection();
    testFileSystem();
    loadData();
  }, []);

  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('count')
        .single();
      
      if (error) {
        setConnectionTest(`Connection Error: ${error.message}`);
      } else {
        setConnectionTest('✅ Connected to Supabase Database');
      }
    } catch (err) {
      setConnectionTest(`Connection Failed: ${err}`);
    }
  };

  const testFileSystem = async () => {
    try {
      const response = await fetch('/uploads/.gitkeep');
      if (response.ok || response.status === 404) {
        setFileSystemCheck('✅ Local uploads directory accessible');
      } else {
        setFileSystemCheck('❌ Local uploads directory not accessible');
      }
    } catch (err) {
      setFileSystemCheck('❌ Error checking file system access');
    }
  };

  const testUpload = async () => {
    setUploadTest('Testing upload API...');
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: new FormData()
      });
      
      const result = await response.text();
      if (response.status === 400 && result.includes('No file uploaded')) {
        setUploadTest('✅ Upload API endpoint working (expected "No file" error)');
      } else {
        setUploadTest(`❌ Upload API error: ${result}`);
      }
    } catch (err) {
      setUploadTest(`❌ Upload API failed: ${err}`);
    }
  };

  const loadData = async () => {
    try {
      const { data: allData, error: allError } = await supabase
        .from('videos')
        .select('*')
        .order('sequence_order');

      const { data: activeData, error: activeError } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .order('sequence_order');

      if (allError) {
        setError(`Error loading all videos: ${allError.message}`);
      } else {
        setAllVideos(allData || []);
      }

      if (activeError) {
        setError(`Error loading active videos: ${activeError.message}`);
      } else {
        setActiveVideos(activeData || []);
      }

      try {
        const scheduledData = await videoApi.getScheduledVideos();
        setScheduledVideos(scheduledData);
      } catch (scheduleError) {
        console.error('Error loading scheduled videos:', scheduleError);
        setScheduledVideos([]);
      }

    } catch (err) {
      setError(`Error: ${err}`);
    }
  };

  const toggleVideoActive = async (videoId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update({ is_active: !currentStatus })
        .eq('id', videoId);

      if (error) {
        alert(`Error updating video: ${error.message}`);
      } else {
        loadData();
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  const checkVideoFile = async (fileUrl: string) => {
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const checkAllFiles = async () => {
    const results = await Promise.all(
      allVideos.map(async (video) => ({
        ...video,
        fileExists: await checkVideoFile(video.file_url)
      }))
    );
    setVideoFileStatus(results);
  };

  const clearAllVideos = async () => {
    if (!confirm('Delete ALL videos from database? This cannot be undone!')) return;
    
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadData();
        alert('All videos deleted from database');
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl text-gray-800 font-bold mb-6">🔧 Debug Video System with Scheduling</h1>
        
        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600 mb-3">Database Connection</h3>
            <p className={`text-sm ${connectionTest.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {connectionTest}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600 mb-3">File System</h3>
            <p className={`text-sm ${fileSystemCheck.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {fileSystemCheck}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600 mb-3">Upload API</h3>
            <button 
              onClick={testUpload}
              className="mb-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Test Upload API
            </button>
            <p className={`text-sm ${uploadTest.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {uploadTest}
            </p>
          </div>
        </div>

        {/* Environment Check */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-600 mb-3">Environment Variables</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-400">Supabase URL:</p>
              <p className={process.env.NEXT_PUBLIC_SUPABASE_URL ? 'text-green-600' : 'text-red-600'}>
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-400">Supabase Key:</p>
              <p className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'text-green-600' : 'text-red-600'}>
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-red-800">Error:</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-600 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Refresh Data
            </button>
            <button
              onClick={checkAllFiles}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              📁 Check All Files
            </button>
            <button
              onClick={clearAllVideos}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              🗑️ Clear All Videos
            </button>
            <a
              href="/admin"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              👨‍💼 Go to Admin
            </a>
            <a
              href="/display"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              📺 Go to Display
            </a>
          </div>
        </div>

        {/* Currently Scheduled Videos */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-600 mb-3">
            Currently Scheduled Videos ({scheduledVideos.length})
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Current time: {new Date().toLocaleString()} • These videos will play on the display right now
          </p>
          
          {scheduledVideos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-red-500 text-lg mb-4">⚠️ No videos are scheduled to play right now!</p>
              <p className="text-gray-600 mb-4">
                This is why the display shows "No scheduled videos". Videos may be:
              </p>
              <ul className="text-left text-gray-600 text-sm space-y-1 max-w-md mx-auto">
                <li>• Scheduled for different times of day</li>
                <li>• Set to play only on specific dates</li>
                <li>• Configured for certain weekdays only</li>
                <li>• Inactive (check admin panel)</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-green-600 font-medium">✅ Videos currently scheduled to play:</p>
              {scheduledVideos.map((video, index) => (
                <div key={video.id} className="flex items-center space-x-3 p-3 border border-green-200 bg-green-50 rounded">
                  <span className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{video.title}</p>
                    <p className="text-sm text-gray-600">
                      Schedule: {scheduleUtils.formatScheduleDescription(video)}
                      {video.schedule_timezone !== 'UTC' && ` • ${video.schedule_timezone}`}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600">({video.duration || '?'}s)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Videos with Schedule Status */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-600 mb-3">All Videos ({allVideos.length})</h2>
          {allVideos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No videos found in database</p>
              <a 
                href="/admin" 
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Your First Video
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {allVideos.map((video, index) => {
                const fileCheck = videoFileStatus.find(v => v.id === video.id);
                const isCurrentlyScheduled = scheduleUtils.isVideoScheduledNow(video);
                
                return (
                  <div key={video.id} className={`border rounded-lg p-4 ${isCurrentlyScheduled ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <p className="font-medium text-gray-600 text-lg">{video.title}</p>
                          {isCurrentlyScheduled && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              PLAYING NOW
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <p><span className="font-medium">Status:</span> 
                              <span className={video.is_active ? 'text-green-600 ml-1' : 'text-gray-400 ml-1'}>
                                {video.is_active ? '✅ Active' : '❌ Inactive'}
                              </span>
                            </p>
                            <p><span className="font-medium">Order:</span> {video.sequence_order}</p>
                            <p><span className="font-medium">File:</span> {video.file_name}</p>
                            {video.file_size && (
                              <p><span className="font-medium">Size:</span> {(video.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                            )}
                          </div>
                          <div>
                            <p><span className="font-medium">Schedule:</span> {scheduleUtils.formatScheduleDescription(video)}</p>
                            <p><span className="font-medium">Timezone:</span> {video.schedule_timezone}</p>
                            <p><span className="font-medium">Created:</span> {new Date(video.created_at).toLocaleDateString()}</p>
                            {video.duration && (
                              <p><span className="font-medium">Duration:</span> {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 font-medium">Local URL:</p>
                          <p className="text-xs text-gray-500 font-mono break-all">{video.file_url}</p>
                          {fileCheck && (
                            <p className={`text-xs mt-1 ${fileCheck.fileExists ? 'text-green-600' : 'text-red-600'}`}>
                              File exists: {fileCheck.fileExists ? '✅ Yes' : '❌ No'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex flex-col space-y-2">
                        <button
                          onClick={() => toggleVideoActive(video.id, video.is_active)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            video.is_active 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {video.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <a
                          href={video.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium text-center"
                        >
                          Preview
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{allVideos.length}</p>
              <p className="text-gray-600">Total Videos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{activeVideos.length}</p>
              <p className="text-gray-600">Active Videos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{scheduledVideos.length}</p>
              <p className="text-gray-600">Currently Scheduled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}