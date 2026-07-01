import db from "../db.server.js";
import { syncImportedCampaignAssignment } from "./campaign.server.js";

export function normalizeCreatorHandle(value = "") {
  const normalized = normalizeCreatorText(value).replace(/^@/, "");
  return normalized || null;
}

export function normalizeCreatorName(value = "") {
  const normalized = normalizeCreatorText(value).replace(/[^a-z0-9]+/g, "");
  return normalized || null;
}

export function creatorIdentityFromRecord(record = {}) {
  const normalizedHandle = normalizeCreatorHandle(record.creatorHandle);
  const normalizedName = normalizeCreatorName(record.creatorName);
  const platform = normalizeCreatorText(
    record.creatorPlatform || record.sourcePlatform || record.platform,
  );
  const normalizedPlatformName =
    platform && normalizedName ? `${platform}:${normalizedName}` : null;

  return {
    key:
      (normalizedHandle && `handle:${normalizedHandle}`) ||
      (normalizedName && `name:${normalizedName}`) ||
      normalizedPlatformName,
    normalizedHandle,
    normalizedName,
    normalizedPlatformName,
  };
}

export function summarizeCreatorPreview(rows = [], existingCreators = []) {
  const usableRows = rows.filter((row) => row.status !== "error");
  const identities = usableRows.map((row) => creatorIdentityFromRecord(row.record));
  const detected = identities.filter((identity) => identity.key);
  const uniqueIdentities = new Map(
    detected.map((identity) => [identity.key, identity]),
  );
  const existingKeys = new Set(
    existingCreators.flatMap((creator) => [
      creator.normalizedHandle && `handle:${creator.normalizedHandle}`,
      creator.normalizedName && `name:${creator.normalizedName}`,
      creator.normalizedPlatformName,
    ].filter(Boolean)),
  );
  let updatedCreators = 0;

  uniqueIdentities.forEach((identity) => {
    if ([
      identity.normalizedHandle && `handle:${identity.normalizedHandle}`,
      identity.normalizedName && `name:${identity.normalizedName}`,
      identity.normalizedPlatformName,
    ].filter(Boolean).some((key) => existingKeys.has(key))) updatedCreators += 1;
  });

  return {
    creatorsDetected: uniqueIdentities.size,
    duplicateCreatorRowsMerged: detected.length - uniqueIdentities.size,
    missingCreatorIdentity: identities.filter((identity) => !identity.key).length,
    newCreators: uniqueIdentities.size - updatedCreators,
    updatedCreators,
  };
}

export async function listCreatorProfiles(shop) {
  if (!shop || !db.creator) return [];
  return db.creator.findMany({
    where: { shop },
    include: {
      attributions: {
        include: { creativePerformance: true, campaign: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertCreatorAttribution({
  campaignId = null,
  creativePerformance,
  record,
  shop,
}) {
  if (!db.creator || !db.creatorAttribution || !creativePerformance) return null;
  const identity = creatorIdentityFromRecord(record);
  if (!identity.key) return null;

  const creator = await findCreatorByIdentity(shop, identity);
  const profile = creatorProfileData(record, identity);
  const savedCreator = creator
    ? await db.creator.update({
        where: { id: creator.id },
        data: mergeCreatorProfile(creator, profile),
      })
    : await db.creator.create({ data: { shop, ...profile } });

  const attribution = await db.creatorAttribution.upsert({
    where: { creativePerformanceId: creativePerformance.id },
    create: {
      shop,
      creatorId: savedCreator.id,
      creativePerformanceId: creativePerformance.id,
      campaignId,
      clicks: nullableNumber(record.creatorClicks ?? record.clicks),
      orders: nullableNumber(record.creatorOrders ?? record.orders),
      revenue: nullableNumber(record.creatorRevenue ?? record.revenue),
      spend: nullableNumber(record.creatorSpend ?? record.spend),
    },
    update: {
      creatorId: savedCreator.id,
      campaignId,
      clicks: nullableNumber(record.creatorClicks ?? record.clicks),
      orders: nullableNumber(record.creatorOrders ?? record.orders),
      revenue: nullableNumber(record.creatorRevenue ?? record.revenue),
      spend: nullableNumber(record.creatorSpend ?? record.spend),
      updatedAt: new Date(),
    },
  });

  return { attribution, creator: savedCreator };
}

export async function upsertCreatorPerformanceRecord({ record, shop }) {
  if (!shop || !record?.importKey) throw new Error("Creator performance row is missing an import key.");

  const existing = await db.creativePerformance.findUnique({
    where: { shop_importKey: { shop, importKey: record.importKey } },
    select: { id: true },
  });
  const data = {
    shop,
    platform: cleanText(record.creatorPlatform || record.sourcePlatform || record.platform),
    campaignId: cleanText(record.campaignId || record.sourceCampaignId),
    campaignName: cleanText(record.campaignName),
    creatorHandle: cleanText(record.creatorHandle),
    creatorName: cleanText(record.creatorName),
    productId: cleanText(record.productId || record.shopifyProductId),
    productName: cleanText(record.productName || record.productTitle || record.productLabel),
    sourceType: "creator_performance_csv",
    sourceRecordId: `${shop}:${record.importKey}`,
    sourceRecordType: "creator_performance_import",
    importKey: record.importKey,
    reportingDate: parseOptionalDate(record.reportingDate || record.date),
    importedAt: new Date(),
    syncedAt: new Date(),
    clicks: nullableNumber(record.creatorClicks ?? record.clicks),
    spend: nullableNumber(record.creatorSpend ?? record.spend),
    conversions: nullableNumber(record.creatorOrders ?? record.conversions),
    orders: nullableNumber(record.creatorOrders ?? record.orders),
    revenue: nullableNumber(record.creatorRevenue ?? record.revenue),
    conversionValue: nullableNumber(record.creatorRevenue ?? record.conversionValue),
    cvr: safeRatioPercent(
      record.creatorOrders ?? record.orders,
      record.creatorClicks ?? record.clicks,
    ),
    roas: safeRatio(record.creatorRevenue ?? record.revenue, record.creatorSpend ?? record.spend),
    payloadJson: JSON.stringify({
      ...record,
      importSource: "creator_performance_import",
      sourceRecordType: "creator_performance_import",
      sourceType: "creator_performance_csv",
    }),
  };
  const performance = await db.creativePerformance.upsert({
    where: { shop_importKey: { shop, importKey: record.importKey } },
    create: data,
    update: { ...data, updatedAt: new Date() },
  });
  const campaign = await syncImportedCampaignAssignment(shop, {
    campaignName: record.campaignName,
    externalCampaignId: record.campaignId || record.sourceCampaignId,
    creativePerformanceId: performance.id,
  });
  await upsertCreatorAttribution({
    campaignId: campaign?.id || null,
    creativePerformance: performance,
    record,
    shop,
  });

  return { performance, result: existing ? "updated" : "created" };
}

async function findCreatorByIdentity(shop, identity) {
  if (identity.normalizedHandle) {
    const byHandle = await db.creator.findUnique({
      where: {
        shop_normalizedHandle: {
          shop,
          normalizedHandle: identity.normalizedHandle,
        },
      },
    });
    if (byHandle) return byHandle;
  }

  if (identity.normalizedName) {
    const byName = await db.creator.findFirst({
      where: { shop, normalizedName: identity.normalizedName },
      orderBy: { updatedAt: "desc" },
    });
    if (byName) return byName;
  }

  if (identity.normalizedPlatformName) {
    return db.creator.findFirst({
      where: { shop, normalizedPlatformName: identity.normalizedPlatformName },
      orderBy: { updatedAt: "desc" },
    });
  }

  return null;
}

function creatorProfileData(record, identity) {
  return {
    handle: cleanText(record.creatorHandle),
    normalizedHandle: identity.normalizedHandle,
    name: cleanText(record.creatorName) || cleanText(record.creatorHandle),
    normalizedName: identity.normalizedName,
    normalizedPlatformName: identity.normalizedPlatformName,
    profileUrl: cleanText(record.creatorProfileUrl),
    platform: cleanText(record.creatorPlatform || record.sourcePlatform || record.platform),
    type: cleanText(record.creatorType),
    email: cleanText(record.creatorEmail),
    commission: nullableNumber(record.creatorCommission),
    notes: cleanText(record.creatorNotes),
  };
}

function mergeCreatorProfile(existing, incoming) {
  return Object.fromEntries(
    Object.entries(incoming).map(([key, value]) => [
      key,
      value === null || value === "" ? existing[key] : value,
    ]),
  );
}

function normalizeCreatorText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeRatio(numerator, denominator) {
  const top = nullableNumber(numerator);
  const bottom = nullableNumber(denominator);
  return top !== null && bottom !== null && bottom > 0
    ? Number((top / bottom).toFixed(2))
    : null;
}

function safeRatioPercent(numerator, denominator) {
  const ratio = safeRatio(numerator, denominator);
  return ratio === null ? null : Number((ratio * 100).toFixed(2));
}
