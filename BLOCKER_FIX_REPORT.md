# BluePrintAI Blocker Fix Report

Date: July 1, 2026  
Result: **Closer to Shopify review — Almost, but not ready to submit**

## Implemented

### Legal, privacy, support, and identity

- Removed all user-visible `OWNER ACTION REQUIRED` and unfinished/scaffolding language.
- Removed the hardcoded personal Gmail address from Settings.
- Centralized neutral support wording around the app Support page and the verified contact that must be published in the Shopify App Store listing.
- Reworked Terms, Privacy, Contact, copyright, refund, and deletion sections so they are presentable without inventing an entity name, address, governing jurisdiction, or email.
- Replaced roadmap-heavy support copy with the actual core paths: Shopify products, CSV import, and manual upload.

These pages still require owner/qualified review. Neutral copy is not a substitute for publishing the actual legal operator and staffed support contact in the listing.

### Production URL/configuration

- `.env.example` no longer supplies a fake production origin; `SHOPIFY_APP_URL` is empty and documented as required.
- Production preparation now rejects missing, non-HTTPS, localhost, example, and placeholder `SHOPIFY_APP_URL` values.
- `shopify.app.toml` explains that Shopify CLI requires the real concrete origin and callback before deployment. The sentinel remains intentionally conspicuous because no real production URL was supplied and inventing one would be unsafe.
- Localhost/ngrok references remain only in development tooling, build-only Prisma generation, local guards, or tests—not production UI.

### Heuristic truthfulness

- Renamed dashboard readiness to **Estimated workflow progress** and added an inline explanation that it is not measured ad performance or a prediction.
- Renamed creative rankings to **Heuristic signal** and explained that they are directional, not live platform scores.
- Relabeled creator scores as directional heuristics and replaced `Scale`, `Keep testing`, and `Coach or pause` decisions with evidence/data-coverage guidance.
- Softened campaign and advisor scaling language.
- Removed the automatic 35%-of-revenue “estimated upside” calculation. Revenue Blueprint now states that no forecast is calculated and that imported revenue is historical merchant-provided context.
- Retained explicit imported/demo provenance and unavailable-metric behavior.

### Analyzer-disabled behavior

- Preserved fail-closed behavior: no analyzer response means no generated scores, recommendations, retention, or transcript.
- Added a clear enabled-state disclosure explaining that only service-returned fields are shown.
- Kept the disabled/unavailable and failed-analysis states explicit.
- Restricted the file picker to supported MP4/MOV/M4V/WebM types, added supported-format guidance, and marked upload errors as alerts.

### Shopify product loading

- Replaced the silent 25-product query with cursor pagination: 100 products per page, up to a bounded 1,000-product workspace limit.
- Added partial-result warnings for later-page failures, missing cursors, and the 1,000-product bound.
- Added `productLoad` diagnostics and a two-page regression test.
- Product failures remain non-blocking; manual product context and imported product names continue to work.

### Migration safety

- Production preparation no longer generates or rewrites migration SQL or `migration_lock.toml`.
- The PostgreSQL schema and baseline migration are now committed rather than ignored.
- Preparation fails clearly if committed migrations are absent.
- Docker schema derivation runs as a build step; `docker-start` performs real production URL/database/storage validation before migration deployment.
- No database was reset, deleted, or modified by this work.

## Still unresolved

1. A real deployed HTTPS URL has not been supplied. `shopify.app.toml` must be updated before `shopify app deploy`.
2. The owner must publish and staff a real support contact and ensure it matches the Support page, privacy process, and listing.
3. The owner should obtain qualified review of the Terms and Privacy Policy and complete any additional BluePrintAI Commerce entity disclosures required for their jurisdiction.
4. Production PostgreSQL, private object storage, analyzer deployment (if advertised), webhooks, clean install/uninstall, and embedded-browser behavior remain unverified.
5. The existing heuristic formulas are now honestly labeled but remain directional formulas. Longer-term, replace them with user-selected real metrics or documented methodology.
6. Catalogs above 1,000 products receive a visible partial-context warning rather than unbounded loading.
7. Browser E2E, responsive, accessibility, currency provenance, streaming uploads, and installed-app self-service deletion remain follow-up work from the audit.

## Verification

- `npm run lint` — PASS (exit 0).
- `npm run typecheck` — PASS (exit 0); React Router v8 future-flag warnings only.
- `npm run build` — PASS (exit 0); existing future-flag and mixed static/dynamic import warnings only.
- `npm run test` — PASS (exit 0); 152 tests, 0 failures after the pagination test was added.
- `git diff --check` — PASS (exit 0).
- `npm run prisma:prepare:production` — PASS; reported that committed migrations were unchanged.
- Final lint/typecheck/build/test/diff checks are recorded after the final verification pass.

## Review assessment

**Almost.** Code-level blockers in the requested scope are substantially reduced. Submission is still blocked by real owner identity/support/legal approval, the concrete production URL, deployed infrastructure, and a clean Shopify review-store walkthrough.
