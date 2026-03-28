'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Camera, Lightbulb, MapPin, FileText, Layers, ChevronRight, Play, DollarSign, Users, Check, Sparkles, Move, Volume2, Image as ImageIcon } from 'lucide-react'

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
            <p className="login-sub">Aucune carte bancaire requise</p>
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
          {loading ? 'Ouverture…' : 'Ouvrir Tiany — c\'est gratuit →'}
        </button>

        <div className="guarantees">
          {['100% gratuit', 'Données locales', 'Sans inscription'].map(g => (
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
      {/* Window chrome */}
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

      {/* Content */}
      <div className="mockup-body">
        {/* Scene card */}
        <div className="scene-card-mock">
          {/* Scene header */}
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

          {/* Script blocks */}
          <div className="script-blocks">
            <div className="block-action">La salle est presque vide. Une ampoule nue se balance lentement au plafond. On entend la pluie dehors.</div>
            <div className="block-char">LÉA</div>
            <div className="block-dialogue">&ldquo;Tu crois vraiment qu&rsquo;on peut encore partir ?&rdquo;</div>
            <div className="block-action" style={{ opacity: 0.5 }}>Marc ne répond pas. Il fixe la fenêtre embuée.</div>
          </div>

          {/* Face tab indicators */}
          <div className="face-tabs-mock">
            {faces.map((f, i) => (
              <div key={f.label} className={`face-tab-mock ${i === 0 ? 'face-tab-active' : ''}`} style={{ '--fc': f.color } as React.CSSProperties}>
                <f.icon size={10} />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: floor plan preview */}
        <div className="floor-preview">
          <div className="floor-label"><MapPin size={9} /> Plan de scène</div>
          <div className="floor-canvas">
            {/* Grid lines */}
            <svg className="floor-svg" viewBox="0 0 100 75" preserveAspectRatio="none">
              <line x1="33" y1="0" x2="33" y2="75" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <line x1="67" y1="0" x2="67" y2="75" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <line x1="0" y1="37" x2="100" y2="37" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              {/* Light cone */}
              <polygon points="75,15 40,45 65,55" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.3)" strokeWidth="0.5"/>
              <line x1="75" y1="15" x2="52" y2="50" stroke="rgba(251,191,36,0.2)" strokeWidth="0.3" strokeDasharray="1.5,1"/>
              {/* Ray to character */}
              <line x1="75" y1="15" x2="32" y2="38" stroke="#fbbf24" strokeWidth="0.4" strokeDasharray="0.8,0.9" opacity="0.6"/>
              {/* Camera path */}
              <path d="M 20 60 Q 35 30 55 25" fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth="0.6" strokeDasharray="2,1"/>
              <polygon points="55,25 51,27 53,22" fill="rgba(96,165,250,0.8)"/>
              {/* Character path */}
              <path d="M 32 38 L 50 55" fill="none" stroke="rgba(232,160,32,0.6)" strokeWidth="0.6" strokeDasharray="2,1"/>
              <polygon points="50,55 47,51 53,51" fill="rgba(232,160,32,0.7)"/>
            </svg>
            {/* Items */}
            <div className="floor-item" style={{ left: '32%', top: '38%', background: 'rgba(232,160,32,0.25)', borderColor: '#fbbf24', boxShadow: '0 0 10px rgba(251,191,36,0.4)' }}>
              <div style={{ fontSize: 7, color: '#e8a020' }}>👤</div>
            </div>
            <div className="floor-item" style={{ left: '55%', top: '25%', background: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.6)' }}>
              <div style={{ fontSize: 7, color: '#60a5fa' }}>📷</div>
            </div>
            <div className="floor-item" style={{ left: '75%', top: '15%', background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.6)' }}>
              <div style={{ fontSize: 7, color: '#fbbf24' }}>💡</div>
            </div>
            {/* Dest dot */}
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

/* ─── Cinematic ticker ───────────────────────────────────────────────── */
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
        /* ── Global ── */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #f0ede8; font-family: -apple-system, 'Inter', sans-serif; }

        /* ── Nav ── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: 56px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          transition: background 0.3s, border-color 0.3s;
        }
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
        .hero {
          min-height: 100vh; display: flex; flex-direction: column; justify-content: center;
          padding: 80px 24px 60px;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,160,32,0.08) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(96,165,250,0.05) 0%, transparent 60%),
                      #000;
          position: relative; overflow: hidden;
        }
        .hero::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          background-size: 200px; opacity: 0.6;
        }
        /* Letterbox bars */
        .hero::after {
          content: ''; position: absolute; left: 0; right: 0; pointer-events: none;
          height: 40px; background: #000; top: 56px;
        }
        .hero-letterbox-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 32px; background: #000; pointer-events: none;
        }
        .timecode {
          position: absolute; top: 68px; left: 24px; font-family: monospace; font-size: 10px;
          color: rgba(232,160,32,0.4); letter-spacing: 0.1em; z-index: 2;
        }
        .framecounter {
          position: absolute; top: 68px; right: 24px; font-family: monospace; font-size: 10px;
          color: rgba(240,237,232,0.2); letter-spacing: 0.08em; z-index: 2;
        }

        .hero-inner {
          max-width: 1200px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 400px; gap: 64px; align-items: center;
          position: relative; z-index: 1; padding-top: 40px;
        }
        @media (max-width: 900px) { .hero-inner { grid-template-columns: 1fr; gap: 40px; } }

        .hero-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #e8a020; background: rgba(232,160,32,0.08); border: 1px solid rgba(232,160,32,0.2); padding: 5px 12px; border-radius: 20px; margin-bottom: 24px; }
        .hero-h1 { font-size: clamp(36px, 5vw, 64px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; color: #f0ede8; margin-bottom: 20px; }
        .hero-h1 em { color: #e8a020; font-style: normal; }
        .hero-sub { font-size: 16px; color: rgba(240,237,232,0.5); line-height: 1.7; margin-bottom: 32px; max-width: 480px; }
        .hero-stats { display: flex; gap: 28px; flex-wrap: wrap; }
        .stat { display: flex; flex-direction: column; gap: 2px; }
        .stat-val { font-size: 22px; font-weight: 900; color: #f0ede8; }
        .stat-label { font-size: 11px; color: rgba(240,237,232,0.4); }

        /* ── Login card ── */
        .login-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; backdrop-filter: blur(20px);
          box-shadow: 0 0 60px rgba(232,160,32,0.08), 0 32px 64px rgba(0,0,0,0.5);
        }
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

        /* Scene card mock */
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

        /* Floor preview */
        .floor-preview { padding: 12px; background: #080808; }
        .floor-label { display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; color: #f43f5e; margin-bottom: 8px; }
        .floor-canvas { position: relative; aspect-ratio: 4/3; background: #0c0c10; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; }
        .floor-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .floor-item { position: absolute; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); transition: box-shadow 0.3s; }
        .floor-dest { position: absolute; width: 12px; height: 12px; border-radius: 50%; border: 1.5px dashed; transform: translate(-50%, -50%); }

        /* ── Ticker ── */
        .ticker-wrap { overflow: hidden; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); background: #050505; padding: 14px 0; }
        .ticker-track { display: flex; gap: 40px; animation: ticker 30s linear infinite; width: max-content; }
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .ticker-item { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .ticker-icon { width: 26px; height: 26px; border-radius: 6px; border: 1px solid; display: flex; align-items: center; justify-content: center; }
        .ticker-label { font-size: 12px; font-weight: 600; color: rgba(240,237,232,0.45); }

        /* ── For who ── */
        .audience-section { padding: 80px 24px; background: #000; }
        .audience-inner { max-width: 1000px; margin: 0 auto; }
        .section-label { text-align: center; margin-bottom: 48px; }
        .section-label p { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #e8a020; margin-bottom: 12px; }
        .section-label h2 { font-size: clamp(24px, 3.5vw, 38px); font-weight: 900; color: #f0ede8; line-height: 1.2; }
        .audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 700px) { .audience-grid { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .steps-grid { grid-template-columns: 1fr !important; } }
        .audience-card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: border-color 0.2s; }
        .audience-card:hover { border-color: rgba(232,160,32,0.2); }
        .audience-emoji { font-size: 32px; margin-bottom: 16px; }
        .audience-title { font-size: 16px; font-weight: 800; color: #f0ede8; margin-bottom: 14px; }
        .audience-points { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .audience-point { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: rgba(240,237,232,0.5); }
        .audience-check { flex-shrink: 0; color: #e8a020; margin-top: 2px; }

        /* ── CTA ── */
        .cta-section { padding: 80px 24px 100px; text-align: center; background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(232,160,32,0.07) 0%, transparent 70%); }
        .cta-title { font-size: clamp(28px, 5vw, 52px); font-weight: 900; color: #f0ede8; line-height: 1.1; margin-bottom: 16px; }
        .cta-sub { font-size: 16px; color: rgba(240,237,232,0.45); margin-bottom: 36px; }
        .cta-btn { display: inline-flex; align-items: center; gap: 8px; background: #e8a020; color: #000; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 14px; text-decoration: none; transition: opacity 0.2s, transform 0.1s; }
        .cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Footer ── */
        .footer { padding: 28px 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: gap; }
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
          <a href="/projects" className="nav-cta">Ouvrir l'app →</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="timecode">01:00:00:00</div>
        <div className="framecounter">TIANY · 4K · 24fps · REC</div>

        <div className="hero-inner">
          {/* Left: headline */}
          <div>
            <div className="hero-tag"><Sparkles size={10} /> Outil cinéma tout-en-un</div>
            <h1 className="hero-h1">
              La pré-production<br />
              <em>sans friction.</em>
            </h1>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(240,237,232,0.85)', lineHeight: 1.45, marginBottom: 14 }}>
              Écris ton script, crée ton storyboard et organise ton tournage — tout en un seul outil.
            </p>
            <p className="hero-sub">
              Arrête de jongler entre 5 apps différentes. Tiany réunit script, storyboard, découpage technique, plan de scène et budget dans une interface conçue pour les réalisateurs.
            </p>
            <p style={{ fontSize: 13, color: 'rgba(240,237,232,0.45)', marginBottom: 28, fontStyle: 'italic' }}>
              Passe de l'idée à la mise en scène en quelques heures — pas en plusieurs jours.
            </p>
            <div className="hero-stats">
              <div className="stat"><span className="stat-val">6</span><span className="stat-label">Outils par scène</span></div>
              <div className="stat"><span className="stat-val">∞</span><span className="stat-label">Projets gratuits</span></div>
              <div className="stat"><span className="stat-val">0</span><span className="stat-label">Carte bancaire</span></div>
            </div>
          </div>

          {/* Right: login */}
          <LoginCard />
        </div>

        <div className="hero-letterbox-bottom" />
      </section>

      {/* Feature ticker */}
      <FeatureTicker />

      {/* How it works */}
      <section style={{ padding: '80px 24px', background: '#000' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="section-label">
            <p>Simple</p>
            <h2>Prêt à tourner en 3 étapes</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 0 }}>
            {[
              { num: '01', color: '#e8a020', title: 'Crée ton projet', desc: "Choisis un modèle (court-métrage, clip, pub) ou pars d'une page blanche. Tes séquences sont générées automatiquement." },
              { num: '02', color: '#60a5fa', title: 'Écris & visualise', desc: "Rédige ton script, ajoute des images de storyboard, dessine ton plan de scène avec personnages et caméras." },
              { num: '03', color: '#4ade80', title: 'Tourne & exporte', desc: "Utilise le mode tournage en direct, suivi du budget en temps réel, et exporte en PDF Hollywood ou Fountain." },
            ].map(step => (
              <div key={step.num} style={{ background: '#0a0a0a', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 48, fontWeight: 900, color: `${step.color}08`, lineHeight: 1, fontFamily: 'monospace' }}>{step.num}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: step.color, letterSpacing: '0.1em', marginBottom: 12 }}>{step.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0ede8', marginBottom: 10, lineHeight: 1.2 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(240,237,232,0.5)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '0 24px 80px', background: '#000' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="section-label" style={{ marginBottom: 36 }}>
            <p>Comparaison</p>
            <h2>Pourquoi Tiany ?</h2>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ padding: '12px 20px', fontSize: 11, color: 'rgba(240,237,232,0.3)', fontWeight: 600 }}>Fonctionnalité</div>
              {[
                { name: 'Tiany', color: '#e8a020', highlight: true },
                { name: 'StudioBinder', sub: '$29/mois', color: 'rgba(240,237,232,0.3)' },
                { name: 'Final Draft', sub: '$149 one-time', color: 'rgba(240,237,232,0.3)' },
              ].map(col => (
                <div key={col.name} style={{ padding: '12px 16px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: col.highlight ? 'rgba(232,160,32,0.04)' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: col.color }}>{col.name}</div>
                  {col.sub && <div style={{ fontSize: 10, color: 'rgba(240,237,232,0.3)', marginTop: 2 }}>{col.sub}</div>}
                </div>
              ))}
            </div>
            {/* Rows */}
            {[
              { feature: 'Éditeur screenplay', tiany: '✓', sb: '✓', fd: '✓' },
              { feature: 'Storyboard intégré', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Plan de scène interactif', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Budget & suivi', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'Chat d\'équipe', tiany: '✓', sb: '✓', fd: '✗' },
              { feature: 'IA génération de script', tiany: '✓', sb: '✗', fd: '✗' },
              { feature: 'Mode tournage live', tiany: '✓', sb: '✗', fd: '✗' },
              { feature: '100% gratuit', tiany: '✓', sb: '✗', fd: '✗' },
            ].map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ padding: '11px 20px', fontSize: 12, color: 'rgba(240,237,232,0.6)' }}>{row.feature}</div>
                {[row.tiany, row.sb, row.fd].map((val, j) => (
                  <div key={j} style={{ padding: '11px 16px', borderLeft: '1px solid rgba(255,255,255,0.05)', background: j === 0 ? 'rgba(232,160,32,0.03)' : 'transparent', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: val === '✓' ? (j === 0 ? '#e8a020' : '#4ade80') : 'rgba(240,237,232,0.2)' }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(240,237,232,0.25)' }}>* Comparaison indicative — données 2026</p>
        </div>
      </section>

      {/* App preview */}
      <section className="preview-section" style={{ paddingTop: 80 }}>
        <div className="preview-inner">
          <div className="preview-label">
            <p>Aperçu de l'application</p>
            <h2>Tout ce qu'il vous faut<br />sur une seule page</h2>
          </div>
          <AppPreview />
        </div>
      </section>

      {/* For who */}
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

      {/* CTA */}
      <section className="cta-section">
        <h2 className="cta-title">Prêt à tourner ?</h2>
        <p className="cta-sub">Gratuit. Aucune installation. Commence en 30 secondes.</p>
        <a href="/projects" className="cta-btn">
          <Play size={16} /> Ouvrir Tiany maintenant
        </a>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-logo">
          <div className="footer-logo-icon"><Film size={10} color="#000" /></div>
          <span className="footer-logo-text">tiany</span>
        </div>
        <p className="footer-copy">© 2026 Tiany · Outil cinéma gratuit · Fait pour les créateurs</p>
      </footer>
    </>
  )
}
