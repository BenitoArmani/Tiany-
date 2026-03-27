-- ============================================================
-- TIANY — Schéma Supabase
-- Coller dans : Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extension pour gen_random_bytes (tokens d'invitation)
create extension if not exists "pgcrypto";

-- ── Users ────────────────────────────────────────────────────
create table if not exists public.tiany_users (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null,
  email       text    unique not null,
  created_at  timestamptz default now()
);

-- ── Projects ─────────────────────────────────────────────────
create table if not exists public.tiany_projects (
  id          text    primary key,
  title       text    not null,
  owner_id    uuid    references public.tiany_users(id),
  data        jsonb   default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Members ──────────────────────────────────────────────────
create table if not exists public.tiany_members (
  id          uuid    primary key default gen_random_uuid(),
  project_id  text    references public.tiany_projects(id) on delete cascade,
  user_id     uuid    references public.tiany_users(id) on delete cascade,
  role        text    not null default 'assistant',
  joined_at   timestamptz default now(),
  unique(project_id, user_id)
);

-- ── Comments ─────────────────────────────────────────────────
create table if not exists public.tiany_comments (
  id          uuid    primary key default gen_random_uuid(),
  project_id  text    references public.tiany_projects(id) on delete cascade,
  scene_id    text    not null,
  target      text    not null,   -- 'block' | 'image' | 'shot' | 'scene'
  target_id   text    not null,
  author_id   uuid    references public.tiany_users(id),
  author_name text    not null,
  text        text    not null,
  created_at  timestamptz default now()
);

-- ── Invitations ───────────────────────────────────────────────
create table if not exists public.tiany_invitations (
  id          uuid    primary key default gen_random_uuid(),
  project_id  text    references public.tiany_projects(id) on delete cascade,
  role        text    not null default 'assistant',
  token       text    unique not null default encode(gen_random_bytes(16), 'hex'),
  created_by  uuid    references public.tiany_users(id),
  used_by     uuid    references public.tiany_users(id),
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

-- ── Row Level Security (permissif pour MVP) ───────────────────
alter table public.tiany_users       enable row level security;
alter table public.tiany_projects    enable row level security;
alter table public.tiany_members     enable row level security;
alter table public.tiany_comments    enable row level security;
alter table public.tiany_invitations enable row level security;

-- Policies : tout autoriser via la clé anon (accès contrôlé côté app)
create policy "public_all" on public.tiany_users       for all using (true) with check (true);
create policy "public_all" on public.tiany_projects    for all using (true) with check (true);
create policy "public_all" on public.tiany_members     for all using (true) with check (true);
create policy "public_all" on public.tiany_comments    for all using (true) with check (true);
create policy "public_all" on public.tiany_invitations for all using (true) with check (true);

-- ── Realtime (commentaires en temps réel) ────────────────────
alter publication supabase_realtime add table public.tiany_comments;

-- ── Index pour performances ───────────────────────────────────
create index if not exists idx_members_project    on public.tiany_members(project_id);
create index if not exists idx_members_user       on public.tiany_members(user_id);
create index if not exists idx_comments_project   on public.tiany_comments(project_id);
create index if not exists idx_comments_scene     on public.tiany_comments(project_id, scene_id);
create index if not exists idx_invitations_token  on public.tiany_invitations(token);
create index if not exists idx_invitations_project on public.tiany_invitations(project_id);
