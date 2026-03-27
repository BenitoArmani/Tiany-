import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Returns null if keys are not configured — app falls back to localStorage
export const supabase = url && key ? createClient(url, key) : null

export const isSupabaseReady = () => !!supabase

/**
 * Link an email to the current session (preserves UUID if anonymous),
 * or sign in with OTP on a fresh device.
 * Returns an error message string, or null on success.
 */
export async function sendMagicLink(email: string): Promise<string | null> {
  if (!supabase) return 'Supabase non configuré'
  try {
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user.is_anonymous) {
      // Anonymous user — link email to existing session, UUID preserved
      const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo })
      return error?.message ?? null
    }
    // No session or already email user — standard OTP magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    return error?.message ?? null
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur inconnue'
  }
}

/**
 * Returns the current Supabase Auth session, creating an anonymous one if none exists.
 * Returns null if Supabase is not configured or anonymous auth is not enabled.
 * Never throws.
 */
export async function ensureSession() {
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
    // No session — sign in anonymously (requires anonymous auth enabled in Supabase dashboard)
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.session) return null
    return data.session
  } catch {
    return null
  }
}
