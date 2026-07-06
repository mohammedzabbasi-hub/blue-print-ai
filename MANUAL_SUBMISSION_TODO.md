# Manual Shopify Submission TODO

These actions require the owner, hosting environment, Shopify Dashboard, or external services. They cannot be safely completed from source alone.

## P0 — before deployment/config publication

- [ ] Choose and deploy the stable HTTPS production origin.
- [ ] Replace `https://YOUR_PRODUCTION_APP_URL` in `shopify.app.toml`.
- [ ] Replace its callback with `<origin>/auth/callback`.
- [ ] Set the identical `SHOPIFY_APP_URL` in production.
- [ ] Set real `SHOPIFY_API_KEY` and secret `SHOPIFY_API_SECRET`.
- [ ] Set `SCOPES=read_products` exactly.
- [ ] Provision managed PostgreSQL and set `DATABASE_URL` with required TLS.
- [ ] Provision private S3/R2 storage and set driver, bucket, region, and credentials/workload identity.
- [ ] Confirm committed PostgreSQL migrations are included in the deployment artifact.

## P0 — owner/legal/support

- [ ] Publish BluePrintAI Commerce as the operator and complete any additional entity disclosures required for the listing and jurisdiction.
- [ ] Publish and test support@blueprintai.app in the Shopify listing.
- [ ] Make that contact operational for support, privacy, deletion, copyright, security, and billing questions.
- [ ] Obtain qualified review/approval of Terms, Privacy, retention, transfer, incident, dispute, and deletion procedures.
- [ ] Define internal identity verification and response-time procedures for privacy/deletion requests.

## P0 — Shopify Partner/Dev Dashboard

- [ ] Set App URL to the real origin.
- [ ] Set allowed redirect URL to exactly `<origin>/auth/callback`.
- [ ] Confirm embedded mode.
- [ ] Confirm requested scope is only `read_products` and reinstall the review store if needed.
- [ ] Publish/configure all five webhook subscriptions from `shopify.app.toml`.
- [ ] Set public Privacy, Terms, Support, and data-deletion URLs.
- [ ] Keep pricing/listing free while billing is disabled.
- [ ] Remove claims of available Meta/TikTok/Google connections from listing/reviewer notes.
- [ ] Provide reviewer instructions centered on Shopify products, CSV import, and manual upload.

## P0 — analyzer decision

- [ ] Either deploy/configure the analyzer and test it end-to-end, or keep it disabled.
- [ ] If disabled, state clearly in listing/reviewer notes that uploads work but full analyzer output requires the separately configured service.
- [ ] Never use the example analyzer URL/key in production.

## P0 — clean review-store test

- [ ] Complete every step in `SHOPIFY_REVIEW_TEST_SCRIPT.md` against the exact deployed commit.
- [ ] Capture install/callback, onboarding, import, upload, legal, webhook, mobile, and uninstall evidence.
- [ ] Confirm no console/runtime errors or failed production requests.
- [ ] Confirm a second Shopify store cannot access the first store's records or media.

## P1 — operational hardening

- [ ] Configure structured error monitoring, alerts, log retention, backups, and restore testing.
- [ ] Load-test concurrent uploads or replace in-memory buffering with streaming.
- [ ] Add browser E2E and accessibility checks to CI.
- [ ] Add currency provenance before supporting mixed-currency workspaces.
- [ ] Add authenticated installed-app self-service workspace deletion if desired.
- [ ] Server-disable unfinished OAuth routes behind a feature flag before broad launch, even though they are not linked in the current UI.

## Final go/no-go

- [ ] All automated checks pass on the deployment commit.
- [ ] All P0 items above are complete.
- [ ] `FINAL_SHOPIFY_QA_REPORT.md` can truthfully be changed from **Almost** to **Ready**.
- [ ] Only then run `shopify app deploy` and submit the published version for review.
