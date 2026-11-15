import "server-only";
import { bufferConfigured, bufferGraphQL, bufferOrgId } from "@/lib/buffer";

const TZ = "America/New_York";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Known AI Transformation Buffer channels (overridable via env). */
export const BUFFER_CHANNEL_DEFAULTS = {
  youtube_viral_digests: "6ae5f0bb2f1f5ed648316cd3",
  youtube_johnny_snow: "6ae5f0902f1f5ed648316b9d",
  instagram: "6ae5f0082f1f5ed64831681e",
} as const;

export type BufferChannelKey = keyof typeof BUFFER_CHANNEL_DEFAULTS;

export function bufferPublishToken() {
  return (
    process.env.BUFFER_API_KEY?.trim() ||
    process.env.BUFFER_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export function bufferChannelId(key: BufferChannelKey) {
  const envKey =
    key === "youtube_viral_digests"
      ? "BUFFER_CHANNEL_YOUTUBE_VIRAL_DIGESTS"
      : key === "youtube_johnny_snow"
        ? "BUFFER_CHANNEL_YOUTUBE_JOHNNY_SNOW"
        : "BUFFER_CHANNEL_INSTAGRAM";
  return process.env[envKey]?.trim() || BUFFER_CHANNEL_DEFAULTS[key];
}

export function resolveChannelIds(keys: string[]) {
  const map: Record<string, string> = {
    youtube_viral_digests: bufferChannelId("youtube_viral_digests"),
    youtube_johnny_snow: bufferChannelId("youtube_johnny_snow"),
    instagram: bufferChannelId("instagram"),
  };
  return keys
    .map((key) => ({ key, id: map[key] }))
    .filter((row): row is { key: string; id: string } => Boolean(row.id));
}

/** Prefer stored caption; otherwise assemble a real post description from script parts. */
export function buildPostDescription(input: {
  caption?: string | null;
  hook?: string | null;
  cta?: string | null;
  title?: string | null;
  contentId?: string | null;
}) {
  const caption = (input.caption || "").trim();
  if (caption) return caption;

  const parts = [input.hook, input.cta].map((v) => (v || "").trim()).filter(Boolean);
  let text = parts.join("\n\n").trim();
  if (!text && input.title) text = String(input.title).trim();
  if (input.contentId && text && !text.includes(input.contentId)) {
    text = `${text}\n\n${input.contentId}`;
  }
  return text;
}

export function truncateYoutubeTitle(value: string, max = 70) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

type ScheduleDay = { day: string; times: string[]; paused?: boolean | null };

export async function fetchChannelPostingSchedules(channelIds: string[]) {
  if (!bufferConfigured() && !bufferPublishToken()) return [] as { id: string; service: string; schedule: ScheduleDay[] }[];
  const data = await bufferGraphQL<{
    channels: { id: string; service: string; postingSchedule?: ScheduleDay[] | null }[];
  }>(
    `query Channels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id
        service
        postingSchedule { day times paused }
      }
    }`,
    { organizationId: bufferOrgId() },
  ).catch(() => ({ channels: [] as { id: string; service: string; postingSchedule?: ScheduleDay[] | null }[] }));

  const wanted = new Set(channelIds);
  return (data.channels || [])
    .filter((row) => wanted.has(row.id))
    .map((row) => ({
      id: row.id,
      service: row.service,
      schedule: (row.postingSchedule || []).filter((day) => !day.paused && day.times?.length),
    }));
}

/** Next free NY slot from Buffer channel schedules (falls back to 12/6/9 PM). */
export async function suggestNextPostSlot(opts: {
  usedIsoTimes: string[];
  channelIds?: string[];
  maxPerDay?: number;
  daysToCheck?: number;
}) {
  const maxPerDay = opts.maxPerDay ?? 3;
  const daysToCheck = opts.daysToCheck ?? 14;
  const channelIds = opts.channelIds?.length
    ? opts.channelIds
    : [bufferChannelId("youtube_viral_digests"), bufferChannelId("instagram")];

  const schedules = await fetchChannelPostingSchedules(channelIds);
  const candidateMinutes = collectScheduleMinutes(schedules);
  const fallbackHours = [12, 18, 21];

  const now = new Date();
  const usedKeys = new Set(opts.usedIsoTimes.map(nySlotKey).filter(Boolean));

  for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
    const day = addNyDays(now, dayOffset);
    const dayKey = nyDateKey(day);
    const dayUsed = [...usedKeys].filter((key) => key.startsWith(dayKey)).length;
    if (dayUsed >= maxPerDay) continue;

    const weekday = DAY_KEYS[nyWeekday(day)];
    const times =
      candidateMinutes.get(weekday) ||
      fallbackHours.map((h) => `${String(h).padStart(2, "0")}:00`);

    for (const hhmm of times) {
      const dueAt = nyWallTimeToIso(dayKey, hhmm);
      if (!dueAt) continue;
      if (Date.parse(dueAt) <= now.getTime() + 5 * 60 * 1000) continue;
      const key = nySlotKey(dueAt);
      if (!key || usedKeys.has(key)) continue;
      return {
        dueAt,
        localValue: `${dayKey}T${hhmm}`,
        label: `${formatNyLabel(dueAt)} · from Buffer posting schedule`,
      };
    }
  }

  const fallbackDay = addNyDays(now, 1);
  const dayKey = nyDateKey(fallbackDay);
  const dueAt = nyWallTimeToIso(dayKey, "12:00")!;
  return {
    dueAt,
    localValue: `${dayKey}T12:00`,
    label: `${formatNyLabel(dueAt)} · fallback midday slot`,
  };
}

function collectScheduleMinutes(schedules: { schedule: ScheduleDay[] }[]) {
  const byDay = new Map<string, Set<string>>();
  for (const channel of schedules) {
    for (const day of channel.schedule) {
      const key = String(day.day || "").toLowerCase().slice(0, 3);
      if (!byDay.has(key)) byDay.set(key, new Set());
      for (const time of day.times || []) {
        const cleaned = normalizeHhmm(time);
        if (cleaned) byDay.get(key)!.add(cleaned);
      }
    }
  }
  const out = new Map<string, string[]>();
  for (const [day, set] of byDay) {
    out.set(day, [...set].sort());
  }
  return out;
}

function normalizeHhmm(value: string) {
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function nyLocalInputToDueAt(localValue: string) {
  const m = localValue.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) throw new Error("Schedule time must be YYYY-MM-DDTHH:mm");
  const dueAt = nyWallTimeToIso(m[1], m[2]);
  if (!dueAt) throw new Error("Could not interpret schedule time in America/New_York");
  if (Date.parse(dueAt) <= Date.now()) throw new Error("Schedule time must be in the future");
  return dueAt;
}

function nyWallTimeToIso(dateKey: string, hhmm: string) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  // Find the UTC instant whose NY wall clock equals this date/time.
  let guess = Date.UTC(y, mo - 1, d, h + 5, mi, 0); // EST first guess
  for (let i = 0; i < 4; i++) {
    const parts = nyParts(new Date(guess));
    const asNy = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const wanted = Date.UTC(y, mo - 1, d, h, mi, 0);
    const delta = wanted - asNy;
    guess += delta;
    if (delta === 0) break;
  }
  const check = nyParts(new Date(guess));
  if (check.year !== y || check.month !== mo || check.day !== d || check.hour !== h || check.minute !== mi) {
    return null;
  }
  return new Date(guess).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nyParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

function nyDateKey(date: Date) {
  const p = nyParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function nyWeekday(date: Date) {
  // 0=Sun ... in America/New_York
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function addNyDays(from: Date, days: number) {
  const p = nyParts(from);
  const utc = Date.UTC(p.year, p.month - 1, p.day + days, 12, 0, 0);
  return new Date(utc);
}

function nySlotKey(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const p = nyParts(new Date(ms));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function formatNyLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type CreateBufferPostInput = {
  channelId: string;
  channelKey: string;
  text: string;
  videoUrl: string;
  dueAt: string;
  youtubeTitle?: string;
};

export async function createBufferScheduledPost(input: CreateBufferPostInput) {
  const token = bufferPublishToken();
  if (!token) throw new Error("Set BUFFER_API_KEY on the server (Buffer → Settings → API).");

  const metadata = metadataForChannel(input.channelKey, input.youtubeTitle);
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post { id dueAt text }
          }
          ... on MutationError {
            message
          }
        }
      }`,
      variables: {
        input: {
          channelId: input.channelId,
          text: input.text,
          schedulingType: "automatic",
          mode: "customScheduled",
          dueAt: input.dueAt,
          assets: [{ video: { url: input.videoUrl } }],
          ...(metadata ? { metadata } : {}),
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    if (/limit|10 posts/i.test(body)) {
      throw new Error("Buffer free plan 10-post limit reached. Upgrade or delete existing scheduled posts.");
    }
    throw new Error(`Buffer API ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { createPost?: { post?: { id: string; dueAt?: string; text?: string }; message?: string } };
    errors?: { message: string }[];
  };

  if (payload.errors?.length) {
    const msg = payload.errors.map((e) => e.message).join("; ");
    if (/limit|10 posts/i.test(msg)) {
      throw new Error("Buffer free plan 10-post limit reached. Upgrade or delete existing scheduled posts.");
    }
    throw new Error(msg);
  }

  const result = payload.data?.createPost;
  if (result?.message) {
    if (/limit|10 posts/i.test(result.message)) {
      throw new Error("Buffer free plan 10-post limit reached. Upgrade or delete existing scheduled posts.");
    }
    throw new Error(result.message);
  }
  if (!result?.post?.id) throw new Error("Buffer did not return a post id.");
  return result.post;
}

export type StoredBufferPost = {
  id: string;
  channel: string;
  dueAt?: string | null;
};

/** Buffer post ids live under platform_links.buffer_posts (jsonb object). */
export function readStoredBufferPosts(platformLinks: unknown): StoredBufferPost[] {
  if (!platformLinks || typeof platformLinks !== "object" || Array.isArray(platformLinks)) {
    return [];
  }
  const raw = (platformLinks as Record<string, unknown>).buffer_posts;
  if (!Array.isArray(raw)) return [];
  const out: StoredBufferPost[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    out.push({
      id,
      channel: typeof row.channel === "string" ? row.channel : "unknown",
      dueAt: typeof row.dueAt === "string" ? row.dueAt : null,
    });
  }
  return out;
}

export function mergePlatformLinks(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export function clearStoredBufferPosts(platformLinks: unknown): Record<string, unknown> {
  const next = mergePlatformLinks(platformLinks, {});
  delete next.buffer_posts;
  return next;
}

export async function deleteBufferPost(postId: string) {
  const token = bufferPublishToken();
  if (!token) throw new Error("Set BUFFER_API_KEY on the server (Buffer → Settings → API).");

  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation DeletePost($input: DeletePostInput!) {
        deletePost(input: $input) {
          ... on DeletePostSuccess { id }
          ... on VoidMutationError { message }
        }
      }`,
      variables: { input: { id: postId } },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Buffer API ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { deletePost?: { id?: string; message?: string } };
    errors?: { message: string }[];
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
  if (payload.data?.deletePost?.message) {
    throw new Error(payload.data.deletePost.message);
  }
  if (!payload.data?.deletePost?.id) {
    throw new Error("Buffer did not confirm post deletion.");
  }
  return payload.data.deletePost.id;
}

function metadataForChannel(channelKey: string, youtubeTitle?: string) {
  if (channelKey === "instagram") {
    return {
      instagram: {
        type: "reel",
        shouldShareToFeed: true,
      },
    };
  }
  if (channelKey.startsWith("youtube_")) {
    return {
      youtube: {
        title: truncateYoutubeTitle(youtubeTitle || "Viral Digest"),
        categoryId: "24",
        privacy: "public",
        notifySubscribers: true,
        madeForKids: false,
        isAiGenerated: true,
      },
    };
  }
  return undefined;
}
