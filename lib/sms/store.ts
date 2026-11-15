import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SmsConversation = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  summary: string | null;
  last_message_at: string;
  bot_paused: boolean;
  opted_out: boolean;
  linq_chat_id: string | null;
  lead_notified_at: string | null;
  created_at: string;
};

export type SmsMessage = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound" | "system";
  body: string;
  created_at: string;
  linq_message_id: string | null;
};

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  phone: string,
  linqChatId: string | null,
) {
  const { data: existing, error: findError } = await supabase
    .from("sms_conversations")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) {
    if (linqChatId && !existing.linq_chat_id) {
      await supabase
        .from("sms_conversations")
        .update({ linq_chat_id: linqChatId })
        .eq("id", existing.id);
      return { ...(existing as SmsConversation), linq_chat_id: linqChatId };
    }
    return existing as SmsConversation;
  }

  const { data, error } = await supabase
    .from("sms_conversations")
    .insert({
      phone,
      linq_chat_id: linqChatId,
      status: "active",
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create SMS conversation");
  return data as SmsConversation;
}

export async function insertMessage(
  supabase: SupabaseClient,
  row: {
    conversationId: string;
    direction: "inbound" | "outbound" | "system";
    body: string;
    linqMessageId?: string | null;
    webhookEventId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("sms_messages")
    .insert({
      conversation_id: row.conversationId,
      direction: row.direction,
      body: row.body,
      linq_message_id: row.linqMessageId ?? null,
      webhook_event_id: row.webhookEventId ?? null,
      meta: row.meta ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null; // duplicate webhook event
    throw new Error(error.message);
  }

  await supabase
    .from("sms_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", row.conversationId);

  return data as SmsMessage;
}

export async function recentMessages(supabase: SupabaseClient, conversationId: string, limit = 10) {
  const { data, error } = await supabase
    .from("sms_messages")
    .select("id, conversation_id, direction, body, created_at, linq_message_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as SmsMessage[]).reverse();
}

export async function activeFaqs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("sms_faqs")
    .select("question, answer")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as { question: string; answer: string }[];
}

export async function updateConversation(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    status: string;
    summary: string | null;
    name: string | null;
    bot_paused: boolean;
    opted_out: boolean;
    lead_notified_at: string | null;
    linq_chat_id: string | null;
  }>,
) {
  const { error } = await supabase.from("sms_conversations").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function countInbound(supabase: SupabaseClient, conversationId: string) {
  const { count, error } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
