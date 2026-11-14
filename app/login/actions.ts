"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accessPassword, passwordsMatch, SESSION_COOKIE, sessionToken } from "@/lib/session";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}

export async function signIn(formData: FormData) {
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));
  if (!accessPassword()) {
    redirect("/login?error=Set%20OPS_PASSWORD%20on%20the%20server");
  }
  if (!passwordsMatch(password)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    redirect(`/login?error=Wrong%20password&next=${encodeURIComponent(next)}`);
  }
  const jar = await cookies();
  const session = sessionToken();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  redirect(next);
}
