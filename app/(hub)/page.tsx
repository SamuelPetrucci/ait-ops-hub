import Link from "next/link";
import type { ReactNode } from "react";
import { getNextFreeSlot } from "@/app/actions/mutations";
import { BufferRefresh } from "@/components/buffer-refresh";
import { ContentPiece } from "@/components/content-piece";
import { SiteLink } from "@/components/site-link";
import { TopTrends } from "@/components/top-trends";
import { requireOwner } from "@/lib/auth";
import { readBufferTotals } from "@/lib/buffer";
import { byContentRecency, liveLinks, resolveVideoUrl, scriptParts } from "@/lib/content";
import { addDays, formatWhen, nyToday } from "@/lib/format";
import { LEAD_STAGES } from "@/lib/prospects";
import { orderTopTrends } from "@/lib/trends";

export const metadata = { title: "Overview" };

const IN_MOTION = ["scripting", "rendering", "in_review", "changes_requested", "approved"];

export default async function OverviewPage() {
  const { supabase } = await requireOwner();
  const today = nyToday();

  const upcomingUntil = `${addDays(today, 14)}T23:59:59Z`;

  const [followUps, leadCount, clientCount, moving, posted, upcoming, inReview, buffer, liveTrends] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, company, website, next_follow_up_due, stage, industry")
      .in("stage", [...LEAD_STAGES])
      .not("next_follow_up_due", "is", null)
      .lte("next_follow_up_due", today)
      .order("next_follow_up_due", { ascending: true })
      .limit(8),
    supabase.from("prospects").select("id", { count: "exact", head: true }).in("stage", [...LEAD_STAGES]),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .in("stage", ["audit_paid", "won", "delivered"]),
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, assigned_agent, script_json, caption, video_url, storage_path, notion_page_url, platform_links, review_notes, updated_at, created_at, scheduled_at, posted_at",
      )
      .in("status", IN_MOTION)
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, assigned_agent, script_json, caption, video_url, storage_path, notion_page_url, platform_links, review_notes, posted_at, updated_at, created_at, scheduled_at",
      )
      .eq("status", "posted")
      .order("posted_at", { ascending: false }),
    supabase
      .from("content_queue")
      .select("id, content_id, title, status, scheduled_at, platforms")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", `${today}T00:00:00Z`)
      .lte("scheduled_at", upcomingUntil)
      .neq("status", "skipped")
      .order("scheduled_at", { ascending: true })
      .limit(8),
    supabase.from("content_queue").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    readBufferTotals(),
    supabase
      .from("trends")
      .select("id, detected_at, topic, niche, status, heat_score")
      .neq("status", "expired")
      .order("detected_at", { ascending: false })
      .limit(5),
  ]);

  for (const result of [followUps, moving, posted, upcoming, liveTrends]) {
    if (result.error) throw new Error(result.error.message);
  }

  const dueRows = followUps.data ?? [];
  const rawMovingRows = [...(moving.data ?? [])].sort(byContentRecency).slice(0, 5);
  const rawPostedRows = [...(posted.data ?? [])].sort(byContentRecency).slice(0, 6);
  const upcomingRows = upcoming.data ?? [];

  const [movingRows, postedRows, suggestedTime] = await Promise.all([
    Promise.all(
      rawMovingRows.map(async (row) => ({
        ...row,
        resolvedVideoUrl: await resolveVideoUrl({
          video_url: row.video_url,
          storage_path: row.storage_path,
        }),
      }))
    ),
    Promise.all(
      rawPostedRows.map(async (row) => ({
        ...row,
        resolvedVideoUrl: await resolveVideoUrl({
          video_url: row.video_url,
          storage_path: row.storage_path,
        }),
      }))
    ),
    getNextFreeSlot(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="panel relative overflow-hidden rounded-3xl px-5 py-6 ring-1 ring-ink/10 md:px-7 md:py-8">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
        <div className="relative">
          <p className="text-[11px] tracking-[0.18em] text-signal uppercase">AI Transformation</p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            What needs you today
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft md:text-base">
            Approve clips, schedule with captions, and keep the pipeline moving.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill href="/approvals">{inReview.count || 0} in review</Pill>
            <Pill href="/leads?followUp=due">{dueRows.length} follow-ups</Pill>
            <Pill href="/content?status=approved">Ready to schedule</Pill>
            <Pill href="/content">Content desk</Pill>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric href="/leads" label="Leads" value={String(leadCount.count || 0)} hint="Open pipeline" />
        <Metric href="/leads?followUp=due" label="Due now" value={String(dueRows.length)} hint="Follow-ups" />
        <Metric href="/clients" label="Clients" value={String(clientCount.count || 0)} hint="Won / paid / delivered" />
        <Metric
          href="/content"
          label="Buffer views"
          value={compact(buffer.views)}
          hint={`${buffer.engagementRate}% eng`}
          hintLink={inReview.count ? { href: "/approvals", text: `${inReview.count} in review` } : undefined}
        />
      </section>

      <TopTrends trends={orderTopTrends(liveTrends.data ?? [])} />

      <div className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl bg-card/50 p-5 ring-1 ring-foreground/10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Pipeline</p>
              <h2 className="text-lg font-medium">Follow-ups due</h2>
            </div>
            <Link href="/leads" className="text-xs text-muted-foreground transition hover:text-foreground">
              All leads
            </Link>
          </div>
          {dueRows.length === 0 ? (
            <p className="rounded-2xl bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing due. Pipeline is clear.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dueRows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/companies/${row.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-background/35 px-3.5 py-3 transition hover:bg-background/55"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.company}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <SiteLink website={row.website} />
                        <span>{row.industry || "Lead"}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-amber-300/90">{formatWhen(row.next_follow_up_due)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-card/50 p-5 ring-1 ring-foreground/10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Content</p>
              <h2 className="text-lg font-medium">Watch and read on site</h2>
              <p className="text-sm text-muted-foreground">
                Buffer last 30 days
                {buffer.syncedAt ? ` · synced ${formatWhen(buffer.syncedAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/content" className="text-xs text-muted-foreground transition hover:text-foreground">
                Content desk
              </Link>
              <BufferRefresh configured={buffer.configured} />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            <MiniStat label="Views" value={compact(buffer.views)} />
            <MiniStat label="Reactions" value={compact(buffer.reactions)} />
            <MiniStat label="Eng %" value={`${buffer.engagementRate || 0}`} />
          </div>

          {upcomingRows.length > 0 ? (
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Coming up</h3>
                <Link href="/content" className="text-xs text-muted-foreground hover:text-foreground">
                  Full calendar
                </Link>
              </div>
              <ul className="flex flex-col gap-1.5">
                {upcomingRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/content/${row.id}`}
                      className="flex items-baseline justify-between gap-3 rounded-xl bg-background/35 px-3 py-2 text-sm transition hover:bg-background/55"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{row.title || "Untitled"}</span>
                        {row.content_id ? (
                          <span className="ml-2 text-xs text-muted-foreground">{row.content_id}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-sky-200/90">{formatWhen(row.scheduled_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-medium">In motion</h3>
                <Link href="/content" className="text-xs text-muted-foreground hover:text-foreground">
                  Open
                </Link>
              </div>
              {movingRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing being scripted or reviewed.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {movingRows.map((row) => {
                    const script = scriptParts(row.script_json, row.caption);
                    return (
                      <ContentPiece
                        key={row.id}
                        compact
                        id={row.id}
                        code={row.content_id}
                        title={row.title || "Untitled"}
                        status={row.status}
                        hook={script.hook || script.fullScript}
                        caption={script.caption}
                        platforms={row.platforms}
                        agent={row.assigned_agent}
                        videoUrl={row.resolvedVideoUrl}
                        notionUrl={row.notion_page_url}
                        links={liveLinks(row.platform_links, row.review_notes)}
                        scheduledAt={row.scheduled_at}
                        suggestedTime={suggestedTime}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {postedRows.length > 0 ? (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-medium">Posted — view here</h3>
                  <Link href="/content?status=posted" className="text-xs text-muted-foreground hover:text-foreground">
                    All posted
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {postedRows.map((row) => {
                    const script = scriptParts(row.script_json, row.caption);
                    return (
                      <ContentPiece
                        key={row.id}
                        compact
                        id={row.id}
                        code={row.content_id}
                        title={row.title || "Untitled"}
                        status={row.status}
                        hook={script.hook}
                        caption={script.caption}
                        platforms={row.platforms}
                        agent={row.assigned_agent}
                        videoUrl={row.resolvedVideoUrl}
                        notionUrl={row.notion_page_url}
                        links={liveLinks(row.platform_links, row.review_notes)}
                        scheduledAt={row.scheduled_at}
                        suggestedTime={suggestedTime}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
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
  hintLink,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
  hintLink?: { href: string; text: string };
}) {
  return (
    <div className="rounded-3xl bg-card/70 px-4 py-4 ring-1 ring-foreground/10 transition hover:bg-card hover:ring-foreground/20">
      <Link href={href} className="block">
        <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-2xl font-medium tracking-tight tabular-nums md:text-3xl">{value}</p>
      </Link>
      {hint || hintLink ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {hint ? <Link href={href}>{hint}</Link> : null}
          {hint && hintLink ? " · " : ""}
          {hintLink ? (
            <Link href={hintLink.href} className="text-signal hover:underline">
              {hintLink.text}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/40 px-3 py-2.5">
      <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Pill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper transition hover:bg-ink/90"
    >
      {children}
    </Link>
  );
}
