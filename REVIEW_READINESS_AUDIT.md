# BluePrintAI Review Readiness Audit

Date: 2026-06-22

Context: follow-up audit after the persistence, honesty, Activity Log, Settings, Data Import, TikTok, and Creators cleanup passes documented in `SAVE_FEATURE_AUDIT.md`.

## Overall Readiness Score

**89 / 100**

The Shopify app is now ready for **deeper manual browser testing on a development store**, but it is **not ready for Shopify App Store submission**. The core persistence story is much stronger than the earlier audit: saved briefs, video analyses, saved creatives, revenue blueprints, settings, activity logs, Recommendations, Command Center, and Settings Active Shop context are Prisma-backed and scoped by `session.shop` on the main rewritten routes. Legacy standalone Login/Onboarding screens now redirect into `/app`, the unused legacy helper chain has been removed, the app scope set has been reduced to product reads only, and the highest-risk claim/provenance copy now distinguishes saved app data, manual/demo data, AI-estimated readiness, and unsupported live integrations. The biggest remaining risks are legal/privacy review and final UI/navigation polish.

## Page-by-Page Status

| Area | Status | Evidence | Review readiness |
|---|---|---|---|
| App shell / sidebar | Good | Main nav links resolve; top search submits to `/app/search`; Recent Activity uses `ActivityLog`. Sidebar Support/Privacy/Terms links now point to real embedded app routes: `/app/support`, `/app/privacy`, and `/app/terms`. Legacy `/app/settings?panel=...` legal/support URLs redirect to those routes. Sidebar no longer clears legacy browser auth; it links to Shopify login. | Ready for manual testing. |
| Command Center | Mostly good | `app/routes/app._index.jsx` now uses a Shopify-authenticated loader and builds workspace dashboard metrics from saved analyses, creatives, briefs, blueprints, settings, and activity logs. The Ad performance tracking graph no longer uses saved app records, activity logs, or readiness scores as proxy performance data; it shows an empty state until real imported ad/sales metric records exist. | Ready for manual testing. |
| Top search | Mostly good | `/app/search` uses Shopify-authenticated loader in production and searches products, saved creatives, saved briefs, recommendations, and demo creator insights. Empty states are clear. Local demo bypass returns no results with a warning. | Ready for manual testing. |
| Creative Library | Good | Loader/action use `loadShopifyRouteContext`, `listSavedCreatives`, and `saveCreativeRecord`. Save survives refresh. File uploads now persist local development media when no remote URL is supplied; detail cards render saved video URLs and clearly label older metadata-only records. Metric cards now show AI-estimated planning indicators instead of unsupported imported performance metrics. | Ready for manual testing; production media storage still needs durable object storage. |
| Creative Library detail | Good | Loads by `findSavedCreative(session.shop, params.id)` and 404s missing records. Metadata-only state is honest. | Ready. |
| Video Analysis / AI Review Studio | Good | Analyze/save/manual save/save to library/generate blueprint use Remix actions and Prisma helpers. Loading/success/error states exist. Auto-save setting is consumed. Scores and impact copy now say AI-estimated creative readiness/planning signals, not guaranteed performance. | Ready for manual testing. |
| Ad Briefs | Good | Loader/action use `listSavedBriefs` and `saveBriefRecord`; button is disabled when no product context exists; success/error states exist. | Ready. |
| Recommendations | Mostly good | `app/routes/app.recommendations.jsx` now uses a Shopify-authenticated loader and generates planning recommendations from saved analyses, creatives, briefs, blueprints, and workspace settings. Empty state is honest. | Ready for manual testing. |
| Revenue Blueprint | Good | Loader/action use `findRevenueBlueprint`, `listRevenueBlueprints`, and `saveRevenueBlueprintRecord`; success/error/empty states exist. | Ready. |
| Creators | Honest demo | Creator CRUD/import/sync controls are disabled and labelled coming soon. Pages explicitly say profiles are demo/manual planning examples, not live TikTok creators or affiliate performance. | Ready for manual testing as demo-only. |
| Creator detail | Honest demo | Missing creator state is handled; detail page labels demo/manual creator profile and disables CRM actions. | Ready for manual testing as demo-only. |
| Data Import | Honest disabled state | Legacy CSV/JSON/clear actions removed. Page shows supported persisted workflows and disabled coming-soon import cards. | Ready for manual testing. |
| Settings | Good | Video preferences persist via `WorkspaceSetting`; TikTok controls are disabled and honest. Active Shop now displays authenticated `session.shop` only and no longer offers in-app shop switching. Email summaries are labelled as a saved preference only; delivery is not active yet. | Ready for manual testing. |
| Activity Log | Good | Loader/action use `ActivityLog` by `session.shop`; clear action has loading/success/error states. | Ready. |
| Login | Safe redirect | `/login` now redirects to `/app`. It no longer calls legacy auth, renders a standalone login form, or writes browser auth/shop state. | Ready for review path. |
| Onboarding | Safe redirect | `/onboarding` now redirects to `/app`. It no longer calls legacy onboarding or writes browser auth/shop state. | Ready for review path. |
| Legal/support pages | Mostly okay | `/privacy`, `/terms`, `/support` exist and disclose TikTok OAuth is not live. | Ready with copy review. |
| Webhooks / privacy | Mostly good | App uninstall and shop redact delete app-owned workspace data. Customer webhooks state no customer records are persisted. | Needs human privacy-policy confirmation. |
| Prisma schema/models | Good | Models exist for saved briefs, video analyses, saved creatives, revenue blueprints, workspace requests, workspace settings, activity logs, and Shopify sessions. | Ready for deeper testing. |
| Authentication/session scoping | Good | Rewritten app routes use `session.shop`; `/login` and `/onboarding` redirect to `/app`. The unused legacy `accountContext`, `shopSession`, `engineApi`, and legacy `activityLog` helper chain has been deleted. | Ready for deeper testing. |

## Critical Blockers

No critical blockers remain in the currently rewritten Shopify app review path.

## Major Issues

1. Persistence duplicate prevention is application-level fingerprinting, not database-enforced uniqueness.
No major scope-specific issue remains after the scope cleanup pass. Remaining major risk is production legal/privacy review.

## Minor Polish Issues

1. Several buttons use text arrows and plain glyphs rather than consistent icon buttons.
2. Many cards use large rounded corners and nested card-like containers; not a blocker, but visual density may feel less native inside Shopify admin.
3. `.DS_Store` exists under `app/routes/`; harmless but should be removed from the repo if tracked or ignored if not.
4. `Activity Log` clear has no confirmation; it is scoped and recoverability may not matter, but accidental deletion is easy.
5. Some legacy CSS/component names still include "performance" internally, but visible copy now labels saved/planning metrics honestly.
6. Search result links for creative records use `?creativeId=...`, but Creative Library does not focus or highlight that ID.
7. Revenue Blueprint saved-history rows are not clickable despite the loader supporting `blueprintId`.
8. Email summaries can be saved in Settings as a future preference, but there is no email delivery feature yet.

## Shopify Review Risks

1. **Session scoping:** Main persisted routes are now shop-scoped, and the unused legacy localStorage shop-ID helper chain has been deleted.
2. **External dependencies:** Reviewers may see failures if pages call `http://127.0.0.1:8000` or another unavailable backend.
3. **Unsupported integrations:** TikTok is mostly cleaned up, but any remaining integration copy should continue to state OAuth/API sync is coming soon.
4. **Claims:** Scores, recommendations, briefs, and revenue blueprints are now framed as AI-estimated planning outputs. Final legal/human review should still confirm no marketplace or ad-performance guarantee is implied.
5. **Data deletion/privacy:** App uninstall and shop redact delete app-owned workspace rows. Customer data webhooks are stubs because no customer models exist; privacy copy should match this.
6. **Scopes:** Current configured scope is `read_products`; order reads are not requested in this build.
7. **Billing:** The app has billing checks but can bypass billing by env/local/demo. Verify production env cannot accidentally bypass required billing.
8. **Demo bypass:** `loadShopifyRouteContext` bypasses Shopify auth outside production and on `?demo=1`. Production behavior should be verified so review does not expose demo mode unexpectedly.

## Remaining Fake/Demo-Labelled Features

| Feature | Current label quality | Notes |
|---|---|---|
| Creator discovery / outreach / affiliate sync | Good | Disabled and clearly labelled coming soon/demo. |
| TikTok OAuth/API sync | Good in Settings/Data Import/Creators | Disabled and clearly states no TikTok seller account or tokens. |
| Data imports | Good | CSV/JSON/TikTok/Shopify sync disabled until models exist. |
| Command Center analytics | Good | Workspace summary sections use saved Shopify app records and label them as saved activity/planning signals. The ad performance graph is empty until real performance records exist; saved creatives, analyses, briefs, activity logs, and readiness scores are not counted as ad performance. |
| Recommendations | Good | Uses saved Shopify app records and labels output as estimated planning recommendations, not live performance. |
| Video Analysis predictions | Good | Functional and persisted; scores are now labelled AI-estimated creative readiness/planning signals. |
| Settings email summaries | Good | Preference persists and copy says email delivery is not active yet. |
| Public Login/Onboarding | Good | `/login` and `/onboarding` redirect to `/app`; public CTAs no longer point to standalone account creation. |

## Broken Routes or 404 Risks

- Sidebar primary routes exist: `/app`, `/app/creative-library`, `/app/video-analysis`, `/app/ad-briefs`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/creators`, `/app/data-import`, `/app/settings`.
- Detail routes exist for `/app/creative-library/:id` and `/app/creators/:creatorId`.
- `/app/activity-log` exists but is not in the primary sidebar; it is reachable through notification fallbacks and direct URL.
- `/app/support`, `/app/privacy`, and `/app/terms` exist as embedded, Shopify-authenticated support/legal summary pages.
- `/app/settings?panel=support`, `/app/settings?panel=privacy`, and `/app/settings?panel=terms` redirect to `/app/support`, `/app/privacy`, and `/app/terms`.
- Search creative links with `?creativeId=` do not 404, but they do not deep-link to a specific highlighted creative.

## API_BASE and localStorage Findings

No active Shopify route, component, model, or service imports `API_BASE`, `getSelectedShopId`, `setSelectedShopId`, `getAuthHeaders`, `accountContext`, or `shopSession`.

Remaining `shop_id` matches in app code are persisted/custom-data field names such as TikTok metadata keys, not browser-local shop identity. Historical audit docs may still mention removed legacy behavior for traceability.

No stale imports of deleted `CreatorForm.jsx` or `app/services/creatorsApi.js` were found in active code.

## Recommended Next Implementation Order

1. Add clickable saved Revenue Blueprint history and optional creative deep-link highlighting.
2. Complete a mobile/manual browser QA pass across the embedded app review path.
3. Do a final legal/privacy/scope review against production distribution requirements.

## Shopify Product Data Integration Pass

Date: 2026-06-24

### What Shopify Data Is Loaded

- The app now loads authenticated Shopify product summaries through `authenticate.admin(request)` and `admin.graphql`.
- The Admin GraphQL query reads `shop { name myshopifyDomain currencyCode }` plus `products(first: 25, sortKey: UPDATED_AT, reverse: true)`.
- Product fields loaded: `id`, `title`, `handle`, `status`, `productType`, `vendor`, `featuredImage { url altText }`, first three variants with `id`, `title`, `price`, plus `createdAt` and `updatedAt`.
- Product data is normalized for live loader use. Full catalogs are not persisted; only selected product context is saved in `workspace_profile`.

### What Scope Is Used

- `shopify.app.toml` still requests only `read_products`.
- The product query was validated against the Shopify Admin GraphQL schema for API version `2026-04`; the minimal `featuredImage` version requires `read_products`.
- A newer `featuredMedia` query shape was not used because validation reported broader scope requirements.

### Orders Revenue Customer Data Status

- This pass does not query orders, customers, revenue, fulfillment, or inventory.
- Revenue Blueprint remains a planning output based on product context and saved app activity, not live revenue/order data.
- Command Center still uses saved app records and planning signals; Shopify product count is shown as product context only.

### Where Product Data Appears

- Onboarding and Settings can select a real Shopify product and save its summary into `workspace_profile`.
- Command Center displays Shopify product count plus the selected/main product.
- Recommendations use the selected Shopify product context when no saved records exist yet.
- Ad Briefs, Revenue Blueprint, Video Analysis, and Creative Library upload include optional product selection where generation or upload context needs a product.
- Empty/error states are non-blocking and keep manual product/profile input available.

### Remaining Risks And Limitations

- Manual QA inside a real Shopify development store is still required to confirm live product loading, zero-product shops, and API-failure behavior.
- `featuredImage` is deprecated in the Admin schema but was kept because it validates with `read_products`; replacing it with `featuredMedia` would require broader scopes.
- No caching was added. Product summaries load live in route loaders/actions and remain scoped to the authenticated `session.shop`.

## Quick Fixes Codex Can Do Immediately

1. Make saved Revenue Blueprint rows link to `?blueprintId=...`.
2. Remove or ignore `app/routes/.DS_Store` if it is tracked.
3. Add a confirmation step before clearing Activity Log.

## Larger Features That Should Wait

1. Real TikTok OAuth/API sync with encrypted token storage and disconnect flow.
2. Real creator CRM, outreach, affiliate, commission, and performance models.
3. Bulk CSV/JSON import models, validation, import batches, and safe clear flows.
4. Binary video/media storage for Creative Library uploads.
5. Production email summaries.
6. Database-level uniqueness/idempotency constraints for saved records.
7. Full in-admin Polaris/App Bridge design pass.

## Support Privacy Terms Navigation Cleanup Pass

Date: 2026-06-23

### What Links Were Broken Or Misleading

- The embedded app sidebar footer linked Support, Privacy, and Terms to `/app/settings?panel=support`, `/app/settings?panel=privacy`, and `/app/settings?panel=terms`.
- Settings did not render support, privacy, or terms panels for those query parameters, so the links landed on the normal Settings page without matching content.
- Public routes `/support`, `/privacy`, and `/terms` already existed and contained honest MVP support/legal copy, but the embedded app shell did not point to real embedded legal/support destinations.

### Routes Powering Support Privacy And Terms Now

- Embedded sidebar footer links now route to `/app/support`, `/app/privacy`, and `/app/terms`.
- `/app/support`, `/app/privacy`, and `/app/terms` are Shopify-authenticated embedded app routes that keep the dark Creative OS styling and show concise in-app summaries.
- `/app/support` explains contact guidance, supported MVP workflows, and current limitations.
- `/app/privacy` summarizes workspace data handling, store scoping, TikTok OAuth/API limitations, and secrets guidance.
- `/app/terms` summarizes MVP nature, AI-output limitations, and user responsibility for submitted data.
- Public `/support`, `/privacy`, and `/terms` remain available as full public pages, and the embedded routes link to those public pages for the fuller copy.
- Public `/terms` now includes route metadata so the document title matches the public support/privacy pages.

### Settings Query Param Dead Link Status

- No active app links to `/app/settings?panel=support`, `/app/settings?panel=privacy`, or `/app/settings?panel=terms` remain.
- No active app links to `/settings?panel=` were found.
- Legacy `/app/settings?panel=support`, `/app/settings?panel=privacy`, and `/app/settings?panel=terms` URLs now redirect to `/app/support`, `/app/privacy`, and `/app/terms`.

### Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed with React Router future-flag warnings only.
- `npm run build`: passed with React Router future-flag warnings only.
- Smoke checks against the built app passed:
  - `/app` returned 200.
  - `/app/settings` returned 200.
  - `/support` returned 200.
  - `/privacy` returned 200.
  - `/terms` returned 200.
  - `/app/support` returned 200.
  - `/app/privacy` returned 200.
  - `/app/terms` returned 200.
  - `/app/settings?panel=support` returned 302 to `/app/support`.
  - `/app/settings?panel=privacy` returned 302 to `/app/privacy`.
  - `/app/settings?panel=terms` returned 302 to `/app/terms`.

### Remaining Risks

- Legal/support wording still needs human review before production distribution.
- Shopify scopes should stay minimal; current app config requests only `read_products`.
- These pages are concise summaries, not a substitute for final production legal terms, privacy policy, or support contact operations.

## Legal Navigation Cleanup Pass

Date: 2026-06-23

### Sidebar Footer Simplification

- The embedded sidebar footer now shows only Support, Legal, and Contact.
- Individual sidebar footer links for Privacy, Terms, Cookies, Acceptable Use, Refunds, AI, and Copyright were removed from the sidebar footer to prevent clutter and uneven wrapping.
- Existing direct embedded and public legal routes remain available.

### Central Legal Hub

- Added `/app/legal` as an authenticated embedded Legal hub.
- Added `/legal` as a public Legal hub.
- The hub groups links into Core Policies, Data And Privacy, AI And Content, and Support And Contact.
- Hub links cover Terms, Privacy, Cookies, Acceptable Use, Refund Policy, AI Disclaimer, Copyright, Contact, and Support.

### Related Links Preserved

- Onboarding consent links still point to `/app/terms` and `/app/privacy`.
- Settings Legal & Privacy links still point to `/app/privacy`, `/app/terms`, and `/app/contact`.

### Remaining Risks

- Legal copy still needs final human review before production distribution.
- The Legal hub is a navigation cleanup only; it does not add automated privacy request handling or deletion workflows.

## Shopify Scope Cleanup Pass

Date: 2026-06-23

### Current Scopes Before Cleanup

- `shopify.app.toml` previously requested `read_products,read_orders`.
- `read_products` powers current Shopify catalog context: product titles, handles, descriptions, images, prices, inventory, status, and shop currency.
- `read_orders` was present for optional order/revenue context, not for a required current workflow.

### Was read_orders Used

- Before this pass, `app/models/blueprint.server.js` defined a Shopify Admin GraphQL `orders(first: 25)` query and called it only when configured scopes included `read_orders`.
- Order results could influence optional planning copy in dashboard/recommendation/revenue helpers, but all current routes already supported empty order data.
- No persistence model, route action, import flow, customer workflow, fulfillment workflow, or required app feature depended on Shopify order records.

### Was read_orders Removed Or Kept

- `read_orders` was removed from `shopify.app.toml`.
- The fallback configured scope list in `app/models/blueprint.server.js` is now `read_products`.
- The active Shopify order GraphQL query path was removed from `loadMerchantData`.
- `loadMerchantData` still returns `orders: []` and `orderScopeEnabled: false` to preserve existing route data shape without requesting or reading orders.
- Data Import, recommendations, revenue blueprint, README, and supporting audit docs now describe catalog context and saved app records instead of live order/revenue access.

### Remaining Scope Risks

- Current configured scope is minimal: `read_products`.
- Production environment variables should be checked before deploy so a stale `SCOPES` value does not request removed scopes.
- If live order, revenue, fulfillment, or customer workflows are added later, the scope request and privacy/legal copy must be reviewed again before distribution.

### Functionality Affected

- No current required functionality is removed.
- Dashboard/recommendation/revenue blueprint planning now uses Shopify product context and saved app records only.
- Historical order/revenue context is no longer fetched from Shopify Admin API.

## Manual QA Checklist Prepared

Date: 2026-06-23

### Checklist File Created

- Created `MANUAL_QA_CHECKLIST.md`.
- The checklist covers page-by-page embedded QA for `/app`, `/app/creative-library`, `/app/video-analysis`, `/app/ad-briefs`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/creators`, `/app/data-import`, `/app/settings`, `/app/activity-log`, `/app/support`, `/app/privacy`, and `/app/terms`.
- The checklist includes special flow tests for video analysis auto-save on/off, manual creative save, revenue blueprint generation, ad brief generation, Activity Log updates, Recommendations updates, Settings persistence, Support/Privacy/Terms links, and `/login` plus `/onboarding` redirects.
- The checklist includes a pre-review technical checklist for lint, typecheck, build, Prisma generate, Shopify config validation, scope verification, and app URL/redirect URL confirmation.

### Automated Checks Result

- `npm run lint`: passed.
- `npm run typecheck`: passed with React Router future-flag warnings only.
- `npm run build`: passed with React Router future-flag warnings only.

### Remaining Items That Require Browser Testing

- Embedded Shopify Admin install/auth behavior.
- Shopify App Bridge/admin frame behavior.
- Real dev-store product context loading.
- Desktop and mobile/narrow visual layout inside Shopify Admin.
- Console and network behavior during real user clicks.
- File upload behavior with real browser file selection.
- Cross-refresh persistence after real route actions.
- Legal/privacy/support copy review.
- Production app URL, redirect URL, and production `SCOPES` verification in Shopify configuration.

## Recommendations Shopify Auth Cleanup Pass

Date: 2026-06-22

### What Legacy Behavior Was Removed

- Removed the Recommendations page's browser-side `useEffect` data loading.
- Removed direct legacy calls to `/recommendations` and `/personalized/recommendations`.
- Removed browser `getSelectedShopId()`, `isDemoAccount()`, `getAuthHeaders()`, and localStorage-derived shop scoping from `app/routes/app.recommendations.jsx`.
- Removed copy that said recommendations would appear after connected TikTok Shop performance data.

### API_BASE And localStorage Status

- `app/routes/app.recommendations.jsx` no longer imports or uses `API_BASE`.
- `app/routes/app.recommendations.jsx` no longer reads browser `localStorage`.
- `app/routes/app.recommendations.jsx` no longer sends or depends on a browser `shop_id`.
- No active app-wide `API_BASE`/localStorage shop-identity route usage remains from the old Recommendations helper chain.

### What Now Powers Recommendations

Recommendations are generated in a Shopify-authenticated Remix loader using `loadShopifyRouteContext(request)` and `session.shop`.

The page now reads existing shop-scoped app data:

- `VideoAnalysis` via `listVideoAnalyses`
- `SavedCreative` via `listSavedCreatives`
- `SavedBrief` via `listSavedBriefs`
- `RevenueBlueprint` via `listRevenueBlueprints`
- `WorkspaceSetting` via `getWorkspaceSettingsMap`

Generated recommendation cards are planning suggestions from saved app records. They use analysis scores, saved creative metadata, saved briefs, saved blueprint next steps, and the auto-save setting when useful. They do not claim live TikTok performance, synced creator data, ROAS, or live revenue.

### Empty, Loading, And Error States

- Loading state: `Loading saved recommendations...` during route navigation/loading.
- Empty state: `Analyze a video or save a creative to generate recommendations.`
- Empty actions: links to Video Analysis and Creative Library.
- Error state: visible red error banner if saved workspace records cannot be loaded.
- Count summary: saved analyses, saved creatives, saved briefs, and saved blueprints are shown as the data basis.

### Remaining Risks

- Recommendations are generated dynamically from saved records; there is still no dedicated `Recommendation` Prisma model or persisted recommendation history.
- The quality of recommendations depends on saved analysis payload shape and heuristic scores.
- Search still has separate recommendation-related logic; it was not changed by this pass.
- The Recommendations route uses the local/dev demo bypass through `loadShopifyRouteContext`, matching other rewritten routes.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app/recommendations` using local dummy Shopify env vars.

## Command Center Shopify Auth Cleanup Pass

Date: 2026-06-22

### What Legacy Behavior Was Removed

- Removed Command Center browser-side `useEffect` loading and local dashboard state.
- Removed `getEngineAnalysis()` and legacy `API_BASE` dashboard analytics loading from `app/routes/app._index.jsx`.
- Removed browser `localStorage`, `shop_id`, `getSelectedShopId()`, `isDemoAccount()`, and local shop selection from the Command Center route and dashboard action components.
- Removed dashboard copy that implied live TikTok Shop intelligence, connected-shop performance, live orders, live views, CTR, or ROAS.
- Removed Next Actions behavior that wrote brief/creator/variant context into `localStorage`.

### API_BASE And localStorage Status

- `app/routes/app._index.jsx` no longer imports or uses `API_BASE`.
- `app/routes/app._index.jsx` no longer reads or writes browser `localStorage`.
- `app/routes/app._index.jsx` no longer sends or depends on a browser `shop_id`.
- `app/components/dashboard/*` no longer use `localStorage` or browser-local shop selection.
- No active app-wide `API_BASE`/localStorage shop-identity route usage remains from the old Command Center helper chain.

### What Now Powers Command Center

Command Center is generated in a Shopify-authenticated Remix loader using `loadShopifyRouteContext(request)` and `session.shop`.

The dashboard now reads existing shop-scoped app data:

- `VideoAnalysis` via `listVideoAnalyses`
- `SavedCreative` via `listSavedCreatives`
- `SavedBrief` via `listSavedBriefs`
- `RevenueBlueprint` via `listRevenueBlueprints`
- `ActivityLog` via `listActivityLogs`
- `WorkspaceSetting` via `getWorkspaceSettingsMap`

Dashboard cards now show saved creative count, saved video analysis count, saved brief count, saved blueprint count, recent activity count, and estimated readiness. Tables and planning sections are driven by saved app records. The Ad performance tracking graph is separate and stays empty until real ad performance records are imported or synced.

### Empty, Loading, And Error States

- Loading state: `Loading saved Command Center records...` during route navigation/loading.
- Empty state: `Analyze a video or save a creative to populate your Command Center.`
- Empty actions: links to Video Analysis and Creative Library.
- Error state: visible red error banner if saved workspace records cannot be loaded.
- Search state: saved workspace match message when dashboard search filters visible records.

### Remaining Risks

- Command Center readiness is heuristic; it is not a real performance score.
- The ad performance graph currently has no persistence model behind it, so it shows an empty state instead of saved-record proxy analytics.
- There is still no dedicated dashboard analytics model or imported order/TikTok performance model.
- The route uses the local/dev demo bypass through `loadShopifyRouteContext`, matching other rewritten routes.
- Legacy `app/services/engineApi.js` was removed in the unused helper cleanup pass.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app`, `/app/recommendations`, `/app/creative-library`, and `/app/video-analysis` using local dummy Shopify env vars.

## Settings Active Shop Cleanup Pass

Date: 2026-06-22

### What localStorage/shop switching behavior was removed

- Removed Settings imports from `app/lib/accountContext.js` and `app/lib/shopSession.js`.
- Removed `/demo/shops` loading and the route-level `API_BASE` dependency from `app/routes/app.settings.jsx`.
- Removed browser `localStorage` reads for `user`, `selectedShop`, `selectedShopId`, `shop_id`, and stored shop names.
- Removed browser `localStorage` writes for selected active shop state.
- Removed the Manage Shops / Choose Active Shop modal and disabled fake multi-shop switching inside the embedded app.
- Removed the legacy Settings logout button that cleared standalone app auth keys from browser storage.

### Whether Settings still uses localStorage/shop_id

- `app/routes/app.settings.jsx` no longer imports or uses `API_BASE`.
- `app/routes/app.settings.jsx` no longer reads or writes browser `localStorage`.
- `app/routes/app.settings.jsx` no longer reads, writes, or submits browser-local `shop_id`.
- No active app-wide `localStorage`/`shop_id` route usage remains from the old Settings helper chain.

### What now displays as the active shop

Settings uses `loadShopifyRouteContext(request)` and displays the authenticated `session.shop` returned by Shopify auth. The Active Shop card now says:

- `This embedded app session is connected to the current Shopify store.`
- `Switch stores from Shopify admin, not inside BluePrintAI.`

Working preferences remain unchanged and still persist through `WorkspaceSetting` by `session.shop`: `analysis_depth`, `auto_save_analyzed_videos`, and `email_summaries`.

### Remaining Risks

- `email_summaries` still persists only as a preference; no production email delivery exists.
- The Account card is now informational. It does not provide a Shopify logout flow, which is acceptable for an embedded app but should be confirmed during manual review.
- Legacy `accountContext.js`, `shopSession.js`, `engineApi.js`, and legacy `activityLog.js` were removed in the unused helper cleanup pass.
- Standalone `/login` and `/onboarding` now redirect to `/app`; they no longer write legacy browser auth or shop IDs.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app/settings`, `/app`, and `/app/recommendations` using local dummy Shopify env vars.

## Legacy Auth/Onboarding Cleanup Pass

Date: 2026-06-22

### What routes existed

- `/login` previously rendered a standalone demo-account login screen, called legacy `/auth/app-login`, and wrote auth/shop values to browser `localStorage`.
- `/onboarding` previously rendered standalone account creation, called legacy `/onboarding/create-account`, and wrote auth/shop values to browser `localStorage`.
- Shopify auth remains separate at `/auth/login` and was not changed.

### What was redirected, removed, or relabelled

- `/login` is now a small React Router module whose loader redirects to `/app`.
- `/onboarding` is now a small React Router module whose loader redirects to `/app`.
- Public landing CTAs now point to `/app` and `/support`, not `/login` or `/onboarding`.
- Terms, Privacy, and Support copy no longer tells users to use demo accounts or onboarding-created standalone workspaces.
- The embedded app sidebar no longer clears old standalone auth keys from `localStorage`; it now links to Shopify login instead of presenting a legacy logout action.

### Whether any `/login` or `/onboarding` links remain in the app

- No active app or public route links to `/login` or `/onboarding`.
- `/login` and `/onboarding` still exist only as safe redirect routes so old bookmarks do not 404.
- `/auth/login` links remain where Shopify login is appropriate.

### Whether accountContext/shopSession still have active imports

- No active route page imports `app/lib/accountContext.js` or `app/lib/shopSession.js`.
- No active route page imports `app/lib/accountContext.js`, `app/lib/shopSession.js`, `app/services/engineApi.js`, or legacy `app/services/activityLog.js`.
- Those files were deleted in the unused helper cleanup pass after the final import audit.

### Remaining Risks

- The dead legacy helper chain has been deleted. Historical docs still mention it for audit traceability.
- `/auth/login` is still required for Shopify auth and should not be removed.
- The sidebar Shopify login link is informational/recovery-oriented, not a full embedded app logout flow; confirm with manual Shopify admin testing.
- Legal copy should receive a final human review to ensure it matches production distribution, scopes, and privacy behavior.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app`, `/app/settings`, and `/app/recommendations`.
- Built-server smoke check returned `302` from `/login` to `/app`.
- Built-server smoke check returned `302` from `/onboarding` to `/app`.

## Claim and Provenance Copy Cleanup Pass

Date: 2026-06-22

### Risky claims found

- Video Analysis used "Performance Prediction", "Predicted TikTok Shop impact", "winning creative", and conversion-oriented language around heuristic analysis results.
- Creative Library list/detail cards displayed `Views`, `Likes`, `Clicks`, and `Orders` even when the app only had saved creative metadata or uploaded analysis payloads.
- Revenue Blueprint empty and generated states implied a strong revenue blueprint without clearly saying the output is a planning estimate.
- Ad Briefs said briefs came from "real creative patterns" even though the page currently uses Shopify product context and saved app activity.
- Settings email summaries sounded like an active weekly digest rather than a saved future preference.
- Public/search/model-generated copy included phrases like "live merchant data", "can sell", "winning recommendations", and "synced" statuses in places where the current app supports authenticated Shopify context, saved app data, manual/demo data, or coming-soon integrations.

### Copy changed

- `app/routes/app.video-analysis.jsx` now labels scores and impact as `AI-estimated creative readiness` and planning signals, not live TikTok performance or guaranteed conversion results.
- `app/routes/app.creative-library.jsx` and `app/routes/app.creative-library.$id.jsx` now show AI-estimated planning indicators instead of unsupported imported views/clicks/orders metrics.
- `app/routes/app.revenue-blueprint.jsx` now says blueprints are generated planning outputs and do not guarantee revenue, ROAS, conversion lift, sales volume, or platform approval.
- `app/routes/app.ad-briefs.jsx` now says generated briefs are planning outputs from Shopify product context and saved app activity.
- `app/routes/app.settings.jsx` now says email summaries are saved as a preference only and delivery is not active yet.
- `app/routes/app.search.jsx`, `app/routes/_index/route.jsx`, `app/models/blueprint.server.js`, `app/components/EmptyWorkspaceState.jsx`, and `app/components/creative-os/CreativePerformanceCard.jsx` received safer provenance wording for demo/manual data, authenticated Shopify context, planning metrics, and coming-soon TikTok sync.

### Remaining unsupported or incomplete features

- TikTok OAuth/API sync is still coming soon.
- Real creator CRM, outreach, commissions, affiliate sync, and live creator performance are still demo/manual only.
- Revenue Blueprint is still a planning estimate; it is not a financial forecast or guarantee.
- Email summary delivery is not active yet.
- Creative Library and Video Analysis uploads now persist local development video files and save playable `/uploads/...` URLs, but production still needs durable object storage before submission.
- Imported performance metrics still need dedicated Shopify-app models before they can be enabled.

### Remaining Shopify review risks

- Scope risk is reduced after the cleanup pass; current app config requests `read_products` only.
- Legal/privacy pages still need a human production review against actual scopes, billing, and data handling.
- App shell Support/Privacy/Terms links now route to real embedded pages.
- Manual browser QA should confirm all claim/provenance copy is visible and not clipped on mobile.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app`, `/app/video-analysis`, `/app/creative-library`, `/app/revenue-blueprint`, and `/app/settings`.

## Unused Legacy Helper Cleanup Pass

Date: 2026-06-22

### Which files were deleted

- `app/lib/accountContext.js`
- `app/lib/shopSession.js`
- `app/services/engineApi.js`
- `app/services/activityLog.js`

The requested `app/utils/accountContext.js` and `app/utils/shopSession.js` paths did not exist in this app. The matching legacy helpers lived under `app/lib`.

### Which candidates were kept and why

- None. All existing candidate files had zero active route, component, model, test, or build-path imports.
- No Shopify auth, webhook, Prisma, model, or route-context helpers were removed.
- No demo data files were removed.

### Import and reference result

- `app/services/engineApi.js` and legacy `app/services/activityLog.js` were standalone legacy service files.
- `app/lib/shopSession.js` only depended on `app/lib/accountContext.js`.
- No active Shopify route imported `accountContext`, `shopSession`, `engineApi`, or legacy `services/activityLog`.
- Active Activity Log routes use Prisma helpers from `app/models/blueprint.server.js`, not the deleted legacy service.

### Whether API_BASE/localStorage shop identity remains anywhere active

- No active Shopify app route, component, model, or service imports `API_BASE`, `getSelectedShopId`, `setSelectedShopId`, `getAuthHeaders`, `accountContext`, or `shopSession`.
- Remaining `shop_id` matches in app code are persisted/custom-data field names such as `tiktok_shop_id`, not browser-local shop identity.
- Historical audit docs still mention removed legacy behavior for traceability.

### Remaining risks

- `/auth/login` is Shopify authentication and remains required.
- `SAVE_FEATURE_AUDIT.md` still contains historical references to the old helper files; it was not updated because save/persistence behavior did not change in this pass.
- Continue reviewing claim/provenance copy and Settings email-summary wording before App Store submission.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings.
- Built-server smoke check returned `200` for `/app`, `/app/settings`, and `/app/recommendations`.
- Built-server smoke check returned `302` from `/login` to `/app`.
- Built-server smoke check returned `302` from `/onboarding` to `/app`.

## Video Upload Storage QA Fix

Date: 2026-06-23

### Review readiness change

- Video Analysis no longer treats an uploaded file as analysis-only metadata. The action now stores the uploaded video in local public development storage and saves the resulting media URL into the `VideoAnalysis` payload.
- Auto-saved Video Analysis records now create Creative Library entries with the uploaded filename as the creative title and the saved media URL as both `mediaUrl` and `video_url`.
- Creative Library manual uploads now persist local uploaded video files when no remote video URL is supplied.
- Creative Library card/detail views already render saved media URLs with a `<video>` element; metadata-only fallback copy was clarified for older records.

### Root cause fixed

- The previous Video Analysis flow consumed the multipart `File` for analysis but never wrote the original file to a stable public path.
- Saved creative payloads therefore contained file metadata and analysis output, but not a playable uploaded-video URL.
- Fallback copy used default product/demo context, which made a real upload look like a generic product creative.

### Storage location

- Video Analysis uploads: `public/uploads/video-analysis/<shop>/`.
- Creative Library uploads: `public/uploads/creative-library/<shop>/`.
- When `build/client` exists, files are mirrored into `build/client/uploads/...` so the local built server can serve newly uploaded videos during QA.
- File names are sanitized and prefixed with a content hash; saved payloads include a media fingerprint for duplicate-source handling.

### Remaining risks

- Local `public/uploads` storage is suitable for dev-store/manual QA only.
- Production still needs durable object storage, access control, retention/cleanup policy, and deployment-aware media serving before App Store submission.
- Existing historical metadata-only records remain metadata-only unless re-uploaded or migrated with a real media URL.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router v8 future-flag warnings.
- `npm run build` passed with React Router v8 future-flag warnings and expected empty auth/webhook chunks.
- `npm run prisma -- generate` passed.
- Built-server smoke check returned `200` for `/app/video-analysis`, `/app/creative-library`, `/app/activity-log`, and `/app/recommendations`.

## Files Inspected

- `SAVE_FEATURE_AUDIT.md`
- `package.json`
- `shopify.app.toml`
- `prisma/schema.prisma`
- `app/root.jsx`
- `app/routes.js`
- `app/shopify.server.js`
- `app/db.server.js`
- `app/models/blueprint.server.js`
- `app/models/route-context.server.js`
- `app/lib/accountContext.js`
- `app/lib/shopSession.js`
- `app/services/engineApi.js`
- `app/services/activityLog.js`
- `app/routes/app.jsx`
- `app/routes/app._index.jsx`
- `app/routes/app.search.jsx`
- `app/routes/app.creative-library.jsx`
- `app/routes/app.creative-library.$id.jsx`
- `app/routes/app.video-analysis.jsx`
- `app/routes/app.ad-briefs.jsx`
- `app/routes/app.recommendations.jsx`
- `app/routes/app.revenue-blueprint.jsx`
- `app/routes/app.creators.jsx`
- `app/routes/app.creators.$creatorId.jsx`
- `app/routes/app.data-import.jsx`
- `app/routes/app.settings.jsx`
- `app/routes/app.activity-log.jsx`
- `app/routes/login.jsx`
- `app/routes/onboarding.jsx`
- `app/routes/privacy.jsx`
- `app/routes/terms.jsx`
- `app/routes/support.jsx`
- `app/routes/$.jsx`
- `app/routes/auth.login/route.jsx`
- `app/routes/webhooks.app.scopes_update.jsx`
- `app/routes/webhooks.app.uninstalled.jsx`
- `app/routes/webhooks.customers.data_request.jsx`
- `app/routes/webhooks.customers.redact.jsx`
- `app/routes/webhooks.shop.redact.jsx`
- `app/components/blueprint-ui.jsx`
- `app/components/dashboard/NextActions.jsx`
- `app/components/dashboard/PatternInsights.jsx`
- `app/components/dashboard/PerformanceChart.jsx`
- `app/components/dashboard/StatCards.jsx`
- `app/components/dashboard/TopBar.jsx`
- `app/components/dashboard/TopCreatives.jsx`
- `app/components/EmptyWorkspaceState.jsx`

## Verification Results

Requested commands were run after this report was created:

- `npm run lint` - passed.
- `npm run typecheck` - passed with React Router v8 future-flag warnings.
- `npm run build` - passed with React Router v8 future-flag warnings and normal empty webhook/auth chunks.
- Built-server smoke check - passed for `/app`, `/app/creative-library`, `/app/video-analysis`, `/app/ad-briefs`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/creators`, `/app/data-import`, `/app/settings`, `/app/activity-log`, and `/app/search?q=serum` using local dummy Shopify env vars.

Manual browser testing should focus first on `/app/recommendations`, `/app`, `/app/settings`, top search, and all save flows that should survive refresh.

## Workspace Onboarding and Demo Cleanup Pass

Date: 2026-06-23

### What changed

- Added an embedded `/app/onboarding` route that runs after Shopify authentication and before the main `/app` workspace for shops without a saved profile.
- Onboarding answers are stored in the existing `WorkspaceSetting` table under `workspace_profile`, scoped by authenticated `session.shop`.
- `/app` shell gating now redirects new workspaces to `/app/onboarding` while allowing `/app/onboarding`, `/app/support`, `/app/privacy`, and `/app/terms` to avoid loops.
- Settings now includes an editable Workspace Profile section so merchants can revise the product/category/audience/goal context later.

### Demo leakage removed

- Authenticated Shopify product loading no longer falls back to seeded demo products when Shopify returns no products.
- Local/dev auth bypass only returns seeded demo products when `?demo=1` is explicitly present.
- Real workspace recommendation, brief, blueprint, data import, and creator fallback paths no longer inject the seeded demo product list.
- Generic empty states now direct merchants to complete onboarding or analyze/save creative data instead of showing unrelated sample products.

### Personalization data

- Recommendations use the saved workspace profile when there are no saved analyses, creatives, briefs, or blueprints.
- Revenue Blueprint and Ad Brief generation use Shopify catalog products first, then the onboarding profile product/category context when no catalog product is available.
- Command Center next actions can reference the configured product/category while still avoiding fake TikTok/shop performance data.
- Video Analysis uses the workspace profile product as upload context when no Shopify product is selected.

### Remaining risks

- Manual dev-store QA still needs to verify the full first-run redirect and form submission inside an embedded Shopify admin session.
- The workspace profile is intentionally minimal and stored as JSON in `WorkspaceSetting`; future reporting may benefit from a dedicated normalized Prisma model.
- Explicit demo mode still keeps seeded demo assets/data for labelled demo evaluation, so review QA should confirm production links do not expose `?demo=1` unintentionally.
