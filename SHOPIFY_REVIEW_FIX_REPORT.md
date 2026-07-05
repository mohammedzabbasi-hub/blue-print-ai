# Shopify Review Fix Report

Date: July 5, 2026

## Fixes made

- Google Ads OAuth completion now says **authorized** and instructs the merchant to select an account instead of prematurely claiming the integration is connected.
- Google Ads status now distinguishes **Authorized · select account** from **Ready to sync**.
- Google Ads disconnect redirects now display a visible success notice.
- Token-revocation warnings returned by disconnect are now visible instead of being silently discarded.
- Added review-contract tests for authorization/readiness/zero-row/disconnect states, POST-only disconnect, selected-account sync, least-privilege Shopify scopes, stable production URLs, and absence of Google Ads mutation endpoints.
- Added the missing Search page document title.

## Tests and evidence

- Full automated suite after changes: **161 passed, 0 failed**.
- Browser: 22 embedded routes rendered without an error boundary.
- Responsive: dashboard, creative library, data import, connections, settings, and support had no document-level overflow at 390 px.
- Production auth boundary: direct unauthenticated demo query redirected to login, as intended.

## Remaining risks

- Real Shopify clean-install and embedded App Bridge behavior require a deployed-store test.
- Legal operator identity/contact and qualified legal approval remain owner tasks.
- The support contact must be published and tested in the listing.
- Production PostgreSQL, private object storage, webhook delivery/cleanup, and analyzer configuration require deployed verification.
- Billing is ready only for a genuinely free listing. Paid submission would require an owner-approved billing plan and Shopify Billing API validation.

## Files changed

- `app/routes/app.connections.jsx`
- `app/routes/app.search.jsx`
- `app/models/shopify-review-contract.test.js`
- `SHOPIFY_REVIEW_SIMULATION_REPORT.md`
- `SHOPIFY_REVIEW_FIX_REPORT.md`
- `SHOPIFY_SUBMISSION_CHECKLIST.md`

## Must be done manually before submission

Complete every unchecked item in `SHOPIFY_SUBMISSION_CHECKLIST.md`, preserve Google Ads read-only behavior, and deploy this exact commit before recording reviewer evidence.
