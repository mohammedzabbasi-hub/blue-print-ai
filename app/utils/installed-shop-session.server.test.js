import assert from "node:assert/strict";
import test from "node:test";

import {
  hasInstalledShopifySession,
  normalizeShopDomain,
} from "./installed-shop-session.server.js";

test("Shopify shop domains are normalized and validated", () => {
  assert.equal(
    normalizeShopDomain(" BluePrintAI-Test-Store.MyShopify.com "),
    "blueprintai-test-store.myshopify.com",
  );
  assert.equal(normalizeShopDomain("example.com"), null);
  assert.equal(normalizeShopDomain("blueprintai.myshopify.com.evil.test"), null);
  assert.equal(normalizeShopDomain(""), null);
});

test("Google OAuth launch requires an installed offline Shopify session", async () => {
  const shop = "blueprintai-test-store.myshopify.com";
  const sessionStore = {
    async findSessionsByShop(requestedShop) {
      assert.equal(requestedShop, shop);
      return [
        { accessToken: "online-token", isOnline: true, shop },
        { accessToken: "offline-token", isOnline: false, shop },
      ];
    },
  };

  assert.equal(
    await hasInstalledShopifySession(sessionStore, shop),
    true,
  );
});

test("Google OAuth launch rejects a shop without an offline session", async () => {
  const shop = "blueprintai-test-store.myshopify.com";
  const sessionStore = {
    async findSessionsByShop() {
      return [{ accessToken: "online-token", isOnline: true, shop }];
    },
  };

  assert.equal(
    await hasInstalledShopifySession(sessionStore, shop),
    false,
  );
});
