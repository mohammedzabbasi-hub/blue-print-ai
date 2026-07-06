import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BUSINESS_DETAILS, legalPages, supportSentence } from "../content/legal.js";

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

test("legal pages use the approved operator and safe support contact", () => {
  assert.equal(BUSINESS_DETAILS.companyName, "BluePrintAI Commerce");
  assert.equal(BUSINESS_DETAILS.supportEmail, "support@blueprintai.app");
  assert.match(supportSentence, /support@blueprintai\.app/);
  assert.match(supportSentence, /OAuth codes/);
  assert.match(supportSentence, /refresh tokens/);
  assert.match(supportSentence, /developer tokens/);
  assert.match(supportSentence, /private ad-account credentials/);

  for (const pageId of ["terms", "privacy", "contact", "data-deletion", "refund-policy", "ai-disclaimer"]) {
    const pageCopy = JSON.stringify(legalPages[pageId]);
    assert.doesNotMatch(pageCopy, /support contact published|app-operator|app operator/i, pageId);
  }
});

test("support copy presents Google Ads as optional reporting and preserves core paths", async () => {
  const [embeddedSupport, publicSupport] = await Promise.all([
    readFile(new URL("../routes/app.support.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/support.jsx", import.meta.url), "utf8"),
  ]);

  for (const source of [embeddedSupport, publicSupport]) {
    assert.match(source, /optional Google Ads integration/);
    assert.match(source, /read-only\/reporting-only/);
    assert.match(source, /TikTok Ads and Meta Ads are not currently available/);
    assert.match(source, /CSV\s+import/);
    assert.match(source, /without connecting Google Ads/);
    assert.match(source, /support@blueprintai\.app/);
    assert.match(source, /OAuth codes/);
    assert.doesNotMatch(source, /Direct ad-platform connections are optional and not currently available/);
  }
});
