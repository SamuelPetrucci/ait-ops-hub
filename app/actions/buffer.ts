"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { bufferConfigured, syncBufferAnalytics } from "@/lib/buffer";

export async function refreshBufferAnalytics() {
  await requireOwner();
  if (!bufferConfigured()) {
    return {
      ok: false as const,
      error: "Add BUFFER_API_KEY on the server (Buffer → Settings → API), then try again.",
    };
  }
  try {
    const result = await syncBufferAnalytics();
    revalidatePath("/");
    revalidatePath("/content");
    return { ok: true as const, result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Buffer sync failed.",
    };
  }
}
