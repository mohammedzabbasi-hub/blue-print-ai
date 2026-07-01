# Shopify Production Configuration Readiness Report

Date: June 30, 2026

## 1. Summary

**Verdict: Yes after human steps.** The repository no longer silently pins Shopify review configuration or public legal-site metadata to an assumed production origin. It uses explicit placeholders while preserving Shopify CLI URL injection and local development fallbacks. A human must replace the five actionable Shopify configuration/credential values, provision the other production services documented in `.env.example`, complete the Dashboard checklist below, deploy, and perform live endpoint/install tests before App Review.

No Shopify CLI, deployment, submission, or external configuration command was run.

## 2. Findings

| File inspected | Findings |
| --- | --- |
| `shopify.app.toml:3-10,12-40` | Embedded app (`embedded = true`); CLI dev URL updates remain enabled; config is included on deploy. The assumed app origin and `/auth/callback` were replaced at lines 5 and 40. Five relative webhook URIs remain correctly origin-independent at lines 15-33. Scope is `read_products` at line 37. No localhost/tunnel URL remains. |
| `package.json:4-29` | Existing scripts: `lint`, `typecheck`, `build`, `test`, and `deploy`. Local development remains `shopify app dev`; the production command resolves to `shopify app deploy`. No pinned URL. |
| `README.md:5-35,60-80,142-197` | Added the exact ordered production checklist at lines 18-35. Temporary TryCloudflare/ngrok URLs remain only in explicitly labeled development instructions (lines 150-186), not review configuration. |
| `.env.example:1-36` | File exists. Shopify key, secret, and app origin now use conspicuously fake values at lines 2-4; configured scope remains `read_products` at line 5. Other existing database, storage, analyzer, development, and billing variables were preserved. |
| `app/shopify.server.js:10-24` | Runtime consumes `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, and `SHOPIFY_APP_URL`; optional `SHOP_CUSTOM_DOMAIN` is not required for standard production hosting. Auth prefix is `/auth`. No pinned URL. |
| `app/models/blueprint.server.js:18-38,1097-1119` | Production Admin API usage loads shop/product data through one products query. This supports `read_products`; no production order/customer/write operation was found. |
| `app/content/legal.js:1-9` | Public website metadata was an assumed origin; line 8 now uses the production URL placeholder. |
| `shopify.web.toml:1-6` | Frontend/backend roles and relative uninstall webhook path only. No pinned origin. |
| `vite.config.js:5-35` | `HOST` is a Shopify CLI compatibility input and is copied to `SHOPIFY_APP_URL`. `http://localhost` and localhost HMR at lines 18-27 are intentional local fallbacks, not production review URLs. |
| `Dockerfile:1-18` | `localhost` at line 16 is a build-only dummy PostgreSQL URL used while generating/building; runtime uses production environment configuration. It is not an App URL, OAuth redirect, or webhook endpoint. |
| `scripts/shopify-dev-tunnel.mjs:3-20` | ngrok variable/example is explicitly a developer-selected tunnel for `dev:tunnel`; it does not provide a production fallback. |
| `app/services/google-ads.server.test.js:16-59`, `app/utils/demo-access.server.js:1`, related tests | localhost/127.0.0.1/ngrok values are test fixtures or local-access guards. They do not configure the deployed Shopify app. |
| `app/utils/embedded-routing.js:23` | `https://blueprintai.local` is a synthetic URL base used to parse relative navigation, not a network endpoint or production origin. |

No hardcoded localhost, 127.0.0.1, ngrok, or TryCloudflare URL remains in `shopify.app.toml` or `.env.example`. The development references above were intentionally retained so local development is not broken.

## 3. Changes made

- `shopify.app.toml`
  - `application_url`: assumed origin -> `https://YOUR_PRODUCTION_APP_URL`
  - OAuth redirect: assumed origin -> `https://YOUR_PRODUCTION_APP_URL/auth/callback`
- `.env.example`
  - `SHOPIFY_API_KEY=` -> `SHOPIFY_API_KEY=your_api_key_here`
  - `SHOPIFY_API_SECRET=` -> `SHOPIFY_API_SECRET=your_api_secret_here`
  - `SHOPIFY_APP_URL`: assumed origin -> `https://YOUR_PRODUCTION_APP_URL`
- `README.md`
  - Added the ordered **Shopify Production Configuration** section, exact Dashboard values, webhook endpoints, embedded/scope confirmations, placeholder warning, and documented-only `shopify app deploy` command.
  - Replaced the earlier production deployment wording with a pointer to the strict checklist.
- `app/content/legal.js`
  - Public website metadata: assumed origin -> `https://YOUR_PRODUCTION_APP_URL`.
- `SHOPIFY_PRODUCTION_CONFIG_REPORT.md`
  - Added this readiness report.

No OAuth flow, scope, webhook handler, local-dev script, or business behavior was changed.

## 4. Remaining human actions

1. Replace the actionable placeholders listed in section 5. Use one real HTTPS origin with no trailing slash everywhere.
2. Set the production environment's `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SCOPES=read_products`, plus the required database/storage values.
3. In the Shopify Partner/Dev Dashboard, set **App URL** to the real production origin.
4. Set the sole **Allowed redirection URL** to `<production-origin>/auth/callback`.
5. Confirm the deployed app version contains and can receive signed requests at:
   - `/webhooks/app/scopes_update`
   - `/webhooks/app/uninstalled`
   - `/webhooks/customers/data_request`
   - `/webhooks/customers/redact`
   - `/webhooks/shop/redact`
6. Confirm the Dashboard embedded-app setting is enabled, matching `embedded = true`.
7. Confirm the requested/granted scope is exactly `read_products`; reinstall or approve the changed grant on the review store if required.
8. Deploy the application, then—only when the real values and endpoints are ready—publish the app configuration using the documented command in section 8.
9. Test a clean embedded install, OAuth callback, valid/invalid signed webhook deliveries, uninstall cleanup, and the complete review journey against the deployed review store.

## 5. Placeholders to replace

### Actionable Shopify values (5)

| File and line | Placeholder/action |
| --- | --- |
| `shopify.app.toml:5` | Replace `https://YOUR_PRODUCTION_APP_URL` with the real origin. |
| `shopify.app.toml:40` | Replace the origin in `https://YOUR_PRODUCTION_APP_URL/auth/callback`. |
| `.env.example:2` | Supply the real production Shopify API key through the deployment secret/config system; do not commit it. |
| `.env.example:3` | Supply the real production Shopify API secret through the deployment secret manager; do not commit it. |
| `.env.example:4` | Replace `https://YOUR_PRODUCTION_APP_URL` with the real origin. |

`app/content/legal.js:8` also contains the URL placeholder and must be updated to the real public origin before submission. This makes **6 repository runtime/config values requiring replacement**, of which **5 are Shopify configuration/credentials**.

README occurrences at lines 20, 23-24, and 26-30 are documentation templates showing the corresponding Dashboard and webhook values. They are not runtime inputs.

Other production placeholders already present in `.env.example` must be supplied according to enabled services: PostgreSQL credentials/host at line 8; private bucket and credentials at lines 14-19; analyzer URL/key at lines 24-25 only if the analyzer is enabled. Empty optional S3 endpoint and workload-credential fields may remain empty when the selected provider does not require them.

## 6. Scopes assessment

Current configured scope: **`read_products`** (`shopify.app.toml:37`, `.env.example:5`).

This appears minimal and consistent. The production runtime performs a read-only products query (`app/models/blueprint.server.js:18-38,1113`). No production customer, order, draft-order, or write operation was found. `scripts/seed-shopify-dev-store.mjs` contains broader product/customer/order mutations, but it is an explicitly separate development-store operator script and those permissions are not requested by the submitted app configuration. No scope change was made.

## 7. Validation results

Checks were run in the required order against the final edited state:

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **PASS** (exit 0; no lint errors) |
| Typecheck | `npm run typecheck` | **PASS** (exit 0; React Router v8 future-flag warnings only) |
| Build | `npm run build` | **PASS** (exit 0; existing future-flag, empty server-route chunk, and mixed static/dynamic import warnings only) |
| Tests | `npm test` | **PASS** (149 passed, 0 failed, 0 skipped/cancelled) |

The warnings are unrelated to these placeholder/configuration edits. No unrelated failure was fixed.

## 8. Commands to run later (documented only)

After replacing all required values, deploying the web service, and verifying public endpoints:

```shell
shopify app deploy
```

This command was **not run** during this work.

## 9. Explicit confirmation

Nothing was deployed or submitted to Shopify. Shopify CLI was not run. No Partner/Dev Dashboard setting or external service was changed. No real secret or newly guessed real production URL was added; only conspicuously fake placeholders were introduced.
