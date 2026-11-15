import "server-only";
import { createAdmin } from "@/lib/supabase/admin";
import { nyToday } from "@/lib/format";
import type { IntegrationCard } from "@/lib/integrations";

/** Persist a health snapshot. Prefers hub_integration_checks; falls back to daily_metrics. */
export async function recordIntegrationChecks(integrations: IntegrationCard[]) {
  const admin = createAdmin();
  const rows = integrations.map((item) => ({
    integration_id: item.id,
    status: item.status,
    detail: item.detail.slice(0, 500),
    checked_by: "ops",
  }));

  const primary = await admin.from("hub_integration_checks").insert(rows);
  if (!primary.error) return { stored: "hub_integration_checks" as const };

  const missingTable = /relation .* does not exist|Could not find the table|schema cache/i.test(
    primary.error.message,
  );
  if (!missingTable) {
    console.error("hub_integration_checks", primary.error.message);
  }

  const fallback = await admin.from("daily_metrics").insert({
    entry_date: nyToday(),
    entry_type: "integration_check",
    title: "Integration health",
    author: "ops",
    lessons_learned: `Integration health ${new Date().toISOString()}`,
    metrics: {
      source: "ops-hub",
      checkedAt: new Date().toISOString(),
      integrations: rows,
    },
  });
  if (fallback.error) {
    console.error("integration_check fallback", fallback.error.message);
    return { stored: null, error: fallback.error.message };
  }
  return { stored: "daily_metrics" as const };
}

export async function readIntegrationHistory(limit = 20) {
  const admin = createAdmin();
  const primary = await admin
    .from("hub_integration_checks")
    .select("id, integration_id, status, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!primary.error && primary.data) return primary.data;

  const fallback = await admin
    .from("daily_metrics")
    .select("id, created_at, metrics, entry_type")
    .eq("entry_type", "integration_check")
    .order("created_at", { ascending: false })
    .limit(5);
  if (fallback.error || !fallback.data) return [];

  const flattened = [];
  for (const row of fallback.data) {
    const metrics = (row.metrics || {}) as { integrations?: { integration_id?: string; status?: string; detail?: string }[] };
    for (const item of metrics.integrations || []) {
      flattened.push({
        id: `${row.id}-${item.integration_id}`,
        integration_id: String(item.integration_id || "unknown"),
        status: String(item.status || "missing"),
        detail: String(item.detail || ""),
        created_at: row.created_at,
      });
    }
  }
  return flattened.slice(0, limit);
}
