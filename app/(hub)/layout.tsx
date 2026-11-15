import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireOwner } from "@/lib/auth";
import { nyToday } from "@/lib/format";
import { LEAD_STAGES } from "@/lib/prospects";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireOwner();
  const today = nyToday();
  const [content, followUps, smsNeeds] = await Promise.all([
    supabase.from("content_queue").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .in("stage", [...LEAD_STAGES])
      .not("next_follow_up_due", "is", null)
      .lte("next_follow_up_due", today),
    supabase
      .from("sms_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_human"),
  ]);

  return (
    <Shell
      email={user.email || "Samuel"}
      badges={{
        leads: followUps.count || 0,
        content: content.count || 0,
        approvals: content.count || 0,
        // 0 until migration 20261115210000_sms_assistant.sql is applied
        sms: smsNeeds.error ? 0 : smsNeeds.count || 0,
      }}
    >
      {children}
    </Shell>
  );
}
