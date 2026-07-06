import prisma from "../db.server.js";
import { normalizeShopIdentifier } from "./ad-platform-connection.server.js";

export const GOOGLE_ADS_SYNC_MODES = new Set(["all", "selected"]);

export async function upsertGoogleAdsCampaigns(
  shop,
  customerId,
  campaigns,
  { client = prisma } = {},
) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
  });
  if (!connection || connection.externalAccountId !== String(customerId)) {
    throw new Error("Connect and select this Google Ads account first.");
  }
  const lastSeenAt = new Date();
  await client.$transaction(
    campaigns.map((campaign) =>
      client.googleAdsCampaign.upsert({
        where: {
          shop_customerId_campaignId: {
            shop: normalizedShop,
            customerId: String(customerId),
            campaignId: String(campaign.campaignId),
          },
        },
        create: {
          connectionId: connection.id,
          shop: normalizedShop,
          customerId: String(customerId),
          ...campaign,
          campaignId: String(campaign.campaignId),
          lastSeenAt,
        },
        update: {
          campaignName: campaign.campaignName,
          campaignStatus: campaign.campaignStatus,
          advertisingChannelType: campaign.advertisingChannelType,
          connectionId: connection.id,
          lastSeenAt,
        },
      }),
    ),
  );
  return { count: campaigns.length };
}

export function listGoogleAdsCampaigns(shop, customerId, { client = prisma } = {}) {
  return client.googleAdsCampaign.findMany({
    where: {
      shop: normalizeShopIdentifier(shop),
      customerId: String(customerId),
    },
    orderBy: { campaignName: "asc" },
  });
}

export async function saveGoogleAdsCampaignSelection(
  shop,
  customerId,
  { mode, selectedCampaignIds },
  { client = prisma } = {},
) {
  if (!GOOGLE_ADS_SYNC_MODES.has(mode)) throw new Error("Choose a valid campaign sync scope.");
  const normalizedShop = normalizeShopIdentifier(shop);
  const ids = [...new Set(selectedCampaignIds.map(String))];
  if (mode === "selected" && !ids.length) {
    throw new Error("Select at least one campaign before syncing.");
  }
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
  });
  if (!connection || connection.externalAccountId !== String(customerId)) {
    throw new Error("Connect and select this Google Ads account first.");
  }
  const available = await client.googleAdsCampaign.findMany({
    where: { shop: normalizedShop, customerId: String(customerId) },
    select: { campaignId: true },
  });
  const availableIds = new Set(available.map(({ campaignId }) => campaignId));
  if (ids.some((id) => !availableIds.has(id))) throw new Error("Select only campaigns from this Google Ads account.");

  await client.$transaction([
    client.adPlatformConnection.update({
      where: { id: connection.id },
      data: { campaignSyncMode: mode },
    }),
    client.googleAdsCampaign.updateMany({
      where: { shop: normalizedShop, customerId: String(customerId) },
      data: { selected: false },
    }),
    ...(ids.length
      ? [client.googleAdsCampaign.updateMany({
          where: { shop: normalizedShop, customerId: String(customerId), campaignId: { in: ids } },
          data: { selected: true },
        })]
      : []),
  ]);
  return { mode, selectedCampaignIds: ids };
}

export async function getGoogleAdsSyncScope(shop, customerId, { client = prisma } = {}) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
    select: { campaignSyncMode: true, externalAccountId: true },
  });
  const mode = connection?.campaignSyncMode === "selected" ? "selected" : "all";
  if (!connection || connection.externalAccountId !== String(customerId)) return { mode: "all", campaignIds: [] };
  if (mode === "all") return { mode, campaignIds: [] };
  const campaigns = await client.googleAdsCampaign.findMany({
    where: { shop: normalizedShop, customerId: String(customerId), selected: true },
    select: { campaignId: true },
  });
  return { mode, campaignIds: campaigns.map(({ campaignId }) => campaignId) };
}
