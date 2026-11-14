-- Owner-only access for every public table.
-- is_owner() checks auth.jwt() -> app_metadata ->> role = 'owner'.
-- Staff, readonly, and anon are denied. service_role bypasses RLS for agents and n8n.

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('alter table public.%I force row level security', r.table_name);
    execute format('drop policy if exists owner_all on public.%I', r.table_name);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      r.table_name
    );
    execute format('revoke all on table public.%I from public, anon', r.table_name);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated, service_role',
      r.table_name
    );
  end loop;
end $$;

revoke all on type public.deal_status from public, anon;
revoke all on type public.agent_status from public, anon;
grant usage on type public.deal_status to authenticated, service_role;
grant usage on type public.agent_status to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['approvals', 'content_queue', 'activities', 'tasks']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
