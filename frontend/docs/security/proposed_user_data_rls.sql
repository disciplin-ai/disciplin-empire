-- PROPOSAL ONLY. NOT APPLIED.
-- Review orphan counts and deployed policy names before running.
begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_saved_gyms_user_id_fkey'
  ) then
    alter table public.user_saved_gyms
      add constraint user_saved_gyms_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'gym_shortlist_runs_user_id_fkey'
  ) then
    alter table public.gym_shortlist_runs
      add constraint gym_shortlist_runs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.user_saved_gyms enable row level security;
alter table public.gym_shortlist_runs enable row level security;
alter table public.gym_shortlist_results enable row level security;

create policy "user_saved_gyms_select_own" on public.user_saved_gyms
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_saved_gyms_insert_own" on public.user_saved_gyms
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_saved_gyms_update_own" on public.user_saved_gyms
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_saved_gyms_delete_own" on public.user_saved_gyms
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "gym_shortlist_runs_select_own" on public.gym_shortlist_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "gym_shortlist_runs_insert_own" on public.gym_shortlist_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "gym_shortlist_runs_update_own" on public.gym_shortlist_runs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "gym_shortlist_runs_delete_own" on public.gym_shortlist_runs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "gym_shortlist_results_select_own" on public.gym_shortlist_results
  for select to authenticated using (
    exists (
      select 1 from public.gym_shortlist_runs run
      where run.id = run_id and run.user_id = (select auth.uid())
    )
  );
create policy "gym_shortlist_results_insert_own" on public.gym_shortlist_results
  for insert to authenticated with check (
    exists (
      select 1 from public.gym_shortlist_runs run
      where run.id = run_id and run.user_id = (select auth.uid())
    )
  );
create policy "gym_shortlist_results_update_own" on public.gym_shortlist_results
  for update to authenticated
  using (
    exists (
      select 1 from public.gym_shortlist_runs run
      where run.id = run_id and run.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.gym_shortlist_runs run
      where run.id = run_id and run.user_id = (select auth.uid())
    )
  );
create policy "gym_shortlist_results_delete_own" on public.gym_shortlist_results
  for delete to authenticated using (
    exists (
      select 1 from public.gym_shortlist_runs run
      where run.id = run_id and run.user_id = (select auth.uid())
    )
  );

-- These tables are referenced by application code but their deployed schemas
-- and current policies are not present in this repository. Apply the following
-- own-row policy set only after confirming each table has user_id uuid:
--
-- profiles, fuel_reports, sensei_sessions, nutrition_settings
--
-- alter table public.<table> enable row level security;
-- create policy "<table>_select_own" on public.<table>
--   for select to authenticated using ((select auth.uid()) = user_id);
-- create policy "<table>_insert_own" on public.<table>
--   for insert to authenticated with check ((select auth.uid()) = user_id);
-- create policy "<table>_update_own" on public.<table>
--   for update to authenticated
--   using ((select auth.uid()) = user_id)
--   with check ((select auth.uid()) = user_id);
-- create policy "<table>_delete_own" on public.<table>
--   for delete to authenticated using ((select auth.uid()) = user_id);
--
-- user_consents and privacy_requests should expose only SELECT and INSERT
-- own-row policies to authenticated users. Administrative processing must use
-- a separately authorized server path and must be audited.

rollback;
