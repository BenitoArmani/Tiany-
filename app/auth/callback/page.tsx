'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

/**
 * Supabase redirects here after magic link / OTP click.
 * The URL contains either a `code` (PKCE flow) or `access_token` (implicit flow).
 * The Supabase client picks it up automatically via exchangeCodeForSession.
 */
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    if (!supabase) {
      router.replace('/projects')
      return
    }

    // Exchange the code in the URL for a session
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).finally(() => {
        router.replace('/projects')
      })
    } else {
      // Implicit flow — session already set by the client from the URL hash
      router.replace('/projects')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm opacity-50">Connexion en cours…</p>
    </div>
  )
}
