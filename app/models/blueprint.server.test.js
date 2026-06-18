import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_PRODUCTS,
  analyzeVideoInput,
  buildActivityEvents,
  buildCreators,
  buildDataImportJobs,
  buildRecommendations,
  buildRevenueBlueprint,
} from "./blueprint.server.js";

describe("BluePrintAI Shopify parity builders", () => {
  it("builds creator matches from Shopify product context and saved creatives", () => {
    const savedCreative = {
      id: "creative-1",
      productId: DEMO_PRODUCTS[0].id,
      title: "Saved product demo",
      angle: "Problem-solution demo",
    };

    const creators = buildCreators(DEMO_PRODUCTS, [savedCreative]);

    assert.equal(creators.length, DEMO_PRODUCTS.length);
    assert.equal(creators[0].productTitle, DEMO_PRODUCTS[0].title);
    assert.equal(creators[0].creatives[0].href, "/app/creative-library?creativeId=creative-1");
    assert.ok(creators[0].fitScore >= 80);
  });

  it("maps Shopify import status without TikTok credentials", () => {
    const jobs = buildDataImportJobs({
      products: DEMO_PRODUCTS,
      orders: [{ id: "order-1", createdAt: "2026-06-17T12:00:00.000Z" }],
      orderScopeEnabled: true,
    }, []);

    assert.equal(jobs[0].source, "Shopify catalog");
    assert.equal(jobs[1].source, "Shopify orders");
    assert.equal(jobs[1].status, "Connected");
    assert.equal(jobs[2].href, "/app/activity-log");
  });

  it("turns product and order data into actionable recommendations and blueprints", () => {
    const merchantData = {
      products: DEMO_PRODUCTS,
      orders: [{ amount: 42, currencyCode: "USD" }],
    };
    const recommendations = buildRecommendations(merchantData.products, merchantData.orders);
    const blueprint = buildRevenueBlueprint(merchantData, {
      product: merchantData.products[0],
      recommendation: recommendations[0],
    });

    assert.ok(recommendations[0].nextAction.includes(merchantData.products[0].title));
    assert.equal(blueprint.context.productId, merchantData.products[0].id);
    assert.equal(blueprint.sevenDayPlan.length, 7);
  });

  it("scores uploaded video input from file and brief signals", () => {
    const analysis = analyzeVideoInput({
      description: "Open with the problem, show the result, then tell shoppers to buy today.",
      productTitle: DEMO_PRODUCTS[0].title,
      fileName: "problem-result-demo.mp4",
      fileType: "video/mp4",
      fileSize: 4_200_000,
    });

    assert.equal(analysis.retentionRisk, "Low");
    assert.ok(analysis.hookScore >= 7);
    assert.equal(analysis.fileSignals.fileType, "video/mp4");
  });

  it("combines persisted records into a newest-first activity timeline", () => {
    const events = buildActivityEvents({
      briefs: [{
        id: "brief-1",
        productId: "product-1",
        productTitle: "Product",
        angle: "Angle",
        createdAt: "2026-06-17T12:00:00.000Z",
      }],
      requests: [{
        id: "request-1",
        type: "creator_outreach",
        status: "requested",
        createdAt: "2026-06-17T13:00:00.000Z",
      }],
    });

    assert.equal(events[0].type, "Workspace");
    assert.equal(events[1].type, "Brief");
  });
});
