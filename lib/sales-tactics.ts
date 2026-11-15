/**
 * Sales tactics configuration for the Prospect Map / day route planner.
 * Edit this file to change visit windows, offers, pain points, and scripts.
 */

export type IndustryCategory =
  | "Professional Services"
  | "Healthcare Admin"
  | "Real Estate/Property Mgmt"
  | "B2B Services"
  | "Restaurant"
  | "Contractor"
  | "Other";

export type VisitWindow = {
  label: string;
  start: string;
  end: string;
  /** Sort weight for day planning — lower = earlier in the day */
  dayOrder: number;
};

export const VISIT_WINDOWS: Record<IndustryCategory, VisitWindow> = {
  Contractor: { label: "Early morning", start: "6:30 AM", end: "8:00 AM", dayOrder: 1 },
  "Professional Services": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM", dayOrder: 2 },
  "Healthcare Admin": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM", dayOrder: 2 },
  "B2B Services": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM", dayOrder: 2 },
  "Real Estate/Property Mgmt": { label: "Late morning", start: "10:00 AM", end: "11:30 AM", dayOrder: 3 },
  Other: { label: "Mid-morning", start: "10:00 AM", end: "11:00 AM", dayOrder: 3 },
  Restaurant: { label: "Afternoon lull", start: "2:00 PM", end: "4:00 PM", dayOrder: 4 },
};

export const OFFER = {
  retainer: "$200+/mo retainer",
  setupFee: "plus setup fee",
  summary: "$200+/mo retainer plus setup fee",
};

export const BOOKING_URL = "https://calendly.com/aitransformationllc-info/discovery-call";

export const FOLLOW_UP_CADENCE = [
  { day: 0, action: "Same-day thank-you note", note: "Draft for review before sending" },
  { day: 3, action: "Day 3 check-in", note: "Brief, friendly follow-up" },
  { day: 10, action: "Day 10 value follow-up", note: "Share a relevant insight or case study" },
];

/** Per-stop field goals for an in-person day */
export const STOP_GOALS = [
  { id: "converse", label: "Have a short conversation with decision-maker or front desk" },
  { id: "card", label: "Drop off business card + one-pager" },
  { id: "pain", label: "Ask 1–2 pain-point questions" },
  { id: "call", label: "Offer a discovery call and try to book it" },
] as const;

export type PainPointPlaybook = {
  pains: string[];
  opener: string;
  cardDropLine: string;
  callAsk: string;
};

const PLAYBOOKS: Record<IndustryCategory, PainPointPlaybook> = {
  "Professional Services": {
    pains: [
      "Missed calls / slow lead follow-up after hours",
      "Intake forms and scheduling still mostly manual",
      "Client updates eating partner/admin time",
    ],
    opener:
      "Hey — I'm Sam with AI Transformation. I help local professional firms cut admin busywork with simple AI + software. Got 60 seconds?",
    cardDropLine:
      "I'll leave my card — if missed calls or intake are a headache, happy to show a 15-min walkthrough.",
    callAsk:
      "Would a 15-minute discovery call this week make sense? I can send a Calendly link or we can pick a time now.",
  },
  "Healthcare Admin": {
    pains: [
      "Front desk phone volume and no-shows",
      "Appointment reminders / reschedules still manual",
      "Staff buried in paperwork instead of patients",
    ],
    opener:
      "Hi — Sam from AI Transformation. We help clinics automate front-desk busywork (reminders, intake, call triage) without replacing staff. Quick question?",
    cardDropLine:
      "Leaving my card for whoever handles ops — if no-shows or phone volume are painful, we can sketch a fix fast.",
    callAsk:
      "Can I set up a short discovery call with whoever owns scheduling/ops? Here's Calendly, or name a better slot.",
  },
  "Real Estate/Property Mgmt": {
    pains: [
      "Leasing inquiries falling through cracks",
      "Tenant requests tracked in texts/email chaos",
      "Showing / follow-up cadence inconsistent",
    ],
    opener:
      "Hey — Sam with AI Transformation. Local property teams use us to catch leads and tenant requests faster. Is the owner or PM around?",
    cardDropLine:
      "Card for you — if leasing follow-up or tenant tickets are messy, I'll show a lightweight system that cleans it up.",
    callAsk:
      "Want to book a 15-min discovery call? I can text you the link or schedule it before I leave.",
  },
  "B2B Services": {
    pains: [
      "Quotes and follow-ups living in someone's inbox",
      "No clear handoff from lead → job → invoice",
      "Reporting / status updates take too long",
    ],
    opener:
      "Hi — I'm Sam from AI Transformation. We build simple AI ops for B2B teams so leads and jobs don't stall. Who handles ops here?",
    cardDropLine:
      "Dropping my card — if follow-ups or job tracking are a pain, let's look at a small automation that pays for itself.",
    callAsk:
      "Open to a quick discovery call this week? Calendly link or pick a time that works.",
  },
  Restaurant: {
    pains: [
      "Reservations / catering inquiries lost after busy rushes",
      "Staff repeating the same FAQ answers all day",
      "Reviews and guest follow-up inconsistent",
    ],
    opener:
      "Hey — Sam with AI Transformation. We help restaurants catch catering/reservation leads and cut front-of-house admin. Is the owner or GM free for a minute?",
    cardDropLine:
      "I'll leave a card — if inquiries or guest follow-up slip during rushes, we can automate the boring parts.",
    callAsk:
      "Could we set a short discovery call for later this week when it's quieter?",
  },
  Contractor: {
    pains: [
      "Estimate requests sitting unanswered while on jobs",
      "Job photos / updates not getting back to customers",
      "Scheduling and crew coordination by text thread",
    ],
    opener:
      "Morning — Sam with AI Transformation. I help contractors stop losing estimate leads while they're on the job. Owner around?",
    cardDropLine:
      "Card for the truck — if estimates or customer updates lag while you're on site, we can fix that without more admin staff.",
    callAsk:
      "Got 15 minutes later for a discovery call? I can text Calendly or lock a time now.",
  },
  Other: {
    pains: [
      "Leads and messages falling through cracks",
      "Too much manual admin for a small team",
      "No simple system for follow-up and scheduling",
    ],
    opener:
      "Hi — I'm Sam with AI Transformation. We help small local businesses save time with AI and modern software. Got a quick minute?",
    cardDropLine:
      "Leaving my card — if admin or follow-up is eating your week, happy to show what we do in 15 minutes.",
    callAsk:
      "Want to book a short discovery call? Here's Calendly, or we can schedule before I go.",
  },
};

export function getVisitWindow(industry: string | null | undefined): VisitWindow {
  const category = industry as IndustryCategory;
  return VISIT_WINDOWS[category] || VISIT_WINDOWS.Other;
}

export function formatVisitWindow(industry: string | null | undefined): string {
  const window = getVisitWindow(industry);
  return `${window.label} (${window.start}–${window.end})`;
}

export function getPlaybook(industry: string | null | undefined): PainPointPlaybook {
  const category = industry as IndustryCategory;
  return PLAYBOOKS[category] || PLAYBOOKS.Other;
}

export function resolveIndustryCategory(industry: string | null | undefined): IndustryCategory {
  if (!industry) return "Other";
  if (industry in VISIT_WINDOWS) return industry as IndustryCategory;
  const lower = industry.toLowerCase();
  if (lower.includes("restaurant") || lower.includes("food") || lower.includes("cafe")) return "Restaurant";
  if (lower.includes("contractor") || lower.includes("plumb") || lower.includes("electric") || lower.includes("hvac")) {
    return "Contractor";
  }
  if (lower.includes("health") || lower.includes("clinic") || lower.includes("dental") || lower.includes("medical")) {
    return "Healthcare Admin";
  }
  if (lower.includes("real estate") || lower.includes("property") || lower.includes("leasing")) {
    return "Real Estate/Property Mgmt";
  }
  if (lower.includes("b2b") || lower.includes("wholesale") || lower.includes("warehouse") || lower.includes("it ")) {
    return "B2B Services";
  }
  if (
    lower.includes("law") ||
    lower.includes("account") ||
    lower.includes("insurance") ||
    lower.includes("consult") ||
    lower.includes("professional")
  ) {
    return "Professional Services";
  }
  return "Other";
}
