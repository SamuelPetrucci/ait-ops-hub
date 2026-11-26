export function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function nyToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

export function weekStart(today = nyToday()) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const delta = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - delta);
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: dateOnly ? undefined : "numeric",
    minute: dateOnly ? undefined : "2-digit",
    timeZone: "America/New_York",
  }).format(date);
}

function nyDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return dateOnly ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

export function formatNyDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = nyDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export function formatNyTime(value: string | null | undefined) {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const date = nyDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

export function formatCount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function channelLabel(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return "Channel";
  const key = raw.toLowerCase();
  if (key.includes("instagram")) return "Instagram";
  if (key.includes("youtube") || key.includes("youtu")) return "YouTube";
  if (key.includes("tiktok")) return "TikTok";
  if (key.includes("linkedin")) return "LinkedIn";
  if (key.includes("facebook") || key.includes("fb.")) return "Facebook";
  if (key === "x" || key.includes("twitter")) return "X";
  if (key.includes("threads")) return "Threads";
  return raw.replaceAll("_", " ");
}

export function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export function nestedString(value: unknown, key: string) {
  const record = Array.isArray(value) ? value[0] : value;
  if (!record || typeof record !== "object") return undefined;
  const field = (record as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

export function companyOf(row: { prospects?: unknown }) {
  return nestedString(row.prospects, "company") || "Unknown company";
}

export function siteUrl(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function siteLabel(value: string | null | undefined) {
  const href = siteUrl(value);
  if (!href) return "";
  return new URL(href).hostname.replace(/^www\./, "");
}

export function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function daysUntil(isoDate: string, today = nyToday()) {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = isoDate.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}
