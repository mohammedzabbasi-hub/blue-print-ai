# Shopify Clean-Store Review Test Script

Run this against the exact deployed commit and a new Shopify development/review store. Record URL, commit SHA, date, tester, screenshots, console errors, and server logs.

## 1. Preflight

1. Confirm every item in `SHOPIFY_SUBMISSION_ENV_CHECKLIST.md`.
2. Confirm `shopify.app.toml` App URL equals `SHOPIFY_APP_URL` exactly.
3. Confirm callback is `<SHOPIFY_APP_URL>/auth/callback`.
4. Confirm listing is free and scope is only `read_products`.
5. Run lint, typecheck, build, tests, and `git diff --check` on the deployed commit.
6. Confirm PostgreSQL migrations deploy without creating or modifying migration files.
7. Confirm the S3/R2 bucket is private.

## 2. Fresh installation and embedded shell

1. Use a store with no BluePrintAI session or workspace rows.
2. Install from Shopify Admin/review link.
3. Approve only `read_products`.
4. Confirm OAuth returns to the embedded app without a top-level blank page or redirect loop.
5. Confirm onboarding appears before Command Center.
6. Confirm the app is inside Shopify Admin and App Bridge navigation works.
7. Refresh, use browser back/forward, close/reopen from Admin, and test a staff user.
8. Inspect browser console/network for uncaught errors, CSP/frame errors, failed loaders, or mixed content.

Expected: a real free workspace is wrapped in Shopify `AppProvider`; no billing redirect appears.

## 3. Onboarding matrices

### Store A: zero products

1. Confirm zero-product warning is visible and non-fatal.
2. Select manual product context and complete onboarding.
3. Verify Terms and Privacy links open.
4. Repeat with “Skip for now”; confirm app remains usable and empty states appear.

### Store B: products

1. Test one product and choose it as primary.
2. Test at least 26 products to prove pagination beyond the former 25-product limit.
3. If possible, test over 1,000 products and confirm the visible partial-context warning.
4. Temporarily force a later GraphQL page failure; confirm already-loaded products remain usable and the warning appears.

## 4. Command Center

1. On an empty workspace, confirm no fabricated totals/charts/creatives appear.
2. Verify actions: Upload Creative, Import Performance Data, Create Campaign.
3. Confirm “Estimated workflow progress” explains that it is directional and not performance.
4. After imports, confirm imported values are labeled and creator rollups do not double count totals.
5. Test date ranges, chart metrics, campaign/creative/creator/product filters, sparse dates, and undated records.

## 5. Creative Library and manual upload

1. Confirm empty state links to Review Studio and CSV import.
2. Open manual upload and save a supported video with product/title context.
3. Verify loading, success, playback, refresh persistence, detail modal, campaign assignment, and deletion.
4. Test a URL-only creative and ensure it is identified as an external source.
5. Test empty, spoofed, unsupported, oversized, and provider-failure uploads.
6. Confirm no views/clicks/orders/revenue are invented for manual uploads.
7. Confirm another store cannot fetch the authenticated media URL.

## 6. AI Review Studio

### Analyzer disabled

1. Set `ANALYZER_ENABLED=false`.
2. Confirm the page states that full analysis requires the configured service.
3. Upload a valid video; confirm it is saved but no scores/recommendations/transcript/retention are generated.

### Analyzer enabled, if included in listing

1. Configure the real HTTPS analyzer and valid key.
2. Test success, partial response, malformed response, HTTP error, network error, and timeout.
3. Confirm only returned evidence is displayed/saved.
4. Confirm missing transcript/retention stays “Not available.”
5. Test manual save, auto-save on/off, duplicate upload, saved review detail, and export.

## 7. CSV import

1. Import a valid creative CSV without videos.
2. Preview before confirm; verify required/optional columns and row counts.
3. Confirm import and verify success summary plus Command Center/Library results.
4. Import matching MP4/MOV/M4V/WebM files and verify playback.
5. Test creator-only CSV and verify it does not create fake Creative Library assets.
6. Re-import identical rows; confirm deterministic update/deduplication.
7. Test missing required identity, malformed CSV, formula-like cells, negative metrics, duplicate video names, unknown columns, 501 rows, and over-2-MB input.
8. Confirm blank optional commercial metrics show “Not imported,” not zero.
9. Confirm imports are described as merchant-provided, not live Meta/TikTok/Google/Shopify analytics.

## 8. Remaining primary routes

### Ad Briefs

1. Test no product context, Shopify product, imported product, and manual context.
2. Generate, save, refresh, and reopen a brief.

### AI Advisor

1. Ask questions with no data and with imported data.
2. Confirm deterministic/advisory labels, evidence, gaps, and working action links.

### Revenue Blueprint

1. Test no context and imported/Shopify context.
2. Confirm “No forecast calculated”; no unsupported dollar upside appears.
3. Generate, save, refresh, and reopen.

### Creators

1. Confirm empty state links to creator CSV.
2. Verify imported metrics, missing fields, directional heuristic labels, detail links, and no scale/pause budget command.

### Settings

1. Save catalog/manual profile and analysis preferences; refresh and verify persistence.
2. Verify legal/support links and no personal email or owner-action marker.
3. Confirm developer reset tools are hidden in production.

### Public legal/support

1. Open `/terms`, `/privacy`, `/support`, `/contact`, and `/data-deletion` while logged out.
2. Open embedded equivalents.
3. Confirm no placeholder, personal email, fake company identity, or broken link.
4. Confirm the real listing support contact is staffed and matches owner procedures.

## 9. Optional connections and billing

1. Confirm Meta, TikTok, and Google cards are disabled/Coming soon and CSV import is offered.
2. Confirm no reviewer instruction asks for optional OAuth.
3. Directly visit unfinished auth/sync paths and verify they are not linked from production UI; record behavior.
4. Confirm `SHOPIFY_BILLING_REQUIRED=false` and no charge/plan redirect occurs.
5. Do not test or advertise paid plans until a separate paid-billing review is complete.

## 10. Webhooks and data lifecycle

1. Send valid and invalid signed requests to every configured webhook route.
2. Confirm invalid signatures are rejected.
3. Confirm scope update changes stored session scope safely.
4. Uninstall and verify DB rows, encrypted connections, sessions, and media are removed.
5. Send shop redaction twice to prove idempotency.
6. Reinstall and confirm a clean workspace.

## 11. Responsive/accessibility matrix

Test widths 390, 430, 768, 1024, and 1440 px:

1. Sidebar, top content, forms, tables, charts, modals, legal pages, and long errors.
2. Keyboard-only navigation, focus visibility, modal Escape/close, and focus restoration.
3. Horizontal tables scroll without clipping required actions.
4. Upload pickers and buttons remain reachable.
5. Run an accessibility scan and inspect console at every primary route.

## 12. Pass criteria

Submit only when:

- no placeholder URL or owner-action UI is visible;
- no fake analytics, forecast, or unlabeled sample data appears;
- install/auth/onboarding has no loop or blank screen;
- manual upload and CSV import persist correctly;
- disabled analyzer behavior matches listing copy;
- webhook/data cleanup works;
- mobile/desktop and console checks pass;
- real support/legal/Partner Dashboard actions are complete.
