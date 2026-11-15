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
| `LINQ_API_KEY` | Server only. Linq API token (`LINQ_API_V3_API_KEY` also accepted) |
| `LINQ_WEBHOOK_SECRET` | Server only. `whsec_…` signing secret from the webhook subscription |
| `OWNER_PHONE` | Server only. Your E.164 number for SMS alerts; inbound from this number is ignored |
| `AI_GATEWAY_API_KEY` | Server only. Vercel AI Gateway key for SMS replies |
| `SMS_ASSISTANT_MODEL` | Optional. Defaults to `openai/gpt-4o-mini` |

## What the hub does

- Leads and clients with working filters, company detail (contacts/deals/notes), content scripts, and Buffer stats.
- Company pages with a timeline, follow-ups, tasks, and outreach drafts.
- Revenue against the $5,000 goal by 24 Nov 2026 (stretch $10,000), plus the service catalog.
- Agent roster, startup directives, a single approvals inbox, task and content boards, and daily reports.
- **SMS Inbox** — Linq inbound assistant replies, lead capture, handoff flags, and bot pause/takeover.
- Command palette on Ctrl/Cmd-K. Live updates for approvals, content, activities, tasks, and SMS threads.

Approval changes status, `approved_by`, `review_notes`, and `reviewed_at`. From an **approved** card, **Schedule in Buffer** picks the next free slot from your Buffer posting schedules (America/New_York), requires a caption/description, and creates the scheduled video posts via the Buffer API.

Dragging a content card to Posted only changes status. It does not call a social API.

## Buffer analytics

The Content desk pulls views, reactions, comments, and engagement from Buffer. Create a personal API key in Buffer → Settings → API, set `BUFFER_API_KEY` in `.env` / Vercel, then click **Refresh Buffer** on Overview or Content. Metrics refresh about once a day on Buffer’s side. The hub matches posts to `content_queue` by the `VD-…` / `SC-…` code in the video URL.

## Profile and integrations

Open **Profile** or **Integrations** from the account menu. The hub pings Supabase, Buffer, video storage, and the ops password gate, then stores a health snapshot (preferred table `hub_integration_checks`, otherwise `daily_metrics` with `entry_type = integration_check`). Apply `supabase/migrations/20261114220000_hub_integrations_audit.sql` in the Supabase SQL editor to enable the dedicated audit table.

## Area discovery (free)

Sales Map → **Discover area** pulls local businesses from OpenStreetMap via Overpass (no Apify / Google Places). Drop a pin on the map (or type a town), set a radius, filter by industry/service niche and estimated company size (Wikidata headcount when tagged, otherwise OSM heuristics; optional free website sniff). Discovered businesses show as blue preview pins before you import selected rows into `prospects`.

Apply `supabase/migrations/20261115090000_prospect_discovery.sql` in the Supabase SQL editor so `osm_id`, `company_size_bucket`, and `discovery_source` exist. Import still works without it, but dedupe by OSM id is weaker until the migration is applied.

## Day sales plan

On Sales Map, **Plan my day** (or **Plan from selection**) builds a field route from Groton, CT: nearest-neighbor order with visit-window clustering (contractors early, restaurants afternoon). Each stop includes pitch opener, rough proposal idea for that company, pain points to discuss, card-drop line, discovery-call ask (Calendly), Google Maps export, copyable summary, and save-to-`sales_routes`. Scripts and proposal sketches live in `lib/sales-tactics.ts`; planner logic in `lib/day-plan.ts`.

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

SMS assistant tables (apply `supabase/migrations/20261115210000_sms_assistant.sql` in the Supabase SQL editor before enabling the webhook): `sms_faqs`, `sms_conversations`, `sms_messages`.

Deals were seeded for every prospect whose stage is `sent` or later (68 deals, 63 of them `sent`). Primary contacts were seeded from the existing contact string.

Deal status `meeting` maps back to prospect stage `meeting_booked`. Deal status `proposal` maps to `audit_proposed`. The other deal statuses use the same name as the prospect stage.

## SMS / iMessage assistant (Linq)

Samuel's assistant answers inbound texts on the Linq number: warm, short replies (≤300 chars) via Vercel AI Gateway, FAQ grounding in `sms_faqs`, last-10-message memory, STOP/HELP compliance, handoff to Samuel on buy/book/anger/uncertainty, and owner alerts (approvals row + Linq text to `OWNER_PHONE`).

**Do not enable the production webhook or send real texts until Samuel approves.**

### Connect the Linq webhook

1. Apply `supabase/migrations/20261115210000_sms_assistant.sql` in the `form-submissions` SQL editor.
2. Set the env vars above in Vercel (Preview first). Never commit keys.
3. Deploy a preview (or local forward) so `https://<host>/api/linq/inbound` is reachable over HTTPS.
4. Create a subscription (CLI or dashboard). Save the `signing_secret` immediately into `LINQ_WEBHOOK_SECRET`:

```bash
linq webhooks create \
  --url "https://YOUR_HOST/api/linq/inbound" \
  --events message.received
```

Or via API: `POST https://api.linqapp.com/api/partner/v3/webhook-subscriptions` with `target_url` and `subscribed_events: ["message.received"]`.

5. Local smoke test without a public URL:

```bash
linq webhooks listen --forward-to http://localhost:3000/api/linq/inbound
```

The route verifies Standard Webhooks signatures (`webhook-id` / `webhook-timestamp` / `webhook-signature`) with the Linq SDK `unwrap`, then processes asynchronously.

### Test plan (no production sends until approved)

1. **Migration** — Confirm `sms_faqs` has seed rows; empty `sms_conversations` / `sms_messages`.
2. **Signature** — POST garbage to `/api/linq/inbound` → `401`. Valid signed `message.received` → `200` `{ received: true }`.
3. **Happy path** — Inbound FAQ (services / websites / AI) → outbound reply under 300 chars, casual tone, no invented prices; rows in `sms_messages` (inbound + outbound).
4. **Pricing** — Ask "how much?" → depends-on-scope + offer to quote/book; no dollar amounts.
5. **Memory** — Send a follow-up; reply uses prior context (last 10).
6. **Handoff** — Ask for Samuel / book a call / buy → exact handoff line, `status = needs_human`, bot paused, approvals insert + owner text (only when you intentionally enable sends).
7. **Compliance** — `STOP` → opt-out confirmation with `override_optout`, no further bot replies until they text again; `HELP` → help text; "are you a bot?" → honest AI answer.
8. **Safety** — Inbound from `OWNER_PHONE` ignored; rapid spam hits rate limit; dashboard **SMS Inbox** lists threads, transcript, Pause/Resume bot.
9. **Production gate** — Keep the Linq subscription disabled (or pointed at preview only) until Samuel signs off.
