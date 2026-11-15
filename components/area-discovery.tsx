"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { importDiscoveredBusinesses } from "@/app/actions/discover";
import { DISCOVERY_CATEGORIES, SIZE_BUCKETS, type CompanySizeBucket } from "@/lib/discovery/categories";
import type { DiscoverAreaResult, DiscoveredBusiness, DiscoverProgress } from "@/lib/discovery/overpass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "next/navigation";

type SearchProgress = DiscoverProgress & {
  startedAt: number;
};

const STAGE_ORDER: DiscoverProgress["stage"][] = [
  "geocode",
  "overpass",
  "wikidata",
  "assemble",
  "enrich",
  "done",
];

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function AreaDiscovery() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locationQuery, setLocationQuery] = useState("Groton, CT");
  const [radiusMiles, setRadiusMiles] = useState(12);
  const [categoryIds, setCategoryIds] = useState<string[]>(["real_estate", "professional", "healthcare"]);
  const [sizeBuckets, setSizeBuckets] = useState<CompanySizeBucket[]>(["1-10", "11-50", "unknown"]);
  const [enrichWebsites, setEnrichWebsites] = useState(false);
  const [results, setResults] = useState<DiscoveredBusiness[]>([]);
  const [meta, setMeta] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!searching || !progress) return;
    const tick = () => setElapsedMs(Date.now() - progress.startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [searching, progress]);

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSize = (bucket: CompanySizeBucket) => {
    setSizeBuckets((prev) => (prev.includes(bucket) ? prev.filter((x) => x !== bucket) : [...prev, bucket]));
  };

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (categoryIds.length && !categoryIds.includes(r.categoryId)) return false;
      if (sizeBuckets.length && !sizeBuckets.includes(r.sizeBucket)) return false;
      return true;
    });
  }, [results, categoryIds, sizeBuckets]);

  const handleDiscover = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startedAt = Date.now();
    setMessage(null);
    setMeta(null);
    setSearching(true);
    setElapsedMs(0);
    setProgress({
      stage: "geocode",
      label: `Locating ${locationQuery.trim() || "area"}…`,
      percent: 4,
      detail: "Starting search",
      startedAt,
    });

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          locationQuery,
          radiusMiles,
          categoryIds,
          sizeBuckets,
          enrichWebsites,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        let error = `Search failed (${response.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) error = parsed.error;
        } catch {
          // keep default
        }
        throw new Error(error);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: DiscoverAreaResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = JSON.parse(trimmed) as
            | ({ type: "progress" } & DiscoverProgress)
            | { type: "result"; result: DiscoverAreaResult }
            | { type: "error"; error: string };

          if (event.type === "progress") {
            setProgress({
              stage: event.stage,
              label: event.label,
              percent: event.percent,
              found: event.found,
              detail: event.detail,
              startedAt,
            });
          } else if (event.type === "result") {
            finalResult = event.result;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      if (!finalResult) {
        throw new Error("Search ended without results");
      }

      setResults(finalResult.businesses);
      setSelected(new Set(finalResult.businesses.slice(0, 25).map((b) => b.osmKey)));
      setMeta(
        `${finalResult.businesses.length} businesses · ${finalResult.radiusMiles} mi of ${finalResult.center.label} · ${finalResult.source}`,
      );
      setProgress({
        stage: "done",
        label: `Found ${finalResult.businesses.length} business${finalResult.businesses.length === 1 ? "" : "es"}`,
        percent: 100,
        found: finalResult.businesses.length,
        detail: finalResult.center.label,
        startedAt,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setMessage("Search cancelled");
        setProgress(null);
      } else {
        setResults([]);
        setMeta(null);
        setMessage(error instanceof Error ? error.message : "Discovery failed");
        setProgress(null);
      }
    } finally {
      setSearching(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCancelSearch = () => {
    abortRef.current?.abort();
  };

  const toggleSelect = (osmKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(osmKey)) next.delete(osmKey);
      else next.add(osmKey);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((b) => b.osmKey)));
  };

  const handleImport = () => {
    const rows = filtered.filter((b) => selected.has(b.osmKey));
    if (rows.length === 0) {
      setMessage("Select at least one business to import");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await importDiscoveredBusinesses({
        businesses: rows.map((b) => ({
          osmKey: b.osmKey,
          company: b.company,
          website: b.website,
          phone: b.phone,
          email: b.email,
          address: b.address,
          city: b.city,
          region: b.region,
          lat: b.lat,
          lng: b.lng,
          industry: b.industry,
          service: b.service,
          sizeBucket: b.sizeBucket,
          milesFromHome: b.milesFromHome,
          driveMinutes: b.driveMinutes,
        })),
      });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `Imported ${result.imported}, skipped ${result.skipped}${
          result.errors.length ? ` · ${result.errors.slice(0, 2).join("; ")}` : ""
        }`,
      );
      router.refresh();
    });
  };

  const busy = searching || isPending;
  const progressPercent = Math.min(100, Math.max(0, progress?.percent ?? 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Discover area (free)</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              OpenStreetMap + Wikidata — no Apify runs. Filter by industry, service niche, and estimated size.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs text-muted-foreground">Town / area</label>
              <Input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Groton, CT"
                className="h-9"
                disabled={searching}
              />
            </div>
            <div>
              <Slider
                label="Radius"
                unit=" mi"
                min={3}
                max={30}
                step={1}
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                disabled={searching}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={enrichWebsites}
                  onChange={(e) => setEnrichWebsites(e.target.checked)}
                  className="rounded border-input"
                  disabled={searching}
                />
                Sniff websites for size (slower, free)
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Industry / service</p>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_CATEGORIES.map((cat) => {
                const active = categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={searching}
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-full px-3 py-1 text-xs transition disabled:opacity-50 ${
                      active ? "bg-ink text-paper" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Estimated company size</p>
            <div className="flex flex-wrap gap-2">
              {SIZE_BUCKETS.map((bucket) => {
                const active = sizeBuckets.includes(bucket);
                return (
                  <button
                    key={bucket}
                    type="button"
                    disabled={searching}
                    onClick={() => toggleSize(bucket)}
                    className={`rounded-full px-3 py-1 text-xs transition disabled:opacity-50 ${
                      active ? "bg-signal/20 text-ink ring-1 ring-signal/40" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {bucket}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleDiscover} disabled={busy || categoryIds.length === 0}>
              {searching ? "Searching…" : "Search OpenStreetMap"}
            </Button>
            {searching ? (
              <Button size="sm" variant="outline" onClick={handleCancelSearch}>
                Cancel
              </Button>
            ) : null}
            {filtered.length > 0 && !searching ? (
              <>
                <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={isPending}>
                  Select shown ({filtered.length})
                </Button>
                <Button size="sm" variant="outline" onClick={handleImport} disabled={isPending || selected.size === 0}>
                  Import selected ({[...selected].filter((k) => filtered.some((b) => b.osmKey === k)).length})
                </Button>
              </>
            ) : null}
          </div>

          {progress ? (
            <div
              className="space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10"
              role="status"
              aria-live="polite"
              aria-busy={searching}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{progress.label}</p>
                  {progress.detail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{progress.detail}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  <div>{Math.round(progressPercent)}%</div>
                  <div>{formatElapsed(elapsedMs)}</div>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full bg-signal transition-[width] duration-300 ease-out ${
                    searching && progress.stage !== "done" ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                {STAGE_ORDER.filter((stage) => enrichWebsites || stage !== "enrich").map((stage) => {
                  const currentIdx = STAGE_ORDER.indexOf(progress.stage);
                  const stageIdx = STAGE_ORDER.indexOf(stage);
                  const done = stageIdx < currentIdx || progress.stage === "done";
                  const active = stage === progress.stage && searching;
                  const label =
                    stage === "geocode"
                      ? "Locate"
                      : stage === "overpass"
                        ? "Map search"
                        : stage === "wikidata"
                          ? "Size data"
                          : stage === "assemble"
                            ? "Assemble"
                            : stage === "enrich"
                              ? "Websites"
                              : "Done";
                  return (
                    <li
                      key={stage}
                      className={`rounded-lg px-2 py-1.5 text-[11px] ${
                        active
                          ? "bg-ink text-paper"
                          : done
                            ? "bg-signal/15 text-ink"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {label}
                      {stage === progress.stage && typeof progress.found === "number" && stage !== "done"
                        ? ` · ${progress.found}`
                        : ""}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

          {filtered.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border rounded-xl ring-1 ring-foreground/10">
              {filtered.map((biz) => {
                const checked = selected.has(biz.osmKey);
                return (
                  <li key={biz.osmKey} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(biz.osmKey)}
                      className="mt-1"
                      aria-label={`Select ${biz.company}`}
                      disabled={searching}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{biz.company}</span>
                        <Badge variant="secondary">{biz.industry}</Badge>
                        <Badge variant="outline">{biz.sizeBucket}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {biz.city || "—"} · {biz.milesFromHome} mi · {biz.service}
                        {biz.website ? ` · ${biz.website.replace(/^https?:\/\//, "")}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Map data © OpenStreetMap contributors (ODbL). Size is an estimate from Wikidata / OSM tags
            {enrichWebsites ? " / website text" : ""}.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
