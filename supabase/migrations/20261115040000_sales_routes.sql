-- Sales routes table for saved visit routes from the route planner.
-- Complements the route_id/visit_order columns on prospects.

create table if not exists public.sales_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stops jsonb not null default '[]'::jsonb,
  start_address text not null default 'Groton, CT',
  start_lat double precision not null default 41.3501,
  start_lng double precision not null default -72.0787,
  total_distance_km numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default 'Samuel'
);

create index if not exists sales_routes_created_at_idx on public.sales_routes (created_at desc);
create index if not exists sales_routes_name_idx on public.sales_routes (name);

do $$
begin
  execute 'create trigger sales_routes_set_updated_at before update on public.sales_routes for each row execute function public.set_updated_at()';
exception
  when duplicate_object then null;
end $$;

alter table public.sales_routes enable row level security;
alter table public.sales_routes force row level security;
drop policy if exists owner_all on public.sales_routes;
create policy owner_all on public.sales_routes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
revoke all on table public.sales_routes from public, anon;
grant select, insert, update, delete on table public.sales_routes to authenticated, service_role;

comment on table public.sales_routes is 'Saved visit routes from the Sales Map route planner.';
comment on column public.sales_routes.stops is 'Ordered array of prospect snapshots [{id, company, lat, lng, city}].';

-- Add geocoded_at column to track when prospects were geocoded
alter table public.prospects add column if not exists geocoded_at timestamptz;
create index if not exists prospects_geocoded_at_idx on public.prospects (geocoded_at) where geocoded_at is not null;

-- Add lead_score column selection to the map query
alter table public.prospects add column if not exists address text;
comment on column public.prospects.address is 'Full street address for geocoding.';
