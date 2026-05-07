import { hydrateProvider, makeError } from "@/types";
import type { ErrorEnvelope, Provider, ProviderRow } from "@/types";

// KV cache key strategy — decision #5.
// Per-provider keys only. No snapshot-blob pattern.
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function providerKey(id: string): string {
  return `provider:${id}`;
}

function categoryKey(category: string): string {
  return `category:${category}:ids`;
}

const ALL_IDS_KEY = "all:provider_ids";
const META_LAST_REFRESH_KEY = "meta:last_refresh";

export class ProviderCache {
  constructor(private readonly kv: KVNamespace) {}

  async getProvider(id: string): Promise<Provider | null | ErrorEnvelope> {
    try {
      const raw = await this.kv.get(providerKey(id), "json");
      if (raw === null) return null;
      const row = raw as ProviderRow;
      return hydrateProvider(row);
    } catch {
      return makeError("CACHE_MISS", "KV read failed", { key: providerKey(id) });
    }
  }

  async putProvider(provider: Provider): Promise<void> {
    // Store as ProviderRow (SQLite integers for booleans, JSON string for array).
    const row: ProviderRow = {
      ...provider,
      data_residency_regions: JSON.stringify(provider.data_residency_regions),
      eu_residency_option: provider.eu_residency_option ? 1 : 0,
      us_cloud_act_subject: provider.us_cloud_act_subject ? 1 : 0,
      gdpr_dpa_available: provider.gdpr_dpa_available ? 1 : 0,
    };
    await this.kv.put(providerKey(provider.id), JSON.stringify(row), {
      expirationTtl: TTL_SECONDS,
    });
  }

  async getAllIds(): Promise<string[] | null> {
    const raw = await this.kv.get(ALL_IDS_KEY, "json");
    if (raw === null) return null;
    return raw as string[];
  }

  async putAllIds(ids: string[]): Promise<void> {
    await this.kv.put(ALL_IDS_KEY, JSON.stringify(ids), {
      expirationTtl: TTL_SECONDS,
    });
  }

  async getCategoryIds(category: string): Promise<string[] | null> {
    const raw = await this.kv.get(categoryKey(category), "json");
    if (raw === null) return null;
    return raw as string[];
  }

  async putCategoryIds(category: string, ids: string[]): Promise<void> {
    await this.kv.put(categoryKey(category), JSON.stringify(ids), {
      expirationTtl: TTL_SECONDS,
    });
  }

  async getLastRefresh(): Promise<string | null> {
    return this.kv.get(META_LAST_REFRESH_KEY);
  }

  async putLastRefresh(iso: string): Promise<void> {
    // No TTL — overwritten by cron; stale value is the detection signal for /health.
    await this.kv.put(META_LAST_REFRESH_KEY, iso);
  }

  // Warm full cache from a provider list. Called by the cron handler.
  // Writes per-provider keys, category indices, all-IDs index, and meta timestamp
  // in a single batched Promise.all per decision #5.
  async warmAll(providers: Provider[]): Promise<undefined | ErrorEnvelope> {
    if (providers.length === 0) {
      return makeError("INTERNAL", "warmAll called with empty provider list");
    }

    const allIds = providers.map((p) => p.id);

    const categoryMap = new Map<string, string[]>();
    for (const p of providers) {
      const existing = categoryMap.get(p.category) ?? [];
      existing.push(p.id);
      categoryMap.set(p.category, existing);
    }

    const writes: Promise<void>[] = [
      ...providers.map((p) => this.putProvider(p)),
      this.putAllIds(allIds),
      ...[...categoryMap.entries()].map(([cat, ids]) => this.putCategoryIds(cat, ids)),
      this.putLastRefresh(new Date().toISOString()),
    ];

    await Promise.all(writes);
  }

  async cacheAgeSeconds(): Promise<number | null> {
    const ts = await this.getLastRefresh();
    if (ts === null) return null;
    const refreshed = Date.parse(ts);
    if (Number.isNaN(refreshed)) return null;
    return Math.floor((Date.now() - refreshed) / 1000);
  }
}
