# BluePrintAI Final Video Demo Checklist

Use this checklist on the deployed Shopify review store immediately before recording. Do not substitute local demo behavior for a live integration and do not present labeled demo metrics as merchant-measured results.

## Pre-recording environment

- [ ] Render deploy is green and `/health` returns `200 ok` over HTTPS.
- [ ] `npm run setup:production` completed successfully against the production PostgreSQL database.
- [ ] `npx prisma migrate status --schema=prisma/production/schema.prisma` reports up to date using the production environment.
- [ ] Shopify App URL and all allowed callback URLs use the current production origin.
- [ ] App is installed/re-authorized on the intended review store with `read_products` only.
- [ ] `ENABLE_DEVELOPER_TOOLS`, `SHOPIFY_BILLING_BYPASS`, and all local auth bypass settings are disabled in production.
- [ ] S3/R2 private object storage is configured and a previously uploaded video still plays after a new deploy.
- [ ] Analyzer is enabled, reachable, and tested with the exact review-safe video.
- [ ] Google Ads OAuth redirect URI and review account access are verified if Google Ads will be shown.
- [ ] `support@blueprintai.app` receives and can reply to a test message.
- [ ] Legal operator, effective date, support contact, and Shopify listing facts have owner approval.
- [ ] Browser console is clear of functionality-impacting errors.

## Accounts and data needed

- [ ] Shopify review-store staff account with app access.
- [ ] At least one real review-safe Shopify product with image/title context.
- [ ] Google Ads test/review account with read access and known campaigns, or a deliberate truthful disconnected state.
- [ ] One short MP4/MOV/M4V/WebM video supported by the analyzer and owned/authorized for demo use.
- [ ] One clean CSV that matches the documented template and uses clearly identified test/demo rows.
- [ ] One existing playable Creative Library record.
- [ ] One grounded assistant question whose answer is known from the visible imported data.

## Pages to open beforehand

- [ ] Shopify Admin app page.
- [ ] Command Center.
- [ ] Connections with Google account state confirmed.
- [ ] Data Import with the clean CSV available locally.
- [ ] Creative Library with one known playable record.
- [ ] AI Review Studio with analyzer state confirmed.
- [ ] Creative Briefs with product/source selectors populated.
- [ ] Campaign Manager with one safe campaign folder.
- [ ] Settings with Legal & Privacy section available.
- [ ] Logged-out `/privacy`, `/terms`, `/support`, `/contact`, and `/data-deletion` tabs for post-recording verification.

## Exact recommended recording sequence

1. [ ] Open BluePrintAI from Shopify Admin; do not begin from a direct unauthenticated URL.
2. [ ] Show Welcome or Command Center and explain that BluePrintAI combines Shopify product context, merchant imports, optional read-only Google Ads reporting, uploaded creative, and saved planning work.
3. [ ] Show the Shopify product context and identify its source accurately.
4. [ ] Open Connections and state that connections are optional.
5. [ ] Show Google Ads only if genuinely connected; state that access is reporting-only and cannot edit, launch, pause, delete, or spend on campaigns.
6. [ ] Open Manage campaigns; toggle one safe campaign; wait for **Saving…** then **Saved**; click **Done**; refresh and confirm the selection remains.
7. [ ] If sync returns zero rows, show the truthful connected/no-live-rows state; do not describe it as a disconnect or failure.
8. [ ] Open Data Import. Show required/optional columns and preview the prepared CSV.
9. [ ] Confirm the preview once only. Avoid importing a file already present unless deduplication has been verified.
10. [ ] Open Creative Library; play one authorized video; show product/campaign/creator context without exposing a storage path.
11. [ ] Open AI Review Studio and analyze the prepared video.
12. [ ] Navigate away and return; confirm the current analysis persists.
13. [ ] Show that the current analysis is absent from Saved reviews and Creative Library until explicitly saved.
14. [ ] Click Save Review once; wait for success; confirm one saved review appears.
15. [ ] Save to Creative Library once only if the recording plan requires it; confirm one playable library card.
16. [ ] Open Creative Briefs and click Generate New Brief.
17. [ ] Select the real product and optional real source creative/review; generate the preview.
18. [ ] State that recommendations and assumptions are separate from factual evidence.
19. [ ] Navigate within the preview and show it is not yet in saved briefs.
20. [ ] Click Save Brief once; confirm one saved card; optionally edit the same record to prove the ID is preserved.
21. [ ] Open Campaign Manager and show that campaigns are local planning folders, not ad-platform mutation.
22. [ ] Show one campaign detail, creative assignment, date range, and imported metric source.
23. [ ] Ask BluePrintAI one grounded question such as “Which creative has the highest CTR?” and verify the cited value against visible data.
24. [ ] Ask “What data is missing?” to demonstrate limits without invented metrics.
25. [ ] Open Settings; show active shop, Workspace Profile, Legal & Privacy, Support, and Data Deletion.
26. [ ] End on Command Center or Creative Library with no modal, toast error, loading state, or destructive confirmation open.

## Steps that must not be skipped

- [ ] Prove the current review survives navigation/reload.
- [ ] Prove Save Review and Save to Creative Library are explicit and idempotent.
- [ ] Prove Creative Brief generation is preview-only until Save Brief.
- [ ] Show Google Ads as read-only and optional.
- [ ] Show source labels for demo, imported, Shopify, Google Ads, and generated data.
- [ ] Show Legal & Privacy, Support, and Data Deletion in Settings.
- [ ] Verify logged-out public legal pages after recording.

## Common recording failure points

- Analyzer is unavailable: do not retry repeatedly. Show the truthful unavailable state and use Data Import/Creative Library for manual video storage; reschedule the analyzer segment if the review requires live analysis.
- Google token expired: reconnect before recording; never show raw provider/configuration diagnostics.
- Campaign auto-save still says Saving: wait for Saved before closing.
- CSV duplicates existing rows: use a unique prepared file or reset only the dedicated review dataset through approved procedures.
- Current review is already saved: use a new authorized video or remove only the current draft; do not delete saved history unexpectedly.
- Video does not play after deploy: stop and verify S3/R2 object existence, authenticated media route, and shop ownership.
- Shopify context parameters disappear: reopen from Shopify Admin; do not continue from a broken top-level URL.
- Assistant answer cannot be verified: use a deterministic question with visible imported evidence.
- Narrow layout hides a control: stop recording and verify at 390, 768, and the intended Shopify embedded width.

## Records to prepare and clean up

Prepare:

- [ ] One labeled CSV import batch.
- [ ] One current analysis video.
- [ ] One saved review target.
- [ ] One Creative Library target.
- [ ] One saved Creative Brief target.
- [ ] One local campaign folder.

After testing/recording:

- [ ] Remove accidental duplicate imports only through the intended shop-scoped UI.
- [ ] Remove temporary current analysis if it should not remain; confirm saved reviews/library items remain.
- [ ] Remove duplicate test briefs/campaign folders created during rehearsals.
- [ ] Revoke temporary Google test grants if no longer needed.
- [ ] Do not reset or delete unrelated merchant data.

## Final post-recording verification

- [ ] Watch the complete video with audio.
- [ ] No secret, token, account credential, private URL, browser autofill, notification, or personal data is visible.
- [ ] No fake/demo data is described as real merchant or connected-platform performance.
- [ ] No unsupported revenue guarantee, forecast, attribution, or AI capability is claimed.
- [ ] Page names match current navigation: Command Center, Creative Library, AI Review Studio, Creative Briefs, Campaigns, Creators, Revenue Blueprint.
- [ ] The final frame is polished and free of loading/error/debug states.
- [ ] Public legal URLs and support email shown in the listing match the deployed app.
