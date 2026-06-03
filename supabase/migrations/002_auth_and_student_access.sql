-- ============================================================================
-- INVOk – auth & pseudonymous student access (002)
--
-- Teachers/admins authenticate via Supabase Auth (auth.users + profiles, 001).
-- Students DO NOT use email. They join a class with a code + pseudonym and get
-- an opaque session token. Codes/tokens are stored ONLY as hashes; plaintext is
-- never persisted, and hashes are never exposed through the public student API.
-- ============================================================================

-- Teacher-issued, class-wide join code.
create table if not exists public.class_join_codes (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz,
  max_uses   integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_class_join_codes_hash on public.class_join_codes (code_hash);
create index if not exists idx_class_join_codes_class on public.class_join_codes (class_id);

-- Per-student pseudonymous identity within a class (no email, no real name).
create table if not exists public.student_access_codes (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes (id) on delete cascade,
  pseudonym    text not null,
  code_hash    text not null,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists idx_student_access_codes_hash on public.student_access_codes (code_hash);
create index if not exists idx_student_access_codes_class on public.student_access_codes (class_id);

-- Opaque bearer session for a pseudonymous student. Only the hash is stored.
create table if not exists public.student_sessions (
  id                     uuid primary key default gen_random_uuid(),
  student_access_code_id uuid not null references public.student_access_codes (id) on delete cascade,
  session_token_hash     text not null,
  expires_at             timestamptz not null,
  created_at             timestamptz not null default now()
);
create unique index if not exists idx_student_sessions_token on public.student_sessions (session_token_hash);
create index if not exists idx_student_sessions_access on public.student_sessions (student_access_code_id);

-- Helper: caller manages the class (its teacher OR an admin of its school).
create or replace function public.manages_class(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_memberships m
    where m.class_id = p_class and m.user_id = auth.uid() and m.role = 'teacher'
  ) or exists (
    select 1
    from public.classes c
    join public.school_memberships sm on sm.school_id = c.school_id
    where c.id = p_class and sm.user_id = auth.uid() and sm.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.class_join_codes     enable row level security;
alter table public.student_access_codes enable row level security;
alter table public.student_sessions     enable row level security;

-- Only class managers (teacher/admin) may manage codes for their class.
-- Note: reading rows exposes only the HASH, never plaintext; the public student
-- join API (service role) never returns hashes to clients.
create policy "class_join_codes_manage" on public.class_join_codes
  for all to authenticated
  using (public.manages_class(class_id))
  with check (public.manages_class(class_id));

create policy "student_access_codes_manage" on public.student_access_codes
  for all to authenticated
  using (public.manages_class(class_id))
  with check (public.manages_class(class_id));

-- student_sessions: RLS enabled, NO policies -> denied to anon/authenticated.
-- Sessions are created/validated ONLY server-side via the service role, which
-- bypasses RLS. This keeps session token hashes unreachable from the client.
