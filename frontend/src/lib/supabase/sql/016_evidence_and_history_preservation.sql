-- 016 — Durable evidence.
--
-- Vision evidence lived in the athlete's browser. Clearing storage, changing
-- phone, or signing in elsewhere lost the footage and everything observed in
-- it, which left approvals nobody could audit.
--
-- Depends on 015 for public.organisations and public.coach_relationships.
-- 015 is born with correct historical deletion rules, so nothing is retrofitted
-- here.
--
-- The governing rule: snapshot, do not reference. Every row carries who acted,
-- in what role, under which organisation, as it was at the time. Foreign keys
-- to people and organisations may go null; the snapshots are the record.

begin;

-- ---------------------------------------------------------------------------
-- Evidence assets — the file itself. One row per piece of footage, ever.
--
-- Media is not stored here. The bytes live in private storage; this row holds
-- the durable reference, the integrity hash, and the circumstances of capture.
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_assets (
  id uuid primary key default gen_random_uuid(),

  -- The athlete owns continuity of their own record.
  athlete_user_id uuid not null references auth.users(id) on delete restrict,

  storage_bucket text not null default 'evidence',
  storage_path text not null,
  content_hash text not null,          -- sha-256 of the bytes as uploaded
  byte_size bigint not null check (byte_size > 0),
  mime_type text not null,

  -- When the footage was taken, where the client could tell us.
  captured_at timestamptz,
  -- When our server accepted it. The only timestamp we vouch for.
  uploaded_at timestamptz not null default now(),
  -- What the client claimed, kept apart so it can never pass as server truth.
  client_reported_at timestamptz,

  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploader_name_snapshot text not null,
  uploader_role_snapshot text not null
    check (uploader_role_snapshot in ('athlete', 'coach')),

  organisation_id uuid references public.organisations(id) on delete set null,
  organisation_name_snapshot text,

  origin text not null default 'recorded'
    check (origin in ('recorded', 'backfilled')),

  retention_class text not null default 'evidence_media'
    check (retention_class in ('evidence_media', 'coaching_record')),

  -- Deletion is explicit and legible, never a side effect. A tombstoned asset
  -- keeps its hash and metadata so the chain that referenced it still reads.
  deleted_at timestamptz,
  deletion_basis text,

  created_at timestamptz not null default now(),

  constraint evidence_assets_deletion_is_explained
    check (deleted_at is null or coalesce(nullif(trim(deletion_basis), ''), null) is not null)
);

-- One row per file: re-uploading identical bytes for the same athlete reuses
-- the asset rather than duplicating the media record.
create unique index if not exists evidence_assets_unique_content
  on public.evidence_assets (athlete_user_id, content_hash);

create index if not exists evidence_assets_athlete_idx
  on public.evidence_assets (athlete_user_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Evidence observations — what someone saw in an asset.
--
-- The footage is what happened. An observation is a reading of it. One asset
-- supports many: Vision today, a better Vision in 2031, the coach, the athlete.
-- Re-analysis adds a row and points at what it supersedes; it never overwrites.
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_observations (
  id uuid primary key default gen_random_uuid(),

  -- restrict, not cascade: an observation must never outlive its asset quietly.
  asset_id uuid not null references public.evidence_assets(id) on delete restrict,
  athlete_user_id uuid not null references auth.users(id) on delete restrict,

  observer_kind text not null
    check (observer_kind in ('vision_model', 'coach', 'athlete')),
  observer_user_id uuid references auth.users(id) on delete set null,
  observer_name_snapshot text not null,
  observer_role_snapshot text not null
    check (observer_role_snapshot in ('system', 'athlete', 'coach')),

  organisation_id uuid references public.organisations(id) on delete set null,
  organisation_name_snapshot text,

  -- Which analyser produced this. A 2031 auditor must know a 2026 reading came
  -- from a 2026 model.
  observer_model text,
  observer_model_version text,

  claims jsonb not null default '{}'::jsonb,
  -- Only where it means something. A coach's eye does not carry a percentage.
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),

  observed_at timestamptz,
  recorded_at timestamptz not null default now(),
  client_reported_at timestamptz,

  supersedes_observation_id uuid references public.evidence_observations(id) on delete set null,

  origin text not null default 'recorded'
    check (origin in ('recorded', 'backfilled')),

  created_at timestamptz not null default now(),

  constraint evidence_observations_model_only_for_models
    check (observer_kind = 'vision_model' or observer_model is null)
);

create index if not exists evidence_observations_asset_idx
  on public.evidence_observations (asset_id, recorded_at desc);

create index if not exists evidence_observations_athlete_idx
  on public.evidence_observations (athlete_user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Immutability. Evidence is a record of the past; the past does not change.
-- Only the tombstone fields may be set, and only once.
-- ---------------------------------------------------------------------------
create or replace function public.evidence_assets_guard()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'evidence_assets: deletion is recorded once and not revised';
  end if;

  if (new.id, new.athlete_user_id, new.storage_path, new.content_hash,
      new.byte_size, new.mime_type, new.uploaded_at, new.uploader_name_snapshot,
      new.uploader_role_snapshot, new.origin)
     is distinct from
     (old.id, old.athlete_user_id, old.storage_path, old.content_hash,
      old.byte_size, old.mime_type, old.uploaded_at, old.uploader_name_snapshot,
      old.uploader_role_snapshot, old.origin) then
    raise exception 'evidence_assets: recorded facts are immutable; only deletion may be set';
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_assets_guard_trigger on public.evidence_assets;
create trigger evidence_assets_guard_trigger
  before update on public.evidence_assets
  for each row execute function public.evidence_assets_guard();

create or replace function public.evidence_observations_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'evidence_observations: insert-only. Record a superseding observation instead.';
end;
$$;

drop trigger if exists evidence_observations_immutable_trigger on public.evidence_observations;
create trigger evidence_observations_immutable_trigger
  before update on public.evidence_observations
  for each row execute function public.evidence_observations_immutable();

-- ---------------------------------------------------------------------------
-- Row level security.
--
-- The athlete reads their own record permanently, including after they leave an
-- academy. A connected coach reads their athlete's evidence. Nobody updates;
-- nobody deletes through the API.
-- ---------------------------------------------------------------------------
alter table public.evidence_assets enable row level security;
alter table public.evidence_observations enable row level security;

drop policy if exists evidence_assets_athlete_read on public.evidence_assets;
create policy evidence_assets_athlete_read
  on public.evidence_assets for select
  using (athlete_user_id = auth.uid());

drop policy if exists evidence_assets_coach_read on public.evidence_assets;
create policy evidence_assets_coach_read
  on public.evidence_assets for select
  using (exists (
    select 1 from public.coach_relationships r
    where r.athlete_user_id = evidence_assets.athlete_user_id
      and r.coach_user_id = auth.uid()
      and r.status = 'connected'
  ));

drop policy if exists evidence_assets_athlete_insert on public.evidence_assets;
create policy evidence_assets_athlete_insert
  on public.evidence_assets for insert
  with check (athlete_user_id = auth.uid());

drop policy if exists evidence_observations_athlete_read on public.evidence_observations;
create policy evidence_observations_athlete_read
  on public.evidence_observations for select
  using (athlete_user_id = auth.uid());

drop policy if exists evidence_observations_coach_read on public.evidence_observations;
create policy evidence_observations_coach_read
  on public.evidence_observations for select
  using (exists (
    select 1 from public.coach_relationships r
    where r.athlete_user_id = evidence_observations.athlete_user_id
      and r.coach_user_id = auth.uid()
      and r.status = 'connected'
  ));

drop policy if exists evidence_observations_athlete_insert on public.evidence_observations;
create policy evidence_observations_athlete_insert
  on public.evidence_observations for insert
  with check (athlete_user_id = auth.uid());

revoke all on public.evidence_assets from anon, authenticated;
revoke all on public.evidence_observations from anon, authenticated;
grant select, insert on public.evidence_assets to authenticated;
grant select, insert on public.evidence_observations to authenticated;

commit;
