import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGoogleAdsDemoRows,
  clearGoogleAdsDemoData,
  seedGoogleAdsDemoData,
} from "./ad-platform-connection.server.js";

function demoClient(initialRows = []) {
  const rows = [...initialRows];
  const client = {
    rows,
    adPlatformConnection: {
      findUnique: async () => ({ id: "connection-1", shop: "demo.myshopify.com", platform: "google", externalAccountId: "1234567890" }),
    },
    adPerformanceDaily: {
      upsert: async ({ create }) => {
        const index = rows.findIndex((row) => row.rowKey === create.rowKey && row.shop === create.shop && row.platform === create.platform);
        if (index >= 0) rows[index] = create;
        else rows.push(create);
        return create;
      },
      deleteMany: async ({ where }) => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].shop === where.shop && rows[index].platform === where.platform && rows[index].isDemo === where.isDemo) rows.splice(index, 1);
        }
        return { count: before - rows.length };
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  return client;
}

test("connected account with zero rows shows the demo load action", async () => {
  const source = await readFile(new URL("../routes/app.connections.jsx", import.meta.url), "utf8");
  assert.match(source, /Google Ads connected\. No live performance rows were found for this account\./);
  assert.match(source, /Load demo Google Ads data/);
  assert.match(source, /get\("synced"\) === "0"/);
});

test("loading demo Google Ads data creates realistic labeled rows", async () => {
  const client = demoClient();
  const result = await seedGoogleAdsDemoData("demo.myshopify.com", { client, endDate: new Date("2026-07-05T12:00:00Z") });
  assert.equal(result.count, 90);
  assert.equal(client.rows.length, 90);
  const row = client.rows[0];
  assert.equal(row.source, "demo");
  assert.equal(row.isDemo, true);
  assert.equal(row.platform, "google");
  assert.ok(row.campaignName && row.adGroupName && row.adName);
  assert.ok(row.impressions > row.clicks && row.clicks > 0);
  const payload = JSON.parse(row.payloadJson);
  assert.equal(payload.source, "demo");
  assert.equal(payload.isDemo, true);
  assert.ok(payload.costMicros > 0 && payload.ctr > 0 && payload.cpc > 0 && payload.roas > 0);
});

test("demo row builder includes all requested daily metrics", () => {
  const [row] = buildGoogleAdsDemoRows({ days: 1, endDate: new Date("2026-07-05T12:00:00Z") });
  for (const field of ["date", "campaignName", "adGroupName", "adName", "impressions", "clicks", "costMicros", "conversions", "conversionValue", "ctr", "cpc", "roas"]) {
    assert.ok(Object.hasOwn(row, field), `missing ${field}`);
  }
});

test("clearing demo rows removes only demo rows and preserves real sync rows", async () => {
  const real = { shop: "demo.myshopify.com", platform: "google", rowKey: "live-1", source: "live", isDemo: false };
  const demo = { shop: "demo.myshopify.com", platform: "google", rowKey: "demo-1", source: "demo", isDemo: true };
  const otherShopDemo = { shop: "other.myshopify.com", platform: "google", rowKey: "demo-2", source: "demo", isDemo: true };
  const client = demoClient([real, demo, otherShopDemo]);
  const result = await clearGoogleAdsDemoData("demo.myshopify.com", { client });
  assert.equal(result.count, 1);
  assert.deepEqual(client.rows, [real, otherShopDemo]);
});
