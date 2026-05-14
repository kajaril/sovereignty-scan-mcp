import { ProviderDB, isErrorEnvelope } from "@/db";
import { runSeed } from "@/seed";
import { describe, expect, it } from "vitest";
import { makeTestEnv } from "./helpers";

async function freshDb(): Promise<ProviderDB> {
  const env = makeTestEnv();
  await env.SOVEREIGN_DB_FREE.exec(
    `CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      description TEXT NOT NULL, hq_country TEXT NOT NULL,
      data_residency_regions TEXT NOT NULL, eu_residency_option INTEGER NOT NULL DEFAULT 0,
      us_cloud_act_subject INTEGER NOT NULL DEFAULT 0, gdpr_dpa_available INTEGER NOT NULL DEFAULT 0,
      legal_framework TEXT, last_verified_at TEXT NOT NULL, verification_source TEXT NOT NULL,
      notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  );
  await runSeed(env.SOVEREIGN_DB_FREE);
  return new ProviderDB(env.SOVEREIGN_DB_FREE);
}

describe("ProviderDB", () => {
  it("getByName returns a provider for a known name", async () => {
    const db = await freshDb();
    const result = await db.getByName("Cloudflare");
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      expect(result.name).toBe("Cloudflare");
      expect(result.hq_country).toBe("US");
      expect(Array.isArray(result.data_residency_regions)).toBe(true);
    }
  });

  it("getByName is case-insensitive", async () => {
    const db = await freshDb();
    const result = await db.getByName("cloudflare");
    expect(isErrorEnvelope(result)).toBe(false);
  });

  // Error envelope: PROVIDER_NOT_FOUND
  it("getByName returns PROVIDER_NOT_FOUND for unknown name", async () => {
    const db = await freshDb();
    const result = await db.getByName("__nonexistent__");
    expect(isErrorEnvelope(result)).toBe(true);
    if (isErrorEnvelope(result)) {
      expect(result.error.code).toBe("PROVIDER_NOT_FOUND");
      expect(result.error.retryable).toBe(false);
      expect(result.error).toHaveProperty("message");
      expect(result.error).toHaveProperty("details");
    }
  });

  it("listAll returns all 55 providers", async () => {
    const db = await freshDb();
    const result = await db.listAll();
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      expect(result.length).toBe(55);
    }
  });

  it("listByCategory returns only AI providers", async () => {
    const db = await freshDb();
    const result = await db.listByCategory("AI");
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      expect(result.length).toBeGreaterThan(0);
      for (const p of result) {
        expect(p.category).toBe("AI");
      }
    }
  });

  it("listCloudActSubjects returns only CLOUD Act providers", async () => {
    const db = await freshDb();
    const result = await db.listCloudActSubjects();
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      expect(result.length).toBeGreaterThan(0);
      for (const p of result) {
        expect(p.us_cloud_act_subject).toBe(true);
      }
    }
  });

  it("countAll returns 55", async () => {
    const db = await freshDb();
    const result = await db.countAll();
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      expect(result).toBe(55);
    }
  });

  it("3 Anthropic inference paths seeded as separate records", async () => {
    const db = await freshDb();
    const all = await db.listByCategory("AI");
    expect(isErrorEnvelope(all)).toBe(false);
    if (!isErrorEnvelope(all)) {
      const anthropicRecords = all.filter((p) => p.name.toLowerCase().startsWith("anthropic"));
      expect(anthropicRecords.length).toBe(3);
      for (const p of anthropicRecords) {
        expect(p.us_cloud_act_subject).toBe(true);
      }
      const direct = anthropicRecords.find((p) => p.id === "anthropic-direct");
      const bedrock = anthropicRecords.find((p) => p.id === "anthropic-bedrock-eu");
      const vertex = anthropicRecords.find((p) => p.id === "anthropic-vertex-eu");
      expect(direct?.eu_residency_option).toBe(false);
      expect(bedrock?.eu_residency_option).toBe(true);
      expect(vertex?.eu_residency_option).toBe(true);
    }
  });

  it("listEuAlternatives excludes input provider", async () => {
    const db = await freshDb();
    const result = await db.listEuAlternatives("AI", "anthropic-direct");
    expect(isErrorEnvelope(result)).toBe(false);
    if (!isErrorEnvelope(result)) {
      const ids = result.map((p) => p.id);
      expect(ids).not.toContain("anthropic-direct");
    }
  });

  it("isErrorEnvelope correctly identifies error vs provider", async () => {
    const db = await freshDb();
    const provider = await db.getByName("Cloudflare");
    const error = await db.getByName("__nonexistent__");
    expect(isErrorEnvelope(provider)).toBe(false);
    expect(isErrorEnvelope(error)).toBe(true);
  });
});
