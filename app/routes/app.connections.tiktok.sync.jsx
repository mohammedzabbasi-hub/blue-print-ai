import { redirect } from "react-router";
import {
  getConnectionByPlatform,
  recordConnectionSyncError,
  upsertDailyAdPerformanceRows,
} from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { fetchTikTokDailyAdPerformance } from "../services/tiktok-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const connection = await getConnectionByPlatform(session.shop, "tiktok");
  const search = new URL(request.url).search;

  if (!connection) {
    return redirect(
      withEmbeddedRouteParams(
        "/app/connections?error=Connect+TikTok+Ads+before+syncing.",
        search,
      ),
    );
  }

  try {
    const rows = await fetchTikTokDailyAdPerformance({
      accessToken: decryptToken(connection.encryptedAccessToken),
      advertiserId: connection.externalAccountId,
      endDate: new Date(),
      startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    });
    const result = await upsertDailyAdPerformanceRows(
      session.shop,
      "tiktok",
      rows,
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
        `/app/connections?error=${encodeURIComponent(error.message || "TikTok Ads sync failed.")}`,
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
