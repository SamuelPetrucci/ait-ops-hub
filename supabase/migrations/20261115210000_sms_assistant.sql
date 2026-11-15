-- SMS / iMessage assistant tables for Linq inbound replies.
-- Apply in the form-submissions SQL editor before enabling the webhook.

create table if not exists public.sms_faqs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  question text not null,
  answer text not null,
  active boolean not null default true
);

create table if not exists public.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text not null,
  name text,
  status text not null default 'active',
  summary text,
  last_message_at timestamptz not null default now(),
  bot_paused boolean not null default false,
  opted_out boolean not null default false,
  linq_chat_id text,
  lead_notified_at timestamptz,
  constraint sms_conversations_phone_unique unique (phone),
  constraint sms_conversations_status_check check (
    status in ('active', 'needs_human', 'closed', 'opted_out')
  )
);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.sms_conversations (id) on delete cascade,
  direction text not null,
  body text not null,
  linq_message_id text,
  webhook_event_id text,
  meta jsonb not null default '{}'::jsonb,
  constraint sms_messages_direction_check check (direction in ('inbound', 'outbound', 'system')),
  constraint sms_messages_webhook_event_unique unique (webhook_event_id)
);

create index if not exists sms_faqs_active_idx on public.sms_faqs (active);
create index if not exists sms_conversations_status_idx on public.sms_conversations (status);
create index if not exists sms_conversations_last_message_idx on public.sms_conversations (last_message_at desc);
create index if not exists sms_messages_conversation_created_idx
  on public.sms_messages (conversation_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['sms_faqs', 'sms_conversations']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at',
      t
    );
  end loop;
end $$;

-- Owner RLS + service_role grants (matches hub pattern).
do $$
declare
  t text;
begin
  foreach t in array array['sms_faqs', 'sms_conversations', 'sms_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      t
    );
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated, service_role',
      t
    );
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sms_conversations'
  ) then
    alter publication supabase_realtime add table public.sms_conversations;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sms_messages'
  ) then
    alter publication supabase_realtime add table public.sms_messages;
  end if;
end $$;

insert into public.sms_faqs (question, answer, active)
select v.question, v.answer, true
from (
  values
    (
      'What services does AI Transformation offer?',
      'We help with custom application development, social media content engines and advertising, websites, and AI automation consulting and implementation.'
    ),
    (
      'Do you build custom apps?',
      'Yep — custom application development for teams that need something tailored, not an off-the-shelf tool.'
    ),
    (
      'Do you do social media or ads?',
      'We build social media content engines and run advertising so your brand stays consistent without you living in Canva all day.'
    ),
    (
      'Do you build websites?',
      'Yes — websites that look sharp and convert, tied into whatever tools you already use.'
    ),
    (
      'Do you help with AI automation?',
      'We consult on and implement AI automation — figuring out where it actually helps, then building it so your team can use it.'
    ),
    (
      'How much does it cost? / What''s your pricing?',
      'It depends on scope — happy to get you a quick quote. Want me to grab Samuel so you can book a short call?'
    ),
    (
      'How long does a project take?',
      'Timelines depend on scope. Happy to sketch a realistic plan once we hear what you need — want me to connect you with Samuel?'
    ),
    (
      'Can I talk to Samuel / book a call?',
      'Absolutely — I can flag Samuel and he''ll text you shortly to set something up.'
    )
) as v(question, answer)
where not exists (
  select 1 from public.sms_faqs f where f.question = v.question
);
