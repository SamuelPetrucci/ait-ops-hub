import Link from "next/link";
import { ContentBoard } from "@/components/boards";
import { BufferRefresh } from "@/components/buffer-refresh";
import { ContentPiece } from "@/components/content-piece";
import { requireOwner } from "@/lib/auth";
import { bufferConfigured, readBufferTotals } from "@/lib/buffer";
import { CONTENT_COLUMNS } from "@/lib/constants";
import { byContentRecency, liveLinks, scriptParts } from "@/lib/content";
import { formatWhen, labelize, nestedString } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Content" };

const STATUSES = CONTENT_COLUMNS.map(([id]) => id);

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status : "";
  const { supabase } = await requireOwner();
  const [queue, performance, buffer] = await Promise.all([
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, scheduled_at, posted_at, assigned_agent, script_json, caption, video_url, notion_page_url, platform_links, review_notes, updated_at, created_at",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_performance")
      .select(
        "id, platform, post_age, views, comments, shares, reach, saves, notes, measurement_date, classification, content_id, content_queue(title)",
      )
      .ilike("notes", "%\"buffer_post_id\"%")
      .order("measurement_date", { ascending: false })
      .order("views", { ascending: false })
      .limit(100),
    readBufferTotals(),
  ]);
  if (queue.error) throw new Error(queue.error.message);
  if (performance.error) throw new Error(performance.error.message);

  const rows = [...(queue.data ?? [])].sort(byContentRecency);
  const visible = status ? rows.filter((row) => row.status === status) : rows;
  const reading = status ? visible : visible.filter((row) => row.status !== "posted" && row.status !== "skipped");
  const calendar = rows
    .filter((row) => row.scheduled_at || row.posted_at)
    .map((row) => ({
      id: row.id,
      title: row.title || "Untitled",
      when: row.posted_at || row.scheduled_at,
      platforms: (row.platforms || []).join(", "),
      status: row.status,
    }))
    .sort((a, b) => String(b.when).localeCompare(String(a.when)));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Content</h1>
          <p className="text-sm text-muted-foreground">
            Scripts and live posts, plus Buffer analytics for the last 30 days
            {buffer.syncedAt ? ` (synced ${formatWhen(buffer.syncedAt)})` : ""}.
          </p>
        </div>
        <BufferRefresh configured={buffer.configured || bufferConfigured()} />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Views" value={String(buffer.views || 0)} />
        <Stat label="Reactions" value={String(buffer.reactions || 0)} />
        <Stat label="Comments" value={String(buffer.comments || 0)} />
        <Stat label="Eng. rate" value={`${buffer.engagementRate || 0}%`} />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Filter href="/content" active={!status} label="All" count={rows.length} />
        {CONTENT_COLUMNS.map(([id, label]) => (
          <Filter
            key={id}
            href={`/content?status=${id}`}
            active={status === id}
            label={label}
            count={rows.filter((row) => row.status === id).length}
          />
        ))}
      </div>

      <section className="grid gap-3">
        {reading.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this status.</p> : null}
        {reading.map((row) => {
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Board</h2>
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
        <h2 className="text-sm font-medium">Buffer performance</h2>
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
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.content_id ? (
                        <Link href={`/content/${row.content_id}`} className="hover:underline">
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Posting calendar</h2>
        {calendar.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled or posted.</p> : null}
        <ul className="flex flex-col gap-2">
          {calendar.map((item) => (
            <li key={item.id}>
              <Link
                href={`/content/${item.id}`}
                className="block rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 hover:bg-muted/40"
              >
                <span className="text-muted-foreground">{formatWhen(item.when)}</span> · {item.title}
                <span className="text-muted-foreground">
                  {" "}
                  · {item.platforms || "No platform"} · {labelize(item.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
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
      className={`shrink-0 rounded-full px-3 py-1 text-xs ring-1 ring-foreground/10 ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
    </div>
  );
}

function parseNotes(value: unknown) {
  if (typeof value !== "string" || !value) return {} as { code?: string; reactions?: number; engagement_rate_pct?: number };
  try {
    return JSON.parse(value) as { code?: string; reactions?: number; engagement_rate_pct?: number };
  } catch {
    return {};
  }
}
