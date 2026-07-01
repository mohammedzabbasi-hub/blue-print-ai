import { FileText, Flame, Gauge, Library, Settings, Zap } from "lucide-react";
import { Link, useLocation } from "react-router";
import { withEmbeddedRouteParams } from "../../utils/embedded-routing";

const iconByType = {
  analysis: Flame,
  blueprint: Gauge,
  brief: FileText,
  creative: Library,
  review: Zap,
  settings: Settings,
};

const colorByType = {
  analysis: "rose",
  blueprint: "emerald",
  brief: "sky",
  creative: "sky",
  review: "emerald",
  settings: "amber",
};

function buildActions(data) {
  return Array.isArray(data?.next_actions) ? data.next_actions : [];
}

function ActionCard({
  actionLabel,
  description,
  href,
  priority,
  title,
  type,
}) {
  const location = useLocation();
  const Icon = iconByType[type] || Zap;
  const color = colorByType[type] || "sky";
  const colorClasses = {
    amber: "bg-amber-500/15 text-amber-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    rose: "bg-rose-500/15 text-rose-300",
    sky: "bg-sky-500/15 text-sky-300",
  };

  const priorityClasses = {
    High: "bg-rose-500/15 text-rose-300",
    Low: "bg-emerald-500/15 text-emerald-300",
    Medium: "bg-amber-500/15 text-amber-300",
  };

  return (
    <div className="border border-white/10 rounded-2xl p-6 bg-[#0d1526]">
      <div className="flex items-start gap-5">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon size={22} />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-white leading-tight">
              {title}
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${
                priorityClasses[priority] || priorityClasses.Medium
              }`}
            >
              {priority || "Medium"}
            </span>
          </div>

          <p className="mt-3 text-slate-400 leading-relaxed">{description}</p>

          {href ? (
            <Link
              to={withEmbeddedRouteParams(href, location.search)}
              className="mt-5 inline-block text-sky-300 font-bold hover:text-sky-200 transition-colors"
            >
              {actionLabel || "Open"} -&gt;
            </Link>
          ) : (
            <span className="mt-5 inline-block text-slate-500 font-bold">
              {actionLabel || "Review"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NextActions({ data }) {
  const actions = buildActions(data);

  return (
    <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-sky-500/15 flex items-center justify-center text-sky-300">
          <Zap size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Recommended Actions</h2>
          <p className="text-slate-400">Based on saved workspace gaps</p>
        </div>
      </div>

      <div className="space-y-5">
        {actions.length === 0 && (
          <div className="border border-white/10 rounded-2xl p-6 bg-[#0d1526]">
            <p className="text-sm font-semibold text-slate-300">
              No recommended actions yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Analyze a video or save a creative to generate next steps.
            </p>
          </div>
        )}

        {actions.map((action) => (
          <ActionCard key={action.title} {...action} />
        ))}
      </div>
    </div>
  );
}
