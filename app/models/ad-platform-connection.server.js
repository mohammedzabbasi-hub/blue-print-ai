import crypto from "node:crypto";
import prisma from "../db.server";
import { encryptToken } from "../utils/token-encryption.server";

const SUPPORTED_PLATFORMS = new Set(["tiktok", "meta", "google"]);

function normalizePlatform(platform) {
  const normalized = String(platform || "").trim().toLowerCase();

  if (!SUPPORTED_PLATFORMS.has(normalized)) {
    throw new Error(`Unsupported ad platform: ${platform || "unknown"}.`);
  }

  return normalized;
}

function requireShop(shop) {
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

export async function createConnection(shop, input) {
  const normalizedShop = requireShop(shop);
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

  return prisma.adPlatformConnection.upsert({
    where: { shop_platform: { shop: normalizedShop, platform } },
    create: { shop: normalizedShop, platform, ...sharedData },
    update: sharedData,
  });
}

export function getConnectionsForShop(shop) {
  return prisma.adPlatformConnection.findMany({
    where: { shop: requireShop(shop) },
    orderBy: { updatedAt: "desc" },
  });
}

export function getConnectionByPlatform(shop, platform) {
  return prisma.adPlatformConnection.findUnique({
    where: {
      shop_platform: {
        shop: requireShop(shop),
        platform: normalizePlatform(platform),
      },
    },
  });
}

export function updateConnectionTokens(shop, platform, input) {
  return prisma.adPlatformConnection.update({
    where: {
      shop_platform: {
        shop: requireShop(shop),
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
        shop: requireShop(shop),
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
      shop: requireShop(shop),
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
