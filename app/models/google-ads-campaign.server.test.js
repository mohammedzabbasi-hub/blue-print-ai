import assert from "node:assert/strict";
import test from "node:test";
import {
  getGoogleAdsSyncScope,
  saveGoogleAdsCampaignSelection,
  upsertGoogleAdsCampaigns,
} from "./google-ads-campaign.server.js";

function fakeClient({ mode = "all", selected = [] } = {}) {
  const calls = { upserts: [], updates: [], updateMany: [] };
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
        if (where?.selected) return selected.map((campaignId) => ({ campaignId }));
        if (select?.campaignId) return [{ campaignId: "7" }, { campaignId: "8" }];
        return [];
      },
      updateMany: (args) => { calls.updateMany.push(args); return Promise.resolve(args); },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
}

test("connected Google Ads accounts default to all-campaign sync", async () => {
  const scope = await getGoogleAdsSyncScope("SHOP.EXAMPLE", "123", { client: fakeClient() });
  assert.deepEqual(scope, { mode: "all", campaignIds: [] });
});

test("campaign discovery upserts against the correct shop and customer without clearing selection", async () => {
  const client = fakeClient();
  await upsertGoogleAdsCampaigns("SHOP.EXAMPLE", "123", [{ campaignId: "7", campaignName: "Brand", campaignStatus: "ENABLED", advertisingChannelType: "SEARCH" }], { client });
  assert.equal(client.calls.upserts[0].where.shop_customerId_campaignId.shop, "shop.example");
  assert.equal(client.calls.upserts[0].where.shop_customerId_campaignId.customerId, "123");
  assert.equal(Object.hasOwn(client.calls.upserts[0].update, "selected"), false);
});

test("campaign selection saves mode and only selected campaign IDs", async () => {
  const client = fakeClient();
  const result = await saveGoogleAdsCampaignSelection("shop.example", "123", { mode: "selected", selectedCampaignIds: ["7"] }, { client });
  assert.deepEqual(result, { mode: "selected", selectedCampaignIds: ["7"] });
  assert.equal(client.calls.updates[0].data.campaignSyncMode, "selected");
  assert.deepEqual(client.calls.updateMany[1].where.campaignId.in, ["7"]);
});

test("selected mode with no campaigns is blocked clearly", async () => {
  await assert.rejects(saveGoogleAdsCampaignSelection("shop.example", "123", { mode: "selected", selectedCampaignIds: [] }, { client: fakeClient() }), /Select at least one campaign before syncing/);
});

test("selected sync scope returns only persisted campaign IDs", async () => {
  assert.deepEqual(await getGoogleAdsSyncScope("shop.example", "123", { client: fakeClient({ mode: "selected", selected: ["7", "8"] }) }), { mode: "selected", campaignIds: ["7", "8"] });
});
