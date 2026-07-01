import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeExpectations = [
  ["privacy.jsx", /pageId="privacy"/],
  ["terms.jsx", /pageId="terms"/],
  ["support.jsx", /SupportRoute/],
  ["contact.jsx", /pageId="contact"/],
  ["data-deletion.jsx", /pageId="data-deletion"/],
  ["app.privacy.jsx", /pageId="privacy"/],
  ["app.terms.jsx", /pageId="terms"/],
  ["app.support.jsx", /AppSupportRoute/],
  ["app.contact.jsx", /pageId="contact"/],
  ["app.data-deletion.jsx", /pageId="data-deletion"/],
];

test("legal and support route modules exist and render their expected pages", async () => {
  for (const [route, expected] of routeExpectations) {
    const source = await readFile(
      new URL(`../routes/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(source, expected, route);
    assert.match(source, /export default function/, route);
  }
});

test("public navigation links every review-required page", async () => {
  const [landing, legalLayout] = await Promise.all([
    readFile(new URL("../routes/_index/route.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/legal/LegalLayout.jsx", import.meta.url), "utf8"),
  ]);

  for (const path of ["/privacy", "/terms", "/support", "/data-deletion"]) {
    assert.match(`${landing}\n${legalLayout}`, new RegExp(path), path);
  }
});
