import type { IndustryCategory } from "@/lib/sales-tactics";

export type CompanySizeBucket = "1-10" | "11-50" | "51-200" | "200+" | "unknown";

export type OsmTagFilter = {
  key: string;
  value: string;
};

export type DiscoveryCategory = {
  id: string;
  label: string;
  industry: IndustryCategory;
  /** Human service label stored on the prospect */
  service: string;
  /** OSM tag pairs to query (OR'd together) */
  tags: OsmTagFilter[];
  /** Default size guess when no better signal exists */
  defaultSize: CompanySizeBucket;
};

/** Free OSM → niche/service map for CT door-to-door prospecting. */
export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    id: "real_estate",
    label: "Real Estate / Property Mgmt",
    industry: "Real Estate/Property Mgmt",
    service: "Property ops / leasing AI",
    tags: [
      { key: "office", value: "estate_agent" },
      { key: "office", value: "property_management" },
      { key: "office", value: "real_estate" },
    ],
    defaultSize: "1-10",
  },
  {
    id: "professional",
    label: "Professional Services",
    industry: "Professional Services",
    service: "Admin / client workflow AI",
    tags: [
      { key: "office", value: "lawyer" },
      { key: "office", value: "accountant" },
      { key: "office", value: "insurance" },
      { key: "office", value: "financial" },
      { key: "office", value: "consulting" },
      { key: "office", value: "advertising_agency" },
      { key: "office", value: "architect" },
      { key: "office", value: "company" },
    ],
    defaultSize: "1-10",
  },
  {
    id: "healthcare",
    label: "Healthcare Admin",
    industry: "Healthcare Admin",
    service: "Front desk / scheduling AI",
    tags: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "doctors" },
      { key: "amenity", value: "dentist" },
      { key: "amenity", value: "veterinary" },
      { key: "healthcare", value: "clinic" },
      { key: "healthcare", value: "doctor" },
      { key: "healthcare", value: "dentist" },
    ],
    defaultSize: "11-50",
  },
  {
    id: "b2b",
    label: "B2B Services",
    industry: "B2B Services",
    service: "Ops / lead follow-up AI",
    tags: [
      { key: "office", value: "telecommunication" },
      { key: "office", value: "it" },
      { key: "office", value: "coworking" },
      { key: "industrial", value: "warehouse" },
      { key: "shop", value: "wholesale" },
    ],
    defaultSize: "11-50",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    industry: "Restaurant",
    service: "Reservations / review reply AI",
    tags: [
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "fast_food" },
    ],
    defaultSize: "1-10",
  },
  {
    id: "contractor",
    label: "Contractor",
    industry: "Contractor",
    service: "Quote / dispatch AI",
    tags: [
      { key: "craft", value: "plumber" },
      { key: "craft", value: "electrician" },
      { key: "craft", value: "carpenter" },
      { key: "craft", value: "hvac" },
      { key: "craft", value: "painter" },
      { key: "shop", value: "trade" },
      { key: "office", value: "construction_company" },
    ],
    defaultSize: "1-10",
  },
];

export const SIZE_BUCKETS: CompanySizeBucket[] = ["1-10", "11-50", "51-200", "200+", "unknown"];

export function categoryById(id: string): DiscoveryCategory | undefined {
  return DISCOVERY_CATEGORIES.find((c) => c.id === id);
}

export function matchCategory(tags: Record<string, string>): DiscoveryCategory | undefined {
  for (const category of DISCOVERY_CATEGORIES) {
    for (const filter of category.tags) {
      if (tags[filter.key] === filter.value) return category;
    }
  }
  return undefined;
}
