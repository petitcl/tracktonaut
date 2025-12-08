import { redirect } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { Settings } from '@/components/Settings'
import { Navigation } from '@/components/Navigation'

export default async function SettingsPage() {
  const user = await authService.getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <main>
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Settings</h1>
            <p className="text-gray-400">
              Manage your timezone, language, and notification preferences
            </p>
          </div>

          <Settings userId={user.id} />
        </div>
      </main>
    </div>
  )
}
