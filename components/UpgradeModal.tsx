'use client'
import { useState } from 'react'
import { X, Sparkles, Check, Lock } from 'lucide-react'

interface UpgradeModalProps {
  onClose: () => void
  reason?: string
  theme?: 'dark' | 'light'
}

export default function UpgradeModal({ onClose, reason, theme = 'dark' }: UpgradeModalProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const fg = theme === 'dark' ? '#f0ede8' : '#1a1510'
  const sub = theme === 'dark' ? 'rgba(240,237,232,0.5)' : 'rgba(0,0,0,0.5)'
  const bg = theme === 'dark' ? '#0d0d0d' : '#ffffff'
  const inputBg = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const handleNotify = () => {
    if (!email.trim()) return
    try { localStorage.setItem('tiany_pro_email', email.trim()) } catch {}
    setSent(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl p-8" style={{ background: bg, border: '1px solid rgba(232,160,32,0.3)', boxShadow: '0 0 60px rgba(232,160,32,0.1), 0 32px 64px rgba(0,0,0,0.5)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 opacity-40 hover:opacity-70 transition-opacity">
          <X size={16} style={{ color: fg }} />
        </button>

        {/* Icon */}
        <div style={{ width: 44, height: 44, background: 'rgba(232,160,32,0.15)', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Sparkles size={20} style={{ color: '#e8a020' }} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#e8a020', marginBottom: 8 }}>
          Tiany Pro
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: fg, marginBottom: 10, lineHeight: 1.2 }}>
          Passe au Pro — 8€/mois
        </h2>

        {reason && (
          <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.85)', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', padding: '8px 12px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={11} style={{ flexShrink: 0 }} /> {reason}
          </div>
        )}

        <p style={{ fontSize: 14, color: sub, lineHeight: 1.6, marginBottom: 20 }}>
          Débloques tout Tiany sans limite pour <strong style={{ color: fg }}>8€/mois</strong>. Sans engagement, sans surprise.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
          {[
            'Projets illimités',
            'Export PDF Hollywood & Fountain',
            'IA génération de script (Claude)',
            'Membres équipe illimités',
            'Sync cloud multi-appareils',
            'Support prioritaire',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: sub }}>
              <Check size={12} style={{ color: '#e8a020', flexShrink: 0 }} />{f}
            </div>
          ))}
        </div>

        {/* Email capture */}
        {!sent ? (
          <>
            <p style={{ fontSize: 11, color: sub, marginBottom: 10 }}>
              Le paiement arrive très bientôt. Laisse ton email pour être notifié en premier :
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNotify()}
                style={{
                  flex: 1, background: inputBg, border: `1px solid ${borderColor}`,
                  borderRadius: 10, padding: '9px 12px', fontSize: 13,
                  color: fg, outline: 'none', colorScheme: theme === 'dark' ? 'dark' : 'light',
                }}
              />
              <button
                onClick={handleNotify}
                disabled={!email.trim()}
                style={{ background: '#e8a020', color: '#000', fontWeight: 800, fontSize: 13, padding: '9px 16px', borderRadius: 10, border: 'none', cursor: email.trim() ? 'pointer' : 'not-allowed', opacity: email.trim() ? 1 : 0.45, whiteSpace: 'nowrap' as const }}
              >
                Notifier →
              </button>
            </div>
            <p style={{ fontSize: 11, color: sub, marginTop: 10, opacity: 0.6 }}>
              En attendant, continue sur le plan gratuit (2 projets, export .txt).
            </p>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 12 }}>
            <p style={{ fontSize: 24, marginBottom: 6 }}>✓</p>
            <p style={{ fontSize: 14, color: '#4ade80', fontWeight: 700 }}>Noté !</p>
            <p style={{ fontSize: 12, color: sub, marginTop: 4 }}>Tu seras parmi les premiers informés au lancement.</p>
          </div>
        )}
      </div>
    </div>
  )
}
