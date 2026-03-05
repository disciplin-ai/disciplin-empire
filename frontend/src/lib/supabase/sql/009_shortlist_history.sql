create table if not exists public.gym_shortlist_runs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  city text,
  country text,

  user_profile jsonb default '{}'::jsonb,
  constraints jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create table if not exists public.gym_shortlist_results (
  run_id uuid references public.gym_shortlist_runs(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,

  match_score numeric(4,3),
  reason text,

  primary key (run_id, gym_id)
);