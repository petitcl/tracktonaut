import { redirect } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { MetricsManager } from '@/components/MetricsManager'
import { Navigation } from '@/components/Navigation'

export default async function MetricsPage() {
  const user = await authService.getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <main>
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Manage Metrics</h1>
            <p className="text-gray-400">
              Customize, reorder, and archive your tracking metrics
            </p>
          </div>

          <MetricsManager userId={user.id} />
        </div>
      </main>
    </div>
  )
}
