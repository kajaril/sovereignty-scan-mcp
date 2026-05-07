import { hydrateProvider, makeError } from "@/types";
import type { ErrorEnvelope, Provider, ProviderRow } from "@/types";

// Free-tier D1 queries only. No binding to sovereignty_db_paid — decision #1.
export class ProviderDB {
  constructor(private readonly db: D1Database) {}

  async getByName(name: string): Promise<Provider | ErrorEnvelope> {
    try {
      const row = await this.db
        .prepare("SELECT * FROM providers WHERE name = ?1 COLLATE NOCASE")
        .bind(name)
        .first<ProviderRow>();
      if (row === null) {
        return makeError("PROVIDER_NOT_FOUND", `No provider found with name "${name}"`);
      }
      return hydrateProvider(row);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "getByName" });
    }
  }

  async getById(id: string): Promise<Provider | ErrorEnvelope> {
    try {
      const row = await this.db
        .prepare("SELECT * FROM providers WHERE id = ?1")
        .bind(id)
        .first<ProviderRow>();
      if (row === null) {
        return makeError("PROVIDER_NOT_FOUND", `No provider found with id "${id}"`);
      }
      return hydrateProvider(row);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "getById" });
    }
  }

  async getManyByIds(ids: string[]): Promise<Provider[] | ErrorEnvelope> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");
    try {
      const result = await this.db
        .prepare(`SELECT * FROM providers WHERE id IN (${placeholders})`)
        .bind(...ids)
        .all<ProviderRow>();
      return result.results.map(hydrateProvider);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "getManyByIds" });
    }
  }

  async listAll(): Promise<Provider[] | ErrorEnvelope> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM providers ORDER BY name ASC")
        .all<ProviderRow>();
      return result.results.map(hydrateProvider);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "listAll" });
    }
  }

  async listByCategory(category: string): Promise<Provider[] | ErrorEnvelope> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM providers WHERE category = ?1 ORDER BY name ASC")
        .bind(category)
        .all<ProviderRow>();
      return result.results.map(hydrateProvider);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "listByCategory" });
    }
  }

  async listCloudActSubjects(): Promise<Provider[] | ErrorEnvelope> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM providers WHERE us_cloud_act_subject = 1 ORDER BY name ASC")
        .all<ProviderRow>();
      return result.results.map(hydrateProvider);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "listCloudActSubjects" });
    }
  }

  // Used by suggest_eu_alternatives — decision #3 deterministic algorithm.
  // Returns EU/EEA/UK/CH providers in same category, excluding the input provider.
  async listEuAlternatives(
    category: string,
    excludeId: string,
  ): Promise<Provider[] | ErrorEnvelope> {
    const euEeaUkCh = [
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
    ];
    const placeholders = euEeaUkCh.map((_, i) => `?${i + 3}`).join(", ");
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM providers
           WHERE category = ?1
             AND eu_residency_option = 1
             AND id != ?2
             AND hq_country IN (${placeholders})
           ORDER BY
             CASE WHEN hq_country IN (
               'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR',
               'GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL',
               'PT','RO','SE','SI','SK','IS','LI','NO'
             ) THEN 0 ELSE 1 END ASC,
             name ASC`,
        )
        .bind(category, excludeId, ...euEeaUkCh)
        .all<ProviderRow>();
      return result.results.map(hydrateProvider);
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "listEuAlternatives" });
    }
  }

  async countAll(): Promise<number | ErrorEnvelope> {
    try {
      const row = await this.db
        .prepare("SELECT COUNT(*) as n FROM providers")
        .first<{ n: number }>();
      return row?.n ?? 0;
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "countAll" });
    }
  }

  async countByCategory(category: string): Promise<number | ErrorEnvelope> {
    try {
      const row = await this.db
        .prepare("SELECT COUNT(*) as n FROM providers WHERE category = ?1")
        .bind(category)
        .first<{ n: number }>();
      return row?.n ?? 0;
    } catch {
      return makeError("DB_UNAVAILABLE", "D1 query failed", { query: "countByCategory" });
    }
  }
}

export function isErrorEnvelope(v: unknown): v is ErrorEnvelope {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    typeof (v as ErrorEnvelope).error === "object"
  );
}
