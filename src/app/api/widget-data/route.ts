// src/app/api/widget-data/route.ts - API endpoint for widget data
import { NextResponse } from 'next/server';
import { videoApi, scheduleUtils } from '@/lib/supabase';

export async function GET() {
  try {
    // Get current video status for widget
    const videos = await videoApi.getAllVideos();
    const activeVideos = videos.filter(v => v.is_active);
    const scheduledVideos = activeVideos.filter(video => 
      scheduleUtils.isVideoScheduledNow(video)
    );
    
    const currentVideo = scheduledVideos.length > 0 ? scheduledVideos[0] : null;
    
    const widgetData = {
      status: currentVideo ? 'playing' : 'idle',
      currentVideo: currentVideo?.title || 'No video playing',
      totalVideos: videos.length,
      activeVideos: activeVideos.length,
      scheduledVideos: scheduledVideos.length,
      lastUpdated: new Date().toISOString(),
      nextVideo: scheduledVideos.length > 1 ? scheduledVideos[1]?.title : null
    };
    
    return NextResponse.json(widgetData);
  } catch (error) {
    console.error('Widget data error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        currentVideo: 'Unable to load',
        totalVideos: 0,
        activeVideos: 0,
        scheduledVideos: 0,
        lastUpdated: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 10;