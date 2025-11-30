import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Auth Service
 * Handles authentication operations (sign in, sign out, user state)
 */
class AuthService {
  /**
   * Sign in with Google OAuth
   * Client-side only
   */
  async signInWithGoogle(redirectTo?: string): Promise<{ error: Error | null }> {
    const supabase = createBrowserClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      return { error }
    }

    return { error: null }
  }

  /**
   * Sign out
   * Client-side only
   */
  async signOut(): Promise<{ error: Error | null }> {
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  /**
   * Get current user (server-side)
   * Returns null if not authenticated
   */
  async getCurrentUser(): Promise<User | null> {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  /**
   * Get current user (client-side)
   * Returns null if not authenticated
   */
  async getCurrentUserClient(): Promise<User | null> {
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  /**
   * Check if user is authenticated (server-side)
   */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  }
}

// Export singleton instance
export const authService = new AuthService()
