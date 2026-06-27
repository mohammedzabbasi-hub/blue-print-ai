import db from "../db.server.js";
import { CAMPAIGN_GOALS, CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES } from "./campaign-options.js";
import { aggregateEffectiveness } from "../utils/ad-effectiveness.js";

export function normalizeCampaignName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function clean(value, max = 5000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function campaignData(input = {}) {
  const name = clean(input.name, 160);
  if (!name) throw new Error("Campaign name is required.");
  const status = CAMPAIGN_STATUSES.includes(input.status) ? input.status : "draft";
  const requestedObjective = input.objective;
  const objective = CAMPAIGN_GOALS.includes(requestedObjective)
    ? requestedObjective
    : "awareness";
  const platformAliases = {
    instagram_reels: "instagram",
    manual: "other",
    meta_ads: "meta",
    mixed: "other",
    youtube_shorts: "youtube",
  };
  const requestedPlatform = platformAliases[input.platform] || input.platform;
  const platform = CAMPAIGN_PLATFORMS.includes(requestedPlatform)
    ? requestedPlatform
    : "other";
  const budgetText = String(input.budget ?? "").trim();
  const budget = budgetText === "" ? null : Number(budgetText);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error("Budget must be zero or a positive number.");
  }
  const startDate = dateOrNull(input.startDate);
  const endDate = dateOrNull(input.endDate);
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be on or after the start date.");
  }
  return {
    name,
    normalizedName: normalizeCampaignName(name),
    description: clean(input.description),
    status,
    objective,
    platform,
    primaryProductName: clean(input.primaryProductName, 300),
    startDate,
    endDate,
    budget,
    targetAudience: clean(input.targetAudience),
    notes: clean(input.notes, 10000),
    externalCampaignId: clean(input.externalCampaignId, 500),
  };
}

export async function createCampaign(shop, input) {
  const data = campaignData(input);
  try {
    return await db.adCampaign.create({ data: { shop, ...data } });
  } catch (error) {
    if (error?.code === "P2002") throw new Error("A campaign with this name already exists.");
    throw error;
  }
}

export async function updateCampaign(shop, id, input) {
  const existing = await db.adCampaign.findFirst({ where: { id, shop } });
  if (!existing) throw new Error("Campaign was not found.");
  try {
    return await db.adCampaign.update({ where: { id }, data: campaignData(input) });
  } catch (error) {
    if (error?.code === "P2002") throw new Error("A campaign with this name already exists.");
    throw error;
  }
}

export async function deleteCampaign(shop, id) {
  const campaign = await db.adCampaign.findFirst({ where: { id, shop } });
  if (!campaign) throw new Error("Campaign was not found.");
  await db.adCampaign.delete({ where: { id } });
  return campaign;
}

export async function ensureImportedCampaign(shop, { campaignName, externalCampaignId } = {}) {
  const name = clean(campaignName, 160);
  const externalId = clean(externalCampaignId, 500);
  if (!name && !externalId) return null;
  let campaign = externalId
    ? await db.adCampaign.findFirst({ where: { shop, externalCampaignId: externalId } })
    : null;
  if (!campaign && name) {
    campaign = await db.adCampaign.findUnique({
      where: { shop_normalizedName: { shop, normalizedName: normalizeCampaignName(name) } },
    });
  }
  if (campaign) {
    if (externalId && !campaign.externalCampaignId) {
      campaign = await db.adCampaign.update({ where: { id: campaign.id }, data: { externalCampaignId: externalId } });
    }
    return campaign;
  }
  return createCampaign(shop, {
    name: name || `Imported campaign ${externalId}`,
    externalCampaignId: externalId,
    status: "active",
    platform: "other",
    description: "Created automatically from imported campaign data.",
  });
}

export async function assignCampaignRecords(shop, campaignId, {
  savedCreativeIds = [], creativePerformanceIds = [], replace = true,
} = {}) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, shop } });
  if (!campaign) throw new Error("Campaign was not found.");
  const savedIds = [...new Set(savedCreativeIds.filter(Boolean))];
  const performanceIds = [...new Set(creativePerformanceIds.filter(Boolean))];
  const [saved, performance] = await Promise.all([
    db.savedCreative.findMany({
      where: { shop, id: { in: savedIds } },
      select: { id: true, sourceId: true },
    }),
    db.creativePerformance.findMany({
      where: { shop, id: { in: performanceIds } },
      select: { id: true, sourceRecordId: true },
    }),
  ]);
  const requestedSavedIds = saved.map((record) => record.id);
  const requestedPerformanceIds = performance.map((record) => record.id);
  const existingAssignments = requestedSavedIds.length || requestedPerformanceIds.length
    ? await db.adCampaignCreative.findMany({
        where: {
          campaignId,
          shop,
          OR: [
            ...(requestedSavedIds.length ? [{ savedCreativeId: { in: requestedSavedIds } }] : []),
            ...(requestedPerformanceIds.length ? [{ creativePerformanceId: { in: requestedPerformanceIds } }] : []),
          ],
        },
        select: { savedCreativeId: true, creativePerformanceId: true },
      })
    : [];
  const alreadySaved = new Set(existingAssignments.map((item) => item.savedCreativeId).filter(Boolean));
  const alreadyPerformance = new Set(existingAssignments.map((item) => item.creativePerformanceId).filter(Boolean));
  const validSavedIds = requestedSavedIds.filter((id) => !alreadySaved.has(id));
  const validPerformanceIds = requestedPerformanceIds.filter((id) => !alreadyPerformance.has(id));
  const validSaved = saved.filter((record) => validSavedIds.includes(record.id));
  const validPerformance = performance.filter((record) => validPerformanceIds.includes(record.id));
  const pairedPerformanceIds = new Set();
  const pairs = validSaved.flatMap((savedRecord) => {
    const performanceRecord = validPerformance.find(
      (record) =>
        !pairedPerformanceIds.has(record.id) &&
        (record.sourceRecordId === savedRecord.id ||
          (savedRecord.sourceId && record.sourceRecordId === savedRecord.sourceId)),
    );

    if (!performanceRecord) return [];
    pairedPerformanceIds.add(performanceRecord.id);
    return [{
      creativePerformanceId: performanceRecord.id,
      savedCreativeId: savedRecord.id,
    }];
  });
  const pairedSavedIds = new Set(pairs.map((pair) => pair.savedCreativeId));
  const unpairedSavedIds = validSavedIds.filter((id) => !pairedSavedIds.has(id));
  const unpairedPerformanceIds = validPerformanceIds.filter(
    (id) => !pairedPerformanceIds.has(id),
  );
  await db.$transaction(async (tx) => {
    if (replace && (validSavedIds.length || validPerformanceIds.length)) {
      await tx.adCampaignCreative.deleteMany({
        where: {
          shop,
          OR: [
            ...(validSavedIds.length ? [{ savedCreativeId: { in: validSavedIds } }] : []),
            ...(validPerformanceIds.length ? [{ creativePerformanceId: { in: validPerformanceIds } }] : []),
          ],
        },
      });
    }
    for (const pair of pairs) {
      await tx.adCampaignCreative.create({
        data: { shop, campaignId, ...pair },
      });
    }
    for (const savedCreativeId of unpairedSavedIds) {
      await tx.adCampaignCreative.create({ data: { shop, campaignId, savedCreativeId } });
    }
    for (const creativePerformanceId of unpairedPerformanceIds) {
      await tx.adCampaignCreative.create({ data: { shop, campaignId, creativePerformanceId } });
    }
  });
  return {
    campaign,
    assigned: pairs.length + unpairedSavedIds.length + unpairedPerformanceIds.length,
  };
}

export async function syncImportedCampaignAssignment(shop, {
  campaignName, externalCampaignId, savedCreativeId, creativePerformanceId,
} = {}) {
  const campaign = await ensureImportedCampaign(shop, { campaignName, externalCampaignId });
  if (!campaign) return null;
  await db.$transaction(async (tx) => {
    await tx.adCampaignCreative.deleteMany({
      where: { shop, OR: [
        ...(savedCreativeId ? [{ savedCreativeId }] : []),
        ...(creativePerformanceId ? [{ creativePerformanceId }] : []),
      ] },
    });
    await tx.adCampaignCreative.create({
      data: { shop, campaignId: campaign.id, savedCreativeId: savedCreativeId || null, creativePerformanceId: creativePerformanceId || null },
    });
  });
  return campaign;
}

export async function removeCampaignAssignment(shop, assignmentId) {
  const assignment = await db.adCampaignCreative.findFirst({ where: { id: assignmentId, shop } });
  if (!assignment) throw new Error("Campaign assignment was not found.");
  await db.adCampaignCreative.delete({ where: { id: assignment.id } });
}

export function aggregateCampaignPerformance(records = []) {
  const summary = aggregateEffectiveness(records);
  const metricValue = (metric) =>
    summary[metric]?.imported ? summary[metric].value : null;

  return {
    clicks: metricValue("clicks"),
    comments: metricValue("comments"),
    engagements: metricValue("engagements"),
    engagementRate: metricValue("engagementRate"),
    impressions: metricValue("impressions"),
    reach: metricValue("reach"),
    likes: metricValue("likes"),
    orders: metricValue("orders"),
    revenue: metricValue("revenue"),
    roas: metricValue("roas"),
    shares: metricValue("shares"),
    spend: metricValue("spend"),
    ctr: metricValue("ctr"),
    cvr: metricValue("cvr"),
    cpc: metricValue("cpc"),
    cpm: metricValue("cpm"),
    videoViews: metricValue("videoViews"),
    views: metricValue("videoViews"),
    hasCommercialMetrics: summary.hasCommercialMetrics,
    hasPublicEngagement: summary.hasPublicEngagement,
  };
}

function decorateCampaign(campaign) {
  const performanceRecords = campaign.assignments
    .map((assignment) => assignment.creativePerformance)
    .filter(Boolean);
  const creativeKeys = new Set(campaign.assignments.map((assignment) =>
    assignment.savedCreativeId || assignment.creativePerformance?.sourceRecordId || assignment.creativePerformanceId,
  ).filter(Boolean));
  const metrics = aggregateCampaignPerformance(performanceRecords);
  const ranked = [...performanceRecords].sort(
    (a, b) => Number(b.revenue || 0) - Number(a.revenue || 0),
  );
  const displayAssignments = [...campaign.assignments.reduce((items, assignment) => {
    const key = assignment.savedCreativeId || assignment.creativePerformance?.sourceRecordId || assignment.creativePerformanceId;
    const existing = items.get(key);
    if (!existing || assignment.creativePerformance) items.set(key, assignment);
    return items;
  }, new Map()).values()].map((assignment) => {
    if (!assignment.savedCreative) return assignment;

    let payload = {};
    try {
      payload = JSON.parse(assignment.savedCreative.payloadJson || "{}");
    } catch {
      payload = {};
    }

    return {
      ...assignment,
      savedCreative: {
        ...assignment.savedCreative,
        creatorHandle: payload.creatorHandle || payload.creator || "",
        productName:
          assignment.savedCreative.productTitle || payload.productName || "",
        videoUrl:
          payload.videoUrl || payload.video_url || payload.mediaUrl || "",
      },
    };
  });
  return {
    ...campaign,
    creativeCount: creativeKeys.size,
    metrics,
    displayAssignments,
    topCreative: ranked[0]?.adName || ranked[0]?.creativeId || null,
    recommendedNextAction: metrics.roas !== null && metrics.roas >= 2
      ? "Scale budget while monitoring conversion efficiency."
      : metrics.ctr !== null && metrics.ctr < 1
        ? "Test a stronger hook or pause weak creatives."
        : performanceRecords.length ? "Keep testing creatives and collect more conversion data." : "Add creatives to start measuring this campaign.",
  };
}

const campaignInclude = {
  assignments: {
    include: { savedCreative: true, creativePerformance: true },
    orderBy: { createdAt: "desc" },
  },
};

export async function listCampaigns(shop) {
  const campaigns = await db.adCampaign.findMany({
    where: { shop }, include: campaignInclude, orderBy: { updatedAt: "desc" },
  });
  return campaigns.map(decorateCampaign);
}

export async function getCampaign(shop, id) {
  const campaign = await db.adCampaign.findFirst({ where: { id, shop }, include: campaignInclude });
  return campaign ? decorateCampaign(campaign) : null;
}

export async function listCampaignAssignments(shop) {
  return db.adCampaignCreative.findMany({
    where: { shop }, include: { campaign: true }, orderBy: { createdAt: "desc" },
  });
}
