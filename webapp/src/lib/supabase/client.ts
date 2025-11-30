import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Browser-side Supabase client
 * Uses @supabase/ssr for cookie-based auth
 * Safe to use in client components
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
