import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireOwner } from "@/lib/auth";
import { nyToday } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireOwner();
  const today = nyToday();
  const [approvals, outreach, content, followUps] = await Promise.all([
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("outreach_messages")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending_approval", "held"]),
    supabase.from("content_queue").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .not("next_follow_up_due", "is", null)
      .lte("next_follow_up_due", today),
  ]);

  return (
    <Shell
      email={user.email || "Samuel"}
      badges={{
        approvals: (approvals.count || 0) + (outreach.count || 0),
        followUps: followUps.count || 0,
        content: content.count || 0,
      }}
    >
      {children}
    </Shell>
  );
}
