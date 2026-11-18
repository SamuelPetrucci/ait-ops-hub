export const REVENUE_GOAL = 5000;
export const REVENUE_STRETCH = 10000;
export const GOAL_DATE = "2026-11-24";

export const DEAL_COLUMNS = [
  ["researched", "Researched"],
  ["qualified", "Qualified"],
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["replied", "Replied"],
  ["meeting", "Meeting"],
  ["proposal", "Proposal"],
  ["won", "Won"],
  ["lost", "Lost"],
  ["do_not_contact", "Do not contact"],
] as const;

export const PROSPECT_STAGES = [
  "researched",
  "qualified",
  "draft",
  "approved",
  "sent",
  "replied",
  "meeting_booked",
  "audit_proposed",
  "audit_paid",
  "implementation_proposed",
  "won",
  "delivered",
  "lost",
  "do_not_contact",
] as const;

export const DEAL_TO_PROSPECT: Record<string, string> = {
  researched: "researched",
  qualified: "qualified",
  draft: "draft",
  sent: "sent",
  replied: "replied",
  meeting: "meeting_booked",
  proposal: "audit_proposed",
  won: "won",
  lost: "lost",
  do_not_contact: "do_not_contact",
};

/** Map prospect stage → deal status when a clear counterpart exists. */
export const PROSPECT_TO_DEAL: Record<string, string> = {
  researched: "researched",
  qualified: "qualified",
  draft: "draft",
  approved: "draft",
  sent: "sent",
  replied: "replied",
  meeting_booked: "meeting",
  audit_proposed: "proposal",
  audit_paid: "won",
  implementation_proposed: "proposal",
  won: "won",
  delivered: "won",
  lost: "lost",
  do_not_contact: "do_not_contact",
};

export const PROSPECT_STAGE_LABELS: Record<(typeof PROSPECT_STAGES)[number], string> = {
  researched: "Researched",
  qualified: "Qualified",
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  audit_proposed: "Audit proposed",
  audit_paid: "Audit paid",
  implementation_proposed: "Implementation proposed",
  won: "Won",
  delivered: "Delivered",
  lost: "Lost",
  do_not_contact: "Do not contact",
};

export const PROSPECT_STAGE_OPTIONS = PROSPECT_STAGES.map(
  (stage) => [stage, PROSPECT_STAGE_LABELS[stage]] as const,
);

export function stageLabel(stage: string | null | undefined) {
  if (!stage) return "—";
  if (stage in PROSPECT_STAGE_LABELS) {
    return PROSPECT_STAGE_LABELS[stage as keyof typeof PROSPECT_STAGE_LABELS];
  }
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Manual opportunity scores for field / browse judgment. */
export const OPPORTUNITY_SCORE_OPTIONS = [
  ["", "Unscored"],
  ["25", "25 · Cold"],
  ["40", "40 · Low"],
  ["50", "50 · Maybe"],
  ["60", "60 · Solid"],
  ["75", "75 · Opportunity"],
  ["90", "90 · Strong"],
  ["100", "100 · Must win"],
] as const;

export const TASK_COLUMNS = [
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
] as const;

export const CONTENT_COLUMNS = [
  ["idea", "Idea"],
  ["scripting", "Scripting"],
  ["rendering", "Rendering"],
  ["in_review", "In review"],
  ["changes_requested", "Changes"],
  ["approved", "Approved"],
  ["scheduled", "Scheduled"],
  ["posted", "Posted"],
  ["rejected", "Rejected"],
  ["skipped", "Skipped"],
] as const;

export const OPEN_DEAL_STATUSES = [
  "researched",
  "qualified",
  "draft",
  "sent",
  "replied",
  "meeting",
  "proposal",
];

export const INDUSTRIES = [
  "Professional Services",
  "Healthcare Admin",
  "Real Estate/Property Mgmt",
  "B2B Services",
  "Restaurant",
  "Contractor",
  "Other",
];

export type NavLink = {
  href: string;
  label: string;
  children?: readonly { href: string; label: string }[];
};

/** Only surfaces that are first-class and functional in the hub. */
export const NAV: readonly NavLink[] = [
  { href: "/", label: "Overview" },
  { href: "/crm", label: "CRM" },
  {
    href: "/content",
    label: "Content",
    children: [{ href: "/content/trends", label: "Trends" }],
  },
  { href: "/approvals", label: "Approvals" },
  { href: "/sms", label: "SMS Inbox" },
];
