"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireOwner } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUICK_STATUSES = ["skipped", "used"] as const;

type QuickStatus = (typeof QUICK_STATUSES)[number];

export async function setTrendStatus(id: string, status: QuickStatus) {
  if (!UUID.test(id) || !QUICK_STATUSES.includes(status)) {
    return { ok: false as const, error: "That trend update is not valid." };
  }

  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("trends")
    .update({ status })
    .eq("id", id)
    .select("id, topic")
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, error: error?.message || "Could not update that trend." };
  }

  try {
    await logActivity(supabase, {
      entityType: "trend",
      entityId: id,
      action: "status_change",
      details: { status, topic: data.topic },
    });
  } catch {
    // The status row is already saved. A missing activity line should not undo the click.
  }

  revalidatePath("/content/trends");
  revalidatePath("/");
  return { ok: true as const };
}
