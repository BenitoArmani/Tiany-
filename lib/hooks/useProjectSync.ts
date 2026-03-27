'use client'
import { useCallback } from 'react'
import { getProject, updateProject, createProject } from '../db/projects'
import { addMember } from '../db/members'
import { isSupabaseReady } from '../supabase'
import { scenesForSync, scenesFromSync } from '../imagedb'

/**
 * Hook to sync a project between localStorage and Supabase.
 * If Supabase is not configured, silently skips cloud sync.
 * Images: idb:// refs are converted to base64 before cloud save,
 * and base64 is converted back to idb:// refs when loading on a new device.
 */
export function useProjectSync() {
  const syncSave = useCallback(async (
    projectId: string,
    title: string,
    data: Record<string, unknown>,
    ownerId?: string
  ) => {
    if (!isSupabaseReady()) return

    // Convert idb:// image refs → base64 for cross-device compatibility
    const syncedScenes = data.scenes
      ? await scenesForSync(data.scenes as unknown[])
      : []
    const cloudData = { ...data, scenes: syncedScenes }

    const existing = await getProject(projectId)
    if (existing) {
      return await updateProject(projectId, title, cloudData)
    } else if (ownerId) {
      const created = await createProject(projectId, title, ownerId, cloudData)
      if (created) {
        await addMember(projectId, ownerId, 'owner')
        return true
      }
      return false
    }
    return true
  }, [])

  const syncLoad = useCallback(async (
    projectId: string,
    localData: Record<string, unknown> | null
  ): Promise<Record<string, unknown> | null> => {
    if (!isSupabaseReady()) return localData

    const remote = await getProject(projectId)
    if (!remote) return localData

    // Use remote if more recent, otherwise keep local
    const remoteTime = new Date(remote.updated_at).getTime()
    const localTime = localData
      ? new Date((localData.updatedAt as string) ?? 0).getTime()
      : 0

    if (remoteTime < localTime) return localData

    // Convert base64 images from remote → local idb:// refs
    const remoteData = remote.data as Record<string, unknown>
    const convertedScenes = remoteData.scenes
      ? await scenesFromSync(remoteData.scenes as unknown[])
      : []
    return { ...remoteData, scenes: convertedScenes }
  }, [])

  return { syncSave, syncLoad }
}
