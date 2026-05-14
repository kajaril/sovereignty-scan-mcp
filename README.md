# @kajaril/sovereignty-scan-mcp

MCP server for EU AI Act vendor sovereignty scanning. MIT-licensed free tier.

Know where your stack processes data before the enforcer does. Covers **55 providers across 12 categories**.

## Install

Add to `claude_desktop_config.json` and restart Claude Desktop. No account required.

```json
{
  "mcpServers": {
    "sovereignty-scan": {
      "type": "http",
      "url": "https://sovereignty-scan.kajaril.com/mcp"
    }
  }
}
```

Free tier — MIT license, public endpoint, 100 req / day per IP.

**Client compatibility**

| Client | Status |
|--------|--------|
| Claude Desktop | ✓ Supported |
| Cursor / Windsurf | ✓ Supported (HTTP MCP) |
| claude.ai web | ✗ Not supported (no HTTP MCP) |

## Quick test

Verify the endpoint is live before installing:

```sh
curl -s https://sovereignty-scan.kajaril.com/health | jq .
```

Or call a tool directly:

```sh
curl -s -X POST https://sovereignty-scan.kajaril.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scan_provider","arguments":{"name":"cloudflare"}}}' \
  | jq .
```

## Tools

**`scan_provider`** — Full jurisdictional profile for a single vendor: headquarters country, data residency regions, EU residency option, US CLOUD Act exposure, GDPR DPA availability, and legal framework.
- `name` — string, case-insensitive

Example response:

```json
{
  "name": "Cloudflare",
  "hq_country": "US",
  "data_residency_regions": ["US", "EU", "APAC"],
  "eu_residency_option": true,
  "us_cloud_act_subject": true,
  "gdpr_dpa_available": true,
  "legal_framework": "GDPR+SCC"
}
```

**`scan_stack`** — Aggregate jurisdictional summary for a list of vendors: CLOUD Act exposure count, EU residency coverage, missing DPAs. Maximum 50 providers per call.
- `providers` — string[], max 50

**`list_providers`** — List all tracked providers. Optional category filter.
- `category?` — AI · Hosting · Database · Auth · Analytics · Observability · CI/CD · Communications · Payments · Search · Sandbox · Cache

**`get_us_cloud_act_providers`** — All providers subject to US CLOUD Act compelled disclosure (18 U.S.C. § 2713). No parameters.

**`suggest_eu_alternatives`** — EU/EEA/UK/CH-based alternatives in the same category as a given provider. Deterministic ordering: EU/EEA first, then UK/CH. Capped at 10.
- `provider_name` — string, case-insensitive

## Pricing

| | Free | Paid |
|---|---|---|
| Price | — | €39–149 / mo |
| License | MIT | Subscription |
| Status | Live | Coming soon |
| Output | Jurisdiction, residency, legal framework, CLOUD Act | + Proprietary risk score + Remediation guidance |
| Auth | None | API key |
| Rate limit | 100 req / day / IP | Extended |

Paid tier notifications: [studio@kajaril.com](mailto:studio@kajaril.com)

## Self-hosting

Requires a Cloudflare account (Workers + D1 + KV).

**1. Clone and install**

```sh
git clone https://github.com/kajaril/sovereignty-scan-mcp
cd sovereignty-scan-mcp
npm install
```

**2. Create infrastructure**

```sh
npx wrangler d1 create sovereignty-db-free
npx wrangler kv:namespace create CACHE_KV
npx wrangler rate-limit:namespace create RATE_LIMITER
npx wrangler rate-limit:namespace create BURST_LIMITER
```

Copy the IDs printed by each command into `wrangler.jsonc` under `d1_databases`, `kv_namespaces`, and `unsafe.bindings`.

**3. Apply schema and seed data**

```sh
npx wrangler d1 execute sovereignty-db-free --remote --file=migrations/0001_providers.sql
node --input-type=module -e "
  import { generateSeedSQL } from './src/seed.js';
  process.stdout.write(generateSeedSQL());
" | npx wrangler d1 execute sovereignty-db-free --remote --command=-
```

**4. Deploy**

```sh
npx wrangler deploy
```

The custom domain (`sovereignty-scan.kajaril.com`) in the default config is owned by kajaril — remove or replace the `routes` entry with your own domain or use the default `*.workers.dev` URL.

## Health

```
GET https://sovereignty-scan.kajaril.com/health
```

Returns a structured payload (HTTP 200):

```json
{
  "status": "ok",
  "provider_count": 55,
  "anthropic_path_count": 3,
  "last_kv_refresh": "2026-05-11T00:00:00.000Z",
  "cache_age_seconds": 86400,
  "schema_version": "0001"
}
```

`status` is `"ok"` when D1 is reachable, `"degraded"` otherwise. `cache_age_seconds` is `null` if the KV cache has never been warmed.

## License

MIT — see [LICENSE](./LICENSE).
