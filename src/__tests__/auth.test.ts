import { describe, expect, it } from "vitest";
import { generateKey, hashKey, validateKey } from "@/auth";
import type { ApiKeyRecord } from "@/types";
import { makeTestEnv } from "./helpers";

describe("generateKey", () => {
  it("starts with ks_free_", () => {
    expect(generateKey()).toMatch(/^ks_free_/);
  });

  it("has total length 40", () => {
    // "ks_free_" (8 chars) + 32 hex chars
    expect(generateKey()).toHaveLength(40);
  });

  it("generates unique keys", () => {
    expect(generateKey()).not.toBe(generateKey());
  });
});

describe("hashKey", () => {
  it("returns 64-char lowercase hex", async () => {
    const h = await hashKey("test-input");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", async () => {
    expect(await hashKey("same-input")).toBe(await hashKey("same-input"));
  });

  it("different inputs produce different hashes", async () => {
    expect(await hashKey("input-a")).not.toBe(await hashKey("input-b"));
  });
});

describe("validateKey", () => {
  it("returns record when key exists in KV", async () => {
    const env = makeTestEnv();
    const key = generateKey();
    const hash = await hashKey(key);
    const record: ApiKeyRecord = {
      email: "user@example.com",
      plan: "free",
      created_at: "2026-05-18T00:00:00.000Z",
    };
    await env.KEYS_KV.put(`apikey:${hash}`, JSON.stringify(record));
    const result = await validateKey(key, env.KEYS_KV);
    expect(result).toEqual(record);
  });

  it("returns null when key does not exist", async () => {
    const env = makeTestEnv();
    const result = await validateKey("ks_free_doesnotexist00000000000000", env.KEYS_KV);
    expect(result).toBeNull();
  });
});
