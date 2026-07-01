import { Eye, Lightbulb, MousePointer2, ShoppingBag, TrendingUp, Video } from "lucide-react";

function compactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function pct(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

function roas(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}x`;
}

export default function StatCards({ data }) {
  const totals = data?.totals || data || {};

  const stats = [
    {
      label: "Total Creatives",
      raw: totals.creatives,
      value: compactNumber(totals.creatives),
      icon: Video,
      accent: "text-sky-400",
      iconBg: "bg-sky-500/15",
    },
    {
      label: "Total Views",
      raw: totals.views,
      value: compactNumber(totals.views),
      icon: Eye,
      accent: "text-emerald-400",
      iconBg: "bg-emerald-500/15",
    },
    {
      label: "Orders Generated",
      raw: totals.orders,
      value: compactNumber(totals.orders),
      icon: ShoppingBag,
      accent: "text-amber-400",
      iconBg: "bg-amber-500/15",
    },
    {
      label: "Avg. CTR",
      raw: totals.ctr,
      value: pct(totals.ctr),
      icon: MousePointer2,
      accent: "text-blue-400",
      iconBg: "bg-blue-500/15",
    },
    {
      label: "Avg. ROAS",
      raw: totals.roas,
      value: roas(totals.roas),
      icon: TrendingUp,
      accent: "text-rose-400",
      iconBg: "bg-rose-500/15",
    },
    {
      label: "Recommendations",
      raw: totals.recommendations,
      value: compactNumber(totals.recommendations),
      icon: Lightbulb,
      accent: "text-violet-400",
      iconBg: "bg-violet-500/15",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const hasData = Number(stat.raw || 0) > 0;

        return (
          <div
            key={stat.label}
            className="bg-[#0d1526] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                <Icon size={15} className={stat.accent} />
              </div>

              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  hasData ? "bg-sky-500/15 text-sky-400" : "bg-white/10 text-slate-400"
                }`}
              >
                {hasData ? "Live" : "Not imported"}
              </span>
            </div>

            <p className="text-[22px] font-bold text-white leading-none mb-1 group-hover:text-sky-50 transition-colors">
              {hasData ? stat.value : "—"}
            </p>

            <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
