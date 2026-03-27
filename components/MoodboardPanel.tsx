'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Upload, Trash2, GripVertical, Edit3, Check, Palette } from 'lucide-react'

export interface MoodItem {
  id: string
  url: string        // base64
  note: string
  colors: string[]   // hex, extrait de l'image
  createdAt: string
}

interface Props {
  projectId: string
  theme: 'dark' | 'light'
  onClose: () => void
}

const uid = () => Math.random().toString(36).slice(2, 9)

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

// Extract dominant colors from an image using canvas sampling
function extractColors(src: string, count = 5): Promise<string[]> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 80
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve([]); return }
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
      // Sample pixels on a grid, quantize to buckets
      const buckets: Record<string, number> = {}
      const step = 4 * 4 // every 4 pixels
      for (let i = 0; i < data.length; i += step) {
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i+1] / 32) * 32
        const b = Math.round(data[i+2] / 32) * 32
        if (data[i+3] < 128) continue // skip transparent
        const key = `${r},${g},${b}`
        buckets[key] = (buckets[key] ?? 0) + 1
      }
      const sorted = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count * 3)
      // Deduplicate colors that are too close
      const picked: string[] = []
      for (const [key] of sorted) {
        const [r, g, b] = key.split(',').map(Number)
        const toHex = (n: number) => n.toString(16).padStart(2, '0')
        const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
        const tooClose = picked.some(p => {
          const pr = parseInt(p.slice(1,3), 16)
          const pg = parseInt(p.slice(3,5), 16)
          const pb = parseInt(p.slice(5,7), 16)
          return Math.abs(r-pr) + Math.abs(g-pg) + Math.abs(b-pb) < 64
        })
        if (!tooClose) picked.push(hex)
        if (picked.length >= count) break
      }
      resolve(picked)
    }
    img.onerror = () => resolve([])
    img.src = src
  })
}

const T = {
  dark:  { bg: '#080808', fg: '#f0ede8', card: '#0d0d0d', cardHdr: '#131313', border: 'rgba(255,255,255,0.08)', hint: 'rgba(255,255,255,0.04)', hintText: 'rgba(255,255,255,0.3)', input: 'rgba(255,255,255,0.06)' },
  light: { bg: '#f2ede4', fg: '#1a1510', card: '#ffffff', cardHdr: '#f5f0e8', border: 'rgba(0,0,0,0.1)', hint: 'rgba(0,0,0,0.04)', hintText: 'rgba(0,0,0,0.35)', input: 'rgba(0,0,0,0.06)' },
}

function ColorDots({ colors }: { colors: string[] }) {
  if (!colors.length) return null
  return (
    <div className="flex gap-1 flex-wrap">
      {colors.map((c, i) => (
        <div key={i} className="w-4 h-4 rounded-full border border-black/20 flex-shrink-0 cursor-pointer"
          style={{ background: c }}
          title={c}
          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(c).catch(() => {}) }}
        />
      ))}
    </div>
  )
}

export default function MoodboardPanel({ projectId, theme, onClose }: Props) {
  const C = T[theme]
  const storageKey = `tiany_moodboard_${projectId}`
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MoodItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteVal, setNoteVal] = useState('')
  const [uploading, setUploading] = useState(false)
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [storageKey])

  const save = useCallback((next: MoodItem[]) => {
    setItems(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }, [storageKey])

  const handleFiles = async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setUploading(true)
    const newItems: MoodItem[] = await Promise.all(imgs.map(async f => {
      const url = await fileToBase64(f)
      const colors = await extractColors(url)
      return { id: uid(), url, note: '', colors, createdAt: new Date().toISOString() }
    }))
    save([...items, ...newItems])
    setUploading(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    await handleFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await handleFiles(files)
  }

  const deleteItem = (id: string) => {
    save(items.filter(i => i.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const saveNote = (id: string) => {
    save(items.map(i => i.id === id ? { ...i, note: noteVal } : i))
    setEditingNote(null)
  }

  // Drag & drop reorder
  const onDragStart = (id: string) => setDragId(id)
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id) }
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const from = items.findIndex(i => i.id === dragId)
    const to   = items.findIndex(i => i.id === targetId)
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    save(next)
    setDragId(null); setDragOverId(null)
  }

  const expandedItem = expanded ? items.find(i => i.id === expanded) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg, color: C.fg }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-14 flex-shrink-0"
        style={{ borderBottom: `1px solid ${C.border}`, background: theme === 'dark' ? 'rgba(8,8,8,0.96)' : 'rgba(242,237,228,0.96)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          <Palette size={16} style={{ color: '#e8a020' }} />
          <span className="font-black text-base">Moodboard</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.2)' }}>
            {items.length} image{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#e8a020', color: '#000' }}>
            <Plus size={14} /> {uploading ? 'Ajout…' : 'Ajouter'}
          </button>
          <button onClick={onClose}
            className="p-2 rounded-xl transition-colors hover:bg-white/10"
            style={{ color: C.hintText }}>
            <X size={16} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6"
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={handleDrop}>

        {/* Drop zone overlay */}
        {dragging && (
          <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(232,160,32,0.08)', border: '3px dashed rgba(232,160,32,0.5)' }}>
            <p className="text-xl font-black" style={{ color: '#e8a020' }}>Déposer les images ici</p>
          </div>
        )}

        {items.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-4 h-64 rounded-2xl cursor-pointer transition-all hover:border-amber-500/40"
            style={{ border: `2px dashed ${C.border}` }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(232,160,32,0.08)' }}>
              <Upload size={26} style={{ color: '#e8a020' }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-base">Glisse tes références visuelles ici</p>
              <p className="text-sm mt-1" style={{ color: C.hintText }}>Photos · Captures · Palettes · Références DOP · Stills</p>
            </div>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {items.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={() => onDragStart(item.id)}
                onDragOver={e => onDragOver(e, item.id)}
                onDrop={() => onDrop(item.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                className="break-inside-avoid group relative rounded-2xl overflow-hidden cursor-pointer transition-all"
                style={{
                  border: `1px solid ${dragOverId === item.id ? '#e8a020' : C.border}`,
                  background: C.card,
                  outline: dragId === item.id ? `2px dashed rgba(232,160,32,0.4)` : 'none',
                  transform: dragId === item.id ? 'scale(0.97) rotate(-1deg)' : 'scale(1)',
                  opacity: dragId === item.id ? 0.6 : 1,
                  transition: 'transform 0.15s, opacity 0.15s',
                }}
                onClick={() => setExpanded(item.id)}>

                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="w-full object-cover" />

                {/* Overlay on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)' }}>
                  {/* Top actions */}
                  <div className="flex items-center justify-between">
                    <div className="opacity-40 hover:opacity-70 cursor-grab active:cursor-grabbing">
                      <GripVertical size={14} className="text-white" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingNote(item.id); setNoteVal(item.note) }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <Edit3 size={11} className="text-white" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/40"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <Trash2 size={11} className="text-white" />
                      </button>
                    </div>
                  </div>
                  {/* Bottom: note + colors */}
                  <div className="space-y-2">
                    {item.note && (
                      <p className="text-xs text-white font-medium leading-snug line-clamp-2">{item.note}</p>
                    )}
                    <div className="flex gap-1">
                      {item.colors.map((c, i) => (
                        <button key={i}
                          onClick={e => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(c).catch(() => {})
                            setCopiedColor(c)
                            setTimeout(() => setCopiedColor(null), 1500)
                          }}
                          className="w-4 h-4 rounded-full border border-white/30 transition-transform hover:scale-125"
                          style={{ background: c }}
                          title={copiedColor === c ? 'Copié !' : c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Inline add button */}
            <div
              onClick={() => fileRef.current?.click()}
              className="break-inside-avoid flex items-center justify-center gap-2 h-28 rounded-2xl cursor-pointer transition-all hover:border-amber-500/30"
              style={{ border: `2px dashed ${C.border}`, color: C.hintText }}>
              <Plus size={18} />
              <span className="text-sm font-semibold">Ajouter</span>
            </div>
          </div>
        )}
      </div>

      {/* Edit note modal */}
      {editingNote && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditingNote(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-3"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold" style={{ color: C.fg }}>Note sur l&apos;image</p>
            <textarea
              value={noteVal}
              onChange={e => setNoteVal(e.target.value)}
              placeholder="Référence, inspiration, note pour l'équipe..."
              rows={3}
              autoFocus
              className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
              style={{ background: C.input, border: `1px solid ${C.border}`, color: C.fg }}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNote(editingNote) }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingNote(null)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.hintText }}>Annuler</button>
              <button onClick={() => saveNote(editingNote)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold"
                style={{ background: '#e8a020', color: '#000' }}>
                <Check size={11} /> Sauver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {expandedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
          onClick={() => setExpanded(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpanded(null)}
              className="absolute -top-2 -right-2 z-10 p-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <X size={16} className="text-white" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expandedItem.url} alt="" className="w-full object-contain max-h-[70vh] rounded-2xl" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {expandedItem.note ? (
                  <p className="text-sm text-white/80">{expandedItem.note}</p>
                ) : (
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune note</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <ColorDots colors={expandedItem.colors} />
                {copiedColor && <p className="text-[10px] text-white/50">{copiedColor} copié</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setExpanded(null); setEditingNote(expandedItem.id); setNoteVal(expandedItem.note) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                <Edit3 size={11} /> Modifier la note
              </button>
              <button
                onClick={() => deleteItem(expandedItem.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                <Trash2 size={11} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
