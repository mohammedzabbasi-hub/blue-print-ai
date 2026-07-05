import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google Ads reviewer flow distinguishes authorization, sync readiness, zero rows, and disconnect", async () => {
  const [connections, sync, disconnect] = await Promise.all([
    source("routes/app.connections.jsx"),
    source("routes/app.connections.google.sync.jsx"),
    source("routes/app.connections.google-ads.disconnect.jsx"),
  ]);

  assert.match(connections, /Authorized · select account/);
  assert.match(connections, /Ready to sync/);
  assert.match(connections, /query\.get\("disconnected"\)/);
  assert.match(connections, /query\.get\("warning"\)/);
  assert.match(connections, /0} daily performance rows synced/);
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

test("review configuration is embedded, least-privilege, and uses one production origin", async () => {
  const config = await readFile(new URL("../../shopify.app.toml", import.meta.url), "utf8");
  assert.match(config, /embedded\s*=\s*true/);
  assert.match(config, /scopes\s*=\s*"read_products"/);
  assert.doesNotMatch(config, /(?:read|write)_(?:customers|orders|draft_orders)|write_products/);

  const origins = [...config.matchAll(/https:\/\/blueprintai-app\.onrender\.com/g)];
  assert.equal(origins.length, 4);
  assert.doesNotMatch(config, /ngrok|trycloudflare|YOUR_PRODUCTION_APP_URL/);
});
