export type CinemaRole =
  | 'owner'
  | 'réalisateur'
  | 'producteur'
  | 'dop'
  | 'chef op son'
  | 'scripte'
  | 'monteur'
  | 'décorateur'
  | 'costumier'
  | 'régisseur'
  | 'acteur'
  | 'assistant'
  | 'stagiaire'

export const CINEMA_ROLES: CinemaRole[] = [
  'owner', 'réalisateur', 'producteur', 'dop', 'chef op son',
  'scripte', 'monteur', 'décorateur', 'costumier', 'régisseur',
  'acteur', 'assistant', 'stagiaire',
]

export const ROLE_COLORS: Record<CinemaRole, string> = {
  owner:        '#e8a020',
  réalisateur:  '#f43f5e',
  producteur:   '#a78bfa',
  dop:          '#60a5fa',
  'chef op son':'#34d399',
  scripte:      '#fbbf24',
  monteur:      '#f97316',
  décorateur:   '#4ade80',
  costumier:    '#e879f9',
  régisseur:    '#94a3b8',
  acteur:       '#fb923c',
  assistant:    '#6b7280',
  stagiaire:    '#475569',
}

export const ROLE_LABELS: Record<CinemaRole, string> = {
  owner:        'Chef de projet',
  réalisateur:  'Réalisateur',
  producteur:   'Producteur',
  dop:          'DOP / Chef op image',
  'chef op son':'Chef op son',
  scripte:      'Scripte',
  monteur:      'Monteur',
  décorateur:   'Décorateur',
  costumier:    'Costumier',
  régisseur:    'Régisseur',
  acteur:       'Acteur',
  assistant:    'Assistant',
  stagiaire:    'Stagiaire',
}

export interface TianyUser {
  id: string
  name: string
  email: string
  created_at: string
}

export interface TianyProject {
  id: string
  title: string
  owner_id: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TianyMember {
  id: string
  project_id: string
  user_id: string
  role: CinemaRole
  joined_at: string
  user?: TianyUser
}

export interface TianyComment {
  id: string
  project_id: string
  scene_id: string
  target: 'block' | 'image' | 'shot' | 'scene'
  target_id: string
  author_id: string
  author_name: string
  text: string
  created_at: string
}

export interface TianyInvitation {
  id: string
  project_id: string
  role: CinemaRole
  token: string
  created_by: string
  used_by: string | null
  expires_at: string
  created_at: string
}
