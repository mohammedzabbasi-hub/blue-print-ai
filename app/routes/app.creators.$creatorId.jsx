import { Link, useLoaderData, useLocation } from "react-router";

import {
  listCreatorProfiles,
} from "../models/creator-attribution.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Creator Detail | BluePrintAI" }];
};

export const loader = async ({ request, params }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const profiles = await listCreatorProfiles(session.shop);
  const requestedId = normalizeCreatorKey(decodeURIComponent(params.creatorId || ""));
  const profile = profiles.find((candidate) =>
    [candidate.id, candidate.handle, candidate.name, candidate.normalizedHandle, candidate.normalizedName]
      .map(normalizeCreatorKey)
      .includes(requestedId),
  );
  const creator = profile ? buildPersistedCreatorDetail(profile) : null;

  return {
    creator,
    merchantData,
  };
};

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};

export default function CreatorDetailRoute() {
  const { creator, merchantData } = useLoaderData();
  const location = useLocation();

  if (!creator) {
    return (
      <main className="space-y-7">
        <section className="glass-strong rounded-2xl p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Creator performance
          </p>
          <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Creator insight unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            Creator attribution is not available for this account yet. Return to
            Creators to compare available account performance records.
          </p>
          <Link
            to={withEmbeddedRouteParams("/app/creators", location.search)}
            className="bp-primary-cta mt-6"
          >
            Back to Creators
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-7">
      <section className="glass-strong rounded-2xl p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Creator performance
            </p>
            <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
              {creator.name}
            </h1>
            <p className="mt-2 font-semibold text-slate-500">
              {creator.handle} · {creator.channel}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review this creator account by traffic, engagement, attributed
              clicks, orders, sales, and conversion quality. Current values are
              merchant-imported CSV data. It is not connected-platform analytics.
            </p>
          </div>

        </div>
      </section>

      {merchantData.errors?.map((error) => (
        <div
          key={error}
          className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 font-semibold text-amber-100"
        >
          {error}
        </div>
      ))}

      <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/10 p-5 text-sm leading-6 text-cyan-50">
        Imported data. Creator traffic, engagement, orders, and revenue on this
        page were provided through CSV import. Missing connected-platform analytics
        remain “Not imported.” Scores and guidance are heuristic.
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Heuristic performance score" value={`${creator.performanceScore}/100`} />
        <StatCard label="Creator views" value={formatOptionalNumber(creator.views)} />
        <StatCard label="Creator clicks" value={formatOptionalNumber(creator.clicks)} />
        <StatCard label="Attributed sales" value={formatOptionalCurrency(creator.sales)} />
        <StatCard label="Conversion rate" value={creator.conversionRate == null ? "Not imported" : `${creator.conversionRate}%`} />
      </section>

      <section>
        <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Creator account analysis
          </p>
          <h2 className="mt-3 text-3xl font-black text-white">
            Performance direction
          </h2>
          <p className="mt-4 leading-7 text-slate-400">
            {creator.name} is currently marked as {creator.decision.toLowerCase()}
            based on blended clicks, engagement, orders, and sales contribution.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-bold text-slate-500">Top product</p>
            <p className="mt-1 text-xl font-black text-white">
              {creator.topProduct || creator.productTitle}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-bold text-slate-500">Best content angle</p>
            <p className="mt-1 text-xl font-black text-white">
              {creator.topCreativeAngle}
            </p>
          </div>
        </div>

      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <InsightList title="Strengths" items={creator.strengths} />
        <InsightList title="Weaknesses" items={creator.weaknesses} />
        <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Next brief
          </p>
          <p className="mt-4 leading-7 text-slate-300">
            {creator.recommendedNextAction}
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          Top creatives
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(creator.topCreatives || []).map((creative) => (
            <div key={creative.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                Imported performance data
              </p>
              <h3 className="mt-2 font-black text-white">{creative.creativeTitle}</h3>
              <p className="mt-2 text-sm text-slate-400">{creative.productTitle}</p>
              <p className="mt-3 text-sm font-bold text-cyan-100">
                {formatOptionalCurrency(creative.revenue)} · {formatOptionalNumber(creative.orders)} orders
              </p>
            </div>
          ))}
        </div>
      </section>

      <Link
        to={withEmbeddedRouteParams("/app/creators", location.search)}
        className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-200 transition hover:bg-white/10"
      >
        Back to Creators
      </Link>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-xl shadow-black/10">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-400">{label}</p>
    </div>
  );
}

function InsightList({ title, items = [] }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
        {title}
      </p>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function buildPersistedCreatorDetail(profile) {
  const matchingRecords = (profile.attributions || [])
    .map((item) => ({ ...item.creativePerformance, ...item }))
    .filter(Boolean);
  const sumNullable = (field) => {
    const values = matchingRecords
      .map((record) => record[field])
      .filter((value) => value !== null && value !== undefined && value !== "");
    return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
  };
  const clicks = sumNullable("clicks");
  const views = sumNullable("videoViews");
  const orders = sumNullable("orders");
  const sales = sumNullable("revenue");
  const engagementCount = sumNullable("engagements");
  const engagementRate = views && engagementCount !== null
    ? Number(((engagementCount / views) * 100).toFixed(1))
    : null;
  const conversionRate = clicks && orders !== null
    ? Number(((orders / clicks) * 100).toFixed(1))
    : null;
  const performanceScore = Math.min(
    99,
    Math.round(
      35 + Number(engagementRate || 0) * 5 +
        Number(conversionRate || 0) * 6 + Number(orders || 0) * 0.18,
    ),
  );
  const first = matchingRecords[0] || {};

  return {
    id: profile.id,
    name: profile.name || profile.handle || "Imported creator",
    handle: profile.handle || "Not imported",
    channel: profile.platform || first.platform || "Imported CSV",
    clicks,
    conversionRate,
    decision:
      performanceScore >= 88
        ? "Scale"
        : performanceScore >= 78
          ? "Keep testing"
          : "Coach or pause",
    engagementRate,
    orders,
    performanceScore,
    sales,
    topProduct: first.productName || "Not imported",
    productTitle: first.productName || "Not imported",
    topCreativeAngle: first.adName || "Not imported",
    strengths: ["Imported creator performance records are available."],
    weaknesses: ["Connected-platform analytics are not available."],
    recommendedNextAction: "Use the imported evidence to plan the next test; verify results in the source platform before scaling.",
    topCreatives: matchingRecords.slice(0, 3).map((record) => ({
      id: record.id,
      creativeTitle: record.adName || "Imported creative",
      productTitle: record.productName || "Not imported",
      revenue: record.revenue,
      orders: record.orders,
    })),
    views,
  };
}

function normalizeCreatorKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, "");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

function formatOptionalCurrency(value) {
  return value === null || value === undefined ? "Not imported" : formatCurrency(value);
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? "Not imported" : formatNumber(value);
}
