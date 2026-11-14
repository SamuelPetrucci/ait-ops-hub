import { Stat } from "@/components/stat";
import { requireOwner } from "@/lib/auth";
import { GOAL_DATE, OPEN_DEAL_STATUSES, REVENUE_GOAL, REVENUE_STRETCH } from "@/lib/constants";
import { daysUntil, money, nyToday, weekStart } from "@/lib/format";

export const metadata = { title: "Overview" };

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
    followToday,
    followOverdue,
    approvals,
    drafts,
    inReview,
    posted,
    agents,
    metrics,
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
      .select("id", { count: "exact", head: true })
      .eq("next_follow_up_due", today),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .lt("next_follow_up_due", today),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("outreach_messages")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending_approval", "held"]),
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
  ]);

  for (const result of [payments, scorecard, deals, qualified, outreach, agents, metrics]) {
    if ("error" in result && result.error) throw new Error(result.error.message);
  }

  const collected = (payments.data ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
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
  const waiting = (approvals.count || 0) + (drafts.count || 0) + (inReview.count || 0);
  const active = (agents.data ?? []).filter((row) => row.status === "active");
  const stale = active.filter((row) => !row.last_active_at || row.last_active_at < staleBefore).length;
  const reported = scorecard.data?.revenue_collected;
  const left = daysUntil(GOAL_DATE, today);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Today</h1>
        <p className="text-sm text-muted-foreground">
          {left >= 0 ? `${left} days to the Nov 24 goal.` : "The Nov 24 goal date has passed."} Payments recorded in
          the hub are the collection number. The latest scorecard is shown beside it.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/revenue"
          label="Collected vs $5,000"
          value={money(collected)}
          hint={`${Math.round((collected / REVENUE_GOAL) * 100)}% of goal · stretch ${money(REVENUE_STRETCH)} · scorecard ${money(reported)}`}
        />
        <Stat
          href="/pipeline"
          label="Open pipeline"
          value={money(pipeline)}
          hint={`Weighted ${money(weighted)}`}
        />
        <Stat href="/companies?stage=qualified" label="New qualified this week" value={String(qualifiedCount)} hint="Sum of agent daily reports" />
        <Stat
          href="/companies"
          label="Outreach sent / replied / bounced"
          value={`${sent} / ${replied} / ${bounced}`}
          hint={`Reports this week: ${weekSent} sent, ${weekReplies} replies`}
        />
        <Stat
          href="/follow-ups"
          label="Follow-ups due today"
          value={String(followToday.count || 0)}
          hint={`${followOverdue.count || 0} overdue`}
        />
        <Stat href="/approvals" label="Approvals waiting" value={String(waiting)} hint="Approvals, drafts, and content in review" />
        <Stat href="/content" label="Content posted this week" value={String(posted.count || 0)} />
        <Stat
          href="/agents"
          label="Agents active / stale"
          value={`${active.length - stale} / ${stale}`}
          hint="Stale means no activity for 48 hours"
        />
      </section>
    </div>
  );
}
