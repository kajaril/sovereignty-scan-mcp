import type { ApiKeyRecord } from "@/types";

export function generateKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `ks_free_${hex}`;
}

export async function hashKey(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validateKey(key: string, kv: KVNamespace): Promise<ApiKeyRecord | null> {
  const hash = await hashKey(key);
  return kv.get<ApiKeyRecord>(`apikey:${hash}`, "json");
}
