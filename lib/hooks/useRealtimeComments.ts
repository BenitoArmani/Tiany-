'use client'
import { useState, useEffect, useCallback } from 'react'
import { getProjectComments, addComment as dbAddComment, subscribeToComments } from '../db/comments'
import type { TianyComment } from '../types/db'

export function useRealtimeComments(projectId: string | null) {
  const [comments, setComments] = useState<TianyComment[]>([])
  const [loading, setLoading] = useState(false)

  // Load all comments on mount
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    getProjectComments(projectId).then(data => {
      setComments(data)
      setLoading(false)
    })
  }, [projectId])

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!projectId) return
    const unsub = subscribeToComments(projectId, (newComment) => {
      setComments(prev => {
        if (prev.find(c => c.id === newComment.id)) return prev
        return [...prev, newComment]
      })
    })
    return unsub
  }, [projectId])

  const addComment = useCallback(async (
    sceneId: string,
    target: TianyComment['target'],
    targetId: string,
    authorId: string,
    authorName: string,
    text: string
  ) => {
    if (!projectId) return
    const created = await dbAddComment(projectId, sceneId, target, targetId, authorId, authorName, text)
    if (created) {
      // Realtime will pick it up, but add locally too for instant feedback
      setComments(prev => prev.find(c => c.id === created.id) ? prev : [...prev, created])
    }
  }, [projectId])

  const commentsForScene = useCallback((sceneId: string) =>
    comments.filter(c => c.scene_id === sceneId), [comments])

  const commentsForTarget = useCallback((sceneId: string, target: TianyComment['target'], targetId: string) =>
    comments.filter(c => c.scene_id === sceneId && c.target === target && c.target_id === targetId), [comments])

  return { comments, loading, addComment, commentsForScene, commentsForTarget }
}
