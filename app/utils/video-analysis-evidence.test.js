import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzerEvidence,
  normalizeRetentionAnalysis,
  transcriptEvidence,
} from "./video-analysis-evidence.js";

test("partial analyzer output is preserved without synthesized fields", () => {
  const evidence = analyzerEvidence({
    analysis: { hook_score: 8, analysis_method: "estimated" },
  });

  assert.deepEqual(evidence.analysis, {
    hook_score: 8,
    analysis_method: "estimated",
  });
  assert.equal(evidence.analysis.cta_score, undefined);
  assert.equal(evidence.analysis.clarity_score, undefined);
  assert.equal(evidence.analysis.summary, undefined);
  assert.equal(evidence.retention_analysis.available, false);
});

test("missing retention remains unavailable instead of receiving fake defaults", () => {
  const retention = normalizeRetentionAnalysis(undefined);

  assert.deepEqual(retention, {
    available: false,
    evidence_type: "unavailable",
    unavailable_reason: "Needs connected platform/video analytics.",
  });
  assert.equal(retention.retention_score, undefined);
  assert.equal(retention.first_3_seconds_retention, undefined);
  assert.equal(retention.first_10_seconds_retention, undefined);
  assert.equal(retention.retention_curve, undefined);
  assert.equal(retention.biggest_dropoff, undefined);
});

test("legacy fabricated retention defaults are suppressed in saved reviews", () => {
  const retention = normalizeRetentionAnalysis({
    retention_score: 42,
    first_3_seconds_retention: 78,
    first_5_seconds_retention: 61,
    first_10_seconds_retention: 39,
    retention_curve: [
      { second: 0, retention: 100 },
      { second: 10, retention: 39 },
    ],
    biggest_dropoff: { timestamp: "0:10", drop_percent: 22 },
  });

  assert.equal(retention.available, false);
  assert.equal(retention.retention_score, undefined);
  assert.equal(retention.biggest_dropoff, undefined);
});

test("analyzer retention values are preserved and heuristic output is labeled", () => {
  const curve = [{ second: 3, retention: 72 }];
  const retention = normalizeRetentionAnalysis({
    evidence_type: "estimated",
    first_3_seconds_retention: 72,
    retention_curve: curve,
  });

  assert.equal(retention.available, true);
  assert.equal(retention.evidence_type, "heuristic");
  assert.equal(retention.first_3_seconds_retention, 72);
  assert.equal(retention.retention_curve, curve);
});

test("transcript status is not treated as transcript content", () => {
  const transcript = transcriptEvidence({
    full_text: "",
    unavailable_reason: "No transcription provider is connected.",
  });

  assert.equal(transcript.available, false);
  assert.equal(transcript.full_text, "");
  assert.equal(
    transcript.unavailable_reason,
    "No transcription provider is connected.",
  );
});

test("legacy transcript placeholder text is treated as unavailable", () => {
  const transcript = transcriptEvidence({
    full_text:
      "Audio was extracted successfully. Speech transcription is not configured in this Shopify app runtime.",
  });

  assert.equal(transcript.available, false);
  assert.equal(transcript.full_text, "");
});
