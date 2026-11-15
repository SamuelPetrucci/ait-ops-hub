"use client";

import { useMemo, useState, useTransition } from "react";
import { discoverArea, importDiscoveredBusinesses } from "@/app/actions/discover";
import { DISCOVERY_CATEGORIES, SIZE_BUCKETS, type CompanySizeBucket } from "@/lib/discovery/categories";
import type { DiscoveredBusiness } from "@/lib/discovery/overpass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "next/navigation";

export type DiscoveryPin = {
  lat: number;
  lng: number;
  label: string;
};

type AreaDiscoveryProps = {
  pin: DiscoveryPin | null;
  onPinChange: (pin: DiscoveryPin | null) => void;
  dropPinMode: boolean;
  onDropPinModeChange: (enabled: boolean) => void;
  radiusMiles: number;
  onRadiusChange: (miles: number) => void;
  results: DiscoveredBusiness[];
  onResultsChange: (businesses: DiscoveredBusiness[]) => void;
};

export function AreaDiscovery({
  pin,
  onPinChange,
  dropPinMode,
  onDropPinModeChange,
  radiusMiles,
  onRadiusChange,
  results,
  onResultsChange,
}: AreaDiscoveryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locationQuery, setLocationQuery] = useState("Groton, CT");
  const [categoryIds, setCategoryIds] = useState<string[]>(["real_estate", "professional", "healthcare"]);
  const [sizeBuckets, setSizeBuckets] = useState<CompanySizeBucket[]>(["1-10", "11-50", "unknown"]);
  const [enrichWebsites, setEnrichWebsites] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);

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

  const handleDiscover = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await discoverArea({
        locationQuery: pin?.label || locationQuery,
        radiusMiles,
        categoryIds,
        sizeBuckets,
        enrichWebsites,
        lat: pin?.lat,
        lng: pin?.lng,
      });
      if ("error" in result) {
        setMessage(result.error);
        onResultsChange([]);
        setMeta(null);
        return;
      }
      onResultsChange(result.businesses);
      setSelected(new Set(result.businesses.slice(0, 25).map((b) => b.osmKey)));
      setMeta(
        `${result.businesses.length} businesses · ${result.radiusMiles} mi of ${result.center.label} · ${result.source}`,
      );
      // Keep pin synced with the resolved search center
      onPinChange({
        lat: result.center.lat,
        lng: result.center.lng,
        label: result.center.label,
      });
      if (!pin) {
        setLocationQuery(result.center.label.split(",").slice(0, 2).join(",").trim() || locationQuery);
      }
    });
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
        }. Use Plan my day for a route with pitches + proposal ideas.`,
      );
      onResultsChange([]);
      setSelected(new Set());
      router.refresh();
    });
  };

  const clearPin = () => {
    onPinChange(null);
    onDropPinModeChange(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Discover area (free)</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Drop a pin on the map or type a town. OpenStreetMap + Wikidata — filter by niche and size, then import.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={dropPinMode ? "default" : "outline"}
              onClick={() => onDropPinModeChange(!dropPinMode)}
            >
              {dropPinMode ? "Click the map…" : "Drop pin on map"}
            </Button>
            {pin ? (
              <Button size="sm" variant="ghost" onClick={clearPin}>
                Clear pin
              </Button>
            ) : null}
            {pin ? (
              <span className="text-xs text-muted-foreground">
                Pin: {pin.label} ({pin.lat.toFixed(4)}, {pin.lng.toFixed(4)})
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Or search by town name below</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                {pin ? "Pin label / town" : "Town / area"}
              </label>
              <Input
                value={pin ? pin.label : locationQuery}
                onChange={(e) => {
                  if (pin) {
                    onPinChange({ ...pin, label: e.target.value });
                  } else {
                    setLocationQuery(e.target.value);
                  }
                }}
                placeholder="Groton, CT"
                className="h-9"
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
                onChange={(e) => onRadiusChange(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={enrichWebsites}
                  onChange={(e) => setEnrichWebsites(e.target.checked)}
                  className="rounded border-input"
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
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
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
                    onClick={() => toggleSize(bucket)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
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
            <Button size="sm" onClick={handleDiscover} disabled={isPending || categoryIds.length === 0}>
              {isPending ? "Searching map…" : pin ? "Search around pin" : "Search OpenStreetMap"}
            </Button>
            {filtered.length > 0 ? (
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
