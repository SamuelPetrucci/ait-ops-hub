"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelize } from "@/lib/format";
import {
  FOLLOW_UP_CADENCE,
  formatVisitWindow,
  OFFER,
} from "@/lib/sales-tactics";
import type { MappedProspect, ProspectMapFilters, RouteInfo, UnmappedProspect } from "@/lib/prospect-map";

const ProspectMapClient = dynamic(() => import("./prospect-map-client").then((m) => m.ProspectMapClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-xl bg-card ring-1 ring-foreground/10">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
});

type SortKey = "company" | "miles_from_home" | "drive_minutes" | "stage";
type SortDir = "asc" | "desc";

type ProspectMapViewProps = {
  mapped: MappedProspect[];
  unmapped: UnmappedProspect[];
  routes: RouteInfo[];
  stages: string[];
  categories: string[];
  routeIds: string[];
};

export function ProspectMapView({
  mapped,
  unmapped,
  routes,
  stages,
  categories,
  routeIds,
}: ProspectMapViewProps) {
  const [filters, setFilters] = useState<ProspectMapFilters>({
    stage: "",
    routeId: "",
    category: "",
    maxDistance: 50,
  });
  const [showRoutes, setShowRoutes] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("miles_from_home");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleFilterChange = (partial: Partial<ProspectMapFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const filteredProspects = useMemo(() => {
    return mapped.filter((p) => {
      if (filters.stage && p.stage !== filters.stage) return false;
      if (filters.routeId && p.route_id !== filters.routeId) return false;
      if (filters.category && p.industry !== filters.category) return false;
      if (filters.maxDistance && p.miles_from_home && p.miles_from_home > filters.maxDistance) return false;
      return true;
    });
  }, [mapped, filters]);

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
      setSortDir("asc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Stage</label>
          <select
            value={filters.stage}
            onChange={(e) => handleFilterChange({ stage: e.target.value })}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Route</label>
          <select
            value={filters.routeId}
            onChange={(e) => handleFilterChange({ routeId: e.target.value })}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
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
          <label className="mb-1 block text-sm text-muted-foreground">Category</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange({ category: e.target.value })}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Slider
            label="Max Distance"
            unit=" mi"
            min={5}
            max={100}
            step={5}
            value={filters.maxDistance}
            onChange={(e) => handleFilterChange({ maxDistance: Number(e.target.value) })}
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
      />

      {filteredRoutes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRoutes.map((route) => (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>Route: {route.id}</span>
                  <Badge variant="outline">
                    {route.stops.length} stop{route.stops.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
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
                  <ol className="space-y-2 text-sm">
                    {route.stops.map((stop, idx) => (
                      <li key={stop.id} className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                            <Link href={`/companies/${stop.id}`} className="font-medium hover:underline">
                              {stop.company}
                            </Link>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {stop.industry || "Other"}
                            </Badge>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {stop.miles_from_home?.toFixed(1)} mi · {stop.drive_minutes?.toFixed(0)} min
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

      <Card>
        <CardHeader>
          <CardTitle>All Prospects by Distance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("company")}
                >
                  Company{sortIndicator("company")}
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("stage")}
                >
                  Stage{sortIndicator("stage")}
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right hover:text-foreground"
                  onClick={() => handleSort("miles_from_home")}
                >
                  Distance{sortIndicator("miles_from_home")}
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right hover:text-foreground"
                  onClick={() => handleSort("drive_minutes")}
                >
                  Drive Time{sortIndicator("drive_minutes")}
                </TableHead>
                <TableHead>Route</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No prospects match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedProspects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/companies/${p.id}`} className="font-medium hover:underline">
                        {p.company}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[p.city, p.region].filter(Boolean).join(", ")}
                      </p>
                    </TableCell>
                    <TableCell>{p.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{labelize(p.stage)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.miles_from_home?.toFixed(1) ?? "—"} mi
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.drive_minutes?.toFixed(0) ?? "—"} min
                    </TableCell>
                    <TableCell>{p.route_id || "—"}</TableCell>
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
