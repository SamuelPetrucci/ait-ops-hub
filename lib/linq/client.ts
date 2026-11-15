import "server-only";
import Linq from "@linqapp/sdk";

export function linqApiKey() {
  return process.env.LINQ_API_KEY || process.env.LINQ_API_V3_API_KEY || "";
}

export function linqWebhookSecret() {
  return process.env.LINQ_WEBHOOK_SECRET || "";
}

export function createLinqClient() {
  const apiKey = linqApiKey();
  if (!apiKey) {
    throw new Error("Set LINQ_API_KEY (or LINQ_API_V3_API_KEY) on the server.");
  }
  return new Linq({ apiKey });
}

export async function sendLinqText(
  to: string,
  text: string,
  options?: { overrideOptout?: boolean; idempotencyKey?: string },
) {
  const client = createLinqClient();
  return client.messages.create({
    to: [to],
    override_optout: options?.overrideOptout ?? false,
    message: {
      parts: [{ type: "text", value: text }],
      idempotency_key: options?.idempotencyKey,
    },
  });
}
