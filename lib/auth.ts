import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionValid } from "@/lib/session";
import { createAdmin } from "@/lib/supabase/admin";

export async function requireOwner() {
  const jar = await cookies();
  if (!sessionValid(jar.get(SESSION_COOKIE)?.value)) redirect("/login");
  return { supabase: createAdmin(), user: { email: "Ops" } };
}
