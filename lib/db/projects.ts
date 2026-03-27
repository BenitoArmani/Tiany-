import { supabase } from '../supabase'
import type { TianyProject } from '../types/db'

export async function createProject(
  id: string,
  title: string,
  ownerId: string,
  data: Record<string, unknown>
): Promise<TianyProject | null> {
  if (!supabase) return null
  const { data: proj, error } = await supabase
    .from('tiany_projects')
    .insert({ id, title, owner_id: ownerId, data })
    .select()
    .single()
  if (error) { console.error('createProject:', error); return null }
  return proj
}

export async function getProject(id: string): Promise<TianyProject | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_projects')
    .select()
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function updateProject(
  id: string,
  title: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_projects')
    .update({ title, data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('updateProject:', error); return false }
  return true
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_projects')
    .delete()
    .eq('id', id)
  if (error) { console.error('deleteProject:', error); return false }
  return true
}

export async function getUserProjects(userId: string): Promise<TianyProject[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tiany_projects')
    .select('*, tiany_members!inner(user_id)')
    .eq('tiany_members.user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) { console.error('getUserProjects:', error); return [] }
  return data ?? []
}
