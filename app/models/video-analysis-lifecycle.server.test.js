import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { after, describe, it } from "node:test";

import db from "../db.server.js";
import {
  clearCurrentVideoAnalysis,
  getCurrentVideoAnalysis,
  listVideoAnalyses,
  resolveReviewPreviewMediaForCreative,
  saveCreativeRecord,
  saveCurrentVideoAnalysisAsReview,
  saveCurrentVideoAnalysisRecord,
  VIDEO_ANALYSIS_STATUS,
} from "./blueprint.server.js";
import {
  deleteUploadedWorkspaceFiles,
  getPrivateMediaObject,
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

describe("AI Review Studio analysis lifecycle", () => {
  it("persists one shop-scoped current analysis without adding Review History or Creative Library records", async () => {
    const shop = testShop("current");
    const otherShop = testShop("current-other");
    const stored = await storeVideo(shop, "current.mp4");
    const current = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: stored.originalName,
      brief: "Current draft",
      analysis: analysisPayload(stored, "Current review"),
    });

    assert.equal(current.status, VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT);
    assert.equal((await getCurrentVideoAnalysis(shop)).id, current.id);
    assert.equal(await getCurrentVideoAnalysis(otherShop), null);
    assert.deepEqual(await listVideoAnalyses(shop), []);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
  });

  it("replaces the prior unsaved current analysis and removes only its unreferenced private media", async () => {
    const shop = testShop("replace");
    const firstStored = await storeVideo(shop, "first.mp4", 1);
    const first = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: firstStored.originalName,
      brief: "First current draft",
      analysis: analysisPayload(firstStored, "First review"),
    });
    const secondStored = await storeVideo(shop, "second.mp4", 2);
    const second = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: secondStored.originalName,
      brief: "Second current draft",
      analysis: analysisPayload(secondStored, "Second review"),
    });

    assert.notEqual(second.id, first.id);
    assert.equal(await db.videoAnalysis.count({
      where: { shop, status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT },
    }), 1);
    assert.equal((await getCurrentVideoAnalysis(shop)).id, second.id);
    await assert.rejects(() => privateMedia(shop, firstStored));
    assert.ok((await privateMedia(shop, secondStored)).body);
  });

  it("saves the current analysis to Review History once while keeping it current", async () => {
    const shop = testShop("save-review");
    const stored = await storeVideo(shop, "save-review.mp4");
    const current = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: stored.originalName,
      brief: "Explicit review",
      analysis: analysisPayload(stored, "Explicit review"),
    });
    const first = await saveCurrentVideoAnalysisAsReview(shop, current.id);
    const second = await saveCurrentVideoAnalysisAsReview(shop, current.id);
    const history = await listVideoAnalyses(shop);

    assert.equal(first.wasCreated, true);
    assert.equal(second.wasCreated, false);
    assert.equal(second.id, first.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, VIDEO_ANALYSIS_STATUS.SAVED_REVIEW);
    assert.equal(history[0].sourceAnalysisId, current.id);
    assert.equal((await getCurrentVideoAnalysis(shop)).id, current.id);
  });

  it("creates one playable Creative Library record only after the explicit library save", async () => {
    const shop = testShop("save-library");
    const stored = await storeVideo(shop, "save-library.mp4");
    const current = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: stored.originalName,
      brief: "Library candidate",
      analysis: analysisPayload(stored, "Library candidate"),
    });

    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
    const preview = await resolveReviewPreviewMediaForCreative({
      shop,
      reviewId: current.id,
    });
    const creativeInput = {
      sourceType: "video_analysis",
      sourceId: current.id,
      productId: current.productId,
      productTitle: current.productTitle,
      title: "Library candidate",
      angle: "Explicit library save",
      payload: {
        mediaFingerprint: preview.mediaFingerprint,
        mediaPath: preview.mediaPath,
        mediaUrl: preview.mediaUrl,
        video_url: preview.mediaUrl,
      },
    };
    const first = await saveCreativeRecord(shop, creativeInput);
    const second = await saveCreativeRecord(shop, creativeInput);

    assert.equal(first.wasCreated, true);
    assert.equal(second.wasCreated, false);
    assert.equal(second.id, first.id);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
    assert.deepEqual(await listVideoAnalyses(shop), []);
    assert.ok((await privateMedia(shop, stored)).body);
  });

  it("clears an unsaved current analysis and its unreferenced media", async () => {
    const shop = testShop("clear-unsaved");
    const stored = await storeVideo(shop, "clear-unsaved.mp4");
    const current = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: stored.originalName,
      brief: "Remove me",
      analysis: analysisPayload(stored, "Remove me"),
    });
    const cleared = await clearCurrentVideoAnalysis(shop, current.id);

    assert.equal(cleared.cleared, true);
    assert.equal(await getCurrentVideoAnalysis(shop), null);
    assert.deepEqual(await listVideoAnalyses(shop), []);
    await assert.rejects(() => privateMedia(shop, stored));
  });

  it("clears the current analysis without deleting its explicitly saved review or referenced media", async () => {
    const shop = testShop("clear-saved");
    const stored = await storeVideo(shop, "clear-saved.mp4");
    const current = await saveCurrentVideoAnalysisRecord({
      shop,
      product: product(),
      fileName: stored.originalName,
      brief: "Keep saved review",
      analysis: analysisPayload(stored, "Keep saved review"),
    });
    const saved = await saveCurrentVideoAnalysisAsReview(shop, current.id);
    await clearCurrentVideoAnalysis(shop, current.id);
    const history = await listVideoAnalyses(shop);

    assert.equal(await getCurrentVideoAnalysis(shop), null);
    assert.equal(history.length, 1);
    assert.equal(history[0].id, saved.id);
    assert.ok((await privateMedia(shop, stored)).body);
  });

  it("continues to treat pre-lifecycle rows as explicitly saved reviews", async () => {
    const shop = testShop("legacy");
    const legacy = await db.videoAnalysis.create({
      data: {
        shop,
        productId: "product-legacy",
        productTitle: "Legacy Product",
        fileName: "legacy.mp4",
        brief: "Old saved review",
        payloadJson: JSON.stringify({ result: { analysis: { summary: "Legacy" } } }),
      },
    });
    const history = await listVideoAnalyses(shop);

    assert.equal(legacy.status, VIDEO_ANALYSIS_STATUS.SAVED_REVIEW);
    assert.equal(history.length, 1);
    assert.equal(history[0].id, legacy.id);
  });
});

function testShop(label) {
  const shop = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
  shops.add(shop);
  return shop;
}

function product() {
  return { id: "product-1", title: "Glow Serum" };
}

async function storeVideo(shop, name, marker = 0) {
  return persistUploadedVideoFile(testMp4File(name, marker), {
    namespace: "video-analysis",
    shop,
  });
}

function analysisPayload(stored, title) {
  return {
    filename: stored.originalName,
    result: {
      analysis: {
        hook_score: 8,
        summary: `${title} summary`,
      },
      display: {
        displayTitle: title,
        originalFilename: stored.originalName,
        summary: `${title} summary`,
      },
      media: {
        fileName: stored.originalName,
        fingerprint: stored.fingerprint,
        mediaPath: stored.storedFileName,
        mediaUrl: stored.mediaUrl,
        storedFileName: stored.storedFileName,
      },
      metadata: {
        file_size: stored.fileSize,
        file_type: stored.fileType,
        media_fingerprint: stored.fingerprint,
        media_path: stored.storedFileName,
        media_url: stored.mediaUrl,
      },
    },
  };
}

function privateMedia(shop, stored) {
  return getPrivateMediaObject({
    shop,
    namespace: "video-analysis",
    storedFileName: stored.storedFileName,
  });
}

function testMp4File(name, marker = 0) {
  const bytes = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom", "ascii"),
    Buffer.alloc(31),
    Buffer.from([marker]),
  ]);

  return new File([bytes], name, { type: "video/mp4" });
}
