"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { nicheLabel, platformLabel, type ReferenceFilters } from "@/lib/references";

export function ReferenceFilters({
  filters,
  niches,
  platforms,
}: {
  filters: ReferenceFilters;
  niches: string[];
  platforms: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);

  function navigate(next: Partial<ReferenceFilters>) {
    const merged: ReferenceFilters = {
      niche: filters.niche,
      platform: filters.platform,
      query,
      ...next,
    };
    const params = new URLSearchParams();
    if (merged.niche) params.set("niche", merged.niche);
    if (merged.platform) params.set("platform", merged.platform);
    const trimmed = merged.query.trim();
    if (trimmed) params.set("q", trimmed);
    const search = params.toString();
    router.push(search ? `/content/references?${search}` : "/content/references", { scroll: false });
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-3xl bg-white/45 p-3 ring-1 ring-ink/10 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(8rem,0.9fr))_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ query });
      }}
    >
      <Field label="Search" htmlFor="reference-q">
        <input
          id="reference-q"
          type="search"
          value={query}
          placeholder="Title, creator, why it works"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
          className={controlClass}
        />
      </Field>
      <Field label="Niche" htmlFor="reference-niche">
        <select
          id="reference-niche"
          value={filters.niche}
          onChange={(event) => navigate({ niche: event.target.value })}
          className={controlClass}
        >
          <option value="">All niches</option>
          {niches.map((niche) => (
            <option key={niche} value={niche}>
              {nicheLabel(niche)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Platform" htmlFor="reference-platform">
        <select
          id="reference-platform"
          value={filters.platform}
          onChange={(event) => navigate({ platform: event.target.value })}
          className={controlClass}
        >
          <option value="">All platforms</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platformLabel(platform)}
            </option>
          ))}
        </select>
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
    <label
      htmlFor={htmlFor}
      className="flex min-w-0 flex-col gap-1 text-[11px] tracking-[0.14em] text-ink-soft uppercase"
    >
      {label}
      {children}
    </label>
  );
}
