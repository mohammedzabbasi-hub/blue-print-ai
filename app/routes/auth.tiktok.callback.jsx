import { redirect } from "react-router";
import { createConnection } from "../models/ad-platform-connection.server";
import { exchangeTikTokCodeForToken } from "../services/tiktok-ads.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import {
  clearTikTokOAuthState,
  validateTikTokOAuthState,
} from "../utils/tiktok-oauth-state.server";

function connectionsRedirect(search, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const path = `/app/connections${query.size ? `?${query}` : ""}`;
  return withEmbeddedRouteParams(path, search);
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  let clearCookieHeader;
  let returnSearch = "";

  try {
    const stateData = await validateTikTokOAuthState(
      request,
      url.searchParams.get("state"),
    );
    clearCookieHeader = stateData.clearCookieHeader;
    returnSearch = stateData.returnSearch;

    const oauthError = url.searchParams.get("error_description") ||
      url.searchParams.get("error");
    if (oauthError) throw new Error(`TikTok authorization failed: ${oauthError}`);

    const code = url.searchParams.get("code") || url.searchParams.get("auth_code");
    if (!code) throw new Error("TikTok did not return an authorization code.");

    const token = await exchangeTikTokCodeForToken({ code });
    const advertiserId = Array.isArray(token.raw?.advertiser_ids)
      ? token.raw.advertiser_ids[0]
      : null;
    const tokenExpiresAt = token.expiresIn
      ? new Date(Date.now() + Number(token.expiresIn) * 1000)
      : null;

    await createConnection(stateData.shop, {
      platform: "tiktok",
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt,
      scopes: token.scopes,
      externalAccountId: advertiserId,
      externalAccountName: advertiserId
        ? `TikTok advertiser ${advertiserId}`
        : "TikTok Ads account",
    });

    return redirect(
      connectionsRedirect(returnSearch, { connected: "tiktok" }),
      { headers: { "Set-Cookie": clearCookieHeader } },
    );
  } catch (error) {
    clearCookieHeader ||= await clearTikTokOAuthState();
    return redirect(
      connectionsRedirect(returnSearch, {
        error: error.message || "TikTok Ads could not be connected.",
      }),
      { headers: { "Set-Cookie": clearCookieHeader } },
    );
  }
};
