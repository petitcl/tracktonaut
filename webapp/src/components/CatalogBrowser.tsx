'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type CatalogMetric = Tables<'catalog_metrics'>

interface CatalogBrowserProps {
  userId: string
}

export function CatalogBrowser({ userId }: CatalogBrowserProps) {
  const router = useRouter()
  const [catalogMetrics, setCatalogMetrics] = useState<CatalogMetric[]>([])
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCatalog() {
      try {
        const supabase = createClient()

        // Fetch catalog metrics
        const { data: catalogData, error: catalogError } = await supabase
          .from('catalog_metrics')
          .select('*')
          .order('order_index', { ascending: true })

        if (catalogError) throw catalogError

        setCatalogMetrics(catalogData || [])

        // Fetch user's installed metrics
        const { data: userMetrics, error: userError } = await supabase
          .from('metrics')
          .select('name')
          .eq('user_id', userId)
          .is('archived_at', null)

        if (userError) throw userError

        setInstalledNames(new Set(userMetrics?.map((m) => m.name) || []))
      } catch (err) {
        console.error('Error loading catalog:', err)
        setError('Failed to load catalog')
      } finally {
        setIsLoading(false)
      }
    }

    loadCatalog()
  }, [userId])

  const installMetric = async (catalogMetricId: number, metricName: string) => {
    setInstalling((prev) => new Set(prev).add(catalogMetricId))
    setError(null)

    try {
      const supabase = createClient()

      // Get catalog metric
      const { data: catalogMetric, error: fetchError } = await supabase
        .from('catalog_metrics')
        .select('*')
        .eq('id', catalogMetricId)
        .single()

      if (fetchError || !catalogMetric) {
        throw new Error('Catalog metric not found')
      }

      // Get current max order_index
      const { data: maxOrderData } = await supabase
        .from('metrics')
        .select('order_index')
        .eq('user_id', userId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextOrderIndex = (maxOrderData?.order_index ?? -1) + 1

      // Create new metric from catalog
      const { error: createError } = await supabase
        .from('metrics')
        .insert({
          user_id: userId,
          name: catalogMetric.name,
          description: catalogMetric.description,
          type: catalogMetric.type,
          emoji: catalogMetric.emoji,
          direction: catalogMetric.direction,
          is_required: catalogMetric.is_required,
          order_index: nextOrderIndex,
          config: catalogMetric.config,
        })

      if (createError) throw createError

      // Update installed names
      setInstalledNames((prev) => new Set(prev).add(metricName))
    } catch (err: unknown) {
      console.error('Error installing metric:', err)
      setError(err instanceof Error ? err.message : 'Failed to install metric')
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev)
        next.delete(catalogMetricId)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const availableMetrics = catalogMetrics.filter((m) => !installedNames.has(m.name))
  const installedCount = catalogMetrics.length - availableMetrics.length

  return (
    <div>
      {/* Status */}
      <div className="mb-6 flex items-center justify-between bg-gray-800 rounded-lg p-4">
        <div>
          <p className="text-sm text-gray-400">Installed Metrics</p>
          <p className="text-2xl font-bold">
            {installedCount} / {catalogMetrics.length}
          </p>
        </div>
        {installedCount === catalogMetrics.length && (
          <span className="text-green-500 font-semibold">✓ All installed!</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-600 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Catalog Grid */}
      {availableMetrics.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-xl text-gray-400 mb-4">
            You&apos;ve installed all available metrics!
          </p>
          <button
            onClick={() => router.push('/capture')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Start Tracking
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableMetrics.map((metric) => (
            <div
              key={metric.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {metric.emoji && <span className="text-3xl">{metric.emoji}</span>}
                  <div>
                    <h3 className="text-lg font-bold">{metric.name}</h3>
                    <span className="text-xs text-gray-500 uppercase">{metric.type}</span>
                  </div>
                </div>
                {metric.is_required && (
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">Required</span>
                )}
              </div>

              {metric.description && (
                <p className="text-sm text-gray-400 mb-4">{metric.description}</p>
              )}

              <button
                onClick={() => installMetric(metric.id, metric.name)}
                disabled={installing.has(metric.id)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing.has(metric.id) ? 'Installing...' : '+ Install'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      {installedCount > 0 && (
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => router.push('/metrics')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Manage Metrics
          </button>
          <button
            onClick={() => router.push('/capture')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Start Tracking
          </button>
        </div>
      )}
    </div>
  )
}
