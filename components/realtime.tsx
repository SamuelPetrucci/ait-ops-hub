"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const TABLES = [
  "approvals",
  "content_queue",
  "activities",
  "tasks",
  "sms_conversations",
  "sms_messages",
] as const;

export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel("ait-ops-hub");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
