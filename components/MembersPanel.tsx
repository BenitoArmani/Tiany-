'use client'
import { useState, useEffect, useCallback } from 'react'
import { Users, X, Copy, Check, Plus, ChevronDown, Trash2, Link as LinkIcon } from 'lucide-react'
import { getProjectMembers, updateMemberRole, removeMember } from '../lib/db/members'
import { createInvitation, getProjectInvitations, revokeInvitation, buildInviteUrl } from '../lib/db/invitations'
import { isSupabaseReady } from '../lib/supabase'
import { CINEMA_ROLES, ROLE_COLORS, ROLE_LABELS, type CinemaRole, type TianyMember, type TianyInvitation } from '../lib/types/db'

export interface MembersPanelProps {
  projectId: string
  currentUserId: string
  isOwner: boolean
  theme: 'dark' | 'light'
  onClose: () => void
}

type Props = MembersPanelProps

const T = {
  dark: { bg: '#0d0d0d', fg: '#f0ede8', border: 'rgba(255,255,255,0.08)', hint: 'rgba(255,255,255,0.04)', hintText: 'rgba(255,255,255,0.35)', card: '#131313' },
  light: { bg: '#ffffff', fg: '#1a1510', border: 'rgba(0,0,0,0.1)', hint: 'rgba(0,0,0,0.04)', hintText: 'rgba(0,0,0,0.4)', card: '#f5f0e8' },
}

function RoleBadge({ role }: { role: CinemaRole }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40` }}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function RolePicker({ value, onChange, disabled }: { value: CinemaRole; onChange: (r: CinemaRole) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button disabled={disabled} onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
        style={{ color: ROLE_COLORS[value] }}>
        {ROLE_LABELS[value]} {!disabled && <ChevronDown size={8} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 py-1 min-w-[180px]"
          style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}>
          {CINEMA_ROLES.filter(r => r !== 'owner').map(r => (
            <button key={r} onClick={() => { onChange(r); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5 flex items-center gap-2"
              style={{ color: r === value ? ROLE_COLORS[r] : 'rgba(240,237,232,0.55)' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ROLE_COLORS[r] }} />
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MembersPanel({ projectId, currentUserId, isOwner, theme, onClose }: Props) {
  const C = T[theme]
  const [members, setMembers] = useState<TianyMember[]>([])
  const [invitations, setInvitations] = useState<TianyInvitation[]>([])
  const [inviteRole, setInviteRole] = useState<CinemaRole>('assistant')
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'members' | 'invite'>('members')

  const ready = isSupabaseReady()

  const load = useCallback(async () => {
    setLoading(true)
    const [m, i] = await Promise.all([
      getProjectMembers(projectId),
      isOwner ? getProjectInvitations(projectId) : Promise.resolve([]),
    ])
    setMembers(m)
    setInvitations(i)
    setLoading(false)
  }, [projectId, isOwner])

  useEffect(() => { load() }, [load])

  const handleCreateInvite = async () => {
    if (!ready) return
    const inv = await createInvitation(projectId, inviteRole, currentUserId)
    if (inv) {
      setInvitations(prev => [inv, ...prev])
      const url = buildInviteUrl(inv.token)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(inv.token)
      setTimeout(() => setCopied(null), 2500)
    }
  }

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(buildInviteUrl(token)).catch(() => {})
    setCopied(token)
    setTimeout(() => setCopied(null), 2500)
  }

  const handleRevoke = async (id: string) => {
    await revokeInvitation(id)
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  const handleRoleChange = async (userId: string, role: CinemaRole) => {
    await updateMemberRole(projectId, userId, role)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Retirer ce membre du projet ?')) return
    await removeMember(projectId, userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: C.bg, border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: '#e8a020' }} />
            <span className="font-black text-base" style={{ color: C.fg }}>Équipe du projet</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: C.hintText }}>
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          {(['members', 'invite'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-3 text-xs font-bold transition-colors"
              style={{ color: tab === t ? '#e8a020' : C.hintText, borderBottom: tab === t ? '2px solid #e8a020' : '2px solid transparent' }}>
              {t === 'members' ? `Membres (${members.length})` : 'Inviter'}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {!ready && (
            <div className="mb-4 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.2)' }}>
              ⚠️ Supabase non configuré — fonctions de collaboration désactivées
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-center py-4" style={{ color: C.hintText }}>Chargement…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: C.hintText }}>Aucun membre pour l&apos;instant</p>
              ) : members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: C.hint, border: `1px solid ${C.border}` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ background: `${ROLE_COLORS[m.role]}25`, color: ROLE_COLORS[m.role] }}>
                    {(m.user?.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: C.fg }}>{m.user?.name ?? '—'}</p>
                    <p className="text-[10px] truncate" style={{ color: C.hintText }}>{m.user?.email}</p>
                  </div>
                  {isOwner && m.user_id !== currentUserId ? (
                    <div className="flex items-center gap-1">
                      <RolePicker value={m.role} onChange={r => handleRoleChange(m.user_id, r)} />
                      <button onClick={() => handleRemove(m.user_id)}
                        className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
                        style={{ color: '#f87171' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'invite' && (
            <div className="space-y-4">
              {isOwner && (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: C.hintText }}>Crée un lien d&apos;invitation avec un rôle spécifique. Le lien est valable 7 jours.</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold mb-1" style={{ color: C.hintText }}>Rôle assigné</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CINEMA_ROLES.filter(r => r !== 'owner').map(r => (
                          <button key={r} onClick={() => setInviteRole(r)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{
                              background: inviteRole === r ? `${ROLE_COLORS[r]}20` : 'transparent',
                              color: inviteRole === r ? ROLE_COLORS[r] : C.hintText,
                              border: `1px solid ${inviteRole === r ? ROLE_COLORS[r] + '40' : C.border}`,
                            }}>
                            {ROLE_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={handleCreateInvite} disabled={!ready}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: '#e8a020', color: '#000' }}>
                    <LinkIcon size={14} />
                    Générer le lien d&apos;invitation
                  </button>
                </div>
              )}

              {invitations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.hintText }}>Liens actifs</p>
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex items-center gap-2 p-3 rounded-xl"
                      style={{ background: C.hint, border: `1px solid ${C.border}` }}>
                      <div className="flex-1 min-w-0">
                        <RoleBadge role={inv.role} />
                        <p className="text-[9px] mt-1 truncate font-mono" style={{ color: C.hintText }}>
                          {buildInviteUrl(inv.token)}
                        </p>
                      </div>
                      <button onClick={() => handleCopy(inv.token)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10 flex-shrink-0"
                        style={{ color: copied === inv.token ? '#4ade80' : C.hintText }}>
                        {copied === inv.token ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      {isOwner && (
                        <button onClick={() => handleRevoke(inv.id)}
                          className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity flex-shrink-0"
                          style={{ color: '#f87171' }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isOwner && (
                <p className="text-xs text-center py-4" style={{ color: C.hintText }}>
                  Seul le chef de projet peut générer des invitations.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
