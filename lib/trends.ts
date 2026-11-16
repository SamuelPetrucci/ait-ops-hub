export const TREND_NICHES = [
  "NFL",
  "Gaming/Streaming",
  "AI-Entertainment",
  "Pop culture",
  "Other",
] as const;

export const TREND_STATUSES = ["new", "queued", "used", "skipped", "expired"] as const;

export type TrendStatus = (typeof TREND_STATUSES)[number];

export type TrendFilters = {
  niche: string;
  status: string;
  minSources: number;
  query: string;
};

export type TrendLink = {
  href: string;
  label: string;
};

export type TrendCardModel = {
  id: string;
  detectedAt: string;
  topic: string;
  niche: string | null;
  summary: string;
  sources: string[];
  sourceCount: number;
  links: TrendLink[];
  heat: number | null;
  velocity: string;
  status: string;
  contentQueueId: string | null;
  hookIdea: string;
  scanNotes: string;
};

type TrendInput = {
  id: string;
  detected_at: string;
  topic: string | null;
  niche: string | null;
  summary: string | null;
  sources: string[] | null;
  source_count: number | string | null;
  source_urls: string[] | null;
  metrics: unknown;
  heat_score: number | string | null;
  velocity: string | null;
  status: string | null;
  content_queue_id: string | null;
  hook_idea: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  queued: "Queued",
  used: "Used",
  skipped: "Skipped",
  expired: "Expired",
};

export function trendStatusLabel(status: string) {
  return STATUS_LABELS[status] || status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function heatValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

export function formatHeat(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function scanNotes(metrics: unknown) {
  const record = asRecord(metrics);
  const notes = record?.scan_notes;
  return typeof notes === "string" ? notes.trim() : "";
}

export function sourceNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sourceCountOf(value: unknown, sources: string[]) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (Number.isFinite(number)) return number;
  return sources.length;
}

export function sourceLinks(value: unknown): TrendLink[] {
  if (!Array.isArray(value)) return [];
  const hrefs = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
  const domains = hrefs.map(domainOf);
  const totals = new Map<string, number>();
  for (const domain of domains) totals.set(domain, (totals.get(domain) || 0) + 1);
  const seen = new Map<string, number>();
  return hrefs.map((href, index) => {
    const domain = domains[index] || href;
    const count = (seen.get(domain) || 0) + 1;
    seen.set(domain, count);
    const total = totals.get(domain) || 1;
    return { href, label: total > 1 ? `${domain} · ${count}` : domain };
  });
}

export function nicheChoices(present: Iterable<string>) {
  const extras = [...new Set(present)]
    .map((item) => item.trim())
    .filter((item) => item && !TREND_NICHES.includes(item as (typeof TREND_NICHES)[number]))
    .sort((a, b) => a.localeCompare(b));
  return [...TREND_NICHES, ...extras];
}

export function readTrendFilters(input: {
  niche?: string;
  status?: string;
  min?: string;
  q?: string;
}): TrendFilters {
  const status = TREND_STATUSES.includes(input.status as TrendStatus) ? input.status || "" : "";
  const min = Number(input.min);
  return {
    niche: (input.niche || "").trim(),
    status,
    minSources: Number.isFinite(min) && min > 0 ? Math.floor(min) : 0,
    query: (input.q || "").trim(),
  };
}

export function filtersActive(filters: TrendFilters) {
  return Boolean(filters.niche || filters.status || filters.minSources > 0 || filters.query);
}

export function trendMatches(
  row: { niche: string | null; status: string; sourceCount: number; topic: string; summary: string },
  filters: TrendFilters,
) {
  if (filters.status) {
    if (row.status !== filters.status) return false;
  } else if (row.status === "expired") {
    return false;
  }
  if (filters.niche && row.niche !== filters.niche) return false;
  if (filters.minSources > 0 && row.sourceCount < filters.minSources) return false;
  const query = filters.query.toLowerCase();
  if (!query) return true;
  return `${row.topic}\n${row.summary}`.toLowerCase().includes(query);
}

export function toTrendCard(row: TrendInput): TrendCardModel {
  const sources = sourceNames(row.sources);
  return {
    id: row.id,
    detectedAt: row.detected_at,
    topic: row.topic?.trim() || "Untitled trend",
    niche: row.niche?.trim() || null,
    summary: row.summary?.trim() || "",
    sources,
    sourceCount: sourceCountOf(row.source_count, sources),
    links: sourceLinks(row.source_urls),
    heat: heatValue(row.heat_score),
    velocity: row.velocity?.trim() || "",
    status: row.status?.trim() || "unknown",
    contentQueueId: row.content_queue_id,
    hookIdea: row.hook_idea?.trim() || "",
    scanNotes: scanNotes(row.metrics),
  };
}

/** Five newest non-expired rows, then highest heat first. Ties keep newer-first order. */
export function orderTopTrends<T extends { status: string; heat_score: unknown; detected_at: string }>(rows: T[]) {
  return [...rows]
    .filter((row) => row.status !== "expired")
    .sort((a, b) => Date.parse(b.detected_at) - Date.parse(a.detected_at))
    .slice(0, 5)
    .sort((a, b) => (heatValue(b.heat_score) ?? -1) - (heatValue(a.heat_score) ?? -1));
}

function domainOf(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
