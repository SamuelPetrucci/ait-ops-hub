export type MappedProspect = {
  id: string;
  company: string;
  contact: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
  stage: string;
  lat: number;
  lng: number;
  miles_from_home: number | null;
  drive_minutes: number | null;
  route_id: string | null;
  visit_order: number | null;
  visit_opener: string | null;
  primary_opportunity: string | null;
  proposed_service: string | null;
  notes: string | null;
  lead_score: number | null;
};

export type UnmappedProspect = {
  id: string;
  company: string;
  city: string | null;
  region: string | null;
};

export type ProspectMapFilters = {
  /** Exact stage — optional; prefer stageGroup for CRM consistency. */
  stage: string;
  stageGroup: string;
  routeId: string;
  category: string;
  maxDistance: number;
  town: string;
  minScore: number;
};

export type RouteStop = MappedProspect;

export type RouteInfo = {
  id: string;
  stops: RouteStop[];
  totalMiles: number;
  totalDriveMinutes: number;
};

export function computeRoutes(prospects: MappedProspect[]): RouteInfo[] {
  const routeMap = new Map<string, MappedProspect[]>();

  for (const p of prospects) {
    if (!p.route_id) continue;
    const existing = routeMap.get(p.route_id) || [];
    existing.push(p);
    routeMap.set(p.route_id, existing);
  }

  const routes: RouteInfo[] = [];
  for (const [id, stops] of routeMap.entries()) {
    const sorted = stops.sort((a, b) => (a.visit_order ?? 0) - (b.visit_order ?? 0));
    const totalMiles = sorted.reduce((sum, s) => sum + (s.miles_from_home || 0), 0);
    const totalDriveMinutes = sorted.reduce((sum, s) => sum + (s.drive_minutes || 0), 0);
    routes.push({ id, stops: sorted, totalMiles, totalDriveMinutes });
  }

  return routes.sort((a, b) => a.id.localeCompare(b.id));
}

export function getUniqueStages(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.stage))].sort();
}

export function matchesMapFilters(
  p: Pick<MappedProspect, "stage" | "route_id" | "industry" | "city" | "miles_from_home" | "lead_score">,
  filters: ProspectMapFilters,
  stageAllowed: (stage: string) => boolean,
) {
  if (!stageAllowed(p.stage)) return false;
  if (filters.routeId && p.route_id !== filters.routeId) return false;
  if (filters.category && p.industry !== filters.category) return false;
  if (filters.town && p.city !== filters.town) return false;
  if (filters.maxDistance && p.miles_from_home && p.miles_from_home > filters.maxDistance) return false;
  if (filters.minScore && (p.lead_score ?? 0) < filters.minScore) return false;
  return true;
}

export function getUniqueCategories(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.industry).filter((c): c is string => !!c))].sort();
}

export function getUniqueRouteIds(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.route_id).filter((r): r is string => !!r))].sort();
}

export function getUniqueTowns(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.city).filter((c): c is string => !!c))].sort();
}
