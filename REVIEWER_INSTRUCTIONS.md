# BluePrintAI Reviewer Instructions

## What BluePrintAI is

BluePrintAI is a Shopify-focused creative planning workspace for organizing video creatives, manually imported ad and creator performance, recommendations, ad briefs, revenue blueprints, and saved video reviews. This reviewer package uses only clearly labeled synthetic sample data and manual file uploads; no Google Ads, TikTok Ads, Meta, or other OAuth integration is required.

## Prerequisites

- Node.js `>=20.19 <22` or `>=22.12` (the range declared in `package.json`).
- npm (the repository includes `package-lock.json`).
- The five reviewer-supplied MP4 files named exactly `TTAD1.mp4`, `TTAD2.mp4`, `TTAD3.mp4`, `TTAD4.mp4`, and `TTAD5.mp4`.
- For the standalone local reviewer path below, no Shopify merchant connection, ad-platform connection, analyzer service, or OAuth credentials are required.

The local reviewer path uses these non-secret development values only:

```dotenv
SHOPIFY_API_KEY=local-demo-key
SHOPIFY_API_SECRET=local-demo-secret
SHOPIFY_APP_URL=http://localhost:3000
SCOPES=read_products
DEV_BYPASS_SHOPIFY_AUTH=true
ANALYZER_ENABLED=false
SHOPIFY_BILLING_REQUIRED=false
SHOPIFY_BILLING_BYPASS=true
```

Do not add Google Ads, TikTok Ads, Meta, analyzer, or production storage credentials for this review path. SQLite is configured directly in `prisma/schema.prisma`, so no `DATABASE_URL` is required locally.

## Install, run, and open locally

From the repository root:

1. Confirm the Node version with `node --version`.
2. Install locked dependencies with `npm install`.
3. Copy `.env.example` to `.env` and replace the local-review fields with the non-secret values shown above. Leave ad-platform and analyzer credentials unset.
4. Generate the Prisma client with `npx prisma generate`.
5. Apply the local SQLite migrations with `npx prisma migrate deploy`.
6. Start the standalone React Router development server with `npx react-router dev`.
7. Open `http://localhost:3000/app?demo=1`.
8. Confirm the banner says **Demo workspace · sample data**.

`npm run dev` launches the Shopify CLI embedded-app workflow and is available for normal Shopify development. It is not needed for this self-contained, no-connection reviewer path.

## Load the complete demo experience

1. Open **Data Import** from the BluePrintAI sidebar.
2. Select **Creative/ad performance**.
3. Upload `demo-data/blueprintai-demo-creative-ad-performance.csv`.
4. In **Add video files**, select all five files: `TTAD1.mp4`, `TTAD2.mp4`, `TTAD3.mp4`, `TTAD4.mp4`, and `TTAD5.mp4`.
5. Click **Review import**.
6. Confirm that five rows are ready and each row matches its same-numbered MP4 file.
7. Complete the import using the confirmation control shown after preview.
8. Return to **Data Import** and select **Creator performance**.
9. Upload `demo-data/blueprintai-demo-creator-performance.csv`.
10. Click **Review import**, confirm five creator rows are ready, and complete the import.
11. Open **Command Center** and confirm performance cards/charts load without an error.
12. Open **Creative Library** and confirm the five imported creative records are present and labeled as imported data.
13. Open **Creators** and confirm the five imported creator profiles are present.
14. Open **AI Advisor** (recommendations), **Ad Briefs**, and **Revenue Blueprint**; confirm each loads and identifies imported or demo context rather than connected-platform measurements.
15. Open **AI Review Studio**. With `ANALYZER_ENABLED=false`, confirm the page and saved-review area load without an error. Uploading a demo video may report analysis as unavailable; it must not fabricate scores, retention, or conclusions.

All product context, CSV records, uploads, performance metrics, recommendations, briefs, blueprints, and reviews in this local demo workspace are sample/demo data. They are not live merchant records or connected-platform results.

## Demo Store Setup Checklist

Use this checklist only when preparing the optional Shopify development store used for a recorded or embedded review. The app experience still uses manual upload and CSV import; do not connect an ad platform.

- [ ] In Shopify Admin, remove every default Shopify snowboard demo product; verify that searching Products for `snowboard` returns no products.
- [ ] Create exactly five demo products: **Ice Roller Pro**, **LashLift Starter Kit**, **GlowPrep Headband Set**, **GlowLift Facial Sculptor**, and **Glass Skin Bundle**.
- [ ] Add at least one clear, professional product image to each of the five products and verify no product has a blank featured image.
- [ ] Set a clean product vendor and product type on every product; use **BluePrintAI Beauty** as the vendor and the matching types **Skincare Tool**, **Lash Care**, **Beauty Accessory**, **Skincare Tool**, and **Skincare Bundle**.
- [ ] Create two or three collections and assign every product to at least one collection; for example, create **Skincare Tools**, **Beauty Routines**, and **Bundles**.
- [ ] Open BluePrintAI **Data Import**, choose **Creative/ad performance**, and upload `demo-data/blueprintai-demo-creative-ad-performance.csv`.
- [ ] In the same creative import, upload exactly `TTAD1.mp4`, `TTAD2.mp4`, `TTAD3.mp4`, `TTAD4.mp4`, and `TTAD5.mp4`; preview and confirm that every CSV row matches the same-numbered file before importing.
- [ ] Open BluePrintAI **Data Import**, choose **Creator performance**, upload `demo-data/blueprintai-demo-creator-performance.csv`, preview five ready rows, and complete the import.
- [ ] Open **Command Center** and verify it is populated and does not display an error.
- [ ] Open **Creative Library** and verify all five imported creatives load, retain the canonical MP4 filenames, and are labeled as imported data.
- [ ] Open **Creators** and verify the five imported creator profiles and supplied metrics load without an error.
- [ ] Open **AI Advisor** and verify recommendations load with demo/imported provenance visible where applicable.
- [ ] Open **Ad Briefs** and verify the page loads, the five-product context is available, and imported/demo context is labeled.
- [ ] Open **Revenue Blueprint** and verify it loads, imported performance context is identified, and missing metrics remain unavailable rather than invented.
- [ ] Open **AI Review Studio** and verify it loads in a safe empty state with no error. With the analyzer disabled, optionally select a demo MP4 and verify unavailable analysis is handled safely without fabricated output.

## Data and upload notes

- The creative importer accepts MP4, MOV, M4V, and WebM and validates filename extension, MIME type, and file signature.
- Its default per-video limit is 100 MB and its combined request limit is 250 MB.
- Matching is case-insensitive, but reviewer assets and all package references deliberately use the canonical names `TTAD1.mp4` through `TTAD5.mp4`.
- The MP4 binaries are not committed as portable demo assets. They currently exist only in local private media storage and must be supplied to the reviewer separately, then uploaded manually.
