import Link from "next/link";
import type { ReactNode } from "react";
import { BufferRefresh } from "@/components/buffer-refresh";
import { ContentPiece } from "@/components/content-piece";
import { SiteLink } from "@/components/site-link";
import { requireOwner } from "@/lib/auth";
import { readBufferTotals } from "@/lib/buffer";
import { GOAL_DATE, OPEN_DEAL_STATUSES, REVENUE_GOAL, REVENUE_STRETCH } from "@/lib/constants";
import { byContentRecency, liveLinks, scriptParts } from "@/lib/content";
import { daysUntil, formatWhen, money, nestedString, nyToday, weekStart } from "@/lib/format";

export const metadata = { title: "Overview" };

const IN_MOTION = ["scripting", "rendering", "in_review", "changes_requested", "approved"];

export default async function OverviewPage() {
  const { supabase } = await requireOwner();
  const today = nyToday();
  const week = weekStart(today);
  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [
    payments,
    scorecard,
    deals,
    qualified,
    outreach,
    followUps,
    approvals,
    drafts,
    inReview,
    postedCount,
    agents,
    metrics,
    moving,
    posted,
  ] = await Promise.all([
    supabase.from("payments").select("amount, status"),
    supabase
      .from("daily_metrics")
      .select("entry_date, revenue_collected, title")
      .eq("entry_type", "revenue_scorecard")
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("deals").select("status, value, probability"),
    supabase
      .from("daily_metrics")
      .select("new_qualified_prospects")
      .eq("entry_type", "agent_daily")
      .gte("entry_date", week),
    supabase.from("outreach_messages").select("status"),
    supabase
      .from("prospects")
      .select("id, company, website, next_follow_up_due")
      .not("next_follow_up_due", "is", null)
      .lte("next_follow_up_due", today)
      .order("next_follow_up_due", { ascending: true }),
    supabase
      .from("approvals")
      .select("id, title, type, related_content_id, related_prospect_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("outreach_messages")
      .select("id, subject, prospect_id, status, prospects(company)", { count: "exact" })
      .in("status", ["pending_approval", "held"])
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("content_queue").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabase
      .from("content_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .gte("posted_at", `${week}T00:00:00Z`),
    supabase.from("agents").select("status, last_active_at"),
    supabase
      .from("daily_metrics")
      .select("emails_sent, replies")
      .gte("entry_date", week)
      .in("entry_type", ["agent_daily", "ceo_daily", "weekly_funnel"]),
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, assigned_agent, script_json, caption, video_url, notion_page_url, platform_links, review_notes, updated_at, created_at, scheduled_at, posted_at",
      )
      .in("status", IN_MOTION)
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, assigned_agent, script_json, caption, video_url, notion_page_url, platform_links, review_notes, posted_at, updated_at, created_at, scheduled_at",
      )
      .eq("status", "posted")
      .order("posted_at", { ascending: false }),
  ]);

  for (const result of [
    payments,
    scorecard,
    deals,
    qualified,
    outreach,
    followUps,
    approvals,
    drafts,
    agents,
    metrics,
    moving,
    posted,
  ]) {
    if ("error" in result && result.error) throw new Error(result.error.message);
  }

  const collected = (payments.data ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const reported = Number(scorecard.data?.revenue_collected || 0);
  const shown = Math.max(collected, reported);
  const openDeals = (deals.data ?? []).filter((row) => OPEN_DEAL_STATUSES.includes(row.status));
  const pipeline = openDeals.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const weighted = openDeals.reduce(
    (sum, row) => sum + (Number(row.value || 0) * Number(row.probability || 0)) / 100,
    0,
  );
  const qualifiedCount = (qualified.data ?? []).reduce(
    (sum, row) => sum + Number(row.new_qualified_prospects || 0),
    0,
  );
  const sent = (outreach.data ?? []).filter((row) => row.status === "sent").length;
  const replied = (outreach.data ?? []).filter((row) => row.status === "replied").length;
  const bounced = (outreach.data ?? []).filter((row) => row.status === "bounced").length;
  const weekSent = (metrics.data ?? []).reduce((sum, row) => sum + Number(row.emails_sent || 0), 0);
  const weekReplies = (metrics.data ?? []).reduce((sum, row) => sum + Number(row.replies || 0), 0);
  const pending = approvals.data ?? [];
  const businessApprovals = pending.filter((row) => !row.related_content_id);
  const contentApprovals = pending.filter((row) => row.related_content_id);
  const active = (agents.data ?? []).filter((row) => row.status === "active");
  const stale = active.filter((row) => !row.last_active_at || row.last_active_at < staleBefore).length;
  const left = daysUntil(GOAL_DATE, today);
  const progress = Math.min(100, Math.round((shown / REVENUE_GOAL) * 100));
  const dueRows = followUps.data ?? [];
  const dueToday = dueRows.filter((row) => row.next_follow_up_due === today).length;
  const businessWaiting = businessApprovals.length + (drafts.count || 0);
  const contentWaiting = contentApprovals.length + (inReview.count || 0);
  const movingRows = [...(moving.data ?? [])].sort(byContentRecency).slice(0, 8);
  const postedRows = [...(posted.data ?? [])].sort(byContentRecency).slice(0, 5);
  const buffer = await readBufferTotals();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-primary uppercase">Today</p>
        <h1 className="mt-1 text-2xl font-medium">Two lines, one company</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Client work and the content engine stay separate. Agents, tasks, and the approval gate sit underneath both.
        </p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-2xl bg-card/60 p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-primary uppercase">Business</p>
              <h2 className="text-lg font-medium">Client work</h2>
              <p className="text-sm text-muted-foreground">
                {left >= 0 ? `${left} days to Nov 24` : "Past the Nov 24 goal"} · {money(shown)} of {money(REVENUE_GOAL)}
                {reported && reported !== collected ? ` · scorecard ${money(reported)}` : ""}
              </p>
            </div>
            <Link href="/pipeline" className="text-xs text-muted-foreground hover:text-foreground">
              Open pipeline
            </Link>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric href="/revenue" label="Collected" value={money(shown)} hint={`Stretch ${money(REVENUE_STRETCH)}`} />
            <Metric href="/pipeline" label="Pipeline" value={money(pipeline)} hint={`Weighted ${money(weighted)}`} />
            <Metric
              href="/follow-ups"
              label="Follow-ups"
              value={String(dueRows.length)}
              hint={dueToday ? `${dueToday} today` : "Due or overdue"}
            />
            <Metric href="/approvals" label="Drafts waiting" value={String(businessWaiting)} hint="Outreach and client approvals" />
          </div>

          <Queue title="Follow-ups due" href="/follow-ups">
            {dueRows.length === 0 ? <Empty>Nothing due.</Empty> : null}
            {dueRows.slice(0, 6).map((row) => (
              <div key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <Link href={`/companies/${row.id}`} className="truncate hover:underline">
                    {row.company}
                  </Link>
                  <SiteLink website={row.website} />
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(row.next_follow_up_due)}</span>
              </div>
            ))}
            {dueRows.length > 6 ? (
              <Link href="/follow-ups" className="text-xs text-muted-foreground hover:underline">
                {dueRows.length - 6} more
              </Link>
            ) : null}
          </Queue>

          <Queue title="Needs a decision" href="/approvals">
            {businessApprovals.length + (drafts.data?.length || 0) === 0 ? <Empty>No client approvals or outreach drafts.</Empty> : null}
            {businessApprovals.slice(0, 4).map((row) => (
              <Link key={row.id} href={row.related_prospect_id ? `/companies/${row.related_prospect_id}` : "/approvals"} className="text-sm hover:underline">
                <span className="text-muted-foreground">{row.type || "Approval"} · </span>
                {row.title}
              </Link>
            ))}
            {(drafts.data ?? []).map((row) => (
              <Link key={row.id} href={`/companies/${row.prospect_id}`} className="text-sm hover:underline">
                <span className="text-muted-foreground">Draft · </span>
                {row.subject || nestedString(row.prospects, "company") || "Outreach"}
              </Link>
            ))}
          </Queue>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href="/companies?stage=qualified" className="hover:text-foreground">
              {qualifiedCount} qualified this week
            </Link>
            <Link href="/companies" className="hover:text-foreground">
              Outreach {sent} sent · {replied} replied · {bounced} bounced
            </Link>
            <span>
              Reports {weekSent} sent · {weekReplies} replies
            </span>
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-card/60 p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-primary uppercase">Content</p>
              <h2 className="text-lg font-medium">Content engine</h2>
              <p className="text-sm text-muted-foreground">
                Buffer last 30 days
                {buffer.syncedAt ? ` · synced ${formatWhen(buffer.syncedAt)}` : ""}. Approval still does not publish.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/content" className="text-xs text-muted-foreground hover:text-foreground">
                Open content
              </Link>
              <BufferRefresh configured={buffer.configured} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric href="/content" label="Buffer views" value={compact(buffer.views)} hint={`${buffer.postCount} posts · ${buffer.engagementRate}% eng`} />
            <Metric href="/content" label="Reactions" value={compact(buffer.reactions)} hint={`${buffer.comments} comments`} />
            <Metric href="/approvals" label="In review" value={String(contentWaiting)} hint={`${postedCount.count || 0} posted this week`} />
          </div>

          <Queue title="In motion" href="/content">
            {movingRows.length === 0 ? <Empty>Nothing is being scripted, rendered, or reviewed.</Empty> : null}
            {movingRows.map((row) => {
              const script = scriptParts(row.script_json, row.caption);
              return (
                <ContentPiece
                  key={row.id}
                  id={row.id}
                  code={row.content_id}
                  title={row.title || "Untitled"}
                  status={row.status}
                  hook={script.hook || script.fullScript}
                  platforms={row.platforms}
                  agent={row.assigned_agent}
                  videoUrl={row.video_url}
                  notionUrl={row.notion_page_url}
                  links={liveLinks(row.platform_links, row.review_notes)}
                />
              );
            })}
          </Queue>

          {contentApprovals.length > 0 ? (
            <Queue title="Content approvals" href="/approvals">
              {contentApprovals.slice(0, 4).map((row) => (
                <Link key={row.id} href={row.related_content_id ? `/content/${row.related_content_id}` : "/approvals"} className="text-sm hover:underline">
                  <span className="text-muted-foreground">{row.type || "Approval"} · </span>
                  {row.title}
                </Link>
              ))}
            </Queue>
          ) : null}

          <Queue title="Live posts" href="/content?status=posted">
            {postedRows.length === 0 ? <Empty>Nothing has been marked posted.</Empty> : null}
            {postedRows.map((row) => {
              const script = scriptParts(row.script_json, row.caption);
              return (
                <ContentPiece
                  key={row.id}
                  id={row.id}
                  code={row.content_id}
                  title={row.title || "Untitled"}
                  status={row.status}
                  hook={script.hook}
                  platforms={row.platforms}
                  agent={row.assigned_agent}
                  videoUrl={row.video_url}
                  notionUrl={row.notion_page_url}
                  links={liveLinks(row.platform_links, row.review_notes)}
                />
              );
            })}
          </Queue>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/agents" className="hover:text-foreground">
          {active.length - stale} agents active · {stale} stale
        </Link>
        <span> · shared across both lines</span>
      </p>
    </div>
  );
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value || 0);
}

function Metric({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 hover:bg-muted/40">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : <p className="mt-0.5 text-xs">&nbsp;</p>}
    </Link>
  );
}

function Queue({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          Open
        </Link>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
