import { ProviderCache } from "@/cache";
import { isErrorEnvelope, ProviderDB } from "@/db";
import type { Env, ErrorEnvelope, MCPToolResponse, Provider } from "@/types";
import { makeError } from "@/types";

// EU/EEA/UK/CH country codes used in suggest_eu_alternatives (decision #3).
const EU_EEA_UK_CH = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK", // EU member states
  "IS",
  "LI",
  "NO", // EEA
  "GB", // UK
  "CH", // Switzerland
]);

function text(content: unknown): MCPToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
  };
}

function errorResponse(envelope: ErrorEnvelope): MCPToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }], isError: true };
}

async function resolveProvider(
  name: string,
  db: ProviderDB,
  cache: ProviderCache,
): Promise<Provider | ErrorEnvelope> {
  // Try KV cache first; fall back to D1.
  const allIds = await cache.getAllIds();
  if (allIds !== null) {
    // Linear scan to find id by name — cache stores per-provider records keyed by id.
    // For 35 providers this is fine; replace with a name→id index if catalog grows significantly.
    for (const id of allIds) {
      const cached = await cache.getProvider(id);
      if (isErrorEnvelope(cached)) continue; // cache miss on individual key — fall through to D1
      if (cached !== null && cached.name.toLowerCase() === name.toLowerCase()) {
        return cached;
      }
    }
  }
  return db.getByName(name);
}

// Tool: scan_provider
// Returns the full jurisdictional profile for one provider.
export async function scanProvider(
  args: Record<string, unknown>,
  env: Env,
): Promise<MCPToolResponse> {
  const name = args.name;
  if (typeof name !== "string" || name.trim() === "") {
    return errorResponse(makeError("INPUT_INVALID", "name must be a non-empty string"));
  }

  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(env.CACHE_KV);
  const result = await resolveProvider(name.trim(), db, cache);

  if (isErrorEnvelope(result)) return errorResponse(result);
  return text(result);
}

// Tool: scan_stack
// Aggregate jurisdictional summary for a stack of providers.
// Hard cap of 50 providers per call — decision #2.
export async function scanStack(args: Record<string, unknown>, env: Env): Promise<MCPToolResponse> {
  const providers = args.providers;
  if (!Array.isArray(providers)) {
    return errorResponse(makeError("INPUT_INVALID", "providers must be an array of strings"));
  }
  if (providers.length > 50) {
    return errorResponse(
      makeError("INPUT_TOO_LARGE", "scan_stack accepts up to 50 providers per call", {
        limit: 50,
      }),
    );
  }
  if (providers.some((p) => typeof p !== "string")) {
    return errorResponse(makeError("INPUT_INVALID", "each provider must be a string"));
  }

  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(env.CACHE_KV);

  const results = await Promise.all(
    (providers as string[]).map((name) => resolveProvider(name, db, cache)),
  );

  const found: Provider[] = [];
  const notFound: string[] = [];
  const errors: ErrorEnvelope[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r === undefined) continue;
    if (isErrorEnvelope(r)) {
      if (r.error.code === "PROVIDER_NOT_FOUND") {
        notFound.push((providers as string[])[i] ?? "");
      } else {
        errors.push(r);
      }
    } else {
      found.push(r);
    }
  }

  const cloudActCount = found.filter((p) => p.us_cloud_act_subject).length;
  const euResidencyCount = found.filter((p) => p.eu_residency_option).length;
  const missingDpa = found.filter((p) => !p.gdpr_dpa_available).map((p) => p.name);

  return text({
    summary: {
      total_queried: providers.length,
      found: found.length,
      not_found: notFound,
      us_cloud_act_subject_count: cloudActCount,
      eu_residency_option_count: euResidencyCount,
      missing_gdpr_dpa: missingDpa,
    },
    providers: found,
    ...(errors.length > 0 && { partial_errors: errors }),
  });
}

// Tool: list_providers
// List all providers with optional category filter.
export async function listProviders(
  args: Record<string, unknown>,
  env: Env,
): Promise<MCPToolResponse> {
  const category = args.category;
  if (category !== undefined && (typeof category !== "string" || category.trim() === "")) {
    return errorResponse(makeError("INPUT_INVALID", "category must be a non-empty string"));
  }

  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(env.CACHE_KV);

  if (category !== undefined) {
    const cat = (category as string).trim();
    // Try category index from KV first.
    const ids = await cache.getCategoryIds(cat);
    if (ids !== null) {
      const providers = await Promise.all(ids.map((id) => cache.getProvider(id)));
      const hydrated = providers.filter((p): p is Provider => p !== null && !isErrorEnvelope(p));
      if (hydrated.length === ids.length) {
        return text({ category: cat, providers: hydrated, count: hydrated.length });
      }
    }
    // KV miss or partial — fall back to D1.
    const result = await db.listByCategory(cat);
    if (isErrorEnvelope(result)) return errorResponse(result);
    return text({ category: cat, providers: result, count: result.length });
  }

  // No category — return all.
  const allIds = await cache.getAllIds();
  if (allIds !== null) {
    const providers = await Promise.all(allIds.map((id) => cache.getProvider(id)));
    const hydrated = providers.filter((p): p is Provider => p !== null && !isErrorEnvelope(p));
    if (hydrated.length === allIds.length) {
      return text({ providers: hydrated, count: hydrated.length });
    }
  }

  const result = await db.listAll();
  if (isErrorEnvelope(result)) return errorResponse(result);
  return text({ providers: result, count: result.length });
}

// Tool: get_us_cloud_act_providers
// Returns all providers subject to US CLOUD Act.
export async function getUsCloudActProviders(
  _args: Record<string, unknown>,
  env: Env,
): Promise<MCPToolResponse> {
  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const result = await db.listCloudActSubjects();
  if (isErrorEnvelope(result)) return errorResponse(result);
  return text({
    us_cloud_act_subject: result,
    count: result.length,
    note: "These providers are incorporated or operate under US jurisdiction and are subject to compelled disclosure under the CLOUD Act (18 U.S.C. § 2713).",
  });
}

// Tool: suggest_eu_alternatives
// Deterministic EU-compliant alternatives in same category — decision #3.
export async function suggestEuAlternatives(
  args: Record<string, unknown>,
  env: Env,
): Promise<MCPToolResponse> {
  const providerName = args.provider_name;
  if (typeof providerName !== "string" || providerName.trim() === "") {
    return errorResponse(makeError("INPUT_INVALID", "provider_name must be a non-empty string"));
  }

  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(env.CACHE_KV);

  const input = await resolveProvider(providerName.trim(), db, cache);
  if (isErrorEnvelope(input)) return errorResponse(input);

  const alternatives = await db.listEuAlternatives(input.category, input.id);
  if (isErrorEnvelope(alternatives)) return errorResponse(alternatives);

  // Decision #3 step 3: cap at 10.
  const truncated = alternatives.length > 10;
  const capped = alternatives.slice(0, 10);

  if (capped.length === 0) {
    return text({
      provider: input.name,
      category: input.category,
      alternatives: [],
      note: `No EU-based alternatives in category ${input.category} are tracked. Submit a provider suggestion at kajaril.com/sovereignty-scan/ or email studio@kajaril.com.`,
    });
  }

  // Decision #3 step 2: EU/EEA first, then UK/CH, alphabetical within tier.
  const euEea = capped.filter(
    (p) => EU_EEA_UK_CH.has(p.hq_country) && p.hq_country !== "GB" && p.hq_country !== "CH",
  );
  const ukCh = capped.filter((p) => p.hq_country === "GB" || p.hq_country === "CH");
  const ordered = [...euEea, ...ukCh];

  return text({
    provider: input.name,
    category: input.category,
    alternatives: ordered,
    count: ordered.length,
    ...(truncated && { truncated: true }),
  });
}

// MCP tool dispatch table.
export const MCP_TOOLS: Record<
  string,
  (args: Record<string, unknown>, env: Env) => Promise<MCPToolResponse>
> = {
  scan_provider: scanProvider,
  scan_stack: scanStack,
  list_providers: listProviders,
  get_us_cloud_act_providers: getUsCloudActProviders,
  suggest_eu_alternatives: suggestEuAlternatives,
};

// MCP tool schema definitions (protocol version 2024-11-05).
export const MCP_TOOL_DEFINITIONS = [
  {
    name: "scan_provider",
    description:
      "Returns the full jurisdictional profile for a single vendor: headquarters country, data residency regions, EU residency option, US CLOUD Act exposure, GDPR DPA availability, and legal framework.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Provider name (case-insensitive)" },
      },
      required: ["name"],
    },
  },
  {
    name: "scan_stack",
    description:
      "Aggregate jurisdictional summary for a stack of providers: CLOUD Act exposure count, EU residency coverage, and missing DPAs. Maximum 50 providers per call.",
    inputSchema: {
      type: "object",
      properties: {
        providers: {
          type: "array",
          items: { type: "string" },
          maxItems: 50,
          description: "Provider names to scan (maximum 50)",
        },
      },
      required: ["providers"],
    },
  },
  {
    name: "list_providers",
    description: "List all tracked providers, with optional category filter.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Filter by category: AI, Hosting, Database, Auth, Analytics, Observability, CI/CD, Communications, Payments, Search, Sandbox, Cache",
        },
      },
    },
  },
  {
    name: "get_us_cloud_act_providers",
    description:
      "Returns all providers subject to US CLOUD Act compelled disclosure (18 U.S.C. § 2713).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "suggest_eu_alternatives",
    description:
      "Returns EU/EEA/UK/CH-based alternatives in the same category as the given provider. Alternatives have eu_residency_option=true and headquarters in an EU member state, EEA country, UK, or Switzerland. Capped at 10.",
    inputSchema: {
      type: "object",
      properties: {
        provider_name: { type: "string", description: "Provider to find alternatives for" },
      },
      required: ["provider_name"],
    },
  },
];
