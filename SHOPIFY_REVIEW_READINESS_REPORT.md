# Shopify App Store Review Readiness Report

Audit date: July 6, 2026  
Production URL: `https://blueprintai-app.onrender.com`

## Current status

**Code readiness: conditionally ready. Submission readiness: not yet confirmed.** The repository has review-safe routes, least-privilege Shopify scope, read-only Google Ads behavior, manual CSV import, public and embedded legal/support routes, and free-listing behavior. The owner must still complete the production and live-install checks below before submission.

## What was audited

- Every sidebar destination and the associated source-level loader/action boundary.
- Dashboard empty/data states and real synced/manual CSV reporting behavior.
- Google Ads authorization, account selection, zero-row sync, disconnect, and reporting-only service calls.
- TikTok/Meta availability claims and direct unfinished TikTok endpoints.
- Shopify auth/session storage, reinstall behavior, idempotent uninstall/redact cleanup, and compliance webhook declarations.
- Production URL, scopes, environment documentation, billing posture, legal/support contacts, and automated contract tests.

## Fixed blockers

- Disabled directly reachable unfinished TikTok OAuth/sync behavior with controlled unavailable responses.
- Changed optional-source copy so Meta, TikTok, Shopify Orders, and TikTok Shop cannot imply a working live sync.
- Added an explicit boundary that Campaign Manager creates local planning folders only and never mutates an ad platform.
- Kept Google Ads zero-row accounts connected and retained the exact zero-row success message.
- Removed the local Google Ads sample-row load/clear controls, handlers, dashboard copy, and reviewer flow to prevent confusion with live reporting.
- Kept manual CSV import as the supported way to provide sample performance data.
- Updated production environment documentation and fixed stale production-origin placeholders in the README.

## Remaining manual tasks

- Verify the Render deployment is healthy and uses the committed production origin.
- Set and verify all production secrets without committing values: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `DATABASE_URL`, `SESSION_SECRET`, storage credentials, and the Google Ads variables when that integration is enabled.
- Confirm `support@blueprintai.app` and the privacy contact are monitored. This is an alias, not a personal Gmail address, but inbox operation cannot be proven from source.
- Owner/legal counsel must confirm the operator identity, mailing address, governing law, retention/subprocessor statements, and policy text in `app/content/legal.js`.
- Test a fresh install, uninstall, and reinstall against the actual review store and production PostgreSQL/S3 services.
- Exercise Google OAuth with the production redirect URI and an approved developer token; verify both a live-row account and a legitimate zero-row account.
- Verify Shopify Partner Dashboard App URL, allowed redirects, scopes, compliance webhook delivery, and listing links.
- Run the reviewer walkthrough at desktop and narrow embedded-admin widths.

## Google Ads reporting note

Google Ads is reporting-only. The service uses accessible-customer listing and search-stream reporting calls; it contains no campaign/ad mutation calls. Test accounts can legitimately return 0 rows. A zero-row sync reports: **“Sync completed. No live Google Ads performance rows were found for this account.”** and leaves the connection active.

## Exact reviewer walkthrough

Follow `SHOPIFY_REVIEWER_TEST_INSTRUCTIONS.md`. The essential path is Install → Onboarding → Connections → optional Google authorization → Sync latest data → verify live rows or the zero-row connected state → use CSV import if sample data is needed → Command Center → verify Ad & campaign effectiveness → visit every sidebar route → confirm Google Ads remains read-only.

## Production URL checklist

- [ ] Render origin is `https://blueprintai-app.onrender.com` with valid TLS.
- [ ] `SHOPIFY_APP_URL` exactly matches that origin without a trailing slash.
- [ ] Shopify App URL and allowed callback URLs match `shopify.app.toml`.
- [ ] No temporary tunnel is configured in the production app or Partner Dashboard.
- [ ] Google callback is `https://blueprintai-app.onrender.com/auth/google-ads/callback`.

## Install/reinstall checklist

- [ ] Fresh install completes Shopify OAuth and creates persistent Prisma sessions.
- [ ] Embedded navigation survives refresh and direct route entry.
- [ ] Repeated uninstall/redact webhook delivery succeeds without crashing.
- [ ] Uninstall cleanup affects only the verified shop's workspace, media, integrations, and sessions.
- [ ] Reinstall creates a clean valid session and does not depend on process memory.

## Billing recommendation

Submit the first review as **free/free-to-install**. Keep `SHOPIFY_BILLING_REQUIRED=false` and `SHOPIFY_BILLING_BYPASS=false` in production. Billing guard code exists for future Shopify-managed pricing, but a paid approval flow has not been established by this audit; do not advertise or enable paid features yet.
