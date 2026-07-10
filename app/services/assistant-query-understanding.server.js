const METRIC_PATTERNS = [
  ["roas", /\broas\b|return on ad spend/i],
  ["revenue", /\brevenue\b|\bsales\b|conversion value/i],
  ["spend", /\bspend\b|\bad spend\b|\btotal cost\b/i],
  ["ctr", /\bctr\b|click[- ]through rate/i],
  ["cvr", /\bcvr\b|conversion rate/i],
  ["cpa", /\bcpa\b|cost per (?:acquisition|conversion|order)/i],
  ["cpc", /\bcpc\b|cost per click/i],
  ["cpm", /\bcpm\b|cost per (?:mille|thousand impressions)/i],
  ["clicks", /\bclicks?\b/i],
  ["impressions", /\bimpressions?\b/i],
  ["orders", /\borders?\b|\bconversions?\b|\bpurchases?\b/i],
  ["videoViews", /\bvideo views?\b|\bviews?\b/i],
];

const CREATIVE_FILE_EXTENSION = /\b[a-z0-9][a-z0-9._-]*\.(?:mp4|mov|m4v|webm)\b/gi;
const TTAD_REFERENCE = /\bttad[\s_-]*\d+(?:\.mp4)?\b/gi;

export function parseAssistantQuestion(question = "") {
  const cleanQuestion = String(question || "").replace(/\s+/g, " ").trim();
  const lower = cleanQuestion.toLowerCase();
  const metrics = METRIC_PATTERNS
    .filter(([, pattern]) => pattern.test(cleanQuestion))
    .map(([metric]) => metric);
  const filenamePhrases = captureFilenamePhrases(cleanQuestion);
  const filenameTokens = matches(cleanQuestion, CREATIVE_FILE_EXTENSION)
    .filter((token) => !filenamePhrases.some((phrase) =>
      normalizeAssistantEntity(phrase).endsWith(normalizeAssistantEntity(token)),
    ));
  const creativeQueries = unique([
    ...matches(cleanQuestion, TTAD_REFERENCE),
    ...captureNamedEntities(cleanQuestion, "creative"),
    ...captureNamedEntities(cleanQuestion, "ad"),
    ...filenamePhrases,
    ...filenameTokens,
  ].map((value) => entityQuery(value)));
  const creatorQueries = unique([
    ...matches(cleanQuestion, /@[a-z0-9_.-]+/gi),
    ...captureNamedEntities(cleanQuestion, "creator"),
  ].map((value) => entityQuery(value, { stripAt: true })));
  const campaignQueries = unique(
    captureNamedEntities(cleanQuestion, "campaign").map((value) => entityQuery(value)),
  );
  const comparison = /\b(?:vs\.?|versus|compare|comparison|against)\b/i.test(cleanQuestion) &&
    (creativeQueries.length + creatorQueries.length + campaignQueries.length >= 2);
  const rankingDirection = /\b(?:worst|weakest|lowest|underperform)/i.test(cleanQuestion)
    ? "worst"
    : /\b(?:best|top|strongest|highest|winner|scale|reuse)\b/i.test(cleanQuestion)
      ? "best"
      : null;
  const requestedEntityType = detectEntityType(lower, {
    campaignQueries,
    creativeQueries,
    creatorQueries,
  });
  const missingData = /\b(?:missing|not found|no data|don't have|do not have|unavailable|data gap|need more data)\b/i.test(cleanQuestion);
  const googleAds = /\bgoogle\s*ads?\b|\bgoogle campaign/i.test(cleanQuestion);
  const videoReview = /\b(?:video review|ai review|review studio|hook|cta|clarity|creative score|readiness score)\b/i.test(cleanQuestion);

  let intent = "general_advice";
  if (comparison) intent = `${requestedEntityType || "creative"}_comparison`;
  else if (creativeQueries.length) intent = "creative_lookup";
  else if (creatorQueries.length) intent = "creator_lookup";
  else if (campaignQueries.length) intent = "campaign_lookup";
  else if (rankingDirection && requestedEntityType) intent = `${requestedEntityType}_ranking`;
  else if (googleAds) intent = "google_ads";
  else if (videoReview) intent = "video_review";
  else if (missingData) intent = "missing_data";
  else if (requestedEntityType && /\b(?:tell me about|about|data|performance|metrics?|how is|what is|what's)\b/i.test(cleanQuestion)) {
    intent = `${requestedEntityType}_lookup`;
  }

  return {
    question: cleanQuestion,
    normalizedQuestion: normalizeAssistantEntity(cleanQuestion),
    intent,
    entityType: requestedEntityType,
    entities: {
      campaigns: campaignQueries,
      creatives: creativeQueries,
      creators: creatorQueries,
    },
    metrics: unique(metrics),
    comparison,
    ranking: rankingDirection
      ? {
          direction: rankingDirection,
          entityType: requestedEntityType,
          metric: metrics[0] || defaultRankingMetric(requestedEntityType),
        }
      : null,
    asksAboutMissingData: missingData,
    asksAboutGoogleAds: googleAds,
    asksAboutVideoReview: videoReview,
  };
}

export function normalizeAssistantEntity(value = "", { stripAt = false } = {}) {
  let normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\.(?:mp4|mov|m4v|webm)$/i, "")
    .replace(/[\s_-]+/g, "")
    .replace(/[^a-z0-9@.]/g, "");
  if (stripAt) normalized = normalized.replace(/^@/, "");
  return normalized;
}

function entityQuery(value, options) {
  return {
    raw: String(value || "").trim(),
    normalized: normalizeAssistantEntity(value, options),
  };
}

function matches(value, pattern) {
  return [...String(value || "").matchAll(pattern)].map((match) => match[0]);
}

function captureNamedEntities(question, entity) {
  const pattern = new RegExp(
    `\\b${entity}\\s+(?:called\\s+|named\\s+)?[“"]?([a-z0-9@][a-z0-9@._ -]{1,80}?)(?=[”"]?(?:\\s+(?:data|metrics?|performance|roas|revenue|spend|vs\\.?|versus|and|with|has|have|should|is|was|from|for)\\b|[?.!,]|$))`,
    "gi",
  );
  return [...String(question || "").matchAll(pattern)]
    .map((match) => match[1].trim())
    .filter((value) => value && !/^(?:should|has|have|is|was|data|metrics?|performance|best|worst|top)\b/i.test(value));
}

function captureFilenamePhrases(question) {
  const values = [...String(question || "").matchAll(
    /(?:\babout\b|\bcreative\b|\bvideo\b|\bfile(?:name)?\b)\s+(?:called\s+|named\s+)?[“"]?([a-z0-9][a-z0-9 _-]{0,80}\.(?:mp4|mov|m4v|webm))/gi,
  )].map((match) => match[1].trim());
  return values.filter((value) => !/^(?:the|this|a)\s/i.test(value));
}

function detectEntityType(question, queries) {
  if (queries.creativeQueries.length || /\bcreative\b|\bvideo\b|\bad\b|ttad/i.test(question)) return "creative";
  if (queries.creatorQueries.length || /\bcreator\b|\binfluencer\b/i.test(question)) return "creator";
  if (queries.campaignQueries.length || /\bcampaign\b/i.test(question)) return "campaign";
  return null;
}

function defaultRankingMetric(entityType) {
  if (entityType === "creator") return "scaleSignal";
  return "roas";
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = typeof value === "string" ? value : value.normalized;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
