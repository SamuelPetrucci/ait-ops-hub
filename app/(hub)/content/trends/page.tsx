import Link from "next/link";
import { ContentChrome } from "@/components/content-chrome";
import { TrendCard } from "@/components/trend-card";
import { TrendFilters } from "@/components/trend-filters";
import { requireOwner } from "@/lib/auth";
import {
  filtersActive,
  nicheChoices,
  readTrendFilters,
  toTrendCard,
  trendMatches,
} from "@/lib/trends";

export const metadata = { title: "Trends" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; status?: string; min?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filters = readTrendFilters({
    niche: first(params.niche),
    status: first(params.status),
    min: first(params.min),
    q: first(params.q),
  });
  const { supabase } = await requireOwner();
  const result = await supabase
    .from("trends")
    .select(
      "id, detected_at, scan_run, topic, niche, summary, sources, source_count, source_urls, metrics, heat_score, velocity, status, content_queue_id, hook_idea, notes, created_at, updated_at",
    )
    .order("detected_at", { ascending: false });

  if (result.error) throw new Error(result.error.message);

  const cards = (result.data ?? []).map((row) => toTrendCard(row));
  const visible = cards.filter((card) => trendMatches(card, filters));
  const hiddenExpired = filters.status ? 0 : cards.filter((card) => card.status === "expired").length;
  const niches = nicheChoices(cards.map((card) => card.niche || ""));

  return (
    <ContentChrome
      active="trends"
      title="Trends"
      description={
        <>
          {visible.length} {visible.length === 1 ? "trend" : "trends"}
          {hiddenExpired > 0 ? ` · ${hiddenExpired} expired hidden` : ""}. Newest detections first.
        </>
      }
    >
      <TrendFilters
        key={`${filters.niche}|${filters.status}|${filters.minSources}|${filters.query}`}
        filters={filters}
        niches={niches}
      />

      {visible.length === 0 ? (
        <div className="rounded-3xl bg-white/55 px-4 py-12 text-center ring-1 ring-ink/10">
          <p className="font-display text-lg font-semibold text-ink">
            {cards.length === 0 ? "No trends yet" : "No trends in this view"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {cards.length === 0
              ? "Scans will show up here after a run writes to the trends table."
              : "Try another niche, status, or search. Expired trends stay hidden until you pick that status."}
          </p>
          {filtersActive(filters) ? (
            <Link href="/content/trends" className="mt-4 inline-block text-sm font-medium text-signal hover:underline">
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </ContentChrome>
  );
}
