import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdvisorContext,
  buildAdvisorResponse,
} from "./advisor.server.js";

function context(overrides = {}) {
  return buildAdvisorContext({
    analyses: [],
    blueprints: [],
    briefs: [],
    campaigns: [],
    creatives: [],
    merchantData: { products: [] },
    performance: { records: [], hasMeasuredPerformanceData: false },
    profile: {},
    ...overrides,
  });
}

describe("AI Advisor action engine", () => {
  it("returns the structured advisor response contract", () => {
    const result = buildAdvisorResponse(context(), "What should I do next?");
    assert.equal(typeof result.answer, "string");
    assert.equal(typeof result.recommendation, "string");
    assert.equal(typeof result.why, "string");
    assert.ok(Array.isArray(result.evidence));
    assert.ok(Array.isArray(result.risks));
    assert.ok(Array.isArray(result.nextActions));
    assert.equal(result.meta.deterministic, true);
  });

  it("provides a useful no-data fallback without inventing a winner", () => {
    const result = buildAdvisorResponse(context(), "Which creative should I scale?");
    assert.match(result.recommendation, /not enough creative evidence/i);
    assert.ok(result.nextActions.some((action) => action.href === "/app/data-import"));
    assert.doesNotMatch(result.answer, /scaled|published|changed|deleted/i);
  });

  it("includes imported creative and campaign evidence in rankings", () => {
    const result = buildAdvisorResponse(
      context({
        campaigns: [{
          id: "campaign-1",
          name: "June Scale",
          creativeCount: 2,
          metrics: { roas: 4.82, revenue: 1200, cvr: 7.5, ctr: 3.2, clicks: 160, orders: 12 },
        }],
        merchantData: { products: [{ id: "p1", title: "Serum" }] },
        performance: {
          hasMeasuredPerformanceData: true,
          records: [{ id: "creative-1", creativeTitle: "Morning Hook", clicks: 160, orders: 12, revenue: 1200, spend: 249, roas: 4.82, ctr: 3.2, cvr: 7.5 }],
        },
      }),
      "Which campaign has the strongest signal?",
    );
    assert.match(result.recommendation, /June Scale/);
    assert.ok(result.evidence.some((item) => item.label === "ROAS" && item.value === "4.82x"));
    assert.ok(result.evidence.some((item) => item.label === "Assigned creatives" && item.value === "2"));
  });

  it("surfaces missing product context as a risk", () => {
    const result = buildAdvisorResponse(context(), "What data is missing from my store?");
    assert.ok(result.risks.some((risk) => /product context is missing/i.test(risk)));
    assert.ok(result.evidence.some((item) => item.label === "Products" && item.value === "0"));
  });

  it("includes imported product names in its store context", () => {
    const advisorContext = context({
      performance: {
        records: [
          {
            id: "imported-1",
            importSource: "public_engagement_import",
            productTitle: "CSV Moisturizer",
            impressions: 2000,
            clicks: 100,
            orders: 8,
            revenue: 640,
            spend: 160,
          },
        ],
      },
    });

    assert.equal(advisorContext.counts.products, 1);
    assert.equal(advisorContext.counts.shopifyProducts, 0);
    assert.equal(advisorContext.counts.importedProductNames, 1);
    assert.deepEqual(advisorContext.productContext.importedProductNames, [
      "CSV Moisturizer",
    ]);
    assert.equal(advisorContext.storeSummary.productContextLabel, "Imported product context");
    assert.equal(advisorContext.storeSummary.products[0].ctr, 5);
    assert.equal(advisorContext.storeSummary.products[0].cvr, 8);
    assert.equal(advisorContext.storeSummary.products[0].roas, 4);
    assert.equal(advisorContext.gaps.some((gap) => /product context is missing/i.test(gap.why)), false);
  });

  it("ranks creator signals from imported attribution records", () => {
    const result = buildAdvisorResponse(
      context({
        performance: { records: [
          { id: "1", creatorHandle: "@maya", clicks: 100, orders: 10, revenue: 900, videoViews: 1000, likes: 120 },
          { id: "2", creatorHandle: "@sam", clicks: 80, orders: 2, revenue: 140, videoViews: 900, likes: 80 },
        ] },
      }),
      "Which creator should I reuse?",
    );
    assert.match(result.recommendation, /@maya/);
    assert.ok(result.evidence.some((item) => item.label === "Revenue"));
  });

  it("never claims an external action was performed", () => {
    const result = buildAdvisorResponse(context(), "Pause my bad campaign and publish a replacement");
    assert.doesNotMatch(`${result.answer} ${result.nextAction}`, /I (paused|published|changed|deleted)|has been (paused|published|changed|deleted)/i);
    assert.ok(result.nextActions.every((action) => action.href.startsWith("/app/")));
  });
});
