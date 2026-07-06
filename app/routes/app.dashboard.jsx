import { useMemo, useState } from "react";
import { Link, useLoaderData, useLocation, useNavigation } from "react-router";

import TopBar from "../components/dashboard/TopBar";
import StatCards from "../components/dashboard/StatCards";
import PerformanceChart from "../components/dashboard/PerformanceChart";
import TopCreatives from "../components/dashboard/TopCreatives";
import PatternInsights from "../components/dashboard/PatternInsights";
import IntegrationStatusCards, {
  ConnectMoreDataSources,
  PerformanceDataNotice,
} from "../components/IntegrationStatusCards";

import {
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
} from "../models/blueprint.server";
import {
  buildIntegrationStatuses,
  listCreativePerformance,
} from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { listCampaigns } from "../models/campaign.server";
import { buildProductContext } from "../models/product-context";
import {
  buildDashboardEffectivenessRecords,
  hasReportingDate,
  partitionDashboardPerformanceRecords,
} from "../utils/ad-effectiveness";

export const meta = () => {
  return [{ title: "Dashboard | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);

  try {
    const [
      analyses,
      creatives,
      briefs,
      blueprints,
      performanceData,
      campaigns,
    ] =
      await Promise.all([
        listVideoAnalyses(session.shop, 50),
        listSavedCreatives(session.shop, 50),
        listSavedBriefs(session.shop, 50),
        listRevenueBlueprints(session.shop, 20),
        listCreativePerformance({ merchantData, shop: session.shop }),
        listCampaigns(session.shop),
      ]);

    return {
      dashboardData: buildCommandCenterData({
        analyses,
        blueprints,
        briefs,
        creatives,
        merchantData,
        performanceData,
        campaigns,
      }),
      error: "",
      shop: session.shop,
    };
  } catch (error) {
    return {
      dashboardData: buildCommandCenterData({
        analyses: [],
        blueprints: [],
        briefs: [],
        creatives: [],
        merchantData: { errors: [], products: [] },
        performanceData: [],
        campaigns: [],
      }),
      error:
        error.message ||
        "Could not load saved Command Center records for this shop.",
      shop: session.shop,
    };
  }
};

function itemMatchesSearch(item, query) {
  if (!query) return true;
  if (item === null || item === undefined) return false;

  if (typeof item === "string" || typeof item === "number") {
    return String(item).toLowerCase().includes(query);
  }

  if (Array.isArray(item)) {
    return item.some((entry) => itemMatchesSearch(entry, query));
  }

  if (typeof item === "object") {
    return Object.values(item).some((value) => itemMatchesSearch(value, query));
  }

  return false;
}

function cloneDashboardData(data) {
  if (!data) return data;

  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function filterDashboardData(data, search) {
  const query = search.trim().toLowerCase();

  if (!query || !data) return data;

  const clone = cloneDashboardData(data);

  function filterArrays(obj) {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      if (Array.isArray(value)) {
        obj[key] = value.filter((item) => itemMatchesSearch(item, query));
      } else if (value && typeof value === "object") {
        filterArrays(value);
      }
    });

    return obj;
  }

  return filterArrays(clone);
}

export default function CommandCenterRoute() {
  const { dashboardData, error, shop } = useLoaderData();
  const location = useLocation();
  const navigation = useNavigation();
  const [dateRange, setDateRange] = useState("30d");
  const [search, setSearch] = useState("");
  const loading = navigation.state === "loading";
  const isEmptyDashboard = dashboardData?.isEmptyState === true;

  const filteredDashboardData = useMemo(() => {
    return filterDashboardData(dashboardData, search);
  }, [dashboardData, search]);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <TopBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          search={search}
          onSearchChange={setSearch}
          showDateFilter={dashboardData.hasTimeSeriesData}
        />

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {formatShopName(shop)} Command Center
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Saved creative activity, directional workflow signals, and planning progress
            for this Shopify app workspace.
          </p>
        </div>

        {loading && (
          <div className="glass rounded-xl p-5 text-sm text-muted-foreground">
            Loading saved Command Center records...
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 text-sm text-rose-300">
            {error}
          </div>
        )}

        <IntegrationStatusCards
          hasUploadedData={dashboardData.hasUploadedData}
          productContext={dashboardData.productContext}
          search={location.search}
        />

        <PerformanceDataNotice
          hasDemoPerformanceData={dashboardData.hasDemoPerformanceData}
          hasImportedPerformanceData={dashboardData.hasImportedPerformanceData}
          hasMeasuredPerformanceData={dashboardData.hasMeasuredPerformanceData}
          productContext={dashboardData.productContext}
        />

        {!loading && (
          <>
            {!isEmptyDashboard && <StatCards data={dashboardData} />}

            {isEmptyDashboard && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-[16px] font-semibold text-foreground mb-1">
                  No saved creative activity yet
                </h2>

                <p className="text-sm text-muted-foreground">
                  Start with one of these core workflows. Your metrics and
                  performance trends will appear here as workspace data grows.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={withEmbeddedRouteParams(
                      "/app/video-analysis",
                      location.search,
                    )}
                    className="bp-primary-cta"
                  >
                    Upload Creative
                  </Link>

                  <Link
                    to={withEmbeddedRouteParams(
                      "/app/data-import",
                      location.search,
                    )}
                    className="bp-primary-cta"
                  >
                    Import Performance Data
                  </Link>

                  <Link
                    to={withEmbeddedRouteParams(
                      "/app/campaigns",
                      location.search,
                    )}
                    className="bp-primary-cta"
                  >
                    Create Campaign
                  </Link>
                </div>
              </div>
            )}

            {!isEmptyDashboard && search.trim() && (
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-sm text-sky-200">
                Showing saved workspace matches for &quot;{search}&quot;.
              </div>
            )}

            {!isEmptyDashboard && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <PerformanceChart
                      dateRange={dateRange}
                      data={dashboardData}
                    />
                  </div>

                  <div>
                    <PatternInsights data={filteredDashboardData} />
                  </div>
                </div>

                <TopCreatives data={filteredDashboardData} />
              </>
            )}

            <ConnectMoreDataSources
              search={location.search}
              statuses={dashboardData.integrationStatuses}
            />
          </>
        )}
      </div>
    </div>
  );
}

function buildCommandCenterData({
  analyses,
  blueprints,
  briefs,
  creatives,
  performanceData = [],
  merchantData = { errors: [], products: [] },
  campaigns = [],
}) {
  const dashboardPerformanceRecords = buildDashboardEffectivenessRecords(performanceData);
  const {
    creativeRecords: effectivenessRecords,
    creatorRollups: excludedCreatorRollups,
  } = partitionDashboardPerformanceRecords(dashboardPerformanceRecords);
  const analysisScores = analyses.map(getAnalysisScore).filter((score) => score > 0);
  const averageAnalysisScore = analysisScores.length
    ? Math.round(
        analysisScores.reduce((sum, score) => sum + score, 0) /
          analysisScores.length,
      )
    : 0;
  const readinessScore = calculateReadinessScore({
    analyses,
    blueprints,
    briefs,
    creatives,
    averageAnalysisScore,
  });
  const hasSavedRecords =
    analyses.length > 0 ||
    creatives.length > 0 ||
    briefs.length > 0 ||
    blueprints.length > 0 ||
    campaigns.length > 0 ||
    effectivenessRecords.length > 0 ||
    (performanceData.dailyRecords || []).length > 0;
  const productContext = buildProductContext({
    shopifyProducts: merchantData.products || [],
    performanceRecords: performanceData.records || [],
  });

  return {
    hasDemoPerformanceData: Boolean(performanceData.hasDemoPerformanceData),
    hasImportedPerformanceData: Boolean(performanceData.hasImportedPerformanceData),
    hasMeasuredPerformanceData: Boolean(performanceData.hasMeasuredPerformanceData),
    hasUploadedData:
      analyses.length > 0 || creatives.length > 0 || effectivenessRecords.length > 0,
    hasTimeSeriesData:
      new Set(
        [...effectivenessRecords, ...(performanceData.dailyRecords || [])]
          .filter(hasReportingDate)
          .map((record) => record.reportingDate || record.date)
          .filter(Boolean)
          .map((date) => new Date(date))
          .filter((date) => !Number.isNaN(date.getTime()))
          .map((date) => date.toISOString().slice(0, 10)),
      ).size > 1,
    integrationStatuses:
      performanceData.integrationStatuses ||
      buildIntegrationStatuses({
        hasShopifyProducts: productContext.hasShopifyProducts,
      }),
    isEmptyState: !hasSavedRecords,
    mode: "saved_app_records",
    productCount: productContext.availableProducts.length,
    productContext,
    totals: {
      analyses: analyses.length,
      avg_analysis_score: averageAnalysisScore,
      blueprints: blueprints.length,
      briefs: briefs.length,
      creatives: creatives.length,
      readiness: readinessScore,
    },
    patterns: buildPatterns({ analyses, creatives, briefs }),
    adPerformance: buildAdPerformanceTrackingData(
      effectivenessRecords,
    ),
    effectivenessRecords,
    excludedCreatorRollupCount: excludedCreatorRollups.length,
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      platform: campaign.platform,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      budget: campaign.budget,
      creativeCount: campaign.creativeCount,
    })),
    top_creatives: buildCreativeRows({
      analyses,
      creatives,
      performanceRecords: performanceData.records || [],
    }),
    leaderboard: buildCreativeRows({
      analyses,
      creatives,
      performanceRecords: performanceData.records || [],
    }),
  };
}

function buildAdPerformanceTrackingData(records = []) {
  const realRecords = records
    .map(normalizePerformanceRecord)
    .filter(Boolean)
    .sort((left, right) => new Date(left.date) - new Date(right.date));

  const totals = realRecords.reduce(
    (summary, record) => {
      summary.views += record.views;
      summary.videoViews += record.videoViews;
      summary.videoCompletions += record.videoCompletions;
      summary.impressions += record.impressions;
      summary.clicks += record.clicks;
      summary.spend += record.spend;
      summary.engagements += record.engagements;
      summary.conversions += record.conversions;
      summary.revenue += record.revenue;
      return summary;
    },
    {
      clicks: 0,
      conversions: 0,
      engagements: 0,
      impressions: 0,
      revenue: 0,
      spend: 0,
      videoCompletions: 0,
      videoViews: 0,
      views: 0,
    },
  );

  return {
    hasData: realRecords.length > 0,
    records: realRecords,
    totals: {
      ...totals,
      averageEngagementRate: totals.views
        ? Number(((totals.engagements / totals.views) * 100).toFixed(2))
        : null,
      completionRate: totals.videoViews
        ? Number(((totals.videoCompletions / totals.videoViews) * 100).toFixed(2))
        : null,
      conversionRate: totals.clicks
        ? Number(((totals.conversions / totals.clicks) * 100).toFixed(2))
        : null,
      cpc: totals.clicks && totals.spend
        ? Number((totals.spend / totals.clicks).toFixed(2))
        : null,
      cpm: totals.impressions && totals.spend
        ? Number(((totals.spend / totals.impressions) * 1000).toFixed(2))
        : null,
      ctr: totals.impressions
        ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2))
        : null,
      roas: totals.spend ? Number((totals.revenue / totals.spend).toFixed(2)) : null,
    },
  };
}

function normalizePerformanceRecord(record = {}) {
  const creativeId =
    record.creativeId || record.creative_id || record.sourceCreativeId || record.id || null;
  const adId = record.adId || record.ad_id || null;
  const date =
    record.date || record.recordedAt || record.firstSeenAt || record.createdAt || null;

  if ((!creativeId && !adId) || !date) return null;

  const impressions = positiveNumber(record.impressions);
  const views = positiveNumber(record.views ?? record.videoViews ?? record.impressions);
  const videoViews = positiveNumber(record.videoViews ?? record.views);
  const videoCompletions = positiveNumber(record.video100PercentWatched);
  const clicks = positiveNumber(record.clicks);
  const spend = positiveNumber(record.spend);
  const likes = positiveNumber(record.likes);
  const comments = positiveNumber(record.comments);
  const shares = positiveNumber(record.shares);
  const saves = positiveNumber(record.saves);
  const reposts = positiveNumber(record.reposts);
  const conversions = positiveNumber(record.orders ?? record.conversions);
  const revenue = positiveNumber(record.revenue ?? record.sales);
  const engagements =
    positiveNumber(record.engagementCount) || likes + comments + shares + saves + reposts;
  const hasMeasuredMetric =
    views > 0 ||
    clicks > 0 ||
    likes > 0 ||
    comments > 0 ||
    shares > 0 ||
    saves > 0 ||
    reposts > 0 ||
    impressions > 0 ||
    spend > 0 ||
    conversions > 0 ||
    revenue > 0 ||
    videoViews > 0;

  if (!hasMeasuredMetric) return null;

  return {
    adId,
    clicks,
    comments,
    conversions,
    creativeId,
    date: new Date(date).toISOString().slice(0, 10),
    impressions,
    likes,
    platform: record.platform || record.sourcePlatform || record.source || "Imported performance",
    revenue,
    reposts,
    saves,
    shares,
    spend,
    engagements,
    videoCompletions,
    videoViews,
    views,
  };
}

function positiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function buildCreativeRows({ analyses, creatives, performanceRecords = [] }) {
  const creativeRows = creatives.map((creative) => {
    const payload = creative.payload || {};
    const score =
      Number(payload.score || 0) ||
      getAnalysisScore({ payload: payload.fullResult || payload.analysis || payload });

    return {
      id: creative.id,
      title: creative.title || "Saved creative",
      product: creative.productTitle || "Manual product",
      creator: payload.creator || payload.analysis?.creator_style || "Manual/uploaded",
      source: creative.sourceType || "saved creative",
      score,
      readiness: score || 0,
      savedAt: creative.createdAt,
      nextStep:
        score && score < 70
          ? "Improve hook, clarity, or CTA"
          : "Generate a brief or blueprint",
    };
  });

  const analysisRows = analyses.map((analysis) => ({
    id: analysis.id,
    title: analysis.fileName || `${analysis.productTitle} analysis`,
    product: analysis.productTitle || "Uploaded product",
    creator:
      getAnalysisPayload(analysis)?.creator_style ||
      "Uploaded/manual creative",
    source: "video analysis",
    score: getAnalysisScore(analysis),
    readiness: getAnalysisScore(analysis),
    savedAt: analysis.createdAt,
    nextStep: getAnalysisScore(analysis) < 70
      ? "Improve the weakest score"
      : "Use as a planning reference",
  }));

  const performanceRows = performanceRecords.map((record) => {
    const engagementRate = Number(record.engagementRate || 0);
    const score = Math.min(
      100,
      Math.round(
        Math.max(45, engagementRate * 8) +
          Math.min(Number(record.orders || 0), 20) +
          Math.min(Number(record.revenue || 0) / 100, 20),
      ),
    );

    return {
      id: record.id,
      title: record.creativeTitle || "Imported creative",
      product: record.productTitle || record.productLabel || "Imported product",
      creator: record.creatorHandle || record.creatorName || "Imported creator",
      source:
        record.importSource === "public_engagement_import"
          ? "Public Engagement Import"
          : record.sourcePlatform || "Performance record",
      score,
      readiness: score,
      savedAt: record.firstSeenAt,
      nextStep:
        record.revenue || record.orders
          ? "Use as a stronger planning signal"
          : "Add clicks, orders, or revenue when available",
    };
  });

  return [...creativeRows, ...analysisRows, ...performanceRows]
    .sort((left, right) => {
      const scoreDifference = Number(right.score || 0) - Number(left.score || 0);
      if (scoreDifference !== 0) return scoreDifference;
      return new Date(right.savedAt || 0) - new Date(left.savedAt || 0);
    })
    .slice(0, 8);
}

function buildPatterns({ analyses, creatives, briefs }) {
  const hooks = {};
  const creatorTypes = {};
  const deliveryStyles = {};
  const sources = {};

  analyses.forEach((record) => {
    const analysis = getAnalysisPayload(record);
    addPattern(hooks, analysis.hook_type || "Saved analysis");
    addPattern(creatorTypes, analysis.creator_style || analysis.creator_type);
    addPattern(deliveryStyles, analysis.delivery_style || "Manual review");
  });

  creatives.forEach((creative) => {
    addPattern(sources, formatSourceLabel(creative.sourceType));
    addPattern(hooks, creative.angle || creative.payload?.insight);
  });

  briefs.forEach((brief) => {
    addPattern(hooks, brief.angle || brief.payload?.angle);
    addPattern(deliveryStyles, "Saved brief");
  });

  return {
    creator_types: creatorTypes,
    delivery_styles: deliveryStyles,
    hooks,
    source_types: sources,
  };
}

function getAnalysisPayload(record) {
  return (
    record.payload?.result?.analysis ||
    record.payload?.analysis ||
    record.payload?.result ||
    {}
  );
}

function getAnalysisScore(record) {
  const analysis = getAnalysisPayload(record);
  const scores = [
    analysis.hook_score,
    analysis.clarity_score,
    analysis.cta_score,
  ]
    .map((value) => Number(value || 0))
    .filter((value) => value > 0);

  if (!scores.length) return 0;

  return Math.round(
    (scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10,
  );
}

function calculateReadinessScore({
  analyses,
  averageAnalysisScore,
  blueprints,
  briefs,
  creatives,
}) {
  const completionScore =
    Math.min(creatives.length, 3) * 8 +
    Math.min(analyses.length, 3) * 10 +
    Math.min(briefs.length, 2) * 8 +
    Math.min(blueprints.length, 2) * 8;
  const qualityScore = averageAnalysisScore
    ? Math.round(averageAnalysisScore * 0.35)
    : 0;

  return Math.max(0, Math.min(100, completionScore + qualityScore));
}

function addPattern(target, label) {
  const normalized = String(label || "").trim();
  if (!normalized) return;

  target[normalized] = (target[normalized] || 0) + 1;
}

function formatShopName(shop = "") {
  const base = shop.replace(".myshopify.com", "").replace(/[-_]+/g, " ");

  return (
    base
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || shop
  );
}

function formatSourceLabel(source = "") {
  return (
    String(source || "Saved record")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Saved record"
  );
}
