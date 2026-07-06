import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateEffectiveness,
  buildDashboardEffectivenessRecords,
  buildCreativeLaunchMarkers,
  buildEffectivenessGroups,
  buildTrendRows,
  dedupeDailyPerformanceRecords,
  filterPerformanceRecordsByDateRange,
  filterEffectivenessRecords,
  partitionDashboardPerformanceRecords,
  trendAvailability,
} from "./ad-effectiveness.js";

const records = [
  {
    id: "csv-1",
    sourceRecordType: "public_engagement_import",
    campaignId: "camp-1",
    campaignName: "June Scale Tests",
    creativeId: "TTAD1",
    creativeTitle: "Morning glow routine",
    creatorHandle: "@mayaglow",
    productId: "serum",
    productName: "GlowBarrier Hydrating Serum",
    reportingDate: "2026-06-20",
    impressions: 1000,
    videoViews: 800,
    likes: 60,
    comments: 10,
    shares: 5,
    clicks: 100,
    orders: 10,
    revenue: 500,
    spend: 100,
  },
  {
    id: "upload-1",
    sourceRecordType: "creative_upload_performance_import",
    campaignId: "camp-1",
    campaignName: "June Scale Tests",
    creativeId: "TTAD2",
    creativeTitle: "Night cleansing balm review",
    creatorHandle: "@nightcreator",
    productId: "balm",
    productName: "Night Cleansing Balm",
    reportingDate: "2026-06-21",
    impressions: 500,
    videoViews: 400,
    likes: 20,
    comments: 4,
    shares: 1,
    clicks: 25,
    orders: 2,
    revenue: 100,
    spend: 50,
    videoUrl: "/uploads/creative-library/test/TTAD2.mp4",
  },
];

describe("ad and campaign effectiveness", () => {
  it("includes current-shop Google Ads demo daily rows in dashboard effectiveness data", () => {
    const demoRow = { id: "google-demo-1", sourcePlatform: "google", source: "demo", isDemo: true };
    const dashboardRecords = buildDashboardEffectivenessRecords({ dailyRecords: [demoRow], records: [] });
    assert.deepEqual(dashboardRecords, [demoRow]);
    assert.equal(dashboardRecords.length > 0, true);
  });

  it("keeps live and demo Google Ads daily rows distinguishable", () => {
    const demoRow = { id: "demo", source: "demo", isDemo: true };
    const liveRow = { id: "live", source: "live", isDemo: false };
    const dashboardRecords = buildDashboardEffectivenessRecords({ dailyRecords: [demoRow, liveRow] });
    assert.deepEqual(dashboardRecords.filter((row) => row.isDemo), [demoRow]);
    assert.deepEqual(dashboardRecords.filter((row) => !row.isDemo), [liveRow]);
  });

  it("includes CSV-only and creative + video performance records", () => {
    assert.equal(records.filter((row) => row.sourceRecordType === "public_engagement_import").length, 1);
    assert.equal(records.filter((row) => row.videoUrl).length, 1);
    assert.equal(aggregateEffectiveness(records).recordCount, 2);
  });

  it("aggregates imported metrics and derives effectiveness rates", () => {
    const summary = aggregateEffectiveness(records);
    assert.equal(summary.revenue.value, 600);
    assert.equal(summary.spend.value, 150);
    assert.equal(summary.orders.value, 12);
    assert.equal(summary.clicks.value, 125);
    assert.equal(summary.roas.value, 4);
    assert.equal(summary.ctr.value, (125 / 1500) * 100);
    assert.equal(summary.cvr.value, (12 / 125) * 100);
    assert.equal(summary.cpc.value, 1.2);
    assert.equal(summary.cpm.value, 100);
    assert.equal(summary.costPerOrder.value, 12.5);
  });

  for (const [view, expectedKey] of [
    ["creative", "TTAD1"],
    ["campaign", "camp-1"],
    ["creator", "@mayaglow"],
    ["product", "serum"],
  ]) {
    it(`filters metrics by ${view}`, () => {
      const filtered = filterEffectivenessRecords(records, view, expectedKey);
      assert.equal(filtered.length, view === "campaign" ? 2 : 1);
      assert.equal(aggregateEffectiveness(filtered).revenue.value, view === "campaign" ? 600 : 500);
      assert.ok(buildEffectivenessGroups(records, view).length > 0);
    });
  }

  it("keeps unavailable commercial fields distinct from imported zeroes", () => {
    const publicOnly = aggregateEffectiveness([{ creativeId: "organic-1", videoViews: 100, likes: 10, comments: 2, shares: 1 }]);
    assert.equal(publicOnly.engagementRate.value, 13);
    assert.equal(publicOnly.revenue.imported, false);
    assert.equal(publicOnly.spend.imported, false);
    assert.equal(publicOnly.hasPublicEngagement, true);
    assert.equal(publicOnly.hasCommercialMetrics, false);
    assert.equal(publicOnly.roas.imported, false);
    assert.equal(publicOnly.ctr.imported, false);
    assert.equal(publicOnly.cvr.imported, false);
    assert.equal(publicOnly.cpc.imported, false);
    assert.equal(publicOnly.cpm.imported, false);
  });

  it("uses engagement components when an imported engagement total is zero", () => {
    const summary = aggregateEffectiveness([{
      impressions: 1000,
      engagementCount: 0,
      likes: 60,
      comments: 10,
      shares: 5,
    }]);
    assert.equal(summary.engagements.value, 75);
    assert.equal(summary.engagementRate.value, 7.5);
  });

  it("keeps creator rollups out of canonical dashboard records", () => {
    const creatorRollup = {
      sourceRecordType: "creator_performance_import",
      revenue: 600,
    };
    const partitioned = partitionDashboardPerformanceRecords([...records, creatorRollup]);
    assert.deepEqual(partitioned.creativeRecords, records);
    assert.deepEqual(partitioned.creatorRollups, [creatorRollup]);
  });

  it("does not calculate CTR from video views when impressions are unavailable", () => {
    const summary = aggregateEffectiveness([{ videoViews: 1000, clicks: 20 }]);
    assert.equal(summary.ctr.imported, false);
  });

  it("groups daily rows by date and recalculates campaign rates", () => {
    const rows = buildTrendRows(records);
    assert.deepEqual(rows.map((row) => row.date), ["2026-06-20", "2026-06-21"]);
    assert.equal(rows[0].summary.revenue.value, 500);
    assert.equal(rows[1].summary.roas.value, 2);
    assert.equal(rows[1].summary.ctr.value, 5);
  });

  it("does not chart undated records using import or creation timestamps", () => {
    const rows = buildTrendRows([
      records[0],
      { creativeId: "undated", createdAt: "2026-06-27", importedAt: "2026-06-27", revenue: 999 },
    ]);
    assert.deepEqual(rows.map((row) => row.date), ["2026-06-20"]);
    assert.equal(rows[0].summary.revenue.value, 500);
  });

  it("filters trend records by calendar days instead of point count", () => {
    const dated = [
      { reportingDate: "2026-06-01", revenue: 1 },
      { reportingDate: "2026-06-23", revenue: 2 },
      { reportingDate: "2026-06-29", revenue: 3 },
    ];
    const filtered = filterPerformanceRecordsByDateRange(dated, "7d", new Date("2026-06-29T12:00:00Z"));
    assert.deepEqual(filtered.map((record) => record.revenue), [2, 3]);
  });

  it("aggregates cumulative campaign growth without summing derived rates", () => {
    const rows = buildTrendRows(records, { cumulative: true });
    assert.equal(rows[1].summary.revenue.value, 600);
    assert.equal(rows[1].summary.spend.value, 150);
    assert.equal(rows[1].summary.roas.value, 4);
    assert.equal(rows[1].summary.cvr.value, (12 / 125) * 100);
  });

  it("generates staggered launch markers and falls back to first performance date", () => {
    const launches = buildCreativeLaunchMarkers([
      { ...records[0], videoFilename: "TTAD1.mp4", creativeLaunchDate: "2026-06-18" },
      { ...records[1], videoFilename: "TTAD2.mp4" },
    ]);
    assert.deepEqual(launches.map((launch) => [launch.date, launch.label]), [
      ["2026-06-18", "TTAD1.mp4 launched"],
      ["2026-06-21", "TTAD2.mp4 launched"],
    ]);
  });

  it("deduplicates repeated creative/date rows before campaign aggregation", () => {
    const duplicate = { ...records[0], id: "csv-1-repeat", revenue: 999 };
    const deduped = dedupeDailyPerformanceRecords([records[0], duplicate, records[1]]);
    const trend = buildTrendRows([records[0], duplicate, records[1]]);
    assert.equal(deduped.length, 2);
    assert.equal(trend[0].summary.recordCount, 1);
    assert.equal(trend[0].summary.revenue.value, 999);
  });

  it("marks a single reporting date as sparse", () => {
    assert.deepEqual(trendAvailability([records[0]]), {
      dateCount: 1,
      isSparse: true,
      hasTrend: false,
    });
  });
});
