# Shopify Review Readiness Checklist

Current status: **Not ready**  
Updated: July 1, 2026

## Submission blockers

- [ ] Replace `YOUR_PRODUCTION_APP_URL` in `shopify.app.toml` and production environment configuration.
- [ ] Finalize Terms, Privacy, data deletion, support, retention, entity identity, address, effective date, and governing-law content; remove every owner-action marker.
- [ ] Use one verified support/privacy email everywhere and ensure it is staffed.
- [x] Stop runtime rewriting of the PostgreSQL baseline and commit immutable production migration history. A real staging upgrade test is still required.
- [x] Transparently relabel dashboard/creative/creator heuristics and remove the unsupported 35% revenue-upside forecast.
- [ ] Decide whether AI Review Studio is part of review. If yes, deploy/configure it and prove successful and failed analyses. If no, make the listing and primary navigation accurately describe its unavailable state.

## Production infrastructure

- [ ] Deploy the exact reviewed commit to a stable HTTPS origin.
- [ ] Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES=read_products`, and keep production auth/billing bypasses false.
- [ ] Provision PostgreSQL and run a tested, immutable migration sequence.
- [ ] Configure a private S3-compatible bucket and least-privilege credentials/workload identity.
- [ ] Verify authenticated upload, playback, missing object, storage outage, and workspace/uninstall deletion.
- [ ] Configure health checks, error reporting, structured logs, backups, and restore testing.
- [ ] If analyzer is enabled, configure its HTTPS URL/key/timeout and monitor availability.

## Shopify Partner / Dev Dashboard

- [ ] Set the App URL to the production origin.
- [ ] Set the allowed redirect URL to exactly `<origin>/auth/callback`.
- [ ] Confirm embedded mode and requested scope `read_products` only.
- [ ] Publish the matching `shopify.app.toml` only after endpoints are live.
- [ ] Confirm valid signed delivery for `app/scopes_update`, `app/uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact`.
- [ ] Confirm invalid webhook signatures are rejected.
- [ ] Match listing claims, free/paid status, refund position, privacy URL, support URL, and reviewer instructions to the deployed behavior.
- [ ] Do not advertise Meta/TikTok/Google connectivity as available.

## Core clean-store journey

- [ ] Install from scratch and complete OAuth inside Shopify Admin.
- [ ] Confirm onboarding cannot be bypassed and survives refresh/re-entry.
- [x] Add bounded cursor pagination beyond 25 products with partial-load diagnostics; deployed-store testing is still required.
- [ ] Complete onboarding with Shopify product context and manual product context.
- [ ] Import a valid creative CSV, creator-only CSV, duplicate CSV, malformed CSV, oversized CSV, and CSV with missing optional metrics.
- [ ] Match multiple supported videos to CSV rows; test invalid signatures, duplicate names, per-file limit, request limit, and storage failure.
- [ ] Verify imported values remain merchant-provided/imported and are never labeled Shopify or connected-platform measurements.
- [ ] Create/edit/delete creatives, analyses, briefs, blueprints, creators/attributions, and campaigns; refresh after every save.
- [ ] Test every sidebar link, public legal link, search result, unknown detail ID, browser back/forward, and deep link.
- [ ] Verify all unavailable metrics render “Not imported/Not available,” not zero.
- [ ] Verify demo data is absent from normal production workspaces and conspicuously labeled in explicit local demo mode.

## Truthfulness and product claims

- [ ] Rename or document every heuristic score and expose its inputs/limitations.
- [ ] Remove arbitrary financial upside projections or convert them into explicit user-controlled scenarios.
- [ ] Ensure “AI” wording distinguishes external analyzer results from deterministic/rules-based planning.
- [ ] Ensure currency comes from a known shop/import source and mixed currencies are not aggregated.
- [ ] Keep Shopify orders, Meta, TikTok Ads/Shop, Google Ads, and YouTube labeled unavailable unless genuinely connected and tested.
- [ ] Keep manual upload, CSV import, and Shopify products useful without any optional OAuth integration.
- [ ] Remove roadmap-heavy “MVP/planned” language from primary marketing surfaces.

## Privacy, data handling, and billing

- [ ] Add or document a reliable installed-app workspace deletion request flow.
- [ ] Verify uninstall/shop-redact removes all shop-scoped DB records, sessions, connections/tokens, and media.
- [ ] Confirm customer data-request/redact responses and operational response procedures.
- [ ] Document actual retention, backups, subprocessors, transfer locations, and incident contact/process.
- [ ] Verify access token/refresh token behavior over token expiry and app reauthorization.
- [ ] Keep the review listing free while `SHOPIFY_BILLING_REQUIRED=false`; if charging, implement and test Shopify-managed plan selection, cancellation, and status handling first.

## UX, mobile, accessibility, and reliability

- [ ] Test authenticated embedded UI at 390, 430, 768, 1024, and 1440 px.
- [ ] Verify sidebar expansion/collapse, horizontal tables, charts, upload controls, modals, and long content at every width.
- [ ] Add dialog focus trap, focus restoration, Escape close, and accessible labels where missing.
- [ ] Test keyboard-only navigation and run an automated accessibility scan.
- [ ] Verify loading, double-submit prevention, error recovery, empty states, and retry behavior for every form/action.
- [ ] Load-test simultaneous 100 MB uploads or replace in-memory buffering with streaming.

## Quality gates

- [x] `npm run lint` — passes.
- [x] `npm run typecheck` — passes with future-flag warnings.
- [x] `npm run build` — passes with warnings.
- [x] `npm run test` — 151 pass, 0 fail.
- [ ] Add route/browser E2E tests for the clean-store journey.
- [ ] Run all gates against the exact deployed commit and production environment configuration.
- [ ] Record a final reviewer walkthrough with no placeholders, unlabeled samples, unavailable primary features, or dead controls.

Only mark the app ready when every Submission blocker is complete and the deployed clean-store journey passes.
