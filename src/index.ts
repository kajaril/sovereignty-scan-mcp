import { ProviderCache } from "@/cache";
import { ProviderDB, isErrorEnvelope } from "@/db";
import { MCP_TOOLS, MCP_TOOL_DEFINITIONS } from "@/mcp";
import { handleScheduled } from "@/scheduler";
import { makeError } from "@/types";
import type { Env, HealthPayload, MCPRequest } from "@/types";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

// CORS open on /mcp and /health — rate limits cap abuse. Operational default.
app.use("*", cors({ origin: "*" }));

// /health — structured payload doubles as a freshness credential for DPO buyers.
// schema_version tracks the D1 migration version, not the package version.
// Mounted at both /health and /sovereignty-scan/health (no redirect — same response, stable URL).
async function handleHealth(c: Context<{ Bindings: Env }>) {
  const db = new ProviderDB(c.env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(c.env.CACHE_KV);

  const [providerCountResult, lastRefresh] = await Promise.all([
    db.countAll(),
    cache.getLastRefresh(),
  ]);

  const providerCount = isErrorEnvelope(providerCountResult) ? 0 : providerCountResult;

  const anthropicCount = isErrorEnvelope(providerCountResult)
    ? 0
    : await db
        .listByCategory("AI")
        .then((r) =>
          isErrorEnvelope(r)
            ? 0
            : r.filter((p) => p.name.toLowerCase().startsWith("anthropic")).length,
        );

  const cacheAge =
    lastRefresh === null ? null : Math.floor((Date.now() - Date.parse(lastRefresh)) / 1000);

  const status = isErrorEnvelope(providerCountResult) ? "degraded" : "ok";

  const payload: HealthPayload = {
    status,
    provider_count: providerCount,
    anthropic_path_count: anthropicCount,
    last_kv_refresh: lastRefresh,
    cache_age_seconds: cacheAge,
    schema_version: "0001",
  };

  return c.json(payload, status === "ok" ? 200 : 503);
}

app.get("/health", handleHealth);
app.get("/sovereignty-scan/health", handleHealth);

// /sovereignty-scan/mcp — MCP JSON-RPC endpoint (protocol version 2024-11-05).
app.post("/sovereignty-scan/mcp", async (c) => {
  // Rate limiting — decision #13: 100 req/day/IP, 5 req/sec burst.
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  const [daily, burst] = await Promise.all([
    c.env.RATE_LIMITER.limit({ key: ip }),
    c.env.BURST_LIMITER.limit({ key: ip }),
  ]);

  if (!daily.success || !burst.success) {
    return c.json(
      makeError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Retry after 1 second."),
      429,
    );
  }

  let body: MCPRequest;
  try {
    body = await c.req.json<MCPRequest>();
  } catch {
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      400,
    );
  }

  if (body.jsonrpc !== "2.0") {
    return c.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32600, message: "Invalid Request" },
      },
      400,
    );
  }

  // MCP protocol: initialize
  if (body.method === "initialize") {
    return c.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "sovereignty-scan-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    });
  }

  // MCP protocol: tools/list
  if (body.method === "tools/list") {
    return c.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { tools: MCP_TOOL_DEFINITIONS },
    });
  }

  // MCP protocol: tools/call
  if (body.method === "tools/call") {
    const params = body.params as
      | { name?: string; arguments?: Record<string, unknown> }
      | undefined;
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};

    if (typeof toolName !== "string") {
      return c.json(makeError("INPUT_INVALID", "tools/call requires params.name"), 400);
    }

    const handler = MCP_TOOLS[toolName];
    if (handler === undefined) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        },
        404,
      );
    }

    try {
      const result = await handler(toolArgs, c.env);
      return c.json({ jsonrpc: "2.0", id: body.id, result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unhandled error";
      return c.json({ jsonrpc: "2.0", id: body.id, result: makeError("INTERNAL", msg) }, 500);
    }
  }

  return c.json(
    {
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    },
    404,
  );
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleScheduled(env);
  },
};
