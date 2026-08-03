-- 017 — Private storage for evidence media.
--
-- The bytes never sit in a relational row. They live in a private bucket, keyed
-- by athlete, and are reachable only through short-lived signed URLs. The
-- evidence_assets row holds the durable reference and the integrity hash.
--
-- Path convention: evidence/<athlete_user_id>/<asset_uuid>.<ext>
-- The first path segment is the athlete's id, which is what the policies below
-- authorise against.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,                                   -- never public
  10485760,                                -- 10 MB, matching the current client cap
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- An athlete may write only beneath their own prefix.
drop policy if exists evidence_athlete_upload on storage.objects;
create policy evidence_athlete_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists evidence_athlete_read on storage.objects;
create policy evidence_athlete_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A connected coach may read their athlete's media. Read only — a coach never
-- writes to an athlete's evidence, and nobody updates or deletes through the
-- API. Removal is an administrative act with a recorded basis.
drop policy if exists evidence_coach_read on storage.objects;
create policy evidence_coach_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.coach_relationships r
      where r.coach_user_id = auth.uid()
        and r.status = 'connected'
        and r.athlete_user_id::text = (storage.foldername(name))[1]
    )
  );

commit;
