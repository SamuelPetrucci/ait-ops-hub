import "server-only";
import { createAdmin } from "@/lib/supabase/admin";

const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

const SOCIAL_HOSTS = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "fb.watch",
  "linkedin.com",
];

const STORAGE_PREFIX = "storage:";
const DEFAULT_BUCKET = "viral-digests";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

export type VideoUrlInput = {
  video_url?: string | null;
  storage_path?: string | null;
};

/**
 * Resolves a video URL from content_queue row data.
 * - http(s) URLs: returned as-is
 * - storage:<bucket>/<path> video_url: server-side signed URL (1 hour)
 * - storage_path field: server-side signed URL from viral-digests bucket (1 hour)
 * - local: paths: ignored; falls through to storage_path when present
 * - null/undefined: returns null
 */
export async function resolveVideoUrl(input: VideoUrlInput): Promise<string | null> {
  const { video_url, storage_path } = input;

  if (video_url?.startsWith("http://") || video_url?.startsWith("https://")) {
    return video_url;
  }

  if (video_url?.startsWith(STORAGE_PREFIX)) {
    const path = video_url.slice(STORAGE_PREFIX.length);
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) return null;
    const bucket = path.slice(0, slashIndex);
    const objectPath = path.slice(slashIndex + 1);
    return createSignedUrl(bucket, objectPath);
  }

  // local: paths are not browser-reachable — still try storage_path / signed URLs.
  if (storage_path) {
    return createSignedUrl(DEFAULT_BUCKET, storage_path);
  }

  return null;
}

async function createSignedUrl(bucket: string, path: string): Promise<string | null> {
  const supabase = createAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export type ScriptParts = {
  hook: string;
  fullScript: string;
  cta: string;
  caption: string;
};

export type LiveLink = {
  label: string;
  href: string;
};

type DatedContent = {
  content_id?: string | null;
  posted_at?: string | null;
  scheduled_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

/** Newest activity first: posted date when live, otherwise last edit / schedule. */
export function byContentRecency(a: DatedContent, b: DatedContent) {
  const diff = contentStamp(b) - contentStamp(a);
  if (diff !== 0) return diff;
  const schedule = ms(b.scheduled_at) - ms(a.scheduled_at);
  if (schedule !== 0) return schedule;
  return String(b.content_id || "").localeCompare(String(a.content_id || ""));
}

function contentStamp(row: DatedContent) {
  if (row.posted_at) return ms(row.posted_at);
  return Math.max(ms(row.updated_at), ms(row.created_at), ms(row.scheduled_at));
}

function ms(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function scriptParts(scriptJson: unknown, caption: string | null | undefined): ScriptParts {
  const script =
    scriptJson && typeof scriptJson === "object" ? (scriptJson as Record<string, unknown>) : {};
  return {
    hook: textField(script.hook),
    fullScript: textField(script.full_script),
    cta: textField(script.cta),
    caption: (caption || "").trim() || textField(script.caption_draft),
  };
}

export function liveLinks(...sources: unknown[]): LiveLink[] {
  const scored = new Map<string, { label: string; score: number }>();
  for (const source of sources) collect(source, "", scored);
  return [...scored.entries()]
    .map(([href, item]) => ({ href, label: item.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function collect(value: unknown, key: string, scored: Map<string, { label: string; score: number }>) {
  if (typeof value === "string") {
    const matches = value.match(URL_RE) || [];
    for (const raw of matches) {
      const href = raw.replace(/[.,]+$/, "");
      if (!isSocialUrl(href)) continue;
      const label = labelFor(key, href);
      const score = key && !key.includes("sent") && key !== "_raw" ? 2 : 1;
      const current = scored.get(href);
      if (!current || score > current.score) scored.set(href, { label, score });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, key, scored);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) collect(child, childKey, scored);
  }
}

function textField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(textField).filter(Boolean).join("\n\n");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["text", "caption", "body", "draft"]) {
    const field = textField(record[key]);
    if (field) return field;
  }
  return "";
}

function isSocialUrl(href: string) {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    return SOCIAL_HOSTS.some((item) => host === item || host.endsWith(`.${item}`));
  } catch {
    return false;
  }
}

const IDEA_KEYS = [
  "source_url",
  "source_urls",
  "source",
  "sources",
  "idea",
  "idea_url",
  "reference",
  "reference_url",
  "references",
  "inspiration",
  "inspired_by",
];

/** URLs the piece was built from: content_queue.source_urls, then explicit script fields. */
export function ideaSources(sourceUrls: unknown, scriptJson: unknown): LiveLink[] {
  const found = new Map<string, string>();
  collectIdea(sourceUrls, found);
  const script =
    scriptJson && typeof scriptJson === "object" ? (scriptJson as Record<string, unknown>) : {};
  for (const key of IDEA_KEYS) {
    if (key in script) collectIdea(script[key], found);
  }
  return [...found.entries()].map(([href, label]) => ({ href, label }));
}

function collectIdea(value: unknown, found: Map<string, string>, title?: string) {
  if (typeof value === "string") {
    const matches = value.match(URL_RE) || [];
    const candidates = matches.length ? matches : [value];
    for (const raw of candidates) {
      const href = raw.replace(/[.,]+$/, "");
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        continue;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (!found.has(url.href)) found.set(url.href, title?.trim() || ideaLabel(url));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectIdea(entry, found);
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const named =
      typeof record.title === "string"
        ? record.title
        : typeof record.name === "string"
          ? record.name
          : title;
    const link = record.url ?? record.href ?? record.link;
    if (typeof link === "string") {
      collectIdea(link, found, named);
      return;
    }
    for (const child of Object.values(record)) collectIdea(child, found, named);
  }
}

function ideaLabel(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id =
      url.searchParams.get("v") ||
      (host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : "") ||
      url.pathname.split("/").filter(Boolean).pop() ||
      "";
    return id && id !== "watch" ? `YouTube · ${id}` : "YouTube";
  }
  if (host.endsWith("tiktok.com")) return "TikTok";
  if (host.endsWith("instagram.com")) return "Instagram";
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) return host;
  const short = last.length > 28 ? `${last.slice(0, 25)}…` : last;
  return `${host} · ${short}`;
}

export type ChannelViews = { channel: string; views: number };

export type ContentViewRollup = {
  total: number;
  /** Views gained since the previous measurement, when the latest total is higher. */
  up: number | null;
  channels: ChannelViews[];
};

/** Latest views per channel. `up` is set only when the newest check beat the one before it. */
export function rollUpViews(
  rows: {
    content_id?: string | null;
    platform?: string | null;
    views?: number | null;
    measurement_date?: string | null;
  }[],
): Map<string, ContentViewRollup> {
  const cell = new Map<string, number>();
  for (const row of rows) {
    if (!row.content_id || row.views == null) continue;
    const views = Number(row.views);
    if (!Number.isFinite(views)) continue;
    const key = `${row.content_id}|${row.platform || "unknown"}|${row.measurement_date || ""}`;
    const prev = cell.get(key);
    if (prev == null || views > prev) cell.set(key, views);
  }

  const grouped = new Map<string, Map<string, Map<string, number>>>();
  for (const [key, views] of cell) {
    const [id, platform, date] = key.split("|");
    const byPlatform = grouped.get(id) ?? new Map<string, Map<string, number>>();
    const byDate = byPlatform.get(platform) ?? new Map<string, number>();
    byDate.set(date, views);
    byPlatform.set(platform, byDate);
    grouped.set(id, byPlatform);
  }

  const result = new Map<string, ContentViewRollup>();
  for (const [id, byPlatform] of grouped) {
    const dates = new Set<string>();
    for (const byDate of byPlatform.values()) {
      for (const date of byDate.keys()) dates.add(date);
    }
    const ordered = [...dates].sort();
    const latest = ordered[ordered.length - 1] ?? "";
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const sumOn = (date: string) => {
      let total = 0;
      for (const byDate of byPlatform.values()) total += byDate.get(date) ?? 0;
      return total;
    };
    const total = sumOn(latest);
    const prior = previous == null ? null : sumOn(previous);
    const platformsOn = (date: string) =>
      [...byPlatform.keys()].filter((platform) => byPlatform.get(platform)?.has(date));
    const latestPlatforms = platformsOn(latest);
    const priorPlatforms = previous ? platformsOn(previous) : [];
    const comparable =
      prior != null &&
      latestPlatforms.length > 0 &&
      latestPlatforms.length === priorPlatforms.length &&
      latestPlatforms.every((platform) => priorPlatforms.includes(platform));
    const channels = [...byPlatform.entries()]
      .filter(([, byDate]) => byDate.has(latest))
      .map(([channel, byDate]) => ({ channel, views: byDate.get(latest) ?? 0 }))
      .sort((a, b) => b.views - a.views);
    result.set(id, {
      total,
      up: comparable && prior != null && total > prior ? total - prior : null,
      channels,
    });
  }
  return result;
}

function labelFor(key: string, href: string) {
  const blob = `${key} ${href}`.toLowerCase();
  if (blob.includes("instagram")) return "Instagram";
  if (blob.includes("johnny")) return "YouTube · Johnny Snow";
  if (blob.includes("viral")) return "YouTube · Viral Digests";
  if (blob.includes("youtube") || blob.includes("youtu.be")) return "YouTube";
  if (blob.includes("tiktok")) return "TikTok";
  if (blob.includes("facebook") || blob.includes("fb.watch")) return "Facebook";
  if (blob.includes("linkedin")) return "LinkedIn";
  return "Live post";
}
