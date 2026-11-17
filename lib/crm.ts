import { PROSPECT_STAGES, stageLabel } from "@/lib/constants";
import {
  getProspectGroupDbStages,
  getProspectGroupFromStage,
  PROSPECT_GROUP_ORDER,
  type ProspectStageGroup,
} from "@/lib/status-groups";

export { stageLabel, PROSPECT_STAGES };

/** Open outreach / pipeline — not yet paying clients. */
export const LEAD_STAGES = [
  "researched",
  "qualified",
  "draft",
  "approved",
  "sent",
  "replied",
  "meeting_booked",
  "audit_proposed",
  "implementation_proposed",
] as const;

/** Won / delivered / paid work. */
export const CLIENT_STAGES = ["audit_paid", "won", "delivered"] as const;

/** Closed / excluded from default CRM views. */
export const CLOSED_STAGES = ["lost", "do_not_contact"] as const;

/** Everything still in play (leads + clients). */
export const OPEN_CRM_STAGES = [...LEAD_STAGES, ...CLIENT_STAGES] as const;

export type ProspectScope = "leads" | "clients" | "all";
export type CrmView = "list" | "map";

export const SCOPE_STAGES: Record<ProspectScope, readonly string[]> = {
  leads: LEAD_STAGES,
  clients: CLIENT_STAGES,
  all: OPEN_CRM_STAGES,
};

export const SCOPE_LABELS: Record<ProspectScope, string> = {
  leads: "Leads",
  clients: "Clients",
  all: "All open",
};

export type CrmFilters = {
  q: string;
  stage: string;
  stageGroup: string;
  industry: string;
  score: string;
  followUp: string;
  owner: string;
  includeDnc: string;
  town: string;
  routeId: string;
  maxDistance: string;
};

export function oneParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseScope(value: string | string[] | undefined): ProspectScope {
  const scope = oneParam(value).trim();
  if (scope === "clients" || scope === "all") return scope;
  return "leads";
}

export function parseView(value: string | string[] | undefined): CrmView {
  return oneParam(value).trim() === "map" ? "map" : "list";
}

export function parseCrmFilters(params: Record<string, string | string[] | undefined>): CrmFilters {
  return {
    q: oneParam(params.q).trim(),
    stage: oneParam(params.stage).trim(),
    stageGroup: oneParam(params.stageGroup).trim(),
    industry: oneParam(params.industry).trim(),
    score: oneParam(params.score).trim(),
    followUp: oneParam(params.followUp).trim(),
    owner: oneParam(params.owner).trim(),
    includeDnc: oneParam(params.includeDnc).trim(),
    town: oneParam(params.town).trim(),
    routeId: oneParam(params.routeId).trim(),
    maxDistance: oneParam(params.maxDistance).trim(),
  };
}

export function stagesForScope(scope: ProspectScope, includeDnc = false): string[] {
  const base = [...SCOPE_STAGES[scope]];
  if (scope === "leads" && includeDnc) base.push("do_not_contact");
  if (scope === "all" && includeDnc) base.push("do_not_contact");
  return base;
}

/**
 * Full pipeline statuses offered in CRM filters — includes empty stages and
 * closed statuses (Lost / DNC) so the dropdown always matches the sales pipeline.
 */
export function filterStagesForScope(scope: ProspectScope): string[] {
  if (scope === "clients") {
    return PROSPECT_STAGES.filter(
      (stage) =>
        CLIENT_STAGES.includes(stage as (typeof CLIENT_STAGES)[number]) ||
        stage === "lost" ||
        stage === "do_not_contact",
    );
  }
  return [...PROSPECT_STAGES];
}

export function isProspectStage(stage: string) {
  return (PROSPECT_STAGES as readonly string[]).includes(stage);
}

export function crmSearchParams(
  opts: {
    scope?: ProspectScope;
    view?: CrmView;
    filters?: Partial<CrmFilters>;
    page?: number;
  } = {},
) {
  const params = new URLSearchParams();
  const scope = opts.scope ?? "leads";
  const view = opts.view ?? "list";
  if (scope !== "leads") params.set("scope", scope);
  if (view !== "list") params.set("view", view);
  if (opts.filters) {
    for (const [key, value] of Object.entries(opts.filters)) {
      if (value) params.set(key, value);
    }
  }
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  return params.toString();
}

export function crmHref(opts: {
  scope?: ProspectScope;
  view?: CrmView;
  filters?: Partial<CrmFilters>;
  page?: number;
}) {
  const qs = crmSearchParams(opts);
  return qs ? `/crm?${qs}` : "/crm";
}

export function listBasePath(scope: ProspectScope = "leads") {
  return crmHref({ scope, view: "list" });
}

export function backPathForStage(stage: string | null | undefined) {
  if (stage && CLIENT_STAGES.includes(stage as (typeof CLIENT_STAGES)[number])) {
    return crmHref({ scope: "clients" });
  }
  return crmHref({ scope: "leads" });
}

/** Client-side stage match used by map + any shared CRM filters. */
export function stageAllowed(
  stage: string,
  scope: ProspectScope,
  filters: Pick<CrmFilters, "stage" | "stageGroup" | "includeDnc">,
) {
  // Exact stage filter always wins (including Lost / DNC).
  if (filters.stage) return stage === filters.stage;

  const allowed = stagesForScope(scope, filters.includeDnc === "1");
  if (!allowed.includes(stage)) return false;
  if (filters.stageGroup) {
    const groupStages = getProspectGroupDbStages(filters.stageGroup as ProspectStageGroup).filter((s) =>
      allowed.includes(s),
    );
    return groupStages.includes(stage);
  }
  return true;
}

export function groupOptionsForStages(stages: Iterable<string>, currentGroup = "") {
  const present = new Set<ProspectStageGroup>();
  for (const stage of stages) present.add(getProspectGroupFromStage(stage));
  return PROSPECT_GROUP_ORDER.filter((group) => present.has(group) || group === currentGroup);
}

/** Pipeline stages in sales order, scoped to the current CRM view. */
export function pipelineStagesForScope(scope: ProspectScope, includeDnc = false) {
  const allowed = new Set(stagesForScope(scope, includeDnc));
  return PROSPECT_STAGES.filter((stage) => allowed.has(stage));
}

export function stageOptionsWithCounts(
  scope: ProspectScope,
  counts: Map<string, number> | Record<string, number>,
  currentStage = "",
) {
  const getCount = (stage: string) =>
    counts instanceof Map ? counts.get(stage) || 0 : counts[stage] || 0;
  return filterStagesForScope(scope).map((stage) => ({
    value: stage,
    label: stageLabel(stage),
    count: getCount(stage),
    active: stage === currentStage,
  }));
}
