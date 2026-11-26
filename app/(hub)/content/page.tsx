import Link from "next/link";
import { getNextFreeSlot } from "@/app/actions/mutations";
import { BufferRefresh } from "@/components/buffer-refresh";
import { NicheFilterSelect } from "@/components/content-filters";
import { ContentDesk, DayPosts, type DeskItem } from "@/components/content-desk";
import { PostCalendar } from "@/components/post-calendar";
import { requireOwner } from "@/lib/auth";
import {
  bufferConfigured,
  fetchBufferCalendarPosts,
  readBufferTotals,
  syncContentPostedFromBuffer,
} from "@/lib/buffer";
import { byContentRecency, ideaSources, resolveVideoUrl, rollUpViews, scriptParts } from "@/lib/content";
import { channelKey, channelLabel, formatCount, formatNyDate, formatNyTime, formatWhen, nestedString, nyDateKey, nyToday } from "@/lib/format";
import {
  CONTENT_GROUP_ORDER,
  CONTENT_STATUS_GROUPS,
  getContentGroupFromStatus,
  type ContentStatusGroup,
} from "@/lib/status-groups";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Content" };

const FILTER_GROUPS = CONTENT_GROUP_ORDER.filter(
  (group): group is Exclude<ContentStatusGroup, "rejected"> => group !== "rejected",
);

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; month?: string; niche?: string; day?: string; channel?: string }>;
}) {
  const params = await searchParams;
  const group = (FILTER_GROUPS as string[]).includes(params.group || "")
    ? (params.group as Exclude<ContentStatusGroup, "rejected">)
    : "";
  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : nyToday().slice(0, 7);
  const niche = params.niche || "";
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : "";
  const channel = params.channel || "";
  const { supabase } = await requireOwner();
  // Pull Buffer "sent" into content_queue as posted before we render the desk.
  await syncContentPostedFromBuffer().catch(() => ({ markedPosted: 0 }));
  const [queue, performance, buffer, suggestedTime, bufferCalendar] = await Promise.all([
    supabase
      .from("content_queue")
      .select(
        "id, content_id, title, status, platforms, scheduled_at, posted_at, assigned_agent, script_json, caption, video_url, storage_path, notion_page_url, platform_links, review_notes, source_urls, updated_at, created_at, content_pillar",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_performance")
      .select(
        "id, platform, post_age, views, comments, shares, reach, saves, notes, measurement_date, classification, content_id, content_queue(title)",
      )
      .order("measurement_date", { ascending: false })
      .order("views", { ascending: false })
      .limit(500),
    readBufferTotals(),
    getNextFreeSlot(),
    fetchBufferCalendarPosts(month).catch(() => []),
  ]);
  if (queue.error) throw new Error(queue.error.message);
  if (performance.error) throw new Error(performance.error.message);

  const viewRollup = rollUpViews(performance.data ?? []);
  const rawRows = [...(queue.data ?? [])].sort(byContentRecency);
  const groupCounts = new Map<ContentStatusGroup, number>();
  const nicheCounts = new Map<string, number>();
  for (const row of rawRows) {
    const bucket = getContentGroupFromStatus(row.status);
    groupCounts.set(bucket, (groupCounts.get(bucket) || 0) + 1);
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
    })),
  );

  const visible = rows.filter((row) => {
    if (group && getContentGroupFromStatus(row.status) !== group) return false;
    if (niche && row.content_pillar !== niche) return false;
    return true;
  });
  const needsAttentionCount = rows.filter((row) => {
    const bucket = getContentGroupFromStatus(row.status);
    return bucket === "needs_review" || bucket === "approved" || bucket === "in_progress";
  }).length;
  const needsSchedule = rows.filter((row) => row.status === "approved" && !row.scheduled_at).length;
  const byCode = new Map(
    rows
      .filter((row) => row.content_id)
      .map((row) => [String(row.content_id).toUpperCase(), row.id] as const),
  );
  const resultRows = [...viewRollup.entries()]
    .map(([id, views]) => {
      const piece = rows.find((row) => row.id === id);
      const perf = (performance.data ?? []).find((row) => row.content_id === id);
      const ideas = piece ? ideaSources(piece.source_urls, piece.script_json) : [];
      const channels = views.channels.length
        ? views.channels.map((channel) => ({
            label: channelLabel(channel.channel),
            views: channel.views,
          }))
        : (piece?.platforms || []).map((platform: string) => ({
            label: channelLabel(platform),
            views: 0,
          }));
      return {
        id,
        title: piece?.title || nestedString(perf?.content_queue, "title") || "Untitled",
        code: piece?.content_id ?? null,
        postedAt: piece?.posted_at ?? null,
        scheduledAt: piece?.scheduled_at ?? null,
        channels,
        views,
        idea: ideas[0] ?? null,
      };
    })
    .sort((a, b) => b.views.total - a.views.total);
  const shownResults = resultRows.filter((row) => {
    if (day && nyDateKey(row.postedAt || row.scheduledAt) !== day) return false;
    if (channel && !row.channels.some((entry: { label: string }) => channelKey(entry.label) === channel)) return false;
    return true;
  });

  const deskPool = (group ? visible : rows).filter((row) => !niche || row.content_pillar === niche);
  const deskItems = deskPool
    .map((row) => toDeskItem(row, suggestedTime, viewRollup.get(row.id) ?? null))
    .filter((item): item is DeskItem => Boolean(item));
  const deskLanes = buildDeskLanes(deskItems, { group, month, niche, day, channel, preview: group ? deskItems.length : 8 });

  const calendarItems = bufferCalendar.map((item) => ({
    id: item.id,
    content_id: item.content_id,
    title: item.title,
    status: item.status,
    platforms: item.platforms,
    scheduled_at: item.scheduled_at,
    posted_at: item.posted_at,
    content_queue_id: queueIdForCode(byCode, item.content_id),
  }));
  const dayItems = day
    ? rows
        .filter((row) => !niche || row.content_pillar === niche)
        .filter((row) => !group || getContentGroupFromStatus(row.status) === group)
        .map((row) => {
          const item = toDeskItem(row, suggestedTime, viewRollup.get(row.id) ?? null, true);
          if (!item || nyDateKey(item.postedAt || item.scheduledAt) !== day) return null;
          const postedOn = channelsForDay(calendarItems, row.id, row.content_id, day);
          return { ...item, platforms: postedOn.length ? postedOn : item.platforms };
        })
        .filter((item): item is DeskItem => Boolean(item))
        .sort((a, b) => String(a.postedAt || a.scheduledAt).localeCompare(String(b.postedAt || b.scheduledAt)))
    : [];
  const dayChannels = channelChoices(dayItems, { group, month, niche, day });
  const dayChannel = dayChannels.some((entry) => entry.key === channel) ? channel : "";
  const visibleDayItems = dayChannel
    ? dayItems.filter((item) => item.platforms.some((platform) => channelKey(platform) === dayChannel))
    : dayItems;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <div className="panel relative overflow-hidden rounded-3xl px-5 py-5 ring-1 ring-ink/10">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
          <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">Desk</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Content</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Review what is waiting, what Grok can post, and what is already scheduled
              {needsSchedule ? ` · ${needsSchedule} cleared and not scheduled` : ""}
              {buffer.syncedAt ? ` · synced ${formatWhen(buffer.syncedAt)}` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/references"
              className="inline-flex h-9 items-center rounded-full bg-ink/5 px-3.5 text-sm text-ink ring-1 ring-ink/10 hover:bg-ink/10"
            >
              References
            </Link>
            <BufferRefresh configured={buffer.configured || bufferConfigured()} />
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Views" value={String(buffer.views || 0)} />
        <Stat label="Reactions" value={String(buffer.reactions || 0)} />
        <Stat label="Comments" value={String(buffer.comments || 0)} />
        <Stat label="Eng. rate" value={`${buffer.engagementRate || 0}%`} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Filter
          href={buildContentUrl({ month, niche, day, channel })}
          active={!group}
          label="Needs attention"
          count={needsAttentionCount}
        />
        {FILTER_GROUPS.map((id) => (
          <Filter
            key={id}
            href={buildContentUrl({ group: id, month, niche, day, channel })}
            active={group === id}
            label={CONTENT_STATUS_GROUPS[id].label}
            count={groupCounts.get(id) || 0}
          />
        ))}
        {nicheOptions.length > 0 ? (
          <NicheFilterSelect
            month={month}
            group={group}
            niche={niche}
            day={day}
            channel={channel}
            options={nicheOptions}
          />
        ) : null}
      </div>

      <PostCalendar
        items={calendarItems}
        month={month}
        selectedDay={day}
        source="buffer"
        configured={buffer.configured || bufferConfigured()}
        query={{
          ...(group ? { group } : {}),
          month,
          ...(niche ? { niche } : {}),
          ...(day ? { day } : {}),
          ...(channel ? { channel } : {}),
        }}
      />

      {day ? (
        <DayPosts
          dayLabel={formatNyDate(day)}
          channels={dayChannels}
          activeChannel={dayChannel}
          items={visibleDayItems}
        />
      ) : group === "posted" ? null : (
        <ContentDesk lanes={deskLanes} />
      )}

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium">Results</h2>
          <p className="text-xs text-muted-foreground">
            Channel, when it went up, views, and the idea link for pieces with a view check.
          </p>
        </div>
        {shownResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No view checks yet. Totals above still come from the org snapshot.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Idea</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownResults.map((row) => {
                const when = row.postedAt || row.scheduledAt;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/content/${row.id}`} className="hover:underline">
                        {row.title}
                      </Link>
                      {row.code ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{row.code}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.channels.length ? (
                        <span className="flex flex-col gap-0.5">
                          {row.channels.map((channel: { label: string; views: number }, index: number) => (
                            <span key={`${channel.label}-${index}`} className="text-sm">
                              {channel.label}
                              <span className="tabular-nums text-muted-foreground">
                                {" "}
                                {formatCount(channel.views)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatNyDate(when)}</TableCell>
                    <TableCell className="tabular-nums">{formatNyTime(when)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCount(row.views.total)}
                      {row.views.up != null ? (
                        <span className="mt-0.5 block text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          ↑ {formatCount(row.views.up)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.idea ? (
                        <a href={row.idea.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {row.idea.label}
                        </a>
                      ) : (
                        "—"
                      )}
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

function deskLane(row: { status: string; scheduled_at: string | null }): DeskItem["lane"] | null {
  if (row.status === "posted" || row.status === "skipped" || row.status === "rejected") return null;
  if (row.status === "scheduled" || (row.status === "approved" && row.scheduled_at)) return "out";
  if (row.status === "approved") return "cleared";
  if (row.status === "idea" || row.status === "scripting" || row.status === "rendering") return "agent";
  return "before";
}

function toDeskItem(
  row: {
    id: string;
    content_id: string | null;
    title: string | null;
    status: string;
    platforms: string[] | null;
    scheduled_at: string | null;
    posted_at: string | null;
    assigned_agent: string | null;
    script_json: unknown;
    caption: string | null;
    content_pillar: string | null;
    source_urls: unknown;
    resolvedVideoUrl: string | null;
  },
  suggestedTime: string,
  views: DeskItem["views"],
  includeLive = false,
): DeskItem | null {
  const lane = deskLane(row) || (includeLive && row.status === "posted" ? "live" : null);
  if (!lane) return null;
  const script = scriptParts(row.script_json, row.caption);
  return {
    id: row.id,
    code: row.content_id,
    title: row.title || "Untitled",
    status: row.status,
    hook: script.hook,
    caption: script.caption,
    platforms: row.platforms || [],
    agent: row.assigned_agent,
    videoUrl: row.resolvedVideoUrl,
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    niche: row.content_pillar,
    ideas: ideaSources(row.source_urls, row.script_json),
    views,
    suggestedTime,
    lane,
  };
}

function buildDeskLanes(
  items: DeskItem[],
  query: { group: string; month: string; niche: string; day: string; channel: string; preview: number },
) {
  const order = ["before", "cleared", "out", "agent"] as const;
  const rank: Record<string, number> = {
    in_review: 0,
    changes_requested: 1,
    scripting: 2,
    rendering: 3,
    idea: 4,
  };
  return order
    .map((kind) => {
      const all = items
        .filter((item) => item.lane === kind)
        .sort((a, b) => {
          if (kind === "out") return String(a.scheduledAt || "").localeCompare(String(b.scheduledAt || ""));
          return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        });
      const shown = query.group ? all : all.slice(0, query.preview);
      const moreGroup =
        kind === "before" ? "needs_review" : kind === "agent" ? "in_progress" : kind === "cleared" ? "approved" : "scheduled";
      return {
        kind,
        items: shown,
        total: all.length,
        moreHref:
          !query.group && all.length > shown.length
            ? buildContentUrl({
                group: moreGroup,
                month: query.month,
                niche: query.niche,
                day: query.day,
                channel: query.channel,
              })
            : undefined,
      };
    })
    .filter((lane) => (query.group ? lane.total > 0 : true));
}

function queueIdForCode(byCode: Map<string, string>, code: string | null) {
  if (!code) return null;
  const exact = byCode.get(code.toUpperCase());
  if (exact) return exact;
  const prefix = `${code.toUpperCase()}_`;
  const hits = [...byCode.entries()].filter(([id]) => id.startsWith(prefix));
  return hits.length === 1 ? hits[0][1] : null;
}

function codesMatch(bufferCode: string | null | undefined, queueCode: string | null) {
  if (!bufferCode || !queueCode) return false;
  const buffer = bufferCode.toUpperCase();
  const queue = queueCode.toUpperCase();
  return queue === buffer || queue.startsWith(`${buffer}_`) || queue.startsWith(`${buffer}-`);
}

function channelsForDay(
  items: { content_id?: string | null; content_queue_id?: string | null; platforms?: string[] | null; scheduled_at?: string | null; posted_at?: string | null }[],
  queueId: string,
  code: string | null,
  day: string,
) {
  const names = new Set<string>();
  for (const item of items) {
    const when = nyDateKey(item.posted_at || item.scheduled_at);
    if (when !== day) continue;
    const sameQueue = item.content_queue_id === queueId;
    const sameCode = codesMatch(item.content_id, code);
    if (!sameQueue && !sameCode) continue;
    for (const platform of item.platforms || []) names.add(platform);
  }
  return [...names];
}

function channelChoices(
  items: DeskItem[],
  query: { group: string; month: string; niche: string; day: string },
) {
  const order = ["youtube", "instagram", "tiktok", "facebook", "linkedin", "x", "threads"];
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const platform of item.platforms) {
      const key = channelKey(platform);
      if (!key || key === "channel" || seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key) || { label: channelLabel(platform), count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  const keys = [...counts.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  return [
    {
      key: "all",
      label: "All channels",
      count: items.length,
      href: buildContentUrl({ ...query, channel: "" }),
    },
    ...keys.map((key) => ({
      key,
      label: counts.get(key)?.label || key,
      count: counts.get(key)?.count || 0,
      href: buildContentUrl({ ...query, channel: key }),
    })),
  ];
}

function buildContentUrl({
  group,
  month,
  niche,
  day,
  channel,
}: {
  group?: string;
  month?: string;
  niche?: string;
  day?: string;
  channel?: string;
}) {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  if (month) params.set("month", month);
  if (day) params.set("day", day);
  if (channel) params.set("channel", channel);
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

