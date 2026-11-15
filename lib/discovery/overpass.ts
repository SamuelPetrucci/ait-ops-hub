import {
  DISCOVERY_CATEGORIES,
  matchCategory,
  type CompanySizeBucket,
  type DiscoveryCategory,
  type OsmTagFilter,
} from "@/lib/discovery/categories";
import { estimateSizeFromTags, fetchWikidataEmployeeBuckets } from "@/lib/discovery/size";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AIT-Ops-Hub-Discovery/1.0 (samuel@aitransformation.co)";

export type DiscoveredBusiness = {
  osmKey: string;
  osmType: string;
  osmId: number;
  company: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number;
  lng: number;
  industry: string;
  service: string;
  categoryId: string;
  sizeBucket: CompanySizeBucket;
  sizeSource: "wikidata" | "tags" | "unknown";
  milesFromHome: number;
  driveMinutes: number;
  wikidataId: string | null;
  osmTags: Record<string, string>;
};

export type DiscoverAreaInput = {
  locationQuery: string;
  radiusMiles: number;
  categoryIds: string[];
  sizeBuckets?: CompanySizeBucket[];
  lat?: number;
  lng?: number;
  enrichWebsites?: boolean;
};

export type DiscoverProgress = {
  stage: "geocode" | "overpass" | "wikidata" | "assemble" | "enrich" | "done";
  label: string;
  percent: number;
  found?: number;
  detail?: string;
};

export type DiscoverAreaResult = {
  center: { lat: number; lng: number; label: string };
  radiusMiles: number;
  businesses: DiscoveredBusiness[];
  queriedCategories: string[];
  source: "OpenStreetMap / Overpass";
};

export type DiscoverProgressHandler = (progress: DiscoverProgress) => void | Promise<void>;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const HOME_LAT = 41.3501;
const HOME_LNG = -72.0787;

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildAddress(tags: Record<string, string>): string | null {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const parts = [street, tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeWebsite(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildOverpassQuery(lat: number, lng: number, radiusMeters: number, tags: OsmTagFilter[]): string {
  const parts = tags.flatMap((tag) => [
    `node["${tag.key}"="${tag.value}"](around:${radiusMeters},${lat},${lng});`,
    `way["${tag.key}"="${tag.value}"](around:${radiusMeters},${lat},${lng});`,
    `relation["${tag.key}"="${tag.value}"](around:${radiusMeters},${lat},${lng});`,
  ]);
  return `[out:json][timeout:60];(${parts.join("")});out center tags;`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
      zoom: "14",
      addressdetails: "0",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { display_name?: string };
    return payload.display_name || null;
  } catch {
    return null;
  }
}

async function resolveLocation(
  locationQuery: string,
  lat?: number,
  lng?: number,
): Promise<{ lat: number; lng: number; label: string }> {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const reversed = await reverseGeocode(lat, lng);
    const fallback = locationQuery.trim() || `Pinned ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return { lat, lng, label: reversed || fallback };
  }

  const q = locationQuery.trim() || "Groton, CT";
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    countrycodes: "us",
  });
  const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!results?.length) throw new Error(`No location found for “${q}”`);
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    label: results[0].display_name,
  };
}

async function runOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`Overpass HTTP ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
      if (payload.remark?.toLowerCase().includes("error")) {
        lastError = new Error(payload.remark);
        continue;
      }
      return payload.elements || [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Overpass request failed");
    }
  }
  throw lastError || new Error("Overpass unavailable");
}

async function report(onProgress: DiscoverProgressHandler | undefined, progress: DiscoverProgress) {
  if (!onProgress) return;
  await onProgress(progress);
}

export async function discoverAreaBusinesses(
  input: DiscoverAreaInput,
  onProgress?: DiscoverProgressHandler,
): Promise<DiscoverAreaResult> {
  const radiusMiles = Math.min(Math.max(input.radiusMiles || 10, 1), 40);
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const categories =
    input.categoryIds.length > 0
      ? DISCOVERY_CATEGORIES.filter((c) => input.categoryIds.includes(c.id))
      : DISCOVERY_CATEGORIES;

  if (categories.length === 0) {
    throw new Error("Pick at least one industry / service category");
  }

  const locationLabel = (input.locationQuery || "Groton, CT").trim();
  await report(onProgress, {
    stage: "geocode",
    label: `Locating ${locationLabel}…`,
    percent: 8,
    detail: "Resolving town center",
  });

  const center = await resolveLocation(input.locationQuery, input.lat, input.lng);

  await report(onProgress, {
    stage: "overpass",
    label: "Searching OpenStreetMap…",
    percent: 20,
    detail: `${categories.length} niche${categories.length === 1 ? "" : "s"} · ${radiusMiles} mi radius`,
  });

  const tagFilters = categories.flatMap((c) => c.tags);
  const query = buildOverpassQuery(center.lat, center.lng, radiusMeters, tagFilters);
  const elements = await runOverpass(query);

  await report(onProgress, {
    stage: "wikidata",
    label: "Estimating company sizes…",
    percent: 55,
    found: elements.length,
    detail: `${elements.length} map feature${elements.length === 1 ? "" : "s"} returned`,
  });

  const wikidataIds = elements
    .map((el) => el.tags?.wikidata)
    .filter((id): id is string => Boolean(id));
  const wikiSizes = await fetchWikidataEmployeeBuckets(wikidataIds);

  await report(onProgress, {
    stage: "assemble",
    label: "Building business list…",
    percent: 72,
    found: elements.length,
    detail: wikiSizes.size > 0 ? `${wikiSizes.size} sized via Wikidata` : "Using OSM size heuristics",
  });

  const byKey = new Map<string, DiscoveredBusiness>();

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags["name:en"] || tags.brand || tags.operator;
    if (!name) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const category: DiscoveryCategory | undefined = matchCategory(tags) || categories[0];
    const wikiId = tags.wikidata || null;
    const wikiSize = wikiId ? wikiSizes.get(wikiId) : undefined;
    const sizeBucket: CompanySizeBucket = wikiSize || estimateSizeFromTags(tags, category);
    const sizeSource: DiscoveredBusiness["sizeSource"] = wikiSize ? "wikidata" : "tags";

    const miles = haversineMiles(HOME_LAT, HOME_LNG, lat, lng);
    const osmKey = `${el.type}/${el.id}`;
    byKey.set(osmKey, {
      osmKey,
      osmType: el.type,
      osmId: el.id,
      company: name,
      website: normalizeWebsite(tags.website || tags["contact:website"]),
      phone: tags.phone || tags["contact:phone"] || null,
      email: tags.email || tags["contact:email"] || null,
      address: buildAddress(tags),
      city: tags["addr:city"] || null,
      region: tags["addr:state"] || "CT",
      lat,
      lng,
      industry: category?.industry || "Other",
      service: category?.service || "Unspecified",
      categoryId: category?.id || "other",
      sizeBucket,
      sizeSource,
      milesFromHome: Math.round(miles * 10) / 10,
      driveMinutes: Math.round(miles * 2),
      wikidataId: wikiId,
      osmTags: tags,
    });
  }

  let businesses = [...byKey.values()].sort((a, b) => a.milesFromHome - b.milesFromHome);

  if (input.sizeBuckets && input.sizeBuckets.length > 0) {
    businesses = businesses.filter((b) => input.sizeBuckets!.includes(b.sizeBucket));
  }

  if (input.enrichWebsites) {
    const { estimateSizeFromWebsite } = await import("@/lib/discovery/size");
    const sample = businesses.slice(0, 12);
    for (let i = 0; i < sample.length; i++) {
      const biz = sample[i];
      await report(onProgress, {
        stage: "enrich",
        label: `Sniffing websites…`,
        percent: 75 + Math.round(((i + 1) / Math.max(sample.length, 1)) * 20),
        found: businesses.length,
        detail: `${i + 1}/${sample.length} · ${biz.company}`,
      });
      if (biz.sizeBucket !== "unknown" && biz.sizeSource === "wikidata") continue;
      const fromWeb = await estimateSizeFromWebsite(biz.website);
      if (fromWeb) {
        biz.sizeBucket = fromWeb;
        biz.sizeSource = "tags";
      }
    }
    if (input.sizeBuckets && input.sizeBuckets.length > 0) {
      businesses = businesses.filter((b) => input.sizeBuckets!.includes(b.sizeBucket));
    }
  }

  await report(onProgress, {
    stage: "done",
    label: `Found ${businesses.length} business${businesses.length === 1 ? "" : "es"}`,
    percent: 100,
    found: businesses.length,
    detail: center.label,
  });

  return {
    center: { lat: center.lat, lng: center.lng, label: center.label },
    radiusMiles,
    businesses,
    queriedCategories: categories.map((c) => c.label),
    source: "OpenStreetMap / Overpass",
  };
}
