# Changelog

All provider data changes and breaking API changes are recorded here.
Code-only changes follow [semantic versioning](https://semver.org); data updates increment the minor version.

---

## [0.1.2] — 2026-05-07

### Data — 20 providers added (35 → 55 total)

**US platforms (9 new):**
- AWS (Hosting) — EU residency via eu-west regions; CLOUD Act subject; GDPR DPA available
- Microsoft Azure (Hosting) — EU residency; CLOUD Act subject; GDPR DPA available
- Google Cloud (Hosting) — EU residency; CLOUD Act subject; GDPR DPA available
- Datadog (Observability) — EU residency; CLOUD Act subject; GDPR DPA available
- MongoDB Atlas (Database) — EU residency; CLOUD Act subject; GDPR DPA available
- Pinecone (Database) — EU residency; CLOUD Act subject; GDPR DPA available
- OpenAI (AI) — US-only residency; CLOUD Act subject; no EU residency option
- GitHub (CI/CD) — US-only residency; CLOUD Act subject; no GDPR DPA
- Stripe (Payments) — EU residency; CLOUD Act subject; GDPR DPA available

**EU-native providers (11 new, not subject to CLOUD Act):**
- Adyen (Payments, NL) — GDPR-EU; no CLOUD Act exposure
- Aiven (Database, FI) — GDPR-EU; no CLOUD Act exposure
- Aleph Alpha (AI, DE) — GDPR-EU; no CLOUD Act exposure
- Hetzner (Hosting, DE) — GDPR-EU; no CLOUD Act exposure
- Infomaniak (Hosting, CH) — FADP+GDPR; Swiss jurisdiction
- Mistral AI (AI, FR) — GDPR-EU; no CLOUD Act exposure
- Mollie (Payments, NL) — GDPR-EU; no CLOUD Act exposure
- OVHcloud (Hosting, FR) — GDPR-EU; no CLOUD Act exposure
- Plausible (Analytics, EE) — GDPR-EU; no CLOUD Act exposure
- Qdrant (Database, DE) — GDPR-EU; no CLOUD Act exposure
- Scaleway (Hosting, FR) — GDPR-EU; no CLOUD Act exposure

### Code
- `notifications/initialized` now returns HTTP 200 instead of 404 — completes MCP handshake
- `initialize` response version corrected: `"0.1.0"` → `"0.1.2"`
- Rate limit error messages now distinguish daily cap from burst cap
- `suggest_eu_alternatives` no-results note URL corrected to `kajaril.com/sovereignty-scan/`
- GET `/mcp` returns 405 with explanation instead of 404

---

## [0.1.0] — 2026-05-07

Initial release.

### Providers (35)
AI · Auth · Analytics · Cache · CI/CD · Communications · Database · Hosting · Observability · Payments · Sandbox · Search

### Tools
- `scan_provider` — full jurisdictional profile for a single vendor
- `scan_stack` — aggregate summary for up to 50 vendors
- `list_providers` — list all providers with optional category filter
- `get_us_cloud_act_providers` — all CLOUD Act-subject providers
- `suggest_eu_alternatives` — EU/EEA/UK/CH alternatives in same category

### Infrastructure
- Cloudflare Worker, D1 (SQLite), KV cache, rate limiting (100 req/day/IP, 5 req/sec burst)
- MIT license, public endpoint, no account required
- Weekly cron (Sunday 00:00 UTC) warms KV cache from D1
