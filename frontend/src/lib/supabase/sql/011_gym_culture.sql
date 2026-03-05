-- Gym "culture" = what the room is actually like
-- This is the table that makes recommendations feel REAL for fighters.

create table if not exists public.gym_culture (
  gym_id uuid primary key references public.gyms(id) on delete cascade,

  -- How the room feels (0–10)
  hard_rounds_score int check (hard_rounds_score between 0 and 10),
  technical_coaching_score int check (technical_coaching_score between 0 and 10),
  beginner_friendliness_score int check (beginner_friendliness_score between 0 and 10),
  injury_risk_score int check (injury_risk_score between 0 and 10),

  -- Who you’ll actually see there
  competitor_presence_score int check (competitor_presence_score between 0 and 10),
  pro_presence_score int check (pro_presence_score between 0 and 10),

  -- Sparring style
  sparring_frequency_per_week int,
  sparring_intensity_label text,     -- "Light", "Mixed", "Hard"
  sparring_control_label text,       -- "Controlled", "Wild", "Depends"

  -- Grappling / striking culture
  wrestling_quality_score int check (wrestling_quality_score between 0 and 10),
  bjj_quality_score int check (bjj_quality_score between 0 and 10),
  striking_quality_score int check (striking_quality_score between 0 and 10),

  -- Notes you show the user (short, sharp)
  culture_notes text,
  watch_out text,

  updated_at timestamptz not null default now()
);

-- Helpful index if you later filter by intensity label
create index if not exists gym_culture_sparring_intensity_idx
on public.gym_culture (lower(sparring_intensity_label));