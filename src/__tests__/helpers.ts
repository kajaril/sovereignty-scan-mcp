// Lightweight test doubles for CF Workers D1 and KV bindings.
// Uses node:sqlite (built-in since Node 22) — no extra dependency.
// These satisfy the structural interface used by ProviderDB and ProviderCache.

import { DatabaseSync } from "node:sqlite";
import type { Env } from "@/types";

// ------------------------------------------------------------------
// D1 mock
// ------------------------------------------------------------------

class MockD1Statement {
  private bindings: unknown[] = [];

  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    bindings: unknown[] = [],
  ) {
    this.bindings = bindings;
  }

  bind(...args: unknown[]): MockD1Statement {
    return new MockD1Statement(this.db, this.sql, args);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.bindings as Parameters<typeof stmt.get>)) as
      | Record<string, unknown>
      | undefined;
    if (row === undefined) return null;
    if (colName !== undefined) return (row[colName] ?? null) as T | null;
    return row as T;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...(this.bindings as Parameters<typeof stmt.all>)) as T[];
    return { results: rows, success: true };
  }

  async run(): Promise<{ success: boolean; results: unknown[] }> {
    const stmt = this.db.prepare(this.sql);
    stmt.run(...(this.bindings as Parameters<typeof stmt.run>));
    return { success: true, results: [] };
  }
}

class MockD1Database {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): MockD1Statement {
    return new MockD1Statement(this.db, sql);
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.db.exec(sql);
    return { count: 1, duration: 0 };
  }

  async batch(
    statements: MockD1Statement[],
  ): Promise<Array<{ success: boolean; results: unknown[] }>> {
    const results: Array<{ success: boolean; results: unknown[] }> = [];
    for (const s of statements) {
      results.push(await s.run());
    }
    return results;
  }
}

// ------------------------------------------------------------------
// KV mock
// ------------------------------------------------------------------

class MockKVNamespace {
  private readonly store = new Map<string, string>();

  async get(key: string, type?: string): Promise<unknown> {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    if (type === "json") return JSON.parse(raw) as unknown;
    return raw;
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ------------------------------------------------------------------
// Rate limiter stub — always allows (unit tests never hit the limit)
// ------------------------------------------------------------------

const ALLOW = { success: true };
const RATE_LIMITER_STUB = {
  limit: async (_opts: { key: string }) => ALLOW,
};

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function makeTestEnv(): Env {
  const db = new DatabaseSync(":memory:");
  return {
    SOVEREIGN_DB_FREE: new MockD1Database(db) as unknown as D1Database,
    CACHE_KV: new MockKVNamespace() as unknown as KVNamespace,
    RATE_LIMITER: RATE_LIMITER_STUB,
    BURST_LIMITER: RATE_LIMITER_STUB,
  };
}
