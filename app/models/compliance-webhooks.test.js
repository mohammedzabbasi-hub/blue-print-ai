import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseTOML } from "confbox/toml";
import db from "../db.server.js";

process.env.SHOPIFY_API_KEY ||= "compliance-test-api-key";
process.env.SHOPIFY_API_SECRET ||= "compliance-test-api-secret";
process.env.SHOPIFY_APP_URL ||= "https://app.example";

const {
  COMPLIANCE_TOPICS,
  createComplianceAction,
} = await import("./compliance-webhook.server.js");
const {
  action: complianceAction,
  loader: complianceLoader,
} = await import("../routes/webhooks.compliance.js");

const legacyRoutes = [
  "webhooks.app.uninstalled.jsx",
  "webhooks.customers.data_request.jsx",
  "webhooks.customers.redact.jsx",
  "webhooks.shop.redact.jsx",
];

test("Shopify config parses and subscribes the unified compliance endpoint", async () => {
  const source = await readFile(
    new URL("../../shopify.app.toml", import.meta.url),
    "utf8",
  );
  const config = parseTOML(source);
  const subscriptions = config.webhooks.subscriptions;
  const compliance = subscriptions.find(
    (subscription) => subscription.uri === "/webhooks/compliance",
  );

  assert.equal(config.webhooks.api_version, "2026-04");
  assert.deepEqual(compliance?.compliance_topics, [
    "customers/data_request",
    "customers/redact",
    "shop/redact",
  ]);
  assert.ok(
    subscriptions.some(
      (subscription) =>
        subscription.uri === "/webhooks/app/uninstalled" &&
        subscription.topics?.includes("app/uninstalled"),
    ),
  );
});

test("valid customer compliance topics authenticate before acknowledging", async () => {
  for (const topic of [
    COMPLIANCE_TOPICS.CUSTOMERS_DATA_REQUEST,
    COMPLIANCE_TOPICS.CUSTOMERS_REDACT,
  ]) {
    let workspaceDeletes = 0;
    let sessionDeletes = 0;
    const request = new Request("https://app.example/webhooks/compliance", {
      method: "POST",
      body: JSON.stringify({ customer: { id: 123 } }),
    });
    const action = createComplianceAction({
      authenticateWebhook: async (authenticatedRequest) => {
        assert.equal(authenticatedRequest, request);
        assert.equal(authenticatedRequest.bodyUsed, false);
        await authenticatedRequest.text();
        return { shop: "privacy-test.myshopify.com", topic };
      },
      deleteShopWorkspace: async () => {
        workspaceDeletes += 1;
      },
      deleteShopSessions: async () => {
        sessionDeletes += 1;
      },
    });

    const response = await action({ request });

    assert.equal(response.status, 204);
    assert.equal(workspaceDeletes, 0);
    assert.equal(sessionDeletes, 0);
  }
});

test("invalid and missing HMAC failures cannot execute shop deletion", async () => {
  for (const headers of [
    { "x-shopify-hmac-sha256": "invalid" },
    {},
  ]) {
    let deletionCalls = 0;
    const action = createComplianceAction({
      authenticateWebhook: async () => {
        throw new Response(null, { status: 401 });
      },
      deleteShopWorkspace: async () => {
        deletionCalls += 1;
      },
      deleteShopSessions: async () => {
        deletionCalls += 1;
      },
    });
    const request = new Request("https://app.example/webhooks/compliance", {
      method: "POST",
      headers,
      body: "{}",
    });

    await assert.rejects(
      action({ request }),
      (error) => error instanceof Response && error.status === 401,
    );
    assert.equal(deletionCalls, 0);
  }
});

test("the production authentication boundary rejects missing HMAC", async () => {
  const request = new Request("https://app.example/webhooks/compliance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-api-version": "2026-04",
      "x-shopify-shop-domain": "unauthenticated.myshopify.com",
      "x-shopify-topic": "shop/redact",
      "x-shopify-webhook-id": "missing-hmac-test",
    },
    body: JSON.stringify({ shop_domain: "unauthenticated.myshopify.com" }),
  });

  await assert.rejects(
    complianceAction({ request }),
    (error) => error instanceof Response && error.status === 401,
  );
});

test("the production authentication boundary rejects invalid HMAC", async () => {
  const request = new Request("https://app.example/webhooks/compliance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-api-version": "2026-04",
      "x-shopify-hmac-sha256": "not-a-valid-signature",
      "x-shopify-shop-domain": "unauthenticated.myshopify.com",
      "x-shopify-topic": "shop/redact",
      "x-shopify-webhook-id": "invalid-hmac-test",
    },
    body: JSON.stringify({ shop_domain: "unauthenticated.myshopify.com" }),
  });

  await assert.rejects(
    complianceAction({ request }),
    (error) => error instanceof Response && error.status === 401,
  );
});

test("unsupported and malformed deliveries do not bypass authentication", async () => {
  let authenticated = false;
  let deletionCalls = 0;
  const unsupported = createComplianceAction({
    authenticateWebhook: async () => {
      authenticated = true;
      return { shop: "unsupported.myshopify.com", topic: "PRODUCTS_UPDATE" };
    },
    deleteShopWorkspace: async () => {
      deletionCalls += 1;
    },
    deleteShopSessions: async () => {
      deletionCalls += 1;
    },
  });

  const response = await unsupported({
    request: new Request("https://app.example/webhooks/compliance", {
      method: "POST",
      body: "{}",
    }),
  });
  assert.equal(authenticated, true);
  assert.equal(response.status, 400);
  assert.equal(deletionCalls, 0);

  const malformed = createComplianceAction({
    authenticateWebhook: async () => {
      throw new Response(null, { status: 400 });
    },
    deleteShopWorkspace: async () => {
      deletionCalls += 1;
    },
    deleteShopSessions: async () => {
      deletionCalls += 1;
    },
  });
  await assert.rejects(
    malformed({
      request: new Request("https://app.example/webhooks/compliance", {
        method: "POST",
        headers: { "x-shopify-hmac-sha256": "present" },
        body: "not-json",
      }),
    }),
    (error) => error instanceof Response && error.status === 400,
  );
  assert.equal(deletionCalls, 0);
});

test("SHOP_REDACT is repeatable and deletes only the authenticated shop", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const shop = `compliance-${suffix}.myshopify.com`;
  const otherShop = `compliance-other-${suffix}.myshopify.com`;
  const targetSession = `compliance-session-${suffix}`;
  const otherSession = `compliance-other-session-${suffix}`;

  await db.$transaction([
    db.workspaceSetting.create({
      data: { shop, key: "compliance-test", value: "delete" },
    }),
    db.workspaceSetting.create({
      data: { shop: otherShop, key: "compliance-test", value: "preserve" },
    }),
    db.session.create({
      data: {
        id: targetSession,
        shop,
        state: "test",
        accessToken: "test-token",
      },
    }),
    db.session.create({
      data: {
        id: otherSession,
        shop: otherShop,
        state: "test",
        accessToken: "test-token",
      },
    }),
  ]);

  try {
    const action = createComplianceAction({
      authenticateWebhook: async (request) => {
        assert.equal(request.bodyUsed, false);
        await request.text();
        return { shop, topic: COMPLIANCE_TOPICS.SHOP_REDACT };
      },
    });

    for (let delivery = 0; delivery < 2; delivery += 1) {
      const response = await action({
        request: new Request("https://app.example/webhooks/compliance", {
          method: "POST",
          body: JSON.stringify({ shop_domain: shop }),
        }),
      });
      assert.equal(response.status, 204);
    }

    assert.equal(await db.workspaceSetting.count({ where: { shop } }), 0);
    assert.equal(await db.session.count({ where: { shop } }), 0);
    assert.equal(await db.workspaceSetting.count({ where: { shop: otherShop } }), 1);
    assert.equal(await db.session.count({ where: { shop: otherShop } }), 1);
  } finally {
    await db.workspaceSetting.deleteMany({ where: { shop: { in: [shop, otherShop] } } });
    await db.session.deleteMany({ where: { shop: { in: [shop, otherShop] } } });
  }
});

test("GET is not accepted as a compliance delivery", async () => {
  const response = complianceLoader();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("existing webhook routes retain Shopify authentication", async () => {
  for (const route of legacyRoutes) {
    const source = await readFile(
      new URL(`../routes/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /authenticate\.webhook\(request\)/, route);
    assert.match(source, /return new Response\(\)/, route);
  }
});
