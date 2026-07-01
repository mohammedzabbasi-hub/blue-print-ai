# Demo Reviewer Package Report

## Outcome

The final manual-review package is ready. It contains parser-validated creative/ad and creator CSVs, canonical `TTAD1.mp4`–`TTAD5.mp4` references, and a self-contained reviewer runbook that requires no ad-platform OAuth or live merchant connection. No OAuth code, core behavior, configuration, page layout, or page styling was changed.

## Phase 1 inventory

### Existing CSV and seed assets inspected

- `seed/blueprintai-local-performance.csv`: 47 app-local demo performance rows consumed by `scripts/seed-blueprintai-local-performance.mjs`; this is a dev-only seed schema, not the manual reviewer-import template.
- `seed/shopify-dev-store-products.csv`: five synthetic products for the guarded dev-store seed script.
- `seed/shopify-dev-store-customers.csv`, `seed/shopify-dev-store-orders.csv`, and `seed/shopify-dev-store-analytics-orders.csv`: guarded synthetic dev-store inputs.
- `glowforge-demo-products.csv`: Shopify product import CSV containing five products across multiple variant rows.
- `DEMO_STORE_IMPORT_GUIDE.md`: earlier product-only import instructions.
- `app/data/demo-creatives.js`, `app/data/demo-brand.js`, `scripts/seed-shopify-dev-store.mjs`, `scripts/seed-blueprintai-local-performance.mjs`, and `scripts/verify-demo-reset.mjs`: existing demo data/builders and seed/reset tooling.

No existing dedicated manual-import creator-performance CSV was present. No dedicated five-row manual creative/ad reviewer CSV was present.

### Importer and upload handling inspected

- `app/models/creative-performance.server.js`: CSV parsing, header normalization, field aliases, validation, and metric persistence.
- `app/models/creative-upload-import.server.js`: creative/video matching and creator-only preview/import handling.
- `app/routes/app.data-import.jsx`: visible import requirements, import modes, preview/confirm flow, file picker, and accepted media list.
- `app/utils/selected-video-files.js`: multi-file form construction.
- `app/utils/upload-storage.server.js`: extension, MIME, signature, size, storage, and media URL handling.
- Import tests in `app/models/creative-upload-import.server.test.js`, `app/models/blueprint.server.test.js`, `app/utils/selected-video-files.test.js`, and `app/utils/upload-storage.server.test.js`.

Creative mode truly requires `platform`, a valid date (`date`, `performance_date`, `reporting_date`, or `day`), and a creative name or playable video/source URL. `video_filename` is the canonical video-match column; aliases are normalized. Creator mode requires `creator_handle` or `creator_name` and does not require a video or creative record.

Uploads accept MP4, MOV, M4V, and WebM. The server validates extension, MIME type, and file signature; the default limit is 100 MB per video and 250 MB combined. Matching uses a case-insensitive base filename, while the package deliberately preserves exact canonical casing.

### Documentation and surfaces inspected

- `README.md`, `.env.example`, `package.json`, `shopify.app.toml`, `DEMO_STORE_IMPORT_GUIDE.md`, and existing review/readiness reports.
- Dashboard: `app/routes/app._index.jsx` and `app/components/dashboard/*`.
- Creative Library: `app/routes/app.creative-library.jsx` and its detail route.
- Creators: `app/routes/app.creators.jsx` and `app/routes/app.creators.$creatorId.jsx`.
- Recommendations/AI Advisor: `app/routes/app.recommendations.jsx`.
- Ad Briefs: `app/routes/app.ad-briefs.jsx`.
- Revenue Blueprint: `app/routes/app.revenue-blueprint.jsx`.
- AI Review Studio: `app/routes/app.video-analysis.jsx` and analyzer service/tests.
- Demo shell/provenance: `app/routes/app.jsx` and `app/components/IntegrationStatusCards.jsx`.

These surfaces already label demo, imported, and missing/unavailable data. AI Review Studio already fails closed when its analyzer is disabled or unavailable. No UI provenance ambiguity justified a code change.

## Files created and modified

Created:

- `demo-data/blueprintai-demo-creative-ad-performance.csv`
- `demo-data/blueprintai-demo-creator-performance.csv`
- `REVIEWER_INSTRUCTIONS.md`
- `DEMO_REVIEWER_PACKAGE_REPORT.md`

No existing application, configuration, test, seed, or documentation file was modified for this task. The worktree contained unrelated pre-existing changes; they were preserved.

## Final CSV schemas and parser confirmation

### Creative/ad performance

File: `demo-data/blueprintai-demo-creative-ad-performance.csv`

Columns exactly as supplied:

`creative_id`, `video_filename`, `platform`, `creative_name`, `date`, `product_name`, `creator_handle`, `impressions`, `views`, `clicks`, `spend`, `orders`, `revenue`, `notes`

The importer normalizes `views` to its canonical `video_views` field. All other headers are canonical parser fields. Direct execution through `parsePublicEngagementCsv(..., { importType: "creative" })` returned five rows, five `ready` statuses, and zero row or file-level CSV errors.

### Creator performance

File: `demo-data/blueprintai-demo-creator-performance.csv`

Columns exactly as supplied:

`creator_handle`, `creator_name`, `creator_platform`, `creator_clicks`, `creator_orders`, `creator_revenue`, `creator_spend`, `creator_commission`, `creator_engagement_rate`, `creator_notes`, `product_name`, `campaign_name`, `best_angle`, `reporting_date`

The importer normalizes `reporting_date` to its canonical `date` field. All other headers are canonical creator-mode parser fields. Direct execution through `parsePublicEngagementCsv(..., { importType: "creator" })` returned five rows, five `ready` statuses, and zero row or file-level CSV errors.

The supplied metrics are supported by the importer and displayed by existing performance/creator surfaces. Clicks do not exceed impressions in creative rows; views do not exceed impressions; orders and revenue are plausible relative to clicks and spend. No unsupported KPI column was added.

## Filename consistency

The final creative CSV, reviewer instructions, report, existing local seed references, and relevant tests use exactly:

- `TTAD1.mp4`
- `TTAD2.mp4`
- `TTAD3.mp4`
- `TTAD4.mp4`
- `TTAD5.mp4`

The five final creative rows were parser-verified to preserve those exact names. No package mismatch required correction.

## Demo/imported/sample labels

Added:

- Both new filenames contain `demo`.
- Every creative CSV row includes `Synthetic demo data for Shopify App Review` in `notes`.
- Every creator CSV row includes `Synthetic demo data for Shopify App Review` in `creator_notes`.
- `REVIEWER_INSTRUCTIONS.md` explicitly states that all locally loaded content is sample/demo data and not live merchant or connected-platform results.
- This report identifies every artifact and metric set as synthetic demo/reviewer data.

Corrected in UI: none. Existing UI labels already include **Demo workspace · sample data**, **Demo performance data**, **Imported performance data**, **Imported creative + performance**, and imported/demo product-context labels. Adding more UI copy would have been redundant and outside the minimal-change constraint.

## OAuth, behavior, and design confirmation

No OAuth or authentication integration was added, scaffolded, or modified. The reviewer path uses existing localhost-only development demo access plus manual CSV/video upload. No core behavior, route structure, page design, styling, tests, or production configuration changed.

The only implementation artifacts are sample CSVs and reviewer documentation; their separate filenames were necessary to prevent the dev-only seed CSV from being mistaken for the manual importer input.

## Validation results

Run from the repository root on June 30, 2026, in the required order:

1. `npm run lint` — **PASS**.
2. `npm run typecheck` — **PASS**. Non-failing React Router v8 future-flag notices were printed.
3. `npm run build` — **PASS**. Non-failing React Router future-flag and Vite dynamic/static chunk warnings were printed.
4. `npm test` — **PASS**: 151 tests passed, 0 failed, 0 skipped.

Additional checks:

- Both CSV files were executed through the real parser: five ready rows each, no parse errors.
- A standalone dev-server launch was attempted in the managed sandbox. It reached Vite but the sandbox denied local socket binding (`EPERM` on ports 64999 and 3000) and hit its file-watch limit (`EMFILE`). This environment restriction does not affect the four required validation commands; a reviewer must run the documented launch on a normal local host.

## Demo Store Setup Checklist

- [ ] In Shopify Admin, remove every default Shopify snowboard demo product; verify that searching Products for `snowboard` returns no products.
- [ ] Create exactly five demo products: **Ice Roller Pro**, **LashLift Starter Kit**, **GlowPrep Headband Set**, **GlowLift Facial Sculptor**, and **Glass Skin Bundle**.
- [ ] Add at least one clear, professional product image to each of the five products and verify no product has a blank featured image.
- [ ] Set a clean product vendor and product type on every product; use **BluePrintAI Beauty** as the vendor and the matching types **Skincare Tool**, **Lash Care**, **Beauty Accessory**, **Skincare Tool**, and **Skincare Bundle**.
- [ ] Create two or three collections and assign every product to at least one collection; for example, create **Skincare Tools**, **Beauty Routines**, and **Bundles**.
- [ ] Open BluePrintAI **Data Import**, choose **Creative/ad performance**, and upload `demo-data/blueprintai-demo-creative-ad-performance.csv`.
- [ ] In the same creative import, upload exactly `TTAD1.mp4`, `TTAD2.mp4`, `TTAD3.mp4`, `TTAD4.mp4`, and `TTAD5.mp4`; preview and confirm that every CSV row matches the same-numbered file before importing.
- [ ] Open BluePrintAI **Data Import**, choose **Creator performance**, upload `demo-data/blueprintai-demo-creator-performance.csv`, preview five ready rows, and complete the import.
- [ ] Open **Command Center** and verify it is populated and does not display an error.
- [ ] Open **Creative Library** and verify all five imported creatives load, retain the canonical MP4 filenames, and are labeled as imported data.
- [ ] Open **Creators** and verify the five imported creator profiles and supplied metrics load without an error.
- [ ] Open **AI Advisor** and verify recommendations load with demo/imported provenance visible where applicable.
- [ ] Open **Ad Briefs** and verify the page loads, the five-product context is available, and imported/demo context is labeled.
- [ ] Open **Revenue Blueprint** and verify it loads, imported performance context is identified, and missing metrics remain unavailable rather than invented.
- [ ] Open **AI Review Studio** and verify it loads in a safe empty state with no error. With the analyzer disabled, optionally select a demo MP4 and verify unavailable analysis is handled safely without fabricated output.

## Residual risks and manual steps

- The five MP4 binaries are not committed as portable reviewer assets. Files with those canonical original names exist only under local private storage, so they must be supplied separately to the reviewer and uploaded manually.
- Product images are not embedded in the existing product CSVs; the reviewer/store preparer must add a professional image to each product.
- Collections must be created manually in Shopify Admin.
- The standalone local server could not be socket-tested inside the managed sandbox; use the commands in `REVIEWER_INSTRUCTIONS.md` on a normal local machine.
- AI Review Studio is intentionally empty-safe with `ANALYZER_ENABLED=false`; full analyzer output requires a separately configured analyzer service, but that service is not required for this review package.
