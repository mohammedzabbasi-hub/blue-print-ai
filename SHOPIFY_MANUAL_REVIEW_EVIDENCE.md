# BluePrintAI Shopify Manual Review Evidence Packet

Use this packet against the exact production commit that will be submitted. Do not record secrets, OAuth codes, access tokens, customer data, or full Google Ads customer IDs in screenshots. Store evidence in a dated private folder such as `review-evidence/YYYY-MM-DD/` and record the commit SHA in every filename or the evidence index.

## Evidence header

| Field | Value |
| --- | --- |
| Production origin | `https://blueprintai-app.onrender.com` (verify; do not assume) |
| Submitted commit SHA |  |
| Render deploy ID and deployed SHA |  |
| Shopify app/config version |  |
| Test store | `blueprintai-test-store.myshopify.com` |
| Tester and date/time (timezone) |  |
| Browser/device |  |
| Evidence folder/link |  |

## Manual proof checklist

Mark exactly one checkbox per row. Use Notes for evidence filenames, timestamps, IDs safe to disclose, defects, and retest results.

| # | Check and where to click | Expected result | Screenshot to capture | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Render deployed latest GitHub commit:** Render Dashboard → BluePrintAI service → **Events/Deploys**; compare the deployed commit SHA with `git rev-parse HEAD` and the intended GitHub branch/commit. Open the live service after comparison. | Latest successful production deploy is the exact submission SHA; build/start succeeded; no newer unreviewed commit is deployed. | Render deploy detail showing service, successful status, timestamp, branch, and SHA. Hide environment values. | ☐ Pass ☐ Fail |  |
| 2 | **Production health:** Render → service → **Logs**; in a private browser open the production origin and `/support`, `/privacy`, and `/terms`. | HTTPS is valid; public pages return normally; logs show no startup loop, unhandled exception, mixed-content failure, or repeated 5xx. | Browser address bar plus one public page; separate sanitized Render log view around startup. | ☐ Pass ☐ Fail |  |
| 3 | **Fresh install:** Shopify Admin for `blueprintai-test-store.myshopify.com` → **Apps** → install BluePrintAI using the Partner Dashboard test/install link → approve access. | Consent requests only the intended Shopify access; OAuth returns to BluePrintAI embedded in Shopify Admin; onboarding/empty state loads without a billing prompt or redirect loop. | Access approval screen (no secrets), then embedded first-load/onboarding screen with Shopify Admin chrome visible. | ☐ Pass ☐ Fail |  |
| 4 | **Uninstall and reinstall:** Shopify Admin → **Settings → Apps and sales channels → BluePrintAI → Uninstall**. Confirm uninstall delivery/cleanup in sanitized logs/database, then reinstall with the test link. | Uninstall succeeds; shop-scoped session, app data, encrypted connection, and stored media are removed according to policy; reinstall creates a clean workspace and completes OAuth. | Uninstall confirmation, sanitized cleanup evidence, and clean post-reinstall onboarding. | ☐ Pass ☐ Fail |  |
| 5 | **Google Ads connect:** BluePrintAI sidebar → **Connections** → Google Ads → **Connect Google Ads**; authorize a dedicated non-sensitive test Google account. | Google consent succeeds and returns to Connections; app reports authorization and requests selection of an accessible account. No write/manage-ad claim or action appears. | Connections before authorization showing optional/CSV copy, Google consent scope summary, and returned account selector. Redact account IDs/email. | ☐ Pass ☐ Fail |  |
| 6 | **Google Ads account select:** Connections → **Select Google Ads account** → choose the designated test customer → **Select**. | Selected account is stored for this Shopify shop; card shows connected account and enables **Sync now** and **Disconnect**. | Connected Google Ads card with masked customer identity and both controls visible. | ☐ Pass ☐ Fail |  |
| 7 | **Google Ads sync:** Connections → **Sync now**; then inspect Dashboard/Creative Library where synced records appear. | Sync completes without changing Google Ads; success reports the number of daily performance rows (including `0`); synced metrics are labeled Google Ads/connected-platform data, not demo or CSV data. | Sync success notice and one destination view showing the synced-source label. | ☐ Pass ☐ Fail |  |
| 8 | **Google Ads disconnect:** Connections → **Disconnect**; optionally verify the grant in the Google Account security page. | Connection and encrypted refresh token are removed from BluePrintAI; card returns to no active connection. If Google revocation fails, the app gives a warning and local disconnect still completes. | Disconnect result/no-active-connection card; warning if encountered. | ☐ Pass ☐ Fail |  |
| 9 | **Empty Google Ads account:** connect/select a permitted test customer with no reportable activity in the last 30 days → **Sync now**. | App completes safely with `0 daily performance rows synced`; Dashboard/Library show an honest empty state and do not invent impressions, clicks, spend, conversions, or revenue. | Zero-row success notice and resulting empty state. | ☐ Pass ☐ Fail |  |
| 10 | **Logged-out support/legal:** sign out or use a private browser and open `/support`, `/privacy`, `/terms`, `/contact`, and `/data-deletion`. Follow page links. | Pages are public over HTTPS, readable without Shopify authentication, mutually navigable, and contain no placeholder/operator-action text or broken links. Published support contact/process matches the listing. | Full-page captures of Support, Privacy, and Terms; one capture proving logged-out/private context. | ☐ Pass ☐ Fail |  |
| 11 | **Partner Dashboard App URL:** Partner Dashboard → Apps → BluePrintAI → **Configuration / URLs**. Compare App URL to Render and `SHOPIFY_APP_URL`. | App URL is the exact stable HTTPS production origin, with no localhost/tunnel, placeholder, path mismatch, or trailing-origin discrepancy. | Dashboard App URL field and a separate production service URL capture. Never expose secrets. | ☐ Pass ☐ Fail |  |
| 12 | **Allowed redirection URLs:** Partner Dashboard → BluePrintAI → **Configuration / URLs**; compare every entry to `[auth].redirect_urls` in `shopify.app.toml`. | Dashboard and the active app version exactly match the reviewed TOML entries: `/auth/callback`, `/auth/shopify/callback`, and `/api/auth/callback` on the production origin. Every retained callback is HTTPS and handled intentionally; remove stale URLs before submission. | Full redirect URL list and active config/version identifier. | ☐ Pass ☐ Fail |  |
| 13 | **App proxy/settings if applicable:** Partner Dashboard → BluePrintAI → **Configuration → App proxy** (or equivalent). Also inspect `shopify.app.toml`. | Current repository declares no app proxy; Dashboard shows none configured. If a proxy exists, stop and reconcile its prefix/subpath/URL with reviewed code before proceeding. | App proxy section showing not configured, or the reconciled settings if intentionally used. | ☐ Pass ☐ Fail |  |
| 14 | **Free/no billing:** Partner Dashboard → listing/distribution → **Pricing**; Render environment → billing flags; install and navigate the app. | Listing is Free; `SHOPIFY_BILLING_REQUIRED=false` and `SHOPIFY_BILLING_BYPASS=false`; no charge approval or plan gate appears. Legal/listing copy says the current app is free. | Listing pricing selection, sanitized environment variable names/boolean values, and normal post-install app screen. | ☐ Pass ☐ Fail |  |
| 15 | **Scopes match use:** Partner Dashboard/config version → **Access scopes**; compare `shopify.app.toml`, production `SCOPES`, consent screen, and app behavior. | Requested/granted scope is exactly `read_products`; no write, order, customer, or ad-management scope is requested. Reinstall after any grant change. | Scope field/version and install consent summary. | ☐ Pass ☐ Fail |  |
| 16 | **Webhooks configured:** Partner Dashboard → active app version/configuration → **Webhooks**; compare `shopify.app.toml`. | API version and five subscriptions are active: `app/scopes_update`, `app/uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact`, with the reviewed relative endpoints. | Active version webhook subscription list. | ☐ Pass ☐ Fail |  |
| 17 | **Webhook delivery:** send Shopify-valid signed test deliveries from the Dashboard/approved tooling, then invalid-signature requests, for all five endpoints; inspect delivery status and sanitized logs. | Valid deliveries return success and perform expected idempotent work; invalid HMAC is rejected; retries do not duplicate destructive work; no secret/body containing personal data is logged. | Dashboard delivery result plus sanitized logs for one valid and one rejected request; evidence index records all five topics. | ☐ Pass ☐ Fail |  |
| 18 | **Production database:** create a harmless app record/settings change, refresh/restart the service if safe, and reopen; inspect the managed database using authorized read-only tooling. | Data persists across navigation/restart, is isolated to the test shop, migrations are current, TLS/managed PostgreSQL is in use, and uninstall/redaction cleanup works. | Before/after UI plus sanitized row-count/migration evidence (no tokens or merchant data). | ☐ Pass ☐ Fail |  |
| 19 | **Production object storage:** upload a safe test video in AI Review Studio/Data Import, play it, verify another shop/logged-out request cannot access it, delete it, and inspect private bucket metadata. | Upload/playback works only when authorized; bucket is private; deletion removes the object; failure handling is non-destructive. | Upload/playback UI, access-denied evidence, and sanitized bucket object/deletion metadata. | ☐ Pass ☐ Fail |  |
| 20 | **Capture reviewer journey:** follow `SHOPIFY_SCREENSHOT_PLAN.md` after resetting to representative safe data. | All required screens are legible, current, free of personal data, and show correct demo/imported/estimated/synced provenance. Reviewer-evidence screenshots retain Shopify Admin chrome where embedded behavior matters. | Completed screenshot inventory with filenames and intended use. | ☐ Pass ☐ Fail |  |

## Production verification commands and records

Run locally against the submitted SHA and record results; these supplement, not replace, the live checks above.

```sh
git rev-parse HEAD
npm run lint
npm run typecheck
npm run build
npm test
git diff --check
```

Record: lint ☐, typecheck ☐, build ☐, **161 tests** ☐, diff check ☐. Do not claim 161 unless the submitted SHA reproduces it.

## Go/no-go

- [ ] Every row above is Pass or has been fixed and retested.
- [ ] Render SHA, GitHub SHA, local submitted SHA, and Shopify active config version are recorded.
- [ ] No screenshot contains a secret, token, OAuth code, full ad account ID, personal data, or unrelated browser content.
- [ ] `SHOPIFY_PARTNER_DASHBOARD_CHECKLIST.md` is complete.
- [ ] Reviewer instructions match observed production behavior exactly.
- [ ] Serious discrepancies are resolved before submission; do not explain around a broken install, callback, webhook, storage, or deletion flow.

## Related repository evidence

- `SHOPIFY_REVIEW_TEST_SCRIPT.md` — broader clean-store and edge-case test script.
- `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md` — production environment prerequisites.
- `SHOPIFY_SUBMISSION_HANDOFF.md` and `MANUAL_SUBMISSION_TODO.md` — historical blockers and owner actions; treat older connector/test-count statements as superseded by current code and this packet.
- `FINAL_SHOPIFY_REVIEW_AUDIT.md`, `SHOPIFY_REVIEW_SIMULATION_REPORT.md`, and `FINAL_SHOPIFY_QA_REPORT.md` — code-review history, not production proof.
- `WEBHOOK_READINESS_REPORT.md`, `STORAGE_PRODUCTION_REPORT.md`, and `docs/GOOGLE_ADS_INTEGRATION_SETUP.md` — subsystem detail.

