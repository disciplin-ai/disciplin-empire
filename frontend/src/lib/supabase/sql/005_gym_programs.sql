create table if not exists public.gym_programs (
  id uuid primary key default gen_random_uuid(),

  gym_id uuid references public.gyms(id) on delete cascade,

  program_type text not null,
  level_label text,
  frequency_per_week int,

  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);