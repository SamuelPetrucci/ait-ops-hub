import Link from "next/link";
import { getNextFreeSlot } from "@/app/actions/mutations";
import { ContentBoard } from "@/components/boards";
import { BufferRefresh } from "@/components/buffer-refresh";
import { ContentPiece } from "@/components/content-piece";
import { PostCalendar } from "@/components/post-calendar";
import { requireOwner } from "@/lib/auth";
import { bufferConfigured, readBufferTotals } from "@/lib/buffer";
import { CONTENT_COLUMNS } from "@/lib/constants";
import { byContentRecency, liveLinks, resolveVideoUrl, scriptParts } from "@/lib/content";
import { formatWhen, nestedString } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Content" };

const STATUSES = CONTENT_COLUMNS.map(([id]) => id);

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string; niche?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status : "";
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : "";
  const niche = params.niche || "";
  const { supabase } = await requireOwner();
  const [queue, performance, buffer, suggestedTime] = await Promise.all([
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, scheduled_at, posted_at, assigned_agent, script_json, caption, video_url, storage_path, notion_page_url, platform_links, review_notes, updated_at, created_at, content_pillar",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_performance")
      .select(
        "id, platform, post_age, views, comments, shares, reach, saves, notes, measurement_date, classification, content_id, content_queue(title)",
      )
      .ilike("notes", '%"buffer_post_id"%')
      .order("measurement_date", { ascending: false })
      .order("views", { ascending: false })
      .limit(100),
    readBufferTotals(),
    getNextFreeSlot(),
  ]);
  if (queue.error) throw new Error(queue.error.message);
  if (performance.error) throw new Error(performance.error.message);

  const rawRows = [...(queue.data ?? [])].sort(byContentRecency);
  const statusCounts = new Map<string, number>();
  const nicheCounts = new Map<string, number>();
  for (const row of rawRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
    if (row.content_pillar) {
      nicheCounts.set(row.content_pillar, (nicheCounts.get(row.content_pillar) || 0) + 1);
    }
  }
  const nicheOptions = [...nicheCounts.keys()].sort();

  const rows = await Promise.all(
    rawRows.map(async (row) => ({
      ...row,
      resolvedVideoUrl: await resolveVideoUrl({
        video_url: row.video_url,
        storage_path: row.storage_path,
      }),
    }))
  );

  const visible = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (niche && row.content_pillar !== niche) return false;
    return true;
  });
  const reading = status || niche
    ? visible
    : visible
        .filter((row) => row.status !== "posted" && row.status !== "skipped" && row.status !== "rejected")
        .sort((a, b) => actionRank(a.status) - actionRank(b.status));
  const statusFilters = CONTENT_COLUMNS.filter(([id]) => id === status || (statusCounts.get(id) || 0) > 0);
  const needsSchedule = rows.filter((row) => row.status === "approved" && !row.scheduled_at).length;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <div className="panel relative overflow-hidden rounded-3xl px-5 py-5 ring-1 ring-ink/10">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">Library</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Content</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Approve, schedule with a caption, then watch performance
              {needsSchedule ? ` · ${needsSchedule} ready to schedule` : ""}
              {buffer.syncedAt ? ` · Buffer synced ${formatWhen(buffer.syncedAt)}` : ""}.
            </p>
          </div>
          <BufferRefresh configured={buffer.configured || bufferConfigured()} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Views" value={String(buffer.views || 0)} />
        <Stat label="Reactions" value={String(buffer.reactions || 0)} />
        <Stat label="Comments" value={String(buffer.comments || 0)} />
        <Stat label="Eng. rate" value={`${buffer.engagementRate || 0}%`} />
      </section>

      <div className="flex flex-wrap gap-2 pb-1">
        <Filter
          href={buildContentUrl({ month, niche })}
          active={!status}
          label="Active"
          count={rows.filter((row) => row.status !== "posted" && row.status !== "skipped").length}
        />
        {statusFilters.map(([id, label]) => (
          <Filter
            key={id}
            href={buildContentUrl({ status: id, month, niche })}
            active={status === id}
            label={label}
            count={statusCounts.get(id) || 0}
          />
        ))}
        <span className="mx-1 border-l border-foreground/10" />
        <Filter
          href={buildContentUrl({ status, month })}
          active={!niche}
          label="All niches"
          count={rows.length}
        />
        {nicheOptions.map((n) => (
          <Filter
            key={n}
            href={buildContentUrl({ status, month, niche: n })}
            active={niche === n}
            label={n}
            count={nicheCounts.get(n) || 0}
          />
        ))}
      </div>

      <PostCalendar
        items={rows}
        month={month || undefined}
        query={{ ...(status ? { status } : {}), ...(month ? { month } : {}), ...(niche ? { niche } : {}) }}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">
            {status ? "Watch & read" : "Needs attention"}
          </h2>
          {!status ? (
            <Link href="/approvals" className="text-xs text-signal hover:underline">
              Open approvals
            </Link>
          ) : null}
        </div>
        {reading.length === 0 ? <p className="text-sm text-ink-soft">Nothing in this status.</p> : null}
        <div className="flex flex-col gap-3">
          {(status || niche ? reading : reading.slice(0, 8)).map((row) => {
            const script = scriptParts(row.script_json, row.caption);
            return (
              <ContentPiece
                key={row.id}
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
                niche={row.content_pillar}
              />
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Move status</h2>
        <ContentBoard
          items={reading.map((row) => {
            const script = scriptParts(row.script_json, row.caption);
            const hook = script.hook.length > 90 ? `${script.hook.slice(0, 90)}…` : script.hook;
            return {
              id: row.id,
              column: row.status,
              title: row.title || "Untitled",
              href: `/content/${row.id}`,
              meta: [row.content_id, hook].filter(Boolean).join(" · "),
            };
          })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Post stats</h2>
        {(performance.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matched Buffer rows yet. Totals above still come from the org snapshot.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Reactions</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Eng %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(performance.data ?? []).map((row) => {
                const title = nestedString(row.content_queue, "title");
                const extra = parseNotes(row.notes);
                const href = row.content_id ? `/content/${row.content_id}` : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {title || extra.code || "Untitled"}
                        </Link>
                      ) : (
                        extra.code || title || "Untitled"
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{row.platform}</TableCell>
                    <TableCell>{row.post_age ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.views ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{extra.reactions ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.comments ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {extra.engagement_rate_pct == null ? "—" : `${extra.engagement_rate_pct}%`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function actionRank(status: string) {
  if (status === "in_review") return 0;
  if (status === "approved") return 1;
  if (status === "scheduled") return 2;
  if (status === "changes_requested") return 3;
  return 4;
}

function buildContentUrl({ status, month, niche }: { status?: string; month?: string; niche?: string }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (month) params.set("month", month);
  if (niche) params.set("niche", niche);
  const query = params.toString();
  return query ? `/content?${query}` : "/content";
}

function Filter({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs ring-1 ${
        active
          ? "bg-ink text-paper ring-ink"
          : "bg-white/50 text-ink-soft ring-ink/10 hover:text-ink"
      }`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/55 px-4 py-4 ring-1 ring-ink/10">
      <p className="text-[11px] tracking-[0.14em] text-ink-soft uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function parseNotes(value: unknown) {
  if (typeof value !== "string" || !value) {
    return {} as { code?: string; reactions?: number; engagement_rate_pct?: number };
  }
  try {
    return JSON.parse(value) as { code?: string; reactions?: number; engagement_rate_pct?: number };
  } catch {
    return {};
  }
}
