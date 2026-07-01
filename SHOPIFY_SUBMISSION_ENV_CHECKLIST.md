# Shopify Submission Environment Checklist

Do not submit or run `shopify app deploy` until the required values below are real and verified.

## Required runtime environment

- [ ] `NODE_ENV=production`
- [ ] `SHOPIFY_API_KEY` — app client ID from Shopify; secret manager/config only.
- [ ] `SHOPIFY_API_SECRET` — real app secret; secret manager only.
- [ ] `SHOPIFY_APP_URL` — exact stable public HTTPS origin, no trailing slash; not localhost, a tunnel, example domain, or placeholder.
- [ ] `SCOPES=read_products`
- [ ] `DATABASE_URL` — managed PostgreSQL URL with required TLS settings.
- [ ] `FILE_STORAGE_DRIVER=s3`
- [ ] `S3_BUCKET` and `S3_REGION`
- [ ] Either workload identity or the paired `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.
- [ ] `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` only when required by the S3-compatible provider.
- [ ] `DEV_BYPASS_SHOPIFY_AUTH=false`
- [ ] `SHOPIFY_BILLING_BYPASS=false`
- [ ] `SHOPIFY_BILLING_REQUIRED=false` while the listing is free.

## Analyzer decision

Choose one truthful configuration:

- [ ] Analyzer included in review: set `ANALYZER_ENABLED=true`, real HTTPS `ANALYZER_SERVICE_URL`, secret `ANALYZER_API_KEY`, and a tested `ANALYZER_TIMEOUT_MS`.
- [ ] Analyzer not included: set `ANALYZER_ENABLED=false` and ensure listing/reviewer notes say uploads can be stored but full analysis requires the separately configured analyzer service.

Never configure example analyzer URLs or keys in production.

## Shopify configuration file

Shopify CLI requires concrete URLs in `shopify.app.toml`; it does not substitute `SHOPIFY_APP_URL` into these fields.

- [ ] Set `application_url` to exactly the `SHOPIFY_APP_URL` value.
- [ ] Set the sole `redirect_urls` entry to `<SHOPIFY_APP_URL>/auth/callback`.
- [ ] Confirm `embedded = true`.
- [ ] Confirm access scopes are exactly `read_products`.
- [ ] Confirm relative webhook paths for app uninstall, scope updates, customer requests/redaction, and shop redaction.
- [ ] Run `shopify app deploy` only after the production web service and public endpoints are live.

## Database and migrations

- [ ] Commit every reviewed `prisma/production/migrations/<timestamp>_<name>/migration.sql` before deployment.
- [ ] Never edit a migration after it has been applied.
- [ ] For schema changes, create a new forward PostgreSQL migration; do not regenerate the baseline.
- [ ] Run `npm run setup:production` against a staging PostgreSQL database first.
- [ ] Verify fresh migration, upgrade migration, persistence after restart, backup, and restore.

## Support/legal owner actions

- [ ] Publish a real staffed support contact in the Shopify App Store listing.
- [ ] Ensure the listing contact is also the operational route for support, privacy, copyright, billing, and deletion requests.
- [ ] Publish the actual operator/legal entity details required for the owner's jurisdiction and listing.
- [ ] Obtain qualified review of Terms, Privacy, retention, transfers, dispute, liability, and deletion procedures.
- [ ] Verify support and deletion requests can be received, authenticated to a shop, answered, and logged.

## Pre-submission proof

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `git diff --check`
- [ ] Clean Shopify install and OAuth callback.
- [ ] Onboarding with zero, one, 26+, and—if applicable—1,000+ products.
- [ ] CSV preview/confirm and manual video upload/playback/deletion.
- [ ] Analyzer enabled/disabled/failure behavior matching reviewer notes.
- [ ] Valid and invalid signed webhook deliveries.
- [ ] Uninstall, shop redaction, token/media/data cleanup, and reinstall.
- [ ] Desktop and narrow embedded-browser walkthrough with no placeholder UI, fake metrics, or dead controls.
