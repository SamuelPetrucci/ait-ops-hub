"use client";

import { useRouter } from "next/navigation";

export function NicheFilterSelect({
  month,
  group,
  niche,
  day,
  channel,
  options,
}: {
  month: string;
  group: string;
  niche: string;
  day?: string;
  channel?: string;
  options: string[];
}) {
  const router = useRouter();

  function navigate(nextNiche: string) {
    const params = new URLSearchParams();
    if (group) params.set("group", group);
    if (month) params.set("month", month);
    if (day) params.set("day", day);
    if (channel) params.set("channel", channel);
    if (nextNiche) params.set("niche", nextNiche);
    const query = params.toString();
    router.push(query ? `/content?${query}` : "/content");
  }

  return (
    <label className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
      <span className="hidden sm:inline">Niche</span>
      <select
        value={niche}
        onChange={(event) => navigate(event.target.value)}
        className="rounded-full bg-white/60 px-3 py-1.5 text-xs text-ink ring-1 ring-ink/10"
        aria-label="Filter by niche"
      >
        <option value="">All niches</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
