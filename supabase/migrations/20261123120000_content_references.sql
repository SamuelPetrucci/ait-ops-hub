-- Reference library: links Grok / content agents can pull from to create and repurpose posts.

create table if not exists public.content_references (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  url text not null,
  notes text,
  niche text,
  kind text not null default 'article',
  tags text[] not null default '{}'::text[],
  assigned_agents text[] not null default '{}'::text[],
  active boolean not null default true,
  created_by text not null default 'Samuel',
  constraint content_references_url_unique unique (url),
  constraint content_references_kind_check check (
    kind in ('article', 'video', 'thread', 'competitor', 'trend', 'research', 'other')
  )
);

create index if not exists content_references_active_idx
  on public.content_references (active) where active = true;
create index if not exists content_references_niche_idx
  on public.content_references (niche) where niche is not null;
create index if not exists content_references_updated_at_idx
  on public.content_references (updated_at desc);
create index if not exists content_references_tags_gin
  on public.content_references using gin (tags);
create index if not exists content_references_agents_gin
  on public.content_references using gin (assigned_agents);

do $$
begin
  execute 'create trigger content_references_set_updated_at before update on public.content_references for each row execute function public.set_updated_at()';
exception
  when duplicate_object then null;
end $$;

alter table public.content_references enable row level security;
alter table public.content_references force row level security;
drop policy if exists owner_all on public.content_references;
create policy owner_all on public.content_references for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
revoke all on table public.content_references from public, anon;
grant select, insert, update, delete on table public.content_references to authenticated, service_role;

comment on table public.content_references is
  'Curated source links for Grok / content agents to create and repurpose posts from.';
comment on column public.content_references.notes is
  'How agents should use this link (angle, what to pull, what to avoid).';
comment on column public.content_references.assigned_agents is
  'Agent names that should prefer this reference; empty means available to all content agents.';

-- Point content / Grok agents at the new library.
insert into public.agent_directives (agent_id, directive, priority, active, sort_order, created_by)
select a.id,
  'Before drafting, load active rows from content_references (filter by niche/tags/assigned_agents when set). Use those URLs as source material to create or repurpose content; cite them in source_urls on the content_queue row.',
  'high',
  true,
  2,
  'Samuel'
from public.agents a
where a.name in (
  'Grok Bot',
  'Social Content (Grok Bot)',
  'Content Agent',
  'Viral_Digest content engine / executor',
  'Viral Content Acquisition specialist'
)
and not exists (
  select 1
  from public.agent_directives d
  where d.agent_id = a.id
    and d.directive like '%content_references%'
);
