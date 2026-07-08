import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import db from "../db.server.js";
import {
  deleteCreativePerformanceRecord,
  deleteSavedCreative,
} from "./blueprint.server.js";
import { listCreativePerformance } from "./creative-performance.server.js";

const shops = new Set();

after(async () => {
  for (const shop of shops) {
    await db.adCampaignCreative.deleteMany({ where: { shop } });
    await db.creatorAttribution.deleteMany({ where: { shop } });
    await db.adCampaign.deleteMany({ where: { shop } });
    await db.creativePerformance.deleteMany({ where: { shop } });
    await db.savedCreative.deleteMany({ where: { shop } });
    await db.activityLog.deleteMany({ where: { shop } });
  }
});

describe("Creative Library imported creative deletion", () => {
  it("deletes duplicate saved-review identities once and remains shop-scoped", async () => {
    const suffix = Date.now();
    const shop = `creative-saved-delete-${suffix}.myshopify.com`;
    const otherShop = `creative-saved-delete-other-${suffix}.myshopify.com`;
    shops.add(shop);
    shops.add(otherShop);
    const sharedData = {
      sourceType: "video_analysis",
      sourceId: "idempotent-review-source",
      productId: "review-product",
      productTitle: "Review product",
      title: "Saved review",
      payloadJson: "{}",
    };
    const [first] = await Promise.all([
      db.savedCreative.create({ data: { shop, ...sharedData } }),
      db.savedCreative.create({ data: { shop, ...sharedData } }),
      db.savedCreative.create({ data: { shop: otherShop, ...sharedData } }),
    ]);

    const deleted = await deleteSavedCreative(shop, first.id);

    assert.equal(deleted?.id, first.id);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
    assert.equal(await db.savedCreative.count({ where: { shop: otherShop } }), 1);
    assert.equal(await deleteSavedCreative(shop, first.id), null);
  });

  it("exposes TTAD1-TTAD5 as local performance records and removes each creative group with campaign links", async () => {
    const shop = `creative-delete-${Date.now()}.myshopify.com`;
    shops.add(shop);
    const campaign = await db.adCampaign.create({
      data: {
        shop,
        name: "Imported creative test",
        normalizedName: "imported creative test",
      },
    });
    const firstPerformanceIds = new Map();

    for (const creativeId of ["TTAD1", "TTAD2", "TTAD3", "TTAD4", "TTAD5"]) {
      const sourceRecordId = `${shop}:${creativeId.toLowerCase()}-day-1`;
      const saved = await db.savedCreative.create({
        data: {
          shop,
          sourceType: "creative_performance_upload_import",
          sourceId: sourceRecordId,
          productId: "test-product",
          productTitle: "Test product",
          title: `${creativeId} imported creative`,
          payloadJson: "{}",
        },
      });
      const first = await db.creativePerformance.create({
        data: {
          shop,
          creativeId,
          platform: "tiktok_ads",
          sourceRecordId,
          sourceRecordType: "creative_upload_performance_import",
          importKey: `${creativeId.toLowerCase()}-day-1`,
          adName: `${creativeId} imported creative`,
        },
      });
      const second = await db.creativePerformance.create({
        data: {
          shop,
          creativeId,
          platform: "tiktok_ads",
          sourceRecordId: `${shop}:${creativeId.toLowerCase()}-day-2`,
          sourceRecordType: "tiktok_ads",
          importKey: `${creativeId.toLowerCase()}-day-2`,
          adName: `${creativeId} imported creative`,
        },
      });
      firstPerformanceIds.set(creativeId, first.id);
      await db.adCampaignCreative.createMany({
        data: [
          { shop, campaignId: campaign.id, savedCreativeId: saved.id },
          { shop, campaignId: campaign.id, creativePerformanceId: first.id },
          { shop, campaignId: campaign.id, creativePerformanceId: second.id },
        ],
      });
    }

    const library = await listCreativePerformance({ shop });
    for (const creativeId of ["TTAD1", "TTAD2", "TTAD3", "TTAD4", "TTAD5"]) {
      const record = library.records.find(
        (candidate) => candidate.creativeId === creativeId,
      );
      assert.equal(record?.storageRecordType, "creative_performance");
      assert.ok(record?.storageRecordId);

      await deleteCreativePerformanceRecord(
        shop,
        firstPerformanceIds.get(creativeId),
      );

      assert.equal(
        await db.creativePerformance.count({ where: { shop, creativeId } }),
        0,
      );
    }

    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
    assert.equal(await db.adCampaignCreative.count({ where: { shop } }), 0);
  });
});
