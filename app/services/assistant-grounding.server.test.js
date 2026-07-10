import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAdvisorContext, buildAssistantResponse } from "../models/advisor.server.js";
import { buildDeterministicEvidenceResponse } from "./assistant-answer.server.js";
import { buildAssistantEvidencePacket } from "./assistant-facts.server.js";
import { parseAssistantQuestion } from "./assistant-query-understanding.server.js";
import { resolveStoreEntities } from "./store-entity-resolver.server.js";

const SHOP = "grounded-shop.myshopify.com";

function row(overrides = {}) {
  return {
    id: "ttad1-day-1",
    shop: SHOP,
    creativeId: "TTAD1",
    creativeTitle: "TTAD1.mp4",
    videoFilename: "TTAD1.mp4",
    creatorHandle: "@maya",
    campaignName: "July Scale",
    productTitle: "Glow Serum",
    sourcePlatform: "csv",
    importSource: "creative_performance_upload_import",
    sourceRecordType: "creative_performance",
    reportingDate: "2026-07-01T00:00:00.000Z",
    revenue: 300,
    spend: 100,
    impressions: 5_000,
    clicks: 100,
    orders: 10,
    reach: 4_000,
    videoViews: 3_500,
    engagements: 250,
    ...overrides,
  };
}

function storeData() {
  return {
    analyses: [{
      id: "review-ttad1",
      shop: SHOP,
      fileName: "TTAD1.mp4",
      productTitle: "Glow Serum",
      savedToLibrary: true,
      payload: {
        result: {
          display: { displayTitle: "TTAD1 review", summary: "The proof is clear." },
          analysis: {
            hook_score: 8,
            clarity_score: 7,
            cta_score: 6,
            overall_score: 7.2,
            recommendations: ["Make the CTA more specific."],
          },
          mediaUrl: "https://private.example/review.mp4?token=secret-media",
        },
      },
    }],
    blueprints: [],
    briefs: [],
    campaigns: [{
      id: "campaign-july",
      shop: SHOP,
      name: "July Scale",
      platform: "manual",
      creativeCount: 2,
      metrics: { revenue: 10_600, spend: 1_200, roas: 8.83 },
      assignments: [],
    }],
    creatives: [{
      id: "saved-ttad1",
      shop: SHOP,
      sourceType: "video_analysis",
      sourceId: "review-ttad1",
      title: "TTAD1",
      productTitle: "Glow Serum",
      payload: {
        originalFilename: "TTAD1.mp4",
        mediaStored: true,
        mediaUrl: "https://private.example/ttad1.mp4?token=private-media",
        refreshToken: "raw-refresh-secret",
      },
    }],
    creatorProfiles: [
      { id: "creator-maya", shop: SHOP, handle: "@maya", name: "Maya", platform: "TikTok" },
      { id: "creator-sam", shop: SHOP, handle: "@sam", name: "Sam", platform: "TikTok" },
    ],
    googleCampaigns: [],
    googleConnection: null,
    performance: {
      records: [
        row(),
        row({ id: "ttad1-day-2", reportingDate: "2026-07-02T00:00:00.000Z" }),
        row({
          id: "ttad5-day-1",
          creativeId: "TTAD5",
          creativeTitle: "TTAD5.mp4",
          videoFilename: "TTAD5.mp4",
          creatorHandle: "@sam",
          campaignName: "Daily Creative Test - Conversion",
          revenue: 10_000,
          spend: 1_000,
          impressions: 20_000,
          clicks: 400,
          orders: 80,
        }),
        row({
          id: "other-shop-ttad1",
          shop: "other-shop.myshopify.com",
          revenue: 999_999,
          spend: 1,
        }),
      ],
      dailyRecords: [],
    },
    profile: {},
    workspaceSettings: [],
  };
}

async function evidence(question, data = storeData()) {
  const parsedQuestion = parseAssistantQuestion(question);
  const resolvedEntities = await resolveStoreEntities({
    shop: SHOP,
    parsedQuestion,
    data,
  });
  return buildAssistantEvidencePacket({
    shop: SHOP,
    question,
    parsedQuestion,
    resolvedEntities,
  });
}

function advisorContext() {
  return buildAdvisorContext({
    campaigns: [{
      id: "wrong-campaign",
      name: "Daily Creative Test - Conversion",
      creativeCount: 1,
      metrics: { roas: 10, revenue: 10_000 },
    }],
    performance: {
      records: [{ id: "wrong-top", creativeTitle: "TTAD5.mp4", revenue: 10_000, spend: 1_000 }],
      hasMeasuredPerformanceData: true,
    },
  });
}

describe("Assistant deterministic store-data grounding", () => {
  it("parses creative spelling and filename variants as the same normalized entity", () => {
    for (const question of ["TTAD1", "TTAD1.mp4", "TTAD 1", "ttad1", "ttad-1"]) {
      const parsed = parseAssistantQuestion(`tell me about ${question} data`);
      assert.equal(parsed.intent, "creative_lookup");
      assert.equal(parsed.entities.creatives[0].normalized, "ttad1");
    }
    const spacedFilename = parseAssistantQuestion("tell me about Summer Hook.mp4 data");
    assert.equal(spacedFilename.entities.creatives[0].normalized, "summerhook");
    assert.equal(
      parseAssistantQuestion("tell me about creative Unknown Hook data").entities.creatives[0].normalized,
      "unknownhook",
    );
  });

  it("detects creator, campaign, metric, missing-data, Google Ads, and video-review questions", () => {
    assert.equal(parseAssistantQuestion("which creator should I scale?").intent, "creator_ranking");
    assert.equal(parseAssistantQuestion("tell me about campaign July Scale data").intent, "campaign_lookup");
    assert.deepEqual(parseAssistantQuestion("compare CTR, CPA, and video views").metrics, ["ctr", "cpa", "videoViews"]);
    assert.equal(parseAssistantQuestion("what data is missing?").intent, "missing_data");
    assert.equal(parseAssistantQuestion("why is Google Ads showing no data?").intent, "google_ads");
    assert.equal(parseAssistantQuestion("show my AI Review Studio scores").intent, "video_review");
  });

  it("resolves TTAD1.mp4 daily rows and computes exact aggregate metrics", async () => {
    const packet = await evidence("tell me about TTAD1 data");
    const fact = packet.facts.entities[0];
    assert.equal(fact.name, "TTAD1.mp4");
    assert.equal(fact.performanceRowCount, 2);
    assert.equal(fact.dailyRowCount, 2);
    assert.deepEqual(fact.dateRange, { start: "2026-07-01", end: "2026-07-02" });
    assert.equal(fact.metrics.revenue, 600);
    assert.equal(fact.metrics.spend, 200);
    assert.equal(fact.metrics.roas, 3);
    assert.equal(fact.metrics.ctr, 2);
    assert.equal(fact.metrics.cvr, 10);
    assert.equal(fact.metrics.cpa, 10);
    assert.equal(fact.metrics.cpc, 1);
    assert.equal(fact.metrics.cpm, 20);
    assert.equal(fact.savedReviews[0].overallScore, 72);
    assert.match(packet.sourceSummary.note, /2 imported daily rows from 2026-07-01 to 2026-07-02/i);
  });

  it("does not substitute TTAD5 or the top campaign for a TTAD1 lookup", async () => {
    const packet = await evidence("ttad1");
    const response = buildDeterministicEvidenceResponse(packet);
    assert.match(response.answer, /TTAD1\.mp4/i);
    assert.match(response.answer, /ROAS 3x/i);
    assert.doesNotMatch(response.answer, /TTAD5|Daily Creative Test - Conversion/i);
  });

  it("returns both creatives for TTAD1 vs TTAD5", async () => {
    const packet = await evidence("TTAD1 vs TTAD5");
    assert.deepEqual(packet.facts.entities.map((entity) => entity.name), ["TTAD1.mp4", "TTAD5.mp4"]);
    const response = buildDeterministicEvidenceResponse(packet);
    assert.match(response.answer, /TTAD1\.mp4.*TTAD5\.mp4/i);
  });

  it("computes the best-ROAS creative ranking on the server", async () => {
    const packet = await evidence("which creative has the best ROAS?");
    assert.equal(packet.facts.ranking.winner.name, "TTAD5.mp4");
    assert.equal(packet.facts.ranking.winner.metrics.roas, 10);
  });

  it("uses creator-attributed rows for scale recommendations", async () => {
    const packet = await evidence("which creator should I scale?");
    assert.equal(packet.intent, "creator_ranking");
    assert.equal(packet.facts.ranking.entityType, "creator");
    assert.equal(packet.facts.ranking.winner.name, "@sam");
  });

  it("resolves saved creator and campaign names even when the type is implicit", async () => {
    const creatorPacket = await evidence("tell me about Maya");
    const campaignPacket = await evidence("tell me about July Scale");
    assert.equal(creatorPacket.facts.entities[0].type, "creator");
    assert.equal(creatorPacket.facts.entities[0].name, "@maya");
    assert.equal(campaignPacket.facts.entities[0].type, "campaign");
    assert.equal(campaignPacket.facts.entities[0].name, "July Scale");
  });

  it("returns an exact missing-entity response", async () => {
    const packet = await evidence("tell me about TTAD99 data");
    const response = buildDeterministicEvidenceResponse(packet);
    assert.match(response.recommendation, /could not find TTAD99/i);
    assert.match(response.recommendation, /Creative Library, saved reviews, or imported performance data/i);
    assert.doesNotMatch(response.answer, /TTAD5|best campaign/i);
  });

  it("distinguishes an existing creative with no imported performance rows", async () => {
    const data = storeData();
    data.performance.records = data.performance.records.filter((record) => record.creativeId !== "TTAD1");
    const packet = await evidence("tell me about TTAD1 data", data);
    const response = buildDeterministicEvidenceResponse(packet);
    assert.match(response.recommendation, /found TTAD1.*do not have imported performance rows/i);
    assert.doesNotMatch(response.answer, /TTAD5|10x ROAS/i);
  });

  it("keeps the latest evidence ahead of stale ranking, route, or model text", async () => {
    const packet = await evidence("tell me abt ttad1 data");
    const context = advisorContext();
    context.pathname = "/app/campaigns";
    context.storeIntelligenceContext = {
      contextStatus: { label: "Using shop context" },
      sections: { performance: { totals: { roas: 10 } } },
      staleHistory: "The user previously asked for TTAD5 and the best campaign.",
      routeIntro: "Discuss Daily Creative Test - Conversion.",
    };
    const response = await buildAssistantResponse(context, "tell me abt ttad1 data", {
      evidencePacket: packet,
      completeChat: async () => ({
        ok: true,
        provider: "gemini",
        content: "TTAD5 is the strongest creative at 10x ROAS.",
      }),
    });
    assert.match(response.answer, /TTAD1\.mp4/i);
    assert.doesNotMatch(response.answer, /TTAD5|Daily Creative Test - Conversion/i);
    assert.equal(response.explanation, "");
  });

  it("returns the deterministic evidence answer when Gemini is unavailable", async () => {
    const packet = await evidence("tell me about TTAD1 data");
    const response = await buildAssistantResponse(advisorContext(), "tell me about TTAD1 data", {
      evidencePacket: packet,
      completeChat: async () => ({
        ok: false,
        provider: "fallback",
        reason: "provider_error",
      }),
    });
    assert.match(response.answer, /TTAD1\.mp4/i);
    assert.match(response.answer, /ROAS 3x/i);
    assert.equal(response.meta.providerFallback, true);
  });

  it("excludes private fields and enforces shop isolation", async () => {
    const packet = await evidence("tell me about TTAD1 data");
    const serialized = JSON.stringify(packet);
    for (const forbidden of [
      "999999",
      "private.example",
      "secret-media",
      "private-media",
      "raw-refresh-secret",
      "refreshToken",
      "mediaUrl",
      "oauth",
      "hmac",
      "session",
      "encrypted",
    ]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden, "i"), forbidden);
    }
    assert.equal(packet.facts.entities[0].metrics.revenue, 600);
    assert.equal(packet.safetyFlags.shopScoped, true);
    assert.equal(packet.safetyFlags.rawAuthDataIncluded, false);
  });
});
