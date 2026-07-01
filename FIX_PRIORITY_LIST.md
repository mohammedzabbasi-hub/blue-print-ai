# BluePrintAI Fix Priority List

Updated: July 1, 2026

## First five fixes

1. **Finalize legal, privacy, and support identity (AUD-02/AUD-08).** Replace every owner-action marker, centralize one verified support address, and align public pages, embedded pages, Settings, and the Shopify listing. This is a hard submission blocker and requires owner/legal input.

2. **Make production configuration and migrations deployable (AUD-01/AUD-03).** Establish the real HTTPS origin. Commit an immutable PostgreSQL baseline and forward-migration workflow instead of regenerating one migration on startup. Prove a fresh deploy and an upgrade deploy.

3. **Remove misleading decision/forecast formulas (AUD-04–AUD-07).** Replace “Readiness,” imported creative readiness rankings, creator “Scale/Coach or pause,” and automatic 35% revenue upside with real metric views, workflow-completion labels, or explicit user-controlled scenarios. Add visible methodology and data-completeness labels wherever a heuristic remains.

4. **Make the primary review paths production-operational (AUD-10/AUD-11/AUD-14).** Configure PostgreSQL, private object storage, and—if advertised—the analyzer. Stream large uploads or reduce limits to a load-tested safe value. Verify upload/playback/deletion and analyzer success/error against deployed services.

5. **Complete a clean Shopify review journey (AUD-09/AUD-11/AUD-17/AUD-18).** Add product pagination, then test install/auth, onboarding, CSV/video import, all saves/deletes, webhooks, narrow layouts, keyboard behavior, and uninstall/reinstall in a clean development store.

## Ordered remediation backlog

| Priority | IDs | Work | Completion evidence |
| --- | --- | --- | --- |
| P0 | AUD-02, AUD-08 | Final legal/support content and one staffed contact. | No scaffold markers; owner-approved pages; contact test received and answered. |
| P0 | AUD-01 | Real production origin and Shopify configuration. | Clean install and callback succeed at the published HTTPS URL. |
| P0 | AUD-03 | Immutable PostgreSQL migration strategy. | Fresh database and upgrade from deployed baseline both pass without drift/checksum changes. |
| P0 | AUD-04–07 | Truthful scores, rankings, decisions, and financial estimates. | Product review finds no unsupported percentage, scale instruction, or dollar forecast. |
| P0 | AUD-10, AUD-11 | Operational production services and exact-commit end-to-end proof. | Reviewer script passes with logs/screenshots for auth, storage, analyzer decision, and webhooks. |
| P1 | AUD-09 | Paginate Shopify products or narrow the “entire store” claim. | Store with 26+ products exposes expected product context. |
| P1 | AUD-12 | Currency provenance and formatting. | Non-USD and mixed-currency tests pass without false aggregation. |
| P1 | AUD-13 | Server-disable unfinished OAuth/sync routes. | Direct URL tests return controlled unavailable responses; no provider redirect occurs. |
| P1 | AUD-14 | Stream or safely constrain uploads. | Concurrent upload load test passes within memory limits. |
| P1 | AUD-15 | Installed-app deletion workflow and operational procedure. | Confirmed deletion removes DB records, tokens, and media and produces a receipt/log. |
| P1 | AUD-17, AUD-18 | Browser E2E, responsive, and accessibility coverage. | CI E2E plus manual Shopify iframe matrix passes. |
| P2 | AUD-16 | Replace roadmap/MVP-heavy primary copy with current capability copy. | Listing and landing page describe only shipped behavior. |
| P2 | AUD-19 | React Router future-flag/upgrade cleanup. | CI warning baseline is documented or eliminated. |

## Safe automatic fix completed

- AUD-20: public landing copy now says “CSV performance data” instead of claiming unsupported JSON import.

No risky architecture, schema, billing, authentication, OAuth, or visual redesign changes were made during this audit.
