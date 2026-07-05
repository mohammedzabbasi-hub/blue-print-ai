import assert from "node:assert/strict";
import test from "node:test";

import { buildIntegrationStatuses } from "../models/creative-performance.server.js";
import {
  fetchAccessibleGoogleAdsCustomers,
  fetchGoogleAdsCampaignMetrics,
  getGoogleAdsIntegrationStatus,
  getGoogleAdsOAuthConfig,
  normalizeGoogleAdsMetricRow,
} from "./google-ads.server.js";
import {
  getGoogleAdsRedirectUri,
  getPublicOrigin,
} from "../utils/google-ads-oauth-state.server.js";

test("Google Ads public origin uses forwarded HTTPS headers", () => {
  const request = new Request("http://127.0.0.1:3000/auth/google-ads", {
    headers: {
      "x-forwarded-host": "sturdily-coyness-surround.ngrok-free.dev",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(
    getPublicOrigin(request, {}),
    "https://sturdily-coyness-surround.ngrok-free.dev",
  );
});

test("Google Ads public origin prefers SHOPIFY_DEV_TUNNEL_URL", () => {
  const request = new Request("http://127.0.0.1:3000/auth/google-ads", {
    headers: {
      "x-forwarded-host": "ignored.example.test",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(
    getPublicOrigin(request, {
      SHOPIFY_DEV_TUNNEL_URL:
        "https://sturdily-coyness-surround.ngrok-free.dev",
    }),
    "https://sturdily-coyness-surround.ngrok-free.dev",
  );
});

test("Google Ads public origin falls back to the request origin", () => {
  const request = new Request("http://localhost:3000/auth/google-ads?shop=x");

  assert.equal(getPublicOrigin(request, {}), "http://localhost:3000");
});

test("Google Ads redirect URI promotes an internal HTTP ngrok URL to HTTPS", () => {
  const request = new Request(
    "http://sturdily-coyness-surround.ngrok-free.dev/auth/google-ads?shop=x",
  );

  assert.equal(
    getGoogleAdsRedirectUri(request, {}),
    "https://sturdily-coyness-surround.ngrok-free.dev/auth/google-ads/callback",
  );
});

test("Google Ads OAuth config reports missing environment safely", () => {
  assert.throws(
    () => getGoogleAdsOAuthConfig({}),
    /GOOGLE_ADS_CLIENT_ID is missing/,
  );
  assert.throws(
    () => getGoogleAdsOAuthConfig({ GOOGLE_ADS_CLIENT_ID: "client" }),
    /GOOGLE_ADS_CLIENT_SECRET is missing/,
  );
});

test("Google Ads rows normalize micros and calculated metrics", () => {
  assert.deepEqual(
    normalizeGoogleAdsMetricRow({
      campaign: { id: "42", name: "Launch" },
      segments: { date: "2026-06-28" },
      metrics: {
        clicks: "25",
        conversions: 3,
        conversionsValue: 150,
        costMicros: "50000000",
        impressions: "1000",
      },
    }),
    {
      adGroupId: null,
      adGroupName: null,
      adId: null,
      adName: null,
      campaignId: "42",
      campaignName: "Launch",
      campaignStatus: null,
      clicks: 25,
      conversions: 3,
      conversionValue: 150,
      conversionRate: 0.12,
      cost: 50,
      cpa: 16.666666666666668,
      cpc: 2,
      cpm: 50,
      ctr: 0.025,
      date: "2026-06-28",
      impressions: 1000,
      revenue: 150,
      roas: 3,
      spend: 50,
    },
  );
});

test("Google Ads metric formulas protect zero denominators", () => {
  const row = normalizeGoogleAdsMetricRow({
    metrics: { impressions: 0, clicks: 0, conversions: 0, costMicros: 0 },
  });
  assert.equal(row.ctr, 0);
  assert.equal(row.cpc, 0);
  assert.equal(row.cpm, 0);
  assert.equal(row.conversionRate, 0);
  assert.equal(row.cpa, 0);
  assert.equal(row.roas, 0);
});

test("Google Ads search uses the selected child customer and accepts zero rows", async () => {
  const previousFetch = global.fetch;
  const previousToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer-test-value";
  let requestedUrl = "";
  let requestedBody = "";
  global.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedBody = String(options.body);
    return new Response(JSON.stringify([{ results: [] }]), { status: 200 });
  };
  try {
    const rows = await fetchGoogleAdsCampaignMetrics({
      accessToken: "access-test-value",
      customerId: "304-963-7762",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    assert.deepEqual(rows, []);
    assert.match(requestedUrl, /customers\/3049637762\/googleAds:searchStream$/);
    assert.match(requestedBody, /FROM campaign/);
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = previousToken;
  }
});

test("Google Ads errors log sanitized metadata without response bodies or secrets", async () => {
  const previousFetch = global.fetch;
  const previousError = console.error;
  const previousToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer-secret-value";
  const logged = [];
  console.error = (...args) => logged.push(args);
  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "safe summary", secret: "raw-secret" } }), {
      status: 400,
      headers: { "request-id": "request-123" },
    });
  try {
    await assert.rejects(
      fetchGoogleAdsCampaignMetrics({
        accessToken: "access-secret-value",
        customerId: "3049637762",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      }),
      /safe summary/,
    );
    const serialized = JSON.stringify(logged);
    assert.doesNotMatch(serialized, /raw-secret|access-secret|developer-secret/);
    assert.match(serialized, /request-123/);
  } finally {
    global.fetch = previousFetch;
    console.error = previousError;
    if (previousToken === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = previousToken;
  }
});

test("missing developer token fails without making an API request", async () => {
  const previous = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  try {
    await assert.rejects(
      fetchAccessibleGoogleAdsCustomers({ accessToken: "not-a-real-token" }),
      /Google Ads developer token not configured/,
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = previous;
  }
});

test("Google Ads integration status lists missing setup without credentials", () => {
  const status = getGoogleAdsIntegrationStatus({});
  assert.equal(status.ok, false);
  assert.deepEqual(status.missing, [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_REDIRECT_URI",
    "GOOGLE_ADS_ENCRYPTION_SECRET",
  ]);
});

test("Google Ads integration accepts the existing shared encryption key", () => {
  assert.deepEqual(
    getGoogleAdsIntegrationStatus({
      GOOGLE_ADS_CLIENT_ID: "client",
      GOOGLE_ADS_CLIENT_SECRET: "secret",
      GOOGLE_ADS_DEVELOPER_TOKEN: "developer",
      GOOGLE_ADS_REDIRECT_URI: "https://app.example.test/auth/google-ads/callback",
      AD_PLATFORM_TOKEN_ENCRYPTION_KEY: "shared",
    }),
    { ok: true, missing: [] },
  );
});

test("Google Ads connection status is additive", () => {
  const statuses = buildIntegrationStatuses({
    connectedPlatforms: ["google"],
    hasShopifyProducts: true,
  });
  assert.equal(statuses.find(({ id }) => id === "google_ads").tone, "connected");
  assert.equal(statuses.find(({ id }) => id === "manual_uploads").tone, "available");
});
