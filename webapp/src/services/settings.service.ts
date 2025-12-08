import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface UserSettings {
  primaryTz: string
  lang: string
  reminderEnabled: boolean
  reminderTime: string | null // HH:mm format in user's timezone
}

class SettingsService {
  async getSettings(userId: string): Promise<UserSettings> {
    const supabase = await createServerSupabaseClient()

    // Get profile settings
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('primary_tz, language')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError) {
      throw new Error(`Failed to load profile: ${profileError.message}`)
    }

    // Get reminder settings
    const { data: reminder } = await supabase
      .from('reminder_settings')
      .select('enabled, reminder_time')
      .eq('user_id', userId)
      .maybeSingle()

    // Initialize with defaults if no profile exists
    const settings: UserSettings = {
      primaryTz: profile?.primary_tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      lang: profile?.language ?? 'en',
      reminderEnabled: reminder?.enabled ?? false,
      reminderTime: reminder?.reminder_time ?? null,
    }

    return settings
  }

  async updateTimezone(userId: string, timezone: string): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({ primary_tz: timezone })
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to update timezone: ${error.message}`)
      }
    } else {
      // Insert new profile with all required fields
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          display_name: 'User',
          primary_tz: timezone,
          language: 'en',
        })

      if (error) {
        throw new Error(`Failed to create profile: ${error.message}`)
      }
    }
  }

  async updateLanguage(userId: string, lang: string): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to update language: ${error.message}`)
      }
    } else {
      // Insert new profile with all required fields
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          display_name: 'User',
          primary_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: lang,
        })

      if (error) {
        throw new Error(`Failed to create profile: ${error.message}`)
      }
    }
  }

  async updateReminder(
    userId: string,
    enabled: boolean,
    reminderTime: string | null
  ): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Check if reminder settings exist
    const { data: existing } = await supabase
      .from('reminder_settings')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('reminder_settings')
        .update({
          enabled,
          reminder_time: reminderTime || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to update reminder: ${error.message}`)
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('reminder_settings')
        .insert({
          user_id: userId,
          enabled,
          reminder_time: reminderTime || undefined,
        })

      if (error) {
        throw new Error(`Failed to create reminder: ${error.message}`)
      }
    }
  }
}

export const settingsService = new SettingsService()
