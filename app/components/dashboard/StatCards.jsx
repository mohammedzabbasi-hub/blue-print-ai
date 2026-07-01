import {
  FileText,
  Gauge,
  Library,
  Lightbulb,
  Video,
} from "lucide-react";

function compactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function StatCards({ data }) {
  const totals = data?.totals || data || {};

  const stats = [
    {
      label: "Saved Creatives",
      value: compactNumber(totals.creatives),
      icon: Library,
      accent: "text-sky-400",
      iconBg: "bg-sky-500/15",
    },
    {
      label: "Video Analyses",
      value: compactNumber(totals.analyses),
      icon: Video,
      accent: "text-emerald-400",
      iconBg: "bg-emerald-500/15",
    },
    {
      label: "Saved Briefs",
      value: compactNumber(totals.briefs),
      icon: FileText,
      accent: "text-amber-400",
      iconBg: "bg-amber-500/15",
    },
    {
      label: "Blueprints",
      value: compactNumber(totals.blueprints),
      icon: Lightbulb,
      accent: "text-blue-400",
      iconBg: "bg-blue-500/15",
    },
    {
      label: "Estimated workflow progress",
      value: `${Number(totals.readiness || 0)}%`,
      icon: Gauge,
      accent: "text-rose-400",
      iconBg: "bg-rose-500/15",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="bg-[#0d1526] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                <Icon size={15} className={stat.accent} />
              </div>

            </div>

            <p className="text-[22px] font-bold text-white leading-none mb-1 group-hover:text-sky-50 transition-colors">
              {stat.value}
            </p>

            <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
          </div>
        );
      })}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Workflow progress is a directional completion indicator based on saved app activity and available heuristic analysis scores. It is not measured ad performance or a prediction of results.
      </p>
    </div>
  );
}
