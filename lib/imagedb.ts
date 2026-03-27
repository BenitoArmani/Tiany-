/**
 * IndexedDB image storage for Tiany.
 * Stores raw File/Blob objects; returns `idb://<id>` references.
 * Module-level URL cache: once resolved, blob URLs are reused across components.
 */

const DB_NAME = 'tiany_images'
const STORE = 'images'
const DB_VERSION = 1

/** Module-level cache: idb://id → blob: URL */
const urlCache = new Map<string, string>()

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Save a File to IndexedDB.
 * @returns `idb://<id>` reference string — store this in state/localStorage instead of base64.
 * Throws on failure (caller should fall back to fileToBase64).
 */
export async function saveImage(file: File): Promise<string> {
  const id = `idb_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, id)
    tx.oncomplete = () => resolve(`idb://${id}`)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Resolve any image reference to a displayable URL.
 * - `idb://id`    → looks up IndexedDB, creates + caches a blob URL
 * - `data:…`      → returned as-is (legacy base64)
 * - anything else → returned as-is
 * Never throws — returns the original ref as fallback.
 */
export async function resolveUrl(ref: string): Promise<string> {
  if (!ref.startsWith('idb://')) return ref
  const cached = urlCache.get(ref)
  if (cached) return cached
  try {
    const id = ref.slice(6)
    const db = await openDB()
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      req.onsuccess = () => {
        if (req.result instanceof Blob) {
          const url = URL.createObjectURL(req.result)
          urlCache.set(ref, url)
          resolve(url)
        } else {
          resolve(ref) // blob missing — broken image, not a crash
        }
      }
      req.onerror = () => resolve(ref)
    })
  } catch {
    return ref
  }
}

/**
 * Synchronous cache lookup — returns null if not yet resolved.
 * Useful in render functions that can't await.
 * For base64/http refs, returns the ref directly.
 */
export function getCachedUrl(ref: string): string | null {
  if (!ref.startsWith('idb://')) return ref
  return urlCache.get(ref) ?? null
}

/**
 * Convert all idb:// refs inside a scenes array to base64 data URLs.
 * Used before saving to Supabase so images work across devices.
 * Never throws — leaves unresolvable refs as-is.
 */
export async function scenesForSync(scenes: unknown[]): Promise<unknown[]> {
  return Promise.all((scenes as Record<string, unknown>[]).map(async (s) => {
    const urls = s.imageUrls as string[] | undefined
    if (!urls?.length) return s
    const exported = await Promise.all(urls.map(async (ref) => {
      if (!ref.startsWith('idb://')) return ref
      try {
        const blobUrl = await resolveUrl(ref)
        if (blobUrl === ref) return ref // IDB miss — keep ref
        const res = await fetch(blobUrl)
        const blob = await res.blob()
        return await new Promise<string>((ok) => {
          const fr = new FileReader()
          fr.onload = () => ok(fr.result as string)
          fr.onerror = () => ok(ref)
          fr.readAsDataURL(blob)
        })
      } catch { return ref }
    }))
    return { ...s, imageUrls: exported }
  }))
}

/**
 * Convert base64 data URLs inside a scenes array to local idb:// refs.
 * Called when applying remote Supabase data on a new device.
 * Never throws — leaves non-base64 refs as-is.
 */
export async function scenesFromSync(scenes: unknown[]): Promise<unknown[]> {
  return Promise.all((scenes as Record<string, unknown>[]).map(async (s) => {
    const urls = s.imageUrls as string[] | undefined
    if (!urls?.length) return s
    const imported = await Promise.all(urls.map(async (ref) => {
      if (!ref.startsWith('data:')) return ref
      try {
        const res = await fetch(ref)
        const blob = await res.blob()
        const file = new File([blob], 'synced-image', { type: blob.type })
        return await saveImage(file)
      } catch { return ref }
    }))
    return { ...s, imageUrls: imported }
  }))
}

/**
 * Delete an image from IndexedDB and revoke its cached blob URL.
 * No-op for non-IDB refs. Never throws.
 */
export async function deleteImage(ref: string): Promise<void> {
  if (!ref.startsWith('idb://')) return
  const cached = urlCache.get(ref)
  if (cached) { URL.revokeObjectURL(cached); urlCache.delete(ref) }
  try {
    const id = ref.slice(6)
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* ignore */ }
}
