-- Worker tracker schema for Supabase
-- Run this in the Supabase SQL editor to set up your database

-- 1. Workers table: each worker has a unique tracking token (used in their link)
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  consent_given_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Locations table: every GPS ping the worker's browser sends
create table public.locations (
  id bigserial primary key,
  worker_id uuid not null references public.workers(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz not null default now()
);

create index locations_worker_recent on public.locations (worker_id, recorded_at desc);

-- 3. View for "latest location per worker" — what the dashboard subscribes to
create view public.latest_locations as
select distinct on (worker_id)
  l.id, l.worker_id, w.name, w.role, l.lat, l.lng, l.accuracy,
  l.speed, l.heading, l.recorded_at
from public.locations l
join public.workers w on w.id = l.worker_id
where w.active = true
order by worker_id, recorded_at desc;

-- 4. Row Level Security
alter table public.workers enable row level security;
alter table public.locations enable row level security;

-- Worker can insert their own location using their token (no login required)
-- We do this by validating the token in an RPC instead of a direct insert.
create or replace function public.record_location(
  p_token text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_speed double precision default null,
  p_heading double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid;
begin
  select id into v_worker_id from public.workers
    where token = p_token and active = true;
  if v_worker_id is null then
    raise exception 'invalid_token';
  end if;
  insert into public.locations (worker_id, lat, lng, accuracy, speed, heading)
    values (v_worker_id, p_lat, p_lng, p_accuracy, p_speed, p_heading);
end;
$$;

grant execute on function public.record_location to anon;

-- Worker lookup by token (so the tracking page can show their name)
create or replace function public.get_worker_by_token(p_token text)
returns table (id uuid, name text, role text, consent_given_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select id, name, role, consent_given_at from public.workers
    where token = p_token and active = true;
$$;

grant execute on function public.get_worker_by_token to anon;

-- Record consent
create or replace function public.give_consent(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workers set consent_given_at = now()
    where token = p_token and consent_given_at is null;
end;
$$;

grant execute on function public.give_consent to anon;

-- Dashboard reads (admin only — protect with Supabase Auth in production)
-- For now, allow authenticated users to read everything
create policy "auth read workers" on public.workers
  for select to authenticated using (true);
create policy "auth read locations" on public.locations
  for select to authenticated using (true);
create policy "auth write workers" on public.workers
  for all to authenticated using (true) with check (true);

-- Enable realtime on locations table
alter publication supabase_realtime add table public.locations;
