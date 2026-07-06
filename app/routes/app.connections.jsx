import {
  Cable,
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import {
  disconnectPlatform,
  countGoogleAdsDemoRows,
  getConnectionByPlatform,
  getConnectionsForShop,
  updateConnectionAccount,
} from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { getGoogleAdsIntegrationStatus, revokeGoogleAdsToken } from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";

const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok Ads",
    description: "Bring TikTok campaign, ad group, and ad performance into BluePrintAI.",
    available: false,
    accent: "from-cyan-400/20 to-fuchsia-500/10",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Connect Facebook and Instagram advertising performance.",
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
  const [connections, googleDemoRowCount] = await Promise.all([
    getConnectionsForShop(session.shop),
    countGoogleAdsDemoRows(session.shop),
  ]);

  const googleConfiguration = getGoogleAdsIntegrationStatus();
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
    googleDemoRowCount,
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const platform = String(formData.get("platform") || "");

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

export default function ConnectionsRoute() {
  const { connections, googleConfiguration, googleDemoRowCount, shop } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const query = new URLSearchParams(location.search);
  const notice = query.get("connected")
    ? `${platformLabel(query.get("connected"))} authorized. Select an accessible account to finish setup.`
    : query.get("synced")
      ? `${Number(query.get("synced")) || 0} daily performance rows synced.`
      : query.get("demoLoaded")
        ? `${Number(query.get("demoLoaded")) || 0} demo Google Ads daily rows loaded locally.`
        : query.has("demoCleared")
          ? `${Number(query.get("demoCleared")) || 0} demo Google Ads daily rows cleared.`
      : query.get("disconnected")
        ? `${platformLabel(query.get("disconnected"))} disconnected.`
        : actionData?.success;
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
      {warning && <Notice tone="warning">{warning}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Ad platforms">
      {PLATFORMS.map((platform) => (
          <PlatformCard
            connection={connectionMap.get(platform.id)}
            key={platform.id}
            platform={platform}
            googleConfiguration={googleConfiguration}
            googleDemoRowCount={googleDemoRowCount}
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

function PlatformCard({ connection, googleConfiguration, googleDemoRowCount, platform, search, shop, submitting }) {
  const available = platform.available === "configured" ? googleConfiguration.ok : platform.available;
  const connected = Boolean(connection) && platform.id === "google";
  const visibleConnection = connected ? connection : null;
  const syncPath = withEmbeddedRouteParams(
    `/app/connections/${platform.id === "google" ? "google-ads" : platform.id}/sync`,
    search,
  );
  const connectPath = withEmbeddedRouteParams(
    platform.id === "google"
      ? `/auth/google-ads/start?shop=${encodeURIComponent(shop)}`
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

        {platform.id === "google" && connected && new URLSearchParams(search).get("synced") === "0" && (
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
            Google Ads connected. No live performance rows were found for this account.
          </p>
        )}

        {platform.id === "google" && googleDemoRowCount > 0 && (
          <p className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold leading-5 text-cyan-100">
            Demo data — not from your live Google Ads account. {googleDemoRowCount} daily rows loaded.
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
              <Form action={syncPath} method="post">
                <button className="bp-primary-cta" disabled={submitting} type="submit">
                  <RefreshCw aria-hidden="true" size={15} /> Sync now
                </button>
              </Form>
              <Form action={withEmbeddedRouteParams("/app/connections/google-ads/demo", search)} method="post">
                <input name="intent" type="hidden" value="load" />
                <button className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 px-4 py-2.5 text-sm font-bold text-cyan-100 hover:bg-cyan-500/10" disabled={submitting} type="submit">
                  <Database aria-hidden="true" size={15} /> Load demo Google Ads data
                </button>
              </Form>
              {googleDemoRowCount > 0 && (
                <Form action={withEmbeddedRouteParams("/app/connections/google-ads/demo", search)} method="post">
                  <input name="intent" type="hidden" value="clear" />
                  <button className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 px-4 py-2.5 text-sm font-bold text-amber-100 hover:bg-amber-500/10" disabled={submitting} type="submit">
                    <Trash2 aria-hidden="true" size={15} /> Clear demo Google Ads data
                  </button>
                </Form>
              )}
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
      </div>
    </article>
  );
}

function StatusBadge({ available, connected, needsSelection, setupRequired }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${connected ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-slate-500/30 bg-slate-950/50 text-slate-300"}`}>
      {connected && <CheckCircle2 aria-hidden="true" size={13} />}
      {needsSelection ? "Authorized · select account" : connected ? "Ready to sync" : setupRequired ? "Setup required" : available ? "Disconnected" : "Coming soon"}
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
