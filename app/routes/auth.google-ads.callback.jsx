import { redirect } from "react-router";
import { createConnection } from "../models/ad-platform-connection.server";
import {
  exchangeGoogleAdsCodeForTokens,
  GOOGLE_ADS_SCOPE,
  listAccessibleCustomers,
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

function configuredFallbackCustomer() {
  const customerId = process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID?.replace(/\D/g, "");
  return customerId ? [{ customerId, resourceName: `customers/${customerId}` }] : [];
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

    const exchange = await exchangeGoogleAdsCodeForTokens({
      code,
      redirectUri: getGoogleAdsRedirectUri(request),
    });
    if (!exchange.ok) throw new Error(exchange.message);
    const { tokens } = exchange;

    let accessibleCustomers = [];
    let accountDiscoveryError = null;
    if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN && tokens.access_token) {
      try {
        const discovery = await listAccessibleCustomers({
          accessToken: tokens.access_token,
        });
        if (!discovery.ok) throw new Error(discovery.message);
        accessibleCustomers = discovery.customers;
      } catch (error) {
        accountDiscoveryError = error.message || "Google Ads account discovery failed.";
      }
    }

    if (!accessibleCustomers.length) {
      accessibleCustomers = configuredFallbackCustomer();
    }

    await createConnection(stateData.shop, {
      platform: "google",
      status: "needs_account_selection",
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope || GOOGLE_ADS_SCOPE,
      externalAccountId: null,
      externalAccountName: "Google Ads account",
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
