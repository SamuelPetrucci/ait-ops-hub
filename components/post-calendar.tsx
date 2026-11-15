import type { ReactNode } from "react";
import Link from "next/link";
import { addDays, formatWhen, labelize, nyToday } from "@/lib/format";

export type CalendarItem = {
  id: string;
  content_id?: string | null;
  title: string | null;
  status: string;
  platforms?: string[] | null;
  scheduled_at?: string | null;
  posted_at?: string | null;
};

type DayEvent = {
  id: string;
  href: string;
  title: string;
  code?: string | null;
  status: string;
  kind: "posted" | "scheduled";
  when: string;
  platforms: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PostCalendar({
  items,
  month,
  query = {},
}: {
  items: CalendarItem[];
  month?: string;
  query?: Record<string, string>;
}) {
  const today = nyToday();
  const focus = parseMonth(month) || today.slice(0, 7);
  const [year, monthNum] = focus.split("-").map(Number);
  const first = `${focus}-01`;
  const startOffset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -startOffset);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) =>
    addDays(gridStart, index),
  );

  const byDay = new Map<string, DayEvent[]>();
  for (const item of items) {
    const postedKey = item.posted_at ? nyDateKey(item.posted_at) : null;
    const scheduledKey = item.scheduled_at ? nyDateKey(item.scheduled_at) : null;
    const href = `/content/${item.id}`;
    const title = item.title || "Untitled";
    const platforms = (item.platforms || []).join(", ");

    if (postedKey) {
      pushEvent(byDay, postedKey, {
        id: `${item.id}-posted`,
        href,
        title,
        code: item.content_id,
        status: item.status,
        kind: "posted",
        when: item.posted_at!,
        platforms,
      });
    }
    if (scheduledKey && scheduledKey !== postedKey && item.status !== "skipped") {
      pushEvent(byDay, scheduledKey, {
        id: `${item.id}-scheduled`,
        href,
        title,
        code: item.content_id,
        status: item.status,
        kind: "scheduled",
        when: item.scheduled_at!,
        platforms,
      });
    }
  }

  const prev = shiftMonth(focus, -1);
  const next = shiftMonth(focus, 1);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${focus}-01T12:00:00Z`));

  const monthEvents = [...byDay.entries()]
    .filter(([day]) => day.startsWith(focus))
    .flatMap(([, events]) => events)
    .sort((a, b) => a.when.localeCompare(b.when));

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card/50 p-4 ring-1 ring-foreground/10 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Calendar</p>
          <h2 className="text-lg font-medium">{label}</h2>
          <p className="text-sm text-muted-foreground">
            {monthEvents.filter((event) => event.kind === "posted").length} posted ·{" "}
            {monthEvents.filter((event) => event.kind === "scheduled").length} scheduled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthLink href={contentHref({ ...query, month: prev })} label="Previous month">
            ←
          </MonthLink>
          <MonthLink href={contentHref({ ...query, month: today.slice(0, 7) })} label="This month">
            Today
          </MonthLink>
          <MonthLink href={contentHref({ ...query, month: next })} label="Next month">
            →
          </MonthLink>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1 font-medium tracking-wide uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const inMonth = day.startsWith(focus);
          const events = byDay.get(day) || [];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`min-h-24 rounded-2xl p-1.5 ring-1 md:min-h-28 ${
                inMonth ? "bg-background/40 ring-foreground/8" : "bg-transparent ring-transparent opacity-40"
              } ${isToday ? "ring-amber-300/50" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={`text-xs tabular-nums ${isToday ? "rounded-full bg-amber-300 px-1.5 py-0.5 font-medium text-zinc-950" : "text-muted-foreground"}`}
                >
                  {Number(day.slice(8))}
                </span>
                {events.length > 0 ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{events.length}</span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                {events.slice(0, 3).map((event) => (
                  <Link
                    key={event.id}
                    href={event.href}
                    title={`${event.title} · ${formatWhen(event.when)}`}
                    className={`block truncate rounded-lg px-1.5 py-1 text-[10px] leading-tight transition hover:opacity-90 ${
                      event.kind === "posted"
                        ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/25"
                        : "bg-sky-400/15 text-sky-100 ring-1 ring-sky-400/25"
                    }`}
                  >
                    <span className="font-medium">{event.code || event.title}</span>
                  </Link>
                ))}
                {events.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">+{events.length - 3} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400/80" /> Posted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-400/80" /> Scheduled
        </span>
      </div>

      {monthEvents.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-foreground/8 pt-4">
          <h3 className="text-sm font-medium">This month</h3>
          <ul className="flex flex-col gap-1.5">
            {monthEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={event.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-background/50"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{event.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[event.code, labelize(event.status), event.platforms].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {event.kind === "posted" ? "Posted" : "Scheduled"} {formatWhen(event.when)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing scheduled or posted in this month.</p>
      )}
    </section>
  );
}

function pushEvent(map: Map<string, DayEvent[]>, day: string, event: DayEvent) {
  const list = map.get(day) || [];
  list.push(event);
  list.sort((a, b) => a.when.localeCompare(b.when));
  map.set(day, list);
}

function nyDateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function parseMonth(value?: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  return value;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function contentHref(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/content?${qs}` : "/content";
}

function MonthLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-full px-3 py-1.5 text-xs ring-1 ring-foreground/10 transition hover:bg-background/50"
    >
      {children}
    </Link>
  );
}
