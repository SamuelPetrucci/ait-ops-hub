"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { DISCOVERY_CATEGORIES, type CompanySizeBucket } from "@/lib/discovery/categories";
import {
  discoverAreaBusinesses,
  type DiscoveredBusiness,
  type DiscoverAreaResult,
} from "@/lib/discovery/overpass";
import { logActivity } from "@/lib/activity";

export type DiscoverRequest = {
  locationQuery: string;
  radiusMiles: number;
  categoryIds: string[];
  sizeBuckets: CompanySizeBucket[];
  enrichWebsites?: boolean;
};

export type ImportDiscoveredRequest = {
  businesses: Array<{
    osmKey: string;
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
    sizeBucket: CompanySizeBucket;
    milesFromHome: number;
    driveMinutes: number;
  }>;
};

export async function discoverArea(input: DiscoverRequest): Promise<DiscoverAreaResult | { error: string }> {
  await requireOwner();

  try {
    return await discoverAreaBusinesses({
      locationQuery: input.locationQuery || "Groton, CT",
      radiusMiles: input.radiusMiles || 10,
      categoryIds: input.categoryIds?.length ? input.categoryIds : DISCOVERY_CATEGORIES.map((c) => c.id),
      sizeBuckets: input.sizeBuckets?.length ? input.sizeBuckets : undefined,
      enrichWebsites: Boolean(input.enrichWebsites),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Discovery failed" };
  }
}

export async function importDiscoveredBusinesses(
  input: ImportDiscoveredRequest,
): Promise<{ imported: number; skipped: number; errors: string[] } | { error: string }> {
  const { supabase } = await requireOwner();
  const rows = input.businesses || [];
  if (rows.length === 0) return { imported: 0, skipped: 0, errors: [] };
  if (rows.length > 100) return { error: "Import at most 100 businesses at a time" };

  const osmKeys = rows.map((r) => r.osmKey);
  const { data: existingByOsm } = await supabase
    .from("prospects")
    .select("id, osm_id, company, website")
    .in("osm_id", osmKeys);

  const existingOsm = new Set((existingByOsm || []).map((r) => r.osm_id).filter(Boolean));

  // Also skip obvious company name duplicates already in CRM
  const names = rows.map((r) => r.company);
  const { data: existingByName } = await supabase.from("prospects").select("id, company").in("company", names);
  const existingNames = new Set((existingByName || []).map((r) => r.company.toLowerCase()));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (existingOsm.has(row.osmKey) || existingNames.has(row.company.toLowerCase())) {
      skipped += 1;
      continue;
    }

    const contactBits = [row.phone, row.email].filter(Boolean).join(" · ") || null;
    const notes = [
      `Discovered via OpenStreetMap (${row.osmKey}).`,
      `Estimated size: ${row.sizeBucket}.`,
      "© OpenStreetMap contributors",
    ].join(" ");

    const payload = {
      company: row.company,
      website: row.website,
      contact: contactBits,
      address: row.address,
      city: row.city,
      region: row.region || "CT",
      industry: row.industry,
      proposed_service: row.service,
      stage: "researched",
      lat: row.lat,
      lng: row.lng,
      miles_from_home: row.milesFromHome,
      drive_minutes: row.driveMinutes,
      geocoded_at: new Date().toISOString(),
      osm_id: row.osmKey,
      company_size_bucket: row.sizeBucket,
      discovery_source: "openstreetmap",
      notes,
      deal_owner: "Samuel",
      lead_score: row.sizeBucket === "1-10" || row.sizeBucket === "11-50" ? 60 : 45,
    };

    const { data: inserted, error } = await supabase.from("prospects").insert(payload).select("id").single();

    if (error) {
      // If migration not applied yet, retry without new columns
      if (/osm_id|company_size_bucket|discovery_source/i.test(error.message)) {
        const fallback = { ...payload } as Record<string, unknown>;
        delete fallback.osm_id;
        delete fallback.company_size_bucket;
        delete fallback.discovery_source;
        const retry = await supabase.from("prospects").insert(fallback).select("id").single();
        if (retry.error) {
          errors.push(`${row.company}: ${retry.error.message}`);
          continue;
        }
        if (retry.data?.id) {
          await logActivity(supabase, {
            entityType: "prospect",
            entityId: retry.data.id,
            action: "discovered",
            details: { source: "openstreetmap", osm_id: row.osmKey, size: row.sizeBucket },
          });
          imported += 1;
          existingNames.add(row.company.toLowerCase());
        }
        continue;
      }
      errors.push(`${row.company}: ${error.message}`);
      continue;
    }

    if (inserted?.id) {
      await logActivity(supabase, {
        entityType: "prospect",
        entityId: inserted.id,
        action: "discovered",
        details: { source: "openstreetmap", osm_id: row.osmKey, size: row.sizeBucket },
      });
      imported += 1;
      existingNames.add(row.company.toLowerCase());
      existingOsm.add(row.osmKey);
    }
  }

  revalidatePath("/prospect-map");
  revalidatePath("/leads");
  revalidatePath("/", "layout");

  return { imported, skipped, errors };
}

export type { DiscoveredBusiness };
