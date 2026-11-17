"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DiscoveryPin } from "@/components/area-discovery";
import { ProspectScoreSelect } from "@/components/prospect-score-select";
import { PROSPECT_STAGES } from "@/lib/constants";
import { stageLabel } from "@/lib/crm";
import type { DiscoveredBusiness } from "@/lib/discovery/overpass";
import { matchesMapFilters, type MappedProspect, type ProspectMapFilters, type RouteInfo } from "@/lib/prospect-map";
import {
  getProspectGroupFromStage,
  getProspectStageHex,
  PROSPECT_PIPELINE_HEX,
} from "@/lib/status-groups";

const HOME_POSITION: [number, number] = [41.3501, -72.0787];
const MILE_TO_METERS = 1609.34;
const DISTANCE_RINGS = [10, 20, 30];

function getStageColor(stage: string): string {
  return getProspectStageHex(stage);
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

const discoveryPinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
    <path fill="#e11d48" stroke="#fff" stroke-width="1.5" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
  </svg>`,
  className: "discovery-pin-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const discoveredBizIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22">
    <circle cx="12" cy="12" r="8" fill="#0ea5e9" stroke="#fff" stroke-width="2" opacity="0.95"/>
  </svg>`,
  className: "discovered-biz-marker",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
});

function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

function FitBounds({
  prospects,
  pin,
  discovered,
}: {
  prospects: MappedProspect[];
  pin: DiscoveryPin | null;
  discovered: DiscoveredBusiness[];
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([HOME_POSITION]);
    let hasPoints = false;

    if (pin) {
      bounds.extend([pin.lat, pin.lng]);
      hasPoints = true;
    }
    for (const p of prospects) {
      bounds.extend([p.lat, p.lng]);
      hasPoints = true;
    }
    for (const b of discovered.slice(0, 80)) {
      bounds.extend([b.lat, b.lng]);
      hasPoints = true;
    }

    if (!hasPoints) {
      map.setView(HOME_POSITION, 10);
      return;
    }
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, prospects, pin, discovered]);

  return null;
}

function MapClickHandler({
  enabled,
  onDrop,
}: {
  enabled: boolean;
  onDrop: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type PlannedStop = {
  id: string;
  company: string;
  lat: number;
  lng: number;
  city: string | null;
  industry: string | null;
};

type ProspectMapProps = {
  prospects: MappedProspect[];
  unmapped: { id: string; company: string; city: string | null; region: string | null }[];
  filters: ProspectMapFilters;
  routes: RouteInfo[];
  showRoutes: boolean;
  onToggleRoutes: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  plannedRoute: PlannedStop[];
  dropPinMode: boolean;
  discoveryPin: DiscoveryPin | null;
  discoveryRadiusMiles: number;
  discoveredBusinesses: DiscoveredBusiness[];
  onMapDropPin: (lat: number, lng: number) => void;
};

export function ProspectMapClient({
  prospects,
  unmapped,
  filters,
  routes,
  showRoutes,
  onToggleRoutes,
  selectedIds,
  onToggleSelect,
  plannedRoute,
  dropPinMode,
  discoveryPin,
  discoveryRadiusMiles,
  discoveredBusinesses,
  onMapDropPin,
}: ProspectMapProps) {
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) =>
      matchesMapFilters(p, filters, (stage) => {
        if (filters.stage) return stage === filters.stage;
        if (filters.stageGroup) return getProspectGroupFromStage(stage) === filters.stageGroup;
        return true;
      }),
    );
  }, [prospects, filters]);

  const plannedRoutePolyline = useMemo(() => {
    if (plannedRoute.length === 0) return [];
    const points: [number, number][] = [HOME_POSITION];
    for (const stop of plannedRoute) {
      points.push([stop.lat, stop.lng]);
    }
    points.push(HOME_POSITION);
    return points;
  }, [plannedRoute]);

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
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <MapContainer
          center={HOME_POSITION}
          zoom={10}
          className={`h-[400px] rounded-xl ring-1 ring-foreground/10 sm:h-[500px] lg:h-[600px] ${
            dropPinMode ? "cursor-crosshair" : ""
          }`}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds
            prospects={filteredProspects}
            pin={discoveryPin}
            discovered={discoveredBusinesses}
          />
          <MapClickHandler enabled={dropPinMode} onDrop={onMapDropPin} />

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

          {discoveryPin ? (
            <Circle
              center={[discoveryPin.lat, discoveryPin.lng]}
              radius={discoveryRadiusMiles * MILE_TO_METERS}
              pathOptions={{
                color: "rgba(225, 29, 72, 0.7)",
                fillColor: "rgba(225, 29, 72, 0.08)",
                weight: 2,
              }}
            />
          ) : null}

          <Marker position={HOME_POSITION} icon={homeIcon}>
            <Popup>
              <strong>Home Base</strong>
              <br />
              Groton, CT
            </Popup>
          </Marker>

          {discoveryPin ? (
            <Marker position={[discoveryPin.lat, discoveryPin.lng]} icon={discoveryPinIcon} zIndexOffset={1000}>
              <Popup>
                <strong>Search pin</strong>
                <br />
                {discoveryPin.label}
                <br />
                <span className="text-xs text-muted-foreground">
                  {discoveryRadiusMiles} mi search radius
                </span>
              </Popup>
            </Marker>
          ) : null}

          {discoveredBusinesses.map((biz) => (
            <Marker
              key={biz.osmKey}
              position={[biz.lat, biz.lng]}
              icon={discoveredBizIcon}
              zIndexOffset={400}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <p className="font-semibold">{biz.company}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {biz.industry}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {biz.sizeBucket}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {biz.service} · {biz.milesFromHome} mi from home
                  </p>
                  <p className="text-xs text-muted-foreground">Not imported yet — select in Discover area</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {plannedRoutePolyline.length > 0 && (
            <Polyline
              positions={plannedRoutePolyline}
              pathOptions={{ color: "#10b981", weight: 4, opacity: 0.8, dashArray: "10 5" }}
            />
          )}

          {filteredProspects.map((prospect) => {
            const isSelected = selectedIds.has(prospect.id);
            return (
              <Marker
                key={prospect.id}
                position={[prospect.lat, prospect.lng]}
                icon={createColoredIcon(isSelected ? "#10b981" : getStageColor(prospect.stage))}
                eventHandlers={{
                  click: () => {
                    if (dropPinMode) return;
                    onToggleSelect(prospect.id);
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[200px] space-y-1">
                    <Link href={`/companies/${prospect.id}`} className="font-semibold text-primary hover:underline">
                      {prospect.company}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {stageLabel(prospect.stage)}
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
                    <div className="pt-1">
                      <p className="mb-1 text-xs text-muted-foreground">Opportunity score</p>
                      <ProspectScoreSelect id={prospect.id} score={prospect.lead_score} compact />
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
            );
          })}

          {routePolylines.map((route) => (
            <Polyline key={route.id} positions={route.points} pathOptions={{ color: route.color, weight: 3, opacity: 0.7 }} />
          ))}
        </MapContainer>

        <div className="text-sm text-muted-foreground">
          {dropPinMode ? (
            <span className="text-foreground">Drop-pin mode on — click the map to set the search center.</span>
          ) : (
            <>
              {filteredProspects.length} mapped prospect{filteredProspects.length !== 1 ? "s" : ""} shown.
              {discoveredBusinesses.length > 0
                ? ` ${discoveredBusinesses.length} discovered (blue) not yet imported.`
                : null}{" "}
              {unmapped.length > 0 && `${unmapped.length} not yet mapped.`}
            </>
          )}
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
            {PROSPECT_STAGES.filter((stage) => prospects.some((p) => p.stage === stage)).map((stage) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PROSPECT_PIPELINE_HEX[stage] || getProspectStageHex(stage) }}
                />
                <span>{stageLabel(stage)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <span>Home (Groton, CT)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-3 w-3 rounded-full bg-rose-600" />
              <span>Search pin + radius</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-3 w-3 rounded-full bg-sky-500" />
              <span>Discovered (not imported)</span>
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
