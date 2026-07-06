# BluePrintAI for Shopify

BluePrintAI is a Shopify-native embedded app for merchant creative planning. It turns Shopify catalog context and saved app activity into product-specific ad angles, video analysis, recommendations, ad briefs, and a 7-day revenue blueprint.

Production deployment and App Store submission operators: see [SHOPIFY_SUBMISSION_HANDOFF.md](SHOPIFY_SUBMISSION_HANDOFF.md).

## Production submission requirements

Before Shopify review, the deployment owner must configure all of the following:

- Managed PostgreSQL through `DATABASE_URL`; SQLite is local/test-only.
- Private S3-compatible uploaded-file storage through `FILE_STORAGE_DRIVER=s3`, `S3_BUCKET`, and its region, endpoint, and workload credentials as applicable.
- Shopify `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, final HTTPS `SHOPIFY_APP_URL`, `SCOPES=read_products`, and a unique high-entropy `SESSION_SECRET` in the deployment secret manager.
- When Google Ads reporting is enabled: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REDIRECT_URI`, and `GOOGLE_ADS_ENCRYPTION_SECRET`; add `GOOGLE_ADS_LOGIN_CUSTOMER_ID` only when a manager account requires it.
- A production analyzer runtime or service. Set `ANALYZER_ENABLED=true` only when Python 3, OpenCV, and FFmpeg are installed and smoke-tested (or the server function is connected to an equivalent managed analyzer). With the flag off or a runtime failure, the upload is saved and the UI truthfully reports that analysis is unavailable; no scores or recommendations are generated or saved.
- Deployed and signed Shopify compliance webhooks for app uninstall, shop redact, customer data request, and customer redact, including verified database/object deletion.
- Owner-confirmed legal operator name/status, complete postal address, monitored privacy/support contacts, governing law, retention/subprocessor statements, pricing/refund terms, and rights to all demo assets and sample data.

The production environment is not submission-ready until these resources and facts have been verified in the deployed Shopify review store.

## Owner Legal & Support Checklist

The legal and support pages are scaffolding with owner-fill fields; they are not legally reviewed text. Before app submission, the owner must confirm every item below and have the Privacy Policy and Terms of Service reviewed by an appropriate qualified party.

- [ ] Confirm the legal business/entity name and entity status in `app/content/legal.js` (shown on `/terms` and `/contact`, including embedded counterparts).
- [ ] Confirm the support/contact email in `app/content/legal.js`, `app/routes/support.jsx`, and `app/routes/app.support.jsx` (used by Privacy, Contact, Support, and Data Deletion).
- [ ] Confirm the business mailing address in `app/content/legal.js` (shown on `/terms`, `/privacy`, and `/contact`).
- [ ] Confirm the effective date in `app/content/legal.js` (shown on all shared legal pages).
- [ ] Confirm the production website URL in `app/content/legal.js` (shown on `/terms` and `/contact`).
- [ ] Have governing-law, dispute, warranty, liability, indemnification, privacy-rights, incident-notification, and other Terms/Privacy language finalized by an appropriate qualified party in `app/content/legal.js`.
- [ ] Confirm hosting locations, subprocessors, backup retention, and any legally required retention in `app/content/legal.js` (`/privacy`).
- [ ] Confirm the deletion-request verification process and response-time expectations in `app/content/legal.js` (`/data-deletion`).
- [ ] Review and finalize the complete Privacy Policy (`/privacy`) and Terms of Service (`/terms`) before submission.

## Shopify Production Configuration

The committed Shopify configuration uses `https://blueprintai-app.onrender.com`. Before deploying a production app version, confirm that origin still matches Render and the Shopify Partner Dashboard, fill the production website owner-action field in `app/content/legal.js`, and complete these steps in order:

1. Deploy the web application and set its production environment variables. `SHOPIFY_APP_URL` must be the real HTTPS origin, `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` must come from the matching Shopify app, and `SCOPES` must be exactly `read_products`.
2. In the Shopify Partner/Dev Dashboard, set **App URL** to `https://blueprintai-app.onrender.com`.
3. Set the allowed redirection URL to `https://blueprintai-app.onrender.com/auth/callback` (and keep only callback variants used by the deployed Shopify configuration).
4. Confirm these app-specific webhook endpoint URLs from `shopify.app.toml` are present in the version being deployed and publicly accept signed Shopify requests:
   - `https://blueprintai-app.onrender.com/webhooks/app/scopes_update`
   - `https://blueprintai-app.onrender.com/webhooks/app/uninstalled`
   - `https://blueprintai-app.onrender.com/webhooks/customers/data_request`
   - `https://blueprintai-app.onrender.com/webhooks/customers/redact`
   - `https://blueprintai-app.onrender.com/webhooks/shop/redact`
5. Confirm the Dashboard's embedded-app setting is enabled, matching `embedded = true` in `shopify.app.toml`.
6. Confirm the requested access scope is exactly `read_products`, matching both `shopify.app.toml` and production `SCOPES`. Reinstall or approve the updated scope on the review store if Shopify requires it.
7. After replacing the repository placeholders and verifying the deployed endpoints, publish the configuration with `shopify app deploy`. This command is documented here only; do not run it until the real production values are in place.

Do not use a localhost, ngrok, TryCloudflare, or other temporary development URL for App Review. The temporary URLs later in this README are explicitly local-development examples and are never production configuration.

This app uses the Shopify React Router app architecture and preserves the Shopify scaffolded OAuth/session flow through `@shopify/shopify-app-react-router`.

## Merchant-facing pages

- Dashboard: saved workspace activity, labeled estimated readiness, product context, and action items.
- Creative Library: product-linked hooks, angles, visual concepts, and CTAs.
- Video Analysis: description-based hook, clarity, CTA, pacing, and retention-risk review.
- Recommendations: prioritized product and conversion recommendations.
- Ad Briefs: copyable hooks, captions, scripts, visual concepts, CTAs, and creator direction.
- Revenue Blueprint: diagnosis, priorities, conversion ideas, positioning, ad plan, and next 7 days.
- Settings: connected store, scopes, heuristic-analysis status, privacy notes, and support information.

## Shopify architecture

- Embedded app: `embedded = true` in `shopify.app.toml`.
- Auth/session handling: `app/shopify.server.js`.
- Authenticated routes: every `/app/*` loader/action calls `authenticate.admin(request)`.
- App Bridge wrapper: `AppProvider` in `app/routes/app.jsx`.
- UI: Shopify web components with a Shopify-compatible embedded navigation menu.
- Data access: Shopify GraphQL Admin API from server loaders/actions only.
- Session storage: Prisma via `@shopify/shopify-app-session-storage-prisma`.
- Uninstall cleanup: `APP_UNINSTALLED` deletes shop-scoped database records, private uploaded media, and sessions.

## Scopes used

Current `shopify.app.toml` scopes:

- `read_products`: required to load product titles, images, prices, and product status for creative planning.

No customer, order, draft-order, or write scopes are requested. Development seed scripts are separate operator tools and are not part of the submitted app's permissions.

## Webhooks

Webhook subscriptions are app-specific and declared in `shopify.app.toml` using API version `2026-04`. The app does not register shop-specific webhooks through `shopifyApp` or an `afterAuth` hook.

| Topic | Callback path | Behavior |
| --- | --- | --- |
| `app/uninstalled` | `/webhooks/app/uninstalled` | Verifies the Shopify HMAC, then deletes uploaded media, shop-scoped workspace records, and sessions for the verified shop. |
| `customers/data_request` | `/webhooks/customers/data_request` | Verifies the Shopify HMAC and acknowledges the request. The app does not store Shopify customer records or customer PII. |
| `customers/redact` | `/webhooks/customers/redact` | Verifies the Shopify HMAC and acknowledges the request. The app does not store Shopify customer records or customer PII. |
| `shop/redact` | `/webhooks/shop/redact` | Verifies the Shopify HMAC, then deletes uploaded media, shop-scoped workspace records, and sessions for the verified shop. Shopify controls delivery after its required waiting period. |
| `app/scopes_update` | `/webhooks/app/scopes_update` | Verifies the Shopify HMAC and updates the stored session scope. |

`shopify app dev` applies the configuration to the selected development store. For production, deploy the HTTPS application at the configured `application_url`, ensure every callback above is publicly reachable without a redirect, and follow the ordered production-configuration checklist above. Confirm that the active app version contains the subscriptions before submission; do not duplicate the compliance subscriptions in the Partner/Dev Dashboard when TOML is the source of truth.

## AI and privacy

- AI provider keys must stay server-side in environment variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`.
- The frontend never receives AI API keys or Shopify access tokens.
- Current review and recommendation outputs are deterministic or heuristic and are labeled accordingly. They do not require an external generative-AI key.
- Do not log Shopify access tokens or AI secrets.
- Store app-specific AI analysis in the app database only when needed. This build does not require Shopify metaobjects.
- Before public submission, publish and link a privacy policy describing collected merchant data, retention, subprocessors, and deletion workflow.
- Before public submission, publish and link terms of service.

## Billing readiness

Do not add Stripe or off-platform billing for public Shopify App Store distribution.

Paid plans use Shopify-managed pricing through the authenticated app billing check. Set `SHOPIFY_BILLING_REQUIRED=true` in production to require an active payment. `SHOPIFY_BILLING_BYPASS=true` is intended only for development/test stores; local/demo mode is always testable without payment.

## Optional integrations

Google Ads is available when its server-side configuration is complete. TikTok and Meta remain placeholders, and manual CSV import remains available. See [the Google Ads setup guide](docs/GOOGLE_ADS_INTEGRATION_SETUP.md).

## Google Ads development configuration

Google Ads OAuth uses a redirect derived from the current request origin: `/auth/google-ads/callback`. Both the OAuth start route and callback route calculate it from `request.url`; no tunnel hostname is hardcoded. In development, the server logs the active callback URL when a Google Ads connection starts. The log contains only the URL, never credentials, tokens, or OAuth state.

Required server-side variables:

- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN` (OAuth connection can be saved without it, but sync returns `Google Ads developer token not configured`)
- `GOOGLE_ADS_REDIRECT_URI`
- `GOOGLE_ADS_ENCRYPTION_SECRET` (or the shared `AD_PLATFORM_TOKEN_ENCRYPTION_KEY`)
- `AD_PLATFORM_TOKEN_ENCRYPTION_KEY` (32 random bytes encoded as base64 or 64-character hex)

Optional variables:

- `AD_PLATFORM_OAUTH_STATE_SECRET` (falls back to `SHOPIFY_API_SECRET`)
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for manager-account calls, without hyphens
- `GOOGLE_ADS_API_VERSION` (defaults to `v24`)

Generate an encryption key without placing it in source control, for example with `openssl rand -base64 32`, and store it in the deployment secret manager. There is intentionally no plaintext production fallback.

## Development

```shell
npm install
npx prisma generate
npm run dev
```

Local media is stored privately under `.data/private-media` and served only through an authenticated app route. It is never written to `public/`.

## Production File Storage and persistence

Production requires both:

- A managed PostgreSQL `DATABASE_URL`. `npm run setup:production` generates the PostgreSQL Prisma client and applies the baseline migration. SQLite remains local/test-only.
- A private S3-compatible bucket configured with `FILE_STORAGE_DRIVER=s3`, `S3_BUCKET`, and `S3_REGION`. Set `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, or use the hosting platform's AWS-compatible workload credentials. For Cloudflare R2, also set the account endpoint in `S3_ENDPOINT`; set `S3_FORCE_PATH_STYLE=true` only when the provider requires it. The bucket must not allow public reads; media is streamed through the authenticated `/app/media/...` route.

`MAX_UPLOAD_SIZE_BYTES` controls the per-video limit and defaults to `104857600` (100 MB). The accepted formats remain MP4, MOV, M4V, and WebM, with extension, MIME type, and file-signature validation. Leave all storage variables unset in local development to use `.data/private-media`; never use the local driver on an ephemeral production host. Partial S3/R2 configuration is treated as an error and never falls back to local storage.

The production container refuses a non-PostgreSQL database URL and refuses uploads when private object storage is not configured. See `.env.example` for the complete non-secret configuration contract.

### Option A: temporary Shopify trycloudflare tunnel

Use Shopify CLI's default Cloudflare Quick Tunnel when you do not need the hostname to survive restarts:

```shell
npm run dev
```

The generated `https://...trycloudflare.com` hostname can change each time. Before testing Google Ads OAuth, add its exact callback URL to the Google OAuth client in Google Cloud:

```text
https://CURRENT-TRYCLOUDFLARE-HOST/auth/google-ads/callback
```

### Option B: stable ngrok static domain

Reserve a static domain in ngrok, authenticate the ngrok CLI, and use one local port for both commands. Port `3000` is the default used by the wrapper:

```shell
ngrok http 3000 --url=https://your-stable-domain.ngrok-free.app
```

Leave ngrok running. In a second terminal, set the public origin (without a path or trailing callback) and start Shopify CLI:

```shell
SHOPIFY_DEV_TUNNEL_URL=https://your-stable-domain.ngrok-free.app npm run dev:tunnel
```

For a different local port, pass the same port to ngrok and set it explicitly:

```shell
ngrok http 4000 --url=https://your-stable-domain.ngrok-free.app
SHOPIFY_DEV_TUNNEL_URL=https://your-stable-domain.ngrok-free.app SHOPIFY_DEV_TUNNEL_PORT=4000 npm run dev:tunnel
```

`dev:tunnel` validates the URL, prints the active Google callback, and runs Shopify CLI with `--tunnel-url=https://your-stable-domain.ngrok-free.app:3000` (or the configured port). It does not create or manage ngrok, so ngrok must already be running. Extra Shopify CLI flags can be forwarded after `--`, for example:

```shell
SHOPIFY_DEV_TUNNEL_URL=https://your-stable-domain.ngrok-free.app npm run dev:tunnel -- --store=your-dev-store.myshopify.com
```

In Google Cloud Console, add this exact Authorized redirect URI to the web OAuth client:

```text
https://your-stable-domain.ngrok-free.app/auth/google-ads/callback
```

### Option C: staging deployment

Deploy the app to a stable HTTPS staging origin and configure the staging app/environment with the Google Ads server-side variables above. Update the staging Shopify app configuration or development app instance so its app URL and Shopify auth redirect URL use the staging domain, then add this exact Authorized redirect URI in Google Cloud:

```text
https://staging.your-domain.com/auth/google-ads/callback
```

Run the deployed app through that staging URL; `npm run dev:tunnel` is only for a locally running app behind a user-managed tunnel.

For every option, Google requires an exact scheme, hostname, port (if present), path, and trailing-slash match. Add `https://your-domain/auth/google-ads/callback`, not just the domain. Google Cloud changes can take a few minutes to propagate.

The app should work on a Shopify development store with generated test data. If the store has no products or API calls fail, BluePrintAI shows demo products and clear notices instead of 404/500 failures.

## Development store seeding

The dev-only seed workflow imports CSV files from `seed/` and populates only `blueprintai-test-store.myshopify.com` with labeled demo records. It refuses to run against any other shop.

```shell
npm run seed:shopify-dev -- --dry-run
npm run seed:shopify-dev
npm run seed:blueprintai-local
```

The script reads:

- `seed/shopify-dev-store-products.csv`
- `seed/shopify-dev-store-customers.csv`
- `seed/shopify-dev-store-orders.csv`
- `seed/shopify-dev-store-analytics-orders.csv`

It upserts products by handle with `productSet`, upserts customers by email with `customerSet`, creates draft orders with stable seed tags, and creates completed demo orders for `completed_demo_order` rows using Shopify Admin GraphQL `orderCreate` when the store token has `write_orders`. Repeated runs do not create endless duplicate draft/orders because seeded records use stable `blueprintai-*` tags.

All seeded Shopify records are labeled with `blueprintai-demo`, `final-review-demo`, and `seeded-by-blueprintai`. Created order records also include `not-real-customer-purchase` and `test: true`. Customer emails must use safe fake `example.com` addresses. The script never uses payment information, never creates real transactions, never completes draft orders, never creates fulfillments, never sends receipts, and never purchases shipping labels.

If no token is passed, the script looks for an offline session in the local Prisma `Session` table after the app has been installed on the dev store. You can also provide a token explicitly:

```shell
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_... npm run seed:shopify-dev
```

Shopify `orderCreate` requires `write_orders` and an offline token. Optional `test_order` rows are skipped as real test-order creation; use `completed_demo_order` rows when you want the script to attempt Shopify-supported completed demo order creation. If Shopify rejects `orderCreate` for the current app/store/scopes, the script logs a warning and continues creating other seed records.

The local BluePrintAI performance seed reads `seed/blueprintai-local-performance.csv` and upserts `SavedCreative` records with stable `performanceId` values for `blueprintai-test-store.myshopify.com`. These records are app-local demo performance data for BluePrintAI dashboards, Creative Library, creator pages, recommendations, and performance graphs. They are separate from Shopify Admin Analytics.

Shopify Analytics, Growth, and Attribution charts are generated by Shopify from real store records and Shopify-controlled analytics pipelines; they cannot be directly overwritten or instantly controlled from CSV. Draft orders may not appear as sales. Completed demo orders may contribute only where Shopify recognizes them as store events, and reporting can lag.

## AI Review Studio analyzer

Video uploads are stored using the existing private media-storage flow. Analysis runs only when `ANALYZER_ENABLED=true` and both `ANALYZER_SERVICE_URL` and `ANALYZER_API_KEY` are configured. `ANALYZER_TIMEOUT_MS` sets the complete HTTP request deadline and defaults to 60,000 ms when omitted or invalid.

The app posts the uploaded video as multipart form field `file` and authenticates with `Authorization: Bearer <ANALYZER_API_KEY>`. When the analyzer is disabled, incompletely configured, unreachable, times out, returns a non-2xx response, or returns malformed data, AI Review Studio reports that analysis is unavailable and renders no fallback scores, retention data, drop-off claims, or conclusions. Partial responses show only returned fields; missing metrics display `Not available`. Analyzer-declared heuristic or estimated output is labeled `Estimated`.

See `.env.example` for safe configuration examples. Never expose `ANALYZER_API_KEY` to browser code or commit a real key.

## Verification

Run:

```shell
npm run build
npm run lint
npx prisma generate
```

Optional:

```shell
npm run typecheck
```

## Install and uninstall testing

1. Install the app on a Shopify development store through `shopify app dev`.
2. Confirm every app nav item loads inside Shopify Admin.
3. Confirm Dashboard, Creative Library, Recommendations, Ad Briefs, Revenue Blueprint, and Settings work with no store products.
4. Add Shopify generated test products and reload the app.
5. Confirm product-specific recommendations and briefs use Shopify product data.
6. Trigger or perform app uninstall.
7. Confirm `APP_UNINSTALLED` webhook receives the event and sessions for that shop are deleted.

## App Store listing readiness checklist

- Add production app URL and redirect URLs.
- Add support email and support documentation URL.
- Add privacy policy URL.
- Add terms of service URL.
- Confirm listed features match reachable in-app pages.
- Confirm no TikTok OAuth, TikTok seller data, separate username/password login, or off-platform billing is required.
- Confirm all authenticated Shopify admin loaders/actions use `authenticate.admin`.
- Confirm scopes are minimal and documented.
- Confirm no protected customer data is requested.
- Confirm AI Review Studio reports analysis unavailable without analyzer configuration.
- Confirm empty, loading, and error states are visible and clear.
- Confirm app stays embedded in Shopify Admin.
- Confirm no broken routes, redirect loops, 404s, or unhandled 500s during review.
- Confirm claims avoid guaranteed revenue or performance outcomes.
- Confirm billing, if enabled later, uses Shopify App Pricing or Billing API.
