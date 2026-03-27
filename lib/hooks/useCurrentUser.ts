'use client'
import { useState, useEffect, useCallback } from 'react'
import { getLocalUserId, setLocalUserId, getLocalUser } from '../db/users'
import { ensureSession, supabase } from '../supabase'
import type { TianyUser } from '../types/db'

/**
 * Resolves the current user identity in priority order:
 * 1. Supabase Auth session (anonymous or email) — UUID stable across devices
 * 2. Existing tiany_user_id in localStorage (may be a previous Supabase UUID)
 * 3. New crypto.randomUUID() stored in localStorage (offline fallback)
 *
 * Always sets tiany_user_id in localStorage so the rest of the app
 * (syncSave, getMemberRole, etc.) can read it synchronously.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<TianyUser | null>(null)
  const [loading, setLoading] = useState(true)

  const sync = useCallback(async () => {
    setLoading(true)
    try {
      // ── 1. Supabase Auth ──────────────────────────────────────────────
      const session = await ensureSession()
      if (session) {
        const id = session.user.id
        setLocalUserId(id)
        const local = getLocalUser()
        setUser({
          id,
          name: local?.name ?? (session.user.user_metadata?.name as string | undefined) ?? 'Utilisateur',
          email: local?.email ?? session.user.email ?? '',
          created_at: session.user.created_at,
        })
        return
      }

      // ── 2 & 3. Local fallback ─────────────────────────────────────────
      const existingId = getLocalUserId()
      const id = existingId ?? (
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `local_${Math.random().toString(36).slice(2)}`
      )
      if (!existingId) setLocalUserId(id)
      const local = getLocalUser()
      setUser({
        id,
        name: local?.name ?? 'Utilisateur',
        email: local?.email ?? '',
        created_at: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { sync() }, [sync])

  // Re-sync whenever the Supabase session changes (e.g. magic link confirmed)
  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      sync()
    })
    return () => subscription.unsubscribe()
  }, [sync])

  return { user, loading, refresh: sync }
}
