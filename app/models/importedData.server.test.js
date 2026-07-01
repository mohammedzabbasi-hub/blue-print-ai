import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import db from "../db.server.js";
import {
  clearImportedData,
  computeCreatorEngagement,
  computeCreativeMetrics,
  getImportSummary,
  importCsvText,
  importJsonBundleText,
} from "./importedData.server.js";

const TEST_SHOP = "blueprintai-import-test.myshopify.com";

describe("importedData.server CSV/JSON import pipeline", () => {
  after(async () => {
    await clearImportedData(TEST_SHOP);
    await db.$disconnect();
  });

  it("imports CSV rows and skips duplicates on re-import", async () => {
    const csv = "id,title,price,currency\nprod-1,Serum,38.00,USD\nprod-2,Cup,29.00,USD\n";

    const first = await importCsvText(TEST_SHOP, "products", csv);
    assert.equal(first.inserted, 2);
    assert.equal(first.skipped, 0);

    const second = await importCsvText(TEST_SHOP, "products", csv);
    assert.equal(second.inserted, 0);
    assert.equal(second.skipped, 2);

    const summary = await getImportSummary(TEST_SHOP);
    assert.equal(summary.products, 2);
  });

  it("rejects an unknown table name without touching the database", async () => {
    const result = await importCsvText(TEST_SHOP, "not_a_table", "id\n1\n");
    assert.equal(result.inserted, 0);
    assert.ok(result.errors[0].includes("not_a_table"));
  });

  it("imports a JSON bundle across multiple tables in one call", async () => {
    const bundle = JSON.stringify({
      creators: [{ id: "creator-1", name: "Maya Chen", total_views: 1000, total_likes: 100 }],
      creatives: [{ id: "creative-1", title: "Hook test", views: 500, clicks: 25 }],
    });

    const { results, errors } = await importJsonBundleText(TEST_SHOP, bundle);

    assert.equal(errors.length, 0);
    assert.equal(results.length, 2);
    assert.ok(results.find((r) => r.table === "creators").inserted === 1);
    assert.ok(results.find((r) => r.table === "creatives").inserted === 1);
  });

  it("clearImportedData removes every imported row for the shop", async () => {
    await clearImportedData(TEST_SHOP);
    const summary = await getImportSummary(TEST_SHOP);

    assert.deepEqual(summary, { products: 0, orders: 0, creators: 0, creatives: 0, metrics: 0 });
  });
});

describe("importedData.server derived metrics never fabricate numbers", () => {
  it("returns null (not zero) when a rate can't be computed from real data", () => {
    assert.equal(computeCreativeMetrics({ views: 0, clicks: 0 }).ctr, null);
    assert.equal(computeCreatorEngagement({ totalViews: 0 }).engagementRate, null);
  });

  it("computes real percentages from real imported numbers", () => {
    const metrics = computeCreativeMetrics({ views: 1000, clicks: 50, orders: 5 });
    assert.equal(metrics.ctr, 5);
    assert.equal(metrics.conversionRate, 10);

    const engagement = computeCreatorEngagement({
      totalViews: 1000,
      totalLikes: 80,
      totalComments: 10,
      totalShares: 10,
    });
    assert.equal(engagement.engagementActions, 100);
    assert.equal(engagement.engagementRate, 10);
  });
});
