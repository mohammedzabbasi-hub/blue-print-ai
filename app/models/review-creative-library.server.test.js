import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { after, describe, it } from "node:test";

import db from "../db.server.js";
import {
  REVIEW_PREVIEW_UNAVAILABLE_MESSAGE,
  resolveReviewPreviewMediaForCreative,
  saveCreativeRecord,
} from "./blueprint.server.js";
import { listCreativePerformance } from "./creative-performance.server.js";
import {
  deleteUploadedWorkspaceFiles,
  persistUploadedVideoFile,
} from "../utils/upload-storage.server.js";

const shops = new Set();

after(async () => {
  for (const shop of shops) {
    await deleteUploadedWorkspaceFiles(shop);
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

  it("reuses a saved review creative when the same upload is saved under its analysis id", async () => {
    const shop = `review-media-dedupe-${Date.now()}.myshopify.com`;
    shops.add(shop);
    const mediaUrl = "/app/media/video-analysis/abc123-TTAD2.mp4";
    const first = await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: "upload:fingerprint-1",
      productId: "product-1",
      productTitle: "Product",
      title: "TTAD2",
      angle: "Review",
      payload: { mediaFingerprint: "fingerprint-1", mediaUrl, video_url: mediaUrl },
    });
    const second = await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: "analysis-1",
      productId: "product-1",
      productTitle: "Product",
      title: "TTAD2 reviewed",
      angle: "Updated review",
      payload: { mediaFingerprint: "fingerprint-1", mediaUrl, video_url: mediaUrl },
    });

    assert.equal(second.wasCreated, false);
    assert.equal(second.id, first.id);
    assert.equal(second.sourceId, "analysis-1");
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
  });

  it("requires a resolvable private MP4 before saving an AI Review Studio creative", async () => {
    const shop = `review-media-required-${Date.now()}.myshopify.com`;
    shops.add(shop);
    const stored = await persistUploadedVideoFile(testMp4File("TTAD2.mp4"), {
      namespace: "video-analysis",
      shop,
    });
    const analysis = await db.videoAnalysis.create({
      data: {
        shop,
        productId: "product-1",
        productTitle: "Product",
        fileName: stored.originalName,
        brief: "Review",
        payloadJson: JSON.stringify({
          result: {
            display: { originalFilename: stored.originalName },
            media: {
              fingerprint: stored.fingerprint,
              mediaPath: stored.storedFileName,
              mediaUrl: stored.mediaUrl,
              storedFileName: stored.storedFileName,
            },
            metadata: {
              media_fingerprint: stored.fingerprint,
              media_path: stored.storedFileName,
              media_url: stored.mediaUrl,
            },
          },
        }),
      },
    });
    const preview = await resolveReviewPreviewMediaForCreative({
      shop,
      reviewId: analysis.id,
      mediaFingerprint: stored.fingerprint,
      mediaUrl: stored.mediaUrl,
      originalFilename: stored.originalName,
    });
    const first = await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: analysis.id,
      productId: "product-1",
      productTitle: "Product",
      title: "TTAD2 reviewed",
      angle: "Review",
      payload: {
        mediaFingerprint: preview.mediaFingerprint,
        mediaPath: preview.mediaPath,
        mediaUrl: preview.mediaUrl,
        source: "video_analysis",
        video_url: preview.mediaUrl,
      },
    });
    const second = await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: analysis.id,
      productId: "product-1",
      productTitle: "Product",
      title: "TTAD2 reviewed again",
      angle: "Review updated",
      payload: {
        mediaFingerprint: preview.mediaFingerprint,
        mediaPath: preview.mediaPath,
        mediaUrl: preview.mediaUrl,
        source: "video_analysis",
        video_url: preview.mediaUrl,
      },
    });
    const library = await listCreativePerformance({ shop });

    assert.equal(preview.mediaUrl, stored.mediaUrl);
    assert.equal(preview.mediaPath, stored.storedFileName);
    assert.equal(first.wasCreated, true);
    assert.equal(second.wasCreated, false);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
    assert.equal(library.records.length, 1);
    assert.equal(library.records[0].videoUrl, stored.mediaUrl);
    assert.equal(library.records[0].mediaPath, stored.storedFileName);
  });

  it("fails and leaves no Creative Library card when uploaded review media is missing", async () => {
    const shop = `review-media-missing-${Date.now()}.myshopify.com`;
    shops.add(shop);
    const analysis = await db.videoAnalysis.create({
      data: {
        shop,
        productId: "product-1",
        productTitle: "Product",
        fileName: "missing.mp4",
        brief: "Review",
        payloadJson: JSON.stringify({
          result: {
            media: {
              mediaPath: "missing-video.mp4",
              mediaUrl: "/app/media/video-analysis/missing-video.mp4",
            },
          },
        }),
      },
    });

    await assert.rejects(
      () =>
        resolveReviewPreviewMediaForCreative({
          shop,
          reviewId: analysis.id,
          mediaUrl: "/app/media/video-analysis/missing-video.mp4",
        }),
      { message: REVIEW_PREVIEW_UNAVAILABLE_MESSAGE },
    );
    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
  });

  it("keeps private media shop-scoped and rejects another shop's upload", async () => {
    const ownerShop = `review-media-owner-${Date.now()}.myshopify.com`;
    const otherShop = `review-media-other-${Date.now()}.myshopify.com`;
    shops.add(ownerShop);
    shops.add(otherShop);
    const stored = await persistUploadedVideoFile(testMp4File("owner.mp4"), {
      namespace: "video-analysis",
      shop: ownerShop,
    });

    await assert.rejects(
      () =>
        resolveReviewPreviewMediaForCreative({
          shop: otherShop,
          mediaPath: stored.storedFileName,
          mediaUrl: stored.mediaUrl,
        }),
      { message: REVIEW_PREVIEW_UNAVAILABLE_MESSAGE },
    );
  });

  it("rejects external Render/login URLs for saved review previews", async () => {
    const shop = `review-media-external-${Date.now()}.myshopify.com`;
    shops.add(shop);

    await assert.rejects(
      () =>
        resolveReviewPreviewMediaForCreative({
          shop,
          mediaUrl: "https://blueprintai.onrender.com/login",
        }),
      { message: REVIEW_PREVIEW_UNAVAILABLE_MESSAGE },
    );
  });
});

function testMp4File(name = "upload.mp4") {
  const bytes = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom", "ascii"),
    Buffer.alloc(32),
  ]);

  return new File([bytes], name, { type: "video/mp4" });
}
