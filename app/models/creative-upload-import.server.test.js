import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import db from "../db.server.js";
import {
  buildCreativeUploadPreview,
  CREATIVE_VIDEO_FILE_FIELD,
  getUploadedVideoFiles,
  importMatchedCreativeRows,
} from "./creative-upload-import.server.js";
import {
  importPublicEngagementRows,
  listCreativePerformance,
  parsePublicEngagementCsv,
  upsertPublicEngagementRecord,
} from "./creative-performance.server.js";
import { appendSelectedVideoFiles } from "../utils/selected-video-files.js";

const testShops = new Set();

after(async () => {
  for (const shop of testShops) {
    await Promise.all([
      db.creativePerformance.deleteMany({ where: { shop } }),
      db.savedCreative.deleteMany({ where: { shop } }),
      rm(resolve("public", "uploads", "creative-library", shop), {
        force: true,
        recursive: true,
      }),
      rm(resolve("build", "client", "uploads", "creative-library", shop), {
        force: true,
        recursive: true,
      }),
    ]);
  }
});

describe("creative upload performance import", () => {
  it("uses a plural multi-file field and reads every FormData file", async () => {
    const formData = new FormData();
    formData.append(CREATIVE_VIDEO_FILE_FIELD, videoFile("TTAD1.mp4", "one"));
    formData.append(CREATIVE_VIDEO_FILE_FIELD, videoFile("TTAD2.mp4", "two"));

    const files = getUploadedVideoFiles(formData);
    const routeSource = await readFile(
      resolve("app", "routes", "app.data-import.jsx"),
      "utf8",
    );

    assert.equal(CREATIVE_VIDEO_FILE_FIELD, "videoFiles");
    assert.deepEqual(files.map((file) => file.name), ["TTAD1.mp4", "TTAD2.mp4"]);
    assert.match(routeSource, /name="videoFiles"/);
    assert.match(routeSource, /id="creative-upload-videos"[\s\S]*multiple/);
    assert.match(routeSource, /Choose video files/);
    assert.match(routeSource, /Add more video files/);
    assert.match(routeSource, /Clear selected files/);
    assert.match(routeSource, /selectedVideos\.slice\(0, 5\)/);
    assert.match(routeSource, /\+ \{selectedVideos\.length - 5\} more/);
    assert.match(routeSource, /setSelectedVideos\(\[\]\)/);
    assert.match(routeSource, /buildCreativeImportFormData/);
    assert.match(routeSource, /submit\(formData,/);
  });

  it("matches all selected files case-insensitively by trimmed base filename", () => {
    const firstSelection = appendSelectedVideoFiles([], [
      videoFile("TTAD1.mp4", "one"),
    ]);
    const separateSelections = appendSelectedVideoFiles(firstSelection, [
      videoFile("ttad2.MP4", "two"),
    ]);
    const preview = previewFor(
      [
        csvRow("multi-1", " ttad1.MP4 ", "First creative"),
        csvRow("multi-2", "TTAD2.mp4", "Second creative"),
      ],
      separateSelections,
    );

    assert.equal(preview.summary.ready, 2);
    assert.equal(preview.summary.uploadedFilesMatched, 2);
    assert.deepEqual(
      preview.rows.map((row) => row.matchedUploadedFile),
      ["TTAD1.mp4", "ttad2.MP4"],
    );
    assert.deepEqual(preview.rows.map((row) => row.creativeUploadStatus), ["Ready", "Ready"]);
  });

  it("detects duplicate, unsupported, missing, and unsafe filenames", () => {
    const duplicate = previewFor(
      [csvRow("duplicate", "TTAD1.mp4", "Duplicate")],
      [videoFile("TTAD1.mp4", "one"), videoFile("ttad1.MP4", "two")],
    );
    const unsupported = previewFor(
      [csvRow("unsupported", "clip.avi", "Unsupported")],
      [videoFile("clip.avi", "avi", "video/x-msvideo")],
    );
    const missing = previewFor(
      [csvRow("missing", "not-uploaded.mp4", "Missing")],
      [videoFile("another.mp4", "other")],
    );
    const unsafe = previewFor(
      [csvRow("unsafe", "../TTAD1.mp4", "Unsafe")],
      [videoFile("TTAD1.mp4", "one")],
    );

    assert.equal(duplicate.rows[0].creativeUploadStatus, "Duplicate filename");
    assert.equal(unsupported.rows[0].creativeUploadStatus, "Unsupported video type");
    assert.equal(missing.rows[0].creativeUploadStatus, "Missing video file");
    assert.equal(unsafe.rows[0].creativeUploadStatus, "Missing required fields");
    assert.ok([duplicate, unsupported, missing, unsafe].every((result) => result.summary.errors === 1));
  });

  it("imports two matched videos into SavedCreative and CreativePerformance", async () => {
    const shop = `multi-video-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
    const files = [videoFile("TTAD1.mp4", "video-one"), videoFile("TTAD2.mp4", "video-two")];
    const preview = previewFor(
      [
        csvRow("persist-1", "TTAD1.mp4", "First persisted creative"),
        csvRow("persist-2", "TTAD2.mp4", "Second persisted creative"),
      ],
      files,
    );

    testShops.add(shop);

    const result = await importMatchedCreativeRows({
      preview,
      shop,
      uploadedVideos: files,
      upsertPublicEngagementRecord,
    });
    const [savedCreatives, performanceRows, library] = await Promise.all([
      db.savedCreative.findMany({ where: { shop }, orderBy: { title: "asc" } }),
      db.creativePerformance.findMany({ where: { shop }, orderBy: { adName: "asc" } }),
      listCreativePerformance({ shop, limit: 10 }),
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.summary.created, 2);
    assert.equal(result.summary.skipped, 0);
    assert.equal(savedCreatives.length, 2);
    assert.equal(performanceRows.length, 2);
    assert.equal(library.records.length, 2);
    assert.ok(performanceRows.every((record) => record.videoUrl?.startsWith(`/uploads/creative-library/${shop}/`)));
    assert.ok(performanceRows.every((record) => record.videoUrl?.endsWith(".mp4")));
    assert.ok(library.records.every((record) => record.videoUrl?.endsWith(".mp4")));
    assert.deepEqual(
      new Set(savedCreatives.map((record) => JSON.parse(record.payloadJson).label)),
      new Set(["Imported creative + performance"]),
    );
  });

  it("keeps the existing CSV-only import working", async () => {
    const shop = `csv-only-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
    const csv = [CSV_HEADER, csvRow("csv-only", "", "CSV only creative")].join("\n");

    testShops.add(shop);

    const result = await importPublicEngagementRows({ csvText: csv, shop });

    assert.equal(result.ok, true);
    assert.equal(result.summary.created, 1);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
    assert.equal(await db.creativePerformance.count({ where: { shop } }), 1);
  });
});

const CSV_HEADER =
  "creative_id,video_filename,product_name,creative_name,creator_handle,platform,views,clicks,orders,revenue,spend,date,insight";

function previewFor(rows, uploadedVideos) {
  return buildCreativeUploadPreview({
    csvText: [CSV_HEADER, ...rows].join("\n"),
    parsePublicEngagementCsv,
    uploadedVideos,
  });
}

function csvRow(id, filename, title) {
  return `${id},${filename},QA Product,${title},@qa-creator,TikTok,100,10,2,50,20,2026-06-26,QA insight`;
}

function videoFile(name, contents, type = "video/mp4") {
  return new File([contents], name, { type });
}
