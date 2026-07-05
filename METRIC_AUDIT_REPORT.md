# BluePrintAI Metric Audit

Audit date: 2026-07-05. Scope: all application routes, components, services, models, Prisma schemas, fixtures, seeds, CSV import code, and tests. Google Ads account IDs were not contacted; verification used code inspection and mocks only.

## Executive answer

No. BluePrintAI can retrieve a useful Google Ads core, but it cannot retrieve every statistic displayed in the app from Google Ads. Google sync supports dated campaign/ad identity plus impressions, clicks, cost/spend, conversions, conversion value/revenue, CTR and average CPC. CPM, CVR, CPA and ROAS are safely derived. Reach, engagement, video-retention, creator, Shopify order, AI review, planning, and workflow metrics are not Google Ads-sourced. Ad-group retrieval exists in the service but the sync does not call it. Currency is not queried, and ad creative assets are not queried.

## Displayed-statistic inventory

| UI statistic/family | Principal UI files | Meaning/source | Classification and labeling | Google Ads status |
|---|---|---|---|---|
| Impressions, clicks, spend/cost, conversions, conversion value/attributed revenue | `app.components/dashboard/PerformanceChart.jsx`, `app.routes/app.creative-library.jsx`, campaign/creator pages | Google sync, merchant CSV, manual records, or demo fixtures depending on row | Source notices distinguish demo/imported/measured; revenue means conversion value for Google Ads, not Shopify booked revenue | YES |
| CTR, CPC, CPM, CVR, ROAS, cost/order (CPA) | dashboard effectiveness cards; creative library; campaign pages | Derived from summed outcomes; explicit CSV values are accepted on records | Dashboard derives weighted ratios and protects zero denominators. Creative Library displays imported values. | YES when inputs exist; PARTIAL in current persistence/UI flow |
| Campaign ID/name/status | campaign routes, dashboard campaign selector, creative library | Workspace campaign model, CSV, or Google Ads campaign | Names/IDs sync. Google status is retained in sync payload after this audit but is not yet a prominent Google-specific UI field. | PARTIAL |
| Ad-group ID/name | creative library and performance records | CSV or Google Ads `ad_group` | Service query exists, but production sync does not call it. Ad rows do contain their parent ad-group identity. | PARTIAL |
| Ad ID/name | creative library and dashboard grouping | CSV/manual or Google Ads ad resource | Synced from `ad_group_ad.ad`; name can legitimately be blank for ad types without a name. Assets/text are not synced. | PARTIAL |
| Daily/date performance and sync row count/status | dashboard trends, Connections | reporting date; DB row writes; connection status | Real when platform/CSV rows exist. Zero-row sync is success and now covered by a mock test. | YES |
| Reach | dashboard, CSV/creative views | CSV/manual/platform-specific | Google Ads core query does not provide it; absent rather than fabricated | NO |
| Views, video views/completions, watch percentages/time, retention/hook/hold rate | dashboard, creative library, video analysis | CSV, analyzer output, or fixture | Video Analysis explicitly says analyzer/estimated and not live platform performance | NO / NOT GOOGLE ADS-SOURCED |
| Likes, comments, shares, saves, engagements/rate | dashboard, creative/creator views | public engagement CSV/manual/import | Labeled as imported; not produced by Google sync | NOT GOOGLE ADS-SOURCED |
| Orders and Shopify/store revenue | dashboard, creative/creator/product pages | CSV attribution or demo; Shopify order connector is explicitly future/optional | Dashboard says figures are not total Shopify revenue/orders | NOT GOOGLE ADS-SOURCED |
| Revenue estimates, projected revenue, growth/impact/optimization | Revenue Blueprint and advisor/recommendation routes | saved planning records and deterministic/AI guidance using available context | Directional/planning language is used; not measured Google Ads output | NOT GOOGLE ADS-SOURCED |
| Hook, CTA, clarity, overall/readiness and retention-health scores | Video Analysis, Creative Library | configured analyzer response; heuristic/model labels propagated | Missing values remain unavailable; estimated/modelled results are labeled | NOT GOOGLE ADS-SOURCED |
| Creator score, conversion rate, attributed sales, views/clicks | creator routes | creator CSV attribution plus derived directional score | “Directional heuristic signal” and optional/imported wording are present | NOT GOOGLE ADS-SOURCED |
| Recommendation/advisor score and recommendations | Recommendations/advisor model | AI/deterministic analysis of workspace context | Guidance, not ad-platform measurement | NOT GOOGLE ADS-SOURCED |
| Saved creatives, analyses, briefs, blueprints, campaigns | dashboard cards/settings | Prisma record counts | Correctly presented as workspace activity | NOT GOOGLE ADS-SOURCED |
| Estimated workflow progress | dashboard `StatCards.jsx` | completion indicator from saved activity/analysis | Explicitly labeled estimated and “not measured ad performance” | NOT GOOGLE ADS-SOURCED |
| Product price/catalog counts | product evidence, briefs, blueprints | Shopify Admin product data or CSV context | Source evidence identifies Shopify versus CSV | NOT GOOGLE ADS-SOURCED |
| Demo creative performance | `app/data/demo-creatives.js`, `app/data/demo-brand.js`, demo CSV/seeds | fixture/demo | Demo records carry `shopify_demo` and UI demo notices/badges | NOT GOOGLE ADS-SOURCED |

## Data-source trace

- Google Ads: OAuth refresh, selected-customer `searchStream`, `AdPerformanceDaily`, then `listCreativePerformance().dailyRecords`.
- Shopify: catalog/product/shop context only in the audited performance flow; order/revenue ingestion is not active.
- CSV/manual: `creative-performance.server.js` parses performance and creator columns into `CreativePerformance`; source/import badges are propagated.
- Prisma: saved creatives, analyses, briefs, blueprints, campaigns, connections, daily ad rows, creator attribution.
- Demo/static: `app/data/demo-creatives.js`, `app/data/demo-brand.js`, `demo-data/`, and seeds. Demo performance is opt-in/fallback and labeled.
- AI/analyzer: Video Analysis scores, transcript, retention and recommendations. The UI distinguishes analyzer output from estimated/modelled output.
- Derived: dashboard CTR/CVR/CPC/CPM/CPA/ROAS and directional workflow/creator scores.

## Accuracy findings

1. Fixed: raw Google Ads API response bodies were written to logs on failures.
2. Fixed: campaign and ad rows could be added together, double counting account outcomes. Totals now use ad rows at the finest available grain and campaign rows only where no ad rows exist for that campaign/date.
3. Fixed: Google CPM/CVR/CPA were not normalized; derived fields are now generated with zero protection and stored in safe payload metadata.
4. Remaining: Google daily rows drive the legacy `adPerformance` data but are not included in `effectivenessRecords`, so the main effectiveness card grid can remain empty for Google-only workspaces.
5. Remaining: currency code is not queried and dashboard currency formatting assumes USD.
6. Remaining: ad-group query is implemented but not invoked by sync.
7. Remaining: campaign status and derived payload fields are persisted in JSON rather than typed Prisma columns.
8. Remaining: the 30-day range uses server UTC timestamps; Google reporting dates use the customer timezone. Boundary-day selection can differ from the account timezone.
9. Correct: empty inputs and zero denominators return zero/null rather than NaN/Infinity; zero-row platform sync updates `lastSyncedAt` and reports success.

## Page/backend comparison

- Connections: backend supplies configuration, account, status, last sync/error, and sync count. Account performance is not previewed here.
- Dashboard: saved-workflow cards are backed by Prisma counts. Performance chart supports imported creative records; Google daily rows feed `adPerformance`, but the current rendered effectiveness component receives `effectivenessRecords`, creating the remaining Google-only visibility gap.
- Creative Library: Prisma creative/manual/CSV records are shown; Google daily rows are not merged into the library `records` collection.
- Campaigns: workspace campaign metrics are aggregated from assigned creative records, not directly from Google campaign rows.
- Creators: creator metrics are creator-import/attribution data and directional derivations, not Google account statistics.
- Video Analysis / AI Review Studio: analyzer output only; unavailable values remain unavailable and estimates are labeled.
- Recommendations, Ad Briefs, Revenue Blueprint: generated/saved workflow outputs use available Shopify/import/performance context; they are not direct Google reports.
- Data Import: CSV columns are mapped and tested; omitted columns remain unavailable.

## Safety/read-only conclusion

The Google integration only lists accessible customers, calls `googleAds:searchStream`, refreshes/revokes OAuth tokens, and writes local Prisma rows. No Google Ads mutate service or campaign/ad/budget creation call was found. Revocation affects OAuth authorization only. Google Ads remains read-only.
