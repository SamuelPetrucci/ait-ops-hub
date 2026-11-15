"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { labelize } from "@/lib/format";
import type { MappedProspect, ProspectMapFilters, RouteInfo } from "@/lib/prospect-map";

const HOME_POSITION: [number, number] = [41.3501, -72.0787];
const MILE_TO_METERS = 1609.34;
const DISTANCE_RINGS = [10, 20, 30];

const STAGE_COLORS: Record<string, string> = {
  researched: "#6b7280",
  qualified: "#3b82f6",
  draft: "#8b5cf6",
  approved: "#10b981",
  sent: "#f59e0b",
  replied: "#22c55e",
  meeting_booked: "#14b8a6",
  audit_proposed: "#06b6d4",
  audit_paid: "#0ea5e9",
  implementation_proposed: "#8b5cf6",
  won: "#22c55e",
  delivered: "#10b981",
  lost: "#ef4444",
  do_not_contact: "#dc2626",
};

function getStageColor(stage: string): string {
  return STAGE_COLORS[stage] || "#6b7280";
}

function createColoredIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28">
    <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "prospect-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

const homeIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fbbf24" stroke="#000" stroke-width="1" width="32" height="32">
    <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
  </svg>`,
  className: "home-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

function FitBounds({ prospects }: { prospects: MappedProspect[] }) {
  const map = useMap();

  useEffect(() => {
    if (prospects.length === 0) {
      map.setView(HOME_POSITION, 10);
      return;
    }
    const bounds = L.latLngBounds([HOME_POSITION]);
    for (const p of prospects) {
      bounds.extend([p.lat, p.lng]);
    }
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, prospects]);

  return null;
}

type ProspectMapProps = {
  prospects: MappedProspect[];
  unmapped: { id: string; company: string; city: string | null; region: string | null }[];
  filters: ProspectMapFilters;
  routes: RouteInfo[];
  showRoutes: boolean;
  onToggleRoutes: () => void;
};

export function ProspectMapClient({
  prospects,
  unmapped,
  filters,
  routes,
  showRoutes,
  onToggleRoutes,
}: ProspectMapProps) {
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (filters.stage && p.stage !== filters.stage) return false;
      if (filters.routeId && p.route_id !== filters.routeId) return false;
      if (filters.category && p.industry !== filters.category) return false;
      if (filters.maxDistance && p.miles_from_home && p.miles_from_home > filters.maxDistance) return false;
      return true;
    });
  }, [prospects, filters]);

  const routePolylines = useMemo(() => {
    if (!showRoutes) return [];
    return routes
      .filter((r) => !filters.routeId || r.id === filters.routeId)
      .map((route) => {
        const stops = route.stops.sort((a, b) => (a.visit_order ?? 0) - (b.visit_order ?? 0));
        const points: [number, number][] = [HOME_POSITION];
        for (const stop of stops) {
          points.push([stop.lat, stop.lng]);
        }
        points.push(HOME_POSITION);
        return { id: route.id, points, color: getStageColor(stops[0]?.stage || "researched") };
      });
  }, [routes, showRoutes, filters.routeId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <MapContainer
          center={HOME_POSITION}
          zoom={10}
          className="h-[600px] rounded-xl ring-1 ring-foreground/10"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds prospects={filteredProspects} />

          {DISTANCE_RINGS.map((miles) => (
            <Circle
              key={miles}
              center={HOME_POSITION}
              radius={miles * MILE_TO_METERS}
              pathOptions={{
                color: "rgba(251, 191, 36, 0.5)",
                fillColor: "rgba(251, 191, 36, 0.05)",
                weight: 1,
                dashArray: "4 4",
              }}
            />
          ))}

          <Marker position={HOME_POSITION} icon={homeIcon}>
            <Popup>
              <strong>Home Base</strong>
              <br />
              Groton, CT
            </Popup>
          </Marker>

          {filteredProspects.map((prospect) => (
            <Marker
              key={prospect.id}
              position={[prospect.lat, prospect.lng]}
              icon={createColoredIcon(getStageColor(prospect.stage))}
            >
              <Popup>
                <div className="min-w-[200px] space-y-1">
                  <Link href={`/companies/${prospect.id}`} className="font-semibold text-primary hover:underline">
                    {prospect.company}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {labelize(prospect.stage)}
                    </Badge>
                    {prospect.industry && (
                      <Badge variant="secondary" className="text-xs">
                        {prospect.industry}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[prospect.city, prospect.region].filter(Boolean).join(", ")}
                  </p>
                  {prospect.website && (
                    <p className="text-xs">
                      <a
                        href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {prospect.website}
                      </a>
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-2 text-xs">
                    <span className="text-muted-foreground">Distance:</span>
                    <span>{prospect.miles_from_home?.toFixed(1) ?? "—"} mi</span>
                    <span className="text-muted-foreground">Drive:</span>
                    <span>{prospect.drive_minutes?.toFixed(0) ?? "—"} min</span>
                  </div>
                  {prospect.primary_opportunity && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Opportunity: </span>
                      {truncate(prospect.primary_opportunity, 80)}
                    </p>
                  )}
                  {prospect.visit_opener && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Opener: </span>
                      {truncate(prospect.visit_opener, 80)}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {routePolylines.map((route) => (
            <Polyline key={route.id} positions={route.points} pathOptions={{ color: route.color, weight: 3, opacity: 0.7 }} />
          ))}
        </MapContainer>

        <div className="text-sm text-muted-foreground">
          {filteredProspects.length} mapped prospect{filteredProspects.length !== 1 ? "s" : ""} shown.{" "}
          {unmapped.length > 0 && `${unmapped.length} not yet mapped.`}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {unmapped.length > 0 && (
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h3 className="mb-3 font-medium">Not Yet Mapped</h3>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {unmapped.map((p) => (
                <Link
                  key={p.id}
                  href={`/companies/${p.id}`}
                  className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{p.company}</span>
                  {(p.city || p.region) && (
                    <span className="ml-1 text-muted-foreground">
                      — {[p.city, p.region].filter(Boolean).join(", ")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRoutes}
            className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-foreground/10 transition ${
              showRoutes ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {showRoutes ? "Hide Routes" : "Show Routes"}
          </button>
        </div>

        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h3 className="font-medium">Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(STAGE_COLORS)
              .filter(([stage]) => prospects.some((p) => p.stage === stage))
              .map(([stage, color]) => (
                <div key={stage} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span>{labelize(stage)}</span>
                </div>
              ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <span>Home (Groton, CT)</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-0.5 w-4 border-t border-dashed border-amber-400" />
              <span>10 / 20 / 30 mile rings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
