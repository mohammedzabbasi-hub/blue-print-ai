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
  listCreativePerformance,
  parsePublicEngagementCsv,
  upsertPublicEngagementRecord,
} from "./creative-performance.server.js";
import { appendSelectedVideoFiles } from "../utils/selected-video-files.js";
import { createCampaign, getCampaign } from "./campaign.server.js";
import { listCreatorProfiles } from "./creator-attribution.server.js";

const testShops = new Set();

after(async () => {
  for (const shop of testShops) {
    await Promise.all([
      rm(resolve("public", "uploads", "creative-library", shop), {
        force: true,
        recursive: true,
      }),
      rm(resolve("build", "client", "uploads", "creative-library", shop), {
        force: true,
        recursive: true,
      }),
    ]);
    await db.adCampaignCreative.deleteMany({ where: { shop } });
    await db.creatorAttribution.deleteMany({ where: { shop } });
    await db.adCampaign.deleteMany({ where: { shop } });
    await db.creativePerformance.deleteMany({ where: { shop } });
    await db.creator.deleteMany({ where: { shop } });
    await db.savedCreative.deleteMany({ where: { shop } });
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

  it("detects duplicate, unsupported, unmatched, and unsafe filenames", () => {
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
    assert.equal(missing.rows[0].creativeUploadStatus, "Performance only");
    assert.equal(missing.rows[0].status, "warning");
    assert.equal(unsafe.rows[0].creativeUploadStatus, "Missing required fields");
    assert.ok([duplicate, unsupported, unsafe].every((result) => result.summary.errors === 1));
    assert.equal(missing.summary.errors, 0);
  });

  it("imports two matched videos into SavedCreative and CreativePerformance", async () => {
    const shop = `multi-video-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
    const files = [videoFile("TTAD1.mp4", "video-one"), videoFile("TTAD2.mp4", "video-two")];

    testShops.add(shop);

    const campaign = await createCampaign(shop, {
      name: "Imported video campaign",
      objective: "testing",
      platform: "tiktok",
    });
    const preview = previewFor(
      [
        csvRow("persist-1", "TTAD1.mp4", "First persisted creative"),
        csvRow("persist-2", "TTAD2.mp4", "Second persisted creative"),
      ],
      files,
    );
    const result = await importMatchedCreativeRows({
      campaignId: campaign.id,
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
    const assignedCampaign = await getCampaign(shop, campaign.id);

    assert.equal(result.ok, true);
    assert.equal(result.summary.created, 2);
    assert.equal(result.summary.skipped, 0);
    assert.equal(savedCreatives.length, 2);
    assert.equal(performanceRows.length, 2);
    assert.equal(library.records.length, 2);
    assert.equal(result.assignedCampaignId, campaign.id);
    assert.equal(assignedCampaign.creativeCount, 2);
    assert.ok(performanceRows.every((record) => record.videoUrl?.startsWith(`/uploads/creative-library/${shop}/`)));
    assert.ok(performanceRows.every((record) => record.videoUrl?.endsWith(".mp4")));
    assert.ok(library.records.every((record) => record.videoUrl?.endsWith(".mp4")));
    assert.deepEqual(
      new Set(savedCreatives.map((record) => JSON.parse(record.payloadJson).label)),
      new Set(["Imported creative + performance"]),
    );
  });

  it("imports a CSV-only row through the unified creative workflow", async () => {
    const shop = `csv-only-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
    const csv = [CSV_HEADER, csvRow("csv-only", "", "CSV only creative")].join("\n");

    testShops.add(shop);

    const preview = buildCreativeUploadPreview({
      csvText: csv,
      parsePublicEngagementCsv,
      uploadedVideos: [],
    });
    const result = await importMatchedCreativeRows({
      preview,
      shop,
      uploadedVideos: [],
      upsertPublicEngagementRecord,
    });

    assert.equal(result.ok, true);
    assert.equal(result.summary.created, 1);
    assert.equal(preview.rows[0].creativeUploadStatus, "Performance only");
    assert.equal(preview.rows[0].status, "warning");
    assert.equal(preview.rows[0].record.sourcePlatform, "tiktok");
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
    assert.equal(await db.creativePerformance.count({ where: { shop } }), 1);
  });

  it("creates a creator from the same CSV row and connects it to the creative", async () => {
    const shop = testShop("creator-create");
    testShops.add(shop);
    const result = await importCreatorCsv(shop, [
      creatorRow("creator-create-1", "@MayaGlow", "Maya Glow", "120", "6", "360", "90"),
    ]);
    const creator = await db.creator.findFirst({
      where: { shop },
      include: { attributions: { include: { creativePerformance: true } } },
    });

    assert.equal(result.summary.newCreators, 1);
    assert.equal(creator.name, "Maya Glow");
    assert.equal(creator.normalizedHandle, "mayaglow");
    assert.equal(creator.attributions.length, 1);
    assert.equal(creator.attributions[0].creativePerformance.adName, "Creator creative creator-create-1");
  });

  it("updates and deduplicates repeated creator rows by normalized handle", async () => {
    const shop = testShop("creator-handle-dedupe");
    testShops.add(shop);
    const preview = await importCreatorCsv(shop, [
      creatorRow("handle-1", "@SameCreator", "First Name", "10", "1", "20", "5"),
      creatorRow("handle-2", "samecreator", "Updated Name", "15", "2", "40", "10"),
    ]);
    const creators = await listCreatorProfiles(shop);

    assert.equal(creators.length, 1);
    assert.equal(creators[0].name, "Updated Name");
    assert.equal(creators[0].attributions.length, 2);
    assert.equal(preview.summary.creatorsDetected, 1);
    assert.equal(preview.summary.duplicateCreatorRowsMerged, 1);
  });

  it("deduplicates by normalized creator name when handles are missing", async () => {
    const shop = testShop("creator-name-dedupe");
    testShops.add(shop);
    await importCreatorCsv(shop, [
      creatorRow("name-1", "", "Ari Brooks", "10", "1", "20", ""),
      creatorRow("name-2", "", " ari  brooks ", "20", "2", "50", ""),
    ]);

    assert.equal(await db.creator.count({ where: { shop } }), 1);
    assert.equal(await db.creatorAttribution.count({ where: { shop } }), 2);
  });

  it("reports an existing creator as updated on a later CSV import", async () => {
    const shop = testShop("creator-update");
    testShops.add(shop);
    await importCreatorCsv(shop, [
      creatorRow("update-1", "@repeat", "Repeat Creator", "10", "1", "25", ""),
    ]);
    const existingCreators = await listCreatorProfiles(shop);
    const second = await importCreatorCsv(shop, [
      creatorRow("update-2", "@REPEAT", "Repeat Creator Updated", "12", "2", "45", ""),
    ], { existingCreators });

    assert.equal(second.summary.newCreators, 0);
    assert.equal(second.summary.updatedCreators, 1);
    assert.equal(await db.creator.count({ where: { shop } }), 1);
  });

  it("connects creator attribution to a campaign-assigned creative", async () => {
    const shop = testShop("creator-campaign");
    testShops.add(shop);
    const campaign = await createCampaign(shop, {
      name: "Creator launch",
      objective: "testing",
      platform: "tiktok",
    });
    await importCreatorCsv(shop, [
      creatorRow("campaign-1", "@campaigncreator", "Campaign Creator", "30", "3", "120", "40"),
    ], { campaignId: campaign.id });
    const attribution = await db.creatorAttribution.findFirst({ where: { shop } });

    assert.equal(attribution.campaignId, campaign.id);
    assert.ok(attribution.creativePerformanceId);
  });

  it("exposes imported creator metrics to the Creators page data source", async () => {
    const shop = testShop("creator-page-metrics");
    testShops.add(shop);
    await importCreatorCsv(shop, [
      creatorRow("metrics-1", "@metriccreator", "Metric Creator", "80", "4", "240", "60"),
    ]);
    const performance = await listCreativePerformance({ shop });
    const record = performance.records.find((item) => item.creatorHandle === "@metriccreator");

    assert.equal(record.creatorName, "Metric Creator");
    assert.equal(record.clicks, 80);
    assert.equal(record.orders, 4);
    assert.equal(record.revenue, 240);
    assert.equal(record.roas, 4);
    assert.equal(record.productTitle, "QA Product");
  });

  it("keeps creator conversion, ROAS, and engagement unavailable when metrics are missing", async () => {
    const shop = testShop("creator-null-safe");
    testShops.add(shop);
    await importCreatorCsv(shop, [
      creatorRow("null-1", "@nullcreator", "Null Creator", "", "", "", ""),
    ]);
    const performance = await listCreativePerformance({ shop });
    const record = performance.records.find((item) => item.creatorHandle === "@nullcreator");
    const routeSource = await readFile(resolve("app", "routes", "app.creators.jsx"), "utf8");

    assert.equal(record.clicks, null);
    assert.equal(record.conversionRate, null);
    assert.equal(record.roas, null);
    assert.equal(record.engagementRate, null);
    assert.match(routeSource, /formatOptionalRate\(creator\.conversionRate/);
    assert.match(routeSource, /formatOptionalRate\(creator\.engagementRate/);
    assert.match(routeSource, /formatOptionalCurrency\(creator\.sales/);
  });

  it("shows creator detection, new/update, missing identity, and merged-row counts in preview", async () => {
    const csv = [
      CREATOR_CSV_HEADER,
      creatorRow("preview-1", "@preview", "Preview Creator", "10", "1", "30", ""),
      creatorRow("preview-2", "preview", "Preview Creator", "15", "2", "50", ""),
      creatorRow("preview-3", "", "", "", "", "", ""),
    ].join("\n");
    const preview = buildCreativeUploadPreview({
      csvText: csv,
      parsePublicEngagementCsv,
      uploadedVideos: [],
    });
    const routeSource = await readFile(resolve("app", "routes", "app.data-import.jsx"), "utf8");

    assert.deepEqual(
      {
        detected: preview.summary.creatorsDetected,
        duplicates: preview.summary.duplicateCreatorRowsMerged,
        missing: preview.summary.missingCreatorIdentity,
        newCreators: preview.summary.newCreators,
        updatedCreators: preview.summary.updatedCreators,
      },
      { detected: 1, duplicates: 1, missing: 1, newCreators: 1, updatedCreators: 0 },
    );
    assert.match(routeSource, /Creators detected/);
    assert.match(routeSource, /Duplicate rows merged/);
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

const CREATOR_CSV_HEADER =
  "creative_id,creative_name,creator_handle,creator_name,creator_platform,creator_profile_url,creator_type,creator_clicks,creator_orders,creator_revenue,creator_spend,creator_commission,creator_notes,product_name,platform,date";

function creatorRow(id, handle, name, clicks, orders, revenue, spend) {
  return `${id},Creator creative ${id},${handle},${name},TikTok,https://tiktok.com/${handle || name},affiliate,${clicks},${orders},${revenue},${spend},10,Imported creator note,QA Product,TikTok,2026-06-27`;
}

async function importCreatorCsv(shop, rows, { campaignId = "", existingCreators = [] } = {}) {
  const preview = buildCreativeUploadPreview({
    csvText: [CREATOR_CSV_HEADER, ...rows].join("\n"),
    existingCreators,
    parsePublicEngagementCsv,
    uploadedVideos: [],
  });
  return importMatchedCreativeRows({
    campaignId,
    preview,
    shop,
    uploadedVideos: [],
    upsertPublicEngagementRecord,
  });
}

function testShop(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.myshopify.com`;
}
