# Data Accuracy Fix Report

Audit date: 2026-07-05.

## Fixes made

- Removed raw and parsed Google Ads error payloads from production logging. Logs retain only HTTP status, request ID, path, and the API’s concise message.
- Added normalized CPM, conversion rate and CPA with divide-by-zero protection; retained correct micros-to-currency, CTR, CPC and ROAS behavior.
- Persisted derived Google fields and campaign status in the existing daily row payload without a destructive schema migration.
- Adapted Google payload rates from decimal ratios to UI percentages.
- Prevented campaign rollups and their child ad rows from being summed together for the same platform/campaign/date.
- Added focused mock tests for formula normalization, zero denominators, selected child-account URL use, empty search-stream results, and secret-safe logging.

## Files changed

- `app/services/google-ads.server.js`
- `app/services/google-ads.server.test.js`
- `app/routes/app.connections.google.sync.jsx`
- `app/models/creative-performance.server.js`
- `METRIC_AUDIT_REPORT.md`
- `GOOGLE_ADS_METRIC_MAPPING.md`
- `DATA_ACCURACY_FIX_REPORT.md`

## Tests added/improved

- Micros-to-dollar and core formula normalization.
- CPM/CVR/CPA/ROAS/CPC/CTR zero-denominator behavior.
- Dashed selected customer ID normalizes into the child-customer search URL.
- Empty search-stream result returns `[]` without failure.
- Error logs exclude access/developer tokens and raw response content.

Existing CSV tests cover column mapping, optional metrics and creator/creative imports. Static inspection found no Google Ads mutation endpoint. The full suite result is recorded below after final verification.

## Remaining risks/work

- Main dashboard effectiveness records do not yet consume Google daily rows; Google-only users may not see those records in the primary effectiveness grid.
- Currency code is not queried; several formatters assume USD.
- Ad-group-level sync and ad creative assets are not implemented.
- Google conversion value is not Shopify booked/net revenue.
- Customer-account timezone is not used to construct reporting boundaries.
- Derived/status values remain JSON payload metadata rather than typed daily columns.
- Real account behavior requires manual verification with campaign history. This audit intentionally did not call external APIs.

## Manual verification

1. Configure manager/login customer `1162462141` and select child `3049637762` in Connections.
2. Sync an account with history and confirm request logs contain no credentials or bodies.
3. Compare one 30-day campaign/ad export against stored daily impressions, clicks, cost, conversions and conversion value.
4. Confirm cost micros conversion, weighted totals and no campaign-plus-ad double count.
5. Sync an empty account and confirm “0 daily performance rows synced,” `lastSyncedAt` update, and no error.
6. Confirm no non-USD account is displayed as USD before currency support is added.

## Verification results

- `npm run lint`: PASS (exit 0, no lint findings).
- `npm run typecheck`: PASS (exit 0; React Router v8 future-flag warnings only).
- `npm run build`: PASS (exit 0; Vite dynamic/static import and React Router future-flag warnings only).
- `npm test`: PASS (158 tests, 14 suites, 0 failures, 0 skipped).
- Focused Google Ads test file: PASS (13 tests, 0 failures).
- No live Google Ads, Shopify, Render, or other external API was called by tests.
