import assert from "node:assert/strict";
import test from "node:test";

import {
  connectionsRedirect,
  redirectOrRecover,
} from "./google-ads-oauth-redirect.server.js";

function assertEmbeddedConnectionsTarget(target) {
  const url = new URL(target, "https://blueprintai.local");
  assert.equal(url.pathname, "/app/connections");
  assert.equal(url.searchParams.get("googleAds"), "connected");
  assert.equal(url.searchParams.get("shop"), "store.myshopify.com");
  assert.equal(url.searchParams.get("host"), "encoded-host");
  assert.equal(url.searchParams.get("embedded"), "1");
  assert.doesNotMatch(target, /^https?:\/\//);
}

test("Google Ads callback redirects to embedded Connections with Shopify params", () => {
  const target = connectionsRedirect(
    {
      host: "encoded-host",
      returnSearch: "?shop=store.myshopify.com&host=encoded-host&embedded=1",
      returnTo: "/app/connections",
      shop: "store.myshopify.com",
    },
    { googleAds: "connected" },
  );

  assertEmbeddedConnectionsTarget(target);
});

test("Google Ads callback does not redirect to external arbitrary URLs", () => {
  const target = connectionsRedirect(
    {
      host: "encoded-host",
      returnSearch: "?shop=store.myshopify.com&host=encoded-host&embedded=1",
      returnTo: "https://evil.example/steal",
      shop: "store.myshopify.com",
    },
    { googleAds: "connected" },
  );

  assertEmbeddedConnectionsTarget(target);
});

test("Google Ads callback missing host renders recovery instead of blank page", async () => {
  const response = redirectOrRecover(
    {
      host: "",
      returnSearch: "?shop=store.myshopify.com",
      returnTo: "/app/connections",
      shop: "store.myshopify.com",
    },
    { googleAds: "connected" },
    "blueprint_google_ads_oauth=; Max-Age=0",
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Google Ads connected\./);
  assert.match(body, /Return to Connections/);
  assert.match(body, /\/app\/connections\?googleAds=connected&amp;shop=store\.myshopify\.com/);
});
