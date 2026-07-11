# BluePrintAI Shopify Plugin Final Audit

Audit date: July 11, 2026  
Repository: `/Users/mohammedabb07650/Documents/blue-print-ai`

## Executive summary

BluePrintAI is not yet ready to submit. The repository is materially stronger than the current deployed build: authentication, shop scoping, mandatory compliance routes, free-app billing behavior, private media controls, Google Ads token/state handling, the AI Review Studio lifecycle, Creative Briefs lifecycle, production migration scripts, and merchant-safe error paths are implemented and covered by automated tests.

This pass fixed four P1 implementation issues: production no longer asks direct visitors to type a shop domain; public deletion instructions now match the in-app deletion control; privacy copy now matches the `read_products` scope; and `/health` is now a true resource route. It also aligned visible headings with navigation, clarified optional data paths, removed risky “winning/proven” copy, and added keyboard focus management to the production deletion dialog.

Submission blockers remain outside the completed code fixes: no compliant listing icon, feature media, or 3–6 final screenshots exist in the repository; final reviewer access/testing information and controlled third-party credentials are not filled; the mandatory review screencast has not been recorded; the exact reviewed build is not deployed; and Shopify install/reinstall, signed webhook deliveries, production migrations, object storage, analyzer, and Google Ads flows still require live verification.

## Final readiness status

**NOT READY — BLOCKERS REMAIN**

No P0 code defect remains, but the listing and reviewer package is incomplete and the exact reviewed build has not completed its live Shopify path.

## Shopify sources used

The installed Shopify plugin was used throughout. Its required App Store self-review workflow was initialized with `app-store-review`, and the canonical local-check requirement set was fetched with:

```text
shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements
```

Primary Shopify guidance:

- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Best practices for App Store apps](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review)
- [Submit an app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
- [Shopify App Pricing and billing](https://shopify.dev/docs/apps/launch/billing)
- [Privacy law compliance and mandatory webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Privacy policy guidance](https://shopify.dev/docs/apps/launch/privacy-requirements)
- [React Router admin authentication](https://shopify.dev/docs/api/shopify-app-react-router/latest/guide-admin)

Official requirements are labeled below. Shopify best practices are identified separately from repository findings and live checks.

## Shopify AI self-review subset

The fetched local-code checklist contains 31 unconditional requirements and 10 category groups. Evaluation against the current repository:

- Likely passing: 26
- Likely failing: 0
- Needs review: 5
- Groups skipped: 10

Needs review: factual listing content (the submitted listing is unavailable), free pricing alignment in Partner Dashboard, first install, post-install UI redirect, and reinstall behavior. These cannot be proven from the local repository alone.

Skipped because no signal exists: theme app extension, payment app, payment facilitator, purchase option, product sourcing, checkout customization, sales channel, post-purchase, mobile app builder, and donation groups.

## Requirements checklist

| Area | Shopify requirement or guidance | Status | Evidence / remaining check |
| --- | --- | --- | --- |
| Truthful app | Requirement 1.1.4: use factual information | Partially satisfied | Source labels and tests prevent fabricated metrics. Final listing and video claims are not yet available. |
| Billing | Requirements 1.2.1–1.2.3: use Shopify App Pricing/Billing API for charges | Partially satisfied | Repository and legal copy consistently describe the current app as free; no external billing provider was found. Verify Partner Dashboard is Free and external billing is unchecked. |
| Shopify API | Requirement 2.2.1 | Satisfied | `read_products`; Admin GraphQL product query; no standalone API-key setup. |
| App Bridge | Requirement 2.2.3 | Satisfied | `@shopify/shopify-app-react-router` AppProvider injects current CDN `app-bridge.js` before application scripts. |
| Admin API | Requirement 2.2.4: GraphQL Admin API | Satisfied | App product access and dev seed tooling use GraphQL; no general REST Admin API use found. |
| Install source | Requirement 2.3.1: initiate from Shopify-owned surface | Satisfied in current code; deployment required | Production recovery no longer renders a shop-domain input. Valid `?shop=` requests still enter Shopify login/OAuth. |
| OAuth install | Requirements 2.3.2–2.3.4 | Requires live verification | Official package handles install/token exchange. Clean install, callback, post-install UI, uninstall/reinstall were not exercised against Shopify. |
| Session tokens | Requirement 1.1.1 | Satisfied statically | `authenticate.admin` plus AppProvider/session-token flow. Incognito/third-party-cookie test still belongs in live review QA. |
| TLS | Requirement 3.1.1 | Satisfied for current deployed origin | HTTPS production pages and `/health` returned 200. The reviewed fixes still require deployment. |
| Scopes | Requirements 3.2.* | Satisfied | Only `read_products`; no protected customer/order or specialized scope. |
| Embedded experience | Requirement 2.2.2 and Shopify embedded guidance | Partially satisfied | Local client navigation preserved `host`/`shop`; back/forward worked. Installed Shopify iframe/direct refresh remains live-only. |
| Mandatory privacy webhooks | Shopify privacy law compliance | Satisfied statically; live verification required | TOML declares `customers/data_request`, `customers/redact`, `shop/redact`; handlers use `authenticate.webhook`. Invalid-HMAC 401 and signed delivery need live probes. |
| App lifecycle webhooks | `app/uninstalled`, `app/scopes_update` | Satisfied statically; live verification required | Both configured and authenticated. Cleanup is shop-scoped and idempotent through `deleteMany`. |
| Privacy policy | Required App Store listing field | Satisfied in current code | `/privacy` is public and reachable. Copy matches `read_products` after this fix; deploy the reviewed build. |
| Data deletion | Privacy guidance and redaction duties | Satisfied in current code | Settings offers confirmed shop-scoped deletion; uninstall/shop-redact share cleanup; public instructions now match. |
| Support | Shopify submission/support expectations | Partially satisfied | Public `/support` and `support@blueprintai.app` exist. Inbox monitoring and response ownership are unverified. |
| Listing descriptions | Requirements 4.4.1–4.4.2 | Not satisfied | Draft copy is provided in the listing checklist, but Partner Dashboard content was not inspected. |
| Listing images | Requirements 4.4.3–4.4.5 | Not satisfied | No submission icon, feature media, or compliant 1600×900 screenshot set exists. |
| Testing credentials | Requirements 4.5.4–4.5.5 | Not satisfied | Placeholder reviewer instructions exist; no controlled review account details are finalized. |
| Demo screencast | Requirement 4.5.3 | Not satisfied | Mandatory English/English-subtitled step-by-step review video not recorded. |
| Emergency contact | Requirement 4.5.6 | Requires live verification | Partner Dashboard contact cannot be verified from repository. |
| Install eligibility | Shopify listing best practice | Requires live verification | No geographic, currency, POS, or Online Store dependency was found; avoid unnecessary restrictions. |
| Tracking disclosure | Listing/privacy accuracy | Partially satisfied | No storefront pixel or marketing analytics vendor found. Disclose essential Shopify auth/session technologies and server/security logs; verify Partner form. |

## P0 findings

No P0 code finding remains.

## P1 findings and resolutions

### Resolved in this pass

1. Production `/app` recovery displayed a manual `myshopify.com` input, conflicting with requirement 2.3.1. Production now gives an “Open from Shopify Admin” recovery page; only Shopify-provided `shop` install requests enter the OAuth helper.
2. `/data-deletion` contradicted Settings by saying no in-app deletion control existed. It now names Settings → Legal & Privacy → Delete BluePrintAI data and the required `DELETE` confirmation.
3. In-app privacy copy claimed Shopify order/performance access although the app requests only `read_products`. It now states the exact current scope and absence of customer/order scopes.
4. `/health` returned the full React document and lost the intended `text/plain`/`no-store` contract. Removing the component export makes it a resource route.
5. The deletion dialog left focus behind the modal and did not support Escape/focus trapping. It now focuses the confirmation input, traps Tab, closes on Escape, and restores focus.
6. Four headings did not match sidebar terminology. They now render Campaigns, Creators, Data Import, and Connections.
7. Welcome and public copy used “proven patterns”/“winning recommendations” and did not explain optional data paths. Copy is now factual and explicit.

### Unresolved P1 submission gates

1. Create and approve a 1200×1200 PNG/JPEG app icon.
2. Create a compliant 1600×900 feature image or approved feature video and alt text.
3. Capture 3–6 unique 1600×900 screenshots from the exact deployed build.
4. Fill Partner Dashboard listing, pricing, tracking, support, emergency contact, install eligibility, and testing information.
5. Provide controlled review access and, if Google Ads is advertised/tested, a non-personal controlled test account.
6. Record the mandatory setup/core-feature screencast in English or with English subtitles.
7. Deploy this exact reviewed state and verify `/health` returns `ok`, `text/plain`, and `Cache-Control: no-store`.
8. Run `npm run setup:production` against Render PostgreSQL and verify production migration status.
9. Complete clean install, embedded navigation, direct refresh, back/forward, uninstall/reinstall, and third-party-cookie/incognito checks.
10. Deliver valid and invalid signed requests to all required webhook endpoints.
11. Verify private object storage, analyzer success/error/timeout, Google Ads OAuth/sync/reconnect/disconnect, and support inbox ownership.

## P2 findings

- React Router v8 future-flag warnings remain during typecheck/build.
- Vite reports several dynamic imports that stay in the main server chunk.
- Some authenticated lists cap at 100 or 1,000 rows instead of full pagination.
- The public landing page and policies use the owner-provided “BluePrintAI Commerce” identity; legal sufficiency and factual ownership remain owner/legal review items.
- Full visual inspection of every dialog and destructive flow was not completed; the production deletion dialog was inspected at 390×844 and fixed.

## P3 findings

- Add installed-store Playwright coverage for OAuth, iframe navigation, webhook delivery, providers, and object storage.
- Add production provider monitoring and alerting.
- Add pagination and database query profiling for large workspaces.
- Plan the React Router v8 upgrade separately.

## Authentication and embedded-app review

- `app/routes/app.jsx` authenticates the app layout with `authenticate.admin` outside a localhost-only non-production demo boundary.
- Child actions inspected call `loadShopifyRouteContext`, which derives `session.shop`; no mutation trusts a form/query shop value.
- Official React Router package guidance explicitly supports `authenticate.admin` for token exchange and session creation. AppProvider injects current App Bridge.
- `boundary.error` and `boundary.headers` are exported from the authenticated layout.
- Internal links preserve `embedded`, `host`, `id_token`, `locale`, and `shop` when present.
- Google Ads state is signed, short-lived, shop-bound, constant-time compared, and restricts return targets to `/app/*`.
- Current code prevents the manual production shop-domain form. The deployed origin still reflects the older build until redeployed.

## Billing review

- Current intended pricing: Free.
- `SHOPIFY_BILLING_REQUIRED=false`; production validation rejects `SHOPIFY_BILLING_BYPASS=true`.
- No Stripe, PayPal, external checkout, external app-charge form, or off-platform billing was found.
- Legal/refund copy consistently says there is no current charge.
- Shopify guidance requires Shopify App Pricing or Billing API for any future charge; Shopify App Pricing is now the recommended default.
- Partner Dashboard must show Free; external billing must remain unchecked.

## Compliance webhook review

- Configured: `app/uninstalled`, `app/scopes_update`, `customers/data_request`, `customers/redact`, `shop/redact`.
- Mandatory compliance handlers use `authenticate.webhook`, which performs Shopify HMAC verification.
- Uninstall/shop-redact delete shop-scoped media, workspace rows, platform connections/campaigns/performance, sessions, briefs, reviews, creatives, creators, imports, settings, and activity.
- Customer handlers acknowledge because the Prisma schema stores no Shopify customer model; this must be revisited before adding customer/order storage.
- Duplicate/missing data is safe through `deleteMany` and shop-scoped cleanup.
- Live invalid-HMAC 401, signed 2xx, retry, and production PostgreSQL cleanup remain unverified.

## Security and shop-isolation review

- No committed credential was identified by tracked-file pattern scans.
- `.env`, SQLite, local uploads, private media, `.DS_Store`, Python bytecode, and caches are ignored.
- Google refresh tokens use AES-256-GCM and fail closed without a valid key; access tokens are not persisted.
- Uploads enforce request/file limits, file extensions, MIME/signatures, sanitized names, private shop-prefixed storage, and authenticated media delivery.
- No `dangerouslySetInnerHTML` was found.
- ID-based models/actions inspected include authenticated shop predicates; regression tests cover cross-shop campaigns, creatives, media, reviews, briefs, creators, assistant context, and deletion.
- Merchant error translation removes configuration names, provider bodies, request IDs, database/filesystem/stack details.

## Migration and deployment review

- Local SQLite and production PostgreSQL schemas differ only in datasource configuration.
- Local tree: 14 migrations; local status is up to date.
- Production tree: PostgreSQL baseline plus five additive migrations.
- `20260710160000_add_video_analysis_lifecycle` is identical in both trees and adds safe defaults/indexes.
- `20260710190000_redesign_creative_briefs` is identical in both trees and adds nullable fields, `DRAFT`, idempotency uniqueness, and indexes.
- No migration reset or destructive production command exists; historical migrations were not changed.
- `setup:production` derives/validates the production schema, generates Prisma Client, and uses `prisma migrate deploy`.
- No `render.yaml` exists; Render Dashboard is the deployment source of truth.

Exact Render configuration:

```text
Build:      npm ci && npm run build
Pre-deploy: npm run setup:production
Start:      npm run start
Health:     /health
```

Docker uses `npm run docker-start`, which runs setup before start. For Render native deployment, keep migration deployment in the single pre-deploy phase to avoid multi-instance migration races.

## Listing and feature-media review

Repository evidence:

- App name in TOML: BluePrintAI; under Shopify's 30-character best-practice limit.
- `public/favicon.ico` is 64×64 and is not a compliant App Store icon.
- No 1200×1200 PNG/JPEG listing icon exists.
- No 1600×900 feature image exists.
- No 3–6 image 1600×900 screenshot set exists. Parity captures are 390/768/1024/1280/1440 × 1000 and are QA artifacts, not listing assets.
- No final feature or review video exists.

Shopify best practices specify 1200×1200 PNG/JPEG icon; 1600×900 feature image; 3–6 unique 1600×900 screenshots; alt text; no browser/desktop chrome, PII, pricing, reviews, guarantees, Shopify trademarks, logo-only images, or duplicates. Feature-video guidance recommends 2–3 minutes, promotional rather than instructional, with screencast footage limited to 25%. This recommendation is distinct from the mandatory reviewer screencast in requirement 4.5.3.

## Browser QA

Completed locally against the post-build app:

- All ten major routes rendered at 390×844, 768×1000, and 1440×1000 without document-level horizontal overflow.
- Headings match primary navigation after fixes.
- Navigation click preserved embedded `host`/`shop`; browser back and forward returned to expected routes.
- Welcome and onboarding rendered at 390px; onboarding exposes Complete setup and Skip for now.
- Creative Library loaded five authenticated local video routes; one reached readyState 4 and all had no media error.
- Deletion dialog fits 390×844, focuses the confirmation input, traps Tab, closes with Escape, and restores trigger focus.
- No captured local or production console warning/error was present.

Completed against the currently deployed origin:

- `/privacy`, `/terms`, `/support`, `/contact`, `/data-deletion`, `/cookies`, `/acceptable-use`, `/refund-policy`, `/ai-disclaimer`, `/copyright`, and `/` loaded publicly over HTTPS without auth or placeholder markers.
- `/health` returned HTTP 200, but the deployed build still uses the old document response. Deploy the resource-route fix before relying on its headers/body.

Not completed:

- No existing signed-in Shopify Admin browser tab was available.
- Clean install, iframe navigation, session-token/incognito, live analyzer, S3/R2, Google Ads, signed webhook, and production database flows remain manual.

## Automated verification

- Tests: 282 passed, 0 failed.
- Lint: passed after the accessibility fix.
- Typecheck: passed with React Router future warnings.
- Build: passed with non-fatal Vite chunk warnings.
- Local Prisma format/validate/generate: passed.
- Production Prisma format/validate/generate: passed with a dummy non-secret PostgreSQL URL.
- Local migration status: 14 migrations, up to date.
- Production migration status: not run; real Render credentials were intentionally not used.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed after final document creation.

## Remaining live checks

1. Deploy this exact state.
2. Verify Render build/pre-deploy/start/health configuration and production migrations.
3. Install on a clean Shopify review store and test reinstall/incognito/direct refresh/back-forward.
4. Exercise valid and invalid signed webhooks.
5. Verify private media across deploy/navigation/reload.
6. Verify analyzer and Google Ads with controlled accounts/data.
7. Confirm support inbox and emergency developer contact.
8. Finalize listing fields/assets, controlled test access, and mandatory screencast.

## Final recommendation

Do not submit or record the final video yet. Finish the listing asset package, deploy this exact build, and complete the live Shopify/provider checks. Reassess readiness only after those checks pass without new P0/P1 findings.
