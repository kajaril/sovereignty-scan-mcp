# @kajaril/sovereignty-scan-mcp

MCP server for EU AI Act vendor sovereignty scanning. MIT-licensed free tier.

Know where your stack processes data before the enforcer does.

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

## Tools

**`scan_provider`** — Full jurisdictional profile for a single vendor: headquarters country, data residency regions, EU residency option, US CLOUD Act exposure, GDPR DPA availability, and legal framework.
- `name` — string, case-insensitive

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

```
git clone https://github.com/kajaril/sovereignty-scan-mcp
cd sovereignty-scan-mcp
npm install
wrangler deploy
```

## Health

```
GET https://sovereignty-scan.kajaril.com/health
```

Returns provider count, cache age, and schema version.

## License

MIT — see [LICENSE](./LICENSE).
