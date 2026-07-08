import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import db from "../db.server.js";
import { saveCreativeRecord } from "./blueprint.server.js";
import { listCreativePerformance } from "./creative-performance.server.js";

const shops = new Set();

after(async () => {
  for (const shop of shops) {
    await db.savedCreative.deleteMany({ where: { shop } });
    await db.videoAnalysis.deleteMany({ where: { shop } });
    await db.activityLog.deleteMany({ where: { shop } });
  }
});

describe("saved review to Creative Library", () => {
  it("updates one canonical record and preserves review context", async () => {
    const shop = `review-library-${Date.now()}.myshopify.com`;
    shops.add(shop);
    const analysis = await db.videoAnalysis.create({
      data: {
        shop,
        productId: "product-1",
        productTitle: "Glow Serum",
        fileName: "glow-demo.mp4",
        brief: "A concise product demonstration.",
        payloadJson: JSON.stringify({ result: { analysis: { hook_score: 8 } } }),
      },
    });
    const input = {
      sourceType: "video_analysis",
      sourceId: analysis.id,
      productId: "product-1",
      productTitle: "Glow Serum",
      title: "Glow Serum demo",
      angle: "A concise product demonstration.",
      payload: {
        fileName: "glow-demo.mp4",
        mediaUrl: "/app/media/video-analysis/glow-demo.mp4",
        summary: "A concise product demonstration.",
        analysis: {
          analysis_method: "heuristic",
          clarity_score: 9,
          cta_score: 7,
          hook_score: 8,
          overall_score: 8,
          recommendations: ["Show the result sooner."],
        },
      },
    };

    const first = await saveCreativeRecord(shop, input);
    const second = await saveCreativeRecord(shop, {
      ...input,
      payload: { ...input.payload, summary: "Updated executive summary." },
    });

    assert.equal(first.wasCreated, true);
    assert.equal(second.wasCreated, false);
    assert.equal(second.id, first.id);
    assert.equal(second.payload.fileName, "glow-demo.mp4");
    assert.equal(second.payload.summary, "Updated executive summary.");
    assert.equal(second.payload.analysis.hook_score, 8);
    assert.equal(
      await db.savedCreative.count({
        where: { shop, sourceType: "video_analysis", sourceId: analysis.id },
      }),
      1,
    );

    await db.videoAnalysis.update({
      where: { id: analysis.id },
      data: { savedToLibrary: true },
    });
    const library = await listCreativePerformance({ shop });
    assert.equal(library.records.length, 1);
    assert.equal(library.records[0].storageRecordType, "saved_creative");
    assert.equal(library.records[0].hookScore, 8);
    assert.equal(library.records[0].videoFilename, "glow-demo.mp4");
  });
});
