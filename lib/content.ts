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
