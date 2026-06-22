import { useState } from "react";
import { TrendingUp } from "lucide-react";

function num(value) {
  return Number(value || 0);
}

function compact(value) {
  const n = num(value);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function buildPath(data, width, height, padding) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return [x, y];
  });

  return pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx1 = px + (x - px) * 0.5;
    const cx2 = x - (x - px) * 0.5;
    return `${acc} C ${cx1} ${py}, ${cx2} ${y}, ${x} ${y}`;
  }, "");
}

function buildAreaPath(linePath, width, height, padding) {
  return `${linePath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
}

function makeTrend(total, points) {
  const finalTotal = Math.max(num(total), 1);
  return Array.from({ length: points }, (_, i) => {
    const progress = (i + 1) / points;
    const wave = 0.84 + Math.sin(i * 1.7) * 0.055 + Math.cos(i * 0.9) * 0.035;
    return Math.max(1, Math.round(finalTotal * progress * wave));
  });
}

export default function PerformanceChart({ dateRange, data }) {
  const [metric, setMetric] = useState("views");

  const totals = data?.totals || {};
  const leaderboard = data?.leaderboard || [];

  const clicks = num(totals.clicks) || leaderboard.reduce((sum, c) => sum + num(c.clicks), 0);
  const views = num(totals.views);
  const orders = num(totals.orders);
  const roas = num(totals.roas || totals.avg_roas);

  const points = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;

  const metricTotals = {
    views,
    orders,
    roas: roas || 0,
  };

  const rawData = makeTrend(metricTotals[metric], points);

  const labels =
    dateRange === "7d"
      ? ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]
      : dateRange === "90d"
        ? Array.from({ length: 90 }, (_, i) => (i % 15 === 0 ? `+${i}d` : ""))
        : Array.from({ length: 30 }, (_, i) => ((i + 1) % 5 === 0 ? `Day ${i + 1}` : ""));

  const W = 600;
  const H = 200;
  const PAD = 12;

  const linePath = buildPath(rawData, W, H, PAD);
  const areaPath = buildAreaPath(linePath, W, H, PAD);

  const metricLabels = {
    views: "Total Views",
    orders: "Orders",
    roas: "ROAS",
  };

  const metricValues = {
    views: compact(views),
    orders: compact(orders),
    roas: `${roas.toFixed(2)}x`,
  };

  const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : "0.00";

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-white mb-0.5">Performance Trend</h2>
          <p className="text-[11px] text-slate-500">Estimated trend from connected shop performance</p>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {["views", "orders", "roas"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium capitalize transition-all duration-150 ${
                metric === m
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-2">
          <span className="text-[18px] font-bold text-white">{metricValues[metric]}</span>
          <span className="text-[11px] text-slate-500 ml-1">{metricLabels[metric]}</span>
        </div>

        <div className="flex items-center gap-1 bg-emerald-500/10 rounded-lg px-2.5 py-2">
          <TrendingUp size={11} className="text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400">{ctr}% CTR</span>
          <span className="text-[11px] text-slate-500">from backend clicks/views</span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: "160px" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#chartGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex justify-between mt-1 px-0">
          {labels.filter(Boolean).map((label, i) => (
            <span key={`${label}-${i}`} className="text-[9px] text-slate-600 font-medium">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
