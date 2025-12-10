'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Metric } from '@/lib/supabase/types'

interface MetricsManagerProps {
  userId: string
}

export function MetricsManager({ userId }: MetricsManagerProps) {
  const [activeMetrics, setActiveMetrics] = useState<Metric[]>([])
  const [archivedMetrics, setArchivedMetrics] = useState<Metric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const loadMetrics = useCallback(async () => {
    try {
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('metrics')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError

      const active = data?.filter((m) => !m.archived_at) || []
      const archived = data?.filter((m) => m.archived_at) || []

      setActiveMetrics(active)
      setArchivedMetrics(archived)
    } catch (err) {
      console.error('Error loading metrics:', err)
      setError('Failed to load metrics')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  async function archiveMetric(metricId: number) {
    try {
      const supabase = createClient()

      const { error: archiveError } = await supabase
        .from('metrics')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', metricId)
        .eq('user_id', userId)

      if (archiveError) throw archiveError

      await loadMetrics()
    } catch (err) {
      console.error('Error archiving metric:', err)
      setError('Failed to archive metric')
    }
  }

  async function unarchiveMetric(metricId: number) {
    try {
      const supabase = createClient()

      const { error: unarchiveError } = await supabase
        .from('metrics')
        .update({ archived_at: null })
        .eq('id', metricId)
        .eq('user_id', userId)

      if (unarchiveError) throw unarchiveError

      await loadMetrics()
    } catch (err) {
      console.error('Error unarchiving metric:', err)
      setError('Failed to unarchive metric')
    }
  }

  async function updateRequired(metricId: number, isRequired: boolean) {
    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from('metrics')
        .update({ is_required: isRequired })
        .eq('id', metricId)
        .eq('user_id', userId)

      if (updateError) throw updateError

      await loadMetrics()
    } catch (err) {
      console.error('Error updating metric:', err)
      setError('Failed to update metric')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-600 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Active Metrics */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Active Metrics ({activeMetrics.length})</h2>
        </div>

        {activeMetrics.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No active metrics</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeMetrics.map((metric) => (
              <div
                key={metric.id}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {metric.emoji && <span className="text-2xl">{metric.emoji}</span>}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{metric.name}</h3>
                      <span className="text-xs text-gray-500 uppercase">{metric.type}</span>
                      {metric.is_required && (
                        <span className="text-xs bg-blue-600 px-2 py-1 rounded">Required</span>
                      )}
                    </div>
                    {metric.description && (
                      <p className="text-sm text-gray-400">{metric.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateRequired(metric.id, !metric.is_required)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    title="Edit metric settings"
                    aria-label="Edit metric settings"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => archiveMetric(metric.id)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    title="Archive metric"
                    aria-label="Archive metric"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archived Metrics */}
      {archivedMetrics.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 mb-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold">Archived Metrics ({archivedMetrics.length})</span>
          </button>

          {showArchived && (
            <div className="space-y-2">
              {archivedMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex items-center justify-between opacity-60"
                >
                  <div className="flex items-center gap-4">
                    {metric.emoji && <span className="text-2xl">{metric.emoji}</span>}
                    <div>
                      <h3 className="font-semibold">{metric.name}</h3>
                      {metric.description && (
                        <p className="text-sm text-gray-400">{metric.description}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => unarchiveMetric(metric.id)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                  >
                    Unarchive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
