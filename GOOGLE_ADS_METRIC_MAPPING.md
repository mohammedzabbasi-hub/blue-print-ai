# Google Ads Metric Mapping

Google Ads API v24 is valid on 2026-07-05. The app uses REST `googleAds:searchStream`, normalizes dashed IDs, sends the optional manager ID as `login-customer-id`, and places the selected child ID in `/customers/{customerId}/...`.

| UI statistic | Google resource / field | Current path/query and conversion | Support | Empty behavior / needed fix |
|---|---|---|---|---|
| Campaign ID/name/status | `campaign.id`, `.name`, `.status` | Campaign/ad queries; strings/enums | PARTIAL | Rows absent on empty account. Status is payload-only and not broadly displayed. |
| Ad-group ID/name | `ad_group.id`, `.name` | Ad query includes parent; separate function exists | PARTIAL | Sync does not invoke the ad-group-level function. |
| Ad ID/name | `ad_group_ad.ad.id`, `.name` | Ad query; strings | PARTIAL | Identifiers sync; creative assets/headlines/media do not. |
| Date | `segments.date` | `YYYY-MM-DD`; persisted at UTC midnight | YES | No rows when inactive. Customer-timezone range boundary remains a risk. |
| Impressions | `metrics.impressions` | `Number(value)` | YES | 0/absent becomes 0. |
| Clicks | `metrics.clicks` | `Number(value)` | YES | 0/absent becomes 0. |
| Cost / spend | `metrics.cost_micros` | `cost_micros / 1,000,000` | YES | 0 safe. Currency is not queried. |
| CTR | `metrics.ctr` or clicks/impressions | Decimal ratio in service; payload adapter multiplies by 100 for UI | YES | 0 denominator → 0. |
| CPC | `metrics.average_cpc` or cost/clicks | micros / 1,000,000; fallback cost/clicks | YES | 0 clicks → 0. |
| CPM | derivable from cost/impressions | `(cost / impressions) * 1000` | YES | 0 impressions → 0. Not directly selected. |
| Conversions | `metrics.conversions` | numeric, may be fractional by Google attribution | YES | 0 safe. |
| Conversion rate / CVR | derivable from conversions/clicks | service ratio; UI adapter multiplies by 100 | YES | 0 clicks → 0. |
| Conversion value | `metrics.conversions_value` | numeric account-currency value | YES | Persisted as daily `revenue` and payload `conversionValue`; naming must remain “attributed/conversion value.” |
| Revenue | No distinct Google booked-revenue field | aliases conversion value | PARTIAL | Must not imply Shopify/net revenue; dashboard currently says attributed revenue. |
| ROAS | derivable from conversion value/cost | `conversionValue / cost` | YES | 0 cost → 0. |
| CPA / cost per order | derivable from cost/conversions | `cost / conversions` | YES | 0 conversions → 0. UI calls it cost per order/acquisition. |
| Currency | `customer.currency_code` | not queried | NO | Add customer query/field and persist code; current UI often assumes USD. |
| Reach | No generally equivalent core search metric in current query | none | NO | Leave unavailable; do not infer from impressions. |
| Video views/watch metrics | Video-specific metrics exist for eligible inventory | not queried | NO | Would require explicit fields, semantics and campaign compatibility handling. |
| Engagement/likes/comments/shares/saves | Not equivalent to app’s imported social fields | none | NO | CSV/analyzer/platform-specific only. |
| Shopify orders/store revenue | Shopify Orders source, not Google Ads | none | NOT GOOGLE ADS-SOURCED | Requires Shopify order ingestion and attribution design. |
| Hook/CTA/clarity/readiness/retention scores | Analyzer output | none | NOT GOOGLE ADS-SOURCED | Continue explicit analyzer/estimated labels. |
| Creator/recommendation/workflow/growth metrics | App/CSV/AI derivation | none | NOT GOOGLE ADS-SOURCED | Continue directional/source labels. |

## Query coverage

The shared selected metrics are `segments.date`, impressions, clicks, cost micros, conversions, conversion value, CTR, and average CPC. Campaign and ad functions are called by sync. Ad-group service support exists but is not called. Search-stream parsing correctly flattens both the array response and each batch’s `results`.

The selected child account is `connection.externalAccountId`; it is normalized and used in the request path. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is separately normalized and only sent as manager/login context. The known values therefore resolve to child `3049637762` and login manager `1162462141` when configured accordingly.
