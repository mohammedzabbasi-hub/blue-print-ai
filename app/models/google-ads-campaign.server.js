import prisma from "../db.server.js";
import { normalizeShopIdentifier } from "./ad-platform-connection.server.js";

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
  const defaultToEligibleCampaigns = connection.campaignSyncMode !== "selected";
  const lastSeenAt = new Date();
  await client.$transaction([
    ...campaigns.map((campaign) =>
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
          selected: defaultToEligibleCampaigns && campaign.campaignStatus === "ENABLED",
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
    ...(defaultToEligibleCampaigns ? [client.adPlatformConnection.update({
      where: { id: connection.id },
      data: { campaignSyncMode: "selected" },
    })] : []),
  ]);
  return { count: campaigns.length };
}

export function listGoogleAdsCampaigns(shop, customerId, { client = prisma } = {}) {
  return client.googleAdsCampaign.findMany({
    where: {
      shop: normalizeShopIdentifier(shop),
      customerId: String(customerId),
      campaignStatus: { not: "REMOVED" },
    },
    orderBy: { campaignName: "asc" },
  });
}

export async function saveGoogleAdsCampaignSelection(
  shop,
  customerId,
  { selectedCampaignIds },
  { client = prisma } = {},
) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const ids = [...new Set(selectedCampaignIds.map(String))];
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
  });
  if (!connection || connection.externalAccountId !== String(customerId)) {
    throw new Error("Connect and select this Google Ads account first.");
  }
  const available = await client.googleAdsCampaign.findMany({
    where: { shop: normalizedShop, customerId: String(customerId), campaignStatus: { not: "REMOVED" } },
    select: { campaignId: true },
  });
  const availableIds = new Set(available.map(({ campaignId }) => campaignId));
  if (ids.some((id) => !availableIds.has(id))) throw new Error("Select only campaigns from this Google Ads account.");

  await client.$transaction([
    client.adPlatformConnection.update({
      where: { id: connection.id },
      data: { campaignSyncMode: "selected" },
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
  return { mode: "selected", selectedCampaignIds: ids };
}

export async function getGoogleAdsSyncScope(shop, customerId, { client = prisma } = {}) {
  const normalizedShop = normalizeShopIdentifier(shop);
  const connection = await client.adPlatformConnection.findUnique({
    where: { shop_platform: { shop: normalizedShop, platform: "google" } },
    select: { campaignSyncMode: true, externalAccountId: true },
  });
  if (!connection || connection.externalAccountId !== String(customerId)) return { mode: "selected", campaignIds: [] };
  const campaigns = await client.googleAdsCampaign.findMany({
    where: { shop: normalizedShop, customerId: String(customerId), selected: true, campaignStatus: { not: "REMOVED" } },
    select: { campaignId: true },
  });
  return { mode: "selected", campaignIds: campaigns.map(({ campaignId }) => campaignId) };
}
