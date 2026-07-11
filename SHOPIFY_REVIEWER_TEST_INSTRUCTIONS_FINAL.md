# BluePrintAI Shopify Reviewer Test Instructions

Submission status: Draft — replace every bracketed value before submission. Do not place secrets in this repository.

## Reviewer access

- App name: BluePrintAI
- Distribution: Public embedded Shopify app
- Production origin: `https://YOUR_PRODUCTION_APP_URL`
- Install/review link: `[SHOPIFY_APP_REVIEW_INSTALL_LINK]`
- Review development store: `[SHOPIFY_REVIEW_STORE_NAME].myshopify.com`
- Store/admin access instructions: `[SHOPIFY_REVIEW_STORE_ACCESS_STEPS]`
- Emergency review contact: `[PARTNER_DASHBOARD_EMERGENCY_CONTACT]`
- Support: `support@blueprintai.app`

Open the app from Shopify Admin → Apps → BluePrintAI. No separate BluePrintAI login is required, and reviewers should not type a shop domain into an app form. If Shopify or a third-party account requires controlled credentials, place them only in the confidential testing-information fields in Partner Dashboard.

## Review data to prepare

1. At least one review-safe Shopify product with title and image.
2. Creative performance sample: `demo-data/blueprintai-demo-creative-ad-performance.csv`.
3. Creator performance sample: `demo-data/blueprintai-demo-creator-performance.csv`.
4. One rights-cleared short video: `[REVIEW_SAFE_VIDEO_FILENAME.mp4]`.
5. One controlled Google Ads account with read access and known campaigns: `[CONTROLLED_GOOGLE_ADS_REVIEW_ACCOUNT]`.

The provided CSV files are labeled sample/demo data and must not be described as live Shopify or connected-platform results. Do not use the ignored `.data/private-media` test files as submission assets.

## Core test path

### 1. Install and first experience

1. Use `[SHOPIFY_APP_REVIEW_INSTALL_LINK]` from a Shopify-owned surface.
2. Approve the requested `read_products` scope.
3. Confirm the app opens inside Shopify Admin without another sign-up.
4. On onboarding, either complete the store profile or choose Skip for now.
5. Confirm Command Center remains usable after skipping.

Expected: Shopify OAuth occurs before app interaction, the app lands in its UI, and returning/reinstalling does not fail on an existing shop/session row.

### 2. Command Center and Shopify product context

1. Open Command Center.
2. Confirm the prepared Shopify product appears as product context.
3. Review the empty state before importing data, if using a clean workspace.
4. After import, confirm metrics are labeled as merchant-provided/imported rather than Shopify Analytics.

Expected: no `NaN`, `Infinity`, `undefined`, fabricated metric, or unlabeled demo value. Creator rollups are not double-counted in dashboard totals.

### 3. Connections and Google Ads

Google Ads is optional and read-only/reporting-only. It never creates, edits, pauses, enables, deletes, launches, bids, budgets, or spends on campaigns.

1. Open Connections.
2. Choose Connect Google Ads.
3. Use the controlled credentials stored in confidential Partner Dashboard testing information.
4. Select the intended Google Ads customer account.
5. Open Manage campaigns.
6. Toggle one campaign checkbox.
7. Wait for Saving… to become Saved.
8. Choose Done, refresh, and reopen Manage campaigns.
9. Run Sync latest data.
10. Disconnect and reconnect if required by the review plan.

Expected: selected campaigns persist; there is no large Save Selection button; zero-row sync remains connected and reports that no live rows were found; provider/configuration secrets are never shown.

Known limitation: TikTok Ads and Meta Ads direct connections are not available. CSV import remains available.

### 4. Data Import

Creative/ad import requires:

- `platform`
- `ad_name`/`creative_name` or `video_url`/`source_url`
- `date`, `performance_date`, `reporting_date`, or `day`

Creator-only import requires `creator_handle` or `creator_name`.

1. Open Data Import.
2. Choose Creative/ad performance.
3. Upload or paste `demo-data/blueprintai-demo-creative-ad-performance.csv`.
4. Optionally select the matching rights-cleared videos named by `video_filename`.
5. Choose Review import.
6. Inspect ready rows, warnings, errors, date range, and video matches.
7. Choose the explicit confirm/import action once.
8. Repeat with the creator CSV if creator testing is required.

Expected: preview occurs before persistence; CSV is limited to 500 rows and 2 MB; only ready rows are imported; invalid/negative values are rejected or explained; formulas are neutralized; duplicates update/deduplicate rather than corrupt totals; partial failures remain visible.

### 5. Creative Library

1. Open Creative Library.
2. Confirm imported or explicitly saved creatives appear.
3. Play one private uploaded video.
4. Open a creative detail and assign a local campaign.
5. Open delete and cancel once to inspect confirmation; do not delete the prepared final record unless a duplicate was created for testing.

Expected: active analysis drafts do not appear; saved reviews are not auto-added; media URLs do not expose storage paths; missing media uses a fallback; assignment/removal does not delete unrelated records.

### 6. AI Review Studio / Video Analysis

1. Open AI Review Studio.
2. Upload `[REVIEW_SAFE_VIDEO_FILENAME.mp4]` and choose the prepared product.
3. Start analysis.
4. Navigate to Command Center and back.
5. Reload the route.
6. Confirm Current Analysis persists.
7. Confirm it is absent from Review History and Creative Library.
8. Choose Save Review once; repeat once to confirm idempotent behavior.
9. Choose Save to Creative Library once if the review plan permits.
10. Use Remove Current Analysis and confirm saved history/library records remain.

Expected: one shop-scoped current draft; explicit saves only; no fabricated completion if analyzer is unavailable; no provider body, key name, endpoint, request ID, database/Python/filesystem error, or stack trace.

Known limitation: this flow requires the deployed analyzer to be enabled and reachable. If it is unavailable, the app truthfully reports that analysis is unavailable and does not save a fake result.

### 7. Creative Briefs

1. Open Creative Briefs (`/app/ad-briefs`).
2. Choose Generate New Brief.
3. Select the prepared real or explicitly imported product context.
4. Optionally select a saved creative or saved review.
5. Generate the preview.
6. Navigate in the preview and confirm it is not in the saved list.
7. Choose Save Brief once; repeat once.
8. Edit and confirm the record ID remains the same.
9. Duplicate and confirm one distinct Draft copy.
10. Open Delete, confirm the warning, and delete only the duplicate.

Expected: generation is preview-only; save is explicit/idempotent; raw performance rows never appear as saved briefs; recommendations are separated from factual evidence; source records remain after deleting a brief.

### 8. Campaigns and Creators

1. Open Campaigns and create one local planning campaign.
2. Assign one prepared creative.
3. Remove the assignment.
4. Open Creators and one creator detail from the imported creator sample.

Expected: campaign actions never mutate an ad platform; duplicate imports do not duplicate campaigns; creator metrics are identified as imported attribution and missing metrics remain unavailable.

### 9. Revenue Blueprint

1. Open Revenue Blueprint.
2. Select the prepared product/campaign/creative context.
3. Generate one blueprint.

Expected: outputs are directional, not guaranteed revenue forecasts; historical imported revenue is labeled; unavailable values remain unavailable; no `NaN`/`Infinity`.

### 10. Ask BluePrintAI

Use the floating assistant and ask:

- Which creative has the highest CTR?
- Compare TTAD1 and TTAD4.
- What is the ROAS for TTAD 1?
- Which campaign spent the most?
- What data is missing?
- What should I test next?
- Which recommendation is based on actual data?
- What can you not determine from my current data?

Expected: TTAD1, TTAD 1, TTAD-1, TTAD1.mp4, and capitalization variants resolve consistently; missing entities do not fall back to an unrelated top creative; deterministic facts use stored shop evidence; data sources are distinguished; no prompt, evidence packet, SQL, secret, or stack trace is exposed.

## Public legal and support routes

These routes must open while logged out:

- Privacy: `https://YOUR_PRODUCTION_APP_URL/privacy`
- Terms: `https://YOUR_PRODUCTION_APP_URL/terms`
- Support: `https://YOUR_PRODUCTION_APP_URL/support`
- Contact: `https://YOUR_PRODUCTION_APP_URL/contact`
- Data deletion: `https://YOUR_PRODUCTION_APP_URL/data-deletion`
- Cookie policy: `https://YOUR_PRODUCTION_APP_URL/cookies`
- Acceptable use: `https://YOUR_PRODUCTION_APP_URL/acceptable-use`
- Refund policy: `https://YOUR_PRODUCTION_APP_URL/refund-policy`
- AI disclaimer: `https://YOUR_PRODUCTION_APP_URL/ai-disclaimer`
- Copyright: `https://YOUR_PRODUCTION_APP_URL/copyright`

Inside the app, open Settings → Legal & Privacy for the consolidated hub.

## Data deletion and uninstall

To delete app workspace data while installed:

1. Open Settings → Legal & Privacy.
2. Choose Delete BluePrintAI data.
3. Type `DELETE`.
4. Confirm.

Expected: BluePrintAI shop-scoped workspace records and uploaded media are removed; Shopify, Google Ads, and other external-platform data are not deleted; Shopify installation/session remains until uninstall.

To uninstall, use Shopify Admin → Settings → Apps and sales channels → BluePrintAI → Uninstall. Shopify's verified `app/uninstalled` webhook invokes workspace/media/session cleanup. Do not manually delete production database rows.

To request deletion without using the control, email `support@blueprintai.app` with the store domain and a non-sensitive description. Never send passwords, tokens, OAuth codes, API keys, or ad-account secrets.

## Known limitations

- Google Ads is reporting-only and depends on controlled OAuth credentials/configuration.
- TikTok Ads and Meta Ads direct integrations are unavailable.
- AI Review Studio depends on the external analyzer when analysis is requested.
- CSV values are merchant-provided and are not independently verified by BluePrintAI.
- Revenue Blueprint and assistant recommendations are directional and do not guarantee outcomes.
- BluePrintAI is currently Free; no payment approval or paid plan should appear.

## Reviewer completion checklist

- [ ] Every bracketed placeholder above is replaced in Partner Dashboard.
- [ ] Controlled credentials are valid, non-personal, and stored only in confidential testing information.
- [ ] Exact deployed commit and app configuration match.
- [ ] All expected results above were rehearsed on the review store.
- [ ] Support inbox is monitored during review.
- [ ] No test requires access to a developer's personal account.
