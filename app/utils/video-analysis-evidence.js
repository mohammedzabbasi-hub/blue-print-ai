const RETENTION_FIELDS = [
  "retention_score",
  "hook_status",
  "useless_viewership_flag",
  "first_3_seconds_retention",
  "first_5_seconds_retention",
  "first_10_seconds_retention",
  "retention_curve",
  "biggest_dropoff",
  "major_dropoffs",
  "engagement_vacancies",
  "recommendations",
  "verdict",
];

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== "";
}

function isLegacyFabricatedRetention(source) {
  const curve = Array.isArray(source.retention_curve)
    ? source.retention_curve
    : [];

  return (
    Number(source.retention_score) === 42 &&
    Number(source.first_3_seconds_retention) === 78 &&
    Number(source.first_5_seconds_retention) === 61 &&
    Number(source.first_10_seconds_retention) === 39 &&
    curve.some(
      (point) =>
        Number(point?.second) === 10 && Number(point?.retention) === 39,
    )
  );
}

export function normalizeRetentionAnalysis(retentionAnalysis) {
  const source =
    retentionAnalysis && typeof retentionAnalysis === "object"
      ? retentionAnalysis
      : {};
  if (isLegacyFabricatedRetention(source)) {
    return {
      available: false,
      evidence_type: "unavailable",
      unavailable_reason: "Needs connected platform/video analytics.",
    };
  }
  const available = RETENTION_FIELDS.some((field) => hasValue(source[field]));

  if (!available) {
    return {
      available: false,
      evidence_type: "unavailable",
      unavailable_reason: "Needs connected platform/video analytics.",
    };
  }

  const declaredType = String(
    source.evidence_type || source.metric_type || source.method || "analyzer",
  ).toLowerCase();
  const evidenceType = /heuristic|estimate|predicted|modeled/.test(declaredType)
    ? "heuristic"
    : /platform|measured|observed/.test(declaredType)
      ? "measured"
      : "analyzer";

  return {
    ...source,
    available: true,
    evidence_type: evidenceType,
  };
}

export function transcriptEvidence(transcript) {
  const source = transcript && typeof transcript === "object" ? transcript : {};
  const candidate =
    typeof source.full_text === "string" ? source.full_text.trim() : "";
  const isLegacyStatusMessage =
    candidate ===
      "Audio was extracted successfully. Speech transcription is not configured in this Shopify app runtime." ||
    candidate ===
      "No transcript available because no audio file was found or ffmpeg is unavailable.";
  const text = isLegacyStatusMessage ? "" : candidate;

  return {
    ...source,
    full_text: text,
    available: Boolean(text),
    unavailable_reason:
      source.unavailable_reason ||
      (text
        ? ""
        : isLegacyStatusMessage
          ? candidate
          : "Speech transcription is not configured for this analysis."),
  };
}

export function analyzerEvidence(analyzer) {
  const source = analyzer && typeof analyzer === "object" ? analyzer : {};
  const nestedAnalysis =
    source.analysis && typeof source.analysis === "object" ? source.analysis : {};
  const analysis = {
    ...nestedAnalysis,
    hook_score: nestedAnalysis.hook_score ?? nestedAnalysis.hookScore ?? source.hookScore,
    cta_score: nestedAnalysis.cta_score ?? nestedAnalysis.ctaScore ?? source.ctaScore,
    clarity_score:
      nestedAnalysis.clarity_score ?? nestedAnalysis.clarityScore ?? source.clarityScore,
    overall_score:
      nestedAnalysis.overall_score ?? nestedAnalysis.overallScore ?? source.overallScore,
    summary:
      nestedAnalysis.summary ?? nestedAnalysis.executiveSummary ?? source.executiveSummary,
    strengths: nestedAnalysis.strengths ?? source.strengths,
    weaknesses: nestedAnalysis.weaknesses ?? source.weaknesses,
    recommendations: nestedAnalysis.recommendations ?? source.recommendations,
    messaging_angle:
      nestedAnalysis.messaging_angle ?? nestedAnalysis.messagingAngle ?? source.messagingAngle,
    visual_elements:
      nestedAnalysis.visual_elements ?? nestedAnalysis.visualElements ?? source.visualElements,
    next_test_plan:
      nestedAnalysis.next_test_plan ?? nestedAnalysis.nextTestPlan ?? source.nextTestPlan,
    ad_format: nestedAnalysis.ad_format ?? nestedAnalysis.adFormat ?? source.adFormat,
  };

  for (const key of Object.keys(analysis)) {
    if (analysis[key] === undefined) delete analysis[key];
  }

  return {
    analysis,
    metadata:
      source.metadata && typeof source.metadata === "object"
        ? { ...source.metadata }
        : {},
    transcript: transcriptEvidence(source.transcript),
    ocr_text: Array.isArray(source.ocr_text) ? source.ocr_text : [],
    retention_analysis: normalizeRetentionAnalysis(source.retention_analysis),
  };
}
