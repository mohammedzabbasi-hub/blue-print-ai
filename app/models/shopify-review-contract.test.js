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
  assert.match(connections, /googleLiveRowCount === 0/);
  assert.match(notices, /query\.get\("disconnected"\)/);
  assert.match(connections, /query\.get\("warning"\)/);
  assert.match(connections, /Google Ads connected\. No live performance rows were found for this account\./);
  assert.match(connections, /getConnectionsNotice/);
  assert.match(disconnect, /disconnectPlatform\(session\.shop, "google"\)/);
  assert.match(disconnect, /export const loader = \(\) => new Response\("Method not allowed", \{ status: 405/);
  assert.match(sync, /externalAccountId/);
});

test("Google Ads integration remains reporting-only", async () => {
  const [service, sync] = await Promise.all([
    source("services/google-ads.server.js"),
    source("routes/app.connections.google.sync.jsx"),
  ]);

  assert.match(service, /googleAds:searchStream/);
  assert.match(service, /customers:listAccessibleCustomers/);
  assert.doesNotMatch(
    `${service}\n${sync}`,
    /googleAds:(?:mutate|upload)|campaigns:(?:create|update|remove)|adGroups:(?:create|update|remove)/i,
  );
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
