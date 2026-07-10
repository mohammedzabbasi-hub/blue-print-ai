import db from "../db.server.js";
import {
  getWorkspaceProfile,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
} from "../models/blueprint.server.js";
import { listCampaigns } from "../models/campaign.server.js";
import { listCreatorProfiles } from "../models/creator-attribution.server.js";
import { listCreativePerformance } from "../models/creative-performance.server.js";
import { getGoogleAdsIntegrationStatus } from "./google-ads.server.js";
import {
  aggregateEffectiveness,
  buildDashboardEffectivenessRecords,
  buildEffectivenessGroups,
  metricNumber,
  partitionDashboardPerformanceRecords,
} from "../utils/ad-effectiveness.js";

export const STORE_CONTEXT_MAX_CHARS = 18_000;

const CONTEXT_SECTION_ORDER = [
  "products",
  "performance",
  "creativeLibrary",
  "savedReviews",
  "creators",
  "campaigns",
  "googleAds",
  "revenueBlueprint",
  "workspace",
  "dataImports",
];

const SAFE_WORKSPACE_SETTING_KEYS = new Set([
  "analysis_depth",
  "auto_save_analyzed_videos",
]);

const SENSITIVE_KEY = /(?:access|refresh|session|oauth|developer|client|api)[_-]?(?:token|key|secret)|encrypted|credential|password|authorization|cookie|hmac|signature/i;
const PRIVATE_MEDIA_KEY = /(?:media|video|asset|thumbnail|source|profile)[_-]?url|mediaPath|storedFileName/i;

export async function loadStoreIntelligenceData({ shop, merchantData }) {
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) throw new Error("A shop is required to build store context.");

  const [
    analyses,
    blueprints,
    briefs,
    campaigns,
    creatives,
    creatorProfiles,
    googleConnection,
    googleCampaigns,
    performance,
    profile,
    workspaceSettings,
  ] = await Promise.all([
    listVideoAnalyses(normalizedShop, 100),
    listRevenueBlueprints(normalizedShop, 100),
    listSavedBriefs(normalizedShop, 100),
    listCampaigns(normalizedShop),
    listSavedCreatives(normalizedShop, 100),
    listCreatorProfiles(normalizedShop),
    db.adPlatformConnection.findUnique({
      where: { shop_platform: { shop: normalizedShop, platform: "google" } },
      select: {
        campaignSyncMode: true,
        externalAccountId: true,
        externalAccountName: true,
        lastSyncError: true,
        lastSyncedAt: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.googleAdsCampaign.findMany({
      where: { shop: normalizedShop, campaignStatus: { not: "REMOVED" } },
      orderBy: { updatedAt: "desc" },
      select: {
        advertisingChannelType: true,
        campaignId: true,
        campaignName: true,
        campaignStatus: true,
        lastSeenAt: true,
        selected: true,
      },
    }),
    listCreativePerformance({ merchantData, shop: normalizedShop }),
    getWorkspaceProfile(normalizedShop),
    db.workspaceSetting.findMany({
      where: {
        shop: normalizedShop,
        key: { in: [...SAFE_WORKSPACE_SETTING_KEYS] },
      },
      orderBy: { updatedAt: "desc" },
      select: { key: true, updatedAt: true, value: true },
    }),
  ]);

  return {
    analyses,
    blueprints,
    briefs,
    campaigns,
    creatives,
    creatorProfiles,
    googleCampaigns,
    googleConfiguration: getGoogleAdsIntegrationStatus(),
    googleConnection,
    performance,
    profile,
    workspaceSettings,
  };
}

export async function buildStoreIntelligenceContext({
  shop,
  question = "",
  routeId = "/app/dashboard",
  selectedProductId = "",
  merchantData = { products: [], shop: {} },
  data,
} = {}) {
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) throw new Error("A shop is required to build store context.");
  const loaded = data || await loadStoreIntelligenceData({
    shop: normalizedShop,
    merchantData,
  });
  const scoped = scopeLoadedData(loaded, normalizedShop);
  const products = collectShopProductContext({
    merchantData,
    performanceRecords: scoped.performance?.records,
    profile: scoped.profile,
    selectedProductId,
    shop: normalizedShop,
  });
  const performance = collectCreativePerformanceContext({
    performance: scoped.performance,
    shop: normalizedShop,
  });
  const creativeLibrary = collectCreativeLibraryContext({
    campaigns: scoped.campaigns,
    creatives: scoped.creatives,
    performanceRecords: scoped.performance?.records,
    shop: normalizedShop,
  });
  const savedReviews = collectSavedReviewContext({
    analyses: scoped.analyses,
    shop: normalizedShop,
  });
  creativeLibrary.weakCreatives = buildWeakCreativeSignals(performance, savedReviews);
  const creators = collectCreatorContext({
    creatorProfiles: scoped.creatorProfiles,
    performanceRecords: scoped.performance?.records,
    shop: normalizedShop,
  });
  const campaigns = collectCampaignContext({
    campaigns: scoped.campaigns,
    shop: normalizedShop,
  });
  const googleAds = collectGoogleAdsContext({
    campaigns: scoped.googleCampaigns,
    configuration: scoped.googleConfiguration,
    connection: scoped.googleConnection,
    performance: scoped.performance,
    shop: normalizedShop,
  });
  const revenueBlueprint = collectRevenueBlueprintContext({
    blueprints: scoped.blueprints,
    shop: normalizedShop,
  });
  const workspace = collectWorkspaceContext({
    profile: scoped.profile,
    settings: scoped.workspaceSettings,
    shop: normalizedShop,
  });
  const dataImports = collectDataImportContext({
    performance: scoped.performance,
    shop: normalizedShop,
  });
  const sections = {
    products,
    performance,
    creativeLibrary,
    savedReviews,
    creators,
    campaigns,
    googleAds,
    revenueBlueprint,
    workspace,
    dataImports,
  };
  const substantiveSections = [
    performance,
    creativeLibrary,
    savedReviews,
    creators,
    campaigns,
    revenueBlueprint,
    dataImports,
  ];
  const availableSectionCount = substantiveSections.filter((section) => section.available).length;
  const contextStatus = availableSectionCount
    ? {
        label: "Using shop context",
        level: "available",
        availableSectionCount,
      }
    : {
        label: "Limited context available",
        level: "limited",
        availableSectionCount: 0,
      };

  return sanitizeContextValue({
    schemaVersion: 1,
    shop: { domain: normalizedShop },
    currentRoute: safeText(routeId, 180),
    questionPriorities: prioritizeStoreContextSections(question, routeId),
    contextStatus,
    sections,
  });
}

export function collectShopProductContext({
  shop,
  merchantData = { products: [], shop: {} },
  profile = {},
  performanceRecords = [],
  selectedProductId = "",
} = {}) {
  const products = (merchantData.products || []).slice(0, 50).map((product) => {
    const prices = (product.variants || [])
      .map((variant) => nullableNumber(variant?.price))
      .filter((value) => value !== null);
    const singlePrice = nullableNumber(product.price);
    if (singlePrice !== null) prices.push(singlePrice);
    return {
      id: safeText(product.id, 180),
      title: safeText(product.title, 200),
      handle: safeText(product.handle, 180),
      status: safeText(product.status, 40),
      vendor: safeText(product.vendor, 160),
      productType: safeText(product.productType, 160),
      priceRange: prices.length
        ? { min: round(Math.min(...prices)), max: round(Math.max(...prices)) }
        : null,
      currencyCode: safeText(product.currencyCode || merchantData.shop?.currencyCode, 12),
      source: safeText(product.source || "shopify", 60),
    };
  });
  const importedProductNames = uniqueText(
    performanceRecords.map((record) =>
      firstText(record.productTitle, record.productName, record.productLabel, record.productHandle),
    ),
  ).slice(0, 20);
  const selectedProduct = products.find((product) =>
    (selectedProductId && product.id === selectedProductId) ||
    (!selectedProductId && (
      (profile.selectedProductId && product.id === profile.selectedProductId) ||
      (profile.selectedProductHandle && product.handle === profile.selectedProductHandle) ||
      (profile.mainProduct && product.title.toLowerCase() === String(profile.mainProduct).toLowerCase())
    )),
  ) || null;

  return {
    source: "Shopify Admin product catalog and BluePrintAI workspace profile",
    available: products.length > 0 || importedProductNames.length > 0 || Boolean(profile.mainProduct),
    shopDomain: normalizeShop(shop),
    shopName: safeText(merchantData.shop?.name, 200),
    currencyCode: safeText(merchantData.shop?.currencyCode || products[0]?.currencyCode, 12),
    selectedProduct: selectedProduct || (profile.mainProduct
      ? {
          id: safeText(profile.selectedProductId, 180),
          title: safeText(profile.mainProduct, 200),
          handle: safeText(profile.selectedProductHandle, 180),
          source: "workspace_profile",
        }
      : null),
    workspaceSelectionMode: safeText(profile.setupMode || "entire_store", 60),
    productCount: products.length,
    products,
    importedProductNames,
    productLoadWarning: merchantData.errors?.length
      ? "Some Shopify product context was unavailable during this request."
      : "",
  };
}

export function collectCreativePerformanceContext({ shop, performance = {} } = {}) {
  const scopedPerformance = {
    ...performance,
    dailyRecords: scopeRows(performance.dailyRecords, shop),
    records: scopeRows(performance.records, shop),
  };
  const dashboardRecords = buildDashboardEffectivenessRecords(scopedPerformance);
  const { creativeRecords, creatorRollups } = partitionDashboardPerformanceRecords(dashboardRecords);
  const totals = aggregateEffectiveness(creativeRecords);
  const creativeGroups = buildEffectivenessGroups(creativeRecords, "creative")
    .map((group) => rankingRow(group.label, aggregateEffectiveness(group.records), group.records.length));
  const dateGroups = new Map();
  creativeRecords.forEach((record) => {
    const date = reportingDate(record);
    if (!date) return;
    dateGroups.set(date, [...(dateGroups.get(date) || []), record]);
  });
  const dailyTrend = [...dateGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-30)
    .map(([date, records]) => ({
      date,
      ...metricsFromSummary(aggregateEffectiveness(records)),
    }));
  const dates = [...dateGroups.keys()].sort();
  const metricRankings = {};
  for (const metric of ["revenue", "roas", "ctr", "cvr", "spend"]) {
    const available = creativeGroups.filter((row) => row.metrics[metric] !== null);
    metricRankings[metric] = {
      best: sortByMetric(available, metric, "desc")[0] || null,
      worst: sortByMetric(available, metric, "asc")[0] || null,
    };
  }

  return {
    source: "BluePrintAI CreativePerformance and connected/imported daily reporting rows",
    available: creativeRecords.length > 0,
    recordCount: creativeRecords.length,
    excludedCreatorRollupCount: creatorRollups.length,
    hasMeasuredPerformanceData: Boolean(performance.hasMeasuredPerformanceData),
    hasImportedPerformanceData: Boolean(performance.hasImportedPerformanceData),
    hasDemoPerformanceData: Boolean(performance.hasDemoPerformanceData),
    totals: metricsFromSummary(totals),
    distinctReportingDateCount: dates.length,
    dateRange: dates.length ? { start: dates[0], end: dates.at(-1) } : null,
    latestReportingDate: dates.at(-1) || null,
    lastImportAt: latestDate(scopedPerformance.records.map((record) => record.importedAt)),
    dailyTrend,
    rankings: {
      bestAndWorstByMetric: metricRankings,
      topByRevenue: sortByMetric(creativeGroups, "revenue", "desc").slice(0, 5),
      topByRoas: sortByMetric(creativeGroups, "roas", "desc").slice(0, 5),
      weakestByRoas: sortByMetric(
        creativeGroups.filter((row) => row.metrics.roas !== null),
        "roas",
        "asc",
      ).slice(0, 5),
    },
  };
}

export function collectCreativeLibraryContext({
  shop,
  campaigns = [],
  creatives = [],
  performanceRecords = [],
} = {}) {
  const scopedCreatives = scopeRows(creatives, shop);
  const scopedPerformance = scopeRows(performanceRecords, shop);
  const campaignBySavedCreative = new Map();
  const campaignByPerformance = new Map();
  scopeRows(campaigns, shop).forEach((campaign) => {
    (campaign.assignments || []).forEach((assignment) => {
      if (assignment.savedCreativeId) campaignBySavedCreative.set(assignment.savedCreativeId, campaign.name);
      if (assignment.creativePerformanceId) campaignByPerformance.set(assignment.creativePerformanceId, campaign.name);
    });
  });
  const savedCreatives = scopedCreatives.slice(0, 15).map((creative) => {
    const payload = objectValue(creative.payload);
    return {
      id: safeText(creative.id, 180),
      creativeName: safeText(creative.title, 240),
      videoFilename: safeText(
        firstText(payload.originalFilename, payload.fileName, payload.videoFilename),
        240,
      ),
      product: safeText(creative.productTitle, 200),
      campaign: safeText(campaignBySavedCreative.get(creative.id), 200),
      sourceType: sourceLabel(creative.sourceType),
      angle: safeText(creative.angle || payload.summary || payload.description, 420),
      previewAvailable: hasPreviewMedia(payload),
      savedAt: isoDate(creative.createdAt),
    };
  });
  const performanceCards = scopedPerformance
    .filter((record) => {
      const source = `${record.importSource || ""} ${record.sourceType || ""} ${record.sourceRecordType || ""}`;
      return /import|csv|performance|ad_platform|google/i.test(source);
    })
    .slice(0, 15)
    .map((record) => ({
      id: safeText(record.id, 180),
      creativeName: safeText(
        firstText(record.creativeTitle, record.adName, record.creativeId, "Imported creative"),
        240,
      ),
      videoFilename: safeText(record.videoFilename || record.originalFilename, 240),
      product: safeText(firstText(record.productTitle, record.productName, record.productLabel), 200),
      campaign: safeText(
        firstText(
          campaignByPerformance.get(record.id),
          record.workspaceCampaignName,
          record.campaignName,
        ),
        200,
      ),
      sourceType: sourceLabel(
        firstText(record.importSource, record.sourceType, record.sourcePlatform, "imported_performance"),
      ),
      previewAvailable: hasPreviewMedia(record),
      reportingDate: reportingDate(record) || null,
      metrics: compactMetrics(record),
    }));

  return {
    source: "BluePrintAI SavedCreative records and imported CreativePerformance cards",
    available: savedCreatives.length > 0 || performanceCards.length > 0,
    savedCreativeCount: scopedCreatives.length,
    importedPerformanceCardCount: performanceCards.length,
    savedCreatives,
    performanceCards,
  };
}

export function collectSavedReviewContext({ shop, analyses = [] } = {}) {
  const scopedAnalyses = scopeRows(analyses, shop);
  const reviews = scopedAnalyses.slice(0, 12).map((record) => {
    const payload = objectValue(record.payload);
    const result = objectValue(payload.result || payload);
    const analysis = objectValue(result.analysis || payload.analysis);
    const display = objectValue(result.display);
    const transcript = objectValue(result.transcript || payload.transcript);
    const recommendations = firstList(
      analysis.recommendations,
      analysis.next_actions,
      analysis.nextActions,
      result.recommendations,
    );
    return {
      id: safeText(record.id, 180),
      title: safeText(
        firstText(display.displayTitle, display.generatedTitle, record.fileName, record.productTitle),
        240,
      ),
      product: safeText(record.productTitle || result.productTitle, 200),
      hookScore: score(analysis.hook_score ?? analysis.hookScore),
      clarityScore: score(analysis.clarity_score ?? analysis.clarityScore),
      ctaScore: score(analysis.cta_score ?? analysis.ctaScore),
      overallScore: score(
        analysis.overall_score ??
        analysis.overallScore ??
        analysis.creative_score ??
        analysis.creativeScore ??
        analysis.readinessScore,
      ),
      executiveSummary: safeText(
        firstText(display.summary, analysis.summary, record.brief, result.summary),
        650,
      ),
      recommendations: recommendations.slice(0, 5).map((item) => safeText(item, 320)),
      signals: uniqueText([
        ...firstList(analysis.labels, analysis.signals),
        ...firstList(analysis.strengths),
        ...firstList(analysis.weaknesses),
      ]).slice(0, 8),
      transcriptAvailable: Boolean(
        transcript.full_text || transcript.summary || result.transcriptSummary,
      ),
      savedToLibrary: Boolean(record.savedToLibrary),
      reviewedAt: isoDate(record.createdAt),
    };
  });
  const weakReviews = reviews
    .filter((review) => [review.hookScore, review.ctaScore, review.overallScore].some((value) => value !== null))
    .sort((left, right) => weakReviewScore(left) - weakReviewScore(right))
    .slice(0, 5);

  return {
    source: "BluePrintAI AI Review Studio VideoAnalysis records",
    available: reviews.length > 0,
    reviewCount: scopedAnalyses.length,
    reviews,
    weakReviews,
    latestReviewAt: latestDate(scopedAnalyses.map((record) => record.createdAt)),
  };
}

export function collectCreatorContext({
  shop,
  creatorProfiles = [],
  performanceRecords = [],
} = {}) {
  const scopedProfiles = scopeRows(creatorProfiles, shop);
  const scopedRecords = scopeRows(performanceRecords, shop);
  const identities = new Map();
  scopedProfiles.forEach((profile) => {
    const key = creatorKey(profile.handle || profile.name);
    if (key) identities.set(key, { profile, records: [] });
  });
  scopedRecords.forEach((record) => {
    const key = creatorKey(record.creatorHandle || record.creatorName);
    if (!key) return;
    const current = identities.get(key) || { profile: {}, records: [] };
    current.records.push(record);
    identities.set(key, current);
  });
  scopedProfiles.forEach((profile) => {
    const key = creatorKey(profile.handle || profile.name);
    if (!key) return;
    const current = identities.get(key);
    (profile.attributions || []).forEach((attribution) => {
      if (attribution.creativePerformance) current.records.push(attribution.creativePerformance);
    });
  });
  const creators = [...identities.values()].map(({ profile, records }) => {
    const deduped = uniqueBy(records, (record) => record.id || JSON.stringify(record));
    const summary = aggregateEffectiveness(deduped);
    const metrics = metricsFromSummary(summary);
    return {
      id: safeText(profile.id || creatorKey(profile.handle || profile.name || records[0]?.creatorHandle), 180),
      name: safeText(profile.name || records[0]?.creatorName || records[0]?.creatorHandle, 200),
      handle: safeText(profile.handle || records[0]?.creatorHandle, 160),
      platform: safeText(profile.platform || records[0]?.sourcePlatform || records[0]?.platform, 80),
      assignedCreatives: uniqueText(deduped.map((record) =>
        firstText(record.creativeTitle, record.adName, record.creativeId),
      )).slice(0, 5),
      campaigns: uniqueText(deduped.map((record) =>
        firstText(record.workspaceCampaignName, record.campaignName),
      )).slice(0, 5),
      recordCount: deduped.length,
      metrics,
    };
  }).sort((left, right) =>
    Number(right.metrics.revenue || 0) - Number(left.metrics.revenue || 0) ||
    Number(right.metrics.roas || 0) - Number(left.metrics.roas || 0) ||
    Number(right.metrics.clicks || 0) - Number(left.metrics.clicks || 0),
  );

  return {
    source: "BluePrintAI Creator profiles and imported creator attribution",
    available: creators.length > 0,
    creatorCount: creators.length,
    topCreators: creators.slice(0, 5),
  };
}

export function collectCampaignContext({ shop, campaigns = [] } = {}) {
  const scopedCampaigns = scopeRows(campaigns, shop);
  const rows = scopedCampaigns.map((campaign) => {
    const performanceRecords = (campaign.assignments || [])
      .map((assignment) => assignment.creativePerformance)
      .filter(Boolean);
    const metrics = campaign.metrics || metricsFromSummary(aggregateEffectiveness(performanceRecords));
    const creativeRows = performanceRecords.map((record) => ({
      name: safeText(firstText(record.adName, record.creativeTitle, record.creativeId), 220),
      metrics: compactMetrics(record),
    }));
    const assignedCreatives = uniqueText((campaign.assignments || []).map((assignment) =>
      firstText(
        assignment.savedCreative?.title,
        assignment.creativePerformance?.adName,
        assignment.creativePerformance?.creativeTitle,
        assignment.creativePerformance?.creativeId,
      ),
    )).slice(0, 6);
    return {
      id: safeText(campaign.id, 180),
      name: safeText(campaign.name, 220),
      status: safeText(campaign.status, 60),
      objective: safeText(campaign.objective, 100),
      platform: safeText(campaign.platform, 80),
      primaryProduct: safeText(campaign.primaryProductName, 200),
      budget: nullableNumber(campaign.budget),
      assignedCreativeCount: Number(campaign.creativeCount ?? assignedCreatives.length),
      assignedCreatives,
      metrics: normalizeMetricObject(metrics),
      bestCreative: sortByMetric(creativeRows, "revenue", "desc")[0] ||
        sortByMetric(creativeRows, "roas", "desc")[0] || null,
      worstCreative: sortByMetric(
        creativeRows.filter((row) => row.metrics.roas !== null),
        "roas",
        "asc",
      )[0] || null,
      updatedAt: isoDate(campaign.updatedAt),
    };
  }).sort((left, right) =>
    Number(right.metrics.revenue || 0) - Number(left.metrics.revenue || 0) ||
    Number(right.metrics.roas || 0) - Number(left.metrics.roas || 0),
  );

  return {
    source: "BluePrintAI local AdCampaign records and assigned creative performance",
    available: rows.length > 0,
    campaignCount: rows.length,
    topCampaigns: rows.slice(0, 5),
  };
}

export function collectGoogleAdsContext({
  shop,
  campaigns = [],
  configuration = {},
  connection,
  performance = {},
} = {}) {
  const scopedCampaigns = scopeRows(campaigns, shop);
  const googleRecords = [
    ...(performance.dailyRecords || []),
    ...(performance.records || []),
  ].filter((record) => /google/i.test(String(record.sourcePlatform || record.platform || record.sourceType || "")));
  let connectionState = "not_connected";
  if (!configuration.ok) connectionState = "setup_required";
  else if (connection && (!connection.externalAccountId || connection.status === "needs_account_selection")) {
    connectionState = "needs_account_selection";
  } else if (connection) connectionState = "connected";
  const selectedCampaigns = scopedCampaigns.filter((campaign) => campaign.selected);

  return {
    source: "BluePrintAI Google Ads connection, campaign selection, and synced read-only rows",
    available: Boolean(connection) || googleRecords.length > 0,
    connectionState,
    selectedAccount: maskAccountId(connection?.externalAccountId),
    selectedAccountName: safeText(connection?.externalAccountName, 180),
    campaignSelectionMode: safeText(connection?.campaignSyncMode || "selected", 40),
    campaignCount: scopedCampaigns.length,
    selectedCampaignCount: selectedCampaigns.length,
    selectedCampaigns: selectedCampaigns.slice(0, 5).map((campaign) => ({
      id: safeText(campaign.campaignId, 120),
      name: safeText(campaign.campaignName, 220),
      status: safeText(campaign.campaignStatus, 60),
      channel: safeText(campaign.advertisingChannelType, 80),
    })),
    lastSyncStatus: connection?.lastSyncError
      ? "failed"
      : connection?.lastSyncedAt
        ? "synced"
        : "not_synced",
    lastSyncedAt: isoDate(connection?.lastSyncedAt),
    syncedRowCount: googleRecords.length,
    syncedMetrics: metricsFromSummary(aggregateEffectiveness(googleRecords)),
    readOnly: true,
    limitation: "Reporting only. BluePrintAI cannot create, edit, pause, launch, delete, or spend on Google Ads campaigns.",
  };
}

export function collectRevenueBlueprintContext({ shop, blueprints = [] } = {}) {
  const scopedBlueprints = scopeRows(blueprints, shop);
  const records = scopedBlueprints.slice(0, 8).map((record) => {
    const payload = objectValue(record.payload);
    const context = objectValue(payload.context);
    return {
      id: safeText(record.id, 180),
      generatedFor: safeText(context.generatedFor, 240),
      product: safeText(context.productTitle || context.productName, 200),
      productSource: safeText(context.productSourceLabel || context.productSource, 160),
      scope: safeText(payload.scope?.label, 240),
      diagnosis: safeText(payload.diagnosis, 650),
      priorities: firstList(payload.priorities).slice(0, 5).map((item) => safeText(item, 360)),
      assumptions: firstList(payload.demoAssumptions, payload.assumptions)
        .slice(0, 5)
        .map((item) => safeText(item, 360)),
      planningEstimates: firstList(payload.opportunities).slice(0, 4).map((opportunity) => ({
        product: safeText(opportunity?.productTitle, 180),
        recommendation: safeText(opportunity?.recommendation, 360),
        estimatedUpside: nullableNumber(opportunity?.estimatedUpside),
      })),
      sevenDayPlan: firstList(payload.sevenDayPlan).slice(0, 7).map((item) => safeText(item, 320)),
      savedAt: isoDate(record.createdAt),
    };
  });

  return {
    source: "BluePrintAI saved RevenueBlueprint records",
    available: records.length > 0,
    blueprintCount: scopedBlueprints.length,
    savedBlueprints: records,
    disclaimer: "Revenue Blueprints are directional planning estimates, not guaranteed revenue forecasts or guaranteed growth.",
  };
}

export function collectWorkspaceContext({ shop, profile = {}, settings = [] } = {}) {
  const safeSettings = {};
  (settings || []).forEach((setting) => {
    if (SAFE_WORKSPACE_SETTING_KEYS.has(setting.key)) {
      safeSettings[setting.key] = safeText(setting.value, 80);
    }
  });
  return {
    source: "BluePrintAI allowlisted workspace profile and app preferences",
    available: Boolean(
      profile.mainProduct || profile.category || profile.targetCustomer || profile.creativeGoal,
    ),
    shopDomain: normalizeShop(shop),
    profile: {
      setupMode: safeText(profile.setupMode, 60),
      mainProduct: safeText(profile.mainProduct, 200),
      category: safeText(profile.category, 120),
      targetCustomer: safeText(profile.targetCustomer, 280),
      creativeGoal: safeText(profile.creativeGoal, 160),
      creativeSource: safeText(profile.creativeSource, 160),
      brandTone: safeText(profile.brandTone, 120),
      selectedProductId: safeText(profile.selectedProductId, 180),
      selectedProductHandle: safeText(profile.selectedProductHandle, 180),
    },
    settings: safeSettings,
  };
}

export function collectDataImportContext({ shop, performance = {} } = {}) {
  const records = scopeRows(performance.records, shop).filter((record) => {
    const source = `${record.importSource || ""} ${record.sourceRecordType || ""} ${record.sourceType || ""}`;
    return /import|csv/i.test(source);
  });
  const reportingDates = records.map(reportingDate).filter(Boolean).sort();
  const importDates = records.map((record) => isoDate(record.importedAt)).filter(Boolean).sort();
  const latestImportAt = importDates.at(-1) || null;
  const latestImportMinute = latestImportAt?.slice(0, 16);
  const sourceCounts = {};
  records.forEach((record) => {
    const source = sourceLabel(
      firstText(record.importSource, record.sourceRecordType, record.sourceType, "CSV import"),
    );
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });

  return {
    source: "Persisted imported CreativePerformance rows",
    available: records.length > 0,
    rowsImported: records.length,
    latestImportAt,
    latestImportCount: latestImportMinute
      ? importDates.filter((value) => value.startsWith(latestImportMinute)).length
      : 0,
    detectedDateRange: reportingDates.length
      ? { start: reportingDates[0], end: reportingDates.at(-1) }
      : null,
    distinctReportingDateCount: new Set(reportingDates).size,
    dailyRowsAvailable: reportingDates.length > 0,
    sourceCounts,
    invalidRows: null,
    warnings: null,
    validationNote: "Invalid-row and warning details are available during import preview but are not persisted after import.",
  };
}

export function prioritizeStoreContextSections(question = "", routeId = "") {
  const text = `${question} ${routeId}`.toLowerCase();
  const priorities = [];
  const add = (...names) => names.forEach((name) => {
    if (!priorities.includes(name)) priorities.push(name);
  });

  if (/creative|video|hook|cta|review|library/.test(text)) {
    add("creativeLibrary", "savedReviews", "performance");
  }
  if (/creator|influencer/.test(text)) add("creators", "performance", "creativeLibrary");
  if (/campaign/.test(text)) add("campaigns", "googleAds", "performance");
  if (/revenue|roas|spend|orders?|sales|ctr|cvr|cpc|cpm|performance/.test(text)) {
    add("performance", "campaigns", "dataImports");
  }
  if (/google\s*ads|google|sync|connect/.test(text)) add("googleAds", "campaigns", "performance");
  if (/product|catalog|sku|vendor/.test(text)) add("products", "workspace", "performance");
  if (/blueprint|plan|forecast/.test(text)) add("revenueBlueprint", "products", "performance");
  if (/import|csv|daily data|reporting date/.test(text)) add("dataImports", "performance");
  if (!priorities.length) add("performance", "creativeLibrary", "products", "workspace");
  return priorities;
}

export function compactStoreContextForLLM(
  context,
  question = "",
  { maxChars = STORE_CONTEXT_MAX_CHARS } = {},
) {
  const priorities = prioritizeStoreContextSections(question, context?.currentRoute);
  const orderedNames = uniqueText([...priorities, ...CONTEXT_SECTION_ORDER]);
  const orderedSections = Object.fromEntries(
    orderedNames
      .filter((name) => context?.sections?.[name])
      .map((name) => [name, context.sections[name]]),
  );
  let compact = sanitizeContextValue({
    schemaVersion: context?.schemaVersion || 1,
    shop: context?.shop,
    currentRoute: context?.currentRoute,
    contextStatus: context?.contextStatus,
    questionPriorities: priorities,
    sections: orderedSections,
  });
  if (serializedSize(compact) <= maxChars) return compact;

  compact = {
    ...compact,
    contextTruncated: true,
    sections: Object.fromEntries(Object.entries(compact.sections).map(([name, section]) => [
      name,
      priorities.includes(name) ? section : summarizeSection(section),
    ])),
  };
  if (serializedSize(compact) <= maxChars) return compact;

  compact = limitContextArrays(compact, 3, 300);
  if (serializedSize(compact) <= maxChars) return compact;

  compact = limitContextArrays(compact, 1, 180);
  if (serializedSize(compact) <= maxChars) return compact;

  compact.sections = Object.fromEntries(
    Object.entries(compact.sections).map(([name, section]) => [name, summarizeSection(section)]),
  );
  return limitContextArrays(compact, 0, 120);
}

function scopeLoadedData(data, shop) {
  return {
    ...data,
    analyses: scopeRows(data.analyses, shop),
    blueprints: scopeRows(data.blueprints, shop),
    briefs: scopeRows(data.briefs, shop),
    campaigns: scopeRows(data.campaigns, shop),
    creatives: scopeRows(data.creatives, shop),
    creatorProfiles: scopeRows(data.creatorProfiles, shop),
    googleCampaigns: scopeRows(data.googleCampaigns, shop),
    performance: {
      ...(data.performance || {}),
      dailyRecords: scopeRows(data.performance?.dailyRecords, shop),
      records: scopeRows(data.performance?.records, shop),
    },
  };
}

function scopeRows(rows = [], shop) {
  const normalizedShop = normalizeShop(shop);
  return (rows || []).filter((row) =>
    !row?.shop || normalizeShop(row.shop) === normalizedShop,
  );
}

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function metricsFromSummary(summary = {}) {
  return {
    revenue: roundNullable(metricNumber(summary, "revenue")),
    spend: roundNullable(metricNumber(summary, "spend")),
    roas: roundNullable(metricNumber(summary, "roas")),
    ctr: roundNullable(metricNumber(summary, "ctr")),
    cvr: roundNullable(metricNumber(summary, "cvr")),
    clicks: roundNullable(metricNumber(summary, "clicks")),
    impressions: roundNullable(metricNumber(summary, "impressions")),
    reach: roundNullable(metricNumber(summary, "reach")),
    orders: roundNullable(metricNumber(summary, "orders")),
    videoViews: roundNullable(metricNumber(summary, "videoViews")),
    engagements: roundNullable(metricNumber(summary, "engagements")),
    engagementRate: roundNullable(metricNumber(summary, "engagementRate")),
    cpc: roundNullable(metricNumber(summary, "cpc")),
    cpm: roundNullable(metricNumber(summary, "cpm")),
    cpa: roundNullable(metricNumber(summary, "costPerOrder")),
  };
}

function compactMetrics(record = {}) {
  const revenue = nullableNumber(record.revenue ?? record.conversionValue);
  const spend = nullableNumber(record.spend);
  const clicks = nullableNumber(record.clicks);
  const impressions = nullableNumber(record.impressions);
  const orders = nullableNumber(record.orders ?? record.conversions);
  return {
    revenue: roundNullable(revenue),
    spend: roundNullable(spend),
    roas: roundNullable(spend && revenue !== null ? revenue / spend : record.roas),
    ctr: roundNullable(impressions && clicks !== null ? clicks / impressions * 100 : record.ctr),
    cvr: roundNullable(clicks && orders !== null ? orders / clicks * 100 : record.cvr ?? record.conversionRate),
    clicks: roundNullable(clicks),
    impressions: roundNullable(impressions),
    reach: roundNullable(record.reach),
    orders: roundNullable(orders),
    videoViews: roundNullable(record.videoViews ?? record.views),
    engagementRate: roundNullable(record.engagementRate),
    cpc: roundNullable(record.cpc),
    cpm: roundNullable(record.cpm),
    cpa: roundNullable(record.cpa ?? (spend && orders ? spend / orders : null)),
  };
}

function normalizeMetricObject(metrics = {}) {
  return Object.fromEntries([
    "revenue", "spend", "roas", "ctr", "cvr", "clicks", "impressions",
    "reach", "orders", "videoViews", "engagementRate", "cpc", "cpm", "cpa",
  ].map((key) => [key, roundNullable(metrics[key])])) ;
}

function rankingRow(label, summary, recordCount) {
  return {
    name: safeText(label, 240),
    recordCount,
    metrics: metricsFromSummary(summary),
  };
}

function sortByMetric(rows = [], metric, direction = "desc") {
  return [...rows]
    .filter((row) => nullableNumber(row?.metrics?.[metric]) !== null)
    .sort((left, right) => {
      const difference = Number(left.metrics[metric]) - Number(right.metrics[metric]);
      return direction === "asc" ? difference : -difference;
    });
}

function reportingDate(record = {}) {
  const value = record.reportingDate || record.date;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function latestDate(values = []) {
  return values.map(isoDate).filter(Boolean).sort().at(-1) || null;
}

function isoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function score(value) {
  const number = nullableNumber(value);
  if (number === null) return null;
  return round(number > 10 ? number : number * 10);
}

function weakReviewScore(review) {
  const values = [review.hookScore, review.ctaScore, review.overallScore]
    .filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 101;
}

function buildWeakCreativeSignals(performance, savedReviews) {
  const performanceWeak = (performance.rankings?.weakestByRoas || []).map((creative) => ({
    name: creative.name,
    source: "Imported creative performance",
    reason: `Lowest available ROAS signal: ${creative.metrics.roas}x.`,
    metrics: { roas: creative.metrics.roas },
  }));
  const reviewWeak = (savedReviews.weakReviews || []).map((review) => ({
    name: review.title,
    source: "AI Review Studio",
    reason: "Low available hook, CTA, or overall saved-review score.",
    scores: {
      hook: review.hookScore,
      cta: review.ctaScore,
      overall: review.overallScore,
    },
  }));
  const combined = [];
  for (let index = 0; combined.length < 5; index += 1) {
    const before = combined.length;
    if (performanceWeak[index]) combined.push(performanceWeak[index]);
    if (combined.length < 5 && reviewWeak[index]) combined.push(reviewWeak[index]);
    if (combined.length === before) break;
  }
  return combined;
}

function creatorKey(value) {
  return String(value || "").trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
}

function maskAccountId(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `••••${digits.slice(-4)}` : "";
}

function sourceLabel(value) {
  return safeText(value || "saved_record", 100)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasPreviewMedia(value = {}) {
  return Boolean(
    value.previewAvailable || value.mediaStored || value.mediaPath || value.videoUrl ||
    value.video_url || value.mediaUrl || value.assetUrl,
  );
}

function safeText(value, maxLength = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return redactSensitiveText(text).slice(0, maxLength);
}

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "[redacted credential]")
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|developer[_ -]?token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function firstList(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
  }
  return [];
}

function uniqueText(values = []) {
  return [...new Set(values.map((value) => safeText(value, 400)).filter(Boolean))];
}

function uniqueBy(values = [], keyFor) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNullable(value) {
  const number = nullableNumber(value);
  return number === null ? null : round(number);
}

function round(value) {
  return Number(Number(value).toFixed(2));
}

function sanitizeContextValue(value, key = "") {
  if (SENSITIVE_KEY.test(key) || PRIVATE_MEDIA_KEY.test(key)) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContextValue(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeContextValue(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return typeof value === "string" ? redactSensitiveText(value) : value;
}

function summarizeSection(section = {}) {
  const count = section.recordCount ?? section.productCount ?? section.savedCreativeCount ??
    section.reviewCount ?? section.creatorCount ?? section.campaignCount ??
    section.blueprintCount ?? section.rowsImported ?? section.syncedRowCount ?? null;
  return {
    source: section.source,
    available: Boolean(section.available),
    count,
    latestReportingDate: section.latestReportingDate || null,
    lastImportAt: section.lastImportAt || section.latestImportAt || null,
    connectionState: section.connectionState,
    limitation: section.limitation,
    disclaimer: section.disclaimer,
  };
}

function limitContextArrays(value, maxItems, maxStringLength) {
  if (Array.isArray(value)) {
    return value.slice(0, maxItems).map((item) =>
      limitContextArrays(item, maxItems, maxStringLength),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      limitContextArrays(child, maxItems, maxStringLength),
    ]));
  }
  return typeof value === "string" ? value.slice(0, maxStringLength) : value;
}

function serializedSize(value) {
  return JSON.stringify(value).length;
}
