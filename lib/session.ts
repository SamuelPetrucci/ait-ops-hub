import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ait_ops";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function accessPassword() {
  return process.env.OPS_PASSWORD?.trim() || "";
}

export function passwordsMatch(input: string) {
  const expected = accessPassword();
  if (!expected || !input) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function sessionToken(now = Date.now()) {
  const password = accessPassword();
  if (!password) throw new Error("Set OPS_PASSWORD on the server.");
  const exp = now + SESSION_MS;
  const payload = `v1.${exp}`;
  const sig = createHmac("sha256", password).update(payload).digest("base64url");
  return {
    token: `${payload}.${sig}`,
    maxAge: Math.floor(SESSION_MS / 1000),
  };
}

export function sessionValid(token: string | undefined, now = Date.now()) {
  const password = accessPassword();
  if (!token || !password) return false;
  const match = /^v1\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return false;
  const exp = Number(match[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = createHmac("sha256", password).update(`v1.${match[1]}`).digest("base64url");
  const actual = Buffer.from(match[2]);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
