#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const seedDir = path.join(rootDir, "seed");
const DEV_STORE_DOMAIN = "blueprintai-test-store.myshopify.com";
const SOURCE_TYPE = "creative_performance_seed";

await main();

async function main() {
  await loadDotEnv();

  const shop = normalizeShop(process.env.SHOPIFY_SHOP || DEV_STORE_DOMAIN);
  guardDevStore(shop);

  const rows = await readCsv("blueprintai-local-performance.csv");
  const prisma = new PrismaClient();
  const summary = { created: 0, updated: 0, skipped: 0 };

  try {
    for (const row of rows) {
      const result = await upsertPerformanceRecord(prisma, shop, row);
      summary[result] += 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("");
  console.log("BluePrintAI local performance seed summary");
  console.log("------------------------------------------");
  console.log(`Shop: ${shop}`);
  console.log(`Created: ${summary.created}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log("");
  console.log("These are app-local demo performance records, separate from Shopify Admin Analytics.");
}

async function upsertPerformanceRecord(prisma, shop, row) {
  const performanceId = row.performanceId?.trim();
  if (!performanceId) {
    console.warn("Skipped local performance row with no performanceId.");
    return "skipped";
  }

  const productHandle = row.productHandle?.trim();
  const productTitle = row.productTitle?.trim() || productHandle || "Demo product";
  const date = normalizeDate(row.date);
  const sourceId = `blueprintai-local:${performanceId}`;
  const payload = buildPayload(row, { date, performanceId, productHandle, productTitle });
  const existing = await prisma.savedCreative.findFirst({
    where: {
      shop,
      sourceType: SOURCE_TYPE,
      sourceId,
    },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    shop,
    sourceType: SOURCE_TYPE,
    sourceId,
    productId: `seed-product:${productHandle}`,
    productTitle,
    title: row.creativeTitle || `${productTitle} demo creative`,
    angle: row.angle || row.hook || "Seeded BluePrintAI performance record",
    payloadJson: JSON.stringify(payload),
    createdAt: date,
    updatedAt: new Date(),
  };

  let result;
  if (existing) {
    await prisma.savedCreative.update({
      where: { id: existing.id },
      data,
    });
    console.log(`Updated local performance ${performanceId} (${productTitle}).`);
    result = "updated";
  } else {
    await prisma.savedCreative.create({ data });
    console.log(`Created local performance ${performanceId} (${productTitle}).`);
    result = "created";
  }

  await prisma.creativePerformance.upsert({
    where: { shop_importKey: { shop, importKey: `seed:${performanceId}` } },
    create: buildPerformanceData(shop, row, { date, performanceId, payload, productHandle, productTitle }),
    update: {
      ...buildPerformanceData(shop, row, { date, performanceId, payload, productHandle, productTitle }),
      updatedAt: new Date(),
    },
  });
  return result;
}

function buildPerformanceData(shop, row, { date, performanceId, payload, productHandle, productTitle }) {
  const impressions = numberValue(row.impressions);
  const clicks = numberValue(row.clicks);
  const orders = numberValue(row.orders);
  const revenue = numberValue(row.revenue);
  const spend = numberValue(row.spend);
  return {
    shop,
    creativeId: row.creativeId || row.creativeFilename || performanceId,
    platform: normalizeSourcePlatform(row.sourcePlatform),
    campaignId: row.campaignId || slug(row.campaignName),
    campaignName: row.campaignName || "",
    adName: row.creativeTitle || row.creativeFilename || performanceId,
    creatorHandle: normalizeHandle(row.creatorHandle),
    creatorName: row.creatorName || row.creatorHandle || "Demo creator",
    productName: productTitle,
    productHandle,
    sourceType: SOURCE_TYPE,
    sourceRecordId: `blueprintai-local:${performanceId}`,
    sourceRecordType: "blueprintai_local_performance_seed",
    importKey: `seed:${performanceId}`,
    reportingDate: date,
    importedAt: new Date(),
    syncedAt: new Date(),
    impressions,
    clicks,
    spend,
    orders,
    revenue,
    ctr: impressions ? round((clicks / impressions) * 100, 2) : null,
    cvr: clicks ? round((orders / clicks) * 100, 2) : null,
    roas: spend ? round(revenue / spend, 2) : null,
    videoViews: numberValue(row.views),
    payloadJson: JSON.stringify({
      ...payload,
      videoFilename: row.creativeFilename || "",
      creativeLaunchDate: normalizeDate(row.creativeLaunchDate || row.date).toISOString(),
      reportingDate: date.toISOString(),
    }),
  };
}

function buildPayload(row, { date, performanceId, productHandle, productTitle }) {
  const spend = numberValue(row.spend);
  const clicks = numberValue(row.clicks);
  const orders = numberValue(row.orders);
  const revenue = numberValue(row.revenue);

  return {
    id: performanceId,
    label: "BluePrintAI local demo performance",
    sourcePlatform: normalizeSourcePlatform(row.sourcePlatform),
    sourceCreativeId: performanceId,
    sourceCampaignId: slug(row.campaignName || performanceId),
    shopifyProductId: `seed-product:${productHandle}`,
    productHandle,
    productTitle,
    creatorName: row.creatorName || row.creatorHandle || "Demo creator",
    creatorHandle: normalizeHandle(row.creatorHandle),
    creativeTitle: row.creativeTitle || `${productTitle} demo creative`,
    hook: row.hook || "",
    angle: row.angle || "",
    cta: row.cta || "",
    channel: row.channel || "",
    campaignName: row.campaignName || "",
    videoFilename: row.creativeFilename || "",
    creativeLaunchDate: normalizeDate(row.creativeLaunchDate || row.date).toISOString(),
    reportingDate: date.toISOString(),
    firstSeenAt: date.toISOString(),
    lastSyncedAt: new Date().toISOString(),
    syncStatus: "seeded_blueprintai_local_demo",
    sourceRecordId: performanceId,
    sourceRecordType: "blueprintai_local_performance_seed",
    views: numberValue(row.views),
    impressions: numberValue(row.impressions),
    clicks,
    spend,
    orders,
    revenue,
    roas: numberValue(row.roas) || (spend ? round(revenue / spend, 2) : 0),
    conversionRate:
      numberValue(row.conversionRate) || (clicks ? round((orders / clicks) * 100, 2) : 0),
    engagementRate: numberValue(row.engagementRate),
    description: row.angle || row.hook || "Seeded BluePrintAI local performance record.",
    mediaState: "seeded_performance_only",
    source: "blueprintai_local_performance_seed",
  };
}

async function readCsv(fileName) {
  const filePath = path.join(seedDir, fileName);
  const content = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(content);

  if (rows.length === 0) {
    throw new Error(`${fileName} has no data rows.`);
  }

  return rows;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), dataRow[index]?.trim() || ""])),
  );
}

function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");

  return fs
    .readFile(envPath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) process.env[key] = rest.join("=").replace(/^"|"$/g, "");
      }
    })
    .catch(() => {});
}

function normalizeDate(value) {
  const date = value ? new Date(`${value}T12:00:00-04:00`) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function normalizeShop(shop) {
  return String(shop || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function guardDevStore(shop) {
  if (shop !== DEV_STORE_DOMAIN) {
    throw new Error(
      `Refusing to seed ${shop || "(unknown store)"}. This script only targets ${DEV_STORE_DOMAIN}.`,
    );
  }
}

function normalizeSourcePlatform(value) {
  const normalized = String(value || "manual").trim();
  return ["manual", "shopify_demo", "meta_ads", "tiktok_ads", "tiktok_shop"].includes(normalized)
    ? normalized
    : "manual";
}

function normalizeHandle(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.startsWith("@") ? text : `@${text}`;
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
