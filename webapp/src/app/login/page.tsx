import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Tracktonaut
          </h1>
          <p className="text-gray-400">
            Track your daily metrics and build better habits
          </p>
        </div>

        {/* Sign In Button */}
        <Suspense
          fallback={
            <div className="w-full bg-gray-700 animate-pulse h-12 rounded-lg" />
          }
        >
          <GoogleSignInButton />
        </Suspense>

        {/* Privacy Note */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  )
}
