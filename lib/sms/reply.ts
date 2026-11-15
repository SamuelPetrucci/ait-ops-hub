import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import type { SmsMessage } from "./store";

const ReplySchema = z.object({
  reply: z.string().max(300),
  needsHuman: z.boolean(),
  extractedName: z.string().nullable(),
  leadSummary: z.string().nullable(),
});

export type SmsLlmResult = z.infer<typeof ReplySchema>;

function smsModel() {
  return process.env.SMS_ASSISTANT_MODEL || "openai/gpt-4o-mini";
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function clampSms(text: string, max = 300) {
  const clean = stripMarkdown(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export async function generateSmsReply(input: {
  inboundText: string;
  history: SmsMessage[];
  faqs: { question: string; answer: string }[];
  forceHandoff: boolean;
}): Promise<SmsLlmResult> {
  if (input.forceHandoff) {
    return {
      reply: "Let me grab Samuel, he'll text you shortly",
      needsHuman: true,
      extractedName: null,
      leadSummary: null,
    };
  }

  const faqBlock = input.faqs
    .map((faq, index) => `${index + 1}. Q: ${faq.question}\nA: ${faq.answer}`)
    .join("\n\n");

  const historyBlock = input.history
    .map((msg) => `${msg.direction === "inbound" ? "Lead" : "Assistant"}: ${msg.body}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: smsModel(),
      schema: ReplySchema,
      system: `You are Samuel's assistant at AI Transformation LLC, texting over SMS/iMessage.

Voice: warm, human, casual. Use contractions. 1–2 short sentences. Under 300 characters. No corporate speak. No emoji spam (at most one if it truly fits). No markdown, bullets, or links unless the person asks for a booking link.

Facts you may use (never invent prices, timelines, guarantees, or promises outside this list):
${faqBlock || "(no FAQs loaded — stay high-level and offer to connect Samuel)"}

Pricing questions: say it depends on scope, you're happy to get a quick quote, and offer to book a short call with Samuel.

If they ask whether this is a bot/AI: answer honestly — you're an AI assistant working for Samuel at AI Transformation.

Set needsHuman=true when: they ask for Samuel, sound angry/frustrated, want to buy/book/hire, or you are unsure.

When needsHuman is true, reply exactly: Let me grab Samuel, he'll text you shortly

Otherwise answer helpfully from the FAQs. Capture a short leadSummary when you learn what they need. Extract a first name only if clearly given.`,
      prompt: `Recent thread:\n${historyBlock || "(new conversation)"}\n\nLatest inbound:\n${input.inboundText}`,
      temperature: 0.4,
      maxOutputTokens: 200,
    });

    return {
      reply: clampSms(object.reply),
      needsHuman: object.needsHuman,
      extractedName: object.extractedName?.trim() || null,
      leadSummary: object.leadSummary?.trim() || null,
    };
  } catch (error) {
    console.error("[sms] LLM reply failed", error);
    return {
      reply: "Let me grab Samuel, he'll text you shortly",
      needsHuman: true,
      extractedName: null,
      leadSummary: "Model uncertain or failed — needs human follow-up.",
    };
  }
}
