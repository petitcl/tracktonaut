'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import type { Metric } from '@/lib/supabase/types'
import { MetricInput, type MetricValue } from './MetricInput'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO, addDays, subDays } from 'date-fns'

interface CaptureInterfaceProps {
  userId: string
}

export function CaptureInterface({ userId }: CaptureInterfaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [metrics, setMetrics] = useState<Metric[]>([])
  const [entries, setEntries] = useState<Record<number, MetricValue>>({})
  const [currentDayId, setCurrentDayId] = useState<string>('')
  const [timezone, setTimezone] = useState<string>('UTC')
  const [completionPct, setCompletionPct] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Helper functions
  const hasValue = (entry: MetricValue): boolean => {
    return (
      entry.bool_value !== undefined ||
      entry.int_value !== undefined ||
      entry.float_value !== undefined ||
      (entry.text_value !== undefined && entry.text_value.length > 0) ||
      entry.select_key !== undefined ||
      (entry.tag_keys !== undefined && entry.tag_keys.length > 0)
    )
  }

  const calculateCompletion = useCallback((metrics: Metric[], entries: Record<number, MetricValue>) => {
    const requiredMetrics = metrics.filter((m) => m.is_required)
    const answeredRequired = requiredMetrics.filter((m) => {
      const entry = entries[m.id]
      return entry && hasValue(entry)
    })

    const pct = requiredMetrics.length > 0
      ? Math.round((answeredRequired.length / requiredMetrics.length) * 100)
      : 100

    setCompletionPct(pct)
  }, [])

  // Initialize data
  useEffect(() => {
    async function initializeData() {
      try {
        const supabase = createClient()

        // Get user profile for timezone
        const { data: profile } = await supabase
          .from('profiles')
          .select('primary_tz')
          .eq('user_id', userId)
          .single()

        const userTz = profile?.primary_tz || Intl.DateTimeFormat().resolvedOptions().timeZone

        setTimezone(userTz)

        // Determine default day_id (yesterday-first logic)
        const dayParam = searchParams.get('day')
        let dayId: string

        if (dayParam) {
          dayId = dayParam
        } else {
          // Check if yesterday was submitted
          const yesterday = formatInTimeZone(subDays(new Date(), 1), userTz, 'yyyy-MM-dd')

          const { data: yesterdayCheckin } = await supabase
            .from('daily_checkin')
            .select('status')
            .eq('user_id', userId)
            .eq('day_id', yesterday)
            .single()

          if (!yesterdayCheckin || yesterdayCheckin.status === 'draft') {
            dayId = yesterday
          } else {
            dayId = formatInTimeZone(new Date(), userTz, 'yyyy-MM-dd')
          }
        }

        setCurrentDayId(dayId)

        // Fetch active metrics
        const { data: metricsData, error: metricsError } = await supabase
          .from('metrics')
          .select('*')
          .eq('user_id', userId)
          .is('archived_at', null)
          .order('order_index', { ascending: true })

        if (metricsError) throw metricsError

        setMetrics(metricsData || [])

        // Fetch existing entries for this day
        const { data: entriesData } = await supabase
          .from('metric_entry')
          .select('*')
          .eq('user_id', userId)
          .eq('day_id', dayId)

        // Convert entries to map
        const entriesMap: Record<number, MetricValue> = {}
        entriesData?.forEach((entry) => {
          entriesMap[entry.metric_id] = {
            bool_value: entry.bool_value ?? undefined,
            int_value: entry.int_value ?? undefined,
            float_value: entry.float_value ?? undefined,
            text_value: entry.text_value ?? undefined,
            select_key: entry.select_key ?? undefined,
            tag_keys: entry.tag_keys ?? undefined,
          }
        })

        setEntries(entriesMap)

        // Calculate completion percentage
        calculateCompletion(metricsData || [], entriesMap)

      } catch (err) {
        console.error('Error initializing capture:', err)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    initializeData()
  }, [userId, searchParams, calculateCompletion])

  const handleEntryChange = (metricId: number, value: MetricValue) => {
    const newEntries = { ...entries, [metricId]: value }
    setEntries(newEntries)
    calculateCompletion(metrics, newEntries)
  }

  const handleSave = async (status: 'draft' | 'submitted') => {
    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      // Convert entries to save_day format
      const entriesToSave = Object.entries(entries)
        .filter(([, value]) => hasValue(value))
        .map(([metricId, value]) => ({
          metric_id: parseInt(metricId),
          ...value,
        }))

      const { error: saveError } = await supabase.rpc('save_day', {
        p_user_id: userId,
        p_day_id: currentDayId,
        p_status: status,
        p_entries: entriesToSave as unknown as Json,
      })

      if (saveError) throw saveError

      if (status === 'submitted') {
        // Redirect to dashboard on submit
        router.push('/')
      } else {
        // Show success message for draft
        alert('Draft saved successfully!')
      }
    } catch (err: unknown) {
      console.error('Error saving:', err)
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const canEditDay = () => {
    const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd')
    const currentDate = parseISO(currentDayId)
    const todayDate = parseISO(today)

    const diffTime = todayDate.getTime() - currentDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays >= 0 && diffDays < 7
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const current = parseISO(currentDayId)
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1)
    const newDayId = formatInTimeZone(newDate, timezone, 'yyyy-MM-dd')

    router.push(`/capture?day=${newDayId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!canEditDay()) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-2">Day Not Editable</h2>
          <p className="text-gray-300">
            You can only edit days within the last 7 days. This day is outside the edit window.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateDay('prev')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h1 className="text-3xl font-bold mb-1">{currentDayId}</h1>
            <p className="text-gray-400">
              {formatInTimeZone(parseISO(currentDayId), timezone, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <button
            onClick={() => navigateDay('next')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Completion Progress */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Completion</span>
            <span className="text-lg font-bold">{completionPct}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metrics */}
      {metrics.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">You haven&apos;t added any metrics yet.</p>
          <button
            onClick={() => router.push('/catalog')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {metric.emoji && <span className="text-2xl">{metric.emoji}</span>}
                  <h3 className="text-xl font-semibold">{metric.name}</h3>
                  {metric.is_required && (
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">Required</span>
                  )}
                </div>
                {metric.description && (
                  <p className="text-sm text-gray-400">{metric.description}</p>
                )}
              </div>

              <MetricInput
                metric={metric}
                value={entries[metric.id] || {}}
                onChange={(value) => handleEntryChange(metric.id, value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {metrics.length > 0 && (
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="flex-1 px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave('submitted')}
            disabled={isSaving}
            className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-600 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
