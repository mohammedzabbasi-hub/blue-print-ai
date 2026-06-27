import { useState } from "react";
import { Form, Link, useActionData, useLoaderData, useLocation, useNavigation } from "react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { assignCampaignRecords, getCampaign, removeCampaignAssignment, updateCampaign } from "../models/campaign.server";
import { CAMPAIGN_GOALS, CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES } from "../models/campaign-options";
import { listSavedCreatives } from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = ({ data }) => [{ title: `${data?.campaign?.name || "Campaign"} | BluePrintAI` }];

export const loader = async ({ request, params }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [campaign, savedCreatives, performance] = await Promise.all([
    getCampaign(session.shop, params.id),
    listSavedCreatives(session.shop, 1000),
    listCreativePerformance({ shop: session.shop, merchantData, limit: 1000 }),
  ]);
  if (!campaign) throw new Response("Campaign not found", { status: 404 });
  const assignedSaved = new Set(campaign.assignments.map((item) => item.savedCreativeId).filter(Boolean));
  const assignedPerformance = new Set(campaign.assignments.map((item) => item.creativePerformanceId).filter(Boolean));
  const performanceSourceIds = new Set(performance.records.filter((item) => item.sourceRecordType !== "saved_creative").map((item) => item.sourceRecordId).filter(Boolean));
  return {
    campaign,
    availableSaved: savedCreatives.filter((item) => !assignedSaved.has(item.id) && !performanceSourceIds.has(item.id) && !performanceSourceIds.has(item.sourceId)),
    availablePerformance: performance.records.filter((item) => item.sourceRecordType === "creative_performance" || item.importKey).filter((item) => !assignedPerformance.has(item.id)),
  };
};

export const action = async ({ request, params }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  try {
    const intent = String(formData.get("intent") || "update");
    if (intent === "assign") {
      const result = await assignCampaignRecords(session.shop, params.id, {
        savedCreativeIds: formData.getAll("savedCreativeId").map(String),
        creativePerformanceIds: formData.getAll("creativePerformanceId").map(String),
      });
      return { success: result.assigned ? `${result.assigned} creative${result.assigned === 1 ? "" : "s"} added to campaign.` : "Those creatives are already assigned." };
    }
    if (intent === "remove") {
      await removeCampaignAssignment(session.shop, String(formData.get("assignmentId")));
      return { success: "Creative removed from campaign." };
    }
    await updateCampaign(session.shop, params.id, Object.fromEntries(formData));
    return { success: "Campaign settings updated." };
  } catch (error) {
    return { error: error.message || "Could not update campaign." };
  }
};

const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const metric = (value, type) => value == null ? "Not imported" : type === "money" ? Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : type === "rate" ? `${Number(value).toFixed(2)}%` : type === "x" ? `${Number(value).toFixed(2)}x` : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const inputDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";

export default function CampaignDetailRoute() {
  const { campaign, availableSaved, availablePerformance } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const location = useLocation();
  const [tab, setTab] = useState(location.hash === "#creatives" || new URLSearchParams(location.search).get("created") === "1" ? "creatives" : "overview");
  const [addOpen, setAddOpen] = useState(new URLSearchParams(location.search).get("created") === "1");
  const [editOpen, setEditOpen] = useState(false);
  const performance = campaign.assignments.map((item) => item.creativePerformance).filter(Boolean);
  const comparison = performance.filter((item) => item.revenue != null || item.conversionValue != null).map((item) => ({ name: item.adName || item.creativeId || "Creative", revenue: Number(item.revenue ?? item.conversionValue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const trend = [...performance].filter((item) => item.reportingDate && (item.revenue != null || item.conversionValue != null)).sort((a, b) => new Date(a.reportingDate) - new Date(b.reportingDate)).map((item) => ({ date: new Date(item.reportingDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: Number(item.revenue ?? item.conversionValue) }));
  const submitting = navigation.state === "submitting";

  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1728] to-[#080d17] p-6 md:p-8">
      <Link className="text-sm font-bold text-cyan-300" to={withEmbeddedRouteParams("/app/campaigns", location.search)}>← Campaign Manager</Link>
      <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusBadge status={campaign.status} /><Badge>{label(campaign.objective)}</Badge><Badge>{label(campaign.platform)}</Badge></div><h1 className="mt-4 truncate font-display text-3xl font-semibold text-white md:text-4xl">{campaign.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{campaign.description || "A workspace for organizing creatives and comparing performance."}</p></div>
        <button className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100" onClick={() => setEditOpen(true)} type="button">Edit campaign</button>
      </div>
    </section>

    {new URLSearchParams(location.search).get("created") === "1" && !actionData && <Notice tone="success">Campaign created. Add creatives to this campaign to start comparing results.</Notice>}
    {(actionData?.success || actionData?.error) && <Notice tone={actionData.error ? "error" : "success"}>{actionData.error || actionData.success}</Notice>}

    <section aria-label="Campaign summary" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <SummaryCard label="Assigned creatives" value={campaign.creativeCount} />
      <SummaryCard label="Views" value={metric(campaign.metrics.views)} />
      <SummaryCard label="Clicks" value={metric(campaign.metrics.clicks)} />
      <SummaryCard label="Orders" value={metric(campaign.metrics.orders)} />
      <SummaryCard label="Revenue" value={metric(campaign.metrics.revenue, "money")} />
      <SummaryCard label="Spend" value={metric(campaign.metrics.spend, "money")} />
      <SummaryCard label="ROAS" value={metric(campaign.metrics.roas, "x")} />
    </section>

    <nav aria-label="Campaign workspace" className="flex gap-1 overflow-x-auto border-b border-white/10">
      {["overview", "creatives", "performance", "notes"].map((value) => <button className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === value ? "border-cyan-400 text-cyan-100" : "border-transparent text-slate-400 hover:text-white"}`} key={value} onClick={() => setTab(value)} type="button">{label(value)}</button>)}
    </nav>

    {tab === "overview" && <Overview campaign={campaign} onAdd={() => { setTab("creatives"); setAddOpen(true); }} />}
    {tab === "creatives" && <Creatives campaign={campaign} onAdd={() => setAddOpen(true)} search={location.search} />}
    {tab === "performance" && <Performance campaign={campaign} comparison={comparison} trend={trend} />}
    {tab === "notes" && <Notes campaign={campaign} onEdit={() => setEditOpen(true)} />}

    {addOpen && <PickerDialog availablePerformance={availablePerformance} availableSaved={availableSaved} onClose={() => setAddOpen(false)} submitting={submitting} />}
    {editOpen && <EditDialog campaign={campaign} onClose={() => setEditOpen(false)} submitting={submitting} />}
  </div>;
}

function Overview({ campaign, onAdd }) {
  return <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Campaign snapshot</h2><p className="mt-2 text-sm text-slate-400">Everything assigned here rolls up into one performance view.</p></div><button className="bp-primary-cta" onClick={onAdd} type="button">Add creatives</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Info label="Primary product" value={campaign.primaryProductName || "Not set"} /><Info label="Budget" value={campaign.budget == null ? "Not set" : metric(campaign.budget, "money")} /><Info label="Starts" value={campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "Open-ended"} /><Info label="Ends" value={campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "Open-ended"} /><Info label="Target audience" value={campaign.targetAudience || "Not set"} /><Info label="Last updated" value={new Date(campaign.updatedAt).toLocaleDateString()} /></div></div>
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Recommended next action</p><h2 className="mt-3 text-lg font-semibold text-white">{campaign.creativeCount ? "Keep the test moving" : "Build your first creative set"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{campaign.recommendedNextAction}</p><p className="mt-5 text-sm text-slate-300"><strong className="text-white">Top creative:</strong> {campaign.topCreative || "Not enough data yet"}</p></div>
  </section>;
}

function Creatives({ campaign, onAdd, search }) {
  return <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-5 md:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold text-white">Assigned creatives</h2><p className="mt-1 text-sm text-slate-400">Select multiple uploads, move them between campaigns, or remove them here.</p></div><button className="bp-primary-cta" onClick={onAdd} type="button">Add creatives</button></div>
    {!campaign.displayAssignments.length ? <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-7 text-center"><h3 className="font-semibold text-white">No creatives assigned</h3><p className="mt-2 text-sm text-slate-400">Add uploaded videos or imported creative records to begin this campaign.</p><button className="mt-4 text-sm font-bold text-cyan-300" onClick={onAdd} type="button">Choose creatives →</button></div> : <div className="mt-6 grid gap-3 xl:grid-cols-2">{campaign.displayAssignments.map((item) => <CreativeRow item={item} key={item.id} search={search} />)}</div>}
  </section>;
}

function CreativeRow({ item, search }) {
  const record = item.creativePerformance || item.savedCreative;
  const videoUrl = record?.videoUrl || "";
  const detailId = item.savedCreativeId || (record?.sourceRecordType === "saved_creative" ? record.sourceRecordId : "");
  return <article className="grid gap-4 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-[120px_1fr]">
    {isPlayableVideo(videoUrl) ? <video className="aspect-video w-full rounded-lg bg-black object-cover" controls preload="metadata" src={videoUrl}><track kind="captions" /></video> : <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-950 text-xs text-slate-500">No preview</div>}
    <div className="min-w-0"><p className="truncate font-semibold text-white">{record?.title || record?.adName || record?.creativeTitle || record?.creativeId || "Creative"}</p><p className="mt-1 truncate text-xs text-slate-400">{record?.creatorHandle || record?.productTitle || record?.productName || "Imported record"}</p><div className="mt-4 flex flex-wrap gap-3">{detailId && <Link className="text-xs font-bold text-cyan-300" to={withEmbeddedRouteParams(`/app/creative-library/${detailId}`, search)}>Open creative detail</Link>}<Form method="post"><input name="intent" type="hidden" value="remove" /><input name="assignmentId" type="hidden" value={item.id} /><button className="text-xs font-bold text-rose-300" type="submit">Remove from campaign</button></Form></div></div>
  </article>;
}

function Performance({ campaign, comparison, trend }) {
  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><SummaryCard label="Impressions" value={metric(campaign.metrics.impressions)} /><SummaryCard label="Reach" value={metric(campaign.metrics.reach)} /><SummaryCard label="Likes" value={metric(campaign.metrics.likes)} /><SummaryCard label="Comments" value={metric(campaign.metrics.comments)} /><SummaryCard label="Shares" value={metric(campaign.metrics.shares)} /><SummaryCard label="CTR / CVR" value={`${metric(campaign.metrics.ctr, "rate")} / ${metric(campaign.metrics.cvr, "rate")}`} /><SummaryCard label="CPC" value={metric(campaign.metrics.cpc, "money")} /><SummaryCard label="CPM" value={metric(campaign.metrics.cpm, "money")} /></section>
    {!campaign.metrics.hasPublicEngagement && !campaign.metrics.hasCommercialMetrics ? <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-7"><h2 className="font-semibold text-white">Performance not imported</h2><p className="mt-2 text-sm text-slate-400">Assigned creatives are organized correctly. Import engagement or ad performance data to unlock comparisons.</p></div> : <section className="grid gap-5 xl:grid-cols-2"><Chart title="Creative comparison by revenue" empty={!comparison.length}><BarChart data={comparison}><CartesianGrid stroke="#263247" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="revenue" fill="#22d3ee" /></BarChart></Chart><Chart title="Revenue trend" empty={!trend.length}><LineChart data={trend}><CartesianGrid stroke="#263247" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line dataKey="revenue" stroke="#22d3ee" strokeWidth={3} /></LineChart></Chart></section>}
  </div>;
}

function Notes({ campaign, onEdit }) { return <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">Campaign notes</h2><button className="text-sm font-bold text-cyan-300" onClick={onEdit} type="button">Edit notes</button></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">{campaign.notes || "No notes yet. Add hypotheses, learnings, or reminders for the next creative round."}</p></section>; }

function PickerDialog({ availablePerformance, availableSaved, onClose, submitting }) {
  const count = availableSaved.length + availablePerformance.length;
  return <Dialog onClose={onClose} title="Add creatives"><p className="mt-2 text-sm text-slate-400">Choose one or more uploaded or imported creatives. Creatives already in this campaign are hidden.</p><Form className="mt-5" method="post"><input name="intent" type="hidden" value="assign" /><div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1"><ChoiceList getLabel={(item) => item.title} name="savedCreativeId" records={availableSaved} title="Saved creatives" /><ChoiceList getLabel={(item) => item.creativeTitle || item.adName || item.sourceCreativeId} name="creativePerformanceId" records={availablePerformance} title="Imported performance creatives" /></div>{!count && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No unassigned creatives are available. Upload a creative or move one from another campaign in the Creative Library.</p>}<div className="mt-6 flex justify-end gap-3"><button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300" onClick={onClose} type="button">Cancel</button><button className="bp-primary-cta" disabled={submitting || !count} type="submit">{submitting ? "Adding…" : "Add selected creatives"}</button></div></Form></Dialog>;
}

function EditDialog({ campaign, onClose, submitting }) { return <Dialog onClose={onClose} title="Edit campaign"><Form className="mt-5 grid gap-4 sm:grid-cols-2" method="post"><input name="intent" type="hidden" value="update" /><Field label="Campaign name" name="name" defaultValue={campaign.name} required /><Field label="Description" name="description" defaultValue={campaign.description || ""} /><Select label="Status" name="status" values={CAMPAIGN_STATUSES} defaultValue={campaign.status} /><Select label="Objective" name="objective" values={CAMPAIGN_GOALS} defaultValue={campaign.objective} /><Select label="Platform" name="platform" values={CAMPAIGN_PLATFORMS} defaultValue={campaign.platform} /><Field label="Primary product" name="primaryProductName" defaultValue={campaign.primaryProductName || ""} /><Field label="Start date" name="startDate" type="date" defaultValue={inputDate(campaign.startDate)} /><Field label="End date" name="endDate" type="date" defaultValue={inputDate(campaign.endDate)} /><Field label="Budget" name="budget" type="number" step="0.01" min="0" defaultValue={campaign.budget ?? ""} /><Field label="Target audience" name="targetAudience" defaultValue={campaign.targetAudience || ""} /><label className="text-sm font-semibold text-slate-200 sm:col-span-2">Notes<textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" defaultValue={campaign.notes || ""} name="notes" /></label><div className="flex justify-end gap-3 sm:col-span-2"><button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300" onClick={onClose} type="button">Cancel</button><button className="bp-primary-cta" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</button></div></Form></Dialog>; }

function Dialog({ children, onClose, title }) { return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog"><section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1220] p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-bold text-white">{title}</h2><button aria-label={`Close ${title}`} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300" onClick={onClose} type="button">✕</button></div>{children}</section></div>; }
function ChoiceList({ getLabel, name, records, title }) { return records.length ? <div><h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{title}</h3><div className="mt-2 space-y-2">{records.map((item) => <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3 text-sm text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-500/5" key={item.id}><input className="accent-cyan-400" name={name} type="checkbox" value={item.id} /><span>{getLabel(item) || "Untitled creative"}</span></label>)}</div></div> : null; }
function Chart({ children, empty, title }) { return <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-5"><h2 className="font-semibold text-white">{title}</h2>{empty ? <div className="mt-4 flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">Not imported</div> : <div className="mt-4 h-64"><ResponsiveContainer height="100%" width="100%">{children}</ResponsiveContainer></div>}</section>; }
function SummaryCard({ label: title, value }) { return <div className="min-w-0 rounded-xl border border-white/10 bg-[#0b1220] p-4"><p className="text-xs font-semibold text-slate-400">{title}</p><p className="mt-2 break-words text-lg font-bold text-white">{value}</p></div>; }
function Info({ label: title, value }) { return <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p><p className="mt-1 text-sm font-semibold text-slate-200">{value}</p></div>; }
function Notice({ children, tone }) { return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{children}</div>; }
function Badge({ children }) { return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">{children}</span>; }
function StatusBadge({ status }) { const tones = { active: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200", paused: "border-amber-400/25 bg-amber-500/10 text-amber-200", completed: "border-blue-400/25 bg-blue-500/10 text-blue-200", draft: "border-slate-500/30 bg-slate-500/10 text-slate-300" }; return <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tones[status] || tones.draft}`}>{label(status)}</span>; }
function Field({ label: title, ...props }) { return <label className="text-sm font-semibold text-slate-200">{title}<input {...props} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label>; }
function Select({ label: title, values, ...props }) { return <label className="text-sm font-semibold text-slate-200">{title}<select {...props} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">{values.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>; }
function isPlayableVideo(value) { return /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(String(value || "")); }
