# BluePrintAI UI Simplification Plan

## Proposed Navigation

Primary navigation:
- Home
- Creatives
- Recommendations
- Ad Briefs
- Revenue Blueprint
- Settings

Secondary access:
- Creative Analysis is accessed from Creatives and Home as "Analyze creative" instead of living as a separate primary navigation item.
- Search remains available as a compact topbar form on desktop and through direct route results.
- Notifications become a compact recent-activity control instead of a prominent alert surface.

## Proposed Route Structure

- `/app`: Home dashboard.
- `/app/creative-library`: Creatives index and saved analysis browser.
- `/app/video-analysis`: Secondary creative-analysis route linked from Home and Creatives.
- `/app/recommendations`: Prioritized recommendation queue.
- `/app/ad-briefs`: Linear brief generator and saved brief viewer.
- `/app/revenue-blueprint`: Weekly action plan.
- `/app/settings`: Store connection, app status, integrations, privacy, support.
- `/app/search`: Secondary search results route.

## Pages to Keep

- Home/Dashboard
- Creatives
- Creative Analysis
- Recommendations
- Ad Briefs
- Revenue Blueprint
- Settings
- Search

## Pages to Simplify

- Home/Dashboard
- Creatives
- Creative Analysis
- Recommendations
- Ad Briefs
- Revenue Blueprint
- Settings

## Pages to Merge

- Merge "Creative Analysis" into the Creatives workflow as a secondary action, while keeping `/app/video-analysis` as the working upload/analysis route.
- Merge Settings cards for store, workspace, and scopes into one connection section.
- Merge Dashboard insight, next actions, and catalog signal into the priority queue.

## Pages to Move

- Move Creative Analysis out of primary navigation.
- Move detailed AI/billing/scope data into Settings grouped status sections.
- Move creative detail metrics into detail panels instead of library cards.

## Pages to Remove from Navigation

- `/app/video-analysis` removed from primary navigation but retained as a working route.
- `/app/search` remains unlisted and reachable from search.

## Sections to Remove

- Duplicate Shopify `<s-app-nav>` or duplicate custom navigation exposure.
- Dashboard repeated status badges.
- Dashboard extra metrics beyond the core summary.
- Dashboard separate "Catalog signal" card.
- Creative Library "Featured winner" label and unsupported winner framing.
- Revenue Blueprint "Why this week matters" standalone card.
- Overly detailed default Settings cards where the same status appears elsewhere.

## Sections to Combine

- Dashboard "Priority queue", "What to do next", and "Next best actions".
- Settings connected store, active workspace, and scopes.
- Settings AI provider and billing readiness.
- Revenue Blueprint diagnosis, priorities, and conversion ideas into "Top priorities".
- Ad Briefs active context and selected brief status.

## Components to Reuse

- `PageHeader`
- `SectionCard`
- `Notice`
- `EmptyState`
- `ProductThumbnail`
- Existing button primitives

## Components to Replace

- Replace large metric grids with compact summary strips.
- Replace creative score rings on default cards with plain score/status text.
- Replace custom route-specific revenue/settings card overload with simpler section cards where practical.
- Replace vague recommendation action labels with deterministic action labels.

## Copy to Shorten

- Dashboard subtitle.
- Creative Library subtitle.
- Video Analysis form description and empty state.
- Recommendations subtitle and impact/effort copy.
- Ad Briefs subtitle and section descriptions.
- Revenue Blueprint header and supporting text.
- Settings header and callouts.

## Nonfunctional Controls to Fix or Remove

- Reduce topbar search prominence but preserve functional `/app/search` submission.
- Reduce notifications to recent activity and avoid real-time alert presentation.
- Replace vague "Take action" recommendation text with "Generate brief" or "Open blueprint".
- Rename concept preview controls to "Open details" when no media is present.
- Move logout into Settings as a secondary/account action instead of a header-level CTA.

## Responsive Changes

- Keep primary nav short so mobile menu is scannable.
- Reduce large hero/header vertical space.
- Ensure creative cards show one concise action on narrow screens.
- Let filter controls stack cleanly without hiding search access entirely.
- Keep dangerous Settings controls stacked and separated on mobile.

## Accessibility Changes

- Use clearer button text and aria labels.
- Avoid color-only status communication.
- Keep visible labels for selects and search.
- Avoid disabled elements that look like active controls.
- Replace tab-like recommendation filters with segmented buttons unless full tab behavior is implemented.

## Files Likely to Change

- `app/routes/app.jsx`
- `app/routes/app._index.jsx`
- `app/routes/app.creative-library.jsx`
- `app/routes/app.recommendations.jsx`
- `app/routes/app.ad-briefs.jsx`
- `app/routes/app.revenue-blueprint.jsx`
- `app/routes/app.settings.jsx`
- `app/components/blueprint-ui.jsx`
- `app/styles/blueprint.css`
- `docs/UI_SIMPLIFICATION_REPORT.md`

## Risks to Existing Functionality

- Removing visible controls can hide useful workflows if not replaced by contextual links.
- Shopify embedded navigation should remain compatible with `AppProvider`.
- Search and notifications must not appear broken after visual reduction.
- Recommendation action URLs must continue to carry `productId`, `recommendationId`, and `generate=1` where appropriate.
- Revenue Blueprint timeline toggles and calendar export must continue posting the expected hidden values.
- Settings data export, delete confirmation, TikTok disconnect, and logout must remain functional.

## Implementation Order

1. App shell and navigation
2. Dashboard
3. Creative Library
4. Creative detail and analysis
5. Recommendations
6. Ad Briefs
7. Revenue Blueprint
8. Settings and secondary pages
9. Empty, loading, and error states
10. Responsive and accessibility review

## Stage 1: App Shell and Navigation

- Keep one visible primary navigation system in the app frame.
- Rename labels: Command Center to Home, Creative Library to Creatives.
- Remove Creative Analysis from primary nav and link it contextually.
- Reduce topbar to store identity, compact search, and recent activity.
- Document the authenticated-browser limitation.

## Stage 2: Dashboard

- Keep one header, one subtitle, and one primary action.
- Reduce metrics from six to three.
- Make priority queue the main content.
- Merge products/next actions/catalog signal into a compact supporting section.

## Stage 3: Creative Library

- Rename page to Creatives.
- Keep search, angle filter, and advanced filters.
- Reduce cards to product/title/source/status/score/action.
- Move hook, CTA, retention, detailed insight, and recommendation into detail panel.
- Rename concept preview actions.

## Stage 4: Creative Detail and Analysis

- Keep `/app/video-analysis`.
- Shorten form copy.
- Keep Analyze primary and Analyze & save secondary.
- Reduce empty/result detail shown by default.

## Stage 5: Recommendations

- Keep a single featured next action.
- Simplify filter controls.
- Make every card show one primary action with direct label.
- Preserve context-aware URLs.

## Stage 6: Ad Briefs

- Make product selection and generation the first obvious step.
- Keep recent briefs as a compact history.
- Group generated output into concise sections.
- Keep copy controls.

## Stage 7: Revenue Blueprint

- Reduce summary metrics and status badges.
- Put top priorities and 7-day checklist first.
- Move positioning/creative plan/saved history into details.
- Keep generate, toggle, and calendar export actions.

## Stage 8: Settings

- Merge related status sections.
- Keep destructive/privacy actions accessible but visually separated.
- Reduce logout prominence.
- Keep support and integration controls.
