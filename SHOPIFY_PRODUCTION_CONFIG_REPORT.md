# Shopify Production Configuration Readiness Report

Date: July 11, 2026

## Executive readiness status

**READY AFTER MANUAL URL CONFIGURATION**

The repository is placeholder-safe and internally consistent for Shopify production URL configuration. It no longer assigns the unverified `blueprintai-app.onrender.com` hostname to production configuration or active reviewer/submission documentation. This report retains that literal only to document the stale value found and removed. Local Shopify CLI and tunnel workflows remain explicitly development-only.

Before Shopify review, an owner must replace `https://YOUR_PRODUCTION_APP_URL` with the final stable HTTPS origin, configure the production host and Shopify Partner/Dev Dashboard, deploy the web application, publish the Shopify app version manually, and verify the live install/callback/webhook flow. Those actions were not performed.

## Exact production URL contract

- Application origin: `https://YOUR_PRODUCTION_APP_URL`
- Shopify allowed redirection URL: `https://YOUR_PRODUCTION_APP_URL/auth/callback`
- Optional Google Ads redirect, separate from Shopify auth: `https://YOUR_PRODUCTION_APP_URL/auth/google-ads/callback`
- App-specific webhook endpoints, API version `2026-04`:
  - `https://YOUR_PRODUCTION_APP_URL/webhooks/app/scopes_update`
  - `https://YOUR_PRODUCTION_APP_URL/webhooks/app/uninstalled`
  - `https://YOUR_PRODUCTION_APP_URL/webhooks/customers/data_request`
  - `https://YOUR_PRODUCTION_APP_URL/webhooks/customers/redact`
  - `https://YOUR_PRODUCTION_APP_URL/webhooks/shop/redact`

Use one origin without a trailing slash. The placeholder must not be deployed or entered in the Dashboard.

## Files inspected

Configuration and runtime entry points:

- `shopify.app.toml`
- `shopify.web.toml`
- `prisma/production/migrations/migration_lock.toml`
- `package.json`
- `.env.example`
- `.env` variable names only; values were not printed or changed
- `Dockerfile`
- `vite.config.js`
- `scripts/prepare-production-prisma.mjs`
- `scripts/shopify-dev-tunnel.mjs`
- `app/shopify.server.js`
- `app/utils/demo-access.server.js`
- `app/utils/google-ads-oauth-state.server.js`
- `app/utils/billing.server.js`
- `app/utils/upload-storage.server.js`
- `app/services/media-analyzer.server.js`
- `app/services/google-ads.server.js`
- `app/services/llm.server.js`

Shopify functionality and route evidence:

- `app/models/blueprint.server.js`
- `app/routes/auth.$.jsx`
- `app/routes/webhooks.app.scopes_update.jsx`
- `app/routes/webhooks.app.uninstalled.jsx`
- `app/routes/webhooks.customers.data_request.jsx`
- `app/routes/webhooks.customers.redact.jsx`
- `app/routes/webhooks.shop.redact.jsx`
- Complete `app/routes/` inventory for callback and webhook path mapping
- Relevant configuration, webhook, production, and review contract tests under `app/**/*.test.js`

Documentation and examples:

- `README.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `SHOPIFY_PARTNER_DASHBOARD_CHECKLIST.md`
- `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md`
- `SHOPIFY_SUBMISSION_HANDOFF.md`
- Reviewer, listing, video, readiness, audit, and handoff Markdown files returned by the repository URL search
- `docs/GOOGLE_ADS_INTEGRATION_SETUP.md`
- Historical/local audit documents returned by the final localhost/tunnel search

Generated output, dependency files, binary assets, `.git`, and `node_modules` were excluded from repository-wide source findings. Installed Shopify library source was inspected only to confirm that `authPathPrefix: "/auth"` derives the SDK callback path `/auth/callback`.

## Files changed by this configuration-readiness pass

Core configuration, examples, runtime contract, and primary documentation:

- `shopify.app.toml`
- `.env.example`
- `README.md`
- `app/models/shopify-review-contract.test.js`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/GOOGLE_ADS_INTEGRATION_SETUP.md`
- `SHOPIFY_PRODUCTION_CONFIG_REPORT.md`

Active production/review documents normalized to the exact placeholder and provider-neutral wording:

- `SHOPIFY_PARTNER_DASHBOARD_CHECKLIST.md`
- `SHOPIFY_MANUAL_REVIEW_EVIDENCE.md`
- `SHOPIFY_REVIEWER_INSTRUCTIONS.md`
- `SHOPIFY_REVIEWER_TEST_INSTRUCTIONS.md`
- `SHOPIFY_REVIEW_READINESS_REPORT.md`
- `SHOPIFY_SUBMISSION_CHECKLIST.md`
- `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md`
- `SHOPIFY_SUBMISSION_HANDOFF.md`
- `SHOPIFY_FINAL_VIDEO_CHECKLIST.md`
- `SHOPIFY_LISTING_FINAL_CHECKLIST.md`
- `SHOPIFY_REVIEWER_TEST_INSTRUCTIONS_FINAL.md`

Historical report placeholder variants were normalized without changing their conclusions:

- `FINAL_SHOPIFY_QA_REPORT.md`
- `FINAL_SHOPIFY_REVIEW_AUDIT.md`
- `HANDOFF_CREATION_REPORT.md`

The working tree already contained unrelated modified and untracked files before this pass. They were preserved. Files not listed above were not intentionally changed for Step 4.

## URL and configuration findings

### Shopify TOML

| Setting | Result | Evidence |
| --- | --- | --- |
| Application URL | Now the required sentinel `https://YOUR_PRODUCTION_APP_URL`; must be replaced manually before deploy | `shopify.app.toml:5-7` |
| Embedded app | Enabled | `shopify.app.toml:8` |
| Development URL handling | `automatically_update_urls_on_dev = true`, so Shopify CLI can inject a development URL and ordinary `npm run dev` remains usable | `shopify.app.toml:10-11` |
| Webhook API version | `2026-04`; agrees with `ApiVersion.April26` in `app/shopify.server.js:13,28` and the installed Shopify library | `shopify.app.toml:13-14` |
| Access scopes | Exactly `read_products` | `shopify.app.toml:36-38` |
| Redirect URLs | Reduced from three entries to the one implemented/derived SDK callback | `shopify.app.toml:40-45` |
| App-specific webhooks | Five relative URIs; relative paths correctly follow the final application origin | `shopify.app.toml:16-34` |
| Web process configuration | Frontend/backend roles; uninstall path agrees with the app subscription and route | `shopify.web.toml:1-6` |

The removed `/auth/shopify/callback` entry was not the callback derived by this SDK configuration. The removed `/api/auth/callback` entry had no matching repository route. The configured SDK uses `authPathPrefix: "/auth"`, derives `/auth/callback`, and the repository handles `/auth/*` through `app/routes/auth.$.jsx`.

`2026-04` is intentionally unchanged: it matches the installed library enum. Shopify recommends regular API version upgrades, but moving to `2026-07` would require a dependency upgrade and compatibility test rather than a URL-only readiness edit.

### Runtime and environment agreement

- `app/shopify.server.js:11-16` reads `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, and `SHOPIFY_APP_URL`, and uses `/auth` as the auth prefix.
- `.env.example:1-8` documents those exact values and the optional `SHOP_CUSTOM_DOMAIN` that the runtime reads.
- `scripts/prepare-production-prisma.mjs:9-38` requires production PostgreSQL, required Shopify variables, exactly `read_products`, HTTPS, and a non-placeholder/non-loopback app URL.
- `.env.example:10-23` agrees with the production PostgreSQL and private S3-compatible storage checks.
- `.env.example:25-64` separates conditional analyzer, assistant, billing, and Google Ads values from core Shopify configuration.
- The unused `SESSION_SECRET` example and documentation requirement were removed. No repository code or installed Shopify/React Router package in scope reads it.
- `HOST` is used only by the compatibility block in `vite.config.js:6-18`, where Shopify CLI input is copied to `SHOPIFY_APP_URL` for development. There is no separate production `APP_URL` variable.
- The local `.env` is environment-specific and incomplete as a production checklist; it was not modified. Production must be configured from the documented contract in the hosting provider's secret/configuration system.

### Package scripts and hosting

- `build`: `react-router build`
- `start`: `react-router-serve ./build/server/index.js`
- `setup:production`: prepares the PostgreSQL schema, generates the client, and deploys committed migrations
- `docker-start`: runs `setup:production` before `start`
- `dev`: `shopify app dev`
- `dev:tunnel`: explicit development-only wrapper
- `deploy`: `shopify app deploy`, documented for later manual use only

No build/start/setup script hard-codes a localhost, tunnel, preview, or production application origin. For a host with a single container start phase, use the committed container default (`npm run docker-start`). For a host with a separate pre-deploy phase, run `npm run setup:production` once there and use `npm run start`. No hosting provider is assumed.

### Production hostname findings

The unverified `https://blueprintai-app.onrender.com` origin was found in `shopify.app.toml`, `.env.example`, `README.md`, `docs/GOOGLE_ADS_INTEGRATION_SETUP.md`, and active submission/reviewer/checklist documents. Every configuration and active-document occurrence was removed or replaced with the exact required placeholder. The final search returns only the historical finding text in this report; excluding this report, it returns zero matches.

No real production hostname was guessed or added. Existing unrelated public URLs in code (Shopify CDN/Admin and Google API endpoints) are vendor API/resource URLs, not BluePrintAI application, OAuth, or webhook origins.

## Webhook route audit

| Topic | Placeholder URL | Implemented handler | Result |
| --- | --- | --- | --- |
| `app/scopes_update` | `https://YOUR_PRODUCTION_APP_URL/webhooks/app/scopes_update` | `app/routes/webhooks.app.scopes_update.jsx` | Verifies through `authenticate.webhook`; updates stored session scope |
| `app/uninstalled` | `https://YOUR_PRODUCTION_APP_URL/webhooks/app/uninstalled` | `app/routes/webhooks.app.uninstalled.jsx` | Verifies; deletes shop workspace/media and sessions |
| `customers/data_request` | `https://YOUR_PRODUCTION_APP_URL/webhooks/customers/data_request` | `app/routes/webhooks.customers.data_request.jsx` | Verifies; acknowledges because no customer records are persisted |
| `customers/redact` | `https://YOUR_PRODUCTION_APP_URL/webhooks/customers/redact` | `app/routes/webhooks.customers.redact.jsx` | Verifies; acknowledges because no customer records are persisted |
| `shop/redact` | `https://YOUR_PRODUCTION_APP_URL/webhooks/shop/redact` | `app/routes/webhooks.shop.redact.jsx` | Verifies; deletes shop workspace/media and sessions |

No webhook URL was invented. Every configured relative URI maps to an implemented React Router action.

## Scope audit

| Configured scope | Repository functionality requiring it | Conclusion |
| --- | --- | --- |
| `read_products` | `PRODUCT_QUERY` reads shop metadata and paginated product IDs, titles, handles, status, type, vendor, images, variants/prices, and timestamps in `app/models/blueprint.server.js:32-67`; `loadMerchantData` executes it through `admin.graphql` at `app/models/blueprint.server.js:2073-2077` | Required and minimal for current submitted runtime |

The production app contains no other `admin.graphql` call and requests no product write, order, draft-order, or customer scope. The development-store seed script contains broader mutations, but it is a separate operator tool and does not justify expanding the submitted app scope. Mandatory privacy webhooks do not require adding customer-data access scopes. The scope was left unchanged.

## Embedded-app result

**PASS at repository configuration level.** `embedded = true` in `shopify.app.toml`, `AppProvider` is used for the authenticated app shell, and production routes authenticate Shopify Admin sessions. A clean live install in Shopify Admin is still required to prove iframe navigation, callback behavior, CSP, session persistence, and reinstall behavior on the deployed origin.

## Environment-variable checklist

Required for the production review runtime:

- [ ] `NODE_ENV=production`
- [ ] `SHOPIFY_API_KEY` from the matching Shopify app
- [ ] `SHOPIFY_API_SECRET` from the matching Shopify app, stored as a secret
- [ ] `SHOPIFY_APP_URL` set to the final origin replacing `https://YOUR_PRODUCTION_APP_URL`
- [ ] `SCOPES=read_products`
- [ ] Managed PostgreSQL `DATABASE_URL`
- [ ] `FILE_STORAGE_DRIVER=s3`
- [ ] `S3_BUCKET` and `S3_REGION`
- [ ] Workload credentials or `S3_ACCESS_KEY_ID` plus `S3_SECRET_ACCESS_KEY`
- [ ] `DEV_BYPASS_SHOPIFY_AUTH=false`
- [ ] `ENABLE_DEVELOPER_TOOLS=false`
- [ ] `SHOPIFY_BILLING_BYPASS=false`
- [ ] `SHOPIFY_BILLING_REQUIRED=false` while the listing is free

Conditional only when applicable:

- `SHOP_CUSTOM_DOMAIN`
- `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and custom upload limits
- `ANALYZER_ENABLED`, HTTPS `ANALYZER_SERVICE_URL`, `ANALYZER_API_KEY`, and timeout
- Assistant provider URL/key/model values
- Google Ads client, secret, developer token, exact redirect, encryption key, and optional manager/default customer/API version values
- `SHOPIFY_APP_HANDLE` only when billing is enabled and the TOML has no root handle

## Shopify Partner/Dev Dashboard checklist

- [ ] Confirm the committed `client_id` belongs to the intended production Shopify app; it was pre-existing and was not changed.
- [ ] Set App URL to the real final origin that replaces `https://YOUR_PRODUCTION_APP_URL`.
- [ ] Keep exactly one Shopify allowed redirect: `https://YOUR_PRODUCTION_APP_URL/auth/callback`, after replacing the origin.
- [ ] Remove any stale localhost, loopback, ngrok, TryCloudflare, preview, old-domain, `/auth/shopify/callback`, or `/api/auth/callback` entries.
- [ ] Confirm embedded app is enabled.
- [ ] Confirm required scopes are exactly `read_products` and the review-store grant matches; reinstall/reapprove if needed.
- [ ] Confirm the active app version contains all five app-specific subscriptions using webhook API version `2026-04`.
- [ ] Confirm public privacy, terms, support, and data-deletion listing URLs use the same final HTTPS origin.
- [ ] Do not submit until a clean install, callback, uninstall/reinstall, and signed webhook delivery have been tested on the deployed review store.

## Hosting/runtime checklist

- [ ] Deploy the exact reviewed commit to one stable HTTPS origin.
- [ ] Configure secrets and variables without committing or logging their values.
- [ ] Run `npm run setup:production` once before accepting traffic, or use `npm run docker-start` when the container start phase owns setup.
- [ ] Confirm production rejects placeholder/loopback app URLs and non-PostgreSQL databases.
- [ ] Confirm `/health` and public legal/support routes are reachable over HTTPS.
- [ ] Confirm PostgreSQL migrations are current and private object storage persists across restarts/deploys.
- [ ] Confirm every configured callback and webhook endpoint is publicly reachable without an unexpected redirect.
- [ ] Review sanitized production logs for callback/webhook/storage failures without exposing secrets or payload PII.

## Remaining localhost, loopback, ngrok, TryCloudflare, tunnel, and temporary references

All remaining matches are acceptable and must not be copied into production configuration:

| Files | Classification and reason retained |
| --- | --- |
| `.env.example:30-31`, `README.md:286` | Commented/documented development-only legacy analyzer at `127.0.0.1`; the production analyzer value is empty and explicitly requires separate HTTPS |
| `README.md:186-241`, `docs/GOOGLE_ADS_INTEGRATION_SETUP.md:10` | Explicit local Shopify development options for ephemeral TryCloudflare and developer-controlled ngrok/staging callbacks |
| `scripts/shopify-dev-tunnel.mjs`, `package.json:7` | Explicit `dev:tunnel` implementation; never invoked by production build/start scripts |
| `vite.config.js:6-27` | Shopify CLI `HOST` compatibility plus localhost HMR fallback for local development |
| `app/utils/demo-access.server.js` | Localhost/loopback guard; bypass is additionally disabled when `NODE_ENV=production` |
| `app/utils/google-ads-oauth-state.server.js` | Development tunnel origin normalization; production Google callback is pinned by `GOOGLE_ADS_REDIRECT_URI` and startup validation |
| `scripts/prepare-production-prisma.mjs` | Negative production guard that rejects loopback and placeholder app URLs |
| `Dockerfile:18` | Build-only dummy PostgreSQL URL used under `NODE_ENV=development`; runtime setup validates the real managed PostgreSQL URL |
| `REVIEWER_INSTRUCTIONS.md` | Self-contained local reviewer/demo workflow, explicitly not the production Shopify flow |
| `app/services/google-ads.server.test.js`, `app/utils/demo-access.server.test.js`, `app/models/shopify-review-contract.test.js` | Test fixtures and negative assertions for local/tunnel behavior |
| `docs/UI_SIMPLIFICATION_AUDIT.md`, `docs/UI_SIMPLIFICATION_REPORT.md` | Historical local visual-audit evidence, not current production instructions |
| `SAVE_FEATURE_AUDIT.md`, `REVIEW_READINESS_AUDIT.md`, `REVIEW_COMPLETENESS_AUDIT.md` | Historical findings describing prior/local behavior, not live configuration |
| `BLOCKER_FIX_REPORT.md`, `DEMO_REVIEWER_PACKAGE_REPORT.md`, `FINAL_REVIEW_SCRIPT_REPORT.md`, `FINAL_SHOPIFY_QA_REPORT.md`, `FINAL_SUBMISSION_AUDIT.md`, `SHOPIFY_PLUGIN_FINAL_AUDIT.md`, `SHOPIFY_REVIEW_SIMULATION_REPORT.md` | Historical audit statements, local-tool descriptions, or negative production checks |
| `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `SHOPIFY_SUBMISSION_CHECKLIST.md`, `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md`, `SHOPIFY_PARTNER_DASHBOARD_CHECKLIST.md`, `SHOPIFY_MANUAL_REVIEW_EVIDENCE.md`, `SHOPIFY_REVIEW_READINESS_REPORT.md` | Negative checklist language requiring removal/rejection of temporary values; no temporary production value is assigned |

`DATABASE_URL=postgresql://USER:PASSWORD@HOST:...` in `.env.example` uses `HOST` as a database-host placeholder, not the Shopify application hostname. `https://blueprintai.local` in URL parsing helpers is a synthetic base used only to parse relative internal paths and is not contacted. Vendor/test/example URLs and seed social URLs are not application configuration.

## Commands run and results

| Command | Result |
| --- | --- |
| Repository `rg` inventories for TOML, env, URLs, callback/webhook routes, scopes, embedded settings, `HOST`, `SHOPIFY_APP_URL`, `APP_URL`, localhost, loopback, ngrok, TryCloudflare, tunnel, and placeholder variants | **PASS**; findings classified above |
| `python3 -c 'import tomllib; ...'` for `shopify.app.toml` and `shopify.web.toml` | **PASS** |
| `git diff --check` | **PASS** |
| Focused `app/models/shopify-review-contract.test.js` | **PASS**; 6 passed |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS**; existing React Router v8 future-flag warnings only |
| `npm run build` | **PASS**; existing future-flag, empty server-route chunk, and mixed static/dynamic import warnings only |
| `npm test` | **PASS**; 282 passed, 0 failed, 0 skipped/cancelled |
| Final search for `blueprintai-app.onrender.com` | **PASS**; only this report's historical finding text remains; zero matches when this report is excluded |
| Final search for removed Shopify redirects | Only checklist/report text instructing owners to remove them; neither remains configured |

The final documentation edit after validation removed one stale README statement about a nonexistent legal URL field. It is Markdown-only and does not affect the passing code checks; `git diff --check` is rerun in the final verification below.

## Outstanding blockers and manual actions

1. Replace every production application placeholder with the real final HTTPS origin. Do not guess it.
2. Configure and deploy the production web runtime, PostgreSQL database, and private object storage.
3. Update the Shopify Partner/Dev Dashboard and production app version with the exact App URL, sole redirect, embedded setting, scope, and webhook configuration.
4. Run `shopify app deploy` manually only after the real origin is in `shopify.app.toml` and the HTTPS application is live.
5. Exercise a clean embedded install, OAuth callback, navigation/refresh, signed and invalid webhook deliveries, uninstall cleanup, and reinstall on the review store.
6. Confirm the existing Shopify `client_id`, environment API key/secret, and Dashboard app all refer to the same app.
7. Confirm public legal/support/listing URLs and owner-supplied legal/support facts before submission.

These are manual/external readiness actions. They do not justify placing a guessed production hostname or credentials in the repository.

## Explicit non-actions

- No deployment was performed.
- `shopify app deploy` was not run.
- Shopify CLI was not run.
- No remote Shopify configuration was mutated.
- No Shopify Partner/Dev Dashboard was accessed or changed.
- No Shopify App Store submission was made.
- No OAuth flow was added or replaced.
- No real secret, token, shop domain, API key, API secret, or new client ID was added.
- No production hostname was guessed.
