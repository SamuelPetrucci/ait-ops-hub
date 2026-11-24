/** America/New_York wall-clock helpers shared by server scheduling and client validation. */

export const NY_TZ = "America/New_York";

export function nyParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
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

/** Convert an NY date + HH:mm wall time to a UTC ISO string, or null if invalid. */
export function nyWallTimeToIso(dateKey: string, hhmm: string) {
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

/** Parse datetime-local value as Eastern Time and return a future UTC ISO, or throw. */
export function nyLocalInputToDueAt(localValue: string) {
  const m = localValue.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) throw new Error("Schedule time must be YYYY-MM-DDTHH:mm");
  const dueAt = nyWallTimeToIso(m[1], m[2]);
  if (!dueAt) throw new Error("Could not interpret schedule time in America/New_York");
  if (Date.parse(dueAt) <= Date.now()) {
    throw new Error("Schedule time must be in the future (Eastern Time). Pick a later slot.");
  }
  return dueAt;
}

/** True when a datetime-local string is still strictly in the future in Eastern Time. */
export function isNyLocalInFuture(localValue: string) {
  try {
    nyLocalInputToDueAt(localValue);
    return true;
  } catch {
    return false;
  }
}

export function nyDateKey(date: Date) {
  const p = nyParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function nyWeekday(date: Date) {
  // 0=Sun ... in America/New_York
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: NY_TZ, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

export function addNyDays(from: Date, days: number) {
  const p = nyParts(from);
  const utc = Date.UTC(p.year, p.month - 1, p.day + days, 12, 0, 0);
  return new Date(utc);
}

export function nySlotKey(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const p = nyParts(new Date(ms));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function formatNyLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
