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
  ["app.privacy.jsx", /settings\?section=legal/],
  ["app.terms.jsx", /settings\?section=legal/],
  ["app.support.jsx", /settings\?section=legal/],
  ["app.contact.jsx", /pageId="contact"/],
  ["app.data-deletion.jsx", /settings\?section=legal/],
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

test("combined settings content covers legal, privacy, support, and deletion", async () => {
  const [settings, combinedContent] = await Promise.all([
    readFile(new URL("../routes/app.settings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/legal/LegalPrivacyContent.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(settings, /Legal & Privacy/);
  assert.match(settings, /<LegalPrivacyContent/);
  for (const heading of [
    "Privacy & Data Use",
    "Google Ads Data Access",
    "Shopify Store Data",
    "Read-Only Advertising Data",
    "Terms of Use",
    "Support",
    "Data Deletion / Account Removal",
    "Contact",
  ]) {
    assert.match(combinedContent, new RegExp(heading), heading);
  }
  assert.match(combinedContent, /Shopify embedded app/);
  assert.match(combinedContent, /OAuth-based/);
  assert.match(combinedContent, /read-only and reporting-only/);
  assert.match(combinedContent, /Users can disconnect Google Ads at any time/);
  assert.match(combinedContent, /support@blueprintai\.app/);
  assert.match(combinedContent, /Delete BluePrintAI data/);
  assert.match(combinedContent, /This deletes BluePrintAI-stored data for this shop/);
  assert.match(settings, /Type DELETE to confirm/);
  assert.match(settings, /deletionConfirmation !== "DELETE"/);
  assert.match(settings, /deleteWorkspaceDataFromSettingsForm\(session\.shop, formData\)/);
});

test("merchant deletion does not call Shopify or Google Ads deletion APIs", async () => {
  const blueprint = await readFile(
    new URL("./blueprint.server.js", import.meta.url),
    "utf8",
  );
  const deletionFunction = blueprint.slice(
    blueprint.indexOf("export async function deleteWorkspaceData(shop)"),
    blueprint.indexOf("export const DEMO_WORKSPACE_RESET_MODELS"),
  );

  assert.doesNotMatch(deletionFunction, /admin\.graphql|googleAds|customers\.delete|products\.delete/);
  assert.match(deletionFunction, /db\.adPlatformConnection\.deleteMany/);
  assert.match(deletionFunction, /deleteUploadedWorkspaceFiles/);
});

test("public support and combined settings describe Google Ads as read-only", async () => {
  const [combinedContent, publicSupport] = await Promise.all([
    readFile(new URL("../components/legal/LegalPrivacyContent.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/support.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(combinedContent, /read-only and reporting-only/);
  assert.match(combinedContent, /does not create, edit, pause, launch, bid, set budgets, or spend/);
  assert.doesNotMatch(combinedContent, /fetch\(|axios|method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);

  for (const source of [combinedContent, publicSupport]) {
    assert.match(source, /support@blueprintai\.app/);
    assert.match(source, /OAuth codes/);
  }
});
