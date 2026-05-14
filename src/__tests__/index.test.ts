import app from "@/index";
import { runSeed } from "@/seed";
import type { Env, HealthPayload } from "@/types";
import { describe, expect, it } from "vitest";
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

// index.ts exports a { fetch, scheduled } object — use fetch directly.
// Hono's app.fetch signature is (Request, Env, ExecutionContext) => Response.
const ctx = {} as ExecutionContext;

describe("/health endpoint", () => {
  // Error envelope shape: structured payload with schema_version 0001
  it("returns structured payload with schema_version 0001", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/health");
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthPayload;
    expect(body.schema_version).toBe("0001");
    expect(body.status).toBe("ok");
    expect(body.provider_count).toBe(55);
    expect(body.anthropic_path_count).toBe(3);
  });

  it("returns all required fields", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/health");
    const res = await app.fetch(req, env, ctx);
    const body = (await res.json()) as HealthPayload;
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("provider_count");
    expect(body).toHaveProperty("anthropic_path_count");
    expect(body).toHaveProperty("last_kv_refresh");
    expect(body).toHaveProperty("cache_age_seconds");
    expect(body).toHaveProperty("schema_version");
    expect(["ok", "degraded"]).toContain(body.status);
  });

  it("has Access-Control-Allow-Origin: * header", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/health");
    const res = await app.fetch(req, env, ctx);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("/mcp endpoint", () => {
  it("initialize returns protocol version 2024-11-05", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result?: { protocolVersion?: string } };
    expect(body.result?.protocolVersion).toBe("2024-11-05");
  });

  it("tools/list returns 5 tools", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result?: { tools?: unknown[] } };
    expect(Array.isArray(body.result?.tools)).toBe(true);
    expect(body.result?.tools?.length).toBe(5);
  });

  it("tools/call scan_provider returns provider data", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "scan_provider", arguments: { name: "Cloudflare" } },
      }),
    });
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result?: { content?: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result?.content?.[0]?.text ?? "{}");
    expect(parsed.name).toBe("Cloudflare");
  });

  // Error envelope via HTTP: INPUT_INVALID
  it("tools/call with empty name returns INPUT_INVALID in result", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "scan_provider", arguments: { name: "" } },
      }),
    });
    const res = await app.fetch(req, env, ctx);
    const body = (await res.json()) as {
      result?: { content?: Array<{ text: string }>; isError?: boolean };
    };
    expect(body.result?.isError).toBe(true);
    const parsed = JSON.parse(body.result?.content?.[0]?.text ?? "{}");
    expect(parsed.error.code).toBe("INPUT_INVALID");
    expect(parsed.error.retryable).toBe(false);
    expect(parsed.error).toHaveProperty("message");
    expect(parsed.error).toHaveProperty("details");
  });

  // Error envelope: bad JSON → JSON-RPC parse error
  it("invalid JSON body returns HTTP 400 with parse error code -32700", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: "not-json{{{",
    });
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error?.code).toBe(-32700);
  });

  // Error envelope: unknown tool → method not found
  it("unknown tool returns HTTP 404", async () => {
    const env = await seededEnv();
    const req = new Request("https://test.example/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "nonexistent_tool", arguments: {} },
      }),
    });
    const res = await app.fetch(req, env, ctx);
    expect(res.status).toBe(404);
  });
});
