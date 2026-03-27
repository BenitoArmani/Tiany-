import { supabase } from '../supabase'
import type { TianyInvitation, CinemaRole } from '../types/db'

export async function createInvitation(
  projectId: string,
  role: CinemaRole,
  createdBy: string
): Promise<TianyInvitation | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_invitations')
    .insert({ project_id: projectId, role, created_by: createdBy })
    .select()
    .single()
  if (error) { console.error('createInvitation:', error); return null }
  return data
}

export async function getInvitationByToken(token: string): Promise<TianyInvitation | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_invitations')
    .select()
    .eq('token', token)
    .single()
  if (error) return null
  return data
}

export async function acceptInvitation(
  token: string,
  userId: string
): Promise<{ projectId: string; role: CinemaRole } | null> {
  if (!supabase) return null

  const inv = await getInvitationByToken(token)
  if (!inv) return null
  if (inv.used_by) return null // already used
  if (new Date(inv.expires_at) < new Date()) return null // expired

  // Mark as used
  const { error } = await supabase
    .from('tiany_invitations')
    .update({ used_by: userId })
    .eq('token', token)
  if (error) return null

  return { projectId: inv.project_id, role: inv.role }
}

export async function getProjectInvitations(projectId: string): Promise<TianyInvitation[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tiany_invitations')
    .select()
    .eq('project_id', projectId)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function revokeInvitation(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_invitations')
    .delete()
    .eq('id', id)
  return !error
}

export function buildInviteUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://tiany.vercel.app'
  return `${base}/join/${token}`
}
