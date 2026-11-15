-- Add geography/route columns to prospects for the Prospect Map feature.
-- Does not drop, rename, or rewrite any existing column.

alter table public.prospects add column if not exists lat double precision;
alter table public.prospects add column if not exists lng double precision;
alter table public.prospects add column if not exists miles_from_home numeric;
alter table public.prospects add column if not exists drive_minutes numeric;
alter table public.prospects add column if not exists route_id text;
alter table public.prospects add column if not exists visit_order int;
alter table public.prospects add column if not exists visit_opener text;

create index if not exists prospects_lat_lng_idx on public.prospects (lat, lng) where lat is not null and lng is not null;
create index if not exists prospects_route_id_idx on public.prospects (route_id) where route_id is not null;
create index if not exists prospects_miles_idx on public.prospects (miles_from_home) where miles_from_home is not null;
