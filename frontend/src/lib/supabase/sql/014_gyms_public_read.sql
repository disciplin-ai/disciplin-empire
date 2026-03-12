alter table public.gyms enable row level security;

drop policy if exists "gyms_select_public" on public.gyms;
create policy "gyms_select_public"
on public.gyms
for select
using (true);

create index if not exists gyms_city_idx
on public.gyms (lower(city));