-- AIT Ops Hub schema additions.
-- Does not drop, rename, or rewrite any existing column.

alter table public.approvals add column if not exists approved_by text;
alter table public.approvals add column if not exists review_notes text;
alter table public.approvals add column if not exists reviewed_at timestamptz;

alter table public.outreach_messages add column if not exists review_notes text;
alter table public.outreach_messages add column if not exists reviewed_at timestamptz;

alter table public.content_queue add column if not exists reviewed_at timestamptz;

alter table public.tasks add column if not exists prospect_id uuid references public.prospects (id) on delete set null;
alter table public.tasks add column if not exists content_id uuid references public.content_queue (id) on delete set null;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  title text,
  is_primary boolean not null default false,
  notes text
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  service text not null,
  value numeric,
  probability integer not null default 0,
  expected_close date,
  status public.deal_status not null default 'researched',
  notes text,
  constraint deals_probability_range check (probability >= 0 and probability <= 100)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  amount numeric not null,
  date date not null default current_date,
  method text,
  status text not null default 'pending',
  notes text,
  constraint payments_amount_nonnegative check (amount >= 0),
  constraint payments_status_check check (status in ('pending', 'paid', 'refunded', 'failed'))
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique,
  role text,
  status public.agent_status not null default 'active',
  owner_of text,
  last_active_at timestamptz,
  daily_budget_note text
);

create table if not exists public.agent_directives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  directive text not null,
  priority text not null default 'medium',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by text not null default 'Samuel',
  constraint agent_directives_priority_check check (priority in ('high', 'medium', 'low'))
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  resource text not null default 'prospects',
  filters jsonb not null default '{}'::jsonb,
  created_by text not null default 'Samuel',
  constraint saved_views_resource_check check (resource in ('prospects', 'deals', 'tasks', 'content'))
);

create index if not exists contacts_prospect_id_idx on public.contacts (prospect_id);
create index if not exists deals_prospect_id_idx on public.deals (prospect_id);
create index if not exists deals_status_idx on public.deals (status);
create index if not exists payments_deal_id_idx on public.payments (deal_id);
create index if not exists activities_entity_idx on public.activities (entity_type, entity_id, created_at desc);
create index if not exists activities_created_idx on public.activities (created_at desc);
create index if not exists agent_directives_agent_sort_idx on public.agent_directives (agent_id, sort_order, created_at);
create index if not exists tasks_prospect_id_idx on public.tasks (prospect_id);
create index if not exists tasks_content_id_idx on public.tasks (content_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists prospects_stage_idx on public.prospects (stage);
create index if not exists prospects_follow_up_idx on public.prospects (next_follow_up_due);
create index if not exists content_queue_status_idx on public.content_queue (status);
create index if not exists content_queue_scheduled_idx on public.content_queue (scheduled_at);

do $$
declare
  t text;
begin
  foreach t in array array['contacts', 'deals', 'agents', 'agent_directives', 'saved_views']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at',
      t
    );
  end loop;
end $$;
