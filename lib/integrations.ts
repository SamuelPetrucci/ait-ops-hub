import "server-only";
import { bufferConfigured, bufferOrgId, readBufferTotals } from "@/lib/buffer";
import { createAdmin } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/supabase/public-env";

export type IntegrationStatus = "connected" | "configured" | "degraded" | "missing";

export type IntegrationCard = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  detail: string;
  href?: string;
  docs?: string;
};

export async function getProfile() {
  return {
    name: "Samuel",
    email: process.env.OWNER_EMAIL?.trim() || "Ops",
    organization: "AI Transformation LLC",
    passwordGate: Boolean(process.env.OPS_PASSWORD?.trim()),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || null,
  };
}

export async function getIntegrations(): Promise<IntegrationCard[]> {
  const [supabase, buffer, storage, password] = await Promise.all([
    checkSupabase(),
    checkBuffer(),
    checkVideoStorage(),
    checkPasswordGate(),
  ]);
  return [supabase, buffer, storage, password];
}

async function checkSupabase(): Promise<IntegrationCard> {
  try {
    const { url } = publicEnv();
    const admin = createAdmin();
    const started = Date.now();
    const { count, error } = await admin.from("prospects").select("id", { count: "exact", head: true });
    if (error) {
      return {
        id: "supabase",
        name: "Supabase",
        description: "Database, auth-adjacent storage, and content queue.",
        status: "degraded",
        detail: error.message,
        href: url,
        docs: "https://supabase.com/dashboard",
      };
    }
    return {
      id: "supabase",
      name: "Supabase",
      description: "Database, auth-adjacent storage, and content queue.",
      status: "connected",
      detail: `${count ?? 0} prospects · ${Date.now() - started}ms · ${hostOf(url)}`,
      href: url,
      docs: "https://supabase.com/dashboard",
    };
  } catch (error) {
    return {
      id: "supabase",
      name: "Supabase",
      description: "Database, auth-adjacent storage, and content queue.",
      status: "missing",
      detail: error instanceof Error ? error.message : "Not configured",
      docs: "https://supabase.com/dashboard",
    };
  }
}

async function checkBuffer(): Promise<IntegrationCard> {
  const orgId = bufferOrgId();
  const configured = bufferConfigured();
  const totals = await readBufferTotals().catch(() => null);

  if (!configured) {
    return {
      id: "buffer",
      name: "Buffer",
      description: "Social scheduling and post analytics.",
      status: totals?.syncedAt ? "degraded" : "missing",
      detail: totals?.syncedAt
        ? `API key missing locally/server. Last snapshot ${totals.syncedAt} · ${totals.views} views`
        : "Add BUFFER_API_KEY (Buffer → Settings → API).",
      docs: "https://publish.buffer.com",
    };
  }

  try {
    const key = process.env.BUFFER_API_KEY!.trim();
    const response = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query ($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) { id service }
        }`,
        variables: { organizationId: orgId },
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        id: "buffer",
        name: "Buffer",
        description: "Social scheduling and post analytics.",
        status: "degraded",
        detail: `API ${response.status}. Org ${orgId}.`,
        docs: "https://publish.buffer.com",
      };
    }
    const payload = (await response.json()) as {
      data?: { channels?: { id: string; service: string }[] };
      errors?: { message: string }[];
    };
    if (payload.errors?.length) {
      return {
        id: "buffer",
        name: "Buffer",
        description: "Social scheduling and post analytics.",
        status: "degraded",
        detail: payload.errors.map((entry) => entry.message).join("; "),
        docs: "https://publish.buffer.com",
      };
    }
    const channels = payload.data?.channels || [];
    const services = [...new Set(channels.map((row) => row.service))].join(", ") || "no channels";
    return {
      id: "buffer",
      name: "Buffer",
      description: "Social scheduling and post analytics.",
      status: "connected",
      detail: `${channels.length} channels (${services}) · org ${orgId.slice(0, 8)}…${
        totals?.syncedAt ? ` · snapshot ${totals.views} views` : ""
      }`,
      docs: "https://publish.buffer.com",
    };
  } catch (error) {
    return {
      id: "buffer",
      name: "Buffer",
      description: "Social scheduling and post analytics.",
      status: "degraded",
      detail: error instanceof Error ? error.message : "Buffer ping failed",
      docs: "https://publish.buffer.com",
    };
  }
}

async function checkVideoStorage(): Promise<IntegrationCard> {
  try {
    const admin = createAdmin();
    const { data, error } = await admin
      .from("content_queue")
      .select("video_url")
      .not("video_url", "is", null)
      .limit(20);
    if (error) {
      return {
        id: "storage",
        name: "Video storage",
        description: "Supabase public bucket for rendered social videos.",
        status: "degraded",
        detail: error.message,
      };
    }
    const urls = (data || []).map((row) => row.video_url).filter(Boolean) as string[];
    if (urls.length === 0) {
      return {
        id: "storage",
        name: "Video storage",
        description: "Supabase public bucket for rendered social videos.",
        status: "configured",
        detail: "No video_url rows yet.",
      };
    }
    const sample = urls[0];
    const ping = await fetch(sample, { method: "HEAD", cache: "no-store" }).catch(() => null);
    const ok = Boolean(ping?.ok);
    return {
      id: "storage",
      name: "Video storage",
      description: "Supabase public bucket for rendered social videos.",
      status: ok ? "connected" : "degraded",
      detail: ok
        ? `${urls.length}+ videos reachable · ${hostOf(sample)}`
        : `Could not HEAD sample video (${hostOf(sample)}).`,
      href: sample,
    };
  } catch (error) {
    return {
      id: "storage",
      name: "Video storage",
      description: "Supabase public bucket for rendered social videos.",
      status: "missing",
      detail: error instanceof Error ? error.message : "Not configured",
    };
  }
}

async function checkPasswordGate(): Promise<IntegrationCard> {
  const set = Boolean(process.env.OPS_PASSWORD?.trim());
  return {
    id: "ops-password",
    name: "Ops password gate",
    description: "Shared password that unlocks the hub session.",
    status: set ? "connected" : "missing",
    detail: set ? "OPS_PASSWORD is set on the server." : "Set OPS_PASSWORD in .env / Vercel.",
  };
}

function hostOf(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}
