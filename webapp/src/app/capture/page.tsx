import { redirect } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { CaptureInterface } from '@/components/CaptureInterface'
import { Navigation } from '@/components/Navigation'

export default async function CapturePage() {
  // Check authentication
  const user = await authService.getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <main>
        <CaptureInterface userId={user.id} />
      </main>
    </div>
  )
}
