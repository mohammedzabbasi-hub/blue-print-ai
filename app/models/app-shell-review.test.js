import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production free workspaces keep the Shopify AppProvider boundary", async () => {
  const source = await readFile(
    new URL("../routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /skipAppProvider: true/);
  assert.match(source, /skipAppProvider: false/);
  assert.match(source, /if \(billingStatus\.skipAppProvider\)/);
  assert.doesNotMatch(source, /if \(billingStatus\.bypassed\)/);
  assert.match(source, /<AppProvider embedded apiKey=\{apiKey\}>/);
});
