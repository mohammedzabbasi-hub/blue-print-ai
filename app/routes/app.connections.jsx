import {
  Cable,
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";
import {
  disconnectPlatform,
  countGoogleAdsLiveRows,
  getConnectionByPlatform,
  getConnectionsForShop,
  updateConnectionAccount,
} from "../models/ad-platform-connection.server";
import {
  listGoogleAdsCampaigns,
  saveGoogleAdsCampaignSelection,
  upsertGoogleAdsCampaigns,
} from "../models/google-ads-campaign.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  fetchGoogleAdsCampaigns,
  getGoogleAdsIntegrationStatus,
  refreshGoogleAdsAccessToken,
  revokeGoogleAdsToken,
} from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { getConnectionsNotice } from "../utils/connections-notice";
import { decryptToken } from "../utils/token-encryption.server";

const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok Ads",
    description: "Coming soon. Import TikTok performance with a CSV today.",
    available: false,
    accent: "from-cyan-400/20 to-fuchsia-500/10",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Coming soon. Import Meta performance with a CSV today.",
    available: false,
    accent: "from-blue-500/20 to-indigo-500/10",
  },
  {
    id: "google",
    name: "Google Ads",
    description: "Connect Google campaign and creative performance data.",
    available: "configured",
    accent: "from-amber-400/20 to-emerald-500/10",
  },
];

export const meta = () => [{ title: "Connections | BluePrintAI" }];

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const [connections, googleLiveRowCount] = await Promise.all([
    getConnectionsForShop(session.shop),
    countGoogleAdsLiveRows(session.shop),
  ]);

  const googleConfiguration = getGoogleAdsIntegrationStatus();
  const googleConnection = connections.find(({ platform }) => platform === "google");
  const googleCampaigns = googleConnection?.externalAccountId
    ? await listGoogleAdsCampaigns(session.shop, googleConnection.externalAccountId)
    : [];
  return {
    connections: connections.map((connection) => ({
      externalAccountId: connection.externalAccountId,
      externalAccountName: connection.externalAccountName,
      lastSyncedAt: connection.lastSyncedAt,
      lastSyncError: connection.lastSyncError,
      platform: connection.platform,
      status: connection.status,
      metadata: parseMetadata(connection.metadataJson),
    })),
    googleConfiguration,
    googleCampaigns,
    googleLiveRowCount,
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const platform = String(formData.get("platform") || "");

  if (["refresh_google_campaigns", "save_google_campaigns"].includes(String(formData.get("intent")))) {
    const connection = await getConnectionByPlatform(session.shop, "google");
    if (!connection?.encryptedRefreshToken || !connection.externalAccountId) {
      return { campaignError: "Connect and select a Google Ads account first." };
    }
    try {
      if (formData.get("intent") === "refresh_google_campaigns") {
        const refreshed = await refreshGoogleAdsAccessToken(decryptToken(connection.encryptedRefreshToken));
        if (!refreshed.ok) throw new Error(refreshed.message);
        const campaigns = await fetchGoogleAdsCampaigns({
          accessToken: refreshed.accessToken,
          customerId: connection.externalAccountId,
        });
        await upsertGoogleAdsCampaigns(session.shop, connection.externalAccountId, campaigns);
        return {
          campaignPanelOpen: true,
          campaignSuccess: `Campaign list refreshed. ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} found.`,
          refreshCompleted: true,
        };
      }
      const selection = await saveGoogleAdsCampaignSelection(session.shop, connection.externalAccountId, {
        selectedCampaignIds: formData.getAll("campaignId").map(String),
      });
      return {
        campaignPanelOpen: true,
        campaignSuccess: "Campaign selection saved.",
        selectedCampaignIds: selection.selectedCampaignIds,
      };
    } catch (error) {
      return {
        campaignError: error.message || "Could not update Google Ads campaign selection.",
        campaignPanelOpen: true,
      };
    }
  }

  if (formData.get("intent") === "select_google_account") {
    const customerId = String(formData.get("customerId") || "").replace(/\D/g, "");
    const connection = await getConnectionByPlatform(session.shop, "google");
    const customers = parseMetadata(connection?.metadataJson)?.accessibleCustomers || [];
    if (!connection || !customers.some((item) => item.customerId === customerId)) {
      return { error: "Select an accessible Google Ads account." };
    }
    await updateConnectionAccount(session.shop, "google", {
      externalAccountId: customerId,
      externalAccountName: `Google Ads customer ${customerId}`,
      metadata: parseMetadata(connection.metadataJson),
    });
    return { success: "Google Ads account selected. You can sync now." };
  }

  if (formData.get("intent") !== "disconnect") {
    return { error: "Unknown connection action." };
  }

  try {
    let warning = "";
    if (platform === "google") {
      const connection = await getConnectionByPlatform(session.shop, platform);
      if (connection?.encryptedRefreshToken) {
        try {
          await revokeGoogleAdsToken(
            decryptToken(connection.encryptedRefreshToken),
          );
        } catch {
          warning =
            " The local connection was removed, but verify the BluePrintAI grant in your Google Account.";
        }
      }
    }
    await disconnectPlatform(session.shop, platform);
    return { success: `${platformLabel(platform)} disconnected.${warning}` };
  } catch (error) {
    return { error: error.message || "Could not disconnect this platform." };
  }
};

export function ErrorBoundary() {
  const error = useRouteError();
  const message = error?.data || error?.message || "Connections could not load.";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-red-500/25 bg-[#0b1220] p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
          Connections
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">
          Return to Connections
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          {String(message)}
        </p>
        <a className="bp-primary-cta mt-5" href="/app/connections" target="_top" rel="noreferrer">
          Return to Connections
        </a>
      </section>
    </div>
  );
}

export default function ConnectionsRoute() {
  const { connections, googleCampaigns, googleConfiguration, googleLiveRowCount, shop } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const query = new URLSearchParams(location.search);
  const missingEmbeddedContext = !query.get("host") && query.get("googleAds") === "connected";
  const googleAdsConnection = connections.find(
    (connection) => connection.platform === "google",
  );
  const notice = getConnectionsNotice({
    actionSuccess: actionData?.success,
    googleAdsConnection,
    query,
  });
  const warning = query.get("warning");
  const error = query.get("error") || actionData?.error;
  const connectionMap = new Map(
    connections.map((connection) => [connection.platform, connection]),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1728] to-[#080d17] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Data connections
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-white md:text-4xl">
              Ad platform connections
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Manual CSV import remains available. Google Ads can connect when server setup is complete; direct connections are optional and are not required to use BluePrintAI.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            <ShieldCheck aria-hidden="true" size={18} />
            Tokens stay encrypted server-side
          </div>
        </div>
      </section>

      {notice && <Notice tone="success">{notice}</Notice>}
      {missingEmbeddedContext && (
        <Notice tone="warning">
          Shopify context was not included in the OAuth return. <a className="underline" href={withEmbeddedRouteParams("/app/connections", location.search)} target="_top" rel="noreferrer">Return to Connections</a>
        </Notice>
      )}
      {warning && <Notice tone="warning">{warning}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Ad platforms">
        {PLATFORMS.map((platform) => (
          <PlatformCard
            connection={connectionMap.get(platform.id)}
            key={platform.id}
            platform={platform}
            googleConfiguration={googleConfiguration}
            googleCampaigns={platform.id === "google" ? googleCampaigns : []}
            googleLiveRowCount={googleLiveRowCount}
            search={location.search}
            shop={shop}
            submitting={navigation.state === "submitting"}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-6 md:flex md:items-center md:justify-between md:gap-6">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
            <Database aria-hidden="true" size={21} />
          </div>
          <div>
            <h2 className="font-semibold text-white">Prefer files? CSV import remains available.</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              You can keep importing performance CSVs without connecting an ad account. Existing imports, campaign assignments, and dashboard reporting continue to work as before.
            </p>
          </div>
        </div>
        <Link
          className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-400/30 hover:text-white md:mt-0"
          to={withEmbeddedRouteParams("/app/data-import", location.search)}
        >
          Open CSV import <ExternalLink aria-hidden="true" size={15} />
        </Link>
      </section>
    </div>
  );
}

function PlatformCard({ connection, googleCampaigns, googleConfiguration, googleLiveRowCount, platform, search, shop, submitting }) {
  const actionData = useActionData();
  const [campaignPanelOpen, setCampaignPanelOpen] = useState(Boolean(actionData?.campaignPanelOpen));
  const available = platform.available === "configured" ? googleConfiguration.ok : platform.available;
  const connected = Boolean(connection) && platform.id === "google";
  const visibleConnection = connected ? connection : null;
  const syncPath = withEmbeddedRouteParams(
    `/app/connections/${platform.id === "google" ? "google-ads" : platform.id}/sync`,
    search,
  );
  const connectPath = withEmbeddedRouteParams(
    platform.id === "google"
      ? `/auth/google-ads/start?shop=${encodeURIComponent(shop)}&returnTo=${encodeURIComponent("/app/connections")}`
      : `/auth/${platform.id}/start`,
    search,
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]">
      <div className={`h-24 bg-gradient-to-br ${platform.accent} p-5`}>
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-cyan-100">
            <Cable aria-hidden="true" size={22} />
          </div>
          <StatusBadge available={available} connected={connected} needsSelection={connection?.status === "needs_account_selection"} setupRequired={platform.id === "google" && !googleConfiguration.ok} />
        </div>
      </div>
      <div className="p-5">
        <h2 className="text-xl font-bold text-white">{platform.name}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
          {platform.description}
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            External account
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-200">
            {visibleConnection?.externalAccountId ? visibleConnection.externalAccountName : connected ? "Select an ad account" : "No active connection"}
          </p>
          {visibleConnection?.externalAccountId && (
            <p className="mt-1 text-xs text-slate-400">
              Google Ads customer ID: {visibleConnection.externalAccountId}
            </p>
          )}
          {visibleConnection?.lastSyncedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Last synced {new Date(visibleConnection.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>

        {visibleConnection?.lastSyncError && (
          <p className="mt-3 text-xs leading-5 text-amber-200">
            Last sync: {visibleConnection.lastSyncError}
          </p>
        )}

        {platform.id === "google" && connected && visibleConnection?.externalAccountId && googleLiveRowCount === 0 && (
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
            Google Ads connected. No live performance rows were found for this account.
          </p>
        )}

        {platform.id === "google" && !googleConfiguration.ok && (
          <p className="mt-3 text-xs leading-5 text-amber-200">
            Setup required. Missing server configuration: {googleConfiguration.missing.join(", ")}.
          </p>
        )}

        {connected && !visibleConnection?.externalAccountId && (
          visibleConnection?.metadata?.accessibleCustomers?.length ? (
            <Form className="mt-4 flex gap-2" method="post">
              <input name="intent" type="hidden" value="select_google_account" />
              <select className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" name="customerId" required>
                <option value="">Select Google Ads account</option>
                {visibleConnection.metadata.accessibleCustomers.map(({ customerId }) => (
                  <option key={customerId} value={customerId}>{customerId}</option>
                ))}
              </select>
              <button className="bp-primary-cta" disabled={submitting} type="submit">Select</button>
            </Form>
          ) : (
            <p className="mt-3 text-xs leading-5 text-amber-200">
              Connected, but accounts could not be listed. Reconnect to retry account discovery.
            </p>
          )
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!connected && available && (
            <Link
              className="bp-primary-cta"
              target={platform.id === "google" ? "_top" : undefined}
              to={connectPath}
            >
              Connect {platform.name}
            </Link>
          )}
          {!connected && !available && (
            <button
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-500"
              disabled
              type="button"
            >
              {platform.id === "google" ? "Setup required" : `Connect ${platform.name} · Coming soon`}
            </button>
          )}
          {connected && visibleConnection?.externalAccountId && (
            <>
              <button
                aria-expanded={campaignPanelOpen}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-400/30"
                onClick={() => setCampaignPanelOpen((open) => !open)}
                type="button"
              >
                Manage campaigns
              </button>
              <Form action={syncPath} method="post">
                <button className="bp-primary-cta" disabled={submitting} type="submit">
                  <RefreshCw aria-hidden="true" size={15} /> Sync latest data
                </button>
              </Form>
              <Form action={withEmbeddedRouteParams("/app/connections/google-ads/disconnect", search)} method="post">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-bold text-red-200 hover:bg-red-500/10"
                  disabled={submitting}
                  type="submit"
                >
                  <Trash2 aria-hidden="true" size={15} /> Disconnect
                </button>
              </Form>
            </>
          )}
          {connected && !visibleConnection?.externalAccountId && (
            <Form action={withEmbeddedRouteParams("/app/connections/google-ads/disconnect", search)} method="post">
              <button className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-bold text-red-200" disabled={submitting} type="submit"><Trash2 aria-hidden="true" size={15} /> Disconnect</button>
            </Form>
          )}
        </div>
        {connected && visibleConnection?.externalAccountId && (
          <CampaignSelector
            actionData={actionData}
            busy={submitting}
            campaigns={googleCampaigns}
            hidden={!campaignPanelOpen}
            onDone={() => setCampaignPanelOpen(false)}
          />
        )}
      </div>
    </article>
  );
}

function CampaignSelector({ actionData, busy, campaigns, hidden, onDone }) {
  const saveFetcher = useFetcher();
  const saveTimer = useRef(null);
  const initialSelectedCampaignIds = campaigns.filter((campaign) => campaign.selected).map((campaign) => campaign.campaignId);
  const selectedCampaignIdsRef = useRef(initialSelectedCampaignIds);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(initialSelectedCampaignIds);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  useEffect(() => {
    if (!actionData?.refreshCompleted || saveStatus !== "") return;
    const refreshedSelection = campaigns.filter((campaign) => campaign.selected).map((campaign) => campaign.campaignId);
    selectedCampaignIdsRef.current = refreshedSelection;
    setSelectedCampaignIds(refreshedSelection);
  }, [actionData?.refreshCompleted, campaigns, saveStatus]);

  useEffect(() => {
    if (saveFetcher.state !== "idle") {
      setSaveStatus("saving");
    } else if (saveFetcher.data?.campaignError) {
      setSaveStatus("error");
    } else if (saveFetcher.data?.campaignSuccess) {
      setSaveStatus("saved");
    }
  }, [saveFetcher.data, saveFetcher.state]);

  const toggleCampaign = (campaignId) => {
    const current = selectedCampaignIdsRef.current;
    const next = current.includes(campaignId)
      ? current.filter((id) => id !== campaignId)
      : [...current, campaignId];
    selectedCampaignIdsRef.current = next;
    setSelectedCampaignIds(next);
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const formData = new FormData();
      formData.set("intent", "save_google_campaigns");
      next.forEach((id) => formData.append("campaignId", id));
      saveFetcher.submit(formData, { method: "post" });
    }, 350);
  };

  return (
    <section className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-950/60 p-4" aria-label="Google Ads campaign selector" hidden={hidden}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-white">Choose campaigns to sync</h3>
        <Form method="post">
          <input name="intent" type="hidden" value="refresh_google_campaigns" />
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200" disabled={busy} onClick={() => setSaveStatus("")} type="submit">
            <RefreshCw aria-hidden="true" size={14} /> Refresh campaign list
          </button>
        </Form>
      </div>
      {actionData?.campaignSuccess && <Notice tone="success">{actionData.campaignSuccess}</Notice>}
      {actionData?.campaignError && <Notice tone="error">{actionData.campaignError}</Notice>}
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Selected campaigns only affect which read-only Google Ads reporting rows BluePrintAI syncs. BluePrintAI does not edit, launch, pause, remove, or spend on campaigns.
      </p>
      <div className="mt-3 max-h-[260px] overflow-y-auto rounded-lg border border-white/10" data-testid="google-campaign-list">
        {campaigns.length ? campaigns.map((campaign) => {
          const selected = selectedCampaignIds.includes(campaign.campaignId);
          return (
            <label aria-label={`Select ${campaign.campaignName}`} className={`flex cursor-pointer items-start gap-3 border-b border-white/10 px-3 py-2.5 last:border-b-0 hover:bg-white/[0.04] ${selected ? "bg-cyan-500/[0.06]" : "bg-transparent"}`} htmlFor={`campaign-${campaign.id}`} key={campaign.id}>
              <input
                checked={selected}
                className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
                id={`campaign-${campaign.id}`}
                onChange={() => toggleCampaign(campaign.campaignId)}
                type="checkbox"
              />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{campaign.campaignName}</span><span className="mt-0.5 block text-xs text-slate-400">{campaign.campaignStatus || "Unknown status"} · {campaign.advertisingChannelType || "Unknown type"}</span></span>
            </label>
          );
        }) : (
          <p className="p-4 text-center text-sm text-slate-300">
            {actionData?.refreshCompleted ? "No campaigns were found in this Google Ads account." : "No campaigns loaded yet. Refresh the campaign list to get started."}
          </p>
        )}
      </div>
      <div className="mt-3 flex min-h-9 items-center justify-between gap-3">
        <p className={`text-xs ${saveStatus === "error" ? "text-red-300" : "text-slate-400"}`} aria-live="polite">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? (saveFetcher.data?.campaignError || "Could not save the campaign selection. Try again.") : "Changes save automatically."}
        </p>
        <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:border-cyan-400/30" onClick={onDone} type="button">Done</button>
      </div>
    </section>
  );
}

function StatusBadge({ available, connected, needsSelection, setupRequired }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${connected ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-slate-500/30 bg-slate-950/50 text-slate-300"}`}>
      {connected && <CheckCircle2 aria-hidden="true" size={13} />}
      {needsSelection ? "Connected · select account" : connected ? "Connected" : setupRequired ? "Setup required" : available ? "Disconnected" : "Coming soon"}
    </span>
  );
}

function Notice({ children, tone }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`} role="status">
      {children}
    </div>
  );
}

function platformLabel(platform) {
  return PLATFORMS.find((item) => item.id === platform)?.name || "Ad platform";
}

function parseMetadata(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}
