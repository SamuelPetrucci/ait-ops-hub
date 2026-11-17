"use client";

import { useState, useMemo, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelize } from "@/lib/format";
import {
  FOLLOW_UP_CADENCE,
  formatVisitWindow,
  OFFER,
} from "@/lib/sales-tactics";
import { buildDaySalesPlan, type DaySalesPlan } from "@/lib/day-plan";
import { reverseGeocodePin } from "@/app/actions/discover";
import { geocodeMissingProspects } from "@/app/actions/geocode";
import { saveRoute, deleteRoute, type SavedRoute } from "@/app/actions/routes";
import { AreaDiscovery, type DiscoveryPin } from "@/components/area-discovery";
import type { DiscoveredBusiness } from "@/lib/discovery/overpass";
import { buildGoogleMapsUrl, orderByNearestNeighbor, type RouteStop } from "@/lib/routes";
import {
  crmSearchParams,
  groupOptionsForStages,
  stageAllowed,
  type CrmFilters,
  type ProspectScope,
} from "@/lib/crm";
import {
  matchesMapFilters,
  type MappedProspect,
  type ProspectMapFilters,
  type RouteInfo,
  type UnmappedProspect,
} from "@/lib/prospect-map";
import { getProspectGroupLabel } from "@/lib/status-groups";

const ProspectMapClient = dynamic(() => import("./prospect-map-client").then((m) => m.ProspectMapClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-xl bg-card ring-1 ring-foreground/10 sm:h-[600px]">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
});

type SortKey = "company" | "miles_from_home" | "drive_minutes" | "stage" | "lead_score";
type SortDir = "asc" | "desc";

const HOME_LAT = 41.3501;
const HOME_LNG = -72.0787;

type ProspectMapViewProps = {
  mapped: MappedProspect[];
  unmapped: UnmappedProspect[];
  routes: RouteInfo[];
  categories: string[];
  routeIds: string[];
  towns: string[];
  savedRoutes: SavedRoute[];
  scope?: ProspectScope;
  initialFilters?: CrmFilters;
};

function mapFiltersFromCrm(initial?: CrmFilters): ProspectMapFilters {
  const minScore = Number(initial?.score || 0);
  const maxDistance = Number(initial?.maxDistance || 50);
  return {
    stage: initial?.stage || "",
    stageGroup: initial?.stageGroup || "",
    routeId: initial?.routeId || "",
    category: initial?.industry || "",
    maxDistance: Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : 50,
    town: initial?.town || "",
    minScore: Number.isFinite(minScore) ? minScore : 0,
  };
}

export function ProspectMapView({
  mapped,
  unmapped,
  routes,
  categories,
  routeIds,
  towns,
  savedRoutes,
  scope = "leads",
  initialFilters,
}: ProspectMapViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<ProspectMapFilters>(() => mapFiltersFromCrm(initialFilters));
  const [showRoutes, setShowRoutes] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const stageGroups = useMemo(
    () => groupOptionsForStages(mapped.map((p) => p.stage), filters.stageGroup),
    [mapped, filters.stageGroup],
  );

  const syncFiltersToUrl = (next: ProspectMapFilters) => {
    if (!pathname.startsWith("/crm")) return;
    const qs = crmSearchParams({
      scope,
      view: "map",
      filters: {
        q: initialFilters?.q || "",
        stage: next.stage,
        stageGroup: next.stageGroup,
        industry: next.category,
        score: next.minScore > 0 ? String(next.minScore) : "",
        followUp: initialFilters?.followUp || "",
        owner: initialFilters?.owner || "",
        includeDnc: initialFilters?.includeDnc || "",
        town: next.town,
        routeId: next.routeId,
        maxDistance: next.maxDistance !== 50 ? String(next.maxDistance) : "",
      },
    });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [sortKey, setSortKey] = useState<SortKey>("miles_from_home");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [routeName, setRouteName] = useState("");
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  const [dayPlan, setDayPlan] = useState<DaySalesPlan | null>(null);
  const [maxDayStops, setMaxDayStops] = useState(8);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [dropPinMode, setDropPinMode] = useState(false);
  const [discoveryPin, setDiscoveryPin] = useState<DiscoveryPin | null>(null);
  const [discoveryRadiusMiles, setDiscoveryRadiusMiles] = useState(12);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<DiscoveredBusiness[]>([]);

  const handleFilterChange = (partial: Partial<ProspectMapFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      syncFiltersToUrl(next);
      return next;
    });
  };

  const filteredProspects = useMemo(() => {
    return mapped.filter((p) =>
      matchesMapFilters(p, filters, (stage) =>
        stageAllowed(stage, scope, {
          stage: filters.stage,
          stageGroup: filters.stageGroup,
          includeDnc: initialFilters?.includeDnc || "",
        }),
      ),
    );
  }, [mapped, filters, scope, initialFilters?.includeDnc]);

  const sortedProspects = useMemo(() => {
    const sorted = [...filteredProspects].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") {
        cmp = a.company.localeCompare(b.company);
      } else if (sortKey === "miles_from_home") {
        cmp = (a.miles_from_home ?? 999) - (b.miles_from_home ?? 999);
      } else if (sortKey === "drive_minutes") {
        cmp = (a.drive_minutes ?? 999) - (b.drive_minutes ?? 999);
      } else if (sortKey === "stage") {
        cmp = a.stage.localeCompare(b.stage);
      } else if (sortKey === "lead_score") {
        cmp = (b.lead_score ?? 0) - (a.lead_score ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProspects, sortKey, sortDir]);

  const filteredRoutes = useMemo(() => {
    if (!filters.routeId) return routes;
    return routes.filter((r) => r.id === filters.routeId);
  }, [routes, filters.routeId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "lead_score" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 10) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedProspects = useMemo(() => {
    return mapped.filter((p) => selectedIds.has(p.id));
  }, [mapped, selectedIds]);

  const plannedRoute = useMemo(() => {
    if (selectedProspects.length === 0) return null;
    const stops: RouteStop[] = selectedProspects.map((p) => ({
      id: p.id,
      company: p.company,
      lat: p.lat,
      lng: p.lng,
      city: p.city,
      industry: p.industry,
    }));
    return orderByNearestNeighbor(stops, HOME_LAT, HOME_LNG);
  }, [selectedProspects]);

  const googleMapsUrl = useMemo(() => {
    const stops = dayPlan?.stops ?? plannedRoute?.ordered;
    if (!stops || stops.length === 0) return null;
    return buildGoogleMapsUrl(stops, HOME_LAT, HOME_LNG);
  }, [dayPlan, plannedRoute]);

  const handleBuildDayPlan = (fromSelection: boolean) => {
    const pool = fromSelection && selectedProspects.length > 0 ? selectedProspects : filteredProspects;
    if (pool.length === 0) {
      setPlannerMessage("No mapped prospects in the current filter. Discover or clear filters first.");
      setDayPlan(null);
      return;
    }

    const plan = buildDaySalesPlan(
      pool.map((p) => ({
        id: p.id,
        company: p.company,
        lat: p.lat,
        lng: p.lng,
        city: p.city,
        industry: p.industry,
        lead_score: p.lead_score,
        miles_from_home: p.miles_from_home,
        visit_opener: p.visit_opener,
        primary_opportunity: p.primary_opportunity,
        proposed_service: p.proposed_service,
        stage: p.stage,
      })),
      {
        startLat: HOME_LAT,
        startLng: HOME_LNG,
        startAddress: "Groton, CT",
        maxStops: maxDayStops,
        respectVisitWindows: true,
      }
    );

    setDayPlan(plan);
    setSelectedIds(new Set(plan.stops.map((s) => s.id)));
    setRouteName(plan.title);
    setPlannerMessage(
      `Day plan ready: ${plan.stopCount} stops · pitch, proposal idea, card drop, book calls.`
    );
  };

  const handleMapDropPin = (lat: number, lng: number) => {
    const provisional: DiscoveryPin = {
      lat,
      lng,
      label: `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    };
    setDiscoveryPin(provisional);
    setDropPinMode(false);
    setDiscoveredBusinesses([]);
    startTransition(async () => {
      const result = await reverseGeocodePin(lat, lng);
      if ("label" in result) {
        setDiscoveryPin({ lat, lng, label: result.label });
      }
    });
  };

  const handleCopyDayPlan = async () => {
    if (!dayPlan) return;
    try {
      await navigator.clipboard.writeText(dayPlan.summaryText);
      setCopyStatus("Copied day plan to clipboard");
      setTimeout(() => setCopyStatus(null), 2500);
    } catch {
      setCopyStatus("Could not copy — select the summary text manually");
    }
  };

  const handleSaveRoute = async () => {
    const stops = dayPlan?.stops ?? plannedRoute?.ordered;
    const totalKm = dayPlan?.totalKm ?? plannedRoute?.totalKm;
    if (!stops || stops.length === 0 || totalKm == null || !routeName.trim()) {
      setPlannerMessage("Build a day plan (or select stops) and enter a route name");
      return;
    }
    setPlannerMessage(null);
    startTransition(async () => {
      const result = await saveRoute(
        routeName.trim(),
        stops.map((s) => ({
          id: s.id,
          company: s.company,
          lat: s.lat,
          lng: s.lng,
          city: s.city,
          industry: s.industry,
        })),
        "Groton, CT",
        HOME_LAT,
        HOME_LNG,
        totalKm
      );
      if ("error" in result) {
        setPlannerMessage(result.error);
      } else {
        setPlannerMessage("Route saved!");
        setRouteName("");
        setSelectedIds(new Set());
        router.refresh();
      }
    });
  };

  const handleDeleteRoute = async (id: string) => {
    startTransition(async () => {
      const result = await deleteRoute(id);
      if (!result.success) {
        setPlannerMessage(result.error || "Failed to delete");
      } else {
        router.refresh();
      }
    });
  };

  const handleGeocode = async () => {
    setGeocodeMessage("Geocoding...");
    startTransition(async () => {
      try {
        const result = await geocodeMissingProspects();
        setGeocodeMessage(
          `Done: ${result.geocoded} geocoded, ${result.skipped} skipped (no address), ${result.failed} failed`
        );
        router.refresh();
      } catch (error) {
        setGeocodeMessage(error instanceof Error ? error.message : "Geocoding failed");
      }
    });
  };

  const hasActiveFilters =
    filters.stage ||
    filters.stageGroup ||
    filters.routeId ||
    filters.category ||
    filters.town ||
    filters.maxDistance !== 50 ||
    filters.minScore !== 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <AreaDiscovery
        pin={discoveryPin}
        onPinChange={setDiscoveryPin}
        dropPinMode={dropPinMode}
        onDropPinModeChange={setDropPinMode}
        radiusMiles={discoveryRadiusMiles}
        onRadiusChange={setDiscoveryRadiusMiles}
        results={discoveredBusinesses}
        onResultsChange={setDiscoveredBusinesses}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 sm:hidden"
          >
            Filters
            {hasActiveFilters ? <span className="size-2 rounded-full bg-signal" /> : null}
          </Button>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                handleFilterChange({
                  stage: "",
                  stageGroup: "",
                  routeId: "",
                  category: "",
                  town: "",
                  maxDistance: 50,
                  minScore: 0,
                })
              }
            >
              Clear filters
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{filteredProspects.length} shown</span>
      </div>

      <div className={`grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 ${showFilters ? "" : "hidden sm:grid"}`}>
        <div>
          <label className="mb-1 block text-xs sm:text-sm text-muted-foreground">Stage</label>
          <select
            value={filters.stageGroup}
            onChange={(e) => handleFilterChange({ stageGroup: e.target.value, stage: "" })}
            className="h-8 sm:h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs sm:text-sm"
            aria-label="Stage group"
          >
            <option value="">All stages</option>
            {stageGroups.map((group) => (
              <option key={group} value={group}>
                {getProspectGroupLabel(group)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs sm:text-sm text-muted-foreground">Niche</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange({ category: e.target.value })}
            className="h-8 sm:h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs sm:text-sm"
          >
            <option value="">All niches</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs sm:text-sm text-muted-foreground">Town</label>
          <select
            value={filters.town}
            onChange={(e) => handleFilterChange({ town: e.target.value })}
            className="h-8 sm:h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs sm:text-sm"
          >
            <option value="">All towns</option>
            {towns.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs sm:text-sm text-muted-foreground">Route</label>
          <select
            value={filters.routeId}
            onChange={(e) => handleFilterChange({ routeId: e.target.value })}
            className="h-8 sm:h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs sm:text-sm"
          >
            <option value="">All routes</option>
            {routeIds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Slider
            label="Max Dist"
            unit=" mi"
            min={5}
            max={100}
            step={5}
            value={filters.maxDistance}
            onChange={(e) => handleFilterChange({ maxDistance: Number(e.target.value) })}
          />
        </div>
        <div>
          <Slider
            label="Min Score"
            unit=""
            min={0}
            max={100}
            step={10}
            value={filters.minScore}
            onChange={(e) => handleFilterChange({ minScore: Number(e.target.value) })}
          />
        </div>
      </div>

      <ProspectMapClient
        prospects={mapped}
        unmapped={unmapped}
        filters={filters}
        routes={routes}
        showRoutes={showRoutes}
        onToggleRoutes={() => setShowRoutes((v) => !v)}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        plannedRoute={dayPlan?.stops || plannedRoute?.ordered || []}
        dropPinMode={dropPinMode}
        discoveryPin={discoveryPin}
        discoveryRadiusMiles={discoveryRadiusMiles}
        discoveredBusinesses={discoveredBusinesses}
        onMapDropPin={handleMapDropPin}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Day sales plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Build a stop order for the day: pitch opener, rough proposal idea per company, card drops,
              pain-point questions, and discovery-call asks. Auto-picks from the current map filter, or uses your selection.
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Max stops</label>
                <select
                  value={maxDayStops}
                  onChange={(e) => setMaxDayStops(Number(e.target.value))}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs sm:text-sm"
                >
                  {[5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={() => handleBuildDayPlan(false)} disabled={filteredProspects.length === 0}>
                Plan my day
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBuildDayPlan(true)}
                disabled={selectedProspects.length === 0}
              >
                Plan from selection
              </Button>
            </div>

            <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <li>1. Converse with decision-maker / front desk</li>
              <li>2. Drop card + leave the offer</li>
              <li>3. Ask 1–2 pain-point questions</li>
              <li>4. Book a discovery call (Calendly)</li>
            </ul>

            {dayPlan ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <Badge variant="outline">{dayPlan.stopCount} stops</Badge>
                  <span className="text-muted-foreground">
                    ~{dayPlan.totalMiles.toFixed(1)} mi · {dayPlan.dateLabel}
                  </span>
                </div>

                <ol className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {dayPlan.stops.map((stop) => (
                    <li key={stop.id} className="rounded-lg bg-muted/50 p-3 text-xs sm:text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            <span className="mr-1.5 text-muted-foreground">{stop.order}.</span>
                            <Link href={`/companies/${stop.id}`} className="hover:underline">
                              {stop.company}
                            </Link>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[stop.city, stop.industryCategory].filter(Boolean).join(" · ")} ·{" "}
                            {stop.visitWindow}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2">
                        <span className="text-muted-foreground">Pitch / opener: </span>
                        {stop.opener}
                      </p>
                      {stop.proposedService ? (
                        <p className="mt-1">
                          <span className="text-muted-foreground">Service niche: </span>
                          {stop.proposedService}
                        </p>
                      ) : null}
                      {stop.opportunity ? (
                        <p className="mt-1">
                          <span className="text-muted-foreground">Opportunity: </span>
                          {stop.opportunity}
                        </p>
                      ) : null}
                      <p className="mt-2 rounded-md bg-background/60 p-2 ring-1 ring-foreground/5">
                        <span className="text-muted-foreground">Proposal idea: </span>
                        {stop.proposalIdea}
                      </p>
                      <div className="mt-2">
                        <p className="text-muted-foreground">Pain points to discuss:</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {stop.painPoints.map((pain) => (
                            <li key={pain}>{pain}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="mt-2">
                        <span className="text-muted-foreground">Card drop: </span>
                        {stop.cardDropLine}
                      </p>
                      <p className="mt-1">
                        <span className="text-muted-foreground">Call ask: </span>
                        {stop.callAsk}
                      </p>
                      <p className="mt-1 text-xs">
                        <a
                          href={stop.bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Discovery call link
                        </a>
                      </p>
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                  {googleMapsUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                        Open in Google Maps
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleCopyDayPlan}>
                    Copy plan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDayPlan(null);
                      setSelectedIds(new Set());
                      setRouteName("");
                      setPlannerMessage(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-2 sm:flex-row">
                  <Input
                    placeholder="Route name"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="h-8 flex-1 text-sm"
                  />
                  <Button size="sm" onClick={handleSaveRoute} disabled={isPending}>
                    Save route
                  </Button>
                </div>
                {(plannerMessage || copyStatus) && (
                  <p className="text-xs text-muted-foreground">{copyStatus || plannerMessage}</p>
                )}
                <p className="text-xs text-muted-foreground">Offer: {dayPlan.offer}</p>
              </div>
            ) : selectedProspects.length > 0 && plannedRoute ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <Badge variant="outline">{plannedRoute.ordered.length} selected</Badge>
                  <span className="text-muted-foreground">
                    ~{(plannedRoute.totalKm * 0.621371).toFixed(1)} mi straight-line — hit{" "}
                    <strong>Plan from selection</strong> for scripts
                  </span>
                </div>
                <ol className="space-y-1 text-xs sm:text-sm">
                  {plannedRoute.ordered.map((stop, idx) => (
                    <li key={stop.id} className="flex items-center gap-2">
                      <span className="w-5 text-muted-foreground">{idx + 1}.</span>
                      <Link href={`/companies/${stop.id}`} className="truncate hover:underline">
                        {stop.company}
                      </Link>
                      <span className="ml-auto shrink-0 text-muted-foreground">{stop.city}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {googleMapsUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                        Open in Google Maps
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
                {plannerMessage && <p className="text-xs text-muted-foreground">{plannerMessage}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic sm:text-sm">
                No day plan yet. Drop a pin → discover → import, then <strong>Plan my day</strong>,
                or select pins and use <strong>Plan from selection</strong>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Saved Routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedRoutes.length === 0 ? (
              <p className="text-xs text-muted-foreground sm:text-sm">No saved routes yet.</p>
            ) : (
              savedRoutes.map((route) => (
                <div key={route.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{route.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {route.stops.length} stops · ~{((route.total_distance_km ?? 0) * 0.621371).toFixed(1)} mi
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={buildGoogleMapsUrl(route.stops, route.start_lat, route.start_lng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Go
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRoute(route.id)}
                      disabled={isPending}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="border-t border-border pt-3">
              <h4 className="mb-2 text-sm font-medium">Every-stop checklist</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>Conversation started</li>
                <li>Card + offer left behind</li>
                <li>Pain points noted</li>
                <li>Discovery call booked or declined logged</li>
              </ul>
              <div className="mt-3 space-y-1 text-xs">
                <p className="font-medium">Follow-up cadence</p>
                {FOLLOW_UP_CADENCE.map((step) => (
                  <p key={step.day} className="text-muted-foreground">
                    <strong>{step.action}:</strong> {step.note}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredRoutes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRoutes.map((route) => (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Route: {route.id}</span>
                  <Badge variant="outline">
                    {route.stops.length} stop{route.stops.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Distance:</span>
                    <span className="ml-1 font-medium">{route.totalMiles.toFixed(1)} mi</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Drive:</span>
                    <span className="ml-1 font-medium">{route.totalDriveMinutes.toFixed(0)} min</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Stops (in visit order):</h4>
                  <ol className="space-y-2 text-xs sm:text-sm">
                    {route.stops.map((stop, idx) => (
                      <li key={stop.id} className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                            <Link href={`/companies/${stop.id}`} className="font-medium hover:underline">
                              {stop.company}
                            </Link>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {stop.industry || "Other"}
                            </Badge>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {stop.miles_from_home?.toFixed(1)} mi
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Best window: {formatVisitWindow(stop.industry)}
                        </p>
                        {stop.visit_opener && (
                          <p className="mt-1 text-xs">
                            <span className="text-muted-foreground">Opener: </span>
                            {stop.visit_opener}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="border-t border-border pt-3">
                  <h4 className="mb-2 text-sm font-medium">Sales Tactic</h4>
                  <div className="space-y-2 text-xs">
                    <p>
                      <span className="text-muted-foreground">Offer: </span>
                      {OFFER.summary}
                    </p>
                    <div>
                      <span className="text-muted-foreground">Follow-up Cadence:</span>
                      <ul className="mt-1 space-y-1 pl-3">
                        {FOLLOW_UP_CADENCE.map((step) => (
                          <li key={step.day}>
                            <strong>{step.action}:</strong> {step.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {unmapped.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base sm:text-lg">
              <span>Needs Address ({unmapped.length})</span>
              <Button size="sm" variant="outline" onClick={handleGeocode} disabled={isPending}>
                Geocode Missing
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {geocodeMessage && (
              <p className="mb-3 text-xs sm:text-sm text-muted-foreground">{geocodeMessage}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {unmapped.slice(0, 20).map((p) => (
                <Link
                  key={p.id}
                  href={`/companies/${p.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                >
                  {p.company}
                  {p.city && <span className="text-muted-foreground">({p.city})</span>}
                </Link>
              ))}
              {unmapped.length > 20 && (
                <span className="text-xs text-muted-foreground">+{unmapped.length - 20} more</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">All Prospects by Distance</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("company")}
                >
                  Company{sortIndicator("company")}
                </TableHead>
                <TableHead className="hidden sm:table-cell">Niche</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("stage")}
                >
                  Stage{sortIndicator("stage")}
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right hover:text-foreground hidden sm:table-cell"
                  onClick={() => handleSort("lead_score")}
                >
                  Score{sortIndicator("lead_score")}
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right hover:text-foreground"
                  onClick={() => handleSort("miles_from_home")}
                >
                  Dist{sortIndicator("miles_from_home")}
                </TableHead>
                <TableHead className="hidden md:table-cell">Route</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No prospects match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedProspects.map((p) => (
                  <TableRow key={p.id} className={selectedIds.has(p.id) ? "bg-primary/10" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        disabled={!selectedIds.has(p.id) && selectedIds.size >= 10}
                        className="h-4 w-4 rounded border-input"
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/companies/${p.id}`} className="font-medium hover:underline">
                        {p.company}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[p.city, p.region].filter(Boolean).join(", ")}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{labelize(p.stage)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {p.lead_score ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.miles_from_home?.toFixed(1) ?? "—"} mi
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{p.route_id || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
