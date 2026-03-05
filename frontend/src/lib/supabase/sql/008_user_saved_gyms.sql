create table if not exists public.user_saved_gyms (
  user_id uuid not null,
  gym_id uuid references public.gyms(id) on delete cascade,

  saved_at timestamptz default now(),
  note text,

  primary key (user_id, gym_id)
);