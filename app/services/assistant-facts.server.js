import {
  aggregateEffectiveness,
  metricNumber,
} from "../utils/ad-effectiveness.js";
import { normalizeAssistantEntity } from "./assistant-query-understanding.server.js";

const METRIC_NAMES = [
  "revenue",
  "spend",
  "roas",
  "ctr",
  "cvr",
  "cpa",
  "cpc",
  "cpm",
  "clicks",
  "impressions",
  "reach",
  "orders",
  "videoViews",
  "engagements",
  "engagementRate",
];

export function buildAssistantEvidencePacket({
  shop,
  question,
  parsedQuestion,
  resolvedEntities,
} = {}) {
  const normalizedShop = String(shop || "").trim().toLowerCase();
  if (!normalizedShop || normalizedShop !== resolvedEntities?.shop) {
    throw new Error("Assistant evidence must be built from the resolved shop scope.");
  }
  const matches = resolvedEntities.entityMatches || [];
  const intent = parsedQuestion?.intent === "general_advice" && matches.length
    ? `${matches[0].type}_lookup`
    : parsedQuestion?.intent || "general_advice";
  const safeMatches = matches.map((match) => ({
    type: match.type,
    query: safeText(match.query, 160),
    name: safeText(match.name, 240),
    matchType: "exact_normalized",
  }));
  const entityFacts = matches.map(buildEntityFact);
  const ranking = buildRankingFact(parsedQuestion, resolvedEntities.catalog);
  const availability = parsedQuestion?.intent === "missing_data"
    ? buildAvailabilityFact(resolvedEntities.catalog)
    : null;
  const googleAds = parsedQuestion?.intent === "google_ads"
    ? buildGoogleAdsFact(resolvedEntities.catalog)
    : null;
  const videoReviews = parsedQuestion?.intent === "video_review" && !entityFacts.length
    ? buildRecentReviewFacts(resolvedEntities.catalog.analyses)
    : null;
  const missingData = buildMissingData({
    entityFacts,
    parsedQuestion,
    resolvedEntities,
  });
  const sourceSummary = buildSourceSummary({
    catalog: resolvedEntities.catalog,
    entityFacts,
    googleAds,
    ranking,
  });
  const facts = {
    answerMode: determineAnswerMode(parsedQuestion, {
      entityFacts,
      googleAds,
      ranking,
      videoReviews,
    }),
    entities: entityFacts,
    ranking,
    availability,
    googleAds,
    videoReviews,
  };

  return sanitizeEvidence({
    question: safeText(question || parsedQuestion?.question, 1200),
    intent,
    entityMatches: safeMatches,
    facts,
    sourceSummary,
    missingData,
    safetyFlags: {
      shopScoped: true,
      exactEntityMatchPreferred: true,
      privateLinksExcluded: true,
      restrictedFieldsExcluded: true,
      rawAuthDataIncluded: false,
    },
  });
}

export function hasAssistantEvidence(evidencePacket) {
  const facts = evidencePacket?.facts || {};
  return Boolean(
    evidencePacket?.entityMatches?.length ||
    facts.ranking ||
    facts.availability ||
    facts.googleAds ||
    facts.videoReviews?.length,
  );
}

function buildEntityFact(match) {
  if (match.type === "creative") return buildCreativeFact(match);
  if (match.type === "creator") return buildCreatorFact(match);
  return buildCampaignFact(match);
}

function buildCreativeFact(match) {
  const metrics = metricsForRows(match.performanceRows);
  const dates = reportingDates(match.performanceRows);
  const reviewFacts = match.analyses.map(reviewFact).filter(Boolean);
  const savedReviewFacts = match.savedCreatives
    .map((creative) => reviewFactFromSavedCreative(creative))
    .filter(Boolean);
  const reviews = dedupeBy([...reviewFacts, ...savedReviewFacts], (review) => JSON.stringify(review));
  const sourceTypes = uniqueText([
    ...match.performanceRows.map((row) => firstText(
      row.importSource,
      row.sourceRecordType,
      row.sourceType,
      row.sourcePlatform,
    )),
    ...match.savedCreatives.map((creative) => creative.sourceType),
    ...match.analyses.map(() => "saved_ai_review"),
  ]);
  return {
    type: "creative",
    name: safeText(match.name, 240),
    filename: safeText(firstText(
      ...match.performanceRows.map((row) => row.videoFilename || row.originalFilename),
      ...match.savedCreatives.map((creative) => creative.payload?.originalFilename || creative.payload?.fileName),
      ...match.analyses.map((analysis) => analysis.fileName),
    ), 240),
    creators: uniqueText(match.performanceRows.map((row) => row.creatorHandle || row.creatorName)),
    campaigns: uniqueText([
      ...match.campaigns.map((campaign) => campaign.name),
      ...match.performanceRows.map((row) => row.workspaceCampaignName || row.campaignName),
    ]),
    products: uniqueText([
      ...match.performanceRows.map((row) => row.productTitle || row.productName || row.productLabel),
      ...match.savedCreatives.map((creative) => creative.productTitle),
      ...match.analyses.map((analysis) => analysis.productTitle),
    ]),
    sourceTypes,
    dateRange: dateRange(dates),
    performanceRowCount: match.performanceRows.length,
    dailyRowCount: dates.length,
    metrics,
    savedCreativeCount: match.savedCreatives.length,
    savedReviewCount: reviews.length,
    savedReviews: reviews.slice(0, 3),
    previewAvailable: [
      ...match.performanceRows,
      ...match.savedCreatives.map((creative) => creative.payload || {}),
    ].some(hasPreview),
  };
}

function buildCreatorFact(match) {
  const metrics = metricsForRows(match.performanceRows);
  const dates = reportingDates(match.performanceRows);
  return {
    type: "creator",
    name: safeText(match.name, 200),
    platforms: uniqueText([
      ...match.profiles.map((profile) => profile.platform),
      ...match.performanceRows.map((row) => row.creatorPlatform || row.sourcePlatform),
    ]),
    creatives: uniqueText(match.performanceRows.map((row) =>
      row.videoFilename || row.originalFilename || row.creativeTitle || row.adName,
    )),
    campaigns: uniqueText(match.performanceRows.map((row) => row.workspaceCampaignName || row.campaignName)),
    dateRange: dateRange(dates),
    performanceRowCount: match.performanceRows.length,
    dailyRowCount: dates.length,
    metrics,
  };
}

function buildCampaignFact(match) {
  const metrics = match.performanceRows.length
    ? metricsForRows(match.performanceRows)
    : metricsFromCampaign(match.campaigns[0]);
  const dates = reportingDates(match.performanceRows);
  return {
    type: "campaign",
    name: safeText(match.name, 240),
    platforms: uniqueText([
      ...match.campaigns.map((campaign) => campaign.platform),
      ...match.googleCampaigns.map(() => "google_ads"),
      ...match.performanceRows.map((row) => row.sourcePlatform),
    ]),
    creatives: uniqueText(match.performanceRows.map((row) =>
      row.videoFilename || row.originalFilename || row.creativeTitle || row.adName,
    )),
    products: uniqueText([
      ...match.campaigns.map((campaign) => campaign.primaryProductName),
      ...match.performanceRows.map((row) => row.productTitle || row.productName),
    ]),
    dateRange: dateRange(dates),
    performanceRowCount: match.performanceRows.length,
    dailyRowCount: dates.length,
    metrics,
    googleAdsSelected: match.googleCampaigns.some((campaign) => campaign.selected),
  };
}

function buildRankingFact(parsedQuestion, catalog) {
  if (!parsedQuestion?.ranking || !/_ranking$/.test(parsedQuestion.intent || "")) return null;
  const { direction, entityType, metric } = parsedQuestion.ranking;
  const candidates = entityType === "creator"
    ? rankCreatorCandidates(catalog.performanceRows)
    : entityType === "campaign"
      ? rankCampaignCandidates(catalog)
      : rankCreativeCandidates(catalog.creativeGroups);
  const metricKey = metric === "cpa" ? "cpa" : metric;
  const available = candidates.filter((candidate) =>
    metricKey === "scaleSignal" ? candidate.performanceRowCount > 0 : candidate.metrics[metricKey] !== null,
  );
  available.sort((left, right) => compareRanking(left, right, metricKey, direction));
  return {
    entityType,
    direction,
    metric: metricKey,
    winner: available[0] || null,
    ranked: available.slice(0, 5),
    candidateCount: candidates.length,
    performanceRowCount: candidates.reduce((sum, candidate) => sum + candidate.performanceRowCount, 0),
  };
}

function rankCreativeCandidates(groups = []) {
  return groups.map((group) => ({
    name: safeText(group.name, 240),
    performanceRowCount: group.rows.length,
    metrics: metricsForRows(group.rows),
  }));
}

function rankCreatorCandidates(rows = []) {
  const groups = groupRows(rows, (row) => row.creatorHandle || row.creatorName);
  return groups.map((group) => ({
    name: safeText(group.name, 200),
    performanceRowCount: group.rows.length,
    metrics: metricsForRows(group.rows),
  }));
}

function rankCampaignCandidates(catalog) {
  const rowGroups = groupRows(catalog.performanceRows, (row) => row.workspaceCampaignName || row.campaignName);
  const candidates = rowGroups.map((group) => ({
    name: safeText(group.name, 240),
    performanceRowCount: group.rows.length,
    metrics: metricsForRows(group.rows),
  }));
  catalog.campaigns.forEach((campaign) => {
    if (candidates.some((candidate) => normalizeAssistantEntity(candidate.name) === normalizeAssistantEntity(campaign.name))) return;
    candidates.push({
      name: safeText(campaign.name, 240),
      performanceRowCount: Number(campaign.metrics?.recordCount || campaign.creativeCount || 0),
      metrics: metricsFromCampaign(campaign),
    });
  });
  return candidates;
}

function compareRanking(left, right, metric, direction) {
  if (metric === "scaleSignal") {
    const tuple = (candidate) => [
      candidate.metrics.revenue,
      candidate.metrics.roas,
      candidate.metrics.orders,
      candidate.metrics.clicks,
    ].map((value) => value ?? Number.NEGATIVE_INFINITY);
    const leftTuple = tuple(left);
    const rightTuple = tuple(right);
    for (let index = 0; index < leftTuple.length; index += 1) {
      if (leftTuple[index] !== rightTuple[index]) {
        return direction === "worst"
          ? leftTuple[index] - rightTuple[index]
          : rightTuple[index] - leftTuple[index];
      }
    }
    return right.performanceRowCount - left.performanceRowCount;
  }
  const lowerIsBetter = ["cpa", "cpc", "cpm"].includes(metric);
  const ascending = direction === "best" ? lowerIsBetter : !lowerIsBetter;
  const multiplier = ascending ? 1 : -1;
  return multiplier * ((left.metrics[metric] || 0) - (right.metrics[metric] || 0)) ||
    right.performanceRowCount - left.performanceRowCount;
}

function buildAvailabilityFact(catalog) {
  return {
    performanceRows: catalog.performanceRows.length,
    creativeGroups: catalog.creativeGroups.length,
    savedCreatives: catalog.savedCreatives.length,
    savedReviews: catalog.analyses.length,
    creatorProfiles: catalog.creatorProfiles.length,
    campaigns: catalog.campaigns.length,
    googleAdsCampaigns: catalog.googleCampaigns.length,
  };
}

function buildGoogleAdsFact(catalog) {
  const googleRows = catalog.performanceRows.filter((row) =>
    /google/i.test(`${row.sourcePlatform || ""} ${row.sourceType || ""}`),
  );
  const dates = reportingDates(googleRows);
  return {
    connectionState: safeText(catalog.googleConnection?.status || "not_connected", 80),
    campaignCount: catalog.googleCampaigns.length,
    selectedCampaignCount: catalog.googleCampaigns.filter((campaign) => campaign.selected).length,
    syncedPerformanceRowCount: googleRows.length,
    dateRange: dateRange(dates),
    readOnly: true,
  };
}

function buildRecentReviewFacts(analyses = []) {
  return analyses.map(reviewFact).filter(Boolean).slice(0, 5);
}

function buildMissingData({ entityFacts, parsedQuestion, resolvedEntities }) {
  const missing = [];
  resolvedEntities.unresolved.forEach((item) => {
    missing.push({
      type: "entity_not_found",
      entityType: item.type,
      query: safeText(item.query, 180),
    });
  });
  entityFacts.forEach((fact) => {
    if (fact.performanceRowCount === 0) {
      missing.push({
        type: "performance_rows_missing",
        entityType: fact.type,
        entityName: fact.name,
      });
    }
    (parsedQuestion?.metrics || []).forEach((metric) => {
      const key = metric === "cpa" ? "cpa" : metric;
      if (fact.metrics?.[key] === null) {
        missing.push({
          type: "metric_missing",
          entityType: fact.type,
          entityName: fact.name,
          metric: key,
        });
      }
    });
  });
  return missing;
}

function buildSourceSummary({ catalog, entityFacts, googleAds, ranking }) {
  const scopedRows = entityFacts.length
    ? entityFacts.reduce((sum, fact) => sum + Number(fact.performanceRowCount || 0), 0)
    : ranking?.performanceRowCount ||
      googleAds?.syncedPerformanceRowCount || 0;
  const dailyRows = entityFacts.reduce((sum, fact) => sum + Number(fact.dailyRowCount || 0), 0);
  const dates = entityFacts.flatMap((fact) => fact.dateRange ? [fact.dateRange.start, fact.dateRange.end] : []);
  const savedReviewCount = entityFacts.reduce((sum, fact) => sum + Number(fact.savedReviewCount || 0), 0);
  const sourceTypes = uniqueText(entityFacts.flatMap((fact) => fact.sourceTypes || []));
  return {
    performanceRowCount: scopedRows,
    dailyRowCount: dailyRows,
    savedCreativeCount: entityFacts.reduce((sum, fact) => sum + Number(fact.savedCreativeCount || 0), 0),
    savedReviewCount,
    sourceTypes,
    dateRange: dateRange(dates),
    availableStoreCreativeCount: catalog.creativeGroups.length,
    note: sourceNote({ dailyRows, dates, savedReviewCount, scopedRows }),
  };
}

function sourceNote({ dailyRows, dates, savedReviewCount, scopedRows }) {
  const range = dateRange(dates);
  if (scopedRows && range) {
    return `Based on ${dailyRows || scopedRows} imported daily ${dailyRows === 1 ? "row" : "rows"} from ${range.start} to ${range.end}.`;
  }
  if (scopedRows) return `Based on ${scopedRows} imported performance ${scopedRows === 1 ? "row" : "rows"}.`;
  if (savedReviewCount) return "Based on saved AI Review Studio data.";
  return "No matching imported performance or saved review evidence was found.";
}

function determineAnswerMode(parsedQuestion, facts) {
  if (facts.entityFacts.length || facts.ranking || facts.googleAds || facts.videoReviews?.length) return "deterministic";
  if ((parsedQuestion?.entities?.creatives?.length || parsedQuestion?.entities?.creators?.length || parsedQuestion?.entities?.campaigns?.length)) {
    return "deterministic_missing";
  }
  if (parsedQuestion?.intent === "missing_data") return "deterministic";
  return "legacy_advisory";
}

function metricsForRows(rows = []) {
  const summary = aggregateEffectiveness(rows);
  const metrics = {
    revenue: rounded(metricNumber(summary, "revenue")),
    spend: rounded(metricNumber(summary, "spend")),
    roas: rounded(metricNumber(summary, "roas")),
    ctr: rounded(metricNumber(summary, "ctr")),
    cvr: rounded(metricNumber(summary, "cvr")),
    cpa: rounded(metricNumber(summary, "costPerOrder")),
    cpc: rounded(metricNumber(summary, "cpc")),
    cpm: rounded(metricNumber(summary, "cpm")),
    clicks: rounded(metricNumber(summary, "clicks")),
    impressions: rounded(metricNumber(summary, "impressions")),
    reach: rounded(metricNumber(summary, "reach")),
    orders: rounded(metricNumber(summary, "orders")),
    videoViews: rounded(metricNumber(summary, "videoViews")),
    engagements: rounded(metricNumber(summary, "engagements")),
    engagementRate: rounded(metricNumber(summary, "engagementRate")),
  };
  for (const metric of ["roas", "ctr", "cvr", "cpa", "cpc", "cpm", "engagementRate"]) {
    if (metrics[metric] === null) metrics[metric] = singleImportedMetric(rows, metric);
  }
  return metrics;
}

function metricsFromCampaign(campaign = {}) {
  const source = campaign?.metrics || {};
  return Object.fromEntries(METRIC_NAMES.map((metric) => [
    metric,
    rounded(source[metric] ?? (metric === "cpa" ? source.costPerOrder : null)),
  ]));
}

function singleImportedMetric(rows, metric) {
  const aliases = metric === "cvr"
    ? ["cvr", "conversionRate"]
    : metric === "cpa"
      ? ["cpa", "costPerOrder"]
      : [metric];
  const values = rows.map((row) => {
    for (const key of aliases) {
      const value = rounded(row[key]);
      if (value !== null) return value;
    }
    return null;
  }).filter((value) => value !== null);
  if (values.length === 1 || values.every((value) => value === values[0])) return values[0] ?? null;
  return null;
}

function reviewFact(record = {}) {
  const payload = record.payload || {};
  const result = payload.result || payload;
  const analysis = result.analysis || payload.analysis || {};
  const display = result.display || {};
  const recommendations = firstArray(
    analysis.recommendations,
    analysis.next_actions,
    analysis.nextActions,
    result.recommendations,
  );
  const fact = {
    title: safeText(display.displayTitle || display.generatedTitle || record.fileName || record.productTitle, 240),
    hookScore: normalizedScore(analysis.hook_score ?? analysis.hookScore),
    clarityScore: normalizedScore(analysis.clarity_score ?? analysis.clarityScore),
    ctaScore: normalizedScore(analysis.cta_score ?? analysis.ctaScore),
    overallScore: normalizedScore(
      analysis.overall_score ?? analysis.overallScore ?? analysis.creative_score ??
      analysis.creativeScore ?? analysis.readinessScore,
    ),
    summary: safeText(display.summary || analysis.summary || record.brief || result.summary, 600),
    recommendations: recommendations.map((value) => safeText(value, 320)).filter(Boolean).slice(0, 5),
  };
  return Object.values(fact).some((value) => Array.isArray(value) ? value.length : value !== null && value !== "")
    ? fact
    : null;
}

function reviewFactFromSavedCreative(record = {}) {
  const payload = record.payload || {};
  if (record.sourceType !== "video_analysis" && !payload.analysis && !payload.fullResult && !payload.analysisResult) {
    return null;
  }
  const nested = payload.fullResult || payload.analysisResult || payload;
  return reviewFact({
    fileName: payload.originalFilename || payload.fileName,
    productTitle: record.productTitle,
    brief: record.angle,
    payload: nested,
  });
}

function hasPreview(value = {}) {
  return Boolean(
    value.previewAvailable || value.mediaStored || value.mediaPath || value.videoUrl ||
    value.video_url || value.mediaUrl || value.assetUrl || value.storedFileName,
  );
}

function groupRows(rows, nameFor) {
  const groups = new Map();
  rows.forEach((row) => {
    const name = String(nameFor(row) || "").trim();
    const key = normalizeAssistantEntity(name, { stripAt: true });
    if (!key) return;
    const current = groups.get(key) || { name, rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  });
  return [...groups.values()];
}

function reportingDates(rows = []) {
  return rows.map((row) => isoDay(row.reportingDate || row.date)).filter(Boolean).sort();
}

function dateRange(values = []) {
  const dates = values.map(isoDay).filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates.at(-1) } : null;
}

function isoDay(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizedScore(value) {
  const number = rounded(value);
  if (number === null) return null;
  return number <= 10 ? rounded(number * 10) : number;
}

function rounded(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
  }
  return [];
}

function uniqueText(values = []) {
  return [...new Set(values.map((value) => safeText(value, 240)).filter(Boolean))];
}

function dedupeBy(values, keyFor) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeText(value, maxLength = 500) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "[private URL omitted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "[credential omitted]")
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|developer[_ -]?token|session|hmac|oauth)\s*[:=]\s*\S+/gi, "$1=[credential omitted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeEvidence(value, key = "") {
  if (/(?:token|secret|credential|session|hmac|oauth|encrypted|password|authorization|cookie|mediaUrl|videoUrl|assetUrl|sourceUrl|mediaPath)/i.test(key)) {
    return undefined;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeEvidence(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return typeof value === "string" ? safeText(value, 1200) : value;
}
