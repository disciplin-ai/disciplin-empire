create index if not exists gyms_city_country_idx
on public.gyms (lower(city), lower(country));

create index if not exists gyms_name_trgm_idx
on public.gyms using gin (name gin_trgm_ops);