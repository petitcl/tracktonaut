import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type {
  DailyCheckin,
  MetricEntry,
  MetricEntryInsert,
  CheckinStatus,
} from '@/lib/supabase/types'
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'
import { subDays, parseISO } from 'date-fns'

/**
 * Day data including check-in and entries
 */
export interface DayData {
  checkin: DailyCheckin | null
  entries: MetricEntry[]
}

/**
 * Result from save_day RPC function
 */
export interface SaveDayResult {
  completion_pct: number
  saved_count: number
}

/**
 * Entry data for save_day RPC
 */
export interface SaveDayEntry {
  metric_id: number
  bool_value?: boolean
  int_value?: number
  float_value?: number
  text_value?: string
  select_key?: string
  tag_keys?: string[]
}

/**
 * Check-in Service
 * Handles daily check-in operations with yesterday-first logic and 7-day edit window
 */
class CheckinService {
  /**
   * Get day_id (YYYY-MM-DD) for a given date in user's timezone
   */
  getDayId(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
  }

  /**
   * Get today's day_id in user's timezone
   */
  getTodayDayId(timezone: string): string {
    return this.getDayId(new Date(), timezone)
  }

  /**
   * Get yesterday's day_id in user's timezone
   */
  getYesterdayDayId(timezone: string): string {
    const today = new Date()
    const yesterday = subDays(today, 1)
    return this.getDayId(yesterday, timezone)
  }

  /**
   * Get the day_id that should be shown first (yesterday-first logic)
   * Returns yesterday if not submitted, otherwise today
   */
  async getDefaultDayId(userId: string, timezone: string): Promise<string> {
    const yesterdayId = this.getYesterdayDayId(timezone)

    // Check if yesterday was submitted
    const yesterdayCheckin = await this.getCheckin(userId, yesterdayId)

    if (!yesterdayCheckin || yesterdayCheckin.status === 'draft') {
      // Yesterday not submitted - show yesterday
      return yesterdayId
    }

    // Yesterday submitted - show today
    return this.getTodayDayId(timezone)
  }

  /**
   * Check if a day is editable (within 7-day window)
   */
  canEditDay(dayId: string, timezone: string): boolean {
    const today = new Date()
    const todayId = this.getDayId(today, timezone)

    const targetDate = parseISO(dayId)
    const todayDate = parseISO(todayId)

    // Calculate days difference
    const diffTime = todayDate.getTime() - targetDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // Can edit if within 7 days (including today)
    return diffDays >= 0 && diffDays < 7
  }

  /**
   * Get check-in for a specific day
   */
  async getCheckin(userId: string, dayId: string): Promise<DailyCheckin | null> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('daily_checkin')
      .select('*')
      .eq('user_id', userId)
      .eq('day_id', dayId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching check-in:', error)
      throw new Error('Failed to fetch check-in')
    }

    return data
  }

  /**
   * Get entries for a specific day
   */
  async getEntries(userId: string, dayId: string): Promise<MetricEntry[]> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('metric_entry')
      .select('*')
      .eq('user_id', userId)
      .eq('day_id', dayId)

    if (error) {
      console.error('Error fetching entries:', error)
      throw new Error('Failed to fetch entries')
    }

    return data || []
  }

  /**
   * Get complete day data (check-in + entries)
   */
  async getDayData(userId: string, dayId: string): Promise<DayData> {
    const [checkin, entries] = await Promise.all([
      this.getCheckin(userId, dayId),
      this.getEntries(userId, dayId),
    ])

    return { checkin, entries }
  }

  /**
   * Save a day (check-in + entries) using save_day RPC
   * This is an atomic transaction that validates all entries
   */
  async saveDay(
    userId: string,
    dayId: string,
    status: CheckinStatus,
    entries: SaveDayEntry[]
  ): Promise<SaveDayResult> {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('save_day', {
      p_user_id: userId,
      p_day_id: dayId,
      p_status: status,
      p_entries: entries as unknown as Record<string, unknown>,
    })

    if (error) {
      console.error('Error saving day:', error)
      throw new Error(error.message || 'Failed to save day')
    }

    return data as SaveDayResult
  }

  /**
   * Get recent check-ins (last N days)
   */
  async getRecentCheckins(
    userId: string,
    limit: number = 30
  ): Promise<DailyCheckin[]> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('daily_checkin')
      .select('*')
      .eq('user_id', userId)
      .order('day_id', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent check-ins:', error)
      throw new Error('Failed to fetch recent check-ins')
    }

    return data || []
  }

  /**
   * Get check-ins for a date range
   */
  async getCheckinRange(
    userId: string,
    startDayId: string,
    endDayId: string
  ): Promise<DailyCheckin[]> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('daily_checkin')
      .select('*')
      .eq('user_id', userId)
      .gte('day_id', startDayId)
      .lte('day_id', endDayId)
      .order('day_id', { ascending: false })

    if (error) {
      console.error('Error fetching check-in range:', error)
      throw new Error('Failed to fetch check-ins')
    }

    return data || []
  }

  /**
   * Get entries for a date range
   */
  async getEntriesRange(
    userId: string,
    startDayId: string,
    endDayId: string
  ): Promise<MetricEntry[]> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('metric_entry')
      .select('*')
      .eq('user_id', userId)
      .gte('day_id', startDayId)
      .lte('day_id', endDayId)
      .order('day_id', { ascending: false })

    if (error) {
      console.error('Error fetching entry range:', error)
      throw new Error('Failed to fetch entries')
    }

    return data || []
  }

  /**
   * Get entries for a specific metric across date range
   */
  async getMetricEntries(
    userId: string,
    metricId: number,
    startDayId: string,
    endDayId: string
  ): Promise<MetricEntry[]> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('metric_entry')
      .select('*')
      .eq('user_id', userId)
      .eq('metric_id', metricId)
      .gte('day_id', startDayId)
      .lte('day_id', endDayId)
      .order('day_id', { ascending: true })

    if (error) {
      console.error('Error fetching metric entries:', error)
      throw new Error('Failed to fetch metric entries')
    }

    return data || []
  }

  /**
   * Get completion streak (consecutive submitted days ending today/yesterday)
   */
  async getCompletionStreak(userId: string, timezone: string): Promise<number> {
    const supabase = await createServerClient()

    const todayId = this.getTodayDayId(timezone)

    // Get recent check-ins (up to 365 days)
    const { data: checkins, error } = await supabase
      .from('daily_checkin')
      .select('day_id, status')
      .eq('user_id', userId)
      .lte('day_id', todayId)
      .order('day_id', { ascending: false })
      .limit(365)

    if (error || !checkins || checkins.length === 0) {
      return 0
    }

    // Count consecutive submitted days from most recent
    let streak = 0
    let expectedDayId = todayId

    for (const checkin of checkins) {
      if (checkin.day_id === expectedDayId && checkin.status === 'submitted') {
        streak++
        // Calculate previous day
        const currentDate = parseISO(expectedDayId)
        const prevDate = subDays(currentDate, 1)
        expectedDayId = this.getDayId(prevDate, timezone)
      } else if (
        streak === 0 &&
        checkin.day_id === this.getYesterdayDayId(timezone) &&
        checkin.status === 'submitted'
      ) {
        // Allow streak to start from yesterday if today not submitted yet
        streak++
        const currentDate = parseISO(checkin.day_id)
        const prevDate = subDays(currentDate, 1)
        expectedDayId = this.getDayId(prevDate, timezone)
      } else {
        // Streak broken
        break
      }
    }

    return streak
  }
}

// Export singleton instance
export const checkinService = new CheckinService()
