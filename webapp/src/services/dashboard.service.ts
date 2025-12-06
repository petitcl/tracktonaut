import type { Metric, MetricEntry, TimeRange } from '@/lib/supabase/types'
import { checkinService } from './checkin.service'
import { metricsService } from './metrics.service'
import { subDays, subMonths, parseISO } from 'date-fns'

/**
 * Metric statistics for a time range
 */
export interface MetricStats {
  metric: Metric
  current: number | null // Most recent value
  average: number | null // Average over range
  min: number | null
  max: number | null
  trend: 'up' | 'down' | 'stable' | null // Trend direction
  dataPoints: DataPoint[] // For sparkline
  completionRate: number // % of days with data
}

/**
 * Data point for charts
 */
export interface DataPoint {
  dayId: string
  value: number | null
}

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
  totalMetrics: number
  activeMetrics: number
  currentStreak: number
  completionRate: number // % of days submitted in range
  metricStats: MetricStats[]
}

/**
 * Dashboard Service
 * Handles data aggregation and analytics calculations for dashboard
 */
class DashboardService {
  /**
   * Get date range for time range selector
   */
  getDateRange(range: TimeRange, timezone: string): { startDayId: string; endDayId: string } {
    const today = new Date()
    const endDayId = checkinService.getDayId(today, timezone)

    let startDate: Date

    switch (range) {
      case '7d':
        startDate = subDays(today, 6) // 7 days including today
        break
      case '1M':
        startDate = subDays(today, 29) // 30 days including today
        break
      case '6M':
        startDate = subMonths(today, 6)
        break
      case '1Y':
        startDate = subMonths(today, 12)
        break
    }

    const startDayId = checkinService.getDayId(startDate, timezone)

    return { startDayId, endDayId }
  }

  /**
   * Calculate statistics for a metric over a time range
   */
  async getMetricStats(
    userId: string,
    metric: Metric,
    startDayId: string,
    endDayId: string
  ): Promise<MetricStats> {
    // Get entries for this metric in range
    const entries = await checkinService.getMetricEntries(
      userId,
      metric.id,
      startDayId,
      endDayId
    )

    // Extract numeric values based on metric type
    const values = entries
      .map((e) => this.extractNumericValue(e, metric.type))
      .filter((v) => v !== null) as number[]

    // Calculate statistics
    const average = values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : null

    const min = values.length > 0 ? Math.min(...values) : null
    const max = values.length > 0 ? Math.max(...values) : null

    const current = entries.length > 0
      ? this.extractNumericValue(entries[entries.length - 1], metric.type)
      : null

    // Calculate trend (compare first half vs second half average)
    const trend = this.calculateTrend(values)

    // Create data points for sparkline
    const dataPoints = this.createDataPoints(entries, metric.type, startDayId, endDayId)

    // Calculate completion rate
    const totalDays = this.countDaysBetween(startDayId, endDayId)
    const completionRate = totalDays > 0 ? (entries.length / totalDays) * 100 : 0

    return {
      metric,
      current,
      average,
      min,
      max,
      trend,
      dataPoints,
      completionRate,
    }
  }

  /**
   * Get dashboard summary for a time range
   */
  async getDashboardSummary(
    userId: string,
    range: TimeRange,
    timezone: string
  ): Promise<DashboardSummary> {
    const { startDayId, endDayId } = this.getDateRange(range, timezone)

    // Get active metrics
    const metrics = await metricsService.getActiveMetrics(userId)

    // Get check-ins for range
    const checkins = await checkinService.getCheckinRange(userId, startDayId, endDayId)

    // Calculate current streak
    const currentStreak = await checkinService.getCompletionStreak(userId, timezone)

    // Calculate completion rate
    const totalDays = this.countDaysBetween(startDayId, endDayId)
    const submittedDays = checkins.filter((c) => c.status === 'submitted').length
    const completionRate = totalDays > 0 ? (submittedDays / totalDays) * 100 : 0

    // Get stats for each metric
    const metricStats = await Promise.all(
      metrics.map((metric) =>
        this.getMetricStats(userId, metric, startDayId, endDayId)
      )
    )

    return {
      totalMetrics: metrics.length,
      activeMetrics: metrics.length,
      currentStreak,
      completionRate,
      metricStats,
    }
  }

  /**
   * Extract numeric value from metric entry based on type
   * Returns null for non-numeric types or missing values
   */
  private extractNumericValue(entry: MetricEntry, type: string): number | null {
    switch (type) {
      case 'boolean':
        return entry.bool_value !== null ? (entry.bool_value ? 1 : 0) : null
      case 'rating':
        return entry.int_value
      case 'number':
        return entry.float_value
      case 'select':
        // For select, we can't easily convert to number without knowing order
        // Return null for now
        return null
      case 'tags':
        // Return count of tags
        return entry.tag_keys ? entry.tag_keys.length : null
      case 'notes':
        // Return length of notes
        return entry.text_value ? entry.text_value.length : null
      default:
        return null
    }
  }

  /**
   * Calculate trend direction
   * Compares first half average to second half average
   */
  private calculateTrend(
    values: number[]
  ): 'up' | 'down' | 'stable' | null {
    if (values.length < 4) {
      return null // Not enough data for trend
    }

    const midpoint = Math.floor(values.length / 2)
    const firstHalf = values.slice(0, midpoint)
    const secondHalf = values.slice(midpoint)

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length

    const change = secondAvg - firstAvg
    const changePercent = (change / firstAvg) * 100

    // Consider stable if change < 5%
    if (Math.abs(changePercent) < 5) {
      return 'stable'
    }

    // For positive direction metrics, up is good
    // For negative direction metrics, down is good
    return change > 0 ? 'up' : 'down'
  }

  /**
   * Create data points for sparkline
   * Fills in missing days with null
   */
  private createDataPoints(
    entries: MetricEntry[],
    type: string,
    startDayId: string,
    endDayId: string
  ): DataPoint[] {
    const entryMap = new Map<string, MetricEntry>()
    entries.forEach((e) => entryMap.set(e.day_id, e))

    const dataPoints: DataPoint[] = []
    const start = parseISO(startDayId)
    const end = parseISO(endDayId)

    let current = start
    while (current <= end) {
      const dayId = checkinService.getDayId(current, 'UTC') // Use UTC for iteration
      const entry = entryMap.get(dayId)

      dataPoints.push({
        dayId,
        value: entry ? this.extractNumericValue(entry, type) : null,
      })

      current = subDays(current, -1) // Add 1 day
    }

    return dataPoints
  }

  /**
   * Count number of days between two day_ids (inclusive)
   */
  private countDaysBetween(startDayId: string, endDayId: string): number {
    const start = parseISO(startDayId)
    const end = parseISO(endDayId)

    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays + 1 // Inclusive
  }

  /**
   * Get aggregated data for a specific metric (for detailed metric view)
   */
  async getMetricDetail(
    userId: string,
    metricId: number,
    range: TimeRange,
    timezone: string
  ): Promise<MetricStats | null> {
    const metric = await metricsService.getMetric(userId, metricId)
    if (!metric) {
      return null
    }

    const { startDayId, endDayId } = this.getDateRange(range, timezone)
    return this.getMetricStats(userId, metric, startDayId, endDayId)
  }
}

// Export singleton instance
export const dashboardService = new DashboardService()
