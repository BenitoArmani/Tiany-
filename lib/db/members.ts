import { supabase } from '../supabase'
import type { TianyMember, CinemaRole } from '../types/db'

export async function addMember(
  projectId: string,
  userId: string,
  role: CinemaRole
): Promise<TianyMember | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_members')
    .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' })
    .select()
    .single()
  if (error) { console.error('addMember:', error); return null }
  return data
}

export async function getProjectMembers(projectId: string): Promise<TianyMember[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tiany_members')
    .select('*, user:tiany_users(*)')
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true })
  if (error) { console.error('getProjectMembers:', error); return [] }
  return data ?? []
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: CinemaRole
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)
  if (error) { console.error('updateMemberRole:', error); return false }
  return true
}

export async function removeMember(projectId: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  if (error) { console.error('removeMember:', error); return false }
  return true
}

export async function getMemberRole(projectId: string, userId: string): Promise<CinemaRole | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data?.role ?? null
}
