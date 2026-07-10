import { redirect } from "react-router";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { buildGoogleOAuthUrl } from "../services/google-ads.server";
import {
  createGoogleAdsOAuthState,
  getGoogleAdsRedirectUri,
} from "../utils/google-ads-oauth-state.server";

export async function loader({ request }) {
  const { session } = await loadShopifyRouteContext(request);
  const redirectUri = getGoogleAdsRedirectUri(request);
  const { context, cookieHeader, state } = await createGoogleAdsOAuthState({
    request,
    shop: session.shop,
  });
  console.info("Google Ads OAuth start", {
    hostPresent: Boolean(context.host),
    returnTo: context.returnTo,
    shop: session.shop,
  });
  const authorization = buildGoogleOAuthUrl({ redirectUri, state });

  if (!authorization.ok) {
    throw new Response("Google Ads connection is temporarily unavailable. Return to Connections and try again later.", { status: 503 });
  }

  return redirect(authorization.url, {
    headers: { "Set-Cookie": cookieHeader },
  });
}
