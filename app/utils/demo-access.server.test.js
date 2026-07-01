import assert from "node:assert/strict";
import test from "node:test";

import { getLocalDemoAccess } from "./demo-access.server.js";

test("production never permits query or environment auth bypass", () => {
  const env = { NODE_ENV: "production", DEV_BYPASS_SHOPIFY_AUTH: "true" };
  for (const url of [
    "https://blueprintai.app/app?demo=1",
    "http://localhost/app?demo=1",
    "http://127.0.0.1/app",
  ]) {
    assert.deepEqual(getLocalDemoAccess(new Request(url), env), {
      explicitDemoMode: false,
      useDemoWorkspace: false,
    });
  }
});

test("development bypass is limited to local hosts", () => {
  const env = { NODE_ENV: "development", DEV_BYPASS_SHOPIFY_AUTH: "true" };
  assert.equal(
    getLocalDemoAccess(new Request("https://blueprintai.app/app?demo=1"), env)
      .useDemoWorkspace,
    false,
  );
  assert.equal(
    getLocalDemoAccess(new Request("http://localhost/app?demo=1"), env)
      .useDemoWorkspace,
    true,
  );
});
