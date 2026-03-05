-- 013_gym_shortlists.sql
-- Purpose:
-- - Save “shortlist runs” + ranked results per user
-- - Power a real premium feature: style-based gym recommendations
-- - Keep it v1-light but extensible

create extension if not exists "pgcrypto";

-- =========================
-- 1) Shortlist runs (one run = one recommendation request)
-- =========================
create table if not exists public.gym_shortlists (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  -- Context used to generate shortlist
  city text not null,
  country text not null,
  user_style text,                 -- e.g. "pressure wrestler", "counter striker"
  goals text,                      -- e.g. "wrestling offense + cage work"
  constraints text,                -- e.g. "no gi, evenings only"
  radius_km integer,               -- optional

  -- Optional hooks: connect this shortlist to Sensei / Vision later
  sensei_followups_id text,        -- if your Sensei plan route returns this
  senseivision_followups_id text,  -- if your Vision route returns this

  -- Meta
  created_at timestamptz not null default now()
);

create index if not exists gym_shortlists_user_idx
  on public.gym_shortlists (user_id, created_at desc);

create index if not exists gym_shortlists_city_country_idx
  on public.gym_shortlists (lower(city), lower(country), created_at desc);

-- =========================
-- 2) Ranked results (each row = one gym in the shortlist)
-- =========================
create table if not exists public.gym_shortlist_items (
  id uuid primary key default gen_random_uuid(),

  shortlist_id uuid not null references public.gym_shortlists(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,

  rank integer not null,                        -- 1 = best
  match_score numeric(5,2) not null,            -- 0.00–100.00
  fit_summary text not null,                    -- short punchy explanation
  fit_reasons text[] not null default '{}'::text[], -- bullets: why it matches
  caution_flags text[] not null default '{}'::text[], -- bullets: risks / not ideal

  -- What the system thinks the gym is best for (optional labels)
  best_for text[] not null default '{}'::text[], -- e.g. ["pressure", "wall wrestling"]

  created_at timestamptz not null default now(),

  -- Prevent duplicates in a single shortlist
  unique (shortlist_id, gym_id),
  -- Ensure rank is unique per shortlist (no two #1s)
  unique (shortlist_id, rank)
);

create index if not exists gym_shortlist_items_shortlist_idx
  on public.gym_shortlist_items (shortlist_id, rank asc);

create index if not exists gym_shortlist_items_gym_idx
  on public.gym_shortlist_items (gym_id);

-- =========================
-- 3) Selected gym (optional, but makes the product feel “real”)
-- =========================
alter table public.gym_shortlists
  add column if not exists selected_gym_id uuid references public.gyms(id) on delete set null;

alter table public.gym_shortlists
  add column if not exists selection_notes text;

-- =========================
-- 4) RLS
-- =========================
alter table public.gym_shortlists enable row level security;
alter table public.gym_shortlist_items enable row level security;

-- Users can read their own shortlists
drop policy if exists "gym_shortlists_select_own" on public.gym_shortlists;
create policy "gym_shortlists_select_own"
on public.gym_shortlists
for select
using (auth.uid() = user_id);

-- Users can create their own shortlists
drop policy if exists "gym_shortlists_insert_own" on public.gym_shortlists;
create policy "gym_shortlists_insert_own"
on public.gym_shortlists
for insert
with check (auth.uid() = user_id);

-- Users can update their own shortlists (e.g., selected_gym_id)
drop policy if exists "gym_shortlists_update_own" on public.gym_shortlists;
create policy "gym_shortlists_update_own"
on public.gym_shortlists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Users can delete their own shortlists
drop policy if exists "gym_shortlists_delete_own" on public.gym_shortlists;
create policy "gym_shortlists_delete_own"
on public.gym_shortlists
for delete
using (auth.uid() = user_id);

-- Items: only accessible through a shortlist the user owns
drop policy if exists "gym_shortlist_items_select_own" on public.gym_shortlist_items;
create policy "gym_shortlist_items_select_own"
on public.gym_shortlist_items
for select
using (
  exists (
    select 1
    from public.gym_shortlists s
    where s.id = gym_shortlist_items.shortlist_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "gym_shortlist_items_insert_own" on public.gym_shortlist_items;
create policy "gym_shortlist_items_insert_own"
on public.gym_shortlist_items
for insert
with check (
  exists (
    select 1
    from public.gym_shortlists s
    where s.id = gym_shortlist_items.shortlist_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "gym_shortlist_items_update_own" on public.gym_shortlist_items;
create policy "gym_shortlist_items_update_own"
on public.gym_shortlist_items
for update
using (
  exists (
    select 1
    from public.gym_shortlists s
    where s.id = gym_shortlist_items.shortlist_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.gym_shortlists s
    where s.id = gym_shortlist_items.shortlist_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "gym_shortlist_items_delete_own" on public.gym_shortlist_items;
create policy "gym_shortlist_items_delete_own"
on public.gym_shortlist_items
for delete
using (
  exists (
    select 1
    from public.gym_shortlists s
    where s.id = gym_shortlist_items.shortlist_id
      and s.user_id = auth.uid()
  )
);