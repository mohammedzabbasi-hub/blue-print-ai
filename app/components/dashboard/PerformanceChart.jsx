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

function pointsForRange(series, dateRange) {
  const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
  return series.slice(-days);
}

export default function PerformanceChart({ dateRange = "30d", data }) {
  const [metric, setMetric] = useState("views");

  const series = pointsForRange(data?.series || [], dateRange);
  const totals = data?.totals || {};
  const hasSeries = series.length >= 2;

  const metricLabels = {
    views: "Total Views",
    orders: "Orders",
    revenue: "Revenue",
  };

  const metricValues = {
    views: compact(totals.views),
    orders: compact(totals.orders),
    revenue: `$${compact(totals.revenue)}`,
  };

  const ctr = num(totals.views) > 0 ? ((num(totals.clicks) / num(totals.views)) * 100).toFixed(2) : "0.00";

  const rawData = series.map((point) => num(point[metric]));

  const W = 600;
  const H = 200;
  const PAD = 12;

  const linePath = hasSeries ? buildPath(rawData, W, H, PAD) : "";
  const areaPath = hasSeries ? buildAreaPath(linePath, W, H, PAD) : "";

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-white mb-0.5">Performance Trend</h2>
          <p className="text-[11px] text-slate-500">
            {hasSeries ? "From imported metrics.csv rows" : "Not imported"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {["views", "orders", "revenue"].map((m) => (
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

      {hasSeries ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-[18px] font-bold text-white">{metricValues[metric]}</span>
              <span className="text-[11px] text-slate-500 ml-1">{metricLabels[metric]}</span>
            </div>

            <div className="flex items-center gap-1 bg-emerald-500/10 rounded-lg px-2.5 py-2">
              <TrendingUp size={11} className="text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">{ctr}% CTR</span>
              <span className="text-[11px] text-slate-500">from imported clicks/views</span>
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
              {series.map((point) => (
                <span key={point.date} className="text-[9px] text-slate-600 font-medium">
                  {point.date.slice(5)}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 text-center">
          <p className="text-sm font-semibold text-slate-300">Not imported</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Upload a metrics.csv with at least two dated rows on the Data
            Import page to chart a real performance trend.
          </p>
        </div>
      )}
    </div>
  );
}
