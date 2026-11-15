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
  notes: string | null;
};

export type UnmappedProspect = {
  id: string;
  company: string;
  city: string | null;
  region: string | null;
};

export type ProspectMapFilters = {
  stage: string;
  routeId: string;
  category: string;
  maxDistance: number;
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

export function getUniqueCategories(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.industry).filter((c): c is string => !!c))].sort();
}

export function getUniqueRouteIds(prospects: MappedProspect[]): string[] {
  return [...new Set(prospects.map((p) => p.route_id).filter((r): r is string => !!r))].sort();
}
