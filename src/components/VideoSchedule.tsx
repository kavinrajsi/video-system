'use client';

import { useState, useEffect } from 'react';
import { Video, Timezone, videoApi, scheduleUtils } from '@/lib/supabase';
import { Calendar, X, Save } from 'lucide-react';

interface VideoScheduleProps {
  video: Video;
  onUpdate: (videoId: string, updates: Partial<Video>) => void;
  onClose: () => void;
}

export default function VideoSchedule({ video, onUpdate, onClose }: VideoScheduleProps) {
  const [scheduleType, setScheduleType] = useState(video.schedule_type || 'always');
  const [startDate, setStartDate] = useState(video.schedule_start_date || '');
  const [endDate, setEndDate] = useState(video.schedule_end_date || '');
  const [startTime, setStartTime] = useState(video.schedule_start_time || '09:00');
  const [endTime, setEndTime] = useState(video.schedule_end_time || '17:00');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    video.schedule_weekdays ? JSON.parse(video.schedule_weekdays) : [1, 2, 3, 4, 5]
  );
  const [timezone, setTimezone] = useState(video.schedule_timezone || 'UTC');
  const [timezones, setTimezones] = useState<Timezone[]>([]);
  const [saving, setSaving] = useState(false);

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadTimezones();
  }, []);

  const loadTimezones = async () => {
    try {
      const data = await videoApi.getTimezones();
      setTimezones(data);
    } catch (error) {
      console.error('Error loading timezones:', error);
      // Fallback to default timezones if database table doesn't exist
      setTimezones([
        { id: 1, name: 'UTC', value: 'UTC', display_name: 'UTC (Coordinated Universal Time)' },
        { id: 2, name: 'US Eastern', value: 'America/New_York', display_name: 'US Eastern Time' },
        { id: 3, name: 'US Central', value: 'America/Chicago', display_name: 'US Central Time' },
        { id: 4, name: 'US Mountain', value: 'America/Denver', display_name: 'US Mountain Time' },
        { id: 5, name: 'US Pacific', value: 'America/Los_Angeles', display_name: 'US Pacific Time' },
        { id: 6, name: 'Europe London', value: 'Europe/London', display_name: 'Europe/London (GMT/BST)' },
        { id: 7, name: 'Europe Paris', value: 'Europe/Paris', display_name: 'Europe/Paris (CET/CEST)' },
        { id: 8, name: 'Asia Tokyo', value: 'Asia/Tokyo', display_name: 'Asia/Tokyo (JST)' },
      ]);
    }
  };

  const toggleWeekday = (dayIndex: number) => {
    setSelectedWeekdays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<Video> = {
        schedule_type: scheduleType,
        schedule_timezone: timezone,
      };

      // Add schedule-specific fields
      if (scheduleType === 'date_range' || scheduleType === 'custom') {
        updates.schedule_start_date = startDate;
        updates.schedule_end_date = endDate;
      }

      if (scheduleType === 'time_daily' || scheduleType === 'custom') {
        updates.schedule_start_time = startTime;
        updates.schedule_end_time = endTime;
      }

      if (scheduleType === 'weekdays' || scheduleType === 'custom') {
        updates.schedule_weekdays = JSON.stringify(selectedWeekdays);
      }

      await onUpdate(video.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Error saving schedule');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentScheduleStatus = () => {
    const tempVideo = {
      ...video,
      schedule_type: scheduleType,
      schedule_start_date: startDate,
      schedule_end_date: endDate,
      schedule_start_time: startTime,
      schedule_end_time: endTime,
      schedule_weekdays: JSON.stringify(selectedWeekdays),
      schedule_timezone: timezone
    } as Video;

    const isActive = scheduleUtils.isVideoScheduledNow(tempVideo);
    return isActive ? '✅ Currently Scheduled' : '⏳ Not Currently Scheduled';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Schedule: {video.title}</span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Current Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Current Status</h3>
            <p className="text-sm text-gray-600">{getCurrentScheduleStatus()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {scheduleUtils.formatScheduleDescription({
                ...video,
                schedule_type: scheduleType,
                schedule_start_date: startDate,
                schedule_end_date: endDate,
                schedule_start_time: startTime,
                schedule_end_time: endTime,
                schedule_weekdays: JSON.stringify(selectedWeekdays),
                schedule_timezone: timezone
              } as Video)}
            </p>
          </div>

          {/* Schedule Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Type
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as Video['schedule_type'])}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="always">Always Active</option>
              <option value="date_range">Date Range</option>
              <option value="time_daily">Daily Time Range</option>
              <option value="weekdays">Specific Weekdays</option>
              <option value="custom">Custom (Combine Options)</option>
            </select>
          </div>

          {/* Timezone */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          {(scheduleType === 'date_range' || scheduleType === 'custom') && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Time Range */}
          {(scheduleType === 'time_daily' || scheduleType === 'custom') && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Time Range
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Time ranges can span midnight (e.g., 22:00 to 06:00)
              </p>
            </div>
          )}

          {/* Weekdays */}
          {(scheduleType === 'weekdays' || scheduleType === 'custom') && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekdays
              </label>
              <div className="grid grid-cols-7 gap-2">
                {weekdayNames.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => toggleWeekday(index)}
                    className={`p-2 text-xs font-medium rounded-lg border ${
                      selectedWeekdays.includes(index)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex space-x-4 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Schedule'}</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}