'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth'

interface SettingsProps {
  userId: string
}

interface UserSettings {
  displayName: string | null
  email: string | null
  createdAt: string
  primaryTz: string
  lang: string
  reminderEnabled: boolean
  reminderTime: string | null
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
]

// Common timezones (subset for better UX)
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export function Settings({ userId }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const supabase = createClient()

      // Get user auth data
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, created_at, primary_tz, language')
        .eq('user_id', userId)
        .maybeSingle()

      if (profileError) throw profileError

      // Get reminder settings
      const { data: reminder } = await supabase
        .from('reminder_settings')
        .select('enabled, reminder_time')
        .eq('user_id', userId)
        .maybeSingle()

      // Initialize with defaults if no profile exists
      const userSettings: UserSettings = {
        displayName: profile?.display_name ?? null,
        email: user?.email ?? null,
        createdAt: profile?.created_at ?? new Date().toISOString(),
        primaryTz: profile?.primary_tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: profile?.language ?? 'en',
        reminderEnabled: reminder?.enabled ?? false,
        reminderTime: reminder?.reminder_time ?? null,
      }

      setSettings(userSettings)
      setDisplayName(userSettings.displayName ?? '')
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  async function handleSaveDisplayName() {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()

      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ display_name: displayName || 'User' })
          .eq('user_id', userId)

        if (updateError) throw updateError
      } else {
        // Insert new profile with all required fields
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: displayName || 'User',
            primary_tz: settings?.primaryTz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: settings?.lang ?? 'en',
          })

        if (insertError) throw insertError
      }

      setSettings((prev) => (prev ? { ...prev, displayName: displayName || null } : null))
      setSuccessMessage('Display name updated successfully')
      setIsEditingName(false)
    } catch (err) {
      console.error('Error updating display name:', err)
      setError('Failed to update display name')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      console.error('Error signing out:', err)
      setError('Failed to sign out')
    }
  }

  async function updateTimezone(timezone: string) {
    if (!settings) return

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()

      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ primary_tz: timezone })
          .eq('user_id', userId)

        if (updateError) throw updateError
      } else {
        // Insert new profile with all required fields
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: 'User',
            primary_tz: timezone,
            language: settings.lang,
          })

        if (insertError) throw insertError
      }

      setSettings({ ...settings, primaryTz: timezone })
      setSuccessMessage('Timezone updated successfully')
    } catch (err) {
      console.error('Error updating timezone:', err)
      setError('Failed to update timezone')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateLanguage(lang: string) {
    if (!settings) return

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()

      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ language: lang })
          .eq('user_id', userId)

        if (updateError) throw updateError
      } else {
        // Insert new profile with all required fields
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: 'User',
            primary_tz: settings.primaryTz,
            language: lang,
          })

        if (insertError) throw insertError
      }

      setSettings({ ...settings, lang })
      setSuccessMessage('Language updated successfully')
    } catch (err) {
      console.error('Error updating language:', err)
      setError('Failed to update language')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateReminder(enabled: boolean, reminderTime: string | null) {
    if (!settings) return

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()

      // Check if reminder settings exist
      const { data: existing } = await supabase
        .from('reminder_settings')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('reminder_settings')
          .update({
            enabled,
            reminder_time: reminderTime || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (updateError) throw updateError
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('reminder_settings')
          .insert({
            user_id: userId,
            enabled,
            reminder_time: reminderTime || undefined,
          })

        if (insertError) throw insertError
      }

      setSettings({ ...settings, reminderEnabled: enabled, reminderTime })
      setSuccessMessage('Reminder settings updated successfully')
    } catch (err) {
      console.error('Error updating reminder:', err)
      setError('Failed to update reminder settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!settings) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Display Name */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label htmlFor="display-name" className="block text-sm font-medium mb-2">
          Display Name
        </label>
        {isEditingName ? (
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              disabled={isSaving}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSaveDisplayName}
              disabled={isSaving}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsEditingName(false)
                setDisplayName(settings?.displayName ?? '')
              }}
              disabled={isSaving}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-gray-700 border border-gray-600 rounded-lg px-4 py-3">
            <span className="text-white">
              {settings.displayName || <span className="text-gray-500">Not set</span>}
            </span>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Email */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <div className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-400">
          {settings.email || 'No email'}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Email is managed through your authentication provider
        </p>
      </div>

      {/* Account Created */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label className="block text-sm font-medium mb-2">Account Created</label>
        <div className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-400">
          {new Date(settings.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Timezone */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label className="block text-sm font-medium mb-2">Timezone</label>
        <p className="text-xs text-gray-500 mb-3">
          Select your timezone for accurate daily check-in tracking
        </p>
        <select
          value={settings.primaryTz}
          onChange={(e) => updateTimezone(e.target.value)}
          disabled={isSaving}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Language */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label className="block text-sm font-medium mb-2">Language</label>
        <p className="text-xs text-gray-500 mb-3">
          Choose your preferred language for the interface
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => updateLanguage(language.code)}
              disabled={isSaving}
              className={`
                px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50
                ${
                  settings.lang === language.code
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {language.name}
            </button>
          ))}
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <label className="block text-sm font-medium mb-2">Daily Reminders</label>
        <p className="text-xs text-gray-500 mb-3">
          Get a daily reminder to log your metrics
        </p>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
          <span className="font-medium">Enable Reminders</span>
          <button
            onClick={() =>
              updateReminder(!settings.reminderEnabled, settings.reminderTime || '20:00')
            }
            disabled={isSaving}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50
              ${settings.reminderEnabled ? 'bg-blue-600' : 'bg-gray-600'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${settings.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {/* Time Picker */}
        {settings.reminderEnabled && (
          <div>
            <label htmlFor="reminder-time" className="block text-sm font-medium mb-2">
              Reminder Time (in your timezone)
            </label>
            <input
              id="reminder-time"
              type="time"
              value={settings.reminderTime || '20:00'}
              onChange={(e) => updateReminder(true, e.target.value)}
              disabled={isSaving}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-2">
              You&apos;ll receive a push notification at this time every day
            </p>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
