/* eslint-disable react/prop-types */
import { Link, useLoaderData, useLocation, useNavigation } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  buildCreators,
  getWorkspaceProfile,
  getWorkspaceSettingsMap,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
  resolveProductContext,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { listCampaigns } from "../models/campaign.server";

export const meta = () => {
  return [{ title: "Recommendations | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);

  try {
    const [analyses, creatives, blueprints, briefs, settings, profile, performance, campaigns] =
      await Promise.all([
        listVideoAnalyses(session.shop, 12),
        listSavedCreatives(session.shop, 12),
        listRevenueBlueprints(session.shop, 8),
        listSavedBriefs(session.shop, 8),
        getWorkspaceSettingsMap(session.shop, {
          auto_save_analyzed_videos: "true",
          analysis_depth: "standard",
        }),
        getWorkspaceProfile(session.shop),
        listCreativePerformance({ merchantData, shop: session.shop }),
        listCampaigns(session.shop),
      ]);
    const creatorSignals = buildCreatorPerformanceRows(
      buildCreators(merchantData.products, creatives),
      performance.records,
    );

    return {
      counts: {
        analyses: analyses.length,
        blueprints: blueprints.length,
        briefs: briefs.length,
        creatives: creatives.length,
        creatorSignals: creatorSignals.length,
        performanceCreatives: performance.records.length,
        products: merchantData.products?.length || 0,
      },
      error: "",
      hasDemoPerformanceData: performance.hasDemoPerformanceData,
      hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
      items: buildNextBestActions({
        analyses,
        blueprints,
        briefs,
        creatorSignals,
        creatives,
        hasDemoPerformanceData: performance.hasDemoPerformanceData,
        hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
        merchantData,
        performanceRecords: performance.records,
        profile,
        settings,
        campaigns,
      }),
      productError: merchantData.errors?.[0] || "",
      profile,
      shop: session.shop,
    };
  } catch (error) {
    return {
      counts: {
        analyses: 0,
        blueprints: 0,
        briefs: 0,
        creatives: 0,
        creatorSignals: 0,
        performanceCreatives: 0,
        products: 0,
      },
      error:
        error.message ||
        "Recommendations could not be loaded from saved workspace records.",
      hasDemoPerformanceData: false,
      hasMeasuredPerformanceData: false,
      items: [],
      productError: "",
      profile: {},
      shop: session.shop,
    };
  }
};

export default function RecommendationsRoute() {
  const {
    counts,
    error,
    items,
    productError,
    profile,
    shop,
  } = useLoaderData();
  const navigation = useNavigation();
  const loading = navigation.state === "loading";
  const hasLowData = getWorkspaceSignalCount(counts) < 3;

  return (
    <div className="space-y-8">
      <section className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          Next Best Action Engine
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Recommendations
        </h1>

        <p className="text-muted-foreground mt-3 max-w-4xl text-sm sm:text-[15px]">
          Next-best actions generated from saved creatives, creator signals,
          engagement data, and workspace context for {shop}.
        </p>

        <p className="mt-4 max-w-4xl rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold leading-5 text-cyan-100">
          Recommendations are planning guidance based on saved workspace data.
          They are not guaranteed performance outcomes.
        </p>
      </section>

      {loading && (
        <p className="text-muted-foreground">
          Loading next-best-action recommendations...
        </p>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      {!error && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="Saved analyses" value={counts.analyses} />
          <Metric label="Saved creatives" value={counts.creatives} />
          <Metric label="Saved briefs" value={counts.briefs} />
          <Metric label="Saved blueprints" value={counts.blueprints} />
          <Metric
            label="Shopify products"
            value={counts.products}
            tone={counts.products === 0 ? "warning" : "default"}
          />
          <Metric
            label="Performance records"
            value={counts.performanceCreatives}
          />
          <Metric label="Creator signals" value={counts.creatorSignals} />
        </section>
      )}

      {productError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
          Shopify products could not be loaded right now. Recommendations will
          use saved workspace profile context where available.
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyWorkspaceState
          title="No recommendations yet"
          description={
            hasWorkspaceProfileContext(profile)
              ? "Analyze a creative or save a workspace record to generate ranked next-best actions."
              : "Complete onboarding, add product context, or analyze a creative to generate ranked next-best actions."
          }
          primaryText="Analyze a Video"
          primaryLink="/app/video-analysis"
          secondaryText="Open Settings"
          secondaryLink="/app/settings"
        />
      )}

      {!loading && !error && items.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Ranked next best actions
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-white">
                What to do next
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Ranked by estimated impact, confidence, data completeness, and
              urgency from available workspace signals.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {items.map((item, index) => (
              <RecommendationCard
                key={item.id}
                item={{ ...item, priority: `Priority ${index + 1}` }}
              />
            ))}
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <summary className="cursor-pointer text-sm font-black text-cyan-200">
          How recommendations work
        </summary>
        <div className="mt-5 space-y-5">
          <p className="text-sm leading-6 text-slate-400">
            BluePrintAI ranks planning guidance using estimated impact,
            confidence, data completeness, and urgency from available workspace
            signals.
          </p>
          <BuildStrongerRecommendations counts={counts} hasLowData={hasLowData} />
        </div>
      </details>
    </div>
  );
}

function RecommendationCard({ item }) {
  const location = useLocation();

  return (
    <article className="glass flex h-full flex-col rounded-2xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
          {item.priority}
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs font-bold text-slate-300">
          {item.type}
        </span>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-100">
          Score {item.totalScore}
        </span>
      </div>

      <h3 className="font-display mt-4 text-2xl font-semibold leading-tight text-foreground">
        {item.title}
      </h3>

      <div className="mt-5 grid gap-4">
        <RecommendationField label="Why BluePrintAI recommends it">
          {item.why}
        </RecommendationField>
        <RecommendationField label="Data signals used">
          <SignalList signals={item.signals} />
        </RecommendationField>
        <RecommendationField label="Suggested next action">
          {item.nextAction}
        </RecommendationField>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <ScorePill label="Impact" value={item.scoring.impact} />
        <ScorePill label="Confidence" value={item.scoring.confidence} />
        <ScorePill label="Data" value={item.scoring.dataCompleteness} />
        <ScorePill label="Urgency" value={item.scoring.urgency} />
      </div>

      {item.href && (
        <div className="mt-auto pt-6">
          <Link
            to={withEmbeddedRouteParams(item.href, location.search)}
            className="bp-primary-cta"
          >
            {item.ctaLabel}
          </Link>
        </div>
      )}
    </article>
  );
}

function RecommendationField({ children, label }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm leading-6 text-slate-300">{children}</div>
    </div>
  );
}

function SignalList({ signals = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span
          key={signal}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300"
        >
          {signal}
        </span>
      ))}
    </div>
  );
}

function ScorePill({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Metric({ label, tone = "default", value }) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-slate-800 bg-slate-950/40";

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">
        {Number(value || 0)}
      </p>
    </div>
  );
}

function BuildStrongerRecommendations({ counts, hasLowData }) {
  const location = useLocation();
  const steps = [
    {
      detail: "Score hook, clarity, CTA, and readiness from a saved upload.",
      href: "/app/video-analysis",
      label: "Upload or analyze a creative",
      show: counts.analyses === 0 && counts.creatives === 0,
    },
    {
      detail: "Match recommendations to real Shopify product context.",
      href: "/app/settings",
      label: "Add Shopify product context",
      show: counts.products === 0,
    },
    {
      detail: "Turn the strongest saved signal into a planning brief.",
      href: "/app/ad-briefs",
      label: "Generate a first brief",
      show: counts.briefs === 0,
    },
    {
      detail: "Add clicks, orders, revenue, or creator attribution when ready.",
      href: "/app/data-import",
      label: "Connect or import performance data",
      show: counts.performanceCreatives < 2,
    },
  ].filter((step) => hasLowData || step.show);

  if (!steps.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        Build stronger recommendations
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-white">
        Improve the signal quality
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={withEmbeddedRouteParams(step.href, location.search)}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.04]"
          >
            <p className="text-sm font-black text-white">{step.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {step.detail}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function buildNextBestActions({
  campaigns = [],
  analyses = [],
  blueprints = [],
  briefs = [],
  creatorSignals = [],
  creatives = [],
  hasDemoPerformanceData = false,
  hasMeasuredPerformanceData = false,
  merchantData = { products: [] },
  performanceRecords = [],
  profile = {},
  settings = {},
}) {
  const actions = [];
  campaigns.forEach((campaign) => {
    const roas = campaign.metrics?.roas;
    const ctr = campaign.metrics?.ctr;
    const cvr = campaign.metrics?.cvr;
    if (roas !== null && roas >= 2) {
      actions.push(createAction({ id: `campaign-scale-${campaign.id}`, type: "Campaign", title: `Scale ${campaign.name}`, why: `${campaign.name} has strong campaign-level return from assigned performance records.`, signals: compactSignals([`${roas.toFixed(2)}x ROAS`, `${campaign.creativeCount} creatives`, `${formatCurrency(campaign.metrics.revenue)} revenue`]), nextAction: "Increase budget in measured steps and keep the strongest creative mix while watching CVR.", ctaLabel: "Open Campaign", href: `/app/campaigns/${campaign.id}`, scoring: { impact: 92, confidence: 84, dataCompleteness: 82, urgency: 74 } }));
    } else if ((ctr !== null && ctr < 1) || (cvr !== null && cvr < 1) || (roas !== null && roas < 1)) {
      actions.push(createAction({ id: `campaign-fix-${campaign.id}`, type: "Campaign", title: `Fix or pause ${campaign.name}`, why: "Assigned campaign records show a weak click, conversion, or return signal.", signals: compactSignals([ctr !== null ? `${ctr.toFixed(2)}% CTR` : "", cvr !== null ? `${cvr.toFixed(2)}% CVR` : "", roas !== null ? `${roas.toFixed(2)}x ROAS` : ""]), nextAction: "Pause the weakest creative, test a clearer hook and CTA, then reassess before adding spend.", ctaLabel: "Review Campaign", href: `/app/campaigns/${campaign.id}`, scoring: { impact: 86, confidence: 80, dataCompleteness: 76, urgency: 90 } }));
    }
  });
  const unassignedCount = performanceRecords.filter((record) => !record.workspaceCampaignId && !record.campaignName).length;
  if (unassignedCount >= 3) actions.push(createAction({ id: "campaign-unassigned", type: "Campaign", title: "Create a campaign for unassigned creatives", why: `${unassignedCount} creative performance records are not organized into a campaign.`, signals: [`${unassignedCount} unassigned creatives`], nextAction: "Create a campaign and bulk-assign related creatives so comparisons use a consistent scope.", ctaLabel: "Open Campaign Manager", href: "/app/campaigns", scoring: { impact: 72, confidence: 95, dataCompleteness: 90, urgency: 70 } }));
  const selectedProduct = resolveProductContext(
    merchantData.products || [],
    profile,
  );
  const topCreator = creatorSignals[0];
  const topCreative = findStrongestCreativeSignal({
    analyses,
    creatives,
    performanceRecords,
  });
  const weakCreative = findWeakCreativeSignal({
    analyses,
    performanceRecords,
  });
  const blueprintSignal = findBlueprintProductSignal({
    blueprints,
    creatives,
    selectedProduct,
  });
  const hasPerformanceSignals = performanceRecords.some(hasPerformanceMetrics);
  const topImportedEngagement = findTopImportedEngagementRecord(performanceRecords);

  if (topImportedEngagement) {
    const hasImportedPerformance = hasImportedDeeperPerformance(topImportedEngagement);

    actions.push(
      createAction({
        id: `imported-engagement-${topImportedEngagement.id}`,
        type: "Creative",
        title: "Scale this creative angle",
        why: hasImportedPerformance
          ? `${topImportedEngagement.creativeTitle} has the strongest imported engagement and performance signal among recent records.`
          : `${topImportedEngagement.creativeTitle} has the strongest imported public engagement signal among recent records.`,
        signals: compactSignals([
          `${formatNumber(topImportedEngagement.views)} views`,
          `${formatNumber(topImportedEngagement.likes)} likes`,
          `${formatNumber(topImportedEngagement.saves)} saves`,
          `${formatNumber(topImportedEngagement.shares)} shares`,
          `${topImportedEngagement.engagementRate}% engagement rate`,
          hasImportedPerformance && topImportedEngagement.revenue !== null
            ? `${formatCurrency(topImportedEngagement.revenue)} revenue`
            : "",
          hasImportedPerformance && topImportedEngagement.orders !== null
            ? `${formatNumber(topImportedEngagement.orders)} orders`
            : "",
        ]),
        nextAction:
          hasImportedPerformance
            ? "Turn this merchant-provided engagement and performance record into a product-specific brief, then compare the next test against clicks, orders, revenue, and spend."
            : "Turn this merchant-provided public engagement record into a product-specific brief, then import clicks, orders, or revenue when available to improve confidence.",
        ctaLabel: "Generate Brief",
        href: "/app/ad-briefs",
        scoring: {
          impact: 86,
          confidence: hasImportedPerformance ? 86 : 72,
          dataCompleteness: hasImportedPerformance ? 82 : 64,
          urgency: 72,
        },
      }),
    );
  }

  if (topCreator) {
    const highTrafficWeakConversion =
      topCreator.clicks >= 100 && topCreator.conversionRate < 1.5;

    actions.push(
      createAction({
        id: `creator-${topCreator.id}`,
        type: "Creator",
        title: highTrafficWeakConversion
          ? `Coach ${topCreator.name} before scaling budget`
          : `Scale ${topCreator.name} with a new brief`,
        why: highTrafficWeakConversion
          ? "This creator is producing traffic, but the available conversion signal is weaker than the click signal. Improve offer fit, landing path, or CTA before assigning more budget."
          : "This creator has the strongest blended creator score across clicks, engagement, sales, conversion rate, and available creator comparison signals.",
        signals: compactSignals([
          `${formatNumber(topCreator.clicks)} clicks`,
          `${topCreator.engagementRate}% engagement`,
          `${formatCurrency(topCreator.sales)} sales`,
          `${topCreator.conversionRate}% CVR`,
          `Best product: ${topCreator.topProduct || topCreator.productTitle}`,
          `Best angle: ${topCreator.topCreativeAngle || topCreator.specialty}`,
          hasDemoPerformanceData ? "Demo creator signals" : "",
        ]),
        nextAction: highTrafficWeakConversion
          ? "Compare this creator against other accounts, then revise the next brief around stronger product fit and a direct CTA."
          : "Generate a creator-specific brief using their strongest product and angle, then monitor conversion quality before expanding spend.",
        ctaLabel: highTrafficWeakConversion
          ? "View Creator Comparison"
          : "Generate Creator Brief",
        href: highTrafficWeakConversion ? "/app/creators" : "/app/ad-briefs",
        scoring: {
          impact: highTrafficWeakConversion ? 78 : 90,
          confidence: Math.min(95, 55 + topCreator.performanceScore / 2),
          dataCompleteness: hasMeasuredPerformanceData ? 82 : 62,
          urgency: highTrafficWeakConversion ? 88 : 72,
        },
      }),
    );
  }

  if (topCreative) {
    actions.push(
      createAction({
        id: `creative-strong-${topCreative.id}`,
        type: "Creative",
        title: "Generate a brief from your strongest saved creative",
        why: `${topCreative.title} has the best available creative signal across hook, clarity, CTA, readiness, or saved performance context.`,
        signals: compactSignals([
          `Hook ${topCreative.scores.hook}/10`,
          `Clarity ${topCreative.scores.clarity}/10`,
          `CTA ${topCreative.scores.cta}/10`,
          `Readiness ${topCreative.readiness}/100`,
          topCreative.source,
        ]),
        nextAction:
          "Turn the strongest saved creative into a brief with one hook variation, one proof sequence, and one CTA test.",
        ctaLabel: "Generate Brief",
        href: "/app/ad-briefs",
        scoring: {
          impact: 84,
          confidence: topCreative.confidence,
          dataCompleteness: topCreative.dataCompleteness,
          urgency: topCreative.readiness >= 75 ? 66 : 58,
        },
      }),
    );
  }

  if (weakCreative) {
    actions.push(
      createAction({
        id: `creative-weak-${weakCreative.id}`,
        type: "Creative",
        title: "Improve low-converting creative",
        why: `${weakCreative.title} has useful saved context, but the available CTA, readiness, or conversion signal is weak enough to fix before the next test.`,
        signals: compactSignals([
          `CTA ${weakCreative.scores.cta}/10`,
          `Readiness ${weakCreative.readiness}/100`,
          weakCreative.conversionRate
            ? `${weakCreative.conversionRate}% CVR`
            : "No conversion signal",
          weakCreative.source,
        ]),
        nextAction:
          "Open AI Review Studio and rebuild the first three seconds, final-frame CTA, or offer explanation before producing another variation.",
        ctaLabel: "Open AI Review Studio",
        href: "/app/video-analysis",
        scoring: {
          impact: 76,
          confidence: weakCreative.confidence,
          dataCompleteness: weakCreative.dataCompleteness,
          urgency: weakCreative.readiness < 55 ? 90 : 74,
        },
      }),
    );
  }

  if (blueprintSignal) {
    actions.push(
      createAction({
        id: `blueprint-${blueprintSignal.id}`,
        type: "Blueprint",
        title: "Prioritize product with saved blueprint context",
        why: `${blueprintSignal.productLabel} already has saved blueprint, creative, or analysis context and can move into the next structured test.`,
        signals: compactSignals([
          `${blueprints.length} saved blueprints`,
          `${creatives.length} saved creatives`,
          `Product: ${blueprintSignal.productLabel}`,
        ]),
        nextAction:
          "Open the Revenue Blueprint and choose the next product-page or creative experiment from the saved plan.",
        ctaLabel: "Open Revenue Blueprint",
        href: blueprintSignal.href,
        scoring: {
          impact: 72,
          confidence: blueprints.length ? 78 : 62,
          dataCompleteness: merchantData.products?.length ? 76 : 58,
          urgency: 58,
        },
      }),
    );
  }

  if ((merchantData.products || []).length === 0) {
    actions.push(
      createAction({
        id: "product-context-missing",
        type: "Product",
        title: "Add Shopify product context",
        why: "Recommendations become stronger when BluePrintAI can match creatives and creators to real Shopify products.",
        signals: ["Shopify products: 0"],
        nextAction:
          "Open Settings to confirm Shopify product access or add product context before generating more product-specific recommendations.",
        ctaLabel: "Open Settings",
        href: "/app/settings",
        scoring: {
          impact: 82,
          confidence: 95,
          dataCompleteness: 35,
          urgency: 86,
        },
      }),
    );
  }

  if (!hasPerformanceSignals || performanceRecords.length < 2) {
    actions.push(
      createAction({
        id: "performance-data-import",
        type: "Data",
        title: "Import or connect performance data",
        why: "Merchant-provided public engagement stats and optional deeper ad metrics improve recommendation ranking and separate creative quality from actual conversion outcomes.",
        signals: compactSignals([
          `Performance records: ${performanceRecords.length}`,
          hasMeasuredPerformanceData
            ? "Imported performance records available"
            : "No imported performance records",
          hasDemoPerformanceData ? "Demo performance data visible" : "",
        ]),
        nextAction:
          "Open Data Import and add public engagement stats. Add clicks, orders, revenue, or spend when those optional fields are available.",
        ctaLabel: "Open Data Import",
        href: "/app/data-import",
        scoring: {
          impact: 74,
          confidence: 92,
          dataCompleteness: hasPerformanceSignals ? 54 : 28,
          urgency: hasPerformanceSignals ? 58 : 84,
        },
      }),
    );
  }

  if (briefs.length === 0 && (analyses.length > 0 || creatives.length > 0)) {
    actions.push(
      createAction({
        id: "first-brief",
        type: "Creative",
        title: "Turn a winning creative into an ad brief",
        why: "Saved creative context exists, but there is no saved brief yet to guide the next production pass.",
        signals: compactSignals([
          `${analyses.length} saved analyses`,
          `${creatives.length} saved creatives`,
          "Saved briefs: 0",
        ]),
        nextAction:
          "Generate the first saved brief so future creator and product recommendations have a clearer testing plan.",
        ctaLabel: "Generate Brief",
        href: "/app/ad-briefs",
        scoring: {
          impact: 70,
          confidence: 76,
          dataCompleteness: 64,
          urgency: 68,
        },
      }),
    );
  }

  if (settings.auto_save_analyzed_videos === "false" && analyses.length > 0) {
    actions.push(
      createAction({
        id: "settings-auto-save",
        type: "Data",
        title: "Turn auto-save back on for future analyses",
        why: "Auto-save is off, so new analyses need to be saved manually before they can power future recommendations.",
        signals: ["Auto-save off", `${analyses.length} saved analyses`],
        nextAction:
          "Open Settings and re-enable auto-save if this workspace should preserve future analysis signals automatically.",
        ctaLabel: "Open Settings",
        href: "/app/settings",
        scoring: {
          impact: 48,
          confidence: 90,
          dataCompleteness: 70,
          urgency: 44,
        },
      }),
    );
  }

  if (!actions.length && (selectedProduct || hasWorkspaceProfileContext(profile))) {
    const product =
      selectedProduct?.title || profile.mainProduct || "your main product";

    actions.push(
      createAction({
        id: "profile-first-analysis",
        type: "Creative",
        title: `Analyze a creative for ${product}`,
        why: "The workspace has product or profile context, but no saved creative performance signals yet.",
        signals: compactSignals([
          profile.category,
          profile.targetCustomer,
          selectedProduct?.title,
        ]),
        nextAction:
          "Upload an existing creative so BluePrintAI can estimate hook, clarity, CTA, and readiness before you plan the next test.",
        ctaLabel: "Analyze Video",
        href: "/app/video-analysis",
        scoring: {
          impact: 68,
          confidence: 62,
          dataCompleteness: 42,
          urgency: 76,
        },
      }),
    );
  }

  return prioritizeActions(actions).slice(0, 8);
}

function createAction({ scoring, ...action }) {
  const normalized = {
    dataCompleteness: clampScore(scoring.dataCompleteness),
    confidence: clampScore(scoring.confidence),
    impact: clampScore(scoring.impact),
    urgency: clampScore(scoring.urgency),
  };
  const totalScore = Math.round(
    normalized.impact * 0.35 +
      normalized.confidence * 0.25 +
      normalized.dataCompleteness * 0.15 +
      normalized.urgency * 0.25,
  );

  return {
    ...action,
    scoring: normalized,
    signals: compactSignals(action.signals),
    title: cleanDisplayTitle(action.title, action.type),
    totalScore,
  };
}

function findStrongestCreativeSignal({
  analyses = [],
  creatives = [],
  performanceRecords = [],
}) {
  const analysisSignals = analyses.map((record) => {
    const analysis = getAnalysisPayload(record);
    const scores = getScores(analysis);
    const readiness = getReadinessScore(scores, analysis);
    const title = cleanDisplayTitle(
      record.productTitle ||
        record.payload?.result?.display?.displayTitle ||
        record.fileName,
      "Saved analysis",
    );

    return {
      confidence: 72,
      dataCompleteness: 66,
      id: record.id,
      readiness,
      scores,
      source: "Saved analysis",
      title,
      value: readiness,
    };
  });
  const creativeSignals = creatives.map((record) => {
    const payload = record.payload || {};
    const scores = getScores(payload.analysis || payload.fullResult || payload);
    const readiness =
      getReadinessScore(scores, payload) ||
      Math.round((Number(payload.score || 0) || 62) * 0.9);

    return {
      confidence: 66,
      dataCompleteness: 58,
      id: record.id,
      readiness,
      scores,
      source: "Saved creative",
      title: cleanDisplayTitle(record.title || payload.displayTitle, "Saved creative"),
      value: readiness,
    };
  });
  const performanceSignals = performanceRecords.map((record) => {
    const scores = {
      clarity: normalizeTenPointScore(record.clarityScore),
      cta: normalizeTenPointScore(record.ctaScore),
      hook: normalizeTenPointScore(record.hookScore),
    };
    const conversionSignal =
      Number(record.orders || 0) * 12 +
      Number(record.revenue || 0) / 40 +
      Number(record.clicks || 0) / 20 +
      Number(record.engagementRate || 0) * 2;
    const readiness =
      Number(record.creativeScore || 0) ||
      Math.min(100, Math.round(58 + conversionSignal));

    return {
      confidence: hasPerformanceMetrics(record) ? 82 : 58,
      conversionRate: Number(record.conversionRate || 0),
      dataCompleteness: hasPerformanceMetrics(record) ? 82 : 50,
      id: record.id,
      readiness,
      scores,
      source:
        record.sourcePlatform === "shopify_demo"
          ? "Demo performance data"
          : record.importSource === "public_engagement_import"
            ? "Public Engagement Import"
          : "Performance record",
      title: cleanDisplayTitle(record.creativeTitle, "Uploaded creative"),
      value: readiness + Math.min(30, conversionSignal),
    };
  });

  return [...analysisSignals, ...creativeSignals, ...performanceSignals]
    .filter((signal) => signal.value > 0)
    .sort((left, right) => right.value - left.value)[0];
}

function findWeakCreativeSignal({ analyses = [], performanceRecords = [] }) {
  const analysisSignals = analyses.map((record) => {
    const analysis = getAnalysisPayload(record);
    const scores = getScores(analysis);
    const readiness = getReadinessScore(scores, analysis);
    const weakest = getWeakestScore(scores);

    return {
      confidence: 72,
      conversionRate: 0,
      dataCompleteness: 66,
      id: record.id,
      readiness,
      scores,
      source: "Saved analysis",
      title: cleanDisplayTitle(record.productTitle || record.fileName, "Saved analysis"),
      weakness: Math.max(0, 10 - weakest.score) * 8 + Math.max(0, 65 - readiness),
    };
  });
  const performanceSignals = performanceRecords.map((record) => {
    const scores = {
      clarity: normalizeTenPointScore(record.clarityScore),
      cta: normalizeTenPointScore(record.ctaScore),
      hook: normalizeTenPointScore(record.hookScore),
    };
    const readiness = Number(record.creativeScore || 0) || getReadinessScore(scores);
    const conversionRate = Number(record.conversionRate || 0);
    const trafficNoConversion =
      Number(record.clicks || 0) >= 50 && conversionRate < 1.5 ? 35 : 0;

    return {
      confidence: hasPerformanceMetrics(record) ? 78 : 58,
      conversionRate,
      dataCompleteness: hasPerformanceMetrics(record) ? 82 : 48,
      id: record.id,
      readiness,
      scores,
      source:
        record.sourcePlatform === "shopify_demo"
          ? "Demo performance data"
          : "Performance record",
      title: cleanDisplayTitle(record.creativeTitle, "Uploaded creative"),
      weakness:
        Math.max(0, 6 - (scores.cta || 0)) * 8 +
        Math.max(0, 62 - readiness) +
        trafficNoConversion,
    };
  });

  return [...analysisSignals, ...performanceSignals]
    .filter((signal) => signal.weakness > 20)
    .sort((left, right) => right.weakness - left.weakness)[0];
}

function findBlueprintProductSignal({
  blueprints = [],
  creatives = [],
  selectedProduct,
}) {
  const blueprint = blueprints[0];
  const creative = creatives.find((record) => record.productTitle) || creatives[0];
  const productLabel =
    blueprint?.payload?.context?.generatedFor ||
    blueprint?.payload?.productTitle ||
    creative?.productTitle ||
    selectedProduct?.title ||
    "a product with saved context";

  if (!blueprint && !creative && !selectedProduct) return null;

  return {
    href: blueprint?.id
      ? `/app/revenue-blueprint?blueprintId=${encodeURIComponent(blueprint.id)}`
      : "/app/revenue-blueprint",
    id: blueprint?.id || creative?.id || selectedProduct?.id || "workspace",
    productLabel: cleanDisplayTitle(productLabel, "Saved product"),
  };
}

function buildCreatorPerformanceRows(creators = [], performanceRecords = []) {
  const byCreator = groupPerformanceByCreator(performanceRecords);
  const knownCreatorKeys = new Set(
    creators.map((creator) => normalizeCreatorKey(creator.handle || creator.name)),
  );
  const importedCreators = [...byCreator.entries()]
    .filter(([key]) => key && !knownCreatorKeys.has(key))
    .map(([key, records]) => buildImportedCreatorBase(key, records));

  return [...creators, ...importedCreators]
    .map((creator) => {
      const creatorKey = normalizeCreatorKey(creator.handle || creator.name);
      const matchingRecords =
        byCreator.get(creatorKey) ||
        performanceRecords.filter(
          (record) => record.shopifyProductId === creator.productId,
        );
      const clicks = matchingRecords.reduce(
        (sum, record) => sum + Number(record.clicks || 0),
        0,
      );
      const orders = matchingRecords.reduce(
        (sum, record) => sum + Number(record.orders || 0),
        0,
      );
      const sales = matchingRecords.reduce(
        (sum, record) => sum + Number(record.revenue || 0),
        0,
      );
      const views = matchingRecords.reduce(
        (sum, record) => sum + Number(record.views || 0),
        0,
      );
      const engagements = matchingRecords.reduce(
        (sum, record) =>
          sum +
          (Number(record.engagementCount || 0) ||
            Number(record.likes || 0) +
              Number(record.comments || 0) +
              Number(record.shares || 0) +
              Number(record.saves || 0) +
              Number(record.reposts || 0)),
        0,
      );
      const finalClicks = clicks || Math.round(creator.averageViews * 0.08);
      const finalOrders = orders || creator.orders;
      const finalSales = sales || creator.revenue;
      const engagementRate = views
        ? Number(((engagements / views) * 100).toFixed(1))
        : creator.engagementRate;
      const conversionRate = finalClicks
        ? Number(((finalOrders / finalClicks) * 100).toFixed(1))
        : creator.conversionRate;
      const performanceScore = Math.min(
        99,
        Math.round(
          creator.fitScore * 0.25 +
            engagementRate * 5 +
            conversionRate * 7 +
            finalOrders * 0.2 +
            Math.min(matchingRecords.length, 4) * 6,
        ),
      );

      return {
        ...creator,
        clicks: finalClicks,
        conversionRate,
        engagementRate,
        orders: finalOrders,
        performanceScore,
        sales: finalSales,
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore);
}

function findTopImportedEngagementRecord(records = []) {
  return records
    .filter((record) => record.importSource === "public_engagement_import")
    .filter((record) => Number(record.views || 0) > 0)
    .sort((left, right) => {
      const leftScore =
        Number(left.engagementRate || 0) * 1000 +
        Number(left.saves || 0) * 2 +
        Number(left.shares || 0) * 2 +
        Number(left.orders || 0) * 20 +
        Number(left.revenue || 0) / 10;
      const rightScore =
        Number(right.engagementRate || 0) * 1000 +
        Number(right.saves || 0) * 2 +
        Number(right.shares || 0) * 2 +
        Number(right.orders || 0) * 20 +
        Number(right.revenue || 0) / 10;
      return rightScore - leftScore;
    })[0];
}

function buildImportedCreatorBase(key, records = []) {
  const first = records[0] || {};
  const handle = first.creatorHandle || `@${key}`;
  const views = records.reduce((sum, record) => sum + Number(record.views || 0), 0);
  const productTitle =
    first.productTitle || first.productLabel || first.productHandle || "Imported product";

  return {
    id: key,
    name: handle,
    handle,
    platform: first.sourcePlatform || first.platform || "Imported",
    productId: first.shopifyProductId || "",
    productTitle,
    topProduct: productTitle,
    topCreativeAngle: first.creativeTitle || "Imported creative",
    fitScore: 70,
    averageViews: Math.round(views / Math.max(records.length, 1)),
    clicks: 0,
    orders: 0,
    revenue: 0,
    engagementRate: 0,
    conversionRate: 0,
    specialty: "Public engagement records",
  };
}

function groupPerformanceByCreator(records = []) {
  return records.reduce((map, record) => {
    const key = normalizeCreatorKey(record.creatorHandle || record.creatorName);
    if (!key) return map;
    map.set(key, [...(map.get(key) || []), record]);
    return map;
  }, new Map());
}

function normalizeCreatorKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, "");
}

function hasWorkspaceProfileContext(profile = {}) {
  return Boolean(
    profile.mainProduct ||
      profile.category ||
      profile.targetCustomer ||
      profile.creativeGoal,
  );
}

function getAnalysisPayload(record) {
  return (
    record.payload?.result?.analysis ||
    record.payload?.analysis ||
    record.payload?.result ||
    {}
  );
}

function getScores(analysis = {}) {
  return {
    clarity: normalizeTenPointScore(analysis.clarity_score || analysis.clarityScore),
    cta: normalizeTenPointScore(analysis.cta_score || analysis.ctaScore),
    hook: normalizeTenPointScore(analysis.hook_score || analysis.hookScore),
  };
}

function getReadinessScore(scores = {}, analysis = {}) {
  const direct =
    Number(analysis.readinessScore || analysis.readiness_score || analysis.score || 0) ||
    0;
  if (direct > 0) return direct > 10 ? Math.round(direct) : Math.round(direct * 10);

  const values = [scores.hook, scores.clarity, scores.cta].filter(Boolean);
  if (!values.length) return 0;

  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
  );
}

function getWeakestScore(scores) {
  return [
    { key: "hook", label: "Hook", score: scores.hook || 0 },
    { key: "clarity", label: "Clarity", score: scores.clarity || 0 },
    { key: "cta", label: "CTA", score: scores.cta || 0 },
  ].sort((left, right) => left.score - right.score)[0];
}

function hasPerformanceMetrics(record = {}) {
  return [
    "spend",
    "impressions",
    "views",
    "likes",
    "comments",
    "shares",
    "saves",
    "reposts",
    "engagementCount",
    "clicks",
    "orders",
    "revenue",
    "roas",
    "conversionRate",
  ].some((key) => Number(record[key] || 0) > 0);
}

function hasImportedDeeperPerformance(record = {}) {
  return [
    "clicks",
    "orders",
    "revenue",
    "spend",
    "roas",
    "conversionRate",
    "ctr",
    "cpc",
    "cpm",
  ].some((key) => record[key] !== null && record[key] !== undefined && record[key] !== "");
}

function prioritizeActions(actions) {
  const seen = new Set();

  return [...actions]
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }
      return left.title.localeCompare(right.title);
    })
    .filter((action) => {
      const key = `${action.type}:${action.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getWorkspaceSignalCount(counts = {}) {
  return (
    Number(counts.analyses || 0) +
    Number(counts.blueprints || 0) +
    Number(counts.briefs || 0) +
    Number(counts.creatives || 0) +
    Number(counts.performanceCreatives || 0) +
    Number(counts.products || 0)
  );
}

function cleanDisplayTitle(value, fallback = "Saved analysis") {
  const text = String(value || "").trim();
  if (!text || isTechnicalName(text)) return fallback;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function isTechnicalName(value = "") {
  const text = String(value || "").trim();
  const withoutExtension = text.replace(/\.[a-z0-9]{2,5}$/i, "");

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      withoutExtension,
    ) ||
    /^[0-9a-f]{20,}$/i.test(withoutExtension) ||
    /^[0-9]{10,}[-_][a-z0-9_-]+/i.test(withoutExtension)
  );
}

function compactSignals(signals = []) {
  return signals
    .map((signal) => String(signal || "").trim())
    .filter(Boolean)
    .slice(0, 7);
}

function normalizeTenPointScore(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number > 10 ? Math.round(number / 10) : Math.round(number);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
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
