import { redirect } from "react-router";
import { createConnection } from "../models/ad-platform-connection.server";
import {
  exchangeGoogleAdsCode,
  fetchAccessibleGoogleAdsCustomers,
  GOOGLE_ADS_SCOPE,
} from "../services/google-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import {
  clearGoogleAdsOAuthState,
  getGoogleAdsRedirectUri,
  validateGoogleAdsOAuthState,
} from "../utils/google-ads-oauth-state.server";

function connectionsRedirect(search, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return withEmbeddedRouteParams(
    `/app/connections${query.size ? `?${query}` : ""}`,
    search,
  );
}

export async function loader({ request }) {
  const url = new URL(request.url);
  let clearCookieHeader;
  let returnSearch = "";
  let stateData;

  try {
    stateData = await validateGoogleAdsOAuthState(
      request,
      url.searchParams.get("state"),
    );
    clearCookieHeader = stateData.clearCookieHeader;
    returnSearch = stateData.returnSearch;
  } catch {
    try {
      clearCookieHeader = await clearGoogleAdsOAuthState();
    } catch {
      clearCookieHeader = null;
    }
    return new Response(
      "Google Ads OAuth state is invalid or has expired. Start the connection again from BluePrintAI.",
      {
        status: 400,
        headers: clearCookieHeader
          ? { "Set-Cookie": clearCookieHeader }
          : undefined,
      },
    );
  }

  try {
    const oauthError =
      url.searchParams.get("error_description") || url.searchParams.get("error");
    if (oauthError) throw new Error(`Google Ads authorization failed: ${oauthError}`);

    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("Google OAuth code is missing.", {
        status: 400,
        headers: { "Set-Cookie": clearCookieHeader },
      });
    }

    const tokens = await exchangeGoogleAdsCode({
      code,
      redirectUri: getGoogleAdsRedirectUri(request),
    });
    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Remove the prior BluePrintAI grant in your Google Account and connect again.",
      );
    }

    let accessibleCustomers = [];
    let accountDiscoveryError = null;
    if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN && tokens.access_token) {
      try {
        accessibleCustomers = await fetchAccessibleGoogleAdsCustomers({
          accessToken: tokens.access_token,
        });
      } catch (error) {
        accountDiscoveryError = error.message || "Google Ads account discovery failed.";
      }
    }
    const selectedCustomer = accessibleCustomers[0] || null;

    await createConnection(stateData.shop, {
      platform: "google",
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope || GOOGLE_ADS_SCOPE,
      externalAccountId: selectedCustomer?.customerId || null,
      externalAccountName: selectedCustomer
        ? `Google Ads customer ${selectedCustomer.customerId}`
        : "Google Ads account",
      metadata: {
        accessibleCustomers,
        accountDiscoveryError,
        accessTokenPersisted: false,
      },
    });

    return redirect(
      connectionsRedirect(returnSearch, { connected: "google" }),
      { headers: { "Set-Cookie": clearCookieHeader } },
    );
  } catch (error) {
    return redirect(
      connectionsRedirect(returnSearch, {
        error: error.message || "Google Ads could not be connected.",
      }),
      { headers: { "Set-Cookie": clearCookieHeader } },
    );
  }
}
