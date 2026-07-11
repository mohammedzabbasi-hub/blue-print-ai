# BluePrintAI Shopify Final Video Checklist

Do not record until every blocking preflight item is checked on the deployed Shopify review store. The mandatory reviewer screencast must be a clear English or English-subtitled setup and core-feature walkthrough that matches the listing.

## Pre-recording deployment checks

- [ ] Exact reviewed commit is deployed.
- [ ] Hosting build succeeded with `npm ci && npm run build`.
- [ ] Hosting pre-deploy succeeded with `npm run setup:production`.
- [ ] Hosting start command is `npm run start` (or the container default `npm run docker-start`).
- [ ] `https://YOUR_PRODUCTION_APP_URL/health` returns HTTP 200, body `ok`, `Content-Type: text/plain`, and `Cache-Control: no-store`.
- [ ] Production PostgreSQL migration status is up to date.
- [ ] Shopify App URL and allowed callback URLs match the final HTTPS origin.
- [ ] App is installed/re-authorized with `read_products` only.
- [ ] `DEV_BYPASS_SHOPIFY_AUTH`, `ENABLE_DEVELOPER_TOOLS`, and `SHOPIFY_BILLING_BYPASS` are disabled.
- [ ] Listing and app both say Free; no plan/charge gate appears.
- [ ] Private S3/R2 media survives deploy, navigation, and reload.
- [ ] Analyzer is enabled/reachable if AI Review Studio analysis will be shown.
- [ ] Google Ads OAuth/account/campaign data is ready if Google Ads will be shown.
- [ ] `support@blueprintai.app` receives a test message.
- [ ] Browser console has no functionality-impacting warnings/errors.

## Accounts and files to prepare

- [ ] Shopify review-store account with permission to open the app.
- [ ] One rights-cleared Shopify product with title and image.
- [ ] Controlled Google Ads review account with known campaigns and no personal developer dependency.
- [ ] `demo-data/blueprintai-demo-creative-ad-performance.csv` or another clearly labeled review CSV.
- [ ] `demo-data/blueprintai-demo-creator-performance.csv` if Creators will be shown.
- [ ] One short rights-cleared MP4/MOV/M4V/WebM supported by the analyzer.
- [ ] One existing playable Creative Library record.
- [ ] One known grounded assistant question whose answer can be checked against visible imported data.

## Pages to open in advance

- [ ] Shopify Admin → Apps → BluePrintAI.
- [ ] Command Center.
- [ ] Connections with Google state verified.
- [ ] Data Import with files available in the system picker.
- [ ] Creative Library with one playable record.
- [ ] AI Review Studio with analyzer status checked.
- [ ] Creative Briefs with product/source selectors populated.
- [ ] Campaigns with one safe local planning record.
- [ ] Settings → Legal & Privacy.
- [ ] Logged-out Privacy, Terms, Support, Contact, and Data Deletion tabs for final verification.

## Records to remove before recording

- [ ] Accidental duplicate CSV batches.
- [ ] Duplicate briefs created during rehearsals.
- [ ] Duplicate local campaign folders.
- [ ] Stale current analyses that would confuse the explicit-save demonstration.
- [ ] Broken/unreferenced test media.
- [ ] Old provider error banners or OAuth query notices.
- [ ] Any record containing personal data, personal account IDs, raw storage paths, or unsupported claims.

Use only shop-scoped UI controls. Do not reset the production database or delete unrelated merchant data.

## Exact recording order

1. [ ] Open BluePrintAI from Shopify Admin, not a direct unauthenticated URL.
2. [ ] Show Welcome or Command Center and explain: Shopify product context works without external accounts; CSV/manual upload is available; Google Ads is optional/read-only; analysis requires video/analyzer.
3. [ ] Show one real review-store Shopify product and identify it as Shopify catalog context.
4. [ ] Open Connections and state that integrations are optional.
5. [ ] Show the genuine Google Ads connection state. Never imply connected when disconnected.
6. [ ] Open Manage campaigns. Toggle one safe campaign and wait for Saving… then Saved.
7. [ ] Choose Done, reopen the selector, and show the selection persisted.
8. [ ] Run sync only if the controlled account is ready. A zero-row result must be described truthfully as connected with no live rows.
9. [ ] Open Data Import and identify the sample as merchant-provided/demo data.
10. [ ] Show required columns and select the prepared CSV/video files.
11. [ ] Choose Review import and show ready rows, warnings, errors, date range, and video matches.
12. [ ] Confirm once. Do not import a duplicate batch unless deduplication is the intentional test.
13. [ ] Open Creative Library and play one authorized video.
14. [ ] Show product/campaign/creator/source labels without exposing storage paths.
15. [ ] Open AI Review Studio and analyze the prepared video.
16. [ ] Navigate away and return, then reload to prove Current Analysis persists.
17. [ ] Show Current Analysis is not automatically in Review History or Creative Library.
18. [ ] Choose Save Review once; repeat only to demonstrate idempotency.
19. [ ] Choose Save to Creative Library once if the video plan includes that proof.
20. [ ] Open Creative Briefs and choose Generate New Brief.
21. [ ] Select the actual product and optional real source creative/review; generate the preview.
22. [ ] State that the preview is unsaved and that recommendations are separate from factual evidence.
23. [ ] Save the brief once; confirm one saved card. Optionally edit the same record to show its ID is preserved.
24. [ ] Open Campaigns. State clearly that these are local planning folders and never mutate an ad platform.
25. [ ] Show one campaign detail and one assigned creative with accurate imported source labels.
26. [ ] Ask BluePrintAI “Which creative has the highest CTR?” and verify the answer against visible data.
27. [ ] Ask “What data is missing?” to demonstrate truthful limits.
28. [ ] Open Settings → Legal & Privacy and show Support and Data Deletion. End on Command Center or Creative Library with no modal, error, toast, loading state, or confirmation open.

## Required proof points

- [ ] OAuth occurs before the app UI on clean install.
- [ ] Embedded navigation, direct refresh, back, and forward work.
- [ ] Current analysis persists but is not auto-saved.
- [ ] Save Review and Save to Creative Library are separate and idempotent.
- [ ] Generate Brief creates an unsaved preview; Save Brief persists explicitly.
- [ ] Google Ads is optional/read-only and campaign selection auto-saves.
- [ ] Imported, Shopify, Google Ads, demo/sample, heuristic, and generated data are labeled distinctly.
- [ ] Public legal/support/deletion pages load logged out.
- [ ] The app is Free and does not request external payment.

## Steps to avoid

- Do not start from `/auth/login` or type a shop domain.
- Do not expose a password manager, browser notification, address-book data, OAuth code, token, client ID/secret, developer token, account ID, connection string, environment value, or private URL.
- Do not show browser devtools, terminal output, filesystem paths, provider bodies, request IDs, SQL, stack traces, Python errors, or database errors.
- Do not call sample/demo/imported metrics real Shopify or live connected-platform performance.
- Do not claim guaranteed revenue, uplift, conversion, attribution, ad approval, or creator success.
- Do not say BluePrintAI launches, pauses, edits, budgets, bids, or spends on campaigns.
- Do not show TikTok/Meta as connected.
- Do not repeatedly click save/import/sync while the first request is in progress.
- Do not delete the only prepared playable creative or unrelated merchant data.
- Do not continue through a broken/blank/error state; stop and repair/rehearse.

## Common failure points

- App opens outside Admin: reopen from Shopify Admin; the production recovery page should not ask for a shop domain.
- Host/shop context disappears: reopen through Shopify Admin and verify internal embedded links.
- Google token expired: reconnect before recording with the controlled account.
- Campaign selector remains Saving: wait for Saved before Done/refresh.
- Google sync returns zero rows: explain the truthful connected/no-live-rows state.
- Analyzer unavailable: do not fabricate a result or repeatedly retry; fix the service before recording the advertised workflow.
- Video does not play: verify S3/R2 object, authenticated media route, shop ownership, and deploy persistence.
- CSV duplicates existing data: use a unique labeled file or intentionally demonstrate deduplication.
- Current analysis already saved: use a new authorized video or remove only the current draft.
- Assistant answer cannot be checked: use the prepared deterministic question and visible data.
- Narrow layout hides a control: stop and retest 390, 768, and the target Shopify embedded width.

## Final post-recording checks

- [ ] Watch the entire video with audio/subtitles.
- [ ] Every listing claim is demonstrated or clearly identified as optional/unavailable.
- [ ] No secret, personal data, notification, browser chrome, test-store identifier, private account, or unsupported claim is visible.
- [ ] Demo/imported data is labeled every time it is discussed.
- [ ] Page names are current: Command Center, Campaigns, Creative Library, AI Review Studio, Creative Briefs, Revenue Blueprint, Creators, Data Import, Connections, Settings.
- [ ] No obsolete Ad Briefs or AI Advisor label appears.
- [ ] Final frame is polished and free of modal, loading, error, debug, and destructive states.
- [ ] Public URLs and support contact shown in the video match the listing.
- [ ] Reviewer instructions describe the exact same path and expected outcomes.
- [ ] Upload the video only after the final deployed build and Partner Dashboard listing are frozen.
