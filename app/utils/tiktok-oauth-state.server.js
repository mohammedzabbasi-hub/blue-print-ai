import crypto from "node:crypto";
import { createCookie } from "react-router";
import { getEmbeddedRouteSearch } from "./embedded-routing";

const STATE_MAX_AGE_SECONDS = 10 * 60;

function getStateSecret() {
  const secret =
    process.env.AD_PLATFORM_OAUTH_STATE_SECRET ||
    process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    throw new Error(
      "TikTok Ads OAuth is not configured yet: AD_PLATFORM_OAUTH_STATE_SECRET or SHOPIFY_API_SECRET is missing.",
    );
  }

  return secret;
}

function getStateCookie() {
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-blueprint_tiktok_oauth"
      : "blueprint_tiktok_oauth";

  return createCookie(cookieName, {
    httpOnly: true,
    maxAge: STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [getStateSecret()],
  });
}

export async function createTikTokOAuthState({ request, shop }) {
  const state = crypto.randomBytes(32).toString("base64url");
  const returnSearch = getEmbeddedRouteSearch(new URL(request.url).search);
  const cookie = getStateCookie();
  const cookieHeader = await cookie.serialize({
    state,
    shop,
    returnSearch,
    createdAt: Date.now(),
  });

  return { cookieHeader, state };
}

export async function validateTikTokOAuthState(request, receivedState) {
  const cookie = getStateCookie();
  const stored = await cookie.parse(request.headers.get("Cookie"));
  const expectedState = String(stored?.state || "");
  const actualState = String(receivedState || "");
  const expectedBuffer = Buffer.from(expectedState);
  const actualBuffer = Buffer.from(actualState);
  const validState =
    expectedBuffer.length > 0 &&
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  const fresh =
    Number.isFinite(stored?.createdAt) &&
    Date.now() - stored.createdAt <= STATE_MAX_AGE_SECONDS * 1000;

  if (!validState || !fresh || !stored?.shop) {
    throw new Error("TikTok OAuth state is invalid or has expired. Please connect again.");
  }

  return {
    clearCookieHeader: await cookie.serialize("", { maxAge: 0 }),
    returnSearch: getEmbeddedRouteSearch(stored.returnSearch),
    shop: stored.shop,
  };
}

export async function clearTikTokOAuthState() {
  return getStateCookie().serialize("", { maxAge: 0 });
}
