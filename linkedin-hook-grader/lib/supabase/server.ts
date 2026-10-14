/**
 * Supabase Server Client
 * Service-role client for API routes - never exposed to browser
 * Lazy initialization to avoid build-time errors
 */

import { createClient } from '@supabase/supabase-js'

let supabaseInstance: ReturnType<typeof createClient> | null = null

/**
 * Get or create the Supabase client instance (lazy initialization)
 */
export function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    // Prefer service role; fall back to publishable/anon when service role is unset
    // (assignment local/dev). Never expose this client to the browser.
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_PUBLISHABLE_KEY)'
      )
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseInstance
}

// For backward compatibility, export a getter that throws if not initialized
// This should only be used in runtime, not at build time
export const supabase = {
  get: () => {
    const instance = getSupabase()
    if (!instance) {
      throw new Error('Supabase client not initialized. This should not happen at runtime.')
    }
    return instance
  }
} as any