import { OAuth2Client } from "google-auth-library";
import { redirect } from "react-router";
import { sessionStorage } from "../shopify.server";
import {
  getGoogleAdsOAuthConfig,
  GOOGLE_ADS_SCOPE,
} from "../services/google-ads.server";
import {
  createGoogleAdsOAuthState,
  getGoogleAdsRedirectUri,
} from "../utils/google-ads-oauth-state.server";
import {
  hasInstalledShopifySession,
  normalizeShopDomain,
} from "../utils/installed-shop-session.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const requestedShop = url.searchParams.get("shop");
  if (!requestedShop) {
    throw new Response(
      "Google Ads OAuth requires a shop query parameter.",
      { status: 400 },
    );
  }

  const shop = normalizeShopDomain(requestedShop);
  if (!shop) {
    throw new Response(
      "The Shopify shop parameter must be a valid myshopify.com domain.",
      { status: 400 },
    );
  }

  let hasInstalledSession;
  try {
    hasInstalledSession = await hasInstalledShopifySession(sessionStorage, shop);
  } catch {
    throw new Response(
      "Shopify session storage is temporarily unavailable.",
      { status: 503 },
    );
  }
  if (!hasInstalledSession) {
    throw new Response(
      "No installed Shopify session was found for this shop. Open BluePrintAI in Shopify Admin before connecting Google Ads.",
      { status: 404 },
    );
  }

  let oauthConfig;
  try {
    oauthConfig = getGoogleAdsOAuthConfig();
  } catch (error) {
    throw new Response(error.message, { status: 503 });
  }
  const redirectUri = getGoogleAdsRedirectUri(request);
  if (process.env.NODE_ENV !== "production") {
    console.info(`Google Ads OAuth callback URL: ${redirectUri}`);
  }
  const { cookieHeader, state } = await createGoogleAdsOAuthState({
    request,
    shop,
  });
  const oauthClient = new OAuth2Client(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    redirectUri,
  );
  const authorizationUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [GOOGLE_ADS_SCOPE],
    state,
  });

  return redirect(authorizationUrl, {
    headers: { "Set-Cookie": cookieHeader },
  });
}
