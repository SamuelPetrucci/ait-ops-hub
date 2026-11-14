import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "./public-env";

export function createAdmin() {
  const { url } = publicEnv();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Set SUPABASE_SERVICE_ROLE_KEY on the server. Never expose it to the browser.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
