-- Gym sessions = your real camp log.
-- This is how "Gym shortlist" becomes a feedback loop:
-- gym -> session -> notes -> SenseiVision -> updated gym fit.

create table if not exists public.gym_sessions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id  uuid not null references public.gyms(id) on delete cascade,

  -- When
  session_date date not null default (now()::date),
  session_time text, -- "AM", "PM", "18:00", optional

  -- What happened
  sport text not null default 'MMA',          -- MMA / Wrestling / Boxing / BJJ / Muay Thai / Strength
  intensity text not null default 'Standard', -- Easy / Standard / Hard
  rounds int,
  minutes int,

  -- Why you went / what you were trying to fix
  goal text,               -- "pressure chain wrestling under fatigue"
  focus_tag text,          -- "Pressure" | "Speed" | "Power" | "Recovery" | "Mixed" (free text OK)
  constraints text,        -- "no partner", "bag only", "knee sensitive"

  -- Fighter outcomes (what you felt, simple but powerful)
  rpe int check (rpe between 1 and 10),               -- effort
  performance_score int check (performance_score between 0 and 10), -- how well it went
  fatigue_score int check (fatigue_score between 0 and 10),
  soreness_score int check (soreness_score between 0 and 10),
  injury_flag boolean not null default false,

  -- The money fields
  what_went_right text,
  what_went_wrong text,
  primary_failure text,   -- single sentence: "shots died after first contact"
  one_fix_applied text,   -- single sentence: "head position + reshoot angle"
  drills_run text,        -- quick list / short text

  -- Optional: connect a SenseiVision analysis to the session
  sensei_vision_id uuid,  -- reference later if you have a table for analyses

  created_at timestamptz not null default now()
);

create index if not exists gym_sessions_user_idx on public.gym_sessions(user_id, session_date desc);
create index if not exists gym_sessions_gym_idx  on public.gym_sessions(gym_id, session_date desc);

-- Basic RLS (owner-only)
alter table public.gym_sessions enable row level security;

drop policy if exists "gym_sessions_select_own" on public.gym_sessions;
create policy "gym_sessions_select_own"
on public.gym_sessions for select
using (auth.uid() = user_id);

drop policy if exists "gym_sessions_insert_own" on public.gym_sessions;
create policy "gym_sessions_insert_own"
on public.gym_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "gym_sessions_update_own" on public.gym_sessions;
create policy "gym_sessions_update_own"
on public.gym_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "gym_sessions_delete_own" on public.gym_sessions;
create policy "gym_sessions_delete_own"
on public.gym_sessions for delete
using (auth.uid() = user_id);