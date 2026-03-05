create table if not exists public.gym_coaches (
  id uuid primary key default gen_random_uuid(),

  gym_id uuid references public.gyms(id) on delete cascade,

  name text not null,
  role text,
  specialties text[],
  credentials text,
  profile_url text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);