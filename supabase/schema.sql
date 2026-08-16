create table if not exists public.shared_maps (
  id uuid primary key default gen_random_uuid(),
  strava_athlete_id text not null unique,
  image_path text not null,
  image_url text not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_maps enable row level security;

grant usage on schema public to service_role;
grant select, insert, update on public.shared_maps to service_role;

insert into storage.buckets (id, name, public)
values ('shared-maps', 'shared-maps', true)
on conflict (id) do update set public = true;
