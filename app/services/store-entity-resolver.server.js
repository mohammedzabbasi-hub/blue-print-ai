import { buildDashboardEffectivenessRecords } from "../utils/ad-effectiveness.js";
import { loadStoreIntelligenceData } from "./store-intelligence-context.server.js";
import { normalizeAssistantEntity } from "./assistant-query-understanding.server.js";

export async function resolveStoreEntities({
  shop,
  parsedQuestion,
  data,
  merchantData = { products: [], shop: {} },
} = {}) {
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) throw new Error("A shop is required to resolve assistant entities.");
  const loaded = data || await loadStoreIntelligenceData({
    shop: normalizedShop,
    merchantData,
  });
  const scoped = scopeData(loaded, normalizedShop);
  const performanceRows = buildDashboardEffectivenessRecords(scoped.performance);
  const catalog = {
    analyses: scoped.analyses,
    campaigns: scoped.campaigns,
    creativeGroups: groupCreativePerformanceRows(performanceRows),
    creatorProfiles: scoped.creatorProfiles,
    googleCampaigns: scoped.googleCampaigns,
    googleConnection: scoped.googleConnection || null,
    performanceRows,
    savedCreatives: scoped.creatives,
  };
  const requestedType = parsedQuestion?.entityType;
  const queries = {
    campaign: parsedQuestion?.entities?.campaigns || [],
    creative: parsedQuestion?.entities?.creatives || [],
    creator: parsedQuestion?.entities?.creators || [],
  };

  if (requestedType && !queries[requestedType].length && /_lookup$|video_review/.test(parsedQuestion?.intent || "")) {
    queries[requestedType] = inferQueriesFromCatalog(parsedQuestion, requestedType, catalog);
  }
  if (!requestedType && /\b(?:tell me about|about|how is|what is|what's)\b/i.test(parsedQuestion?.question || "")) {
    const inferred = ["creative", "creator", "campaign"]
      .flatMap((type) => inferQueriesFromCatalog(parsedQuestion, type, catalog)
        .map((query) => ({ ...query, type })))
      .sort((left, right) => right.normalized.length - left.normalized.length)[0];
    if (inferred) queries[inferred.type] = [{ raw: inferred.raw, normalized: inferred.normalized }];
  }

  const entityMatches = [];
  const unresolved = [];
  for (const query of queries.creative) {
    const match = resolveCreative(query, catalog);
    if (match) entityMatches.push(match);
    else unresolved.push({ type: "creative", query: query.raw, normalized: query.normalized });
  }
  for (const query of queries.creator) {
    const match = resolveCreator(query, catalog);
    if (match) entityMatches.push(match);
    else unresolved.push({ type: "creator", query: query.raw, normalized: query.normalized });
  }
  for (const query of queries.campaign) {
    const match = resolveCampaign(query, catalog);
    if (match) entityMatches.push(match);
    else unresolved.push({ type: "campaign", query: query.raw, normalized: query.normalized });
  }

  return {
    shop: normalizedShop,
    parsedQuestion,
    entityMatches,
    unresolved,
    catalog,
  };
}

function resolveCreative(query, catalog) {
  const performanceRows = catalog.performanceRows.filter((row) =>
    aliasesForPerformance(row).some((alias) => alias.normalized === query.normalized),
  );
  const savedCreatives = catalog.savedCreatives.filter((creative) =>
    aliasesForSavedCreative(creative).some((alias) => alias.normalized === query.normalized),
  );
  const analyses = catalog.analyses.filter((analysis) =>
    aliasesForAnalysis(analysis).some((alias) => alias.normalized === query.normalized),
  );
  if (!performanceRows.length && !savedCreatives.length && !analyses.length) return null;
  const aliases = uniqueAliases([
    ...performanceRows.flatMap(aliasesForPerformance),
    ...savedCreatives.flatMap(aliasesForSavedCreative),
    ...analyses.flatMap(aliasesForAnalysis),
  ]);
  const name = preferredCreativeName({ analyses, performanceRows, savedCreatives }, query.raw);
  const campaigns = catalog.campaigns.filter((campaign) => {
    if (performanceRows.some((row) => sameValue(row.campaignId, campaign.id) || sameValue(row.campaignName, campaign.name))) return true;
    return (campaign.assignments || []).some((assignment) =>
      savedCreatives.some((creative) => assignment.savedCreativeId === creative.id) ||
      performanceRows.some((row) => assignment.creativePerformanceId === (row.storageRecordId || row.id)),
    );
  });
  return {
    type: "creative",
    query: query.raw,
    normalized: query.normalized,
    name,
    aliases: aliases.map((alias) => alias.value),
    performanceRows,
    savedCreatives,
    analyses,
    campaigns,
  };
}

function resolveCreator(query, catalog) {
  const profiles = catalog.creatorProfiles.filter((profile) =>
    aliasesForCreator(profile).some((alias) => alias.normalized === query.normalized),
  );
  const performanceRows = catalog.performanceRows.filter((row) =>
    aliasesForCreator(row).some((alias) => alias.normalized === query.normalized),
  );
  if (!profiles.length && !performanceRows.length) return null;
  const profile = profiles[0] || {};
  return {
    type: "creator",
    query: query.raw,
    normalized: query.normalized,
    name: profile.handle || profile.name || performanceRows[0]?.creatorHandle || performanceRows[0]?.creatorName || query.raw,
    profiles,
    performanceRows,
  };
}

function resolveCampaign(query, catalog) {
  const campaigns = catalog.campaigns.filter((campaign) =>
    aliasesForCampaign(campaign).some((alias) => alias.normalized === query.normalized),
  );
  const googleCampaigns = catalog.googleCampaigns.filter((campaign) =>
    aliasesForCampaign(campaign).some((alias) => alias.normalized === query.normalized),
  );
  const performanceRows = catalog.performanceRows.filter((row) =>
    aliasesForCampaign(row).some((alias) => alias.normalized === query.normalized),
  );
  if (!campaigns.length && !googleCampaigns.length && !performanceRows.length) return null;
  return {
    type: "campaign",
    query: query.raw,
    normalized: query.normalized,
    name: campaigns[0]?.name || googleCampaigns[0]?.campaignName || performanceRows[0]?.campaignName || query.raw,
    campaigns,
    googleCampaigns,
    performanceRows,
  };
}

function inferQueriesFromCatalog(parsedQuestion, type, catalog) {
  const normalizedQuestion = parsedQuestion?.normalizedQuestion || "";
  const candidates = type === "creative"
    ? [
        ...catalog.performanceRows.flatMap(aliasesForPerformance),
        ...catalog.savedCreatives.flatMap(aliasesForSavedCreative),
        ...catalog.analyses.flatMap(aliasesForAnalysis),
      ]
    : type === "creator"
      ? [
          ...catalog.creatorProfiles.flatMap(aliasesForCreator),
          ...catalog.performanceRows.flatMap(aliasesForCreator),
        ]
      : [
          ...catalog.campaigns.flatMap(aliasesForCampaign),
          ...catalog.googleCampaigns.flatMap(aliasesForCampaign),
          ...catalog.performanceRows.flatMap(aliasesForCampaign),
        ];
  return uniqueAliases(candidates)
    .filter((alias) => alias.normalized.length >= 4 && normalizedQuestion.includes(alias.normalized))
    .sort((left, right) => right.normalized.length - left.normalized.length)
    .slice(0, parsedQuestion?.comparison ? 2 : 1)
    .map((alias) => ({ raw: alias.value, normalized: alias.normalized }));
}

function groupCreativePerformanceRows(rows = []) {
  const groups = new Map();
  rows.forEach((row) => {
    const aliases = aliasesForPerformance(row);
    const preferred = aliases.find((alias) => alias.kind !== "fingerprint" && alias.kind !== "id") || aliases[0];
    const stableId = aliases.find((alias) => alias.kind === "id");
    const key = stableId?.normalized || preferred?.normalized || normalizeAssistantEntity(row.id);
    if (!key) return;
    const current = groups.get(key) || { key, name: preferred?.value || "Imported creative", rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  });
  return [...groups.values()];
}

function aliasesForPerformance(record = {}) {
  return aliases([
    ["name", record.creativeTitle],
    ["name", record.creativeName],
    ["name", record.adName],
    ["filename", record.videoFilename],
    ["filename", record.filename],
    ["filename", record.originalFilename],
    ["id", record.creativeId],
    ["id", record.sourceCreativeId],
    ["id", record.adId],
    ["fingerprint", record.mediaFingerprint],
  ]);
}

function aliasesForSavedCreative(record = {}) {
  const payload = record.payload || {};
  const result = payload.result || payload.fullResult?.result || payload.fullResult || {};
  const display = result.display || payload.display || {};
  const media = result.media || {};
  const metadata = result.metadata || {};
  return aliases([
    ["name", record.title],
    ["name", payload.name],
    ["name", payload.creativeName],
    ["name", payload.displayTitle],
    ["name", display.displayTitle],
    ["filename", payload.originalFilename],
    ["filename", payload.fileName],
    ["filename", payload.videoFilename],
    ["filename", display.originalFilename],
    ["fingerprint", payload.mediaFingerprint],
    ["fingerprint", media.fingerprint],
    ["fingerprint", metadata.media_fingerprint],
    ["id", record.sourceId],
  ]);
}

function aliasesForAnalysis(record = {}) {
  const payload = record.payload || {};
  const result = payload.result || payload;
  const display = result.display || {};
  const media = result.media || {};
  const metadata = result.metadata || {};
  return aliases([
    ["filename", record.fileName],
    ["filename", display.originalFilename],
    ["name", display.displayTitle],
    ["name", display.generatedTitle],
    ["fingerprint", media.fingerprint],
    ["fingerprint", metadata.media_fingerprint],
  ]);
}

function aliasesForCreator(record = {}) {
  return aliases([
    ["handle", record.handle || record.creatorHandle],
    ["name", record.name || record.creatorName],
    ["name", record.normalizedName],
    ["handle", record.normalizedHandle],
  ], { stripAt: true });
}

function aliasesForCampaign(record = {}) {
  return aliases([
    ["name", record.name || record.campaignName],
    ["id", record.campaignId],
    ["id", record.externalCampaignId],
    ["name", record.normalizedName],
  ]);
}

function aliases(values, options) {
  return values
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([kind, value]) => ({
      kind,
      value: String(value).trim(),
      normalized: normalizeAssistantEntity(value, options),
    }))
    .filter((value) => value.normalized);
}

function preferredCreativeName({ analyses, performanceRows, savedCreatives }, fallback) {
  return performanceRows.map((row) => row.videoFilename || row.originalFilename || row.creativeTitle || row.adName || row.creativeId).find(Boolean) ||
    savedCreatives.map((row) => row.payload?.originalFilename || row.payload?.fileName || row.title).find(Boolean) ||
    analyses.map((row) => row.fileName || row.payload?.result?.display?.displayTitle).find(Boolean) ||
    fallback;
}

function uniqueAliases(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value.normalized || seen.has(value.normalized)) return false;
    seen.add(value.normalized);
    return true;
  });
}

function scopeData(data, shop) {
  return {
    ...data,
    analyses: scopeRows(data?.analyses, shop),
    campaigns: scopeRows(data?.campaigns, shop),
    creatives: scopeRows(data?.creatives, shop),
    creatorProfiles: scopeRows(data?.creatorProfiles, shop),
    googleCampaigns: scopeRows(data?.googleCampaigns, shop),
    googleConnection: !data?.googleConnection?.shop || normalizeShop(data.googleConnection.shop) === shop
      ? data?.googleConnection
      : null,
    performance: {
      ...(data?.performance || {}),
      dailyRecords: scopeRows(data?.performance?.dailyRecords, shop),
      records: scopeRows(data?.performance?.records, shop),
    },
  };
}

function scopeRows(rows = [], shop) {
  return (rows || []).filter((row) => !row?.shop || normalizeShop(row.shop) === shop);
}

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function sameValue(left, right) {
  return Boolean(left && right && normalizeAssistantEntity(left) === normalizeAssistantEntity(right));
}
