"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TREND_STATUSES, trendStatusLabel, type TrendFilters } from "@/lib/trends";

export function TrendFilters({
  filters,
  niches,
}: {
  filters: TrendFilters;
  niches: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [minSources, setMinSources] = useState(filters.minSources > 0 ? String(filters.minSources) : "");

  function currentMin() {
    const min = Number(minSources);
    return Number.isFinite(min) && min > 0 ? Math.floor(min) : 0;
  }

  function navigate(next: Partial<TrendFilters>) {
    const merged: TrendFilters = {
      niche: filters.niche,
      status: filters.status,
      minSources: currentMin(),
      query,
      ...next,
    };
    const params = new URLSearchParams();
    if (merged.niche) params.set("niche", merged.niche);
    if (merged.status) params.set("status", merged.status);
    if (merged.minSources > 0) params.set("min", String(merged.minSources));
    const trimmed = merged.query.trim();
    if (trimmed) params.set("q", trimmed);
    const search = params.toString();
    router.push(search ? `/content/trends?${search}` : "/content/trends", { scroll: false });
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-3xl bg-white/45 p-3 ring-1 ring-ink/10 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(8rem,0.8fr))_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ query, minSources: currentMin() });
      }}
    >
      <Field label="Search" htmlFor="trend-q">
        <input
          id="trend-q"
          type="search"
          value={query}
          placeholder="Topic or summary"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
          className={controlClass}
        />
      </Field>
      <Field label="Niche" htmlFor="trend-niche">
        <select
          id="trend-niche"
          value={filters.niche}
          onChange={(event) => navigate({ niche: event.target.value })}
          className={controlClass}
        >
          <option value="">All niches</option>
          {niches.map((niche) => (
            <option key={niche} value={niche}>
              {niche}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status" htmlFor="trend-status">
        <select
          id="trend-status"
          value={filters.status}
          onChange={(event) => navigate({ status: event.target.value })}
          className={controlClass}
        >
          <option value="">Hide expired</option>
          {TREND_STATUSES.map((status) => (
            <option key={status} value={status}>
              {trendStatusLabel(status)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Min sources" htmlFor="trend-min">
        <input
          id="trend-min"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={minSources}
          placeholder="Any"
          onChange={(event) => setMinSources(event.target.value)}
          onBlur={() => {
            const next = currentMin();
            if (next !== filters.minSources) navigate({ minSources: next });
          }}
          className={controlClass}
        />
      </Field>
      <button
        type="submit"
        className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper transition hover:bg-ink/90"
      >
        Search
      </button>
    </form>
  );
}

const controlClass =
  "h-9 w-full rounded-full bg-white/70 px-3 text-sm font-normal tracking-normal text-ink normal-case ring-1 ring-ink/10 outline-none focus-visible:ring-2 focus-visible:ring-signal";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-1 text-[11px] tracking-[0.14em] text-ink-soft uppercase">
      {label}
      {children}
    </label>
  );
}
