// Error codes locked at v0.1.0 — decision #4.
// Adding a new code requires updating this union AND bumping the contract.
export type ErrorCode =
  | "INPUT_TOO_LARGE"
  | "INPUT_INVALID"
  | "PROVIDER_NOT_FOUND"
  | "CACHE_MISS"
  | "DB_UNAVAILABLE"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL";

export interface MCPError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: MCPError;
}

export function makeError(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): ErrorEnvelope {
  const retryable =
    code === "DB_UNAVAILABLE" || code === "RATE_LIMIT_EXCEEDED" || code === "INTERNAL";
  return { error: { code, message, retryable, details } };
}

// Raw D1 row — SQLite stores booleans as 0/1 and arrays as JSON TEXT.
export interface ProviderRow {
  id: string;
  name: string;
  category: string;
  description: string;
  hq_country: string;
  data_residency_regions: string; // JSON TEXT e.g. '["EU","US"]'
  eu_residency_option: 0 | 1;
  us_cloud_act_subject: 0 | 1;
  gdpr_dpa_available: 0 | 1;
  legal_framework: string | null;
  last_verified_at: string;
  verification_source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Hydrated provider with parsed booleans and arrays.
export interface Provider {
  id: string;
  name: string;
  category: string;
  description: string;
  hq_country: string;
  data_residency_regions: string[];
  eu_residency_option: boolean;
  us_cloud_act_subject: boolean;
  gdpr_dpa_available: boolean;
  legal_framework: string | null;
  last_verified_at: string;
  verification_source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function hydrateProvider(row: ProviderRow): Provider {
  return {
    ...row,
    data_residency_regions: JSON.parse(row.data_residency_regions) as string[],
    eu_residency_option: row.eu_residency_option === 1,
    us_cloud_act_subject: row.us_cloud_act_subject === 1,
    gdpr_dpa_available: row.gdpr_dpa_available === 1,
  };
}

// CF Workers environment bindings for the free-tier worker.
// SOVEREIGN_DB_FREE only — no binding to sovereignty_db_paid (decision #1).
export interface Env {
  SOVEREIGN_DB_FREE: D1Database;
  CACHE_KV: KVNamespace;
  RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  BURST_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

// /health response shape. schema_version tracks the D1 migration version.
export interface HealthPayload {
  status: "ok" | "degraded";
  provider_count: number;
  anthropic_path_count: number;
  last_kv_refresh: string | null;
  cache_age_seconds: number | null;
  schema_version: "0001";
}

// MCP JSON-RPC wire types (protocol version 2024-11-05).
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface MCPToolContent {
  type: "text";
  text: string;
}

export interface MCPToolResponse {
  content: MCPToolContent[];
  isError?: boolean;
}

// Result type for internal tool handlers — either success data or error envelope.
export type ToolResult<T> = { ok: true; data: T } | { ok: false; envelope: ErrorEnvelope };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function err<T>(envelope: ErrorEnvelope): ToolResult<T> {
  return { ok: false, envelope };
}
