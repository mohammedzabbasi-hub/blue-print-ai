import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Users,
  Eye,
  DollarSign,
  ShoppingBag,
} from "lucide-react";

import CreatorForm from "../components/CreatorForm";
import {
  createCreator,
  getCreatorComparison,
  getCreators,
} from "../services/creatorsApi";

export const meta = () => {
  return [{ title: "Creators | BluePrintAI" }];
};

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  return `$${new Intl.NumberFormat("en-US").format(Math.round(number))}`;
};

const getCreatorInitial = (creator) => {
  return (creator?.name || creator?.tiktok_handle || "C")
    .charAt(0)
    .toUpperCase();
};

const getScore = (creator, index) => {
  const views = Number(creator.total_views || creator.views || 0);
  const revenue = Number(creator.total_revenue || creator.revenue || 0);
  const conversions = Number(
    creator.total_conversions || creator.conversions || 0
  );

  const raw = views / 50000 + revenue / 5000 + conversions / 200;
  return Math.max(42, Math.min(99, Math.round(raw + 70 - index * 4)));
};

export default function CreatorsRoute() {
  const [creators, setCreators] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCreators() {
    try {
      setLoading(true);

      const creatorsData = await getCreators();
      const comparisonData = await getCreatorComparison();

      setCreators(creatorsData || []);
      setComparison(comparisonData || null);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load creators");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCreator(formData) {
    try {
      await createCreator(formData);
      setShowForm(false);
      await loadCreators();
    } catch (err) {
      setError(err.message || "Failed to create creator");
    }
  }

  useEffect(() => {
    loadCreators();
  }, []);

  const totals = useMemo(() => {
    const totalViews = creators.reduce(
      (sum, creator) => sum + Number(creator.total_views || creator.views || 0),
      0
    );

    const totalRevenue = creators.reduce(
      (sum, creator) =>
        sum + Number(creator.total_revenue || creator.revenue || 0),
      0
    );

    const totalConversions = creators.reduce(
      (sum, creator) =>
        sum + Number(creator.total_conversions || creator.conversions || 0),
      0
    );

    const topCreator = [...creators].sort(
      (a, b) =>
        Number(b.total_revenue || b.revenue || 0) -
        Number(a.total_revenue || a.revenue || 0)
    )[0];

    return {
      totalViews,
      totalRevenue,
      totalConversions,
      topCreator,
    };
  }, [creators]);

  const rankedCreators = useMemo(() => {
    return [...creators].sort(
      (a, b) =>
        Number(b.total_revenue || b.revenue || 0) -
        Number(a.total_revenue || a.revenue || 0)
    );
  }, [creators]);

  if (loading) {
    return (
      <main className="space-y-8">
        <div className="glass rounded-2xl p-8">
          <p className="text-muted-foreground">Loading creators...</p>
        </div>
      </main>
    );
  }

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
              Compare creator performance across views, engagement, conversions,
              revenue, and consistency for your connected TikTok Shop.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadCreators}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setShowForm((previous) => !previous)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-3 font-black text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Close" : "Add Creator"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-semibold text-red-200">
          {error}
        </div>
      )}

      {showForm && (
        <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-6 shadow-xl shadow-black/20">
          <CreatorForm
            onSubmit={handleCreateCreator}
            submitLabel="Add Creator"
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Creators"
          value={formatNumber(creators.length)}
          badge="Live"
        />
        <StatCard
          icon={Eye}
          label="Total Views"
          value={formatNumber(totals.totalViews)}
          badge="Live"
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatMoney(totals.totalRevenue)}
          badge="Live"
        />
        <StatCard
          icon={ShoppingBag}
          label="Conversions"
          value={formatNumber(totals.totalConversions)}
          badge="Live"
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
            Dashboard, Recommendations, Ad Briefs, and Video Analysis layouts.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {rankedCreators.map((creator, index) => (
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
                  <th className="px-5 py-4">Conversions</th>
                  <th className="px-5 py-4">Revenue</th>
                  <th className="px-5 py-4">Score</th>
                </tr>
              </thead>

              <tbody>
                {rankedCreators.map((creator, index) => (
                  <tr
                    key={creator.id || creator.name || index}
                    className="border-t border-white/10 text-sm text-slate-200"
                  >
                    <td className="px-5 py-4">
                      <div className="font-black text-white">
                        {creator.name || `Creator ${index + 1}`}
                      </div>
                      <div className="text-slate-500">
                        {creator.tiktok_handle ||
                          creator.handle ||
                          "@creator"}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold">
                      {formatNumber(creator.total_views || creator.views)}
                    </td>
                    <td className="px-5 py-4 font-bold">
                      {formatNumber(
                        creator.total_conversions || creator.conversions
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold">
                      {formatMoney(creator.total_revenue || creator.revenue)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 font-black text-cyan-200">
                        {getScore(creator, index)}/100
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
            {totals.topCreator?.name ||
              comparison?.top_creator?.name ||
              "Your top creator"}{" "}
            is currently the strongest creator for this shop based on views,
            conversions, revenue, and consistency.
          </p>

          {totals.topCreator && (
            <div className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-5">
              <p className="text-sm font-bold text-cyan-200">Top Creator</p>
              <h3 className="mt-2 text-2xl font-black text-white">
                {totals.topCreator.name}
              </h3>
              <p className="mt-1 text-slate-400">
                {totals.topCreator.tiktok_handle || "@creator"}
              </p>
              <div className="mt-5 flex items-end justify-between">
                <span className="text-slate-400">Performance Score</span>
                <span className="text-3xl font-black text-white">
                  {getScore(totals.topCreator, 0)}/100
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {rankedCreators.slice(0, 4).map((creator, index) => (
              <div
                key={creator.id || creator.name || index}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div>
                  <p className="font-black text-white">
                    #{index + 1} {creator.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {creator.tiktok_handle || "@creator"}
                  </p>
                </div>
                <p className="font-black text-white">
                  {getScore(creator, index)}/100
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
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
  const views = creator.total_views || creator.views || 0;
  const revenue = creator.total_revenue || creator.revenue || 0;
  const conversions = creator.total_conversions || creator.conversions || 0;
  const videos = creator.total_videos || creator.videos || 0;
  const followers = creator.follower_count || creator.followers || 0;

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
              {creator.tiktok_handle || creator.handle || "@creator"}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
          #{index + 1}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <MiniMetric label="Followers" value={formatNumber(followers)} />
        <MiniMetric label="Videos" value={formatNumber(videos)} />
        <MiniMetric label="Views" value={formatNumber(views)} />
        <MiniMetric label="Revenue" value={formatMoney(revenue)} />
        <MiniMetric label="Conversions" value={formatNumber(conversions)} />
        <MiniMetric label="Score" value={`${getScore(creator, index)}/100`} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#07101d] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-slate-400">Creator strength</span>
          <span className="font-black text-cyan-200">
            {getScore(creator, index)}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
            style={{ width: `${getScore(creator, index)}%` }}
          />
        </div>
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