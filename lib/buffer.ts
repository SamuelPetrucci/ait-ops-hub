import "server-only";
import { createAdmin } from "@/lib/supabase/admin";
import { nyToday } from "@/lib/format";

const BUFFER_API = "https://api.buffer.com";
/** Matches VD-REACT-09 / SC-005 in video URLs; underscore after the code is fine (no trailing \\b). */
const CODE_RE = /\b((?:VD|SC)-[A-Z0-9]+(?:-\d+)?)/i;

export type BufferMetric = {
  type: string;
  name?: string;
  value: number;
  unit?: string;
};

export type BufferPost = {
  id: string;
  text: string | null;
  sentAt: string | null;
  dueAt: string | null;
  channelId: string;
  channelService: string;
  metrics: BufferMetric[] | null;
  metricsUpdatedAt: string | null;
  assets: { source?: string | null }[] | null;
};

export type BufferTotals = {
  postCount: number;
  views: number;
  reactions: number;
  comments: number;
  engagementRate: number;
  metricsUpdatedAt: string | null;
  syncedAt: string | null;
  configured: boolean;
};

export function bufferConfigured() {
  return Boolean(process.env.BUFFER_API_KEY?.trim());
}

export function bufferOrgId() {
  return process.env.BUFFER_ORGANIZATION_ID?.trim() || "6ae5ef2ae4504097267f8cd4";
}

export async function bufferGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const key = process.env.BUFFER_API_KEY?.trim();
  if (!key) throw new Error("Set BUFFER_API_KEY on the server (Buffer → Settings → API).");
  const response = await fetch(BUFFER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Buffer API ${response.status}`);
  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join("; "));
  if (!payload.data) throw new Error("Buffer returned no data.");
  return payload.data;
}

export async function fetchBufferAggregate(days = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const data = await bufferGraphQL<{
    aggregatedPostMetrics: { metrics: BufferMetric[]; metricsUpdatedAt: string | null };
  }>(
    `query Aggregate($input: AggregatedPostMetricsInput!) {
      aggregatedPostMetrics(input: $input) {
        metrics { type name value unit }
        metricsUpdatedAt
      }
    }`,
    {
      input: {
        organizationId: bufferOrgId(),
        startDateTime: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
        endDateTime: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
      },
    },
  );
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    metrics: data.aggregatedPostMetrics.metrics || [],
    metricsUpdatedAt: data.aggregatedPostMetrics.metricsUpdatedAt,
  };
}

type BufferPostNode = {
  id: string;
  text: string | null;
  status?: string | null;
  sentAt: string | null;
  dueAt: string | null;
  channelId: string;
  metrics: BufferMetric[] | null;
  metricsUpdatedAt: string | null;
  assets: { source?: string | null }[] | null;
};

async function bufferChannelServiceMap() {
  const channels = await bufferGraphQL<{
    channels: { id: string; service: string; name?: string | null }[];
  }>(
    `query Channels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id
        service
        name
      }
    }`,
    { organizationId: bufferOrgId() },
  ).catch(() => ({ channels: [] as { id: string; service: string; name?: string | null }[] }));

  return new Map((channels.channels || []).map((row) => [row.id, row]));
}

async function fetchBufferPostsPage(input: {
  status: Array<"scheduled" | "sent" | "sending" | "error">;
  first?: number;
  dueAt?: { start?: string; end?: string };
  sortDirection?: "asc" | "desc";
}): Promise<BufferPost[]> {
  const serviceById = await bufferChannelServiceMap();
  const data = await bufferGraphQL<{
    posts: { edges: { node: BufferPostNode }[] };
  }>(
    `query CalendarPosts(
      $organizationId: OrganizationId!
      $first: Int!
      $status: [PostStatus!]
      $dueAt: DateTimeComparator
      $direction: SortDirection!
    ) {
      posts(
        first: $first
        input: {
          organizationId: $organizationId
          filter: { status: $status, dueAt: $dueAt }
          sort: [{ field: dueAt, direction: $direction }]
        }
      ) {
        edges {
          node {
            id
            text
            status
            sentAt
            dueAt
            channelId
            metrics { type name value unit }
            metricsUpdatedAt
            assets {
              ... on VideoAsset { source }
              ... on ImageAsset { source }
            }
          }
        }
      }
    }`,
    {
      organizationId: bufferOrgId(),
      first: input.first ?? 100,
      status: input.status,
      dueAt: input.dueAt ?? null,
      direction: input.sortDirection ?? "asc",
    },
  );

  return (data.posts.edges || []).map((edge) => {
    const channel = serviceById.get(edge.node.channelId);
    return {
      id: edge.node.id,
      text: edge.node.text,
      sentAt: edge.node.sentAt,
      dueAt: edge.node.dueAt,
      channelId: edge.node.channelId,
      channelService: channel?.service || "unknown",
      metrics: edge.node.metrics,
      metricsUpdatedAt: edge.node.metricsUpdatedAt,
      assets: edge.node.assets,
    };
  });
}

export async function fetchBufferSentPosts(limit = 50): Promise<BufferPost[]> {
  return fetchBufferPostsPage({
    status: ["sent"],
    first: limit,
    sortDirection: "desc",
  });
}

/** Live Buffer queue for the month grid: scheduled + recently sent. */
export async function fetchBufferCalendarPosts(month: string): Promise<BufferCalendarItem[]> {
  if (!bufferConfigured()) return [];

  const start = `${month}-01T00:00:00Z`;
  const [year, monthNum] = month.split("-").map(Number);
  const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59));
  const end = endDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  const [scheduled, sent] = await Promise.all([
    fetchBufferPostsPage({
      status: ["scheduled", "sending"],
      first: 100,
      dueAt: { start, end },
      sortDirection: "asc",
    }).catch(() => [] as BufferPost[]),
    fetchBufferPostsPage({
      status: ["sent"],
      first: 100,
      dueAt: { start, end },
      sortDirection: "desc",
    }).catch(() => [] as BufferPost[]),
  ]);

  return groupBufferPostsForCalendar([...scheduled, ...sent]);
}

export type BufferCalendarItem = {
  id: string;
  content_id: string | null;
  title: string;
  status: "scheduled" | "posted";
  platforms: string[];
  scheduled_at: string | null;
  posted_at: string | null;
  buffer_post_ids: string[];
};

function groupBufferPostsForCalendar(posts: BufferPost[]): BufferCalendarItem[] {
  const groups = new Map<string, BufferCalendarItem>();

  for (const post of posts) {
    const when = post.sentAt || post.dueAt;
    if (!when) continue;
    const code = contentCodeFromBufferPost(post);
    const title = titleFromBufferPost(post, code);
    const kind = post.sentAt ? "posted" : "scheduled";
    const slot = when.slice(0, 16); // group same minute across channels
    const key = `${kind}|${slot}|${(code || title).toUpperCase()}`;
    const existing = groups.get(key);
    const service = labelChannel(post.channelService);

    if (existing) {
      if (!existing.platforms.includes(service)) existing.platforms.push(service);
      existing.buffer_post_ids.push(post.id);
      continue;
    }

    groups.set(key, {
      id: post.id,
      content_id: code,
      title,
      status: kind,
      platforms: [service],
      scheduled_at: kind === "scheduled" ? post.dueAt : null,
      posted_at: kind === "posted" ? post.sentAt || post.dueAt : null,
      buffer_post_ids: [post.id],
    });
  }

  return [...groups.values()].sort((a, b) => {
    const aWhen = a.posted_at || a.scheduled_at || "";
    const bWhen = b.posted_at || b.scheduled_at || "";
    return aWhen.localeCompare(bWhen);
  });
}

function titleFromBufferPost(post: BufferPost, code: string | null) {
  const text = (post.text || "").replace(/\s+/g, " ").trim();
  if (text) {
    const firstLine = text.split(/\n|\r/)[0]?.trim() || text;
    if (firstLine.length <= 90) return firstLine;
    return `${firstLine.slice(0, 87).trimEnd()}…`;
  }
  return code || "Buffer post";
}

function labelChannel(service: string) {
  if (service === "youtube") return "YouTube";
  if (service === "instagram") return "Instagram";
  if (service === "tiktok") return "TikTok";
  return service;
}

export function contentCodeFromBufferPost(post: BufferPost) {
  for (const asset of post.assets || []) {
    const match = (asset.source || "").match(CODE_RE);
    if (match) return match[1].toUpperCase();
  }
  const fromText = (post.text || "").match(CODE_RE);
  return fromText ? fromText[1].toUpperCase() : null;
}

function metricValue(metrics: BufferMetric[] | null | undefined, type: string) {
  const hit = (metrics || []).find((entry) => entry.type === type);
  return hit == null ? null : Number(hit.value);
}

/** Existing DB check: post_age is 24h | 72h | 7d */
function postAgeBucket(iso: string | null) {
  if (!iso) return "7d";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "7d";
  const days = Math.max(0, (Date.now() - then) / 86400000);
  if (days <= 1) return "24h";
  if (days <= 3) return "72h";
  return "7d";
}

/** Existing DB check: promising | strong_performer | needs_more_data | underperforming */
function classifyFromEngagement(rate: number | null, views: number | null) {
  if (views == null || views < 50 || rate == null) return "needs_more_data";
  if (rate >= 3) return "strong_performer";
  if (rate >= 1.5) return "promising";
  return "underperforming";
}

function totalsFromMetrics(metrics: BufferMetric[], syncedAt: string | null, metricsUpdatedAt: string | null): BufferTotals {
  const map = Object.fromEntries(metrics.map((entry) => [entry.type, Number(entry.value)]));
  return {
    postCount: map.postCount || 0,
    views: map.views || 0,
    reactions: map.reactions || 0,
    comments: map.comments || 0,
    engagementRate: map.engagementRate || 0,
    metricsUpdatedAt,
    syncedAt,
    configured: bufferConfigured(),
  };
}

async function writeBufferSnapshot(input: {
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  metricsUpdatedAt: string | null;
  syncedAt: string;
}) {
  const supabase = createAdmin();
  const { error } = await supabase.from("buffer_snapshots").insert({
    organization_id: bufferOrgId(),
    period_start: input.periodStart,
    period_end: input.periodEnd,
    metrics: input.metrics,
    metrics_updated_at: input.metricsUpdatedAt,
    synced_at: input.syncedAt,
  });
  if (error) throw new Error(error.message);
}

async function writeBufferPostRows(posts: BufferPost[], today: string) {
  const supabase = createAdmin();
  const codes = [
    ...new Set(posts.map(contentCodeFromBufferPost).filter((value): value is string => Boolean(value))),
  ];
  const { data: queueRows, error: queueError } = await supabase
    .from("content_queue")
    .select("id, content_id")
    .in("content_id", codes.length ? codes : ["__none__"]);
  if (queueError) throw new Error(queueError.message);
  const byCode = new Map((queueRows || []).map((row) => [String(row.content_id).toUpperCase(), row.id]));

  await supabase
    .from("content_performance")
    .delete()
    .eq("measurement_date", today)
    .ilike("notes", "%\"buffer_post_id\"%");

  const byKey = new Map<
    string,
    {
      content_id: string;
      platform: string;
      post_age: string;
      measurement_date: string;
      data_status: string;
      classification: string;
      views: number | null;
      reach: number | null;
      comments: number | null;
      shares: number | null;
      saves: number | null;
      avg_watch_time_sec: number | null;
      notes: string;
    }
  >();
  for (const post of posts) {
    if (!post.metrics?.length) continue;
    const code = contentCodeFromBufferPost(post);
    const contentId = code ? byCode.get(code) : undefined;
    if (!contentId) continue;
    const views = metricValue(post.metrics, "views");
    const engagement = metricValue(post.metrics, "engagementRate");
    const platform = post.channelService || "unknown";
    const postAge = postAgeBucket(post.sentAt || post.dueAt);
    const key = `${contentId}|${platform}|${postAge}|${today}`;
    const next = {
      content_id: contentId,
      platform,
      post_age: postAge,
      measurement_date: today,
      data_status: "complete",
      classification: classifyFromEngagement(engagement, views),
      views,
      reach: metricValue(post.metrics, "reach"),
      comments: metricValue(post.metrics, "comments"),
      shares: metricValue(post.metrics, "shares") ?? metricValue(post.metrics, "reposts"),
      saves: metricValue(post.metrics, "saves"),
      avg_watch_time_sec: metricValue(post.metrics, "averageTimeWatched"),
      notes: JSON.stringify({
        source: "buffer",
        buffer_post_id: post.id,
        code,
        reactions: metricValue(post.metrics, "reactions"),
        engagement_rate_pct: engagement,
        metrics_updated_at: post.metricsUpdatedAt,
      }),
    };
    const prev = byKey.get(key);
    if (!prev || Number(next.views || 0) > Number(prev.views || 0)) byKey.set(key, next);
  }
  const rows = [...byKey.values()];
  if (rows.length) {
    const { error } = await supabase.from("content_performance").insert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

export async function syncBufferAnalytics() {
  const aggregate = await fetchBufferAggregate(30);
  const posts = await fetchBufferSentPosts(80);
  const today = nyToday();
  const metricsMap = Object.fromEntries(aggregate.metrics.map((entry) => [entry.type, Number(entry.value)]));
  const syncedAt = new Date().toISOString();

  await writeBufferSnapshot({
    periodStart: aggregate.periodStart,
    periodEnd: aggregate.periodEnd,
    metrics: metricsMap,
    metricsUpdatedAt: aggregate.metricsUpdatedAt,
    syncedAt,
  });
  const upserted = await writeBufferPostRows(posts, today);

  return {
    posts: posts.length,
    upserted,
    metrics: metricsMap,
    metricsUpdatedAt: aggregate.metricsUpdatedAt,
  };
}

export async function readBufferTotals(): Promise<BufferTotals> {
  const supabase = createAdmin();
  const { data, error } = await supabase
    .from("buffer_snapshots")
    .select("metrics, metrics_updated_at, synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      postCount: 0,
      views: 0,
      reactions: 0,
      comments: 0,
      engagementRate: 0,
      metricsUpdatedAt: null,
      syncedAt: null,
      configured: bufferConfigured(),
    };
  }
  const metrics = (data.metrics || {}) as Record<string, number>;
  return {
    postCount: Number(metrics.postCount || 0),
    views: Number(metrics.views || 0),
    reactions: Number(metrics.reactions || 0),
    comments: Number(metrics.comments || 0),
    engagementRate: Number(metrics.engagementRate || 0),
    metricsUpdatedAt: data.metrics_updated_at,
    syncedAt: data.synced_at,
    configured: bufferConfigured(),
  };
}

/** Seed snapshot + rows from already-fetched Buffer MCP payloads (no API key required for this write). */
export async function seedBufferFromPayload(input: {
  aggregate: { metrics: BufferMetric[]; metricsUpdatedAt: string | null; periodStart: string; periodEnd: string };
  posts: BufferPost[];
}) {
  const today = nyToday();
  const metricsMap = Object.fromEntries(input.aggregate.metrics.map((entry) => [entry.type, Number(entry.value)]));
  const syncedAt = new Date().toISOString();

  await writeBufferSnapshot({
    periodStart: input.aggregate.periodStart,
    periodEnd: input.aggregate.periodEnd,
    metrics: metricsMap,
    metricsUpdatedAt: input.aggregate.metricsUpdatedAt,
    syncedAt,
  });
  await writeBufferPostRows(input.posts, today);
  return totalsFromMetrics(input.aggregate.metrics, syncedAt, input.aggregate.metricsUpdatedAt);
}
