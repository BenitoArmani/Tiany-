import { supabase } from '../supabase'
import type { TianyComment } from '../types/db'

export async function addComment(
  projectId: string,
  sceneId: string,
  target: TianyComment['target'],
  targetId: string,
  authorId: string,
  authorName: string,
  text: string
): Promise<TianyComment | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tiany_comments')
    .insert({ project_id: projectId, scene_id: sceneId, target, target_id: targetId, author_id: authorId, author_name: authorName, text })
    .select()
    .single()
  if (error) { console.error('addComment:', error); return null }
  return data
}

export async function getProjectComments(projectId: string): Promise<TianyComment[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tiany_comments')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getProjectComments:', error); return [] }
  return data ?? []
}

export async function getSceneComments(projectId: string, sceneId: string): Promise<TianyComment[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tiany_comments')
    .select()
    .eq('project_id', projectId)
    .eq('scene_id', sceneId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data ?? []
}

export async function deleteComment(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tiany_comments')
    .delete()
    .eq('id', id)
  return !error
}

export function subscribeToComments(
  projectId: string,
  onInsert: (comment: TianyComment) => void
) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`comments:${projectId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tiany_comments', filter: `project_id=eq.${projectId}` },
      payload => onInsert(payload.new as TianyComment)
    )
    .subscribe()
  return () => { supabase?.removeChannel(channel) }
}
