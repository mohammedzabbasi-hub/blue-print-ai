# TTSA To Shopify Route Map

This map uses the TTSA BluePrintAI frontend at `/Users/mohammedabb07650/Documents/BluePrintAI/BLUEPRINTAIFRONTEND` as the visual source of truth and maps it to the Shopify implementation at `/Users/mohammedabb07650/Documents/blue-print-ai`.

| TTSA route / page | TTSA source files | Shopify route | Shopify target files | Notes |
| --- | --- | --- | --- | --- |
| Dashboard / home | `src/pages/Dashboard.jsx`, `src/components/dashboard/*` | `/app` | `app/routes/app._index.jsx` | Priority for this pass. Adapts TikTok wording to Shopify while preserving TTSA command-center structure. |
| Creative library | `src/pages/CreativeLibrary.jsx`, `src/creative-library.css`, `src/components/creatives/*` | `/app/creative-library` | `app/routes/app.creative-library.jsx` | Not rebuilt in this pass except shared shell/CSS effects. |
| Upload / video analysis | `src/pages/VideoAnalysis.jsx`, `src/video-analysis.css`, `src/components/ai/*` | `/app/video-analysis` | `app/routes/app.video-analysis.jsx` | TTSA route is `/upload`; Shopify route remains platform-safe `/app/video-analysis`. |
| Recommendations | `src/pages/Recommendations.jsx`, `src/pages/Recommendations.css`, `src/components/recommendations/*` | `/app/recommendations` | `app/routes/app.recommendations.jsx` | Shared shell parity only in this pass. |
| Ad briefs | `src/pages/AdBriefs.jsx`, `src/ad-briefs.css`, `src/components/briefs/*` | `/app/ad-briefs` | `app/routes/app.ad-briefs.jsx` | Shared shell parity only in this pass. |
| Revenue blueprint | `src/pages/RevenueBlueprint.jsx`, `src/styles/revenue-blueprint.css` | `/app/revenue-blueprint` | `app/routes/app.revenue-blueprint.jsx` | Shared shell parity only in this pass. |
| Creators | `src/pages/Creators.jsx`, `src/components/CreatorCard.jsx`, `src/components/CreatorStats.jsx` | `/app/creators` | `app/routes/app.creators.jsx` | Shared shell parity only in this pass. |
| Creator detail | `src/pages/CreatorDetail.jsx` | `/app/creators/:creatorId` | `app/routes/app.creators.$creatorId.jsx` | Dynamic route retained. |
| Data import | `src/pages/DataImport.jsx` | `/app/data-import` | `app/routes/app.data-import.jsx` | Shopify data import wording should replace TikTok-only copy in a later pass. |
| Settings | `src/pages/Settings.jsx`, `src/pages/SettingsPage.jsx` | `/app/settings` | `app/routes/app.settings.jsx` | Shared shell parity only in this pass. |
| Search | `src/components/AppTopbar.jsx` search affordance | `/app/search` | `app/routes/app.search.jsx` | Shopify keeps a real GET search route. |
| Activity log | `src/pages/ActivityLog.jsx`, `src/services/activityLog.js` | `/app/activity-log` | `app/routes/app.activity-log.jsx` | Not shown in TTSA sidebar screenshots, but route exists in both ecosystems. |

## TTSA Shell Source

- App shell: `src/components/AppLayout.jsx`
- Sidebar: `src/components/AppSidebar.jsx`
- Topbar: `src/components/AppTopbar.jsx`
- Routes: `src/routes.jsx`
- Global tokens/styles: `src/index.css`, `src/styles/global.css`, `src/styles/dashboard.css`

## Shopify Shell Target

- Embedded app wrapper and loader: `app/routes/app.jsx`
- Shared components: `app/components/blueprint-ui.jsx`
- Shared styles: `app/styles/blueprint.css`
- Dashboard route: `app/routes/app._index.jsx`
