import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionValid } from "@/lib/session";
import { DISCOVERY_CATEGORIES, type CompanySizeBucket } from "@/lib/discovery/categories";
import {
  discoverAreaBusinesses,
  type DiscoverAreaResult,
  type DiscoverProgress,
} from "@/lib/discovery/overpass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type DiscoverBody = {
  locationQuery?: string;
  radiusMiles?: number;
  categoryIds?: string[];
  sizeBuckets?: CompanySizeBucket[];
  enrichWebsites?: boolean;
  lat?: number;
  lng?: number;
};

function encodeEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(request: NextRequest) {
  const jar = await cookies();
  if (!sessionValid(jar.get(SESSION_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: DiscoverBody;
  try {
    body = (await request.json()) as DiscoverBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encodeEvent(payload));
      };

      try {
        const hasPin =
          typeof body.lat === "number" &&
          typeof body.lng === "number" &&
          Number.isFinite(body.lat) &&
          Number.isFinite(body.lng);

        const result: DiscoverAreaResult = await discoverAreaBusinesses(
          {
            locationQuery: body.locationQuery || (hasPin ? "Pinned map area" : "Groton, CT"),
            radiusMiles: body.radiusMiles || 10,
            categoryIds: body.categoryIds?.length
              ? body.categoryIds
              : DISCOVERY_CATEGORIES.map((c) => c.id),
            sizeBuckets: body.sizeBuckets?.length ? body.sizeBuckets : undefined,
            enrichWebsites: Boolean(body.enrichWebsites),
            lat: hasPin ? body.lat : undefined,
            lng: hasPin ? body.lng : undefined,
          },
          async (progress: DiscoverProgress) => {
            send({ type: "progress", ...progress });
          },
        );
        send({ type: "result", result });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Discovery failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
