import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type {
  Metric,
  MetricType,
  MetricInsert,
  MetricUpdate,
  RatingConfig,
  NumberConfig,
  SelectConfig,
  TagsConfig,
} from '@/lib/supabase/types'
import { Json } from '@/lib/supabase/database.types'

/**
 * Metrics Service
 * Handles CRUD operations for user metrics with type-specific validation
 */
class MetricsService {
  /**
   * Get all active metrics for current user (server-side)
   * Sorted by order_index
   */
  async getActiveMetrics(userId: string): Promise<Metric[]> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching metrics:', error)
      throw new Error('Failed to fetch metrics')
    }

    return data || []
  }

  /**
   * Get all active metrics for current user (client-side)
   */
  async getActiveMetricsClient(): Promise<Metric[]> {
    const supabase = createBrowserClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching metrics:', error)
      throw new Error('Failed to fetch metrics')
    }

    return data || []
  }

  /**
   * Get all metrics (including archived) for current user
   */
  async getAllMetrics(userId: string): Promise<Metric[]> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching all metrics:', error)
      throw new Error('Failed to fetch metrics')
    }

    return data || []
  }

  /**
   * Get single metric by ID
   */
  async getMetric(userId: string, metricId: number): Promise<Metric | null> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('id', metricId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching metric:', error)
      throw new Error('Failed to fetch metric')
    }

    return data
  }

  /**
   * Create a new metric
   * Validates config based on metric type
   */
  async createMetric(userId: string, metric: MetricInsert): Promise<Metric> {
    // Validate config before inserting
    this.validateMetricConfig(metric.type as MetricType, metric.config || {})

    const supabase = await createServerSupabaseClient()

    // Get current max order_index
    const { data: maxOrderData } = await supabase
      .from('metrics')
      .select('order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrderIndex = (maxOrderData?.order_index ?? -1) + 1

    const { data, error } = await supabase
      .from('metrics')
      .insert({
        ...metric,
        user_id: userId,
        order_index: nextOrderIndex,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating metric:', error)
      throw new Error('Failed to create metric')
    }

    return data
  }

  /**
   * Update an existing metric
   * Validates config if type or config changes
   */
  async updateMetric(
    userId: string,
    metricId: number,
    updates: MetricUpdate
  ): Promise<Metric> {
    const supabase = await createServerSupabaseClient()

    // If type or config is being updated, validate
    if (updates.type || updates.config) {
      const existing = await this.getMetric(userId, metricId)
      if (!existing) {
        throw new Error('Metric not found')
      }

      const finalType = updates.type || existing.type
      const finalConfig = updates.config || existing.config

      this.validateMetricConfig(finalType as MetricType, finalConfig as Json)
    }

    const { data, error } = await supabase
      .from('metrics')
      .update(updates)
      .eq('id', metricId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating metric:', error)
      throw new Error('Failed to update metric')
    }

    return data
  }

  /**
   * Archive a metric (soft delete)
   */
  async archiveMetric(userId: string, metricId: number): Promise<void> {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('metrics')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', metricId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error archiving metric:', error)
      throw new Error('Failed to archive metric')
    }
  }

  /**
   * Unarchive a metric
   */
  async unarchiveMetric(userId: string, metricId: number): Promise<void> {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('metrics')
      .update({ archived_at: null })
      .eq('id', metricId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error unarchiving metric:', error)
      throw new Error('Failed to unarchive metric')
    }
  }

  /**
   * Permanently delete a metric
   */
  async deleteMetric(userId: string, metricId: number): Promise<void> {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('metrics')
      .delete()
      .eq('id', metricId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting metric:', error)
      throw new Error('Failed to delete metric')
    }
  }

  /**
   * Reorder metrics
   * Updates order_index for multiple metrics
   */
  async reorderMetrics(
    userId: string,
    metricIds: number[]
  ): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Update each metric with new order_index
    const updates = metricIds.map((id, index) =>
      supabase
        .from('metrics')
        .update({ order_index: index })
        .eq('id', id)
        .eq('user_id', userId)
    )

    const results = await Promise.all(updates)

    const errors = results.filter(({ error }) => error)
    if (errors.length > 0) {
      console.error('Error reordering metrics:', errors)
      throw new Error('Failed to reorder metrics')
    }
  }

  /**
   * Validate metric config based on type
   * Throws error if invalid
   */
  private validateMetricConfig(type: MetricType, config: Json): void {
    switch (type) {
      case 'boolean':
        // Boolean metrics have no config
        break

      case 'rating':
        const ratingConfig = config as unknown as RatingConfig
        if (!ratingConfig.scaleMin || !ratingConfig.scaleMax) {
          throw new Error('Rating metric requires scaleMin and scaleMax')
        }
        if (ratingConfig.scaleMin >= ratingConfig.scaleMax) {
          throw new Error('scaleMin must be less than scaleMax')
        }
        break

      case 'number':
        const numberConfig = config as unknown as NumberConfig
        if (numberConfig.min !== undefined && numberConfig.max !== undefined) {
          if (numberConfig.min >= numberConfig.max) {
            throw new Error('min must be less than max')
          }
        }
        break

      case 'select':
        const selectConfig = config as unknown as SelectConfig
        if (!selectConfig.options || selectConfig.options.length === 0) {
          throw new Error('Select metric requires at least one option')
        }
        // Validate each option has key and label
        selectConfig.options.forEach((opt, index) => {
          if (!opt.key || !opt.label) {
            throw new Error(`Option ${index} missing key or label`)
          }
        })
        break

      case 'tags':
        const tagsConfig = config as unknown as TagsConfig
        if (!tagsConfig.options || tagsConfig.options.length === 0) {
          throw new Error('Tags metric requires at least one option')
        }
        // Validate each option has key and label
        tagsConfig.options.forEach((opt, index) => {
          if (!opt.key || !opt.label) {
            throw new Error(`Option ${index} missing key or label`)
          }
        })
        break

      case 'notes':
        // Notes metrics have no config
        break

      default:
        throw new Error(`Unknown metric type: ${type}`)
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService()
