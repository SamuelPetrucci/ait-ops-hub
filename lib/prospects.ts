import "server-only";
import {
  crmSearchParams,
  isProspectStage,
  parseCrmFilters,
  stagesForScope,
  type CrmFilters,
  type CrmView,
  type ProspectScope,
} from "@/lib/crm";
import { getProspectGroupDbStages, type ProspectStageGroup } from "@/lib/status-groups";

export {
  backPathForStage,
  CLIENT_STAGES,
  crmHref,
  crmSearchParams,
  filterStagesForScope,
  isProspectStage,
  LEAD_STAGES,
  listBasePath,
  oneParam,
  OPEN_CRM_STAGES,
  parseCrmFilters,
  parseScope,
  parseView,
  SCOPE_LABELS,
  SCOPE_STAGES,
  stageAllowed,
  stagesForScope,
  type CrmFilters,
  type CrmView,
  type ProspectScope,
} from "@/lib/crm";

/** @deprecated Prefer CrmFilters. */
export type ProspectFilters = CrmFilters;

export function parseProspectFilters(params: Record<string, string | string[] | undefined>): CrmFilters {
  return parseCrmFilters(params);
}

export function filtersToSearchParams(
  filters: CrmFilters,
  page?: number,
  scope?: ProspectScope,
  view?: CrmView,
) {
  return crmSearchParams({ scope, view, filters, page });
}

/** Apply list filters. Scope stages constrain the set unless an exact stage is chosen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProspectFilters(query: any, scope: ProspectScope, filters: CrmFilters, today: string) {
  const allowed = stagesForScope(scope, filters.includeDnc === "1");
  const stage = filters.stage && isProspectStage(filters.stage) ? filters.stage : "";
  const stageGroup = filters.stageGroup as ProspectStageGroup | "";

  if (stage) {
    // Exact pipeline stage (including Lost / DNC) always wins over open-scope defaults.
    query = query.eq("stage", stage);
  } else if (stageGroup) {
    const groupStages = getProspectGroupDbStages(stageGroup).filter((s) => allowed.includes(s));
    if (groupStages.length > 0) {
      query = query.in("stage", groupStages);
    } else {
      query = query.in("stage", [...allowed]);
    }
  } else {
    query = query.in("stage", [...allowed]);
  }

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, "");
    if (q) query = query.or(`company.ilike.%${q}%,contact.ilike.%${q}%,website.ilike.%${q}%`);
  }
  if (filters.industry) query = query.eq("industry", filters.industry);
  if (filters.town) query = query.eq("city", filters.town);
  if (filters.routeId) query = query.eq("route_id", filters.routeId);

  const minScore = Number(filters.score);
  if (filters.score !== "" && Number.isFinite(minScore)) {
    query = query.gte("lead_score", minScore);
  }

  const maxDistance = Number(filters.maxDistance);
  if (filters.maxDistance !== "" && Number.isFinite(maxDistance)) {
    query = query.lte("miles_from_home", maxDistance);
  }

  if (filters.followUp === "overdue") query = query.lt("next_follow_up_due", today);
  else if (filters.followUp === "today") query = query.eq("next_follow_up_due", today);
  else if (filters.followUp === "upcoming") query = query.gt("next_follow_up_due", today);
  else if (filters.followUp === "due") query = query.lte("next_follow_up_due", today);
  else if (filters.followUp === "any") query = query.not("next_follow_up_due", "is", null);

  if (filters.owner) query = query.eq("deal_owner", filters.owner);

  return query;
}
