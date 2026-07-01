# BluePrintAI Production-Readiness Audit

Audit date: July 1, 2026  
Verdict: **No — not code-ready for Shopify App Review**

## Scope and method

This audit inspected the React Router route tree, Prisma models and migrations, Shopify authentication/session setup, compliance webhooks, billing guard, product loading, CSV/video imports, private media storage, demo-data boundaries, optional ad connectors, public/embedded legal pages, responsive CSS patterns, loading/error/empty states, and automated tests. It also ran lint, typecheck, production build, and the complete Node test suite.

A fresh deployed Shopify install and visual in-app-browser walkthrough were not available in this environment. Findings that require a real HTTPS deployment, Partner Dashboard configuration, Shopify iframe behavior, OAuth providers, PostgreSQL, or S3 are explicitly marked unverified.

## Executive findings

The core MVP is real: authenticated shop scoping, Shopify product reads, CSV preview/confirm, creator imports, manual video upload, private media delivery, campaign CRUD, saved briefs/blueprints/reviews, empty states, and compliance webhook handlers exist. Demo creator generation is now opt-in and production demo bypass is blocked. Direct Meta/TikTok/Google connections are visibly disabled and described as optional.

The app still cannot be submitted. Public legal pages contain literal owner-action scaffolding, production URLs are placeholders, and the support identity conflicts across screens. Several prominent product outputs are deterministic formulas presented as readiness, scale/pause decisions, or revenue upside without disclosing their exact assumptions. Production database evolution is also unsafe because startup regenerates a same-named baseline migration from the current schema.

## Issue table

| ID | Severity | Location | Issue | Why it matters | Recommended fix | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-01 | Blocker | `shopify.app.toml:5,40`; `.env.example:4` | Production App URL and OAuth callback still use `YOUR_PRODUCTION_APP_URL`. | Install/auth cannot work in review and the submitted configuration is visibly incomplete. | Deploy to a stable HTTPS origin, replace both TOML values, set the matching secret environment value, and publish the app configuration. | Reported |
| AUD-02 | Blocker | `app/content/legal.js:1-25,84-105,117-206,470`; `app/routes/support.jsx:67`; `app/routes/app.support.jsx:62` | Terms, Privacy, support, retention, privacy-rights, transfer, incident, governing-law, liability, and contact content contains literal `[[OWNER ACTION REQUIRED...]]` scaffolding. | Reviewers and merchants see unfinished legal pages; privacy/support URLs are submission requirements. | Supply real owner facts, finalize the policies with qualified review, and remove every scaffold marker before submission. | Reported |
| AUD-03 | High | `scripts/prepare-production-prisma.mjs:9-10,23-55`; `package.json` (`setup:production`) | Every production setup regenerates one fixed migration, `20260630000000_initial_postgresql`, from the entire current schema. | After first deployment, later schema changes rewrite an already-applied migration/checksum instead of creating forward migrations; upgrades can fail or drift. | Commit a stable PostgreSQL baseline once, stop rewriting it at startup, and add immutable timestamped migrations for every future schema change. Test upgrade from the currently deployed schema. | Reported |
| AUD-04 | High | `app/routes/app._index.jsx:313-319,659-675`; `app/components/dashboard/StatCards.jsx:49-50`; `app/components/dashboard/TopCreatives.jsx:61-80` | “Readiness” is a hardcoded activity-count formula plus 35% of an average analysis score, shown as a percentage without methodology. | A merchant can interpret an arbitrary workflow-completion score as measured creative/business readiness. | Rename to “Workspace completion” and disclose the formula, or replace it with evidence-backed dimensions. Never present it as performance probability. | Reported |
| AUD-05 | High | `app/routes/app._index.jsx:563-590`; `app/components/dashboard/TopCreatives.jsx:61-80,141-143` | Imported records receive an invented 45–100 “estimated readiness” score derived from engagement, orders, and revenue. | It converts merchant-supplied metrics with different scales into a synthetic percentage and ranks creatives as if comparable. | Remove the synthetic score for imported performance; rank by a user-selected real metric or show a plainly named, documented heuristic with confidence/data completeness. | Reported |
| AUD-06 | High | `app/routes/app.creators.jsx:659-703,720-750`; `app/routes/app.creators.$creatorId.jsx:104` | Creator “performance score” starts with a hardcoded fit score of 70 and drives “Scale / Keep testing / Coach or pause” decisions. | This can recommend budget/action from arbitrary constants and incomplete imported data. | Replace decision labels with descriptive data completeness and real metric comparisons; if retained, expose inputs, weighting, minimum evidence, and “heuristic—not measured” labeling beside every score. | Reported |
| AUD-07 | High | `app/models/blueprint.server.js:1766-1780`; `app/routes/app.revenue-blueprint.jsx:281-299` | “Estimated upside” is always 35% of imported revenue, with no causal model, baseline, time period, currency, or visible formula. | The output resembles a financial forecast despite being an unsupported multiplier. | Remove the dollar projection or let the merchant enter an explicit scenario assumption and display the equation, period, currency, and non-guarantee inline. | Reported |
| AUD-08 | High | `app/content/legal.js:7`; `app/routes/support.jsx:67`; `app/routes/app.support.jsx:62`; `app/routes/app.settings.jsx:458-460` | Most support surfaces show a placeholder while Settings exposes a hardcoded personal Gmail address. | Contact/deletion instructions conflict, may leak a personal address, and cannot be trusted by reviewers. | Define one verified support address in centralized configuration/content and use it everywhere, including the listing and privacy policy. | Reported |
| AUD-09 | High | `app/models/blueprint.server.js:18-49,1097-1128` | Shopify product loading fetches only the 25 most recently updated products and has no pagination. | Stores with more than 25 products silently lose catalog context; “entire store” onboarding is inaccurate. | Implement cursor pagination with a bounded safety limit/cache, or clearly offer recent-25 selection rather than claiming the whole store. | Reported |
| AUD-10 | High | `app/routes/app.video-analysis.jsx:96-103,1235-1240`; `.env.example:22-26`; `app/routes/_index/route.jsx:18,190-199,228-234` | AI Review Studio depends on an external analyzer that is disabled by default; without it, upload works but the advertised analysis feature does not. | A reviewer following the primary feature path can receive “analysis unavailable,” while public marketing still leads with creative analysis. | Deploy and verify the analyzer for review, or reposition the listing/page as upload-only until configured. Add a health/readiness check to deployment. | Reported |
| AUD-11 | High | Deployment/Partner Dashboard; `app/shopify.server.js`; `app/routes/webhooks.*.jsx`; `app/utils/upload-storage.server.js` | No deployed clean-install, auth callback, signed webhook, PostgreSQL, private S3 playback/deletion, or uninstall/reinstall evidence exists for this commit. | Passing local tests cannot prove the Shopify review journey or production infrastructure. | Complete the deployment checklist against a clean development store and retain screenshots/logs for valid and invalid cases. | Reported |
| AUD-12 | Medium | `app/components/dashboard/PerformanceChart.jsx:36-44`; other `formatCurrency` helpers | Dashboard and generated monetary values are formatted as USD even though Shopify returns `shop.currencyCode` and imported files do not carry a normalized currency. | Non-USD merchants can see materially misleading revenue/spend/upside. | Persist currency provenance, use the shop/import currency, and refuse to aggregate mixed currencies without conversion. | Reported |
| AUD-13 | Medium | `app/routes/auth.tiktok.*.jsx`; `app/routes/app.connections.tiktok.sync.jsx`; `app/services/tiktok-ads.server.js:56-68`; Google auth/sync routes | Connector cards are disabled, but publicly routed OAuth/sync implementations remain reachable; TikTok account discovery and sync intentionally throw. | Direct URLs expose unfinished flows and expand review/support/security surface despite “coming soon” UI. | Feature-flag the routes server-side to a controlled 404/disabled response, or remove them from the deployed route manifest until complete. Preserve code on a branch/module. | Reported |
| AUD-14 | Medium | `app/utils/upload-storage.server.js:60-93`; `app/routes/app.video-analysis.jsx`; import actions | Each video is fully buffered in process memory before validation/storage (up to 100 MB per file; 250 MB request). | Concurrent real uploads can exhaust container memory and cause crashes. | Stream multipart uploads and hashing directly to private storage, enforce limits while streaming, and load-test concurrent uploads. | Reported |
| AUD-15 | Medium | `app/routes/app.settings.jsx:444-460`; `app/content/legal.js:173-198` | Installed merchants have no self-service full workspace deletion control; only developer reset or contact instructions exist. | Deletion requests require manual handling and the hardcoded/placeholder contact is unreliable. | Add an authenticated destructive deletion flow with confirmation, audit receipt, media cleanup, and clear session/uninstall behavior. | Reported |
| AUD-16 | Medium | `app/routes/_index/route.jsx:124,234,253-254`; `app/routes/app.connections.jsx:28-49,128,237-276` | Public marketing repeatedly advertises planned TikTok Shop integration while Connections only lists TikTok Ads, Meta, and Google as unavailable. | The product feels roadmap/demo-led and may confuse reviewers about what is actually included. | Move roadmap copy out of primary product marketing; list only currently usable capabilities and label optional future connections once. | Reported |
| AUD-17 | Medium | `package.json`; `app/**/*.test.js` | Tests are strong at unit/model/source-contract level, but there is no browser/E2E script for install, onboarding, forms, uploads, navigation, billing, responsive UI, or OAuth. | Route modules can pass 151 tests while buttons, iframe navigation, focus behavior, or deployment integrations remain broken. | Add Playwright against a controlled authenticated test setup and a manual clean-store review script; cover narrow and desktop widths. | Reported |
| AUD-18 | Medium | Responsive tables/modals in `app/routes/app.data-import.jsx:850-880`, `app/routes/app.creative-library.jsx`, `app/routes/app.campaigns.$id.jsx` | Source uses scrollable wide tables and responsive grids, but no fresh visual verification was possible; custom dialogs lack demonstrated focus trap/restore and Escape behavior. | Mobile usability and keyboard accessibility remain unproven and can affect real users/review quality. | Run WCAG-focused browser QA at 390/430/768/1440 px; add dialog focus management and automated accessibility checks. | Reported |
| AUD-19 | Low | React Router build/typecheck output; `vite.config.js` | React Router v8 future-flag warnings repeat during type generation/build; server-only routes generate empty client chunks. | Not a current failure, but upgrade drift/noisy CI can conceal new warnings. | Evaluate and adopt supported future flags incrementally; document expected server-route chunk warnings. | Reported |
| AUD-20 | Low | Public landing copy, formerly `app/routes/_index/route.jsx:224` | Landing page claimed JSON import although only CSV upload/paste is implemented. | Misstated a core working path. | Correct copy to CSV only. | **Fixed in this audit** |

## Feature readiness matrix

| Area | Current assessment | Review disposition |
| --- | --- | --- |
| Command Center | Real persisted/imported data and good empty states; synthetic readiness rankings remain misleading. | Fix AUD-04/05 before review. |
| Creative Library | Upload/save/detail/delete/campaign assignment and provenance labels exist; production storage must be verified. | Almost, pending deployed storage and browser QA. |
| AI Review Studio | Fails closed without fabricated analyzer output; analyzer is not operational by default. | Block or explicitly exclude until service is deployed. |
| Ad Briefs | Deterministic product-context templates persist correctly and expose source evidence. | Usable if described as planning templates, not measured AI performance. |
| Recommendations / AI Advisor | Deterministic, evidence-aware advisor with no fake empty-state winner. | Rename/disclose as rules-based advisor in listing and UI. |
| Revenue Blueprint | Persists shop-scoped plans and labels estimates, but 35% upside is unsupported. | Fix AUD-07. |
| Creators | Imported creator attribution works; no production sample creators leak, but score/decision heuristics are unsafe. | Fix AUD-06. |
| Data Import | CSV preview/confirm, validation, idempotent updates, creator-only rows, and optional video matching are implemented and tested. | Core review path; add E2E and load tests. |
| Settings / onboarding | Profile/preferences/product/manual context and empty states exist. | Verify clean install; centralize support and add deletion. |
| Shopify auth/session | Standard Shopify library and Prisma session storage; dev bypass is production-disabled. | Verify deployed install/token refresh/uninstall. |
| Shopify products/orders | Read-only products are real but capped at 25; orders are intentionally not connected. | Fix catalog claim/pagination; keep orders clearly unavailable. |
| Optional OAuth | UI truthfully disables all connectors; underlying TikTok flow is unfinished. | Server-disable unfinished routes. |
| Billing | Current policy/config is free; guard code exists for a future paid mode but no paid plan is review-tested. | Keep listing free or complete Shopify billing end-to-end before charging. |
| Legal/support | Routes exist and are linked publicly and in-app. Content is unfinished and inconsistent. | Blocker. |

## Automated checks

| Command | Result |
| --- | --- |
| `npm run lint` | PASS (exit 0) |
| `npm run typecheck` | PASS (exit 0; React Router v8 future-flag warnings) |
| `npm run build` | PASS (exit 0; 2,756 modules transformed; future-flag and expected empty server-route chunk warnings) |
| `npm run test` | PASS (exit 0; 151 tests passed, 0 failed, 0 skipped) |

## Changes made during audit

- `app/routes/_index/route.jsx`: changed the unsupported “CSV/JSON” import claim to “CSV performance data.”
- Added `AUDIT_REPORT.md`, `REVIEW_READINESS_CHECKLIST.md`, and `FIX_PRIORITY_LIST.md`.

No feature, schema, auth, billing, OAuth, or architecture changes were made.
