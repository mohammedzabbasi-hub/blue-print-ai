# BluePrintAI Production Deployment Checklist

## Required environment-variable names

Set values in Render; never commit or paste them into screenshots/reports.

Core required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES=read_products`
- `SESSION_SECRET`
- `FILE_STORAGE_DRIVER=s3`
- `S3_BUCKET` (or supported `MEDIA_S3_BUCKET` alias)
- `S3_REGION` (or supported `MEDIA_S3_REGION` alias)
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, unless workload credentials are intentionally used

Optional S3-compatible storage:

- `S3_ENDPOINT`
- `S3_FORCE_PATH_STYLE`
- `MAX_UPLOAD_SIZE_BYTES`
- `PRIVATE_MEDIA_ROOT` (local development only; do not use on ephemeral production)

Analyzer, required together when enabled:

- `ANALYZER_ENABLED=true`
- `ANALYZER_SERVICE_URL` (HTTPS in production)
- `ANALYZER_API_KEY`
- `ANALYZER_TIMEOUT_MS` (optional)

Google Ads, required together when the integration is enabled:

- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_REDIRECT_URI`
- `GOOGLE_ADS_ENCRYPTION_SECRET` or `AD_PLATFORM_TOKEN_ENCRYPTION_KEY`
- `AD_PLATFORM_OAUTH_STATE_SECRET` (optional; falls back to Shopify secret)
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (manager accounts only)
- `GOOGLE_ADS_API_VERSION` (optional)

Assistant provider, required together only when enabled:

- `LLM_PROVIDER`
- `LLAMA_API_KEY`
- `LLAMA_API_BASE_URL`
- `LLAMA_MODEL`

Billing:

- `SHOPIFY_BILLING_REQUIRED`
- `SHOPIFY_APP_HANDLE` when billing is required
- `SHOPIFY_BILLING_BYPASS=false` in production

Must be absent or false in production:

- `ENABLE_DEVELOPER_TOOLS`
- `SHOPIFY_BILLING_BYPASS`
- `DEV_BYPASS_SHOPIFY_AUTH`
- `SHOPIFY_DEV_TUNNEL_URL`
- local/tunnel-only host variables

## Exact Render commands

Recommended Render native Node service:

- Build Command: `npm ci && npm run build`
- Pre-Deploy Command: `npm run setup:production`
- Start Command: `npm run start`
- Health Check Path: `/health`

Exact migration command:

`npm run setup:production`

This command runs:

`npm run prisma:prepare:production && prisma generate --schema prisma/production/schema.prisma && prisma migrate deploy --schema prisma/production/schema.prisma`

Docker deployment:

- Build: use the committed `Dockerfile`.
- Start: container default `npm run docker-start`.
- `docker-start` runs production setup/migrations before `npm run start`.
- If Render Pre-Deploy already runs `npm run setup:production`, prefer native `npm run start` afterward instead of migrating twice. Repeated `migrate deploy` is designed to be safe, but a single clear migration owner is easier to operate.

## Current migration state

Repository production migration order:

1. `20260630000000_initial_postgresql`
2. `20260702090000_add_google_ads_connection_state`
3. `20260705180000_add_ad_performance_provenance`
4. `20260706120000_add_google_ads_campaign_selection`
5. `20260710160000_add_video_analysis_lifecycle`
6. `20260710190000_redesign_creative_briefs`

Local SQLite reports all 14 local migrations applied. The real production pending set cannot be determined without the production database. Do not assume the two July 10 migrations are applied; let `prisma migrate deploy` and `prisma migrate status` verify.

## Pre-deploy

- [ ] Backup/snapshot the managed PostgreSQL database according to Render/provider procedures.
- [ ] Confirm deploy targets the correct database and app origin; do not print the URL.
- [ ] Confirm no production environment variable contains localhost, ngrok, TryCloudflare, or a placeholder origin.
- [ ] Confirm `SHOPIFY_APP_URL` is the exact HTTPS origin without a path.
- [ ] Confirm `SCOPES` is exactly `read_products`.
- [ ] Confirm S3/R2 bucket is private and persistent.
- [ ] Confirm analyzer URL is HTTPS and key matches the analyzer service when enabled.
- [ ] Confirm Google redirect is exactly `<SHOPIFY_APP_URL>/auth/google-ads/callback` when enabled.
- [ ] Confirm developer/billing/auth bypass flags are false/absent.
- [ ] Run the automated release gates locally.

## Deploy and migration verification

- [ ] Run Pre-Deploy: `npm run setup:production`.
- [ ] Confirm Prisma reports successful migration deployment; do not use `migrate reset`, `db push`, or edit an applied migration.
- [ ] Start with `npm run start`.
- [ ] Confirm `/health` returns `200`, body `ok`, and `Cache-Control: no-store`.
- [ ] Inspect Render logs for startup/migration errors without copying secrets into tickets/screenshots.
- [ ] Run `npx prisma migrate status --schema=prisma/production/schema.prisma` inside the production environment; confirm up to date.

## Shopify verification

- [ ] `shopify.app.toml` application URL equals the deployed origin.
- [ ] Allowed redirects include the active Shopify callback routes on the same origin.
- [ ] App is embedded and loads from Shopify Admin.
- [ ] App install/re-auth works and stored session uses production PostgreSQL.
- [ ] Required compliance webhook subscriptions are in the deployed app version.
- [ ] Test signed uninstall/scopes-update in a non-production review store; verify response and cleanup behavior.

## OAuth and integration verification

- [ ] Google Ads OAuth begins inside Shopify Admin and returns to Connections with embedded context.
- [ ] Invalid/expired state fails safely.
- [ ] Account discovery works for the intended direct or manager account.
- [ ] Campaign checkbox changes auto-save and persist after refresh.
- [ ] Zero-row sync remains connected and displays a truthful no-rows message.
- [ ] Disconnect removes the local encrypted token and attempts Google grant revocation.
- [ ] Analyzer success, timeout, invalid response, unavailable state, and unsupported upload all show merchant-safe messages.
- [ ] Private media remains playable after a new deploy and is inaccessible from another shop.

## Public route verification

Check while logged out and on mobile width:

- [ ] `/`
- [ ] `/health`
- [ ] `/privacy`
- [ ] `/terms`
- [ ] `/support`
- [ ] `/data-deletion`
- [ ] `/contact`
- [ ] `/cookies`
- [ ] `/acceptable-use`
- [ ] `/refund-policy`
- [ ] `/ai-disclaimer`
- [ ] `/copyright`
- [ ] `/legal`

Confirm current naming, support contact, readable layout, mutual links, accurate data-use language, and no placeholder/private/test contact.

## Rollback considerations

- Application rollback must not roll back or rewrite applied migration history.
- The July 10 migrations are additive; older application code may not understand newer lifecycle/brief fields even though defaults preserve existing rows. Prefer forward-fixing the app over running an old binary for an extended period.
- Snapshot before migration. If a release must be rolled back, keep the migrated database and deploy a compatible forward fix; do not run `prisma migrate reset` or manually drop columns/data.
- Preserve the S3/R2 bucket during app rollback. Database rollback alone does not restore deleted media.
- If migration deployment fails, keep the web service from accepting traffic, inspect the exact failed migration and database state, and create a new roll-forward migration after review.

## Final release sign-off

- [ ] Production migrations up to date.
- [ ] Build/start/health green.
- [ ] Shopify embedded flow verified.
- [ ] Video analyzer and private playback verified.
- [ ] Google Ads flow verified or deliberately omitted with truthful unavailable state.
- [ ] Public legal/support routes verified logged out.
- [ ] `FINAL_VIDEO_DEMO_CHECKLIST.md` completed.
