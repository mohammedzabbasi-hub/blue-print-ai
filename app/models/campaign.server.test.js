import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import db from "../db.server.js";
import {
  aggregateCampaignPerformance,
  assignCampaignRecords,
  createCampaign,
  deleteCampaign,
  ensureImportedCampaign,
  getCampaign,
  listCampaigns,
  removeCampaignAssignment,
  syncImportedCampaignAssignment,
  updateCampaign,
} from "./campaign.server.js";

const shops = new Set();
after(async () => {
  for (const shop of shops) {
    await db.adCampaignCreative.deleteMany({ where: { shop } });
    await db.adCampaign.deleteMany({ where: { shop } });
    await db.savedCreative.deleteMany({ where: { shop } });
    await db.creativePerformance.deleteMany({ where: { shop } });
    await db.creator.deleteMany({ where: { shop } });
  }
});
const shopName = (prefix) => {
  const shop = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
  shops.add(shop);
  return shop;
};

async function seedRecords(shop, suffix) {
  const saved = await db.savedCreative.create({ data: { shop, sourceType: "manual", productId: "p1", productTitle: "Product", title: `Creative ${suffix}`, payloadJson: "{}" } });
  const performance = await db.creativePerformance.create({ data: { shop, importKey: `campaign-test-${suffix}-${shop}`, adName: `Creative ${suffix}`, sourceRecordId: saved.id, impressions: 1000, clicks: 50, orders: 5, revenue: 500, spend: 100, videoViews: 800, engagements: 80 } });
  return { saved, performance };
}

describe("Campaign Manager persistence", () => {
  it("creates, edits, lists, and deletes a shop-scoped campaign", async () => {
    const shop = shopName("campaign-crud");
    const created = await createCampaign(shop, { name: "June Scale", status: "draft", objective: "revenue", budget: "2500" });
    const updated = await updateCampaign(shop, created.id, { name: "June Scale", status: "active", objective: "revenue", platform: "meta", budget: "3000" });
    assert.equal(updated.status, "active");
    assert.equal(updated.objective, "revenue");
    assert.equal(updated.platform, "meta");
    assert.equal((await listCampaigns(shop))[0].budget, 3000);
    await deleteCampaign(shop, created.id);
    assert.equal(await getCampaign(shop, created.id), null);
  });

  it("deletes only local campaign relationships while preserving creatives and imported evidence", async () => {
    const shop = shopName("campaign-safe-delete");
    const otherShop = shopName("campaign-safe-delete-other");
    const deletedCampaign = await createCampaign(shop, { name: "Shared campaign name" });
    const sameShopCampaign = await createCampaign(shop, { name: "Keep this campaign" });
    const otherShopCampaign = await createCampaign(otherShop, { name: "Shared campaign name" });
    const record = await seedRecords(shop, `safe-delete-${Date.now()}`);
    const creator = await db.creator.create({
      data: { shop, handle: "@campaign-safe-delete", normalizedHandle: "@campaign-safe-delete" },
    });
    await assignCampaignRecords(shop, deletedCampaign.id, {
      savedCreativeIds: [record.saved.id],
      creativePerformanceIds: [record.performance.id],
    });
    await db.creatorAttribution.create({
      data: {
        shop,
        creatorId: creator.id,
        creativePerformanceId: record.performance.id,
        campaignId: deletedCampaign.id,
      },
    });

    const deleted = await deleteCampaign(shop, deletedCampaign.id);

    assert.equal(deleted.id, deletedCampaign.id);
    assert.equal(await getCampaign(shop, deletedCampaign.id), null);
    assert.equal(await db.adCampaignCreative.count({ where: { shop, campaignId: deletedCampaign.id } }), 0);
    assert.ok(await db.savedCreative.findUnique({ where: { id: record.saved.id } }));
    assert.ok(await db.creativePerformance.findUnique({ where: { id: record.performance.id } }));
    assert.equal((await db.creatorAttribution.findUnique({ where: { creativePerformanceId: record.performance.id } })).campaignId, null);
    assert.ok(await db.adCampaign.findUnique({ where: { id: sameShopCampaign.id } }));
    assert.ok(await db.adCampaign.findUnique({ where: { id: otherShopCampaign.id } }));
    assert.equal(await deleteCampaign(shop, deletedCampaign.id), null);
    assert.ok(await db.adCampaign.findUnique({ where: { id: otherShopCampaign.id } }));
  });

  it("rejects duplicate campaign names case-insensitively within a shop but permits another shop", async () => {
    const shop = shopName("campaign-unique");
    const otherShop = shopName("campaign-unique-other");
    await createCampaign(shop, { name: "Creator Test" });
    await assert.rejects(() => createCampaign(shop, { name: " creator   test " }), /already exists/);
    assert.equal((await createCampaign(otherShop, { name: "Creator Test" })).name, "Creator Test");
  });

  it("assigns one or multiple records and aggregates campaign performance", async () => {
    const shop = shopName("campaign-assign");
    const campaign = await createCampaign(shop, { name: "Performance Test" });
    const first = await seedRecords(shop, "one");
    const second = await seedRecords(shop, "two");
    const result = await assignCampaignRecords(shop, campaign.id, { savedCreativeIds: [first.saved.id, second.saved.id], creativePerformanceIds: [first.performance.id, second.performance.id] });
    assert.equal(result.assigned, 2);
    const detail = await getCampaign(shop, campaign.id);
    assert.equal(detail.creativeCount, 2);
    assert.equal(detail.metrics.revenue, 1000);
    assert.equal(detail.metrics.roas, 5);
    assert.equal(detail.metrics.ctr, 5);
    assert.equal(detail.metrics.cvr, 10);
  });

  it("does not duplicate assignments and can remove a creative", async () => {
    const shop = shopName("campaign-remove");
    const campaign = await createCampaign(shop, { name: "Assignment Test" });
    const record = await seedRecords(shop, "remove");

    await assignCampaignRecords(shop, campaign.id, {
      creativePerformanceIds: [record.performance.id, record.performance.id],
      savedCreativeIds: [record.saved.id, record.saved.id],
    });
    const duplicate = await assignCampaignRecords(shop, campaign.id, {
      creativePerformanceIds: [record.performance.id],
      savedCreativeIds: [record.saved.id],
    });

    const before = await getCampaign(shop, campaign.id);
    assert.equal(duplicate.assigned, 0);
    assert.equal(before.creativeCount, 1);
    assert.equal(before.assignments.length, 1);

    await removeCampaignAssignment(shop, before.assignments[0].id);
    const after = await getCampaign(shop, campaign.id);
    assert.equal(after.assignments.length, 0);
    assert.equal(after.creativeCount, 0);
  });

  it("auto-maps imported campaign names and external IDs without duplicating campaigns", async () => {
    const shop = shopName("campaign-import");
    const record = await seedRecords(shop, "import");
    const first = await syncImportedCampaignAssignment(shop, { campaignName: "June Creator Scale Test", externalCampaignId: "source-123", savedCreativeId: record.saved.id, creativePerformanceId: record.performance.id });
    const second = await ensureImportedCampaign(shop, { campaignName: "june creator scale test", externalCampaignId: "source-123" });
    assert.equal(first.id, second.id);
    assert.equal((await listCampaigns(shop)).length, 1);
    assert.equal((await getCampaign(shop, first.id)).creativeCount, 1);
  });

  it("calculates safe empty and complete aggregate metrics", () => {
    assert.equal(aggregateCampaignPerformance([]).roas, null);
    assert.equal(aggregateCampaignPerformance([]).revenue, null);
    assert.equal(aggregateCampaignPerformance([]).clicks, null);
    assert.equal(aggregateCampaignPerformance([{ impressions: 200, clicks: 10, orders: 2, revenue: 80, spend: 20 }]).roas, 4);
  });

  it("keeps public engagement totals without inventing commercial zeroes", () => {
    const metrics = aggregateCampaignPerformance([
      { videoViews: 100, likes: 10, comments: 2, shares: 1 },
    ]);

    assert.equal(metrics.views, 100);
    assert.equal(metrics.likes, 10);
    assert.equal(metrics.comments, 2);
    assert.equal(metrics.shares, 1);
    assert.equal(metrics.revenue, null);
    assert.equal(metrics.spend, null);
    assert.equal(metrics.orders, null);
    assert.equal(metrics.roas, null);
    assert.equal(metrics.hasPublicEngagement, true);
    assert.equal(metrics.hasCommercialMetrics, false);
  });
});
