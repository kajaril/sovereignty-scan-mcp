# Security Policy

## Scope

Report vulnerabilities in:

- **Worker code** — logic errors, injection, authentication bypass
- **API endpoint** — unexpected data exposure, request smuggling
- **Data integrity** — incorrect CLOUD Act classification, false DPA availability status, wrong jurisdiction

Out of scope: rate limit bypass attempts, DoS, issues in third-party dependencies (report those upstream).

## Reporting

Email **studio@kajaril.com** with subject: `[SECURITY] sovereignty-scan-mcp — <short description>`

Include:
- What the issue is and where it occurs
- Steps to reproduce
- Impact in your assessment

Please do not open a public GitHub issue for security vulnerabilities.

## Response

- **Acknowledge**: within 48 hours
- **Confirm and patch**: within 7 days for confirmed issues
- **Disclosure**: coordinated — we will notify you before any public disclosure

## Data integrity reports

If a provider's sovereignty data is factually wrong (e.g. a provider is classified as not subject to CLOUD Act when it should be), that is treated as a high-priority data issue. Use the same email with subject `[DATA] sovereignty-scan-mcp — <provider name>` and include a source link.
