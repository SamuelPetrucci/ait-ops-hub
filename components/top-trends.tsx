import Link from "next/link";
import { formatHeat, heatValue } from "@/lib/trends";

export function TopTrends({
  trends,
}: {
  trends: {
    id: string;
    topic: string | null;
    niche: string | null;
    heat_score: number | string | null;
  }[];
}) {
  return (
    <section className="rounded-3xl bg-card/50 p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Content</p>
          <h2 className="font-display text-lg font-semibold text-ink">Top trends</h2>
        </div>
        <Link href="/content/trends" className="text-xs text-signal hover:underline">
          All trends
        </Link>
      </div>
      {trends.length === 0 ? (
        <p className="rounded-2xl bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No live trends yet.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {trends.map((trend) => {
            const heat = heatValue(trend.heat_score);
            return (
              <li key={trend.id}>
                <Link
                  href="/content/trends"
                  className="flex h-full min-h-24 flex-col gap-2 rounded-2xl bg-background/35 px-3 py-3 transition hover:bg-background/55"
                >
                  <span className="line-clamp-3 text-sm font-medium text-ink">{trend.topic?.trim() || "Untitled trend"}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
                    {trend.niche ? <span className="truncate">{trend.niche}</span> : null}
                    {heat != null ? (
                      <span className="tabular-nums text-signal">Heat {formatHeat(heat)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
