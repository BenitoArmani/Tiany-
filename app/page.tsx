'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Camera, Lightbulb, MapPin, FileText, Layers, Play, DollarSign, Users, Check, Sparkles, Move, Volume2, Image as ImageIcon, Timer, BadgeCheck, ChevronRight } from 'lucide-react'

/* ─── Auth helpers ──────────────────────────────────────────────────── */
function getStoredUser() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('tiany_user') || 'null') } catch { return null }
}

/* ─── Login card ────────────────────────────────────────────────────── */
function LoginCard() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hasUser, setHasUser] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setHasUser(!!getStoredUser()) }, [])

  const handleStart = () => {
    if (!name.trim()) return
    setLoading(true)
    localStorage.setItem('tiany_user', JSON.stringify({ name: name.trim(), email: email.trim(), createdAt: new Date().toISOString() }))
    setTimeout(() => router.push('/projects'), 400)
  }

  const handleContinue = () => {
    setLoading(true)
    setTimeout(() => router.push('/projects'), 200)
  }

  if (hasUser) {
    const user = getStoredUser()
    return (
      <div className="login-card">
        <div className="login-card-inner">
          <div className="avatar-row">
            <div className="avatar">{user?.name?.[0]?.toUpperCase() ?? '?'}</div>
            <div>
              <p className="welcome-back">Bon retour,</p>
              <p className="user-name">{user?.name}</p>
            </div>
          </div>
          <button onClick={handleContinue} disabled={loading} className="btn-primary">
            {loading ? 'Chargement…' : 'Continuer vers mes projets →'}
          </button>
          <button onClick={() => { localStorage.removeItem('tiany_user'); setHasUser(false) }} className="btn-ghost">
            Changer de compte
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-card">
      <div className="login-card-inner">
        <div className="login-header">
          <div className="login-icon"><Film size={20} /></div>
          <div>
            <h3 className="login-title">Commencer gratuitement</h3>
            <p className="login-sub">14 jours — aucune carte bancaire</p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Prénom *</label>
          <input
            className="form-input"
            placeholder="Votre prénom"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email <span style={{ opacity: 0.5 }}>(optionnel)</span></label>
          <input
            className="form-input"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />
        </div>

        <button onClick={handleStart} disabled={!name.trim() || loading} className="btn-primary">
          {loading ? 'Ouverture…' : 'Commencer 14 jours gratuits →'}
        </button>

        <div className="guarantees">
          {['14j gratuits', 'Données locales', 'Sans carte bancaire'].map(g => (
            <span key={g} className="guarantee-badge"><Check size={9} />{g}</span>
          ))}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(240,237,232,0.2)', textAlign: 'center', marginTop: -4 }}>
          Court-métrage · Clip musical · Publicité · Documentaire
        </p>
      </div>
    </div>
  )
}

/* ─── App preview mockup ─────────────────────────────────────────────── */
function AppPreview() {
  const faces = [
    { label: 'Script', color: '#e8a020', icon: Film },
    { label: 'Storyboard', color: '#60a5fa', icon: ImageIcon },
    { label: 'Découpage', color: '#f97316', icon: Layers },
    { label: 'Son & Lum.', color: '#a78bfa', icon: Volume2 },
    { label: 'Notes', color: '#4ade80', icon: FileText },
    { label: 'Plan scène', color: '#f43f5e', icon: MapPin },
  ]
  return (
    <div className="mockup-window">
      <div className="mockup-chrome">
        <div className="traffic-lights">
          <span className="tl red" /><span className="tl yellow" /><span className="tl green" />
        </div>
        <span className="mockup-title">tiany — Premier court-métrage</span>
        <div className="mockup-actions">
          <span className="mock-badge mock-saved">● Sauvegardé</span>
          <span className="mock-badge mock-export">Exporter</span>
        </div>
      </div>
      <div className="mockup-body">
        <div className="scene-card-mock">
          <div className="scene-header-mock">
            <div className="scene-num">01</div>
            <input readOnly value="INT. CAFÉ — NUIT" className="scene-heading-mock" />
            <div className="face-dots">
              {faces.map((f, i) => (
                <div key={f.label} className={`face-dot ${i === 0 ? 'active' : ''}`}
                  style={{ background: i === 0 ? f.color : 'transparent', borderColor: f.color + (i === 0 ? '' : '40') }}>
                  {i === 0 && <f.icon size={7} color="#000" />}
                </div>
              ))}
            </div>
          </div>
          <div className="script-blocks">
            <div className="block-action">La salle est presque vide. Une ampoule nue se balance lentement au plafond. On entend la pluie dehors.</div>
            <div className="block-char">LÉA</div>
            <div className="block-dialogue">&ldquo;Tu crois vraiment qu&rsquo;on peut encore partir ?&rdquo;</div>
            <div className="block-action" style={{ opacity: 0.5 }}>Marc ne répond pas. Il fixe la fenêtre embuée.</div>
          </div>
          <div className="face-tabs-mock">
            {faces.map((f, i) => (
              <div key={f.label} className={`face-tab-mock ${i === 0 ? 'face-tab-active' : ''}`} style={{ '--fc': f.color } as React.CSSProperties}>
                <f.icon size={10} />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="floor-preview">
          <div className="floor-label"><MapPin size={9} /> Plan de scène</div>
          <div className="floor-canvas">
            <svg className="floor-svg" viewBox="0 0 100 75" preserveAspectRatio="none">
              <line x1="33" y1="0" x2="33" y2="75" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <line x1="67" y1="0" x2="67" y2="75" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <line x1="0" y1="37" x2="100" y2="37" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <polygon points="75,15 40,45 65,55" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.3)" strokeWidth="0.5"/>
              <line x1="75" y1="15" x2="52" y2="50" stroke="rgba(251,191,36,0.2)" strokeWidth="0.3" strokeDasharray="1.5,1"/>
              <line x1="75" y1="15" x2="32" y2="38" stroke="#fbbf24" strokeWidth="0.4" strokeDasharray="0.8,0.9" opacity="0.6"/>
              <path d="M 20 60 Q 35 30 55 25" fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth="0.6" strokeDasharray="2,1"/>
              <polygon points="55,25 51,27 53,22" fill="rgba(96,165,250,0.8)"/>
              <path d="M 32 38 L 50 55" fill="none" stroke="rgba(232,160,32,0.6)" strokeWidth="0.6" strokeDasharray="2,1"/>
              <polygon points="50,55 47,51 53,51" fill="rgba(232,160,32,0.7)"/>
            </svg>
            <div className="floor-item" style={{ left: '32%', top: '38%', background: 'rgba(232,160,32,0.25)', borderColor: '#fbbf24', boxShadow: '0 0 10px rgba(251,191,36,0.4)' }}>
              <div style={{ fontSize: 7, color: '#e8a020' }}>👤</div>
            </div>
            <div className="floor-item" style={{ left: '55%', top: '25%', background: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.6)' }}>
              <div style={{ fontSize: 7, color: '#60a5fa' }}>📷</div>
            </div>
            <div className="floor-item" style={{ left: '75%', top: '15%', background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.6)' }}>
              <div style={{ fontSize: 7, color: '#fbbf24' }}>💡</div>
            </div>
            <div className="floor-dest" style={{ left: '20%', top: '60%', borderColor: 'rgba(96,165,250,0.5)' }}/>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Features strip ─────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Film, color: '#e8a020', title: 'Éditeur screenplay', desc: 'Format pro (INT/EXT, action, dialogue). Comme Final Draft, gratuit.' },
  { icon: ImageIcon, color: '#60a5fa', title: 'Storyboard', desc: 'Importez vos croquis ou générez des cases depuis votre texte.' },
  { icon: Camera, color: '#f97316', title: 'Découpage technique', desc: 'Type de plan, angle, mouvement — chaque plan documenté.' },
  { icon: MapPin, color: '#f43f5e', title: 'Plan de scène', desc: 'Éditeur vue de dessus : personnages, caméras, lumières avec trajectoires.' },
  { icon: DollarSign, color: '#22c55e', title: 'Budget & Logistique', desc: 'Suivi des dépenses par catégorie, PIN, temps de tournage par scène.' },
  { icon: Users, color: '#a78bfa', title: 'Équipe & Chat', desc: 'Communication d\'équipe intégrée, DMs et discussion de groupe.' },
  { icon: Lightbulb, color: '#fbbf24', title: 'Éclairage & Son', desc: 'Clé, fill, contre-jour, ambiance musicale — tout est noté.' },
  { icon: Move, color: '#34d399', title: 'Trajectoires', desc: 'Chemins de mouvement pour acteurs, caméras et lumières.' },
]

function FeatureTicker() {
  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {[...FEATURES, ...FEATURES].map((f, i) => (
          <div key={i} className="ticker-item">
            <div className="ticker-icon" style={{ background: `${f.color}18`, borderColor: `${f.color}30` }}>
              <f.icon size={13} style={{ color: f.color }} />
            </div>
            <span className="ticker-label">{f.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Who is it for ─────────────────────────────────────────────────── */
const AUDIENCE = [
  { emoji: '🎓', title: 'Étudiants en cinéma', points: ['Premier court-métrage clé en main', 'Présentation prof avec PDF export', 'Apprendre les codes du métier'] },
  { emoji: '🎬', title: 'Réalisateurs indep.', points: ['Pré-prod ultra rapide', 'Communique avec ton chef-op', 'Plan de scène interactif'] },
  { emoji: '🎵', title: 'Clips & publicités', points: ['Modèle clip musical intégré', 'Structure pub 30s prête', 'Découpage rythmique'] },
]

/* ─── Testimonials ───────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { quote: "Tiany m'a permis de préparer mon premier court-métrage en 3 jours. Avant j'utilisais 4 apps différentes, maintenant tout est au même endroit.", name: 'Marie L.', role: 'Étudiante en cinéma, ESEC Paris', color: '#e8a020', initials: 'ML' },
  { quote: "Enfin un outil gratuit à la hauteur des prods pros. Mon chef-op et moi préparons les plans ensemble — sans se perdre dans des fichiers PDF.", name: 'Karim B.', role: 'Réalisateur indépendant, Lyon', color: '#60a5fa', initials: 'KB' },
  { quote: "J'ai exporté mon script en format Hollywood pour ma présentation de fin d'année. Parfait du premier coup, sans rien formater.", name: 'Sophie A.', role: '1ère Assistante réalisatrice', color: '#4ade80', initials: 'SA' },
]

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #f0ede8; font-family: -apple-system, 'Inter', sans-serif; }

        /* ── Nav ── */
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; transition: background 0.3s, border-color 0.3s; }
        .nav-scrolled { background: rgba(0,0,0,0.92); border-bottom: 1px solid rgba(255,255,255,0.07); backdrop-filter: blur(16px); }
        .nav-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .nav-logo-icon { width: 28px; height: 28px; background: #e8a020; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .nav-logo-text { font-weight: 900; font-size: 17px; color: #f0ede8; }
        .nav-beta { font-size: 9px; font-weight: 700; background: rgba(232,160,32,0.12); color: #e8a020; border: 1px solid rgba(232,160,32,0.25); padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em; }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-link { font-size: 13px; color: rgba(240,237,232,0.5); text-decoration: none; transition: color 0.2s; }
        .nav-link:hover { color: #f0ede8; }
        .nav-cta { font-size: 13px; font-weight: 700; background: #e8a020; color: #000; padding: 7px 18px; border-radius: 10px; text-decoration: none; transition: opacity 0.2s; }
        .nav-cta:hover { opacity: 0.88; }

        /* ── Hero ── */
        .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 80px 24px 60px; position: relative; overflow: hidden; background: #000; }
        .hero-photo-layer { position: absolute; right: 0; top: 0; bottom: 0; width: 58%; z-index: 0; overflow: hidden; pointer-events: none; }
        .hero-photo-layer img { width: 100%; height: 100%; object-fit: cover; opacity: 0.5; }
        .hero-photo-mask { position: absolute; inset: 0; background: linear-gradient(to right, #000 5%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.15) 100%); }
        .hero-photo-bar-top { position: absolute; top: 0; left: 0; right: 0; height: 13%; background: #000; }
        .hero-photo-bar-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 11%; background: #000; }
        .hero-photo-tc { position: absolute; top: 15%; left: 20px; font-family: monospace; font-size: 10px; color: rgba(232,160,32,0.65); letter-spacing: 0.1em; }
        @media (max-width: 900px) { .hero-photo-layer { width: 100%; opacity: 0.3; } }
        .hero-inner { max-width: 1200px; margin: 0 auto; width: 100%; display: grid; grid-template-columns: 1fr 400px; gap: 64px; align-items: center; position: relative; z-index: 1; padding-top: 40px; }
        @media (max-width: 900px) { .hero-inner { grid-template-columns: 1fr; gap: 40px; } }
        .hero-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #e8a020; background: rgba(232,160,32,0.08); border: 1px solid rgba(232,160,32,0.2); padding: 5px 12px; border-radius: 20px; margin-bottom: 24px; }
        .hero-h1 { font-size: clamp(36px, 5vw, 64px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; color: #f0ede8; margin-bottom: 20px; }
        .hero-h1 em { color: #e8a020; font-style: normal; }
        .hero-sub { font-size: 15px; color: rgba(240,237,232,0.5); line-height: 1.7; margin-bottom: 24px; max-width: 480px; }
        .hero-letterbox-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 32px; background: #000; pointer-events: none; }

        /* ── Crew strip ── */
        .crew-strip { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
        .crew-avatars { display: flex; }
        .crew-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #000; border: 2px solid #000; flex-shrink: 0; }
        .crew-label { font-size: 12px; color: rgba(240,237,232,0.4); line-height: 1.4; }

        /* ── Login card ── */
        .login-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(20px); box-shadow: 0 0 60px rgba(232,160,32,0.08), 0 32px 64px rgba(0,0,0,0.5); }
        .login-card-inner { padding: 28px; display: flex; flex-direction: column; gap: 16px; }
        .login-header { display: flex; align-items: center; gap: 12px; padding-bottom: 4px; }
        .login-icon { width: 36px; height: 36px; background: #e8a020; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #000; flex-shrink: 0; }
        .login-title { font-size: 15px; font-weight: 800; color: #f0ede8; }
        .login-sub { font-size: 11px; color: rgba(240,237,232,0.4); margin-top: 2px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 11px; font-weight: 600; color: rgba(240,237,232,0.5); letter-spacing: 0.04em; }
        .form-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; font-size: 14px; color: #f0ede8; outline: none; transition: border-color 0.2s; color-scheme: dark; }
        .form-input:focus { border-color: rgba(232,160,32,0.5); background: rgba(255,255,255,0.08); }
        .form-input::placeholder { color: rgba(240,237,232,0.25); }
        .btn-primary { background: #e8a020; color: #000; font-weight: 800; font-size: 14px; padding: 12px 20px; border-radius: 12px; border: none; cursor: pointer; transition: opacity 0.2s, transform 0.1s; width: 100%; }
        .btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: none; color: rgba(240,237,232,0.35); font-size: 12px; cursor: pointer; padding: 4px; transition: color 0.2s; }
        .btn-ghost:hover { color: rgba(240,237,232,0.6); }
        .guarantees { display: flex; flex-wrap: wrap; gap: 6px; }
        .guarantee-badge { display: flex; align-items: center; gap: 4px; font-size: 10px; color: rgba(240,237,232,0.35); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); padding: 3px 8px; border-radius: 20px; }
        .avatar-row { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 42px; height: 42px; background: #e8a020; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; color: #000; flex-shrink: 0; }
        .welcome-back { font-size: 11px; color: rgba(240,237,232,0.4); }
        .user-name { font-size: 16px; font-weight: 800; color: #f0ede8; }

        /* ── Proof bar ── */
        .proof-bar { padding: 22px 24px; background: #050505; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .proof-bar-inner { max-width: 1000px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap; }
        .proof-stat { text-align: center; padding: 8px 32px; }
        .proof-stat + .proof-stat { border-left: 1px solid rgba(255,255,255,0.07); }
        .proof-stat-val { font-size: 26px; font-weight: 900; color: #f0ede8; line-height: 1; }
        .proof-stat-label { font-size: 11px; color: rgba(240,237,232,0.35); margin-top: 4px; }
        @media (max-width: 600px) { .proof-stat { padding: 8px 16px; } .proof-stat-val { font-size: 20px; } }

        /* ── Ticker ── */
        .ticker-wrap { overflow: hidden; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); background: #050505; padding: 14px 0; }
        .ticker-track { display: flex; gap: 40px; animation: ticker 30s linear infinite; width: max-content; }
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .ticker-item { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .ticker-icon { width: 26px; height: 26px; border-radius: 6px; border: 1px solid; display: flex; align-items: center; justify-content: center; }
        .ticker-label { font-size: 12px; font-weight: 600; color: rgba(240,237,232,0.45); }

        /* ── Feature sections ── */
        .feature-section { padding: 96px 24px; }
        .feature-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        @media (max-width: 860px) { .feature-inner { grid-template-columns: 1fr; gap: 36px; } }
        .feature-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; margin-bottom: 20px; }
        .feature-h2 { font-size: clamp(24px, 3vw, 38px); font-weight: 900; color: #f0ede8; line-height: 1.15; margin-bottom: 16px; }
        .feature-desc { font-size: 15px; color: rgba(240,237,232,0.5); line-height: 1.75; margin-bottom: 28px; }
        .feature-points { display: flex; flex-direction: column; gap: 12px; }
        .feature-point { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: rgba(240,237,232,0.6); line-height: 1.5; }
        .feature-point-icon { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
        .feature-visual { border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: #0a0a0a; }
        @media (max-width: 860px) { .feature-visual, .feature-visual-order-first { order: -1; } }

        /* ── App preview mockup ── */
        .preview-section { padding: 0 24px 80px; background: #000; }
        .preview-inner { max-width: 1200px; margin: 0 auto; }
        .preview-label { text-align: center; margin-bottom: 36px; }
        .preview-label p { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #e8a020; margin-bottom: 12px; }
        .preview-label h2 { font-size: clamp(26px, 4vw, 42px); font-weight: 900; color: #f0ede8; line-height: 1.15; }
        .mockup-window { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05); }
        .mockup-chrome { background: #131313; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 10px 16px; display: flex; align-items: center; gap: 12px; }
        .traffic-lights { display: flex; gap: 6px; flex-shrink: 0; }
        .tl { width: 11px; height: 11px; border-radius: 50%; }
        .tl.red { background: #ff5f57; } .tl.yellow { background: #ffbd2e; } .tl.green { background: #27c93f; }
        .mockup-title { font-size: 12px; color: rgba(240,237,232,0.35); flex: 1; text-align: center; }
        .mockup-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .mock-badge { font-size: 10px; padding: 3px 10px; border-radius: 6px; font-weight: 600; }
        .mock-saved { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }
        .mock-export { background: rgba(232,160,32,0.1); color: #e8a020; border: 1px solid rgba(232,160,32,0.2); }
        .mockup-body { display: grid; grid-template-columns: 1fr 280px; }
        @media (max-width: 700px) { .mockup-body { grid-template-columns: 1fr; } .floor-preview { display: none; } }
        .scene-card-mock { padding: 16px; border-right: 1px solid rgba(255,255,255,0.06); }
        .scene-header-mock { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .scene-num { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.2); width: 18px; flex-shrink: 0; }
        .scene-heading-mock { background: transparent; border: none; outline: none; font-size: 11px; font-weight: 700; color: #e8a020; letter-spacing: 0.06em; flex: 1; }
        .face-dots { display: flex; gap: 4px; margin-left: auto; flex-shrink: 0; }
        .face-dot { width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid; display: flex; align-items: center; justify-content: center; }
        .script-blocks { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.8; space-y: 4px; padding: 0 0 12px; color: rgba(240,237,232,0.7); }
        .block-action { color: rgba(200,196,190,0.7); margin-bottom: 8px; }
        .block-char { text-align: center; padding-left: 30%; font-weight: 700; color: #f0ede8; text-transform: uppercase; letter-spacing: 0.06em; }
        .block-dialogue { padding: 0 14%; font-style: italic; color: #ddd9d3; margin-bottom: 8px; }
        .face-tabs-mock { display: flex; gap: 2px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; }
        .face-tab-mock { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 600; color: rgba(240,237,232,0.3); cursor: default; }
        .face-tab-active { background: rgba(232,160,32,0.12); color: var(--fc); }
        .floor-preview { padding: 12px; background: #080808; }
        .floor-label { display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; color: #f43f5e; margin-bottom: 8px; }
        .floor-canvas { position: relative; aspect-ratio: 4/3; background: #0c0c10; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; }
        .floor-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .floor-item { position: absolute; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); transition: box-shadow 0.3s; }
        .floor-dest { position: absolute; width: 12px; height: 12px; border-radius: 50%; border: 1.5px dashed; transform: translate(-50%, -50%); }

        /* ── Section label ── */
        .section-label { text-align: center; margin-bottom: 48px; }
        .section-label p { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #e8a020; margin-bottom: 12px; }
        .section-label h2 { font-size: clamp(24px, 3.5vw, 38px); font-weight: 900; color: #f0ede8; line-height: 1.2; }

        /* ── Testimonials ── */
        .proof-section { padding: 96px 24px; background: #050505; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .proof-inner { max-width: 1000px; margin: 0 auto; }
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 48px; }
        @media (max-width: 700px) { .testimonials-grid { grid-template-columns: 1fr; } }
        .testimonial-card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 16px; }
        .testimonial-quote { font-size: 14px; line-height: 1.75; color: rgba(240,237,232,0.6); font-style: italic; flex: 1; }
        .testimonial-author { display: flex; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
        .testimonial-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #000; flex-shrink: 0; }
        .testimonial-name { font-size: 13px; font-weight: 700; color: #f0ede8; }
        .testimonial-role { font-size: 11px; color: rgba(240,237,232,0.3); margin-top: 1px; }
        .stars { font-size: 12px; color: #e8a020; letter-spacing: 2px; margin-bottom: 4px; }

        /* ── For who ── */
        .audience-section { padding: 80px 24px; background: #000; }
        .audience-inner { max-width: 1000px; margin: 0 auto; }
        .audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 700px) { .audience-grid { grid-template-columns: 1fr; } }
        .audience-card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: border-color 0.2s; }
        .audience-card:hover { border-color: rgba(232,160,32,0.2); }
        .audience-emoji { font-size: 32px; margin-bottom: 16px; }
        .audience-title { font-size: 16px; font-weight: 800; color: #f0ede8; margin-bottom: 14px; }
        .audience-points { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .audience-point { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: rgba(240,237,232,0.5); }
        .audience-check { flex-shrink: 0; color: #e8a020; margin-top: 2px; }

        /* ── Pricing ── */
        .pricing-section { padding: 96px 24px; background: #000; }
        .pricing-inner { max-width: 860px; margin: 0 auto; }
        .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 52px; }
        @media (max-width: 700px) { .pricing-grid { grid-template-columns: 1fr; } }
        .pricing-card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 36px; }
        .pricing-card.featured { border-color: rgba(232,160,32,0.35); background: linear-gradient(140deg, rgba(232,160,32,0.04) 0%, #0a0a0a 55%); box-shadow: 0 0 40px rgba(232,160,32,0.06); }
        .pricing-badge { display: inline-flex; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 20px; }
        .pricing-price { font-size: 52px; font-weight: 900; color: #f0ede8; line-height: 1; margin-bottom: 4px; }
        .pricing-price-sub { font-size: 13px; color: rgba(240,237,232,0.35); margin-bottom: 20px; }
        .pricing-name { font-size: 20px; font-weight: 800; color: #f0ede8; margin-bottom: 8px; }
        .pricing-desc { font-size: 14px; color: rgba(240,237,232,0.45); margin-bottom: 28px; line-height: 1.6; }
        .pricing-features { display: flex; flex-direction: column; gap: 11px; margin-bottom: 32px; }
        .pricing-feature { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(240,237,232,0.6); }
        .pricing-btn { display: block; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 800; font-size: 14px; text-decoration: none; transition: opacity 0.2s, transform 0.1s; cursor: pointer; }
        .pricing-btn.primary { background: #e8a020; color: #000; border: none; }
        .pricing-btn.primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .pricing-btn.secondary { background: rgba(255,255,255,0.04); color: rgba(240,237,232,0.4); border: 1px solid rgba(255,255,255,0.08); }

        /* ── CTA ── */
        .cta-section { padding: 96px 24px 112px; text-align: center; background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(232,160,32,0.07) 0%, transparent 70%); }
        .cta-title { font-size: clamp(28px, 5vw, 52px); font-weight: 900; color: #f0ede8; line-height: 1.1; margin-bottom: 16px; }
        .cta-sub { font-size: 16px; color: rgba(240,237,232,0.45); margin-bottom: 36px; }
        .cta-btn { display: inline-flex; align-items: center; gap: 8px; background: #e8a020; color: #000; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 14px; text-decoration: none; transition: opacity 0.2s, transform 0.1s; }
        .cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Full mobile responsive ── */
        @media (max-width: 640px) {
          .nav-link { display: none; }
          .nav-cta { font-size: 12px; padding: 6px 12px; }
          .nav-logo-text { font-size: 15px; }

          .hero { padding: 72px 16px 40px; }
          .hero-photo-layer { width: 100%; opacity: 0.18; }
          .hero-inner { gap: 28px; padding-top: 24px; }
          .hero-sub { font-size: 14px; }
          .crew-label { font-size: 11px; }

          .proof-bar { padding: 0; }
          .proof-bar-inner { display: grid !important; grid-template-columns: 1fr 1fr; }
          .proof-stat { padding: 16px 10px; border-left: none !important; }
          .proof-stat:nth-child(2n) { border-left: 1px solid rgba(255,255,255,0.07) !important; }
          .proof-stat:nth-child(n+3) { border-top: 1px solid rgba(255,255,255,0.07); }
          .proof-stat-val { font-size: 22px !important; }

          .feature-section { padding: 52px 16px !important; }
          .feature-visual { order: -1; }
          .feature-h2 { font-size: 24px; }
          .feature-desc { font-size: 14px; }

          .proof-section { padding: 56px 16px; }
          .testimonials-grid { gap: 14px; }

          .preview-section { padding: 0 16px 52px !important; }
          .preview-section > div { padding-top: 52px; }

          .audience-section { padding: 52px 16px; }

          .pricing-section { padding: 56px 16px; }
          .pricing-card { padding: 24px 20px; }
          .pricing-price { font-size: 42px; }

          .cta-section { padding: 56px 16px 80px; }
          .cta-title { font-size: 28px; }

          .section-label h2 { font-size: 24px; }
          .section-label { margin-bottom: 32px; }
        }

        @media (max-width: 480px) {
          .hero-h1 { font-size: 32px !important; }
          .feature-inner { gap: 24px; }
          .login-card-inner { padding: 20px; }
        }

        /* ── Footer ── */
        .footer { padding: 28px 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .footer-logo { display: flex; align-items: center; gap: 8px; }
        .footer-logo-icon { width: 22px; height: 22px; background: #e8a020; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
        .footer-logo-text { font-weight: 900; font-size: 14px; color: #f0ede8; }
        .footer-copy { font-size: 12px; color: rgba(240,237,232,0.25); }
      `}</style>

      {/* Nav */}
      <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <a href="/" className="nav-logo">
          <div className="nav-logo-icon"><Film size={13} color="#000" /></div>
          <span className="nav-logo-text">tiany</span>
          <span className="nav-beta">BÊTA</span>
        </a>
        <div className="nav-right">
          <a href="#audience" className="nav-link">Pour qui</a>
          <a href="#pricing" className="nav-link">Tarifs</a>
          <a href="/projects" className="nav-cta">14 jours gratuits →</a>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        {/* Cinematic photo layer */}
        <div className="hero-photo-layer">
          <img
            src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=80"
            alt="Tournage cinéma"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="hero-photo-mask" />
          <div className="hero-photo-bar-top" />
          <div className="hero-photo-bar-bottom" />
          <div className="hero-photo-tc">01:32:45:12 · REC ●</div>
        </div>

        <div className="hero-inner">
          {/* Left: text */}
          <div>
            <div className="hero-tag"><Sparkles size={10} /> Pré-production cinéma tout-en-un</div>
            <h1 className="hero-h1">
              La pré-production<br />
              <em>sans friction.</em>
            </h1>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(240,237,232,0.85)', lineHeight: 1.45, marginBottom: 14 }}>
              Écris ton script, crée ton storyboard et organise ton tournage — tout en un seul outil.
            </p>
            <p className="hero-sub">
              Arrête de jongler entre 5 apps. Script, storyboard, découpage, plan de scène et budget réunis dans une interface pensée pour les réalisateurs.
            </p>
            {/* Crew strip */}
            <div className="crew-strip">
              <div className="crew-avatars">
                {[{ i: 'RE', c: '#e8a020' }, { i: 'DP', c: '#60a5fa' }, { i: 'SC', c: '#f43f5e' }, { i: 'AS', c: '#4ade80' }].map((a, idx) => (
                  <div key={idx} className="crew-avatar" style={{ background: a.c, marginLeft: idx > 0 ? -9 : 0, zIndex: 4 - idx }}>
                    {a.i}
                  </div>
                ))}
              </div>
              <span className="crew-label">Réalisateur · Chef op · Scripte · Son<br />toute l'équipe sur le même outil</span>
            </div>
          </div>

          {/* Right: login */}
          <LoginCard />
        </div>
        <div className="hero-letterbox-bottom" />
      </section>

      {/* ─── Social proof bar ─────────────────────────────────────────── */}
      <div className="proof-bar">
        <div className="proof-bar-inner">
          {[
            { val: '★ 4.9', label: 'Note moyenne' },
            { val: '6', label: 'Outils par scène' },
            { val: '14j', label: 'Gratuit pour tester' },
            { val: '15', label: 'Langues disponibles' },
          ].map((s, i) => (
            <div key={i} className="proof-stat">
              <div className="proof-stat-val" style={{ color: i === 0 ? '#e8a020' : '#f0ede8' }}>{s.val}</div>
              <div className="proof-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Feature ticker ───────────────────────────────────────────── */}
      <FeatureTicker />

      {/* ─── Feature 1: Script editor ─────────────────────────────────── */}
      <section className="feature-section" style={{ background: '#000' }}>
        <div className="feature-inner">
          <div>
            <div className="feature-tag" style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020' }}>
              <Film size={11} /> Écriture
            </div>
            <h2 className="feature-h2">Ton script,<br />exactement comme les pros</h2>
            <p className="feature-desc">
              Format Hollywood automatique — INT/EXT, action, dialogues, transitions. Indiscernable d'un script sorti de Final Draft, sans débourser 149€.
            </p>
            <div className="feature-points">
              {[
                'Format industry-standard sans configuration',
                'Numérotation et mise en page automatiques',
                'Export PDF Hollywood en un clic',
                'Export Fountain pour Final Cut & Premiere Pro',
              ].map(p => (
                <div key={p} className="feature-point">
                  <div className="feature-point-icon" style={{ background: 'rgba(232,160,32,0.1)' }}>
                    <Check size={11} style={{ color: '#e8a020' }} />
                  </div>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="feature-visual">
            <div style={{ padding: 28, fontFamily: 'Courier New, monospace', fontSize: 12, lineHeight: 2, color: 'rgba(240,237,232,0.7)', background: '#0a0a0a', minHeight: 340 }}>
              <div style={{ color: '#e8a020', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 20 }}>INT. STUDIO D'ENREGISTREMENT — NUIT</div>
              <div style={{ color: 'rgba(240,237,232,0.55)', marginBottom: 14 }}>La pièce est plongée dans une semi-obscurité. Les voyants rouges des équipements clignotent.</div>
              <div style={{ textAlign: 'center', fontWeight: 700, color: '#f0ede8', letterSpacing: '0.05em', marginBottom: 4 }}>MAYA</div>
              <div style={{ padding: '0 15%', color: '#ddd9d3', fontStyle: 'italic', marginBottom: 14 }}>(voix basse)<br />Tu l'entends aussi ? Ce silence juste avant le son...</div>
              <div style={{ color: 'rgba(240,237,232,0.55)', marginBottom: 14 }}>Elle pose la main sur la console. Le niveau VU remonte lentement.</div>
              <div style={{ color: '#6b7280', textAlign: 'right', letterSpacing: '0.1em', marginTop: 28 }}>COUPE SUR :</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature 2: Storyboard (reversed) ────────────────────────── */}
      <section className="feature-section" style={{ background: '#050505', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="feature-inner">
          <div className="feature-visual feature-visual-order-first" style={{ order: -1 }}>
            <div style={{ padding: 24, background: '#0a0a0a' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.08em', marginBottom: 14 }}>STORYBOARD — SCÈNE 3 · 4 PLANS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { bg: 'rgba(232,160,32,0.08)', label: 'Plan large — ouverture', border: 'rgba(232,160,32,0.2)' },
                  { bg: 'rgba(96,165,250,0.08)', label: 'Insert — mains sur console', border: 'rgba(96,165,250,0.2)' },
                  { bg: 'rgba(244,63,94,0.08)', label: 'Plan américain — Maya', border: 'rgba(244,63,94,0.2)' },
                  { bg: 'rgba(74,222,128,0.08)', label: 'Contre-plongée finale', border: 'rgba(74,222,128,0.2)' },
                ].map((f, i) => (
                  <div key={i} style={{ background: f.bg, borderRadius: 10, border: `1px solid ${f.border}`, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: f.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={14} style={{ color: 'rgba(240,237,232,0.5)' }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'rgba(240,237,232,0.4)', textAlign: 'center', lineHeight: 1.4 }}>{f.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 16px', background: 'rgba(96,165,250,0.07)', borderRadius: 10, border: '1px solid rgba(96,165,250,0.15)', fontSize: 11, color: 'rgba(240,237,232,0.45)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>4 plans · durée ~3min</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>+ Ajouter image</span>
              </div>
            </div>
          </div>
          <div>
            <div className="feature-tag" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>
              <ImageIcon size={11} /> Storyboard
            </div>
            <h2 className="feature-h2">Visualise chaque plan<br />avant de tourner</h2>
            <p className="feature-desc">
              Importe tes croquis, photos ou captures d'écran. Organise les plans scène par scène. Présente ta vision à l'équipe en mode plein écran — comme un vrai director's book.
            </p>
            <div className="feature-points">
              {[
                'Upload multi-images par scène, glisser-déposer',
                'Recadrage et focal point par image',
                'Mode lightbox plein écran avec navigation',
                'Mode présentation cinématique (Star Wars crawl, Pitch)',
              ].map(p => (
                <div key={p} className="feature-point">
                  <div className="feature-point-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
                    <Check size={11} style={{ color: '#60a5fa' }} />
                  </div>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature 3: Floor plan + Team ────────────────────────────── */}
      <section className="feature-section" style={{ background: '#000' }}>
        <div className="feature-inner">
          <div>
            <div className="feature-tag" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>
              <MapPin size={11} /> Plan de scène & équipe
            </div>
            <h2 className="feature-h2">Coordonne ton équipe<br />plan par plan</h2>
            <p className="feature-desc">
              Dessine ta scène vue de dessus : personnages, caméra, lumières, trajectoires. Partage avec le chef-op, l'ingénieur son, la scripte. Tout le monde sait où se mettre.
            </p>
            <div className="feature-points">
              {[
                'Éditeur SVG interactif vue de dessus',
                'Personnages, caméras, lumières et obstacles',
                'Trajectoires de mouvement et cones de lumière',
                'Mode tournage live avec chrono et budget brûlé',
              ].map(p => (
                <div key={p} className="feature-point">
                  <div className="feature-point-icon" style={{ background: 'rgba(244,63,94,0.1)' }}>
                    <Check size={11} style={{ color: '#f43f5e' }} />
                  </div>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="feature-visual">
            <div style={{ padding: 20, background: '#080810', minHeight: 300 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={10} /> PLAN DE SCÈNE — SCÈNE 4
              </div>
              <div style={{ position: 'relative', aspectRatio: '4/3', background: '#0c0c14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                <svg viewBox="0 0 300 225" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <pattern id="pgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="300" height="225" fill="url(#pgrid)" />
                  <rect x="20" y="20" width="260" height="185" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" rx="4" />
                  {/* Light cone */}
                  <polygon points="60,50 100,130 30,140" fill="rgba(251,191,36,0.07)" />
                  <line x1="60" y1="50" x2="100" y2="130" stroke="rgba(251,191,36,0.2)" strokeWidth="0.8" strokeDasharray="4,3"/>
                  <line x1="60" y1="50" x2="30" y2="140" stroke="rgba(251,191,36,0.2)" strokeWidth="0.8" strokeDasharray="4,3"/>
                  {/* Camera path */}
                  <path d="M 240 170 Q 200 120 150 90" fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1" strokeDasharray="5,3"/>
                  <polygon points="150,90 154,98 146,97" fill="#60a5fa" opacity="0.7"/>
                  {/* Actor path */}
                  <path d="M 90 130 L 150 150" fill="none" stroke="rgba(232,160,32,0.5)" strokeWidth="1" strokeDasharray="4,3"/>
                  <polygon points="150,150 145,145 145,155" fill="#e8a020" opacity="0.7"/>
                  {/* Camera */}
                  <circle cx="240" cy="170" r="14" fill="rgba(96,165,250,0.15)" stroke="#60a5fa" strokeWidth="1.5"/>
                  <text x="240" y="175" textAnchor="middle" fontSize="10" fill="#60a5fa">📷</text>
                  {/* Actor 1 */}
                  <circle cx="90" cy="130" r="12" fill="rgba(232,160,32,0.15)" stroke="#e8a020" strokeWidth="1.5"/>
                  <text x="90" y="134" textAnchor="middle" fontSize="9" fill="#e8a020" fontWeight="700">A1</text>
                  {/* Actor 2 */}
                  <circle cx="195" cy="145" r="12" fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="1.5"/>
                  <text x="195" y="149" textAnchor="middle" fontSize="9" fill="#4ade80" fontWeight="700">A2</text>
                  {/* Light */}
                  <circle cx="60" cy="50" r="11" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth="1.5"/>
                  <text x="60" y="54" textAnchor="middle" fontSize="9" fill="#fbbf24">💡</text>
                </svg>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                {[{ c: '#e8a020', l: 'A1 — Maya' }, { c: '#4ade80', l: 'A2 — Marc' }, { c: '#60a5fa', l: 'Caméra' }].map(b => (
                  <div key={b.l} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: `${b.c}15`, border: `1px solid ${b.c}30`, color: b.c }}>{b.l}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────── */}
      <section className="proof-section">
        <div className="proof-inner">
          <div className="section-label">
            <p>Ils utilisent Tiany</p>
            <h2>Des créateurs qui ont passé le cap</h2>
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <p className="testimonial-name">{t.name}</p>
                    <p className="testimonial-role">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── App preview ──────────────────────────────────────────────── */}
      <section className="preview-section" style={{ paddingTop: 96 }}>
        <div className="preview-inner">
          <div className="preview-label">
            <p>Aperçu de l'application</p>
            <h2>Toute la pré-production<br />sur une seule page</h2>
          </div>
          <AppPreview />
        </div>
      </section>

      {/* ─── Comparison ───────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px', background: '#000' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="section-label" style={{ marginBottom: 36 }}>
            <p>Comparaison</p>
            <h2>Pourquoi pas StudioBinder ?</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', minWidth: 520 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ padding: '12px 20px', fontSize: 11, color: 'rgba(240,237,232,0.3)', fontWeight: 600 }}>Fonctionnalité</div>
              {[
                { name: 'Tiany', sub: '14j gratuits', color: '#e8a020', highlight: true },
                { name: 'StudioBinder', sub: '$29/mois', color: 'rgba(240,237,232,0.3)' },
                { name: 'Final Draft', sub: '$149 one-time', color: 'rgba(240,237,232,0.3)' },
              ].map(col => (
                <div key={col.name} style={{ padding: '12px 16px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: col.highlight ? 'rgba(232,160,32,0.04)' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: col.color }}>{col.name}</div>
                  {col.sub && <div style={{ fontSize: 10, color: col.highlight ? 'rgba(232,160,32,0.6)' : 'rgba(240,237,232,0.3)', marginTop: 2 }}>{col.sub}</div>}
                </div>
              ))}
            </div>
            {[
              { feature: 'Éditeur screenplay', tiany: '✓', sb: '✓', fd: '✓' },
              { feature: 'Storyboard intégré', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Plan de scène interactif', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Budget & suivi', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Mode tournage live', tiany: '✓', sb: '✗', fd: '✗' },
              { feature: 'IA génération de script', tiany: '✓', sb: '✗', fd: '✗' },
              { feature: 'Essai gratuit', tiany: '14 jours', sb: '✗', fd: '✗' },
            ].map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ padding: '11px 20px', fontSize: 12, color: 'rgba(240,237,232,0.6)' }}>{row.feature}</div>
                {[row.tiany, row.sb, row.fd].map((val, j) => (
                  <div key={j} style={{ padding: '11px 16px', borderLeft: '1px solid rgba(255,255,255,0.05)', background: j === 0 ? 'rgba(232,160,32,0.03)' : 'transparent', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: j === 0 && val !== '✗' ? 12 : 14, fontWeight: 700, color: val === '✓' || (j === 0 && val !== '✗') ? (j === 0 ? '#e8a020' : '#4ade80') : 'rgba(240,237,232,0.2)' }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(240,237,232,0.25)' }}>* Comparaison indicative — données 2026</p>
        </div>
      </section>

      {/* ─── For who ──────────────────────────────────────────────────── */}
      <section className="audience-section" id="audience">
        <div className="audience-inner">
          <div className="section-label">
            <p>Pour qui</p>
            <h2>Conçu pour le monde du cinéma</h2>
          </div>
          <div className="audience-grid">
            {AUDIENCE.map(a => (
              <div key={a.title} className="audience-card">
                <div className="audience-emoji">{a.emoji}</div>
                <h3 className="audience-title">{a.title}</h3>
                <ul className="audience-points">
                  {a.points.map(p => (
                    <li key={p} className="audience-point">
                      <Check size={12} className="audience-check" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────────────── */}
      <section className="pricing-section" id="pricing">
        <div className="pricing-inner">
          <div className="section-label">
            <p>Tarifs transparents</p>
            <h2>Commence gratuitement.<br />Paie si tu aimes.</h2>
          </div>
          <div className="pricing-grid">
            {/* Plan 14 jours */}
            <div className="pricing-card featured">
              <div className="pricing-badge" style={{ background: 'rgba(232,160,32,0.15)', color: '#e8a020' }}>
                ✦ 14 jours gratuits
              </div>
              <div className="pricing-price">0€</div>
              <div className="pricing-price-sub">puis puis 8€/mois</div>
              <h3 className="pricing-name">Plan Essai</h3>
              <p className="pricing-desc">Toutes les fonctionnalités débloquées, sans limite. Sans carte bancaire requise.</p>
              <div className="pricing-features">
                {[
                  'Script · Storyboard · Floor Plan',
                  'Découpage technique & Son & Lumière',
                  'Budget avec suivi et catégories',
                  'Mode tournage live avec chrono',
                  'Export PDF Hollywood & Fountain',
                  'Collaboration jusqu\'à 5 membres',
                  'Sync cloud multi-appareils',
                ].map(f => (
                  <div key={f} className="pricing-feature">
                    <Check size={13} style={{ color: '#e8a020', flexShrink: 0 }} />{f}
                  </div>
                ))}
              </div>
              <a href="/projects" className="pricing-btn primary">Commencer 14 jours gratuits →</a>
            </div>

            {/* Pro — coming soon */}
            <div className="pricing-card">
              <div className="pricing-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(240,237,232,0.35)' }}>
                Bientôt disponible
              </div>
              <div className="pricing-price" style={{ color: 'rgba(240,237,232,0.35)' }}>Pro</div>
              <div className="pricing-price-sub">Tarif à annoncer</div>
              <h3 className="pricing-name" style={{ color: 'rgba(240,237,232,0.5)' }}>Plan Pro</h3>
              <p className="pricing-desc">Pour les équipes, les productions régulières et les projets ambitieux.</p>
              <div className="pricing-features" style={{ opacity: 0.45 }}>
                {[
                  'Tout le Plan Essai, pour toujours',
                  'Projets et membres illimités',
                  'Génération IA de script (Claude)',
                  'Export storyboard haute résolution',
                  'Rôles et permissions avancés',
                  'Support prioritaire',
                ].map(f => (
                  <div key={f} className="pricing-feature">
                    <Check size={13} style={{ color: 'rgba(240,237,232,0.3)', flexShrink: 0 }} />{f}
                  </div>
                ))}
              </div>
              <div className="pricing-btn secondary" style={{ cursor: 'default' }}>
                Être notifié au lancement
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────── */}
      <section className="cta-section">
        <h2 className="cta-title">Ton prochain film<br /><em style={{ color: '#e8a020', fontStyle: 'normal' }}>commence ici.</em></h2>
        <p className="cta-sub">14 jours gratuits. Sans carte bancaire. Prêt en 30 secondes.</p>
        <a href="/projects" className="cta-btn">
          <Play size={16} /> Commencer gratuitement
        </a>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['14j gratuits', 'Données locales', 'Sans carte bancaire', 'Sans installation'].map(g => (
            <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(240,237,232,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '3px 10px', borderRadius: 20 }}>
              <Check size={9} />{g}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-logo">
          <div className="footer-logo-icon"><Film size={10} color="#000" /></div>
          <span className="footer-logo-text">tiany</span>
        </div>
        <p className="footer-copy">© 2026 Tiany · Outil cinéma · Fait pour les créateurs · tiany.vercel.app</p>
      </footer>
    </>
  )
}
