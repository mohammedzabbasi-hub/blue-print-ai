import db from "../db.server.js";

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
