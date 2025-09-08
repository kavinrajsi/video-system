// src/lib/supabase.ts - Fixed to match your actual database schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Updated Types to match your ACTUAL database schema
export interface Video {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  duration?: number;
  sequence_order: number;
  is_active: boolean;
  
  // Based on your original schema - using the schedule_ prefix
  schedule_type: 'always' | 'date_range' | 'time_daily' | 'weekdays' | 'custom';
  schedule_start_date?: string;
  schedule_end_date?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
  schedule_weekdays?: string; // JSON string of weekday numbers
  schedule_timezone: string;   // This is the field that exists in your DB
  
  created_at: string;
  updated_at: string;
}

export interface Timezone {
  id: number;
  name: string;
  value: string;
  display_name: string;
}

// Updated utility functions for scheduling
export const scheduleUtils = {
  // Check if a video should be playing right now
  isVideoScheduledNow(video: Video, currentTime?: Date): boolean {
    if (!video.is_active) return false;
    
    const now = currentTime || new Date();
    const timezone = video.schedule_timezone || 'UTC';
    
    // Convert current time to video's timezone
    const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    
    switch (video.schedule_type) {
      case 'always':
        return true;
        
      case 'date_range':
        if (!video.schedule_start_date || !video.schedule_end_date) return false;
        const startDate = new Date(video.schedule_start_date);
        const endDate = new Date(video.schedule_end_date);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return nowInTimezone >= startDate && nowInTimezone <= endDate;
        
      case 'time_daily':
        if (!video.schedule_start_time || !video.schedule_end_time) return false;
        const currentTime = nowInTimezone.getHours() * 100 + nowInTimezone.getMinutes();
        const startTime = this.timeStringToMinutes(video.schedule_start_time);
        const endTime = this.timeStringToMinutes(video.schedule_end_time);
        
        if (startTime <= endTime) {
          return currentTime >= startTime && currentTime <= endTime;
        } else {
          // Handle overnight time ranges (e.g., 22:00 to 06:00)
          return currentTime >= startTime || currentTime <= endTime;
        }
        
      case 'weekdays':
        if (!video.schedule_weekdays) return false;
        const weekdays = JSON.parse(video.schedule_weekdays);
        const currentWeekday = nowInTimezone.getDay(); // 0 = Sunday
        return weekdays.includes(currentWeekday);
        
      case 'custom':
        // Combine date range, time, and weekdays
        let isInDateRange = true;
        let isInTimeRange = true;
        let isOnCorrectWeekday = true;
        
        if (video.schedule_start_date && video.schedule_end_date) {
          const startDate = new Date(video.schedule_start_date);
          const endDate = new Date(video.schedule_end_date);
          endDate.setHours(23, 59, 59, 999);
          isInDateRange = nowInTimezone >= startDate && nowInTimezone <= endDate;
        }
        
        if (video.schedule_start_time && video.schedule_end_time) {
          const currentTime = nowInTimezone.getHours() * 100 + nowInTimezone.getMinutes();
          const startTime = this.timeStringToMinutes(video.schedule_start_time);
          const endTime = this.timeStringToMinutes(video.schedule_end_time);
          
          if (startTime <= endTime) {
            isInTimeRange = currentTime >= startTime && currentTime <= endTime;
          } else {
            isInTimeRange = currentTime >= startTime || currentTime <= endTime;
          }
        }
        
        if (video.schedule_weekdays) {
          const weekdays = JSON.parse(video.schedule_weekdays);
          const currentWeekday = nowInTimezone.getDay();
          isOnCorrectWeekday = weekdays.includes(currentWeekday);
        }
        
        return isInDateRange && isInTimeRange && isOnCorrectWeekday;
        
      default:
        return false;
    }
  },
  
  timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  },
  
  formatScheduleDescription(video: Video): string {
    switch (video.schedule_type) {
      case 'always':
        return 'Always active';
        
      case 'date_range':
        return `${video.schedule_start_date} to ${video.schedule_end_date}`;
        
      case 'time_daily':
        return `Daily ${video.schedule_start_time} - ${video.schedule_end_time}`;
        
      case 'weekdays':
        const weekdays = JSON.parse(video.schedule_weekdays || '[]');
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `Weekdays: ${weekdays.map((d: number) => dayNames[d]).join(', ')}`;
        
      case 'custom':
        const parts = [];
        if (video.schedule_start_date && video.schedule_end_date) {
          parts.push(`${video.schedule_start_date} to ${video.schedule_end_date}`);
        }
        if (video.schedule_start_time && video.schedule_end_time) {
          parts.push(`${video.schedule_start_time} - ${video.schedule_end_time}`);
        }
        if (video.schedule_weekdays) {
          const weekdays = JSON.parse(video.schedule_weekdays);
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          parts.push(weekdays.map((d: number) => dayNames[d]).join(', '));
        }
        return parts.join(' • ') || 'Custom schedule';
        
      default:
        return 'No schedule';
    }
  }
};

// Video API functions
export const videoApi = {
  // Get all currently scheduled active videos
  async getScheduledVideos(currentTime?: Date): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .order('sequence_order');
    
    if (error) throw error;
    
    // Filter by schedule
    const scheduledVideos = (data || []).filter(video => 
      scheduleUtils.isVideoScheduledNow(video, currentTime)
    );
    
    return scheduledVideos;
  },

  // Get all active videos (legacy method - for compatibility)
  async getActiveVideos(): Promise<Video[]> {
    return this.getScheduledVideos();
  },

  // Get all videos (for admin)
  async getAllVideos(): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('sequence_order');
    
    if (error) throw error;
    return data || [];
  },

  // Get timezones
  async getTimezones(): Promise<Timezone[]> {
    try {
      const { data, error } = await supabase
        .from('timezones')
        .select('*')
        .order('name');
      
      if (error) {
        // If timezones table doesn't exist, return default timezones
        console.warn('Timezones table not found, using defaults');
        return [
          { id: 1, name: 'UTC', value: 'UTC', display_name: 'UTC (Coordinated Universal Time)' },
          { id: 2, name: 'US Eastern', value: 'America/New_York', display_name: 'US Eastern Time' },
          { id: 3, name: 'US Central', value: 'America/Chicago', display_name: 'US Central Time' },
          { id: 4, name: 'US Mountain', value: 'America/Denver', display_name: 'US Mountain Time' },
          { id: 5, name: 'US Pacific', value: 'America/Los_Angeles', display_name: 'US Pacific Time' },
          { id: 6, name: 'Europe London', value: 'Europe/London', display_name: 'Europe/London (GMT/BST)' },
          { id: 7, name: 'Europe Paris', value: 'Europe/Paris', display_name: 'Europe/Paris (CET/CEST)' },
          { id: 8, name: 'Asia Tokyo', value: 'Asia/Tokyo', display_name: 'Asia/Tokyo (JST)' },
        ];
      }
      
      return data || [];
    } catch (err) {
      console.warn('Error accessing timezones, using defaults:', err);
      return [
        { id: 1, name: 'UTC', value: 'UTC', display_name: 'UTC (Coordinated Universal Time)' },
        { id: 2, name: 'US Eastern', value: 'America/New_York', display_name: 'US Eastern Time' },
        { id: 3, name: 'US Central', value: 'America/Chicago', display_name: 'US Central Time' },
        { id: 4, name: 'US Mountain', value: 'America/Denver', display_name: 'US Mountain Time' },
        { id: 5, name: 'US Pacific', value: 'America/Los_Angeles', display_name: 'US Pacific Time' },
        { id: 6, name: 'Europe London', value: 'Europe/London', display_name: 'Europe/London (GMT/BST)' },
        { id: 7, name: 'Europe Paris', value: 'Europe/Paris', display_name: 'Europe/Paris (CET/CEST)' },
        { id: 8, name: 'Asia Tokyo', value: 'Asia/Tokyo', display_name: 'Asia/Tokyo (JST)' },
      ];
    }
  },

  // Fixed addVideo function with correct field names
  async addVideo(video: Omit<Video, 'id' | 'created_at' | 'updated_at'>): Promise<Video> {
    try {
      console.log('=== DEBUG: Adding video to database ===');
      console.log('Input video object:', JSON.stringify(video, null, 2));
      
      // Validate required fields
      if (!video.title || !video.file_url) {
        throw new Error('Title and file_url are required');
      }

      // Use the correct field names that match your database schema
      const videoData = {
        title: video.title,
        description: video.description || null,
        file_url: video.file_url,
        file_name: video.file_name || '',
        file_size: video.file_size || 0,
        duration: video.duration || 0,
        is_active: video.is_active !== undefined ? video.is_active : true,
        sequence_order: video.sequence_order || 0,
        schedule_type: video.schedule_type || 'always',
        schedule_timezone: video.schedule_timezone || 'UTC',  // Using the correct field name
        schedule_start_date: video.schedule_start_date || null,
        schedule_end_date: video.schedule_end_date || null,
        schedule_start_time: video.schedule_start_time || null,
        schedule_end_time: video.schedule_end_time || null,
        schedule_weekdays: video.schedule_weekdays || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('=== DEBUG: Prepared data for insert ===');
      console.log('Video data to insert:', JSON.stringify(videoData, null, 2));

      const { data, error } = await supabase
        .from('videos')
        .insert(videoData)
        .select()
        .single();
      
      if (error) {
        console.error('=== DEBUG: Detailed Supabase error ===');
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Error code:', error.code);
        
        throw new Error(`Database error: ${error.message} (Code: ${error.code || 'unknown'})`);
      }

      if (!data) {
        throw new Error('No data returned from database insert');
      }

      console.log('=== DEBUG: Video added successfully ===');
      console.log('Success data:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('=== DEBUG: Catch block error ===');
      console.error('Error in addVideo:', error);
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Unknown database error: ${JSON.stringify(error)}`);
      }
    }
  },

  // Update video
  async updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete video
  async deleteVideo(id: string): Promise<void> {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Subscribe to real-time changes
  subscribeToVideos(callback: (payload: Record<string, unknown>) => void) {
    return supabase
      .channel('videos')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'videos' }, 
        callback
      )
      .subscribe();
  },

  // Debug functions (you can remove these after fixing the issue)
  async checkVideoTableSchema(): Promise<any> {
    try {
      console.log('=== DEBUG: Checking videos table schema ===');
      
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Schema check error:', error);
        return { error: error };
      }
      
      if (data) {
        console.log('Existing video record structure:', Object.keys(data));
        return { columns: Object.keys(data), sampleData: data };
      } else {
        // Try with minimal data using correct field names
        const testData = {
          title: 'TEST_RECORD',
          file_url: 'https://t5m2as0qwqyz49ri.public.blob.vercel-storage.com/WhatsApp%20Video%202025-09-08%20at%2000.45.39-vtqWf9lPWuotLYuUOIIELApSojYCha.mp4',
          file_name: 'test.mp4',
          is_active: true,
          sequence_order: 999,
          schedule_type: 'always',
          schedule_timezone: 'UTC'  // Using correct field name
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('videos')
          .insert(testData)
          .select()
          .single();
        
        if (insertError) {
          return { testInsertError: insertError };
        } else {
          // Clean up test record
          await supabase.from('videos').delete().eq('id', insertData.id);
          return { testInsertSuccess: true, columns: Object.keys(insertData) };
        }
      }
    } catch (err) {
      return { exception: err };
    }
  },

  checkEnvironment(): any {
    return {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      nodeEnv: process.env.NODE_ENV,
      supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    };
  }
};