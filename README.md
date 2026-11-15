# AIT Ops Hub

Private CRM and agent-operations hub for AI Transformation LLC. Next.js App Router on Vercel, backed by the existing Supabase project `form-submissions` (`tpoowbghgomkatofzsph`).

The browser does not talk to Supabase for sign-in. The hub asks for one shared password (`OPS_PASSWORD`). A correct password sets an httpOnly cookie for 30 days. Server actions and pages then read and write with the service role key, which stays on the server.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `OPS_PASSWORD` in `.env` and in the Vercel project. Share that password with the ops team. Changing it signs every existing session out. There is no email link and no per-user role.

## Environment variables

These are the Vercel Supabase integration names. Do not prefix the service keys with `NEXT_PUBLIC_`.

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser. Falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Hub reads and writes, plus agent/n8n jobs |
| `SUPABASE_SECRET_KEY` | Server only. Alternate to the service role key |
| `OPS_PASSWORD` | Server only. Shared password that opens the hub |
| `BUFFER_API_KEY` | Server only. Personal key from Buffer → Settings → API (analytics + scheduling) |
| `BUFFER_ORGANIZATION_ID` | Server only. Defaults to the AI Transformation org |
| `BUFFER_CHANNEL_YOUTUBE_VIRAL_DIGESTS` | Optional. Defaults to Viral Digests channel |
| `BUFFER_CHANNEL_YOUTUBE_JOHNNY_SNOW` | Optional. Defaults to Johnny Snow channel |
| `BUFFER_CHANNEL_INSTAGRAM` | Optional. Defaults to Instagram business channel |

## What the hub does

- Leads and clients with working filters, company detail (contacts/deals/notes), content scripts, and Buffer stats.
- Company pages with a timeline, follow-ups, tasks, and outreach drafts.
- Revenue against the $5,000 goal by 24 Nov 2026 (stretch $10,000), plus the service catalog.
- Agent roster, startup directives, a single approvals inbox, task and content boards, and daily reports.
- Command palette on Ctrl/Cmd-K. Live updates for approvals, content, activities, and tasks.

Approval changes status, `approved_by`, `review_notes`, and `reviewed_at`. From an **approved** card, **Schedule in Buffer** picks the next free slot from your Buffer posting schedules (America/New_York), requires a caption/description, and creates the scheduled video posts via the Buffer API.

Dragging a content card to Posted only changes status. It does not call a social API.

## Buffer analytics

The Content desk pulls views, reactions, comments, and engagement from Buffer. Create a personal API key in Buffer → Settings → API, set `BUFFER_API_KEY` in `.env` / Vercel, then click **Refresh Buffer** on Overview or Content. Metrics refresh about once a day on Buffer’s side. The hub matches posts to `content_queue` by the `VD-…` / `SC-…` code in the video URL.

## Profile and integrations

Open **Profile** or **Integrations** from the account menu. The hub pings Supabase, Buffer, video storage, and the ops password gate, then stores a health snapshot (preferred table `hub_integration_checks`, otherwise `daily_metrics` with `entry_type = integration_check`). Apply `supabase/migrations/20261114220000_hub_integrations_audit.sql` in the Supabase SQL editor to enable the dedicated audit table.

## How agents read directives and write activities

Agents and n8n use the service role on the server. That role bypasses RLS. Never put it in a browser, a `NEXT_PUBLIC_` variable, or a client bundle.

Read the active directives for one agent, in the order Samuel set:

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data } = await supabase
  .from("agent_directives")
  .select("directive, priority, sort_order, agents!inner(name, status, owner_of)")
  .eq("active", true)
  .eq("agents.name", "Orchestrator")
  .order("sort_order", { ascending: true });
```

After every mutation, insert an activity. `actor` is the agent name, or `Samuel` for a person.

```ts
await supabase.from("activities").insert({
  entity_type: "prospect",
  entity_id: prospectId,
  actor: "Orchestrator",
  action: "updated",
  details: { summary: "What changed" },
});
```

`entity_type` is `prospect`, `deal`, `outreach`, `content`, `approval`, `task`, `agent`, or `expense`. `entity_id` is that row's uuid.

## Access control

The app gate is the shared password. After sign-in, the server uses the service role, which bypasses row level security. That key never goes to the browser.

The database policies are unchanged. `public.is_owner()` is true only when `auth.jwt() -> app_metadata ->> role` is `owner`. Every public table has one policy, `owner_all`, for the `authenticated` role. `anon` has no grants. A staff or readonly JWT receives zero rows. Direct use of the publishable key still cannot read the hub.

Verified against the live database:

- `anon` on `prospects`: permission denied
- authenticated JWT with `app_metadata.role = staff`: 0 prospects, 0 deals, 0 agents
- authenticated JWT with `app_metadata.role = readonly`: 0 prospects
- authenticated JWT with `app_metadata.role = owner`: 703 prospects and 68 deals

## Schema

Migrations live in `supabase/migrations` and are already applied to `form-submissions`. They add columns and tables only. Existing columns were not dropped or renamed.

New tables: `contacts`, `deals`, `payments`, `activities`, `agents`, `agent_directives`, `saved_views`.

Deals were seeded for every prospect whose stage is `sent` or later (68 deals, 63 of them `sent`). Primary contacts were seeded from the existing contact string.

Deal status `meeting` maps back to prospect stage `meeting_booked`. Deal status `proposal` maps to `audit_proposed`. The other deal statuses use the same name as the prospect stage.
