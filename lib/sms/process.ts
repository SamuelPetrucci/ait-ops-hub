import "server-only";
import { createAdmin } from "@/lib/supabase/admin";
import { sendLinqText } from "@/lib/linq/client";
import { parseInboundEvent, type InboundSms } from "@/lib/linq/webhook";
import {
  HELP_REPLY,
  OPT_OUT_CONFIRMATION,
  isHelpMessage,
  isOptOutMessage,
} from "./compliance";
import { HANDOFF_REPLY, shouldHandoff } from "./handoff";
import { notifyOwnerOfSmsEvent } from "./notify";
import { normalizePhone, ownerPhone, phonesEqual } from "./phone";
import { isRateLimited } from "./rate-limit";
import { generateSmsReply } from "./reply";
import {
  activeFaqs,
  countInbound,
  getOrCreateConversation,
  insertMessage,
  recentMessages,
  updateConversation,
} from "./store";

async function replyAndStore(params: {
  phone: string;
  conversationId: string;
  text: string;
  overrideOptout?: boolean;
}) {
  const supabase = createAdmin();
  const sent = await sendLinqText(params.phone, params.text, {
    overrideOptout: params.overrideOptout,
    idempotencyKey: `sms-reply-${params.conversationId}-${Date.now()}`,
  });

  const linqMessageId = sent.message?.id ?? null;

  await insertMessage(supabase, {
    conversationId: params.conversationId,
    direction: "outbound",
    body: params.text,
    linqMessageId,
  });
}

export async function handleInboundSms(event: unknown) {
  const inbound = parseInboundEvent(event);
  if (!inbound) {
    console.error("[sms] could not parse inbound event");
    return { ok: false, reason: "parse_failed" as const };
  }

  if (inbound.eventType && inbound.eventType !== "message.received") {
    return { ok: true, reason: "ignored_event" as const };
  }

  if (inbound.fromMe) {
    return { ok: true, reason: "from_me" as const };
  }

  const phone = normalizePhone(inbound.phone);
  if (!phone) {
    console.error("[sms] missing sender phone", inbound);
    return { ok: false, reason: "no_phone" as const };
  }

  if (phonesEqual(phone, ownerPhone())) {
    return { ok: true, reason: "owner_phone" as const };
  }

  if (!inbound.text) {
    return { ok: true, reason: "empty_body" as const };
  }

  const supabase = createAdmin();
  const conversation = await getOrCreateConversation(supabase, phone, inbound.chatId);

  const saved = await insertMessage(supabase, {
    conversationId: conversation.id,
    direction: "inbound",
    body: inbound.text,
    linqMessageId: inbound.messageId,
    webhookEventId: inbound.eventId || null,
    meta: { chat_id: inbound.chatId },
  });

  if (!saved) {
    return { ok: true, reason: "duplicate_event" as const };
  }

  const inboundCount = await countInbound(supabase, conversation.id);
  const isNewLead = inboundCount === 1;

  if (isOptOutMessage(inbound.text)) {
    await updateConversation(supabase, conversation.id, {
      status: "opted_out",
      opted_out: true,
      bot_paused: true,
      summary: "Opted out",
    });
    try {
      await replyAndStore({
        phone,
        conversationId: conversation.id,
        text: OPT_OUT_CONFIRMATION,
        overrideOptout: true,
      });
    } catch (error) {
      console.error("[sms] opt-out confirmation failed", error);
    }
    return { ok: true, reason: "opted_out" as const };
  }

  if (conversation.opted_out || conversation.status === "opted_out") {
    await updateConversation(supabase, conversation.id, {
      opted_out: false,
      status: conversation.bot_paused ? "needs_human" : "active",
    });
  }

  if (isHelpMessage(inbound.text)) {
    if (!(await isRateLimited(supabase, conversation.id))) {
      await replyAndStore({
        phone,
        conversationId: conversation.id,
        text: HELP_REPLY,
      });
    }
    return { ok: true, reason: "help" as const };
  }

  if (conversation.bot_paused || conversation.status === "needs_human") {
    if (isNewLead) {
      await notifyOwnerOfSmsEvent(supabase, conversation, "new_lead", {
        inboundText: inbound.text,
        summary: conversation.summary,
      });
    }
    return { ok: true, reason: "bot_paused" as const };
  }

  if (await isRateLimited(supabase, conversation.id)) {
    console.error("[sms] rate limited", phone);
    return { ok: true, reason: "rate_limited" as const };
  }

  const forceHandoff = shouldHandoff(inbound.text);
  const [history, faqs] = await Promise.all([
    recentMessages(supabase, conversation.id, 10),
    activeFaqs(supabase),
  ]);

  const llm = await generateSmsReply({
    inboundText: inbound.text,
    history,
    faqs,
    forceHandoff,
  });

  const replyText = llm.needsHuman || forceHandoff ? HANDOFF_REPLY : llm.reply;

  const patch: Parameters<typeof updateConversation>[2] = {};
  if (llm.extractedName && !conversation.name) patch.name = llm.extractedName;
  if (llm.leadSummary) patch.summary = llm.leadSummary;
  if (llm.needsHuman || forceHandoff) {
    patch.status = "needs_human";
    patch.bot_paused = true;
  }
  if (Object.keys(patch).length) {
    await updateConversation(supabase, conversation.id, patch);
  }

  await replyAndStore({
    phone,
    conversationId: conversation.id,
    text: replyText,
  });

  const refreshed = {
    ...conversation,
    ...patch,
    summary: patch.summary ?? conversation.summary,
  };

  if (isNewLead) {
    await notifyOwnerOfSmsEvent(supabase, refreshed, "new_lead", {
      inboundText: inbound.text,
      summary: refreshed.summary || llm.leadSummary,
    });
  }

  if (llm.needsHuman || forceHandoff) {
    await notifyOwnerOfSmsEvent(supabase, refreshed, "needs_human", {
      inboundText: inbound.text,
      summary: refreshed.summary || llm.leadSummary,
    });
  }

  return { ok: true, reason: "replied" as const };
}

export type { InboundSms };
