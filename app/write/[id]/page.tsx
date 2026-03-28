'use client'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Film, Plus, Download, Trash2, Camera, Lightbulb, Image as ImageIcon, MessageCircle, X, Upload, ChevronDown, Sun, Moon, Layers, Volume2, FileText, ArrowLeft, GripVertical, Check, Clock, Play, ChevronLeft, ChevronRight, BarChart2, Send, Smile, Paperclip, Lock, Users, AtSign, Quote, Sparkles, RefreshCw, MapPin, Settings, DollarSign, Eye, EyeOff, User, AlertTriangle, Palette, Clapperboard, Tag, BadgeCheck, Timer, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { saveImage, resolveUrl, getCachedUrl, deleteImage } from '../../../lib/imagedb'
import { sendMagicLink, isSupabaseReady } from '../../../lib/supabase'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useProjectSync } from '../../../lib/hooks/useProjectSync'
import { useRealtimeComments } from '../../../lib/hooks/useRealtimeComments'
import { getMemberRole } from '../../../lib/db/members'
import type { MembersPanelProps } from '../../../components/MembersPanel'
import type { default as MoodboardPanelType } from '../../../components/MoodboardPanel'

const MembersPanel = dynamic<MembersPanelProps>(() => import('../../../components/MembersPanel'), { ssr: false })
const MoodboardPanel = dynamic<React.ComponentProps<typeof MoodboardPanelType>>(() => import('../../../components/MoodboardPanel'), { ssr: false })

type BlockType = 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition'
type SceneFace = 0 | 1 | 2 | 3 | 4 | 5

interface Block { id: string; type: BlockType; text: string }
interface Comment { id: string; author: string; text: string; target: 'block'|'image'|'shot'|'scene'; targetId: string }
interface Shot { id: string; type: string; angle: string; movement: string; description: string; duration: string }
interface FloorItem {
  id: string; type: 'character' | 'camera' | 'obstacle' | 'light'
  x: number; y: number; label: string; angle: number
  movement?: string; destX?: number; destY?: number; pathCurved?: boolean
  shape?: 'rect' | 'circle' | 'triangle'; w?: number; h?: number
  lightType?: string; lightSpread?: number
  color?: string; locked?: boolean
}
interface Scene {
  id: string; heading: string; blocks: Block[]
  face: SceneFace; imageUrls: string[]; imagePositions?: {x: number; y: number}[]
  shots: Shot[]
  camera: { angle: string; movement: string; focal: string }
  lighting: { key: string; fill: string; ambiance: string }
  sound: { direct: string; music: string; ambiance: string }
  notes: string
  comments: Comment[]
  floorItems: FloorItem[]
  hiddenFaces: number[]
  timeSpent: number
  timePlanned: number
  shotDone?: boolean
  props?: PropItem[]
  assignedMembers?: string[]
}
interface BudgetEntry { id: string; category: string; label: string; planned: number; actual: number }
interface BudgetData { pin: string; isPublic: boolean; entries: BudgetEntry[] }
interface PropItem { id: string; text: string; done: boolean }
interface ShootingEntry { sceneId: string; cameraSetup: string; estimatedMinutes: number }

const uid = () => Math.random().toString(36).slice(2, 9)

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

type Theme = 'dark' | 'light'
const THEME = {
  dark: { bg: '#080808', fg: '#f0ede8', card: '#0d0d0d', cardHeader: '#131313', border: 'rgba(255,255,255,0.08)', borderSoft: 'rgba(255,255,255,0.06)', header: 'rgba(8,8,8,0.96)', hint: 'rgba(255,255,255,0.04)', hintText: 'rgba(255,255,255,0.2)', hintBold: 'rgba(255,255,255,0.4)', addBtn: 'rgba(255,255,255,0.08)', addBtnText: 'rgba(255,255,255,0.25)', inputColor: '#f0ede8', seqCount: 'rgba(255,255,255,0.22)', divider: 'rgba(255,255,255,0.1)', blockFocus: 'rgba(255,255,255,0.025)', chatBg: '#0a0a0a', chatMsg: 'rgba(255,255,255,0.07)', chatInput: 'rgba(255,255,255,0.06)', chatBorder: 'rgba(255,255,255,0.07)', chatMuted: 'rgba(255,255,255,0.25)', shadow: '0 1px 3px rgba(0,0,0,0.4)' },
  light: { bg: '#f2ede4', fg: '#1a1510', card: '#ffffff', cardHeader: '#f5f0e8', border: 'rgba(0,0,0,0.13)', borderSoft: 'rgba(0,0,0,0.08)', header: 'rgba(242,237,228,0.96)', hint: 'rgba(0,0,0,0.04)', hintText: 'rgba(0,0,0,0.4)', hintBold: 'rgba(0,0,0,0.6)', addBtn: 'rgba(0,0,0,0.07)', addBtnText: 'rgba(0,0,0,0.45)', inputColor: '#1a1510', seqCount: 'rgba(0,0,0,0.35)', divider: 'rgba(0,0,0,0.15)', blockFocus: 'rgba(0,0,0,0.04)', chatBg: '#faf7f2', chatMsg: 'rgba(0,0,0,0.06)', chatInput: 'rgba(0,0,0,0.05)', chatBorder: 'rgba(0,0,0,0.1)', chatMuted: 'rgba(0,0,0,0.35)', shadow: '0 1px 3px rgba(0,0,0,0.08)' },
} as const

// ─── Typography presets ──────────────────────────────────────────────
type FontPreset = 'classique' | 'theatrical' | 'literary' | 'modern'
const FONT_PRESETS: Record<FontPreset, { label: string; desc: string; mono: string; serif: string; dialogue: string }> = {
  classique:  { label: 'Classique',  desc: 'Courier Prime — standard industrie',    mono: 'var(--font-courier-prime)', serif: 'var(--font-courier-prime)', dialogue: 'var(--font-courier-prime)' },
  theatrical: { label: 'Théâtral',   desc: 'Courier + Lora — dialogue élégant',     mono: 'var(--font-courier-prime)', serif: 'var(--font-lora)',          dialogue: 'var(--font-lora)' },
  literary:   { label: 'Littéraire', desc: 'EB Garamond — roman & théâtre',         mono: 'var(--font-eb-garamond)',   serif: 'var(--font-eb-garamond)',   dialogue: 'var(--font-eb-garamond)' },
  modern:     { label: 'Moderne',    desc: 'JetBrains Mono — tech & contemporain',  mono: 'var(--font-jetbrains-mono)',serif: 'var(--font-jetbrains-mono)',dialogue: 'var(--font-jetbrains-mono)' },
}

const BLOCK_CONFIG: Record<BlockType, { label: string; color: string; placeholder: string; style: React.CSSProperties; upper?: boolean; next: BlockType; tab: BlockType }> = {
  action:      { label: 'Action',      color: '#6b7280', placeholder: "Description de l'action, décor, atmosphère...", style: { color: '#c8c4be' }, next: 'character', tab: 'character' },
  character:   { label: 'Personnage',  color: '#e8a020', placeholder: 'NOM DU PERSONNAGE', style: { color: '#f0ede8', fontWeight: 800, textAlign: 'center', paddingLeft: '26%', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.8rem' }, upper: true, next: 'dialogue', tab: 'action' },
  dialogue:    { label: 'Dialogue',    color: '#60a5fa', placeholder: 'Ce que dit le personnage...', style: { color: '#ddd9d3', paddingLeft: '16%', paddingRight: '16%', fontStyle: 'italic' }, next: 'character', tab: 'parenthetical' },
  parenthetical:{ label: 'Note de jeu',color: '#a78bfa', placeholder: '(en aparté, doucement...)', style: { color: '#9ca3af', paddingLeft: '22%', paddingRight: '22%', fontStyle: 'italic', fontSize: '0.78rem' }, next: 'dialogue', tab: 'dialogue' },
  transition:  { label: 'Transition',  color: '#34d399', placeholder: 'COUPE SUR :', style: { color: '#9ca3af', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', fontSize: '0.78rem' }, upper: true, next: 'action', tab: 'action' },
}

const FACES = [
  { label: 'Script',      icon: Film,      color: '#e8a020' },
  { label: 'Storyboard',  icon: ImageIcon, color: '#60a5fa' },
  { label: 'Découpage',   icon: Layers,    color: '#f97316' },
  { label: 'Son & Lum.',  icon: Volume2,   color: '#a78bfa' },
  { label: 'Notes',       icon: FileText,  color: '#4ade80' },
  { label: 'Plan scène',  icon: MapPin,    color: '#f43f5e' },
]

// ─── i18n ─────────────────────────────────────────────────────────────
type Lang = 'fr'|'en'|'es'|'de'|'it'|'pt'|'ja'|'zh'|'ko'|'ar'|'ru'|'nl'|'pl'|'sv'|'tr'
const LANG_META: Record<Lang, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇬🇧', label: 'English' },
  es: { flag: '🇪🇸', label: 'Español' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  pt: { flag: '🇧🇷', label: 'Português' },
  ja: { flag: '🇯🇵', label: '日本語' },
  zh: { flag: '🇨🇳', label: '中文' },
  ko: { flag: '🇰🇷', label: '한국어' },
  ar: { flag: '🇸🇦', label: 'العربية' },
  ru: { flag: '🇷🇺', label: 'Русский' },
  nl: { flag: '🇳🇱', label: 'Nederlands' },
  pl: { flag: '🇵🇱', label: 'Polski' },
  sv: { flag: '🇸🇪', label: 'Svenska' },
  tr: { flag: '🇹🇷', label: 'Türkçe' },
}
const FACE_LABELS: Record<Lang, string[]> = {
  fr: ['Script', 'Storyboard', 'Découpage', 'Son & Lum.', 'Notes', 'Plan scène'],
  en: ['Script', 'Storyboard', 'Shot list', 'Sound & Light', 'Notes', 'Floor plan'],
  es: ['Guión', 'Storyboard', 'Desglose', 'Sonido & Luz', 'Notas', 'Plano escena'],
  de: ['Drehbuch', 'Storyboard', 'Shotlist', 'Ton & Licht', 'Notizen', 'Grundriss'],
  it: ['Sceneggiatura', 'Storyboard', 'Scaletta', 'Audio & Luce', 'Note', 'Pianta scena'],
  pt: ['Roteiro', 'Storyboard', 'Decupagem', 'Som & Luz', 'Notas', 'Planta cena'],
  ja: ['脚本', 'ストーリーボード', 'ショットリスト', '音響・照明', 'メモ', '平面図'],
  zh: ['剧本', '故事板', '分镜表', '声音与灯光', '备注', '场景平面图'],
  ko: ['시나리오', '스토리보드', '촬영목록', '음향&조명', '노트', '평면도'],
  ar: ['نص', 'لوحة قصصية', 'قائمة اللقطات', 'صوت وإضاءة', 'ملاحظات', 'مخطط المشهد'],
  ru: ['Сценарий', 'Раскадровка', 'Список планов', 'Звук & Свет', 'Заметки', 'Схема сцены'],
  nl: ['Script', 'Storyboard', 'Shotlijst', 'Geluid & Licht', 'Notities', 'Plattegrond'],
  pl: ['Scenariusz', 'Storyboard', 'Lista ujęć', 'Dźwięk & Światło', 'Notatki', 'Plan sceny'],
  sv: ['Manus', 'Storyboard', 'Inspelningslista', 'Ljud & Ljus', 'Anteckningar', 'Scengolv'],
  tr: ['Senaryo', 'Storyboard', 'Çekim listesi', 'Ses & Işık', 'Notlar', 'Sahne planı'],
}
const UI: Record<Lang, Record<string,string>> = {
  fr: { addScene: '+ Séquence', back: 'Projets', budget: 'Budget', chat: 'Chat', export: 'Exporter', exportPDF: '📄 PDF Scénario', exportFountain: '✍️ Fountain', exportTxt: '📝 Texte brut', presenting: 'Présenter', headingPlaceholder: 'INT. LIEU — JOUR', wordCount: 'mots', pages: 'p.', minutes: 'min', statsLabel: 'Statistiques', floorChar: 'Personnage', floorCam: 'Caméra', floorObs: 'Obstacle', floorLight: 'Lumière', lockBtn: 'Verrouiller', locked: 'Verrouillé', deleteBtn: 'Supprimer', trajectory: '+ Trajectoire', trajectoryOn: '〜 Trajectoire ✓', curve: '〜 Courbe', straight: '— Droite', orientation: 'Orienter', direction: 'Direction', rotation: 'Rotation', clearAll: 'Tout effacer', emptyFloor: 'Clique sur un bouton pour ajouter des éléments', opening: 'Ouverture', sceneLabel: 'Plan de scène', language: 'Langue', dragHint: 'Glisse pour déplacer · Clique pour sélectionner', dropImage: 'Glisser une image ici ou cliquer', addBlock: 'Ajouter', aiWrite: '✦ IA', aiInsert: 'Insérer', aiDiscard: 'Ignorer', aiGenerating: 'Génération...' },
  en: { addScene: '+ Scene', back: 'Projects', budget: 'Budget', chat: 'Chat', export: 'Export', exportPDF: '📄 Screenplay PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 Plain text', presenting: 'Present', headingPlaceholder: 'INT. LOCATION — DAY', wordCount: 'words', pages: 'p.', minutes: 'min', statsLabel: 'Statistics', floorChar: 'Character', floorCam: 'Camera', floorObs: 'Obstacle', floorLight: 'Light', lockBtn: 'Lock', locked: 'Locked', deleteBtn: 'Delete', trajectory: '+ Path', trajectoryOn: '〜 Path ✓', curve: '〜 Curved', straight: '— Straight', orientation: 'Orient', direction: 'Direction', rotation: 'Rotation', clearAll: 'Clear all', emptyFloor: 'Tap a button to add elements', opening: 'Spread', sceneLabel: 'Floor plan', language: 'Language', dragHint: 'Drag to move · Click to select', dropImage: 'Drag an image here or click', addBlock: 'Add', aiWrite: '✦ AI', aiInsert: 'Insert', aiDiscard: 'Discard', aiGenerating: 'Generating...' },
  es: { addScene: '+ Escena', back: 'Proyectos', budget: 'Presupuesto', chat: 'Chat', export: 'Exportar', exportPDF: '📄 PDF Guión', exportFountain: '✍️ Fountain', exportTxt: '📝 Texto plano', presenting: 'Presentar', headingPlaceholder: 'INT. LUGAR — DÍA', wordCount: 'palabras', pages: 'p.', minutes: 'min', statsLabel: 'Estadísticas', floorChar: 'Personaje', floorCam: 'Cámara', floorObs: 'Obstáculo', floorLight: 'Luz', lockBtn: 'Bloquear', locked: 'Bloqueado', deleteBtn: 'Eliminar', trajectory: '+ Trayectoria', trajectoryOn: '〜 Trayectoria ✓', curve: '〜 Curva', straight: '— Recta', orientation: 'Orientar', direction: 'Dirección', rotation: 'Rotación', clearAll: 'Borrar todo', emptyFloor: 'Haz clic para añadir elementos', opening: 'Apertura', sceneLabel: 'Plano escena', language: 'Idioma', dragHint: 'Arrastra para mover · Clic para seleccionar', dropImage: 'Arrastra una imagen aquí o haz clic', addBlock: 'Añadir', aiWrite: '✦ IA', aiInsert: 'Insertar', aiDiscard: 'Descartar', aiGenerating: 'Generando...' },
  de: { addScene: '+ Szene', back: 'Projekte', budget: 'Budget', chat: 'Chat', export: 'Exportieren', exportPDF: '📄 Drehbuch PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 Nur Text', presenting: 'Präsentieren', headingPlaceholder: 'INT. ORT — TAG', wordCount: 'Wörter', pages: 'S.', minutes: 'Min', statsLabel: 'Statistiken', floorChar: 'Figur', floorCam: 'Kamera', floorObs: 'Hindernis', floorLight: 'Licht', lockBtn: 'Sperren', locked: 'Gesperrt', deleteBtn: 'Löschen', trajectory: '+ Weg', trajectoryOn: '〜 Weg ✓', curve: '〜 Kurve', straight: '— Gerade', orientation: 'Ausrichten', direction: 'Richtung', rotation: 'Rotation', clearAll: 'Alles löschen', emptyFloor: 'Klicke um Elemente hinzuzufügen', opening: 'Öffnung', sceneLabel: 'Grundriss', language: 'Sprache', dragHint: 'Ziehen zum Verschieben · Klicken zum Auswählen', dropImage: 'Bild hierher ziehen oder klicken', addBlock: 'Hinzufügen', aiWrite: '✦ KI', aiInsert: 'Einfügen', aiDiscard: 'Verwerfen', aiGenerating: 'Generierung...' },
  it: { addScene: '+ Scena', back: 'Progetti', budget: 'Budget', chat: 'Chat', export: 'Esporta', exportPDF: '📄 PDF Sceneggiatura', exportFountain: '✍️ Fountain', exportTxt: '📝 Testo semplice', presenting: 'Presentare', headingPlaceholder: 'INT. LUOGO — GIORNO', wordCount: 'parole', pages: 'p.', minutes: 'min', statsLabel: 'Statistiche', floorChar: 'Personaggio', floorCam: 'Camera', floorObs: 'Ostacolo', floorLight: 'Luce', lockBtn: 'Blocca', locked: 'Bloccato', deleteBtn: 'Elimina', trajectory: '+ Traiettoria', trajectoryOn: '〜 Traiettoria ✓', curve: '〜 Curva', straight: '— Retta', orientation: 'Orienta', direction: 'Direzione', rotation: 'Rotazione', clearAll: 'Cancella tutto', emptyFloor: 'Clicca per aggiungere elementi', opening: 'Apertura', sceneLabel: 'Pianta scena', language: 'Lingua', dragHint: 'Trascina per spostare · Clic per selezionare', dropImage: "Trascina un'immagine qui o clicca", addBlock: 'Aggiungi', aiWrite: '✦ IA', aiInsert: 'Inserisci', aiDiscard: 'Scarta', aiGenerating: 'Generazione...' },
  pt: { addScene: '+ Cena', back: 'Projetos', budget: 'Orçamento', chat: 'Chat', export: 'Exportar', exportPDF: '📄 PDF Roteiro', exportFountain: '✍️ Fountain', exportTxt: '📝 Texto simples', presenting: 'Apresentar', headingPlaceholder: 'INT. LOCAL — DIA', wordCount: 'palavras', pages: 'p.', minutes: 'min', statsLabel: 'Estatísticas', floorChar: 'Personagem', floorCam: 'Câmera', floorObs: 'Obstáculo', floorLight: 'Luz', lockBtn: 'Bloquear', locked: 'Bloqueado', deleteBtn: 'Excluir', trajectory: '+ Trajetória', trajectoryOn: '〜 Trajetória ✓', curve: '〜 Curva', straight: '— Reta', orientation: 'Orientar', direction: 'Direção', rotation: 'Rotação', clearAll: 'Limpar tudo', emptyFloor: 'Clique para adicionar elementos', opening: 'Abertura', sceneLabel: 'Planta cena', language: 'Idioma', dragHint: 'Arraste para mover · Clique para selecionar', dropImage: 'Arraste uma imagem aqui ou clique', addBlock: 'Adicionar', aiWrite: '✦ IA', aiInsert: 'Inserir', aiDiscard: 'Descartar', aiGenerating: 'Gerando...' },
  ja: { addScene: '+ シーン', back: 'プロジェクト', budget: '予算', chat: 'チャット', export: 'エクスポート', exportPDF: '📄 脚本 PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 テキスト', presenting: 'プレゼン', headingPlaceholder: '内部. 場所 — 昼', wordCount: '単語', pages: 'p.', minutes: '分', statsLabel: '統計', floorChar: 'キャラクター', floorCam: 'カメラ', floorObs: '障害物', floorLight: 'ライト', lockBtn: 'ロック', locked: 'ロック中', deleteBtn: '削除', trajectory: '+ 軌跡', trajectoryOn: '〜 軌跡 ✓', curve: '〜 曲線', straight: '— 直線', orientation: '向き', direction: '方向', rotation: '回転', clearAll: '全削除', emptyFloor: 'ボタンをタップして追加', opening: '開口', sceneLabel: '平面図', language: '言語', dragHint: 'ドラッグで移動・クリックで選択', dropImage: '画像をドラッグまたはクリック', addBlock: '追加', aiWrite: '✦ AI', aiInsert: '挿入', aiDiscard: '破棄', aiGenerating: '生成中...' },
  zh: { addScene: '+ 场景', back: '项目', budget: '预算', chat: '聊天', export: '导出', exportPDF: '📄 剧本 PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 纯文本', presenting: '演示', headingPlaceholder: '内景. 地点 — 白天', wordCount: '字', pages: '页', minutes: '分', statsLabel: '统计', floorChar: '角色', floorCam: '摄像机', floorObs: '障碍物', floorLight: '灯光', lockBtn: '锁定', locked: '已锁定', deleteBtn: '删除', trajectory: '+ 轨迹', trajectoryOn: '〜 轨迹 ✓', curve: '〜 曲线', straight: '— 直线', orientation: '方向', direction: '方向', rotation: '旋转', clearAll: '全部清除', emptyFloor: '点击按钮添加元素', opening: '开口', sceneLabel: '平面图', language: '语言', dragHint: '拖动移动 · 点击选择', dropImage: '拖入图片或点击', addBlock: '添加', aiWrite: '✦ AI', aiInsert: '插入', aiDiscard: '丢弃', aiGenerating: '生成中...' },
  ko: { addScene: '+ 장면', back: '프로젝트', budget: '예산', chat: '채팅', export: '내보내기', exportPDF: '📄 시나리오 PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 일반 텍스트', presenting: '프레젠테이션', headingPlaceholder: '내부. 장소 — 낮', wordCount: '단어', pages: 'p.', minutes: '분', statsLabel: '통계', floorChar: '캐릭터', floorCam: '카메라', floorObs: '장애물', floorLight: '조명', lockBtn: '잠금', locked: '잠금됨', deleteBtn: '삭제', trajectory: '+ 경로', trajectoryOn: '〜 경로 ✓', curve: '〜 곡선', straight: '— 직선', orientation: '방향', direction: '방향', rotation: '회전', clearAll: '모두 지우기', emptyFloor: '버튼을 탭하여 추가', opening: '개구부', sceneLabel: '평면도', language: '언어', dragHint: '드래그로 이동 · 클릭으로 선택', dropImage: '이미지를 드래그하거나 클릭', addBlock: '추가', aiWrite: '✦ AI', aiInsert: '삽입', aiDiscard: '버리기', aiGenerating: '생성 중...' },
  ar: { addScene: '+ مشهد', back: 'المشاريع', budget: 'الميزانية', chat: 'محادثة', export: 'تصدير', exportPDF: '📄 PDF النص', exportFountain: '✍️ Fountain', exportTxt: '📝 نص عادي', presenting: 'عرض', headingPlaceholder: 'داخلي. مكان — نهار', wordCount: 'كلمات', pages: 'ص.', minutes: 'دق', statsLabel: 'إحصائيات', floorChar: 'شخصية', floorCam: 'كاميرا', floorObs: 'عائق', floorLight: 'إضاءة', lockBtn: 'قفل', locked: 'مقفل', deleteBtn: 'حذف', trajectory: '+ مسار', trajectoryOn: '〜 مسار ✓', curve: '〜 منحنى', straight: '— مستقيم', orientation: 'اتجاه', direction: 'اتجاه', rotation: 'دوران', clearAll: 'مسح الكل', emptyFloor: 'انقر لإضافة عناصر', opening: 'فتحة', sceneLabel: 'مخطط المشهد', language: 'اللغة', dragHint: 'اسحب للتحريك · انقر للتحديد', dropImage: 'اسحب صورة هنا أو انقر', addBlock: 'أضف', aiWrite: '✦ AI', aiInsert: 'أدرج', aiDiscard: 'تجاهل', aiGenerating: 'جارٍ الإنشاء...' },
  ru: { addScene: '+ Сцена', back: 'Проекты', budget: 'Бюджет', chat: 'Чат', export: 'Экспорт', exportPDF: '📄 PDF Сценарий', exportFountain: '✍️ Fountain', exportTxt: '📝 Простой текст', presenting: 'Презентация', headingPlaceholder: 'ИНТ. МЕСТО — ДЕНЬ', wordCount: 'слов', pages: 'стр.', minutes: 'мин', statsLabel: 'Статистика', floorChar: 'Персонаж', floorCam: 'Камера', floorObs: 'Препятствие', floorLight: 'Свет', lockBtn: 'Заблокировать', locked: 'Заблокировано', deleteBtn: 'Удалить', trajectory: '+ Путь', trajectoryOn: '〜 Путь ✓', curve: '〜 Кривая', straight: '— Прямая', orientation: 'Ориентация', direction: 'Направление', rotation: 'Вращение', clearAll: 'Очистить всё', emptyFloor: 'Нажмите кнопку для добавления', opening: 'Отверстие', sceneLabel: 'План сцены', language: 'Язык', dragHint: 'Перетащить · Клик для выбора', dropImage: 'Перетащите изображение или нажмите', addBlock: 'Добавить', aiWrite: '✦ ИИ', aiInsert: 'Вставить', aiDiscard: 'Отклонить', aiGenerating: 'Генерация...' },
  nl: { addScene: '+ Scène', back: 'Projecten', budget: 'Budget', chat: 'Chat', export: 'Exporteren', exportPDF: '📄 Scenario PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 Platte tekst', presenting: 'Presenteren', headingPlaceholder: 'INT. LOCATIE — DAG', wordCount: 'woorden', pages: 'p.', minutes: 'min', statsLabel: 'Statistieken', floorChar: 'Personage', floorCam: 'Camera', floorObs: 'Obstakel', floorLight: 'Licht', lockBtn: 'Vergrendelen', locked: 'Vergrendeld', deleteBtn: 'Verwijderen', trajectory: '+ Pad', trajectoryOn: '〜 Pad ✓', curve: '〜 Gebogen', straight: '— Recht', orientation: 'Oriënteren', direction: 'Richting', rotation: 'Rotatie', clearAll: 'Alles wissen', emptyFloor: 'Klik om elementen toe te voegen', opening: 'Opening', sceneLabel: 'Plattegrond', language: 'Taal', dragHint: 'Slepen om te verplaatsen · Klikken om te selecteren', dropImage: 'Sleep afbeelding hier of klik', addBlock: 'Toevoegen', aiWrite: '✦ AI', aiInsert: 'Invoegen', aiDiscard: 'Afwijzen', aiGenerating: 'Genereren...' },
  pl: { addScene: '+ Scena', back: 'Projekty', budget: 'Budżet', chat: 'Czat', export: 'Eksportuj', exportPDF: '📄 PDF Scenariusz', exportFountain: '✍️ Fountain', exportTxt: '📝 Zwykły tekst', presenting: 'Prezentuj', headingPlaceholder: 'WNT. MIEJSCE — DZIEŃ', wordCount: 'słów', pages: 's.', minutes: 'min', statsLabel: 'Statystyki', floorChar: 'Postać', floorCam: 'Kamera', floorObs: 'Przeszkoda', floorLight: 'Światło', lockBtn: 'Zablokuj', locked: 'Zablokowane', deleteBtn: 'Usuń', trajectory: '+ Ścieżka', trajectoryOn: '〜 Ścieżka ✓', curve: '〜 Krzywa', straight: '— Prosta', orientation: 'Orientuj', direction: 'Kierunek', rotation: 'Obrót', clearAll: 'Wyczyść wszystko', emptyFloor: 'Kliknij aby dodać elementy', opening: 'Otwór', sceneLabel: 'Plan sceny', language: 'Język', dragHint: 'Przeciągnij aby przesunąć · Kliknij aby wybrać', dropImage: 'Przeciągnij obraz tutaj lub kliknij', addBlock: 'Dodaj', aiWrite: '✦ AI', aiInsert: 'Wstaw', aiDiscard: 'Odrzuć', aiGenerating: 'Generowanie...' },
  sv: { addScene: '+ Scen', back: 'Projekt', budget: 'Budget', chat: 'Chatt', export: 'Exportera', exportPDF: '📄 Manus PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 Vanlig text', presenting: 'Presentera', headingPlaceholder: 'INT. PLATS — DAG', wordCount: 'ord', pages: 's.', minutes: 'min', statsLabel: 'Statistik', floorChar: 'Karaktär', floorCam: 'Kamera', floorObs: 'Hinder', floorLight: 'Ljus', lockBtn: 'Lås', locked: 'Låst', deleteBtn: 'Ta bort', trajectory: '+ Bana', trajectoryOn: '〜 Bana ✓', curve: '〜 Kurva', straight: '— Rak', orientation: 'Orientera', direction: 'Riktning', rotation: 'Rotation', clearAll: 'Rensa allt', emptyFloor: 'Klicka för att lägga till element', opening: 'Öppning', sceneLabel: 'Scengolv', language: 'Språk', dragHint: 'Dra för att flytta · Klicka för att välja', dropImage: 'Dra en bild hit eller klicka', addBlock: 'Lägg till', aiWrite: '✦ AI', aiInsert: 'Infoga', aiDiscard: 'Kasta', aiGenerating: 'Genererar...' },
  tr: { addScene: '+ Sahne', back: 'Projeler', budget: 'Bütçe', chat: 'Sohbet', export: 'Dışa aktar', exportPDF: '📄 Senaryo PDF', exportFountain: '✍️ Fountain', exportTxt: '📝 Düz metin', presenting: 'Sunum yap', headingPlaceholder: 'İÇ. YER — GÜNDÜZ', wordCount: 'kelime', pages: 's.', minutes: 'dak', statsLabel: 'İstatistikler', floorChar: 'Karakter', floorCam: 'Kamera', floorObs: 'Engel', floorLight: 'Işık', lockBtn: 'Kilitle', locked: 'Kilitli', deleteBtn: 'Sil', trajectory: '+ Yol', trajectoryOn: '〜 Yol ✓', curve: '〜 Eğri', straight: '— Düz', orientation: 'Yönlendir', direction: 'Yön', rotation: 'Döndür', clearAll: 'Tümünü temizle', emptyFloor: 'Öğe eklemek için düğmeye tıkla', opening: 'Açıklık', sceneLabel: 'Sahne planı', language: 'Dil', dragHint: 'Sürükle taşı · Tıkla seç', dropImage: 'Buraya görsel sürükle veya tıkla', addBlock: 'Ekle', aiWrite: '✦ AI', aiInsert: 'Ekle', aiDiscard: 'Yoksay', aiGenerating: 'Oluşturuluyor...' },
}
const BLOCK_LABELS: Record<Lang, Record<BlockType, string>> = {
  fr: { action: 'Action', character: 'Personnage', dialogue: 'Dialogue', parenthetical: 'Note de jeu', transition: 'Transition' },
  en: { action: 'Action', character: 'Character', dialogue: 'Dialogue', parenthetical: 'Parenthetical', transition: 'Transition' },
  es: { action: 'Acción', character: 'Personaje', dialogue: 'Diálogo', parenthetical: 'Acotación', transition: 'Transición' },
  de: { action: 'Aktion', character: 'Figur', dialogue: 'Dialog', parenthetical: 'Spielhinweis', transition: 'Übergang' },
  it: { action: 'Azione', character: 'Personaggio', dialogue: 'Dialogo', parenthetical: 'Nota di scena', transition: 'Transizione' },
  pt: { action: 'Ação', character: 'Personagem', dialogue: 'Diálogo', parenthetical: 'Indicação', transition: 'Transição' },
  ja: { action: 'ト書き', character: 'キャラ', dialogue: 'セリフ', parenthetical: '演技指示', transition: 'トランジション' },
  zh: { action: '动作', character: '角色', dialogue: '对话', parenthetical: '括号说明', transition: '转场' },
  ko: { action: '액션', character: '캐릭터', dialogue: '대사', parenthetical: '무대지시', transition: '전환' },
  ar: { action: 'حدث', character: 'شخصية', dialogue: 'حوار', parenthetical: 'ملاحظة أداء', transition: 'انتقال' },
  ru: { action: 'Действие', character: 'Персонаж', dialogue: 'Диалог', parenthetical: 'Ремарка', transition: 'Переход' },
  nl: { action: 'Actie', character: 'Personage', dialogue: 'Dialoog', parenthetical: 'Spelaanwijzing', transition: 'Overgang' },
  pl: { action: 'Akcja', character: 'Postać', dialogue: 'Dialog', parenthetical: 'Wskazówka', transition: 'Przejście' },
  sv: { action: 'Aktion', character: 'Karaktär', dialogue: 'Dialog', parenthetical: 'Spelanvisning', transition: 'Övergång' },
  tr: { action: 'Eylem', character: 'Karakter', dialogue: 'Diyalog', parenthetical: 'Sahne notu', transition: 'Geçiş' },
}
const BLOCK_PLACEHOLDERS: Record<Lang, Record<BlockType, string>> = {
  fr: { action: "Description de l'action, décor, atmosphère...", character: 'NOM DU PERSONNAGE', dialogue: 'Ce que dit le personnage...', parenthetical: '(en aparté, doucement...)', transition: 'COUPE SUR :' },
  en: { action: 'Action description, setting, atmosphere...', character: 'CHARACTER NAME', dialogue: 'What the character says...', parenthetical: '(softly, to herself...)', transition: 'CUT TO:' },
  es: { action: 'Descripción de la acción, escenario...', character: 'NOMBRE DEL PERSONAJE', dialogue: 'Lo que dice el personaje...', parenthetical: '(suavemente, aparte...)', transition: 'CORTE A:' },
  de: { action: 'Aktionsbeschreibung, Szenerie, Atmosphäre...', character: 'NAME DER FIGUR', dialogue: 'Was die Figur sagt...', parenthetical: '(leise, für sich...)', transition: 'SCHNITT AUF:' },
  it: { action: "Descrizione dell'azione, ambientazione...", character: 'NOME DEL PERSONAGGIO', dialogue: 'Cosa dice il personaggio...', parenthetical: '(sottovoce, a parte...)', transition: 'TAGLIO SU:' },
  pt: { action: 'Descrição da ação, cenário, atmosfera...', character: 'NOME DO PERSONAGEM', dialogue: 'O que o personagem diz...', parenthetical: '(suavemente, à parte...)', transition: 'CORTE PARA:' },
  ja: { action: 'シーン描写、舞台設定、雰囲気…', character: 'キャラクター名', dialogue: 'セリフを入力…', parenthetical: '（静かに、独り言で…）', transition: 'カット：' },
  zh: { action: '动作描述、场景设定、氛围…', character: '角色名', dialogue: '角色说的话…', parenthetical: '（轻声，自言自语…）', transition: '切换到：' },
  ko: { action: '행동 묘사, 배경, 분위기...', character: '캐릭터 이름', dialogue: '캐릭터가 말하는 것...', parenthetical: '(조용히, 혼잣말...)', transition: '컷 투:' },
  ar: { action: 'وصف الحدث، الديكور، الأجواء...', character: 'اسم الشخصية', dialogue: 'ما تقوله الشخصية...', parenthetical: '(بهدوء، لنفسها...)', transition: 'قطع إلى:' },
  ru: { action: 'Описание действия, обстановки, атмосферы...', character: 'ИМЯ ПЕРСОНАЖА', dialogue: 'Что говорит персонаж...', parenthetical: '(тихо, про себя...)', transition: 'МОНТАЖНЫЙ ПЕРЕХОД:' },
  nl: { action: 'Beschrijving van de actie, setting, sfeer...', character: 'NAAM PERSONAGE', dialogue: 'Wat het personage zegt...', parenthetical: '(zachtjes, terzijde...)', transition: 'SNEDE NAAR:' },
  pl: { action: 'Opis akcji, scenografia, atmosfera...', character: 'IMIĘ POSTACI', dialogue: 'Co mówi postać...', parenthetical: '(cicho, na stronie...)', transition: 'CIĘCIE DO:' },
  sv: { action: 'Beskrivning av aktion, miljö, atmosfär...', character: 'KARAKTÄRENS NAMN', dialogue: 'Vad karaktären säger...', parenthetical: '(stilla, för sig själv...)', transition: 'KLIPP TILL:' },
  tr: { action: 'Eylem açıklaması, mekan, atmosfer...', character: 'KARAKTER ADI', dialogue: 'Karakterin söyledikleri...', parenthetical: '(sessizce, kendi kendine...)', transition: 'KES:' },
}
const BUDGET_CATEGORIES = [
  { id: 'repas',     label: '🍕 Repas équipe' },
  { id: 'transport', label: '🚗 Transport & carburant' },
  { id: 'camera',    label: '🎥 Location caméra & optiques' },
  { id: 'son',       label: '🎤 Son & matériel audio' },
  { id: 'decor',     label: '🏠 Location décor / lieu' },
  { id: 'lumiere',   label: '💡 Éclairage & électricité' },
  { id: 'costume',   label: '🎭 Costumes & maquillage' },
  { id: 'post',      label: '✂️ Montage & étalonnage' },
  { id: 'musique',   label: '🎵 Musique & droits' },
  { id: 'cachets',   label: '👥 Cachets comédiens' },
  { id: 'assurance', label: '📋 Assurances & autorisations' },
  { id: 'imprevus',  label: '⚠️ Imprévus & divers' },
]
const SHOT_TYPES = ["Plan large","Plan d'ensemble","Plan moyen","Plan rapproché épaule","Plan américain","Gros plan","Très gros plan","Plan séquence","Insert"]
const SHOT_ANGLES = ['Face','Plongée','Contre-plongée','Plongée zénithale','Contre-plongée rasante','Dutch angle']
const SHOT_MOVES  = ['Fixe','Panoramique H.','Tilt vertical','Travelling avant','Travelling arrière','Travelling latéral','Zoom avant','Zoom arrière','Steadicam','Caméra épaule','Grue / Crane','Drone']
const FLOOR_CAM_MOVES = ['Fixe','Travelling H.','Travelling V.','Travelling circ.','Panoramique H.','Tilt','Zoom avant','Zoom arrière','Steadicam','Grue / Crane','Drone']
const FLOOR_LIGHT_TYPES = ['Clé (Key)','Remplissage (Fill)','Contre-jour','Ambiante','Projecteur','Pratique']
const FLOOR_LIGHT_COLORS: Record<string, string> = {
  'Clé (Key)': '#fbbf24', 'Remplissage (Fill)': '#60a5fa', 'Contre-jour': '#f97316',
  'Ambiante': '#4ade80', 'Projecteur': '#f0ede8', 'Pratique': '#e8a020',
}

// ─── AutoTextarea ─────────────────────────────────────────────────────
function AutoTextarea({ value, onChange, placeholder, style, focused, onFocus, onKeyDown, spellCheck = true, fontFamily }: {
  value: string; onChange: (v: string) => void; placeholder: string
  style?: React.CSSProperties; focused: boolean; onFocus: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  spellCheck?: boolean; fontFamily?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (focused && ref.current) ref.current.focus() }, [focused])
  useEffect(() => {
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px' }
  }, [value])
  return (
    <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
      onFocus={onFocus} onKeyDown={onKeyDown} placeholder={placeholder} rows={1}
      className="w-full bg-transparent resize-none outline-none text-sm leading-7 placeholder:opacity-20"
      style={{ minHeight: 28, overflow: 'hidden', fontFamily: fontFamily ?? 'var(--font-courier-prime), monospace', ...style }} spellCheck={spellCheck} />
  )
}

// ─── TypePicker ───────────────────────────────────────────────────────
function TypePicker({ current, onChange, lang }: { current: BlockType; onChange: (t: BlockType) => void; lang: Lang }) {
  const [open, setOpen] = useState(false)
  const cfg = BLOCK_CONFIG[current]
  return (
    <div className="relative">
      <button onMouseDown={e => { e.preventDefault(); setOpen(v => !v) }}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-colors hover:bg-white/5"
        style={{ color: cfg.color, whiteSpace: 'nowrap' }}>
        {BLOCK_LABELS[lang][current]} <ChevronDown size={8} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 py-1 min-w-[140px]"
          style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}>
          {(Object.keys(BLOCK_CONFIG) as BlockType[]).map(t => (
            <button key={t} onMouseDown={e => { e.preventDefault(); onChange(t); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5 flex items-center gap-2"
              style={{ color: t === current ? BLOCK_CONFIG[t].color : 'rgba(240,237,232,0.55)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BLOCK_CONFIG[t].color }} />
              {BLOCK_LABELS[lang][t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FlipTab ──────────────────────────────────────────────────────────
function FlipTab({ face, onClick, lang }: { face: SceneFace; onClick: () => void; lang: Lang }) {
  const next = ((face + 1) % 6) as SceneFace
  const cur = FACES[face]; const nxt = FACES[next]
  const CurIcon = cur.icon; const NxtIcon = nxt.icon
  const curLabel = FACE_LABELS[lang][face]
  const nxtLabel = FACE_LABELS[lang][next]
  return (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center gap-4 px-3 py-5 h-full transition-all group"
      style={{ background: `linear-gradient(180deg, ${cur.color}20 0%, ${cur.color}10 100%)`, borderLeft: `2px solid ${cur.color}50`, minWidth: 64, boxShadow: `inset -4px 0 12px ${cur.color}08` }}
      title={`Basculer vers ${nxtLabel}`}>
      <div className="flex flex-col items-center gap-2">
        <CurIcon size={20} style={{ color: cur.color, filter: `drop-shadow(0 0 4px ${cur.color}80)` }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: cur.color, writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
          {curLabel.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 transition-transform group-hover:translate-x-0.5">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M7 4l5 5-5 5" stroke={cur.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[8px] font-semibold opacity-60" style={{ color: cur.color }}>flip</span>
      </div>
      <div className="flex flex-col items-center gap-1.5 opacity-40 group-hover:opacity-70 transition-opacity">
        <NxtIcon size={14} style={{ color: nxt.color }} />
        <span className="text-[8px] font-bold" style={{ color: nxt.color, writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
          {nxtLabel.toUpperCase()}
        </span>
      </div>
    </button>
  )
}

// ─── SceneCard ────────────────────────────────────────────────────────
function SceneCard({ scene, focusedBlockId, theme, lang, fontPreset, dragHandleProps, onHeadingChange, onBlockChange, onBlockType,
  onBlockDelete, onBlockAdd, onBlockFocus, onFaceChange, onImagesChange, onImagePositionsChange, onCameraChange, onLightingChange,
  onSoundChange, onShotChange, onNotesChange, onDeleteScene, onDuplicateScene, onAddComment, onFloorItemsChange, onHiddenFacesChange,
  onToggleDone, onPropsChange, onBlocksBatchInsert
}: {
  scene: Scene; focusedBlockId: string | null; theme: Theme; lang: Lang; fontPreset: FontPreset
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  onHeadingChange: (v: string) => void; onBlockChange: (id: string, v: string) => void
  onBlockType: (id: string, t: BlockType) => void; onBlockDelete: (id: string) => void
  onBlockAdd: (afterId: string) => void; onBlockFocus: (id: string) => void
  onFaceChange: (f: SceneFace) => void; onImagesChange: (urls: string[]) => void; onImagePositionsChange: (pos: {x: number; y: number}[]) => void
  onCameraChange: (k: keyof Scene['camera'], v: string) => void
  onLightingChange: (k: keyof Scene['lighting'], v: string) => void
  onSoundChange: (k: keyof Scene['sound'], v: string) => void
  onShotChange: (shots: Shot[]) => void; onNotesChange: (v: string) => void
  onDeleteScene: () => void; onDuplicateScene: () => void; onAddComment: (target: 'block'|'image'|'shot'|'scene', targetId: string, text: string) => void
  onFloorItemsChange: (items: FloorItem[]) => void
  onHiddenFacesChange: (faces: number[]) => void
  onToggleDone: () => void
  onPropsChange: (props: PropItem[]) => void
  onBlocksBatchInsert: (blocks: {type: string; text: string}[]) => void
}) {
  const T = THEME[theme]
  const [dragging, setDragging] = useState(false)
  const [commentTarget, setCommentTarget] = useState<{type: 'block'|'image'|'shot'|'scene', id: string} | null>(null)
  const [commentText, setCommentText] = useState('')
  const commentsFor = (type: 'block'|'image'|'shot'|'scene', id: string) =>
    scene.comments.filter(c => c.target === type && c.targetId === id)
  const [sbData, setSbData] = useState<StoryboardData | null>(null)
  const [sbLoading, setSbLoading] = useState(false)
  const [showFaceSettings, setShowFaceSettings] = useState(false)
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'preview'>('idle')
  const [aiBlocks, setAiBlocks] = useState<{type: string; text: string}[]>([])
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([])
  const [reframingIdx, setReframingIdx] = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const dragImgRef = useRef<{idx: number; startX: number; startY: number; startObjX: number; startObjY: number} | null>(null)
  const imgDraggedRef = useRef(false) // true if pointer moved > 4px — suppresses onClick

  const getImgPos = (idx: number) => scene.imagePositions?.[idx] ?? { x: 50, y: 50 }

  const onImgPointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getImgPos(idx)
    dragImgRef.current = { idx, startX: e.clientX, startY: e.clientY, startObjX: pos.x, startObjY: pos.y }
    imgDraggedRef.current = false
    setReframingIdx(idx)
  }

  const onImgPointerMove = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!dragImgRef.current || dragImgRef.current.idx !== idx) return
    const { startX, startY, startObjX, startObjY } = dragImgRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.hypot(dx, dy) < 4) return // ignore tiny jitter — don't reframe, don't mark as drag
    imgDraggedRef.current = true
    const newX = Math.min(100, Math.max(0, startObjX - dx * 0.25))
    const newY = Math.min(100, Math.max(0, startObjY - dy * 0.25))
    onImagePositionsChange(scene.imageUrls.map((_, i) => i === idx ? { x: newX, y: newY } : getImgPos(i)))
  }

  const onImgPointerUp = () => { dragImgRef.current = null; setReframingIdx(null) }

  useEffect(() => {
    if (lightboxIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null ? Math.min(scene.imageUrls.length - 1, i + 1) : null)
      if (e.key === 'ArrowLeft') setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, scene.imageUrls.length])

  useEffect(() => {
    let cancelled = false
    Promise.all(scene.imageUrls.map(u => resolveUrl(u))).then(urls => {
      if (!cancelled) setResolvedUrls(urls)
    })
    return () => { cancelled = true }
  }, [scene.imageUrls])

  const handleAiWrite = async () => {
    if (aiState === 'loading') return
    setAiState('loading')
    try {
      const res = await fetch('/api/ai-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading: scene.heading, blocks: scene.blocks.map(b => ({ type: b.type, text: b.text })), lang }),
      })
      const data = await res.json()
      if (data.blocks && Array.isArray(data.blocks)) {
        setAiBlocks(data.blocks)
        setAiState('preview')
      } else {
        setAiState('idle')
      }
    } catch {
      setAiState('idle')
    }
  }

  const handleAiInsert = () => {
    onBlocksBatchInsert(aiBlocks)
    setAiBlocks([])
    setAiState('idle')
  }
  const fileRef = useRef<HTMLInputElement>(null)

  const saveFiles = async (files: File[]): Promise<string[]> => {
    return Promise.all(files.map(async f => {
      try { return await saveImage(f) } catch { return fileToBase64(f) }
    }))
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    const refs = await saveFiles(files)
    onImagesChange([...scene.imageUrls, ...refs])
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    const refs = await saveFiles(files)
    onImagesChange([...scene.imageUrls, ...refs])
  }

  const handleBlockChange = (id: string, v: string, type: BlockType) => {
    let out = v
    if (type === 'dialogue') out = out.replace(/^"/, '« ').replace(/"$/, ' »')
    if (BLOCK_CONFIG[type].upper) out = out.toUpperCase()
    onBlockChange(id, out)
  }

  return (
    <>
    <div className="relative rounded-2xl overflow-hidden mb-5 flex flex-col"
      style={{ border: `1px solid ${T.border}`, background: T.card, borderLeft: scene.shotDone ? '3px solid #4ade8060' : undefined, opacity: scene.shotDone ? 0.75 : 1 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.cardHeader }}>
        {/* Main row */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Drag handle */}
          <div {...dragHandleProps} className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-25 hover:opacity-60 transition-opacity touch-none"
            style={{ color: T.fg }}>
            <GripVertical size={14} />
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
            style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.2)' }}>
            SEQ.
          </span>
          <input value={scene.heading} onChange={e => onHeadingChange(e.target.value.toUpperCase())}
            placeholder={UI[lang].headingPlaceholder}
            className="flex-1 bg-transparent outline-none font-mono font-black text-sm uppercase tracking-wider"
            style={{ color: '#e8a020' }} />
          {/* Shot done toggle */}
          <button onClick={onToggleDone}
            className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full transition-all hover:opacity-80 flex-shrink-0"
            style={{ background: scene.shotDone ? 'rgba(74,222,128,0.12)' : T.hint, color: scene.shotDone ? '#4ade80' : T.hintText, border: `1px solid ${scene.shotDone ? '#4ade8040' : T.border}` }}>
            {scene.shotDone ? <BadgeCheck size={9} /> : <Check size={9} />}
          </button>
          {/* Desktop: face dots + settings + dup + delete */}
          <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
            {([0,1,2,3,4,5] as SceneFace[]).map(f => {
              const hidden = scene.hiddenFaces.includes(f)
              if (hidden) return null
              return (
                <button key={f} onClick={() => onFaceChange(f)} title={FACE_LABELS[lang][f]}
                  className="flex items-center justify-center w-6 h-6 sm:w-auto sm:block rounded-full transition-all hover:scale-125 touch-manipulation"
                  style={{ boxShadow: scene.face === f ? `0 0 6px ${FACES[f].color}` : 'none' }}>
                  <span className="block w-2 h-2 rounded-full" style={{ background: scene.face === f ? FACES[f].color : T.divider }} />
                </button>
              )
            })}
            {/* Hide faces gear */}
            <div className="relative ml-0.5">
              <button onClick={() => setShowFaceSettings(v => !v)}
                className="opacity-25 hover:opacity-60 transition-opacity p-0.5 rounded" style={{ color: T.fg }}>
                <Settings size={10} />
              </button>
              {showFaceSettings && (
                <div className="absolute right-0 top-full mt-1 rounded-xl p-3 shadow-2xl z-50 min-w-[160px]"
                  style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: `1px solid ${T.border}` }}
                  onClick={e => e.stopPropagation()}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: T.hintText }}>Afficher / Masquer</p>
                  {FACES.map((face, f) => {
                    const hidden = scene.hiddenFaces.includes(f)
                    return (
                      <button key={f} onClick={() => {
                        const next = hidden ? scene.hiddenFaces.filter(h => h !== f) : [...scene.hiddenFaces, f]
                        onHiddenFacesChange(next)
                        if (!hidden && scene.face === f) onFaceChange(0)
                      }}
                        className="flex items-center gap-2 w-full text-left px-1 py-1 rounded-lg transition-colors hover:opacity-80">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hidden ? T.divider : face.color }} />
                        <span className="text-xs flex-1" style={{ color: hidden ? T.hintText : T.fg }}>{FACE_LABELS[lang][f]}</span>
                        {hidden ? <EyeOff size={9} style={{ color: T.hintText }} /> : <Eye size={9} style={{ color: face.color }} />}
                      </button>
                    )
                  })}
                  <button onClick={() => setShowFaceSettings(false)} className="w-full mt-2 text-[10px] text-center py-1 rounded-lg" style={{ background: T.hint, color: T.hintText }}>Fermer</button>
                </div>
              )}
            </div>
            <button onClick={onDuplicateScene} className="ml-1 opacity-25 hover:opacity-60 transition-opacity" title="Dupliquer" style={{ color: '#60a5fa' }}>
              <Plus size={12} />
            </button>
            <button onClick={onDeleteScene} className="ml-1 opacity-25 hover:opacity-60 transition-opacity" style={{ color: '#f87171' }}>
              <Trash2 size={12} />
            </button>
          </div>
          {/* Mobile: delete only */}
          <button onClick={onDeleteScene} className="flex lg:hidden opacity-25 hover:opacity-60 transition-opacity flex-shrink-0" style={{ color: '#f87171' }}>
            <Trash2 size={14} />
          </button>
        </div>
        {/* Mobile face switcher row */}
        <div className="flex lg:hidden items-center gap-1 px-3 pb-2">
          {([0,1,2,3,4,5] as SceneFace[]).map(f => {
            if (scene.hiddenFaces.includes(f)) return null
            const face = FACES[f]; const FaceIcon = face.icon; const isActive = scene.face === f
            return (
              <button key={f} onClick={() => onFaceChange(f)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0 transition-all"
                style={{ background: isActive ? `${face.color}20` : 'transparent', color: isActive ? face.color : T.hintText, border: `1px solid ${isActive ? face.color + '40' : T.border}` }}>
                <FaceIcon size={11} />
                {isActive && <span className="text-[9px] font-semibold whitespace-nowrap">{FACE_LABELS[lang][f]}</span>}
              </button>
            )
          })}
          <button onClick={onDuplicateScene} className="ml-auto flex-shrink-0 opacity-30 hover:opacity-70 p-1" style={{ color: '#60a5fa' }} title="Dupliquer">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-[80px]">
        <div className="flex-1 min-w-0">

          {/* FACE 0 — Script */}
          {scene.face === 0 && (
            <div className="px-2 py-3 space-y-0.5">
              {scene.blocks.map(block => {
                const cfg = BLOCK_CONFIG[block.type]
                const isFocused = focusedBlockId === block.id
                const hasComments = commentsFor('block', block.id).length > 0
                return (
                  <div key={block.id}
                    className="group relative flex items-start gap-1 px-2 py-0.5 rounded-lg transition-colors"
                    style={{ background: isFocused ? T.blockFocus : 'transparent' }}>
                    <div className={`flex-shrink-0 overflow-hidden pt-1.5 transition-all ${isFocused ? 'w-16 sm:w-20 opacity-100' : 'w-0 sm:w-20 opacity-0 sm:group-hover:opacity-70'}`}>
                      <TypePicker current={block.type} onChange={t => onBlockType(block.id, t)} lang={lang} />
                    </div>
                    <div className="flex-shrink-0 w-0.5 self-stretch rounded-full mt-1 mb-1 transition-opacity"
                      style={{ background: isFocused ? cfg.color : 'transparent', opacity: 0.6 }} />
                    <div className="flex-1 min-w-0 px-2">
                      <AutoTextarea value={block.text}
                        onChange={v => handleBlockChange(block.id, v, block.type)}
                        placeholder={BLOCK_PLACEHOLDERS[lang][block.type]}
                        style={{ ...cfg.style, color: theme === 'light' ? T.fg : cfg.style.color }}
                        focused={isFocused}
                        spellCheck={!['character','transition'].includes(block.type)}
                        fontFamily={
                          block.type === 'dialogue' || block.type === 'parenthetical'
                            ? FONT_PRESETS[fontPreset].dialogue
                            : FONT_PRESETS[fontPreset].mono
                        }
                        onFocus={() => onBlockFocus(block.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onBlockAdd(block.id) }
                          else if (e.key === 'Tab') { e.preventDefault(); onBlockType(block.id, cfg.tab) }
                          else if (e.key === 'Backspace' && block.text === '') { e.preventDefault(); onBlockDelete(block.id) }
                        }} />
                    </div>
                    <div className={`flex-shrink-0 flex items-center gap-1 pt-2 transition-opacity ${isFocused || hasComments ? 'opacity-100' : 'opacity-20 sm:opacity-0 sm:group-hover:opacity-100'}`}>
                      {hasComments && (
                        <div className="flex -space-x-1 mr-1">
                          {commentsFor('block', block.id).slice(0,3).map(c => (
                            <div key={c.id} title={`${c.author}: ${c.text}`}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border"
                              style={{ background: '#1d4ed8', borderColor: T.card, color: 'white' }}>
                              {c.author[0].toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setCommentTarget({type:'block', id:block.id})} title="Commenter"
                        className="p-1 rounded transition-colors hover:text-blue-400"
                        style={{ color: 'rgba(255,255,255,0.25)' }}>
                        <MessageCircle size={10} />
                      </button>
                      <button onClick={() => onBlockDelete(block.id)} title="Supprimer"
                        className="p-1 rounded transition-colors hover:text-red-400"
                        style={{ color: 'rgba(255,255,255,0.25)' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}
              <div className="ml-2 sm:ml-24 mt-1 flex items-center gap-2">
                <button onClick={() => onBlockAdd(scene.blocks[scene.blocks.length - 1]?.id ?? '')}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                  style={{ color: T.hintText }}>
                  <Plus size={10} /> {UI[lang].addBlock}
                </button>
                <button onClick={handleAiWrite} disabled={aiState === 'loading'}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{ color: '#e8a020', background: aiState !== 'idle' ? 'rgba(232,160,32,0.08)' : 'transparent' }}>
                  {aiState === 'loading' ? <span className="animate-spin text-[10px]">◌</span> : null}
                  {aiState === 'loading' ? UI[lang].aiGenerating : UI[lang].aiWrite}
                </button>
              </div>
              {aiState === 'preview' && aiBlocks.length > 0 && (
                <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.04)' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(232,160,32,0.15)' }}>
                    <span className="text-[10px] font-bold" style={{ color: '#e8a020' }}>✦ {aiBlocks.length} blocs générés</span>
                    <div className="flex items-center gap-1">
                      <button onClick={handleAiInsert} className="text-[10px] font-bold px-2 py-1 rounded-lg transition-colors" style={{ background: '#e8a020', color: '#000' }}>{UI[lang].aiInsert}</button>
                      <button onClick={() => setAiState('idle')} className="text-[10px] px-2 py-1 rounded-lg transition-colors" style={{ color: T.hintText }}>{UI[lang].aiDiscard}</button>
                    </div>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    {aiBlocks.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[9px] font-bold mt-0.5 flex-shrink-0" style={{ color: BLOCK_CONFIG[b.type as BlockType]?.color ?? '#888', width: 72 }}>{BLOCK_LABELS[lang][b.type as BlockType] ?? b.type}</span>
                        <span className="text-xs opacity-70 leading-5">{b.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FACE 1 — Storyboard */}
          {scene.face === 1 && (
            <div className="p-4">
              {/* Images strip */}
              {scene.imageUrls.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'thin' }}>
                  {scene.imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group flex-shrink-0 rounded-xl overflow-hidden"
                      style={{ width: scene.imageUrls.length === 1 ? '100%' : '220px', aspectRatio: '16/9', cursor: reframingIdx === idx ? 'grabbing' : 'grab' }}
                      onPointerDown={e => onImgPointerDown(e, idx)}
                      onPointerMove={e => onImgPointerMove(e, idx)}
                      onPointerUp={onImgPointerUp}
                      onPointerCancel={onImgPointerUp}
                      onClick={() => { if (!imgDraggedRef.current) setLightboxIdx(idx) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolvedUrls[idx] ?? url} alt={`storyboard ${idx + 1}`} className="w-full h-full object-cover"
                        style={{ objectPosition: `${getImgPos(idx).x}% ${getImgPos(idx).y}%`, pointerEvents: 'none' }} />
                      {/* Reframe hint */}
                      <span className="absolute top-2 left-2 flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity select-none"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 3v18M3 12h18"/></svg>
                        recadrer
                      </span>
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => { deleteImage(url); onImagesChange(scene.imageUrls.filter((_, i) => i !== idx)); onImagePositionsChange((scene.imagePositions ?? scene.imageUrls.map(() => ({x:50,y:50}))).filter((_, i) => i !== idx)) }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.75)' }}>
                        <X size={12} className="text-white" />
                      </button>
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)' }}>{idx + 1}</span>
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => setCommentTarget({type:'image', id:String(idx)})}
                        className="absolute bottom-2 right-2 flex items-center gap-1 p-1.5 rounded-lg opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.75)' }} title="Commenter cette image">
                        <MessageCircle size={11} className="text-white" />
                        {commentsFor('image', String(idx)).length > 0 && (
                          <span className="text-[9px] font-bold text-white">{commentsFor('image', String(idx)).length}</span>
                        )}
                      </button>
                    </div>
                  ))}
                  {/* Add image button inline */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className="flex-shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
                    style={{ width: '110px', aspectRatio: '16/9', border: `2px dashed ${dragging ? '#60a5fa' : T.border}`, background: dragging ? 'rgba(96,165,250,0.05)' : T.hint }}>
                    <Plus size={16} style={{ color: T.hintText }} />
                    <p className="text-[10px] font-semibold text-center" style={{ color: T.hintText }}>{UI[lang].addBlock}</p>
                  </div>
                </div>
              )}

              {/* Empty drop zone (no images yet) */}
              {scene.imageUrls.length === 0 && !sbData && (
                <div onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all"
                  style={{ aspectRatio: '16/9', border: `2px dashed ${dragging ? '#60a5fa' : T.border}`, background: dragging ? 'rgba(96,165,250,0.05)' : T.hint }}>
                  <Upload size={22} style={{ color: T.hintText }} />
                  <p className="text-sm font-medium" style={{ color: T.hintText }}>{UI[lang].dropImage}</p>
                  <p className="text-xs" style={{ color: T.hintText, opacity: 0.7 }}>Photo de repérage · Croquis · Référence visuelle</p>
                </div>
              )}

              {/* Generated storyboard visual */}
              {scene.imageUrls.length === 0 && sbData && (
                <div className="relative">
                  <StoryboardVisual data={sbData} theme={theme} />
                  <button onClick={() => { setSbData(null); setSbLoading(false) }}
                    className="absolute top-2 left-2 p-1.5 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.7)' }} title="Effacer">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />

              {/* Generate / Regenerate button */}
              {scene.imageUrls.length === 0 && (
                <div className="flex items-center justify-end mt-2 gap-2">
                  {sbData && (
                    <button onClick={e => { e.stopPropagation(); setSbLoading(true); setTimeout(() => { setSbData(generateStoryboardData(scene)); setSbLoading(false) }, 700) }}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                      style={{ background: T.hint, color: T.hintText, border: `1px solid ${T.border}` }}>
                      <RefreshCw size={9} /> Regénérer
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setSbLoading(true); setTimeout(() => { setSbData(generateStoryboardData(scene)); setSbLoading(false) }, 700) }}
                    disabled={sbLoading}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-60"
                    style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                    <Sparkles size={10} style={{ animation: sbLoading ? 'spin 1s linear infinite' : 'none' }} />
                    {sbLoading ? 'Génération...' : '✨ Générer'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FACE 2 — Découpage */}
          {scene.face === 2 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#f97316' }}>
                  <Layers size={12} /> Découpage technique
                </div>
                <button onClick={() => onShotChange([...scene.shots, { id: uid(), type: '', angle: '', movement: '', description: '', duration: '' }])}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <Plus size={10} /> Plan
                </button>
              </div>
              {scene.shots.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: T.hintText }}>Aucun plan — cliquez sur + Plan</p>
              ) : (
                <div className="space-y-2">
                  {scene.shots.map((shot, i) => (
                    <div key={shot.id} className="rounded-xl p-3 space-y-2" style={{ background: T.hint, border: `1px solid ${T.border}` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>P{i+1}</span>
                        <select value={shot.type} onChange={e => { const s=[...scene.shots]; s[i]={...s[i],type:e.target.value}; onShotChange(s) }}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }}>
                          <option value="">Type de plan</option>
                          {SHOT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <button onClick={() => setCommentTarget({type:'shot', id:shot.id})}
                          className="flex items-center gap-0.5 p-1.5 rounded-lg transition-colors hover:text-blue-400"
                          style={{ color: commentsFor('shot', shot.id).length > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)' }}
                          title="Commenter ce plan">
                          <MessageCircle size={11} />
                          {commentsFor('shot', shot.id).length > 0 && <span className="text-[9px] font-bold">{commentsFor('shot', shot.id).length}</span>}
                        </button>
                        <button onClick={() => onShotChange(scene.shots.filter(s => s.id !== shot.id))}
                          className="opacity-30 hover:opacity-70 transition-opacity" style={{ color: '#f87171' }}>
                          <X size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={shot.angle} onChange={e => { const s=[...scene.shots]; s[i]={...s[i],angle:e.target.value}; onShotChange(s) }}
                          className="text-xs px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }}>
                          <option value="">Angle</option>
                          {SHOT_ANGLES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select value={shot.movement} onChange={e => { const s=[...scene.shots]; s[i]={...s[i],movement:e.target.value}; onShotChange(s) }}
                          className="text-xs px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }}>
                          <option value="">Mouvement</option>
                          {SHOT_MOVES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <input value={shot.description} onChange={e => { const s=[...scene.shots]; s[i]={...s[i],description:e.target.value}; onShotChange(s) }}
                        placeholder="Description du plan..." className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
                        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }} />
                      <input value={shot.duration} onChange={e => { const s=[...scene.shots]; s[i]={...s[i],duration:e.target.value}; onShotChange(s) }}
                        placeholder="Durée estimée (ex: 3s)" className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
                        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FACE 3 — Son & Lumière */}
          {scene.face === 3 && (
            <div className="p-4 grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 flex justify-end -mb-2">
                <button onClick={() => setCommentTarget({type:'scene', id:'sonlum'})}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-colors hover:text-blue-400"
                  style={{ color: commentsFor('scene','sonlum').length > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)' }}>
                  <MessageCircle size={10} />
                  {commentsFor('scene','sonlum').length > 0 ? `${commentsFor('scene','sonlum').length} commentaire${commentsFor('scene','sonlum').length>1?'s':''}` : 'Commenter'}
                </button>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold mb-3" style={{ color: '#a78bfa' }}>
                  <Camera size={12} /> Caméra
                </div>
                <div className="space-y-2">
                  {([
                    { key: 'angle' as const, label: 'Angle de vue', opts: ['Face','Plongée','Contre-plongée','Plongée zénithale','Œil de bœuf','Hollandais'] },
                    { key: 'movement' as const, label: 'Mouvement', opts: ['Fixe','Travelling avant','Travelling arrière','Panoramique H','Tilt vertical','Steadicam','Grue / Crane','Drone'] },
                    { key: 'focal' as const, label: 'Focale', opts: ['14mm (grand angle)','24mm','35mm','50mm (standard)','85mm (portrait)','135mm','200mm (télé)'] },
                  ] as const).map(f => (
                    <div key={f.key}>
                      <p className="text-[10px] mb-1" style={{ color: T.hintText }}>{f.label}</p>
                      <select value={scene.camera[f.key]} onChange={e => onCameraChange(f.key, e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                        style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}>
                        <option value="">— choisir —</option>
                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold mb-3" style={{ color: '#fbbf24' }}>
                  <Lightbulb size={12} /> Lumière
                </div>
                <div className="space-y-2">
                  {([
                    { key: 'key' as const, label: 'Source principale (clé)', opts: ['Gauche','Droite','Face','Contre-jour','Zénith','Ambiance douce'] },
                    { key: 'fill' as const, label: 'Type de lumière', opts: ['Naturelle — fenêtre','Néon froid','Bougie / chaud','Projecteur dur','Lumière diffuse','Aucune (nuit)'] },
                    { key: 'ambiance' as const, label: 'Palette colorée', opts: ['Neutre','Chaude dorée','Froide bleue','Bleue nuit','Vert fade','Orange crépuscule','Noir & blanc'] },
                  ] as const).map(f => (
                    <div key={f.key}>
                      <p className="text-[10px] mb-1" style={{ color: T.hintText }}>{f.label}</p>
                      <select value={scene.lighting[f.key]} onChange={e => onLightingChange(f.key, e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                        style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}>
                        <option value="">— choisir —</option>
                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-bold mb-3" style={{ color: '#34d399' }}>
                  <Volume2 size={12} /> Son
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {([
                    { key: 'direct' as const, label: 'Son direct', opts: ['Synchro direct','Playback','Voix off','Silence / muet'] },
                    { key: 'music' as const, label: 'Musique', opts: ['Originale','Préexistante','Silence','Diégétique (dans la scène)'] },
                    { key: 'ambiance' as const, label: 'Ambiance sonore', opts: ['Extérieur jour','Extérieur nuit','Intérieur calme','Bruit de foule','Silence oppressant','Pluie / orage'] },
                  ] as const).map(f => (
                    <div key={f.key}>
                      <p className="text-[10px] mb-1" style={{ color: T.hintText }}>{f.label}</p>
                      <select value={scene.sound[f.key]} onChange={e => onSoundChange(f.key, e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                        style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}>
                        <option value="">— choisir —</option>
                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FACE 4 — Notes */}
          {scene.face === 4 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#4ade80' }}>
                  <FileText size={12} /> Notes de réalisation
                </div>
                <button onClick={() => setCommentTarget({type:'scene', id:'notes'})}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-colors hover:text-blue-400"
                  style={{ color: commentsFor('scene','notes').length > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)' }}>
                  <MessageCircle size={10} />
                  {commentsFor('scene','notes').length > 0 ? `${commentsFor('scene','notes').length} commentaire${commentsFor('scene','notes').length>1?'s':''}` : 'Commenter'}
                </button>
              </div>
              <textarea value={scene.notes} onChange={e => onNotesChange(e.target.value)}
                placeholder="Intentions, références visuelles, humeur de la scène, consignes pour les acteurs..."
                rows={6} className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none font-mono leading-6"
                style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}
                spellCheck={true} />
            </div>
          )}

          {/* FACE 5 — Plan de scène */}
          {scene.face === 5 && (
            <div>
              <div className="flex justify-end px-3 pt-2 -mb-1">
                <button onClick={() => setCommentTarget({type:'scene', id:'floorplan'})}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-colors hover:text-blue-400"
                  style={{ color: commentsFor('scene','floorplan').length > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)' }}>
                  <MessageCircle size={10} />
                  {commentsFor('scene','floorplan').length > 0 ? `${commentsFor('scene','floorplan').length} commentaire${commentsFor('scene','floorplan').length>1?'s':''}` : 'Commenter le plan'}
                </button>
              </div>
              <FloorPlanCanvas items={scene.floorItems} onChange={onFloorItemsChange} theme={theme} lang={lang} />
            </div>
          )}

          {/* Comment panel */}
          {commentTarget && (() => {
            const existing = commentsFor(commentTarget.type, commentTarget.id)
            const user = typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('tiany_user') || 'null') } catch { return null } })() : null
            const authorName: string = user?.name ?? 'Moi'
            const authorInitial: string = authorName[0]?.toUpperCase() ?? 'M'
            const targetLabel = commentTarget.type === 'block' ? 'ce bloc' : commentTarget.type === 'image' ? `l'image ${Number(commentTarget.id)+1}` : commentTarget.type === 'shot' ? 'ce plan' : commentTarget.id === 'sonlum' ? 'Son & Lumière' : commentTarget.id === 'notes' ? 'les notes' : 'le plan scène'
            return (
              <div className="px-4 pb-3 border-t" style={{ borderColor: T.borderSoft }}>
                {existing.length > 0 && (
                  <div className="mt-3 space-y-2 mb-3">
                    {existing.map(c => (
                      <div key={c.id} className="flex gap-2 items-start">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                          style={{ background: '#1d4ed8', color: 'white' }}>{c.author[0]?.toUpperCase()}</div>
                        <div className="flex-1 rounded-lg px-2 py-1.5" style={{ background: T.hint, border: `1px solid ${T.border}` }}>
                          <span className="text-[10px] font-bold mr-2" style={{ color: '#60a5fa' }}>{c.author}</span>
                          <span className="text-xs" style={{ color: T.fg }}>{c.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3 items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: '#1d4ed8', color: 'white' }}>{authorInitial}</div>
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    placeholder={`Commenter ${targetLabel}… (Entrée pour envoyer)`}
                    className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                    style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && commentText.trim()) {
                        onAddComment(commentTarget.type, commentTarget.id, commentText.trim())
                        setCommentText('')
                        setCommentTarget(null)
                      }
                      if (e.key === 'Escape') { setCommentTarget(null); setCommentText('') }
                    }} autoFocus />
                  <button onClick={() => { setCommentTarget(null); setCommentText('') }} style={{ color: T.hintText }}><X size={14} /></button>
                </div>
              </div>
            )
          })()}
        </div>

        {/* ── Completion bar (bottom of card) ── */}
        <div className="absolute bottom-0 left-0 right-0 sm:right-16 h-0.5 flex">
          {(() => {
            const checks = [
              scene.blocks.some(b => b.text.length > 0),
              scene.imageUrls.length > 0,
              scene.shots.length > 0,
              !!(scene.camera.angle || scene.lighting.key || scene.sound.direct),
              scene.notes.length > 0,
            ]
            const colors = ['#e8a020','#60a5fa','#f97316','#a78bfa','#4ade80']
            return checks.map((done, i) => (
              <div key={i} className="flex-1 transition-all duration-500"
                style={{ background: done ? colors[i] : T.border, opacity: done ? 0.8 : 0.3 }} />
            ))
          })()}
        </div>
        <div className="hidden sm:block">
          <FlipTab face={scene.face} lang={lang} onClick={() => onFaceChange(((scene.face + 1) % 6) as SceneFace)} />
        </div>
      </div>
    </div>

    {/* ── Lightbox ── */}
    {lightboxIdx !== null && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.93)' }}
        onClick={() => setLightboxIdx(null)}>
        {/* Close */}
        <button className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.1)' }}
          onClick={() => setLightboxIdx(null)}>
          <X size={18} className="text-white" />
        </button>
        {/* Prev */}
        {lightboxIdx > 0 && (
          <button className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(0, (i ?? 1) - 1)) }}>
            <ChevronLeft size={22} className="text-white" />
          </button>
        )}
        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedUrls[lightboxIdx] ?? scene.imageUrls[lightboxIdx]}
          alt=""
          className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain select-none"
          style={{ objectPosition: `${getImgPos(lightboxIdx).x}% ${getImgPos(lightboxIdx).y}%`, boxShadow: '0 0 80px rgba(0,0,0,0.8)' }}
          onClick={e => e.stopPropagation()} />
        {/* Next */}
        {lightboxIdx < scene.imageUrls.length - 1 && (
          <button className="absolute right-4 flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(scene.imageUrls.length - 1, (i ?? 0) + 1)) }}>
            <ChevronRight size={22} className="text-white" />
          </button>
        )}
        {/* Dots */}
        {scene.imageUrls.length > 1 && (
          <div className="absolute bottom-5 flex gap-2">
            {scene.imageUrls.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setLightboxIdx(i) }}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === lightboxIdx ? 'white' : 'rgba(255,255,255,0.3)', transform: i === lightboxIdx ? 'scale(1.3)' : 'scale(1)' }} />
            ))}
          </div>
        )}
      </div>
    )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────
function defaultScene(): Scene {
  return {
    id: uid(), heading: '', face: 0, imageUrls: [], shots: [],
    blocks: [{ id: uid(), type: 'action', text: '' }],
    camera: { angle: '', movement: '', focal: '' },
    lighting: { key: '', fill: '', ambiance: '' },
    sound: { direct: '', music: '', ambiance: '' },
    notes: '', comments: [], floorItems: [], hiddenFaces: [], timeSpent: 0, timePlanned: 0,
    shotDone: false, props: [], assignedMembers: [],
  }
}

function countWords(scenes: Scene[]) {
  return scenes.reduce((total, s) => total + s.blocks.reduce((t, b) => t + b.text.split(/\s+/).filter(Boolean).length, 0), 0)
}

// ─── Floor Plan Canvas ────────────────────────────────────────────────
// Improved color intensity: camera vivid blue, character saturated amber, light softer yellow, obstacle muted grey
const FLOOR_TYPE_COLORS: Record<FloorItem['type'], string> = { character: '#f5a623', camera: '#3b9eff', obstacle: '#8b99b0', light: '#e8c84a' }
// Opacity hierarchy: camera 100%, character 90%, light 65%, obstacle 35%
const FLOOR_TYPE_OPACITY: Record<FloorItem['type'], number> = { camera: 1, character: 0.9, light: 0.65, obstacle: 0.35 }
const FLOOR_TYPE_LABELS: Record<FloorItem['type'], string> = { character: 'Personnage', camera: 'Caméra', obstacle: 'Obstacle', light: 'Lumière' }
const CHAR_COLORS = ['#e8a020','#60a5fa','#4ade80','#f97316','#a78bfa','#f43f5e','#fb7185','#34d399']

function FloorPlanCanvas({ items, onChange, theme, lang = 'fr' }: { items: FloorItem[]; onChange: (items: FloorItem[]) => void; theme: Theme; lang?: Lang }) {
  const T = THEME[theme]
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; kind: 'pos'|'dest'; ox: number; oy: number; px: number; py: number; rw: number; rh: number; moved: boolean } | null>(null)
  const bgClickRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Local items state: updated immediately during drag; parent receives a single onChange on drag end.
  // This prevents the parent re-render cascade on every pointermove (fixes ghosting/duplication).
  const [localItems, setLocalItems] = useState<FloorItem[]>(items)
  const localItemsRef = useRef<FloorItem[]>(items)

  // Sync from parent only when not dragging
  useEffect(() => {
    if (!dragRef.current) {
      localItemsRef.current = items
      setLocalItems(items)
    }
  }, [items])

  const sel = localItems.find(i => i.id === selectedId) ?? null

  const upd = (id: string, patch: Partial<FloorItem>) => {
    const next = localItemsRef.current.map(i => i.id === id ? { ...i, ...patch } : i)
    localItemsRef.current = next
    setLocalItems(next)
  }

  const remove = (id: string) => {
    const next = localItemsRef.current.filter(i => i.id !== id)
    localItemsRef.current = next
    onChange(next)
    if (selectedId === id) setSelectedId(null)
  }

  const addItem = (type: FloorItem['type']) => {
    const charCount = localItemsRef.current.filter(i => i.type === 'character').length
    const defaults: Partial<FloorItem>[] = [
      { label: 'Perso', color: CHAR_COLORS[charCount % CHAR_COLORS.length] },
      { label: 'Caméra', movement: 'Fixe', destX: 50, destY: 25, angle: 0 },
      { label: 'Décor', shape: 'rect', w: 12, h: 8, angle: 0 },
      { label: 'Lumière', lightType: 'Clé (Key)', lightSpread: 60, angle: 200 }
    ]
    const idx = ['character','camera','obstacle','light'].indexOf(type)
    const next = [...localItemsRef.current, { id: uid(), type, x: 35 + Math.random()*30, y: 35 + Math.random()*30, angle: 0, ...defaults[idx] } as FloorItem]
    localItemsRef.current = next
    onChange(next)
  }

  const startDrag = (e: React.PointerEvent, id: string, kind: 'pos'|'dest') => {
    e.stopPropagation()
    const item = localItemsRef.current.find(i => i.id === id)
    if (!item || item.locked || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const ox = kind === 'dest' ? (item.destX ?? item.x) : item.x
    const oy = kind === 'dest' ? (item.destY ?? item.y) : item.y
    dragRef.current = { id, kind, ox, oy, px: e.clientX, py: e.clientY, rw: rect.width, rh: rect.height, moved: false }
    containerRef.current.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { id, kind, ox, oy, px, py, rw, rh } = dragRef.current
    const dx = ((e.clientX - px) / rw) * 100
    const dy = ((e.clientY - py) / rh) * 100
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) dragRef.current.moved = true
    const nx = Math.max(2, Math.min(97, ox + dx))
    const ny = Math.max(2, Math.min(97, oy + dy))
    const patch = kind === 'pos' ? { x: nx, y: ny } : { destX: nx, destY: ny }
    // Update ref immediately (always current for onUp)
    localItemsRef.current = localItemsRef.current.map(i => i.id === id ? { ...i, ...patch } : i)
    // Throttle React re-render to one per animation frame
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        setLocalItems([...localItemsRef.current])
        rafRef.current = null
      })
    }
  }

  const onUp = (e: React.PointerEvent) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setLocalItems([...localItemsRef.current]) // flush final position
    }
    const d = dragRef.current
    dragRef.current = null
    containerRef.current?.releasePointerCapture(e.pointerId)
    if (d && !d.moved) {
      setSelectedId(prev => prev === d.id ? null : d.id)
    } else if (d && d.moved) {
      // Commit final position to parent once
      onChange(localItemsRef.current)
    } else if (!d && bgClickRef.current) {
      setSelectedId(null)
    }
    bgClickRef.current = false
  }

  // litMap: itemId → {lightId, lightColor} — closest light wins, enables ray drawing
  const litMap = useMemo(() => {
    const map = new Map<string, { lightId: string; lightColor: string }>()
    localItems.filter(i => i.type === 'light').forEach(light => {
      const spread = ((light.lightSpread ?? 60) / 2) * (Math.PI / 180)
      const dir = (light.angle - 90) * (Math.PI / 180)
      const reach = 40
      const lc = FLOOR_LIGHT_COLORS[light.lightType ?? 'Clé (Key)'] ?? '#fbbf24'
      const candidates: { item: FloorItem; dist: number }[] = []
      localItems.filter(i => i.id !== light.id && i.type !== 'light').forEach(item => {
        const dx = item.x - light.x, dy = item.y - light.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist > reach) return
        let a = Math.atan2(dy, dx) - dir
        while (a > Math.PI) a -= 2*Math.PI
        while (a < -Math.PI) a += 2*Math.PI
        if (Math.abs(a) <= spread) candidates.push({ item, dist })
      })
      candidates.sort((a, b) => a.dist - b.dist)
      candidates.forEach(({ item }) => { if (!map.has(item.id)) map.set(item.id, { lightId: light.id, lightColor: lc }) })
    })
    return map
  }, [localItems])

  const litItems = useMemo(() => new Set(litMap.keys()), [litMap])

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  const canvasBg  = theme === 'dark' ? '#0c0c10' : '#f5f4f0'

  return (
    <div className="p-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#f43f5e' }}>
          <MapPin size={11} /> {UI[lang].sceneLabel}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['character','camera','obstacle','light'] as FloorItem['type'][]).map(type => {
            const typeLabel = type === 'character' ? UI[lang].floorChar : type === 'camera' ? UI[lang].floorCam : type === 'obstacle' ? UI[lang].floorObs : UI[lang].floorLight
            return (
              <button key={type} onClick={() => addItem(type)}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                style={{ background: `${FLOOR_TYPE_COLORS[type]}18`, color: FLOOR_TYPE_COLORS[type], border: `1px solid ${FLOOR_TYPE_COLORS[type]}30` }}>
                <Plus size={8} /> {typeLabel}
              </button>
            )
          })}
          {localItems.length > 0 && <button onClick={() => { localItemsRef.current = []; setLocalItems([]); onChange([]) }} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>{UI[lang].clearAll}</button>}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef}
        className="relative rounded-xl overflow-hidden select-none touch-none"
        style={{ aspectRatio: '4/3', background: canvasBg, border: `1px solid ${T.border}`, cursor: 'crosshair' }}
        onPointerDown={e => { e.preventDefault(); containerRef.current?.setPointerCapture(e.pointerId); bgClickRef.current = true }}
        onPointerMove={onMove} onPointerUp={onUp}>

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid */}
          {[25,50,75].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke={gridColor} strokeWidth="0.3"/>)}
          {[33,67].map(y => <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke={gridColor} strokeWidth="0.3"/>)}
          <rect x="0.5" y="0.5" width="99" height="99" stroke={gridColor} strokeWidth="0.5" fill="none"/>

          {/* Light cones — brighter when hitting something */}
          {localItems.filter(i => i.type === 'light').map(light => {
            const spread = (light.lightSpread ?? 60) / 2
            const reach = 40
            const dir = (light.angle - 90) * (Math.PI / 180)
            const a1 = dir - spread * (Math.PI / 180)
            const a2 = dir + spread * (Math.PI / 180)
            const x1 = light.x + Math.cos(a1) * reach, y1 = light.y + Math.sin(a1) * reach
            const x2 = light.x + Math.cos(a2) * reach, y2 = light.y + Math.sin(a2) * reach
            const lc = FLOOR_LIGHT_COLORS[light.lightType ?? 'Clé (Key)'] ?? '#fbbf24'
            const hasHit = Array.from(litMap.values()).some(v => v.lightId === light.id)
            return (
              <g key={`cone-${light.id}`}>
                <polygon points={`${light.x},${light.y} ${x1},${y1} ${x2},${y2}`}
                  fill={`${lc}${hasHit ? '25' : '10'}`} stroke={`${lc}${hasHit ? '60' : '25'}`} strokeWidth="0.3"/>
                <line x1={light.x} y1={light.y} x2={(x1+x2)/2} y2={(y1+y2)/2}
                  stroke={`${lc}45`} strokeWidth={hasHit ? '0.4' : '0.2'} strokeDasharray="1.5,1"/>
              </g>
            )
          })}

          {/* Light rays: dashed line from light source to each lit item */}
          {Array.from(litMap.entries()).map(([itemId, { lightId, lightColor }]) => {
            const light = items.find(i => i.id === lightId)
            const item = items.find(i => i.id === itemId)
            if (!light || !item) return null
            return (
              <line key={`ray-${lightId}-${itemId}`}
                x1={light.x} y1={light.y} x2={item.x} y2={item.y}
                stroke={lightColor} strokeWidth="0.3" strokeDasharray="0.8,1.2" opacity="0.35"/>
            )
          })}

          {/* Movement paths for ALL item types — curve is perpendicular to direction of travel */}
          {localItems.filter(i => i.type === 'camera' ? i.movement !== 'Fixe' : i.destX !== undefined).map(item => {
            const baseColor = item.type === 'character' && item.color ? item.color : FLOOR_TYPE_COLORS[item.type]
            const lc = item.type === 'light' ? (FLOOR_LIGHT_COLORS[item.lightType ?? 'Clé (Key)'] ?? '#fbbf24') : baseColor
            const dx = item.destX ?? item.x + 15, dy = item.destY ?? item.y
            // Perpendicular control point for curve (curves left relative to direction of travel)
            const mx = (item.x + dx) / 2, my = (item.y + dy) / 2
            const px2 = -(dy - item.y), py2 = dx - item.x
            const pl = Math.sqrt(px2*px2 + py2*py2) || 1
            const cpx = mx + (px2/pl) * 14, cpy = my + (py2/pl) * 14
            const pathD = item.pathCurved
              ? `M ${item.x} ${item.y} Q ${cpx} ${cpy} ${dx} ${dy}`
              : `M ${item.x} ${item.y} L ${dx} ${dy}`
            const col = item.id === selectedId ? lc : `${lc}99`
            const vx = dx - item.x, vy = dy - item.y
            const len = Math.sqrt(vx*vx + vy*vy) || 1
            const nx = vx/len, ny = vy/len
            const ax = dx - nx*3, ay = dy - ny*3
            // Trajectory style per type: camera=thick blue dashed, character=solid strong, others=subtle
            const pathStrokeWidth = item.type === 'camera' ? '1.1' : item.type === 'character' ? '0.9' : '0.45'
            const pathDasharray = item.type === 'camera' ? '2.5,1.5' : item.type === 'character' ? 'none' : '1.5,1.5'
            const pathOpacity = item.type === 'camera' ? 1 : item.type === 'character' ? 0.9 : 0.45
            return (
              <g key={`path-${item.id}`} opacity={pathOpacity}>
                <path d={pathD} fill="none" stroke={col} strokeWidth={pathStrokeWidth} strokeDasharray={pathDasharray}/>
                <polygon points={`${dx},${dy} ${ax-ny*1.3},${ay+nx*1.3} ${ax+ny*1.3},${ay-nx*1.3}`} fill={col} opacity="0.9"/>
              </g>
            )
          })}
        </svg>

        {/* Items */}
        {localItems.map(item => {
          const baseColor = item.type === 'character' && item.color ? item.color : FLOOR_TYPE_COLORS[item.type]
          const litInfo = litMap.get(item.id)
          const lit = litItems.has(item.id)
          const lightColor = litInfo?.lightColor ?? '#fbbf24'
          const isSelected = item.id === selectedId
          const borderColor = isSelected ? '#ffffff' : lit ? lightColor : `${baseColor}90`
          // bg fill: type-aware — camera fullest, obstacle most transparent
          const bgFillAlpha = { camera: '30', character: '22', light: '14', obstacle: '0a' }[item.type]
          const bgColor = lit ? `${lightColor}28` : `${baseColor}${bgFillAlpha}`
          // Contrast outline: white ring in dark, dark ring in light — ensures separation from background
          const outlineRing = theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)'
          const outlineShadow = `0 0 0 1.5px ${outlineRing}`
          const glowStyle = lit
            ? `${outlineShadow}, 0 0 14px ${lightColor}80, 0 0 5px ${lightColor}50`
            : isSelected
              ? `${outlineShadow}, 0 0 8px ${baseColor}80`
              : outlineShadow
          // Opacity hierarchy
          const itemOpacity = isSelected ? 1 : FLOOR_TYPE_OPACITY[item.type]

          return (
            <div key={item.id} className="absolute flex flex-col items-center"
              style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%,-50%)', cursor: item.locked ? 'not-allowed' : 'grab', zIndex: isSelected ? 20 : 5, touchAction: 'none', opacity: itemOpacity, transition: dragRef.current?.id === item.id ? 'none' : 'opacity 0.2s', willChange: dragRef.current?.id === item.id ? 'left, top' : 'auto' }}
              onPointerDown={e => { e.stopPropagation(); startDrag(e, item.id, 'pos') }}>

              {item.type === 'obstacle' ? (
                <div style={{
                  width: `${(item.w ?? 12) * 2.5}px`, minWidth: 20,
                  height: `${(item.h ?? 8) * 2}px`, minHeight: 16,
                  background: bgColor,
                  border: `${isSelected ? 2 : 1.5}px solid ${borderColor}`,
                  borderRadius: item.shape === 'circle' ? '50%' : item.shape === 'triangle' ? '0' : 4,
                  clipPath: item.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                  transform: `rotate(${item.angle}deg)`,
                  boxShadow: glowStyle, transition: 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
                }} />
              ) : (
                <div style={{
                  position: 'relative', width: 28, height: 28,
                  background: bgColor,
                  border: `${isSelected ? 2 : 1.5}px solid ${borderColor}`,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: lit ? lightColor : baseColor,
                  transform: (item.type === 'camera' || item.type === 'light') ? `rotate(${item.angle}deg)` : 'none',
                  boxShadow: glowStyle, transition: 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
                }}>
                  {item.type === 'character' && <User size={13} />}
                  {item.type === 'camera' && <Camera size={13} />}
                  {item.type === 'light' && <Lightbulb size={13} />}
                  {item.locked && (
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={7} style={{ color: '#fbbf24' }} />
                    </div>
                  )}
                </div>
              )}
              <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap flex items-center gap-0.5"
                style={{ color: lit ? lightColor : baseColor, transition: 'color 0.3s' }}>
                {item.type === 'obstacle' && item.locked && <Lock size={6} />}
                {item.label}
              </span>
            </div>
          )
        })}

        {/* Destination dots for ALL items with movement */}
        {localItems.filter(i => i.type === 'camera' ? i.movement !== 'Fixe' : i.destX !== undefined).map(item => {
          const baseColor = item.type === 'character' && item.color ? item.color : FLOOR_TYPE_COLORS[item.type]
          const lc = item.type === 'light' ? (FLOOR_LIGHT_COLORS[item.lightType ?? 'Clé (Key)'] ?? '#fbbf24') : baseColor
          return (
            <div key={`dest-${item.id}`}
              className="absolute rounded-full flex items-center justify-center"
              style={{ left: `${item.destX ?? item.x + 15}%`, top: `${item.destY ?? item.y + 15}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, background: `${lc}20`, border: `1.5px dashed ${lc}`, cursor: 'move', zIndex: 15, touchAction: 'none' }}
              onPointerDown={e => { e.stopPropagation(); startDrag(e, item.id, 'dest') }}>
              <div className="w-2 h-2 rounded-full" style={{ background: lc }} />
            </div>
          )
        })}

        {localItems.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: T.hintText }}>
            <MapPin size={20} style={{ opacity: 0.3 }} />
            <p className="text-xs text-center opacity-50">{UI[lang].emptyFloor}<br/>{UI[lang].dragHint}</p>
          </div>
        )}
      </div>

      {/* Character roster — list outside the canvas */}
      {localItems.filter(i => i.type === 'character').length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {localItems.filter(i => i.type === 'character').map(char => {
            const cc = char.color ?? '#e8a020'
            return (
              <div key={char.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ background: `${cc}15`, border: `1px solid ${cc}30` }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cc }} />
                <span className="text-[10px] font-semibold" style={{ color: cc }}>{char.label}</span>
                <button onClick={() => upd(char.id, { locked: !char.locked })} title={char.locked ? UI[lang].locked : UI[lang].lockBtn}
                  style={{ opacity: char.locked ? 1 : 0.35, color: '#fbbf24', transition: 'opacity 0.2s' }}>
                  <Lock size={8} />
                </button>
                <button onClick={() => remove(char.id)} style={{ opacity: 0.35, color: '#f87171' }}
                  className="hover:opacity-90 transition-opacity"><X size={8} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected item panel */}
      {sel && (
        <div className="mt-2 p-3 rounded-xl flex flex-wrap items-center gap-2" style={{ background: T.hint, border: `1px solid ${T.border}` }}>
          <span className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: sel.type === 'character' && sel.color ? sel.color : FLOOR_TYPE_COLORS[sel.type] }}>
            {sel.type === 'character' ? UI[lang].floorChar : sel.type === 'camera' ? UI[lang].floorCam : sel.type === 'obstacle' ? UI[lang].floorObs : UI[lang].floorLight}
          </span>

          {/* Label */}
          <input value={sel.label} onChange={e => upd(sel.id, { label: e.target.value })}
            className="text-xs px-2 py-1 rounded-lg outline-none w-20" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }} />

          {/* Character: color palette */}
          {sel.type === 'character' && (
            <div className="flex items-center gap-0.5">
              {CHAR_COLORS.map(c => (
                <button key={c} onClick={() => upd(sel.id, { color: c })}
                  className="rounded-full transition-all"
                  style={{ width: 14, height: 14, background: c,
                    border: `2px solid ${(sel.color ?? CHAR_COLORS[0]) === c ? '#fff' : 'transparent'}`,
                    transform: (sel.color ?? CHAR_COLORS[0]) === c ? 'scale(1.25)' : 'scale(1)' }} />
              ))}
            </div>
          )}

          {/* Camera controls */}
          {sel.type === 'camera' && (<>
            <select value={sel.movement ?? 'Fixe'} onChange={e => upd(sel.id, { movement: e.target.value })}
              className="text-xs px-2 py-1 rounded-lg outline-none" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }}>
              {FLOOR_CAM_MOVES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {sel.movement !== 'Fixe' && (
              <button onClick={() => upd(sel.id, { pathCurved: !sel.pathCurved })}
                className="text-[10px] px-2 py-1 rounded-lg" style={{ background: sel.pathCurved ? 'rgba(96,165,250,0.15)' : T.card, color: '#60a5fa', border: `1px solid rgba(96,165,250,0.3)` }}>
                {sel.pathCurved ? UI[lang].curve : UI[lang].straight}
              </button>
            )}
            <button onClick={() => upd(sel.id, { angle: (sel.angle + 45) % 360 })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: T.card, color: T.hintText, border: `1px solid ${T.border}` }}>
              <RefreshCw size={8} /> {UI[lang].orientation}
            </button>
          </>)}

          {/* Light controls */}
          {sel.type === 'light' && (<>
            <select value={sel.lightType ?? 'Clé (Key)'} onChange={e => upd(sel.id, { lightType: e.target.value })}
              className="text-xs px-2 py-1 rounded-lg outline-none" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.fg }}>
              {FLOOR_LIGHT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: T.hintText }}>{UI[lang].opening}</span>
              <input type="range" min="15" max="150" value={sel.lightSpread ?? 60} onChange={e => upd(sel.id, { lightSpread: Number(e.target.value) })} className="w-16 accent-amber-400" />
              <span className="text-[10px] font-bold" style={{ color: '#fbbf24' }}>{sel.lightSpread ?? 60}°</span>
            </div>
            <button onClick={() => upd(sel.id, { angle: (sel.angle + 15) % 360 })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: T.card, color: T.hintText, border: `1px solid ${T.border}` }}>
              <RefreshCw size={8} /> {UI[lang].direction}
            </button>
          </>)}

          {/* Obstacle controls */}
          {sel.type === 'obstacle' && (<>
            {(['rect','circle','triangle'] as const).map(s => (
              <button key={s} onClick={() => upd(sel.id, { shape: s })}
                className="text-[10px] px-2 py-1 rounded-lg transition-all"
                style={{ background: sel.shape === s ? 'rgba(107,114,128,0.25)' : T.card, color: sel.shape === s ? '#9ca3af' : T.hintText, border: `1px solid ${sel.shape === s ? 'rgba(107,114,128,0.4)' : T.border}`, fontWeight: sel.shape === s ? 700 : 400 }}>
                {s === 'rect' ? '▬' : s === 'circle' ? '●' : '▲'} {s}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: T.hintText }}>L</span>
              <input type="range" min="4" max="35" value={sel.w ?? 12} onChange={e => upd(sel.id, { w: Number(e.target.value) })} className="w-14 accent-gray-400" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: T.hintText }}>H</span>
              <input type="range" min="4" max="25" value={sel.h ?? 8} onChange={e => upd(sel.id, { h: Number(e.target.value) })} className="w-14 accent-gray-400" />
            </div>
            <button onClick={() => upd(sel.id, { angle: (sel.angle + 15) % 360 })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: T.card, color: T.hintText, border: `1px solid ${T.border}` }}>
              <RefreshCw size={8} /> {UI[lang].rotation}
            </button>
          </>)}

          {/* Trajectory / movement — all non-camera types */}
          {sel.type !== 'camera' && (() => {
            const baseSelColor = sel.type === 'character' && sel.color ? sel.color
              : sel.type === 'light' ? (FLOOR_LIGHT_COLORS[sel.lightType ?? 'Clé (Key)'] ?? '#fbbf24')
              : FLOOR_TYPE_COLORS[sel.type]
            const hasDest = sel.destX !== undefined
            return (<>
              <button onClick={() => upd(sel.id, hasDest ? { destX: undefined, destY: undefined } : { destX: Math.min(95, sel.x + 18), destY: sel.y })}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
                style={{ background: hasDest ? `${baseSelColor}18` : T.card, color: baseSelColor, border: `1px solid ${hasDest ? baseSelColor + '50' : T.border}` }}>
                {hasDest ? UI[lang].trajectoryOn : UI[lang].trajectory}
              </button>
              {hasDest && (
                <button onClick={() => upd(sel.id, { pathCurved: !sel.pathCurved })}
                  className="text-[10px] px-2 py-1 rounded-lg"
                  style={{ background: sel.pathCurved ? `${baseSelColor}15` : T.card, color: baseSelColor, border: `1px solid ${sel.pathCurved ? baseSelColor + '40' : T.border}` }}>
                  {sel.pathCurved ? UI[lang].curve : UI[lang].straight}
                </button>
              )}
            </>)
          })()}

          {/* Lock toggle — all types */}
          <button onClick={() => upd(sel.id, { locked: !sel.locked })}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
            style={{ background: sel.locked ? 'rgba(251,191,36,0.12)' : T.card, color: sel.locked ? '#fbbf24' : T.hintText, border: `1px solid ${sel.locked ? 'rgba(251,191,36,0.3)' : T.border}` }}>
            <Lock size={8} /> {sel.locked ? UI[lang].locked : UI[lang].lockBtn}
          </button>

          <div className="ml-auto">
            <button onClick={() => remove(sel.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
              <Trash2 size={8} /> {UI[lang].deleteBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Delete slider ────────────────────────────────────────────────────
function DeleteSlider({ label, onConfirm, onCancel, theme }: { label: string; onConfirm: () => void; onCancel: () => void; theme: Theme }) {
  const T = THEME[theme]
  const trackRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(0)
  const dragging = useRef(false)
  const startX = useRef(0)
  const THRESHOLD = 0.72

  const getTrackWidth = () => (trackRef.current?.offsetWidth ?? 200) - 40

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true; startX.current = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = Math.max(0, Math.min(1, (e.clientX - startX.current) / getTrackWidth()))
    setPos(p)
  }
  const handlePointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (pos >= THRESHOLD) { onConfirm() } else { setPos(0) }
  }

  const confirmed = pos >= THRESHOLD
  const knobBg = confirmed ? '#f87171' : (theme === 'dark' ? '#ffffff' : '#1a1510')
  const knobIcon = confirmed ? '#fff' : (theme === 'dark' ? '#000' : '#fff')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,113,113,0.1)' }}>
            <Trash2 size={18} style={{ color: '#f87171' }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: T.fg }}>Supprimer cette séquence ?</p>
            <p className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: T.hintText }}>{label || 'Sans titre'}</p>
          </div>
        </div>
        <p className="text-[11px] text-center mb-2" style={{ color: T.hintText }}>Glisser → pour confirmer la suppression</p>
        <div ref={trackRef} className="relative h-11 rounded-full select-none mb-4"
          style={{ background: confirmed ? 'rgba(248,113,113,0.12)' : T.hint, border: `1px solid ${confirmed ? 'rgba(248,113,113,0.4)' : T.border}`, transition: 'background 0.2s, border-color 0.2s' }}>
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            <span className="text-xs font-bold" style={{ color: T.hintText, opacity: Math.max(0, 1 - pos * 2) }}>NON</span>
            <span className="text-xs font-bold" style={{ color: '#f87171', opacity: Math.min(1, pos * 2) }}>OUI ✓</span>
          </div>
          <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            className="absolute top-1.5 bottom-1.5 w-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ left: `calc(${pos * 80}% + 4px)`, background: knobBg, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', transition: dragging.current ? 'none' : 'left 0.3s, background 0.2s' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={knobIcon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
          style={{ background: T.addBtn, color: T.hintBold }}>
          Annuler
        </button>
      </div>
    </div>
  )
}

// ─── Storyboard generation ─────────────────────────────────────────────
interface StoryboardData { prompt_image: string; shot_type: string; camera_movement: string; arrow_direction: 'forward' | 'backward' | 'pan-left' | 'pan-right' }

function generateStoryboardData(scene: Scene): StoryboardData {
  const text = scene.blocks.map(b => b.text).join(' ').toLowerCase()
  const heading = scene.heading.toLowerCase()
  let shot_type = 'Plan moyen'
  if (/gros plan|visage|regard|œil|yeux/.test(text)) shot_type = 'Gros plan'
  else if (/plan large|paysage|décor|ensemble|foule/.test(text)) shot_type = "Plan d'ensemble"
  else if (/insert|détail|main|objet|téléphone/.test(text)) shot_type = 'Insert'
  else if (/épaule|serré|portrait/.test(text)) shot_type = 'Plan rapproché épaule'
  else if (/américain|ceinture|taille/.test(text)) shot_type = 'Plan américain'
  let camera_movement = 'Fixe'
  if (/avance|s'approche|arrive|travelling avant/.test(text)) camera_movement = 'Travelling avant'
  else if (/recule|s'éloigne|part|fuit|travelling arrière/.test(text)) camera_movement = 'Travelling arrière'
  else if (/panoramique|balaye|tourne/.test(text)) camera_movement = 'Panoramique H.'
  else if (/course|poursuite|court|steadicam/.test(text)) camera_movement = 'Steadicam'
  else if (/drone|aérien|survole/.test(text)) camera_movement = 'Drone'
  let arrow_direction: StoryboardData['arrow_direction'] = 'forward'
  if (camera_movement === 'Travelling arrière') arrow_direction = 'backward'
  else if (camera_movement === 'Panoramique H.') arrow_direction = 'pan-right'
  const isNight = /nuit|soir|dark/.test(heading + text)
  const isExt = /ext\./.test(heading)
  const snippet = scene.blocks.filter(b => b.text).map(b => b.text).join(', ').slice(0, 60)
  return {
    prompt_image: `storyboard sketch noir et blanc, ${shot_type.toLowerCase()}, ${isNight ? 'nuit, ombres' : isExt ? 'extérieur' : 'intérieur'}, ${snippet}`,
    shot_type, camera_movement, arrow_direction,
  }
}

function StoryboardVisual({ data, theme }: { data: StoryboardData; theme: Theme }) {
  const T = THEME[theme]
  const arrowSvg: Record<StoryboardData['arrow_direction'], string> = {
    forward:    'M4 12h16M14 6l6 6-6 6',
    backward:   'M20 12H4M10 6L4 12l6 6',
    'pan-right':'M4 8h16M4 12h16M4 16h16',
    'pan-left': 'M20 8H4M20 12H4M20 16H4',
  }
  const gradients: Record<string, string> = {
    'Plan large': 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    "Plan d'ensemble": 'linear-gradient(180deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
    'Plan moyen': 'linear-gradient(180deg, #1c1c1c 0%, #2d2d2d 100%)',
    'Plan rapproché épaule': 'linear-gradient(180deg, #111 0%, #222 100%)',
    'Plan américain': 'linear-gradient(180deg, #111 0%, #2a2a2a 100%)',
    'Gros plan': 'linear-gradient(180deg, #0a0a0a 30%, #1a1a1a 100%)',
    'Insert': 'linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%)',
  }
  const bg = gradients[data.shot_type] ?? gradients['Plan moyen']
  return (
    <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', background: bg }}>
      {/* Composition lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 160 90" preserveAspectRatio="none">
        <line x1="53" y1="0" x2="53" y2="90" stroke="white" strokeWidth="0.3"/>
        <line x1="107" y1="0" x2="107" y2="90" stroke="white" strokeWidth="0.3"/>
        <line x1="0" y1="30" x2="160" y2="30" stroke="white" strokeWidth="0.3"/>
        <line x1="0" y1="60" x2="160" y2="60" stroke="white" strokeWidth="0.3"/>
        <rect x="2" y="2" width="156" height="86" rx="1" stroke="white" strokeWidth="0.5" fill="none"/>
      </svg>
      {/* Subject silhouette placeholder */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 160 90">
        {data.shot_type === 'Gros plan' && <ellipse cx="80" cy="50" rx="22" ry="28" fill="white" opacity="0.15"/>}
        {data.shot_type !== 'Gros plan' && data.shot_type !== 'Insert' && (
          <g transform="translate(75,30)">
            <circle cx="5" cy="8" r="6" fill="white" opacity="0.2"/>
            <rect x="0" y="16" width="10" height="20" rx="2" fill="white" opacity="0.15"/>
          </g>
        )}
      </svg>
      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black px-2 py-0.5 rounded"
            style={{ background: 'rgba(249,115,22,0.85)', color: '#fff' }}>{data.shot_type}</span>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}>{data.camera_movement}</span>
        </div>
        {/* Arrow */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={arrowSvg[data.arrow_direction]}/>
          </svg>
        </div>
      </div>
      {/* IA badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <Sparkles size={7} style={{ color: '#e8a020' }} />
        <span className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>IA</span>
      </div>
    </div>
  )
}

// ─── Chat types & mock data ───────────────────────────────────────────
interface ChatMsg { id: string; author: string; color: string; text: string; time: string; quote?: string; img?: string; dm?: boolean }

const MOCK_MEMBERS = [
  { name: 'Toi', color: '#e8a020', initials: 'T' },
  { name: 'Léa', color: '#60a5fa', initials: 'L' },
  { name: 'Marcus', color: '#a78bfa', initials: 'M' },
  { name: 'Sofia', color: '#4ade80', initials: 'S' },
]

const MOCK_GROUP: ChatMsg[] = [
  { id: '1', author: 'Léa', color: '#60a5fa', text: "J'ai regardé le script de la séq 3, on devrait revoir la lumière pour le retour de Marcus 👀", time: '14:32' },
  { id: '2', author: 'Marcus', color: '#a78bfa', text: "Ouais je suis d'accord, contre-jour plutôt que face non ?", time: '14:34' },
  { id: '3', author: 'Sofia', color: '#4ade80', text: "J'ai mis un storyboard de référence dans la séq 2, regardez !", time: '14:41' },
  { id: '4', author: 'Léa', color: '#60a5fa', quote: "J'ai mis un storyboard de référence dans la séq 2, regardez !", text: "Parfait, exactement l'ambiance qu'on cherchait 🔥", time: '14:42' },
  { id: '5', author: 'Marcus', color: '#a78bfa', text: "@Toi t'as prévu quoi pour le plan du miroir ? On part sur un steadicam ?", time: '14:55' },
  { id: '6', author: 'Sofia', color: '#4ade80', text: "@Toi au fait c'est toi qui gères le budget repas ou c'est Léa ?", time: '15:03' },
]

const MOCK_DMS: Record<string, ChatMsg[]> = {
  'Léa': [
    { id: 'd1', author: 'Léa', color: '#60a5fa', text: "Hey, t'as une minute pour parler du tournage de samedi ?", time: '13:10', dm: true },
    { id: 'd2', author: 'Toi', color: '#e8a020', text: "Oui bien sûr, c'est quoi le souci ?", time: '13:12', dm: true },
    { id: 'd3', author: 'Léa', color: '#60a5fa', text: "Je peux pas venir avant 15h finalement 😬", time: '13:13', dm: true },
  ],
  'Marcus': [
    { id: 'd4', author: 'Marcus', color: '#a78bfa', text: "Est-ce que je comprends pas cette didascalie là →", time: '11:20', dm: true, quote: 'INT. ESCALIER — NUIT. Il monte lentement, dos à la caméra.' },
  ],
  'Sofia': [],
}

// ─── Chat panel ───────────────────────────────────────────────────────
function ChatPanel({ onClose, theme, mobile = false }: { onClose: () => void; theme: Theme; mobile?: boolean }) {
  const T = THEME[theme]
  const [tab, setTab] = useState<'group' | string>('group')
  const [input, setInput] = useState('')
  const [groupMsgs, setGroupMsgs] = useState<ChatMsg[]>(MOCK_GROUP)
  const [dmMsgs, setDmMsgs] = useState<Record<string, ChatMsg[]>>(MOCK_DMS)
  const [quoting, setQuoting] = useState<string | null>(null)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [groupMsgs, dmMsgs, tab])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursor)
    const match = beforeCursor.match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionOpen(true) }
    else setMentionOpen(false)
  }

  const insertMention = (name: string) => {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const beforeCursor = input.slice(0, cursor)
    const afterCursor = input.slice(cursor)
    const replaced = beforeCursor.replace(/@(\w*)$/, `@${name} `)
    setInput(replaced + afterCursor)
    setMentionOpen(false)
    setTimeout(() => { inputRef.current?.focus() }, 0)
  }

  const mentionMembers = MOCK_MEMBERS.filter(m => m.name !== 'Toi' && m.name.toLowerCase().startsWith(mentionQuery))

  const renderWithMentions = (text: string, isMe: boolean) => {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1)
        const member = MOCK_MEMBERS.find(m => m.name.toLowerCase() === name.toLowerCase())
        if (member) return <span key={i} className="font-bold" style={{ color: isMe ? '#000' : member.color }}>{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const send = () => {
    if (!input.trim()) return
    const msg: ChatMsg = { id: uid(), author: 'Toi', color: '#e8a020', text: input.trim(), time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), quote: quoting ?? undefined }
    if (tab === 'group') setGroupMsgs(m => [...m, msg])
    else setDmMsgs(d => ({ ...d, [tab]: [...(d[tab] ?? []), msg] }))
    setInput(''); setQuoting(null)
  }

  const sendImg = (url: string) => {
    const msg: ChatMsg = { id: uid(), author: 'Toi', color: '#e8a020', text: '', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), img: url }
    if (tab === 'group') setGroupMsgs(m => [...m, msg])
    else setDmMsgs(d => ({ ...d, [tab]: [...(d[tab] ?? []), msg] }))
  }

  const msgs = tab === 'group' ? groupMsgs : (dmMsgs[tab] ?? [])

  return (
    <div className="flex flex-col h-full" style={{ background: T.chatBg, color: T.fg, width: mobile ? '100%' : 300, borderLeft: mobile ? 'none' : `1px solid ${T.chatBorder}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${T.chatBorder}` }}>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {MOCK_MEMBERS.slice(0,3).map(m => (
              <div key={m.name} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border"
                style={{ background: m.color, color: '#000', borderColor: T.chatBg }}>{m.initials}</div>
            ))}
          </div>
          <span className="text-xs font-bold">Équipe · {MOCK_MEMBERS.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Group settings */}
          <div className="relative">
            <button onClick={() => setShowGroupMenu(v => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: T.chatMuted, background: showGroupMenu ? T.chatMsg : 'transparent' }}
              title="Paramètres du groupe">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>
            {showGroupMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]"
                style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: `1px solid ${T.chatBorder}` }}
                onClick={() => setShowGroupMenu(false)}>
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.chatMuted, borderBottom: `1px solid ${T.chatBorder}` }}>
                  Membres
                </div>
                {MOCK_MEMBERS.filter(m => m.name !== 'Toi').map(m => (
                  <div key={m.name} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
                        style={{ background: m.color, color: '#000' }}>{m.initials}</div>
                      <span className="text-xs font-medium" style={{ color: T.fg }}>{m.name}</span>
                    </div>
                    <button className="text-[10px] px-2 py-0.5 rounded-lg transition-colors"
                      style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}
                      onClick={() => alert(`${m.name} exclu(e) du groupe (simulation)`)}>
                      Exclure
                    </button>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.chatBorder}` }}>
                  <button className="w-full text-left px-3 py-2.5 text-xs font-bold transition-colors"
                    style={{ color: '#f87171' }}
                    onClick={() => alert('Vous avez quitté le groupe (simulation)')}>
                    Quitter le groupe
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: T.chatMuted }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${T.chatBorder}` }}>
        <button onClick={() => setTab('group')}
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors flex-1 justify-center"
          style={{ color: tab === 'group' ? '#e8a020' : T.chatMuted, borderBottom: tab === 'group' ? '2px solid #e8a020' : '2px solid transparent' }}>
          <Users size={11} /> Groupe
        </button>
        {MOCK_MEMBERS.filter(m => m.name !== 'Toi').map(m => (
          <button key={m.name} onClick={() => setTab(m.name)}
            className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold transition-colors flex-1 justify-center relative"
            style={{ color: tab === m.name ? m.color : T.chatMuted, borderBottom: tab === m.name ? `2px solid ${m.color}` : '2px solid transparent' }}>
            <Lock size={9} />
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black" style={{ background: m.color, color: '#000' }}>{m.initials}</div>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ opacity: 0.4 }}>
            <MessageCircle size={28} />
            <p className="text-xs text-center">Début de la conversation</p>
          </div>
        )}
        {msgs.map((msg, i) => {
          const isMe = msg.author === 'Toi'
          const showAvatar = i === 0 || msgs[i-1].author !== msg.author
          return (
            <div key={msg.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="flex-shrink-0 w-7 h-7 mt-0.5">
                {showAvatar && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background: msg.color, color: '#000' }}>
                    {msg.author[0]}
                  </div>
                )}
              </div>
              <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showAvatar && (
                  <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-bold" style={{ color: msg.color }}>{msg.author}</span>
                    <span className="text-[9px]" style={{ color: T.chatMuted }}>{msg.time}</span>
                  </div>
                )}
                {/* Quote */}
                {msg.quote && (
                  <div className="flex items-start gap-1.5 px-2 py-1 rounded-lg text-[10px] max-w-full"
                    style={{ background: T.chatMsg, borderLeft: `2px solid ${T.chatBorder}`, color: T.chatMuted }}>
                    <Quote size={8} className="flex-shrink-0 mt-0.5" />
                    <span className="italic line-clamp-2">{msg.quote}</span>
                  </div>
                )}
                {/* Image */}
                {msg.img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={msg.img} alt="meme" className="rounded-xl max-w-full object-cover" style={{ maxHeight: 160 }} />
                )}
                {/* Text */}
                {msg.text && (
                  <div className="relative">
                    <div className="px-3 py-2 rounded-2xl text-xs leading-5"
                      style={{ background: isMe ? '#e8a020' : T.chatMsg, color: isMe ? '#000' : T.fg, borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px' }}>
                      {renderWithMentions(msg.text, isMe)}
                    </div>
                    {/* Quote action */}
                    <button onClick={() => setQuoting(msg.text)}
                      className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                      style={{ background: T.chatMsg }}>
                      <Quote size={9} style={{ color: T.chatMuted }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quote preview */}
      {quoting && (
        <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: T.chatMsg, border: `1px solid ${T.chatBorder}` }}>
          <Quote size={10} style={{ color: '#e8a020', flexShrink: 0 }} />
          <span className="text-[10px] italic flex-1 truncate" style={{ color: T.chatMuted }}>{quoting}</span>
          <button onClick={() => setQuoting(null)} style={{ color: T.chatMuted }}><X size={12} /></button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-4 pt-2 flex-shrink-0 relative">
        {mentionOpen && mentionMembers.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden shadow-2xl z-50"
            style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: `1px solid ${T.chatBorder}` }}>
            {mentionMembers.map(m => (
              <button key={m.name} onMouseDown={e => { e.preventDefault(); insertMention(m.name) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black flex-shrink-0"
                  style={{ background: m.color, color: '#000' }}>{m.initials}</div>
                <span className="font-bold" style={{ color: m.color }}>@{m.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-2 rounded-2xl" style={{ background: T.chatInput, border: `1px solid ${T.chatBorder}` }}>
          <textarea ref={inputRef} value={input} onChange={handleInputChange}
            placeholder={tab === 'group' ? 'Message au groupe...' : `Message privé à ${tab}...`}
            rows={1} className="flex-1 bg-transparent outline-none text-xs leading-5 resize-none"
            style={{ maxHeight: 80, color: T.fg, scrollbarWidth: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => fileRef.current?.click()}
              className="p-1.5 rounded-lg transition-colors" style={{ color: T.chatMuted }} title="Image / Mème">
              <Paperclip size={13} />
            </button>
            <button className="p-1.5 rounded-lg transition-colors" style={{ color: T.chatMuted }} title="Emoji">
              <Smile size={13} />
            </button>
            <button onClick={send} disabled={!input.trim()}
              className="p-1.5 rounded-xl transition-all disabled:opacity-30"
              style={{ background: input.trim() ? '#e8a020' : 'transparent', color: input.trim() ? '#000' : T.chatMuted }}>
              <Send size={13} />
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) sendImg(URL.createObjectURL(f)) }} />
        <p className="text-center mt-2 text-[9px]" style={{ color: T.chatMuted }}>
          <AtSign size={8} style={{ display: 'inline' }} /> mention · Shift+Enter pour saut de ligne
        </p>
      </div>
    </div>
  )
}

// ─── Budget Panel ─────────────────────────────────────────────────────
const DEFAULT_BUDGET_ENTRIES: BudgetEntry[] = BUDGET_CATEGORIES.map(c => ({ id: c.id, category: c.id, label: c.label, planned: 0, actual: 0 }))

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const barColor = pct > 100 ? '#f87171' : pct > 80 ? '#fbbf24' : color
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(128,128,128,0.15)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right" style={{ color: barColor }}>{pct}%</span>
    </div>
  )
}

function BudgetPanel({ projectId, scenes, theme, onClose, onSceneTimeChange }: {
  projectId: string; scenes: Scene[]; theme: Theme; onClose: () => void
  onSceneTimeChange: (sceneId: string, planned: number, spent: number) => void
}) {
  const T = THEME[theme]
  const storageKey = `tiany_budget_${projectId}`

  const loadData = (): BudgetData => {
    const raw = localStorage.getItem(storageKey)
    if (raw) return JSON.parse(raw)
    return { pin: '1234', isPublic: false, entries: DEFAULT_BUDGET_ENTRIES }
  }

  const [data, setData] = useState<BudgetData>(loadData)
  const [unlocked, setUnlocked] = useState(data.isPublic)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [newPin, setNewPin] = useState('')

  const save = (d: BudgetData) => { setData(d); localStorage.setItem(storageKey, JSON.stringify(d)) }

  const totalPlanned = data.entries.reduce((s, e) => s + e.planned, 0)
  const totalActual  = data.entries.reduce((s, e) => s + e.actual, 0)
  const totalTimePlanned = scenes.reduce((s, sc) => s + sc.timePlanned, 0)
  const totalTimeActual  = scenes.reduce((s, sc) => s + sc.timeSpent, 0)
  const budgetPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0
  const timePct   = totalTimePlanned > 0 ? Math.round((totalTimeActual / totalTimePlanned) * 100) : 0
  const budgetLeft = totalPlanned - totalActual
  const timeLeft   = totalTimePlanned - totalTimeActual
  const overBudget = totalActual > totalPlanned && totalPlanned > 0
  const overTime   = totalTimeActual > totalTimePlanned && totalTimePlanned > 0
  const activeEntries = data.entries.filter(e => e.planned > 0 || e.actual > 0)
  const overEntries = data.entries.filter(e => e.actual > e.planned && e.planned > 0)

  // Santé globale
  const health = overBudget || overTime ? 'red'
    : budgetPct > 80 || timePct > 80 ? 'orange'
    : totalPlanned > 0 ? 'green' : 'neutral'
  const healthLabel = { red: '🔴 Dépassement', orange: '🟡 Attention', green: '🟢 Sous contrôle', neutral: '⚪ Aucune donnée' }[health]
  const healthColor = { red: '#f87171', orange: '#fbbf24', green: '#22c55e', neutral: '#6b7280' }[health]

  // Résumé en langage humain
  const budgetSummary = totalPlanned === 0
    ? "Aucun budget saisi. Renseignez vos prévisions pour suivre vos dépenses."
    : overBudget
      ? `Vous avez dépassé votre budget de ${Math.abs(budgetLeft).toLocaleString()} €. Budget prévu : ${totalPlanned.toLocaleString()} €, dépensé : ${totalActual.toLocaleString()} €.`
      : `Vous avez dépensé ${totalActual.toLocaleString()} € sur ${totalPlanned.toLocaleString()} € prévus. Il vous reste ${budgetLeft.toLocaleString()} € (${100 - budgetPct}% du budget).`
  const timeSummary = totalTimePlanned === 0
    ? "Aucun temps de tournage saisi. Indiquez le temps prévu par séquence."
    : overTime
      ? `Dépassement de ${Math.abs(timeLeft).toFixed(1)}h. Tournage prévu : ${totalTimePlanned}h, temps réel : ${totalTimeActual}h.`
      : `Tournage : ${totalTimeActual}h sur ${totalTimePlanned}h prévues. Il reste ${timeLeft.toFixed(1)}h à tourner.`

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: T.bg, color: T.fg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.header }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <DollarSign size={14} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <span className="font-black text-sm">Budget & Logistique</span>
            {unlocked && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: data.isPublic ? 'rgba(34,197,94,0.15)' : 'rgba(232,160,32,0.15)', color: data.isPublic ? '#22c55e' : '#e8a020' }}>{data.isPublic ? '🌐 Public' : '🔒 Privé'}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unlocked && (
            <button onClick={() => save({ ...data, isPublic: !data.isPublic })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: data.isPublic ? 'rgba(248,113,113,0.1)' : 'rgba(34,197,94,0.1)', color: data.isPublic ? '#f87171' : '#22c55e', border: `1px solid ${data.isPublic ? 'rgba(248,113,113,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
              {data.isPublic ? <><EyeOff size={11} /> Rendre privé</> : <><Eye size={11} /> Rendre public</>}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: T.hintText, background: T.hint }}><X size={16} /></button>
        </div>
      </div>

      {!unlocked ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xs text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(232,160,32,0.1)' }}>
              <Lock size={28} style={{ color: '#e8a020' }} />
            </div>
            <p className="font-black text-lg mb-1">Page privée</p>
            <p className="text-sm mb-6" style={{ color: T.hintText }}>Entrez le code PIN (défaut : 1234)</p>
            <div className="flex justify-center gap-3 mb-6">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
                  style={{ background: pinError ? 'rgba(248,113,113,0.15)' : T.hint, border: `1px solid ${pinError ? 'rgba(248,113,113,0.4)' : T.border}`, color: pinInput[i] ? T.fg : 'transparent' }}>
                  {pinInput[i] ? '●' : ''}
                </div>
              ))}
            </div>
            {pinError && <p className="text-xs mb-4" style={{ color: '#f87171' }}>Code incorrect</p>}
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                <button key={i} disabled={k === ''} onClick={() => {
                  if (k === '⌫') { setPinInput(p => p.slice(0,-1)); setPinError(false) }
                  else if (pinInput.length < 4) {
                    const next = pinInput + k
                    setPinInput(next)
                    if (next.length === 4) setTimeout(() => {
                      if (next === data.pin) { setUnlocked(true); setPinError(false) }
                      else { setPinError(true); setPinInput('') }
                    }, 200)
                  }
                }} className="h-12 rounded-xl text-lg font-bold transition-all hover:opacity-80 active:scale-95 disabled:opacity-0"
                  style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }}>{k}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">

            {/* ── Santé du projet ── */}
            <div className="rounded-2xl p-5" style={{ background: T.card, border: `2px solid ${healthColor}30` }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-black" style={{ color: healthColor }}>{healthLabel}</span>
                {overEntries.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                    {overEntries.length} poste{overEntries.length > 1 ? 's' : ''} en dépassement
                  </span>
                )}
              </div>
              {/* Budget barre */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: T.fg }}>💰 Budget</span>
                  <span className="text-xs" style={{ color: T.hintText }}>{totalActual.toLocaleString()} € / {totalPlanned.toLocaleString()} €</span>
                </div>
                {totalPlanned > 0 ? <ProgressBar value={totalActual} max={totalPlanned} color="#22c55e" /> : <p className="text-xs" style={{ color: T.hintText }}>Aucun budget saisi</p>}
                <p className="text-xs mt-1.5 leading-5" style={{ color: T.hintText }}>{budgetSummary}</p>
              </div>
              {/* Temps barre */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: T.fg }}>⏱ Temps de tournage</span>
                  <span className="text-xs" style={{ color: T.hintText }}>{totalTimeActual}h / {totalTimePlanned}h</span>
                </div>
                {totalTimePlanned > 0 ? <ProgressBar value={totalTimeActual} max={totalTimePlanned} color="#a78bfa" /> : <p className="text-xs" style={{ color: T.hintText }}>Aucun temps saisi</p>}
                <p className="text-xs mt-1.5 leading-5" style={{ color: T.hintText }}>{timeSummary}</p>
              </div>
            </div>

            {/* ── Dépenses ── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: T.cardHeader, borderBottom: `1px solid ${T.border}` }}>
                <p className="font-black text-sm">Dépenses par catégorie</p>
                <p className="text-[11px]" style={{ color: T.hintText }}>Saisir Prévu puis le Réel au fur et à mesure</p>
              </div>
              <div style={{ background: T.card }}>
                <div className="grid px-5 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.hintText, gridTemplateColumns: '1fr 80px 80px' }}>
                  <span>Catégorie</span><span className="text-right">Prévu €</span><span className="text-right">Réel €</span>
                </div>
                {data.entries.map(entry => {
                  const isOver = entry.actual > entry.planned && entry.planned > 0
                  const hasData = entry.planned > 0 || entry.actual > 0
                  return (
                    <div key={entry.id} className="px-5 py-2.5 border-t" style={{ borderColor: T.border }}>
                      <div className="grid items-center gap-2 mb-1" style={{ gridTemplateColumns: '1fr 80px 80px' }}>
                        <span className="text-xs font-medium" style={{ color: isOver ? '#f87171' : T.fg }}>
                          {isOver && '⚠️ '}{entry.label}
                        </span>
                        <input type="number" min="0" value={entry.planned || ''} placeholder="0"
                          onChange={e => { const v = Number(e.target.value); save({ ...data, entries: data.entries.map(en => en.id === entry.id ? { ...en, planned: v } : en) }) }}
                          className="text-xs text-right px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }} />
                        <input type="number" min="0" value={entry.actual || ''} placeholder="0"
                          onChange={e => { const v = Number(e.target.value); save({ ...data, entries: data.entries.map(en => en.id === entry.id ? { ...en, actual: v } : en) }) }}
                          className="text-xs text-right px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: isOver ? 'rgba(248,113,113,0.08)' : T.hint, border: `1px solid ${isOver ? 'rgba(248,113,113,0.3)' : T.border}`, color: isOver ? '#f87171' : T.fg }} />
                      </div>
                      {hasData && entry.planned > 0 && (
                        <ProgressBar value={entry.actual} max={entry.planned} color="#22c55e" />
                      )}
                    </div>
                  )
                })}
                {/* Total */}
                <div className="grid px-5 py-3 font-black text-sm border-t" style={{ gridTemplateColumns: '1fr 80px 80px', borderColor: T.border, background: T.cardHeader }}>
                  <span style={{ color: T.fg }}>TOTAL</span>
                  <span className="text-right" style={{ color: '#60a5fa' }}>{totalPlanned.toLocaleString()} €</span>
                  <span className="text-right" style={{ color: overBudget ? '#f87171' : '#22c55e' }}>{totalActual.toLocaleString()} €</span>
                </div>
                {activeEntries.length > 0 && (
                  <div className="px-5 py-3 border-t" style={{ borderColor: T.border }}>
                    <ProgressBar value={totalActual} max={totalPlanned} color="#22c55e" />
                    <p className="text-[11px] mt-2 font-medium" style={{ color: overBudget ? '#f87171' : '#22c55e' }}>
                      {overBudget ? `⚠️ Dépassement de ${(totalActual - totalPlanned).toLocaleString()} €` : budgetLeft > 0 ? `✓ Il reste ${budgetLeft.toLocaleString()} € disponibles` : '✓ Budget exactement respecté'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Temps par séquence ── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <div className="px-5 py-3" style={{ background: T.cardHeader, borderBottom: `1px solid ${T.border}` }}>
                <p className="font-black text-sm">Temps par séquence</p>
                <p className="text-[11px] mt-0.5" style={{ color: T.hintText }}>Convention ciné : 1 page script ≈ 1 min à l'écran ≈ 1h de tournage</p>
              </div>
              <div style={{ background: T.card }}>
                <div className="grid px-5 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.hintText, gridTemplateColumns: '1fr 70px 70px' }}>
                  <span>Séquence</span><span className="text-right">Prévu h</span><span className="text-right">Réel h</span>
                </div>
                {scenes.map(sc => {
                  const scOver = sc.timeSpent > sc.timePlanned && sc.timePlanned > 0
                  const hasTime = sc.timePlanned > 0 || sc.timeSpent > 0
                  return (
                    <div key={sc.id} className="px-5 py-2.5 border-t" style={{ borderColor: T.border }}>
                      <div className="grid items-center gap-2 mb-1" style={{ gridTemplateColumns: '1fr 70px 70px' }}>
                        <span className="text-xs font-mono truncate" style={{ color: scOver ? '#f87171' : '#e8a020' }}>
                          {scOver && '⚠️ '}{sc.heading || 'Sans titre'}
                        </span>
                        <input type="number" min="0" step="0.5" value={sc.timePlanned || ''} placeholder="0h"
                          onChange={e => onSceneTimeChange(sc.id, Number(e.target.value), sc.timeSpent)}
                          className="text-xs text-right px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }} />
                        <input type="number" min="0" step="0.5" value={sc.timeSpent || ''} placeholder="0h"
                          onChange={e => onSceneTimeChange(sc.id, sc.timePlanned, Number(e.target.value))}
                          className="text-xs text-right px-2 py-1.5 rounded-lg outline-none"
                          style={{ background: scOver ? 'rgba(248,113,113,0.08)' : T.hint, border: `1px solid ${scOver ? 'rgba(248,113,113,0.3)' : T.border}`, color: scOver ? '#f87171' : T.fg }} />
                      </div>
                      {hasTime && sc.timePlanned > 0 && <ProgressBar value={sc.timeSpent} max={sc.timePlanned} color="#a78bfa" />}
                    </div>
                  )
                })}
                <div className="grid px-5 py-3 font-black text-sm border-t" style={{ gridTemplateColumns: '1fr 70px 70px', borderColor: T.border, background: T.cardHeader }}>
                  <span style={{ color: T.fg }}>TOTAL</span>
                  <span className="text-right" style={{ color: '#a78bfa' }}>{totalTimePlanned}h</span>
                  <span className="text-right" style={{ color: overTime ? '#f87171' : '#22c55e' }}>{totalTimeActual}h</span>
                </div>
                {totalTimePlanned > 0 && (
                  <div className="px-5 py-3 border-t" style={{ borderColor: T.border }}>
                    <ProgressBar value={totalTimeActual} max={totalTimePlanned} color="#a78bfa" />
                    <p className="text-[11px] mt-2 font-medium" style={{ color: overTime ? '#f87171' : '#22c55e' }}>
                      {overTime ? `⚠️ Dépassement de ${Math.abs(timeLeft).toFixed(1)}h — le temps c'est de l'argent !` : timeLeft > 0 ? `✓ Il reste ${timeLeft.toFixed(1)}h à tourner` : '✓ Temps de tournage respecté'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── PIN ── */}
            <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="font-bold text-sm mb-3">🔒 Code PIN d'accès</p>
              {changingPin ? (
                <div className="flex items-center gap-2">
                  <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="Nouveau PIN (4 chiffres)" className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
                    style={{ background: T.hint, border: `1px solid ${T.border}`, color: T.fg }} />
                  <button onClick={() => { if (newPin.length === 4) { save({ ...data, pin: newPin }); setChangingPin(false); setNewPin('') } }}
                    disabled={newPin.length !== 4} className="px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>OK</button>
                  <button onClick={() => setChangingPin(false)} className="px-3 py-2 rounded-xl text-sm" style={{ background: T.hint, color: T.hintText }}>Annuler</button>
                </div>
              ) : (
                <button onClick={() => setChangingPin(true)} className="text-sm px-3 py-2 rounded-xl hover:opacity-80 transition-all"
                  style={{ background: T.hint, color: T.hintText }}>Modifier le code PIN</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FirstRunModal ────────────────────────────────────────────────────
function FirstRunModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const T = THEME[theme]
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')

  const handleSendLink = async () => {
    if (!email.trim() || emailStatus === 'sending') return
    setEmailStatus('sending')
    setEmailError('')
    const err = await sendMagicLink(email.trim())
    if (err) {
      setEmailStatus('error')
      setEmailError(err)
    } else {
      setEmailStatus('sent')
    }
  }

  const steps = [
    {
      title: 'Bienvenue sur Tiany 🎬',
      content: (
        <p className="text-sm leading-7 text-center" style={{ color: T.hintBold }}>
          {"L'outil de pré-production pour cinéastes indépendants."}<br/>
          Écrivez, storyboardez, budgétisez — tout en un.
        </p>
      ),
    },
    {
      title: "Les 6 faces d'une séquence",
      content: (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-center" style={{ color: T.hintBold }}>Chaque carte peut afficher 6 vues différentes :</p>
          <div className="flex flex-wrap justify-center gap-3">
            {FACES.map((face, i) => {
              const Icon = face.icon
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: `${face.color}20`, border: `2px solid ${face.color}50` }}>
                    <Icon size={16} style={{ color: face.color }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: face.color }}>{face.label}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-center" style={{ color: T.hintText }}>Cliquez sur la flèche à droite de chaque carte pour basculer entre les vues.</p>
        </div>
      ),
    },
    {
      title: 'Plan de scène interactif',
      content: (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-center" style={{ color: T.hintBold }}>Visualisez et planifiez chaque scène en 2D :</p>
          <div className="flex flex-wrap justify-center gap-3">
            {([
              { type: 'character' as const, label: 'Personnages', emoji: '🧑' },
              { type: 'camera' as const, label: 'Caméras', emoji: '🎥' },
              { type: 'light' as const, label: 'Lumières', emoji: '💡' },
              { type: 'obstacle' as const, label: 'Décors', emoji: '🏠' },
            ]).map(item => (
              <div key={item.type} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
                style={{ background: `${FLOOR_TYPE_COLORS[item.type]}15`, border: `1px solid ${FLOOR_TYPE_COLORS[item.type]}30` }}>
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: FLOOR_TYPE_COLORS[item.type] }}>{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center" style={{ color: T.hintText }}>Glissez les éléments, ajoutez des trajectoires de mouvement et visualisez les cônes de lumière.</p>
        </div>
      ),
    },
    {
      title: 'Commençons !',
      content: (
        <div className="flex flex-col items-center gap-5 w-full">
          <p className="text-sm text-center" style={{ color: T.hintBold }}>
            Votre projet est prêt.<br/>Commencez à écrire votre première séquence !
          </p>
          {isSupabaseReady() && emailStatus !== 'sent' && (
            <div className="w-full flex flex-col gap-2">
              <p className="text-xs text-center" style={{ color: T.hintText }}>
                Optionnel — sauvegardez votre projet dans le cloud pour y accéder sur tous vos appareils.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendLink()}
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: T.hint, color: T.fg, border: `1px solid ${T.border}` }}
                />
                <button
                  onClick={handleSendLink}
                  disabled={!email.trim() || emailStatus === 'sending'}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(232,160,32,0.2)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.3)' }}>
                  {emailStatus === 'sending' ? '…' : 'Envoyer'}
                </button>
              </div>
              {emailStatus === 'error' && (
                <p className="text-xs text-center" style={{ color: '#e05050' }}>{emailError}</p>
              )}
            </div>
          )}
          {emailStatus === 'sent' && (
            <p className="text-xs text-center px-2 py-3 rounded-xl" style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020' }}>
              Lien envoyé ! Vérifiez votre boîte mail pour confirmer.
            </p>
          )}
          <button onClick={onClose}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-80"
            style={{ background: '#e8a020', color: '#000' }}>
            {"C'est parti →"}
          </button>
        </div>
      ),
    },
  ]
  const cur = steps[step]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.cardHeader }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(232,160,32,0.15)' }}>
              <Film size={13} style={{ color: '#e8a020' }} />
            </div>
            <span className="text-xs font-bold" style={{ color: T.hintText }}>Tiany · {step + 1} / {steps.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: T.hintText, background: T.hint }}>
            <X size={13} />
          </button>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center pt-5 px-6">
          {steps.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300"
              style={{ width: i === step ? 20 : 8, height: 8, background: i === step ? '#e8a020' : i < step ? 'rgba(232,160,32,0.4)' : T.divider }} />
          ))}
        </div>
        {/* Content */}
        <div className="px-6 py-6 flex flex-col gap-5 flex-1">
          <h2 className="text-xl font-black text-center" style={{ color: T.fg }}>{cur.title}</h2>
          {cur.content}
        </div>
        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-20 hover:opacity-70"
            style={{ background: T.hint, color: T.fg }}>
            <ChevronLeft size={14} /> Précédent
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(232,160,32,0.15)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.3)' }}>
              Suivant <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={onClose}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-xl font-bold transition-all hover:opacity-80"
              style={{ background: '#e8a020', color: '#000' }}>
              Commencer <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Location extractor ───────────────────────────────────────────────
function extractLocation(heading: string): string {
  const m = heading.match(/^(?:INT|EXT|INT\.\/EXT|EXT\.\/INT)\.?\s+(.+?)\s*[—–-]/i)
  return m ? m[1].trim().toUpperCase() : ''
}
const LOC_COLORS = ['#e8a020','#60a5fa','#4ade80','#f97316','#a78bfa','#f43f5e','#34d399','#fb923c','#e879f9','#2dd4bf']
const CAMERA_SETUPS = ['Pied','Épaule','Grue','Steadicam','Dolly','Drone','Handheld']

// ─── TournagePanel ────────────────────────────────────────────────────
function TournagePanel({ scenes, shootingOrder, shootingEntries, onShootingOrderChange, onEntriesChange, onPropsChange, onToggleDone, theme, lang, onClose, onStartShootingMode }: {
  scenes: Scene[]
  shootingOrder: string[]
  shootingEntries: ShootingEntry[]
  onShootingOrderChange: (order: string[]) => void
  onEntriesChange: (entries: ShootingEntry[]) => void
  onPropsChange: (sceneId: string, props: PropItem[]) => void
  onToggleDone: (sceneId: string) => void
  theme: Theme
  lang: Lang
  onClose: () => void
  onStartShootingMode: () => void
}) {
  const T = THEME[theme]
  const [tab, setTab] = useState<'plan'|'depouil'>('plan')
  const [propInputs, setPropInputs] = useState<Record<string, string>>({})
  const [expandedPropScene, setExpandedPropScene] = useState<string|null>(null)
  const dragRef = useRef<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)

  // Build ordered scenes list
  const orderedScenes = useMemo(() => {
    const map = new Map(scenes.map(s => [s.id, s]))
    const ordered = shootingOrder.map(id => map.get(id)).filter(Boolean) as Scene[]
    // Add any scenes not yet in shooting order
    scenes.forEach(s => { if (!shootingOrder.includes(s.id)) ordered.push(s) })
    return ordered
  }, [scenes, shootingOrder])

  // Collect all unique locations
  const allLocations = useMemo(() => {
    const locs = new Set<string>()
    orderedScenes.forEach(s => { const l = extractLocation(s.heading); if (l) locs.add(l) })
    return [...locs]
  }, [orderedScenes])
  const locColor = (loc: string) => LOC_COLORS[allLocations.indexOf(loc) % LOC_COLORS.length] ?? '#6b7280'

  const getEntry = (sceneId: string) => shootingEntries.find(e => e.sceneId === sceneId) ?? { sceneId, cameraSetup: '', estimatedMinutes: 0 }
  const updateEntry = (sceneId: string, patch: Partial<ShootingEntry>) => {
    const existing = shootingEntries.find(e => e.sceneId === sceneId)
    if (existing) onEntriesChange(shootingEntries.map(e => e.sceneId === sceneId ? { ...e, ...patch } : e))
    else onEntriesChange([...shootingEntries, { sceneId, cameraSetup: '', estimatedMinutes: 0, ...patch }])
  }

  const autoGroupByLocation = () => {
    const grouped = [...orderedScenes].sort((a, b) => {
      const la = extractLocation(a.heading)
      const lb = extractLocation(b.heading)
      return la.localeCompare(lb)
    })
    onShootingOrderChange(grouped.map(s => s.id))
  }

  const totalMinutes = shootingEntries.reduce((t, e) => t + (e.estimatedMinutes || 0), 0)
  const doneCount = scenes.filter(s => s.shotDone).length

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: T.bg, color: T.fg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 h-14 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.header }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
            <Clapperboard size={14} style={{ color: '#f87171' }} />
          </div>
          <div>
            <span className="font-black text-sm">Production</span>
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
              {doneCount}/{scenes.length} tournés
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onStartShootingMode}
            className="flex items-center gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            <Timer size={12} /><span className="hidden sm:inline"> Mode </span>Tournage
          </button>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: T.hintText, background: T.hint }}><X size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 sm:px-5 gap-4 sm:gap-5 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
        {([['plan','🎬 Plan de travail'],['depouil','🏷️ Dépouillement']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="pb-3 pt-3 text-xs font-bold transition-colors whitespace-nowrap"
            style={{ color: tab === t ? '#f87171' : T.hintText, borderBottom: tab === t ? '2px solid #f87171' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">

        {/* ── Tab: Plan de travail ── */}
        {tab === 'plan' && (
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs" style={{ color: T.hintText }}>
                Glisse les séquences dans l&apos;ordre de tournage. Les couleurs = mêmes décors.
              </p>
              <div className="flex items-center gap-2">
                {totalMinutes > 0 && <span className="text-xs font-bold" style={{ color: '#4ade80' }}>~{Math.round(totalMinutes/60)}h{totalMinutes%60 > 0 ? String(totalMinutes%60).padStart(2,'0') : ''}</span>}
                <button onClick={autoGroupByLocation}
                  className="text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  Grouper par décor
                </button>
              </div>
            </div>

            {orderedScenes.map((scene, idx) => {
              const loc = extractLocation(scene.heading)
              const entry = getEntry(scene.id)
              const isDragOver = dragOver === scene.id
              return (
                <div key={scene.id}
                  draggable
                  onDragStart={() => { dragRef.current = scene.id }}
                  onDragOver={e => { e.preventDefault(); setDragOver(scene.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault(); setDragOver(null)
                    const from = dragRef.current; dragRef.current = null
                    if (!from || from === scene.id) return
                    const cur = orderedScenes.map(s => s.id)
                    const fi = cur.indexOf(from), ti = cur.indexOf(scene.id)
                    const next = [...cur]; const [mv] = next.splice(fi, 1); next.splice(ti, 0, mv)
                    onShootingOrderChange(next)
                  }}
                  className="rounded-xl transition-all cursor-grab active:cursor-grabbing"
                  style={{
                    background: isDragOver ? T.hint : T.card,
                    border: `1px solid ${loc ? locColor(loc) + '30' : T.border}`,
                    opacity: scene.shotDone ? 0.55 : 1,
                    borderLeft: loc ? `3px solid ${locColor(loc)}` : `1px solid ${T.border}`,
                  }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <GripVertical size={12} style={{ color: T.hintText, flexShrink: 0 }} />
                    <span className="text-[10px] font-black w-5 flex-shrink-0" style={{ color: T.hintText }}>#{idx + 1}</span>
                    {/* Narrative order badge */}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0 font-bold" style={{ background: T.hint, color: T.hintText }}>
                      N°{scenes.findIndex(s => s.id === scene.id) + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: scene.shotDone ? T.hintText : T.fg, textDecoration: scene.shotDone ? 'line-through' : 'none' }}>
                        {scene.heading || '(sans titre)'}
                      </p>
                      {loc && <p className="text-[10px] mt-0.5 font-bold" style={{ color: locColor(loc) }}>{loc}</p>}
                    </div>
                    {/* Camera setup */}
                    <select value={entry.cameraSetup} onChange={e => updateEntry(scene.id, { cameraSetup: e.target.value })}
                      className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0 bg-transparent border outline-none cursor-pointer"
                      style={{ borderColor: T.border, color: entry.cameraSetup ? '#e8a020' : T.hintText, maxWidth: 90 }}>
                      <option value="">📷 Setup</option>
                      {CAMERA_SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {/* Time estimate */}
                    <input type="number" min={0} max={999} value={entry.estimatedMinutes || ''}
                      onChange={e => updateEntry(scene.id, { estimatedMinutes: parseInt(e.target.value) || 0 })}
                      placeholder="min"
                      className="w-12 text-[10px] text-center px-1 py-1 rounded-lg bg-transparent border outline-none"
                      style={{ borderColor: T.border, color: T.hintText }} />
                    {/* Done toggle */}
                    <button onClick={() => onToggleDone(scene.id)}
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: scene.shotDone ? 'rgba(74,222,128,0.15)' : T.hint, border: `1px solid ${scene.shotDone ? '#4ade80' : T.border}` }}>
                      {scene.shotDone ? <BadgeCheck size={13} style={{ color: '#4ade80' }} /> : <Check size={10} style={{ color: T.hintText }} />}
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Location legend */}
            {allLocations.length > 0 && (
              <div className="mt-6 p-4 rounded-xl" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: T.hintText }}>Décors identifiés</p>
                <div className="flex flex-wrap gap-2">
                  {allLocations.map(loc => (
                    <span key={loc} className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: locColor(loc) + '18', color: locColor(loc), border: `1px solid ${locColor(loc)}35` }}>
                      {loc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Dépouillement ── */}
        {tab === 'depouil' && (
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs" style={{ color: T.hintText }}>
                Liste tous les accessoires et éléments requis par séquence.
              </p>
              <button
                onClick={() => {
                  // Auto-extract capitalized nouns from action blocks as prop suggestions
                  scenes.forEach(scene => {
                    if ((scene.props ?? []).length > 0) return
                    const actionText = scene.blocks.filter(b => b.type === 'action').map(b => b.text).join(' ')
                    const words = actionText.match(/\b[A-ZÀ-Ü][a-zà-ü]{3,}\b/g) ?? []
                    const unique = [...new Set(words)].slice(0, 8)
                    if (unique.length > 0) {
                      onPropsChange(scene.id, unique.map(w => ({ id: uid(), text: w, done: false })))
                    }
                  })
                }}
                className="text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all hover:opacity-80"
                style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                ✦ Extraction auto
              </button>
            </div>

            {scenes.map((scene, sceneIdx) => {
              const props = scene.props ?? []
              const doneProps = props.filter(p => p.done).length
              const isExpanded = expandedPropScene === scene.id || expandedPropScene === null
              return (
                <div key={scene.id} className="rounded-xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedPropScene(expandedPropScene === scene.id ? null : scene.id)}>
                    <span className="text-[10px] font-black flex-shrink-0" style={{ color: T.hintText }}>#{sceneIdx + 1}</span>
                    <p className="flex-1 text-sm font-bold truncate" style={{ color: T.fg }}>{scene.heading || '(sans titre)'}</p>
                    {props.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: doneProps === props.length ? 'rgba(74,222,128,0.12)' : 'rgba(232,160,32,0.12)', color: doneProps === props.length ? '#4ade80' : '#e8a020' }}>
                        {doneProps}/{props.length}
                      </span>
                    )}
                    <ChevronDown size={12} style={{ color: T.hintText, transform: expandedPropScene === scene.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {(expandedPropScene === scene.id) && (
                    <div className="px-4 pb-4 space-y-2" style={{ borderTop: `1px solid ${T.border}` }}>
                      {/* Action text preview */}
                      {scene.blocks.filter(b => b.type === 'action' && b.text).slice(0, 2).map(b => (
                        <p key={b.id} className="text-[10px] italic pt-2" style={{ color: T.hintText }}>{b.text.slice(0, 120)}{b.text.length > 120 ? '…' : ''}</p>
                      ))}
                      {/* Props list */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {props.map(prop => (
                          <div key={prop.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                            style={{ background: prop.done ? 'rgba(74,222,128,0.1)' : T.hint, border: `1px solid ${prop.done ? '#4ade8040' : T.border}`, color: prop.done ? '#4ade80' : T.fg }}>
                            <button onClick={() => onPropsChange(scene.id, props.map(p => p.id === prop.id ? { ...p, done: !p.done } : p))}
                              className="flex-shrink-0">
                              {prop.done ? '✓' : '○'}
                            </button>
                            <span style={{ textDecoration: prop.done ? 'line-through' : 'none' }}>{prop.text}</span>
                            <button onClick={() => onPropsChange(scene.id, props.filter(p => p.id !== prop.id))}
                              className="opacity-40 hover:opacity-80 flex-shrink-0 ml-0.5">
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Add prop */}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={propInputs[scene.id] ?? ''}
                          onChange={e => setPropInputs(prev => ({ ...prev, [scene.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (propInputs[scene.id] ?? '').trim()) {
                              onPropsChange(scene.id, [...props, { id: uid(), text: propInputs[scene.id].trim(), done: false }])
                              setPropInputs(prev => ({ ...prev, [scene.id]: '' }))
                            }
                          }}
                          placeholder="+ Accessoire, décor, costume…"
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-transparent border outline-none"
                          style={{ borderColor: T.border, color: T.fg }} />
                        <button
                          onClick={() => {
                            const v = (propInputs[scene.id] ?? '').trim()
                            if (!v) return
                            onPropsChange(scene.id, [...props, { id: uid(), text: v, done: false }])
                            setPropInputs(prev => ({ ...prev, [scene.id]: '' }))
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                          <Tag size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Export */}
            <button
              onClick={() => {
                const lines: string[] = [`DÉPOUILLEMENT — ${new Date().toLocaleDateString('fr-FR')}\n`]
                scenes.forEach((scene, i) => {
                  const props = scene.props ?? []
                  if (props.length === 0) return
                  lines.push(`\n[${i + 1}] ${scene.heading || '(sans titre)'}`)
                  props.forEach(p => lines.push(`  ${p.done ? '✓' : '○'} ${p.text}`))
                })
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'depouillement.txt'; a.click()
                URL.revokeObjectURL(url)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-80 flex items-center justify-center gap-2 mt-2"
              style={{ background: T.hint, color: T.hintBold, border: `1px solid ${T.border}` }}>
              <Download size={13} /> Exporter le dépouillement
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── ShootingModeOverlay ──────────────────────────────────────────────
function ShootingModeOverlay({ scenes, shootingOrder, burnRate, onBurnRateChange, onToggleDone, theme, onClose }: {
  scenes: Scene[]
  shootingOrder: string[]
  burnRate: number
  onBurnRateChange: (r: number) => void
  onToggleDone: (id: string) => void
  theme: Theme
  onClose: () => void
}) {
  const T = THEME[theme]
  const [elapsed, setElapsed] = useState(0) // seconds
  const [running, setRunning] = useState(false)
  const [sceneIdx, setSceneIdx] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const orderedScenes = useMemo(() => {
    const map = new Map(scenes.map(s => [s.id, s]))
    const ordered = shootingOrder.map(id => map.get(id)).filter(Boolean) as Scene[]
    scenes.forEach(s => { if (!shootingOrder.includes(s.id)) ordered.push(s) })
    return ordered
  }, [scenes, shootingOrder])

  const pendingScenes = orderedScenes.filter(s => !s.shotDone)
  const currentScene = pendingScenes[sceneIdx] ?? orderedScenes[0]
  const totalBurned = (elapsed / 60) * burnRate
  const fmt = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const doneCount = scenes.filter(s => s.shotDone).length

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#030303', color: '#f0ede8' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 h-14 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: running ? '#f87171' : '#6b7280', boxShadow: running ? '0 0 8px #f87171' : 'none' }} />
            <span className="font-mono text-lg font-black tracking-wider" style={{ color: running ? '#f0ede8' : 'rgba(240,237,232,0.45)' }}>{fmt(elapsed)}</span>
          </div>
          <span className="text-sm font-black" style={{ color: '#f87171' }}>
            {totalBurned > 0 ? `−${totalBurned.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €` : '0 €'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>€/min</span>
            <input type="number" value={burnRate} onChange={e => onBurnRateChange(Number(e.target.value) || 0)}
              className="w-16 text-xs font-bold text-center bg-transparent border rounded-lg px-2 py-1 outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#e8a020' }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: '#4ade80' }}>{doneCount}/{scenes.length} ✓</span>
          <button onClick={() => setRunning(r => !r)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black transition-all"
            style={{ background: running ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)', color: running ? '#f87171' : '#4ade80', border: `1px solid ${running ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}` }}>
            {running ? '⏸ Pause' : '▶ Démarrer'}
          </button>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }}><X size={16} /></button>
        </div>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Séquences à tourner — {pendingScenes.length} restantes
          </p>
          {orderedScenes.map((scene, idx) => {
            const isCurrent = scene.id === currentScene?.id && !scene.shotDone
            return (
              <div key={scene.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer"
                style={{ background: isCurrent ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isCurrent ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.05)'}`, opacity: scene.shotDone ? 0.45 : 1 }}
                onClick={() => { const pi = pendingScenes.findIndex(s => s.id === scene.id); if (pi >= 0) setSceneIdx(pi) }}>
                <span className="text-[10px] font-black w-5" style={{ color: 'rgba(255,255,255,0.3)' }}>#{idx+1}</span>
                <p className="flex-1 text-sm font-bold truncate" style={{ color: scene.shotDone ? 'rgba(255,255,255,0.3)' : '#f0ede8', textDecoration: scene.shotDone ? 'line-through' : 'none' }}>
                  {scene.heading || '(sans titre)'}
                </p>
                {isCurrent && <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171' }}>EN COURS</span>}
                <button onClick={e => { e.stopPropagation(); onToggleDone(scene.id) }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                  style={{ background: scene.shotDone ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${scene.shotDone ? '#4ade8040' : 'rgba(255,255,255,0.08)'}` }}>
                  {scene.shotDone ? <BadgeCheck size={13} style={{ color: '#4ade80' }} /> : <Check size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current scene detail */}
      {currentScene && (
        <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Séquence en cours</p>
              <p className="text-base font-black" style={{ color: '#f0ede8' }}>{currentScene.heading || '(sans titre)'}</p>
              {extractLocation(currentScene.heading) && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{extractLocation(currentScene.heading)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSceneIdx(i => Math.max(0, i - 1))}
                disabled={sceneIdx === 0}
                className="p-2 rounded-lg disabled:opacity-20" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <ChevronLeft size={16} style={{ color: '#f0ede8' }} />
              </button>
              <button onClick={() => {
                onToggleDone(currentScene.id)
                setSceneIdx(i => Math.min(pendingScenes.length - 2, i))
              }}
                className="px-4 py-2 rounded-xl text-sm font-black transition-all hover:opacity-80"
                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                ✓ Séquence tournée
              </button>
              <button onClick={() => setSceneIdx(i => Math.min(pendingScenes.length - 1, i + 1))}
                disabled={sceneIdx >= pendingScenes.length - 1}
                className="p-2 rounded-lg disabled:opacity-20" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <ChevronRight size={16} style={{ color: '#f0ede8' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────
export default function WritePage() {
  const params = useParams()
  const projectId = params.id as string

  const [title, setTitle] = useState('Sans titre')
  const [scenes, setScenes] = useState<Scene[]>([defaultScene()])
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('tiany_lang') as Lang) ?? 'fr'
    return 'fr'
  })
  const [showLangPicker, setShowLangPicker] = useState(false)
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem('tiany_lang', l); setShowLangPicker(false) }
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle' | 'error'>('idle')
  const [loaded, setLoaded] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const [presentIdx, setPresentIdx] = useState(0)
  const [swMode, setSwMode] = useState(false)
  const [pitchMode, setPitchMode] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [unreadMentions, setUnreadMentions] = useState(() => MOCK_GROUP.filter(m => m.text.includes('@Toi')).length)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [budgetToken, setBudgetToken] = useState(0)
  const [showMembers, setShowMembers] = useState(false)
  const [showMoodboard, setShowMoodboard] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [fontPreset, setFontPreset] = useState<FontPreset>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('tiany_font_preset') as FontPreset) ?? 'theatrical'
    return 'theatrical'
  })
  const [showFontPicker, setShowFontPicker] = useState(false)
  const setPreset = (p: FontPreset) => { setFontPreset(p); localStorage.setItem('tiany_font_preset', p); setShowFontPicker(false) }
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [shootingOrder, setShootingOrder] = useState<string[]>([])
  const [shootingEntries, setShootingEntries] = useState<ShootingEntry[]>([])
  const [showTournage, setShowTournage] = useState(false)
  const [showShootingMode, setShowShootingMode] = useState(false)
  const [burnRate, setBurnRate] = useState(100)
  const dragScene = useRef<string | null>(null)

  // Supabase hooks
  const { user: currentUser } = useCurrentUser()
  const { syncSave, syncLoad } = useProjectSync()
  const { comments: realtimeComments, addComment: addRealtimeComment } = useRealtimeComments(projectId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = useRef(false) // true once user edits after initial load
  const T = THEME[theme]

  // ── Load from localStorage ──
  useEffect(() => {
    let localData: Record<string, unknown> | null = null
    try {
      const localRaw = localStorage.getItem(`tiany_project_${projectId}`)
      localData = localRaw ? JSON.parse(localRaw) : null
    } catch { localData = null }

    const applyData = (data: { title?: string; scenes?: (Scene & { imageUrl?: string | null })[]; lang?: string; theme?: string; fontPreset?: string; budget?: unknown } | null) => {
      if (!data) return
      setTitle(data.title || 'Sans titre')
      // Restore settings
      if (data.lang && data.lang !== langRef.current) { setLangState(data.lang as Lang); langRef.current = data.lang as Lang; localStorage.setItem('tiany_lang', data.lang) }
      if (data.theme && data.theme !== themeRef.current) { setTheme(data.theme as Theme); themeRef.current = data.theme as Theme }
      if (data.fontPreset && data.fontPreset !== fontPresetRef.current) { setFontPreset(data.fontPreset as FontPreset); fontPresetRef.current = data.fontPreset as FontPreset; localStorage.setItem('tiany_font_preset', data.fontPreset) }
      // Restore budget — write to localStorage then bump token so BudgetPanel remounts with fresh data
      if (data.budget) {
        try { localStorage.setItem(`tiany_budget_${projectId}`, JSON.stringify(data.budget)) } catch { /* ignore */ }
        setBudgetToken(t => t + 1)
      }
      setScenes((data.scenes || [defaultScene()]).map((s: Scene & { imageUrl?: string | null }) => {
        const base = { ...defaultScene(), ...s }
        if (!base.imageUrls || base.imageUrls.length === 0) {
          if (s.imageUrl && !s.imageUrl.startsWith('blob:')) base.imageUrls = [s.imageUrl]
          else base.imageUrls = []
        }
        // migrate old comments (blockId → targetId)
        base.comments = (base.comments ?? []).map((c: Comment & { blockId?: string }) => {
          if (c.blockId && !c.targetId) return { ...c, target: 'block' as const, targetId: c.blockId }
          return c
        })
        return base
      }))
      if (data.scenes?.[0]?.blocks?.[0]) setFocusedBlockId(data.scenes[0].blocks[0].id)
    }

    // Load local first (instant), then try Supabase
    applyData(localData)
    syncLoad(projectId, localData).then((remote: Record<string, unknown> | null) => {
      // Skip if user already made edits while Supabase was loading
      if (remote && remote !== localData && !isDirtyRef.current) applyData(remote as typeof localData)
    })

    // Load member role
    const uid = localStorage.getItem('tiany_user_id')
    if (uid) getMemberRole(projectId, uid).then((r: string | null) => setMemberRole(r))

    if (!localStorage.getItem('tiany_onboarded')) setShowOnboarding(true)
    setLoaded(true)
  }, [projectId, syncLoad])

  // ── Refs to track current settings for saveToStorage (no dep churn) ──
  const langRef = useRef(lang)
  const themeRef = useRef(theme)
  const fontPresetRef = useRef(fontPreset)
  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { fontPresetRef.current = fontPreset }, [fontPreset])

  // ── Preload all IDB image URLs into module cache ──
  useEffect(() => {
    const refs = scenes.flatMap(s => s.imageUrls).filter(u => u.startsWith('idb://'))
    refs.forEach(ref => resolveUrl(ref)) // fire-and-forget — populates urlCache
  }, [scenes])

  // ── Auto-save (debounced 800ms) ──
  const saveToStorage = useCallback((newTitle: string, newScenes: Scene[]) => {
    setSaveStatus('saving')
    isDirtyRef.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const words = countWords(newScenes)
      const pageCount = Math.max(1, Math.ceil(words / 200))
      // Read budget from its own localStorage key to include in the sync payload
      let budget: unknown = undefined
      try { const raw = localStorage.getItem(`tiany_budget_${projectId}`); if (raw) budget = JSON.parse(raw) } catch { /* ignore */ }
      const projectData = {
        id: projectId, title: newTitle, scenes: newScenes,
        lang: langRef.current, theme: themeRef.current, fontPreset: fontPresetRef.current,
        ...(budget ? { budget } : {}),
        updatedAt: new Date().toISOString(),
      }
      try { localStorage.setItem(`tiany_project_${projectId}`, JSON.stringify(projectData)) } catch { /* storage full */ }
      // Update index
      try {
        const rawIdx = localStorage.getItem('tiany_index')
        if (rawIdx) {
          const idx = JSON.parse(rawIdx)
          const updated = idx.map((p: { id: string }) => p.id === projectId
            ? { ...p, title: newTitle, updatedAt: new Date().toISOString(), sceneCount: newScenes.length, pageCount }
            : p)
          localStorage.setItem('tiany_index', JSON.stringify(updated))
        }
      } catch { /* index update failed */ }
      // Sync to Supabase
      const ownerId = localStorage.getItem('tiany_user_id') ?? undefined
      syncSave(projectId, newTitle, projectData as Record<string, unknown>, ownerId)
        .then(ok => setSaveStatus(ok ? 'saved' : 'error'))
        .catch(() => setSaveStatus('error'))
    }, 800)
  }, [projectId, syncSave])

  // ── Scenes mutators ──
  const updateScene = useCallback(<K extends keyof Scene>(id: string, key: K, val: Scene[K]) => {
    setScenes(prev => { const next = prev.map(s => s.id === id ? { ...s, [key]: val } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const deleteScene = useCallback((id: string) => {
    setScenes(prev => { if (prev.length === 1) return prev; setConfirmDeleteId(id); return prev })
  }, [])

  const confirmDelete = useCallback((id: string) => {
    setScenes(prev => { const next = prev.filter(s => s.id !== id); saveToStorage(title, next); return next })
    setConfirmDeleteId(null)
  }, [saveToStorage, title])

  const addScene = useCallback(() => {
    const s = defaultScene()
    setScenes(prev => { const next = [...prev, s]; saveToStorage(title, next); return next })
    setFocusedBlockId(s.blocks[0].id)
  }, [saveToStorage, title])

  const duplicateScene = useCallback((sceneId: string) => {
    setScenes(prev => {
      const idx = prev.findIndex(s => s.id === sceneId)
      if (idx < 0) return prev
      const dupe: Scene = { ...prev[idx], id: uid() }
      const next = [...prev]
      next.splice(idx + 1, 0, dupe)
      saveToStorage(title, next)
      return next
    })
  }, [saveToStorage, title])

  const updateBlock = useCallback((sceneId: string, blockId: string, text: string) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, text } : b) } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const changeBlockType = useCallback((sceneId: string, blockId: string, type: BlockType) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, type } : b) } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const deleteBlock = useCallback((sceneId: string, blockId: string) => {
    setScenes(prev => {
      const next = prev.map(s => {
        if (s.id !== sceneId || s.blocks.length === 1) return s
        const idx = s.blocks.findIndex(b => b.id === blockId)
        const blocks = s.blocks.filter(b => b.id !== blockId)
        setFocusedBlockId(blocks[Math.max(0, idx - 1)]?.id ?? null)
        return { ...s, blocks }
      })
      saveToStorage(title, next); return next
    })
  }, [saveToStorage, title])

  const addBlock = useCallback((sceneId: string, afterBlockId: string) => {
    setScenes(prev => {
      const next = prev.map(s => {
        if (s.id !== sceneId) return s
        const idx = s.blocks.findIndex(b => b.id === afterBlockId)
        const cur = s.blocks[idx]
        const nb: Block = { id: uid(), type: BLOCK_CONFIG[cur?.type ?? 'action'].next, text: '' }
        const blocks = [...s.blocks]; blocks.splice(idx + 1, 0, nb)
        setFocusedBlockId(nb.id)
        return { ...s, blocks }
      })
      saveToStorage(title, next); return next
    })
  }, [saveToStorage, title])

  const batchInsertBlocks = useCallback((sceneId: string, rawBlocks: {type: string; text: string}[]) => {
    setScenes(prev => {
      const next = prev.map(s => {
        if (s.id !== sceneId) return s
        const newBlocks: Block[] = rawBlocks.map(b => ({ id: uid(), type: (b.type as BlockType) ?? 'action', text: b.text }))
        return { ...s, blocks: [...s.blocks, ...newBlocks] }
      })
      saveToStorage(title, next); return next
    })
  }, [saveToStorage, title])

  const addComment = useCallback((sceneId: string, target: 'block'|'image'|'shot'|'scene', targetId: string, text: string) => {
    let authorName = 'Moi'
    let authorId = localStorage.getItem('tiany_user_id') ?? uid()
    try { const u = JSON.parse(localStorage.getItem('tiany_user') || 'null'); if (u?.name) authorName = u.name } catch {}
    const c: Comment = { id: uid(), author: authorName, text, target, targetId }
    // Save locally in scene
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, comments: [...s.comments, c] } : s); saveToStorage(title, next); return next })
    // Sync to Supabase realtime
    addRealtimeComment(sceneId, target, targetId, authorId, authorName, text)
  }, [saveToStorage, title, addRealtimeComment])

  const updateShots = useCallback((sceneId: string, shots: Shot[]) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, shots } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateSound = useCallback((sceneId: string, key: keyof Scene['sound'], val: string) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, sound: { ...s.sound, [key]: val } } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateNotes = useCallback((sceneId: string, notes: string) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, notes } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateSceneTime = useCallback((sceneId: string, timePlanned: number, timeSpent: number) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, timePlanned, timeSpent } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateFloorItems = useCallback((sceneId: string, floorItems: FloorItem[]) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, floorItems } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateHiddenFaces = useCallback((sceneId: string, hiddenFaces: number[]) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, hiddenFaces } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const toggleShotDone = useCallback((sceneId: string) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, shotDone: !s.shotDone } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const updateProps = useCallback((sceneId: string, props: PropItem[]) => {
    setScenes(prev => { const next = prev.map(s => s.id === sceneId ? { ...s, props } : s); saveToStorage(title, next); return next })
  }, [saveToStorage, title])

  const handleShootingOrderChange = useCallback((order: string[]) => {
    setShootingOrder(order)
    localStorage.setItem(`tiany_shooting_${projectId}`, JSON.stringify(order))
  }, [projectId])

  const handleEntriesChange = useCallback((entries: ShootingEntry[]) => {
    setShootingEntries(entries)
    localStorage.setItem(`tiany_shooting_entries_${projectId}`, JSON.stringify(entries))
  }, [projectId])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    saveToStorage(v, scenes)
  }

  // ── Initialize shooting order ──
  useEffect(() => {
    if (scenes.length > 0 && shootingOrder.length === 0) {
      const saved = localStorage.getItem(`tiany_shooting_${projectId}`)
      if (saved) setShootingOrder(JSON.parse(saved))
      else setShootingOrder(scenes.map(s => s.id))
    }
  }, [scenes, projectId, shootingOrder.length])

  // ── Drag to reorder scenes ──
  const handleDragStart = (id: string) => { dragScene.current = id }
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id) }
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault(); setDragOver(null)
    const from = dragScene.current; dragScene.current = null
    if (!from || from === targetId) return
    setScenes(prev => {
      const fromIdx = prev.findIndex(s => s.id === from)
      const toIdx = prev.findIndex(s => s.id === targetId)
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      saveToStorage(title, next); return next
    })
  }

  // ── Export ──
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExportTxt = () => {
    const lines = scenes.flatMap(s => {
      const p: string[] = [s.heading || 'INT. — JOUR']
      s.blocks.forEach(b => { if (b.text) p.push(b.text) })
      return p
    })
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${title.replace(/\s+/g,'_')}.txt`; a.click()
    setShowExportMenu(false)
  }

  const handleExportFountain = () => {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    let content = `Title: ${title}\nAuthor: \nDraft date: ${dateStr}\n\n===\n\n`
    scenes.forEach(s => {
      const heading = (s.heading || 'INT. LIEU — JOUR').toUpperCase()
      content += heading + '\n\n'
      s.blocks.forEach(b => {
        if (!b.text) return
        if (b.type === 'action') content += b.text + '\n\n'
        else if (b.type === 'character') content += b.text.toUpperCase() + '\n'
        else if (b.type === 'dialogue') content += b.text + '\n\n'
        else if (b.type === 'parenthetical') content += `(${b.text.replace(/^\(|\)$/g,'')})\n`
        else if (b.type === 'transition') content += `> ${b.text.toUpperCase()}\n\n`
      })
    })
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${title.replace(/\s+/g,'_')}.fountain`; a.click()
    setShowExportMenu(false)
  }

  const handleExportPDF = async () => {
    setShowExportMenu(false)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' })
    const pageW = 215.9
    const pageH = 279.4
    const marginTop = 25.4
    const marginBottom = 25.4
    const actionLeft = 37.5
    const actionRight = pageW - 25.4
    const actionWidth = actionRight - actionLeft
    const charLeft = 96.5
    const dialogLeft = 63.5
    const dialogWidth = 88.9
    const parenLeft = 69.5
    const parenWidth = 77
    const lineH = 6.35 // ~1/6 inch at 12pt Courier
    let y = marginTop
    let pageNum = 1

    const addPageNum = () => {
      doc.setFont('Courier', 'normal')
      doc.setFontSize(12)
      doc.text(`${pageNum}.`, pageW - 25.4, marginTop - 8, { align: 'right' })
    }

    const checkNewPage = (neededH: number) => {
      if (y + neededH > pageH - marginBottom) {
        doc.addPage()
        pageNum++
        addPageNum()
        y = marginTop
      }
    }

    const writeLine = (text: string, x: number, maxW: number, bold = false, align: 'left'|'right'|'center' = 'left') => {
      doc.setFont('Courier', bold ? 'bold' : 'normal')
      doc.setFontSize(12)
      const lines = doc.splitTextToSize(text, maxW)
      lines.forEach((line: string) => {
        checkNewPage(lineH)
        if (align === 'right') doc.text(line, actionRight, y, { align: 'right' })
        else if (align === 'center') doc.text(line, x + maxW / 2, y, { align: 'center' })
        else doc.text(line, x, y)
        y += lineH
      })
      return lines.length
    }

    // Title page
    doc.setFont('Courier', 'bold')
    doc.setFontSize(24)
    doc.text(title, pageW / 2, pageH / 2 - 20, { align: 'center' })
    doc.setFont('Courier', 'normal')
    doc.setFontSize(14)
    doc.text('Écrit avec Tiany', pageW / 2, pageH / 2 - 8, { align: 'center' })
    const nowStr = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.setFontSize(12)
    doc.text(nowStr, pageW / 2, pageH / 2 + 2, { align: 'center' })

    // Script pages
    doc.addPage()
    pageNum++
    addPageNum()
    y = marginTop

    scenes.forEach(scene => {
      const heading = (scene.heading || 'INT. LIEU — JOUR').toUpperCase()
      checkNewPage(lineH * 2)
      writeLine(heading, actionLeft, actionWidth, true)
      y += lineH * 0.5

      scene.blocks.forEach(block => {
        if (!block.text) return
        if (block.type === 'action') {
          checkNewPage(lineH)
          writeLine(block.text, actionLeft, actionWidth)
          y += lineH * 0.5
        } else if (block.type === 'character') {
          checkNewPage(lineH * 3)
          writeLine(block.text.toUpperCase(), charLeft, actionRight - charLeft, true)
        } else if (block.type === 'dialogue') {
          checkNewPage(lineH)
          writeLine(block.text, dialogLeft, dialogWidth)
          y += lineH * 0.5
        } else if (block.type === 'parenthetical') {
          const text = block.text.startsWith('(') ? block.text : `(${block.text})`
          checkNewPage(lineH)
          writeLine(text, parenLeft, parenWidth)
        } else if (block.type === 'transition') {
          checkNewPage(lineH * 2)
          y += lineH * 0.5
          writeLine(block.text.toUpperCase(), actionLeft, actionWidth, true, 'right')
          y += lineH * 0.5
        }
      })
      y += lineH
    })

    doc.save(`${title.replace(/\s+/g,'_')}.pdf`)
  }

  // ── Computed ──
  const words = countWords(scenes)
  const pages = Math.max(1, Math.ceil(words / 200))

  if (!loaded) return <div className="min-h-screen" style={{ background: '#080808' }} />

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200" data-theme={theme} style={{ background: T.bg, color: T.fg }}>

      {/* Header */}
      <header className="flex items-center gap-2 px-3 h-12 sticky top-0 z-40 flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}`, background: T.header, backdropFilter: 'blur(12px)' }}>
        <Link href="/projects" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
          style={{ background: T.addBtn, color: T.addBtnText }} title={UI[lang].back}>
          <ArrowLeft size={14} />
        </Link>
        <div className="w-px h-4 flex-shrink-0" style={{ background: T.divider }} />
        <input value={title} onChange={e => handleTitleChange(e.target.value)}
          className="bg-transparent outline-none text-sm font-semibold flex-1 min-w-0"
          style={{ color: T.inputColor }} placeholder="Titre du projet" />

        {/* Save status */}
        <div className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: T.seqCount }}>
          {saveStatus === 'saving' && <span className="hidden sm:inline">Sauvegarde...</span>}
          {saveStatus === 'saved' && <><Check size={10} style={{ color: '#4ade80' }} /><span className="hidden sm:inline" style={{ color: '#4ade80' }}>Sauvegardé</span></>}
          {saveStatus === 'error' && <span className="hidden sm:inline" style={{ color: '#f87171' }}>Erreur cloud</span>}
        </div>

        {/* ── Desktop toolbar (sm+) ── */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowStats(s => !s)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: T.addBtn, color: T.seqCount }}>
            <Clock size={10} /><span>{pages} p. · ~{pages} min</span>
            <BarChart2 size={10} className="ml-1" />
          </button>
          <button onClick={() => setShowTournage(true)}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
            <Clapperboard size={12} /> Tournage
          </button>
          <button onClick={() => { setPresenting(true); setPresentIdx(0) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
            <Play size={11} /> {UI[lang].presenting}
          </button>
          <button onClick={() => { setPitchMode(true); setPresentIdx(0) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}>
            <Film size={11} /> Pitch
          </button>
          <button onClick={() => { setShowChat(c => !c); setUnreadMentions(0) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-all relative"
            style={{ background: showChat ? 'rgba(232,160,32,0.15)' : T.addBtn, color: showChat ? '#e8a020' : T.addBtnText, border: showChat ? '1px solid rgba(232,160,32,0.3)' : `1px solid ${T.border}` }}>
            <MessageCircle size={11} /> {UI[lang].chat}
            {!showChat && unreadMentions > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: '#f43f5e', color: '#fff' }}>{unreadMentions}</span>
            )}
          </button>
          <button onClick={() => setShowBudget(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-all"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
            <DollarSign size={11} /> {UI[lang].budget}
          </button>
          <button onClick={() => setShowMoodboard(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-all"
            style={{ background: 'rgba(168,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(168,139,250,0.2)' }}>
            <Palette size={11} /> Moodboard
          </button>
          <button onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-all"
            style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.2)' }}>
            <Users size={11} /> Équipe
          </button>
          {/* Font preset picker */}
          <div className="relative">
            <button onClick={() => setShowFontPicker(v => !v)}
              className="flex items-center justify-center h-8 px-2.5 rounded-lg transition-all hover:opacity-70 text-xs font-bold"
              style={{ background: showFontPicker ? 'rgba(168,139,250,0.15)' : T.addBtn, color: showFontPicker ? '#a78bfa' : T.addBtnText, border: showFontPicker ? '1px solid rgba(168,139,250,0.3)' : `1px solid transparent` }}
              title="Typographie">
              Aa
            </button>
            {showFontPicker && (
              <div className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden shadow-2xl z-50 w-56 py-2"
                style={{ background: theme === 'dark' ? '#161616' : '#fff', border: `1px solid ${T.border}` }}>
                <p className="text-[10px] font-black uppercase tracking-widest px-4 pb-2 pt-1" style={{ color: T.hintText }}>
                  {({ fr:'Typographie', en:'Typography', es:'Tipografía', de:'Typografie', it:'Tipografia', pt:'Tipografia', ja:'フォント', zh:'字体', ko:'글꼴', ar:'الخط', ru:'Шрифт', nl:'Typografie', pl:'Typografia', sv:'Typografi', tr:'Tipografi' } as Record<Lang,string>)[lang]}
                </p>
                {(Object.entries(FONT_PRESETS) as [FontPreset, typeof FONT_PRESETS[FontPreset]][]).map(([key, p]) => (
                  <button key={key} onClick={() => setPreset(key)}
                    className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/5 flex items-start gap-3"
                    style={{ background: fontPreset === key ? 'rgba(168,139,250,0.08)' : 'transparent' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ fontFamily: p.dialogue, color: fontPreset === key ? '#a78bfa' : T.fg }}>{p.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: T.hintText }}>{p.desc}</p>
                      <p className="text-xs mt-1 italic" style={{ fontFamily: p.dialogue, color: T.hintText, opacity: 0.8 }}>
                        {({ fr:"« Il faut qu'on parte… »", en:'"We have to leave…"', es:'«Tenemos que irnos…»', de:'»Wir müssen gehen…«', it:'«Dobbiamo andare…»', pt:'«Temos que ir…»', ja:'「もう行かなければ…」', zh:'「我们必须走了…」', ko:'「우리 가야 해…」', ar:'«يجب أن نذهب…»', ru:'«Нам нужно уходить…»', nl:'«We moeten gaan…»', pl:'«Musimy odejść…»', sv:'«Vi måste gå…»', tr:'«Gitmeliyiz…»' } as Record<Lang,string>)[lang]}
                      </p>
                    </div>
                    {fontPreset === key && <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#a78bfa' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Language picker */}
          <div className="relative">
            <button onClick={() => setShowLangPicker(v => !v)}
              className="flex items-center gap-1 h-8 px-2 rounded-lg transition-all hover:opacity-70 text-xs font-bold"
              style={{ background: T.addBtn, color: T.addBtnText }}>
              {LANG_META[lang].flag} {lang.toUpperCase()}
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 py-1 min-w-[160px] max-h-[60vh] overflow-y-auto"
                style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: `1px solid ${T.border}` }}>
                {(Object.keys(LANG_META) as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5 flex items-center gap-2"
                    style={{ color: l === lang ? '#e8a020' : T.hintBold, fontWeight: l === lang ? 700 : 400 }}>
                    <span>{LANG_META[l].flag}</span>
                    <span>{LANG_META[l].label}</span>
                    {l === lang && <Check size={10} className="ml-auto" style={{ color: '#e8a020' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowShortcuts(v => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70 text-xs font-bold"
            style={{ background: showShortcuts ? 'rgba(255,255,255,0.1)' : T.addBtn, color: T.addBtnText }}
            title="Raccourcis clavier">
            ?
          </button>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
            style={{ background: T.addBtn, color: T.addBtnText }}>
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020', border: '1px solid rgba(232,160,32,0.2)' }}>
              <Download size={11} /> {UI[lang].export}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 py-1 min-w-[160px]"
                style={{ background: theme === 'dark' ? '#1c1c1c' : '#ffffff', border: '1px solid rgba(232,160,32,0.2)' }}>
                <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: '#f0ede8' }}>{UI[lang].exportPDF}</button>
                <button onClick={handleExportFountain} className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: '#f0ede8' }}>{UI[lang].exportFountain}</button>
                <button onClick={handleExportTxt} className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: '#f0ede8' }}>{UI[lang].exportTxt}</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile toolbar (< sm) ── */}
        <div className="flex lg:hidden items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
            style={{ background: T.addBtn, color: T.addBtnText }}>
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          {/* Mobile overflow menu */}
          <div className="relative">
            <button onClick={() => setShowMobileMenu(v => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
              style={{ background: showMobileMenu ? 'rgba(232,160,32,0.15)' : T.addBtn, color: showMobileMenu ? '#e8a020' : T.addBtnText, border: showMobileMenu ? '1px solid rgba(232,160,32,0.3)' : `1px solid ${T.border}` }}>
              <MoreHorizontal size={15} />
            </button>
            {showMobileMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-2xl overflow-hidden shadow-2xl z-50 py-2 w-52"
                style={{ background: theme === 'dark' ? '#161616' : '#fff', border: `1px solid ${T.border}` }}>
                <button onClick={() => { setShowTournage(true); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#f87171' }}>
                  <Clapperboard size={14} /> Tournage
                </button>
                <button onClick={() => { setPresenting(true); setPresentIdx(0); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#60a5fa' }}>
                  <Play size={14} /> {UI[lang].presenting}
                </button>
                <button onClick={() => { setPitchMode(true); setPresentIdx(0); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#f43f5e' }}>
                  <Film size={14} /> Pitch
                </button>
                <button onClick={() => { setShowChat(c => !c); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5 relative"
                  style={{ color: '#e8a020' }}>
                  <MessageCircle size={14} /> {UI[lang].chat}
                  <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: '#4ade80' }} />
                </button>
                <button onClick={() => { setShowBudget(true); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#22c55e' }}>
                  <DollarSign size={14} /> {UI[lang].budget}
                </button>
                <button onClick={() => { setShowMoodboard(true); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#a78bfa' }}>
                  <Palette size={14} /> Moodboard
                </button>
                <button onClick={() => { setShowMembers(true); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: '#e8a020' }}>
                  <Users size={14} /> Équipe
                </button>
                <div className="border-t my-1" style={{ borderColor: T.border }} />
                {/* Font preset */}
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: T.hintText }}>Typographie</p>
                  {(Object.entries(FONT_PRESETS) as [FontPreset, typeof FONT_PRESETS[FontPreset]][]).map(([key, p]) => (
                    <button key={key} onClick={() => { setPreset(key); setShowMobileMenu(false) }}
                      className="w-full text-left py-2 flex items-center gap-2"
                      style={{ color: fontPreset === key ? '#a78bfa' : T.hintBold }}>
                      {fontPreset === key && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#a78bfa' }} />}
                      <span className="text-xs font-semibold" style={{ fontFamily: p.dialogue }}>{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t my-1" style={{ borderColor: T.border }} />
                {/* Language */}
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: T.hintText }}>Langue</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(LANG_META) as Lang[]).map(l => (
                      <button key={l} onClick={() => { setLang(l); setShowMobileMenu(false) }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: l === lang ? 'rgba(232,160,32,0.15)' : T.addBtn, color: l === lang ? '#e8a020' : T.hintText, border: l === lang ? '1px solid rgba(232,160,32,0.3)' : `1px solid ${T.border}` }}>
                        {LANG_META[l].flag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t my-1" style={{ borderColor: T.border }} />
                {/* Stats */}
                <button onClick={() => { setShowStats(s => !s); setShowMobileMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5"
                  style={{ color: T.hintText }}>
                  <BarChart2 size={14} /> Stats · {pages} p.
                </button>
                {/* Export */}
                <div className="px-4 pt-1 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2 mt-1" style={{ color: T.hintText }}>Export</p>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { handleExportPDF(); setShowMobileMenu(false) }} className="text-left text-xs py-1.5" style={{ color: '#e8a020' }}>{UI[lang].exportPDF}</button>
                    <button onClick={() => { handleExportFountain(); setShowMobileMenu(false) }} className="text-left text-xs py-1.5" style={{ color: '#e8a020' }}>{UI[lang].exportFountain}</button>
                    <button onClick={() => { handleExportTxt(); setShowMobileMenu(false) }} className="text-left text-xs py-1.5" style={{ color: '#e8a020' }}>{UI[lang].exportTxt}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stats panel */}
      {showStats && (() => {
        const totalShots = scenes.reduce((t, s) => t + s.shots.length, 0)
        const filled = scenes.filter(s => s.blocks.some(b => b.text)).length
        const withImg = scenes.filter(s => s.imageUrls.length > 0).length
        const withNotes = scenes.filter(s => s.notes).length
        const chars = [...new Set(scenes.flatMap(s => s.blocks.filter(b => b.type === 'character').map(b => b.text)).filter(Boolean))]
        return (
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.cardHeader }}>
            {[
              { label: 'Séquences', val: scenes.length, color: '#e8a020' },
              { label: 'Pages · Minutes', val: `${pages} · ${pages}`, color: '#60a5fa' },
              { label: 'Plans découpés', val: totalShots, color: '#f97316' },
              { label: 'Personnages', val: chars.length, color: '#a78bfa' },
              { label: 'Scripts écrits', val: `${filled}/${scenes.length}`, color: '#e8a020' },
              { label: 'Storyboards', val: `${withImg}/${scenes.length}`, color: '#60a5fa' },
              { label: 'Notes réalisa.', val: `${withNotes}/${scenes.length}`, color: '#4ade80' },
              { label: 'Mots total', val: words, color: '#6b7280' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: T.card }}>
                <p className="text-lg font-black" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[10px] mt-0.5" style={{ color: T.hintText }}>{s.label}</p>
              </div>
            ))}
            {chars.length > 0 && (
              <div className="col-span-2 sm:col-span-4 rounded-xl p-3 text-left" style={{ background: T.card }}>
                <p className="text-[10px] mb-2" style={{ color: T.hintText }}>Personnages</p>
                <div className="flex flex-wrap gap-2">
                  {chars.map(c => <span key={c} className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(232,160,32,0.1)', color: '#e8a020' }}>{c}</span>)}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Hint bar — desktop only */}
      <div className="hidden sm:flex items-center gap-4 px-5 py-2 text-xs flex-wrap"
        style={{ borderBottom: `1px solid ${T.hint}`, color: T.hintText }}>
        <span><b style={{ color: T.hintBold }}>Enter</b> → bloc suivant</span>
        <span><b style={{ color: T.hintBold }}>Tab</b> → changer le type</span>
        <span>La <b style={{ color: '#e8a020' }}>flèche à droite</b> bascule entre 5 vues</span>
      </div>

      {/* Editor + Chat side by side */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8 pb-20 sm:pb-8">
        {scenes.map(scene => (
          <div key={scene.id}
            draggable
            onDragStart={() => handleDragStart(scene.id)}
            onDragOver={e => handleDragOver(e, scene.id)}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, scene.id)}
            style={{ opacity: dragOver === scene.id ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <SceneCard scene={scene} focusedBlockId={focusedBlockId} theme={theme} lang={lang} fontPreset={fontPreset}
              dragHandleProps={{ onMouseDown: e => e.currentTarget.closest('[draggable]')?.setAttribute('draggable','true') }}
              onHeadingChange={v => updateScene(scene.id, 'heading', v)}
              onBlockChange={(bid, v) => updateBlock(scene.id, bid, v)}
              onBlockType={(bid, t) => changeBlockType(scene.id, bid, t)}
              onBlockDelete={bid => deleteBlock(scene.id, bid)}
              onBlockAdd={bid => addBlock(scene.id, bid)}
              onBlockFocus={bid => setFocusedBlockId(bid)}
              onFaceChange={f => updateScene(scene.id, 'face', f)}
              onImagesChange={urls => updateScene(scene.id, 'imageUrls', urls)}
              onImagePositionsChange={pos => updateScene(scene.id, 'imagePositions', pos)}
              onCameraChange={(k, v) => updateScene(scene.id, 'camera', { ...scene.camera, [k]: v })}
              onLightingChange={(k, v) => updateScene(scene.id, 'lighting', { ...scene.lighting, [k]: v })}
              onSoundChange={(k, v) => updateSound(scene.id, k, v)}
              onShotChange={shots => updateShots(scene.id, shots)}
              onNotesChange={v => updateNotes(scene.id, v)}
              onDeleteScene={() => deleteScene(scene.id)}
              onDuplicateScene={() => duplicateScene(scene.id)}
              onAddComment={(target, targetId, text) => addComment(scene.id, target, targetId, text)}
              onFloorItemsChange={items => updateFloorItems(scene.id, items)}
              onHiddenFacesChange={faces => updateHiddenFaces(scene.id, faces)}
              onToggleDone={() => toggleShotDone(scene.id)}
              onPropsChange={props => updateProps(scene.id, props)}
              onBlocksBatchInsert={blocks => batchInsertBlocks(scene.id, blocks)}
            />
          </div>
        ))}
        <button onClick={addScene}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all text-sm font-semibold hover:opacity-70"
          style={{ border: `1px dashed ${T.border}`, color: T.addBtnText }}>
          <Plus size={14} /> {UI[lang].addScene}
        </button>
        </div>
        </div>

        {/* Chat panel — desktop sidebar */}
        {showChat && (
          <div className="flex-shrink-0 h-full sticky top-0 overflow-hidden hidden lg:flex"
            style={{ height: 'calc(100vh - 48px)' }}>
            <ChatPanel onClose={() => setShowChat(false)} theme={theme} />
          </div>
        )}
      </div>

      {/* ── Mode présentation ── */}
      {presenting && (() => {
        const presentableScenes = scenes.filter(s => !s.shotDone)
        const scene = presentableScenes[presentIdx] ?? presentableScenes[0] ?? scenes[0]
        const face = FACES[scene.face]
        const FaceIcon = face.icon
        const progress = ((presentIdx + 1) / presentableScenes.length) * 100
        return (
          <div className="fixed inset-0 z-50 flex flex-col"
            style={{ background: '#050505', color: '#f0ede8' }}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setPresentIdx(i => Math.min(i + 1, presentableScenes.length - 1))
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setPresentIdx(i => Math.max(i - 1, 0))
              if (e.key === 'Escape') setPresenting(false)
            }} tabIndex={0} autoFocus>
            {/* Progress bar */}
            <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: face.color }} />
            </div>
            {/* Top bar */}
            <div className="flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#e8a020' }}>
                  <Film size={13} className="text-black" />
                </div>
                <span className="font-black">{title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{presentIdx + 1} / {presentableScenes.length}</span>
                <button onClick={() => setSwMode(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-90 font-bold"
                  style={{ background: 'rgba(255,232,31,0.1)', color: '#FFE81F', border: '1px solid rgba(255,232,31,0.25)' }}
                  title="Star Wars Mode">
                  ✦ SW
                </button>
                <button onClick={() => setPresenting(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-12 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-6">
                <FaceIcon size={16} style={{ color: face.color }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: face.color }}>{face.label}</span>
              </div>
              <h2 className="text-3xl font-black text-center mb-8 font-mono" style={{ color: '#e8a020' }}>
                {scene.heading || 'INT. — JOUR'}
              </h2>
              {scene.face === 0 && (
                <div className="w-full max-w-2xl space-y-3 text-center">
                  {scene.blocks.filter(b => b.text).slice(0, 6).map(b => {
                    const cfg = BLOCK_CONFIG[b.type]
                    return (
                      <p key={b.id} className="text-base leading-7 font-mono"
                        style={{ ...cfg.style, color: b.type === 'character' ? '#e8a020' : '#c8c4be', fontSize: b.type === 'character' ? '0.85rem' : '1rem' }}>
                        {b.text}
                      </p>
                    )
                  })}
                </div>
              )}
              {scene.face === 1 && scene.imageUrls.length > 0 && (
                <div className="flex gap-3 overflow-x-auto max-w-full pb-1">
                  {scene.imageUrls.map((url, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={idx} src={getCachedUrl(url) ?? url} alt={`storyboard ${idx + 1}`}
                      className="flex-shrink-0 max-h-80 rounded-2xl object-contain"
                      style={{ maxWidth: scene.imageUrls.length === 1 ? '100%' : '320px', objectPosition: `${scene.imagePositions?.[idx]?.x ?? 50}% ${scene.imagePositions?.[idx]?.y ?? 50}%` }} />
                  ))}
                </div>
              )}
              {scene.face === 1 && scene.imageUrls.length === 0 && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Pas d&apos;image pour cette séquence</p>
              )}
              {scene.face === 4 && scene.notes && (
                <p className="text-base leading-7 font-mono max-w-2xl text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>{scene.notes}</p>
              )}
            </div>
            {/* Nav */}
            <div className="flex items-center justify-center gap-6 pb-8">
              <button onClick={() => setPresentIdx(i => Math.max(i - 1, 0))}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl transition-all hover:opacity-70 disabled:opacity-20"
                style={{ background: 'rgba(255,255,255,0.07)' }} disabled={presentIdx === 0}>
                <ChevronLeft size={18} /><span className="hidden sm:inline">Précédent</span>
              </button>
              <div className="flex gap-1.5">
                {presentableScenes.map((_, i) => (
                  <button key={i} onClick={() => setPresentIdx(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ background: i === presentIdx ? face.color : 'rgba(255,255,255,0.2)', transform: i === presentIdx ? 'scale(1.3)' : 'scale(1)' }} />
                ))}
              </div>
              <button onClick={() => presentIdx === presentableScenes.length - 1 ? setPresenting(false) : setPresentIdx(i => i + 1)}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl transition-all hover:opacity-70"
                style={{ background: presentIdx === presentableScenes.length - 1 ? 'rgba(232,160,32,0.15)' : 'rgba(255,255,255,0.07)', color: presentIdx === presentableScenes.length - 1 ? '#e8a020' : '#f0ede8' }}>
                <span className="hidden sm:inline">{presentIdx === presentableScenes.length - 1 ? 'Terminer' : 'Suivant'}</span><span className="sm:hidden">{presentIdx === presentableScenes.length - 1 ? 'Fin' : ''}</span> <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Pitch mode ── */}
      {pitchMode && (() => {
        const scene = scenes[presentIdx]
        const progress = ((presentIdx + 1) / scenes.length) * 100
        const hasImages = scene.imageUrls.length > 0
        const scriptBlocks = scene.blocks.filter(b => b.text.trim())
        const isFirst = presentIdx === 0
        const isLast = presentIdx === scenes.length - 1

        return (
          <div className="fixed inset-0 z-50 flex flex-col"
            style={{ background: '#04040a', color: '#f0ede8' }}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setPresentIdx(i => Math.min(i + 1, scenes.length - 1))
              if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   setPresentIdx(i => Math.max(i - 1, 0))
              if (e.key === 'Escape') setPitchMode(false)
            }} tabIndex={0} autoFocus>

            {/* Progress bar */}
            <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #f43f5e, #e8a020)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-8 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#e8a020' }}>
                  <Film size={11} className="text-black" />
                </div>
                <span className="font-black text-sm tracking-wide">{title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}>
                  PITCH
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {presentIdx + 1} / {scenes.length}
                </span>
                <button onClick={() => setPitchMode(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">

              {/* LEFT — Storyboard */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 min-w-0 border-b lg:border-b-0 lg:border-r"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {hasImages ? (
                  <div className="w-full max-w-xl space-y-3">
                    {scene.imageUrls.slice(0, 2).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={getCachedUrl(url) ?? url} alt=""
                        className="w-full rounded-2xl object-cover"
                        style={{ maxHeight: scene.imageUrls.length === 1 ? '65vh' : '30vh', border: '1px solid rgba(255,255,255,0.08)', objectPosition: `${scene.imagePositions?.[i]?.x ?? 50}% ${scene.imagePositions?.[i]?.y ?? 50}%` }} />
                    ))}
                    {scene.imageUrls.length > 2 && (
                      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        +{scene.imageUrls.length - 2} image{scene.imageUrls.length - 2 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <ImageIcon size={40} />
                    <p className="text-xs">Pas de storyboard</p>
                  </div>
                )}
              </div>

              {/* RIGHT — Script */}
              <div className="flex-1 flex flex-col justify-center p-4 lg:p-8 overflow-y-auto min-w-0">
                {/* Scene heading */}
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2"
                  style={{ color: 'rgba(244,63,94,0.7)' }}>
                  Séquence {presentIdx + 1}
                </p>
                <h2 className="text-2xl font-black mb-6 font-mono leading-tight"
                  style={{ color: '#e8a020' }}>
                  {scene.heading || 'INT. — JOUR'}
                </h2>

                {/* Notes (réalisateur) */}
                {scene.notes && (
                  <p className="text-xs italic mb-5 leading-5"
                    style={{ color: 'rgba(255,255,255,0.35)', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 12 }}>
                    {scene.notes}
                  </p>
                )}

                {/* Script blocks */}
                {scriptBlocks.length > 0 ? (
                  <div className="space-y-2">
                    {scriptBlocks.slice(0, 8).map(b => {
                      const cfg = BLOCK_CONFIG[b.type]
                      return (
                        <p key={b.id} className="text-sm leading-6 font-mono"
                          style={{
                            color: b.type === 'character' ? '#e8a020'
                              : b.type === 'transition' ? 'rgba(255,255,255,0.25)'
                              : b.type === 'dialogue' ? 'rgba(255,255,255,0.75)'
                              : 'rgba(255,255,255,0.55)',
                            fontWeight: b.type === 'character' ? 700 : 400,
                            fontStyle: b.type === 'dialogue' || b.type === 'parenthetical' ? 'italic' : 'normal',
                            textAlign: (cfg.style.textAlign as React.CSSProperties['textAlign']) ?? 'left',
                            paddingLeft: b.type === 'dialogue' || b.type === 'parenthetical' ? '1.5rem' : 0,
                            textTransform: b.type === 'character' || b.type === 'transition' ? 'uppercase' : 'none',
                            fontSize: b.type === 'transition' ? '0.7rem' : '0.85rem',
                          }}>
                          {b.text}
                        </p>
                      )
                    })}
                    {scriptBlocks.length > 8 && (
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        +{scriptBlocks.length - 8} lignes…
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>Pas de script pour cette séquence</p>
                )}

                {/* Découpage summary if exists */}
                {scene.shots.length > 0 && (
                  <div className="mt-5 pt-4 flex flex-wrap gap-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {scene.shots.slice(0, 4).map((shot, i) => (
                      <span key={shot.id} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                        P{i+1} {shot.type || '—'}
                      </span>
                    ))}
                    {scene.shots.length > 4 && (
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>+{scene.shots.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setPresentIdx(i => Math.max(i - 1, 0))}
                disabled={isFirst}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all hover:opacity-70 disabled:opacity-20 text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <ChevronLeft size={16} /> Précédent
              </button>

              {/* Dots */}
              <div className="flex gap-1.5">
                {scenes.map((_, i) => (
                  <button key={i} onClick={() => setPresentIdx(i)}
                    className="rounded-full transition-all"
                    style={{ width: i === presentIdx ? 20 : 6, height: 6, background: i === presentIdx ? '#f43f5e' : 'rgba(255,255,255,0.18)' }} />
                ))}
              </div>

              <button onClick={() => isLast ? setPitchMode(false) : setPresentIdx(i => i + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all hover:opacity-70 text-sm font-bold"
                style={{ background: isLast ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)', color: isLast ? '#f43f5e' : '#f0ede8' }}>
                {isLast ? 'Terminer' : 'Suivant'} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Star Wars crawl ── */}
      {presenting && swMode && (() => {
        const crawlText = scenes.map(s => {
          const lines: string[] = []
          if (s.heading) lines.push(s.heading)
          s.blocks.filter(b => b.text.trim()).forEach(b => {
            if (b.type === 'character') lines.push(`— ${b.text} —`)
            else if (b.type === 'transition') lines.push(`[ ${b.text} ]`)
            else lines.push(b.text)
          })
          return lines.join('\n')
        }).join('\n\n· · ·\n\n')

        // Slow readable speed: ~8 chars/s
        const duration = Math.max(60, Math.min(240, Math.round(crawlText.length / 8)))

        return (
          <div className="fixed inset-0 z-[51] flex flex-col overflow-hidden"
            style={{ background: '#000' }}
            onKeyDown={e => { if (e.key === 'Escape') setSwMode(false) }}
            tabIndex={0} autoFocus>

            <style>{`
              @keyframes sw-crawl {
                0%   { transform: rotateX(10deg) translateY(100vh); }
                100% { transform: rotateX(10deg) translateY(-220%); }
              }
              .sw-crawl-text {
                animation: sw-crawl ${duration}s linear forwards;
                transform-origin: 50% 100%;
              }
            `}</style>

            {/* Top bar — only close button */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-10"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
              <span className="font-black tracking-widest text-sm" style={{ color: '#FFE81F', letterSpacing: '0.25em' }}>
                ✦ {title.toUpperCase()}
              </span>
              <button onClick={() => setSwMode(false)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:opacity-80"
                style={{ background: 'rgba(255,232,31,0.1)', color: '#FFE81F', border: '1px solid rgba(255,232,31,0.2)' }}>
                ← Classique
              </button>
            </div>

            {/* Perspective viewport */}
            <div className="flex-1 flex items-end justify-center overflow-hidden"
              style={{ perspective: '400px', perspectiveOrigin: '50% 85%' }}>
              <div className="sw-crawl-text w-full max-w-2xl px-8 pb-8">
                {/* Title card */}
                <div className="text-center mb-16">
                  <p className="text-xs font-bold tracking-[0.4em] mb-6" style={{ color: 'rgba(255,232,31,0.5)' }}>
                    UNE PRODUCTION TIANY
                  </p>
                  <h1 className="text-4xl font-black tracking-widest leading-tight"
                    style={{ color: '#FFE81F', fontFamily: 'serif', textShadow: '0 0 40px rgba(255,232,31,0.4)' }}>
                    {title.toUpperCase()}
                  </h1>
                </div>

                {/* Scenes */}
                {scenes.map((s, idx) => (
                  <div key={s.id} className="mb-12 text-center">
                    {s.heading && (
                      <p className="text-base font-black tracking-[0.2em] mb-4 uppercase"
                        style={{ color: '#FFE81F', opacity: 0.9 }}>
                        {s.heading}
                      </p>
                    )}
                    {/* Storyboard images — shown as small centered thumbnails */}
                    {s.imageUrls.length > 0 && (
                      <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        {s.imageUrls.slice(0, 3).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={getCachedUrl(url) ?? url} alt=""
                            className="rounded-lg object-cover"
                            style={{ width: s.imageUrls.length === 1 ? 320 : 180, height: s.imageUrls.length === 1 ? 180 : 100, opacity: 0.75, border: '1px solid rgba(255,232,31,0.2)', objectPosition: `${s.imagePositions?.[i]?.x ?? 50}% ${s.imagePositions?.[i]?.y ?? 50}%` }} />
                        ))}
                      </div>
                    )}
                    {s.blocks.filter(b => b.text.trim()).map(b => (
                      <p key={b.id} className="text-base leading-8 mb-2"
                        style={{
                          color: b.type === 'character' ? '#FFE81F' : b.type === 'transition' ? 'rgba(255,232,31,0.45)' : 'rgba(255,232,31,0.82)',
                          fontFamily: 'serif',
                          fontWeight: b.type === 'character' ? 700 : 400,
                          letterSpacing: b.type === 'character' ? '0.18em' : '0.04em',
                          fontStyle: b.type === 'dialogue' || b.type === 'parenthetical' ? 'italic' : 'normal',
                          fontSize: b.type === 'transition' ? '0.8rem' : b.type === 'character' ? '0.9rem' : '1rem',
                          textTransform: b.type === 'character' || b.type === 'transition' ? 'uppercase' : 'none',
                        }}>
                        {b.text}
                      </p>
                    ))}
                    {/* If scene has only images and no text */}
                    {s.imageUrls.length > 0 && s.blocks.every(b => !b.text.trim()) && (
                      <p className="text-xs tracking-[0.3em] mt-2" style={{ color: 'rgba(255,232,31,0.3)' }}>
                        [ SÉQUENCE VISUELLE ]
                      </p>
                    )}
                    {idx < scenes.length - 1 && (
                      <p className="mt-8 mb-0 text-xs tracking-[0.5em]" style={{ color: 'rgba(255,232,31,0.2)' }}>· · ·</p>
                    )}
                  </div>
                ))}

                {/* End card */}
                <div className="text-center mt-16 mb-32">
                  <p className="text-2xl font-black tracking-[0.4em]"
                    style={{ color: '#FFE81F', fontFamily: 'serif', opacity: 0.6 }}>
                    FIN
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom vignette */}
            <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{ background: 'linear-gradient(0deg, #000 0%, transparent 100%)' }} />
          </div>
        )
      })()}

      {/* ── Chat mobile (à la racine pour éviter le clipping overflow-hidden) ── */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          <ChatPanel onClose={() => setShowChat(false)} theme={theme} mobile />
        </div>
      )}

      {/* ── Budget panel ── */}
      {showBudget && <BudgetPanel key={budgetToken} projectId={projectId} scenes={scenes} theme={theme} onClose={() => setShowBudget(false)} onSceneTimeChange={updateSceneTime} />}
      {showMembers && (
        <MembersPanel
          projectId={projectId}
          currentUserId={currentUser?.id ?? localStorage.getItem('tiany_user_id') ?? ''}
          isOwner={!memberRole || memberRole === 'owner'}
          theme={theme}
          onClose={() => setShowMembers(false)}
        />
      )}
      {showMoodboard && (
        <MoodboardPanel
          projectId={projectId}
          theme={theme}
          onClose={() => setShowMoodboard(false)}
        />
      )}

      {/* ── Keyboard shortcuts panel ── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowShortcuts(false)}>
          <div className="rounded-2xl overflow-hidden w-full max-w-md shadow-2xl" style={{ background: theme === 'dark' ? '#111' : '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="font-black text-base" style={{ color: T.fg }}>Raccourcis clavier</h2>
                <p className="text-xs mt-0.5" style={{ color: T.hintText }}>Dans l'éditeur de script</p>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: T.hintText }}><X size={14} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['Enter', 'Nouveau bloc'],
                ['Tab', 'Changer le type'],
                ['Backspace', 'Supprimer (si vide)'],
                ['Shift+Enter', 'Saut de ligne'],
                ['?', 'Raccourcis'],
                ['Ctrl+Z', 'Annuler'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <kbd className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)', color: T.hintBold, border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>{key}</kbd>
                  <span className="text-xs" style={{ color: T.hintText }}>{desc}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px]" style={{ color: T.hintText }}>Dans le chat : <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.07)' }}>@</kbd> pour mentionner un membre</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation slider ── */}
      {confirmDeleteId && (() => {
        const scene = scenes.find(s => s.id === confirmDeleteId)
        return (
          <DeleteSlider
            label={scene?.heading || 'Sans titre'}
            theme={theme}
            onConfirm={() => confirmDelete(confirmDeleteId)}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )
      })()}

      {/* ── First run onboarding ── */}
      {showOnboarding && (
        <FirstRunModal theme={theme} onClose={() => {
          localStorage.setItem('tiany_onboarded', '1')
          setShowOnboarding(false)
        }} />
      )}

      {/* Tournage Panel */}
      {showTournage && (
        <TournagePanel
          scenes={scenes}
          shootingOrder={shootingOrder}
          shootingEntries={shootingEntries}
          onShootingOrderChange={handleShootingOrderChange}
          onEntriesChange={handleEntriesChange}
          onPropsChange={updateProps}
          onToggleDone={toggleShotDone}
          theme={theme}
          lang={lang}
          onClose={() => setShowTournage(false)}
          onStartShootingMode={() => { setShowTournage(false); setShowShootingMode(true) }}
        />
      )}

      {/* Shooting Mode Overlay */}
      {showShootingMode && (
        <ShootingModeOverlay
          scenes={scenes}
          shootingOrder={shootingOrder}
          burnRate={burnRate}
          onBurnRateChange={setBurnRate}
          onToggleDone={toggleShotDone}
          theme={theme}
          onClose={() => setShowShootingMode(false)}
        />
      )}
    </div>
  )
}
