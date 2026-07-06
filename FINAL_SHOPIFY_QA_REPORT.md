# Final Shopify Submission QA Report

Date: July 1, 2026  
Final readiness: **Almost — do not submit until the manual deployment gates are complete**

## Scope and evidence

This pass reviewed production configuration, Docker startup, Prisma preparation/migrations, environment use, Shopify authentication/session handling, the embedded app shell, billing gating, compliance webhooks, clean-store states, primary routes, CSV/video workflows, data provenance, optional connectors, legal/support routes, and responsive source patterns.

Automated source/model tests and a production build were run. A real HTTPS deployment, Shopify Partner Dashboard, authenticated clean review store, production PostgreSQL/S3, and interactive in-app browser were not available. Those are mandatory manual gates, not assumed passes.

## Automatic fixes in this pass

1. **Embedded AppProvider boundary:** free production workspaces now remain wrapped in Shopify's `AppProvider`. Only explicit local/demo bypass requests skip it. Previously, `SHOPIFY_BILLING_REQUIRED=false` also bypassed the provider.
2. **Production startup validation:** production preparation now requires non-empty Shopify API key/secret/scopes, exactly `read_products`, a real HTTPS app URL, `FILE_STORAGE_DRIVER=s3`, bucket, region, PostgreSQL, and committed migrations.
3. **Reviewer-facing truthfulness:** Creative Library no longer says CSV performance imports are inactive; its empty state now points to Review Studio and CSV import.
4. **Analyzer claim:** the public workflow now says the analyzer runs only when configured and that uploads can still be saved otherwise.
5. **Catalog bound:** onboarding now discloses safe pagination up to 1,000 recently updated Shopify products instead of claiming an unlimited full-store analysis.
6. Added an automated regression test that ensures real free workspaces keep the `AppProvider` boundary.

## Production configuration

### Must be replaced before submission

| Location | Required action |
| --- | --- |
| `shopify.app.toml:7` | Replace `https://YOUR_PRODUCTION_APP_URL` with the exact deployed HTTPS origin. |
| `shopify.app.toml:43` | Replace the sentinel with `<deployed-origin>/auth/callback`. |
| Production environment | Set `SHOPIFY_APP_URL` to the identical origin, without a trailing slash. |
| Shopify Partner/Dev Dashboard | Publish the same App URL and allowed redirect URL through the deployed app configuration/version. |

Shopify CLI configuration requires concrete URLs in TOML; runtime environment substitution does not replace those fields. No fake production URL was introduced.

### Required production environment

- `NODE_ENV=production`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL=https://<real-deployed-origin>`
- `SCOPES=read_products`
- `DATABASE_URL=postgresql://...` using managed PostgreSQL and required TLS
- `FILE_STORAGE_DRIVER=s3`
- `S3_BUCKET`
- `S3_REGION`
- paired `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, or workload identity
- `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` only for providers that require them
- `DEV_BYPASS_SHOPIFY_AUTH=false`
- `SHOPIFY_BILLING_REQUIRED=false` for the current free listing
- `SHOPIFY_BILLING_BYPASS=false`

Analyzer, optional connectors, and paid billing variables are not required for the current core review path. See `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md` for the analyzer decision.

### Development-only URL findings

- `scripts/shopify-dev-tunnel.mjs`: ngrok example is development tooling only.
- `vite.config.js` and `app/utils/demo-access.server.js`: localhost fallbacks/guards are development-only.
- OAuth URL tests contain localhost/ngrok fixtures only.
- Docker uses a non-networked localhost PostgreSQL URL solely for Prisma client generation at image build time; runtime validation requires a real managed PostgreSQL URL.
- No localhost/ngrok URL was found in production-facing UI copy.

## Shopify install, embedded app, billing, and webhooks

| Area | Result | Remaining proof |
| --- | --- | --- |
| Admin authentication | Uses `authenticate.admin`, App Store distribution, Prisma session storage, and `/auth` prefix. | Clean install and callback on deployed HTTPS origin. |
| Embedded provider | **Fixed:** real workspaces always render under `AppProvider`; only local/demo bypass skips it. | Verify App Bridge navigation in Shopify iframe. |
| Onboarding guard | Non-onboarded workspaces redirect to `/app/onboarding`; legal/support routes remain reachable. | Fresh install, skip, complete, refresh, reopen. |
| Billing | Current build is free; billing checks run only when explicitly required. Missing paid-app handle fails closed. | Ensure listing is free and both billing flags are false. Paid mode is not review-ready. |
| Sessions | Prisma session storage includes refresh-token fields and expiring offline-token mode. | Token expiry/refresh, staff account, uninstall/reinstall. |
| Webhooks | Signed authentication exists for app uninstall, scope update, customer data request/redact, and shop redact. Workspace/media/session deletion is shop-scoped and idempotent. | Public reachability, valid/invalid signatures, retry logs, real cleanup. |
| Permissions | TOML and runtime review configuration use `read_products` only. | Confirm granted scope on clean review store. |

## Clean-store and primary-route review

| Route | Clean state / core action | QA result |
| --- | --- | --- |
| Command Center | Shows “No saved creative activity,” with upload, import, and campaign actions. | Source-ready; browser verification required. |
| Creative Library | Truthful empty state points to Review Studio and CSV import; manual upload modal remains available. | Copy fixed; upload/storage E2E required. |
| AI Review Studio | Disabled analyzer says upload-only; enabled state limits claims to returned fields; missing transcript/retention remain unavailable. | Fail-closed source/tests pass; service E2E required if listed. |
| Ad Briefs | Requires Shopify/imported/manual product context and gives a clear import path when absent. | Ready for clean-store test. |
| AI Advisor | Deterministic/advisory labeling and data-gap behavior; does not require OAuth. | Ready for clean-store test. |
| Revenue Blueprint | No product context points to import; unsupported revenue forecast was removed. | Ready for clean-store test. |
| Creators | No-data state points to creator CSV; imported data and heuristic signals are labeled. | Ready for clean-store test. |
| Data Import | Required/optional columns, 500-row/2 MB constraints, preview, errors, warnings, confirm, success summary, and destinations are visible. | Strong automated coverage; browser file E2E required. |
| Settings | Manual/Shopify product context, preferences, legal links, and neutral support routing exist. | Ready; production save/refresh required. |
| Onboarding | Supports catalog, primary product, and manual product context; legal acceptance links exist; skip remains usable. | Catalog limit copy fixed; clean install required. |
| Terms / Privacy / Support | Public and embedded routes are linked and contain no owner-action markers or personal Gmail. | BluePrintAI Commerce and support@blueprintai.app must match the listing; owner must approve policies. |
| Connections | Direct ad-platform cards are disabled as “Coming soon”; CSV import remains the active alternative. | Optional and non-blocking. Underlying direct OAuth routes should not be advertised in reviewer notes. |

## Upload and import provenance

- CSV values are merchant-provided imports, not Shopify Orders or live platform analytics.
- Demo mode is development-only and visibly labels all data as sample.
- Normal production workspaces do not seed demo creators or demo performance.
- Missing commercial fields remain unavailable instead of receiving fabricated values.
- Dashboard creator rollups are excluded from canonical totals to avoid double counting.
- Uploaded video files are signature/type/size checked and use authenticated private-media routes.
- Production uploads require S3-compatible private storage; local production storage fails closed.
- Analyzer failures do not generate or save fabricated analysis, transcript, or retention values.

## Top remaining review risks

1. Real deployment origin and callback are not yet configured in TOML/Dashboard.
2. No clean Shopify install, iframe navigation, uninstall/reinstall, or webhook delivery has been executed against this exact build.
3. BluePrintAI Commerce and support@blueprintai.app must be published consistently in the listing, and any additional required legal-entity disclosures still need owner review.
4. Production PostgreSQL and private S3 behavior are not verified.
5. Analyzer is disabled by default. Either deploy it or ensure the listing/reviewer notes describe upload-only behavior.
6. Browser/mobile/keyboard/console QA could not be executed in this environment.
7. Paid billing is intentionally not ready; the listing must remain free.
8. Underlying Google/TikTok routes remain in the codebase while cards are disabled. They are optional and should not be included in review instructions.
9. Uploads are buffered in memory; concurrency/load testing remains outstanding.
10. Currency provenance and installed-app self-service workspace deletion remain post-blocker follow-ups.

## Verification commands

| Check | Result |
| --- | --- |
| `npm run lint` | PASS (exit 0) |
| `npm run typecheck` | PASS (exit 0; React Router v8 future-flag warnings) |
| `npm run build` | PASS (exit 0; existing future-flag and mixed static/dynamic import warnings) |
| `npm run test` | PASS (exit 0; 153 passed, 0 failed, 0 skipped) |
| `git diff --check` | PASS (exit 0) |

Runtime HTTP smoke evidence:

- Production build public routes `/`, `/terms`, `/privacy`, `/support`, `/contact`, and `/data-deletion`: HTTP 200.
- Production mode `/app?demo=1`: HTTP 410, confirming the development demo/auth bypass is rejected in production.
- Explicit development-only demo boundary: Command Center, Creative Library, Review Studio, Ad Briefs, Recommendations, Revenue Blueprint, Creators, Data Import, Settings, and Onboarding all returned HTTP 200.
- Interactive browser console, responsive visual, and Shopify iframe checks remain manual because the in-app browser control surface was unavailable.

## Files changed in this pass

- `app/routes/app.jsx`
- `app/models/app-shell-review.test.js`
- `scripts/prepare-production-prisma.mjs`
- `app/routes/app.creative-library.jsx`
- `app/routes/_index/route.jsx`
- `app/routes/app.onboarding.jsx`
- `FINAL_SHOPIFY_QA_REPORT.md`
- `SHOPIFY_REVIEW_TEST_SCRIPT.md`
- `MANUAL_SUBMISSION_TODO.md`

Earlier blocker-pass changes remain in the working tree and are documented in `BLOCKER_FIX_REPORT.md`.
