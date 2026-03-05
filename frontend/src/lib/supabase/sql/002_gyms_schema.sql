-- EXTENSIONS
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- GYMS TABLE
create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text unique,

  city text not null,
  country text not null,
  address text,

  latitude double precision,
  longitude double precision,

  primary_discipline text,
  disciplines text[] default '{}'::text[],
  style_tags text[] default '{}'::text[],

  intensity_label text,
  level_label text,
  price_label text,

  is_verified boolean not null default false,
  google_maps_url text,
  website text,

  style_fit jsonb not null default '{}'::jsonb,
  coach_notes text,

  osm_id bigint unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gyms_city_country_idx
on public.gyms (lower(city), lower(country));

create index if not exists gyms_name_trgm_idx
on public.gyms using gin (name gin_trgm_ops);