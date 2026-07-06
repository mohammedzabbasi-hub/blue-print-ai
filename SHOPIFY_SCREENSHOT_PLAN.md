# BluePrintAI Shopify Screenshot Plan

Capture from the exact submitted production version at 1440×900 or another consistent desktop viewport. Use a prepared test store containing safe synthetic data. Do not expose secrets, personal data, OAuth codes, full Google Ads IDs, or browser extensions. App Store listing images should be clean product-focused compositions; reviewer evidence should preserve Shopify Admin chrome, route context, notices, and provenance labels where useful.

| # | Page / route | What must be visible | Label or claim to verify | Use |
| --- | --- | --- | --- | --- |
| 1 | App home / Command Center — `/app` or `/app/dashboard` | Embedded Shopify Admin context, navigation, primary summary/actions, representative safe records | Values are clearly sourced; any workflow progress is estimated/directional, not guaranteed performance | App Store listing + reviewer evidence |
| 2 | Onboarding / empty state — `/app/onboarding` and clean `/app` | Zero-product/no-performance state, continue/skip/manual-context affordance, Terms and Privacy links | Empty state does not invent totals; app remains useful with no data | Reviewer evidence; optional listing |
| 3 | Creative Library — `/app/creative-library` | Creative cards/table, source/provenance badges, one safe thumbnail or video record, import/upload entry point | Imported/manual/synced origin is visible; no fabricated metrics for manual uploads | App Store listing + reviewer evidence |
| 4 | AI Review Studio / Video Analysis — `/app/video-analysis` | Upload area, supported formats, saved review or safe analyzer state | Analysis availability is truthful; generated/heuristic/estimated output is distinguished from measured evidence; unavailable fields remain unavailable | App Store listing + reviewer evidence |
| 5 | Recommendations / AI Advisor — `/app/recommendations` | Recommendation cards, evidence/gaps, working action links | Advice is advisory/directional and grounded in visible imported/demo/synced context | App Store listing + reviewer evidence |
| 6 | Ad Briefs — `/app/ad-briefs` | Product/context selector and a representative generated/saved brief | Brief is a planning output; context source is visible and claims are not guaranteed results | App Store listing + reviewer evidence |
| 7 | Revenue Blueprint — `/app/revenue-blueprint` | Context/evidence, blueprint output, empty or saved state as applicable | Estimates/forecast limitations are explicit; no unsupported revenue uplift appears | App Store listing + reviewer evidence |
| 8 | Connections — `/app/connections` | Full Google Ads card plus CSV fallback copy; ideally connected state with masked ID and Sync/Disconnect controls | Google Ads is optional; connection is reporting-only/read-only; tokens encrypted server-side; CSV remains available | Reviewer evidence; listing only if the copy is fully visible and polished |
| 9 | Connections zero-row sync — `/app/connections?synced=0` | Successful `0 daily performance rows synced` notice and connected card | Empty account is handled without invented data | Reviewer evidence |
| 10 | Data Import — `/app/data-import` | Import type, CSV picker, preview/validation, and safe result summary (capture preview and completed state if needed) | Merchant-provided/CSV origin, preview-before-confirm, supported columns/files | App Store listing + reviewer evidence |
| 11 | Settings — `/app/settings` | Workspace/analysis settings and Legal & Privacy links; production-only view | Preferences persist; developer reset tools are absent; billing/support statements match production | Reviewer evidence; optional listing |
| 12 | Support — `/support` logged out, plus `/app/support` if useful | Public page, BluePrintAI Commerce and support@blueprintai.app contact details, Privacy and Terms links, address bar/HTTPS | Public without authentication; support path matches listing; no placeholder text | Reviewer evidence |
| 13 | Privacy — `/privacy` logged out | Page title, effective/operator disclosures, Google Ads authorization/data section if visible | Public, current, accurate read-only/optional data processing disclosure; no placeholder text | Reviewer evidence |
| 14 | Terms — `/terms` logged out | Page title, service/pricing terms, navigation | Public and current; app described as free if listing is Free; no placeholder text | Reviewer evidence |

## Capture variants and filenames

- Use `01-dashboard-listing.png`, `01-dashboard-reviewer.png`, etc.
- Capture listing images without debug tools, query-string notices, or Shopify/Google account identifiers.
- Capture reviewer evidence with the relevant success notice, Shopify Admin frame, or logged-out address bar.
- For provenance proof, include at least one screen for each source actually submitted: `Demo/sample`, `Imported/CSV`, `Estimated/directional`, and `Google Ads/connected-platform/synced`.
- Add concise annotations only on duplicate evidence copies; keep original unedited captures.
- Review at 100% zoom for clipped controls, broken images, stale dates, placeholder copy, inconsistent currency, and accidental personal data.

## Screenshot acceptance checklist

- [ ] All 14 planned page states captured or an evidence note explains why a non-listing variant is not applicable.
- [ ] Listing screenshots match Shopify's current asset dimensions and content rules in the Partner Dashboard.
- [ ] Reviewer captures prove embedded install, optional/read-only Google Ads, empty state, provenance labels, public legal/support, and free/no-billing behavior.
- [ ] No image contains secrets, tokens, OAuth codes, full account IDs, customer data, or unrelated browser content.
- [ ] Screenshots match the submitted commit and active Shopify app version.
