import { supabase } from '../supabase'
import type { TianyUser } from '../types/db'

export async function upsertUser(name: string, email: string): Promise<TianyUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_users')
    .upsert({ name, email }, { onConflict: 'email' })
    .select()
    .single()
  if (error) { console.error('upsertUser:', error); return null }
  return data
}

export async function getUserById(id: string): Promise<TianyUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_users')
    .select()
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getUserByEmail(email: string): Promise<TianyUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_users')
    .select()
    .eq('email', email)
    .single()
  if (error) return null
  return data
}

// Store current user id in localStorage for session
export function getLocalUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('tiany_user_id')
}

export function setLocalUserId(id: string) {
  if (typeof window !== 'undefined') localStorage.setItem('tiany_user_id', id)
}

export function getLocalUser(): { name: string; email: string } | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('tiany_user') || 'null') } catch { return null }
}
