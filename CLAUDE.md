# CLAUDE.md — @kajaril/sovereignty-scan-mcp

This file is the constitution for Claude Code working in this repo. Read it before any non-trivial change.

> **This is a template.** Copy to the repo root as `CLAUDE.md` at milestone M1. Update the "Repo state" section as the build progresses. Everything above that section is locked and should not be edited without a corresponding decision update in `kajaril-decisions-addendum-wk0.md` or this plan.

---

## What kajaril is

A one-person studio out of Cairo. Tools, agents, and platforms — built quietly, finished properly. This repo is the first published MCP product: a vendor sovereignty scanner for EU AI Act compliance.

The product is an artifact in a credential layer. Code shipped here will be read by DPO buyers, regulators, and audit agents. Every decision in this codebase is on the record.

## Required reading before structural changes

Three documents are canonical. Read them, in order, before any change that touches architecture, the data model, the seed, or any locked decision:

1. **`kajaril-source-of-truth.md`** — strategy, wedge, stack, roadmap
2. **`kajaril-decisions-addendum-wk0.md`** — entity-level locked decisions #11–#18 (overrides §2.2 and §4.2 of the source-of-truth)
3. **`sovereignty-scan-mcp-plan.md`** — Week 1 build plan + locked decisions #1–#7 specific to this MCP

These files live in the kajaril Entity folder, not in this repo. The build plan is the spec. Deviating from any locked decision (#1–#7 in the build plan, #11–#18 in the addendum) requires stopping, asking, and recording the new decision in writing before code changes.

## Locked decisions for this repo

These are not negotiable. If implementation reveals a reason one should change, **stop and ask** — do not adapt the code to a different decision silently.

1. **Database split** — Free-tier worker binds only to `sovereignty_db_free`. Never adds a binding to `sovereignty_db_paid` for any reason.
2. **`scan_stack` cap** — Hard limit of 50 providers per call. Returns `INPUT_TOO_LARGE` over.
3. **`suggest_eu_alternatives` algorithm** — Deterministic. The four-step logic in the build plan §Decisions is the spec; do not introduce ranking heuristics.
4. **Error envelope** — Every failure path returns `{error: {code, message, retryable, details}}`. Codes are locked at v0.1.0; do not add new codes without updating `types.ts` first and bumping the contract.
5. **KV cache key strategy** — Per-provider keys (`provider:{id}`, `category:{name}:ids`, `all:provider_ids`, `meta:last_refresh`). Do not switch to a snapshot-blob pattern.
6. **Provider data updates** — `seed.ts` is the source of truth. D1 is derived. All updates are commits to `seed.ts`, reviewed via PR, then idempotent reseed (`INSERT ... ON CONFLICT DO UPDATE`). **Writing SQL `UPDATE` directly against live D1 is prohibited** — it leaves no audit trail.
7. **License + metadata** — MIT. `package.json` author, repository, homepage, bugs are locked. `LICENSE` file at repo root.

## Discipline (from kajaril-source-of-truth.md §1)

- **No SaaS dashboard.** Free tier writes locally. Paid tiers are self-hosted or notary-only. Do not propose adding a customer portal, account login, or hosted UI to this repo.
- **No third-party telemetry.** No Segment, Amplitude, PostHog, Sentry, or any analytics SaaS calling out from this Worker. Observability is `diagnostics_channel` only.
- **No customer data ever leaves the Worker.** This product reads from D1, writes to KV, returns over `/mcp`. There is no other egress. If a feature seems to need one, stop and ask.
- **No tracking cookies, no fingerprinting.** `/health` and `/mcp` are stateless from the client's perspective.

The discipline above is the product, not just hygiene. A buyer choosing kajaril over a US SaaS vendor is choosing it because of these constraints.

## Coding conventions

- **TypeScript** strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`)
- **Biome** for formatting and linting. Pre-commit hook enforces. No exceptions.
- **Hono** for HTTP routing. No Express, no Fastify, no hand-rolled routers.
- **Imports**: absolute paths via `tsconfig.json` `paths`. No deep relative imports (`../../../`).
- **No default exports** in `src/`. Named exports only — easier to grep, easier to refactor.
- **`async/await` only.** No `.then()` chains in new code.
- **Error handling**: throw typed errors, catch at handler boundary, return error envelope. Never `try { } catch { /* ignore */ }`.

## Test discipline

- Every error envelope code in `types.ts` has at least one Vitest assertion that triggers it.
- No `.only` on `it` or `describe` in committed code. Pre-commit blocks.
- No `.skip` without an attached `// TODO(reason, owner, deadline)` comment.
- Tests run against a local Miniflare instance for D1 and KV. No live calls in unit tests.
- The `/health` endpoint has its own test asserting the structured payload shape.

## Commit and PR conventions

- **Signed commits required** on `main`. YubiKey-backed.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Scope optional.
- **PR descriptions** state which locked decision (if any) the change touches. If a PR touches a locked decision, the description must cite the decision number and explain why the lock still holds — or link to the addendum entry recording the new decision.
- **One concern per PR.** Refactor + feature in the same PR is a re-roll.

## Filesystem boundaries

This session operates only within the repo root. Reads or writes outside the repo require an explicit ask in chat — no exceptions, even for "convenience" actions like reading the user's `~/.gitconfig` or `~/.config/wrangler/config.toml`.

**Inside the repo, never read or modify:**
- `.env`, `.env.*`, `.dev.vars` — local secrets, gitignored
- `.wrangler/` — wrangler local state, contains build artifacts and tokens
- `node_modules/` — read-only dependency tree
- `dist/`, `build/` — generated output
- `.git/` — git internals; use git commands, never edit refs directly
- Any file matching `*secret*`, `*credential*`, `*token*`, `*.key`, `*.pem` — these names are a tripwire even when contents are placeholder

**Append-only, never modified:**
- `audit/` — debt audit artifacts. New files allowed; existing files immutable.
- `migrations/0001_*.sql` (after first prod apply) — additive migrations only via new files (`0002_*.sql`, etc.)

The full block list lives in `.claudeignore`. If a path is excluded there and the work seems to need it, stop and ask — do not work around the ignore file.

## Connector and MCP permissions

This session runs with a deliberately small set of external connections. Adding new ones requires an explicit ask.

**Allowed in this repo's CC session:**
- **GitHub MCP** — read, branch, PR, comment. Never `delete-repo`, `transfer-ownership`, `force-push`, or modify branch protection rules. The repo is the credential layer; an accidental destructive op is an existential bug.
- **Cloudflare MCP** — scoped to the kajaril CF account only (`info@kajaril.com`). Read and lookup operations on Workers, D1, KV, R2 are fine. Destructive ops (`d1 delete`, `kv:namespace delete`, `worker delete`) are manual via terminal, not through the MCP.
- **Filesystem (built-in)** — bounded by the rules above.

**Not allowed in this session, install/connect requires explicit decision:**
- Slack, Linear, Asana, Notion, Jira, Discord, Trello, any productivity MCP — not needed for an MCP server build, and each one is a prompt-injection vector
- Claude in Chrome / web browsing — research belongs in a separate CC session, not the one writing production code
- Any MCP that grants write access to email, calendar, or messaging
- Stripe MCP — paid tier work, not Week 1
- Any "search the web" or "scrape page" tool — provider data updates go through decision #6, not ad-hoc scraping

If a task seems to need a connection not on the allowed list, the answer is almost always "open a separate session for that work" rather than "expand this session's permissions."

## Skills loading policy

Skills bias the model's suggestions toward their domain. Load only what fits the work in this repo.

**Load on Day 1:**
- `cloudflare/skills` plugin — `build-mcp`, `build-agent`, `debug`, etc. Native fit for the build.
- `mcp-builder-k` — MCP protocol patterns
- `tech-debt-audit` — used at M7 closing

**Do not load in this repo's session:**
- `algorithmic-art-k`, `canvas-design-k`, `frontend-design`, `web-artifacts-builder-k`, `theme-factory-k` — wrong domain. Loaded design skills will surface UI suggestions for what should remain a headless MCP.
- `pptx-k`, `docx-k`, `xlsx-k`, `pdf-k` — document creation, not relevant to MCP server work
- `skill-creator-k` — only relevant when creating a new skill, which is not Week 1 work
- `setup-cowork`, `cowork-plugin-management:*` — environment setup skills, irrelevant once the repo exists

If a task in this repo seems to need a skill from the "do not load" list, that's a flag — almost always it means the task itself doesn't belong in this repo (e.g., "draft a one-pager about sovereignty-scan" is real work, but it belongs in a separate session with `docx-k` loaded, not this one).

## Secrets handling

Locked Day 1, even though the v0.1.0 secrets surface is small. Discipline propagates; ad-hoc-now becomes ad-hoc-forever.

**Where secrets live:**
- **Production**: Cloudflare Secrets via `wrangler secret put <NAME>`. Read at runtime via `env.<NAME>` in Worker code. Never in `wrangler.jsonc`, never in committed files.
- **Local dev**: `.dev.vars` file at repo root, gitignored, used by `wrangler dev`. Format: `KEY=value` per line. This file is for local development only and never gets committed.
- **CI**: GitHub Actions secrets. The npm publish flow uses OIDC (no token stored), so the only CI secret in v0.1.0 is none. When CF API tokens are needed for automated deploys (post-M7), they live in GitHub Actions secrets, scoped to the minimum permission set, rotated quarterly.

**Never appears in:**
- Source code (`src/**/*.ts`)
- Tests (`src/__tests__/**/*.ts`) — use placeholder strings like `"test-token"` if a token must appear, never a real one even from a dev environment
- Comments
- Commit messages
- PR descriptions
- `README.md` or any other docs
- Issue descriptions
- Logs (`diagnostics_channel` events scrub before emission — use `[REDACTED]` for any field that might contain a secret)
- Error messages returned via the error envelope

**v0.1.0 secrets inventory (Week 1):**
- npm publish token: handled by GitHub Actions OIDC — no token stored
- Cloudflare account ID `363dfad074317f1849e4fb0ae78243b3`: not a secret, fine in `wrangler.jsonc`
- D1 database IDs (after `wrangler d1 create`): not secrets, fine in `wrangler.jsonc`
- KV namespace ID: not a secret, fine in `wrangler.jsonc`

The free tier has no API keys, no third-party service credentials, no customer data. This is intentional — it's why the free tier is the credential artifact.

**Week 5–7 secrets (planned, not yet relevant):**
- Stripe keys (test + live) — Cloudflare Secrets, scoped to paid-tier worker only
- Customer API keys (paid tier auth) — hashed at rest, never logged, rotated per customer request
- Resend API key (already exists, currently used by other surfaces) — scope per-worker

**If a secret leaks:**
1. Rotate immediately — the leaked value is dead the moment it touches any non-trusted surface, regardless of whether you "got it back"
2. Audit usage of the rotated value (CF Logpush, npm audit logs, GitHub audit log)
3. Force-pushing it out of git history is **not** sufficient — assume any value committed to git, even briefly, is exposed forever
4. Document the incident in `audit/incidents/<date>-<short-id>.md`. Even a near-miss gets logged. The audit trail is the product.

## What Claude Code should NOT do without asking

- Add a new dependency to `package.json` (every dep is a sovereignty-scan attack surface — propose, then I approve)
- Modify `wrangler.jsonc` bindings, account_id, or compatibility_date
- Run `wrangler deploy`, `wrangler d1 execute --remote`, `npm publish`, or `git push --force` — these four move state irreversibly
- Change anything in `migrations/` after a migration has been applied to prod
- Edit `audit/` files (they are append-only artifacts)
- Touch the seed without going through the workflow in decision #6
- Read or write any file matching the `.claudeignore` patterns
- Connect a new MCP server, install a new skill, or expand session permissions
- Embed any secret-shaped string anywhere in the repo, even as a placeholder, even in a test

## What Claude Code SHOULD do automatically

- Run `biome check --write` before suggesting any code change is "done"
- Run `vitest run` and verify green before claiming a milestone closed
- Reference the locked decision number when implementing a constrained behavior (e.g., "implementing `scan_stack` cap per decision #2")
- Suggest a `seed.ts` PR when provider data needs to change, never propose a SQL UPDATE
- Stop and surface contradictions between the build plan, the addendum, and the source-of-truth — they are designed to override each other in a specific order, but a real conflict is a flag

## Repo state

| Milestone | Status | Closed at |
|---|---|---|
| M1 — Repo + CI infrastructure | _closed_ | 2026-05-07 |
| M2 — Package scaffolding + schema | _closed_ | 2026-05-07 |
| M3 — Data layer | _closed_ | 2026-05-07 |
| M4 — MCP tools + worker | _closed_ | 2026-05-07 |
| M5 — Seed data | _closed_ | 2026-05-07 |
| M6 — Configuration + deploy | _closed_ | 2026-05-07 |
| M7 — Tests, audit, publish | _closed_ | 2026-05-07 |

Update this table as milestones close. The closing condition for Week 1 is all seven rows showing a date.

## When in doubt

Stop. Ask. Read the build plan. Then ask again.

A governance product fails the moment it ships an undocumented decision. Slow is fine; silent is not.
