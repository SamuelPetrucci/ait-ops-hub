import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLinqText } from "@/lib/linq/client";
import { logActivity } from "@/lib/activity";
import { ownerPhone } from "./phone";
import { updateConversation, type SmsConversation } from "./store";

export async function notifyOwnerOfSmsEvent(
  supabase: SupabaseClient,
  conversation: SmsConversation,
  reason: "new_lead" | "needs_human",
  details: { inboundText: string; summary?: string | null },
) {
  const title =
    reason === "new_lead"
      ? `SMS lead: ${conversation.phone}`
      : `SMS needs you: ${conversation.phone}`;

  const notes = [
    details.summary || conversation.summary || "Inbound SMS conversation",
    `Phone: ${conversation.phone}`,
    details.inboundText ? `Latest: ${details.inboundText.slice(0, 240)}` : null,
    `Open: /sms/${conversation.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Approvals inbox (pre-existing table; try a few payload shapes).
  const approvalAttempts: Record<string, string>[] = [
    {
      title,
      notes,
      status: "pending",
      requested_by: "SMS Assistant",
    },
    {
      title,
      notes,
      status: "pending",
    },
    {
      title,
      body: notes,
      status: "pending",
    },
  ];

  let approvalId: string | null = null;
  for (const payload of approvalAttempts) {
    const { data: approval, error: approvalError } = await supabase
      .from("approvals")
      .insert(payload as never)
      .select("id")
      .maybeSingle();
    if (!approvalError && approval?.id) {
      approvalId = approval.id;
      break;
    }
    console.error("[sms] approvals insert attempt failed", approvalError?.message, payload);
  }

  if (approvalId) {
    try {
      await logActivity(supabase, {
        entityType: "approval",
        entityId: approvalId,
        actor: "SMS Assistant",
        action: reason === "new_lead" ? "sms_new_lead" : "sms_needs_human",
        details: {
          conversation_id: conversation.id,
          phone: conversation.phone,
          summary: details.summary,
        },
      });
    } catch (error) {
      console.error("[sms] activity log failed", error);
    }
  }

  await logActivity(supabase, {
    entityType: "sms_conversation",
    entityId: conversation.id,
    actor: "SMS Assistant",
    action: reason === "new_lead" ? "sms_new_lead" : "sms_needs_human",
    details: {
      phone: conversation.phone,
      summary: details.summary,
      inbound: details.inboundText.slice(0, 400),
    },
  }).catch((error) => console.error("[sms] conversation activity failed", error));

  const owner = ownerPhone();
  if (!owner) {
    console.error("[sms] OWNER_PHONE missing — skipped owner text");
    return;
  }

  const ownerText =
    reason === "new_lead"
      ? `New SMS lead ${conversation.phone}: ${(details.summary || details.inboundText).slice(0, 160)}`
      : `Needs you — ${conversation.phone}: ${(details.summary || details.inboundText).slice(0, 160)}`;

  try {
    await sendLinqText(owner, ownerText, {
      idempotencyKey: `owner-${reason}-${conversation.id}-${Date.now()}`,
    });
  } catch (error) {
    console.error("[sms] owner notify text failed", error);
  }

  if (reason === "new_lead" && !conversation.lead_notified_at) {
    await updateConversation(supabase, conversation.id, {
      lead_notified_at: new Date().toISOString(),
    });
  }
}
