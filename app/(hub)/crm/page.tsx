import { CrmChrome } from "@/components/crm-chrome";
import { ProspectDirectory } from "@/components/prospect-directory";
import { ProspectMapView } from "@/components/prospect-map-view";
import { getSavedRoutes } from "@/app/actions/routes";
import { requireOwner } from "@/lib/auth";
import {
  parseCrmFilters,
  parseScope,
  parseView,
  SCOPE_LABELS,
  stagesForScope,
  type ProspectScope,
} from "@/lib/crm";
import {
  computeRoutes,
  getUniqueCategories,
  getUniqueRouteIds,
  getUniqueTowns,
  type MappedProspect,
  type UnmappedProspect,
} from "@/lib/prospect-map";

export const metadata = { title: "CRM" };

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = parseScope(params.scope);
  const view = parseView(params.view);
  const filters = parseCrmFilters(params);

  const title = view === "map" ? "Sales map" : SCOPE_LABELS[scope];
  const description =
    view === "map"
      ? "Same sales pipeline as the list — filter Researched, Qualified, Draft, Won, and the rest."
      : scope === "clients"
        ? "Audit paid, won, and delivered companies."
        : scope === "all"
          ? "Full pipeline: researched → qualified → draft → sent → won and more."
          : "Sales pipeline stages: researched, qualified, draft, sent, replied, meeting, proposal, won.";

  return (
    <CrmChrome scope={scope} view={view} filters={filters} title={title} description={description}>
      {view === "map" ? <CrmMap scope={scope} searchParams={params} /> : <ProspectDirectory scope={scope} searchParams={params} />}
    </CrmChrome>
  );
}

async function CrmMap({
  scope,
  searchParams,
}: {
  scope: ProspectScope;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseCrmFilters(searchParams);
  const { supabase } = await requireOwner();
  const allowed = stagesForScope(scope, filters.includeDnc === "1");

  const [prospectResult, savedRoutes] = await Promise.all([
    supabase
      .from("prospects")
      .select(
        "id, company, contact, website, city, region, industry, stage, lat, lng, miles_from_home, drive_minutes, route_id, visit_order, visit_opener, primary_opportunity, proposed_service, notes, lead_score",
      )
      .in("stage", allowed)
      .order("company"),
    getSavedRoutes(),
  ]);

  if (prospectResult.error) throw new Error(prospectResult.error.message);

  const mapped: MappedProspect[] = [];
  const unmapped: UnmappedProspect[] = [];

  for (const row of prospectResult.data ?? []) {
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
        proposed_service: row.proposed_service,
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

  return (
    <ProspectMapView
      mapped={mapped}
      unmapped={unmapped}
      routes={computeRoutes(mapped)}
      categories={getUniqueCategories(mapped)}
      routeIds={getUniqueRouteIds(mapped)}
      towns={getUniqueTowns(mapped)}
      savedRoutes={savedRoutes}
      scope={scope}
      initialFilters={filters}
    />
  );
}
