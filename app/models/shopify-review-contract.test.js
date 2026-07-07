import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google Ads reviewer flow distinguishes authorization, sync readiness, zero rows, and disconnect", async () => {
  const [connections, notices, sync, disconnect] = await Promise.all([
    source("routes/app.connections.jsx"),
    source("utils/connections-notice.js"),
    source("routes/app.connections.google.sync.jsx"),
    source("routes/app.connections.google-ads.disconnect.jsx"),
  ]);

  assert.match(connections, /Connected · select account/);
  assert.match(connections, /connected \? "Connected"/);
  assert.match(connections, /Sync latest data/);
  assert.match(connections, /Manage campaigns/);
  assert.match(connections, /Campaign sync scope/);
  assert.match(connections, /Disconnect/);
  assert.match(connections, /googleLiveRowCount === 0/);
  assert.equal(connections.includes(["Load demo", "Google Ads data"].join(" ")), false);
  assert.equal(connections.includes(["Clear demo", "Google Ads data"].join(" ")), false);
  assert.match(notices, /query\.get\("disconnected"\)/);
  assert.match(connections, /query\.get\("warning"\)/);
  assert.match(connections, /Google Ads connected\. No live performance rows were found for this account\./);
  assert.match(connections, /getConnectionsNotice/);
  assert.match(disconnect, /disconnectPlatform\(session\.shop, "google"\)/);
  assert.match(disconnect, /export const loader = \(\) => new Response\("Method not allowed", \{ status: 405/);
  assert.match(sync, /externalAccountId/);
  assert.match(sync, /Select at least one campaign before syncing\./);
  assert.match(sync, /campaignIds: syncScope\.campaignIds/);
  assert.match(sync, /removeGoogleAdsRowsOutsideCampaignScope/);
});

test("dashboard empty state and manual CSV import remain available", async () => {
  const [chart, connections, dataImport, performanceModel] = await Promise.all([
    source("components/dashboard/PerformanceChart.jsx"),
    source("routes/app.connections.jsx"),
    source("routes/app.data-import.jsx"),
    source("models/creative-performance.server.js"),
  ]);

  assert.match(chart, /No imported ad or creative performance data yet\./);
  assert.match(connections, /Manual CSV import remains available/);
  assert.match(connections, /\/app\/data-import/);
  assert.match(dataImport, /CSV/i);
  assert.match(performanceModel, /NOT: \{ platform: "google", source: "demo", isDemo: true \}/);
});

test("Google Ads integration remains reporting-only", async () => {
  const [service, sync, campaignRoute] = await Promise.all([
    source("services/google-ads.server.js"),
    source("routes/app.connections.google.sync.jsx"),
    source("routes/app.connections_.google-ads.campaigns.jsx"),
  ]);

  assert.match(service, /googleAds:searchStream/);
  assert.match(service, /customers:listAccessibleCustomers/);
  assert.doesNotMatch(
    `${service}\n${sync}\n${campaignRoute}`,
    /googleAds:(?:mutate|upload)|campaigns:(?:create|update|remove)|adGroups:(?:create|update|remove)/i,
  );
});

test("Google Ads campaign management is inline on Connections", async () => {
  const [connections, campaignRoute, campaignModel] = await Promise.all([
    source("routes/app.connections.jsx"),
    source("routes/app.connections_.google-ads.campaigns.jsx"),
    source("models/google-ads-campaign.server.js"),
  ]);

  assert.match(connections, /setCampaignPanelOpen/);
  assert.match(connections, /type="button"[\s\S]*Manage campaigns/);
  assert.doesNotMatch(connections, /to=\{withEmbeddedRouteParams\("\/app\/connections\/google-ads\/campaigns"/);
  assert.match(connections, /aria-label="Google Ads campaign selector"/);
  assert.match(connections, /max-h-\[280px\][^\n]*overflow-y-auto/);
  assert.match(connections, /refresh_google_campaigns/);
  assert.match(connections, /save_google_campaigns/);
  assert.match(connections, /No campaigns loaded yet\. Click Refresh campaign list\./);
  assert.match(campaignModel, /Select at least one campaign before syncing\./);
  assert.match(campaignRoute, /Connect\+and\+select\+a\+Google\+Ads\+account\+first/);
  assert.match(campaignRoute, /formData\.get\("intent"\) === "refresh"/);
  assert.match(campaignRoute, /formData\.get\("intent"\) === "save"/);
  assert.match(campaignRoute, /No campaigns loaded yet\. Click Refresh campaign list\./);
  assert.match(campaignRoute, /No campaigns were found in this Google Ads account\./);
  assert.match(campaignRoute, /withEmbeddedRouteParams\("\/app\/connections", location\.search\)/);
});

test("campaign management is explicitly local planning and not ad-platform mutation", async () => {
  const [campaigns, campaignDetail] = await Promise.all([
    source("routes/app.campaigns.jsx"),
    source("routes/app.campaigns.$id.jsx"),
  ]);
  assert.match(campaigns, /local planning folders/);
  assert.match(campaigns, /never creates, edits, launches, or spends on an ad platform/);
  assert.match(campaignDetail, /Changes here do not modify an ad platform/);
});

test("review configuration is embedded, least-privilege, and uses one production origin", async () => {
  const config = await readFile(new URL("../../shopify.app.toml", import.meta.url), "utf8");
  assert.match(config, /embedded\s*=\s*true/);
  assert.match(config, /scopes\s*=\s*"read_products"/);
  assert.doesNotMatch(config, /(?:read|write)_(?:customers|orders|draft_orders)|write_products/);

  const origins = [...config.matchAll(/https:\/\/blueprintai-app\.onrender\.com/g)];
  assert.equal(origins.length, 4);
  assert.doesNotMatch(config, /ngrok|trycloudflare|YOUR_PRODUCTION_APP_URL/);
});
