import { redirect } from "react-router";
import { disconnectPlatform, getConnectionByPlatform } from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { revokeGoogleAdsToken } from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { decryptToken } from "../utils/token-encryption.server";

export async function action({ request }) {
  const { session } = await loadShopifyRouteContext(request);
  const connection = await getConnectionByPlatform(session.shop, "google");
  let warning = "";
  if (connection?.encryptedRefreshToken) {
    try { await revokeGoogleAdsToken(decryptToken(connection.encryptedRefreshToken)); }
    catch { warning = " Google access could not be revoked; review grants in your Google Account."; }
  }
  await disconnectPlatform(session.shop, "google");
  return redirect(withEmbeddedRouteParams(`/app/connections?disconnected=google&warning=${encodeURIComponent(warning)}`, new URL(request.url).search));
}

export const loader = () => new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
