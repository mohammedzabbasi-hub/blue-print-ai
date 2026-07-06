import { CheckSquare, RefreshCw } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { getConnectionByPlatform } from "../models/ad-platform-connection.server";
import {
  listGoogleAdsCampaigns,
  saveGoogleAdsCampaignSelection,
  upsertGoogleAdsCampaigns,
} from "../models/google-ads-campaign.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { fetchGoogleAdsCampaigns, refreshGoogleAdsAccessToken } from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";

export const meta = () => [{ title: "Manage Google Ads campaigns | BluePrintAI" }];

async function campaignContext(request) {
  const { session } = await loadShopifyRouteContext(request);
  const connection = await getConnectionByPlatform(session.shop, "google");
  if (!connection?.encryptedRefreshToken || !connection.externalAccountId) {
    throw redirect(withEmbeddedRouteParams("/app/connections?error=Connect+and+select+a+Google+Ads+account+first.", new URL(request.url).search));
  }
  return { session, connection };
}

export const loader = async ({ request }) => {
  const { session, connection } = await campaignContext(request);
  return {
    campaigns: await listGoogleAdsCampaigns(session.shop, connection.externalAccountId),
    customerId: connection.externalAccountId,
    mode: connection.campaignSyncMode === "selected" ? "selected" : "all",
  };
};

export const action = async ({ request }) => {
  const { session, connection } = await campaignContext(request);
  const formData = await request.formData();
  try {
    if (formData.get("intent") === "refresh") {
      const refreshed = await refreshGoogleAdsAccessToken(decryptToken(connection.encryptedRefreshToken));
      if (!refreshed.ok) throw new Error(refreshed.message);
      const campaigns = await fetchGoogleAdsCampaigns({
        accessToken: refreshed.accessToken,
        customerId: connection.externalAccountId,
      });
      await upsertGoogleAdsCampaigns(session.shop, connection.externalAccountId, campaigns);
      return { success: `Campaign list refreshed. ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} found.` };
    }
    if (formData.get("intent") === "save") {
      await saveGoogleAdsCampaignSelection(session.shop, connection.externalAccountId, {
        mode: String(formData.get("campaignSyncMode") || ""),
        selectedCampaignIds: formData.getAll("campaignId").map(String),
      });
      return { success: "Campaign sync scope saved." };
    }
    return { error: "Unknown campaign selection action." };
  } catch (error) {
    return { error: error.message || "Could not update Google Ads campaign selection." };
  }
};

export default function GoogleAdsCampaignsRoute() {
  const { campaigns, customerId, mode } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Read-only Google Ads reporting</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">Manage campaigns</h1>
        <p className="mt-3 text-sm text-slate-300">Customer {customerId}. Choose which campaigns are included in future reporting syncs. BluePrintAI cannot change campaigns.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Form method="post">
            <input name="intent" type="hidden" value="refresh" />
            <button className="bp-primary-cta" disabled={busy} type="submit"><RefreshCw aria-hidden="true" size={15} /> Refresh campaign list</button>
          </Form>
          <Link className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200" to="/app/connections">Back to Connections</Link>
        </div>
      </section>
      {actionData?.success && <Notice tone="success">{actionData.success}</Notice>}
      {actionData?.error && <Notice tone="error">{actionData.error}</Notice>}
      <Form className="rounded-2xl border border-white/10 bg-[#0b1220] p-6" method="post">
        <input name="intent" type="hidden" value="save" />
        <fieldset>
          <legend className="text-lg font-bold text-white">Campaign sync scope</legend>
          <label className="mt-4 flex items-center gap-3 text-sm text-slate-200"><input defaultChecked={mode === "all"} name="campaignSyncMode" type="radio" value="all" /> All campaigns</label>
          <label className="mt-3 flex items-center gap-3 text-sm text-slate-200"><input defaultChecked={mode === "selected"} name="campaignSyncMode" type="radio" value="selected" /> Selected campaigns only</label>
        </fieldset>
        <div className="mt-6 space-y-2">
          {campaigns.length ? campaigns.map((campaign) => (
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4" htmlFor={`campaign-${campaign.id}`} key={campaign.id}>
              <input defaultChecked={campaign.selected} id={`campaign-${campaign.id}`} name="campaignId" type="checkbox" value={campaign.campaignId} />
              <span className="sr-only">Select campaign</span>
              <span><span className="block font-semibold text-white">{campaign.campaignName}</span><span className="mt-1 block text-xs text-slate-400">{campaign.campaignStatus || "Unknown status"} · {campaign.advertisingChannelType || "Unknown channel"}</span></span>
            </label>
          )) : <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-300">No campaigns were found in this Google Ads account.</p>}
        </div>
        <button className="bp-primary-cta mt-6" disabled={busy} type="submit"><CheckSquare aria-hidden="true" size={15} /> Save selection</button>
      </Form>
    </div>
  );
}

function Notice({ children, tone }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`} role="status">{children}</div>;
}
