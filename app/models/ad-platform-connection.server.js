import crypto from "node:crypto";
import prisma from "../db.server.js";
import { encryptToken } from "../utils/token-encryption.server.js";

const SUPPORTED_PLATFORMS = new Set(["tiktok", "meta", "google"]);
export const GOOGLE_ADS_PLATFORM = "google";

function normalizePlatform(platform) {
  const normalized = String(platform || "").trim().toLowerCase();

  if (!SUPPORTED_PLATFORMS.has(normalized)) {
    throw new Error(`Unsupported ad platform: ${platform || "unknown"}.`);
  }

  return normalized;
}

export function normalizeShopIdentifier(shop) {
  const normalized = String(shop || "").trim().toLowerCase();
  if (!normalized) throw new Error("A Shopify shop is required.");
  return normalized;
}

function optionalJson(value) {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function connectionTokenData(input, { requireToken = false } = {}) {
  const data = {};

  if (input.accessToken) {
    data.encryptedAccessToken = encryptToken(String(input.accessToken));
  }

  if (Object.hasOwn(input, "refreshToken")) {
    data.encryptedRefreshToken = input.refreshToken
      ? encryptToken(String(input.refreshToken))
      : null;
  }

  if (requireToken && !input.accessToken && !input.refreshToken) {
    throw new Error("An access token or refresh token is required to create a connection.");
  }

  if (Object.hasOwn(input, "tokenExpiresAt")) {
    data.tokenExpiresAt = input.tokenExpiresAt
      ? new Date(input.tokenExpiresAt)
      : null;
  }

  return data;
}

export async function createConnection(shop, input, { client = prisma } = {}) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const platform = normalizePlatform(input.platform);
  const tokenData = connectionTokenData(input, { requireToken: true });
  const sharedData = {
    status: input.status || "connected",
    googleAccountEmail: input.googleAccountEmail || null,
    externalAccountId: input.externalAccountId
      ? String(input.externalAccountId)
      : null,
    externalAccountName: input.externalAccountName
      ? String(input.externalAccountName)
      : null,
    scopes: Array.isArray(input.scopes)
      ? input.scopes.join(",")
      : input.scopes || null,
    metadataJson: optionalJson(input.metadata),
    lastSyncError: null,
    ...tokenData,
  };

  return client.adPlatformConnection.upsert({
    where: { shop_platform: { shop: normalizedShop, platform } },
    create: { shop: normalizedShop, platform, ...sharedData },
    update: sharedData,
  });
}

export function getConnectionsForShop(shop) {
  return prisma.adPlatformConnection.findMany({
    where: { shop: normalizeShopIdentifier(shop), status: { not: "disconnected" } },
    orderBy: { updatedAt: "desc" },
  });
}

export function getConnectionByPlatform(shop, platform) {
  return prisma.adPlatformConnection.findUnique({
    where: {
      shop_platform: {
        shop: normalizeShopIdentifier(shop),
        platform: normalizePlatform(platform),
      },
    },
  });
}

export function updateConnectionTokens(shop, platform, input) {
  return prisma.adPlatformConnection.update({
    where: {
      shop_platform: {
        shop: normalizeShopIdentifier(shop),
        platform: normalizePlatform(platform),
      },
    },
    data: connectionTokenData(input),
  });
}

export function updateConnectionAccount(shop, platform, input) {
  return prisma.adPlatformConnection.update({
    where: {
      shop_platform: {
        shop: normalizeShopIdentifier(shop),
        platform: normalizePlatform(platform),
      },
    },
    data: {
      status: input.externalAccountId ? "connected" : "needs_account_selection",
      externalAccountId: input.externalAccountId
        ? String(input.externalAccountId)
        : null,
      externalAccountName: input.externalAccountName
        ? String(input.externalAccountName)
        : null,
      metadataJson: optionalJson(input.metadata),
    },
  });
}

export function disconnectPlatform(shop, platform) {
  return prisma.adPlatformConnection.deleteMany({
    where: {
      shop: normalizeShopIdentifier(shop),
      platform: normalizePlatform(platform),
    },
  });
}

function dailyRowKey(row) {
  if (row.rowKey) return String(row.rowKey);

  return crypto
    .createHash("sha256")
    .update(
      [
        row.externalAccountId,
        new Date(row.reportingDate).toISOString().slice(0, 10),
        row.campaignId || "",
        row.adGroupId || "",
        row.adId || "",
      ].join(":"),
    )
    .digest("hex");
}

function normalizeDailyRow({ connection, row }) {
  if (!row.externalAccountId || !row.reportingDate) {
    throw new Error(
      "Each daily performance row requires externalAccountId and reportingDate.",
    );
  }

  const reportingDate = new Date(row.reportingDate);
  if (Number.isNaN(reportingDate.getTime())) {
    throw new Error("Daily performance reportingDate must be a valid date.");
  }
  reportingDate.setUTCHours(0, 0, 0, 0);

  const fields = [
    "externalAccountName",
    "campaignId",
    "campaignName",
    "adGroupId",
    "adGroupName",
    "adId",
    "adName",
    "currencyCode",
    "impressions",
    "reach",
    "clicks",
    "spend",
    "conversions",
    "revenue",
    "videoViews",
    "engagements",
  ];
  const data = {
    connectionId: connection.id,
    shop: connection.shop,
    platform: connection.platform,
    rowKey: dailyRowKey({ ...row, reportingDate }),
    externalAccountId: String(row.externalAccountId),
    reportingDate,
    payloadJson: optionalJson(row.payload),
    source: row.source === "demo" ? "demo" : "live",
    isDemo: row.isDemo === true,
  };

  for (const field of fields) {
    data[field] = row[field] ?? null;
  }

  return data;
}

export async function upsertDailyAdPerformanceRows(
  shop,
  platform,
  rows,
) {
  const connection = await getConnectionByPlatform(shop, platform);
  if (!connection) throw new Error("Connect the ad platform before syncing data.");

  const normalizedRows = rows.map((row) =>
    normalizeDailyRow({ connection, row }),
  );

  await prisma.$transaction(
    normalizedRows.map((data) =>
      prisma.adPerformanceDaily.upsert({
        where: {
          shop_platform_rowKey: {
            shop: data.shop,
            platform: data.platform,
            rowKey: data.rowKey,
          },
        },
        create: data,
        update: data,
      }),
    ),
  );

  await prisma.adPlatformConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date(), lastSyncError: null },
  });

  return { count: normalizedRows.length };
}

export function recordConnectionSyncError(connectionId, error) {
  return prisma.adPlatformConnection.update({
    where: { id: connectionId },
    data: { lastSyncError: String(error?.message || error) },
  });
}

const GOOGLE_ADS_DEMO_ADS = [
  { campaignId: "demo-search", campaignName: "Brand Search — Core Products", adGroupId: "demo-search-brand", adGroupName: "Brand + Product", adId: "demo-search-responsive", adName: "Responsive search — Shop best sellers", baseImpressions: 1850, ctr: 0.071, cpc: 1.42, conversionRate: 0.079, averageOrderValue: 82 },
  { campaignId: "demo-pmax", campaignName: "Performance Max — New Customers", adGroupId: "demo-pmax-assets", adGroupName: "Lifestyle creative assets", adId: "demo-pmax-lifestyle", adName: "Lifestyle product collection", baseImpressions: 5100, ctr: 0.024, cpc: 0.94, conversionRate: 0.047, averageOrderValue: 76 },
  { campaignId: "demo-retargeting", campaignName: "Display — Cart Retargeting", adGroupId: "demo-retargeting-cart", adGroupName: "7-day cart visitors", adId: "demo-retargeting-offer", adName: "Complete your order", baseImpressions: 2900, ctr: 0.013, cpc: 0.68, conversionRate: 0.064, averageOrderValue: 88 },
];

export function buildGoogleAdsDemoRows({ days = 30, endDate = new Date() } = {}) {
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  const rows = [];

  for (let day = 0; day < days; day += 1) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - day);
    GOOGLE_ADS_DEMO_ADS.forEach((ad, index) => {
      const activityFactor = 0.82 + ((day * 7 + index * 11) % 35) / 100;
      const impressions = Math.round(ad.baseImpressions * activityFactor);
      const clicks = Math.round(impressions * ad.ctr);
      const spend = Number((clicks * ad.cpc).toFixed(2));
      const conversions = Number((clicks * ad.conversionRate).toFixed(2));
      const conversionValue = Number((conversions * ad.averageOrderValue).toFixed(2));
      rows.push({
        ...ad,
        date,
        reportingDate: date,
        rowKey: `demo:google:${date.toISOString().slice(0, 10)}:${ad.adId}`,
        externalAccountId: "blueprintai-demo-google-ads",
        externalAccountName: "BluePrintAI Google Ads demo",
        currencyCode: "USD",
        impressions,
        clicks,
        spend,
        costMicros: Math.round(spend * 1_000_000),
        conversions,
        conversionValue,
        revenue: conversionValue,
        ctr: clicks / impressions,
        cpc: clicks ? spend / clicks : 0,
        roas: spend ? conversionValue / spend : 0,
        source: "demo",
        isDemo: true,
      });
    });
  }
  return rows;
}

export async function seedGoogleAdsDemoData(shop, { client = prisma, endDate } = {}) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
  });
  if (!connection?.externalAccountId) {
    throw new Error("Connect and select a Google Ads account before loading demo data.");
  }
  const rows = buildGoogleAdsDemoRows({ endDate });
  await client.$transaction(rows.map((row) => {
    const data = normalizeDailyRow({ connection, row: {
      ...row,
      payload: { source: "demo", isDemo: true, costMicros: row.costMicros, conversionValue: row.conversionValue, ctr: row.ctr, cpc: row.cpc, roas: row.roas },
    } });
    return client.adPerformanceDaily.upsert({
      where: { shop_platform_rowKey: { shop: data.shop, platform: data.platform, rowKey: data.rowKey } },
      create: data,
      update: data,
    });
  }));
  return { count: rows.length };
}

export async function clearGoogleAdsDemoData(shop, { client = prisma } = {}) {
  return client.adPerformanceDaily.deleteMany({
    where: {
      shop: normalizeShopIdentifier(shop),
      platform: GOOGLE_ADS_PLATFORM,
      source: "demo",
      isDemo: true,
    },
  });
}

export function countGoogleAdsDemoRows(shop) {
  return prisma.adPerformanceDaily.count({
    where: {
      shop: normalizeShopIdentifier(shop),
      platform: GOOGLE_ADS_PLATFORM,
      source: "demo",
      isDemo: true,
    },
  });
}

export function countGoogleAdsLiveRows(shop) {
  return prisma.adPerformanceDaily.count({
    where: {
      shop: normalizeShopIdentifier(shop),
      platform: GOOGLE_ADS_PLATFORM,
      source: "live",
      isDemo: false,
    },
  });
}
