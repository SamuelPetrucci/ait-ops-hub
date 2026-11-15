const STOP_EXACT = new Set(["STOP", "UNSUBSCRIBE", "OPTOUT", "CANCEL", "END", "QUIT"]);

const HELP_EXACT = new Set(["HELP", "INFO"]);

/** Linq keyword opt-out + clear conversational stop intent. */
export function isOptOutMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (STOP_EXACT.has(trimmed)) return true;
  if (/^opt[\s-]?out$/i.test(trimmed)) return true;
  if (/\b(stop messaging me|don't text me|do not text me|remove me from (this|your) list)\b/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function isHelpMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return HELP_EXACT.has(trimmed.toUpperCase()) || /^help\b/i.test(trimmed);
}

export const OPT_OUT_CONFIRMATION =
  "You've been unsubscribed. Reply any time if you'd like to hear from us again.";

export const HELP_REPLY =
  "AI Transformation LLC — Samuel's assistant. Reply with your question, or STOP to unsubscribe. For Samuel, just say so.";
