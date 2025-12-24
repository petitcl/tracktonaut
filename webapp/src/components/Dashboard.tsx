'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Metric, TimeRange } from '@/lib/supabase/types'
import type { DataPoint, TagFrequency } from '@/services/dashboard.service'
import { formatInTimeZone } from 'date-fns-tz'
import { subDays, subMonths } from 'date-fns'
import { WordCloud } from './WordCloud'

interface DashboardProps {
  userId: string
}

interface NotePreview {
  dayId: string
  text: string
}

interface MetricStats {
  metric: Metric
  current: number | null
  average: number | null
  min: number | null
  max: number | null
  trend: 'up' | 'down' | 'stable' | null
  dataPoints: DataPoint[]
  completionRate: number
  tagFrequencies?: TagFrequency[]
  notePreviews?: NotePreview[]
}

interface DashboardSummary {
  totalMetrics: number
  activeMetrics: number
  currentStreak: number
  completionRate: number
  metricStats: MetricStats[]
}

export function Dashboard({ userId }: DashboardProps) {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = createClient()

        // Get user timezone
        const { data: profile } = await supabase
          .from('profiles')
          .select('primary_tz')
          .eq('user_id', userId)
          .single()

        const userTz = profile?.primary_tz || Intl.DateTimeFormat().resolvedOptions().timeZone

        // Calculate date range
        const today = new Date()
        const endDayId = formatInTimeZone(today, userTz, 'yyyy-MM-dd')

        let startDate: Date
        switch (timeRange) {
          case '7d':
            startDate = subDays(today, 6)
            break
          case '1M':
            startDate = subDays(today, 29)
            break
          case '6M':
            startDate = subMonths(today, 6)
            break
          case '1Y':
            startDate = subMonths(today, 12)
            break
        }
        const startDayId = formatInTimeZone(startDate, userTz, 'yyyy-MM-dd')

        // Fetch metrics, check-ins, and entries
        const [metricsResult, checkinsResult, entriesResult] = await Promise.all([
          supabase
            .from('metrics')
            .select('*')
            .eq('user_id', userId)
            .is('archived_at', null)
            .order('order_index', { ascending: true }),
          supabase
            .from('daily_checkin')
            .select('*')
            .eq('user_id', userId)
            .gte('day_id', startDayId)
            .lte('day_id', endDayId)
            .order('day_id', { ascending: false }),
          supabase
            .from('metric_entry')
            .select('*')
            .eq('user_id', userId)
            .gte('day_id', startDayId)
            .lte('day_id', endDayId)
        ])

        if (metricsResult.error) throw metricsResult.error

        const metrics = metricsResult.data || []
        const checkins = checkinsResult.data || []
        const allEntries = entriesResult.data || []

        // Calculate stats for each metric
        const metricStats: MetricStats[] = await Promise.all(
          metrics.map(async (metric) => {
            const entries = allEntries.filter((e) => e.metric_id === metric.id)
            const values = entries.map((e) => extractNumericValue(e, metric.type)).filter((v) => v !== null) as number[]

            const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
            const min = values.length > 0 ? Math.min(...values) : null
            const max = values.length > 0 ? Math.max(...values) : null
            const current = entries.length > 0 ? extractNumericValue(entries[entries.length - 1], metric.type) : null

            const trend = calculateTrend(values)

            // Create sparse data points
            const dataPoints = createDataPoints(entries, metric.type, startDayId, endDayId, userTz)

            const totalDays = countDaysBetween(startDayId, endDayId)
            const completionRate = totalDays > 0 ? (entries.length / totalDays) * 100 : 0

            // Calculate tag frequencies for tags metrics
            let tagFrequencies: TagFrequency[] | undefined
            if (metric.type === 'tags') {
              tagFrequencies = calculateTagFrequencies(entries, metric)
            }

            // Extract note previews for notes metrics
            let notePreviews: NotePreview[] | undefined
            if (metric.type === 'notes') {
              notePreviews = extractNotePreviews(entries)
            }

            return {
              metric,
              current,
              average,
              min,
              max,
              trend,
              dataPoints,
              completionRate,
              tagFrequencies,
              notePreviews,
            }
          })
        )

        // Calculate streak (simplified client-side version)
        const streak = 0 // TODO: Implement streak calculation

        // Calculate completion rate
        const totalDays = countDaysBetween(startDayId, endDayId)
        const submittedDays = checkins.filter((c) => c.status === 'submitted').length
        const completionRate = totalDays > 0 ? (submittedDays / totalDays) * 100 : 0

        setSummary({
          totalMetrics: metrics.length,
          activeMetrics: metrics.length,
          currentStreak: streak,
          completionRate,
          metricStats,
        })
      } catch (err) {
        console.error('Error loading dashboard:', err)
        setError('Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [userId, timeRange])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-6">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <button
          onClick={() => router.push('/capture')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          + Log Today
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Active Metrics</p>
          <p className="text-3xl font-bold">{summary.activeMetrics}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Current Streak</p>
          <p className="text-3xl font-bold">{summary.currentStreak} days</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Completion Rate</p>
          <p className="text-3xl font-bold">{Math.round(summary.completionRate)}%</p>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-6">
        {(['7d', '1M', '6M', '1Y'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
            `}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      {summary.metricStats.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-xl text-gray-400 mb-4">No metrics yet</p>
          <button
            onClick={() => router.push('/catalog')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {summary.metricStats.map((stats) => (
            <MetricCard key={stats.metric.id} stats={stats} />
          ))}
        </div>
      )}
    </div>
  )
}

function MetricCard({ stats }: { stats: MetricStats }) {
  const router = useRouter()
  const { metric, current, average, trend, dataPoints, tagFrequencies, notePreviews } = stats

  // For tags metrics, render word cloud instead of numeric visualization
  const isTagsMetric = metric.type === 'tags'
  const isNotesMetric = metric.type === 'notes'

  const handleCardClick = () => {
    router.push(`/dashboard/metrics/${metric.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {metric.emoji && <span className="text-2xl">{metric.emoji}</span>}
          <h3 className="font-semibold">{metric.name}</h3>
        </div>
        {!isTagsMetric && !isNotesMetric && trend && (
          <span className={`text-sm ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>

      {isTagsMetric && tagFrequencies ? (
        <>
          {/* Word Cloud for Tags Metrics */}
          <div className="mb-4">
            <WordCloud tagFrequencies={tagFrequencies} />
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Total Tags</p>
              <p className="font-semibold">{tagFrequencies.reduce((sum, t) => sum + t.count, 0)}</p>
            </div>
            <div>
              <p className="text-gray-500">Rate</p>
              <p className="font-semibold">{Math.round(stats.completionRate)}%</p>
            </div>
          </div>
        </>
      ) : isNotesMetric && notePreviews ? (
        <>
          {/* Notes Preview List */}
          {notePreviews.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              No notes yet
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {notePreviews.map((note) => (
                <div key={note.dayId} className="border-l-2 border-blue-500 pl-3">
                  <p className="text-xs text-gray-500 mb-1">{note.dayId}</p>
                  <p className="text-sm text-gray-300">{note.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Total Notes</p>
              <p className="font-semibold">{notePreviews.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Rate</p>
              <p className="font-semibold">{Math.round(stats.completionRate)}%</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Current Value */}
          <div className="mb-4">
            <p className="text-sm text-gray-400">Current</p>
            <p className="text-3xl font-bold">{current !== null ? current.toFixed(1) : '—'}</p>
          </div>

          {/* Mini Sparkline */}
          <div className="h-16 mb-4">
            <Sparkline dataPoints={dataPoints} />
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Avg</p>
              <p className="font-semibold">{average !== null ? average.toFixed(1) : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Rate</p>
              <p className="font-semibold">{Math.round(stats.completionRate)}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Sparkline({ dataPoints }: { dataPoints: DataPoint[] }) {
  if (dataPoints.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-600">No data</div>
  }

  const values = dataPoints.map((dp) => dp.value).filter((v) => v !== null) as number[]
  if (values.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-600">No data</div>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = dataPoints.map((dp, i) => {
    const x = (i / (dataPoints.length - 1)) * 100
    const y = dp.value !== null ? 100 - ((dp.value - min) / range) * 100 : null
    return { x, y }
  })

  const pathData = points
    .filter((p) => p.y !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
    .join(' ')

  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
    </svg>
  )
}

// Helper functions
function extractNumericValue(entry: { bool_value: boolean | null, int_value: number | null, float_value: number | null, text_value: string | null, select_key: string | null, tag_keys: string[] | null }, type: string): number | null {
  switch (type) {
    case 'boolean':
      return entry.bool_value !== null ? (entry.bool_value ? 1 : 0) : null
    case 'rating':
      return entry.int_value
    case 'number':
      return entry.float_value
    case 'tags':
      return entry.tag_keys ? entry.tag_keys.length : null
    case 'notes':
      return entry.text_value ? entry.text_value.length : null
    default:
      return null
  }
}

function calculateTrend(values: number[]): 'up' | 'down' | 'stable' | null {
  if (values.length < 4) return null

  const midpoint = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, midpoint)
  const secondHalf = values.slice(midpoint)

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length

  const change = secondAvg - firstAvg
  const changePercent = (change / firstAvg) * 100

  if (Math.abs(changePercent) < 5) return 'stable'
  return change > 0 ? 'up' : 'down'
}

function createDataPoints(
  entries: { day_id: string; bool_value: boolean | null; int_value: number | null; float_value: number | null; text_value: string | null; select_key: string | null; tag_keys: string[] | null }[],
  type: string,
  startDayId: string,
  endDayId: string,
  timezone: string
): DataPoint[] {
  const entryMap = new Map(entries.map((e) => [e.day_id, e]))
  const dataPoints: DataPoint[] = []

  const start = new Date(startDayId)
  const end = new Date(endDayId)

  let current = start
  while (current <= end) {
    const dayId = formatInTimeZone(current, timezone, 'yyyy-MM-dd')
    const entry = entryMap.get(dayId)

    dataPoints.push({
      dayId,
      value: entry ? extractNumericValue(entry, type) : null,
    })

    current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
  }

  return dataPoints
}

function countDaysBetween(startDayId: string, endDayId: string): number {
  const start = new Date(startDayId)
  const end = new Date(endDayId)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1
}

function calculateTagFrequencies(
  entries: { tag_keys: string[] | null }[],
  metric: Metric
): TagFrequency[] {
  // Get tag options from config
  const config = metric.config as { options?: Array<{ key: string; label: string }> }
  const tagOptions = config?.options || []

  // Count occurrences of each tag
  const frequencyMap = new Map<string, number>()

  // Initialize all tags with 0
  tagOptions.forEach((option) => {
    frequencyMap.set(option.key, 0)
  })

  // Count tag occurrences across all entries
  entries.forEach((entry) => {
    const tagKeys = entry.tag_keys || []
    tagKeys.forEach((key) => {
      const currentCount = frequencyMap.get(key) || 0
      frequencyMap.set(key, currentCount + 1)
    })
  })

  // Convert to array and include labels, filter out zero counts
  const frequencies: TagFrequency[] = tagOptions
    .map((option) => ({
      key: option.key,
      label: option.label,
      count: frequencyMap.get(option.key) || 0,
    }))
    .filter((freq) => freq.count > 0) // Only include tags that were actually used
    .sort((a, b) => b.count - a.count) // Sort by count descending

  return frequencies
}

function extractNotePreviews(
  entries: { day_id: string; text_value: string | null }[]
): NotePreview[] {
  return entries
    .filter((entry) => {
      const text = entry.text_value
      // Filter out null, empty, and whitespace-only notes
      return text !== null && text.trim() !== ''
    })
    .sort((a, b) => b.day_id.localeCompare(a.day_id)) // Most recent first
    .slice(0, 5) // Take only 5 most recent
    .map((entry) => ({
      dayId: entry.day_id,
      text: entry.text_value!.substring(0, 100), // Truncate to 100 chars
    }))
}
