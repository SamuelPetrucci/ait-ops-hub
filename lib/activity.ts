import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    entityType: string;
    entityId: string;
    action: string;
    details?: Record<string, unknown>;
    actor?: string;
  },
) {
  const { error } = await supabase.from("activities").insert({
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    actor: entry.actor ?? "Samuel",
    action: entry.action,
    details: entry.details ?? {},
  });
  if (error) throw new Error(error.message);
}
