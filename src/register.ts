import type { Context } from "hono";
import { generateKey, hashKey } from "@/auth";
import type { ApiKeyRecord, Env } from "@/types";
import { makeError } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleRegister(c: Context<{ Bindings: Env }>): Promise<Response> {
  let body: { email?: unknown };
  try {
    body = await c.req.json<{ email?: unknown }>();
  } catch {
    return c.json(makeError("INPUT_INVALID", "Request body must be valid JSON"), 400);
  }

  const { email } = body;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return c.json(makeError("INPUT_INVALID", "A valid email address is required"), 400);
  }

  const normalised = email.toLowerCase();
  const emailHash = await hashKey(normalised);
  const existing = await c.env.KEYS_KV.get(`regemail:${emailHash}`);
  if (existing !== null) {
    return c.json(makeError("INPUT_INVALID", "This email is already registered"), 409);
  }

  const key = generateKey();
  const keyHash = await hashKey(key);
  const now = new Date().toISOString();
  const record: ApiKeyRecord = { email: normalised, plan: "free", created_at: now };

  await Promise.all([
    c.env.KEYS_KV.put(`apikey:${keyHash}`, JSON.stringify(record)),
    c.env.KEYS_KV.put(`regemail:${emailHash}`, JSON.stringify({ created_at: now })),
  ]);

  return c.json({
    api_key: key,
    plan: "free",
    message: "Save this key — it cannot be recovered.",
  });
}
