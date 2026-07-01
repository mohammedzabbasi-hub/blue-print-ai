import { useState } from "react";
import { Link, useLoaderData, useLocation, useOutlet } from "react-router";
import {
  BarChart3,
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

import {
  getWorkspaceProfile,
  listSavedCreatives,
  workspaceProfileHasContext,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Creator Performance | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [creatives, profile, performance] = await Promise.all([
    listSavedCreatives(session.shop, 50),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
  ]);
  const creators = buildCreatorPerformanceRows(
    [],
    performance.records,
  );

  return {
    creators,
    creativesCount: creatives.length,
    hasDemoPerformanceData: performance.hasDemoPerformanceData,
    hasAnyContext: creators.length > 0,
    hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
    hasProfileContext: workspaceProfileHasContext(profile),
    profile,
    shop: session.shop,
  };
};

export default function CreatorsRoute() {
  const outlet = useOutlet();
  const {
    creators,
    creativesCount,
    hasAnyContext,
    hasDemoPerformanceData,
    hasProfileContext,
    profile,
    shop,
  } = useLoaderData();
  const location = useLocation();
  const [selectedCreator, setSelectedCreator] = useState(null);
  const totals = summarizeCreators(creators);
  const topCreator = creators[0];

  if (outlet) return outlet;

  return (
    <div className="space-y-7">
      <section className="glass-strong rounded-2xl p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Creator performance
              </p>
              {hasDemoPerformanceData && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-100">
                  Demo performance data
                </span>
              )}
            </div>

            <h1 className="mt-4 max-w-5xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Compare creator account performance
            </h1>

            <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground">
              Compare merchant-imported creator traffic, engagement, and attributed
              sales. Scores and management guidance are labeled heuristic and are
              not connected-platform measurements.
            </p>
          </div>
          <Link
            className="bp-primary-cta shrink-0"
            to={withEmbeddedRouteParams("/app/data-import?type=creators", location.search)}
          >
            Import creator CSV
          </Link>
        </div>
      </section>

      {!hasAnyContext && (
        <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            No creator performance data yet
          </p>
          <h2 className="mt-3 text-2xl font-black text-white">
            Import creator performance data to compare creators.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Add creator-level traffic, engagement, and sales records through
            the existing CSV import workflow.
          </p>
          <Link
            className="bp-primary-cta mt-5"
            to={withEmbeddedRouteParams("/app/data-import?type=creators", location.search)}
          >
            Import creator CSV
          </Link>
        </section>
      )}

      {hasAnyContext && <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PerformanceMetric
          icon={MousePointerClick}
          label="Creator clicks"
          value={formatNumber(totals.clicks)}
          detail="Outbound store visits from creator links"
        />
        <PerformanceMetric
          icon={BarChart3}
          label="Engagement"
          value={formatOptionalRate(totals.engagementRate, "%")}
          detail="Weighted creator engagement rate"
        />
        <PerformanceMetric
          icon={ShoppingBag}
          label="Attributed sales"
          value={formatCurrency(totals.sales)}
          detail={`${formatNumber(totals.orders)} orders across creator accounts`}
        />
        <PerformanceMetric
          icon={TrendingUp}
          label="Blended ROAS"
          value={formatOptionalRate(totals.roas, "x")}
          detail={`${formatCurrency(totals.spend)} tracked spend`}
        />
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
              Account leaderboard
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              Creator performance comparison
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-400">
            Use this view to compare creator accounts by contribution to
            revenue, clicks, engagement, and buying intent. Imported CSV rows
            are attributed through unified creative performance records.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {creators.map((creator) => (
            <CreatorPerformanceCard
              key={creator.id}
              creator={creator}
              onView={() => setSelectedCreator(creator)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
        <div className="mb-5">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            Comparison table
          </p>
          <h2 className="mt-3 text-3xl font-black text-white">
            Side-by-side creator results
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[1120px] w-full border-collapse text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Creator account</th>
                <th className="px-5 py-4">Primary channel</th>
                <th className="px-5 py-4">Clicks</th>
                <th className="px-5 py-4">Engagement</th>
                <th className="px-5 py-4">Orders</th>
                <th className="px-5 py-4">Sales</th>
                <th className="px-5 py-4">CVR</th>
                <th className="px-5 py-4">Best product</th>
                <th className="px-5 py-4">Best angle</th>
                <th className="px-5 py-4">AOV</th>
                <th className="px-5 py-4">Heuristic guidance</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((creator) => (
                <tr
                  key={creator.id}
                  className="border-t border-white/10 text-sm text-slate-300"
                >
                  <td className="px-5 py-4">
                    <Link
                      to={withEmbeddedRouteParams(
                        `/app/creators/${encodeURIComponent(creator.id)}`,
                        location.search,
                      )}
                      className="font-black text-white hover:text-cyan-200"
                    >
                      {creator.name}
                    </Link>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {creator.handle}
                    </p>
                  </td>
                  <td className="px-5 py-4">{creator.channel}</td>
                  <td className="px-5 py-4">{formatOptionalNumber(creator.clicks)}</td>
                  <td className="px-5 py-4">{formatOptionalRate(creator.engagementRate, "%")}</td>
                  <td className="px-5 py-4">{formatOptionalNumber(creator.orders)}</td>
                  <td className="px-5 py-4">{formatOptionalCurrency(creator.sales)}</td>
                  <td className="px-5 py-4">{formatOptionalRate(creator.conversionRate, "%")}</td>
                  <td className="px-5 py-4">{creator.topProduct || creator.productTitle}</td>
                  <td className="px-5 py-4">{creator.topCreativeAngle || creator.specialty}</td>
                  <td className="px-5 py-4">{formatOptionalCurrency(creator.aov)}</td>
                  <td className="px-5 py-4 font-bold text-cyan-100">
                    {creator.decision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <ManagementRecommendation
          creativesCount={creativesCount}
          hasProfileContext={hasProfileContext}
          profile={profile}
          shop={shop}
          topCreator={topCreator}
        />
      </section>
      </>}

      {selectedCreator && (
        <CreatorAccountPopIn
          creator={selectedCreator}
          onClose={() => setSelectedCreator(null)}
          search={location.search}
        />
      )}
    </div>
  );
}

function CreatorPerformanceCard({ creator, onView }) {
  return (
    <article
      data-testid={`creator-card-${creator.id}`}
      className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.04]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            {creator.status}
          </p>
          <h3 className="mt-3 text-xl font-black text-white">{creator.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {creator.handle} · {creator.channel}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {formatOptionalNumber(creator.followerCount)} followers · {formatOptionalNumber(creator.averageViews)} avg views
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
          Heuristic {creator.performanceScore}/100
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MiniMetric label="Clicks" value={formatOptionalNumber(creator.clicks)} />
        <MiniMetric label="Engagement" value={formatOptionalRate(creator.engagementRate, "%")} />
        <MiniMetric label="Sales" value={formatOptionalCurrency(creator.sales)} />
        <MiniMetric label="ROAS" value={formatOptionalRate(creator.roas, "x")} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-[#07101d] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Best use case
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {creator.topProduct || creator.productTitle} · {creator.topCreativeAngle || creator.specialty}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-[#07101d] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Campaign context</p>
        <p className="mt-2 text-sm text-slate-300">Top campaign: {creator.topCampaign}</p>
        <p className="mt-1 text-xs text-slate-500">Campaigns contributed to: {creator.campaignsContributedTo?.length || 0}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-[#07101d] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Heuristic guidance
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {creator.recommendation}
        </p>
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          data-testid={`view-creator-account-${creator.id}`}
          onClick={onView}
          className="bp-primary-cta"
        >
          View creator account
        </button>
      </div>
    </article>
  );
}

function CreatorAccountPopIn({ creator, onClose, search = "" }) {
  const topRecords = Array.isArray(creator.topPerformanceRecords)
    ? creator.topPerformanceRecords
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-account-title"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] border border-cyan-300/30 bg-[#07101d] shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#07101d]/95 p-5 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Creator account
            </p>
            <h2
              id="creator-account-title"
              className="mt-2 text-3xl font-black text-white"
            >
              {creator.name}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {creator.handle} · {creator.channel}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
              {creator.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-300">
              {creator.performanceScore}/100 score
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-100">
              {creator.channel === creator.platform
                ? "Demo/tracked records"
                : "Imported/tracked records"}
            </span>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            <MiniMetric label="Followers" value={formatOptionalNumber(creator.followerCount)} />
            <MiniMetric label="Average views" value={formatOptionalNumber(creator.averageViews)} />
            <MiniMetric label="Clicks" value={formatOptionalNumber(creator.clicks)} />
            <MiniMetric label="Attributed sales" value={formatOptionalCurrency(creator.sales)} />
            <MiniMetric label="Spend" value={formatOptionalCurrency(creator.spend)} />
            <MiniMetric label="ROAS" value={formatOptionalRate(creator.roas, "x")} />
            <MiniMetric label="Orders" value={formatOptionalNumber(creator.orders)} />
            <MiniMetric label="Engagement" value={formatOptionalRate(creator.engagementRate, "%")} />
            <MiniMetric label="Conversion rate" value={formatOptionalRate(creator.conversionRate, "%")} />
            <MiniMetric label="Video views" value={formatOptionalNumber(creator.videoViews)} />
            <MiniMetric label="Completion" value={formatOptionalRate(creator.videoCompletionRate, "%")} />
            <MiniMetric label="AOV" value={formatOptionalCurrency(creator.aov)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Account profile
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Primary channel" value={creator.channel} />
                <DetailRow label="Niche" value={creator.niche} />
                <DetailRow
                  label="Top product"
                  value={creator.topProduct || creator.productTitle}
                />
                <DetailRow
                  label="Best content angle"
                  value={creator.topCreativeAngle || creator.specialty}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Heuristic guidance
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {creator.decision}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {creator.recommendation}
              </p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <CreatorInsightList title="Strengths" items={creator.strengths} />
            <CreatorInsightList title="Watchouts" items={creator.weaknesses} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Recommended next action
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {creator.recommendedNextAction}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Top tracked creative records
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Performance records saved to this workspace for this creator.
                </p>
              </div>

              <Link
                to={withEmbeddedRouteParams(
                  `/app/creators/${encodeURIComponent(creator.id)}`,
                  search,
                )}
                className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
              >
                Open full page
              </Link>
            </div>

            {topRecords.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {topRecords.map((record) => (
                  <div
                    key={record.id || record.sourceCreativeId}
                    className="rounded-2xl border border-white/10 bg-[#07101d] p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                      {record.label || formatSyncStatus(record.syncStatus) || "Tracked record"}
                    </p>
                    <h3 className="mt-2 font-black text-white">
                      {record.creativeTitle || "Creative record"}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {record.productTitle || creator.topProduct}
                    </p>
                    <p className="mt-3 text-sm font-bold text-cyan-100">
                      {formatOptionalCurrency(record.revenue)} ·{" "}
                      {formatOptionalNumber(record.orders)} orders
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-white/10 bg-[#07101d] p-4 text-sm leading-6 text-slate-400">
                No individual creative performance records are attached to this
                creator yet. Import creator attribution or add manual metrics to
                populate record-level details.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value || "Not set"}</p>
    </div>
  );
}

function CreatorInsightList({ title, items = [] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.length ? (
          items.map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>No notes saved yet.</li>
        )}
      </ul>
    </div>
  );
}

function PerformanceMetric({ detail, icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-300">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ManagementRecommendation({
  creativesCount,
  hasProfileContext,
  profile,
  shop,
  topCreator,
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
      <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
        Heuristic management suggestion
      </p>
      <h2 className="mt-3 text-3xl font-black text-white">
        {topCreator ? `Scale ${topCreator.name}` : "Import creator data"}
      </h2>

      {topCreator ? (
        <>
          <p className="mt-4 leading-7 text-slate-400">
            Based on merchant-imported fields, {topCreator.name} ranks highest by blended
            clicks, engagement, orders, and attributed sales. Increase spend or
            assign a new creative test while monitoring conversion quality.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Workspace" value={profile.mainProduct || shop} />
            <MiniMetric label="Heuristic guidance" value={topCreator.decision} />
            <MiniMetric label="Saved creatives" value={String(creativesCount)} />
            <MiniMetric
              label="Profile context"
              value={hasProfileContext ? "Available" : "Incomplete"}
            />
          </div>
        </>
      ) : (
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Import creator account links, clicks, engagement, and order attribution
          to compare performance.
        </p>
      )}
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

export function buildCreatorPerformanceRows(creators = [], performanceRecords = []) {
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
        performanceRecords.filter((record) => record.shopifyProductId === creator.productId);
      const imported = creator.status === "Imported";
      const clicks = aggregateNullable(matchingRecords, "clicks");
      const orders = aggregateNullable(matchingRecords, "orders");
      const sales = aggregateNullable(matchingRecords, "revenue");
      const spend = aggregateNullable(matchingRecords, "spend");
      const views = aggregateNullable(matchingRecords, "views");
      const videoViews = matchingRecords.reduce((sum, record) => sum + Number(record.videoViews || record.views || 0), 0);
      const videoCompletions = matchingRecords.reduce((sum, record) => sum + Number(record.video100PercentWatched || 0), 0);
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
      const importedEngagementRates = matchingRecords
        .map((record) => record.engagementRate)
        .filter((value) => value !== null && value !== undefined && value !== "");
      const finalClicks = imported ? clicks : clicks || Math.round(creator.averageViews * 0.08);
      const finalOrders = imported ? orders : orders || creator.orders;
      const finalSales = imported ? sales : sales || creator.revenue;
      const finalViews = imported ? views : views || creator.averageViews;
      const engagementRate = importedEngagementRates.length
        ? Number((importedEngagementRates.reduce((sum, value) => sum + Number(value), 0) / importedEngagementRates.length).toFixed(1))
        : views !== null && views > 0
        ? Number(((engagements / views) * 100).toFixed(1))
        : imported ? null : creator.engagementRate;
      const conversionRate = finalClicks && finalOrders !== null
        ? Number(((finalOrders / finalClicks) * 100).toFixed(1))
        : imported ? null : creator.conversionRate;
      const roas = spend && finalSales !== null ? Number((finalSales / spend).toFixed(2)) : null;
      const videoCompletionRate = videoViews
        ? Number(((videoCompletions / videoViews) * 100).toFixed(1))
        : null;
      const aov = finalSales !== null && finalOrders
        ? Number((finalSales / finalOrders).toFixed(0))
        : null;
      const performanceScore = Math.min(
        99,
        Math.round(
          creator.fitScore * 0.25 +
            Number(engagementRate || 0) * 5 +
            Number(conversionRate || 0) * 7 +
            Number(orders || 0) * 0.2 +
            Math.min(matchingRecords.length, 4) * 6,
        ),
      );
      const campaignTotals = new Map();
      matchingRecords.forEach((record) => {
        const name = record.workspaceCampaignName || record.campaignName;
        if (name) campaignTotals.set(name, (campaignTotals.get(name) || 0) + Number(record.revenue || 0));
      });
      const campaigns = [...campaignTotals.entries()].sort((a, b) => b[1] - a[1]);

      return {
        ...creator,
        aov,
        channel:
          matchingRecords[0]?.sourcePlatform === "shopify_demo"
            ? creator.platform
            : matchingRecords[0]?.sourcePlatform || creator.platform,
        clicks: finalClicks,
        conversionRate,
        decision:
          performanceScore >= 88
            ? "Scale"
            : performanceScore >= 78
              ? "Keep testing"
              : "Coach or pause",
        engagementRate,
        orders: finalOrders,
        performanceScore,
        recommendation:
          matchingRecords[0]?.sourcePlatform === "shopify_demo"
            ? "Demo performance data. Connect an ad platform or add manual metrics before making creator decisions."
            : matchingRecords[0]?.importSource === "public_engagement_import"
            ? "Merchant-provided public engagement records show this creator's current traction. Add deeper performance stats when available to improve confidence."
            : performanceScore >= 88
            ? "Scale this creator with a new brief, more product links, or a larger campaign allocation."
            : performanceScore >= 78
              ? "Keep this creator in testing and improve the offer, landing path, or CTA before scaling."
              : "Review fit, creative quality, and traffic source before assigning more budget.",
        sales: finalSales,
        spend,
        roas,
        topCampaign: campaigns[0]?.[0] || "Unassigned",
        campaignsContributedTo: campaigns.map(([name]) => name),
        topPerformanceRecords: matchingRecords
          .sort((left, right) => Number(right.revenue || 0) - Number(left.revenue || 0))
          .slice(0, 3),
        views: finalViews,
        videoCompletionRate,
        videoViews,
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore);
}

function buildImportedCreatorBase(key, records = []) {
  const first = records[0] || {};
  const handle = first.creatorHandle || "Not imported";
  const views = aggregateNullable(records, "views");
  const orders = aggregateNullable(records, "orders");
  const revenue = aggregateNullable(records, "revenue");
  const spend = aggregateNullable(records, "spend");
  const productTitle =
    first.productTitle || first.productLabel || first.productHandle || "Imported product";

  return {
    id: key,
    name: first.creatorName || first.creatorHandle || key,
    handle,
    platform: first.sourcePlatform || first.platform || "Imported",
    niche: "Imported public engagement",
    topProduct: productTitle,
    topCreativeAngle: first.angle || first.creativeTitle || "Not imported",
    productId: first.shopifyProductId || "",
    productTitle,
    fitScore: 70,
    averageViews: views === null ? null : Math.round(views / Math.max(records.length, 1)),
    clicks: aggregateNullable(records, "clicks"),
    orders,
    revenue,
    spend,
    roas: spend && revenue !== null ? Number((revenue / spend).toFixed(2)) : null,
    engagementRate: null,
    conversionRate: null,
    followerCount: null,
    status: "Imported",
    specialty: "Public engagement records",
    strengths: [
      "Imported creator performance records are available.",
      ...(first.creatorNotes ? [first.creatorNotes] : []),
    ],
    notes: first.creatorNotes || "",
    weaknesses: revenue
      ? []
      : ["Clicks, orders, and revenue are not available for every imported row."],
    recommendedNextAction:
      "Use this creator in a product-specific brief, then import deeper performance stats when available.",
  };
}

function aggregateNullable(records, key) {
  const values = records
    .map((record) => record[key])
    .filter((value) => value !== null && value !== undefined && value !== "");
  return values.length
    ? values.reduce((sum, value) => sum + Number(value), 0)
    : null;
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

function summarizeCreators(creators = []) {
  const clicks = creators.reduce((sum, creator) => sum + Number(creator.clicks || 0), 0);
  const orders = creators.reduce((sum, creator) => sum + Number(creator.orders || 0), 0);
  const sales = creators.reduce((sum, creator) => sum + Number(creator.sales || 0), 0);
  const spend = creators.reduce((sum, creator) => sum + Number(creator.spend || 0), 0);
  const creatorsWithEngagement = creators.filter(
    (creator) => creator.engagementRate !== null && creator.engagementRate !== undefined,
  );
  const engagementWeight = creatorsWithEngagement.reduce(
    (sum, creator) => sum + (Number(creator.views || 0) || Number(creator.clicks || 0) || 1),
    0,
  );
  const weightedEngagement = creatorsWithEngagement.reduce(
    (sum, creator) =>
      sum + Number(creator.engagementRate) * (Number(creator.views || 0) || Number(creator.clicks || 0) || 1),
    0,
  );

  return {
    clicks,
    conversionRate: clicks ? (orders / clicks) * 100 : 0,
    engagementRate: engagementWeight ? weightedEngagement / engagementWeight : null,
    orders,
    roas: spend ? sales / spend : null,
    sales,
    spend,
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

function formatSyncStatus(value = "") {
  const labels = {
    imported_public_engagement: "Imported public engagement",
    manual_entry: "Manual entry",
    saved_in_app: "Saved in app",
  };
  const key = String(value || "").trim();

  return labels[key] || key.replace(/_/g, " ");
}
