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

  it("connects campaign assignment to creative detail and video import", async () => {
    const [creativeSource, importSource] = await Promise.all([
      readFile(creativeDetailPath, "utf8"),
      readFile(importPath, "utf8"),
    ]);

    assert.match(creativeSource, /Move to campaign/);
    assert.match(creativeSource, /assignCampaignRecords/);
    assert.match(importSource, /Step 3 · Assign campaign/);
    assert.match(importSource, /newCampaignName/);
    assert.match(importSource, /name="videoFiles"/);
  });
});
