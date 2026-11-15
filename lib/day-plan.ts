import {
  BOOKING_URL,
  FOLLOW_UP_CADENCE,
  OFFER,
  STOP_GOALS,
  formatVisitWindow,
  getPlaybook,
  getVisitWindow,
  resolveIndustryCategory,
} from "@/lib/sales-tactics";
import { orderByNearestNeighbor, type RouteStop } from "@/lib/routes";

export type DayPlanCandidate = {
  id: string;
  company: string;
  lat: number;
  lng: number;
  city: string | null;
  industry: string | null;
  lead_score?: number | null;
  miles_from_home?: number | null;
  visit_opener?: string | null;
  primary_opportunity?: string | null;
  stage?: string | null;
};

export type DayPlanStop = RouteStop & {
  order: number;
  industryCategory: string;
  visitWindow: string;
  suggestedArrive: string;
  opener: string;
  painPoints: string[];
  opportunity: string | null;
  cardDropLine: string;
  callAsk: string;
  goals: { id: string; label: string }[];
  bookingUrl: string;
};

export type DaySalesPlan = {
  dateLabel: string;
  title: string;
  startAddress: string;
  startLat: number;
  startLng: number;
  stopCount: number;
  totalKm: number;
  totalMiles: number;
  offer: string;
  bookingUrl: string;
  goals: { id: string; label: string }[];
  followUp: { day: number; action: string; note: string }[];
  stops: DayPlanStop[];
  summaryText: string;
};

export type BuildDayPlanOptions = {
  startLat: number;
  startLng: number;
  startAddress?: string;
  maxStops?: number;
  /** Prefer visit-window clustering (contractors early, restaurants late) before nearest-neighbor within cluster */
  respectVisitWindows?: boolean;
  date?: Date;
};

function scoreCandidate(c: DayPlanCandidate): number {
  const lead = c.lead_score ?? 40;
  const miles = c.miles_from_home ?? 25;
  const distancePenalty = Math.min(miles, 60) * 0.8;
  const stageBoost =
    c.stage === "qualified" || c.stage === "researched"
      ? 8
      : c.stage === "approved" || c.stage === "draft"
        ? 5
        : 0;
  return lead - distancePenalty + stageBoost;
}

/**
 * Pick the best nearby candidates for a field day when the user hasn't selected stops yet.
 * Biases toward higher lead score and closer distance, then fills remaining slots by proximity
 * to the current cluster so the route stays tight.
 */
export function pickDayCandidates(
  candidates: DayPlanCandidate[],
  maxStops: number,
  startLat: number,
  startLng: number
): DayPlanCandidate[] {
  if (candidates.length === 0 || maxStops <= 0) return [];

  const ranked = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const picked: DayPlanCandidate[] = [];
  const remaining = [...ranked];

  const first = remaining.shift();
  if (!first) return [];
  picked.push(first);

  while (picked.length < maxStops && remaining.length > 0) {
    const last = picked[picked.length - 1];
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const dist =
        Math.hypot(c.lat - last.lat, c.lng - last.lng) * 69 +
        Math.hypot(c.lat - startLat, c.lng - startLng) * 15;
      const score = scoreCandidate(c) - dist * 2;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    picked.push(remaining.splice(bestIdx, 1)[0]);
  }

  return picked;
}

function orderForDay(
  stops: RouteStop[],
  startLat: number,
  startLng: number,
  respectVisitWindows: boolean
): { ordered: RouteStop[]; totalKm: number } {
  if (!respectVisitWindows || stops.length <= 1) {
    return orderByNearestNeighbor(stops, startLat, startLng);
  }

  const buckets = new Map<number, RouteStop[]>();
  for (const stop of stops) {
    const order = getVisitWindow(resolveIndustryCategory(stop.industry)).dayOrder;
    const list = buckets.get(order) || [];
    list.push(stop);
    buckets.set(order, list);
  }

  const ordered: RouteStop[] = [];
  let totalKm = 0;
  let curLat = startLat;
  let curLng = startLng;

  const dayOrders = [...buckets.keys()].sort((a, b) => a - b);
  for (const dayOrder of dayOrders) {
    const bucket = buckets.get(dayOrder) || [];
    const { ordered: segment, totalKm: segmentKm } = orderByNearestNeighbor(bucket, curLat, curLng);
    ordered.push(...segment);
    totalKm += segmentKm;
    if (segment.length > 0) {
      const last = segment[segment.length - 1];
      curLat = last.lat;
      curLng = last.lng;
    }
  }

  return { ordered, totalKm };
}

function suggestedArriveFor(index: number, industry: string | null): string {
  const window = getVisitWindow(resolveIndustryCategory(industry));
  // Rough stagger: first stop at window start, later stops +25 min each within the bucket
  const base = window.start;
  if (index === 0) return base;
  return `${window.label} · stop ${index + 1} (~${25 * index} min after first in this niche)`;
}

function buildStopPlaybook(
  stop: RouteStop,
  order: number,
  candidate?: DayPlanCandidate
): DayPlanStop {
  const category = resolveIndustryCategory(stop.industry);
  const playbook = getPlaybook(category);
  return {
    ...stop,
    order,
    industryCategory: category,
    visitWindow: formatVisitWindow(category),
    suggestedArrive: suggestedArriveFor(order - 1, stop.industry),
    opener: candidate?.visit_opener?.trim() || playbook.opener,
    painPoints: playbook.pains,
    opportunity: candidate?.primary_opportunity ?? null,
    cardDropLine: playbook.cardDropLine,
    callAsk: playbook.callAsk,
    goals: STOP_GOALS.map((g) => ({ id: g.id, label: g.label })),
    bookingUrl: BOOKING_URL,
  };
}

export function buildDaySalesPlan(
  candidates: DayPlanCandidate[],
  options: BuildDayPlanOptions
): DaySalesPlan {
  const maxStops = Math.min(Math.max(options.maxStops ?? 8, 1), 10);
  const respectVisitWindows = options.respectVisitWindows !== false;
  const startAddress = options.startAddress ?? "Groton, CT";
  const date = options.date ?? new Date();

  const selected =
    candidates.length <= maxStops
      ? candidates
      : pickDayCandidates(candidates, maxStops, options.startLat, options.startLng);

  const asRouteStops: RouteStop[] = selected.map((c) => ({
    id: c.id,
    company: c.company,
    lat: c.lat,
    lng: c.lng,
    city: c.city,
    industry: c.industry,
  }));

  const { ordered, totalKm } = orderForDay(
    asRouteStops,
    options.startLat,
    options.startLng,
    respectVisitWindows
  );

  const byId = new Map(selected.map((c) => [c.id, c]));
  const stops = ordered.map((stop, idx) => buildStopPlaybook(stop, idx + 1, byId.get(stop.id)));

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const title = `Sales day plan · ${dateLabel}`;
  const totalMiles = totalKm * 0.621371;

  const summaryLines = [
    title,
    `Start: ${startAddress}`,
    `Stops: ${stops.length} · ~${totalMiles.toFixed(1)} mi straight-line`,
    `Goals each stop: converse → card drop → pain points → book discovery call`,
    `Offer: ${OFFER.summary}`,
    `Book: ${BOOKING_URL}`,
    "",
    ...stops.map((s) => {
      const pains = s.painPoints
        .slice(0, 2)
        .map((p) => `    - ${p}`)
        .join("\n");
      return [
        `${s.order}. ${s.company}${s.city ? ` (${s.city})` : ""}`,
        `   Window: ${s.visitWindow}`,
        `   Opener: ${s.opener}`,
        `   Pain points:`,
        pains,
        `   Card: ${s.cardDropLine}`,
        `   Ask: ${s.callAsk}`,
      ].join("\n");
    }),
    "",
    "Follow-up:",
    ...FOLLOW_UP_CADENCE.map((f) => `- ${f.action}: ${f.note}`),
  ];

  return {
    dateLabel,
    title,
    startAddress,
    startLat: options.startLat,
    startLng: options.startLng,
    stopCount: stops.length,
    totalKm,
    totalMiles,
    offer: OFFER.summary,
    bookingUrl: BOOKING_URL,
    goals: STOP_GOALS.map((g) => ({ id: g.id, label: g.label })),
    followUp: FOLLOW_UP_CADENCE.map((f) => ({ day: f.day, action: f.action, note: f.note })),
    stops,
    summaryText: summaryLines.join("\n"),
  };
}
