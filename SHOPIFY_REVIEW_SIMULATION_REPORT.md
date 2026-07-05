# Shopify App Review Simulation Report

Audit date: July 5, 2026  
Workspace: `/Users/mohammedabb07650/Documents/blue-print-ai` (confirmed writable)  
Verdict: **Code review-ready; submission not yet ready until the manual owner/deployment checks below pass.**

## New merchant journey

The production build preserves Shopify authentication and the embedded `AppProvider`. A local development-only reviewer workspace was used to exercise the merchant UI without weakening the production boundary. The app opens with a clear purpose, allows product/manual context without an ad connection, labels the entire demo workspace as sample data, and keeps Google Ads optional. All 22 tested embedded pages rendered a heading without an error boundary. Key workflows had no document-level horizontal overflow at 390 px.

The production build correctly redirected an unauthenticated direct `/app?demo=1` request to `/auth/login`; production query/environment bypass is intentionally disabled. A real fresh-store Shopify install cannot be simulated locally and remains mandatory before submission.

## Route checklist

| Route | Purpose | New merchant / empty behavior | Data source | Risk | Fix made or needed |
| --- | --- | --- | --- | --- | --- |
| `/app` | Entry and workspace orientation | Explains product, offers setup actions; production requires Shopify auth | Shopify/workspace | Low | Passed browser check |
| `/app/onboarding` | First-time setup | Product/manual setup; optional integrations can be skipped | Shopify/manual | Medium | Manually verify fresh install and completion redirect |
| `/app/dashboard` | Command Center | Empty/imported context is explicit; does not require Google | Shopify, CSV, saved activity, labeled demo | Low | Passed desktop/390 px |
| `/app/campaigns` | Organize campaigns | Clear creation and no-performance state | App records/imports | Low | Passed |
| `/app/campaigns/:id` | Campaign workspace | Unknown ID and no-performance paths exist | App records/imports | Low | Manually test a real and unknown ID |
| `/app/creative-library` | Saved/imported creative records | Explains only saved/uploaded records appear | Upload, CSV, labeled demo | Low | Passed desktop/390 px |
| `/app/creative-library/:id` | Creative detail deep link | Redirects to canonical detail/modal; missing values stay unavailable | Upload/CSV | Low | Automated coverage present |
| `/app/video-analysis` | AI Review Studio | Upload guidance; disabled analyzer fails closed | Upload plus heuristic/analyzer output | Medium | Configure analyzer or describe it as unavailable in reviewer notes |
| `/app/recommendations` | Evidence-based advisor | No-data fallback does not invent a winner | Deterministic/AI-estimated planning output | Low | Passed; keep advisory wording |
| `/app/ad-briefs` | Generate planning briefs | Requires available product context and guides merchant | Shopify/CSV context; generated estimate | Low | Passed |
| `/app/revenue-blueprint` | Revenue planning | Missing metrics remain unavailable; estimates disclosed | Shopify/CSV context; AI/heuristic estimate | Medium | Passed; never describe as guaranteed revenue |
| `/app/creators` | Creator comparison | Imported-only records; guidance labeled heuristic | CSV/imported attribution | Low | Passed |
| `/app/creators/:creatorId` | Creator detail | Imported evidence and unknown creator handling | CSV/imported attribution | Low | Manually verify deep link in deployed app |
| `/app/data-import` | CSV/demo/video import | Requirements, preview/confirm, limits, malformed/duplicate handling | Merchant CSV/upload | Low | Passed desktop/390 px; tests cover validation/dedupe |
| `/app/connections` | Optional ad integrations | CSV remains available; Google setup state explained; TikTok/Meta disabled | Connection metadata | Low | Fixed auth/readiness/disconnect messaging |
| `/app/connections/google-ads/sync` | Read-only Google sync | Missing connection/account gives safe redirect; zero rows is success | Google Ads reporting | Low | POST only; selected child account used |
| `/app/connections/google-ads/disconnect` | Remove Google connection | POST only; local disconnect succeeds even if revoke warns | Connection metadata | Low | Fixed visible success/warning |
| `/app/settings` | Workspace settings and deletion | Manual/imported context supported; destructive reset confirmed | Workspace settings | Low | Passed desktop/390 px |
| `/app/activity-log` | Saved activity | Clear persisted-record purpose/empty behavior | App records | Low | Passed |
| `/app/search` | Workspace search | Empty query/results safe | App records | Low | Passed; page title is blank (polish) |
| `/app/privacy`, `/privacy` | Privacy policy | Informational | Legal content | Medium | Route passes; owner identity/contact must be finalized |
| `/app/terms`, `/terms` | Terms | Informational | Legal content | Medium | Route passes; qualified owner/legal review required |
| `/app/support`, `/support`, `/contact` | Reviewer/merchant help | Usable guidance and listing-contact direction | Support content | Medium | Publish and test a professional listing support address |
| `/app/data-deletion`, `/data-deletion` | Deletion instructions | Describes uninstall/redact cleanup | Compliance | Low | Passed |
| `/app/ai-disclaimer`, `/ai-disclaimer` | Output limitations | No outcome guarantees | Legal/AI disclosure | Low | Passed |
| `/app/refund-policy`, `/refund-policy` | Billing/refund position | Clearly says current app is free | Billing policy | Low | Listing and env must match free status |
| `/app/cookies`, `/cookies` | Cookie disclosures | Essential-only/current vendor status | Legal content | Low | Passed |
| `/app/acceptable-use`, `/acceptable-use` | Prohibited use | Informational | Legal content | Low | Passed |
| `/app/legal`, `/legal` | Legal index | Links required pages | Legal content | Low | Passed |
| `/auth/google-ads/start` | OAuth launch | Requires installed Shopify session and configuration | OAuth | Low | Safe state binding; manual production OAuth required |
| `/auth/google-ads/callback` | OAuth completion/account discovery | Safe invalid/expired state and missing-token handling | OAuth/Google account list | Low | Access token not persisted; child selection required |
| `/webhooks/app/uninstalled` | Uninstall cleanup | HMAC-authenticated; idempotent shop-scoped data/session deletion | Shopify webhook | Low | Automated contract coverage; production delivery test needed |
| `/webhooks/app/scopes_update` | Scope updates | HMAC-authenticated | Shopify webhook | Low | Production delivery test needed |
| `/webhooks/shop/redact` | Shop erasure | Deletes workspace media/data and sessions | Shopify webhook | Low | Automated coverage; production object-store test needed |
| `/webhooks/customers/redact` | Customer erasure | HMAC-authenticated safe response | Shopify webhook | Low | App requests no customer scope |
| `/webhooks/customers/data_request` | Customer data request | HMAC-authenticated safe response | Shopify webhook | Low | App requests no customer scope |

## Passed

- Stable production origin in `shopify.app.toml`; no ngrok/Cloudflare URL.
- Embedded mode enabled; scopes limited to `read_products`.
- Demo banner states sample data is not merchant or connected-platform performance.
- CSV/import, Google Ads, Shopify, demo, and estimated/heuristic provenance are represented in UI/test contracts.
- Google Ads queries reporting endpoints only, normalizes customer IDs, uses the selected child account, and accepts zero rows.
- Google access tokens are not persisted; refresh tokens are encrypted server-side; error logging excludes bodies/secrets.
- Upload limits, signature checks, private storage path, authenticated playback, and cleanup have tests.
- All required compliance webhook routes and subscriptions exist.
- Current billing position is free; no external payment flow found.
- Legal, privacy, support, deletion, AI disclaimer, refund, cookie, and acceptable-use routes exist publicly and embedded.

## Review blockers still requiring manual evidence

1. Install the exact deployed commit on a fresh Shopify development/review store and test embedded OAuth, deep links, refresh, staff access, uninstall, and reinstall.
2. Finalize operator/legal identity and have Privacy/Terms reviewed; the current operator label is intentionally generic and must not be invented in code.
3. Publish and test a professional support email/contact in the Shopify listing and ensure it matches the app pages.
4. Confirm Render environment, PostgreSQL migrations, private S3-compatible storage, analyzer availability decision, and all production secrets.
5. Confirm Partner Dashboard App URL, redirects, scopes, webhooks, free pricing, listing claims, and reviewer instructions match this commit.

## Non-blocking polish

- No reviewer-facing polish defect remained from the local route pass.
- React Router v8 future-flag and bundle chunking warnings remain build-time maintenance items.
- Development browser emitted Vite hot-reload WebSocket errors; no application/runtime page error was observed.

## Manual test script

1. Install from the Partner Dashboard into a new store with zero products/orders.
2. Confirm onboarding, skip optional connections, visit every sidebar link, and refresh/deep-link each major page.
3. Add one Shopify product; confirm catalog context is labeled Shopify.
4. Import valid, empty, malformed, duplicate, and missing-column CSVs; confirm preview, errors, dedupe, and CSV source labels.
5. Upload supported/unsupported/oversized files; verify safe failure, playback authorization, analyzer disabled/success/error states.
6. Connect Google Ads, select customer `3049637762` with manager/login context `1162462141`, sync an empty range and a populated range, disconnect, reconnect, and expire/revoke the token. Do not mutate ads.
7. Verify public legal/support URLs while logged out.
8. Send signed/invalid webhook fixtures, then uninstall and confirm app data, media, connections, and sessions are removed.
9. Repeat at desktop and narrow Shopify Admin widths and inspect browser/server logs.

## Files changed

- `app/routes/app.connections.jsx`
- `app/routes/app.search.jsx`
- `app/models/shopify-review-contract.test.js`
- `SHOPIFY_REVIEW_SIMULATION_REPORT.md`
- `SHOPIFY_REVIEW_FIX_REPORT.md`
- `SHOPIFY_SUBMISSION_CHECKLIST.md`
