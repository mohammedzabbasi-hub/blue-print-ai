import { useMemo, useState } from "react";
import { BarChart3, Lightbulb } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  EFFECTIVENESS_METRICS,
  EFFECTIVENESS_VIEWS,
  aggregateEffectiveness,
  buildCreativeLaunchMarkers,
  buildEffectivenessGroups,
  buildTrendRows,
  filterPerformanceRecordsByDateRange,
  filterEffectivenessRecords,
  hasReportingDate,
  metricNumber,
  performanceInsight,
  trendAvailability,
} from "../../utils/ad-effectiveness";

function compact(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMetric(metric, entry, unavailable = "Not imported") {
  if (!entry?.imported) return unavailable;
  const value = Number(entry.value || 0);
  if (["revenue", "spend", "cpc", "cpm", "costPerOrder"].includes(metric)) {
    return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  if (["ctr", "cvr", "engagementRate"].includes(metric)) return `${value.toFixed(2)}%`;
  if (metric === "roas") return `${value.toFixed(2)}x`;
  return compact(value);
}

const cards = [
  ["revenue", "Attributed revenue"], ["spend", "Spend"], ["roas", "ROAS"],
  ["ctr", "CTR"], ["cvr", "CVR"], ["orders", "Orders / conversions"],
  ["clicks", "Clicks"], ["videoViews", "Video views / impressions"],
  ["impressions", "Impressions"], ["reach", "Reach"],
  ["engagementRate", "Engagement rate"], ["cpc", "Cost per click"],
  ["cpm", "Cost per 1,000 impressions"],
  ["costPerOrder", "Cost per order / acquisition"],
];

function scopeHeading(view, group, recordCount, creativeCount, excludedRollupCount) {
  if (view === "all") {
    const records = `${recordCount} creative ${recordCount === 1 ? "record" : "records"}`;
    const excluded = excludedRollupCount
      ? ` · ${excludedRollupCount} creator ${excludedRollupCount === 1 ? "rollup" : "rollups"} excluded from totals`
      : "";
    return `${records}${excluded}`;
  }
  const prefix = { campaign: "Campaign", creative: "Creative/ad", creator: "Creator", product: "Product" }[view];
  if (view === "creative") return `${prefix}: ${group?.label || "Select an item"}`;
  return `${prefix}: ${group?.label || "Select an item"} · ${creativeCount} ${creativeCount === 1 ? "creative" : "creatives"}`;
}

export default function PerformanceChart({ dateRange, data }) {
  const allRecords = useMemo(
    () => Array.isArray(data?.effectivenessRecords) ? data.effectivenessRecords : [],
    [data?.effectivenessRecords],
  );
  const records = allRecords;
  const [view, setView] = useState("all");
  const [selection, setSelection] = useState("");
  const [metric, setMetric] = useState("revenue");
  const [cumulative, setCumulative] = useState(false);
  const groups = useMemo(() => {
    if (view === "all") return [];
    const importedGroups = buildEffectivenessGroups(records, view);
    if (view !== "campaign") return importedGroups;
    const actual = (data?.campaigns || []).map((campaign) => ({
      key: campaign.id,
      label: campaign.name,
      metadata: campaign,
      records: records.filter((record) => record.workspaceCampaignId === campaign.id),
    }));
    const actualKeys = new Set(actual.map((group) => group.key));
    return [...actual, ...importedGroups.filter((group) => !actualKeys.has(group.key))];
  }, [data?.campaigns, records, view]);
  const activeKey = selection && groups.some((group) => group.key === selection) ? selection : groups[0]?.key || "";
  const selectedRecords = useMemo(() => filterEffectivenessRecords(records, view, activeKey), [records, view, activeKey]);
  const summary = useMemo(() => aggregateEffectiveness(selectedRecords), [selectedRecords]);
  const activeGroup = groups.find((group) => group.key === activeKey);
  const selectedCreativeCount = buildEffectivenessGroups(selectedRecords, "creative").length;
  const undatedRecordCount = selectedRecords.filter((record) => !hasReportingDate(record)).length;
  const chartRecords = useMemo(
    () => filterPerformanceRecordsByDateRange(selectedRecords, dateRange),
    [dateRange, selectedRecords],
  );

  const chartRows = useMemo(() => {
    return buildTrendRows(chartRecords, { cumulative }).map((row) => ({
      date: row.date,
      name: row.label,
      value: metricNumber(row.summary, metric),
    })).filter((row) => row.value !== null);
  }, [chartRecords, cumulative, metric]);
  const availability = useMemo(() => trendAvailability(chartRecords), [chartRecords]);
  const launchMarkers = useMemo(
    () => view === "campaign" ? buildCreativeLaunchMarkers(selectedRecords) : [],
    [selectedRecords, view],
  );

  if (!records.length && !(data?.campaigns || []).length) {
    return (
      <section className="bg-[#0d1526] border border-white/5 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white">Ad &amp; campaign effectiveness</h2>
        <p className="mt-1 text-sm text-slate-400">Track engagement, conversion, spend, and attributed revenue for each imported ad, creative, or creator campaign.</p>
        <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950/35 p-6">
          <h3 className="font-semibold text-white">No imported ad or creative performance data yet.</h3>
          <p className="mt-2 text-sm text-slate-400">Upload a creative performance CSV or import creatives with videos to compare campaign effectiveness.</p>
        </div>
      </section>
    );
  }

  const hasChart = availability.hasTrend && chartRows.length > 0;

  return (
    <section className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Ad &amp; campaign effectiveness</h2>
        <p className="mt-1 text-sm text-slate-400">Track engagement, conversion, spend, and attributed revenue for each imported ad, creative, or creator campaign.</p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300">View
          <select value={view} onChange={(event) => { setView(event.target.value); setSelection(""); }} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
            {EFFECTIVENESS_VIEWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {view !== "all" && <label className="text-xs font-semibold text-slate-300">Item
          <select value={activeKey} onChange={(event) => setSelection(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
            {groups.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
          </select>
        </label>}
      </div>

      <div className="mt-5 rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100">
        {scopeHeading(view, activeGroup, selectedRecords.length, selectedCreativeCount, data?.excludedCreatorRollupCount || 0)}
        {activeGroup?.metadata && <span className="mt-1 block text-xs font-normal text-sky-200/80">{[activeGroup.metadata.status, activeGroup.metadata.objective, activeGroup.metadata.platform].filter(Boolean).join(" · ")}{activeGroup.metadata.budget != null ? ` · Budget $${Number(activeGroup.metadata.budget).toLocaleString()}` : ""}</span>}
      </div>

      {undatedRecordCount > 0 && <p className="mt-3 text-xs text-slate-400">{undatedRecordCount} undated {undatedRecordCount === 1 ? "record is" : "records are"} not charted.</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([key, label]) => <div key={key} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-lg font-bold text-slate-100">{formatMetric(key, key === "videoViews" && !summary.videoViews.imported ? summary.impressions : summary[key])}</p>
        </div>)}
      </div>

      {summary.hasPublicEngagement && !summary.hasCommercialMetrics && <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">Revenue, spend, and conversion metrics require optional performance fields.</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 size={16} className="text-sky-300" />Performance over time</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1" aria-label="Trend mode">
            {[{ value: false, label: "Daily" }, { value: true, label: "Cumulative" }].map((option) => <button key={option.label} type="button" onClick={() => setCumulative(option.value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cumulative === option.value ? "bg-sky-400/20 text-sky-100" : "text-slate-400 hover:text-white"}`}>{option.label}</button>)}
          </div>
          <select aria-label="Graph metric" value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
            {EFFECTIVENESS_METRICS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 h-64 rounded-xl border border-white/5 bg-slate-950/30 p-3">
        {hasChart ? <ResponsiveContainer
          height="100%"
          initialDimension={{ width: 640, height: 232 }}
          width="100%"
        >
          <AreaChart data={chartRows} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
            <defs><linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#64748b" fontSize={10} minTickGap={18} /><YAxis stroke="#64748b" fontSize={10} width={45} /><Tooltip formatter={(value) => formatMetric(metric, { imported: true, value })} labelFormatter={(label) => `Reporting date ${label}`} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} /><Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2.5} fill="url(#performanceFill)" activeDot={{ r: 5, fill: "#38bdf8" }} />
            {launchMarkers.filter((marker) => chartRows.some((row) => row.date === marker.date)).map((marker, index) => <ReferenceLine key={`${marker.creativeKey}-${marker.date}`} x={marker.date.slice(5)} stroke="#a78bfa" strokeDasharray="3 3" label={{ value: marker.label, position: index % 2 ? "insideTopRight" : "insideTopLeft", fill: "#c4b5fd", fontSize: 9 }} />)}
          </AreaChart>
        </ResponsiveContainer> : <div className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-400">{availability.dateCount === 0 ? "No dated performance records are available in the selected calendar range." : availability.isSparse ? "Only one reporting date is available. Import daily performance rows to unlock trend charts." : "This metric was not imported for the selected records."}</div>}
      </div>

      {view === "campaign" && launchMarkers.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Creative launches">{launchMarkers.map((marker) => <span key={`${marker.creativeKey}-${marker.date}`} className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">{marker.date.slice(5)} · {marker.label}</span>)}</div>}

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-violet-400/15 bg-violet-400/[0.07] px-4 py-3 text-sm text-violet-100"><Lightbulb size={16} className="mt-0.5 shrink-0" /><span>{performanceInsight(selectedRecords)}{view !== "all" && buildTrendRows(selectedRecords).length < 2 ? " Import more dated rows to unlock trend analysis." : ""}</span></div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">Dashboard totals use creative/ad-level performance records. Creator rollups remain available on creator pages but are excluded here to prevent double counting. These figures are not total Shopify store revenue or total Shopify orders.</p>
    </section>
  );
}
