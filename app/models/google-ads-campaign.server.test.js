import assert from "node:assert/strict";
import test from "node:test";
import {
  getGoogleAdsSyncScope,
  listGoogleAdsCampaigns,
  saveGoogleAdsCampaignSelection,
  upsertGoogleAdsCampaigns,
} from "./google-ads-campaign.server.js";

function fakeClient({ mode = "all", selected = [] } = {}) {
  const calls = { findMany: [], upserts: [], updates: [], updateMany: [] };
  const connection = { id: "connection-1", externalAccountId: "123", campaignSyncMode: mode };
  return {
    calls,
    adPlatformConnection: {
      findUnique: async ({ select } = {}) => select ? { externalAccountId: connection.externalAccountId, campaignSyncMode: connection.campaignSyncMode } : connection,
      update: (args) => { calls.updates.push(args); return Promise.resolve(args); },
    },
    googleAdsCampaign: {
      upsert: (args) => { calls.upserts.push(args); return Promise.resolve(args); },
      findMany: async ({ where, select } = {}) => {
        calls.findMany.push({ where, select });
        if (where?.selected) return selected.map((campaignId) => ({ campaignId }));
        if (select?.campaignId) return [{ campaignId: "7" }, { campaignId: "8" }];
        return [];
      },
      updateMany: (args) => { calls.updateMany.push(args); return Promise.resolve(args); },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
}

test("Google Ads sync scope is always selection-based", async () => {
  const scope = await getGoogleAdsSyncScope("SHOP.EXAMPLE", "123", { client: fakeClient() });
  assert.deepEqual(scope, { mode: "selected", campaignIds: [] });
});

test("first campaign discovery selects enabled campaigns by default", async () => {
  const client = fakeClient();
  await upsertGoogleAdsCampaigns("SHOP.EXAMPLE", "123", [{ campaignId: "7", campaignName: "Brand", campaignStatus: "ENABLED", advertisingChannelType: "SEARCH" }], { client });
  assert.equal(client.calls.upserts[0].where.shop_customerId_campaignId.shop, "shop.example");
  assert.equal(client.calls.upserts[0].where.shop_customerId_campaignId.customerId, "123");
  assert.equal(client.calls.upserts[0].create.selected, true);
  assert.equal(Object.hasOwn(client.calls.upserts[0].update, "selected"), false);
  assert.equal(client.calls.updates[0].data.campaignSyncMode, "selected");
});

test("later campaign refreshes preserve saved selections", async () => {
  const client = fakeClient({ mode: "selected" });
  await upsertGoogleAdsCampaigns("shop.example", "123", [{ campaignId: "8", campaignName: "New", campaignStatus: "ENABLED", advertisingChannelType: "SEARCH" }], { client });
  assert.equal(client.calls.upserts[0].create.selected, false);
  assert.equal(client.calls.updates.length, 0);
});

test("removed campaigns are hidden from the selectable campaign list", async () => {
  const client = fakeClient();
  await listGoogleAdsCampaigns("shop.example", "123", { client });
  assert.deepEqual(client.calls.findMany[0].where.campaignStatus, { not: "REMOVED" });
});

test("campaign selection saves mode and only selected campaign IDs", async () => {
  const client = fakeClient();
  const result = await saveGoogleAdsCampaignSelection("shop.example", "123", { selectedCampaignIds: ["7"] }, { client });
  assert.deepEqual(result, { mode: "selected", selectedCampaignIds: ["7"] });
  assert.equal(client.calls.updates[0].data.campaignSyncMode, "selected");
  assert.deepEqual(client.calls.updateMany[1].where.campaignId.in, ["7"]);
});

test("selected mode with no campaigns is blocked clearly", async () => {
  await assert.rejects(saveGoogleAdsCampaignSelection("shop.example", "123", { selectedCampaignIds: [] }, { client: fakeClient() }), /Select at least one campaign before syncing/);
});

test("selected sync scope returns only persisted campaign IDs", async () => {
  assert.deepEqual(await getGoogleAdsSyncScope("shop.example", "123", { client: fakeClient({ mode: "selected", selected: ["7", "8"] }) }), { mode: "selected", campaignIds: ["7", "8"] });
});
