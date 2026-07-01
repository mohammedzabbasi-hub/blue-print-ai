# BluePrintAI Review Completeness Audit

Audit date: June 30, 2026  
Audit method: source/configuration review, production build, automated test suite, and local browser review of the built app at `/app?demo=1`. No application code was changed.

## Executive Summary

- **Ready for Shopify review now? No.**
- **Ready for serious beta users now? No.** It is suitable only for a controlled development-store trial where the operator explains the demo data and known limitations.
- **Can manual import replace Meta/TikTok/Google OAuth for initial review? Yes.** Shopify products plus a truthful, well-tested manual CSV/video workflow are sufficient to demonstrate the core value. The optional connectors do not need to ship. Incomplete connectors must be hidden or unmistakably labeled unavailable.

### Top five blockers

1. **Fabricated creator data is mixed into merchant/imported results without a visible demo label.** The Creators page displayed ten accounts and `$267,238` attributed sales even though only three imported creator identities were present. Seven accounts and much of the total came from `demoCreators`.
2. **The app requests grossly excessive Shopify scopes.** Configuration asks for write access to products, customers, draft orders, and orders although runtime Shopify use is a read-only products query.
3. **TikTok Ads is presented as connectable even though account discovery and performance sync intentionally throw “not configured yet.”** A reviewer can complete or partially complete OAuth only to reach a dead end.
4. **Production storage is not review-safe.** Prisma is fixed to local SQLite and uploaded videos are written into the deployed app's public/build directories. This is non-durable on common container hosts and exposes merchant media at guessable public URLs without authorization.
5. **Upload/deletion controls are incomplete.** Video storage trusts extensions, buffers before a server-side size limit, and uninstall/shop-redact deletes database rows but does not delete uploaded files.

The positive news: lint, typecheck, production build, and all 129 automated tests pass. Creative/ad CSV import, creator-only CSV import, TTAD filename matching, import-key upsert behavior, dashboard de-duplication, compliance webhook authentication, and unavailable-metric handling all have meaningful automated coverage.

## P0 — Must Fix Before Shopify Review

### P0.1 — Unlabeled fabricated creators contaminate real totals and decisions

- **Issue:** `buildCreators()` always starts from the hardcoded `demoCreators` array whenever any saved creative exists. Imported metrics are then overlaid on matching identities while unmatched fabricated accounts remain. The resulting page totals, rankings, scores, “Scale” decisions, follower counts, clicks, orders, and sales mix real/imported and fake records.
- **Why it matters:** This is materially misleading. A merchant or reviewer cannot distinguish measured creator results from simulated results.
- **Exact files:** `app/models/blueprint.server.js:1344-1421`; `app/data/demo-brand.js:105-577`; `app/routes/app.creators.jsx:24-45`, `119-249`, `263-315`, `app/routes/app.creators.jsx:650-705`.
- **Evidence:** Browser review showed real imported creators alongside Maya Chen (`@mayaglowup`), Alina Brooks, Nina Patel, Sofia Lane, Jordan Reed, Emery Kim, and Ava Monroe. The page showed `$267,238` attributed sales and 6,280 orders with no “Demo performance data” badge. `hasDemoPerformanceData` is based only on `sourcePlatform === "shopify_demo"`; these fabricated base rows are created by `buildCreators()` and therefore evade that signal.
- **Recommended fix:** Build production creator rows exclusively from `Creator`/`CreatorAttribution` and imported/connected performance. Put sample creators behind an explicit demo-workspace flag, isolate them from merchant totals, and label every sample card, total, detail, and recommendation. Add a regression test asserting that imported creators never cause unmatched demo creators to appear.

### P0.2 — Shopify access scopes violate least privilege

- **Issue:** `shopify.app.toml` requests `read_products,write_products,read_customers,write_customers,read_draft_orders,write_draft_orders,read_orders,write_orders`.
- **Why it matters:** The app only queries products. Unnecessary customer and write permissions increase review scrutiny, protected-customer-data obligations, merchant distrust, and breach impact.
- **Exact files:** `shopify.app.toml:31-33`; `app/models/blueprint.server.js:19-50`, `1167-1199`.
- **Evidence:** Code search found the Shopify Admin API used only for `products(first: 25...)`; Shopify orders are explicitly a future TODO in `app/models/creative-performance.server.js:193-201`.
- **Recommended fix:** Submit with `read_products` only. Add `read_orders` later through Shopify's protected-data process when an actual orders connector exists. Remove every write/customer/draft-order scope now and reinstall the review store with the final scope set.

### P0.3 — TikTok Ads is advertised as available but cannot sync

- **Issue:** The Connections UI sets TikTok `available: true`, but advertiser discovery and daily performance functions always throw.
- **Why it matters:** This is a broken CTA and misleading integration claim in a reviewer-facing page.
- **Exact files:** `app/routes/app.connections.jsx:28-49`, `177-243`; `app/services/tiktok-ads.server.js:56-68`; `app/routes/app.connections.tiktok.sync.jsx:12-53`.
- **Evidence:** Browser review showed an active “Connect TikTok Ads” link. The implementation says “TikTok Ads advertiser account discovery is not configured yet” and “TikTok Ads performance sync is not configured yet.”
- **Recommended fix:** Set TikTok to unavailable and label it “Optional — coming later,” or remove it entirely until account selection, token refresh, API sync, error handling, and end-to-end tests work. Manual CSV import is enough for review.

### P0.4 — Uploaded merchant videos are public and insufficiently validated

- **Issue:** Uploads are stored under `public/uploads/...` and copied into `build/client/uploads/...`; access is not authenticated. Validation checks the filename extension but not actual content signature, and the entire file is buffered before a storage limit is applied.
- **Why it matters:** Merchant/creator media can be exposed outside the authenticated Shopify app. Extension spoofing and unbounded multipart buffering create security and denial-of-service risk.
- **Exact files:** `app/utils/upload-storage.server.js:5-43`, `55-57`, `85-97`; `app/routes/app.video-analysis.jsx:59-102`; `app/services/media-analyzer.server.js:7-37`; `app/routes/app.data-import.jsx:136-206`.
- **Evidence:** Five uploaded videos are already directly present in `public/uploads/creative-library/blueprintai-test-store.myshopify.com/`. The 250 MB analyzer check occurs after `persistUploadedVideoFile()` has already read and written the file. The UI's 100 MB message is a warning, not enforcement.
- **Recommended fix:** Use private object storage with short-lived signed URLs or an authenticated media route. Enforce multipart request limits before buffering, verify MIME and media signatures, define a firm duration/size policy, scan uploads as appropriate, and test rejection server-side.

### P0.5 — Uninstall and shop-redact leave uploaded files behind

- **Issue:** `deleteWorkspaceData()` deletes database records but does not call `deleteUploadedWorkspaceFiles()`; only the separate demo-reset path removes files.
- **Why it matters:** Shopify uninstall/privacy deletion must remove app-owned merchant content according to the published policy and retention commitments.
- **Exact files:** `app/routes/webhooks.app.uninstalled.jsx:5-16`; `app/routes/webhooks.shop.redact.jsx:5-14`; `app/models/blueprint.server.js:842-859`, `894-987`.
- **Evidence:** Uploaded-file deletion exists but is called only by `resetDemoWorkspace()`, not by the webhook deletion function.
- **Recommended fix:** Make the webhook cleanup path delete both database data and object/file storage, make it idempotent, record failures for retry, and test that both upload namespaces are removed.

### P0.6 — SQLite/local filesystem is not a credible production persistence plan

- **Issue:** Prisma hardcodes `provider = "sqlite"` and `url = "file:dev.sqlite"`; uploads are stored inside the application filesystem.
- **Why it matters:** Multi-instance and ephemeral deployments can lose sessions, imports, analyses, tokens, and files. Reviewers may see intermittent auth/data loss after a deploy or restart.
- **Exact files:** `prisma/schema.prisma:8-11`; `app/utils/upload-storage.server.js:27-33`; `Dockerfile:1-18`.
- **Evidence:** There is no environment-controlled database URL and no external media storage adapter.
- **Recommended fix:** Move production to a managed durable database (normally PostgreSQL) and private object storage. Run migrations in deployment, back up data, and keep SQLite only for local tests.

### P0.7 — Legal text openly contains unfinished legal placeholders

- **Issue:** Public legal pages state that governing law and dispute terms “should be reviewed,” retention periods “should be reviewed,” and deletion logic “should be implemented,” even though deletion logic partly exists. The website domain also differs from `shopify.app.toml` (`blueprintaiapp.com` vs `blueprintai.app`).
- **Why it matters:** These pages read like drafts, not final merchant terms. Contradictory deletion and domain statements undermine review readiness.
- **Exact files:** `app/content/legal.js:1-14`, `97-103`, `166-175`; `shopify.app.toml:4-6`.
- **Evidence:** The wording is visible on public `/privacy` and `/terms` routes.
- **Recommended fix:** Finalize operator identity/address, domain, governing law, retention periods, subprocessors, deletion process, and billing position. Remove internal implementation notes from user-facing copy and obtain legal review appropriate to launch jurisdictions.

### P0.8 — Production/demo authentication boundaries are unsafe if misconfigured

- **Issue:** `DEV_BYPASS_SHOPIFY_AUTH=true` bypasses authentication on any host, and `?demo=1` also bypasses authentication on any host. Both use the shared fixed shop `blueprintai-test-store.myshopify.com`.
- **Why it matters:** A production environment-variable mistake—or simply a public `?demo=1` URL—can expose and mutate the shared demo workspace without Shopify authentication.
- **Exact files:** `app/routes/app.jsx:24-56`; `app/models/route-context.server.js:20-48`.
- **Evidence:** The local audit used `?demo=1` and could access all pages and shared persisted records without auth. The condition does not restrict explicit demo mode to localhost or non-production.
- **Recommended fix:** Disable both paths when `NODE_ENV === "production"`; use a separate, read-only demo deployment if needed. Add tests proving production requests cannot bypass `authenticate.admin()`.

## P1 — Should Fix Before Beta Users

### P1.1 — Creator detail links do not render a detail page

- **Issue:** `/app/creators/:creatorId` resolves to the parent Creators UI because the parent route does not render an `<Outlet>`.
- **Why it matters:** The comparison table implies navigable creator accounts but the user remains on the list, creating a broken-navigation impression.
- **Exact files:** `app/routes/app.creators.jsx:48-260`; `app/routes/app.creators.$creatorId.jsx`.
- **Evidence:** Browser navigation to `/app/creators/maya-chen?demo=1` displayed the full list page, not the creator detail implementation.
- **Recommended fix:** Make the detail route a sibling/non-nested route or add an outlet with the intended layout. Add route-level browser tests for valid and unknown IDs.

### P1.2 — Creative import status is ambiguous and engagement can display a false zero

- **Issue:** The Creative Library detail showed “Sync / import status: saved performance,” not a useful source label. It also displayed `Engagement 0.00%` while likes/comments/shares were present, which reads as a measured zero rather than unavailable or recalculated.
- **Why it matters:** Users need exact provenance and null semantics for every commercial metric.
- **Exact files:** `app/routes/app.creative-library.jsx:220-255` and detail-modal metric rendering; `app/utils/ad-effectiveness.js:179-238`.
- **Evidence:** Browser modal for “Mascara replacement claim” showed 0.00% engagement alongside 16,080 likes, 544 comments, and 2,310 shares.
- **Recommended fix:** Display canonical source (`CSV import`, connected platform, demo), import date, and imported-vs-derived status. Derive engagement consistently when denominator exists; otherwise show “Not imported,” never 0.00% by default.

### P1.3 — Google Ads can look connected while unusable

- **Issue:** OAuth can store a generic “Google Ads account” even when account discovery is unavailable; the UI then labels it Connected and offers Sync. The audited workspace showed “Connected” plus “Google Ads developer token not configured.”
- **Why it matters:** “Authorized” and “ready to sync” are different states. Current copy makes configuration failure look like a live integration.
- **Exact files:** `app/routes/auth.google-ads.callback.jsx:79-106`; `app/routes/app.connections.jsx:177-275`; `app/routes/app.connections.google.sync.jsx`.
- **Recommended fix:** Model states separately: unavailable, authorization required, authorized/no account selected, ready, sync error. Do not show Connected until a customer ID is selected and required server configuration exists.

### P1.4 — No `.env.example` or startup configuration validation

- **Issue:** Environment requirements are scattered through README/code; `.env.example` is absent.
- **Why it matters:** Missing billing, OAuth, encryption, app URL, or scope settings can silently yield a free app, broken connector, or runtime error.
- **Exact files:** `app/shopify.server.js:11-23`; `app/utils/billing.server.js:10-37`; OAuth/token utilities; `README.md:55-122`.
- **Recommended fix:** Add a non-secret `.env.example`, document required/optional variables, validate production configuration on startup, and explicitly choose a free or Shopify-managed pricing listing.

### P1.5 — Billing is implemented as an environment toggle, but the launch plan is unresolved

- **Issue:** Billing is off unless `SHOPIFY_BILLING_REQUIRED=true`; `shopify.app.toml` has no handle and the public policy says the MVP is free.
- **Why it matters:** This can pass review only if the listing is genuinely free. A paid listing would fail or redirect to an unconfigured plan URL.
- **Exact files:** `app/routes/app.jsx:59-99`; `app/utils/billing.server.js:10-37`; `app/content/legal.js:13-14`; `README.md:55`.
- **Recommended fix:** For initial review, declare the app free everywhere and remove paid-plan language from the demo flow. If paid, configure managed pricing/app handle and test install, approval, cancellation, and re-entry.

### P1.6 — Shopify catalog loading is capped at 25 products with no pagination

- **Issue:** Only the 25 most recently updated products are queried.
- **Why it matters:** “Entire store” and product selection become inaccurate for real merchants with larger catalogs.
- **Exact files:** `app/models/blueprint.server.js:19-50`.
- **Recommended fix:** Implement cursor pagination or truthfully label the scope as “25 most recently updated products.”

### P1.7 — AI naming overstates what is currently deterministic/heuristic

- **Issue:** AI Advisor is deterministic rules, Video Analysis is a local heuristic analyzer, and Ad Briefs/Revenue Blueprint are template/rule builders. The existence of an AI-provider key only changes a settings status; no inspected generation flow calls OpenAI, Anthropic, or Gemini.
- **Why it matters:** “AI Advisor” and “AI Review Studio” can imply model-based analysis. Current Video Analysis copy is fairly candid, but the product-level naming and settings can still mislead.
- **Exact files:** `app/models/advisor.server.js:1-130`; `app/routes/app.video-analysis.jsx:283-318`, `1190-1210`; `app/services/media_analyzer_bridge.py:233-292`; `app/models/blueprint.server.js` brief/blueprint builders.
- **Recommended fix:** Label output mechanics consistently: “rule-based recommendation,” “heuristic media review,” and “template-generated plan.” Use “AI-generated” only where a real model call occurred and save provider/model/evidence metadata.

### P1.8 — No end-to-end Shopify install/embed test was demonstrated

- **Issue:** Local demo mode verifies route UI but bypasses App Bridge and Shopify auth. Install, reauthorization, top-level OAuth redirects, embedded refresh, and mobile Shopify Admin behavior remain unverified.
- **Why it matters:** These are common Shopify review failure points.
- **Exact files:** `app/routes/app.jsx:24-99`; `app/shopify.server.js`; `app/routes/auth.$.jsx`; `app/routes/login.jsx`.
- **Recommended fix:** Run a clean install on a fresh development store using the production-like HTTPS URL, then test install, refresh, direct deep link, expired session, uninstall/reinstall, multiple staff users, and no in-iframe login screen. Record the review screencast.

### P1.9 — CSV import lacks full browser-level regression coverage and operational limits

- **Issue:** Unit/integration tests are strong, but no browser test was found for preview → confirm with real multipart uploads. Video files can collectively exceed practical memory/storage limits even though the CSV is limited to 2 MB/500 rows.
- **Why it matters:** The highest-value demo workflow needs reliable user-facing error, retry, and partial-failure behavior.
- **Exact files:** `app/routes/app.data-import.jsx:136-215`, `986-998`; `app/models/creative-upload-import.server.js`; `app/constants/import-limits.js:1`.
- **Recommended fix:** Add end-to-end tests with TTAD1–TTAD5, duplicate re-import, mismatched filenames, bad MIME, oversized aggregate upload, empty optional metrics, and creator-only CSV.

### P1.10 — Imported metrics are trusted without provenance/audit controls

- **Issue:** Merchant-provided rows can assert revenue, orders, ROAS, and creator attribution. Basic type/range validation exists, but there is no import batch model, original-file hash, author/session ID, currency normalization, or conflict history.
- **Why it matters:** Users may mistake self-reported or incorrectly mapped data for platform-verified facts.
- **Exact files:** `prisma/schema.prisma` `CreativePerformance`; `app/models/creative-upload-import.server.js`; `app/models/creative-performance.server.js`.
- **Recommended fix:** Add import batches and provenance, label metrics “merchant-imported,” normalize currency/time zone, warn when supplied derived metrics conflict with raw fields, and support rollback.

### P1.11 — Reviewer/demo data is currently a muddled hybrid

- **Issue:** Explicit demo mode adds five GlowForge demo products while the same shared shop database contains TTAD/import records for GlowDrop/LashLift. The reviewed pages therefore show seven product contexts and mixed brands.
- **Why it matters:** The requested five clean review products are not what the current demo presents. It looks seeded and internally inconsistent.
- **Exact files:** `app/models/route-context.server.js:31-47`; `app/data/demo-brand.js:12-103`; shared local database/seed scripts.
- **Recommended fix:** Use one isolated review-store dataset: five real Shopify products, five TTAD videos, one clearly labeled import batch, and no code-level demo products/creators. Reset and verify it before recording/submission.

### P1.12 — Runtime analyzer dependencies are not declared in the production image

- **Issue:** The app spawns `python3`, while the Dockerfile installs only OpenSSL. OCR/frame/audio tooling also depends on Python/system packages not described in the image.
- **Why it matters:** Production AI Review Studio may silently degrade to “unavailable” after upload.
- **Exact files:** `Dockerfile:1-18`; `app/services/media-analyzer.server.js:53-83`; `app/services/media_analyzer_bridge.py`.
- **Recommended fix:** Package and health-check Python, ffmpeg, OCR, and Python libraries in the runtime image, or move analysis to a managed worker. Add a production smoke test.

## P2 — Nice-to-Have After Launch

### P2.1 — Replace large custom embedded UI with more Shopify-native patterns

- **Issue:** The app uses a custom collapsing sidebar and dense dark dashboard rather than Shopify Admin navigation/Polaris conventions.
- **Why it matters:** It works locally, but responsive, keyboard, and embed consistency require more testing.
- **Exact files:** `app/routes/app.jsx:102-260`; `app/styles/creative-os.css`; `app/styles/blueprint.css`.
- **Recommended fix:** Test 390/768/1024/1440 widths inside Admin, improve focus management and modal semantics, and consider Shopify-native navigation/components.

### P2.2 — Add richer connector/account management later

- **Issue:** Meta, TikTok Shop/Affiliate, YouTube/creator-source connections are absent or status-only.
- **Why it matters:** These are not necessary for initial value if manual import is first-class.
- **Recommended fix:** Ship one connector at a time with account selection, incremental sync, refresh/revocation, rate-limit handling, provenance, and tests. Do not pre-advertise nonfunctional integrations.

### P2.3 — Add observability and support diagnostics

- **Issue:** Webhooks log to console; no structured monitoring, retry queue, health page, or support diagnostic bundle was found.
- **Recommended fix:** Add redacted structured logs, webhook cleanup retries, job status, error monitoring, and shop-scoped support diagnostics.

### P2.4 — Paginate and virtualize high-volume screens

- **Issue:** Several loaders use fixed limits and pages render large tables/cards directly.
- **Recommended fix:** Add pagination/filtering for creatives, creators, analyses, activity, campaigns, and imports before higher-volume merchants onboard.

## Page-by-Page Audit

| Route | Status | Verified behavior | Missing/broken/review risk | Clear next action? |
|---|---|---|---|---|
| `/app` | **Partial** | Dashboard loads; imported ad metrics populate; creator rollups are explicitly excluded from canonical totals; charts and range controls render. | Readiness is an estimated planning score; demo/import provenance is not prominent enough; mixed demo products can enter related planning pages. | Yes: import/library and optional connections. |
| `/app/creative-library` | **Partial** | Five imported TTAD records render; campaign move controls, delete controls, search/filter, and detail modal exist. Detail modal opened successfully. | Source label is vague; engagement false-zero issue; public media storage; upload path needs security/E2E validation. | Yes: upload creative. |
| `/app/creative-library/:id` | **Partial/unverified** | A route exists and production build emits it. Main UX currently uses a modal. | Unknown-ID behavior and direct deep linking were not proven; prevent “Creative not found” in the review script by testing all five IDs. | Depends on record. |
| `/app/video-analysis` | **Partial** | Upload form, product selection, auto-save status, truthful empty history, and heuristic/unavailable wording render. | Not a model-based AI analysis; runtime Python dependencies missing from Docker; upload is persisted before robust server validation; no real upload was transmitted during this read-only audit. | Yes: choose and analyze video. |
| `/app/ad-briefs` | **Partial** | Uses imported product performance evidence; demo products are labeled in selector; saves generated records. | Output is rule/template-generated, not verified external AI; explicit demo mode mixes unrelated sample products with imported products. | Yes: generate/save brief. |
| `/app/recommendations` | **Partial** | Evidence-grounded, deterministic advisor renders with prompt chips and clearly says advisory-only. | “AI Advisor” overstates deterministic logic; output interaction was not submitted in this read-only audit. | Yes: ask a question. |
| `/app/revenue-blueprint` | **Partial** | Uses product/import evidence; missing values and demo assumptions have code paths; saves plans. | “Estimated upside” is simply 35% of imported revenue (`app/models/blueprint.server.js:1841-1844`), not a forecast; must be labeled as an assumption everywhere. | Yes: choose scope and generate. |
| `/app/creators` | **Fail** | Imported creator rows and metrics do appear. | Fabricated creator accounts are merged into totals and rankings without a visible demo label. This page is not truthful enough for review. | Yes, but decisions are contaminated. |
| `/app/creators/:creatorId` | **Fail** | Route exists. | Direct browser navigation rendered the parent list, not the detail page. | No reliable detail transition. |
| `/app/data-import` | **Strong partial** | Creative/ad and creator modes, paste/file input, optional video matching, requirements, preview/confirm design, 2 MB/500-row guidance. Automated tests verify matching/persistence/upsert. | No browser E2E import in this read-only audit; aggregate video limits and MIME validation are inadequate. | Yes: review import. |
| `/app/settings` | **Partial** | Workspace/profile settings and legal navigation render. | Production configuration/billing status is not merchant-facing enough; legal text is unfinished; developer/reset behavior must remain disabled in production. | Yes: save profile. |
| `/app/connections` | **Fail for review as shown** | Manual CSV fallback is clearly presented; Meta is correctly disabled as coming soon. | TikTok is falsely available; Google can show Connected while not sync-ready; TikTok Shop and other referenced sources have no real connector. | Manual import CTA works; connector CTAs are inconsistent. |
| `/app/campaigns` and `/app/campaigns/:id` | **Partial (extra route)** | Persistence and aggregate behavior have tests; dashboard navigation exposes the feature. | Not in the requested core route list but part of reviewer-visible navigation; needs clean-store browser QA and empty-state/deep-link checks. | Yes. |
| Public/app legal routes | **Routes pass, content partial** | Privacy, terms, contact, support, refund, acceptable use, AI disclaimer, copyright, and cookies routes exist in public and embedded forms. | Draft/legal-review language and inconsistent domain remain visible. | Yes, informational. |

## Data & Metrics Truthfulness Audit

### Hardcoded/fabricated data found

- `app/data/demo-brand.js:12-103`: five fabricated GlowForge products with prices, inventory, product types, and images.
- `app/data/demo-brand.js:105-577`: fabricated creators, follower counts, average views, engagement, conversion, revenue, orders, strengths, weaknesses, and recommendations.
- `app/data/demo-brand.js:256-577`: fabricated creative/ad performance rows and commercial metrics labeled internally `shopify_demo`.
- `app/models/blueprint.server.js:1344-1421`: demo creators are used as the base for production creator rows whenever saved creatives exist; computed fit, hook, response, and creative counts are fabricated/heuristic.
- `app/models/blueprint.server.js:1201-1208`: legacy dashboard `creativeHealthScore` is bounded to 58–94 based on active-product count, not measured creative performance. Verify/remove any remaining UI use.
- `app/models/blueprint.server.js:1327-1339`: product recommendations and impact text are templated.
- `app/models/blueprint.server.js:1841-1844`: “estimated upside” equals 35% of a record's revenue. This is an assumption, not a forecast.
- `app/routes/app.video-analysis.jsx:283-318` and `app/services/media_analyzer_bridge.py:233-292`: hook/CTA/clarity/readiness and recommendations are heuristic.
- `app/models/advisor.server.js:117`: advisor output is explicitly deterministic.

### Truthfulness controls that work

- Canonical dashboard totals exclude creator rollups, and the UI states that they are not total Shopify revenue/orders. Automated tests cover this.
- Missing commercial values are generally preserved as unavailable rather than coerced to zero.
- Legacy fabricated retention defaults are suppressed; transcript placeholders are not treated as content.
- Demo products are labeled in Ad Briefs and Revenue Blueprint selectors.
- Video Review copy calls its scores heuristic and makes retention/transcript conditional.
- Revenue Blueprint has a `demoAssumptions` disclosure path.

### Truthfulness controls that fail

- Creator demo rows bypass `hasDemoPerformanceData`, contaminate totals, and receive confident management decisions.
- A creative detail can show 0.00% engagement even when engagement components exist.
- “AI” naming is broader than the actual deterministic/heuristic implementation.
- Imported revenue/orders are merchant assertions; they are not labeled distinctly enough from connected-platform measurements on every surface.
- Explicit demo mode combines sample catalog products with persisted imported data from a shared shop, making the dataset internally inconsistent.

## Import/Data Pipeline Audit

### What is verified

- **Creative/ad performance CSV:** Implemented through preview and confirm actions in `app/routes/app.data-import.jsx:136-215` and parsing/persistence in `app/models/creative-upload-import.server.js`.
- **Creator CSV:** A creator-only mode exists and does not require creative/platform/date/video fields.
- **TTAD1–TTAD5 matching:** Case-insensitive trimmed base-filename matching is tested. Duplicate, unsafe, unsupported, and unmatched filenames are detected.
- **Persistence:** Imported rows are written to Prisma models. Tests verify SavedCreative, CreativePerformance, Creator, CreatorAttribution, and campaign linkage.
- **Re-import behavior:** `CreativePerformance` has `@@unique([shop, importKey])`; tests verify updates/deduplication for creative and creator imports.
- **Dashboard:** Canonical creative/ad records populate totals/charts without creator double-counting.
- **Creative Library:** Matched videos create playable assets; CSV-only records remain valid performance-only entries.
- **Creators:** Imported records reach the page data source, but the page currently mixes in demo creators.
- **Ad Briefs/Recommendations/Revenue Blueprint:** Imported product names and performance context feed these features.

### Required creative/ad columns shown by the UI

- `platform`
- `ad_name`/`creative_name` **or** `video_url`/`source_url`
- `date`/`performance_date`/`reporting_date`/`day`

Recommended/optional columns include creative and campaign identifiers, launch date, creator identity/profile/type, creator metrics, product identity, asset/source URLs, impressions, reach, clicks, spend, orders/conversions, revenue/conversion value, CTR/CPC/CPM/CVR/ROAS, video views/quartiles/watch time, engagement components, saves/reposts, and notes.

### Gaps

- No import-batch/audit/rollback model.
- No currency/time-zone contract or multi-currency handling.
- No server-enforced aggregate video limit before multipart buffering.
- Files are extension-validated rather than content-validated.
- Derived metrics supplied by CSV are not visibly reconciled with raw fields.
- The local browser review did not submit files because this audit was requested as read-only; behavior claims above are based on code plus passing automated persistence tests, not a fresh destructive import.

### Can import data power the whole app?

**Mostly yes for the planned review demo:** dashboard metrics/charts, Creative Library, creator comparisons, recommendations, Revenue Blueprint, and Ad Brief evidence can be populated. AI Review Studio is separately powered by an uploaded video and heuristics. Shopify products are independently loaded through the Shopify Admin GraphQL API. The current creator demo contamination must be removed before this statement is true in a merchant-safe sense.

## OAuth/Integration Audit

| Integration | Status | Needed before review? | Risk |
|---|---|---:|---|
| Shopify products | **Partially working** | Yes | Read-only query is implemented, but only first 25 products and clean-install behavior was not verified in Admin. |
| Shopify orders | **Placeholder/TODO** | No | Dangerous only because scopes currently request read/write orders despite no ingestion. Remove scopes. |
| Manual CSV/video | **Working in code/tests; browser flow partial** | Yes | Core review path. Must harden uploads and run end-to-end review-store import. |
| Google Ads | **Partial** | No | OAuth/token encryption and sync normalization exist; configuration/account-selection readiness is ambiguous. Hide for review or label beta/unavailable. |
| TikTok Ads | **Placeholder after OAuth** | No | Dangerous/misleading: active Connect CTA, but discovery/sync intentionally throw. |
| Meta Ads | **Placeholder only** | No | Correctly disabled as coming soon; acceptable if kept secondary. |
| TikTok Shop/Affiliate | **Status/reference only** | No | Do not imply data is available. Keep out of primary workflow. |
| YouTube/creator-source connections | **Not implemented** | No | Any references should say future/optional. |

Disconnected integrations do not inherently block review. The current optional CSV copy is good. The blocker is presenting an incomplete TikTok connector as active and a non-ready Google authorization as Connected.

## AI Feature Audit

| Feature | Actual method | Uses real/imported data? | Demo/static dependency | Unsupported-claim risk |
|---|---|---:|---:|---|
| AI Review Studio | Python media inspection plus deterministic heuristics | Product context and uploaded file metadata/frames/OCR | No commercial metrics required | Moderate; safe if “heuristic” remains prominent and runtime analyzer works. |
| Ad Briefs | Rule/template builder | Yes: Shopify/imported product and saved performance | Demo products in explicit demo mode | Moderate; do not call template output model-generated. |
| AI Advisor | Deterministic ranking/advice | Yes | Can consume contaminated creator/demo context | High until creator source isolation is fixed. |
| Revenue Blueprint | Rule/template plan; 35%-of-revenue upside assumption | Yes | Demo assumption path exists | High if “estimated upside” is not explicitly described as a scenario assumption. |
| Creator ranking/matching | Weighted deterministic scoring over base creator rows | Imported records, but currently seeded from fabricated creators | Heavy | Critical truthfulness failure. |

The app can give useful recommendations without OAuth by using Shopify product context plus merchant-imported performance. That should be the honest initial product story.

## Shopify Review Checklist

| Item | Result | Evidence/notes |
|---|---|---|
| Embedded app configuration | **Partial** | `embedded = true`; AppProvider used for authenticated flow. Only bypass mode was browser-tested. |
| Install/auth flow | **Partial/unverified** | Standard Shopify library used; fresh production-like install not run. |
| Session handling | **Partial** | Prisma Shopify session storage; production SQLite is unsuitable. |
| App Bridge | **Partial** | AppProvider is present; bypass mode intentionally omits it. Deep-link/embed QA still required. |
| Required scopes | **Fail** | Requests many unused read/write/customer/order scopes. |
| Billing/plan clarity | **Partial** | Free MVP policy is clear, but environment toggles and missing app handle leave paid mode unresolved. |
| Privacy policy | **Partial** | Routes exist; draft implementation/legal-review language remains. |
| Terms | **Partial** | Routes exist; governing law/dispute language unfinished. |
| Support/contact | **Pass with caveat** | Email/contact/support routes exist; verify address and domain. |
| App listing readiness | **Fail/unverified** | No listing assets/copy/reviewer instructions were verified; product claims must match heuristic/manual-import reality. |
| Uninstall webhook | **Partial** | HMAC-authenticated and deletes DB/session; leaves uploaded files. |
| Mandatory privacy webhooks | **Partial** | Routes/subscriptions/tests exist; shop redact leaves files; customer handlers correctly say no customer data is stored. |
| Protected customer data | **Fail by scope** | Code does not store customers, but config asks for customer/order permissions. |
| Least privilege | **Fail** | Only `read_products` is presently justified. |
| Navigation after refresh/deep link | **Partial** | Major local routes load; creator detail is broken. |
| Incorrect in-iframe login | **Unverified** | Cannot certify without clean Shopify Admin testing. |
| Demo/sample labeling | **Fail** | Products often labeled; creator fabrication is not. |
| Manual import fallback | **Pass in code/tests** | Strong automated coverage and clear Connections fallback. |
| Data deletion | **Fail** | Database deletion exists; uploaded files persist on uninstall/redact. |
| Secure uploads | **Fail** | Public URLs, extension-only validation, no pre-buffer limit. |
| Durable production persistence | **Fail** | SQLite/local filesystem. |

## Test Results

Commands were run from `/Users/mohammedabb07650/Documents/blue-print-ai` on June 30, 2026.

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | **PASS** | Exit 0, no lint errors. |
| `npm run typecheck` | **PASS** | Exit 0. React Router v8 future-flag warnings only. |
| `npm run build` | **PASS** | Exit 0; 2,751 modules transformed. Several server-only route chunks were correctly emitted empty. React Router future-flag warnings only. |
| `npm run test` | **PASS** | Exit 0; **129 tests passed, 0 failed**, 36 top-level tests, 14 suites. |

Covered areas include campaign persistence/aggregation, compliance webhook routing/config, creative deletion, TTAD upload matching, import persistence/upsert, creator-only imports, product-context evidence, dashboard source summaries, Google OAuth/state/config/normalization, ad effectiveness and double-count prevention, session lookup, token encryption, document hydration, retention/transcript truthfulness, and selected-file accumulation.

Not covered sufficiently: fresh Shopify install/embed flow, billing approval, production database/storage, actual external OAuth against review credentials, browser-level multipart import, runtime Python analyzer in the production image, responsive Admin embed QA, and uploaded-file deletion from webhook paths.

## Shopify Reviewer Demo Readiness

| Requested demo state | Current result |
|---|---|
| 5 clean demo products | **Fail as audited.** Explicit demo mode shows five code-level GlowForge products plus two imported product contexts; use five real Shopify review-store products instead. |
| Product data in BluePrintAI | **Implemented, needs live-store verification.** Read-only Shopify GraphQL query exists. |
| TTAD1.mp4–TTAD5.mp4 | **Present locally and matching tested.** Five files exist under public uploads, but storage is not production-safe. |
| Creative performance CSV | **Pass in automated tests; fresh browser import still required.** |
| Creator performance CSV | **Pass in automated tests; UI result currently contaminated by demo creators.** |
| Dashboard graphs | **Pass with existing imported data.** Browser showed populated revenue trend and commercial totals. |
| Creator comparison | **Fail truthfulness.** Populated, but fabricated accounts and totals are mixed in. |
| Creative Library | **Partial pass.** Five records and details render; fix provenance/engagement/storage. |
| AI Review Studio | **Partial.** Truthful heuristic copy; production analyzer/upload pipeline not proven. |
| Ad Briefs | **Partial.** Useful evidence and CTA; template/rule nature must remain clear. |
| Recommendations | **Partial.** Useful deterministic advice; source contamination must be removed. |
| Revenue Blueprint | **Partial.** Useful planning shell; 35% upside assumption needs stronger disclosure. |
| Settings/connections | **Fail as shown.** TikTok false availability and Google misleading connected state. |
| No snowboard/irrelevant content | **No snowboard content observed**, but unrelated GlowForge sample products/creators are mixed with the TTAD dataset. |
| No blank “Creative not found” pages | **Not fully verified.** Five modal records worked at list level; test every direct detail URL after final dataset reset. |
| No unsupported analytics | **Fail.** Creator page still exposes fabricated analytics and scores. |

## Recommended Final Build Plan

### Phase 1 — Review blockers

- [ ] Remove all implicit `demoCreators`/demo performance from authenticated merchant workspaces; isolate sample mode and exclude it from real totals.
- [ ] Rebuild creator list/detail/ranking solely from persisted creators and attribution records; add truthfulness tests.
- [ ] Reduce Shopify scopes to `read_products`; reinstall and retest the review store.
- [ ] Disable/hide TikTok and Google connectors for review unless end-to-end ready; leave Meta clearly coming soon and CSV primary.
- [ ] Restrict all auth bypass/demo query behavior to non-production.
- [ ] Move sessions/app data to durable production DB and uploads to private object storage.
- [ ] Enforce server-side multipart/file count/aggregate size/MIME/signature limits before buffering.
- [ ] Delete uploaded objects during uninstall and `shop/redact`; add retry/idempotency tests.
- [ ] Finalize legal/operator/domain/retention/deletion/billing copy.

### Phase 2 — Complete the review-store experience

- [ ] Fix `/app/creators/:creatorId` routing and test every creator link.
- [ ] Correct creative engagement null/derivation behavior and show precise provenance/import dates.
- [ ] Add `.env.example` and production startup validation.
- [ ] Package/health-check the video analyzer runtime or move it to a worker.
- [ ] Add an end-to-end TTAD1–TTAD5 import test covering preview, confirm, re-import update, and visible results across all dependent pages.
- [ ] Create exactly five relevant Shopify products in a clean review store; remove code-level catalog/creator samples from that workspace.
- [ ] Reset the review shop, import one clearly named sample CSV batch, and confirm every sample label.

### Phase 3 — Shopify submission verification

- [ ] Run a clean install with final scopes and production-like HTTPS configuration.
- [ ] Verify embed load, refresh, deep links, expired session, staff-user access, uninstall, redact cleanup, and reinstall.
- [ ] Test desktop/tablet/mobile widths inside Shopify Admin and keyboard/modal behavior.
- [ ] Decide and configure a truthful free-vs-paid listing; test billing only if paid.
- [ ] Prepare listing copy/screenshots and reviewer instructions centered on Shopify products + manual CSV/video import.
- [ ] Record the final reviewer demo using only the clean five-product/five-video dataset.

### Phase 4 — Beta hardening

- [ ] Add import batches, provenance, rollback, currency/time-zone handling, and conflict warnings.
- [ ] Paginate Shopify products and high-volume workspace pages.
- [ ] Add monitoring, webhook cleanup retries, sync/job status, and support diagnostics.
- [ ] Implement external connectors one at a time; do not expose them before account selection and sync are complete.

## Final Verdict

BluePrintAI has a credible manual-import core and unusually good automated coverage for its current stage. It is still **not ready for Shopify review** because the current reviewer-visible product can make unsupported creator-performance claims, requests permissions it does not use, exposes incomplete connectors as available, and lacks production-safe persistence/upload/deletion controls.

The fastest review path is not to finish every OAuth integration. It is to remove/hide them, reduce scopes to `read_products`, make the five-product/five-video manual-import story impeccably truthful, isolate all sample data, harden storage/deletion, and verify one clean embedded install end to end.
