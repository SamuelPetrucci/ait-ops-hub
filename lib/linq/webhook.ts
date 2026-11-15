import "server-only";
import { createLinqClient, linqWebhookSecret } from "./client";

export type InboundSms = {
  eventId: string;
  eventType: string;
  chatId: string | null;
  messageId: string | null;
  phone: string | null;
  text: string;
  fromMe: boolean;
  raw: unknown;
};

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      const row = asRecord(part);
      if (!row) return "";
      if (row.type === "text" && typeof row.value === "string") return row.value;
      if (typeof row.value === "string") return row.value;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Normalize both Linq webhook versions (2025 legacy + 2026-02-03). */
export function parseInboundEvent(event: unknown): InboundSms | null {
  const root = asRecord(event);
  if (!root) return null;

  const eventType = typeof root.event_type === "string" ? root.event_type : "";
  const eventId =
    (typeof root.event_id === "string" && root.event_id) ||
    (typeof root.id === "string" && root.id) ||
    "";

  const data = asRecord(root.data) ?? root;
  const chat = asRecord(data.chat);
  const sender = asRecord(data.sender_handle);
  const message = asRecord(data.message);

  const chatId =
    (typeof data.chat_id === "string" && data.chat_id) ||
    (typeof chat?.id === "string" && chat.id) ||
    null;

  const messageId =
    (typeof data.id === "string" && data.id) ||
    (typeof message?.id === "string" && message.id) ||
    null;

  const phone =
    (typeof data.from === "string" && data.from) ||
    (typeof sender?.handle === "string" && sender.handle) ||
    null;

  const fromMe =
    data.is_from_me === true ||
    sender?.is_me === true ||
    data.direction === "outbound";

  const text =
    textFromParts(data.parts) ||
    textFromParts(message?.parts) ||
    (typeof data.text === "string" ? data.text.trim() : "") ||
    (typeof message?.text === "string" ? message.text.trim() : "");

  return {
    eventId,
    eventType,
    chatId,
    messageId,
    phone,
    text,
    fromMe,
    raw: event,
  };
}

export function verifyLinqWebhook(rawBody: string, headers: Headers) {
  const secret = linqWebhookSecret();
  if (!secret) {
    throw new Error("LINQ_WEBHOOK_SECRET is not set");
  }

  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });

  const client = createLinqClient();
  return client.webhooks.unwrap(rawBody, {
    headers: headerRecord,
    key: secret,
  });
}
