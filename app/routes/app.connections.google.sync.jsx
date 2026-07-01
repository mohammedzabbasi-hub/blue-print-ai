import { redirect } from "react-router";
import {
  getConnectionByPlatform,
  recordConnectionSyncError,
  updateConnectionAccount,
  upsertDailyAdPerformanceRows,
} from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  fetchAccessibleGoogleAdsCustomers,
  fetchGoogleAdsCampaignMetrics,
  getGoogleAdsAccessToken,
} from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";

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
    const accessToken = await getGoogleAdsAccessToken(
      decryptToken(connection.encryptedRefreshToken),
    );
    let customerId = connection.externalAccountId;
    if (!customerId) {
      const customers = await fetchAccessibleGoogleAdsCustomers({ accessToken });
      customerId = customers[0]?.customerId;
      if (customerId) {
        await updateConnectionAccount(session.shop, "google", {
          externalAccountId: customerId,
          externalAccountName: `Google Ads customer ${customerId}`,
          metadata: { accessibleCustomers: customers, accessTokenPersisted: false },
        });
      }
    }
    if (!customerId) {
      throw new Error("No accessible Google Ads customer account was found.");
    }

    const rows = await fetchGoogleAdsCampaignMetrics({
      accessToken,
      customerId,
      endDate: new Date(),
      startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    });
    const result = await upsertDailyAdPerformanceRows(
      session.shop,
      "google",
      rows.map((row) => ({
        ...row,
        externalAccountId: customerId,
        externalAccountName:
          connection.externalAccountName || `Google Ads customer ${customerId}`,
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
