'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Film, Plus, Trash2, Clock, Layers, ChevronRight, Edit3, X, Clapperboard, Music, FileVideo, Newspaper } from 'lucide-react'
import { getUserProjects, deleteProject as deleteProjectFromDB, updateProject } from '../../lib/db/projects'
import { getLocalUserId } from '../../lib/db/users'
import { ensureSession, isSupabaseReady } from '../../lib/supabase'

interface StoredProject { id: string; title: string; createdAt: string; updatedAt: string; sceneCount: number; pageCount: number }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

const uid = () => Math.random().toString(36).slice(2, 9)
const makeBlock = (type: string, text = '') => ({ id: uid(), type, text })
const makeScene = (heading: string, blocks: {type:string;text:string}[]) => ({
  id: uid(), heading, face: 0, imageUrl: null, shots: [],
  blocks: blocks.map(b => makeBlock(b.type, b.text)),
  camera: { angle: '', movement: '', focal: '' },
  lighting: { key: '', fill: '', ambiance: '' },
  sound: { direct: '', music: '', ambiance: '' },
  notes: '', comments: [],
})

const TEMPLATES = [
  {
    id: 'blank', label: 'Vierge', icon: Plus, color: '#6b7280',
    desc: 'Page blanche, tu pars de zéro',
    title: 'Sans titre',
    scenes: () => [makeScene('', [makeBlock('action')])],
  },
  {
    id: 'court', label: 'Court-métrage', icon: Clapperboard, color: '#e8a020',
    desc: '3 actes · 5 séquences · structure classique',
    title: 'Mon court-métrage',
    scenes: () => [
      makeScene('INT. LIEU — JOUR', [
        makeBlock('action', "On découvre le décor. L'atmosphère s'installe. Présentation du personnage principal."),
        makeBlock('character', 'PROTAGONISTE'),
        makeBlock('dialogue', ''),
      ]),
      makeScene('EXT. RUE — JOUR', [makeBlock('action', "Le protagoniste part. Quelque chose attire son attention.")]),
      makeScene('INT. LIEU 2 — SOIR', [makeBlock('action', "Le conflit éclate. Point de non-retour.")]),
      makeScene('EXT. LIEU — NUIT', [makeBlock('action', "La confrontation. Climax de l'histoire.")]),
      makeScene('INT. LIEU — MATIN', [
        makeBlock('action', "Résolution. Le monde a changé."),
        makeBlock('transition', 'FONDU AU NOIR.'),
      ]),
    ],
  },
  {
    id: 'clip', label: 'Clip musical', icon: Music, color: '#60a5fa',
    desc: '7 séquences · structure clip · énergique',
    title: 'Mon clip',
    scenes: () => [
      makeScene('INTRO', [makeBlock('action', "Image d'ouverture. Ambiance visuelle du clip. Identité.")]),
      makeScene('COUPLET 1', [makeBlock('action', "Performance de l'artiste. Plan large et plans serrés alternés.")]),
      makeScene('REFRAIN', [makeBlock('action', "Montage dynamique. Plan large. Énergie maximale.")]),
      makeScene('COUPLET 2', [makeBlock('action', "Narration. Introduction d'un second personnage ou lieu.")]),
      makeScene('REFRAIN x2', [makeBlock('action', "Plus intense que le premier refrain. Mouvement de caméra.")]),
      makeScene('BRIDGE', [makeBlock('action', "Rupture de style. Ralenti ou accéléré. Moment signature.")]),
      makeScene('OUTRO', [makeBlock('action', "Plan final. Clôture de l'identité visuelle."), makeBlock('transition', 'FONDU AU NOIR.')]),
    ],
  },
  {
    id: 'pub', label: 'Publicité', icon: FileVideo, color: '#a78bfa',
    desc: '3 séquences · 30 secondes · impact rapide',
    title: 'Mon spot pub',
    scenes: () => [
      makeScene('PROBLÈME — 0 à 10s', [makeBlock('action', "Situation familière. Le spectateur se reconnaît. Problème visible."), makeBlock('character', 'PERSONNAGE'), makeBlock('dialogue', "Pourquoi c'est si compliqué ?")]),
      makeScene('SOLUTION — 10 à 22s', [makeBlock('action', "Le produit / service apparaît. Transformation rapide. Émotion positive.")]),
      makeScene('CTA — 22 à 30s', [makeBlock('action', "Bénéfice final. Logo. Slogan. Appel à l'action."), makeBlock('transition', 'FONDU.')]),
    ],
  },
  {
    id: 'docu', label: 'Documentaire', icon: Newspaper, color: '#4ade80',
    desc: '4 séquences · format interview · réalité',
    title: 'Mon documentaire',
    scenes: () => [
      makeScene('OUVERTURE', [makeBlock('action', "Images d'ambiance. Contexte du sujet. Voix off introductive.")]),
      makeScene('INTERVIEW 1', [makeBlock('action', "Premier témoignage. Plan buste sur fond neutre. Sous-titres prévu."), makeBlock('character', 'INTERVIEWÉ(E)'), makeBlock('dialogue', '...')]),
      makeScene('ARCHIVE / TERRAIN', [makeBlock('action', "Images d'archive ou tournage sur le terrain. Illustration des propos.")]),
      makeScene('CONCLUSION', [makeBlock('action', "Synthèse. Dernier témoignage. Message final."), makeBlock('transition', 'FONDU AU NOIR.')]),
    ],
  },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Load local index immediately (instant)
    const raw = localStorage.getItem('tiany_index')
    const local: StoredProject[] = raw ? JSON.parse(raw) : []
    if (local.length) setProjects(local)

    // Then sync from Supabase in the background
    if (!isSupabaseReady()) return
    ;(async () => {
      // Ensure we have a stable user ID before fetching
      await ensureSession()
      const userId = getLocalUserId()
      if (!userId) return
      const remote = await getUserProjects(userId)
      if (!remote.length) return

      setProjects(prev => {
        const localMap = new Map(prev.map(p => [p.id, p]))
        const merged = [...prev]
        for (const rp of remote) {
          const local = localMap.get(rp.id)
          if (local) {
            // Project exists locally — update title/meta if Supabase is newer
            const remoteNewer = new Date(rp.updated_at).getTime() > new Date(local.updatedAt).getTime()
            if (remoteNewer) {
              const scenes = (rp.data?.scenes as unknown[]) ?? []
              const idx = merged.findIndex(p => p.id === rp.id)
              if (idx !== -1) merged[idx] = { ...merged[idx], title: rp.title, updatedAt: rp.updated_at, sceneCount: scenes.length }
            }
            continue
          }
          // Project exists on Supabase but not locally — add to index
          const scenes = (rp.data?.scenes as unknown[]) ?? []
          const entry: StoredProject = {
            id: rp.id, title: rp.title,
            createdAt: rp.created_at, updatedAt: rp.updated_at,
            sceneCount: scenes.length, pageCount: 0,
          }
          merged.push(entry)
          // Cache project data locally so write page can open it offline too
          try { localStorage.setItem(`tiany_project_${rp.id}`, JSON.stringify(rp.data)) } catch { /* quota */ }
        }
        merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        try { localStorage.setItem('tiany_index', JSON.stringify(merged)) } catch { /* quota */ }
        return merged
      })
    })()
  }, [])

  const saveIndex = (list: StoredProject[]) => {
    setProjects(list)
    localStorage.setItem('tiany_index', JSON.stringify(list))
  }

  const createFromTemplate = (tpl: typeof TEMPLATES[0]) => {
    const id = uid()
    const now = new Date().toISOString()
    const scenes = tpl.scenes()
    const proj: StoredProject = { id, title: tpl.title, createdAt: now, updatedAt: now, sceneCount: scenes.length, pageCount: 0 }
    localStorage.setItem(`tiany_project_${id}`, JSON.stringify({ id, title: tpl.title, scenes }))
    saveIndex([proj, ...projects])
    setShowTemplates(false)
    router.push(`/write/${id}`)
  }

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Supprimer ce projet définitivement ?')) return
    localStorage.removeItem(`tiany_project_${id}`)
    saveIndex(projects.filter(p => p.id !== id))
    deleteProjectFromDB(id) // fire-and-forget
  }

  const startRename = (p: StoredProject, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setRenaming(p.id); setRenameVal(p.title)
  }

  const commitRename = (id: string) => {
    const title = renameVal.trim() || 'Sans titre'
    let data: Record<string, unknown> = {}
    try {
      const raw = localStorage.getItem(`tiany_project_${id}`)
      if (raw) { data = JSON.parse(raw); localStorage.setItem(`tiany_project_${id}`, JSON.stringify({ ...data, title })) }
    } catch { /* ignore */ }
    saveIndex(projects.map(p => p.id === id ? { ...p, title } : p))
    setRenaming(null)
    updateProject(id, title, { ...data, title }) // fire-and-forget
  }

  return (
    <div className="min-h-screen" style={{ background: '#080808', color: '#f0ede8' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 sticky top-0 z-40"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#e8a020' }}>
            <Film size={13} className="text-black" />
          </div>
          <span className="font-black text-base">tiany</span>
        </Link>
        <button onClick={() => setShowTemplates(true)}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90"
          style={{ background: '#e8a020', color: '#000' }}>
          <Plus size={14} /> Nouveau projet
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-end justify-between mb-1 gap-4">
          <h1 className="text-2xl font-black">Mes projets</h1>
          {projects.length > 0 && (
            <div className="relative mb-1">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="text-sm rounded-xl pl-8 pr-3 py-1.5 outline-none transition-all w-44 focus:w-56"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0ede8' }} />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-30" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
          )}
        </div>
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {projects.length === 0 ? 'Aucun projet pour le moment' : `${projects.length} projet${projects.length > 1 ? 's' : ''}`}
        </p>

        {projects.length === 0 ? (
          <button onClick={() => setShowTemplates(true)}
            className="w-full flex flex-col items-center justify-center gap-4 py-16 rounded-2xl transition-all"
            style={{ border: '2px dashed rgba(255,255,255,0.1)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(232,160,32,0.1)' }}>
              <Clapperboard size={26} style={{ color: '#e8a020' }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">Créer mon premier projet</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Court-métrage · Clip · Pub · Documentaire · Vierge</p>
            </div>
          </button>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => setShowTemplates(true)}
              className="flex items-center justify-center gap-2 py-10 rounded-2xl transition-all hover:bg-white/5 font-semibold text-sm"
              style={{ border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
              <Plus size={16} /> Nouveau projet
            </button>

            {projects.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase())).map(p => (
              <Link key={p.id} href={`/write/${p.id}`}
                className="group relative flex flex-col gap-3 p-5 rounded-2xl transition-all hover:border-amber-500/30"
                style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="absolute top-3 right-3 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={e => startRename(p, e)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }} title="Renommer"><Edit3 size={13} /></button>
                  <button onClick={e => deleteProject(p.id, e)} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: 'rgba(248,113,113,0.6)' }} title="Supprimer"><Trash2 size={13} /></button>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232,160,32,0.1)' }}>
                  <Film size={18} style={{ color: '#e8a020' }} />
                </div>
                {renaming === p.id ? (
                  <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(p.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenaming(null) }}
                    onClick={e => e.preventDefault()}
                    className="bg-transparent outline-none font-bold text-base border-b" style={{ borderColor: '#e8a020', color: '#f0ede8' }} />
                ) : (
                  <p className="font-bold text-base leading-tight pr-14">{p.title}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span className="flex items-center gap-1"><Layers size={10} /> {p.sceneCount} séq.</span>
                  {p.pageCount > 0 && <span className="flex items-center gap-1"><Clock size={10} /> ~{p.pageCount} min</span>}
                  <span className="ml-auto">{timeAgo(p.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" style={{ color: '#e8a020' }}>
                  Ouvrir <ChevronRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* ── Template modal ── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="font-black text-lg">Choisir un modèle</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Ou démarre de zéro avec le modèle vierge</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3 overflow-y-auto">
              {TEMPLATES.map(tpl => {
                const Icon = tpl.icon
                return (
                  <button key={tpl.id} onClick={() => createFromTemplate(tpl)}
                    className="flex items-start gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                    style={{ background: '#181818', border: `1px solid ${tpl.color}22` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${tpl.color}15` }}>
                      <Icon size={18} style={{ color: tpl.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: tpl.color }}>{tpl.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{tpl.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
