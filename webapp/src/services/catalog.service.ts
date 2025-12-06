import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { Json, Tables } from '@/lib/supabase/database.types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Metric, MetricInsert } from '@/lib/supabase/types'

/**
 * Catalog metric type (from catalog_metrics table)
 */
export type CatalogMetric = Tables<'catalog_metrics'>

/**
 * Catalog Service
 * Handles browsing and installing metrics from the seed catalog
 */
class CatalogService {
  /**
   * Get all catalog metrics (server-side)
   * Sorted by order_index
   */
  async getCatalogMetrics(): Promise<CatalogMetric[]> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('catalog_metrics')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching catalog metrics:', error)
      throw new Error('Failed to fetch catalog metrics')
    }

    return data || []
  }

  /**
   * Get all catalog metrics (client-side)
   */
  async getCatalogMetricsClient(): Promise<CatalogMetric[]> {
    const supabase = createBrowserClient()

    const { data, error } = await supabase
      .from('catalog_metrics')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching catalog metrics:', error)
      throw new Error('Failed to fetch catalog metrics')
    }

    return data || []
  }

  /**
   * Install a catalog metric for user
   * Copies catalog metric to user's metrics table
   */
  async installMetric(
    userId: string,
    catalogMetricId: number
  ): Promise<Metric> {
    const supabase = await createServerSupabaseClient()

    // Get catalog metric
    const catalogResult = await supabase
      .from('catalog_metrics')
      .select('*')
      .eq('id', catalogMetricId)
      .maybeSingle()

    if (catalogResult.error || !catalogResult.data) {
      console.error('Error fetching catalog metric:', catalogResult.error)
      throw new Error('Catalog metric not found')
    }

    // Type assertion needed due to TypeScript control flow limitations
    const catalogMetric = catalogResult.data as CatalogMetric
    const catalogName = catalogMetric.name

    // Check if user already has this metric
    const { data: existing } = await supabase
      .from('metrics')
      .select('id')
      .eq('user_id', userId)
      .eq('name', catalogName)
      .is('archived_at', null)
      .maybeSingle()

    if (existing) {
      throw new Error('You already have this metric installed')
    }

    // Get current max order_index
    const maxOrderResult = await supabase
      .from('metrics')
      .select('order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const maxOrder = maxOrderResult.data as { order_index: number } | null
    const nextOrderIndex = (maxOrder?.order_index ?? -1) + 1

    // Create new metric from catalog
    const newMetric: MetricInsert = {
      user_id: userId,
      name: catalogMetric.name,
      description: catalogMetric.description,
      type: catalogMetric.type as MetricInsert['type'],
      emoji: catalogMetric.emoji,
      direction: catalogMetric.direction as MetricInsert['direction'],
      is_required: catalogMetric.is_required,
      order_index: nextOrderIndex,
      config: catalogMetric.config as Json,
    }

    const { data: createdMetric, error: createError } = await supabase
      .from('metrics')
      .insert([newMetric])
      .select()
      .single()

    if (createError) {
      console.error('Error installing metric:', createError)
      throw new Error('Failed to install metric')
    }

    return createdMetric
  }

  /**
   * Install multiple catalog metrics at once
   * Useful for first-time setup
   */
  async installMultipleMetrics(
    userId: string,
    catalogMetricIds: number[]
  ): Promise<Metric[]> {
    const results: Metric[] = []

    for (const catalogMetricId of catalogMetricIds) {
      try {
        const metric = await this.installMetric(userId, catalogMetricId)
        results.push(metric)
      } catch (error) {
        console.error(`Failed to install metric ${catalogMetricId}:`, error)
        // Continue installing other metrics even if one fails
      }
    }

    return results
  }

  /**
   * Get catalog metrics that user hasn't installed yet
   */
  async getAvailableCatalogMetrics(userId: string): Promise<CatalogMetric[]> {
    const supabase = await createServerSupabaseClient()

    // Get all catalog metrics
    const { data: catalogMetrics, error: catalogError } = await supabase
      .from('catalog_metrics')
      .select('*')
      .order('order_index', { ascending: true })

    if (catalogError) {
      console.error('Error fetching catalog metrics:', catalogError)
      throw new Error('Failed to fetch catalog metrics')
    }

    // Get user's active metrics
    const { data: userMetrics, error: userError } = await supabase
      .from('metrics')
      .select('name')
      .eq('user_id', userId)
      .is('archived_at', null)

    if (userError) {
      console.error('Error fetching user metrics:', userError)
      throw new Error('Failed to fetch user metrics')
    }

    const installedNames = new Set(userMetrics?.map((m) => m.name) || [])

    // Filter out already installed metrics
    return catalogMetrics?.filter((cm) => !installedNames.has(cm.name)) || []
  }
}

// Export singleton instance
export const catalogService = new CatalogService()
