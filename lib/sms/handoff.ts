const HANDOFF_PATTERNS = [
  /\bsamuel\b/i,
  /\b(talk|speak|connect|get)\s+(to|with)\s+(a\s+)?(human|person|someone|samuel)\b/i,
  /\b(real person|human please|live person)\b/i,
  /\b(book|schedule|set up)\b.*\b(call|meeting|consult|demo)\b/i,
  /\b(buy|purchase|sign up|get started|hire you|ready to (go|start|move))\b/i,
  /\b(quote|proposal|contract|invoice)\b/i,
  /\b(angry|furious|upset|frustrated|ridiculous|scam|lawsuit|lawyer)\b/i,
];

export function shouldHandoff(text: string) {
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(text));
}

export const HANDOFF_REPLY = "Let me grab Samuel, he'll text you shortly";
