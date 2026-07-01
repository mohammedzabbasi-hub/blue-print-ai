# Shopify Webhook Readiness Report

Date: 2026-06-30

## Summary verdict

**Yes-after-owner-tasks.** The code is review-ready for the required uninstall and privacy webhooks: each route authenticates with Shopify before acting, success responses are HTTP 200, customer privacy routes correctly avoid pretending to manage Shopify customer data, and shop cleanup is scoped to the verified shop. The TOML webhook API version was corrected from the not-yet-supported `2026-07` value to `2026-04`, matching `ApiVersion.April26` in the server initialization and the installed Shopify API package.

Production readiness still depends on publishing the TOML configuration, deploying reachable HTTPS callbacks, and completing Shopify and legal owner tasks listed below.

## Inspection findings

### `shopify.app.toml`

- `application_url`: `https://blueprintai.app`
- Scope: `read_products`
- Webhook API version after the minimal fix: `2026-04`
- App-specific subscriptions: `app/scopes_update` and `app/uninstalled`
- Compliance subscriptions: `customers/data_request`, `customers/redact`, and `shop/redact`
- Registration mechanism: app configuration TOML. `include_config_on_deploy = true`; production changes take effect when an app version is deployed with Shopify CLI.

### `app/shopify.server.js`

The repository uses JavaScript (`app/shopify.server.js`), not the `.ts` filename suggested in the task. It initializes `shopifyApp(...)` from `@shopify/shopify-app-react-router/server` with `ApiVersion.April26`, App Store distribution, Prisma session storage, managed scopes from `SCOPES`, and expiring offline access tokens. There is no `webhooks` configuration object and no `afterAuth` registration hook because this app uses app-specific TOML subscriptions. It exports `authenticate`, `unauthenticated`, `login`, `registerWebhooks`, `sessionStorage`, `apiVersion`, and document response headers.

### Webhook routes

| Topic | Handler | HMAC | Payload action | Verdict |
| --- | --- | --- | --- | --- |
| `app/uninstalled` | `app/routes/webhooks.app.uninstalled.jsx` | `authenticate.webhook(request)` | Deletes private uploaded files, all app-owned workspace rows keyed by the verified shop, then all sessions for that shop. Repeated delivery is safe because file removal is forced and database cleanup uses `deleteMany`. Cleanup errors remain retryable 5xx responses; invalid HMAC requests are rejected before deletion. | PASS |
| `customers/data_request` | `app/routes/webhooks.customers.data_request.jsx` | `authenticate.webhook(request)` | Returns 200. No Shopify customer records/customer PII are stored, so no fabricated export is performed. | PASS |
| `customers/redact` | `app/routes/webhooks.customers.redact.jsx` | `authenticate.webhook(request)` | Returns 200. No Shopify customer records/customer PII are stored, so no fabricated deletion is performed. | PASS |
| `shop/redact` | `app/routes/webhooks.shop.redact.jsx` | `authenticate.webhook(request)` | Deletes private uploaded files, app-owned shop rows, and sessions for the verified shop. Shopify controls delivery after the waiting period. Repeated delivery is safe. | PASS |
| `app/scopes_update` | `app/routes/webhooks.app.scopes_update.jsx` | `authenticate.webhook(request)` | Updates the authenticated session's stored scopes when a session is present. | PASS |

`deleteWorkspaceData(shop)` covers every non-session Prisma model in both local and production schemas and deletes the verified shop's local or S3-backed media prefix before the database transaction. The schemas contain app workspace/merchant data and Shopify staff session fields, but no Shopify customer model. A `Creator.email` field is app-owned creator workspace data, not a Shopify customer record, and is removed by shop cleanup.

## Changes made

- `shopify.app.toml`: changed only the webhook serialization API version from `2026-07` to the currently supported `2026-04`, matching server initialization.
- `README.md`: added a Webhooks section with registration mechanism, exact callback paths, behavior, production deployment, reachability, and active-version verification steps.
- `app/models/compliance-webhooks.test.js`: added uninstall-route coverage, asserted the uninstall subscription and API version, and asserted that both shop cleanup routes call shop-scoped workspace and session deletion.
- `WEBHOOK_READINESS_REPORT.md`: added this audit and handoff report.

No OAuth flow, scope, billing code, UI, webhook route, cleanup implementation, or data model was changed.

## Already correct and left untouched

- All required routes already existed and authenticated through `authenticate.webhook(request)` before reading verified shop/topic data or deleting anything.
- The two customer privacy handlers already documented that the app stores no Shopify customer records and returned an empty HTTP 200 response.
- Uninstall and shop-redact already used the verified `shop` value and idempotent `deleteMany` operations.
- `deleteWorkspaceData` already removed shop-scoped database records and uploaded media from local private storage or the configured S3-compatible bucket.
- Compliance topics already used the correct `compliance_topics` TOML key. `app/uninstalled` already used the normal `topics` key.
- No additional scopes are required for these webhook deliveries.

## Search inventory

The requested case-insensitive terms were searched repository-wide with generated/build/dependency/database artifacts excluded. Operational matches are:

- `shopify.app.toml:12,15-16,19-33` — webhook section, callback URIs, normal topic, and compliance topics.
- `app/shopify.server.js:33` — exported `registerWebhooks`; no `webhooks:` object or `afterAuth` match exists.
- `app/routes/webhooks.app.scopes_update.jsx:5`, `webhooks.app.uninstalled.jsx:6,12`, `webhooks.customers.data_request.jsx:4,9`, `webhooks.customers.redact.jsx:4`, `webhooks.shop.redact.jsx:6` — authentication and lifecycle/privacy comments.
- `app/models/compliance-webhooks.test.js:6-9,28,31,36` — route, topic, configuration, and cleanup assertions.
- `README.md:13-14,28,39,49,51,55-59,63,70,241,248-249,255` — webhook, uninstall, privacy, deployment, and owner documentation.
- `app/content/legal.js:74,114-116,119,171,175,178,195,199,290,418,425-426,441-442,450`; `app/components/legal/LegalLayout.jsx:75-77,143,146`; `app/routes/privacy.jsx:4,7-8`; `app/routes/app.privacy.jsx:5,14-15`; `app/routes/app.settings.jsx:69,75,445,448,459`; `app/routes/app.onboarding.jsx:58,303,306,491`; `app/routes/app.jsx:283`; `app/routes/support.jsx:67,75-76`; `app/routes/_index/route.jsx:257-258` — legal/privacy UI and policy references.
- `app/models/blueprint.server.js:1040` — export redaction marker unrelated to Shopify compliance-topic handling.
- Existing audit/report documentation also contains historical matches: `docs/WEBHOOK_FIX_REPORT.md`, `REVIEW_COMPLETENESS_AUDIT.md`, `REVIEW_READINESS_AUDIT.md`, `SAVE_FEATURE_AUDIT.md`, `PARITY_AUDIT.md`, `FINAL_PARITY_REPORT.md`, and `CODEX_REPORT.md`. These are documentation only and were not treated as runtime evidence.

No uppercase source matches exist for `CUSTOMERS_DATA_REQUEST`, `CUSTOMERS_REDACT`, or `SHOP_REDACT`; the project consistently uses lowercase TOML topics and filename-based React Router routes.

## NON-CODE owner tasks

1. Deploy the production application at `https://blueprintai.app` (or update both production configuration and TOML to the actual final HTTPS origin) and ensure all callback paths return directly without 301/302/307 redirects.
2. Run `npm run deploy` to publish the TOML subscriptions in an active Shopify app version. Confirm the active version contains all four required subscriptions plus `app/scopes_update`; TOML is the source of truth, so separate Dashboard duplication is not required.
3. Send valid and invalid-HMAC webhook test deliveries against the deployed endpoints. Confirm valid deliveries return 200, invalid signatures are rejected, uninstall/shop-redact remove only the target shop's database rows/media/sessions, and duplicate deliveries are harmless.
4. Configure production PostgreSQL and private S3-compatible storage so deletion tests exercise the same persistence systems used in production.
5. Publish final privacy-policy and terms URLs, verify their factual retention/subprocessor/operator/contact statements, complete Shopify's data-protection questionnaire and App Store automated checks, and retain operational evidence of deletion handling.

## Code readiness versus legal/compliance readiness

This report confirms code-level webhook handling and configuration only. It does **not** assert legal compliance. Privacy-law obligations, policy accuracy, retention/backups, subprocessors, incident processes, and Shopify submission declarations require owner and, where appropriate, legal review.

## Validation

| Command | Result |
| --- | --- |
| `npm run lint` | PASS (exit 0) |
| `npm run typecheck` | PASS (exit 0); React Router v8 future-flag notices only |
| `npm run build` | PASS (exit 0); Vite informational dynamic/static import chunk notices and React Router future-flag notices only |
| `npm run test` | PASS (exit 0): 149 tests passed, 0 failed |

The existing test harness is Node's built-in test runner. The webhook tests are source/config contract checks rather than end-to-end signed HTTP delivery tests; deployed valid/invalid signature testing remains an owner task.
