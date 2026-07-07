import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

describe("product context evidence UI", () => {
  it("renders source labels, imported metrics, and Not available fallbacks", async () => {
    const component = await source("components/ProductContextEvidence.jsx");
    assert.match(component, /evidence\.productName/);
    assert.match(component, /evidence\.sourceLabel/);
    assert.match(component, /Related creatives\/ads/);
    assert.match(component, /Best creative\/ad/);
    assert.match(component, /Not available/);
    assert.doesNotMatch(component, /JSON\.stringify/);
  });

  it("shows evidence before and after Ad Brief generation", async () => {
    const route = await source("routes/app.ad-briefs.jsx");
    assert.match(route, /Product context available for generation/);
    assert.match(route, /AI used this context/);
  });

  it("shows evidence before and after Revenue Blueprint generation", async () => {
    const route = await source("routes/app.revenue-blueprint.jsx");
    assert.match(route, /Product context available for generation/);
    assert.match(route, /AI used this context/);
  });

  it("keeps canonical product source labels after retiring the advisor page", async () => {
    const model = await source("models/product-context.js");
    assert.match(model, /Shopify product/);
    assert.match(model, /Imported product context/);
    assert.match(model, /Demo product/);
    assert.match(model, /No product context/);
  });

  it("keeps active context primary and optional integrations secondary", async () => {
    const [dashboard, dataSources, productContext] = await Promise.all([
      source("routes/app.dashboard.jsx"),
      source("components/IntegrationStatusCards.jsx"),
      source("models/product-context.js"),
    ]);
    assert.match(dashboard, /hasUploadedData={dashboardData\.hasUploadedData}/);
    assert.match(dashboard, /<ConnectMoreDataSources/);
    assert.match(dataSources, /Active data context/);
    assert.match(dataSources, /Connect more data sources/);
    assert.match(dataSources, /Optional — unlock deeper/);
    assert.match(dataSources, /Use CSV import instead/);
    assert.match(productContext, /Manual upload available/);
    assert.doesNotMatch(dataSources, /Not connected yet/);
    assert.doesNotMatch(dataSources, /md:grid-cols-2 xl:grid-cols-3/);
  });
});
