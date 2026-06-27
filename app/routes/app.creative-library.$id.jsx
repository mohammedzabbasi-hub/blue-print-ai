import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import {
  deleteSavedCreative,
  findSavedCreative,
} from "../models/blueprint.server";
import {
  hasPerformanceMetrics,
  listCreativePerformance,
  normalizeCreativePerformance,
  platformLabel,
} from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  assignCampaignRecords,
  listCampaignAssignments,
  listCampaigns,
} from "../models/campaign.server";
import { generateCreativeTitleAndSummary } from "../utils/creative-display.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Creative Detail | BluePrintAI" }];
};

export const loader = async ({ params, request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const creative = await findSavedCreative(session.shop, params.id);

  if (creative) {
    const [campaigns, assignments] = await Promise.all([
      listCampaigns(session.shop),
      listCampaignAssignments(session.shop),
    ]);
    const assignment = assignments.find((item) => item.savedCreativeId === creative.id);
    return {
      assignment: assignment ? { campaignId: assignment.campaignId, campaignName: assignment.campaign.name } : null,
      campaigns: campaigns.map(({ id, name }) => ({ id, name })),
      creative: toCreativeDetail(creative),
      isDemo: false,
    };
  }

  const performance = await listCreativePerformance({ merchantData, shop: session.shop });
  const demoCreative = performance.records.find(
    (record) =>
      record.sourcePlatform === "shopify_demo" &&
      (record.id === params.id || record.sourceCreativeId === params.id),
  );

  if (!demoCreative) {
    throw new Response("Creative not found", { status: 404 });
  }

  return { assignment: null, campaigns: [], creative: toCreativeDetailFromPerformance(demoCreative), isDemo: true };
};

export const action = async ({ params, request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "assignCampaign") {
    try {
      await assignCampaignRecords(session.shop, String(formData.get("campaignId") || ""), {
        savedCreativeIds: [params.id],
      });
      return { success: "Creative campaign updated." };
    } catch (error) {
      return { error: error.message || "Could not assign this creative." };
    }
  }

  if (intent !== "delete") {
    return { error: "Unknown creative action." };
  }

  try {
    const deleted = await deleteSavedCreative(session.shop, params.id);

    if (!deleted) {
      return { error: "Creative was not found for this shop." };
    }

    return redirect(
      withEmbeddedRouteParams(
        "/app/creative-library?deleted=1",
        new URL(request.url).search,
      ),
    );
  } catch (error) {
    return { error: error.message || "Could not remove this creative." };
  }
};

export default function CreativeDetailRoute() {
  const { assignment, campaigns, creative, isDemo } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const videoUrl = creative.video_url || "";
  const deleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link
          to={withEmbeddedRouteParams(
            "/app/creative-library",
            location.search,
          )}
          className="mb-6 inline-block text-primary hover:underline"
        >
          Back to Creative Library -&gt;
        </Link>

        <div className="glass rounded-2xl p-6">
          <h1 className="font-display text-4xl font-semibold text-foreground">
            {creative.title || "Untitled Creative"}
          </h1>

          <p className="mt-2 text-muted-foreground">
            {creative.product || "Product"} · {creative.creator || "Creator"}
          </p>

          {creative.isDemoPerformanceData && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
              Demo performance data
            </p>
          )}

          {actionData?.error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
              {actionData.error}
            </div>
          )}

          {actionData?.success && (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              {actionData.success}
            </div>
          )}

          {creative.summary && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              {creative.summary}
            </p>
          )}

          {creative.fileName && creative.fileName !== creative.title && (
            <p className="mt-2 max-w-full truncate text-xs text-slate-500">
              Original file: {creative.fileName}
            </p>
          )}

          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="mt-6 max-h-[600px] w-full rounded-xl border bg-black object-contain"
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-xl border border-border-strong bg-black p-6 text-center text-slate-300">
              <div className="max-w-md">
                <p className="truncate font-semibold text-white">
                  {creative.fileName || creative.title || "Saved creative"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  No stored video file is attached to this record. Older records
                  may contain analysis metadata only.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-border-strong bg-surface-2/60 px-3 py-1 text-sm text-foreground">
              {creative.sourceLabel || creative.sourceType}
            </span>
            <span className="rounded-full border border-border-strong bg-surface-2/60 px-3 py-1 text-sm text-foreground">
              {creative.angle || "Saved creative"}
            </span>
          </div>

          {!isDemo && (
            <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <p className="text-sm font-semibold text-cyan-100">
                Campaign: {assignment?.campaignName || "Unassigned"}
              </p>
              {campaigns.length ? (
                <Form className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row" method="post">
                  <input name="intent" type="hidden" value="assignCampaign" />
                  <select className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" defaultValue={assignment?.campaignId || campaigns[0].id} name="campaignId">
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                  <button className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm font-bold text-cyan-200" type="submit">
                    {assignment ? "Move to campaign" : "Assign to campaign"}
                  </button>
                </Form>
              ) : (
                <Link className="mt-3 inline-flex text-sm font-bold text-cyan-300" to={withEmbeddedRouteParams("/app/campaigns#create-campaign", location.search)}>Create a campaign to assign →</Link>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {isDemo ? null : confirmingDelete ? (
              <Form method="post" className="flex flex-wrap items-center gap-2">
                <input name="intent" type="hidden" value="delete" />
                <button
                  type="submit"
                  disabled={deleting}
                  className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-2 text-sm font-semibold text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Confirm delete creative"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-lg border border-border-strong bg-surface-2/60 px-4 py-2 text-sm font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </Form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border border-red-500/40 bg-transparent px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
              >
                Delete creative
              </button>
            )}
          </div>

          {creative.hasPerformanceMetrics ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Performance metrics
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Spend" value={formatOptionalCurrency(creative.spend)} />
                <Metric label="Impressions" value={formatOptionalNumber(creative.impressions)} />
                <Metric label="Clicks" value={formatOptionalNumber(creative.clicks)} />
                <Metric label="Orders / conv." value={formatOptionalNumber(creative.orders ?? creative.conversions)} />
                <Metric label="Revenue" value={formatOptionalCurrency(creative.revenue ?? creative.conversionValue)} />
                <Metric label="ROAS" value={formatOptionalRate(creative.roas, "x")} />
                <Metric label="CVR" value={formatOptionalRate(creative.conversionRate, "%")} />
                <Metric label="CTR" value={formatOptionalRate(creative.ctr, "%")} />
                <Metric label="Video views" value={formatOptionalNumber(creative.videoViews ?? creative.views)} />
                <Metric label="Completion" value={formatOptionalRate(creative.videoCompletionRate, "%")} />
                <Metric label="CPC" value={formatOptionalCurrency(creative.cpc)} />
                <Metric label="CPM" value={formatOptionalCurrency(creative.cpm)} />
                <Metric label="Sync" value={formatSyncStatus(creative.syncStatus || "manual")} />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <DetailGroup
                  title="Campaign and ad"
                  rows={[
                    ["Campaign", creative.campaignName],
                    ["Ad set / group", creative.adsetName || creative.adGroupName],
                    ["Ad", creative.adName || creative.title],
                    ["Source", creative.sourceLabel || creative.sourceType],
                  ]}
                />
                <DetailGroup
                  title="Video benchmarks"
                  rows={[
                    ["2-second views", formatOptionalNumber(creative.video2SecondViews)],
                    ["3-second views", formatOptionalNumber(creative.video3SecondViews)],
                    ["25% watched", formatOptionalNumber(creative.video25PercentWatched)],
                    ["50% watched", formatOptionalNumber(creative.video50PercentWatched)],
                    ["75% watched", formatOptionalNumber(creative.video75PercentWatched)],
                    ["100% watched", formatOptionalNumber(creative.video100PercentWatched)],
                    ["Avg. watch time", formatOptionalSeconds(creative.averageWatchTime)],
                  ]}
                />
              </div>
            </div>
          ) : (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              AI-estimated planning indicators
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Readiness" value={creative.score} />
              <Metric label="Hook" value={creative.hookScore} />
              <Metric label="Clarity" value={creative.clarityScore} />
              <Metric label="CTA" value={creative.ctaScore} />
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              These values come from saved app metadata or uploaded analysis
              results. They are not imported views, clicks, orders, revenue, or
              live TikTok performance.
            </p>
          </div>
          )}

          <div className="mt-6 rounded-xl border border-border-strong bg-surface-2/60 p-5">
            <h2 className="text-xl font-bold text-foreground">
              Creative Insight
            </h2>

            <p className="mt-2 text-muted-foreground">{creative.insight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-border-strong bg-surface-2/60 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-words text-lg font-semibold leading-tight text-foreground">{value}</p>
    </div>
  );
}

function DetailGroup({ rows = [], title }) {
  return (
    <div className="rounded-xl border border-border-strong bg-surface-2/60 p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">
              {value || "Unavailable"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function toCreativeDetail(record) {
  const payload = record.payload || {};
  if (payload.sourcePlatform) {
    const performance = normalizeCreativePerformance({
      id: record.id,
      ...payload,
    });

    return {
      id: record.id,
      angle: performance.angle,
      adGroupName: performance.adGroupName,
      adName: performance.adName,
      adsetName: performance.adsetName,
      averageWatchTime: performance.averageWatchTime,
      clicks: performance.clicks,
      conversionRate: performance.conversionRate,
      conversionValue: performance.conversionValue,
      conversions: performance.conversions,
      creator: performance.creatorHandle || performance.creatorName || "Manual Creator",
      ctr: performance.ctr,
      cpc: performance.cpc,
      cpm: performance.cpm,
      cta: performance.cta,
      campaignName: performance.campaignName,
      hasPerformanceMetrics: hasPerformanceMetrics(performance),
      hook: performance.hook,
      insight:
        performance.angle ||
        performance.hook ||
        performance.transcript ||
        "No insight available.",
      isDemoPerformanceData: performance.sourcePlatform === "shopify_demo",
      orders: performance.orders,
      product: performance.productTitle,
      revenue: performance.revenue,
      roas: performance.roas,
      score: 0,
      sourceLabel: platformLabel(performance.sourcePlatform),
      sourceType: performance.sourcePlatform,
      spend: performance.spend,
      summary: performance.transcript || performance.angle || "",
      syncStatus: performance.syncStatus,
      title: performance.creativeTitle,
      video_url: performance.videoUrl,
      views: performance.views,
      impressions: performance.impressions,
      video2SecondViews: performance.video2SecondViews,
      video3SecondViews: performance.video3SecondViews,
      video25PercentWatched: performance.video25PercentWatched,
      video50PercentWatched: performance.video50PercentWatched,
      video75PercentWatched: performance.video75PercentWatched,
      video100PercentWatched: performance.video100PercentWatched,
      videoCompletionRate: performance.videoCompletionRate,
      videoViews: performance.videoViews,
    };
  }

  const originalFilename = payload.originalFilename || payload.fileName || record.title || "";
  const savedAnalysis = payload.analysis?.result?.analysis || payload.analysis || {};
  const fallbackDisplay = generateCreativeTitleAndSummary({
    productTitle: record.productTitle,
    fileName: originalFilename,
    analysis: savedAnalysis,
    preferredSummary: payload.summary || payload.description || payload.insight || "",
  });

  return {
    id: record.id,
    title:
      payload.displayTitle ||
      payload.generatedTitle ||
      fallbackDisplay.displayTitle ||
      record.title,
    product: record.productTitle,
    creator: payload.creator || payload.analysis?.creator_style || "Uploaded Creator",
    sourceType: record.sourceType,
    angle: record.angle,
    fileName: originalFilename,
    video_url: payload.video_url || payload.mediaUrl || "",
    summary: fallbackDisplay.summary || payload.summary || payload.description || "",
    insight:
      fallbackDisplay.summary ||
      savedAnalysis.summary ||
      savedAnalysis.pacingNotes ||
      payload.summary ||
      payload.description ||
      payload.insight ||
      record.angle ||
      "No insight available.",
    score: payload.score || 0,
    clarityScore: payload.analysis?.clarity_score || payload.clarityScore || 0,
    ctaScore: payload.analysis?.cta_score || payload.ctaScore || 0,
    hookScore: payload.analysis?.hook_score || payload.hookScore || 0,
  };
}

function toCreativeDetailFromPerformance(performance) {
  return {
    id: performance.id,
    angle: performance.angle,
    adGroupName: performance.adGroupName,
    adName: performance.adName,
    adsetName: performance.adsetName,
    averageWatchTime: performance.averageWatchTime,
    clarityScore: performance.clarityScore,
    clicks: performance.clicks,
    conversionRate: performance.conversionRate,
    conversionValue: performance.conversionValue,
    conversions: performance.conversions,
    creator: performance.creatorHandle || performance.creatorName || "Demo Creator",
    ctr: performance.ctr,
    cpc: performance.cpc,
    cpm: performance.cpm,
    cta: performance.cta,
    ctaScore: performance.ctaScore,
    campaignName: performance.campaignName,
    hasPerformanceMetrics: hasPerformanceMetrics(performance),
    hook: performance.hook,
    hookScore: performance.hookScore,
    insight:
      performance.transcript ||
      performance.angle ||
      performance.hook ||
      "Demo creative performance record.",
    isDemoPerformanceData: performance.sourcePlatform === "shopify_demo",
    orders: performance.orders,
    product: performance.productTitle,
    revenue: performance.revenue,
    roas: performance.roas,
    score: performance.creativeScore,
    sourceLabel: platformLabel(performance.sourcePlatform),
    sourceType: performance.sourcePlatform,
    spend: performance.spend,
    summary: performance.transcript || performance.angle || "",
    syncStatus: performance.syncStatus,
    title: performance.creativeTitle,
    video_url: performance.videoUrl,
    views: performance.views,
    impressions: performance.impressions,
    video2SecondViews: performance.video2SecondViews,
    video3SecondViews: performance.video3SecondViews,
    video25PercentWatched: performance.video25PercentWatched,
    video50PercentWatched: performance.video50PercentWatched,
    video75PercentWatched: performance.video75PercentWatched,
    video100PercentWatched: performance.video100PercentWatched,
    videoCompletionRate: performance.videoCompletionRate,
    videoViews: performance.videoViews,
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function hasOptionalValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatOptionalCurrency(value) {
  return hasOptionalValue(value) ? formatCurrency(value) : "Not imported";
}

function formatOptionalNumber(value) {
  return hasOptionalValue(value) ? formatNumber(value) : "Not imported";
}

function formatOptionalRate(value, suffix) {
  return hasOptionalValue(value) ? `${Number(value).toFixed(2)}${suffix}` : "Not imported";
}

function formatOptionalSeconds(value) {
  return hasOptionalValue(value) ? `${Number(value).toFixed(1)}s` : "Not imported";
}

function formatSyncStatus(value = "") {
  const labels = {
    analysis_only: "Analysis only",
    imported_public_engagement: "Imported public engagement",
    manual: "Manual",
    manual_entry: "Manual entry",
    saved_in_app: "Saved in app",
  };
  const key = String(value || "").trim();

  return labels[key] || key.replace(/_/g, " ") || "Manual";
}
