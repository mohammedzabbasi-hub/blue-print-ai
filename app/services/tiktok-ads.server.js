const TIKTOK_PLATFORM = "TikTok Ads";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${TIKTOK_PLATFORM} is not configured yet: ${name} is missing.`);
  }
  return value;
}

export function createTikTokAuthUrl({ state }) {
  const authorizationUrl = new URL(requireEnv("TIKTOK_ADS_AUTH_URL"));
  authorizationUrl.searchParams.set(
    "client_key",
    requireEnv("TIKTOK_ADS_CLIENT_KEY"),
  );
  authorizationUrl.searchParams.set(
    "redirect_uri",
    requireEnv("TIKTOK_ADS_REDIRECT_URI"),
  );
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("response_type", "code");

  return authorizationUrl.toString();
}

export async function exchangeTikTokCodeForToken({ code }) {
  const tokenUrl = requireEnv("TIKTOK_ADS_TOKEN_URL");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: requireEnv("TIKTOK_ADS_CLIENT_KEY"),
      secret: requireEnv("TIKTOK_ADS_CLIENT_SECRET"),
      auth_code: code,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.code || !payload.data?.access_token) {
    throw new Error(
      payload.message ||
        `${TIKTOK_PLATFORM} token exchange failed with status ${response.status}.`,
    );
  }

  return {
    accessToken: payload.data.access_token,
    refreshToken: payload.data.refresh_token || null,
    expiresIn: payload.data.expires_in || null,
    scopes: payload.data.scope || null,
    raw: payload.data,
  };
}

export async function fetchTikTokAdvertiserAccounts({ accessToken } = {}) {
  requireEnv("TIKTOK_ADS_CLIENT_KEY");
  if (!accessToken) throw new Error("A TikTok Ads access token is required.");
  throw new Error(
    "TikTok Ads advertiser account discovery is not configured yet.",
  );
}

export async function fetchTikTokDailyAdPerformance({ accessToken } = {}) {
  requireEnv("TIKTOK_ADS_CLIENT_KEY");
  if (!accessToken) throw new Error("A TikTok Ads access token is required.");
  throw new Error("TikTok Ads performance sync is not configured yet.");
}
