/**
 * Sales tactics configuration for the Prospect Map.
 * Edit this file to change visit windows, offers, and follow-up cadence.
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
};

export const VISIT_WINDOWS: Record<IndustryCategory, VisitWindow> = {
  "Professional Services": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM" },
  "Healthcare Admin": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM" },
  "Real Estate/Property Mgmt": { label: "Mid-morning", start: "10:00 AM", end: "11:30 AM" },
  "B2B Services": { label: "Mid-morning", start: "9:30 AM", end: "11:00 AM" },
  Restaurant: { label: "Afternoon lull", start: "2:00 PM", end: "4:00 PM" },
  Contractor: { label: "Early morning", start: "6:30 AM", end: "8:00 AM" },
  Other: { label: "Mid-morning", start: "10:00 AM", end: "11:00 AM" },
};

export const OFFER = {
  retainer: "$200+/mo retainer",
  setupFee: "plus setup fee",
  summary: "$200+/mo retainer plus setup fee",
};

export const FOLLOW_UP_CADENCE = [
  { day: 0, action: "Same-day thank-you note", note: "Draft for review before sending" },
  { day: 3, action: "Day 3 check-in", note: "Brief, friendly follow-up" },
  { day: 10, action: "Day 10 value follow-up", note: "Share a relevant insight or case study" },
];

export function getVisitWindow(industry: string | null | undefined): VisitWindow {
  const category = industry as IndustryCategory;
  return VISIT_WINDOWS[category] || VISIT_WINDOWS.Other;
}

export function formatVisitWindow(industry: string | null | undefined): string {
  const window = getVisitWindow(industry);
  return `${window.label} (${window.start}–${window.end})`;
}
