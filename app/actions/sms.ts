"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function setSmsBotPaused(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = String(formData.get("id") || "");
  const paused = String(formData.get("paused") || "") === "true";
  if (!id) return;

  const { error } = await supabase
    .from("sms_conversations")
    .update({
      bot_paused: paused,
      status: paused ? "needs_human" : "active",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    entityType: "sms_conversation",
    entityId: id,
    action: paused ? "sms_bot_paused" : "sms_bot_resumed",
    details: { bot_paused: paused },
  });

  revalidatePath("/sms");
  revalidatePath(`/sms/${id}`);
}

export async function markSmsClosed(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase
    .from("sms_conversations")
    .update({ status: "closed", bot_paused: true })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    entityType: "sms_conversation",
    entityId: id,
    action: "sms_closed",
  });

  revalidatePath("/sms");
  revalidatePath(`/sms/${id}`);
}
