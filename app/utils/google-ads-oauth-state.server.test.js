import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoogleAdsOAuthState,
  validateGoogleAdsOAuthState,
} from "./google-ads-oauth-state.server.js";

test("Google Ads OAuth state cookie binds the callback to a shop", async () => {
  const previous = process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
  process.env.AD_PLATFORM_OAUTH_STATE_SECRET = "test-only-state-secret";
  try {
    const request = new Request(
      "https://example.test/auth/google-ads?shop=store.myshopify.com&host=abc",
    );
    const created = await createGoogleAdsOAuthState({
      request,
      shop: "store.myshopify.com",
    });
    const callbackRequest = new Request(
      `https://example.test/auth/google-ads/callback?state=${created.state}`,
      { headers: { Cookie: created.cookieHeader.split(";", 1)[0] } },
    );
    const validated = await validateGoogleAdsOAuthState(
      callbackRequest,
      created.state,
    );

    assert.equal(validated.shop, "store.myshopify.com");
    assert.match(validated.returnSearch, /shop=store\.myshopify\.com/);
  } finally {
    if (previous === undefined) delete process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
    else process.env.AD_PLATFORM_OAUTH_STATE_SECRET = previous;
  }
});

test("Google Ads OAuth state stores embedded host and internal return target", async () => {
  const previous = process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
  process.env.AD_PLATFORM_OAUTH_STATE_SECRET = "test-only-state-secret";
  try {
    const request = new Request(
      "https://example.test/auth/google-ads/start?shop=store.myshopify.com&host=encoded-host&embedded=1&returnTo=%2Fapp%2Fconnections",
    );
    const created = await createGoogleAdsOAuthState({
      request,
      shop: "store.myshopify.com",
    });
    const callbackRequest = new Request(
      `https://example.test/auth/google-ads/callback?state=${created.state}`,
      { headers: { Cookie: created.cookieHeader.split(";", 1)[0] } },
    );
    const validated = await validateGoogleAdsOAuthState(
      callbackRequest,
      created.state,
    );

    assert.equal(created.context.host, "encoded-host");
    assert.equal(validated.host, "encoded-host");
    assert.equal(validated.embedded, "1");
    assert.equal(validated.returnTo, "/app/connections");
    assert.equal(
      validated.returnSearch,
      "?embedded=1&host=encoded-host&shop=store.myshopify.com",
    );
  } finally {
    if (previous === undefined) delete process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
    else process.env.AD_PLATFORM_OAUTH_STATE_SECRET = previous;
  }
});

test("Google Ads OAuth state refuses external return targets", async () => {
  const previous = process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
  process.env.AD_PLATFORM_OAUTH_STATE_SECRET = "test-only-state-secret";
  try {
    const request = new Request(
      "https://example.test/auth/google-ads/start?shop=store.myshopify.com&host=encoded-host&embedded=1&returnTo=https%3A%2F%2Fevil.example%2Fsteal",
    );
    const created = await createGoogleAdsOAuthState({
      request,
      shop: "store.myshopify.com",
    });
    const callbackRequest = new Request(
      `https://example.test/auth/google-ads/callback?state=${created.state}`,
      { headers: { Cookie: created.cookieHeader.split(";", 1)[0] } },
    );
    const validated = await validateGoogleAdsOAuthState(
      callbackRequest,
      created.state,
    );

    assert.equal(validated.returnTo, "/app/connections");
  } finally {
    if (previous === undefined) delete process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
    else process.env.AD_PLATFORM_OAUTH_STATE_SECRET = previous;
  }
});

test("Google Ads OAuth state rejects a mismatched callback", async () => {
  const previous = process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
  process.env.AD_PLATFORM_OAUTH_STATE_SECRET = "test-only-state-secret";
  try {
    const request = new Request("https://example.test/auth/google-ads");
    const created = await createGoogleAdsOAuthState({
      request,
      shop: "store.myshopify.com",
    });
    const callbackRequest = new Request(
      "https://example.test/auth/google-ads/callback?state=wrong",
      { headers: { Cookie: created.cookieHeader.split(";", 1)[0] } },
    );
    await assert.rejects(
      validateGoogleAdsOAuthState(callbackRequest, "wrong"),
      /invalid or has expired/,
    );
  } finally {
    if (previous === undefined) delete process.env.AD_PLATFORM_OAUTH_STATE_SECRET;
    else process.env.AD_PLATFORM_OAUTH_STATE_SECRET = previous;
  }
});
