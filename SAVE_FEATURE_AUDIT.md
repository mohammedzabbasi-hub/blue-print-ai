# BluePrintAI Shopify App Save Feature Audit

Date: 2026-06-22

Scope: Shopify React Router/Remix app under `app/`, Prisma schema under `prisma/`, shared services/components, and client-side API/localStorage persistence paths. This audit does not cover the original TTSA FastAPI backend implementation except where this Shopify app still calls it through `API_BASE`.

## Summary Score

**37 / 100**

The app has a useful Prisma persistence layer for Shopify-scoped saved briefs, video analyses, saved creatives, revenue blueprints, workspace requests, and workspace settings. However, most current page-level save/generate/import controls do **not** use those Shopify Remix actions or Prisma helpers. They either call the legacy external API (`API_BASE`, defaulting to `http://127.0.0.1:8000`), write only to `localStorage`, or mutate React state only. This means persistence is inconsistent, often not guaranteed in the Shopify app database, and sometimes not correctly scoped to the authenticated Shopify session.

## Persistence Backend Inventory

| Area | Current support | Notes |
|---|---|---|
| Shopify sessions | `Session` Prisma model, `PrismaSessionStorage` | Working Shopify app session storage. |
| Saved ad briefs | `SavedBrief`, `saveBriefRecord`, `listSavedBriefs`, `findSavedBrief` | Model exists and is shop scoped, but current `/app/ad-briefs` page is display-only and loads briefs from legacy API, not Prisma. |
| Video analyses | `VideoAnalysis`, `saveVideoAnalysisRecord`, `listVideoAnalyses` | Model exists and is shop scoped, but current video analysis page calls legacy API and does not use the helper. |
| Saved creatives | `SavedCreative`, `saveCreativeRecord`, `listSavedCreatives`, `findSavedCreative` | Model exists and is shop scoped, but Creative Library upload and Video Analysis save call legacy API. |
| Revenue blueprints | `RevenueBlueprint`, `saveRevenueBlueprintRecord`, `listRevenueBlueprints`, `findRevenueBlueprint` | Model exists and is shop scoped, but current Revenue Blueprint page calls legacy API. |
| Workspace requests | `WorkspaceRequest`, `createWorkspaceRequest`, `listWorkspaceRequests` | Model exists, but no user-facing request/export control currently writes it. Notifications expect `data_export` requests. |
| Workspace settings | `WorkspaceSetting`, `upsertWorkspaceSetting`, `getWorkspaceSetting` | Model exists, but Settings page preferences mostly do not persist. TikTok helpers exist but page calls legacy API. |
| Creators | No Prisma model | Creator create/update/delete calls legacy API only. |
| Imported products/orders/metrics | No Prisma models in this app | Data Import calls legacy API only. Current Shopify Admin API helpers read product context only; order reads are not requested in the current scope set. |
| Activity log | No Prisma model | Service calls legacy API, with localStorage fallback. |

## Save Feature Table

| Page | UI label/control | File/component | Current behavior | Persistence method | Works after refresh? | Shop scoped? | Status | Recommended fix |
|---|---|---|---|---|---|---|---|---|
| Command Center | Date range buttons | `app/components/dashboard/TopBar.jsx` | Updates chart range state only. | React state | No | N/A | Working, non-persistent | Label is not save-like; no fix needed unless date preference should persist. |
| Command Center | Search input | `app/routes/app._index.jsx`, `TopBar` | Filters loaded dashboard data client-side. | React state | No | N/A | Working, non-persistent | No persistence expected. |
| Command Center | Import Data | `app/routes/app._index.jsx` | Navigates to Data Import. | Link only | N/A | N/A | Working | No fix. |
| Command Center | Upload Creative | `app/routes/app._index.jsx` | Navigates to Video Analysis. | Link only | N/A | N/A | Working | No fix. |
| Command Center | Generate Brief | `app/components/dashboard/NextActions.jsx` | Writes `briefProductName` and `briefBrandName` to localStorage, then navigates to `/app/ad-briefs`. Current Ad Briefs page does not read these values or generate. | localStorage only | Yes locally, but unused | No; browser/user local only | Broken/misleading | Remove the localStorage write and route to a real brief action once ad-brief generation is reintroduced, or relabel as "Open Ad Briefs". |
| Command Center | Find Creators | `app/components/dashboard/NextActions.jsx` | Writes `creatorSearchFocus` to localStorage, then navigates to `/app/creators`. Creators page does not appear to read it. | localStorage only | Yes locally, but unused | No | Partial/fake | Either consume this value on Creators page or remove the write. |
| Command Center | Create Variant | `app/components/dashboard/NextActions.jsx` | Writes `variantSourceCreative` to localStorage, then navigates to Revenue Blueprint. Revenue Blueprint does not read it. | localStorage only | Yes locally, but unused | No | Broken/misleading | Remove until a real variant/blueprint flow uses this data, or wire it into a Remix action. |
| Creative Library | Upload Creative | `app/routes/app.creative-library.jsx` | Opens upload form. | React state | No | N/A | Working UI | No fix. |
| Creative Library | Save Creative | `app/routes/app.creative-library.jsx` | Submits file or URL to legacy API endpoints `/personalized/creatives/upload` or `/personalized/creatives`, reloads list on success. | External API via `API_BASE` | Depends on legacy backend | Uses numeric `shop_id` from localStorage, not Shopify session | Partial | Replace with Shopify route action that authenticates `session.shop` and calls `saveCreativeRecord`; only use external storage for actual media if needed. |
| Creative Library | Close/Cancel upload | `app/routes/app.creative-library.jsx` | Closes form unless upload is saving. | React state | N/A | N/A | Working | No fix. |
| Creative Library detail | View creative details | `app/routes/app.creative-library.$id.jsx` | Loads creative from legacy API by ID and localStorage shop ID. | External API read | Depends | LocalStorage shop ID | Partial | Load from `SavedCreative` by `session.shop` and `creativeId`, or bridge legacy IDs explicitly. |
| AI Review Studio / Video Analysis | Analyze Video | `app/routes/app.video-analysis.jsx` | Posts file to legacy `/video-analysis/analyze`; result is held in React state. Activity is logged via service. | External API; result state only | No for analysis result unless backend also stores it | Auth token/localStorage, not Shopify session | Partial | Add Remix action using `authenticate.admin`, `analyzeUploadedVideoFile`, and `saveVideoAnalysisRecord`. |
| AI Review Studio / Video Analysis | Save to Creative Library | `app/routes/app.video-analysis.jsx` | Posts analyzed creative payload to legacy `/personalized/creatives`; logs activity; shows success/error. | External API | Depends | Numeric localStorage `shop_id`, not Shopify session | Partial | Persist to `VideoAnalysis` and `SavedCreative` via `saveVideoAnalysisRecord({ savedToLibrary: true })` scoped to `session.shop`. |
| AI Review Studio / Video Analysis | Generate Blueprint | `app/routes/app.video-analysis.jsx` | Builds blueprint object in browser, writes `latestVideoBlueprint` to localStorage, logs activity, shows success. Revenue Blueprint page does not read this key. | localStorage only | Yes on same browser only | No | Fake/misleading | Replace with server action that calls `saveRevenueBlueprintRecord` or relabel as "Prepare blueprint draft" and consume it. |
| AI Review Studio / Video Analysis | Download Report | `app/routes/app.video-analysis.jsx` | Creates a JSON blob and triggers browser download. | Browser file download | N/A | N/A | Working export | No database persistence expected; label is accurate. |
| Ad Briefs | Display saved/sample ad brief cards | `app/routes/app.ad-briefs.jsx` | Fetches `/briefs?shop_id=...` from legacy API and displays cards. No save controls after revert. | External API read | Depends | Numeric localStorage `shop_id`, not Shopify session | Partial | If this page should show Shopify app data, load `SavedBrief` via server loader scoped to `session.shop`. |
| Recommendations | Recommendation cards | `app/routes/app.recommendations.jsx` | Fetches recommendation lists from legacy API. No save/apply buttons. | External API read | Depends | Numeric localStorage `shop_id`, not Shopify session | Partial | No save issue now; later "apply" controls should write WorkspaceRequest or blueprint records. |
| Revenue Blueprint | Generate Blueprint | `app/routes/app.revenue-blueprint.jsx` | Posts `{ shop_id }` to legacy `/blueprint/generate`, stores returned blueprint in React state. | External API | Depends on legacy backend | Numeric localStorage `shop_id`, not Shopify session | Partial | Replace with Remix action and `saveRevenueBlueprintRecord(session.shop, blueprint)`. |
| Revenue Blueprint | Generate New Blueprint | `app/routes/app.revenue-blueprint.jsx` | Same as above; no explicit error message if request fails. | External API | Depends | Numeric localStorage `shop_id` | Partial/brittle | Add error UI and use Prisma persistence with duplicate/version handling. |
| Creators | Add Creator | `app/routes/app.creators.jsx`, `CreatorForm` | Submits form to legacy `/creators/`, then reloads creators. | External API | Depends | Sends `brand_id` from localStorage shop ID; not Shopify session | Partial | Add `Creator` Prisma model or confirm creators stay in external backend; use authenticated shop scoping. |
| Creators | Update Creator | `app/routes/app.creators.$creatorId.jsx`, `CreatorForm` | PUTs to legacy `/creators/:id?shop_id=...`; updates component state on success. | External API | Depends | LocalStorage shop ID | Partial | Same as Add Creator; include loading/success state. |
| Creators | Delete Creator | `app/routes/app.creators.$creatorId.jsx` | DELETEs legacy creator endpoint and navigates back. | External API | Depends | LocalStorage shop ID | Partial | Add confirmation and authenticated server-side scoping. |
| Creators | Refresh | `app/routes/app.creators.jsx` | Reloads creators from legacy API. | External API read | N/A | LocalStorage shop ID | Working read | No persistence expected. |
| Data Import | Upload CSV | `app/routes/app.data-import.jsx` | Posts selected table CSV to legacy `/data-import/csv`; refreshes summary. | External API | Depends | Numeric localStorage `shop_id` | Partial | Add Shopify app database/import models or explicitly mark as legacy external import. Handle fetch exceptions. |
| Data Import | Upload JSON | `app/routes/app.data-import.jsx` | Posts JSON bundle to legacy `/data-import/json`; displays inserted/skipped counts. | External API | Depends | Numeric localStorage `shop_id` | Partial | Same as CSV; add validation and server-side shop scoping. |
| Data Import | Clear Shop Data / Yes, Clear Data | `app/routes/app.data-import.jsx` | DELETEs legacy `/data-import/clear?shop_id=...`; refreshes summary. | External API | Depends | Numeric localStorage `shop_id` | Partial/dangerous | Add confirmation is present, but route should authenticate and scope by Shopify session, not browser storage. |
| Settings | Manage Shops / Choose Active Shop | `app/routes/app.settings.jsx`, `app/lib/accountContext.js` | Writes selected shop metadata to localStorage and dispatches browser event. | localStorage | Yes same browser | User-local only; not Shopify session | Partial | In Shopify app, active shop should come from `session.shop`; remove local shop switching or persist user preference server-side. |
| Settings | Connect TikTok Shop | `app/routes/app.settings.jsx` | Calls legacy `/tiktok/oauth/start`, validates URL, redirects. | External OAuth start | Depends | External auth headers, not Shopify session | Partial | Use Shopify-authenticated route action to create state tied to `session.shop`; store connection metadata in `WorkspaceSetting`. |
| Settings | Use Demo TikTok Shop Data | `app/routes/app.settings.jsx` | POSTs legacy `/tiktok/oauth/demo-connect`; updates UI state. | External API | Depends | External auth token/localStorage | Partial | Wire to `WorkspaceSetting` if demo connection is part of Shopify app state. |
| Settings | Disconnect | `app/routes/app.settings.jsx` | POSTs legacy `/tiktok/oauth/disconnect`; updates UI state. | External API | Depends | External auth token/localStorage | Partial | Use existing `disconnectTikTokWorkspace(session.shop)` helper from a Remix action. |
| Settings | Analysis Depth select | `app/routes/app.settings.jsx` | Select is uncontrolled and has no handler. | None | No | No | Fake | Either persist to `WorkspaceSetting` or remove until supported. |
| Settings | Auto-save analyzed videos toggle | `app/routes/app.settings.jsx` | Static styled toggle; no button/input/handler. | None | No | No | Fake | Convert to real checkbox/button backed by `WorkspaceSetting`; video analysis should read it. |
| Settings | Email summaries toggle | `app/routes/app.settings.jsx` | Static styled toggle; no handler. | None | No | No | Fake | Convert to real setting or remove. |
| Settings | Logout | `app/routes/app.settings.jsx`, `app/routes/app.jsx` | Clears local auth/shop keys and navigates. | localStorage removal | Yes | Local browser only | Working for legacy auth | In embedded Shopify app, prefer Shopify session/logout behavior where relevant. |
| Activity Log | Clear Log | `app/routes/app.activity-log.jsx`, `app/services/activityLog.js` | DELETEs legacy activity-log endpoint; falls back to clearing localStorage. | External API or localStorage fallback | Yes if external/localStorage succeeds | External `shop_id` from localStorage | Partial | Add Prisma `ActivityLog` model or explicitly mark as local-only. Add loading/success text. |
| Activity Log | Filter chips | `app/routes/app.activity-log.jsx` | Filters by activity type and reloads. | React state plus API read | No persistence needed | LocalStorage shop ID for API | Working read | No save fix. |
| Login | Sign In | `app/routes/login.jsx` | Calls legacy `/auth/app-login`, stores token/user/shop in localStorage. | External API plus localStorage | Yes same browser | Not Shopify session | Partial for Shopify app | Keep only if supporting standalone login; for Shopify app use `auth.login` route and Shopify sessions. |
| Onboarding | Create Account | `app/routes/onboarding.jsx` | Calls legacy `/onboarding/create-account`, stores returned session/shop in localStorage. | External API plus localStorage | Yes same browser | Not Shopify session | Partial | Move onboarding into Shopify app or mark as non-Shopify legacy flow. |
| Shopify auth | Log in | `app/routes/auth.login/route.jsx` | Remix `<Form>` posts to Shopify login helper. | Shopify session flow | Yes | Shopify scoped | Working | No fix. |
| Sidebar/topbar | Logout | `app/routes/app.jsx` | Clears localStorage legacy auth keys and navigates. Does not clear Shopify Prisma session. | localStorage removal | Yes local only | N/A | Partial | Clarify desired embedded Shopify logout behavior. |
| Shared | Copy | `app/components/blueprint-ui.jsx` | Writes text to clipboard and shows success/error. | Clipboard only | N/A | N/A | Working | No database persistence expected. |
| Webhooks | App uninstalled / shop redact | `app/routes/webhooks.app.uninstalled.jsx`, `app/routes/webhooks.shop.redact.jsx` | Authenticates Shopify webhook, deletes app-owned Prisma rows and sessions for `shop`. | Prisma delete transaction | Yes | Yes | Working | Good baseline for data lifecycle. |
| Webhooks | App scopes update | `app/routes/webhooks.app.scopes_update.jsx` | Updates stored Shopify session scope. | Prisma Session update | Yes | Yes | Working | No fix. |

## Highest-Priority Save Issues

1. **Prisma save helpers are not wired to user-facing save controls.** `saveBriefRecord`, `saveVideoAnalysisRecord`, `saveCreativeRecord`, and `saveRevenueBlueprintRecord` exist but are unused by current page actions.
2. **Most save controls use `API_BASE` legacy endpoints instead of Shopify Remix route actions.** This makes persistence depend on a separate backend, not the Shopify app database.
3. **Shop scoping is often based on browser localStorage numeric `shop_id`, not authenticated Shopify `session.shop`.** Users can lose, corrupt, or spoof local shop state.
4. **Settings preference controls are fake.** Analysis Depth, Auto-save analyzed videos, and Email summaries look configurable but do not save anywhere.
5. **Dashboard next actions write localStorage values that destination pages do not consume.** "Generate Brief" and "Create Variant" are especially misleading.
6. **Video Analysis "Generate Blueprint" is localStorage-only and disconnected from the Revenue Blueprint page.**
7. **Revenue Blueprint generation has no visible error state.** Failures only go to `console.error`.
8. **Data Import has no Shopify app schema support.** CSV/JSON imports and clear operations depend entirely on the legacy backend.
9. **Creators have no Prisma model in this app.** Add/update/delete depend on legacy endpoints and do not use Shopify sessions.
10. **Saved/search links still include `generate=1` for Ad Briefs, but the generation workflow was reverted.** These links imply behavior that no longer exists.

## Quick Fixes

1. Relabel dashboard "Generate Brief" to "Open Ad Briefs" or remove the unused localStorage writes until generation returns.
2. Relabel dashboard "Create Variant" to "Open Revenue Blueprint" or wire `variantSourceCreative` into the destination.
3. Remove or disable Settings fake controls, or add explicit "Coming soon" copy.
4. Add visible error state to Revenue Blueprint generation.
5. Wrap Data Import upload/clear fetches in `try/catch` so network failures produce clear UI messages.
6. Add loading/success/error indicators to Creator create/update/delete.
7. Update Search recommendation links so they do not pass `generate=1` while Ad Briefs is display-only.
8. Add comments or UI labels distinguishing external legacy persistence from Shopify app persistence.

## Larger Backend/Database Fixes Needed

1. Add Remix actions/loaders for Creative Library, Video Analysis, Revenue Blueprint, and Ad Briefs that authenticate with `authenticate.admin(request)` and use `session.shop`.
2. Wire Video Analysis to `saveVideoAnalysisRecord`, including optional `savedToLibrary`.
3. Wire Creative Library uploads to `saveCreativeRecord`; decide where video binaries live and store stable media URLs, not large browser-only data.
4. Wire Revenue Blueprint generation to `saveRevenueBlueprintRecord`; add duplicate/version strategy.
5. If creators are first-class Shopify app data, add `Creator` and possibly `CreatorMetric` Prisma models with `shop` indexes.
6. If imported TikTok/shop data belongs in this app, add Prisma models for imported products, orders, creators, creatives, metrics, and import batches.
7. Add `ActivityLog` Prisma model if activity needs to survive across browsers/devices without legacy API.
8. Back Settings preferences with `WorkspaceSetting` and use them in Video Analysis behavior.
9. Replace browser localStorage shop selection with authenticated Shopify session scoping, or store per-user preferences server-side if multi-shop selection remains needed.
10. Add duplicate prevention where create flows can be repeated: saved creatives by `(shop, sourceType, sourceId)`, saved briefs by deterministic source key, and revenue blueprints by idempotency key or explicit "new version".

## Files Inspected

- `prisma/schema.prisma`
- `app/db.server.js`
- `app/shopify.server.js`
- `app/models/blueprint.server.js`
- `app/routes/app.jsx`
- `app/routes/app._index.jsx`
- `app/routes/app.activity-log.jsx`
- `app/routes/app.ad-briefs.jsx`
- `app/routes/app.creative-library.jsx`
- `app/routes/app.creative-library.$id.jsx`
- `app/routes/app.creators.jsx`
- `app/routes/app.creators.$creatorId.jsx`
- `app/routes/app.data-import.jsx`
- `app/routes/app.recommendations.jsx`
- `app/routes/app.revenue-blueprint.jsx`
- `app/routes/app.search.jsx`
- `app/routes/app.settings.jsx`
- `app/routes/app.video-analysis.jsx`
- `app/routes/auth.login/route.jsx`
- `app/routes/login.jsx`
- `app/routes/onboarding.jsx`
- `app/routes/webhooks.app.scopes_update.jsx`
- `app/routes/webhooks.app.uninstalled.jsx`
- `app/routes/webhooks.shop.redact.jsx`
- `app/routes/webhooks.customers.data_request.jsx`
- `app/routes/webhooks.customers.redact.jsx`
- `app/components/CreatorForm.jsx`
- `app/components/blueprint-ui.jsx`
- `app/components/dashboard/NextActions.jsx`
- `app/components/dashboard/TopBar.jsx`
- `app/components/dashboard/TopCreatives.jsx`
- `app/components/dashboard/PatternInsights.jsx`
- `app/components/EmptyWorkspaceState.jsx`
- `app/services/activityLog.js`
- `app/services/creatorsApi.js`
- `app/services/engineApi.js`
- `app/lib/accountContext.js`
- `app/lib/shopSession.js`

## Notes

- "Works after refresh" is marked as "Depends" for legacy API saves because the Shopify app code alone cannot prove the external backend has durable storage or correct Shopify-session scoping.
- The current Ad Briefs page was intentionally reverted to display-only. This audit treats missing generation/save controls there as expected, but flags stale links that still imply generation behavior.
- No implementation changes were made as part of this audit beyond creating this report.

## Persistence Implementation Pass 1

Date: 2026-06-22

### What Was Fixed

- Added a shared Shopify route context helper in `app/models/route-context.server.js` so priority routes use `session.shop` in production and the existing demo shop in local/dev.
- Rewired `app/routes/app.video-analysis.jsx`:
  - `Analyze Video` now posts to a Remix action, runs the local media analyzer/heuristic analyzer, and saves a `VideoAnalysis` row with `saveVideoAnalysisRecord`.
  - `Save to Creative Library` now uses a fetcher action and writes `SavedCreative` with `saveCreativeRecord`.
  - `Generate Blueprint` now uses a fetcher action and writes `RevenueBlueprint` with `saveRevenueBlueprintRecord`.
  - The page loader lists recent saved analyses so records survive refresh and navigation.
- Rewired `app/routes/app.creative-library.jsx`:
  - Loader reads saved creative records with `listSavedCreatives`.
  - `Save Creative` posts to a Remix action and writes `SavedCreative` using `session.shop`.
  - Saved creative cards render from Prisma-backed records.
- Rewired `app/routes/app.creative-library.$id.jsx`:
  - Detail page now loads a `SavedCreative` by ID and `session.shop`.
- Rewired `app/routes/app.revenue-blueprint.jsx`:
  - Loader reads latest/saved revenue blueprints from Prisma.
  - `Generate Blueprint` and `Generate New Blueprint` now create `RevenueBlueprint` rows.
  - The page displays saved blueprint history.
- Rewired `app/routes/app.ad-briefs.jsx`:
  - Loader reads saved briefs with `listSavedBriefs`.
  - `Generate Saved Brief` creates a persisted `SavedBrief` with `saveBriefRecord`.
  - The page keeps the simple Creative Planning card layout while adding one real persistence action.
- Removed stale `generate=1` URL generation from `app/models/blueprint.server.js` and `app/routes/app.search.jsx`.
- Updated `app/components/dashboard/NextActions.jsx` so Command Center actions no longer write unused localStorage handoff values or imply fake generation.

### Buttons That Now Persist

| Page | Button | Persists to |
|---|---|---|
| AI Review Studio / Video Analysis | Analyze Video | `VideoAnalysis` |
| AI Review Studio / Video Analysis | Save to Creative Library | `SavedCreative` |
| AI Review Studio / Video Analysis | Generate Blueprint | `RevenueBlueprint` |
| Creative Library | Save Creative | `SavedCreative` |
| Revenue Blueprint | Generate Blueprint / Generate New Blueprint | `RevenueBlueprint` |
| Ad Briefs | Generate Saved Brief | `SavedBrief` |

### Pages That Now Survive Refresh

- Video Analysis: recent saved analysis records appear after refresh.
- Creative Library: saved creative records appear after refresh and can be opened in detail view.
- Revenue Blueprint: latest and prior generated blueprints appear after refresh.
- Ad Briefs: saved brief cards appear after refresh.

### What Remains Fake Or Partial

- Creators still uses the legacy external creator API and has no Prisma model.
- Data Import still uses the legacy external import API and has no Prisma import schema.
- Settings preference controls are still mostly static/fake and should be backed by `WorkspaceSetting`.
- Activity Log still uses legacy API/localStorage fallback and has no Prisma model.
- Login/onboarding routes still use the legacy auth API/localStorage flow outside Shopify auth.
- Creative Library file uploads currently persist file metadata only unless a Video URL is supplied. No binary/media storage was added in this pass.

### Schema And Migration Changes

- No Prisma schema or migration changes were required for this pass.
- Existing models used: `VideoAnalysis`, `SavedCreative`, `RevenueBlueprint`, and `SavedBrief`.

### Risks And Limitations

- Local/dev bypass uses `blueprintai-test-store.myshopify.com`; production uses authenticated Shopify `session.shop`.
- Video analysis scoring is still heuristic/local analyzer based. It does not call an external AI provider.
- Saved Creative file uploads do not store the uploaded binary; they store metadata and optional remote `video_url`.
- Duplicate prevention has not been added yet, so repeated clicks can create multiple saved records.
- The prior sidebar brand/icon visual tweaks remain unrelated uncommitted changes in the working tree.

## Persistence Implementation Pass 2

Date: 2026-06-22

### Duplicate Prevention Added

- Added deterministic persistence fingerprints in `app/models/blueprint.server.js` for `SavedBrief`, `VideoAnalysis`, `SavedCreative`, and `RevenueBlueprint` saves.
- Repeated Video Analysis submissions for the same shop, product, file metadata, brief, and analysis payload now return the existing `VideoAnalysis` instead of creating another row.
- Repeated Creative Library saves now return the existing creative. Upload saves are keyed by URL when supplied, or by filename, size, and MIME type for file metadata uploads.
- Repeated "Save to Creative Library" actions from Video Analysis are keyed by the saved analysis source ID, so clicking the button again does not create another `SavedCreative`.
- Repeated Revenue Blueprint generation now reuses the matching blueprint fingerprint when the generated inputs/content are unchanged.
- Repeated Ad Brief generation now reuses the matching brief fingerprint; volatile generated timestamps are excluded from the fingerprint so identical briefs do not duplicate.

### Save UX Improvements Added

- Video Analysis now returns specific states: `Analysis saved.`, `Saved to Creative Library.`, and `Blueprint saved.` Duplicate submissions show an already-saved variant instead of implying a new record.
- Creative Library save success now says `Saved to Creative Library.` and the client list filters out an already-returned creative ID before prepending.
- Revenue Blueprint success now says `Blueprint saved.` and the page shows a clear "No saved blueprints yet" state.
- Ad Brief success now says `Brief saved.` and the primary action is labeled `Generate and Save Brief`.
- Save/generate buttons have disabled/loading states during active submissions.
- Video Analysis now shows a saved-analyses empty state when no analysis records exist yet.
- Creative Library detail was kept in the dark Creative OS styling and now honestly states when a record saved metadata only with no stored video URL.

### Remaining Fake Or Partial Features

- Creators still uses the legacy external API and is intentionally out of scope for this pass.
- Data Import still uses the legacy external API and has no Shopify app import models yet.
- Settings preference controls still need to be backed by `WorkspaceSetting`.
- Activity Log still uses legacy API/localStorage fallback and has no Prisma activity model.
- Creative Library file uploads still save metadata only unless a video URL is supplied; no binary/media storage was added.

### Schema Or Migration Changes

- No Prisma schema or migration changes were made.
- Duplicate prevention is application-level and uses stored payload fingerprints plus existing indexed shop/product/source fields. A future migration could add database-level uniqueness if the app needs hard race-condition protection across concurrent workers.

### Risks Or Limitations

- The duplicate checks avoid normal repeated-click duplicates but are not a database-enforced unique constraint.
- Existing rows created before Pass 2 do not have persistence fingerprints, so the first repeat of an old record may create one fingerprinted record.
- Fingerprints intentionally ignore volatile `generatedAt` values, so identical generated brief content is considered the same saved brief.
- Verification passed: `npm run lint` completed with three existing hook-dependency warnings in out-of-scope pages, `npm run typecheck` passed with React Router future-flag warnings, and `npm run build` passed with React Router future-flag warnings.

## Persistence Implementation Pass 3

Date: 2026-06-22

### Settings Preferences Now Persisted

- Rewired `app/routes/app.settings.jsx` to load and save the visible Video Analysis Preferences with authenticated `session.shop`.
- Persisted settings use the existing `WorkspaceSetting` model:
  - `analysis_depth`
  - `auto_save_analyzed_videos`
  - `email_summaries`
- Added a Remix action for `Save Preferences` with visible loading, success, and error states.
- Settings survive refresh, navigation, and app restart because they are stored in Prisma by `(shop, key)`.
- No unrelated settings were added.

### Activity Log Now Persisted

- Added a shop-scoped `ActivityLog` Prisma model.
- Added server helpers in `app/models/blueprint.server.js`:
  - `createActivityLogRecord`
  - `listActivityLogs`
  - `clearActivityLogs`
- Replaced the Activity Log page’s legacy API/localStorage read path with a Shopify-authenticated Remix loader/action.
- The Activity Log page now reads real Prisma activity rows, filters by activity type, clears rows for the authenticated shop, and shows `No activity has happened yet for this shop.` when empty.
- The app shell Recent Activity dropdown now loads from real `ActivityLog` rows instead of reconstructing activity from saved records.

### Actions That Create Activity Records

- `VideoAnalysis` create: logs `video_analysis` with title `Analysis saved`.
- `SavedCreative` create: logs `creative` with title `Creative saved`.
- `RevenueBlueprint` create: logs `blueprint` with title `Blueprint saved`.
- `SavedBrief` create: logs `ad_brief` with title `Brief saved`.
- Settings preference save: logs `settings` with title `Settings updated`.
- Idempotent "already saved" paths from Pass 2 return existing records and do not create duplicate activity rows.

### Schema And Migration Changes

- Added Prisma model `ActivityLog`.
- Added migration `prisma/migrations/20260622213000_add_activity_log/migration.sql`.
- Ran `npm run prisma -- generate`.
- Ran `npm run prisma -- migrate deploy` against the local SQLite database.
- No schema changes were needed for Settings because `WorkspaceSetting` already existed.

### Remaining Fake Or Partial Features

- Settings Active Shop management still uses legacy localStorage/demo shop behavior and was not expanded in this pass.
- TikTok Shop connect/demo/disconnect controls still call the legacy external API and should be moved to Shopify-authenticated actions later.
- The legacy `app/services/activityLog.js` helper remains in the tree but is no longer used by the app Activity Log route or shell Recent Activity UI.
- Creators and Data Import remain legacy external API flows.
- Activity is not backfilled for records created before Pass 3.

### Risks Or Limitations

- Activity logging is application-level. Related record IDs prevent duplicate log rows for repeated idempotent saves, but there is no database unique constraint for activity records.
- Clearing Activity Log deletes persisted activity rows for the authenticated shop.
- The `auto_save_analyzed_videos` preference is now persisted, but Video Analysis does not yet consume it to automatically save analyzed videos to Creative Library.
- Verification passed: `npm run lint` completed with two existing out-of-scope hook-dependency warnings, `npm run typecheck` passed with React Router future-flag warnings, and `npm run build` passed with React Router future-flag warnings.

## Auto-save Video Analysis Behavior Pass

Date: 2026-06-22

### Setting Consumption

- `auto_save_analyzed_videos` is now consumed by `app/routes/app.video-analysis.jsx`.
- The Video Analysis loader reads the authenticated shop's `WorkspaceSetting` value with `getWorkspaceSettingsMap(session.shop, ...)`.
- The Video Analysis action also reads the same setting server-side before deciding whether to persist the analysis.
- No browser `localStorage` is used for this setting.

### When Auto-save Is Enabled

- Successful `Analyze Video` submissions automatically call `saveVideoAnalysisRecord`.
- The page shows `Auto-save is on. New analyses will be saved automatically.`
- Successful auto-save shows `Analysis saved automatically.`
- Repeated identical submissions reuse the existing fingerprinted `VideoAnalysis` and show an already-saved state instead of creating another row.
- Activity Log records are created only from the new `VideoAnalysis` create path. Idempotent existing-record returns do not create duplicate activity records.

### When Auto-save Is Disabled

- Successful `Analyze Video` submissions return the analysis result without creating a `VideoAnalysis` row.
- The page shows `Auto-save is off. Save analyses manually.`
- The result actions include a manual `Save Analysis` button that persists the analysis with the same `saveVideoAnalysisRecord` idempotency helper.
- Existing manual actions still work: `Save to Creative Library`, `Generate Blueprint`, and `Download Report`.

### Limitations

- Auto-save applies to the `VideoAnalysis` record only. It does not automatically save the result to Creative Library.
- The saved analyses list is still loader-backed, so a newly auto-saved record appears there after navigation/refresh rather than being inserted client-side immediately.
- Duplicate prevention remains application-level fingerprinting, not a database unique constraint.

### Remaining Fake Or Partial Features

- Settings Active Shop management still uses legacy localStorage/demo shop behavior.
- TikTok Settings controls still call the legacy external API.
- Creators and Data Import remain legacy external API flows.
- Creative Library file uploads still save metadata only unless a video URL is supplied.

### Verification

- `npm run lint` passed with two existing out-of-scope hook-dependency warnings.
- `npm run typecheck` passed with React Router future-flag warnings.
- `npm run build` passed with React Router future-flag warnings.

## Creative Library Delete Pass

Date: 2026-06-23

### What Changed

- Added a Shopify-authenticated delete action to `app/routes/app.creative-library.jsx` for card-level Creative Library deletion.
- Added a Shopify-authenticated delete action to `app/routes/app.creative-library.$id.jsx` for detail-page deletion.
- Added `deleteSavedCreative(shop, creativeId)` in `app/models/blueprint.server.js`.
- Delete lookup is scoped by authenticated `session.shop`; a creative ID from another shop is treated as not found.
- Successful deletes create an `ActivityLog` row with type `creative_deleted`, title `Creative removed`, and description `Removed [creative title] from Creative Library`.
- `/app/activity-log` includes `creative_deleted` in the visible filter set.

### Delete Behavior

- Deleting removes the `SavedCreative` row only.
- `VideoAnalysis` rows are not deleted.
- Uploaded media files are not removed from local/dev storage yet. Current upload files under `public/uploads/...` may remain until a safe storage cleanup helper and production storage policy are implemented.
- Existing save behavior and duplicate prevention remain unchanged.

### Verification Needed

- Manual QA should confirm delete from the library list, delete from the detail page, refresh persistence, Activity Log creation, and cross-shop deletion denial.

## TikTok Settings Cleanup Pass

Date: 2026-06-22

### TikTok Controls That Existed

- Settings displayed a `TikTok Shop Connection` card with:
  - `Connect TikTok Shop`
  - `Use Demo TikTok Shop Data`
  - `Disconnect`
  - status banners for connected/demo/disconnected/error/pending
- The Active Shop modal also had a `+ Connect New Shop` button that reused the TikTok OAuth start handler.
- The route called legacy external endpoints directly from the browser:
  - `/tiktok/oauth/status`
  - `/tiktok/oauth/start`
  - `/tiktok/oauth/demo-connect`
  - `/tiktok/oauth/disconnect`

### What Was Fake Or Legacy

- TikTok status depended on legacy external API responses and URL query state, not a complete Shopify-authenticated OAuth implementation.
- The connect/demo/disconnect buttons implied live TikTok account operations even though the Shopify app does not currently complete secure TikTok OAuth.
- The modal `+ Connect New Shop` button was misleading because it started the same TikTok OAuth path rather than adding a Shopify-authenticated shop connection.

### Removed, Disabled, Or Relabeled

- Removed the Settings page's browser-side TikTok OAuth fetch calls and TikTok connection state handlers.
- Replaced dynamic TikTok connection claims with honest static copy:
  - `TikTok connection coming soon`
  - `No TikTok seller account is connected to this Shopify app right now.`
- Disabled and relabeled TikTok buttons:
  - `Connect TikTok Shop - Coming Soon`
  - `Demo TikTok Sync - Coming Soon`
  - `Disconnect Unavailable`
- Disabled and relabeled the modal button:
  - `Connect New Shop - Coming Soon`
- Updated the TikTok testing status list to state that OAuth is not wired, no TikTok tokens are stored, and uploaded/demo creative workflows are available now.

### LocalStorage And Legacy Usage

- TikTok-specific local state and legacy TikTok endpoint calls were removed from `app/routes/app.settings.jsx`.
- No Settings UI now claims TikTok is connected from localStorage, URL query state, or legacy API calls.
- General Settings localStorage usage remains for the existing legacy Active Shop/logout behavior; that was intentionally not changed in this TikTok-focused pass.

### Remaining TikTok Integration Work Needed

- Build a secure Shopify-authenticated TikTok OAuth start/callback flow.
- Store TikTok access/refresh tokens and seller metadata in `WorkspaceSetting` or a dedicated encrypted/secrets-aware store.
- Add a real disconnect Remix action that clears persisted TikTok credentials for `session.shop`.
- Replace Data Import and Creators legacy TikTok/shop assumptions in later passes.

### Verification

- `npm run lint` passed with two existing out-of-scope hook-dependency warnings.
- `npm run typecheck` passed with React Router future-flag warnings.
- `npm run build` passed with React Router future-flag warnings.

## Data Import Cleanup Pass

Date: 2026-06-22

### Import Controls That Existed

- Data Import previously displayed active controls for:
  - `Upload CSV`
  - `Upload JSON`
  - `Clear Shop Data`
  - table selection for products, orders, creators, creatives, and metrics
  - imported-row summary cards
- Those controls called legacy external endpoints directly from the browser:
  - `/data-import/summary?shop_id=...`
  - `/data-import/csv`
  - `/data-import/json`
  - `/data-import/clear?shop_id=...`

### Real, Fake, Legacy, Or Mock

- CSV import was legacy external API behavior and used a browser/localStorage-derived numeric `shop_id`.
- JSON import was legacy external API behavior and used a browser/localStorage-derived numeric `shop_id`.
- Clear imported data was legacy external API behavior and used a browser/localStorage-derived numeric `shop_id`.
- The Shopify app does not currently have Prisma models for imported products, orders, creators, creative metrics, or import batches.
- Existing real Shopify-app persistence is limited to saved creatives, video analyses, saved briefs, revenue blueprints, settings, activity logs, and workspace requests.

### Disabled Or Relabeled

- Replaced active CSV/JSON/clear controls with an honest Data Import status page.
- Added supported-today links to real persisted workflows:
  - Creative Library uploads/saved creative records
  - Video Analysis uploads/saved analyses
- Added disabled coming-soon import cards:
  - `CSV Import Coming Soon`
  - `JSON Import Coming Soon`
  - `TikTok Sync Coming Soon`
  - `Shopify Sync Coming Soon`
- Added explanatory copy:
  - `Manual uploads and saved creative records are supported. TikTok and automated data sync are coming soon.`
  - import controls are disabled until safe, shop-scoped database targets exist.
- Added persisted workspace record counts for currently supported Prisma-backed records.

### LocalStorage And API_BASE Usage

- `app/routes/app.data-import.jsx` no longer imports or calls `API_BASE`.
- `app/routes/app.data-import.jsx` no longer reads browser `localStorage`.
- `app/routes/app.data-import.jsx` now uses an authenticated Remix loader and `session.shop` via `loadShopifyRouteContext`.

### Remaining Import Work Needed

- Add Prisma models for imported products, orders, creators, creatives, metrics, and import batches if bulk import remains a product requirement.
- Add authenticated Remix actions for CSV/JSON parsing and validation.
- Add idempotency/deduplication strategy for imported rows.
- Add a safe clear/import-batch deletion flow scoped to `session.shop`.
- Build real TikTok OAuth/API sync separately before enabling TikTok automated imports.

### Verification

- `npm run lint` passed with one existing out-of-scope Creator detail hook-dependency warning.
- `npm run typecheck` passed with React Router future-flag warnings.
- `npm run build` passed with React Router future-flag warnings.

## Creators Cleanup Pass

Date: 2026-06-22

### Creator Controls That Existed

- Creators list page controls:
  - `Refresh`
  - `Add Creator`
  - creator metric cards labeled as live creator/view/revenue/conversion data
  - creator cards and leaderboard rows that displayed handles, views, conversions, revenue, and scores
  - best-current-creator comparison panel
- Creator detail page controls:
  - `Edit`
  - `Delete`
  - editable creator form with handle, follower, video, view, engagement, conversion, revenue, and notes fields
  - AI creator summary that described tracked revenue and conversions
- Supporting creator code:
  - `app/services/creatorsApi.js` called legacy `/creators/` endpoints through `API_BASE`.
  - `app/components/CreatorForm.jsx` powered create/update forms with no Shopify-app persistence.

### Real, Demo, Legacy, Or Fake

- Real Shopify-app persistence: none for creators. There is still no `Creator` Prisma model in this app.
- Demo/static: `buildCreators()` generates synthetic planning profiles from Shopify products and saved creative records.
- Legacy API based: add, update, delete, refresh, detail fetch, and compare calls used the external creator API.
- LocalStorage/shop_id based: legacy creator API calls used `getSelectedShopId()` and appended `shop_id` instead of using `session.shop`.
- Fake or unsupported controls: add/edit/delete/contact/outreach/sync/export/invite-style behavior implied creator CRM, outreach, affiliate, commission, or TikTok sync support that the Shopify app does not currently provide.

### Disabled Or Relabeled

- Replaced active `Refresh` with `Sync Creators Coming Soon`.
- Replaced active `Add Creator` and creator CRUD paths with disabled `Invite Creator Coming Soon` and `Contact Creator Coming Soon` controls.
- Added disabled `Export Creator List Coming Soon`.
- Relabeled the Creators page and Creator detail page as `Demo creator insights.`
- Replaced live-performance language with explicit demo/manual planning language.
- Removed live TikTok creator, outreach, commission, affiliate, synced performance, and connected TikTok Shop claims from the creator pages.
- Added honest help copy:
  - `Creator discovery and TikTok affiliate sync are coming soon.`
  - `For now, use Creative Library and Video Analysis to evaluate uploaded creative assets.`
- Updated search result creator subtitles to label generated creator matches as demo creator insights.

### API_BASE And LocalStorage Usage

- `app/routes/app.creators.jsx` no longer imports `creatorsApi`, `API_BASE`, `getSelectedShopId`, or any localStorage-backed shop context.
- `app/routes/app.creators.$creatorId.jsx` no longer imports `creatorsApi`, `API_BASE`, `getSelectedShopId`, or any localStorage-backed shop context.
- `app/services/creatorsApi.js` was deleted.
- `app/components/CreatorForm.jsx` was deleted.
- Active Shopify creator pages now load with `loadShopifyRouteContext(request)` and use `session.shop` when reading saved creative records.
- No creator-page API_BASE/localStorage/shop_id behavior remains. Unrelated legacy usage still exists elsewhere in the app and is tracked in earlier audit sections.

### Remaining Creator Integration Work Needed

- Add Shopify-scoped `Creator` and optional `CreatorMetric`, `CreatorContact`, `CreatorOutreach`, and `CreatorCommission` Prisma models if creators become first-class app data.
- Build authenticated Remix actions/loaders for creator create/update/delete only after the schema exists.
- Build a secure TikTok OAuth/API integration before enabling TikTok creator discovery, affiliate sync, commissions, or performance metrics.
- Add explicit import/sync provenance for any future creator data, including timestamps, source names, and per-shop scoping.
- Reintroduce contact/invite/outreach controls only when they persist durable records or connect to a real supported integration.

### Verification

- `npm run lint` passed.
- `npm run typecheck` passed with React Router future-flag warnings.
- `npm run build` passed with React Router future-flag warnings.
