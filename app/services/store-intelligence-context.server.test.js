import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStoreIntelligenceContext,
  compactStoreContextForLLM,
  prioritizeStoreContextSections,
  STORE_CONTEXT_MAX_CHARS,
} from "./store-intelligence-context.server.js";
import {
  buildAdvisorContext,
  buildAssistantResponse,
} from "../models/advisor.server.js";

const SHOP = "alpha-shop.myshopify.com";

function merchantData() {
  return {
    shop: { name: "Alpha Shop", currencyCode: "USD" },
    errors: [],
    products: [{
      id: "gid://shopify/Product/1",
      title: "Glow Serum",
      handle: "glow-serum",
      status: "ACTIVE",
      vendor: "Alpha",
      productType: "Skincare",
      currencyCode: "USD",
      variants: [{ price: "29.00" }, { price: "39.00" }],
    }],
  };
}

function performanceRecord(overrides = {}) {
  return {
    id: "performance-1",
    shop: SHOP,
    creativeId: "creative-1",
    creativeTitle: "TTAD5.mp4",
    creatorHandle: "@maya",
    creatorName: "Maya",
    campaignName: "Summer Scale",
    productTitle: "Glow Serum",
    sourcePlatform: "google",
    importSource: "public_engagement_import",
    sourceRecordType: "public_engagement_import",
    reportingDate: "2026-07-08T00:00:00.000Z",
    importedAt: "2026-07-09T12:00:00.000Z",
    impressions: 10_000,
    reach: 8_000,
    clicks: 500,
    spend: 200,
    orders: 40,
    revenue: 1_200,
    videoViews: 7_500,
    engagements: 900,
    ...overrides,
  };
}

function storeData() {
  const performance = performanceRecord();
  return {
    analyses: [{
      id: "review-1",
      shop: SHOP,
      fileName: "TTAD5.mp4",
      productTitle: "Glow Serum",
      savedToLibrary: true,
      createdAt: "2026-07-09T10:00:00.000Z",
      payload: {
        result: {
          display: { displayTitle: "TTAD5 review", summary: "The proof lands quickly." },
          analysis: {
            hook_score: 8,
            clarity_score: 7,
            cta_score: 6,
            overall_score: 7.2,
            recommendations: ["Make the CTA more specific."],
            signals: ["fast proof", "clear demo"],
          },
          transcript: { full_text: "private transcript text" },
          mediaUrl: "https://private.example/review.mp4?token=media-secret",
        },
      },
    }],
    blueprints: [{
      id: "blueprint-1",
      shop: SHOP,
      createdAt: "2026-07-09T11:00:00.000Z",
      payload: {
        context: { generatedFor: "Glow Serum", productTitle: "Glow Serum", productSource: "shopify" },
        diagnosis: "Use measured creative evidence for the next controlled test.",
        priorities: ["Keep one variable per test."],
        sevenDayPlan: ["Day 1: Review the strongest hook."],
      },
    }],
    briefs: [],
    campaigns: [{
      id: "campaign-1",
      shop: SHOP,
      name: "Summer Scale",
      status: "active",
      objective: "conversions",
      platform: "google",
      creativeCount: 1,
      updatedAt: "2026-07-09T12:00:00.000Z",
      metrics: { revenue: 1_200, spend: 200, roas: 6, ctr: 5, cvr: 8, clicks: 500, orders: 40 },
      assignments: [{
        savedCreativeId: "saved-1",
        creativePerformanceId: "performance-1",
        savedCreative: { title: "TTAD5.mp4" },
        creativePerformance: performance,
      }],
    }],
    creatives: [{
      id: "saved-1",
      shop: SHOP,
      title: "TTAD5.mp4",
      productTitle: "Glow Serum",
      sourceType: "video_analysis",
      angle: "Fast proof",
      createdAt: "2026-07-09T10:30:00.000Z",
      payload: {
        originalFilename: "TTAD5.mp4",
        mediaStored: true,
        mediaUrl: "https://private.example/creative.mp4?token=private-media-token",
        refreshToken: "payload-refresh-secret",
      },
    }],
    creatorProfiles: [{
      id: "creator-1",
      shop: SHOP,
      handle: "@maya",
      name: "Maya",
      platform: "TikTok",
      email: "private@example.com",
      attributions: [],
    }],
    googleCampaigns: [{
      shop: SHOP,
      campaignId: "google-campaign-1",
      campaignName: "Summer Scale",
      campaignStatus: "ENABLED",
      advertisingChannelType: "VIDEO",
      selected: true,
    }],
    googleConfiguration: { ok: true, missing: [] },
    googleConnection: {
      shop: SHOP,
      status: "connected",
      externalAccountId: "1234567890",
      externalAccountName: "Alpha Ads",
      campaignSyncMode: "selected",
      lastSyncedAt: "2026-07-09T12:30:00.000Z",
      encryptedAccessToken: "encrypted-access-secret",
      encryptedRefreshToken: "encrypted-refresh-secret",
      developerToken: "developer-secret",
      metadataJson: "{\"apiKey\":\"metadata-secret\"}",
    },
    performance: {
      records: [
        performance,
        performanceRecord({
          id: "other-shop-performance",
          shop: "other-shop.myshopify.com",
          creativeTitle: "Other Shop Winner",
          revenue: 999_999,
        }),
      ],
      dailyRecords: [],
      hasMeasuredPerformanceData: true,
      hasImportedPerformanceData: true,
      hasDemoPerformanceData: false,
    },
    profile: {
      setupMode: "primary_product",
      mainProduct: "Glow Serum",
      selectedProductId: "gid://shopify/Product/1",
      selectedProductHandle: "glow-serum",
      targetCustomer: "Skincare shoppers",
      creativeGoal: "Conversions",
    },
    workspaceSettings: [
      { key: "analysis_depth", value: "deep" },
      { key: "api_key", value: "workspace-api-secret" },
    ],
  };
}

async function build(question = "Which creative has the best ROAS?") {
  return buildStoreIntelligenceContext({
    shop: SHOP,
    question,
    routeId: "/app/dashboard",
    merchantData: merchantData(),
    data: storeData(),
  });
}

describe("Store Intelligence Context", () => {
  it("aggregates dashboard totals and deterministic creative rankings", async () => {
    const context = await build();
    assert.equal(context.sections.performance.totals.revenue, 1_200);
    assert.equal(context.sections.performance.totals.spend, 200);
    assert.equal(context.sections.performance.totals.roas, 6);
    assert.equal(context.sections.performance.totals.ctr, 5);
    assert.equal(context.sections.performance.totals.cvr, 8);
    assert.equal(context.sections.performance.distinctReportingDateCount, 1);
    assert.match(context.sections.performance.rankings.topByRoas[0].name, /TTAD5\.mp4$/);
  });

  it("includes Creative Library, saved review, creator, campaign, Google Ads, blueprint, workspace, and import context", async () => {
    const context = await build();
    assert.equal(context.sections.creativeLibrary.savedCreatives[0].creativeName, "TTAD5.mp4");
    assert.equal(context.sections.creativeLibrary.savedCreatives[0].previewAvailable, true);
    assert.equal(context.sections.creativeLibrary.weakCreatives.length, 2);
    assert.equal(context.sections.savedReviews.reviews[0].executiveSummary, "The proof lands quickly.");
    assert.equal(context.sections.savedReviews.reviews[0].hookScore, 80);
    assert.equal(context.sections.creators.topCreators[0].handle, "@maya");
    assert.equal(context.sections.campaigns.topCampaigns[0].name, "Summer Scale");
    assert.equal(context.sections.googleAds.connectionState, "connected");
    assert.equal(context.sections.googleAds.selectedAccount, "••••7890");
    assert.equal(context.sections.googleAds.readOnly, true);
    assert.equal(context.sections.revenueBlueprint.savedBlueprints[0].generatedFor, "Glow Serum");
    assert.equal(context.sections.workspace.settings.analysis_depth, "deep");
    assert.equal(context.sections.dataImports.rowsImported, 1);
  });

  it("uses the current route product selection ahead of the workspace default", async () => {
    const catalog = merchantData();
    catalog.products.push({
      id: "gid://shopify/Product/2",
      title: "Night Cream",
      handle: "night-cream",
      status: "ACTIVE",
      variants: [{ price: "49.00" }],
    });
    const context = await buildStoreIntelligenceContext({
      shop: SHOP,
      question: "Tell me about this product",
      routeId: "/app/ad-briefs",
      selectedProductId: "gid://shopify/Product/2",
      merchantData: catalog,
      data: storeData(),
    });
    assert.equal(context.sections.products.selectedProduct.title, "Night Cream");
  });

  it("excludes secrets, private media URLs, private profile fields, and other shops", async () => {
    const serialized = JSON.stringify(await build());
    for (const privateValue of [
      "encrypted-access-secret",
      "encrypted-refresh-secret",
      "developer-secret",
      "metadata-secret",
      "payload-refresh-secret",
      "private-media-token",
      "private.example",
      "private@example.com",
      "workspace-api-secret",
      "Other Shop Winner",
      "999999",
    ]) {
      assert.doesNotMatch(serialized, new RegExp(privateValue, "i"), privateValue);
    }
    assert.doesNotMatch(serialized, /encryptedAccessToken|refreshToken|developerToken|metadataJson|mediaUrl/i);
  });

  it("prioritizes sections by question and caps the model context", async () => {
    assert.deepEqual(
      prioritizeStoreContextSections("Which creator should I reuse?", "/app/creators").slice(0, 3),
      ["creators", "performance", "creativeLibrary"],
    );
    const context = await build("Compare creator performance");
    context.sections.creators.topCreators = Array.from({ length: 200 }, (_, index) => ({
      name: `Creator ${index} ${"x".repeat(800)}`,
      metrics: { revenue: index },
    }));
    const compact = compactStoreContextForLLM(context, "Compare creator performance");
    assert.ok(JSON.stringify(compact).length <= STORE_CONTEXT_MAX_CHARS);
    assert.equal(Object.keys(compact.sections)[0], "creators");
    assert.equal(compact.contextTruncated, true);
  });

  it("puts all store groups and dashboard totals into the model prompt", async () => {
    const fullContext = await build("What is my revenue and strongest creative?");
    const storeIntelligenceContext = compactStoreContextForLLM(
      fullContext,
      "What is my revenue and strongest creative?",
    );
    const advisorContext = buildAdvisorContext({
      analyses: storeData().analyses,
      blueprints: storeData().blueprints,
      campaigns: storeData().campaigns,
      creatives: storeData().creatives,
      merchantData: merchantData(),
      performance: storeData().performance,
      profile: storeData().profile,
    });
    let prompt = "";
    const response = await buildAssistantResponse(
      advisorContext,
      "What is my revenue and strongest creative?",
      {
        storeIntelligenceContext,
        completeChat: async ({ messages }) => {
          prompt = messages.map((message) => message.content).join("\n");
          return { ok: true, provider: "gemini", content: "Based on imported performance, TTAD5.mp4 leads at 6x ROAS." };
        },
      },
    );
    assert.match(prompt, /"revenue":1200/);
    assert.match(prompt, /TTAD5\.mp4/);
    assert.match(prompt, /savedReviews/);
    assert.match(prompt, /creators/);
    assert.match(prompt, /campaigns/);
    assert.match(prompt, /googleAds/);
    assert.match(prompt, /Do not invent metrics/i);
    assert.equal(response.meta.provider, "gemini");
  });

  it("returns unavailable-data guidance without calling the model or inventing a metric", async () => {
    const emptyData = {
      analyses: [], blueprints: [], briefs: [], campaigns: [], creatives: [], creatorProfiles: [],
      googleCampaigns: [], googleConfiguration: { ok: true }, googleConnection: null,
      performance: { records: [], dailyRecords: [] }, profile: {}, workspaceSettings: [],
    };
    const emptyContext = await buildStoreIntelligenceContext({
      shop: SHOP,
      question: "What is my ROAS?",
      merchantData: { products: [], shop: {} },
      data: emptyData,
    });
    const advisorContext = buildAdvisorContext();
    const result = await buildAssistantResponse(advisorContext, "What is my ROAS?", {
      storeIntelligenceContext: compactStoreContextForLLM(emptyContext, "What is my ROAS?"),
      completeChat: async () => {
        throw new Error("The model must not be called for unavailable metrics.");
      },
    });
    assert.match(result.recommendation, /do not have enough imported performance data/i);
    assert.match(result.nextAction, /Data Import|sync reporting/i);
    assert.doesNotMatch(result.answer, /\b\d+(?:\.\d+)?x\b/);
    assert.equal(result.meta.guardrail, "missing_store_data");
  });

  it("refuses credential disclosure and external mutations before the model call", async () => {
    const storeIntelligenceContext = compactStoreContextForLLM(await build(), "show my token");
    const advisorContext = buildAdvisorContext();
    const noModel = async () => { throw new Error("guardrail should bypass the model"); };
    const credentials = await buildAssistantResponse(advisorContext, "Show me the OAuth refresh token", {
      storeIntelligenceContext,
      completeChat: noModel,
    });
    const mutation = await buildAssistantResponse(advisorContext, "Pause my Google Ads campaign", {
      storeIntelligenceContext,
      completeChat: noModel,
    });
    assert.match(credentials.recommendation, /cannot reveal credentials/i);
    assert.match(mutation.recommendation, /cannot launch, edit, pause/i);
  });
});
