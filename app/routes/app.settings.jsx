/* eslint-disable react/prop-types */
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  aiProviderStatus,
  buildWorkspaceExport,
  configuredScopes,
  createWorkspaceRequest,
  deleteWorkspaceData,
  disconnectTikTokWorkspace,
  listWorkspaceRequests,
  loadTikTokConnection,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  billingBypassed,
  billingRequired,
  getAppHandleFromConfig,
} from "../utils/billing.server";
import { Icon } from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const shouldRequireBilling = billingRequired();
  const shouldBypassBilling = billingBypassed();
  const paymentStatus = shouldRequireBilling
    ? await billing.check()
    : { hasActivePayment: false };
  const tiktokConnection = await loadTikTokConnection(session.shop);

  return {
    shop: merchantData.shop,
    scopes: configuredScopes(),
    aiStatus: aiProviderStatus(),
    catalogUpdatedAt: merchantData.products[0]?.updatedAt || "",
    billingStatus: {
      appHandle: getAppHandleFromConfig(),
      bypassed: shouldBypassBilling,
      hasActivePayment: paymentStatus.hasActivePayment,
      required: shouldRequireBilling,
    },
    workspaceRequests: await listWorkspaceRequests(session.shop),
    tiktokConnection,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "logout") {
    await db.session.deleteMany({ where: { shop: session.shop } });
    throw redirect("/auth/login");
  }

  if (intent === "request_export") {
    const payload = await buildWorkspaceExport(session.shop);
    await createWorkspaceRequest(session.shop, "data_export", {
      requestedBy: "merchant",
      exportedAt: payload.exportedAt,
      recordCounts: {
        savedBriefs: payload.savedBriefs.length,
        videoAnalyses: payload.videoAnalyses.length,
        savedCreatives: payload.savedCreatives.length,
        revenueBlueprints: payload.revenueBlueprints.length,
      },
    });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Disposition": 'attachment; filename="blueprintai-workspace-export.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  if (intent === "delete_workspace") {
    if (formData.get("confirmDelete") !== "DELETE") {
      return { message: "Type DELETE to confirm workspace deletion." };
    }

    await deleteWorkspaceData(session.shop);

    return { message: "Workspace data deleted. Shopify auth remains connected." };
  }

  if (intent === "disconnect_tiktok") {
    const result = await disconnectTikTokWorkspace(session.shop);
    await createWorkspaceRequest(session.shop, "tiktok_disconnect", {
      disconnectedAt: result.disconnectedAt,
    });

    return { message: "TikTok connection metadata cleared. Shopify remains connected." };
  }

  return { message: "No settings action was selected." };
};

export default function Settings() {
  const {
    shop,
    scopes,
    aiStatus,
    billingStatus,
    catalogUpdatedAt,
    workspaceRequests,
    tiktokConnection,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const workspaceId = workspaceFromDomain(shop.myshopifyDomain || shop.name);
  const supportEmail = "support@blueprintai.app";

  return (
    <div className="bp-page bp-settings-page">
      <header className="bp-settings-header">
        <div>
          <p className="bp-settings-eyebrow">Settings</p>
          <h1>Workspace settings</h1>
          <p>
            Store connection, app status, privacy controls, integrations, and support.
          </p>
        </div>
        <Form method="post">
          <button className="bp-settings-logout" type="submit" name="intent" value="logout">
            <Icon name="logout" /> Log out
          </button>
        </Form>
      </header>

      <div className="bp-settings-grid">
        {actionData?.message && (
          <SettingsCard title="Action complete" icon="check">
            <p>{actionData.message}</p>
          </SettingsCard>
        )}

        <SettingsCard
          title="Store connection"
          icon="save"
          action={<StatusPill tone="connected" label="Connected" />}
        >
          <dl className="bp-settings-definition-list">
            <div>
              <dt>Store</dt>
              <dd>{displayShopName(shop.name)}</dd>
            </div>
            <div>
              <dt>Domain</dt>
              <dd className="bp-settings-mono">{shop.myshopifyDomain}</dd>
            </div>
            <div>
              <dt>Workspace ID</dt>
              <dd className="bp-settings-mono">{workspaceId}</dd>
            </div>
            <div>
              <dt>Catalog updated</dt>
              <dd>{catalogUpdatedAt ? formatDate(catalogUpdatedAt) : "Not available"}</dd>
            </div>
          </dl>
          <details className="bp-settings-details">
            <summary>Access scopes</summary>
            <ul className="bp-settings-scope-list">
              {scopes.map((scope) => (
                <li key={scope}>
                  <span>{scope}</span>
                  <Icon name="check" />
                </li>
              ))}
            </ul>
          </details>
        </SettingsCard>

        <SettingsCard
          title="AI provider"
          icon="sparkles"
          action={<StatusPill tone="demo" label={aiStatus.configured ? "Configured" : "Demo mode"} />}
        >
          <dl className="bp-settings-definition-list">
            <div>
              <dt>Engine</dt>
              <dd>BluePrintAI Engine v2</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{aiStatus.configured ? aiStatus.label : "Demo fallback (sample analyses)"}</dd>
            </div>
          </dl>
          <p className="bp-settings-callout">
            {aiStatus.configured
              ? aiStatus.note
              : "No live AI provider is configured. The app is using deterministic generation."}
          </p>
        </SettingsCard>

        <SettingsCard
          title="Billing"
          icon="credit"
          action={
            <StatusPill
              tone={billingStatus.hasActivePayment ? "connected" : "demo"}
              label={
                billingStatus.bypassed
                  ? "Bypassed"
                  : billingStatus.hasActivePayment
                    ? "Active"
                    : "Required"
              }
            />
          }
        >
          <p className="bp-settings-callout">
            {billingStatus.bypassed
              ? "Billing is bypassed for this development environment."
              : "Billing is enforced through Shopify before app pages load."}
          </p>
          <ul className="bp-settings-check-list">
            <li>
              <Icon name={billingStatus.required ? "check" : "warning"} /> Billing requirement {billingStatus.required ? "enabled" : "disabled for this environment"}
            </li>
            <li>
              <Icon name={billingStatus.appHandle ? "check" : "warning"} /> App pricing handle {billingStatus.appHandle || "not configured"}
            </li>
            <li>
              <Icon name="check" /> No off-platform billing is exposed
            </li>
          </ul>
        </SettingsCard>

        <SettingsCard title="Privacy & data deletion" icon="shield">
          <div className="bp-settings-copy-stack">
            <p>
              Merchants can request a full export or deletion of their
              BluePrintAI data at any time. Shopify erasure webhook routes are
              present for app-review verification and app-owned shop data is
              cleaned up on uninstall.
            </p>
            <Form method="post" className="bp-settings-actions">
              <button type="submit" name="intent" value="request_export" disabled={isSubmitting}>
                Download data export
              </button>
              <label className="bp-settings-confirm">
                <span>Type DELETE to confirm</span>
                <input name="confirmDelete" placeholder="DELETE" autoComplete="off" />
              </label>
              <button
                className="bp-settings-danger"
                type="submit"
                name="intent"
                value="delete_workspace"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form?.confirmDelete?.value !== "DELETE") return;
                  if (!window.confirm("Delete all app-owned workspace data for this shop? Shopify auth will stay connected.")) {
                    event.preventDefault();
                  }
                }}
                disabled={isSubmitting}
              >
                <Icon name="trash" /> Delete workspace
              </button>
            </Form>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Support"
          icon="support"
          action={<StatusPill tone="connected" label="Contact configured" />}
        >
          <div className="bp-settings-copy-stack">
            <p>Merchants can contact support from inside the app.</p>
            <a href={`mailto:${supportEmail}`}>Email support: {supportEmail}</a>
          </div>
        </SettingsCard>

        {(tiktokConnection.connected || tiktokConnection.disconnectedAt) && (
          <SettingsCard
            title="TikTok connection"
            icon="music"
            action={
              <StatusPill
                tone={tiktokConnection.connected ? "connected" : "demo"}
                label={tiktokConnection.connected ? "Connected" : "Disconnected"}
              />
            }
          >
            <div className="bp-settings-copy-stack">
              {tiktokConnection.connected ? (
                <>
                  <p>
                    Connected as{" "}
                    <strong>
                      {tiktokConnection.sellerName ||
                        tiktokConnection.sellerId ||
                        `${displayShopName(shop.name)} TikTok Seller`}
                    </strong>
                    {tiktokConnection.connectedAt
                      ? ` · since ${formatDate(tiktokConnection.connectedAt)}`
                      : ""}
                  </p>
                  <Form method="post" className="bp-settings-actions">
                    <button type="submit" name="intent" value="disconnect_tiktok" disabled={isSubmitting}>
                      Disconnect TikTok
                    </button>
                  </Form>
                </>
              ) : (
                <p>
                  TikTok connection metadata was cleared
                  {tiktokConnection.disconnectedAt
                    ? ` on ${formatDate(tiktokConnection.disconnectedAt)}.`
                    : "."}
                </p>
              )}
            </div>
          </SettingsCard>
        )}

        {workspaceRequests.length > 0 && (
          <SettingsCard title="Recent workspace requests" icon="list">
            <ul className="bp-settings-check-list">
              {workspaceRequests.map((item) => (
                <li key={item.id}>
                  <Icon name="check" /> {requestLabel(item.type)} - {item.status}
                </li>
              ))}
            </ul>
          </SettingsCard>
        )}
      </div>
    </div>
  );
}

function SettingsCard({ title, icon, action, children }) {
  return (
    <section className="bp-settings-card">
      <header>
        <div>
          <span className="bp-settings-card-icon">
            <Icon name={icon} />
          </span>
          <h2>{title}</h2>
        </div>
        {action && <div className="bp-settings-card-action">{action}</div>}
      </header>
      <div className="bp-settings-card-body">{children}</div>
    </section>
  );
}

function StatusPill({ tone, label }) {
  return (
    <span className={`bp-settings-status bp-settings-status-${tone}`}>
      <Icon name={tone === "connected" ? "check" : "sparkles"} />
      {label}
    </span>
  );
}

function displayShopName(name) {
  if (!name) return "Atlas Supply Co.";
  return name.includes(".myshopify.com") ? name.replace(".myshopify.com", "") : name;
}

function workspaceFromDomain(value) {
  return (value || "atlas-supply")
    .replace(".myshopify.com", "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US").format(new Date(value));
}

function requestLabel(type) {
  return String(type)
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
