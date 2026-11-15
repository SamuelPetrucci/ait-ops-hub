"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AIT-Ops-Hub-Geocoder/1.0 (samuel@aitransformation.co)";
const RATE_LIMIT_MS = 1100;

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type GeocodeResult = {
  success: boolean;
  lat?: number;
  lng?: number;
  error?: string;
};

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address || address.trim().length < 3) {
    return { success: false, error: "Address too short" };
  }

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "us",
    });

    const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const results = (await response.json()) as NominatimResult[];

    if (!results || results.length === 0) {
      return { success: false, error: "No results found" };
    }

    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { success: false, error: "Invalid coordinates" };
    }

    return { success: true, lat, lng };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function buildAddress(row: {
  address?: string | null;
  city?: string | null;
  region?: string | null;
}): string {
  if (row.address) return row.address;
  const parts = [row.city, row.region].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

const HOME_LAT = 41.3501;
const HOME_LNG = -72.0787;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDriveMinutes(miles: number): number {
  return Math.round(miles * 2);
}

export type GeocodeBatchResult = {
  total: number;
  geocoded: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export async function geocodeMissingProspects(): Promise<GeocodeBatchResult> {
  const { supabase } = await requireOwner();

  const { data: rows, error } = await supabase
    .from("prospects")
    .select("id, company, address, city, region")
    .is("lat", null)
    .neq("stage", "do_not_contact")
    .limit(50);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    return { total: 0, geocoded: 0, skipped: 0, failed: 0, errors: [] };
  }

  const result: GeocodeBatchResult = {
    total: rows.length,
    geocoded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of rows) {
    const address = buildAddress(row);

    if (!address) {
      result.skipped += 1;
      result.errors.push(`${row.company}: no address`);
      continue;
    }

    const geo = await geocodeAddress(address);

    if (!geo.success || geo.lat === undefined || geo.lng === undefined) {
      result.failed += 1;
      result.errors.push(`${row.company}: ${geo.error}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const miles = haversineDistance(HOME_LAT, HOME_LNG, geo.lat, geo.lng);
    const driveMinutes = estimateDriveMinutes(miles);

    const { error: updateError } = await supabase
      .from("prospects")
      .update({
        lat: geo.lat,
        lng: geo.lng,
        miles_from_home: miles,
        drive_minutes: driveMinutes,
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      result.failed += 1;
      result.errors.push(`${row.company}: ${updateError.message}`);
    } else {
      result.geocoded += 1;
    }

    await sleep(RATE_LIMIT_MS);
  }

  revalidatePath("/prospect-map");
  return result;
}

export async function geocodeSingleProspect(prospectId: string): Promise<GeocodeResult & { company?: string }> {
  const { supabase } = await requireOwner();

  const { data: row, error } = await supabase
    .from("prospects")
    .select("id, company, address, city, region")
    .eq("id", prospectId)
    .single();

  if (error || !row) {
    return { success: false, error: error?.message || "Prospect not found" };
  }

  const address = buildAddress(row);
  if (!address) {
    return { success: false, error: "No address available", company: row.company };
  }

  const geo = await geocodeAddress(address);

  if (!geo.success || geo.lat === undefined || geo.lng === undefined) {
    return { success: false, error: geo.error, company: row.company };
  }

  const miles = haversineDistance(HOME_LAT, HOME_LNG, geo.lat, geo.lng);
  const driveMinutes = estimateDriveMinutes(miles);

  const { error: updateError } = await supabase
    .from("prospects")
    .update({
      lat: geo.lat,
      lng: geo.lng,
      miles_from_home: miles,
      drive_minutes: driveMinutes,
      geocoded_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (updateError) {
    return { success: false, error: updateError.message, company: row.company };
  }

  revalidatePath("/prospect-map");
  revalidatePath(`/companies/${prospectId}`);
  return { success: true, lat: geo.lat, lng: geo.lng, company: row.company };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
