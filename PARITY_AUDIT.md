# BluePrintAI to Shopify Parity Audit

Audit date: 2026-06-17

Source application: `/Users/mohammedabb07650/Documents/BluePrintAI`

Target application: `/Users/mohammedabb07650/Documents/blue-print-ai`

## Executive Summary

The Shopify target is no longer a starter app. It already contains a custom embedded React Router shell, Shopify-authenticated loaders/actions, shop-scoped Prisma persistence, BluePrintAI visual styling, and route coverage for the main source workflows. The remaining parity gap is concentrated in source features that depend on TikTok-specific services, source-side local browser state, creator CRUD, and richer route-specific state handling.

Current audited score before this pass:

| Category | Score | Notes |
| --- | ---: | --- |
| Visual parity | 82/100 | Dark SaaS shell, cards, headers, filters, dashboard, creative board, and revenue blueprint are close. Some source-specific Tailwind/lucide proportions and modal density are not fully reproduced. |
| Feature parity | 78/100 | Core workflows exist: dashboard, creative library, upload/analysis, briefs, recommendations, revenue blueprint, creators, data import, settings, activity, search. Gaps remain in creator CRUD, TikTok OAuth equivalents, and exact source data services. |
| Interaction parity | 80/100 | Major buttons and forms work through Shopify actions. Remaining gaps: creator save/edit/delete equivalence, some modal keyboard affordances, and persisted list filter URL state. |
| Responsive parity | 76/100 | Source and target both use collapsible sidebar/topbar and responsive grids. Target has CSS breakpoints for 1280/1024/720 but needs verified screenshot iteration at every requested width. |
| Overall parity | 79/100 | Good structural parity, not yet 95 because the audit is not fully screenshot-verified and creator/source platform features remain partial. |

## Repository Structure Comparison

| Area | Source | Target | Parity | Required work |
| --- | --- | --- | ---: | --- |
| Frontend shell | `BLUEPRINTAIFRONTEND/src/App.jsx`, `components/AppLayout.jsx`, `AppSidebar.jsx`, `AppTopbar.jsx` | `app/routes/app.jsx`, `app/styles/blueprint.css`, `app/components/blueprint-ui.jsx` | 86 | Keep Shopify `AppProvider` and auth loader; tune target tokens to source dark shell. |
| Frontend routes | Vite React Router DOM routes in `src/App.jsx` | React Router file routes under `app/routes/app.*.jsx` | 90 | Source routes are all represented except public marketing/legal/support pages inside Shopify embedded app. |
| Component system | Tailwind/shadcn/lucide plus `components/blueprint/*` | Custom `bp-*` component helpers and CSS | 78 | Centralize tokens and add missing reusable controls for creator/request interactions. |
| Backend/API | FastAPI routes in `BLUEPRINTAIBACKEND/routes` and `api/routes` | Shopify loaders/actions, Admin GraphQL, Prisma models | 76 | Preserve Shopify auth; map TikTok endpoints to Shopify/catalog/workspace equivalents. |
| Database | SQLAlchemy models for shops, products, orders, creators, briefs, creatives, recommendations, blueprints, activity | Prisma `Session`, `SavedBrief`, `VideoAnalysis`, `SavedCreative`, `RevenueBlueprint`, `WorkspaceRequest`, `WorkspaceSetting` | 75 | Creator entities are generated rather than persisted; add workspace request persistence for outreach actions. |
| Assets | `src/assets/images/*`, `public/demo-thumbnails/*` | `public/blueprint-assets/*` | 88 | Source hero/thumb assets copied into target public assets. |

## Route Parity Matrix

| Route / Component | Source equivalent | Target equivalent | Current parity | Missing UI elements | Missing behavior | Missing data integration | Responsive differences | Required implementation work | Files to change |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Embedded shell | `components/AppLayout.jsx`, `AppSidebar.jsx`, `AppTopbar.jsx` | `app/routes/app.jsx` | 86 | Lucide icon exactness, source footer links in embedded nav | Source logout/local auth differs; target topbar notifications are stronger | Target uses Shopify session and workspace activity | Target sidebar collapses at 1024; source at `lg` 1024 with 248px rail | Preserve Shopify shell; refine token consistency and notification/search behavior | `app/routes/app.jsx`, `app/styles/blueprint.css` |
| Dashboard / Command Center | `pages/Index.jsx`, `pages/Dashboard.jsx`, dashboard components | `app/routes/app._index.jsx` | 84 | Source performance chart/leaderboard density not fully copied | Date range selector absent in target | Target uses Shopify products/orders with demo fallback | Target grid stacks well but chart-specific mobile not applicable | Add richer dashboard analytics only if data exists; keep current Shopify-backed metrics | `app/routes/app._index.jsx` |
| Creative Library | `pages/CreativeLibrary.jsx`, `components/creatives/*` | `app/routes/app.creative-library.jsx` | 90 | Exact source media card proportions and shadcn controls differ | URL state for filters not persisted | Saved analyses and generated concepts integrated | Source has Tailwind responsive columns; target custom board has breakpoints | Add URL state later; current controls are functional | `app/routes/app.creative-library.jsx` |
| Upload / AI Review Studio | `pages/VideoAnalysis.jsx`, `pages/UploadPage.jsx`, `components/ai/*` | `app/routes/app.video-analysis.jsx`, `app/services/media-analyzer.server.js` | 88 | Source has deeper analysis charts/sections | Target cannot run TikTok backend video APIs; uses local analyzer/fallback | Saved analyses persisted per Shopify shop; media stored only under size limit | Target has custom two-column and mobile stack | Maintain upload validation and media analyzer; document platform constraint | `app/routes/app.video-analysis.jsx`, `app/services/media-analyzer.server.js` |
| Ad Briefs | `pages/AdBriefs.jsx`, `components/briefs/*` | `app/routes/app.ad-briefs.jsx` | 91 | Minor source form styling differences | Copy buttons and generate action work | Saved briefs persisted per shop | Brief layout stacks through CSS | Keep auto-generation from recommendation/creative context | `app/routes/app.ad-briefs.jsx` |
| Recommendations | `pages/Recommendations.jsx`, recommendation components | `app/routes/app.recommendations.jsx` | 86 | Source cards/tabs are similar but not exact | Filtering tabs work; no URL persistence | Recommendations built from Shopify catalog/order context | Target card grid responsive; needs screenshot verification | Consider URL tab state; keep working action routes | `app/routes/app.recommendations.jsx` |
| Revenue Blueprint | `pages/RevenueBlueprint.jsx`, `styles/revenue-blueprint.css` | `app/routes/app.revenue-blueprint.jsx` | 90 | Exact source timeline styling differs | Generate, export calendar, and checkbox completion work | Blueprints and completion persisted per shop | Dedicated CSS breakpoints present | Keep Shopify order-scope warnings; no TikTok data copied | `app/routes/app.revenue-blueprint.jsx` |
| Creators | `pages/Creators.jsx`, `CreatorCard.jsx`, `CreatorForm.jsx`, `CreatorDetail.jsx` | `app/routes/app.creators.jsx`, `app/routes/app.creators.$creatorId.jsx` | 70 | Source add/edit/delete form, persistent creator records | Target creator cards are generated and only link to brief/profile | Target derives creators from products/saved creatives | Grid responsive but no source modal/form parity | Add working Shopify-safe creator outreach persistence and request state | `app/routes/app.creators.jsx`, `app/routes/app.creators.$creatorId.jsx`, `app/models/blueprint.server.js` |
| Data Import | `pages/DataImport.jsx`, backend `routes/data_import.py` | `app/routes/app.data-import.jsx` | 82 | Source import controls/status detail richer | Target opens connected workflows; no manual file import | Shopify catalog/orders/workspace requests only | Simple list stacks well | Document TikTok import exception; add optional import request later | `app/routes/app.data-import.jsx` |
| Settings | `pages/Settings.jsx`, `SettingsPage.jsx` | `app/routes/app.settings.jsx` | 88 | Source shop switch/demo modal differs | Export, delete, logout, TikTok metadata disconnect, support all work | Shopify billing/auth/scopes preserved | Cards responsive via grid | Preserve Shopify billing/OAuth; do not copy TikTok credentials | `app/routes/app.settings.jsx` |
| Activity Log | `pages/ActivityLog.jsx`, `services/activityLog.js` | `app/routes/app.activity-log.jsx` | 82 | Source filter chips/clear control absent | Target timeline links work | Events composed from persisted shop records | Simple timeline stacks | Add filter chips if required | `app/routes/app.activity-log.jsx` |
| Search | Source topbar search and page-level filters | `app/routes/app.search.jsx`, topbar form | 88 | Source topbar input visual exactness differs | Search submits to URL and results link to actions | Searches products, creatives, briefs, recs, creators | Results stack well | Keep current route; optionally persist input value in topbar | `app/routes/app.jsx`, `app/routes/app.search.jsx` |
| Login / onboarding | `pages/Login.jsx`, `pages/Onboarding.jsx` | Shopify `_index`, `auth.login`, `auth.$` routes | 72 | Source public screens are not copied | Shopify OAuth replaces source login/onboarding | Shopify session/auth required | Shopify auth screens follow template | Preserve Shopify auth; visible parity intentionally limited | `app/routes/_index/route.jsx`, `app/routes/auth.*` |
| Webhooks/privacy | FastAPI webhooks and legal pages | Shopify webhook routes and settings privacy controls | 84 | Public privacy/terms/support pages absent in embedded route tree | Shopify webhook actions exist | Shopify privacy routes use app auth/session | Not visual-heavy | Keep Shopify compliance implementation | `app/routes/webhooks.*.jsx` |

## Feature Inventory

| Feature | Source behavior | Target behavior | Status |
| --- | --- | --- | --- |
| Search | Client filters plus API-backed pages | Topbar GET search across products/creatives/briefs/recommendations/creators | Complete |
| Filtering/sorting | Creative filters, recommendation tabs, activity filters | Creative search/angle/source/score/sort; recommendation tabs | Mostly complete; activity filters absent |
| Pagination | Source UI components include pagination but major pages mostly load finite lists | Target loads capped lists | Partial, acceptable for current data volumes |
| File/video upload | FastAPI video analyzer | React Router multipart action, validation, local analyzer bridge/fallback, saved media under size limit | Complete with platform constraint |
| Creative analysis | Backend analyzer + AI components | Deterministic + media analyzer bridge, saved per shop | Mostly complete |
| Brief generation | API-driven briefs | Server-generated, saved briefs, copy blocks, recommendation/creative context | Complete |
| Revenue blueprint | Blueprint API + UI | Server-generated, saved versions, calendar export, checkbox completion persistence | Complete |
| Creator listings/detail | CRUD-like creator API/UI | Generated creator matches from products/creatives | Partial; outreach/request persistence needed |
| Notifications | Source toast/activity patterns | Target notification panel from persisted records | Mostly complete |
| Settings | Shop/TikTok/demo/auth controls | Shopify store/scopes/billing/export/delete/TikTok metadata/support | Complete with platform adaptation |
| Data imports | TikTok/demo import endpoints | Shopify product/order/workspace import status | Complete with platform adaptation |
| URL query state | Source routes use params in several places | Brief/search/creative detail/blueprint params work; filters not persisted | Partial |
| Persistent selections | Source localStorage selected shop | Shopify session shop plus workspace settings | Complete for Shopify context |
| Validation | Source frontend/backend validation | Upload/delete/action validation in server actions | Mostly complete |

## Shopify-Specific Constraints

- Shopify OAuth, session storage, billing, webhooks, and embedded `AppProvider` must remain the target authority. Source login/onboarding cannot be copied directly.
- TikTok Shop OAuth, seller credentials, Partner Center APIs, and TikTok webhook behavior cannot be copied into the Shopify app. Visible integration status can be represented through Shopify-safe workspace metadata only.
- Shopify Admin GraphQL is the source for live products/orders. Demo fallback is allowed only when live data is unavailable so the embedded app remains usable in review/development.
- Full video frame/audio analysis is constrained by the Shopify app runtime and local server environment; target uses a local analyzer bridge when available and deterministic metadata analysis otherwise.

## Implementation Priorities

1. Add persisted creator outreach/request interactions to close the largest feature gap without introducing non-Shopify creator credentials.
2. Add focused smoke tests for pure server builders and Shopify-safe behavior.
3. Run build/type checks and fix regressions.
4. Capture target/source screenshots where local auth/runtime permits; document any blocked screenshot states.
5. Repeat final audit and record exact remaining exceptions in `FINAL_PARITY_REPORT.md`.
