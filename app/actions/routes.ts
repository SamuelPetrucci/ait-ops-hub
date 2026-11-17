"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import type { RouteStop } from "@/lib/routes";

export type SavedRoute = {
  id: string;
  name: string;
  stops: RouteStop[];
  start_address: string;
  start_lat: number;
  start_lng: number;
  total_distance_km: number | null;
  created_at: string;
};

export async function saveRoute(
  name: string,
  stops: RouteStop[],
  startAddress: string,
  startLat: number,
  startLng: number,
  totalKm: number
): Promise<{ id: string } | { error: string }> {
  const { supabase } = await requireOwner();

  if (!name.trim()) {
    return { error: "Route name is required" };
  }

  if (stops.length === 0) {
    return { error: "Add at least one stop" };
  }

  const { data, error } = await supabase
    .from("sales_routes")
    .insert({
      name: name.trim(),
      stops,
      start_address: startAddress,
      start_lat: startLat,
      start_lng: startLng,
      total_distance_km: totalKm,
      created_by: "Samuel",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/crm");
  revalidatePath("/prospect-map");
  return { id: data.id };
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const { supabase } = await requireOwner();

  const { data, error } = await supabase
    .from("sales_routes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    stops: (row.stops || []) as RouteStop[],
    start_address: row.start_address,
    start_lat: row.start_lat,
    start_lng: row.start_lng,
    total_distance_km: row.total_distance_km,
    created_at: row.created_at,
  }));
}

export async function deleteRoute(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireOwner();

  const { error } = await supabase.from("sales_routes").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/crm");
  revalidatePath("/prospect-map");
  return { success: true };
}
