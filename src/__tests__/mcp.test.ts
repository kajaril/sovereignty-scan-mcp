import { describe, expect, it } from "vitest";
import { isErrorEnvelope, ProviderDB } from "@/db";
import {
  getUsCloudActProviders,
  listProviders,
  scanProvider,
  scanStack,
  suggestEuAlternatives,
} from "@/mcp";
import { runSeed } from "@/seed";
import type { Env } from "@/types";
import { makeTestEnv } from "./helpers";

async function seededEnv(): Promise<Env> {
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
  return env;
}

describe("scan_provider", () => {
  it("returns provider data for known name", async () => {
    const env = await seededEnv();
    const result = await scanProvider({ name: "Cloudflare" }, env);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.name).toBe("Cloudflare");
    expect(parsed.hq_country).toBe("US");
    expect(typeof parsed.eu_residency_option).toBe("boolean");
    expect(typeof parsed.us_cloud_act_subject).toBe("boolean");
  });

  // Error envelope: INPUT_INVALID — empty name
  it("returns INPUT_INVALID for empty name", async () => {
    const env = await seededEnv();
    const result = await scanProvider({ name: "" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
    expect(parsed.error.retryable).toBe(false);
  });

  // Error envelope: INPUT_INVALID — wrong type
  it("returns INPUT_INVALID for non-string name", async () => {
    const env = await seededEnv();
    const result = await scanProvider({ name: 42 }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
  });

  // Error envelope: PROVIDER_NOT_FOUND
  it("returns PROVIDER_NOT_FOUND for unknown name", async () => {
    const env = await seededEnv();
    const result = await scanProvider({ name: "__nonexistent__" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("PROVIDER_NOT_FOUND");
    expect(parsed.error.retryable).toBe(false);
  });
});

describe("scan_stack", () => {
  it("returns aggregate summary", async () => {
    const env = await seededEnv();
    const result = await scanStack({ providers: ["Cloudflare", "Neon"] }, env);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.summary.total_queried).toBe(2);
    expect(parsed.summary.found).toBeGreaterThan(0);
    expect(typeof parsed.summary.us_cloud_act_subject_count).toBe("number");
    expect(typeof parsed.summary.eu_residency_option_count).toBe("number");
    expect(Array.isArray(parsed.summary.missing_gdpr_dpa)).toBe(true);
  });

  // Error envelope: INPUT_TOO_LARGE — over 50 providers (decision #2)
  it("returns INPUT_TOO_LARGE for > 50 providers", async () => {
    const env = await seededEnv();
    const providers = Array.from({ length: 51 }, (_, i) => `provider-${i}`);
    const result = await scanStack({ providers }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_TOO_LARGE");
    expect(parsed.error.retryable).toBe(false);
    expect(parsed.error.details.limit).toBe(50);
  });

  // Error envelope: INPUT_INVALID — not an array
  it("returns INPUT_INVALID when providers is not an array", async () => {
    const env = await seededEnv();
    const result = await scanStack({ providers: "not-an-array" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
  });

  it("at exactly 50 providers does not error with INPUT_TOO_LARGE", async () => {
    const env = await seededEnv();
    const providers = Array.from({ length: 50 }, (_, i) => `provider-${i}`);
    const result = await scanStack({ providers }, env);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error?.code).not.toBe("INPUT_TOO_LARGE");
  });
});

describe("list_providers", () => {
  it("returns all providers without category filter", async () => {
    const env = await seededEnv();
    const result = await listProviders({}, env);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.count).toBe(55);
    expect(Array.isArray(parsed.providers)).toBe(true);
  });

  it("filters by category", async () => {
    const env = await seededEnv();
    const result = await listProviders({ category: "AI" }, env);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.category).toBe("AI");
    expect(parsed.count).toBeGreaterThan(0);
    for (const p of parsed.providers) {
      expect(p.category).toBe("AI");
    }
  });

  // Error envelope: INPUT_INVALID — empty category
  it("returns INPUT_INVALID for empty category", async () => {
    const env = await seededEnv();
    const result = await listProviders({ category: "" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
  });
});

describe("get_us_cloud_act_providers", () => {
  it("returns only CLOUD Act providers with note", async () => {
    const env = await seededEnv();
    const result = await getUsCloudActProviders({}, env);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.count).toBeGreaterThan(0);
    for (const p of parsed.us_cloud_act_subject) {
      expect(p.us_cloud_act_subject).toBe(true);
    }
    expect(typeof parsed.note).toBe("string");
  });
});

describe("suggest_eu_alternatives", () => {
  it("returns alternatives for a US-only provider", async () => {
    const env = await seededEnv();
    const result = await suggestEuAlternatives({ provider_name: "Anthropic Direct API" }, env);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.category).toBe("AI");
    expect(Array.isArray(parsed.alternatives)).toBe(true);
  });

  it("caps at 10 results", async () => {
    const env = await seededEnv();
    const result = await suggestEuAlternatives({ provider_name: "Anthropic Direct API" }, env);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.alternatives.length).toBeLessThanOrEqual(10);
  });

  // Error envelope: INPUT_INVALID — empty provider_name
  it("returns INPUT_INVALID for empty name", async () => {
    const env = await seededEnv();
    const result = await suggestEuAlternatives({ provider_name: "" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
    expect(parsed.error.retryable).toBe(false);
  });

  // Error envelope: PROVIDER_NOT_FOUND
  it("returns PROVIDER_NOT_FOUND for unknown name", async () => {
    const env = await seededEnv();
    const result = await suggestEuAlternatives({ provider_name: "__nonexistent__" }, env);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("PROVIDER_NOT_FOUND");
  });

  it("returns note for category with no EU alternatives", async () => {
    const env = await seededEnv();
    const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
    const sandboxProviders = await db.listByCategory("Sandbox");
    expect(isErrorEnvelope(sandboxProviders)).toBe(false);
    if (!isErrorEnvelope(sandboxProviders) && sandboxProviders.length > 0) {
      const first = sandboxProviders[0];
      if (first !== undefined) {
        const result = await suggestEuAlternatives({ provider_name: first.name }, env);
        const parsed = JSON.parse(result.content[0]?.text ?? "{}");
        expect(Array.isArray(parsed.alternatives)).toBe(true);
        if (parsed.alternatives.length === 0) {
          expect(typeof parsed.note).toBe("string");
        }
      }
    }
  });
});
