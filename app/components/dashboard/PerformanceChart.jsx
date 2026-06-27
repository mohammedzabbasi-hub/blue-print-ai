import { useMemo, useState } from "react";
import { BarChart3, Lightbulb } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  EFFECTIVENESS_METRICS,
  EFFECTIVENESS_VIEWS,
  aggregateEffectiveness,
  buildEffectivenessGroups,
  buildTrendRows,
  comparisonGroups,
  filterEffectivenessRecords,
  metricNumber,
  performanceInsight,
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

function scopeHeading(view, group, recordCount, creativeCount) {
  if (view === "all") return `All imported ads/campaigns · ${recordCount} ${recordCount === 1 ? "record" : "records"}`;
  const prefix = { campaign: "Campaign", creative: "Creative/ad", creator: "Creator", product: "Product" }[view];
  if (view === "creative") return `${prefix}: ${group?.label || "Select an item"}`;
  return `${prefix}: ${group?.label || "Select an item"} · ${creativeCount} ${creativeCount === 1 ? "creative" : "creatives"}`;
}

export default function PerformanceChart({ dateRange, data }) {
  const records = useMemo(
    () => Array.isArray(data?.effectivenessRecords) ? data.effectivenessRecords : [],
    [data?.effectivenessRecords],
  );
  const [view, setView] = useState("all");
  const [selection, setSelection] = useState("");
  const [metric, setMetric] = useState("revenue");
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

  const chartRows = useMemo(() => {
    if (view === "all") {
      return comparisonGroups(records)
        .map((group) => ({ name: group.label, value: metricNumber(aggregateEffectiveness(group.records), metric) }))
        .filter((row) => row.value !== null)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    }
    const limit = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
    return buildTrendRows(selectedRecords).slice(-limit).map((row) => ({ name: row.label, value: metricNumber(row.summary, metric) })).filter((row) => row.value !== null);
  }, [dateRange, metric, records, selectedRecords, view]);

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

  const hasChart = chartRows.length > 0;
  const singleDate = view !== "all" && chartRows.length === 1;

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
        {scopeHeading(view, activeGroup, selectedRecords.length, selectedCreativeCount)}
        {activeGroup?.metadata && <span className="mt-1 block text-xs font-normal text-sky-200/80">{[activeGroup.metadata.status, activeGroup.metadata.objective, activeGroup.metadata.platform].filter(Boolean).join(" · ")}{activeGroup.metadata.budget != null ? ` · Budget $${Number(activeGroup.metadata.budget).toLocaleString()}` : ""}</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([key, label]) => <div key={key} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-lg font-bold text-slate-100">{formatMetric(key, key === "videoViews" && !summary.videoViews.imported ? summary.impressions : summary[key])}</p>
        </div>)}
      </div>

      {summary.hasPublicEngagement && !summary.hasCommercialMetrics && <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">Revenue, spend, and conversion metrics require optional performance fields.</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 size={16} className="text-sky-300" />{view === "all" ? "Top imported ads/campaigns" : singleDate ? "Imported reporting summary" : "Performance trend"}</div>
        <select aria-label="Graph metric" value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
          {EFFECTIVENESS_METRICS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="mt-4 h-64 rounded-xl border border-white/5 bg-slate-950/30 p-3">
        {hasChart ? <ResponsiveContainer width="100%" height="100%">
          {view === "all" || singleDate ? <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-12} textAnchor="end" interval={0} /><YAxis stroke="#64748b" fontSize={10} width={45} /><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} /><Bar dataKey="value" fill="#38bdf8" radius={[5, 5, 0, 0]} />
          </BarChart> : <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#64748b" fontSize={10} /><YAxis stroke="#64748b" fontSize={10} width={45} /><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} /><Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={{ fill: "#38bdf8" }} />
          </LineChart>}
        </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">This metric was not imported for the selected records.</div>}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-violet-400/15 bg-violet-400/[0.07] px-4 py-3 text-sm text-violet-100"><Lightbulb size={16} className="mt-0.5 shrink-0" /><span>{performanceInsight(selectedRecords)}{view !== "all" && buildTrendRows(selectedRecords).length < 2 ? " Import more dated rows to unlock trend analysis." : ""}</span></div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">Only imported ad, creative, and creator-campaign records are included. These figures are not total Shopify store revenue or total Shopify orders.</p>
    </section>
  );
}
