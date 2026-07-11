# BluePrintAI Manual QA Checklist

Date prepared: 2026-06-23

Purpose: guide a human Shopify development-store QA pass after the persistence, honesty/copy, scope, and Support/Privacy/Terms navigation cleanup work.

Use this checklist inside Shopify Admin with the embedded app installed. Keep browser DevTools open on Console and Network. Test at desktop width and a narrow/mobile width.

## Setup

- [ ] Install or open BluePrintAI on a Shopify development store.
- [ ] Confirm the app opens embedded inside Shopify Admin, not as a standalone page.
- [ ] Confirm the active store shown in the app matches the Shopify Admin store.
- [ ] Confirm production or dev env `SCOPES` does not include `read_orders`.
- [ ] Confirm `shopify.app.toml` requests `read_products` only.
- [ ] Keep DevTools Console open and watch for uncaught errors during every page and flow.

## Shopify Product Data Integration QA

- [ ] Products load from the Shopify Admin GraphQL API using the embedded Admin session.
- [ ] Confirm `read_products` remains the only requested scope in `shopify.app.toml` and runtime `SCOPES`.
- [ ] Product selector appears in onboarding and Settings when Shopify products exist.
- [ ] Product selectors appear in Ad Briefs, Revenue Blueprint, Video Analysis, and Creative Library upload where product context is used.
- [ ] Selected product saves into `workspace_profile` with title, handle, vendor, product type, and featured image reference only.
- [ ] Recommendations, briefs, and blueprints use the selected product title/context instead of demo/manual fallback.
- [ ] Command Center shows Shopify product count and the selected/main product when available.
- [ ] Empty state appears when no products exist: "No Shopify products found yet. Add products in Shopify or enter product context manually."
- [ ] Shopify API failure shows a non-blocking warning and manual workspace profile input still works.
- [ ] Confirm no orders, customers, revenue, fulfillment, or inventory fields are queried during this pass.

## Landing Page Hero Simplification

- [ ] Abstract hero mockup replaced; no "Next ad direction", "Hook Pattern", "Creator Style", or abstract brief-output card appears.
- [ ] New visual explains Upload -> Analyze -> Generate in a simple three-step workflow.
- [ ] Public landing page links to Shopify Admin and Contact support, tells merchants to open BluePrintAI from Shopify Admin, and never links directly to bare `/app`.
- [ ] Responsive behavior checked on desktop and narrow/mobile widths.
- [ ] No unsupported TikTok sync, revenue, order, or ad performance claims added.

## Legal Navigation Cleanup

- [ ] Sidebar footer simplified to Support, Legal, and Contact.
- [ ] `/app/legal` central hub added and reachable from the sidebar footer.
- [ ] `/app/legal` links to Terms, Privacy, Cookies, Acceptable Use, Refund Policy, AI Disclaimer, Copyright, Contact, and Support.
- [ ] All direct legal routes still work in embedded app and public contexts.
- [ ] Onboarding consent links still open `/app/terms` and `/app/privacy`.
- [ ] Settings Legal & Privacy / Data Requests links still open `/app/privacy`, `/app/terms`, and `/app/contact`.
- [ ] Sidebar footer does not wrap awkwardly or overflow at desktop, tablet, or narrow/mobile widths.

## Video Analysis Notice Cleanup

- [ ] Large AI disclaimer banner removed from the Video Analysis hero.
- [ ] Large auto-save banner removed from the Video Analysis hero.
- [ ] Auto-save behavior still works when enabled.
- [ ] Manual save still works when auto-save is disabled.
- [ ] Small auto-save helper text appears near the Analyze Video control.
- [ ] Small AI accuracy helper text appears near generated analysis results.

## Creators Page Redesign QA

- [ ] Creator comparison purpose is clear on `/app/creators`.
- [ ] Creator cards are labelled as style archetypes/planning profiles, not live creators.
- [ ] No fake live TikTok creator data, commissions, affiliate revenue, or synced performance appears.
- [ ] Coming-soon sync actions are moved to a smaller bottom section.
- [ ] Workspace profile personalization checked in “Recommended for your workspace.”
- [ ] Empty/no-context state is honest and points users toward onboarding or creative analysis.
- [ ] Responsive layout checked on desktop and narrow/mobile widths.

## Shared Checks For Every App Page

Apply these checks to each route listed below.

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works from this page to every primary app page.
- [ ] Top search submits to `/app/search` when text is entered, or is clearly limited in local demo mode.
- [ ] Empty state is clear when no saved data exists.
- [ ] Demo/manual data is labelled honestly.
- [ ] Buttons are clickable only when functional; unavailable controls are disabled or clearly labelled coming soon.
- [ ] Save/generate actions, where present, persist after refresh.
- [ ] Loading, success, and error states appear for actions.
- [ ] No console errors appear.
- [ ] No misleading TikTok, live revenue, live order, or live creator claims appear.
- [ ] Mobile/narrow layout does not overlap, clip important text, or hide required controls.

## Page-By-Page Checklist

### `/app` Command Center

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search routes to `/app/search` with a query.
- [ ] Empty/new-shop state is understandable if no records exist.
- [ ] Dashboard metrics are labelled as saved app records, planning signals, or manual/demo data.
- [ ] Dashboard does not imply live TikTok performance, live orders, live revenue, ROAS, or guaranteed sales.
- [ ] Primary actions route to real pages: upload creative, open briefs, open recommendations/blueprint/data import.
- [ ] Recent activity panel opens and links to real app routes.
- [ ] No console errors.
- [ ] Mobile/narrow layout keeps metric cards, navigation, and activity panel usable.

### Ad Performance Graph Empty-State Fix

- [ ] Graph no longer uses saved app records as performance data.
- [ ] No ad performance data shows the empty state: "No ad performance data yet."
- [ ] Future metrics are disabled/empty until import/sync exists.
- [ ] Saved creatives/analyses do not populate performance graph.
- [ ] Saved briefs, blueprints, activity logs, and readiness scores do not populate performance graph.
- [ ] Analyze creative remains available as a creative workflow, but does not claim to populate ad performance.
- [ ] Performance import CTA is disabled or clearly marked coming soon.

### `/app/creative-library`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty state explains how to add or save creatives.
- [ ] Demo/manual creative data is labelled honestly.
- [ ] Upload/save controls are usable only when required fields are present.
- [ ] Save Creative persists after refresh.
- [ ] Saved creative detail route opens from a card.
- [ ] Metadata-only upload state is honest when no stable video URL exists.
- [ ] Loading, success, and error states appear for save attempts.
- [ ] No copy claims imported views, clicks, orders, revenue, live TikTok performance, or guaranteed results.
- [ ] No console errors.
- [ ] Mobile/narrow card grid and upload form remain usable.

### `/app/video-analysis`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty/recent analysis state is clear.
- [ ] Analysis output is labelled as AI-estimated creative readiness/planning signals.
- [ ] Analyze Video is disabled or blocked until valid input is present.
- [ ] Analyze Video shows loading, success, and error states.
- [ ] Analysis records persist after refresh.
- [ ] Save to Creative Library persists after refresh.
- [ ] Generate Blueprint creates a saved revenue blueprint.
- [ ] Auto-save behavior follows the Settings preference.
- [ ] No TikTok/live revenue/live order/live creator performance claims appear.
- [ ] No console errors.
- [ ] Mobile/narrow upload form, result cards, and action buttons remain usable.

### `/app/ad-briefs`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty state explains product context or saved brief requirements.
- [ ] Briefs are labelled as planning outputs from product context and saved app activity.
- [ ] Generate/save brief action is clickable only when product context exists.
- [ ] Generated brief persists after refresh.
- [ ] Loading, success, and error states appear.
- [ ] Saved brief cards remain visible after navigation away and back.
- [ ] No copy claims real creative performance, guaranteed sales, or live TikTok data.
- [ ] No console errors.
- [ ] Mobile/narrow brief cards and generated text remain readable.

### `/app/recommendations`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty state is clear when no saved app records exist.
- [ ] Recommendations are labelled as estimated planning suggestions.
- [ ] Recommendation links route to real destination pages.
- [ ] Recommendations update after saved analyses, creatives, briefs, or blueprints exist.
- [ ] No unavailable apply/sync buttons are clickable.
- [ ] No copy claims live revenue, live ROAS, synced TikTok creator data, or guaranteed performance.
- [ ] No console errors.
- [ ] Mobile/narrow recommendation cards remain scannable.

### `/app/revenue-blueprint`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty state explains how to create enough context.
- [ ] Blueprint copy is labelled as a planning estimate, not a financial forecast.
- [ ] Generate Blueprint and Generate New Blueprint show loading, success, and error states.
- [ ] Generated blueprint persists after refresh.
- [ ] Saved blueprint history remains visible after navigation away and back.
- [ ] Blueprint does not imply live orders, live revenue, ROAS, conversion lift, sales volume, or platform approval.
- [ ] No console errors.
- [ ] Mobile/narrow timeline and saved-history sections remain readable.

### `/app/creators`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty/demo state is clear.
- [ ] Creator profiles are labelled as demo/manual planning examples.
- [ ] Create/import/sync/outreach/CRM controls are disabled or clearly coming soon.
- [ ] Creator detail links route to real detail pages or clear missing states.
- [ ] No copy claims live TikTok creators, affiliate sync, commissions, creator revenue, or tracked outreach.
- [ ] No console errors.
- [ ] Mobile/narrow creator grid and detail pages remain usable.

### `/app/data-import`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Empty/import-limited state is clear.
- [ ] Supported workflows link to real pages.
- [ ] CSV, JSON, TikTok sync, and Shopify bulk import controls are disabled or clearly coming soon.
- [ ] Counts reflect saved Shopify app records where shown.
- [ ] Page does not imply active TikTok sync, live order import, or bulk imported performance metrics.
- [ ] No console errors.
- [ ] Mobile/narrow import cards remain readable.

### `/app/settings`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search works or is honestly limited.
- [ ] Active Shop shows the authenticated Shopify store.
- [ ] No in-app shop switcher appears.
- [ ] TikTok controls are disabled and clearly say OAuth/API sync is not live.
- [ ] Analysis depth, auto-save analyzed videos, and email-summary preferences save successfully.
- [ ] Settings preferences survive refresh.
- [ ] Email summaries are labelled as a saved preference only; delivery is not active yet.
- [ ] No console errors.
- [ ] Mobile/narrow settings cards and forms remain usable.

### `/app/activity-log`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works or the route is reachable from activity/notification links.
- [ ] Top search works or is honestly limited.
- [ ] Empty state is clear when no activity exists.
- [ ] Activity created by video analysis, creative save, brief save, blueprint generation, and settings update appears.
- [ ] Filter controls work.
- [ ] Clear Log shows loading, success, and error states.
- [ ] Clear Log affects only the authenticated shop.
- [ ] No console errors.
- [ ] Mobile/narrow activity list remains readable.

### `/app/support`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search remains available from the app shell.
- [ ] Support content explains contact/help instructions and current limitations.
- [ ] Page does not claim unsupported integrations.
- [ ] Link to the public support page works.
- [ ] No console errors.
- [ ] Mobile/narrow layout remains readable.

### `/app/privacy`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search remains available from the app shell.
- [ ] Privacy summary describes app workspace data and store scoping honestly.
- [ ] Page says TikTok OAuth/API sync is not live.
- [ ] Page does not claim live order or customer data access.
- [ ] Link to the full public privacy page works.
- [ ] No console errors.
- [ ] Mobile/narrow layout remains readable.

### `/app/terms`

- [ ] Page loads inside Shopify Admin.
- [ ] Sidebar navigation works.
- [ ] Top search remains available from the app shell.
- [ ] Terms summary describes MVP status, AI-output limitations, and user responsibility.
- [ ] Page does not claim guaranteed sales, ROAS, creator performance, revenue, or platform approval.
- [ ] Link to the full public terms page works.
- [ ] No console errors.
- [ ] Mobile/narrow layout remains readable.

## Special Flow Tests

### Analyze A Video With Auto-Save On

- [ ] Open `/app/settings`.
- [ ] Enable auto-save analyzed videos.
- [ ] Save preferences and refresh `/app/settings`; confirm the setting stays enabled.
- [ ] Open `/app/video-analysis`.
- [ ] Analyze a valid video or valid test upload.
- [ ] Confirm loading and success states appear.
- [ ] Confirm a Video Analysis record appears after refresh.
- [ ] Confirm a Saved Creative appears in `/app/creative-library` after refresh.
- [ ] Confirm `/app/activity-log` records the analysis/save activity.

### Analyze A Video With Auto-Save Off, Then Manually Save

- [ ] Open `/app/settings`.
- [ ] Disable auto-save analyzed videos.
- [ ] Save preferences and refresh `/app/settings`; confirm the setting stays disabled.
- [ ] Open `/app/video-analysis`.
- [ ] Analyze a valid video or valid test upload.
- [ ] Confirm the analysis persists after refresh.
- [ ] Confirm the creative is not auto-saved to `/app/creative-library`.
- [ ] Click Save to Creative Library.
- [ ] Confirm success state appears.
- [ ] Refresh `/app/creative-library`; confirm the creative persists.
- [ ] Confirm `/app/activity-log` records the manual save.

### Save A Creative

- [ ] Open `/app/creative-library`.
- [ ] Add a creative with valid metadata and, if available, a stable video URL.
- [ ] Confirm Save Creative shows loading and success states.
- [ ] Refresh the page.
- [ ] Confirm the saved creative remains.
- [ ] Open the creative detail route and confirm metadata/media state is honest.
- [ ] Confirm `/app/activity-log` records the creative save.

### Generate A Revenue Blueprint

- [ ] Open `/app/revenue-blueprint`.
- [ ] Click Generate Blueprint or Generate New Blueprint.
- [ ] Confirm loading and success states appear.
- [ ] Refresh the page.
- [ ] Confirm the blueprint remains in saved history.
- [ ] Confirm output says planning estimate and does not guarantee revenue, ROAS, conversions, sales, or approval.
- [ ] Confirm `/app/activity-log` records the blueprint save.

### Generate And Save An Ad Brief

- [ ] Open `/app/ad-briefs`.
- [ ] Select or confirm product context is available.
- [ ] Generate/save a brief.
- [ ] Confirm loading and success states appear.
- [ ] Refresh the page.
- [ ] Confirm the saved brief remains.
- [ ] Confirm `/app/activity-log` records the brief save.

### Confirm Activity Log Updates

- [ ] Perform video analysis, creative save, brief save, blueprint generation, and settings save.
- [ ] Open `/app/activity-log`.
- [ ] Confirm each activity type appears.
- [ ] Use filters to isolate each type.
- [ ] Confirm notification panel in the app shell links to relevant routes.

### Confirm Recommendations Update After Saved Data Exists

- [ ] Open `/app/recommendations` before saving data and note the empty/default state.
- [ ] Save at least one analysis, creative, brief, and blueprint.
- [ ] Refresh `/app/recommendations`.
- [ ] Confirm recommendations reflect saved app records and route to real actions.
- [ ] Confirm copy remains framed as planning suggestions.

### Confirm Settings Preferences Survive Refresh

- [ ] Change analysis depth.
- [ ] Toggle auto-save analyzed videos.
- [ ] Toggle email summaries.
- [ ] Save preferences.
- [ ] Refresh `/app/settings`.
- [ ] Confirm all preferences persist.
- [ ] Confirm email-summary copy says delivery is not active yet.

### Confirm Support/Privacy/Terms Links Work

- [ ] In the sidebar footer, click Support.
- [ ] Confirm `/app/support` loads.
- [ ] Click Privacy.
- [ ] Confirm `/app/privacy` loads.
- [ ] Click Terms.
- [ ] Confirm `/app/terms` loads.
- [ ] Visit `/app/settings?panel=support`; confirm it redirects to `/app/support`.
- [ ] Visit `/app/settings?panel=privacy`; confirm it redirects to `/app/privacy`.
- [ ] Visit `/app/settings?panel=terms`; confirm it redirects to `/app/terms`.
- [ ] Confirm public `/support`, `/privacy`, and `/terms` load outside the embedded shell.

### Confirm Login And Onboarding Redirects

- [ ] Visit `/login`.
- [ ] Confirm it redirects to `/app`.
- [ ] Visit `/onboarding`.
- [ ] Confirm it redirects to `/app`.
- [ ] Confirm neither page writes legacy browser auth/shop state.

## Pre-Review Technical Checklist

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run prisma -- generate`.
- [ ] Run `shopify app config validate`.
- [ ] Confirm production env `SCOPES` does not include `read_orders`.
- [ ] Confirm `shopify.app.toml` scopes are still `read_products`.
- [ ] Confirm app URL and redirect URLs match the current Shopify app config.
- [ ] Confirm `SHOPIFY_APP_URL` points at the production HTTPS app URL before submission.
- [ ] Confirm public Privacy, Terms, and Support URLs are production-ready.

## Automated QA Precheck

Date run: 2026-06-23

### Commands Run

- [x] `npm run lint` - passed.
- [x] `npm run typecheck` - passed with React Router future-flag warnings only.
- [x] `npm run build` - passed with React Router future-flag warnings only and expected empty auth/webhook chunks.
- [x] `npm run prisma -- generate` - passed and generated Prisma Client.
- [x] `shopify app config validate` - passed after rerun with network access; the first sandboxed attempt failed DNS lookup for `app.shopify.com`.

### Route Smoke Results

Smoke checks used the production build served locally with `SCOPES=read_products`.

- [x] `/app` - 200, `Dashboard | BluePrintAI`.
- [x] `/app/creative-library` - 200, `Creative Library | BluePrintAI`.
- [x] `/app/video-analysis` - 200, `Video Analysis | BluePrintAI`.
- [x] `/app/ad-briefs` - 200, `Ad Briefs | BluePrintAI`.
- [x] `/app/recommendations` - 200, `Recommendations | BluePrintAI`.
- [x] `/app/revenue-blueprint` - 200, `Revenue Blueprint | BluePrintAI`.
- [x] `/app/creators` - 200, `Creators | BluePrintAI`.
- [x] `/app/data-import` - 200, `Data Import | BluePrintAI`.
- [x] `/app/settings` - 200, `Settings | BluePrintAI`.
- [x] `/app/activity-log` - 200, `Activity Log | BluePrintAI`.
- [x] `/app/support` - 200, `Support | BluePrintAI`.
- [x] `/app/privacy` - 200, `Privacy | BluePrintAI`.
- [x] `/app/terms` - 200, `Terms | BluePrintAI`.
- [x] `/support` - 200, `Support | BluePrintAI`.
- [x] `/privacy` - 200, `Privacy Policy | BluePrintAI`.
- [x] `/terms` - 200, `Terms Of Service | BluePrintAI`.

### Redirect Results

- [x] `/login` - 302 to `/app`.
- [x] `/onboarding` - 302 to `/app`.
- [x] `/app/settings?panel=support` - 302 to `/app/support`.
- [x] `/app/settings?panel=privacy` - 302 to `/app/privacy`.
- [x] `/app/settings?panel=terms` - 302 to `/app/terms`.

### Risky Pattern Search Results

- [x] `shopify.app.toml` requests only `read_products`.
- [x] No active imports from deleted legacy helper files were found for `accountContext`, `shopSession`, `engineApi`, or legacy `activityLog`.
- [x] No active app code links to `/app/settings?panel=` or `/settings?panel=`.
- [x] Sidebar links point to valid routes: `/app`, `/app/creative-library`, `/app/video-analysis`, `/app/ad-briefs`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/creators`, `/app/data-import`, `/app/settings`, `/app/support`, `/app/privacy`, and `/app/terms`.
- [x] `API_BASE`, `localStorage`, `getSelectedShopId`, `getAuthHeaders`, `accountContext`, and `shopSession` matches were historical audit/checklist references, not active route imports.
- [x] Remaining `shop_id` matches in active app code are TikTok metadata keys such as `tiktok_shop_id`, not browser-local shop identity.
- [x] Remaining `read_orders` matches are historical audit/checklist references; active Shopify config does not request it.
- [x] Remaining risky phrase matches in active UI are negative/disclaimer copy such as "not live TikTok performance" or "not guaranteed performance claims."

### Fixes Made

- No code fixes were needed during this automated precheck.
- Documentation only: this `Automated QA Precheck` section was added to the checklist.

### Still Requires Manual Shopify Admin Testing

- [ ] Embedded Shopify Admin install/auth behavior.
- [ ] Shopify App Bridge/admin frame behavior.
- [ ] Real dev-store product context loading.
- [ ] Desktop and mobile/narrow visual layout inside Shopify Admin.
- [ ] Console and network behavior during real user clicks.
- [ ] File upload behavior with real browser file selection.
- [ ] Cross-refresh persistence after real route actions.
- [ ] Activity Log updates after real save/generate flows.
- [ ] Recommendations updates after saved data exists.
- [ ] Legal/privacy/support wording review.
- [ ] Production app URL, redirect URL, and production `SCOPES` verification in Shopify configuration.

## Items That Require Human Browser Testing

- [ ] Embedded Shopify Admin install/auth behavior.
- [ ] Shopify App Bridge/admin frame behavior.
- [ ] Real dev-store product context loading.
- [ ] Mobile/narrow visual layout inside Shopify Admin.
- [ ] Console and network behavior during real clicks.
- [ ] File upload behavior with real browser file selection.
- [ ] Cross-refresh persistence after real route actions.
- [ ] Legal/privacy/support wording review.
- [ ] Production app URL and redirect URL verification in Shopify Partner/Admin config.

## Video Upload Storage QA Fix

Date run: 2026-06-23

### What Caused The Bug

- The `/app/video-analysis` action read the uploaded `File` for analysis, but did not persist the original media file or save a playable media URL into the `VideoAnalysis` or `SavedCreative` payload.
- Auto-saved Creative Library records were created from analysis metadata only, so the Creative Library card could only render a placeholder/default metadata state.
- The Video Analysis fallback copy used the default product context, which made uploads look like generic product demo records instead of records anchored to the real uploaded filename.

### Storage Behavior After Fix

- [x] Uploaded videos from `/app/video-analysis` are now saved to local public development storage before analysis.
- [x] Uploaded videos from the Creative Library upload modal are also saved to local public development storage when no remote video URL is supplied.
- [x] Saved analysis payloads include media metadata: `media_url`, `media_fingerprint`, file size, file type, and storage marker.
- [x] Saved Creative Library payloads include `video_url` and `mediaUrl`, allowing cards/details to render a real `<video>` preview.
- [x] Auto-saved Video Analysis records now create Creative Library records with the uploaded filename as the title.
- [x] Duplicate creative saves use the saved analysis id or upload fingerprint as the source id to avoid repeated saved creatives for the same upload flow.

### Local Dev File Location

- Video Analysis uploads: `public/uploads/video-analysis/<shop>/`.
- Creative Library uploads: `public/uploads/creative-library/<shop>/`.
- These files are served through static `/uploads/...` URLs in local development. When `build/client` exists, the upload helper also mirrors files into `build/client/uploads/...` so `npm run start` can serve newly uploaded videos during built-server QA.

### Creative Library Display

- [x] Creative Library cards use `payload.video_url` or `payload.mediaUrl` and render a playable video when present.
- [x] Creative Library details use the same saved video URL.
- [x] Records without a media URL now show clear metadata-only copy with the real saved filename/title.

### Remaining Production Storage Limitations

- [ ] Local `public/uploads` storage is for development/manual QA only.
- [ ] Production should move uploaded video storage to durable object storage with access controls, retention policy, and cleanup behavior.
- [ ] Existing historical metadata-only records will not gain playable media unless re-uploaded or migrated with a real media URL.
- [ ] Browser QA still needs to confirm a real dev-store upload survives refresh and plays in Creative Library after navigation.

## Uploaded Video Title/Summary Fix

Date run: 2026-06-23

### What Changed

- [x] Raw uploaded filenames are preserved internally as `originalFilename` / `fileName`.
- [x] Raw UUID-style filenames are no longer used as the main title for new Video Analysis or Creative Library records.
- [x] Generated display metadata is stored in existing JSON payloads without schema changes.
- [x] Creative Library cards prefer `displayTitle` / `generatedTitle` over raw filenames.
- [x] Creative Library detail pages show the generated title prominently.
- [x] Original filenames are shown only as small truncated metadata text.
- [x] Success copy after Video Analysis now says `Analysis saved as: [Generated Title]` or the matching manual-save variant.

### Helper

- Added `generateCreativeTitleAndSummary` in `app/utils/creative-display.server.js`.
- The helper removes UUID/timestamp filename noise and generates heuristic titles/summaries from product context, cleaned filename text, transcript/OCR text when available, metadata, and saved analysis signals.
- The helper is intended to be replaceable later with a real AI/video-understanding model.

## Creative Delete QA

Date added: 2026-06-23

- [ ] Delete from library list: save/upload a test creative, use the card-level Delete action, confirm the confirmation state appears, confirm deletion, and verify the card is removed.
- [ ] Delete from detail page: save/upload another creative, open its Creative Library detail page, use Delete creative, confirm deletion, and verify the route redirects back to `/app/creative-library`.
- [ ] Refresh persistence check: refresh `/app/creative-library` after each delete and confirm the deleted creative stays removed.
- [ ] Activity Log check: open `/app/activity-log` and confirm a `Creative Deleted` activity row with title `Creative removed` appears for the deleted creative.
- [ ] Shop-scope check: attempt to delete a creative ID from another shop/session and confirm it is not removed and a visible error is shown.
- [x] Uploaded media file cleanup is not implemented for creative delete. Deleting removes the `SavedCreative` record only; local/dev uploaded files under `public/uploads/...` may remain.

### Heuristic Limitations

- [ ] Generated titles are heuristic, not a guarantee that the app fully understood the video.
- [ ] If no transcript/OCR/model output is available, titles come from file metadata and saved analysis signals only.
- [ ] Existing historical records may receive fallback display titles at render time, but their stored payloads remain unchanged until re-saved.
- [ ] Manual browser QA should upload a long UUID-named video and confirm the card/detail title is clean after refresh/navigation.

## Workspace Onboarding and Demo Cleanup

Date added: 2026-06-23

- [ ] First-run redirect: open `/app` for a shop with no `workspace_profile` setting and confirm it redirects to `/app/onboarding`.
- [ ] Product/category/profile save: complete onboarding with a category, product line, target customer, creative goal, creative source, and optional tone; confirm the action redirects to `/app`.
- [ ] Persistence after refresh: refresh `/app`, `/app/recommendations`, and `/app/settings` and confirm onboarding does not reappear.
- [ ] Recommendations personalize from onboarding: with no saved records, confirm Recommendations uses the entered product/category/profile context for setup recommendations.
- [ ] Skipped setup: use “Skip for now” and confirm generic empty states appear with “No product context yet” or “No saved creative data yet,” not seeded product names.
- [ ] No Hydrating Barrier Serum/demo leakage: search `/app`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/ad-briefs`, and `/app/creative-library` for unrelated demo product names unless explicit `?demo=1` mode is active.
- [ ] Settings profile edit test: update the Workspace Profile section in `/app/settings`, refresh, and confirm the saved values persist and power new recommendations/briefs/blueprints.
- [ ] Demo mode remains isolated: open an explicit `?demo=1` flow and confirm demo data is labelled/local to demo mode and does not appear in a normal shop workspace.
- [ ] Existing records: confirm saved analyses, saved creatives, briefs, revenue blueprints, settings, and activity logs still load for a previously populated shop.

## Onboarding QA Results

Date run: 2026-06-23

- [x] Inspected `/app/onboarding`, `app.jsx` route gating, and workspace profile helpers.
- [x] Fresh local workspace with no `workspace_profile` redirected `/app` to `/app/onboarding?next=%2Fapp`.
- [x] Fresh local workspace redirected `/app/recommendations` to `/app/onboarding?next=%2Fapp%2Frecommendations`.
- [x] `/app/support`, `/app/privacy`, and `/app/terms` returned `200` while onboarding was incomplete.
- [x] Completing onboarding saved `WorkspaceSetting` key `workspace_profile` scoped to `blueprintai-test-store.myshopify.com`.
- [x] Completed onboarding redirected to `/app` and allowed `/app`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/ad-briefs`, and `/app/settings`.
- [x] Settings Workspace Profile edit persisted updated product/category/audience/goal/tone values and the Recommendations loader included the updated profile context.
- [x] Skip onboarding saved a completed/skipped profile and allowed `/app`; `/app/ad-briefs` showed the generic “No product context yet” empty state.
- [x] Rendered normal app responses for `/app`, `/app/recommendations`, `/app/revenue-blueprint`, `/app/ad-briefs`, and `/app/settings` were searched for `Hydrating Barrier Serum`, `demo-product`, `Demo Creator`, demo thumbnails, and `sample collaboration`.
- [x] Source scan confirmed the remaining demo terms are confined to seed/demo data, explicit filtering code, or QA checklist/audit text.

### QA Notes

- The local built-server smoke test used dummy Shopify env vars and the existing local demo-bypass shop.
- The existing local `workspace_profile` value was restored after the temporary first-run, completed-onboarding, settings-edit, and skipped-onboarding checks.
- Existing historical local activity rows unrelated to onboarding can still appear as activity notifications, but seeded `demo-product-*` records and Hydrating Barrier Serum content are filtered from normal workspace records and rendered responses.
