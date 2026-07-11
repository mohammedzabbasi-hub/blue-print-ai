import { useMemo, useState } from "react";
import {
  Form,
  Link,
  Outlet,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useParams,
} from "react-router";
import { createCampaign, deleteCampaign, listCampaigns } from "../models/campaign.server";
import { CAMPAIGN_GOALS, CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES } from "../models/campaign-options";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { merchantErrorMessage } from "../utils/merchant-errors";

export const meta = () => [{ title: "Campaign Manager | BluePrintAI" }];

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  return { campaigns: await listCampaigns(session.shop) };
};

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  try {
    if (formData.get("intent") === "delete") {
      await deleteCampaign(session.shop, String(formData.get("campaignId") || ""));
      return { success: "Campaign deleted. Assigned creatives remain available." };
    }
    const campaign = await createCampaign(session.shop, Object.fromEntries(formData));
    return redirect(withEmbeddedRouteParams(`/app/campaigns/${campaign.id}?created=1`, new URL(request.url).search));
  } catch (error) {
    return { error: merchantErrorMessage(error, "Could not save campaign. Try again.") };
  }
};

const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const optionalNumber = (value) => value == null ? "Not imported" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const optionalMoney = (value) => value == null ? "Not imported" : Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const optionalRate = (value, suffix) => value == null ? "Not imported" : `${Number(value).toFixed(2)}${suffix}`;

export default function CampaignManagerRoute() {
  const params = useParams();
  const { campaigns } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const location = useLocation();
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(location.hash === "#create-campaign" || Boolean(actionData?.error));
  const visible = useMemo(
    () => campaigns.filter((campaign) => status === "all" || campaign.status === status),
    [campaigns, status],
  );

  if (params.id) return <Outlet />;

  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1728] to-[#080d17] p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Creative organization</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white md:text-4xl">Campaigns</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Group imported ads, creatives, and creator tests into local planning folders. Creating or editing a campaign here never creates, edits, launches, or spends on an ad platform.</p>
        </div>
        <button className="bp-primary-cta shrink-0" onClick={() => setCreateOpen(true)} type="button">Create campaign</button>
      </div>
    </section>

    {actionData?.success && <Notice tone="success">{actionData.success}</Notice>}

    <nav aria-label="Campaign status" className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1220] p-2">
      {["all", ...CAMPAIGN_STATUSES].map((value) => <button
        aria-pressed={status === value}
        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${status === value ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
        key={value}
        onClick={() => setStatus(value)}
        type="button"
      >{label(value)}</button>)}
    </nav>

    {!campaigns.length ? <EmptyState onCreate={() => setCreateOpen(true)} /> : !visible.length ? <section className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-7 text-center">
      <h2 className="text-lg font-semibold text-white">No {label(status).toLowerCase()} campaigns</h2>
      <p className="mt-2 text-sm text-slate-400">Choose another status or create a new campaign.</p>
    </section> : <section className="grid gap-4 xl:grid-cols-2">
      {visible.map((campaign) => <CampaignCard campaign={campaign} key={campaign.id} search={location.search} />)}
    </section>}

    {createOpen && <CreateCampaignDialog
      error={actionData?.error}
      onClose={() => setCreateOpen(false)}
      submitting={navigation.state === "submitting"}
    />}
  </div>;
}

function CampaignCard({ campaign, search }) {
  const performance = campaign.metrics.hasCommercialMetrics
    ? `${optionalMoney(campaign.metrics.revenue)} revenue · ${optionalRate(campaign.metrics.roas, "x")} ROAS`
    : campaign.metrics.hasPublicEngagement
      ? `${optionalNumber(campaign.metrics.views)} views · ${optionalNumber(campaign.metrics.engagements)} engagements`
      : "Performance not imported";
  return <article className="group rounded-2xl border border-white/10 bg-[#0b1220] p-5 transition hover:border-cyan-400/25 hover:bg-[#0d1727]">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2"><StatusBadge status={campaign.status} /><Badge>{label(campaign.objective)}</Badge><Badge>{label(campaign.platform)}</Badge></div>
        <h2 className="mt-4 truncate text-xl font-bold text-white">{campaign.name}</h2>
        <p className="mt-1 truncate text-sm text-slate-400">{campaign.primaryProductName || "No primary product"}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
        <p className="text-xl font-black text-white">{campaign.creativeCount}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Creatives</p>
      </div>
    </div>
    <div className="mt-5 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Performance</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{performance}</p>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">Updated {new Date(campaign.updatedAt).toLocaleDateString()}</p>
      <Link className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-100 transition group-hover:bg-cyan-500/15" to={withEmbeddedRouteParams(`/app/campaigns/${campaign.id}`, search)}>Open campaign</Link>
    </div>
  </article>;
}

function EmptyState({ onCreate }) {
  return <section className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] px-6 py-10 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-xl text-cyan-200">▦</div>
    <h2 className="mt-4 text-xl font-semibold text-white">No campaigns yet</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Campaigns work like folders for your ads and creative tests, making it easy to organize ideas and compare results.</p>
    <button className="bp-primary-cta mt-5" onClick={onCreate} type="button">Create your first campaign</button>
  </section>;
}

function CreateCampaignDialog({ error, onClose, submitting }) {
  return <div aria-labelledby="create-campaign-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog">
    <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1220] p-6 shadow-2xl shadow-black/60 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">New folder</p><h2 className="mt-2 text-2xl font-bold text-white" id="create-campaign-title">Create campaign</h2><p className="mt-2 text-sm text-slate-400">Start with the essentials. You can add creatives on the next screen.</p></div>
        <button aria-label="Close create campaign" className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" onClick={onClose} type="button">✕</button>
      </div>
      {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}
      <Form className="mt-6 space-y-5" method="post">
        <Field label="Campaign name" name="name" placeholder="e.g. Summer creator tests" required />
        <div className="grid gap-4 sm:grid-cols-3"><Select label="Objective" name="objective" values={CAMPAIGN_GOALS} /><Select label="Platform" name="platform" values={CAMPAIGN_PLATFORMS} /><Select label="Status" name="status" values={CAMPAIGN_STATUSES} /></div>
        <details className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <summary className="cursor-pointer text-sm font-bold text-cyan-100">Advanced details <span className="ml-1 font-normal text-slate-500">(optional)</span></summary>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Description" name="description" />
            <Field label="Primary product" name="primaryProductName" />
            <Field label="Budget" min="0" name="budget" step="0.01" type="number" />
            <Field label="Start date" name="startDate" type="date" />
            <Field label="End date" name="endDate" type="date" />
            <Field className="sm:col-span-2" label="Target audience" name="targetAudience" />
            <Field className="sm:col-span-2" label="Notes" name="notes" />
          </div>
        </details>
        <div className="flex justify-end gap-3"><button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300" onClick={onClose} type="button">Cancel</button><button className="bp-primary-cta" disabled={submitting} type="submit">{submitting ? "Creating…" : "Create campaign"}</button></div>
      </Form>
    </section>
  </div>;
}

function Notice({ children, tone }) { return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{children}</div>; }
function Badge({ children }) { return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">{children}</span>; }
function StatusBadge({ status }) { const tones = { active: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200", paused: "border-amber-400/25 bg-amber-500/10 text-amber-200", completed: "border-blue-400/25 bg-blue-500/10 text-blue-200", draft: "border-slate-500/30 bg-slate-500/10 text-slate-300" }; return <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tones[status] || tones.draft}`}>{label(status)}</span>; }
function Field({ className = "", label: title, ...props }) { return <label className={`block text-sm font-semibold text-slate-200 ${className}`}>{title}<input {...props} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none" /></label>; }
function Select({ label: title, values, ...props }) { return <label className="block text-sm font-semibold text-slate-200">{title}<select {...props} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white focus:border-cyan-500 focus:outline-none">{values.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>; }
