begin;

create extension if not exists pgcrypto;

-- Organisations exist so records can be grouped by the programme they were
-- created under. Deliberately minimal: no hierarchy, no membership, no
-- policies. Those arrive with the federation model. Every historical row keeps
-- a name snapshot alongside this reference, so the record still reads if the
-- organisation is later removed.
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;

create table if not exists public.coach_relationships (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  athlete_display_name text not null
    check (char_length(athlete_display_name) between 1 and 80),
  coach_display_name text not null
    check (char_length(coach_display_name) between 1 and 80),
  invited_email text not null
    check (invited_email = lower(trim(invited_email))),
  academy_name text
    check (academy_name is null or char_length(academy_name) <= 120),
  status text not null default 'invited'
    check (status in ('invited', 'connected', 'declined', 'disconnected', 'revoked')),
  delivery_status text not null default 'created'
    check (delivery_status in (
      'created',
      'unavailable',
      'development_available',
      'confirmed',
      'failed'
    )),
  delivery_updated_at timestamptz,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  disconnected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coach_relationships_one_current_per_athlete
  on public.coach_relationships (athlete_user_id)
  where status in ('invited', 'connected');

create index if not exists coach_relationships_coach_lookup
  on public.coach_relationships (coach_user_id, status);

create or replace function public.disconnect_deleted_coach()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.coach_user_id is not null
    and new.coach_user_id is null
    and old.status = 'connected'
  then
    new.status := 'disconnected';
    new.disconnected_at := now();
    new.updated_at := now();
    delete from public.current_coach_missions
      where relationship_id = old.id;
    update public.mission_submissions
      set status = 'withdrawn', decided_at = now(), decided_by = null
      where relationship_id = old.id and status = 'pending';
  end if;
  return new;
end;
$$;

create table if not exists public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null
    references public.coach_relationships(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists coach_invitations_relationship_created
  on public.coach_invitations (relationship_id, created_at desc);

create table if not exists public.mission_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Historical. A submission records what was proposed, including proposals
  -- that were declined, so it outlives the relationship it was made under.
  relationship_id uuid references public.coach_relationships(id) on delete set null,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  proposed_change_to_version_id uuid,
  correction_text text not null
    check (char_length(correction_text) between 1 and 2000),
  practice_task text not null
    check (char_length(practice_task) between 1 and 2000),
  athlete_context text
    check (athlete_context is null or char_length(athlete_context) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  rejection_reason text
    check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default now()
);

create unique index if not exists mission_submissions_one_pending_per_relationship
  on public.mission_submissions (relationship_id)
  where status = 'pending';

create table if not exists public.mission_versions (
  id uuid primary key default gen_random_uuid(),
  -- An approval is the record of a coach's decision. It must not disappear
  -- because the submission or the relationship behind it was removed.
  submission_id uuid unique
    references public.mission_submissions(id) on delete set null,
  relationship_id uuid references public.coach_relationships(id) on delete set null,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  coach_display_name text not null
    check (char_length(coach_display_name) between 1 and 80),
  version_number integer not null check (version_number > 0),
  correction_text text not null
    check (char_length(correction_text) between 1 and 2000),
  practice_task text not null
    check (char_length(practice_task) between 1 and 2000),
  athlete_context text
    check (athlete_context is null or char_length(athlete_context) <= 2000),
  organisation_id uuid references public.organisations(id) on delete set null,
  organisation_name_snapshot text,
  approval_kind text not null
    check (approval_kind in ('approved', 'edited_and_approved')),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (athlete_user_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mission_submissions_proposed_version_fkey'
  ) then
    alter table public.mission_submissions
      add constraint mission_submissions_proposed_version_fkey
      foreign key (proposed_change_to_version_id)
      references public.mission_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.current_coach_missions (
  athlete_user_id uuid primary key references auth.users(id) on delete cascade,
  relationship_id uuid not null references public.coach_relationships(id) on delete cascade,
  mission_version_id uuid not null unique
    references public.mission_versions(id) on delete cascade,
  activated_at timestamptz not null default now()
);

drop trigger if exists coach_relationships_deleted_coach_disconnect
  on public.coach_relationships;
create trigger coach_relationships_deleted_coach_disconnect
  before update of coach_user_id on public.coach_relationships
  for each row execute function public.disconnect_deleted_coach();

create table if not exists public.coach_audit_events (
  id uuid primary key default gen_random_uuid(),
  -- The ledger outlives its subject. Deleting a relationship must never
  -- erase the record of what happened inside it.
  relationship_id uuid references public.coach_relationships(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_display_name text not null,
  actor_role text not null check (actor_role in ('athlete', 'coach')),
  event_type text not null
    check (event_type in (
      'invitation_created',
      'invitation_resent',
      'invitation_revoked',
      'invitation_accepted',
      'invitation_declined',
      'mission_submitted',
      'mission_approved',
      'mission_edited_and_approved',
      'mission_rejected',
      'relationship_disconnected'
    )),
  organisation_id uuid references public.organisations(id) on delete set null,
  organisation_name_snapshot text,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_audit_events_relationship_created
  on public.coach_audit_events (relationship_id, created_at desc);

create or replace function public.populate_coach_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_relationship public.coach_relationships%rowtype;
begin
  select * into v_relationship
  from public.coach_relationships
  where id = new.relationship_id;
  if new.actor_user_id = v_relationship.coach_user_id then
    new.actor_display_name := v_relationship.coach_display_name;
    new.actor_role := 'coach';
  else
    new.actor_display_name := v_relationship.athlete_display_name;
    new.actor_role := 'athlete';
  end if;
  return new;
end;
$$;

drop trigger if exists coach_audit_events_actor_snapshot
  on public.coach_audit_events;
create trigger coach_audit_events_actor_snapshot
  before insert on public.coach_audit_events
  for each row execute function public.populate_coach_audit_actor();

create or replace function public.reject_immutable_coach_record_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'immutable_coach_record';
end;
$$;

drop trigger if exists mission_versions_immutable
  on public.mission_versions;
create trigger mission_versions_immutable
  before update on public.mission_versions
  for each row execute function public.reject_immutable_coach_record_mutation();

drop trigger if exists coach_audit_events_immutable
  on public.coach_audit_events;
create trigger coach_audit_events_immutable
  before update on public.coach_audit_events
  for each row execute function public.reject_immutable_coach_record_mutation();

revoke all on function public.reject_immutable_coach_record_mutation()
  from public, anon, authenticated;
revoke all on function public.populate_coach_audit_actor()
  from public, anon, authenticated;
revoke all on function public.disconnect_deleted_coach()
  from public, anon, authenticated;

alter table public.coach_relationships enable row level security;
alter table public.coach_invitations enable row level security;
alter table public.mission_submissions enable row level security;
alter table public.mission_versions enable row level security;
alter table public.current_coach_missions enable row level security;
alter table public.coach_audit_events enable row level security;

drop policy if exists coach_relationships_participant_read
  on public.coach_relationships;
create policy coach_relationships_participant_read
  on public.coach_relationships
  for select to authenticated
  using (
    athlete_user_id = (select auth.uid())
    or coach_user_id = (select auth.uid())
  );

drop policy if exists mission_submissions_participant_read
  on public.mission_submissions;
create policy mission_submissions_participant_read
  on public.mission_submissions
  for select to authenticated
  using (
    athlete_user_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_relationships relationship
      where relationship.id = relationship_id
        and relationship.coach_user_id = (select auth.uid())
    )
  );

drop policy if exists mission_versions_participant_read
  on public.mission_versions;
create policy mission_versions_participant_read
  on public.mission_versions
  for select to authenticated
  using (
    athlete_user_id = (select auth.uid())
    or coach_user_id = (select auth.uid())
  );

drop policy if exists current_coach_missions_participant_read
  on public.current_coach_missions;
create policy current_coach_missions_participant_read
  on public.current_coach_missions
  for select to authenticated
  using (
    athlete_user_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_relationships relationship
      where relationship.id = relationship_id
        and relationship.coach_user_id = (select auth.uid())
    )
  );

drop policy if exists coach_audit_events_participant_read
  on public.coach_audit_events;
create policy coach_audit_events_participant_read
  on public.coach_audit_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.coach_relationships relationship
      where relationship.id = relationship_id
        and (
          relationship.athlete_user_id = (select auth.uid())
          or relationship.coach_user_id = (select auth.uid())
        )
    )
  );

revoke all on public.coach_relationships from anon, authenticated;
revoke all on public.coach_invitations from anon, authenticated;
revoke all on public.mission_submissions from anon, authenticated;
revoke all on public.mission_versions from anon, authenticated;
revoke all on public.current_coach_missions from anon, authenticated;
revoke all on public.coach_audit_events from anon, authenticated;

grant select on public.coach_relationships to authenticated;
grant select on public.mission_submissions to authenticated;
grant select on public.mission_versions to authenticated;
grant select on public.current_coach_missions to authenticated;
grant select on public.coach_audit_events to authenticated;

create or replace function public.coach_create_invitation(
  p_athlete_display_name text,
  p_coach_display_name text,
  p_coach_email text,
  p_academy_name text,
  p_token_hash text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_coach_email));
  v_relationship_id uuid;
  v_invitation_id uuid;
  v_recent_count integer;
  v_daily_count integer;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if char_length(trim(p_athlete_display_name)) not between 1 and 80
    or char_length(trim(p_coach_display_name)) not between 1 and 80
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '14 days'
  then
    raise exception 'invalid_invitation';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  then raise exception 'self_invitation_not_allowed'; end if;

  if exists (
    select 1 from public.coach_relationships
    where athlete_user_id = v_actor and status in ('invited', 'connected')
  ) then
    raise exception 'active_relationship_exists';
  end if;

  select count(*) into v_recent_count
  from public.coach_audit_events
  where actor_user_id = v_actor
    and event_type in ('invitation_created', 'invitation_resent')
    and created_at > now() - interval '1 hour';
  if v_recent_count >= 3 then raise exception 'invitation_rate_limited'; end if;
  select count(*) into v_daily_count
  from public.coach_audit_events
  where actor_user_id = v_actor
    and event_type in ('invitation_created', 'invitation_resent')
    and created_at > now() - interval '24 hours';
  if v_daily_count >= 10 then raise exception 'invitation_rate_limited'; end if;

  insert into public.coach_relationships (
    athlete_user_id,
    athlete_display_name,
    coach_display_name,
    invited_email,
    academy_name
  ) values (
    v_actor,
    trim(p_athlete_display_name),
    trim(p_coach_display_name),
    v_email,
    nullif(trim(p_academy_name), '')
  ) returning id into v_relationship_id;

  insert into public.coach_invitations (
    relationship_id, token_hash, expires_at, created_by
  ) values (
    v_relationship_id, p_token_hash, p_expires_at, v_actor
  ) returning id into v_invitation_id;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    v_relationship_id, v_actor, 'invitation_created', 'coach_invitation', v_invitation_id
  );

  return jsonb_build_object(
    'relationshipId', v_relationship_id,
    'invitationId', v_invitation_id
  );
end;
$$;

create or replace function public.coach_resend_invitation(
  p_relationship_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation_id uuid;
  v_last_created timestamptz;
  v_recent_count integer;
  v_daily_count integer;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '14 days'
  then
    raise exception 'invalid_invitation';
  end if;

  perform 1 from public.coach_relationships
  where id = p_relationship_id
    and athlete_user_id = v_actor
    and status = 'invited'
  for update;
  if not found then raise exception 'invitation_not_available'; end if;

  select max(created_at) into v_last_created
  from public.coach_invitations
  where relationship_id = p_relationship_id;
  if v_last_created > now() - interval '60 seconds'
  then raise exception 'invitation_rate_limited'; end if;

  select count(*) into v_recent_count
  from public.coach_audit_events
  where actor_user_id = v_actor
    and event_type in ('invitation_created', 'invitation_resent')
    and created_at > now() - interval '1 hour';
  if v_recent_count >= 3 then raise exception 'invitation_rate_limited'; end if;
  select count(*) into v_daily_count
  from public.coach_audit_events
  where actor_user_id = v_actor
    and event_type in ('invitation_created', 'invitation_resent')
    and created_at > now() - interval '24 hours';
  if v_daily_count >= 10 then raise exception 'invitation_rate_limited'; end if;

  update public.coach_invitations
  set cancelled_at = now()
  where relationship_id = p_relationship_id
    and used_at is null
    and cancelled_at is null;

  insert into public.coach_invitations (
    relationship_id, token_hash, expires_at, created_by
  ) values (
    p_relationship_id, p_token_hash, p_expires_at, v_actor
  ) returning id into v_invitation_id;

  update public.coach_relationships
  set invited_at = now(),
      delivery_status = 'created',
      delivery_updated_at = null,
      updated_at = now()
  where id = p_relationship_id;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    p_relationship_id, v_actor, 'invitation_resent', 'coach_invitation', v_invitation_id
  );

  return jsonb_build_object('invitationId', v_invitation_id);
end;
$$;

create or replace function public.coach_cancel_invitation(
  p_relationship_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  update public.coach_relationships
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = p_relationship_id
    and athlete_user_id = v_actor
    and status = 'invited';
  if not found then raise exception 'invitation_not_available'; end if;

  update public.coach_invitations
  set cancelled_at = now()
  where relationship_id = p_relationship_id
    and used_at is null
    and cancelled_at is null;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    p_relationship_id, v_actor, 'invitation_revoked', 'coach_relationship', p_relationship_id
  );
end;
$$;

create or replace function public.coach_resolve_invitation(
  p_token_hash text
) returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select jsonb_build_object(
    'relationshipId', relationship.id,
    'athleteName', relationship.athlete_display_name,
    'coachName', relationship.coach_display_name,
    'academyName', relationship.academy_name,
    'status', relationship.status,
    'expiresAt', invitation.expires_at,
    'expired', invitation.expires_at <= now(),
    'usable', (
      relationship.status = 'invited'
      and invitation.used_at is null
      and invitation.cancelled_at is null
      and invitation.expires_at > now()
    )
  ) into v_result
  from public.coach_invitations invitation
  join public.coach_relationships relationship
    on relationship.id = invitation.relationship_id
  where invitation.token_hash = p_token_hash
    and relationship.invited_email = v_actor_email;

  if v_result is null then raise exception 'invitation_not_found'; end if;
  return v_result;
end;
$$;

create or replace function public.coach_accept_invitation(
  p_token_hash text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_relationship_id uuid;
  v_invitation_id uuid;
  v_invited_email text;
  v_athlete_user_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_cancelled_at timestamptz;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select relationship.id, invitation.id, relationship.invited_email,
         relationship.athlete_user_id,
         relationship.status, invitation.expires_at,
         invitation.used_at, invitation.cancelled_at
  into v_relationship_id, v_invitation_id, v_invited_email,
       v_athlete_user_id,
       v_status, v_expires_at, v_used_at, v_cancelled_at
  from public.coach_invitations invitation
  join public.coach_relationships relationship
    on relationship.id = invitation.relationship_id
  where invitation.token_hash = p_token_hash
  for update of invitation, relationship;

  if v_relationship_id is null or v_invited_email <> v_actor_email
  then raise exception 'invitation_not_found'; end if;
  if v_athlete_user_id = v_actor
  then raise exception 'self_invitation_not_allowed'; end if;
  if v_status <> 'invited' or v_used_at is not null
    or v_cancelled_at is not null or v_expires_at <= now()
  then raise exception 'invitation_not_available'; end if;

  update public.coach_relationships
  set coach_user_id = v_actor,
      status = 'connected',
      accepted_at = now(),
      updated_at = now()
  where id = v_relationship_id;

  update public.coach_invitations
  set used_at = now()
  where id = v_invitation_id;

  update public.coach_invitations
  set cancelled_at = now()
  where relationship_id = v_relationship_id
    and id <> v_invitation_id
    and used_at is null
    and cancelled_at is null;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    v_relationship_id, v_actor, 'invitation_accepted',
    'coach_relationship', v_relationship_id
  );

  return jsonb_build_object('relationshipId', v_relationship_id);
end;
$$;

create or replace function public.coach_decline_invitation(
  p_token_hash text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_relationship_id uuid;
  v_invitation_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select relationship.id, invitation.id
  into v_relationship_id, v_invitation_id
  from public.coach_invitations invitation
  join public.coach_relationships relationship
    on relationship.id = invitation.relationship_id
  where invitation.token_hash = p_token_hash
    and relationship.invited_email = v_actor_email
    and relationship.status = 'invited'
    and invitation.used_at is null
    and invitation.cancelled_at is null
    and invitation.expires_at > now()
  for update of invitation, relationship;

  if v_relationship_id is null then raise exception 'invitation_not_available'; end if;

  update public.coach_relationships
  set status = 'declined', declined_at = now(), updated_at = now()
  where id = v_relationship_id;

  update public.coach_invitations
  set used_at = now()
  where id = v_invitation_id;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    v_relationship_id, v_actor, 'invitation_declined',
    'coach_relationship', v_relationship_id
  );
end;
$$;

create or replace function public.coach_submit_mission(
  p_relationship_id uuid,
  p_correction_text text,
  p_practice_task text,
  p_athlete_context text default null,
  p_proposed_change_to_version_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_submission_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if char_length(trim(p_correction_text)) not between 1 and 2000
    or char_length(trim(p_practice_task)) not between 1 and 2000
    or char_length(coalesce(p_athlete_context, '')) > 2000
  then raise exception 'invalid_submission'; end if;

  perform 1 from public.coach_relationships
  where id = p_relationship_id
    and athlete_user_id = v_actor
    and coach_user_id is not null
    and status = 'connected';
  if not found then raise exception 'connected_relationship_required'; end if;

  if p_proposed_change_to_version_id is not null and not exists (
    select 1 from public.mission_versions
    where id = p_proposed_change_to_version_id
      and athlete_user_id = v_actor
      and relationship_id = p_relationship_id
  ) then raise exception 'invalid_previous_version'; end if;

  insert into public.mission_submissions (
    relationship_id, athlete_user_id, proposed_change_to_version_id,
    correction_text, practice_task, athlete_context
  ) values (
    p_relationship_id, v_actor, p_proposed_change_to_version_id,
    trim(p_correction_text), trim(p_practice_task),
    nullif(trim(p_athlete_context), '')
  ) returning id into v_submission_id;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    p_relationship_id, v_actor, 'mission_submitted',
    'mission_submission', v_submission_id
  );

  return jsonb_build_object('submissionId', v_submission_id);
end;
$$;

create or replace function public.coach_decide_submission(
  p_submission_id uuid,
  p_decision text,
  p_correction_text text default null,
  p_practice_task text default null,
  p_athlete_context text default null,
  p_rejection_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_submission public.mission_submissions%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_correction text;
  v_task text;
  v_context text;
  v_event text;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if p_decision not in ('approve', 'edit_and_approve', 'reject')
  then raise exception 'invalid_decision'; end if;

  select submission.* into v_submission
  from public.mission_submissions submission
  join public.coach_relationships relationship
    on relationship.id = submission.relationship_id
  where submission.id = p_submission_id
    and submission.status = 'pending'
    and relationship.coach_user_id = v_actor
    and relationship.athlete_user_id <> v_actor
    and relationship.status = 'connected'
  for update of submission;
  if v_submission.id is null then raise exception 'submission_not_available'; end if;

  if p_decision = 'reject' then
    if char_length(trim(coalesce(p_rejection_reason, ''))) not between 1 and 1000
    then raise exception 'rejection_reason_required'; end if;

    update public.mission_submissions
    set status = 'rejected', decided_at = now(), decided_by = v_actor,
        rejection_reason = trim(p_rejection_reason)
    where id = p_submission_id;

    insert into public.coach_audit_events (
      relationship_id, actor_user_id, event_type, entity_type, entity_id
    ) values (
      v_submission.relationship_id, v_actor, 'mission_rejected',
      'mission_submission', p_submission_id
    );
    return jsonb_build_object('status', 'rejected');
  end if;

  v_correction := case when p_decision = 'edit_and_approve'
    then trim(coalesce(p_correction_text, ''))
    else v_submission.correction_text end;
  v_task := case when p_decision = 'edit_and_approve'
    then trim(coalesce(p_practice_task, ''))
    else v_submission.practice_task end;
  v_context := case when p_decision = 'edit_and_approve'
    then nullif(trim(p_athlete_context), '')
    else v_submission.athlete_context end;

  if char_length(v_correction) not between 1 and 2000
    or char_length(v_task) not between 1 and 2000
    or char_length(coalesce(v_context, '')) > 2000
  then raise exception 'invalid_approved_version'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.mission_versions
  where athlete_user_id = v_submission.athlete_user_id;

  insert into public.mission_versions (
    submission_id, relationship_id, athlete_user_id, coach_user_id,
    coach_display_name, version_number, correction_text, practice_task, athlete_context,
    approval_kind
  ) values (
    p_submission_id, v_submission.relationship_id,
    v_submission.athlete_user_id, v_actor,
    (select coach_display_name from public.coach_relationships
      where id = v_submission.relationship_id),
    v_version_number,
    v_correction, v_task, v_context,
    case when p_decision = 'edit_and_approve'
      then 'edited_and_approved' else 'approved' end
  ) returning id into v_version_id;

  insert into public.current_coach_missions (
    athlete_user_id, relationship_id, mission_version_id
  ) values (
    v_submission.athlete_user_id, v_submission.relationship_id, v_version_id
  )
  on conflict (athlete_user_id) do update
  set relationship_id = excluded.relationship_id,
      mission_version_id = excluded.mission_version_id,
      activated_at = now();

  update public.mission_submissions
  set status = 'approved', decided_at = now(), decided_by = v_actor
  where id = p_submission_id;

  v_event := case when p_decision = 'edit_and_approve'
    then 'mission_edited_and_approved' else 'mission_approved' end;
  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id,
    metadata
  ) values (
    v_submission.relationship_id, v_actor, v_event,
    'mission_version', v_version_id,
    jsonb_build_object('submissionId', p_submission_id, 'version', v_version_number)
  );

  return jsonb_build_object(
    'status', 'approved',
    'missionVersionId', v_version_id,
    'versionNumber', v_version_number
  );
end;
$$;

create or replace function public.coach_disconnect_relationship(
  p_relationship_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_athlete uuid;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select athlete_user_id into v_athlete
  from public.coach_relationships
  where id = p_relationship_id
    and status = 'connected'
    and (
      athlete_user_id = v_actor
      or coach_user_id = v_actor
    )
  for update;
  if v_athlete is null then raise exception 'relationship_not_available'; end if;

  update public.coach_relationships
  set status = 'disconnected', disconnected_at = now(), updated_at = now()
  where id = p_relationship_id;

  update public.mission_submissions
  set status = 'withdrawn', decided_at = now(), decided_by = v_actor
  where relationship_id = p_relationship_id and status = 'pending';

  delete from public.current_coach_missions
  where athlete_user_id = v_athlete
    and relationship_id = p_relationship_id;

  insert into public.coach_audit_events (
    relationship_id, actor_user_id, event_type, entity_type, entity_id
  ) values (
    p_relationship_id, v_actor, 'relationship_disconnected',
    'coach_relationship', p_relationship_id
  );
end;
$$;

revoke all on function public.coach_create_invitation(text, text, text, text, text, timestamptz)
  from public, anon;
revoke all on function public.coach_resend_invitation(uuid, text, timestamptz)
  from public, anon;
revoke all on function public.coach_cancel_invitation(uuid)
  from public, anon;
revoke all on function public.coach_resolve_invitation(text)
  from public, anon;
revoke all on function public.coach_accept_invitation(text)
  from public, anon;
revoke all on function public.coach_decline_invitation(text)
  from public, anon;
revoke all on function public.coach_submit_mission(uuid, text, text, text, uuid)
  from public, anon;
revoke all on function public.coach_decide_submission(uuid, text, text, text, text, text)
  from public, anon;
revoke all on function public.coach_disconnect_relationship(uuid)
  from public, anon;

grant execute on function public.coach_create_invitation(text, text, text, text, text, timestamptz)
  to authenticated;
grant execute on function public.coach_resend_invitation(uuid, text, timestamptz)
  to authenticated;
grant execute on function public.coach_cancel_invitation(uuid)
  to authenticated;
grant execute on function public.coach_resolve_invitation(text)
  to authenticated;
grant execute on function public.coach_accept_invitation(text)
  to authenticated;
grant execute on function public.coach_decline_invitation(text)
  to authenticated;
grant execute on function public.coach_submit_mission(uuid, text, text, text, uuid)
  to authenticated;
grant execute on function public.coach_decide_submission(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.coach_disconnect_relationship(uuid)
  to authenticated;

-- The audit trail is a ledger: written once, never revised, never removed.
create or replace function public.coach_audit_events_append_only()
returns trigger
language plpgsql
as $
begin
  raise exception 'coach_audit_events is append-only';
end;
$;

drop trigger if exists coach_audit_events_no_update on public.coach_audit_events;
create trigger coach_audit_events_no_update
  before update or delete on public.coach_audit_events
  for each row execute function public.coach_audit_events_append_only();

grant select on public.organisations to authenticated;

commit;
