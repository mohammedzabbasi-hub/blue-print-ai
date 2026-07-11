# BluePrintAI Shopify Partner Dashboard Checklist

Complete this against the active production configuration and listing immediately before submission. Record screenshots in the private evidence folder referenced by `SHOPIFY_MANUAL_REVIEW_EVIDENCE.md`.

| Dashboard item | Required production value / verification | Done | Evidence / notes |
| --- | --- | --- | --- |
| App URL | Exact stable origin `https://YOUR_PRODUCTION_APP_URL` only after confirming it is the live hosted service and equals `SHOPIFY_APP_URL` and `shopify.app.toml` | ☐ |  |
| Allowed redirect URLs | Exactly `https://YOUR_PRODUCTION_APP_URL/auth/callback`; remove stale localhost, tunnel, old-domain, `/auth/shopify/callback`, and `/api/auth/callback` entries | ☐ |  |
| Embedded app | Enabled; clean install opens inside Shopify Admin with App Bridge navigation and no framing/CSP error | ☐ |  |
| App proxy | Not configured because the repository declares no app proxy. If Dashboard differs, stop and reconcile before submission | ☐ |  |
| Distribution type | Select the intended public App Store distribution; confirm it matches the submission and is not a custom/single-merchant distribution by mistake | ☐ |  |
| Pricing / free listing | **Free**; no recurring, one-time, usage, or external charge. Production uses `SHOPIFY_BILLING_REQUIRED=false` and `SHOPIFY_BILLING_BYPASS=false` | ☐ |  |
| Contact/support email | `support@blueprintai.app`; owner-approved address for BluePrintAI Commerce; matches public Support page and reviewer instructions; test receipt/reply without exposing messages in repo screenshots | ☐ |  |
| Privacy URL | `https://YOUR_PRODUCTION_APP_URL/privacy`; public, HTTPS, current, no placeholders | ☐ |  |
| Terms URL | `https://YOUR_PRODUCTION_APP_URL/terms`; public, HTTPS, current, no placeholders | ☐ |  |
| Support URL | `https://YOUR_PRODUCTION_APP_URL/support`; public, HTTPS, matches staffed contact/process | ☐ |  |
| Data deletion URL/process | `https://YOUR_PRODUCTION_APP_URL/data-deletion`; process agrees with compliance webhooks and privacy copy | ☐ |  |
| App icon | Final BluePrintAI icon at Shopify-required size/format; sharp at small size; no transparency/cropping/text-legibility issue; rights cleared | ☐ |  |
| Screenshots | Upload only current production images selected from `SHOPIFY_SCREENSHOT_PLAN.md`; correct dimensions/order; no fake UI, secrets, or personal data | ☐ |  |
| Category | Choose the narrowest truthful primary/secondary categories for creative planning/marketing analytics; confirm feature claims fit the chosen category | ☐ |  |
| App description | Accurately describes creative workspace, CSV import, optional read-only Google Ads reporting, video review availability, advisory estimates, and no guaranteed outcomes; no unsupported Meta/TikTok/direct-management claims | ☐ |  |
| Scopes | Exactly `read_products`; matches TOML, production `SCOPES`, active version, consent screen, and actual product-read use | ☐ |  |
| Protected customer data | Declare accurately. Current app should not request protected customer/order scopes; answer Dashboard questions from actual processing and legal counsel, not assumption | ☐ |  |
| Webhook API version | Active deployed configuration matches `shopify.app.toml` (`2026-04` at packet creation) and is supported at submission time | ☐ |  |
| Webhooks | Active subscriptions: `app/scopes_update`, `app/uninstalled`, `customers/data_request`, `customers/redact`, `shop/redact`; endpoints and valid/invalid HMAC delivery verified | ☐ |  |
| Google Ads disclosure | Listing/review notes say optional and read-only/reporting-only; consent/data use matches Privacy; no requirement to connect an account | ☐ |  |
| Billing disclosure | Listing, legal pages, reviewer notes, and observed install all say Free/no current billing | ☐ |  |
| Reviewer instructions | Paste finalized `SHOPIFY_REVIEWER_INSTRUCTIONS.md`; replace bracketed fields; include test store/install route and safe asset location without secrets | ☐ |  |
| Review contact | Person monitoring Shopify review questions is assigned for the review window and can access production logs without sharing secrets | ☐ |  |
| Active app version | Published config version references the verified production URL, redirects, scope, and webhooks; record version ID and deployment timestamp | ☐ |  |

## Final cross-check

- [ ] Hosted deployed SHA = intended repository SHA = locally verified SHA.
- [ ] Dashboard App URL = production `SHOPIFY_APP_URL` = `shopify.app.toml` origin.
- [ ] Active redirects, scopes, embedded setting, and webhooks match `shopify.app.toml` exactly.
- [ ] Listing claims match the behavior observed during the clean install and Google Ads tests.
- [ ] All manual evidence rows pass and screenshot inventory is complete.
- [ ] The listing identifies BluePrintAI Commerce as operator and support@blueprintai.app as the support email; no unresolved legal placeholder, private test credential, or stale tunnel URL appears in the listing or public pages.

## Consolidated references

- `SHOPIFY_MANUAL_REVIEW_EVIDENCE.md` — master proof checklist and production evidence index.
- `SHOPIFY_REVIEWER_INSTRUCTIONS.md` — paste-ready reviewer narrative.
- `SHOPIFY_SCREENSHOT_PLAN.md` — listing and reviewer screenshot inventory.
- `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md` — environment and production-service prerequisites.
- `SHOPIFY_REVIEW_TEST_SCRIPT.md` — deeper clean-store QA matrix.
- `SHOPIFY_SUBMISSION_HANDOFF.md` and `MANUAL_SUBMISSION_TODO.md` — previous owner/infrastructure handoff; historical test counts and connector availability may be outdated.
- `FINAL_SHOPIFY_REVIEW_AUDIT.md`, `SHOPIFY_REVIEW_SIMULATION_REPORT.md`, `WEBHOOK_READINESS_REPORT.md`, and `STORAGE_PRODUCTION_REPORT.md` — supporting code-side audit history.
