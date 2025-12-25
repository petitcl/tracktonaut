import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/services/auth.service'
import { metricsService } from '@/services/metrics.service'
import { checkinService } from '@/services/checkin.service'
import { Navigation } from '@/components/Navigation'

interface PageProps {
  params: Promise<{
    metric_id: string
  }>
}

export default async function MetricDetailPage({ params }: PageProps) {
  const user = await authService.getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { metric_id } = await params
  const metricId = parseInt(metric_id, 10)

  if (isNaN(metricId)) {
    redirect('/')
  }

  // Fetch metric
  const metric = await metricsService.getMetric(user.id, metricId)

  if (!metric) {
    redirect('/')
  }

  // Fetch all entries for this metric (no time range filter)
  const entries = await checkinService.getMetricEntries(
    user.id,
    metricId,
    '1970-01-01', // Start from beginning of time
    '2099-12-31'  // Far future end date
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <main>
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <div className="flex items-center gap-3 mb-2">
              {metric.emoji && <span className="text-4xl">{metric.emoji}</span>}
              <h1 className="text-4xl font-bold">{metric.name}</h1>
            </div>
            {metric.description && (
              <p className="text-gray-400">{metric.description}</p>
            )}
          </div>

          {/* Metric Type Specific Content */}
          {metric.type === 'notes' ? (
            <NotesView entries={entries} />
          ) : (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <p className="text-gray-400">
                Detailed view for {metric.type} metrics coming soon
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

interface NotesViewProps {
  entries: Array<{
    day_id: string
    text_value: string | null
  }>
}

function NotesView({ entries }: NotesViewProps) {
  // Filter out empty notes and sort by date descending (most recent first)
  const notes = entries
    .filter((entry) => {
      const text = entry.text_value
      return text !== null && text.trim() !== ''
    })
    .sort((a, b) => b.day_id.localeCompare(a.day_id))

  if (notes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center">
        <p className="text-gray-400 text-lg">No notes yet</p>
        <p className="text-gray-500 text-sm mt-2">
          Start tracking to see your notes here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">All Notes</h2>
        <p className="text-gray-400">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {notes.map((note) => (
        <div
          key={note.day_id}
          className="bg-gray-800 rounded-lg p-6 border border-gray-700"
        >
          <p className="text-sm text-gray-500 mb-3">{note.day_id}</p>
          <p className="text-gray-200 whitespace-pre-wrap">{note.text_value}</p>
        </div>
      ))}
    </div>
  )
}
