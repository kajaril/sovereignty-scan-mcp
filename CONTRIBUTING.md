# Contributing

Two contribution paths: adding a provider, and code changes.

## Adding a provider

Provider data lives in `src/seed.ts` — that is the source of truth. Never submit a SQL `UPDATE` directly against the database; it leaves no audit trail and will be rejected.

**Steps:**

1. Fork the repo and create a branch: `data/add-<provider-name>`
2. Add an entry to the `providers` array in `src/seed.ts`
3. Open a PR with a source link for each field you're asserting

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Official product name |
| `category` | string | AI · Hosting · Database · Auth · Analytics · Observability · CI/CD · Communications · Payments · Search · Sandbox · Cache |
| `hq_country` | string | ISO 3166-1 alpha-2 (e.g. `"US"`, `"DE"`) |
| `data_residency_regions` | string[] | e.g. `["US", "EU"]` |
| `eu_residency_option` | boolean | Can data be pinned to EU/EEA? |
| `us_cloud_act_subject` | boolean | Is the entity US-incorporated? |
| `gdpr_dpa_available` | boolean | Is a signed DPA available? |
| `legal_framework` | string | `"US-CLOUD-Act"` · `"GDPR+SCC"` · `"GDPR-EU"` · `"FADP+GDPR"` |

Source your data — link to the provider's official DPA page, data processing terms, or privacy documentation in the PR description. Unsourced entries will not be merged.

One provider per PR unless they are a natural group (e.g. a product suite with shared infrastructure).

## Code changes

```sh
npm install
npm test       # 47 tests must pass
npm run lint   # Biome — no warnings
```

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- One concern per PR — refactor and feature in the same PR is a re-roll
- New dependencies require discussion before opening a PR

## What gets rejected

- SQL `UPDATE` against live data
- New dependencies added without prior discussion
- PRs that touch more than one concern
- Provider entries without source links
