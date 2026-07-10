import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBrief, buildRevenueBlueprint, resolveProductContext } from "./blueprint.server.js";
import {
  buildProductContext,
  buildProductContextEvidence,
  buildDashboardDataSourceSummary,
  productContextLabel,
} from "./product-context.js";

const shopifyProduct = {
  id: "gid://shopify/Product/1",
  title: "Shopify Serum",
  source: "shopify",
};
const importedRecord = {
  id: "import-1",
  importSource: "public_engagement_import",
  productTitle: "CSV Moisturizer",
  creativeTitle: "Morning Routine",
  creatorName: "Maya Chen",
  creatorHandle: "@maya",
  impressions: 10000,
  clicks: 500,
  orders: 25,
  revenue: 2500,
  spend: 500,
  reportingDate: "2026-06-01",
};

describe("shared product context", () => {
  it("reports no product context", () => {
    const context = buildProductContext();

    assert.equal(context.shopifyProductsCount, 0);
    assert.equal(context.importedProductNamesCount, 0);
    assert.equal(context.hasAnyProductContext, false);
    assert.equal(context.productContextSource, "none");
    assert.equal(productContextLabel(context), "No product context");
  });

  it("reports real Shopify products", () => {
    const context = buildProductContext({ shopifyProducts: [shopifyProduct] });

    assert.equal(context.shopifyProductsCount, 1);
    assert.equal(context.hasShopifyProducts, true);
    assert.equal(context.productContextSource, "shopify");
    assert.equal(productContextLabel(context), "Shopify product");
    assert.deepEqual(
      buildProductContextEvidence(context),
      {
        product: context.availableProducts[0],
        productName: "Shopify Serum",
        source: "shopify",
        sourceLabel: "Shopify product",
        explanation: "Real catalog product data loaded from Shopify.",
      },
    );
  });

  it("uses imported product names when Shopify has zero products", () => {
    const context = buildProductContext({ performanceRecords: [importedRecord] });

    assert.equal(context.shopifyProductsCount, 0);
    assert.equal(context.importedProductNamesCount, 1);
    assert.equal(context.hasImportedProductContext, true);
    assert.equal(context.hasAnyProductContext, true);
    assert.equal(context.productContextSource, "imported");
    assert.equal(context.availableProducts[0].title, "CSV Moisturizer");
    assert.deepEqual(context.availableProducts[0].creatorNames, ["Maya Chen"]);
    assert.equal(context.availableProducts[0].relatedCreativeCount, 1);
    assert.equal(context.availableProducts[0].impressions, 10000);
    assert.equal(context.availableProducts[0].clicks, 500);
    assert.equal(context.availableProducts[0].orders, 25);
    assert.equal(context.availableProducts[0].conversions, null);
    assert.equal(context.availableProducts[0].revenue, 2500);
    assert.equal(context.availableProducts[0].spend, 500);
    assert.equal(context.availableProducts[0].ctr, 5);
    assert.equal(context.availableProducts[0].cvr, 5);
    assert.equal(context.availableProducts[0].roas, 5);
    assert.equal(context.availableProducts[0].bestPerformingCreative.name, "Morning Routine");
    assert.match(context.availableProducts[0].dateRange.start, /^2026-06-01/);
    const evidence = buildProductContextEvidence(context);
    assert.equal(evidence.productName, "CSV Moisturizer");
    assert.equal(evidence.sourceLabel, "Imported product context");
    assert.match(evidence.explanation, /CSV\/ad imports/);
  });

  it("keeps unavailable imported metrics and Shopify-only fields null", () => {
    const context = buildProductContext({
      performanceRecords: [{
        id: "import-2",
        sourceType: "csv",
        productName: "CSV Cleanser",
        clicks: 0,
      }],
    });
    const product = context.importedProducts[0];

    assert.equal(product.clicks, 0);
    assert.equal(product.impressions, null);
    assert.equal(product.revenue, null);
    assert.equal(product.spend, null);
    assert.equal(product.roas, null);
    assert.equal(product.description, null);
    assert.equal(product.price, null);
    assert.equal(product.category, null);
    assert.equal(product.featuredImage, null);
  });

  it("reports mixed Shopify and imported context with Shopify as the primary source", () => {
    const context = buildProductContext({
      shopifyProducts: [shopifyProduct],
      performanceRecords: [importedRecord],
    });

    assert.equal(context.shopifyProductsCount, 1);
    assert.equal(context.importedProductNamesCount, 1);
    assert.equal(context.hasShopifyProducts, true);
    assert.equal(context.hasImportedProductContext, true);
    assert.equal(context.productContextSource, "shopify");
    assert.equal(context.availableProducts.length, 2);
  });

  it("unlocks Creative Briefs with imported product context", () => {
    const context = buildProductContext({ performanceRecords: [importedRecord] });
    const product = resolveProductContext(context.availableProducts, {});
    const brief = buildBrief(product);

    assert.equal(product?.source, "imported");
    assert.equal(brief.productTitle, "CSV Moisturizer");
    assert.match(brief.context.sourceLabel, /Imported product context/);
    assert.equal(brief.context.productSource, "imported");
    assert.equal(brief.context.importedPerformance.revenue, 2500);
    assert.equal(brief.context.importedPerformance.bestPerformingCreative.name, "Morning Routine");
  });

  it("unlocks Revenue Blueprint with imported product context", () => {
    const context = buildProductContext({ performanceRecords: [importedRecord] });
    const product = resolveProductContext(context.availableProducts, {});
    const blueprint = buildRevenueBlueprint(
      { products: [] },
      { product, performanceRecords: [importedRecord] },
    );

    assert.equal(blueprint.context.productTitle, "CSV Moisturizer");
    assert.equal(blueprint.context.productSource, "imported");
    assert.equal(blueprint.context.importedPerformance.roas, 5);
    assert.match(blueprint.context.productSourceLabel, /CSV\/ad data/);
    assert.match(blueprint.diagnosis, /imported CSV\/ad performance context/);
  });
});

describe("dashboard data source summary", () => {
  it("shows real Shopify products as active context", () => {
    const context = buildProductContext({ shopifyProducts: [shopifyProduct] });
    const summary = buildDashboardDataSourceSummary(context);

    assert.equal(summary.items[0].id, "shopify_products");
    assert.equal(summary.items[0].active, true);
    assert.equal(summary.items[0].label, "Using 1 Shopify product");
    assert.equal(
      summary.items.some((item) => item.id === "no_product_context"),
      false,
    );
  });

  it("shows imported product names as active context", () => {
    const context = buildProductContext({ performanceRecords: [importedRecord] });
    const summary = buildDashboardDataSourceSummary(context);

    assert.equal(summary.items[0].id, "imported_products");
    assert.equal(summary.items[0].active, true);
    assert.equal(summary.items[0].label, "Using 1 imported product");
  });

  it("shows manual upload as an available workflow", () => {
    const summary = buildDashboardDataSourceSummary(buildProductContext());
    const manualUploads = summary.items.find(
      (item) => item.id === "manual_uploads",
    );

    assert.equal(manualUploads.label, "Manual upload available");
    assert.equal(
      summary.items.some((item) => item.label === "No active product context yet"),
      true,
    );
  });

  it("never claims Shopify context for demo or imported-only products", () => {
    const contexts = [
      buildProductContext({ shopifyProducts: [{ title: "Demo", source: "demo" }] }),
      buildProductContext({ performanceRecords: [importedRecord] }),
    ];

    contexts.forEach((context) => {
      const labels = buildDashboardDataSourceSummary(context).items.map(
        (item) => item.label,
      );
      assert.equal(labels.some((label) => label.includes("Shopify")), false);
    });
  });
});
