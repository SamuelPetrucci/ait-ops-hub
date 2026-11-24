import { labelize } from "@/lib/format";

export type ReferenceFilters = {
  niche: string;
  platform: string;
  query: string;
};

export type ReferenceAccountSummary = {
  id: string | null;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  brand: string | null;
  niche: string | null;
  followers: number | null;
  whyTrack: string | null;
};

export type ReferenceCardModel = {
  id: string;
  createdAt: string;
  sentAt: string | null;
  postedAt: string | null;
  platform: string;
  url: string;
  resolvedUrl: string | null;
  creatorHandle: string | null;
  channelName: string | null;
  title: string;
  durationS: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  followers: number | null;
  formatTag: string | null;
  whyItWorks: string;
  notes: string;
  account: ReferenceAccountSummary | null;
};

type AccountInput = {
  id?: string | null;
  handle?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
  brand?: string | null;
  niche?: string | null;
  followers?: number | string | null;
  why_track?: string | null;
} | null;

export type ReferencePostInput = {
  id: string;
  created_at: string;
  sent_at?: string | null;
  posted_at?: string | null;
  platform?: string | null;
  url?: string | null;
  resolved_url?: string | null;
  creator_handle?: string | null;
  channel_name?: string | null;
  title_or_caption?: string | null;
  duration_s?: number | string | null;
  views?: number | string | null;
  likes?: number | string | null;
  comments?: number | string | null;
  shares?: number | string | null;
  followers?: number | string | null;
  format_tag?: string | null;
  why_it_works?: string | null;
  notes?: string | null;
  reference_accounts?: AccountInput | AccountInput[];
};

export function readReferenceFilters(input: {
  niche?: string;
  platform?: string;
  q?: string;
}): ReferenceFilters {
  return {
    niche: (input.niche || "").trim(),
    platform: (input.platform || "").trim().toLowerCase(),
    query: (input.q || "").trim(),
  };
}

export function filtersActive(filters: ReferenceFilters) {
  return Boolean(filters.niche || filters.platform || filters.query);
}

export function nicheChoices(present: Iterable<string>) {
  return [...new Set([...present].map((item) => item.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function platformChoices(present: Iterable<string>) {
  return [...new Set([...present].map((item) => item.trim().toLowerCase()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function nicheLabel(niche: string | null | undefined) {
  if (!niche) return "—";
  return labelize(niche)
    .split(" ")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "ai" || lower === "gta") return lower.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function platformLabel(platform: string | null | undefined) {
  if (!platform) return "—";
  const key = platform.toLowerCase();
  if (key === "x") return "X";
  if (key === "youtube") return "YouTube";
  if (key === "tiktok") return "TikTok";
  if (key === "instagram") return "Instagram";
  return labelize(platform).replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rem = total % 60;
  if (minutes <= 0) return `${rem}s`;
  return `${minutes}:${String(rem).padStart(2, "0")}`;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function accountOf(value: AccountInput | AccountInput[] | undefined): ReferenceAccountSummary | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id || null,
    handle: row.handle?.trim() || null,
    displayName: row.display_name?.trim() || null,
    profileUrl: row.profile_url?.trim() || null,
    brand: row.brand?.trim() || null,
    niche: row.niche?.trim() || null,
    followers: asNumber(row.followers),
    whyTrack: row.why_track?.trim() || null,
  };
}

export function toReferenceCard(row: ReferencePostInput): ReferenceCardModel {
  const account = accountOf(row.reference_accounts);
  const title = (row.title_or_caption || "").trim();
  return {
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at || null,
    postedAt: row.posted_at || null,
    platform: (row.platform || "").trim().toLowerCase() || "unknown",
    url: (row.resolved_url || row.url || "").trim(),
    resolvedUrl: row.resolved_url?.trim() || null,
    creatorHandle: row.creator_handle?.trim() || account?.handle || null,
    channelName: row.channel_name?.trim() || account?.displayName || null,
    title: title || "Untitled reference",
    durationS: asNumber(row.duration_s),
    views: asNumber(row.views),
    likes: asNumber(row.likes),
    comments: asNumber(row.comments),
    shares: asNumber(row.shares),
    followers: asNumber(row.followers) ?? account?.followers ?? null,
    formatTag: row.format_tag?.trim() || null,
    whyItWorks: (row.why_it_works || "").trim(),
    notes: (row.notes || "").trim(),
    account,
  };
}

export function referenceMatches(card: ReferenceCardModel, filters: ReferenceFilters) {
  const niche = card.account?.niche || "";
  if (filters.niche && niche !== filters.niche) return false;
  if (filters.platform && card.platform !== filters.platform) return false;
  if (!filters.query) return true;

  const haystack = [
    card.title,
    card.whyItWorks,
    card.notes,
    card.creatorHandle,
    card.channelName,
    card.formatTag,
    niche,
    card.account?.whyTrack,
    card.account?.brand,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(filters.query.toLowerCase());
}
