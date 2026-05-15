import { ProviderCache } from "@/cache";
import { isErrorEnvelope, ProviderDB } from "@/db";
import type { Env } from "@/types";

// Weekly cron: Sunday 00:00 UTC (wrangler.jsonc: "0 0 * * 7").
// Reads all providers from D1, writes per-provider KV keys, category indices,
// all-IDs index, and last_refresh timestamp — decision #5.
// This handler does NOT re-verify provider data. Provider updates follow decision #6
// (committed to seed.ts, reviewed via PR, idempotent reseed).
export async function handleScheduled(env: Env): Promise<void> {
  const db = new ProviderDB(env.SOVEREIGN_DB_FREE);
  const cache = new ProviderCache(env.CACHE_KV);

  const providers = await db.listAll();
  if (isErrorEnvelope(providers)) {
    // diagnostics_channel emission would go here in production observability setup.
    return;
  }

  try {
    const result = await cache.warmAll(providers);
    if (result !== undefined && isErrorEnvelope(result)) {
      // diagnostics_channel emission would go here in production observability setup.
      return;
    }
  } catch {
    // KV write failure — log and exit cleanly; next cron will retry.
    return;
  }
}
