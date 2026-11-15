/**
 * Status grouping for UI display.
 * Collapses many DB statuses into 6 UI groups while keeping DB enum unchanged.
 */

export type ContentStatusGroup = 
  | "in_progress"
  | "needs_review"
  | "approved"
  | "scheduled"
  | "posted"
  | "rejected";

export const CONTENT_STATUS_GROUPS: Record<ContentStatusGroup, {
  label: string;
  dbStatuses: string[];
  canonical: string;
  color: string;
}> = {
  in_progress: {
    label: "In Progress",
    dbStatuses: ["idea", "scripting", "rendering"],
    canonical: "idea",
    color: "bg-blue-500/20 text-blue-400",
  },
  needs_review: {
    label: "Needs Review",
    dbStatuses: ["in_review", "changes_requested"],
    canonical: "in_review",
    color: "bg-amber-500/20 text-amber-400",
  },
  approved: {
    label: "Approved",
    dbStatuses: ["approved"],
    canonical: "approved",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  scheduled: {
    label: "Scheduled",
    dbStatuses: ["scheduled"],
    canonical: "scheduled",
    color: "bg-purple-500/20 text-purple-400",
  },
  posted: {
    label: "Posted",
    dbStatuses: ["posted"],
    canonical: "posted",
    color: "bg-green-500/20 text-green-400",
  },
  rejected: {
    label: "Rejected",
    dbStatuses: ["skipped", "rejected"],
    canonical: "skipped",
    color: "bg-red-500/20 text-red-400",
  },
};

export const CONTENT_GROUP_ORDER: ContentStatusGroup[] = [
  "in_progress",
  "needs_review", 
  "approved",
  "scheduled",
  "posted",
  "rejected",
];

export function getContentGroupFromStatus(status: string): ContentStatusGroup {
  for (const [group, config] of Object.entries(CONTENT_STATUS_GROUPS)) {
    if (config.dbStatuses.includes(status)) {
      return group as ContentStatusGroup;
    }
  }
  return "in_progress";
}

export function getCanonicalStatus(group: ContentStatusGroup, currentStatus?: string): string {
  const config = CONTENT_STATUS_GROUPS[group];
  if (currentStatus && config.dbStatuses.includes(currentStatus)) {
    return currentStatus;
  }
  return config.canonical;
}

export function getGroupLabel(group: ContentStatusGroup): string {
  return CONTENT_STATUS_GROUPS[group].label;
}

export function getGroupColor(group: ContentStatusGroup): string {
  return CONTENT_STATUS_GROUPS[group].color;
}

export type ProspectStageGroup =
  | "new"
  | "outreach"
  | "engaged"
  | "closing"
  | "won"
  | "closed";

export const PROSPECT_STAGE_GROUPS: Record<ProspectStageGroup, {
  label: string;
  dbStages: string[];
  canonical: string;
  color: string;
}> = {
  new: {
    label: "New",
    dbStages: ["researched", "qualified"],
    canonical: "researched",
    color: "bg-slate-500/20 text-slate-400",
  },
  outreach: {
    label: "Outreach",
    dbStages: ["draft", "approved", "sent"],
    canonical: "draft",
    color: "bg-blue-500/20 text-blue-400",
  },
  engaged: {
    label: "Engaged",
    dbStages: ["replied", "meeting_booked"],
    canonical: "replied",
    color: "bg-amber-500/20 text-amber-400",
  },
  closing: {
    label: "Closing",
    dbStages: ["audit_proposed", "implementation_proposed"],
    canonical: "audit_proposed",
    color: "bg-purple-500/20 text-purple-400",
  },
  won: {
    label: "Won",
    dbStages: ["audit_paid", "won", "delivered"],
    canonical: "won",
    color: "bg-green-500/20 text-green-400",
  },
  closed: {
    label: "Closed",
    dbStages: ["lost", "do_not_contact"],
    canonical: "lost",
    color: "bg-red-500/20 text-red-400",
  },
};

export const PROSPECT_GROUP_ORDER: ProspectStageGroup[] = [
  "new",
  "outreach",
  "engaged",
  "closing",
  "won",
  "closed",
];

export function getProspectGroupFromStage(stage: string): ProspectStageGroup {
  for (const [group, config] of Object.entries(PROSPECT_STAGE_GROUPS)) {
    if (config.dbStages.includes(stage)) {
      return group as ProspectStageGroup;
    }
  }
  return "new";
}

export type DealStageGroup =
  | "research"
  | "outreach"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

export const DEAL_STAGE_GROUPS: Record<DealStageGroup, {
  label: string;
  dbStatuses: string[];
  canonical: string;
  color: string;
}> = {
  research: {
    label: "Research",
    dbStatuses: ["researched", "qualified"],
    canonical: "researched",
    color: "bg-slate-500/20 text-slate-400",
  },
  outreach: {
    label: "Outreach",
    dbStatuses: ["draft", "sent", "replied"],
    canonical: "sent",
    color: "bg-blue-500/20 text-blue-400",
  },
  meeting: {
    label: "Meeting",
    dbStatuses: ["meeting"],
    canonical: "meeting",
    color: "bg-amber-500/20 text-amber-400",
  },
  proposal: {
    label: "Proposal",
    dbStatuses: ["proposal"],
    canonical: "proposal",
    color: "bg-purple-500/20 text-purple-400",
  },
  won: {
    label: "Won",
    dbStatuses: ["won"],
    canonical: "won",
    color: "bg-green-500/20 text-green-400",
  },
  lost: {
    label: "Lost",
    dbStatuses: ["lost", "do_not_contact"],
    canonical: "lost",
    color: "bg-red-500/20 text-red-400",
  },
};

export const DEAL_GROUP_ORDER: DealStageGroup[] = [
  "research",
  "outreach",
  "meeting",
  "proposal",
  "won",
  "lost",
];

export function getDealGroupFromStatus(status: string): DealStageGroup {
  for (const [group, config] of Object.entries(DEAL_STAGE_GROUPS)) {
    if (config.dbStatuses.includes(status)) {
      return group as DealStageGroup;
    }
  }
  return "research";
}

export function getCanonicalProspectStage(group: ProspectStageGroup, currentStage?: string): string {
  const config = PROSPECT_STAGE_GROUPS[group];
  if (currentStage && config.dbStages.includes(currentStage)) {
    return currentStage;
  }
  return config.canonical;
}

export function getProspectGroupLabel(group: ProspectStageGroup): string {
  return PROSPECT_STAGE_GROUPS[group].label;
}

export function getProspectGroupColor(group: ProspectStageGroup): string {
  return PROSPECT_STAGE_GROUPS[group].color;
}

export function groupProspectStages(stages: string[]): Map<ProspectStageGroup, string[]> {
  const grouped = new Map<ProspectStageGroup, string[]>();
  for (const stage of stages) {
    const group = getProspectGroupFromStage(stage);
    const current = grouped.get(group) || [];
    current.push(stage);
    grouped.set(group, current);
  }
  return grouped;
}

export function getProspectGroupDbStages(group: ProspectStageGroup): string[] {
  return PROSPECT_STAGE_GROUPS[group].dbStages;
}
