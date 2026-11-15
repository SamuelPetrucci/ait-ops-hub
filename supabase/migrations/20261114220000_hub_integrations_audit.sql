-- Ensure Buffer analytics columns/table exist (idempotent).
alter table public.content_performance
  add column if not exists buffer_post_id text,
  add column if not exists reactions numeric,
  add column if not exists engagement_rate_pct numeric;

create unique index if not exists content_performance_buffer_post_id_uidx
  on public.content_performance (buffer_post_id)
  where buffer_post_id is not null;

create table if not exists public.buffer_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  metrics_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists buffer_snapshots_synced_idx
  on public.buffer_snapshots (synced_at desc);

alter table public.buffer_snapshots enable row level security;
alter table public.buffer_snapshots force row level security;

drop policy if exists owner_all on public.buffer_snapshots;
create policy owner_all on public.buffer_snapshots
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

revoke all on public.buffer_snapshots from anon, public;
grant select, insert, update, delete on public.buffer_snapshots to authenticated, service_role;

-- Lightweight audit log for integration health checks from the Profile page.
create table if not exists public.hub_integration_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  integration_id text not null,
  status text not null check (status in ('connected', 'configured', 'degraded', 'missing')),
  detail text,
  checked_by text not null default 'ops'
);

create index if not exists hub_integration_checks_created_idx
  on public.hub_integration_checks (created_at desc);

create index if not exists hub_integration_checks_integration_idx
  on public.hub_integration_checks (integration_id, created_at desc);

alter table public.hub_integration_checks enable row level security;
alter table public.hub_integration_checks force row level security;

drop policy if exists owner_all on public.hub_integration_checks;
create policy owner_all on public.hub_integration_checks
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

revoke all on public.hub_integration_checks from anon, public;
grant select, insert, update, delete on public.hub_integration_checks to authenticated, service_role;
