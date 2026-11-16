import Link from "next/link";
import { TrendStatusActions } from "@/components/trend-status-actions";
import { formatWhen } from "@/lib/format";
import { formatHeat, trendStatusLabel, type TrendCardModel } from "@/lib/trends";

export function TrendCard({ trend }: { trend: TrendCardModel }) {
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white/55 p-4 ring-1 ring-ink/10 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {trend.niche ? <NicheBadge niche={trend.niche} /> : null}
            <StatusBadge status={trend.status} />
            {trend.heat != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2 py-0.5 text-[11px] text-signal">
                <span className="tracking-[0.12em] uppercase">Heat</span>
                <span className="font-display text-sm font-semibold tabular-nums">{formatHeat(trend.heat)}</span>
              </span>
            ) : null}
            {trend.velocity ? (
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft">{trend.velocity}</span>
            ) : null}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink">{trend.topic}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            <time dateTime={trend.detectedAt}>{formatWhen(trend.detectedAt)} ET</time>
            {trend.sourceCount > 0 ? ` · ${trend.sourceCount} source${trend.sourceCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </div>

      {trend.summary ? <p className="text-sm leading-relaxed text-ink">{trend.summary}</p> : null}
      {trend.hookIdea ? (
        <p className="rounded-2xl bg-signal/10 px-3 py-2 text-sm leading-relaxed text-ink">
          <span className="mr-2 text-[11px] tracking-[0.14em] text-signal uppercase">Hook</span>
          {trend.hookIdea}
        </p>
      ) : null}
      {trend.scanNotes ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">{trend.scanNotes}</p>
      ) : null}

      {trend.sources.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {trend.sources.map((source, index) => (
            <li key={`${source}-${index}`}>
              <span className="inline-flex rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-soft">{source}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {trend.links.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {trend.links.map((link, index) => (
            <li key={`${link.href}-${index}`}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full rounded-full bg-white px-2.5 py-1 text-xs text-signal ring-1 ring-ink/10 hover:underline"
              >
                <span className="truncate">{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
        {trend.contentQueueId ? (
          <Link href={`/content/${trend.contentQueueId}`} className="text-sm font-medium text-signal hover:underline">
            View clip idea
          </Link>
        ) : null}
        <div className={trend.contentQueueId ? "" : "sm:ml-auto"}>
          <TrendStatusActions id={trend.id} status={trend.status} />
        </div>
      </div>
    </article>
  );
}

function NicheBadge({ niche }: { niche: string }) {
  return (
    <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink ring-1 ring-ink/10">
      {niche}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(status)}`}>
      {trendStatusLabel(status)}
    </span>
  );
}

function statusClass(status: string) {
  if (status === "new") return "bg-signal/15 text-signal";
  if (status === "queued") return "bg-ember/15 text-ember";
  if (status === "used") return "bg-ink text-paper";
  return "bg-ink/5 text-ink-soft";
}
