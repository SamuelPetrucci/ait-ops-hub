import "server-only";

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

export type ProspectScope = "leads" | "clients";

export const SCOPE_STAGES: Record<ProspectScope, readonly string[]> = {
  leads: LEAD_STAGES,
  clients: CLIENT_STAGES,
};

export type ProspectFilters = {
  q: string;
  stage: string;
  industry: string;
  score: string;
  followUp: string;
  owner: string;
  includeDnc: string;
};

export function oneParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseProspectFilters(params: Record<string, string | string[] | undefined>): ProspectFilters {
  return {
    q: oneParam(params.q).trim(),
    stage: oneParam(params.stage).trim(),
    industry: oneParam(params.industry).trim(),
    score: oneParam(params.score).trim(),
    followUp: oneParam(params.followUp).trim(),
    owner: oneParam(params.owner).trim(),
    includeDnc: oneParam(params.includeDnc).trim(),
  };
}

export function filtersToSearchParams(filters: ProspectFilters, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  return params.toString();
}

/** Apply list filters. Scope stages always constrain the set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProspectFilters(query: any, scope: ProspectScope, filters: ProspectFilters, today: string) {
  const allowed = SCOPE_STAGES[scope];
  const stage = filters.stage && allowed.includes(filters.stage) ? filters.stage : "";

  if (stage) query = query.eq("stage", stage);
  else if (scope === "leads" && filters.includeDnc === "1") {
    query = query.in("stage", [...LEAD_STAGES, "do_not_contact"]);
  } else {
    query = query.in("stage", [...allowed]);
  }

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, "");
    if (q) query = query.or(`company.ilike.%${q}%,contact.ilike.%${q}%,website.ilike.%${q}%`);
  }
  if (filters.industry) query = query.eq("industry", filters.industry);

  const minScore = Number(filters.score);
  if (filters.score !== "" && Number.isFinite(minScore)) {
    query = query.gte("lead_score", minScore);
  }

  if (filters.followUp === "overdue") query = query.lt("next_follow_up_due", today);
  else if (filters.followUp === "today") query = query.eq("next_follow_up_due", today);
  else if (filters.followUp === "upcoming") query = query.gt("next_follow_up_due", today);
  else if (filters.followUp === "due") query = query.lte("next_follow_up_due", today);
  else if (filters.followUp === "any") query = query.not("next_follow_up_due", "is", null);

  if (filters.owner) query = query.eq("deal_owner", filters.owner);

  return query;
}

export function listBasePath(scope: ProspectScope) {
  return scope === "clients" ? "/clients" : "/leads";
}

export function backPathForStage(stage: string | null | undefined) {
  if (stage && CLIENT_STAGES.includes(stage as (typeof CLIENT_STAGES)[number])) return "/clients";
  return "/leads";
}
