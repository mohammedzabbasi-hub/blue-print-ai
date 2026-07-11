import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const overviewPath = new URL("../routes/app.campaigns.jsx", import.meta.url);
const detailPath = new URL("../routes/app.campaigns.$id.jsx", import.meta.url);
const creativeDetailPath = new URL("../routes/app.creative-library.$id.jsx", import.meta.url);
const importPath = new URL("../routes/app.data-import.jsx", import.meta.url);

describe("Campaign Manager route UX", () => {
  it("loads the campaign list and keeps creation in a focused modal", async () => {
    const source = await readFile(overviewPath, "utf8");

    assert.match(source, /listCampaigns\(session\.shop\)/);
    assert.match(source, /CreateCampaignDialog/);
    assert.match(source, /Advanced details/);
    assert.match(source, /No campaigns yet/);
    assert.match(source, /redirect\(withEmbeddedRouteParams/);
  });

  it("loads a campaign workspace with creative and performance actions", async () => {
    const source = await readFile(detailPath, "utf8");

    assert.match(source, /getCampaign\(session\.shop, params\.id\)/);
    assert.match(source, /Assigned creatives/);
    assert.match(source, /Add selected creatives/);
    assert.match(source, /removeCampaignAssignment/);
    assert.match(source, /Not imported/);
    assert.match(source, /\["overview", "creatives", "performance", "notes"\]/);
  });

  it("requires an in-app confirmation for shop-authenticated local campaign deletion", async () => {
    const source = await readFile(detailPath, "utf8");

    assert.match(source, /loadShopifyRouteContext\(request\)/);
    assert.match(source, /deleteCampaign\(session\.shop, params\.id\)/);
    assert.match(source, /Delete “\$\{campaign\.name\}” from BluePrintAI\?/);
    assert.match(source, /It does not delete the campaign from Google Ads or any other advertising platform/);
    assert.match(source, /Creatives and imported performance records will be preserved/);
    assert.match(source, /future import containing the same external campaign may recreate the local campaign/);
    assert.match(source, /withEmbeddedRouteParams\(/);
    assert.match(source, /\/app\/campaigns\?deleted=1/);
    assert.doesNotMatch(source, /window\.confirm|confirm\(/);
    assert.doesNotMatch(source, /googleAds|GoogleAds|deleteGoogle/);
  });

  it("connects campaign assignment to creative detail while keeping import campaign assignment out of the workflow", async () => {
    const [creativeSource, importSource] = await Promise.all([
      readFile(creativeDetailPath, "utf8"),
      readFile(importPath, "utf8"),
    ]);

    assert.match(creativeSource, /Move to campaign/);
    assert.match(creativeSource, /assignCampaignRecords/);
    assert.doesNotMatch(importSource, /Assign campaign/);
    assert.doesNotMatch(importSource, /newCampaignName/);
    assert.match(importSource, /name="videoFiles"/);
  });
});
