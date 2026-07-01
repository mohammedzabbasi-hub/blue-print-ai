# Shopify Production Submission Handoff

> **STATUS: CODE-COMPLETE, BUT NOT READY FOR SHOPIFY REVIEW OR SUBMISSION.**
>
> Confirmed code blockers: **0**. Remaining blockers: **5 infrastructure**, **6 Shopify Partner Dashboard**, **5 legal/owner**, and **2 demo-store/QA**. Manual production setup and owner decisions are still required.

## Placeholder reference

Every angle-bracketed value below must be replaced by the authorized human operator. Do not commit secrets.

| Placeholder | Meaning |
| --- | --- |
| `<YOUR_PRODUCTION_APP_URL>` | Stable public HTTPS origin, without a trailing slash |
| `<YOUR_HOSTING_PROVIDER>` | Selected production hosting platform |
| `<YOUR_HOSTING_PROVIDER_DEPLOY_COMMAND>` | Provider-approved command for deploying the reviewed commit, if the provider uses one |
| `<SHOPIFY_API_KEY>` | Client ID/key for the matching production Shopify app |
| `<SHOPIFY_API_SECRET>` | Secret for the matching production Shopify app |
| `<DATABASE_URL>` | Managed PostgreSQL connection string |
| `<S3_BUCKET>`, `<S3_REGION>`, `<S3_ENDPOINT>` | Private S3-compatible storage settings |
| `<S3_ACCESS_KEY_ID>`, `<S3_SECRET_ACCESS_KEY>` | Storage credentials, unless workload identity is used |
| `<ANALYZER_SERVICE_URL>`, `<ANALYZER_API_KEY>` | HTTPS analyzer endpoint and its server-side secret |
| `<SUPPORT_EMAIL>` | Owner-approved, monitored support contact |
| `<LEGAL_ENTITY_AND_BUSINESS_DETAILS>` | Qualified, owner-approved legal identity and related facts |
| `<REVIEW_STORE_DOMAIN>` | Shopify development/review store domain |
| `<REVIEWER_ACCESS_OR_INSTALL_INSTRUCTIONS>` | Dashboard-authorized reviewer access or installation path |
| `<OWNER_APPROVED_TRUE_OR_FALSE>` | Owner-approved production choice where a boolean depends on listing/pricing decisions |

## Exact remaining blockers

The wording below is preserved from `FINAL_SHOPIFY_REVIEW_AUDIT.md`. The two demo-store/QA items come from that audit's unfinished QA-owner checklist because it has no separately counted demo-store section.

### Infrastructure tasks — 5

1. **Production hosting is not verified.** Replace `https://YOUR_PRODUCTION_APP_URL`, deploy the exact reviewed commit to a stable HTTPS origin, and confirm `/app`, `/auth/callback`, public legal pages, and webhook endpoints are reachable.
2. **Production environment and secrets are not verified.** Supply `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES=read_products`, `DATABASE_URL`, storage credentials, and any enabled-service secrets through the host's secret manager; keep `DEV_BYPASS_SHOPIFY_AUTH=false` and `SHOPIFY_BILLING_BYPASS=false` in production.
3. **Managed PostgreSQL is not verified.** Provision it, run `npm run setup:production`, confirm the generated PostgreSQL schema/migration deploys, and test persistence and uninstall/shop-redact deletion.
4. **Private object storage is not verified.** Configure `FILE_STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, and credentials or workload identity; test upload, authenticated playback, deletion, and provider-failure behavior.
5. **The analyzer is not review-operationally verified.** If AI Review Studio is part of the submitted listing, deploy its HTTPS service and set `ANALYZER_ENABLED=true`, `ANALYZER_SERVICE_URL`, `ANALYZER_API_KEY`, and timeout; otherwise describe it as unavailable/optional in the listing and reviewer notes.

### Shopify Partner Dashboard tasks — 6

1. Replace both production-origin placeholders in `shopify.app.toml`, then publish the reviewed configuration with the existing `npm run deploy` / `shopify app deploy` workflow only after the web service is live.
2. Set the Dashboard App URL to the same stable HTTPS production origin.
3. Set the allowed redirection URL to exactly `<production-origin>/auth/callback`.
4. Confirm the app is embedded and the requested/granted scope is exactly `read_products`; reinstall the review store if the grant changed.
5. Confirm registration and signed delivery for `app/scopes_update`, `app/uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact` at the routes configured in `shopify.app.toml`.
6. Complete listing/reviewer setup: accurate feature and pricing copy, public privacy/support URLs, test credentials or install instructions, and reviewer steps that do not promise unavailable direct ad connectors.

### Legal / owner tasks — 5

1. Replace every owner-action value in `app/content/legal.js`: legal entity/name/status, mailing address, effective date, governing law, support email, and production website.
2. Obtain qualified review and finalize Terms sections for warranty, liability, indemnification, dispute resolution, and governing law; remove all scaffolding/owner-action text.
3. Finalize Privacy disclosures for retention/backups, privacy-rights handling, international transfers/subprocessors, incident procedure, and deletion-request verification/response timing.
4. Publish and staff the real support contact used in `app/routes/support.jsx` and `app/routes/app.support.jsx`; verify it receives messages and matches the listing.
5. Confirm the owner-approved pricing/billing position. The current repository declares a free MVP/review period; Dashboard pricing, listing copy, refund policy, and production billing flags must all match that decision.

### Demo store tasks — 2

1. **[NOT DONE — QA owner]** Install on a clean review store and walk onboarding, zero-product state, populated-product state, every sidebar route, unknown detail IDs, import preview/confirm, upload/playback, analyzer unavailable/success/error, persistence after refresh, and uninstall/reinstall.
2. **[NOT DONE — QA owner]** Repeat the embedded journey at desktop and narrow widths; verify App Bridge navigation, auth callback, no blank/crash states, no unlabeled sample values, and no unresolved links.

Placement note: these are categorized as demo-store tasks because both require the deployed app to be exercised in the clean Shopify store and reviewer-like embedded environment.

## Zero code blockers confirmed

The audit reports **0 confirmed code blockers**. `FINAL_REVIEW_SCRIPT_REPORT.md` records successful Prisma validation, lint, typecheck, production build, and **151 passing tests with 0 failures**. `scripts/review-check.sh` reported `Failures: 0` and exited with status 0. These automated results support code-completeness; they do not replace the unfinished deployed-store validation above.

## What must be done manually (by a human)

- Select and administer production hosting, managed PostgreSQL, private object storage, DNS, and SSL.
- Obtain the Shopify production credentials and place all secrets in the hosting provider's secret manager.
- Choose whether AI Review Studio is included in the listing; deploy/configure its analyzer if included.
- Replace the two URL placeholders in `shopify.app.toml` only after the stable production origin is known.
- Complete all Partner Dashboard settings, listing fields, distribution settings, reviewer access, and app-version publication.
- Supply all legal identity, contact, privacy, retention, governing-law, pricing, billing, and refund decisions; obtain qualified legal review.
- Create/reset the review store, install the app, prepare safe labeled demo data, execute the complete QA journey, and preserve evidence.
- Send valid and invalid signed webhook requests and verify delivery, cleanup, retry, and observability behavior.

## What can be done in Terminal

Run from the repository root. Values must come from the authorized owner or secret manager.

```shell
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
```

After `DATABASE_URL` points to the provisioned PostgreSQL database:

```shell
npm run setup:production
```

If the selected host provides a deployment command, use its documented command only:

```shell
<YOUR_HOSTING_PROVIDER_DEPLOY_COMMAND>
```

After the web service is live, URL placeholders have been replaced, endpoints are verified, and the correct Shopify app configuration is linked:

```shell
npm run deploy
```

For the hard-coded development store only, inspect the seed safely before applying it:

```shell
npm run seed:shopify-dev -- --dry-run
npm run seed:shopify-dev
npm run seed:blueprintai-local
npm run demo:reset:verify
```

The seed script refuses stores other than `blueprintai-test-store.myshopify.com`. Do not put an access token in a command history; prefer the existing offline session or a secure environment injection.

## What must be done in the hosting dashboard

- Create the production service on `<YOUR_HOSTING_PROVIDER>` from the exact reviewed commit.
- Use a supported Node version from `package.json`: `>=20.19 <22 || >=22.12`.
- Configure the build command as `npm ci && npm run build` and the runtime command as `npm run start`, or use the repository's `npm run docker-start` only when production database setup at startup is intentional and supported.
- Attach managed PostgreSQL and securely set `DATABASE_URL`.
- Attach a private, non-public S3-compatible bucket and configure credentials or workload identity.
- Add all required environment variables from the table below through the provider's secret/configuration controls.
- Attach the stable production domain, enable valid SSL, and enforce HTTPS.
- Confirm the deployed origin serves `/`, `/app`, `/auth/callback`, `/privacy`, `/terms`, `/support`, and every configured webhook path without an unexpected redirect or server error.
- Enable logs/monitoring sufficient to validate webhook delivery, analyzer failures, storage failures, and database cleanup without logging secrets.

## What must be done in the Shopify Partner Dashboard

- Set App URL to `<YOUR_PRODUCTION_APP_URL>` using the same HTTPS origin as `SHOPIFY_APP_URL` and `shopify.app.toml`.
- Set the single allowed Shopify redirect URL to `<YOUR_PRODUCTION_APP_URL>/auth/callback`.
- Confirm embedded mode is enabled.
- Confirm the requested and granted scope is exactly `read_products`; reinstall the review store if needed.
- Publish the TOML-defined webhook subscriptions and verify signed delivery for all five topics.
- Complete distribution settings and provide accurate listing copy, pricing, legal/support URLs, screenshots/assets, reviewer instructions, and `<REVIEWER_ACCESS_OR_INSTALL_INSTRUCTIONS>`.
- Do not advertise unavailable TikTok, Meta, or Google direct connections. Describe AI Review Studio as unavailable/optional unless the analyzer is deployed and verified.

## Required production environment variables

This table reflects `.env.example` and the production decisions described by the audit. Conditional/optional entries must be set only when applicable. All values shown are placeholders, including non-secret configuration values.

| Variable | Purpose | Placeholder value | Secret? |
| --- | --- | --- | --- |
| `SHOPIFY_API_KEY` | Shopify app client key | `<SHOPIFY_API_KEY>` | No |
| `SHOPIFY_API_SECRET` | Shopify app authentication/webhook secret | `<SHOPIFY_API_SECRET>` | **Yes** |
| `SHOPIFY_APP_URL` | Stable HTTPS production origin | `<YOUR_PRODUCTION_APP_URL>` | No |
| `SCOPES` | Requested Shopify scopes; must be exactly `read_products` | `<READ_PRODUCTS>` | No |
| `DATABASE_URL` | Managed PostgreSQL connection | `<DATABASE_URL>` | **Yes** |
| `FILE_STORAGE_DRIVER` | Production media backend; must be `s3` | `<S3>` | No |
| `MAX_UPLOAD_SIZE_BYTES` | Per-upload byte limit; documented default is 104857600 | `<MAX_UPLOAD_SIZE_BYTES>` | No |
| `S3_BUCKET` | Private media bucket | `<S3_BUCKET>` | No |
| `S3_REGION` | Bucket region | `<S3_REGION>` | No |
| `S3_ACCESS_KEY_ID` | Storage credential when workload identity is unavailable | `<S3_ACCESS_KEY_ID>` | **Yes** |
| `S3_SECRET_ACCESS_KEY` | Storage credential when workload identity is unavailable | `<S3_SECRET_ACCESS_KEY>` | **Yes** |
| `S3_ENDPOINT` | Optional non-AWS S3-compatible endpoint | `<S3_ENDPOINT>` | No |
| `S3_FORCE_PATH_STYLE` | Optional provider-specific addressing choice | `<PROVIDER_REQUIRED_TRUE_OR_FALSE>` | No |
| `ANALYZER_ENABLED` | Enables analysis only when the service is deployed | `<OWNER_APPROVED_TRUE_OR_FALSE>` | No |
| `ANALYZER_SERVICE_URL` | Conditional HTTPS analyzer endpoint | `<ANALYZER_SERVICE_URL>` | No |
| `ANALYZER_API_KEY` | Conditional analyzer bearer credential | `<ANALYZER_API_KEY>` | **Yes** |
| `ANALYZER_TIMEOUT_MS` | Conditional analyzer request deadline | `<ANALYZER_TIMEOUT_MS>` | No |
| `DEV_BYPASS_SHOPIFY_AUTH` | Development bypass; must remain false in production | `<FALSE_IN_PRODUCTION>` | No |
| `SHOPIFY_BILLING_REQUIRED` | Owner-approved billing enforcement choice | `<OWNER_APPROVED_TRUE_OR_FALSE>` | No |
| `SHOPIFY_BILLING_BYPASS` | Development/test bypass; must remain false in production | `<FALSE_IN_PRODUCTION>` | No |

## Production deployment checklist

- [ ] Freeze and identify the exact reviewed commit.
- [ ] Complete qualified legal review and replace every owner-action/scaffolding value.
- [ ] Choose the production pricing/billing position and analyzer availability; align the listing and flags.
- [ ] Provision `<YOUR_HOSTING_PROVIDER>`, managed PostgreSQL, and private S3-compatible storage.
- [ ] Add all applicable environment values through the host's secret manager; keep both production bypass flags false.
- [ ] Run `npm ci`, lint, typecheck, build, and test against the reviewed commit.
- [ ] Run `npm run setup:production` against the managed PostgreSQL database.
- [ ] Deploy the exact reviewed commit to the stable HTTPS production origin.
- [ ] Verify SSL, public legal/support routes, `/app`, `/auth/callback`, and all webhook endpoints.
- [ ] Test database persistence, private upload/playback/deletion, storage failure, and uninstall/shop-redact cleanup.
- [ ] Deploy and verify the analyzer, or explicitly mark it unavailable/optional everywhere reviewer-facing.
- [ ] Replace both `shopify.app.toml` URL placeholders with the verified origin.
- [ ] Set matching App URL, exact callback URL, embedded mode, and `read_products` in Shopify.
- [ ] Run `npm run deploy` only after the live service and configuration have been verified.
- [ ] Verify all five signed webhook topics on the deployed app version.
- [ ] Install/reinstall on a clean review store and execute both final checklists below.

## Final demo store checklist

- [ ] Use an authorized Shopify development/review store identified as `<REVIEW_STORE_DOMAIN>`.
- [ ] Start from a clean app install and confirm the OAuth callback completes inside Shopify Admin.
- [ ] Verify onboarding and the zero-product state before adding products.
- [ ] Add safe generated test products and confirm populated product workflows.
- [ ] If using the repository seed scripts, confirm the store is exactly `blueprintai-test-store.myshopify.com`, run the dry run first, then run the documented seed commands.
- [ ] Confirm seeded records are labeled demo/test data and use only fake `example.com` customer addresses.
- [ ] Confirm no real payments, transactions, fulfillments, receipts, shipping labels, or customer data are used.
- [ ] Verify app-local demo performance data remains distinct from Shopify Analytics and is visibly labeled.
- [ ] Exercise import preview/confirm with safe reviewer CSV data and preserve the source file for review.
- [ ] Upload a safe supported video and verify private playback and deletion.
- [ ] Test analyzer unavailable, success, and error states if the analyzer is listed; otherwise verify it is plainly unavailable/optional.
- [ ] Verify saved state persists after refresh and uninstall/reinstall cleanup behaves as documented.
- [ ] Record the exact reviewer install/access instructions and any non-secret test-data locations.

## Final reviewer testing checklist

- [ ] Install/open the app using `<REVIEWER_ACCESS_OR_INSTALL_INSTRUCTIONS>` on `<REVIEW_STORE_DOMAIN>`.
- [ ] Complete Shopify authorization and confirm the app remains embedded in Shopify Admin.
- [ ] Complete onboarding first, then open every sidebar route.
- [ ] Check the Dashboard with zero products, then with the prepared test products.
- [ ] Create/open campaigns and test valid and unknown campaign detail IDs.
- [ ] Open Creative Library records and test valid and unknown creative detail IDs.
- [ ] Preview and confirm the supplied safe CSV import; verify imported metrics are labeled as merchant-supplied.
- [ ] Upload the supplied safe test video; verify authenticated playback, analysis behavior promised by the listing, and deletion.
- [ ] Verify Ad Briefs, Recommendations, Revenue Blueprint, Creators, Activity Log, Search, Settings, and Support in empty and populated states.
- [ ] Verify estimated/demo/imported values are labeled and no result is presented as guaranteed revenue or measured performance when it is not.
- [ ] Confirm TikTok, Meta, and Google direct connections are unavailable and are not required for the supported CSV workflow.
- [ ] Refresh and navigate back/forward; confirm persistence and no blank, crash, 404, redirect-loop, or unresolved-link state.
- [ ] Repeat the embedded journey at desktop and narrow widths.
- [ ] Uninstall, verify shop-scoped cleanup, reinstall, and confirm a clean journey.
- [ ] Use only `<REVIEWER_ACCESS_OR_INSTALL_INSTRUCTIONS>`, `<REVIEW_STORE_DOMAIN>`, supplied safe CSV/video test data, and any Dashboard-managed credentials; no app-specific username/password or real customer/payment credentials are required.

## Submit only when ALL of these are true

- [ ] All 5 infrastructure blockers are closed with deployed evidence.
- [ ] All 6 Partner Dashboard blockers are closed in the active app version/listing.
- [ ] All 5 legal/owner blockers are resolved and qualified review is complete.
- [ ] Both demo-store/QA blockers are completed at desktop and narrow widths.
- [ ] The stable HTTPS origin is identical in hosting configuration, `SHOPIFY_APP_URL`, `shopify.app.toml`, and the Partner Dashboard.
- [ ] Managed PostgreSQL migrations, persistence, and required deletion behavior are verified.
- [ ] Private object storage upload, authenticated playback, deletion, and failure behavior are verified.
- [ ] Analyzer availability exactly matches the listing and reviewer notes.
- [ ] App URL, callback, embedded mode, and the exact `read_products` scope are verified on a clean install.
- [ ] All five webhook topics accept valid signed requests, reject invalid requests, and perform documented cleanup.
- [ ] Public legal/support pages contain no owner-action or scaffolding text and match the listing.
- [ ] Pricing, billing flags, listing copy, refund policy, and reviewer instructions all agree.
- [ ] Demo/import/estimate provenance remains visible throughout the complete review journey.
- [ ] Lint, typecheck, build, and all 151 tests pass on the exact submitted commit.
- [ ] The owner can truthfully change the audit verdict to **Ready for review: Yes** based on evidence, not assumption.
