import { ProviderCache } from "@/cache";
import { isErrorEnvelope } from "@/db";
import type { Provider } from "@/types";
import { describe, expect, it } from "vitest";
import { makeTestEnv } from "./helpers";

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "test-provider",
    name: "Test Provider",
    category: "AI",
    description: "A test provider",
    hq_country: "DE",
    data_residency_regions: ["EU"],
    eu_residency_option: true,
    us_cloud_act_subject: false,
    gdpr_dpa_available: true,
    legal_framework: "GDPR",
    last_verified_at: "2026-05-06T00:00:00Z",
    verification_source: "manual",
    notes: null,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    ...overrides,
  };
}

describe("ProviderCache", () => {
  it("getProvider returns null on cache miss", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.getProvider("nonexistent-id");
    expect(result).toBeNull();
  });

  it("putProvider and getProvider round-trip", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const provider = makeProvider();
    await cache.putProvider(provider);

    const result = await cache.getProvider("test-provider");
    expect(result).not.toBeNull();
    expect(isErrorEnvelope(result)).toBe(false);
    if (result !== null && !isErrorEnvelope(result)) {
      expect(result.id).toBe("test-provider");
      expect(result.name).toBe("Test Provider");
      expect(result.eu_residency_option).toBe(true);
      expect(result.us_cloud_act_subject).toBe(false);
      expect(Array.isArray(result.data_residency_regions)).toBe(true);
      expect(result.data_residency_regions).toContain("EU");
    }
  });

  it("getAllIds returns null on cache miss", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.getAllIds();
    expect(result).toBeNull();
  });

  it("putAllIds and getAllIds round-trip", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    await cache.putAllIds(["a", "b", "c"]);
    const result = await cache.getAllIds();
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("getCategoryIds returns null on cache miss", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.getCategoryIds("AI");
    expect(result).toBeNull();
  });

  it("putCategoryIds and getCategoryIds round-trip", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    await cache.putCategoryIds("AI", ["p1", "p2"]);
    const result = await cache.getCategoryIds("AI");
    expect(result).toEqual(["p1", "p2"]);
  });

  it("getLastRefresh returns null on cache miss", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.getLastRefresh();
    expect(result).toBeNull();
  });

  it("putLastRefresh and getLastRefresh round-trip", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const ts = "2026-05-06T00:00:00.000Z";
    await cache.putLastRefresh(ts);
    const result = await cache.getLastRefresh();
    expect(result).toBe(ts);
  });

  it("cacheAgeSeconds returns null when no refresh timestamp", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.cacheAgeSeconds();
    expect(result).toBeNull();
  });

  it("warmAll writes all per-provider keys, category index, all-IDs, and last_refresh", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const providers = [
      makeProvider({ id: "p1", name: "P1", category: "AI" }),
      makeProvider({ id: "p2", name: "P2", category: "Hosting" }),
      makeProvider({ id: "p3", name: "P3", category: "AI" }),
    ];

    const result = await cache.warmAll(providers);
    expect(result).toBeUndefined();

    const allIds = await cache.getAllIds();
    expect(allIds).toHaveLength(3);

    const aiIds = await cache.getCategoryIds("AI");
    expect(aiIds).toHaveLength(2);

    const hostingIds = await cache.getCategoryIds("Hosting");
    expect(hostingIds).toHaveLength(1);

    const lastRefresh = await cache.getLastRefresh();
    expect(lastRefresh).not.toBeNull();

    const p1 = await cache.getProvider("p1");
    expect(isErrorEnvelope(p1)).toBe(false);
    expect(p1).not.toBeNull();
  });

  // Error envelope: warmAll with empty list returns INTERNAL
  it("warmAll with empty list returns INTERNAL error envelope", async () => {
    const env = makeTestEnv();
    const cache = new ProviderCache(env.CACHE_KV);
    const result = await cache.warmAll([]);
    expect(isErrorEnvelope(result)).toBe(true);
    if (isErrorEnvelope(result)) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.retryable).toBe(true);
      expect(result.error).toHaveProperty("message");
      expect(result.error).toHaveProperty("details");
    }
  });
});
