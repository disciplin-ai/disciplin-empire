create table if not exists public.gym_ratings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,

  rating_avg numeric(3,2),
  rating_count int,
  source text,

  updated_at timestamptz default now()
);