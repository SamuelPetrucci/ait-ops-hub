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
  "Other",
];

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/companies", label: "Companies" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/revenue", label: "Revenue" },
  { href: "/activity", label: "Activity" },
  { href: "/agents", label: "Agents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/content", label: "Content" },
  { href: "/reports", label: "Reports" },
];
