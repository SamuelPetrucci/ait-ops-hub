-- New enum values and types only. Existing labels are left in place.

alter type public.approval_status add value if not exists 'changes_requested';
alter type public.content_status add value if not exists 'changes_requested';
alter type public.content_status add value if not exists 'rejected';
alter type public.outreach_status add value if not exists 'changes_requested';
alter type public.outreach_status add value if not exists 'rejected';

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'deal_status') then
    create type public.deal_status as enum (
      'researched',
      'qualified',
      'draft',
      'sent',
      'replied',
      'meeting',
      'proposal',
      'won',
      'lost',
      'do_not_contact'
    );
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'agent_status') then
    create type public.agent_status as enum ('active', 'paused');
  end if;
end $$;
