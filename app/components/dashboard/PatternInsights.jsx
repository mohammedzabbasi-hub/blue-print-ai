import { Sparkles } from "lucide-react";

const GROUPS = [
  {
    category: "Hook Types",
    key: "hooks",
    colors: ["bg-sky-500", "bg-blue-500", "bg-cyan-500"],
  },
  {
    category: "Creator Styles",
    key: "creator_types",
    colors: ["bg-emerald-500", "bg-teal-500", "bg-green-500"],
  },
  {
    category: "Humor Styles",
    key: "humor_styles",
    colors: ["bg-amber-500", "bg-orange-500", "bg-yellow-500"],
  },
  {
    category: "Delivery Styles",
    key: "delivery_styles",
    colors: ["bg-rose-500", "bg-pink-500", "bg-red-500"],
  },
];

function toPatternItems(map, colors) {
  const entries = Object.entries(map || {})
    .map(([label, count]) => [label, Number(count || 0)])
    .filter(([label, count]) => label && count > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return [];

  return entries.slice(0, 3).map(([label, count], index) => ({
    label,
    pct: Math.round((count / total) * 100),
    color: colors[index] || colors[0],
  }));
}

function buildPatternGroups(data) {
  const source = data?.patterns || {};

  return GROUPS.map((group) => ({
    category: group.category,
    items: toPatternItems(source[group.key], group.colors),
  })).filter((group) => group.items.length > 0);
}

export default function PatternInsights({ data }) {
  const patternGroups = buildPatternGroups(data);

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5 h-full">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 bg-sky-500/15 rounded-md flex items-center justify-center">
          <Sparkles size={12} className="text-sky-400" />
        </div>

        <div>
          <h2 className="text-[14px] font-semibold text-white leading-none">Pattern Insights</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Win-rate by creative type</p>
        </div>
      </div>

      <div className="space-y-5">
        {patternGroups.length === 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-300">
              No pattern insights yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Import data or upload creatives to generate shop-specific patterns.
            </p>
          </div>
        )}

        {patternGroups.map((group) => (
          <div key={group.category}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
              {group.category}
            </p>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-300 truncate max-w-[160px]">
                      {item.label}
                    </span>
                    <span className="text-[11px] font-semibold text-white ml-2 flex-shrink-0">
                      {item.pct}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} opacity-80 transition-all duration-700`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
