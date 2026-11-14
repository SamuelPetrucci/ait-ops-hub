-- Primary contact from the existing prospect contact string.
insert into public.contacts (prospect_id, name, email, is_primary, notes)
select
  p.id,
  p.company,
  substring(p.contact from '([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})'),
  true,
  p.contact
from public.prospects p
where p.contact is not null
  and length(trim(p.contact)) > 0
  and not exists (
    select 1 from public.contacts c where c.prospect_id = p.id
  );

-- One deal per company already at stage sent or later.
insert into public.deals (prospect_id, service, value, probability, expected_close, status, notes)
select
  p.id,
  coalesce(nullif(trim(p.proposed_service), ''), 'Unspecified'),
  p.proposal_value,
  case p.stage::text
    when 'sent' then 20
    when 'replied' then 35
    when 'meeting_booked' then 50
    when 'audit_proposed' then 60
    when 'audit_paid' then 80
    when 'implementation_proposed' then 70
    when 'won' then 100
    when 'delivered' then 100
    when 'lost' then 0
    when 'do_not_contact' then 0
    else 15
  end,
  p.estimated_close_date,
  (
    case p.stage::text
      when 'meeting_booked' then 'meeting'
      when 'audit_proposed' then 'proposal'
      when 'audit_paid' then 'won'
      when 'implementation_proposed' then 'proposal'
      when 'delivered' then 'won'
      when 'sent' then 'sent'
      when 'replied' then 'replied'
      when 'won' then 'won'
      when 'lost' then 'lost'
      when 'do_not_contact' then 'do_not_contact'
      else 'sent'
    end
  )::public.deal_status,
  'Seeded from prospect stage ' || p.stage::text
from public.prospects p
where p.stage >= 'sent'::public.prospect_stage
  and not exists (
    select 1 from public.deals d where d.prospect_id = p.id
  );

insert into public.agents (name, role, status, owner_of, daily_budget_note)
values
  ('Prospect Analyst', 'Prospecting', 'active', 'prospecting', 'No paid scraping without an approval.'),
  ('A Market Intelligence', 'Research', 'active', 'prospecting', null),
  ('Market Researcher', 'Research', 'active', 'prospecting', null),
  ('D Outreach & Brand Comms', 'Outreach', 'active', 'outreach', 'Draft only. Never send from the hub.'),
  ('E Sales & Audit Specialist', 'Sales', 'active', 'outreach', null),
  ('Review & Perforce Analyst', 'Review', 'active', 'outreach', null),
  ('Outreach & Sale', 'Outreach', 'active', 'outreach', null),
  ('Viral_Digest content engine / executor', 'Content', 'active', 'content', 'Leave videos in in_review until Samuel approves.'),
  ('Social Content (Grok Bot)', 'Content', 'active', 'content', null),
  ('Content Agent', 'Content', 'active', 'content', null),
  ('Grok Bot', 'Executor', 'active', 'content', null),
  ('Viral Content Acquisition specialist', 'Content', 'active', 'content', null),
  ('Orchestrator', 'Operations', 'active', 'n8n engine', 'Act only on rows Samuel has approved.'),
  ('F Technical Solutions Architect', 'Engineering', 'active', 'n8n engine', null),
  ('H Notion Operations Manager', 'Operations', 'active', 'n8n engine', null),
  ('Automation Engineer', 'Automation', 'active', 'n8n engine', null)
on conflict (name) do nothing;

update public.agents a
set last_active_at = sub.last_at
from (
  select name, max(last_at) as last_at
  from (
    select author as name, max(entry_date)::timestamptz + interval '18 hours' as last_at
    from public.daily_metrics
    where author is not null
    group by author
    union all
    select assigned_agent, max(updated_at)
    from public.content_queue
    where assigned_agent is not null
    group by assigned_agent
    union all
    select assigned_agent, max(updated_at)
    from public.tasks
    where assigned_agent is not null
    group by assigned_agent
  ) raw
  group by name
) sub
where a.name = sub.name
  and (a.last_active_at is null or a.last_active_at < sub.last_at);

insert into public.agent_directives (agent_id, directive, priority, active, sort_order, created_by)
select a.id, d.directive, d.priority, true, d.sort_order, 'Samuel'
from public.agents a
join (
  values
    ('Prospect Analyst', 'Qualify only companies with a public business email and a specific operational pain. Skip do_not_contact.', 'high', 0),
    ('Prospect Analyst', 'Write a research note and an activity row for every company you touch.', 'medium', 1),
    ('D Outreach & Brand Comms', 'Draft outreach into pending_approval or held. Do not send. Samuel approves in the hub, then you or n8n may send.', 'high', 0),
    ('Viral_Digest content engine / executor', 'Queue shorts with script, caption, and sources. Status stays in_review until approved. Do not post.', 'high', 0),
    ('Social Content (Grok Bot)', 'Read active directives at startup. Post only content_queue rows with status approved.', 'high', 0),
    ('Orchestrator', 'At startup, load active agent_directives ordered by sort_order. Write an activities row for every mutation you make.', 'high', 0),
    ('Orchestrator', 'Nothing in approved status is permission to invent a send. Send only the exact approved row.', 'high', 1)
) as d(name, directive, priority, sort_order)
  on d.name = a.name
where not exists (
  select 1 from public.agent_directives existing where existing.agent_id = a.id
);

insert into public.saved_views (name, resource, filters, created_by)
select v.name, v.resource, v.filters::jsonb, 'Samuel'
from (
  values
    ('Sent — needs a follow-up', 'prospects', '{"stage":"sent","followUp":"any"}'),
    ('Qualified', 'prospects', '{"stage":"qualified"}'),
    ('Healthcare', 'prospects', '{"industry":"Healthcare Admin"}'),
    ('Overdue follow-ups', 'prospects', '{"followUp":"overdue"}')
) as v(name, resource, filters)
where not exists (
  select 1 from public.saved_views s where s.name = v.name and s.resource = v.resource
);
