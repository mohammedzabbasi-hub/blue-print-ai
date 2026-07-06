import { OAuth2Client } from "google-auth-library";

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_API_VERSION = "v24";

function requireConfiguration(name, message) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(message || `${name} is not configured.`);
  return value;
}

export function getGoogleAdsOAuthConfig(env = process.env) {
  const clientId = env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (!clientId) {
    throw new Error("Google Ads OAuth is not configured: GOOGLE_ADS_CLIENT_ID is missing.");
  }
  if (!clientSecret) {
    throw new Error(
      "Google Ads OAuth is not configured: GOOGLE_ADS_CLIENT_SECRET is missing.",
    );
  }
  return { clientId, clientSecret };
}

export function getGoogleAdsIntegrationStatus(env = process.env) {
  const required = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_REDIRECT_URI",
  ];
  const missing = required.filter((name) => !env[name]?.trim());
  const encryptionConfigured = Boolean(
    env.GOOGLE_ADS_ENCRYPTION_SECRET?.trim() ||
      env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY?.trim(),
  );
  if (!encryptionConfigured) missing.push("GOOGLE_ADS_ENCRYPTION_SECRET");
  return { ok: missing.length === 0, missing };
}

export function buildGoogleOAuthUrl({ redirectUri, state }, env = process.env) {
  try {
    const { clientId, clientSecret } = getGoogleAdsOAuthConfig(env);
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    return {
      ok: true,
      url: client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        scope: [GOOGLE_ADS_SCOPE],
        state,
      }),
    };
  } catch (error) {
    return { ok: false, code: "configuration_error", message: error.message };
  }
}

function apiVersion() {
  const configured = process.env.GOOGLE_ADS_API_VERSION?.trim();
  return configured && /^v\d+$/.test(configured)
    ? configured
    : DEFAULT_API_VERSION;
}

export function normalizeCustomerId(value) {
  const normalized = String(value || "").replace(/\D/g, "");
  if (!normalized) throw new Error("A Google Ads customer ID is required.");
  return normalized;
}

export async function exchangeGoogleAdsCode({ code, redirectUri }) {
  const { clientId, clientSecret } = getGoogleAdsOAuthConfig();
  const oauthClient = new OAuth2Client(
    clientId,
    clientSecret,
    redirectUri,
  );
  const { tokens } = await oauthClient.getToken(code);
  return tokens;
}

export async function exchangeGoogleAdsCodeForTokens(options) {
  try {
    const tokens = await exchangeGoogleAdsCode(options);
    if (!tokens.refresh_token) {
      return {
        ok: false,
        code: "missing_refresh_token",
        message: "Google did not return a refresh token. Remove the prior BluePrintAI grant in your Google Account and connect again.",
      };
    }
    return { ok: true, tokens };
  } catch (error) {
    return { ok: false, code: "token_exchange_failed", message: error.message };
  }
}

export async function getGoogleAdsAccessToken(refreshToken) {
  if (!refreshToken) throw new Error("The Google Ads refresh token is missing.");

  const { clientId, clientSecret } = getGoogleAdsOAuthConfig();
  const oauthClient = new OAuth2Client(
    clientId,
    clientSecret,
  );
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const result = await oauthClient.getAccessToken();
  const accessToken = typeof result === "string" ? result : result?.token;

  if (!accessToken) {
    throw new Error("Google Ads authorization could not be refreshed.");
  }

  return accessToken;
}

export async function refreshGoogleAdsAccessToken(refreshToken) {
  try {
    return { ok: true, accessToken: await getGoogleAdsAccessToken(refreshToken) };
  } catch (error) {
    return { ok: false, code: "token_refresh_failed", message: error.message };
  }
}

function googleAdsHeaders(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": requireConfiguration(
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "Google Ads developer token not configured",
    ),
  };
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  if (loginCustomerId) {
    headers["login-customer-id"] = normalizeCustomerId(loginCustomerId);
  }
  return headers;
}

async function googleAdsRequest(path, { accessToken, body, method = "GET" }) {
  const response = await fetch(
    `https://googleads.googleapis.com/${apiVersion()}${path}`,
    {
      method,
      headers: googleAdsHeaders(accessToken),
      signal: AbortSignal.timeout(20_000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const rawPayload = await response.text();
  let payload = {};
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const apiMessage =
      payload?.error?.details?.[0]?.errors?.[0]?.message ||
      payload?.error?.message;
    const requestId = response.headers.get("request-id");

    // Never log the response body: Google may include request details or
    // credential-adjacent diagnostic data in error payloads.
    console.error("Google Ads API request failed", {
      status: response.status,
      requestId,
      path,
      message: apiMessage,
    });

    throw new Error(
      `${apiMessage || `Google Ads API request failed (${response.status}).`}${
        requestId ? ` Request ID: ${requestId}` : ""
      }`,
    );
  }

  return payload;
}

export async function fetchAccessibleGoogleAdsCustomers({ accessToken }) {
  const payload = await googleAdsRequest("/customers:listAccessibleCustomers", {
    accessToken,
  });

  return (payload.resourceNames || []).map((resourceName) => ({
    customerId: normalizeCustomerId(resourceName),
    resourceName,
  }));
}

export async function listAccessibleCustomers(options) {
  try {
    return { ok: true, customers: await fetchAccessibleGoogleAdsCustomers(options) };
  } catch (error) {
    return { ok: false, code: "account_discovery_failed", message: error.message };
  }
}

async function searchGoogleAds({ accessToken, customerId, query }) {
  const payload = await googleAdsRequest(
    `/customers/${normalizeCustomerId(customerId)}/googleAds:searchStream`,
    { accessToken, body: { query }, method: "POST" },
  );

  return (Array.isArray(payload) ? payload : [payload]).flatMap(
    (batch) => batch?.results || [],
  );
}

export async function fetchGoogleAdsCampaigns({ accessToken, customerId }) {
  const rows = await searchGoogleAds({
    accessToken,
    customerId,
    query: `SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type
    FROM campaign
    ORDER BY campaign.name`,
  });
  return rows.map(({ campaign = {} }) => ({
    campaignId: String(campaign.id || ""),
    campaignName: campaign.name || "",
    campaignStatus: campaign.status || null,
    advertisingChannelType: campaign.advertisingChannelType || null,
  }));
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeGoogleAdsMetricRow(row = {}, level = "campaign") {
  const metrics = row.metrics || {};
  const campaign = row.campaign || {};
  const adGroup = row.adGroup || {};
  const ad = row.adGroupAd?.ad || {};
  const impressions = number(metrics.impressions);
  const clicks = number(metrics.clicks);
  const cost = number(metrics.costMicros) / 1_000_000;
  const conversions = number(metrics.conversions);
  const conversionValue = number(metrics.conversionsValue);
  const ctr = impressions ? clicks / impressions : 0;
  const cpc = clicks ? cost / clicks : 0;
  const cpm = impressions ? (cost / impressions) * 1_000 : 0;
  const conversionRate = clicks ? conversions / clicks : 0;
  const cpa = conversions ? cost / conversions : 0;

  return {
    campaignId: String(campaign.id || ""),
    campaignName: campaign.name || "",
    campaignStatus: campaign.status || null,
    adGroupId: level === "campaign" ? null : String(adGroup.id || ""),
    adGroupName: level === "campaign" ? null : adGroup.name || "",
    adId: level === "ad" ? String(ad.id || "") : null,
    adName: level === "ad" ? ad.name || "" : null,
    date: row.segments?.date || null,
    impressions,
    clicks,
    cost,
    spend: cost,
    conversions,
    conversionValue,
    revenue: conversionValue,
    // Google Ads rate fields are decimal ratios. Keep ratios in the service;
    // UI adapters convert them to percentages where required.
    ctr: number(metrics.ctr) || ctr,
    cpc: number(metrics.averageCpc) / 1_000_000 || cpc,
    cpm,
    conversionRate,
    cpa,
    roas: cost ? conversionValue / cost : 0,
  };
}

const METRICS = `
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.ctr,
  metrics.average_cpc`;

export function googleAdsCampaignFilter(campaignIds) {
  if (campaignIds == null) return "";
  const normalized = [...new Set(campaignIds.map((id) => normalizeCustomerId(id)))];
  if (!normalized.length) throw new Error("Select at least one campaign before syncing.");
  return `\n        AND campaign.id IN (${normalized.join(", ")})`;
}

export async function fetchGoogleAdsCampaignMetrics({
  accessToken,
  customerId,
  startDate,
  endDate,
  campaignIds,
}) {
  const rows = await searchGoogleAds({
    accessToken,
    customerId,
    query: `SELECT campaign.id, campaign.name, campaign.status, ${METRICS}
      FROM campaign
      WHERE segments.date BETWEEN '${dateOnly(startDate)}' AND '${dateOnly(endDate)}'
        AND campaign.status != 'REMOVED'${googleAdsCampaignFilter(campaignIds)}
      ORDER BY segments.date DESC`,
  });
  return rows.map((row) => normalizeGoogleAdsMetricRow(row, "campaign"));
}

export async function fetchGoogleAdsAdGroupMetrics(options) {
  const rows = await searchGoogleAds({
    ...options,
    query: `SELECT campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name, ${METRICS}
      FROM ad_group
      WHERE segments.date BETWEEN '${dateOnly(options.startDate)}' AND '${dateOnly(options.endDate)}'
        AND ad_group.status != 'REMOVED'
      ORDER BY segments.date DESC`,
  });
  return rows.map((row) => normalizeGoogleAdsMetricRow(row, "adGroup"));
}

export async function fetchGoogleAdsAdMetrics(options) {
  const rows = await searchGoogleAds({
    ...options,
    query: `SELECT campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name,
        ad_group_ad.ad.id, ad_group_ad.ad.name, ${METRICS}
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${dateOnly(options.startDate)}' AND '${dateOnly(options.endDate)}'
        AND ad_group_ad.status != 'REMOVED'${googleAdsCampaignFilter(options.campaignIds)}
      ORDER BY segments.date DESC`,
  });
  return rows.map((row) => normalizeGoogleAdsMetricRow(row, "ad"));
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid reporting date is required.");
  return date.toISOString().slice(0, 10);
}

export async function revokeGoogleAdsToken(token) {
  if (!token) return false;
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Google Ads authorization could not be revoked.");
  return true;
}
