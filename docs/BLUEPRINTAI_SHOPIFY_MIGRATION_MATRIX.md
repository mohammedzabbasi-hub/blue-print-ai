# BluePrintAI to Shopify Migration Matrix

Resolved source: `/Users/mohammedabb07650/Documents/BluePrintAI`

Resolved target: `/Users/mohammedabb07650/Documents/blue-print-ai`

Baseline checkpoint: `992033c Initial Shopify app checkpoint`

| Source area | Source route | Shopify target route | Target status | Adaptation |
| --- | --- | --- | --- | --- |
| Login / app entry | `/`, `/login` | `/`, `/auth/login` | Preserved | Shopify OAuth and server sessions remain the auth source. TikTok and local-token auth were not copied. |
| Onboarding | `/onboarding` | Shopify install/auth flow plus `/app/settings` | Partial | Shopify onboarding is platform-driven. Workspace setup and status are surfaced in Settings. |
| Dashboard | `/dashboard` | `/app` | Migrated before this pass, shell labels updated | Uses Shopify products plus saved app records; order reads are not requested in the current scope set. |
| Creative Library | `/creative-library` | `/app/creative-library` | Migrated before this pass | Saved analyses and Shopify product concepts feed cards/details. |
| Creative Upload / AI Review Studio | `/upload` | `/app/video-analysis` | Migrated before this pass, nav restored | Upload validation, analyzer bridge, save-to-library flow retained. |
| Creative Detail | `/creatives/:id` | `/app/creative-library?creativeId=...` | Adapted | Detail panel lives inside the Shopify route rather than a separate nested route. |
| Video Analysis | `/upload` | `/app/video-analysis` | Migrated before this pass | Shopify-safe file metadata/media analyzer flow replaces TikTok metrics. |
| Recommendations | `/recommendations` | `/app/recommendations` | Migrated before this pass | Recommendation actions carry product and recommendation context into briefs/blueprints. |
| Ad Briefs | `/ad-briefs` | `/app/ad-briefs` | Migrated before this pass | Generated and saved per authenticated Shopify shop. |
| Revenue Blueprint | `/revenue-blueprint` | `/app/revenue-blueprint` | Migrated before this pass | Blueprint records are shop-scoped in Prisma. |
| Creators | `/creators` | `/app/creators` | Added | Creator matches are normalized from Shopify products and saved creatives. |
| Creator Detail | `/creators/:creatorId` | `/app/creators/:creatorId` | Added | Detail, fit score, notes, associated creatives, and brief action added. |
| Data Import | `/data-import` | `/app/data-import` | Added | Shopify catalog/order/workspace import status replaces TikTok seller data import. |
| Settings | `/settings` | `/app/settings` | Migrated before this pass | Shopify connection, billing, scopes, privacy, and safe TikTok metadata disconnect remain. |
| Notifications | topbar | topbar notification panel | Migrated before this pass | Uses recent shop-scoped briefs, creatives, analyses, blueprints, requests, and integration status. |
| Search | topbar | `/app/search?q=...` | Extended | Now searches products, saved creatives, briefs, recommendations, and creators. |
| Activity Log | `/activity-log` | `/app/activity-log` | Added | Built from shop-scoped app records and workspace requests. |
| Support / privacy / terms | `/support`, `/privacy`, `/terms` | Settings and Shopify app legal surfaces | Partial | Source public pages were not copied into authenticated app navigation; Shopify legal/app-store surfaces remain separate. |
