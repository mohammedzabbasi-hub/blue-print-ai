import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, describe, it } from "node:test";

import db from "../db.server.js";
import {
  createCreativeBriefPreview,
  deleteCreativeBrief,
  duplicateCreativeBrief,
  findSavedBrief,
  listSavedBriefs,
  saveCreativeBriefPreview,
  updateCreativeBrief,
} from "./blueprint.server.js";

const shops = new Set();

after(async () => {
  for (const shop of shops) {
    await db.savedBrief.deleteMany({ where: { shop } });
    await db.savedCreative.deleteMany({ where: { shop } });
    await db.videoAnalysis.deleteMany({ where: { shop } });
    await db.creativePerformance.deleteMany({ where: { shop } });
    await db.activityLog.deleteMany({ where: { shop } });
  }
});

describe("Creative Briefs persistence", () => {
  it("keeps generation unsaved and saves a preview exactly once", async () => {
    const shop = testShop("save");
    const preview = previewFor(shop);

    assert.equal(await db.savedBrief.count({ where: { shop } }), 0);
    const first = await saveCreativeBriefPreview(shop, preview, preview.previewToken);
    const second = await saveCreativeBriefPreview(shop, preview, preview.previewToken);

    assert.equal(first.wasCreated, true);
    assert.equal(second.wasCreated, false);
    assert.equal(second.id, first.id);
    assert.equal(await db.savedBrief.count({ where: { shop } }), 1);
  });

  it("rejects a changed preview token", async () => {
    const shop = testShop("tamper");
    const preview = previewFor(shop);
    preview.content.hook = "Changed after generation";

    await assert.rejects(
      () => saveCreativeBriefPreview(shop, preview, preview.previewToken),
      /preview changed/i,
    );
    assert.equal(await db.savedBrief.count({ where: { shop } }), 0);
  });

  it("scopes read, edit, duplicate, and delete to the authenticated shop", async () => {
    const shop = testShop("owner");
    const otherShop = testShop("other");
    const preview = previewFor(shop);
    const saved = await saveCreativeBriefPreview(shop, preview, preview.previewToken);

    assert.equal(await findSavedBrief(otherShop, saved.id), null);
    assert.equal(await updateCreativeBrief(otherShop, saved.id, { title: "Stolen" }), null);
    assert.equal(await duplicateCreativeBrief(otherShop, saved.id, "other-request"), null);
    assert.equal(await deleteCreativeBrief(otherShop, saved.id), false);
    assert.ok(await findSavedBrief(shop, saved.id));
  });

  it("updates the same ID and creates one idempotent draft copy", async () => {
    const shop = testShop("edit-copy");
    const preview = previewFor(shop);
    const saved = await saveCreativeBriefPreview(shop, preview, preview.previewToken);
    const updated = await updateCreativeBrief(shop, saved.id, {
      title: "Launch Brief",
      status: "READY",
      content: { hook: "A stronger opening hook" },
    });
    const copy = await duplicateCreativeBrief(shop, saved.id, "copy-request-1");
    const repeated = await duplicateCreativeBrief(shop, saved.id, "copy-request-1");

    assert.equal(updated.id, saved.id);
    assert.equal(updated.title, "Launch Brief");
    assert.equal(updated.payload.content.hook, "A stronger opening hook");
    assert.notEqual(copy.id, saved.id);
    assert.equal(copy.title, "Launch Brief — Copy");
    assert.equal(copy.status, "DRAFT");
    assert.equal(repeated.id, copy.id);
    assert.equal((await listSavedBriefs(shop, 10)).length, 2);
  });

  it("deletes only the selected brief and leaves source records intact", async () => {
    const shop = testShop("delete");
    const creative = await db.savedCreative.create({
      data: { shop, sourceType: "manual", productId: "product-1", productTitle: "Glow Serum", title: "Source", angle: "Demo", payloadJson: "{}" },
    });
    const analysis = await db.videoAnalysis.create({
      data: { shop, productId: "product-1", productTitle: "Glow Serum", fileName: "source.mp4", payloadJson: "{}" },
    });
    const preview = createCreativeBriefPreview(shop, setup(), {
      product: product(), creative, analysis,
    });
    const saved = await saveCreativeBriefPreview(shop, preview, preview.previewToken);

    assert.equal(await deleteCreativeBrief(shop, saved.id), true);
    assert.ok(await db.savedCreative.findUnique({ where: { id: creative.id } }));
    assert.ok(await db.videoAnalysis.findUnique({ where: { id: analysis.id } }));
  });

  it("normalizes a legitimate legacy brief without exposing raw performance rows", async () => {
    const shop = testShop("legacy");
    await db.savedBrief.create({
      data: { shop, productId: "legacy-product", productTitle: "Legacy Product", angle: "Legacy angle", payloadJson: JSON.stringify({ hooks: ["Legacy hook"], script: ["Legacy scene"] }) },
    });
    await db.creativePerformance.create({ data: { shop, creativeId: "raw-row", productName: "Legacy Product", impressions: 100, payloadJson: "{}" } });

    const briefs = await listSavedBriefs(shop, 10);
    assert.equal(briefs.length, 1);
    assert.equal(briefs[0].payload.content.hook, "Legacy hook");
  });
});

describe("Creative Briefs route contract", () => {
  it("uses Creative Briefs language and keeps /app/ad-briefs", async () => {
    const [route, shell, assistant] = await Promise.all([
      source("routes/app.ad-briefs.jsx"), source("routes/app.jsx"), source("utils/assistant-context.js"),
    ]);
    assert.match(route, /Creative Briefs \| BluePrintAI/);
    assert.match(route, /No creative briefs yet/);
    assert.match(route, /Generate New Brief/);
    assert.match(route, /Generate Brief/);
    assert.match(route, /Save Brief/);
    assert.doesNotMatch(route, /Generate and Save Brief/);
    assert.doesNotMatch(route, /performanceBriefs|toPerformanceBriefCard|ProductContextEvidence/);
    assert.doesNotMatch(route, /GEMINI_API_KEY|OPENAI_API_KEY|DATABASE_URL|ANALYZER_API_KEY/);
    assert.match(shell, /to: "\/app\/ad-briefs", label: "Creative Briefs"/);
    assert.match(assistant, /Create a TikTok UGC brief/);
    assert.match(assistant, /Create three hook variations/);
  });
});

function previewFor(shop) {
  return createCreativeBriefPreview(shop, setup(), { product: product() });
}

function setup() {
  return {
    campaignObjective: "Conversions",
    targetAudience: "Busy skincare shoppers",
    platform: "TikTok",
    creativeFormat: "UGC testimonial",
    tone: "Authentic",
    productSellingPoint: "A simpler morning routine",
  };
}

function product() {
  return { id: "product-1", title: "Glow Serum", description: "Hydrating daily serum", source: "shopify", sourceLabel: "Shopify product" };
}

function testShop(label) {
  const shop = `creative-brief-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
  shops.add(shop);
  return shop;
}

function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}
