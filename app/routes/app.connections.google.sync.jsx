import { redirect } from "react-router";
import {
  getConnectionByPlatform,
  recordConnectionSyncError,
  removeGoogleAdsRowsOutsideCampaignScope,
  upsertDailyAdPerformanceRows,
} from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  fetchGoogleAdsAdMetrics,
  fetchGoogleAdsCampaignMetrics,
  refreshGoogleAdsAccessToken,
} from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";
import { getGoogleAdsSyncScope } from "../models/google-ads-campaign.server";

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const connection = await getConnectionByPlatform(session.shop, "google");
  const search = new URL(request.url).search;

  if (!connection?.encryptedRefreshToken) {
    return redirect(
      withEmbeddedRouteParams(
        "/app/connections?error=Connect+Google+Ads+before+syncing.",
        search,
      ),
    );
  }

  try {
    const customerId = connection.externalAccountId;
    if (!customerId) {
      throw new Error("Select a Google Ads customer account before syncing.");
    }
    const syncScope = await getGoogleAdsSyncScope(session.shop, customerId);
    if (!syncScope.campaignIds.length) {
      throw new Error("Select at least one campaign before syncing.");
    }
    const refreshed = await refreshGoogleAdsAccessToken(
      decryptToken(connection.encryptedRefreshToken),
    );
    if (!refreshed.ok) throw new Error(refreshed.message);
    const accessToken = refreshed.accessToken;

    const reportingOptions = {
      accessToken,
      customerId,
      endDate: new Date(),
      startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      campaignIds: syncScope.campaignIds,
    };
    const [campaignRows, adRows] = await Promise.all([
      fetchGoogleAdsCampaignMetrics(reportingOptions),
      fetchGoogleAdsAdMetrics(reportingOptions),
    ]);
    const rows = [...campaignRows, ...adRows];
    await removeGoogleAdsRowsOutsideCampaignScope(
      session.shop,
      customerId,
      syncScope.campaignIds,
    );
    const result = await upsertDailyAdPerformanceRows(
      session.shop,
      "google",
      rows.map((row) => ({
        ...row,
        externalAccountId: customerId,
        externalAccountName:
          connection.externalAccountName || `Google Ads customer ${customerId}`,
        payload: {
          source: "Google Ads",
          level: row.adId ? "ad" : "campaign",
          campaignStatus: row.campaignStatus,
          conversionValue: row.conversionValue,
          ctr: row.ctr,
          cpc: row.cpc,
          cpm: row.cpm,
          conversionRate: row.conversionRate,
          cpa: row.cpa,
          roas: row.roas,
        },
        reportingDate: row.date,
      })),
    );

    return redirect(
      withEmbeddedRouteParams(
        `/app/connections?synced=${result.count}`,
        search,
      ),
    );
  } catch (error) {
    await recordConnectionSyncError(connection.id, error);
    return redirect(
      withEmbeddedRouteParams(
        `/app/connections?error=${encodeURIComponent(
          error.message || "Google Ads sync failed.",
        )}`,
        search,
      ),
    );
  }
};

export const loader = () =>
  new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
