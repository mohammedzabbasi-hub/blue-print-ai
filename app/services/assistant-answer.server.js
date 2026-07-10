import { hasAssistantEvidence } from "./assistant-facts.server.js";
import { normalizeAssistantEntity } from "./assistant-query-understanding.server.js";

export function buildDeterministicEvidenceResponse(evidencePacket) {
  const sourceNote = evidencePacket?.sourceSummary?.note || "";
  const facts = evidencePacket?.facts || {};
  let result;

  if (evidencePacket?.missingData?.some((item) => item.type === "entity_not_found") && !facts.entities?.length) {
    result = answerMissingEntity(evidencePacket.missingData[0]);
  } else if (facts.entities?.length) {
    result = facts.entities.length > 1
      ? answerComparison(facts.entities)
      : answerEntity(facts.entities[0]);
  } else if (facts.ranking) {
    result = answerRanking(facts.ranking);
  } else if (facts.googleAds) {
    result = answerGoogleAds(facts.googleAds);
  } else if (facts.videoReviews?.length) {
    result = answerVideoReviews(facts.videoReviews);
  } else if (facts.availability) {
    result = answerAvailability(facts.availability);
  } else {
    return null;
  }

  const evidence = buildEvidenceRows(facts);
  return {
    answer: [result.recommendation, result.why, sourceNote].filter(Boolean).join(" "),
    recommendation: result.recommendation,
    why: result.why,
    evidence,
    risks: result.risks || [],
    nextAction: result.nextAction,
    nextActions: result.nextActions || [],
    sourceNote,
    meta: {
      deterministic: true,
      evidenceCount: evidence.length,
      evidencePacket: true,
      intent: evidencePacket.intent,
      usingShopContext: hasAssistantEvidence(evidencePacket),
      contextLabel: hasAssistantEvidence(evidencePacket)
        ? "Using shop context"
        : "Limited context available",
      provider: "deterministic_evidence",
      providerFallback: false,
      sourceCounts: {
        performanceRows: evidencePacket.sourceSummary?.performanceRowCount || 0,
        savedReviews: evidencePacket.sourceSummary?.savedReviewCount || 0,
      },
    },
  };
}

export function buildEvidenceAssistantMessages(evidencePacket) {
  return [
    {
      role: "system",
      content: [
        "You are BluePrintAI Assistant.",
        "You must answer using only the provided evidence packet.",
        "If the user asks about a specific creative, creator, or campaign, answer only about that entity.",
        "Do not substitute top performers or unrelated campaigns.",
        "If the entity is not found, say it was not found and explain what data is available.",
        "Do not invent metrics.",
        "Do not reveal internal IDs, private URLs, tokens, API keys, sessions, HMAC values, encrypted credentials, OAuth data, or secrets.",
        "Google Ads access is read-only reporting. Do not claim that you changed an external system.",
        "Return one concise plain-language explanation. Do not add facts that are absent from the evidence packet.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        evidencePacket,
        question: evidencePacket.question,
      }),
    },
  ];
}

export function isGroundedEvidenceExplanation(content, evidencePacket) {
  const text = String(content || "").trim();
  if (!text || text.length > 1200) return false;
  if (/https?:\/\/|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|session|hmac|oauth|credential/i.test(text)) return false;
  if (/\b(?:launched|paused|published|deleted|changed|edited)\b.*\b(?:ad|campaign|shopify|google|tiktok|meta)\b/i.test(text)) return false;
  if (/\b(?:scale|increase|decrease|raise|lower|pause|launch|publish|delete|change budget|spend more)\b/i.test(text)) return false;
  if (/_lookup$/.test(evidencePacket.intent || "") && /\b(?:best|top|highest|strongest|worst|weakest|winner)\b/i.test(text)) return false;
  const allowedEntities = new Set((evidencePacket.entityMatches || []).map((match) =>
    normalizeAssistantEntity(match.name || match.query),
  ));
  const mentionedTtads = [...text.matchAll(/\bttad[\s_-]*\d+(?:\.mp4)?\b/gi)]
    .map((match) => normalizeAssistantEntity(match[0]));
  if (mentionedTtads.some((entity) => !allowedEntities.has(entity))) return false;
  const allowedNumbers = collectNumbers(evidencePacket);
  const mentionedNumbers = collectNumbers(text);
  return mentionedNumbers.every((number) => allowedNumbers.some((allowed) => Math.abs(allowed - number) < 0.001));
}

function answerEntity(entity) {
  if (entity.performanceRowCount === 0) {
    const place = entity.type === "creative"
      ? "Creative Library or saved reviews"
      : entity.type === "creator"
        ? "creator data"
        : "campaign data";
    return {
      recommendation: `I found ${entity.name}, but I do not have imported performance rows for it yet.`,
      why: `The match comes from ${place}, so I can confirm the entity exists but will not estimate performance metrics.`,
      nextAction: "Import or sync performance rows for this entity, then ask again.",
    };
  }
  const metrics = metricSentence(entity.metrics);
  const assignments = [
    entity.creators?.length ? `Creator: ${entity.creators.join(", ")}.` : "",
    entity.campaigns?.length ? `Campaign: ${entity.campaigns.join(", ")}.` : "",
    entity.products?.length ? `Product: ${entity.products.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  const review = entity.savedReviews?.[0];
  const reviewText = review
    ? [
        review.overallScore !== null ? `Saved AI review score: ${formatNumber(review.overallScore)}/100.` : "",
        review.summary ? `Saved review summary: ${review.summary}` : "",
      ].filter(Boolean).join(" ")
    : "";
  return {
    recommendation: `Here is the available shop data for ${entity.name}.`,
    why: [metrics, assignments, reviewText].filter(Boolean).join(" "),
    nextAction: "Use these exact imported facts as the baseline for your next review or controlled test.",
  };
}

function answerComparison(entities) {
  return {
    recommendation: `Here is the side-by-side comparison for ${entities.map((entity) => entity.name).join(" vs ")}.`,
    why: entities.map((entity) => `${entity.name}: ${metricSentence(entity.metrics) || "no imported performance metrics"}`).join(" "),
    nextAction: "Compare the same metric and date coverage before deciding what to scale or revise.",
  };
}

function answerRanking(ranking) {
  if (!ranking.winner) {
    return {
      recommendation: `I cannot rank a ${ranking.entityType} by ${metricLabel(ranking.metric)} yet.`,
      why: "No shop-scoped candidate has that imported metric, so I will not choose an unrelated winner.",
      nextAction: "Import the requested metric for the entities you want to compare.",
    };
  }
  const metricValue = ranking.metric === "scaleSignal"
    ? metricSentence(ranking.winner.metrics)
    : formatMetric(ranking.metric, ranking.winner.metrics[ranking.metric]);
  return {
    recommendation: `${ranking.winner.name} is the server-computed ${ranking.direction} ${ranking.entityType}${ranking.metric === "scaleSignal" ? " to scale" : ` by ${metricLabel(ranking.metric)}`}.`,
    why: `${metricValue || "The ranking uses the available imported outcome data."} The result was computed from ${ranking.winner.performanceRowCount} shop-scoped performance ${ranking.winner.performanceRowCount === 1 ? "row" : "rows"}.`,
    nextAction: "Confirm comparable date coverage and sample size before changing spend.",
  };
}

function answerMissingEntity(missing) {
  const query = missing.query || "that entity";
  const locations = missing.entityType === "creative"
    ? "Creative Library, saved reviews, or imported performance data"
    : missing.entityType === "creator"
      ? "creator profiles or imported attribution data"
      : "local campaigns, Google Ads campaign metadata, or imported performance data";
  return {
    recommendation: `I could not find ${query} in your ${locations}.`,
    why: "I did not substitute a top performer because the question requested a specific entity.",
    nextAction: `Check the ${missing.entityType} name or import its data, then ask again.`,
  };
}

function answerGoogleAds(googleAds) {
  return {
    recommendation: `Google Ads reporting is ${googleAds.connectionState === "connected" ? "connected" : "not fully connected"} for this shop.`,
    why: `${googleAds.campaignCount} campaign records are available, ${googleAds.selectedCampaignCount} are selected, and ${googleAds.syncedPerformanceRowCount} synced performance rows are available. Access is read-only.`,
    nextAction: "Use Connections to review account and campaign selection or sync reporting rows.",
  };
}

function answerVideoReviews(reviews) {
  return {
    recommendation: `${reviews.length} saved AI Review Studio ${reviews.length === 1 ? "review is" : "reviews are"} available.`,
    why: reviews.map((review) => `${review.title}${review.overallScore !== null ? `: ${formatNumber(review.overallScore)}/100` : ""}.`).join(" "),
    nextAction: "Name a specific creative or filename for an exact saved-review answer.",
  };
}

function answerAvailability(availability) {
  const populated = Object.entries(availability).filter(([, value]) => Number(value) > 0);
  return {
    recommendation: populated.length
      ? "Your shop has data available, with some coverage gaps shown below."
      : "I do not have imported workspace evidence for this shop yet.",
    why: populated.length
      ? populated.map(([key, value]) => `${plainLabel(key)}: ${value}.`).join(" ")
      : "No creative performance, saved creative, saved review, creator, campaign, or Google Ads campaign records were found.",
    nextAction: "Import the missing creative-level performance fields or connect a read-only reporting source.",
  };
}

function buildEvidenceRows(facts) {
  const rows = [];
  (facts.entities || []).forEach((entity) => {
    rows.push({ label: "Entity", value: entity.name });
    rows.push({ label: "Performance rows", value: String(entity.performanceRowCount) });
    Object.entries(entity.metrics || {}).forEach(([metric, value]) => {
      if (value !== null) rows.push({ label: metricLabel(metric), value: formatMetric(metric, value) });
    });
  });
  if (facts.ranking?.winner) {
    rows.push({ label: "Server-computed result", value: facts.ranking.winner.name });
    const value = facts.ranking.winner.metrics?.[facts.ranking.metric];
    if (value !== null && value !== undefined) {
      rows.push({ label: metricLabel(facts.ranking.metric), value: formatMetric(facts.ranking.metric, value) });
    }
  }
  return rows.slice(0, 30);
}

function metricSentence(metrics = {}) {
  return [
    formatMetric("revenue", metrics.revenue),
    formatMetric("spend", metrics.spend),
    formatMetric("roas", metrics.roas),
    formatMetric("ctr", metrics.ctr),
    formatMetric("cvr", metrics.cvr),
    formatMetric("cpa", metrics.cpa),
    formatMetric("clicks", metrics.clicks),
    formatMetric("impressions", metrics.impressions),
    formatMetric("orders", metrics.orders),
    formatMetric("videoViews", metrics.videoViews),
  ].filter(Boolean).join("; ") + (Object.values(metrics).some((value) => value !== null) ? "." : "");
}

function formatMetric(metric, value) {
  if (value === null || value === undefined) return "";
  const formatted = formatNumber(value);
  if (["revenue", "spend", "cpa", "cpc", "cpm"].includes(metric)) return `${metricLabel(metric)} $${formatted}`;
  if (["ctr", "cvr", "engagementRate"].includes(metric)) return `${metricLabel(metric)} ${formatted}%`;
  if (metric === "roas") return `ROAS ${formatted}x`;
  return `${metricLabel(metric)} ${formatted}`;
}

function metricLabel(metric) {
  const labels = {
    cpa: "CPA",
    cpc: "CPC",
    cpm: "CPM",
    ctr: "CTR",
    cvr: "CVR",
    engagementRate: "Engagement rate",
    impressions: "Impressions",
    orders: "Orders/conversions",
    revenue: "Revenue",
    roas: "ROAS",
    scaleSignal: "commercial scale signal",
    spend: "Spend",
    videoViews: "Video views",
  };
  return labels[metric] || plainLabel(metric);
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function plainLabel(value) {
  return String(value || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function collectNumbers(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return [...String(text || "").matchAll(/-?\d[\d,]*(?:\.\d+)?/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter(Number.isFinite);
}
