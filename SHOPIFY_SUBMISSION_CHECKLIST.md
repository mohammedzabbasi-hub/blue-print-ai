# Shopify Submission Checklist

## Install and embedded flow

- [ ] Deploy the exact reviewed commit to `https://blueprintai-app.onrender.com`.
- [ ] Fresh-install on a new development/review store.
- [ ] Verify embedded load, App Bridge navigation, refresh, direct deep links, expired session, multiple staff users, uninstall, and reinstall.
- [ ] Verify zero-product and populated-product onboarding; optional Google Ads can be skipped.

## URL and redirects

- [x] Repository `application_url` is `https://blueprintai-app.onrender.com`.
- [x] Repository redirect URLs use the same HTTPS origin.
- [x] No committed ngrok/Cloudflare development URL is used for production.
- [ ] Confirm Partner Dashboard values match and publish configuration.

## Scopes and protected data

- [x] Requested scope is only `read_products`.
- [x] No customer/order/write scopes are requested.
- [ ] Reinstall/re-authorize the review store if its prior grant was broader.
- [ ] Confirm listing data-use answers match actual Shopify, CSV, upload, and Google Ads processing.

## Billing

- [x] Repository declares current review/MVP app free.
- [x] No external payment link was found.
- [ ] Confirm listing price is free and production flags keep billing disabled.
- [ ] Do not submit as paid until Shopify Billing API plan/approval/cancel/re-entry is implemented and tested.

## Support and legal

- [x] Public and embedded privacy, terms, support, contact, deletion, AI disclaimer, refund, cookies, and acceptable-use routes exist.
- [ ] Finalize legal operator identity, address/jurisdiction as applicable, effective date, subprocessors/retention, and qualified legal review.
- [ ] Publish and test a professional support email/contact; match it in the listing and app pages.

## Listing and screenshots

- [ ] Listing claims only features available in the deployed review build.
- [ ] Screenshots label demo/imported/estimated data and avoid outcome guarantees.
- [ ] Reviewer notes explain analyzer availability and optional Google Ads.
- [ ] Provide clean install steps and any required test account instructions.

## Data source truthfulness

- [x] Demo workspace is visibly labeled sample data.
- [x] CSV/imported and Shopify product context are distinguished.
- [x] Revenue blueprints and AI/heuristic recommendations are qualified as estimates/planning output.
- [ ] Recheck all production screens with empty, imported, synced, and demo accounts.

## Google Ads optional read-only flow

- [x] Reporting uses search/list endpoints; no mutate endpoint exists.
- [x] Selected child customer is used; login customer is header context only; IDs are normalized.
- [x] Zero synced rows is a successful state.
- [x] Authorization, account selection, ready-to-sync, error, disconnect, and reconnect states have safe handling.
- [ ] Production-test OAuth with manager `1162462141` and child `3049637762` without creating/editing/pausing/enabling/deleting campaigns, ads, budgets, or ad groups.
- [ ] Verify expired token, permission error, missing config, disconnect revoke warning, and reconnect.

## CSV/demo import and creative workflows

- [x] Automated coverage includes invalid/unsafe files, required fields, dedupe, limits, and provenance.
- [ ] Browser-test valid, empty, malformed, duplicate, and missing-column CSVs.
- [ ] Test supported, unsupported, empty, spoofed, and oversized video files.
- [ ] Confirm failed/disabled analyzer never fabricates results.

## Uninstall and webhooks

- [x] App uninstall, scope update, shop redact, customer redact, and customer data request routes/subscriptions exist.
- [x] HMAC authentication contract and shop-scoped cleanup are tested.
- [ ] Verify signed delivery and invalid-signature rejection in production.
- [ ] Verify uninstall/shop-redact delete PostgreSQL rows, encrypted connections, private media, and sessions idempotently.

## Final verification commands

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `git diff --check`
- [ ] `git status --short`
- [ ] `git diff --stat`
- [ ] Run `./scripts/review-check.sh` in the deployed commit/environment where appropriate.

