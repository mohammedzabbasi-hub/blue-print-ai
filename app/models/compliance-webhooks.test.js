import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  "webhooks.app.uninstalled.jsx",
  "webhooks.customers.data_request.jsx",
  "webhooks.customers.redact.jsx",
  "webhooks.shop.redact.jsx",
];

test("mandatory compliance routes delegate HMAC verification to Shopify", async () => {
  for (const route of routes) {
    const source = await readFile(
      new URL(`../routes/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /authenticate\.webhook\(request\)/, route);
    assert.match(source, /return new Response\(\)/, route);
  }
});

test("Shopify config subscribes to all mandatory compliance topics", async () => {
  const config = await readFile(
    new URL("../../shopify.app.toml", import.meta.url),
    "utf8",
  );
  for (const topic of ["customers/data_request", "customers/redact", "shop/redact"]) {
    assert.match(config, new RegExp(topic.replace("/", "\\/")));
  }
  assert.match(config, /topics\s*=\s*\[\s*"app\/uninstalled"\s*\]/);
  assert.match(config, /api_version\s*=\s*"2026-04"/);
});

test("shop data cleanup routes delete shop-scoped workspace data and sessions", async () => {
  for (const route of ["webhooks.app.uninstalled.jsx", "webhooks.shop.redact.jsx"]) {
    const source = await readFile(
      new URL(`../routes/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /deleteWorkspaceData\(shop\)/, route);
    assert.match(source, /session\.deleteMany\(\{\s*where:\s*\{\s*shop\s*\}/s, route);
  }
});
