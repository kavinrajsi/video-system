# Video Display System

A comprehensive digital signage solution built with Next.js that allows you to upload, schedule, and display videos globally. Perfect for retail stores, corporate displays, restaurants, and any location requiring scheduled video content.

## 🚀 Features

### 📱 PWA Display App

- **Fullscreen video playback** with automatic looping
- **Progressive Web App** - installable on any device
- **Offline support** with local video caching
- **Real-time updates** when content changes
- **Auto-advance** through video playlist
- **Global deployment** ready

### 👨‍💼 Admin Portal

- **Drag-and-drop video uploads**
- **Video management** with reordering and activation controls
- **Advanced scheduling** with multiple schedule types
- **Real-time preview** of what's currently playing
- **Schedule status indicators** for each video
- **Timezone support** for global operations

### ⏰ Advanced Scheduling

- **Always Active** - Play videos continuously
- **Date Range** - Schedule for specific date periods
- **Daily Time Range** - Play during specific hours (e.g., 9 AM - 5 PM)
- **Weekdays Only** - Play on selected days of the week
- **Custom Combinations** - Mix date ranges, times, and weekdays
- **Timezone Aware** - Support for global deployments
- **Automatic Updates** - Schedule changes apply immediately

### 🛠️ Developer Features

- **Local Storage** - Videos stored locally for faster loading
- **Real-time Sync** - Supabase integration for instant updates
- **Debug Panel** - Comprehensive system diagnostics
- **TypeScript** - Full type safety
- **Responsive Design** - Works on all devices

## 🏗️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Local file system
- **Real-time**: Supabase subscriptions
- **PWA**: next-pwa
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd video-display-system
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings → API and copy your project URL and anon key

4. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Set up database**
   - Go to Supabase SQL Editor
   - Run the migration script (see Database Setup section)

6. **Create uploads directory**

   ```bash
   mkdir -p public/uploads
   touch public/uploads/.gitkeep
   ```

7. **Start development server**

   ```bash
   npm run dev
   ```

8. **Open the application**
   - Admin Portal: http://localhost:3000/admin
   - Display App: http://localhost:3000/display
   - Debug Panel: http://localhost:3000/debug

## 📊 Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Create videos table with scheduling
CREATE TABLE IF NOT EXISTS videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title varchar(255) NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name varchar(255) NOT NULL,
  file_size bigint,
  duration integer,
  sequence_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  
  -- Scheduling fields
  schedule_type varchar(20) DEFAULT 'always' CHECK (schedule_type IN ('always', 'date_range', 'time_daily', 'weekdays', 'custom')),
  schedule_start_date date,
  schedule_end_date date,
  schedule_start_time time,
  schedule_end_time time,
  schedule_weekdays text,
  schedule_timezone varchar(50) DEFAULT 'UTC',
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_videos_sequence_order ON videos(sequence_order);
CREATE INDEX IF NOT EXISTS idx_videos_active ON videos(is_active);
CREATE INDEX IF NOT EXISTS idx_videos_schedule_type ON videos(schedule_type);
CREATE INDEX IF NOT EXISTS idx_videos_schedule_dates ON videos(schedule_start_date, schedule_end_date);

-- Enable Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Create policy (adjust as needed for production)
CREATE POLICY "Allow all operations on videos" ON videos FOR ALL USING (true);

-- Create timezones table
CREATE TABLE IF NOT EXISTS timezones (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  value varchar(50) NOT NULL UNIQUE,
  display_name varchar(100) NOT NULL
);

-- Insert timezone data
INSERT INTO timezones (name, value, display_name) VALUES
  ('UTC', 'UTC', 'UTC (Coordinated Universal Time)'),
  ('US Eastern', 'America/New_York', 'US Eastern Time'),
  ('US Central', 'America/Chicago', 'US Central Time'),
  ('US Mountain', 'America/Denver', 'US Mountain Time'),
  ('US Pacific', 'America/Los_Angeles', 'US Pacific Time'),
  ('Europe London', 'Europe/London', 'Europe/London (GMT/BST)'),
  ('Europe Paris', 'Europe/Paris', 'Europe/Paris (CET/CEST)'),
  ('Asia Tokyo', 'Asia/Tokyo', 'Asia/Tokyo (JST)')
ON CONFLICT (value) DO NOTHING;
```

## 📱 Usage Guide

### 1. Upload Videos

1. Go to `/admin`
2. Drag and drop video files or click "Select Videos"
3. Videos are automatically processed and made active

### 2. Schedule Content

1. In the admin panel, click the 📅 calendar icon next to any video
2. Choose your schedule type:
   - **Always**: Video plays continuously
   - **Date Range**: Set start and end dates
   - **Daily Time**: Set daily start/end times (e.g., 9 AM - 5 PM)
   - **Weekdays**: Select specific days of the week
   - **Custom**: Combine date range, time, and weekdays
3. Set the appropriate timezone
4. Save the schedule

### 3. Deploy Display

1. Open `/display` on your display device
2. For mobile/tablet: "Add to Home Screen" for full PWA experience
3. Videos will automatically play based on their schedules
4. The display checks for updates every minute

### 4. Monitor System

1. Use `/debug` to troubleshoot issues
2. Check which videos are currently scheduled
3. Verify file system and database connections
4. View detailed video information and schedules

## 🔧 Configuration

### Supported Video Formats

- MP4 (recommended)
- WebM
- MOV

### Schedule Types Explained

| Type | Description | Example Use Case |
|------|-------------|------------------|
| **Always** | Plays continuously when active | Default content, evergreen videos |
| **Date Range** | Plays only between specific dates | Holiday promotions, seasonal content |
| **Daily Time** | Plays during specific hours each day | Business hours only, lunch specials |
| **Weekdays** | Plays only on selected days | Weekend events, weekday promotions |
| **Custom** | Combines multiple conditions | Complex campaigns with specific timing |

### Timezone Support

The system supports global deployments with timezone-aware scheduling:
- Each video can have its own timezone
- Schedules are calculated in the video's specified timezone
- Display automatically updates when schedules change

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Production Considerations

- **File Storage**: Consider moving to cloud storage for larger deployments
- **Database**: Use Supabase Pro for production workloads
- **CDN**: Enable caching for video files
- **Security**: Implement proper authentication for admin panel
- **Monitoring**: Set up error tracking and analytics

## 🛠️ Development

### Project Structure

```
src/
├── app/
│   ├── admin/           # Admin portal
│   ├── display/         # PWA display app
│   ├── debug/           # Debug panel
│   └── api/            # API routes
├── components/         # React components
└── lib/               # Utilities and Supabase client

public/
├── uploads/           # Local video storage
└── manifest.json     # PWA manifest
```

### Key Files

- `src/lib/supabase.ts` - Database client and API functions
- `src/components/VideoSchedule.tsx` - Scheduling component
- `src/app/api/upload/route.ts` - Video upload handler
- `src/app/api/delete/route.ts` - Video deletion handler

### Adding New Features

1. **New Schedule Types**: Extend the `schedule_type` enum and add logic to `scheduleUtils.isVideoScheduledNow()`
2. **Cloud Storage**: Replace local storage API routes with cloud provider integration
3. **Authentication**: Add auth middleware to admin routes
4. **Analytics**: Track video play counts and user engagement

## 🔍 Troubleshooting

### Common Issues

**"No scheduled videos" on display:**

- Check the debug panel to see current schedule status
- Verify videos are marked as "Active" in admin panel
- Confirm schedule timing and timezone settings

**Videos not uploading:**

- Check that `public/uploads` directory exists and is writable
- Verify upload API is working in debug panel
- Check file format compatibility

**Database connection issues:**

- Verify Supabase URL and API key in `.env.local`
- Check network connectivity to Supabase
- Ensure database tables exist (run migration script)

### Debug Panel Features

The debug panel (`/debug`) provides:

- System status checks
- Database connection verification
- File system accessibility tests
- Current schedule status for all videos
- File existence verification
- Environment variable validation

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.