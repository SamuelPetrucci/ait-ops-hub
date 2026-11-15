import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 60_000;
const MAX_OUTBOUND_PER_WINDOW = 8;

/** DB-backed rate limit: max outbound replies per phone per rolling minute. */
export async function isRateLimited(supabase: SupabaseClient, conversationId: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .gte("created_at", since);

  if (error) {
    console.error("[sms] rate-limit check failed", error.message);
    return false;
  }

  return (count ?? 0) >= MAX_OUTBOUND_PER_WINDOW;
}
