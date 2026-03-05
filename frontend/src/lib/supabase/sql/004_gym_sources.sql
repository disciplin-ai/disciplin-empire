create table if not exists public.gym_sources (
  id uuid primary key default gen_random_uuid(),

  gym_id uuid references public.gyms(id) on delete cascade,

  source_type text not null,
  source_url text,
  external_id text,

  payload jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index if not exists gym_sources_gym_idx
on public.gym_sources(gym_id);