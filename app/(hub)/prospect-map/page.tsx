import { ProspectMapView } from "@/components/prospect-map-view";
import { requireOwner } from "@/lib/auth";
import {
  computeRoutes,
  getUniqueCategories,
  getUniqueRouteIds,
  getUniqueStages,
  type MappedProspect,
  type UnmappedProspect,
} from "@/lib/prospect-map";

export const metadata = { title: "Prospect Map" };

export default async function ProspectMapPage() {
  const { supabase } = await requireOwner();

  const { data, error } = await supabase
    .from("prospects")
    .select(
      "id, company, contact, website, city, region, industry, stage, lat, lng, miles_from_home, drive_minutes, route_id, visit_order, visit_opener, primary_opportunity, notes"
    )
    .neq("stage", "do_not_contact")
    .neq("stage", "lost")
    .order("company");

  if (error) throw new Error(error.message);

  const mapped: MappedProspect[] = [];
  const unmapped: UnmappedProspect[] = [];

  for (const row of data ?? []) {
    if (row.lat != null && row.lng != null) {
      mapped.push({
        id: row.id,
        company: row.company,
        contact: row.contact,
        website: row.website,
        city: row.city,
        region: row.region,
        industry: row.industry,
        stage: row.stage,
        lat: row.lat,
        lng: row.lng,
        miles_from_home: row.miles_from_home,
        drive_minutes: row.drive_minutes,
        route_id: row.route_id,
        visit_order: row.visit_order,
        visit_opener: row.visit_opener,
        primary_opportunity: row.primary_opportunity,
        notes: row.notes,
      });
    } else {
      unmapped.push({
        id: row.id,
        company: row.company,
        city: row.city,
        region: row.region,
      });
    }
  }

  const routes = computeRoutes(mapped);
  const stages = getUniqueStages(mapped);
  const categories = getUniqueCategories(mapped);
  const routeIds = getUniqueRouteIds(mapped);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-medium tracking-tight">Prospect Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mapped.length} mapped, {unmapped.length} need coordinates. Home base: Groton, CT.
        </p>
      </div>
      <ProspectMapView
        mapped={mapped}
        unmapped={unmapped}
        routes={routes}
        stages={stages}
        categories={categories}
        routeIds={routeIds}
      />
    </div>
  );
}
