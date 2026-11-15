import { after } from "next/server";
import { verifyLinqWebhook } from "@/lib/linq/webhook";
import { handleInboundSms } from "@/lib/sms/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event: unknown;
  try {
    event = verifyLinqWebhook(rawBody, request.headers);
  } catch (error) {
    console.error("[sms] webhook verification failed", error);
    return new Response("invalid signature", { status: 401 });
  }

  after(async () => {
    try {
      await handleInboundSms(event);
    } catch (error) {
      console.error("[sms] inbound processing failed", error);
    }
  });

  return Response.json({ received: true });
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "linq-inbound",
    hint: "POST message.received webhooks here. Do not enable in production until Samuel approves.",
  });
}
