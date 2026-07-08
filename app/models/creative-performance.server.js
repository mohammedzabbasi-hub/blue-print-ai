import { existsSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import db from "../db.server.js";
import {
  DEMO_PERFORMANCE_LABEL,
  buildDemoPerformanceSeries,
  demoCreatives,
  enrichDemoCreative,
} from "../data/demo-creatives.js";
import {
  listSavedCreatives,
  listVideoAnalyses,
  saveCreativeRecord,
} from "./blueprint.server.js";
import { MAX_PUBLIC_IMPORT_BYTES } from "../constants/import-limits.js";
import { syncImportedCampaignAssignment } from "./campaign.server.js";
import { upsertCreatorAttribution } from "./creator-attribution.server.js";
import { normalizeShopIdentifier } from "./ad-platform-connection.server.js";

export const DEMO_PERFORMANCE_DATA_LABEL = "Demo performance data";
export const PERFORMANCE_EMPTY_STATE =
  "Connect an ad platform or upload creatives manually to start analyzing performance.";
export const DEMO_PERFORMANCE_EMPTY_STATE =
  "This page is currently using demo performance data.";
export const SHOPIFY_PRODUCTS_ONLY_STATE =
  "Product context is available, but orders/ad platforms are not connected yet.";

export const SOURCE_PLATFORMS = [
  "manual",
  "public_engagement_import",
  "tiktok",
  "instagram",
  "instagram_reels",
  "youtube",
  "youtube_shorts",
  "meta",
  "google",
  "shopify_demo",
  "csv",
  "shopify",
  "meta_ads",
  "tiktok_ads",
  "google_ads",
  "youtube_ads",
  "tiktok_shop",
  "demo",
];

export const PUBLIC_ENGAGEMENT_IMPORT_SOURCE_TYPE =
  "creative_performance_public_engagement_import";
export const CREATIVE_UPLOAD_IMPORT_SOURCE_TYPE =
  "creative_performance_upload_import";
export const CREATIVE_UPLOAD_IMPORT_RECORD_TYPE =
  "creative_upload_performance_import";
export const MAX_PUBLIC_IMPORT_ROWS = 500;
export const PLAYABLE_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];

const REQUIRED_IMPORT_FIELDS = ["platform", "date"];
const RECOMMENDED_IMPORT_FIELDS = [
  "product_handle",
  "product_name",
];
const NUMERIC_IMPORT_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "spend",
  "conversions",
  "orders",
  "revenue",
  "conversion_value",
  "ctr",
  "cpc",
  "cpm",
  "cvr",
  "conversion_rate",
  "roas",
  "views",
  "video_views",
  "video_2_second_views",
  "video_3_second_views",
  "video_25_percent_watched",
  "video_50_percent_watched",
  "video_75_percent_watched",
  "video_100_percent_watched",
  "average_watch_time",
  "engagements",
  "likes",
  "comments",
  "shares",
  "saves",
  "reposts",
  "hook_rate",
  "hold_rate",
  "retention_rate",
  "creator_commission",
  "creator_clicks",
  "creator_orders",
  "creator_revenue",
  "creator_spend",
  "creator_engagement_rate",
];
const ZERO_DEFAULT_FIELDS = ["likes", "comments", "shares", "saves", "reposts"];
const OPTIONAL_PERFORMANCE_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "orders",
  "conversions",
  "revenue",
  "conversion_value",
  "spend",
  "views",
  "cvr",
  "conversion_rate",
  "ctr",
  "cpc",
  "cpm",
  "roas",
  "video_views",
  "video_2_second_views",
  "video_3_second_views",
  "video_25_percent_watched",
  "video_50_percent_watched",
  "video_75_percent_watched",
  "video_100_percent_watched",
  "hook_rate",
  "hold_rate",
  "average_watch_time",
  "retention_rate",
  "creator_commission",
  "creator_clicks",
  "creator_orders",
  "creator_revenue",
  "creator_spend",
  "creator_engagement_rate",
];
const DEEPER_PERFORMANCE_KEYS = [
  "impressions",
  "reach",
  "clicks",
  "orders",
  "conversions",
  "revenue",
  "conversionValue",
  "spend",
  "conversionRate",
  "ctr",
  "cpc",
  "cpm",
  "roas",
  "videoViews",
  "video2SecondViews",
  "video3SecondViews",
  "video25PercentWatched",
  "video50PercentWatched",
  "video75PercentWatched",
  "video100PercentWatched",
  "videoCompletionRate",
  "hookRate",
  "holdRate",
  "averageWatchTime",
  "retentionRate",
];

const DEMO_CREATIVE_VIDEO_PATHS = {
  "7-day sculptor honest review": "/demo-videos/sculptor-review.mp4",
  "demo-grwm-setup-upgrade": "/demo-videos/grwm-skincare.mp4",
  "demo-lash-appointments": "/demo-videos/lash-appointments.mp4",
  "demo-morning-puffiness-fix": "/demo-videos/morning-puffiness.mp4",
  "demo-seven-day-sculptor-review": "/demo-videos/sculptor-review.mp4",
  "grwm skincare setup upgrade": "/demo-videos/grwm-skincare.mp4",
  "i stopped paying for lash appointments": "/demo-videos/lash-appointments.mp4",
  "morning puffiness fix in 10 seconds": "/demo-videos/morning-puffiness.mp4",
};

export function buildIntegrationStatuses({
  connectedPlatforms = [],
  hasShopifyProducts = false,
} = {}) {
  const connected = new Set(connectedPlatforms);
  return [
    {
      id: "shopify_products",
      label: "Shopify Products",
      status: hasShopifyProducts ? "Active" : "No products loaded",
      tone: hasShopifyProducts ? "connected" : "pending",
      description: hasShopifyProducts
        ? "Real Shopify catalog products available"
        : "Add a product in Shopify or use imported product context",
    },
    {
      id: "shopify_orders",
      label: "Shopify Orders",
      status: "Optional",
      tone: "pending",
      description: "Coming soon — no live order connection is available",
      // TODO: Shopify Orders connector - request read_orders only when the
      // product is ready to ingest order attribution and revenue data.
      todo: "Future connector: Shopify Orders connector with read_orders support.",
    },
    {
      id: "meta_ads",
      label: "Meta Ads",
      status: connected.has("meta") ? "Connected" : "Optional",
      tone: connected.has("meta") ? "connected" : "pending",
      description: connected.has("meta")
        ? "Connected ad metrics source"
        : "Coming soon — use manual CSV import instead",
      // TODO: Meta Ads connector - sync campaign, creative, spend, click,
      // conversion, and revenue metrics into CreativePerformance.
      todo: "Future connector: Meta Ads connector.",
    },
    {
      id: "tiktok_ads",
      label: "TikTok Ads",
      status: connected.has("tiktok") ? "Connected" : "Optional",
      tone: connected.has("tiktok") ? "connected" : "pending",
      description: connected.has("tiktok")
        ? "Connected ad metrics source"
        : "Coming soon — use manual CSV import instead",
      // TODO: TikTok Ads connector - sync ad creative and performance metrics
      // into CreativePerformance.
      todo: "Future connector: TikTok Ads connector.",
    },
    {
      id: "tiktok_shop",
      label: "TikTok Shop Affiliate",
      status: "Optional",
      tone: "pending",
      description: "Coming soon — no live affiliate connection is available",
      // TODO: TikTok Shop Affiliate connector - sync affiliate creator,
      // product, GMV, orders, and video attribution into CreativePerformance.
      todo: "Future connector: TikTok Shop Affiliate connector.",
    },
    {
      id: "google_ads",
      label: "Google Ads",
      status: connected.has("google") ? "Connected" : "Optional",
      tone: connected.has("google") ? "connected" : "pending",
      description: connected.has("google")
        ? "Connected Google Ads campaign metrics"
        : "Optional — connect to sync ad metrics",
    },
    {
      id: "manual_uploads",
      label: "Manual Uploads",
      status: "Manual upload available",
      tone: "available",
      description: "Upload creatives or import a CSV at any time",
    },
  ];
}

export async function listCreativePerformance({
  shop,
  merchantData = { products: [] },
  includeDemo = false,
  limit = 500,
} = {}) {
  const normalizedShop = shop ? normalizeShopIdentifier(shop) : "";
  const [
    savedCreatives,
    videoAnalyses,
    dbPerformanceRecords,
    campaignAssignments,
    platformDailyRecords,
    platformConnections,
  ] = await Promise.all([
    normalizedShop ? listSavedCreatives(normalizedShop, limit) : [],
    normalizedShop ? listVideoAnalyses(normalizedShop, limit) : [],
    normalizedShop
      ? db.creativePerformance.findMany({
          where: { shop: normalizedShop },
          include: { creatorAttribution: { include: { creator: true } } },
          orderBy: [{ reportingDate: "desc" }, { createdAt: "desc" }],
        })
      : [],
    normalizedShop
      ? db.adCampaignCreative.findMany({
          where: { shop: normalizedShop },
          include: { campaign: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
    normalizedShop
      ? db.adPerformanceDaily.findMany({
          where: {
            shop: normalizedShop,
            NOT: { platform: "google", source: "demo", isDemo: true },
          },
          orderBy: [{ reportingDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
      : [],
    normalizedShop
      ? db.adPlatformConnection.findMany({
          where: { shop: normalizedShop },
          select: { platform: true },
        })
      : [],
  ]);
  const savedRecords = [
    ...dbPerformanceRecords.map((record, index) =>
      creativePerformanceDbRecordToPerformance(record, index),
    ),
    ...savedCreatives.map((record, index) =>
      creativeRecordToPerformance(record, index),
    ),
    ...videoAnalyses
      .filter(
        (record) =>
          record.savedToLibrary &&
          !savedCreatives.some(
            (creative) =>
              creative.sourceType === "video_analysis" &&
              creative.sourceId === record.id,
          ),
      )
      .map((record, index) => videoAnalysisToPerformance(record, index)),
  ].filter(Boolean);
  const demoRecords =
    includeDemo && savedRecords.length === 0
      ? demoCreatives.map((creative, index) =>
          demoCreativeToPerformance(creative, index, merchantData.products || []),
        )
      : [];
  const connectedDailyRecords = platformDailyRecords.map((record) => {
    let payload = {};
    try {
      payload = record.payloadJson ? JSON.parse(record.payloadJson) : {};
    } catch {
      payload = {};
    }
    return ({
    id: record.id,
    creativeId: record.campaignId || record.rowKey,
    campaignId: record.campaignId,
    campaignName: record.campaignName,
    adGroupId: record.adGroupId,
    adGroupName: record.adGroupName,
    adId: record.adId,
    adName: record.adName,
    date: record.reportingDate,
    reportingDate: record.reportingDate,
    impressions: record.impressions,
    clicks: record.clicks,
    spend: record.spend,
    conversions: record.conversions,
    revenue: record.revenue,
    conversionValue: payload.conversionValue ?? record.revenue,
    ctr: payload.ctr == null ? null : Number(payload.ctr) * 100,
    cpc: payload.cpc ?? null,
    cpm: payload.cpm ?? null,
    conversionRate:
      payload.conversionRate == null ? null : Number(payload.conversionRate) * 100,
    cpa: payload.cpa ?? null,
    roas: payload.roas ?? null,
    campaignStatus: payload.campaignStatus ?? null,
    engagements: record.engagements,
    videoViews: record.videoViews,
    platform: record.platform === "google" ? "Google Ads" : record.platform,
    sourcePlatform: record.platform,
    source: record.source,
    isDemo: record.isDemo,
    sourceType: record.isDemo ? "demo" : "ad_platform_sync",
    sourceRecordType: "ad_platform_daily",
  });
  });
  const googleAdGrainKeys = new Set(
    connectedDailyRecords
      .filter((record) => record.adId)
      .map((record) => `${record.sourcePlatform}:${record.campaignId}:${new Date(record.reportingDate).toISOString().slice(0, 10)}`),
  );
  const nonOverlappingDailyRecords = connectedDailyRecords.filter((record) => {
    if (record.adId) return true;
    const date = new Date(record.reportingDate);
    if (Number.isNaN(date.getTime())) return true;
    return !googleAdGrainKeys.has(
      `${record.sourcePlatform}:${record.campaignId}:${date.toISOString().slice(0, 10)}`,
    );
  });
  const dailyRecords = connectedDailyRecords.length
    ? nonOverlappingDailyRecords
    : includeDemo && savedRecords.length === 0
      ? buildDemoPerformanceSeries(30)
      : [];
  const assignmentByPerformance = new Map();
  const assignmentBySaved = new Map();
  campaignAssignments.forEach((assignment) => {
    if (assignment.creativePerformanceId && !assignmentByPerformance.has(assignment.creativePerformanceId)) {
      assignmentByPerformance.set(assignment.creativePerformanceId, assignment.campaign);
    }
    if (assignment.savedCreativeId && !assignmentBySaved.has(assignment.savedCreativeId)) {
      assignmentBySaved.set(assignment.savedCreativeId, assignment.campaign);
    }
  });
  const records = dedupePerformanceRecords([...savedRecords, ...demoRecords]).map((record) => {
    const campaign = assignmentByPerformance.get(record.id) || assignmentBySaved.get(record.sourceRecordId);
    return campaign ? {
      ...record,
      workspaceCampaignId: campaign.id,
      workspaceCampaignName: campaign.name,
      campaignName: campaign.name,
    } : record;
  }).sort(
    (left, right) =>
      Date.parse(right.firstSeenAt || 0) - Date.parse(left.firstSeenAt || 0),
  );

  return {
    hasDemoPerformanceData: connectedDailyRecords.some((record) => record.isDemo) || records.some(
      (record) => record.sourcePlatform === "shopify_demo",
    ),
    hasImportedPerformanceData: records.some((record) => {
      const source = `${record.importSource || ""} ${record.sourceRecordType || ""} ${record.sourceType || ""}`.toLowerCase();
      return source.includes("import") || source.includes("csv");
    }),
    hasMeasuredPerformanceData: connectedDailyRecords.some((record) => !record.isDemo) || records.some(
      (record) =>
        record.sourcePlatform !== "shopify_demo" && hasPerformanceMetrics(record),
    ),
    integrationStatuses: buildIntegrationStatuses({
      connectedPlatforms: platformConnections.map(({ platform }) => platform),
      hasShopifyProducts: (merchantData.products || []).some(
        (product) => product?.source !== "demo",
      ),
    }),
    dailyRecords,
    records,
  };
}

function dedupePerformanceRecords(records = []) {
  const byKey = new Map();

  records.forEach((record) => {
    const key =
      record.importKey ||
      record.sourceRecordId ||
      record.sourceCreativeId ||
      record.id;

    if (!key || !byKey.has(key)) {
      byKey.set(key || `record:${byKey.size}`, record);
      return;
    }

    const existing = byKey.get(key);
    byKey.set(key, hasPerformanceMetrics(existing) ? existing : record);
  });

  return [...byKey.values()];
}

function creativePerformanceDbRecordToPerformance(record = {}, index = 0) {
  let payload = {};
  try {
    payload = record.payloadJson ? JSON.parse(record.payloadJson) : {};
  } catch {
    payload = {};
  }
  const persisted = Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined),
  );
  return normalizeCreativePerformance({
    ...payload,
    ...persisted,
    id: record.id || `performance-${index}`,
    adId: record.adId ?? payload.adId,
    adName: record.adName ?? payload.adName ?? payload.creativeName,
    adsetId: record.adsetId ?? payload.adsetId,
    adsetName: record.adsetName ?? payload.adsetName,
    adGroupId: record.adGroupId ?? payload.adGroupId,
    adGroupName: record.adGroupName ?? payload.adGroupName,
    assetUrl: record.assetUrl,
    averageWatchTime: record.averageWatchTime,
    campaignId: record.campaignId ?? payload.campaignId ?? payload.sourceCampaignId,
    campaignName: record.campaignName ?? payload.campaignName ?? payload.campaign,
    clicks: record.clicks,
    comments: record.comments,
    conversionValue: record.conversionValue,
    conversions: record.conversions,
    cpc: record.cpc,
    cpm: record.cpm,
    ctr: record.ctr,
    cvr: record.cvr,
    creativeId: record.creativeId ?? payload.creativeId,
    creativeTitle: record.adName ?? payload.creativeTitle ?? payload.creativeName,
    creativeLaunchDate: payload.creativeLaunchDate ?? payload.launchDate ?? payload.firstSeenDate,
    creatorHandle:
      record.creatorAttribution?.creator?.handle ?? record.creatorHandle ?? payload.creatorHandle,
    creatorName:
      record.creatorAttribution?.creator?.name ?? record.creatorName ?? payload.creatorName,
    creatorPlatform:
      record.creatorAttribution?.creator?.platform ?? payload.creatorPlatform,
    creatorProfileUrl:
      record.creatorAttribution?.creator?.profileUrl ?? payload.creatorProfileUrl,
    creatorType: record.creatorAttribution?.creator?.type ?? payload.creatorType,
    engagements: record.engagements,
    engagementCount: record.engagements,
    firstSeenAt: record.reportingDate || record.createdAt,
    importKey: record.importKey,
    importSource:
      record.sourceRecordType === "public_engagement_import"
        ? "public_engagement_import"
        : record.sourceRecordType === CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
          ? CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
          : record.sourceType,
    importedAt: record.importedAt,
    impressions: record.impressions,
    lastSyncedAt: record.syncedAt || record.updatedAt,
    likes: record.likes,
    orders: record.orders,
    platform: record.platform,
    productHandle: record.productHandle ?? payload.productHandle,
    productId: record.productId ?? payload.productId ?? payload.shopifyProductId,
    productLabel: record.productName ?? payload.productName ?? payload.product,
    productName: record.productName ?? payload.productName ?? payload.product,
    productTitle: record.productName ?? payload.productName ?? payload.product,
    reach: record.reach,
    reportingDate: record.reportingDate ?? payload.reportingDate ?? payload.date,
    revenue: record.revenue,
    roas: record.roas,
    shares: record.shares,
    shopifyProductId: record.productId ?? payload.shopifyProductId,
    sourceCreativeId: record.creativeId || record.sourceRecordId || payload.sourceCreativeId,
    sourcePlatform: normalizeImportPlatform(record.platform || record.sourceType || "csv"),
    sourceRecordId: record.sourceRecordId,
    sourceRecordType: record.sourceRecordType || "creative_performance",
    storageRecordId: record.id,
    storageRecordType: "creative_performance",
    sourceType: record.sourceType,
    sourceUrl: record.sourceUrl,
    spend: record.spend,
    syncStatus:
      record.sourceRecordType === "public_engagement_import"
        ? "imported_public_engagement"
        : "saved_performance",
    syncedAt: record.syncedAt,
    thumbnailUrl: record.thumbnailUrl,
    video100PercentWatched: record.video100PercentWatched,
    video25PercentWatched: record.video25PercentWatched,
    video2SecondViews: record.video2SecondViews,
    video3SecondViews: record.video3SecondViews,
    video50PercentWatched: record.video50PercentWatched,
    video75PercentWatched: record.video75PercentWatched,
    videoUrl: record.videoUrl,
    videoViews: record.videoViews,
  });
}

export async function saveManualCreativePerformance({
  shop,
  product,
  fields = {},
}) {
  const title = cleanText(fields.creativeTitle || fields.title) || "Manual creative";
  const creatorHandle = normalizeHandle(fields.creatorHandle);
  const creatorName =
    cleanText(fields.creatorName) ||
    cleanText(fields.creator) ||
    creatorHandle ||
    "Manual creator";
  const platform = SOURCE_PLATFORMS.includes(fields.sourcePlatform)
    ? fields.sourcePlatform
    : "manual";
  const metrics = normalizeMetrics(fields);
  const now = new Date().toISOString();
  const performance = normalizeCreativePerformance({
    ...metrics,
    angle: cleanText(fields.angle),
    creatorHandle,
    creatorName,
    creativeTitle: title,
    cta: cleanText(fields.cta),
    firstSeenAt: now,
    hook: cleanText(fields.hook),
    lastSyncedAt: now,
    productTitle: product.title,
    shopifyProductId: product.id,
    sourceCampaignId: cleanText(fields.sourceCampaignId),
    sourceCreativeId: cleanText(fields.sourceCreativeId),
    sourcePlatform: platform,
    syncStatus: "manual_entry",
    thumbnailUrl: cleanText(fields.thumbnailUrl),
    transcript: cleanText(fields.transcript),
    videoUrl: cleanText(fields.videoUrl),
  });

  const saved = await saveCreativeRecord(shop, {
    sourceType: "creative_performance_manual",
    sourceId:
      performance.sourceCreativeId ||
      performance.videoUrl ||
      `manual:${product.id}:${title}:${now}`,
    productId: product.id,
    productTitle: product.title,
    title,
    angle: performance.angle || performance.hook || "Manual creative entry",
    payload: {
      ...performance,
      description:
        performance.angle ||
        performance.hook ||
        performance.transcript ||
        "Manual creative entry",
      displayTitle: title,
      mediaState: performance.videoUrl ? "remote_url" : "upload_placeholder",
      mediaUrl: performance.videoUrl,
      source: "manual_creative_entry",
      video_url: performance.videoUrl,
    },
  });

  return creativeRecordToPerformance(saved);
}

export function parsePublicEngagementCsv(csvText = "", { importType = "creative" } = {}) {
  const safeText = String(csvText || "").replace(/^\uFEFF/, "");

  if (!safeText.trim()) {
    return {
      errors: ["Add CSV text or choose a CSV file before previewing."],
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  if (Buffer.byteLength(safeText, "utf8") > MAX_PUBLIC_IMPORT_BYTES) {
    return {
      errors: ["CSV input is larger than the 2 MB import limit."],
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  let parsedRows;

  try {
    parsedRows = parseCsvRows(safeText);
  } catch (error) {
    return {
      errors: [error.message || "Could not parse this CSV."],
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  if (parsedRows.length < 2) {
    return {
      errors: ["CSV needs a header row and at least one data row."],
      headers: parsedRows[0] || [],
      rows: [],
      totalRows: 0,
    };
  }

  const headers = parsedRows[0].map(normalizeHeader);
  const dataRows = parsedRows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()));
  const validatedRows = dataRows.slice(0, MAX_PUBLIC_IMPORT_ROWS).map((row, index) =>
    validatePublicEngagementRow(
      Object.fromEntries(headers.map((header, cellIndex) => [header, sanitizeCsvValue(row[cellIndex])])),
      index + 2,
      importType,
    ),
  );
  const { duplicateRowsMerged, rows } = mergeDuplicateImportRows(validatedRows);
  const errors = [];

  if (dataRows.length > MAX_PUBLIC_IMPORT_ROWS) {
    errors.push(`Only the first ${MAX_PUBLIC_IMPORT_ROWS} rows can be imported at once.`);
  }

  return {
    errors,
    headers,
    duplicateRowsMerged,
    rows,
    totalRows: dataRows.length,
  };
}

function mergeDuplicateImportRows(rows = []) {
  const merged = new Map();
  let duplicateRowsMerged = 0;

  rows.forEach((row) => {
    const key = row.status === "error" ? `row:${row.rowNumber}` : row.record?.importKey;
    const current = key ? merged.get(key) : null;
    if (!current) {
      merged.set(key || `row:${row.rowNumber}`, row);
      return;
    }

    duplicateRowsMerged += 1;
    const record = { ...current.record };
    Object.entries(row.record || {}).forEach(([field, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (typeof value === "number" && typeof record[field] === "number") {
        record[field] = Math.max(record[field], value);
      } else if (record[field] === null || record[field] === undefined || record[field] === "") {
        record[field] = value;
      }
    });
    merged.set(key, {
      ...current,
      record,
      status: "warning",
      warnings: [...new Set([...(current.warnings || []), ...(row.warnings || []), "Duplicate creative/date row merged."])],
    });
  });

  return { duplicateRowsMerged, rows: [...merged.values()] };
}

export async function importPublicEngagementRows({ csvText = "", shop }) {
  const parsed = parsePublicEngagementCsv(csvText);
  const performanceRows = parsed.rows.filter(
    (row) => row.status !== "error" && hasImportedPerformanceFields(row.record),
  ).length;
  const summary = {
    created: 0,
    errors: parsed.errors.length,
    performanceRows,
    skipped: 0,
    updated: 0,
    warnings: parsed.rows.reduce((sum, row) => sum + row.warnings.length, 0),
  };

  if (!shop) {
    return {
      ...parsed,
      summary: {
        ...summary,
        errors: summary.errors + 1,
      },
      ok: false,
      topErrors: ["Authenticated Shopify workspace was not resolved."],
    };
  }

  for (const row of parsed.rows) {
    if (row.status === "error") {
      summary.skipped += 1;
      summary.errors += row.errors.length || 1;
      continue;
    }

    const result = await upsertPublicEngagementRecord(shop, row);
    summary[result] += 1;
  }

  summary.performanceRows = parsed.rows.filter(
    (row) => row.status !== "error" && hasImportedPerformanceFields(row.record),
  ).length;

  return {
    ...parsed,
    ok: summary.created + summary.updated > 0,
    summary,
    topErrors: parsed.rows.flatMap((row) => row.errors).slice(0, 5),
  };
}

export async function upsertPublicEngagementRecord(shop, row) {
  const record = row.record;
  const sourceId = `${shop}:${record.importKey}`;
  const importSource =
    record.importSource === CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
      ? CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
      : "public_engagement_import";
  const sourceRecordType = record.sourceRecordType || importSource;
  const savedSourceType =
    record.savedCreativeSourceType ||
    record.sourceType ||
    (importSource === CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
      ? CREATIVE_UPLOAD_IMPORT_SOURCE_TYPE
      : PUBLIC_ENGAGEMENT_IMPORT_SOURCE_TYPE);
  const reportingDate =
    parseDbDate(record.reportingDate || record.date || record.firstSeenAt) ||
    new Date();
  const productTitle =
    record.productLabel || record.productHandle || "Imported product";
  const productId = record.productHandle
    ? `import-product:${slug(record.productHandle)}`
    : `import-product:${slug(productTitle)}`;
  const title =
    record.creativeTitle ||
    record.adName ||
    record.creativeName ||
    record.videoUrl ||
    "Imported creative";
  const existing = await db.savedCreative.findFirst({
    where: {
      shop,
      sourceType: savedSourceType,
      sourceId,
    },
    orderBy: { createdAt: "desc" },
  });
  const payload = {
    ...record,
    id: sourceId,
    label:
      importSource === CREATIVE_UPLOAD_IMPORT_RECORD_TYPE
        ? "Imported creative + performance"
        : "Merchant-provided public engagement stats",
    sourceCreativeId: sourceId,
    sourcePlatform: record.sourcePlatform,
    shopifyProductId: productId,
    productTitle,
    creativeTitle: title,
    firstSeenAt: record.creativeLaunchDate || reportingDate.toISOString(),
    lastSyncedAt: new Date().toISOString(),
    syncStatus: "imported_public_engagement",
    sourceRecordId: sourceId,
    sourceRecordType,
    sourceType: savedSourceType,
    importSource,
    importKey: record.importKey,
    sourceImportKey: sourceId,
    description:
      record.notes ||
      record.insight ||
      "Merchant-provided public engagement/performance record imported from CSV.",
    mediaState:
      record.mediaState || (record.videoUrl ? "direct_video_url" : "metadata_only"),
    mediaUrl: record.videoUrl || "",
    source: record.source || "merchant_provided_csv",
    video_url: record.videoUrl,
  };
  const data = {
    shop,
    sourceType: savedSourceType,
    sourceId,
    productId,
    productTitle,
    title,
    angle: record.notes || record.campaignName || "Imported public engagement stats",
    payloadJson: JSON.stringify(payload),
    createdAt: reportingDate,
    updatedAt: new Date(),
  };

  if (existing) {
    const savedCreative = await db.savedCreative.update({
      where: { id: existing.id },
      data,
    });
    const performance = await upsertCreativePerformanceMetric(shop, {
      ...record,
      sourceRecordType,
      sourceType: savedSourceType,
    }, sourceId);
    await syncImportedCampaignAssignment(shop, {
      campaignName: record.campaignName,
      externalCampaignId: record.campaignId || record.sourceCampaignId,
      savedCreativeId: savedCreative.id,
      creativePerformanceId: performance?.id,
    });
    await syncCreatorAttribution(shop, record, performance);
    return "updated";
  }

  const savedCreative = await db.savedCreative.create({ data });
  const performance = await upsertCreativePerformanceMetric(shop, {
    ...record,
    sourceRecordType,
    sourceType: savedSourceType,
  }, sourceId);
  await syncImportedCampaignAssignment(shop, {
    campaignName: record.campaignName,
    externalCampaignId: record.campaignId || record.sourceCampaignId,
    savedCreativeId: savedCreative.id,
    creativePerformanceId: performance?.id,
  });
  await syncCreatorAttribution(shop, record, performance);
  return "created";
}

async function syncCreatorAttribution(shop, record, performance) {
  if (!performance || record.createCreatorProfile === false) return;
  const assignment = await db.adCampaignCreative.findFirst({
    where: { shop, creativePerformanceId: performance.id },
    select: { campaignId: true },
    orderBy: { createdAt: "desc" },
  });
  await upsertCreatorAttribution({
    campaignId: assignment?.campaignId || null,
    creativePerformance: performance,
    record,
    shop,
  });
}

async function upsertCreativePerformanceMetric(shop, record, sourceId) {
  if (!db.creativePerformance || !record.importKey) return;

  const data = creativePerformanceDbData(shop, record, sourceId);

  return db.creativePerformance.upsert({
    where: {
      shop_importKey: {
        importKey: record.importKey,
        shop,
      },
    },
    create: data,
    update: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

function creativePerformanceDbData(shop, record, sourceId) {
  return {
    shop,
    creativeId: record.creativeId || record.sourceCreativeId || null,
    platform: record.sourcePlatform || record.platform || null,
    campaignId: record.campaignId || record.sourceCampaignId || null,
    campaignName: record.campaignName || null,
    adsetId: record.adsetId || null,
    adsetName: record.adsetName || null,
    adGroupId: record.adGroupId || null,
    adGroupName: record.adGroupName || null,
    adId: record.adId || null,
    adName: record.adName || record.creativeTitle || record.creativeName || null,
    creatorHandle: record.creatorHandle || null,
    creatorName: record.creatorName || null,
    productId: record.productId || record.shopifyProductId || null,
    productName: record.productName || record.productTitle || record.productLabel || null,
    productHandle: record.productHandle || null,
    thumbnailUrl: record.thumbnailUrl || null,
    videoUrl: record.videoUrl || null,
    assetUrl: record.assetUrl || null,
    sourceUrl: record.sourceUrl || record.videoUrl || null,
    sourceType: record.sourceType || "csv",
    sourceRecordId: sourceId,
    sourceRecordType: record.sourceRecordType || "public_engagement_import",
    importKey: record.importKey,
    reportingDate: parseDbDate(record.reportingDate || record.date || record.firstSeenAt),
    importedAt: parseDbDate(record.importedAt) || new Date(),
    syncedAt: parseDbDate(record.syncedAt || record.lastSyncedAt) || new Date(),
    impressions: nullableNumber(record.impressions),
    reach: nullableNumber(record.reach),
    clicks: nullableNumber(record.clicks),
    spend: nullableNumber(record.spend),
    conversions: nullableNumber(record.conversions),
    orders: nullableNumber(record.orders),
    revenue: nullableNumber(record.revenue),
    conversionValue: nullableNumber(record.conversionValue),
    ctr: nullableNumber(record.ctr),
    cpc: nullableNumber(record.cpc),
    cpm: nullableNumber(record.cpm),
    cvr: nullableNumber(record.conversionRate),
    roas: nullableNumber(record.roas),
    videoViews: nullableNumber(record.videoViews),
    video2SecondViews: nullableNumber(record.video2SecondViews),
    video3SecondViews: nullableNumber(record.video3SecondViews),
    video25PercentWatched: nullableNumber(record.video25PercentWatched),
    video50PercentWatched: nullableNumber(record.video50PercentWatched),
    video75PercentWatched: nullableNumber(record.video75PercentWatched),
    video100PercentWatched: nullableNumber(record.video100PercentWatched),
    averageWatchTime: nullableNumber(record.averageWatchTime),
    engagements: nullableNumber(record.engagementCount),
    likes: nullableNumber(record.likes),
    comments: nullableNumber(record.comments),
    shares: nullableNumber(record.shares),
    payloadJson: JSON.stringify(record),
  };
}

export function normalizeCreativePerformance(input = {}) {
  const aliased = normalizeCreativePerformanceRecord(input, input.sourceType);
  const spend = nullableNumber(aliased.spend);
  const impressions = nullableNumber(aliased.impressions);
  const reach = nullableNumber(aliased.reach);
  const views = nullableNumber(aliased.views);
  const videoViews = nullableNumber(aliased.videoViews ?? aliased.views);
  const clicks = nullableNumber(aliased.clicks);
  const conversions = nullableNumber(aliased.conversions);
  const orders = nullableNumber(aliased.orders);
  const revenue = nullableNumber(aliased.revenue);
  const conversionValue = nullableNumber(aliased.conversionValue);
  const likes = positiveNumber(aliased.likes);
  const comments = positiveNumber(aliased.comments);
  const shares = positiveNumber(aliased.shares);
  const saves = positiveNumber(aliased.saves);
  const reposts = positiveNumber(aliased.reposts);
  const engagementCount =
    nullableNumber(aliased.engagementCount) ?? likes + comments + shares + saves + reposts;
  const conversionsForRate = orders ?? conversions;
  const revenueForRoas = revenue ?? conversionValue;
  const roas =
    nullableNumber(aliased.roas) ??
    (spend && revenueForRoas !== null ? round(revenueForRoas / spend, 2) : null);
  const ctr =
    nullableNumber(aliased.ctr) ??
    (impressions && clicks !== null ? round((clicks / impressions) * 100, 2) : null);
  const conversionRate =
    nullableNumber(aliased.conversionRate) ??
    nullableNumber(aliased.cvr) ??
    (clicks && conversionsForRate !== null ? round((conversionsForRate / clicks) * 100, 2) : null);
  const cpc =
    nullableNumber(aliased.cpc) ??
    (clicks && spend !== null ? round(spend / clicks, 2) : null);
  const cpm =
    nullableNumber(aliased.cpm) ??
    (impressions && spend !== null ? round((spend / impressions) * 1000, 2) : null);
  const videoCompletions = nullableNumber(aliased.video100PercentWatched);
  const videoCompletionRate =
    nullableNumber(aliased.videoCompletionRate) ??
    (videoViews && videoCompletions !== null
      ? round((videoCompletions / videoViews) * 100, 2)
      : null);

  return {
    id: aliased.id || aliased.sourceCreativeId || "",
    wasCreated: Boolean(aliased.wasCreated),
    creativeId: cleanText(aliased.creativeId),
    campaignId: cleanText(aliased.campaignId),
    adsetId: cleanText(aliased.adsetId || aliased.adGroupId),
    adsetName: cleanText(aliased.adsetName || aliased.adGroupName),
    adGroupId: cleanText(aliased.adGroupId || aliased.adsetId),
    adGroupName: cleanText(aliased.adGroupName || aliased.adsetName),
    adId: cleanText(aliased.adId),
    adName: cleanText(aliased.adName),
    sourcePlatform: SOURCE_PLATFORMS.includes(aliased.sourcePlatform)
      ? aliased.sourcePlatform
      : "manual",
    sourceCreativeId: cleanText(aliased.sourceCreativeId || aliased.creativeId),
    sourceCampaignId: cleanText(aliased.sourceCampaignId || aliased.campaignId),
    campaignName: cleanText(aliased.campaignName),
    channel: cleanText(aliased.channel),
    shopifyProductId: cleanText(aliased.shopifyProductId || aliased.productId),
    productTitle: cleanText(aliased.productTitle || aliased.productName),
    productName: cleanText(aliased.productName || aliased.productTitle),
    productId: cleanText(aliased.productId || aliased.shopifyProductId),
    creatorName: cleanText(aliased.creatorName),
    creatorHandle: normalizeHandle(aliased.creatorHandle),
    creatorProfileUrl: cleanText(aliased.creatorProfileUrl),
    creatorPlatform: cleanText(aliased.creatorPlatform),
    creatorType: cleanText(aliased.creatorType),
    creatorEmail: cleanText(aliased.creatorEmail),
    creatorCommission: nullableNumber(aliased.creatorCommission),
    creatorClicks: nullableNumber(aliased.creatorClicks),
    creatorOrders: nullableNumber(aliased.creatorOrders),
    creatorRevenue: nullableNumber(aliased.creatorRevenue),
    creatorSpend: nullableNumber(aliased.creatorSpend),
    creatorNotes: cleanText(aliased.creatorNotes),
    creativeTitle: cleanText(aliased.creativeTitle || aliased.adName || aliased.title),
    creativeLaunchDate: aliased.creativeLaunchDate || "",
    hook: cleanText(aliased.hook),
    angle: cleanText(aliased.angle),
    cta: cleanText(aliased.cta),
    ctaScore: positiveNumber(aliased.ctaScore),
    clarityScore: positiveNumber(aliased.clarityScore),
    creativeScore: positiveNumber(aliased.creativeScore || aliased.score),
    transcript: cleanText(aliased.transcript),
    label: cleanText(aliased.label),
    productHandle: cleanText(aliased.productHandle),
    productLabel: cleanText(aliased.productLabel || aliased.productName),
    hookScore: positiveNumber(aliased.hookScore),
    thumbnailUrl: cleanText(aliased.thumbnailUrl || aliased.thumbnail),
    videoUrl: cleanText(
      firstPlayableVideoUrl(
        aliased.videoUrl,
        aliased.video_url,
        aliased.mediaUrl,
        aliased.assetUrl,
        aliased.sourceUrl,
        aliased.creativeUrl,
      ),
    ),
    assetUrl: cleanText(aliased.assetUrl),
    sourceUrl: cleanText(aliased.sourceUrl),
    sourceType: cleanText(aliased.sourceType),
    videoFilename: cleanText(aliased.videoFilename),
    spend,
    impressions,
    reach,
    views,
    videoViews,
    video2SecondViews: nullableNumber(aliased.video2SecondViews),
    video3SecondViews: nullableNumber(aliased.video3SecondViews),
    video25PercentWatched: nullableNumber(aliased.video25PercentWatched),
    video50PercentWatched: nullableNumber(aliased.video50PercentWatched),
    video75PercentWatched: nullableNumber(aliased.video75PercentWatched),
    video100PercentWatched: videoCompletions,
    videoCompletionRate,
    likes,
    comments,
    shares,
    saves,
    reposts,
    engagementCount,
    clicks,
    orders,
    conversions,
    revenue,
    conversionValue,
    roas,
    ctr,
    cpc,
    cpm,
    conversionRate,
    engagementRate:
      nullableNumber(aliased.engagementRate) ??
      (views ? round((engagementCount / views) * 100, 2) : null),
    hookRate: nullableNumber(aliased.hookRate),
    holdRate: nullableNumber(aliased.holdRate),
    averageWatchTime: nullableNumber(aliased.averageWatchTime),
    retentionRate: nullableNumber(aliased.retentionRate),
    reportingDate: aliased.reportingDate || aliased.date || aliased.firstSeenAt || "",
    importedAt: aliased.importedAt || aliased.createdAt || "",
    syncedAt: aliased.syncedAt || aliased.lastSyncedAt || aliased.updatedAt || "",
    firstSeenAt: aliased.firstSeenAt || aliased.reportingDate || aliased.date || aliased.createdAt || new Date().toISOString(),
    lastSyncedAt: aliased.lastSyncedAt || aliased.syncedAt || aliased.updatedAt || aliased.createdAt || "",
    syncStatus: cleanText(aliased.syncStatus || "manual"),
    importSource: cleanText(aliased.importSource),
    importKey: cleanText(aliased.importKey),
    notes: cleanText(aliased.notes),
    source: cleanText(aliased.source),
    utmSource: cleanText(aliased.utmSource),
    utmMedium: cleanText(aliased.utmMedium),
    utmCampaign: cleanText(aliased.utmCampaign),
    sourceRecordId: cleanText(aliased.sourceRecordId),
    sourceRecordType: cleanText(aliased.sourceRecordType),
    storageRecordId: cleanText(aliased.storageRecordId),
    storageRecordType: cleanText(aliased.storageRecordType),
  };
}

export function summarizeCreativePerformance(records = []) {
  const totals = records.reduce(
    (summary, record) => {
      summary.spend += positiveNumber(record.spend);
      summary.impressions += positiveNumber(record.impressions);
      summary.views += positiveNumber(record.views);
      summary.videoViews += positiveNumber(record.videoViews);
      summary.videoCompletions += positiveNumber(record.video100PercentWatched);
      summary.clicks += positiveNumber(record.clicks);
      summary.orders += positiveNumber(record.orders);
      summary.conversions += positiveNumber(record.conversions ?? record.orders);
      summary.revenue += positiveNumber(record.revenue ?? record.conversionValue);
      return summary;
    },
    {
      clicks: 0,
      conversions: 0,
      impressions: 0,
      orders: 0,
      revenue: 0,
      spend: 0,
      videoCompletions: 0,
      videoViews: 0,
      views: 0,
    },
  );

  return {
    ...totals,
    averageCpc: totals.clicks && totals.spend ? round(totals.spend / totals.clicks, 2) : null,
    averageCpm:
      totals.impressions && totals.spend
        ? round((totals.spend / totals.impressions) * 1000, 2)
        : null,
    conversionRate: totals.clicks ? round((totals.conversions / totals.clicks) * 100, 2) : null,
    ctr: totals.impressions ? round((totals.clicks / totals.impressions) * 100, 2) : null,
    roas: totals.spend ? round(totals.revenue / totals.spend, 2) : null,
    videoCompletionRate:
      totals.videoViews ? round((totals.videoCompletions / totals.videoViews) * 100, 2) : null,
  };
}

export function hasPerformanceMetrics(record = {}) {
  return [
    "spend",
    "impressions",
    "reach",
    "views",
    "videoViews",
    "video2SecondViews",
    "video3SecondViews",
    "video25PercentWatched",
    "video50PercentWatched",
    "video75PercentWatched",
    "video100PercentWatched",
    "likes",
    "comments",
    "shares",
    "saves",
    "reposts",
    "engagementCount",
    "clicks",
    "orders",
    "conversions",
    "revenue",
    "conversionValue",
    "roas",
    "conversionRate",
  ].some((key) => positiveNumber(record[key]) > 0);
}

export function platformLabel(platform = "") {
  const labels = {
    manual: "Manual Upload",
    video_analysis: "AI Review Studio",
    public_engagement_import: "Public Engagement Import",
    tiktok: "TikTok import",
    instagram: "Instagram import",
    instagram_reels: "Instagram Reels import",
    youtube: "YouTube import",
    youtube_shorts: "YouTube Shorts import",
    meta: "Meta import",
    meta_ads: "Meta Ads",
    shopify_demo: DEMO_PERFORMANCE_DATA_LABEL,
    tiktok_ads: "TikTok Ads",
    tiktok_shop: "TikTok Shop Affiliate",
  };

  return labels[platform] || "Manual Upload";
}

function creativeRecordToPerformance(record = {}, index = 0) {
  const payload = record.payload || {};
  const result = payload.fullResult?.result || payload.fullResult || payload.result || {};
  const analysis = payload.analysis || result.analysis || {};
  const performance = payload.sourcePlatform
    ? payload
    : {
        angle: record.angle || payload.angle || payload.insight || payload.summary,
        creatorHandle: payload.creatorHandle || payload.creator,
        creatorName: payload.creatorName || payload.creator,
        creativeTitle:
          payload.displayTitle || payload.generatedTitle || record.title,
        cta: payload.cta,
        firstSeenAt: record.createdAt,
        hook: payload.hook || analysis.hook_type,
        hookScore: analysis.hook_score || analysis.hookScore,
        clarityScore: analysis.clarity_score || analysis.clarityScore,
        ctaScore: analysis.cta_score || analysis.ctaScore,
        creativeScore:
          analysis.overall_score ||
          analysis.overallScore ||
          analysis.creative_score ||
          analysis.creativeScore ||
          analysis.readinessScore,
        lastSyncedAt: record.updatedAt || record.createdAt,
        productTitle: record.productTitle || payload.productTitle,
        shopifyProductId: record.productId || payload.shopifyProductId,
        sourceCreativeId: record.sourceId || record.id,
        sourcePlatform:
          record.sourceType === "video_analysis" ? "video_analysis" : "manual",
        syncStatus: payload.syncStatus || "saved_in_app",
        thumbnailUrl: payload.thumbnailUrl || payload.thumbnail,
        transcript: payload.transcript || payload.transcript_summary || payload.brief,
        videoUrl: payload.videoUrl || payload.video_url || payload.mediaUrl,
        videoFilename: payload.originalFilename || payload.fileName,
        ...normalizeMetrics(payload),
      };

  return normalizeCreativePerformance({
    ...performance,
    id: record.id || `saved-${index}`,
    sourceRecordId: record.id || "",
    sourceRecordType: "saved_creative",
    storageRecordId: record.id || "",
    storageRecordType: "saved_creative",
    wasCreated: record.wasCreated,
  });
}

function videoAnalysisToPerformance(record = {}, index = 0) {
  const payload = record.payload || {};
  const result = payload.result || payload;
  const analysis = result.analysis || payload.analysis || {};
  const display = result.display || {};
  const media = result.media || {};
  const metadata = result.metadata || {};

  return normalizeCreativePerformance({
    id: `analysis-${record.id || index}`,
    angle: analysis.summary || record.angle,
    creatorName: analysis.creator_style || "Uploaded creative",
    creativeTitle:
      display.displayTitle ||
      display.generatedTitle ||
      record.fileName ||
      `${record.productTitle || "Uploaded product"} analysis`,
    cta: analysis.cta || "",
    firstSeenAt: record.createdAt,
    hook: analysis.hook_type || "",
    lastSyncedAt: record.updatedAt || record.createdAt,
    productTitle: record.productTitle,
    shopifyProductId: record.productId,
    sourceCreativeId: record.id,
    sourcePlatform: "video_analysis",
    sourceRecordId: record.id || "",
    sourceRecordType: "video_analysis",
    storageRecordId: record.id || "",
    storageRecordType: "video_analysis",
    syncStatus: "analysis_only",
    thumbnailUrl: "",
    transcript: result.transcript?.full_text || payload.brief || "",
    videoUrl: media.mediaUrl || metadata.media_url || "",
    videoFilename: record.fileName || display.originalFilename || "",
  });
}

function demoCreativeToPerformance(creative = {}, index = 0, products = []) {
  const enriched = enrichDemoCreative(creative);
  const product =
    products.find((candidate) => candidate.title === enriched.productTitle) ||
    products.find((candidate) => candidate.handle === enriched.productHandle) ||
    {};
  const clicks = positiveNumber(enriched.clicks);
  const orders = positiveNumber(enriched.orders);
  const revenue = positiveNumber(enriched.revenue);
  const spend = positiveNumber(enriched.spend);
  const views = positiveNumber(enriched.views);
  const impressions = Math.round(views * 1.18);

  return normalizeCreativePerformance({
    id: enriched.id,
    angle: enriched.angle,
    creatorHandle: enriched.creatorHandle,
    creatorName: enriched.creatorName,
    creativeScore: enriched.score,
    creativeTitle: enriched.title,
    cta: enriched.cta,
    firstSeenAt: new Date(Date.now() - index * 86400000).toISOString(),
    hook: enriched.hook,
    hookScore: enriched.hookScore,
    clarityScore: enriched.clarityScore,
    ctaScore: enriched.ctaScore,
    impressions,
    lastSyncedAt: new Date().toISOString(),
    orders,
    productHandle: enriched.productHandle,
    productTitle: product.title || enriched.productTitle,
    revenue,
    shopifyProductId: product.id || "",
    sourceCampaignId: `demo-campaign-${index + 1}`,
    sourceCreativeId: enriched.id,
    sourcePlatform: "shopify_demo",
    sourceRecordId: enriched.id,
    sourceRecordType: "demo_performance",
    spend,
    syncStatus: DEMO_PERFORMANCE_LABEL,
    thumbnailUrl: enriched.thumbnailUrl || product.featuredImage?.url || "",
    transcript: enriched.transcriptSummary,
    label: DEMO_PERFORMANCE_LABEL,
    videoUrl: enriched.videoUrl || demoVideoUrlForCreative(enriched),
    views,
    clicks,
    roas: enriched.roas,
    conversionRate: enriched.conversionRate,
  });
}

function demoVideoUrlForCreative(creative = {}) {
  const url =
    DEMO_CREATIVE_VIDEO_PATHS[cleanText(creative.id)] ||
    DEMO_CREATIVE_VIDEO_PATHS[cleanText(creative.title).toLowerCase()];

  if (!url) return "";

  const publicPath = path.join(process.cwd(), "public", url.replace(/^\//, ""));

  return existsSync(publicPath) ? url : "";
}

function normalizeMetrics(input = {}) {
  return {
    clicks: nullableNumber(input.clicks),
    conversionRate: nullableNumber(input.conversionRate),
    comments: positiveNumber(input.comments),
    cpc: nullableNumber(input.cpc),
    cpm: nullableNumber(input.cpm),
    ctr: nullableNumber(input.ctr),
    engagementCount: positiveNumber(input.engagementCount),
    engagementRate: positiveNumber(input.engagementRate),
    hookRate: nullableNumber(input.hookRate),
    holdRate: nullableNumber(input.holdRate),
    impressions: nullableNumber(input.impressions),
    likes: positiveNumber(input.likes),
    orders: nullableNumber(input.orders),
    averageWatchTime: nullableNumber(input.averageWatchTime),
    reposts: positiveNumber(input.reposts),
    retentionRate: nullableNumber(input.retentionRate),
    revenue: nullableNumber(input.revenue),
    roas: nullableNumber(input.roas),
    saves: positiveNumber(input.saves),
    shares: positiveNumber(input.shares),
    spend: nullableNumber(input.spend),
    views: nullableNumber(input.views),
    video100PercentWatched: nullableNumber(input.video100PercentWatched),
    video25PercentWatched: nullableNumber(input.video25PercentWatched),
    video50PercentWatched: nullableNumber(input.video50PercentWatched),
    video75PercentWatched: nullableNumber(input.video75PercentWatched),
    videoViews: nullableNumber(input.videoViews),
  };
}

export function normalizeCreativePerformanceRecord(input = {}, sourceType = "") {
  const source = sourceType || input.sourceType || input.source_type || input.importSource || "";
  const normalized = {};

  Object.entries(input || {}).forEach(([key, value]) => {
    normalized[normalizeObjectKey(key)] = value;
  });

  return {
    ...normalized,
    adGroupId: pickFirst(normalized.adGroupId, normalized.adsetId),
    adGroupName: pickFirst(normalized.adGroupName, normalized.adsetName),
    adId: pickFirst(normalized.adId, normalized.sourceAdId),
    adName: pickFirst(normalized.adName, normalized.creativeName, normalized.creativeTitle),
    assetUrl: pickFirst(normalized.assetUrl, normalized.mediaUrl),
    averageWatchTime: pickFirst(normalized.averageWatchTime, normalized.avgWatchTime),
    campaignId: pickFirst(normalized.campaignId, normalized.sourceCampaignId),
    campaignName: pickFirst(normalized.campaignName, normalized.campaign),
    creativeLaunchDate: pickFirst(
      normalized.creativeLaunchDate,
      normalized.launchDate,
      normalized.firstSeenDate,
    ),
    conversionRate: pickFirst(normalized.conversionRate, normalized.cvr),
    conversionValue: pickFirst(normalized.conversionValue, normalized.purchaseValue),
    conversions: pickFirst(normalized.conversions, normalized.purchases),
    creativeId: pickFirst(normalized.creativeId, normalized.sourceCreativeId),
    creativeTitle: pickFirst(normalized.creativeTitle, normalized.creativeName, normalized.adName),
    creatorHandle: pickFirst(normalized.creatorHandle, normalized.handle, normalized.promoterHandle, normalized.influencerHandle),
    date: pickFirst(normalized.date, normalized.performanceDate, normalized.reportingDate, normalized.day),
    engagementCount: pickFirst(normalized.engagementCount, normalized.engagements),
    importedAt: pickFirst(normalized.importedAt, normalized.createdAt),
    orders: pickFirst(normalized.orders, normalized.orderCount),
    platform: pickFirst(normalized.platform, normalized.sourcePlatform, normalized.channel),
    productHandle: pickFirst(normalized.productHandle),
    productId: pickFirst(normalized.productId, normalized.shopifyProductId),
    productName: pickFirst(normalized.productName, normalized.productTitle, normalized.productLabel),
    productTitle: pickFirst(normalized.productTitle, normalized.productName, normalized.productLabel),
    revenue: pickFirst(normalized.revenue, normalized.sales, normalized.conversionValue),
    sourcePlatform: normalizeImportPlatform(
      pickFirst(normalized.sourcePlatform, normalized.platform, normalized.channel, source),
    ),
    sourceType: cleanText(source || normalized.sourceType || "csv"),
    sourceUrl: pickFirst(
      normalized.sourceUrl,
      normalized.creativeUrl,
      normalized.postUrl,
      normalized.url,
      normalized.videoUrl,
    ),
    syncedAt: pickFirst(normalized.syncedAt, normalized.lastSyncedAt, normalized.updatedAt),
    video100PercentWatched: pickFirst(normalized.video100PercentWatched, normalized.completions),
    videoViews: pickFirst(normalized.videoViews, normalized.views),
    views: pickFirst(normalized.views, normalized.videoViews),
  };
}

function validatePublicEngagementRow(input, rowNumber, importType = "creative") {
  const creatorMode = importType === "creator";
  const row = {
    ...input,
    ad_group_id: input.ad_group_id || input.adset_id,
    ad_group_name: input.ad_group_name || input.adset_name,
    ad_name: input.ad_name || input.ad || input.creative_name,
    campaign_name: input.campaign_name || input.campaign,
    conversion_rate: input.conversion_rate || input.conversionrate,
    creative_id: input.creative_id || input.source_creative_id,
    creative_name: input.creative_name || input.ad_name || input.creative_title || input.title,
    creator_handle:
      input.creator_handle ||
      (String(input.creator || "").trim().startsWith("@") ? input.creator : ""),
    creator_name:
      input.creator_name ||
      (String(input.creator || "").trim().startsWith("@") ? "" : input.creator),
    date:
      input.date ||
      input.performance_date ||
      input.reporting_date ||
      input.day ||
      input.created_at ||
      input.first_seen_at,
    creative_launch_date:
      input.creative_launch_date ||
      input.launch_date ||
      input.first_seen_date ||
      input.first_seen_at,
    engagement_rate: input.engagement_rate || input.engagementrate,
    creator_engagement_rate:
      input.creator_engagement_rate || input.engagement_rate || input.engagementrate,
    platform: input.platform || input.source_platform || input.channel,
    product_id: input.product_id || input.shopify_product_id,
    product_handle: input.product_handle,
    product_name: input.product_name || input.product_label || input.product_title || input.product,
    source_type: input.source_type || input.source,
    source_url: input.source_url || input.creative_url || input.post_url || input.url,
    video_url: input.video_url || input.media_url,
    video_filename:
      input.video_filename ||
      input.video_file_name ||
      input.file_name ||
      input.filename ||
      input.asset_filename ||
      input.creative_filename,
  };
  const errors = [];
  const warnings = [];
  const creativeName = cleanImportText(row.creative_name);
  const rawVideoUrl = cleanImportText(row.video_url);
  const rawAssetUrl = cleanImportText(row.asset_url);
  const rawSourceUrl = cleanImportText(row.source_url);
  const rawCreativeUrl = cleanImportText(row.creative_url);
  const videoUrl = firstPlayableVideoUrl(
    rawVideoUrl,
    rawAssetUrl,
    rawSourceUrl,
    rawCreativeUrl,
  );
  const platform = cleanImportText(row.platform);
  const date = parseImportDate(row.date);
  const creativeLaunchDate = parseImportDate(row.creative_launch_date);
  const metrics = {};

  for (const field of NUMERIC_IMPORT_FIELDS) {
    const rawValue = row[field];

    if (!creatorMode && ZERO_DEFAULT_FIELDS.includes(field) && !String(rawValue || "").trim()) {
      metrics[field] = 0;
      continue;
    }

    const parsed = parseImportNumber(rawValue, {
      nullable: OPTIONAL_PERFORMANCE_FIELDS.includes(field),
    });

    if (parsed.error) {
      errors.push(`${field} must be a non-negative number.`);
    }

    metrics[field] = parsed.value;
  }

  if (!creatorMode) for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!cleanImportText(row[field])) errors.push(`${field} is required.`);
  }

  if (!creatorMode && !creativeName && !videoUrl) {
    errors.push("creative_name or video_url/post_url is required.");
  }

  if (!creatorMode && !date) errors.push("date must be a valid date.");
  if (cleanImportText(row.creative_launch_date) && !creativeLaunchDate) {
    errors.push("creative_launch_date must be a valid date when provided.");
  }
  if (creatorMode && cleanImportText(row.date) && !date) {
    errors.push("reporting_date must be a valid date when provided.");
  }

  if (!cleanImportText(row.creator_handle) && !cleanImportText(row.creator_name)) {
    (creatorMode ? errors : warnings).push(
      creatorMode
        ? "creator_handle or creator_name is required."
        : "creator_handle or creator_name is recommended for creator attribution.",
    );
  }

  if (!creatorMode && !cleanImportText(row.product_handle) && !cleanImportText(row.product_name)) {
    warnings.push("product_handle or product_name is recommended for product planning.");
  }

  if (!creatorMode) for (const field of RECOMMENDED_IMPORT_FIELDS) {
    if (
      !["product_handle", "product_label"].includes(field) &&
      !String(row[field] || "").trim()
    ) {
      warnings.push(`${field} is recommended.`);
    }
  }

  const engagementParts = [
    metrics.likes,
    metrics.comments,
    metrics.shares,
    metrics.saves,
    metrics.reposts,
  ].filter((value) => value !== null && value !== undefined);
  const engagementCount =
    metrics.engagements ??
    (engagementParts.length
      ? engagementParts.reduce((sum, value) => sum + Number(value), 0)
      : null);
  const impressions = metrics.impressions;
  const clicks = metrics.clicks;
  const orders = metrics.orders ?? metrics.conversions;
  const revenue = metrics.revenue ?? metrics.conversion_value;
  const spend = metrics.spend;
  const sourcePlatform = normalizeImportPlatform(platform);
  const record = normalizeCreativePerformance({
    platform,
    sourcePlatform,
    creativeId: cleanImportText(row.creative_id),
    campaignId: cleanImportText(row.campaign_id),
    campaignName: cleanImportText(row.campaign_name),
    adsetId: cleanImportText(row.adset_id || row.ad_group_id),
    adsetName: cleanImportText(row.adset_name || row.ad_group_name),
    adGroupId: cleanImportText(row.ad_group_id || row.adset_id),
    adGroupName: cleanImportText(row.ad_group_name || row.adset_name),
    adId: cleanImportText(row.ad_id),
    adName: cleanImportText(row.ad_name),
    creativeName,
    creativeLaunchDate: creativeLaunchDate ? creativeLaunchDate.toISOString() : "",
    videoUrl,
    creatorHandle: normalizeHandle(row.creator_handle),
    creatorName: cleanImportText(row.creator_name),
    creatorProfileUrl: cleanImportText(row.creator_profile_url),
    creatorPlatform: cleanImportText(row.creator_platform || row.platform),
    creatorType: cleanImportText(row.creator_type),
    creatorEmail: cleanImportText(row.creator_email),
    creatorCommission: metrics.creator_commission,
    creatorClicks: metrics.creator_clicks,
    creatorOrders: metrics.creator_orders,
    creatorRevenue: metrics.creator_revenue,
    creatorSpend: metrics.creator_spend,
    creatorNotes: cleanImportText(row.creator_notes),
    productId: cleanImportText(row.product_id),
    productHandle: cleanImportText(row.product_handle),
    productName: cleanImportText(row.product_name),
    productLabel: cleanImportText(row.product_name),
    date: date ? date.toISOString() : "",
    reportingDate: date ? date.toISOString() : "",
    views: metrics.views ?? metrics.video_views,
    videoViews: metrics.video_views ?? metrics.views,
    reach: metrics.reach,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    reposts: metrics.reposts,
    engagementCount,
    engagementRate: metrics.creator_engagement_rate ?? metrics.engagement_rate,
    clicks: clicks ?? metrics.creator_clicks,
    orders: orders ?? metrics.creator_orders,
    revenue: revenue ?? metrics.creator_revenue,
    spend: spend ?? metrics.creator_spend,
    impressions,
    conversions: metrics.conversions,
    conversionValue: metrics.conversion_value,
    conversionRate: metrics.conversion_rate ?? metrics.cvr,
    ctr: metrics.ctr,
    cpc: metrics.cpc,
    cpm: metrics.cpm,
    roas: metrics.roas,
    video2SecondViews: metrics.video_2_second_views,
    video3SecondViews: metrics.video_3_second_views,
    video25PercentWatched: metrics.video_25_percent_watched,
    video50PercentWatched: metrics.video_50_percent_watched,
    video75PercentWatched: metrics.video_75_percent_watched,
    video100PercentWatched: metrics.video_100_percent_watched,
    hookRate: metrics.hook_rate,
    holdRate: metrics.hold_rate,
    averageWatchTime: metrics.average_watch_time,
    retentionRate: metrics.retention_rate,
    assetUrl: rawAssetUrl,
    thumbnailUrl: cleanImportText(row.thumbnail_url),
    sourceUrl: rawSourceUrl || rawCreativeUrl || rawVideoUrl,
    sourceType: cleanImportText(row.source_type || "csv"),
    source: cleanImportText(row.source),
    videoFilename: cleanImportText(row.video_filename),
    utmSource: cleanImportText(row.utm_source),
    utmMedium: cleanImportText(row.utm_medium),
    utmCampaign: cleanImportText(row.utm_campaign),
    angle: cleanImportText(row.best_angle || row.angle),
    notes: cleanImportText(row.notes || row.insight || row.creator_notes),
  });

  // Preserve the normalized CSV platform instead of allowing the generic CSV
  // source type to collapse a recognized ad platform to "manual".
  record.sourcePlatform = sourcePlatform;

  record.importKey = buildPublicEngagementImportKey(record, creatorMode ? "creator-performance" : "public-engagement");
  if (!hasImportedPerformanceFields(record)) {
    warnings.push(
      "Deeper performance metrics were not included, so revenue/spend/order metrics will show as not imported.",
    );
  }

  return {
    errors,
    record,
    rowNumber,
    status: errors.length ? "error" : warnings.length ? "warning" : "ready",
    warnings,
  };
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => String(cell || "").trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error("CSV has an unterminated quoted value.");

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => String(cell || "").trim())) rows.push(row);
  }

  return rows;
}

function parseImportDate(value) {
  const text = cleanImportText(value);
  if (!text) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00Z` : text;
  const date = new Date(dateOnly);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseImportNumber(value, { nullable = false } = {}) {
  const text = String(value || "").trim();
  if (!text) return { value: nullable ? null : 0 };
  const normalized = text.replace(/[$,%]/g, "").replace(/,/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    return { error: true, value: 0 };
  }
  return { value: number };
}

function sanitizeCsvValue(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function cleanImportText(value) {
  return sanitizeCsvValue(value).slice(0, 500);
}

function normalizeHeader(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const aliases = {
    ad_spend: "spend",
    ad: "ad_name",
    ad_title: "ad_name",
    amount_spent: "spend",
    average_watch_time: "average_watch_time",
    averagewatchtime: "average_watch_time",
    avg_view_duration: "average_watch_time",
    avg_watch_time: "average_watch_time",
    campaign: "campaign_name",
    ad_campaign: "campaign_name",
    adcampaign: "campaign_name",
    campaign_title: "campaign_name",
    channel: "platform",
    completions: "video_100_percent_watched",
    conversionrate: "conversion_rate",
    conversion_value: "conversion_value",
    cost: "spend",
    creator: "creator_name",
    creative_id: "creative_id",
    creativeid: "creative_id",
    creative_title: "creative_name",
    day: "date",
    performance_date: "date",
    reporting_date: "date",
    launch_date: "creative_launch_date",
    first_seen_date: "creative_launch_date",
    cvr: "conversion_rate",
    engagementrate: "engagement_rate",
    external_creative_id: "creative_id",
    handle: "creator_handle",
    impression_count: "impressions",
    influencer_handle: "creator_handle",
    link_clicks: "clicks",
    order_count: "orders",
    outbound_clicks: "clicks",
    post_url: "video_url",
    creative_url: "creative_url",
    creativeurl: "creative_url",
    product: "product_name",
    product_label: "product_name",
    product_title: "product_name",
    promoter_handle: "creator_handle",
    purchase_count: "conversions",
    purchase_value: "revenue",
    purchases: "conversions",
    quartile_25: "video_25_percent_watched",
    quartile_50: "video_50_percent_watched",
    quartile_75: "video_75_percent_watched",
    revenue_usd: "revenue",
    sales: "revenue",
    source_platform: "platform",
    asset_filename: "video_filename",
    creative_filename: "video_filename",
    file_name: "video_filename",
    filename: "video_filename",
    video_file_name: "video_filename",
    video_filename: "video_filename",
    video_p25: "video_25_percent_watched",
    video_p50: "video_50_percent_watched",
    video_p75: "video_75_percent_watched",
    video_p100: "video_100_percent_watched",
    views: "video_views",
    "25_percent_watched": "video_25_percent_watched",
    "50_percent_watched": "video_50_percent_watched",
    "75_percent_watched": "video_75_percent_watched",
    "100_percent_watched": "video_100_percent_watched",
  };

  return aliases[normalized] || normalized;
}

export function isPlayableVideoUrl(value) {
  const url = cleanText(value);

  if (!url) return false;

  const withoutQuery = url.split(/[?#]/)[0].toLowerCase();

  return PLAYABLE_VIDEO_EXTENSIONS.some((extension) =>
    withoutQuery.endsWith(extension),
  );
}

function firstPlayableVideoUrl(...values) {
  return cleanText(values.find(isPlayableVideoUrl) || "");
}

function normalizeObjectKey(value) {
  const header = normalizeHeader(value);
  const camel = header.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
  const aliases = {
    cvr: "conversionRate",
    sourcePlatform: "sourcePlatform",
    video2SecondViews: "video2SecondViews",
    video3SecondViews: "video3SecondViews",
    video25PercentWatched: "video25PercentWatched",
    video50PercentWatched: "video50PercentWatched",
    video75PercentWatched: "video75PercentWatched",
    video100PercentWatched: "video100PercentWatched",
  };

  return aliases[camel] || camel;
}

function pickFirst(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && String(value).trim() !== "",
  );
}

function normalizeImportPlatform(value) {
  const normalized = normalizeHeader(value);
  if (["tiktok", "tik_tok"].includes(normalized)) return "tiktok";
  if (["instagram", "instagram_reels", "reels"].includes(normalized)) return "instagram_reels";
  if (["youtube", "youtube_shorts", "shorts"].includes(normalized)) return "youtube_shorts";
  if (["meta", "facebook"].includes(normalized)) return "meta";
  return normalized || "public_engagement_import";
}

function buildPublicEngagementImportKey(record, prefix = "public-engagement") {
  return `${prefix}:${crypto
    .createHash("sha256")
    .update(
      [
        record.sourcePlatform,
        record.creativeId,
        record.videoFilename,
        record.videoUrl,
        record.creativeName,
        record.creatorHandle,
        record.creatorName,
        record.campaignName,
        record.productHandle || record.productLabel,
        record.angle,
        record.date?.slice(0, 10),
      ]
        .join("|")
        .toLowerCase(),
    )
    .digest("hex")
    .slice(0, 24)}`;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function positiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseDbDate(value) {
  const date = parseImportDate(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function hasImportedPerformanceFields(record = {}) {
  return DEEPER_PERFORMANCE_KEYS.some(
    (key) => record[key] !== null && record[key] !== undefined && record[key] !== "",
  );
}

function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeHandle(value) {
  const text = cleanText(value).replace(/^'(?=@)/, "");
  if (!text) return "";
  return text.startsWith("@") ? text : `@${text}`;
}
