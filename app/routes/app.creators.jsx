import { useMemo } from "react";
import { useLoaderData } from "react-router";
import { Users, Eye, DollarSign, ShoppingBag } from "lucide-react";

import { authenticate } from "../shopify.server";
import { buildImportedCreators } from "../models/importedData.server";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";

export const meta = () => {
  return [{ title: "Creators | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const creators = await buildImportedCreators(session.shop);
  return { creators };
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US").format(number);
};

const formatMoney = (value) => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `$${new Intl.NumberFormat("en-US").format(Math.round(number))}`;
};

const formatEngagementRate = (value) => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(1)}%`;
};

const getCreatorInitial = (creator) => {
  return (creator?.name || creator?.handle || "C").charAt(0).toUpperCase();
};

export default function CreatorsRoute() {
  const { creators } = useLoaderData();

  const totals = useMemo(() => {
    const totalViews = creators.reduce(
      (sum, creator) => sum + Number(creator.totalViews || 0),
      0
    );

    const totalRevenue = creators.reduce(
      (sum, creator) => sum + Number(creator.totalRevenue || 0),
      0
    );

    const totalOrders = creators.reduce(
      (sum, creator) => sum + Number(creator.totalOrders || 0),
      0
    );

    const topCreator = creators[0] || null;

    return {
      totalViews,
      totalRevenue,
      totalOrders,
      topCreator,
    };
  }, [creators]);

  return (
    <main className="space-y-7">
      <section className="glass-strong rounded-2xl p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Creator Intelligence
            </p>

            <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Creator Performance
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              Compare imported creator performance across views, engagement,
              orders, and revenue for your connected shop.
            </p>
          </div>
        </div>
      </section>

      {creators.length === 0 ? (
        <EmptyWorkspaceState
          eyebrow="Creators"
          title="Not imported"
          description="No creator data has been imported yet. Upload a creators.csv on the Data Import page to see creator performance here."
          primaryLabel="Go to Data Import"
          primaryLink="/app/data-import"
          secondaryLabel={null}
          secondaryLink={null}
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Creators"
              value={formatNumber(creators.length)}
              badge="Imported"
            />
            <StatCard
              icon={Eye}
              label="Total Views"
              value={formatNumber(totals.totalViews)}
              badge="Imported"
            />
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={formatMoney(totals.totalRevenue)}
              badge="Imported"
            />
            <StatCard
              icon={ShoppingBag}
              label="Orders"
              value={formatNumber(totals.totalOrders)}
              badge="Imported"
            />
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
            <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                  Creator Cards
                </p>
                <h2 className="mt-3 text-3xl font-black text-white">
                  Top creator profiles
                </h2>
              </div>

              <p className="max-w-xl text-sm font-medium text-slate-400">
                Creator cards are simplified so the page feels closer to your
                Dashboard, Recommendations, Ad Briefs, and Video Analysis
                layouts.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {creators.map((creator, index) => (
                <CreatorProfileCard
                  key={creator.id || creator.name || index}
                  creator={creator}
                  index={index}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
              <div className="mb-5">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                  Comparison Table
                </p>
                <h2 className="mt-3 text-3xl font-black text-white">
                  Creator leaderboard
                </h2>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.25em] text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Creator</th>
                      <th className="px-5 py-4">Views</th>
                      <th className="px-5 py-4">Orders</th>
                      <th className="px-5 py-4">Revenue</th>
                      <th className="px-5 py-4">Engagement Rate</th>
                    </tr>
                  </thead>

                  <tbody>
                    {creators.map((creator, index) => (
                      <tr
                        key={creator.id || creator.name || index}
                        className="border-t border-white/10 text-sm text-slate-200"
                      >
                        <td className="px-5 py-4">
                          <div className="font-black text-white">
                            {creator.name || `Creator ${index + 1}`}
                          </div>
                          <div className="text-slate-500">
                            {creator.handle || "@creator"}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold">
                          {formatNumber(creator.totalViews)}
                        </td>
                        <td className="px-5 py-4 font-bold">
                          {formatNumber(creator.totalOrders)}
                        </td>
                        <td className="px-5 py-4 font-bold">
                          {formatMoney(creator.totalRevenue)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 font-black text-cyan-200">
                            {formatEngagementRate(creator.engagementRate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-7">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                Creator Comparison
              </p>
              <h2 className="mt-3 text-3xl font-black text-white">
                Best current creator
              </h2>

              <p className="mt-4 leading-7 text-slate-400">
                {totals.topCreator?.name || "Your top creator"} is currently
                the highest-revenue creator imported for this shop.
              </p>

              {totals.topCreator && (
                <div className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-5">
                  <p className="text-sm font-bold text-cyan-200">
                    Top Creator
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {totals.topCreator.name}
                  </h3>
                  <p className="mt-1 text-slate-400">
                    {totals.topCreator.handle || "@creator"}
                  </p>
                  <div className="mt-5 flex items-end justify-between">
                    <span className="text-slate-400">Engagement Rate</span>
                    <span className="text-3xl font-black text-white">
                      {formatEngagementRate(totals.topCreator.engagementRate)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {creators.slice(0, 4).map((creator, index) => (
                  <div
                    key={creator.id || creator.name || index}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div>
                      <p className="font-black text-white">
                        #{index + 1} {creator.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {creator.handle || "@creator"}
                      </p>
                    </div>
                    <p className="font-black text-white">
                      {formatEngagementRate(creator.engagementRate)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ icon: Icon, label, value, badge }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>

        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
          {badge}
        </span>
      </div>

      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-400">{label}</p>
    </div>
  );
}

function CreatorProfileCard({ creator, index }) {
  const hasEngagementRate =
    creator.engagementRate !== null && creator.engagementRate !== undefined;

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.04]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-indigo-500 text-2xl font-black text-white">
            {getCreatorInitial(creator)}
          </div>

          <div>
            <h3 className="text-xl font-black text-white">
              {creator.name || `Creator ${index + 1}`}
            </h3>
            <p className="font-semibold text-slate-500">
              {creator.handle || "@creator"}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
          #{index + 1}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <MiniMetric label="Followers" value={formatNumber(creator.followers)} />
        <MiniMetric label="Views" value={formatNumber(creator.totalViews)} />
        <MiniMetric label="Orders" value={formatNumber(creator.totalOrders)} />
        <MiniMetric label="Revenue" value={formatMoney(creator.totalRevenue)} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#07101d] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-slate-400">Engagement rate</span>
          <span className="font-black text-cyan-200">
            {formatEngagementRate(creator.engagementRate)}
          </span>
        </div>

        {hasEngagementRate ? (
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
              style={{
                width: `${Math.max(0, Math.min(100, creator.engagementRate))}%`,
              }}
            />
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-500">
            Not enough imported data to compute an engagement rate.
          </p>
        )}
      </div>
    </article>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
