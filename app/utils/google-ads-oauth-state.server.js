import crypto from "node:crypto";
import { createCookie } from "react-router";
import { getEmbeddedRouteSearch } from "./embedded-routing.js";

const STATE_MAX_AGE_SECONDS = 10 * 60;

function getStateSecret() {
  const secret =
    process.env.AD_PLATFORM_OAUTH_STATE_SECRET || process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    throw new Error(
      "Google Ads OAuth is not configured: AD_PLATFORM_OAUTH_STATE_SECRET or SHOPIFY_API_SECRET is missing.",
    );
  }

  return secret;
}

function getStateCookie() {
  return createCookie(
    process.env.NODE_ENV === "production"
      ? "__Host-blueprint_google_ads_oauth"
      : "blueprint_google_ads_oauth",
    {
      httpOnly: true,
      maxAge: STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      secrets: [getStateSecret()],
    },
  );
}

function firstForwardedValue(value) {
  return String(value || "").split(",", 1)[0].trim();
}

function isNgrokHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app"].some(
    (suffix) => normalized.endsWith(suffix),
  );
}

function normalizePublicOrigin(value, { requireHttps = false } = {}) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    if (requireHttps && url.protocol !== "https:") return null;
    if (isNgrokHostname(url.hostname)) url.protocol = "https:";
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicOrigin(request, env = process.env) {
  const configuredTunnelUrl = env.SHOPIFY_DEV_TUNNEL_URL?.trim();
  if (configuredTunnelUrl) {
    const configuredOrigin = normalizePublicOrigin(configuredTunnelUrl, {
      requireHttps: true,
    });
    if (!configuredOrigin) {
      throw new Error(
        "SHOPIFY_DEV_TUNNEL_URL must be a valid HTTPS origin.",
      );
    }
    return configuredOrigin;
  }

  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const forwardedProto = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  ).toLowerCase();

  if (forwardedHost && ["http", "https"].includes(forwardedProto)) {
    const forwardedOrigin = normalizePublicOrigin(
      `${forwardedProto}://${forwardedHost}`,
    );
    if (forwardedOrigin) return forwardedOrigin;
  }

  if (forwardedHost) {
    const forwardedOrigin = normalizePublicOrigin(`https://${forwardedHost}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  const fallbackUrl = new URL(request.url);
  if (isNgrokHostname(fallbackUrl.hostname)) fallbackUrl.protocol = "https:";
  return fallbackUrl.origin;
}

export function getGoogleAdsRedirectUri(request, env = process.env) {
  return `${getPublicOrigin(request, env)}/auth/google-ads/callback`;
}

export async function createGoogleAdsOAuthState({ request, shop }) {
  const state = crypto.randomBytes(32).toString("base64url");
  const returnSearch = getEmbeddedRouteSearch(new URL(request.url).search);
  const cookie = getStateCookie();

  return {
    state,
    cookieHeader: await cookie.serialize({
      state,
      shop,
      returnSearch,
      createdAt: Date.now(),
    }),
  };
}

export async function validateGoogleAdsOAuthState(request, receivedState) {
  const cookie = getStateCookie();
  const stored = await cookie.parse(request.headers.get("Cookie"));
  const expected = Buffer.from(String(stored?.state || ""));
  const received = Buffer.from(String(receivedState || ""));
  const stateIsValid =
    expected.length > 0 &&
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);
  const stateIsFresh =
    Number.isFinite(stored?.createdAt) &&
    Date.now() - stored.createdAt <= STATE_MAX_AGE_SECONDS * 1000;

  if (!stateIsValid || !stateIsFresh || !stored?.shop) {
    throw new Error(
      "Google Ads OAuth state is invalid or has expired. Please connect again.",
    );
  }

  return {
    clearCookieHeader: await cookie.serialize("", { maxAge: 0 }),
    returnSearch: getEmbeddedRouteSearch(stored.returnSearch),
    shop: stored.shop,
  };
}

export async function clearGoogleAdsOAuthState() {
  return getStateCookie().serialize("", { maxAge: 0 });
}
