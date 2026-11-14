import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "./public-env";

export function createBrowserSupabase() {
  const { url, key } = publicEnv();
  return createBrowserClient(url, key);
}
