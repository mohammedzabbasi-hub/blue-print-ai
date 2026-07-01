# Demo Store Import Guide

This guide imports the GlowForge Beauty demo product catalog into the Shopify test store so BluePrintAI can be checked against live Shopify product data.

1. Open Shopify Admin for `blueprintai-test-store.myshopify.com`.
2. Go to Products.
3. Click Import.
4. Click Add file.
5. Select `glowforge-demo-products.csv`.
6. Upload and import the products.
7. After import, confirm the products appear under Products.
8. Optionally add product images manually, or later update the `Image Src` column with public image URLs.
9. Then rerun the app with:

```sh
cd ~/Documents/blue-print-ai
shopify app dev
```

10. Open the app preview.
11. Check these routes:

```text
/app
/app/onboarding
/app/settings
/app/recommendations
/app/ad-briefs
/app/revenue-blueprint
/app/video-analysis
/app/creative-library
```

12. Confirm the demo products appear in BluePrintAI.

Note: This CSV is only for demo/testing and does not create fake performance data.
