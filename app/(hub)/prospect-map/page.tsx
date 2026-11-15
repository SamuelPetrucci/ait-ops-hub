import { ProspectMapView } from "@/components/prospect-map-view";
import { requireOwner } from "@/lib/auth";
import { getSavedRoutes } from "@/app/actions/routes";
import {
  computeRoutes,
  getUniqueCategories,
  getUniqueRouteIds,
  getUniqueStages,
  getUniqueTowns,
  type MappedProspect,
  type UnmappedProspect,
} from "@/lib/prospect-map";

export const metadata = { title: "Sales Map" };

export default async function ProspectMapPage() {
  const { supabase } = await requireOwner();

  const [prospectResult, savedRoutes] = await Promise.all([
    supabase
      .from("prospects")
      .select(
        "id, company, contact, website, city, region, industry, stage, lat, lng, miles_from_home, drive_minutes, route_id, visit_order, visit_opener, primary_opportunity, notes, lead_score"
      )
      .neq("stage", "do_not_contact")
      .neq("stage", "lost")
      .order("company"),
    getSavedRoutes(),
  ]);

  if (prospectResult.error) throw new Error(prospectResult.error.message);
  const data = prospectResult.data;

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
        lead_score: row.lead_score,
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
  const towns = getUniqueTowns(mapped);

  return (
    <div className="mx-auto w-full max-w-7xl px-1 sm:px-0">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Sales Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mapped.length} mapped, {unmapped.length} need coordinates. Home: Groton, CT. Drop a pin on the map
          (Uber-style) to scrape nearby businesses, then <strong>Plan my day</strong> for stop scripts.
        </p>
      </div>
      <ProspectMapView
        mapped={mapped}
        unmapped={unmapped}
        routes={routes}
        stages={stages}
        categories={categories}
        routeIds={routeIds}
        towns={towns}
        savedRoutes={savedRoutes}
      />
    </div>
  );
}
