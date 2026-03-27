'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Film, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { getInvitationByToken, acceptInvitation } from '../../../lib/db/invitations'
import { getProjectMembers, addMember } from '../../../lib/db/members'
import { upsertUser, getLocalUserId, setLocalUserId } from '../../../lib/db/users'
import { getProject } from '../../../lib/db/projects'
import { isSupabaseReady } from '../../../lib/supabase'
import { ROLE_LABELS, ROLE_COLORS, type CinemaRole } from '../../../lib/types/db'

type Step = 'loading' | 'invalid' | 'form' | 'joining' | 'done' | 'no_supabase'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [inviteRole, setInviteRole] = useState<CinemaRole>('assistant')
  const [projectTitle, setProjectTitle] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseReady()) { setStep('no_supabase'); return }
    getInvitationByToken(token).then(async inv => {
      if (!inv || inv.used_by || new Date(inv.expires_at) < new Date()) {
        setStep('invalid'); return
      }
      setInviteRole(inv.role)
      const proj = await getProject(inv.project_id)
      setProjectTitle(proj?.title ?? 'Projet sans titre')

      // Pre-fill if user already exists locally
      try {
        const local = JSON.parse(localStorage.getItem('tiany_user') || 'null')
        if (local?.name) setName(local.name)
        if (local?.email) setEmail(local.email)
      } catch {}

      setStep('form')
    })
  }, [token])

  const handleJoin = async () => {
    if (!name.trim() || !email.trim()) { setError('Nom et email requis'); return }
    setError('')
    setStep('joining')

    const user = await upsertUser(name.trim(), email.trim())
    if (!user) { setError('Erreur de connexion'); setStep('form'); return }

    // Save locally
    localStorage.setItem('tiany_user', JSON.stringify({ name: user.name, email: user.email, createdAt: user.created_at }))
    setLocalUserId(user.id)

    const result = await acceptInvitation(token, user.id)
    if (!result) { setError('Lien invalide ou expiré'); setStep('form'); return }

    // Add as member (acceptInvitation may not have done it)
    await addMember(result.projectId, user.id, result.role)

    // Redirect to project
    setTimeout(() => router.push(`/write/${result.projectId}`), 800)
    setStep('done')
  }

  const bg = '#080808'
  const fg = '#f0ede8'
  const border = 'rgba(255,255,255,0.08)'
  const hint = 'rgba(255,255,255,0.04)'
  const hintText = 'rgba(255,255,255,0.35)'

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: bg, color: fg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e8a020' }}>
            <Film size={15} className="text-black" />
          </div>
          <span className="font-black text-xl">tiany</span>
        </div>

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={24} className="animate-spin" style={{ color: '#e8a020' }} />
            <p className="text-sm" style={{ color: hintText }}>Vérification du lien…</p>
          </div>
        )}

        {step === 'no_supabase' && (
          <div className="rounded-2xl p-6 text-center space-y-3" style={{ background: '#111', border: `1px solid ${border}` }}>
            <AlertTriangle size={28} style={{ color: '#f97316', margin: '0 auto' }} />
            <p className="font-bold">Supabase non configuré</p>
            <p className="text-sm" style={{ color: hintText }}>Le système de collaboration n&apos;est pas encore activé sur cette instance.</p>
          </div>
        )}

        {step === 'invalid' && (
          <div className="rounded-2xl p-6 text-center space-y-3" style={{ background: '#111', border: `1px solid ${border}` }}>
            <AlertTriangle size={28} style={{ color: '#f87171', margin: '0 auto' }} />
            <p className="font-bold">Lien invalide ou expiré</p>
            <p className="text-sm" style={{ color: hintText }}>Ce lien d&apos;invitation n&apos;existe plus ou a déjà été utilisé.</p>
          </div>
        )}

        {(step === 'form' || step === 'joining') && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: `1px solid ${border}` }}>
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: `1px solid ${border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: hintText }}>Invitation</p>
              <p className="font-black text-lg">{projectTitle}</p>
              <div className="mt-2">
                <span className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{ background: `${ROLE_COLORS[inviteRole]}20`, color: ROLE_COLORS[inviteRole], border: `1px solid ${ROLE_COLORS[inviteRole]}40` }}>
                  Rôle : {ROLE_LABELS[inviteRole]}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: hintText }}>Entre tes infos pour rejoindre l&apos;équipe.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: hintText }}>Nom</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ton prénom ou nom"
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: hint, border: `1px solid ${border}`, color: fg }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: hintText }}>Email</label>
                  <input
                    type="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ton@email.com"
                    className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                    style={{ background: hint, border: `1px solid ${border}`, color: fg }}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button onClick={handleJoin} disabled={step === 'joining'}
                className="w-full py-3 rounded-xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: '#e8a020', color: '#000' }}>
                {step === 'joining' ? 'Connexion…' : 'Rejoindre le projet →'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: '#111', border: `1px solid ${border}` }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(74,222,128,0.1)' }}>
              <Check size={26} style={{ color: '#4ade80' }} />
            </div>
            <p className="font-black text-lg">Bienvenue dans l&apos;équipe !</p>
            <p className="text-sm" style={{ color: hintText }}>Redirection vers le projet…</p>
          </div>
        )}
      </div>
    </div>
  )
}
