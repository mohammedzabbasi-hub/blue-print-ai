function present(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function first(record, keys) {
  for (const key of keys) {
    if (present(record?.[key])) return record[key];
  }
  return null;
}

function importedSum(records, keys) {
  const values = records
    .map((record) => first(record, keys))
    .filter(present);
  return values.length
    ? { imported: true, value: values.reduce((sum, value) => sum + number(value), 0) }
    : { imported: false, value: null };
}

function clean(value) {
  return String(value || "").trim();
}

function dateValue(record) {
  // Import/creation timestamps describe ingestion, not when performance happened.
  // Keeping this strict prevents undated rollups from becoming fake daily spikes.
  return first(record, ["reportingDate", "date"]);
}

export function isCreatorPerformanceRollup(record = {}) {
  return clean(record.sourceRecordType).toLowerCase() === "creator_performance_import" ||
    clean(record.sourceType).toLowerCase() === "creator_performance_csv";
}

export function partitionDashboardPerformanceRecords(records = []) {
  const creativeRecords = [];
  const creatorRollups = [];

  records.forEach((record) => {
    // Creator imports summarize creative rows and must remain available to creator
    // pages, but mixing grains here would double dashboard outcome metrics.
    if (isCreatorPerformanceRollup(record)) creatorRollups.push(record);
    else creativeRecords.push(record);
  });

  return { creativeRecords, creatorRollups };
}

export function buildDashboardEffectivenessRecords(performanceData = {}) {
  const storedRecords = (performanceData.records || []).filter(
    (record) => !["saved_creative", "video_analysis", "demo_performance"].includes(record.sourceRecordType),
  );
  return [...storedRecords, ...(performanceData.dailyRecords || [])];
}

export function hasReportingDate(record = {}) {
  return Boolean(dateKey(dateValue(record)));
}

export function filterPerformanceRecordsByDateRange(records = [], range = "30d", now = new Date()) {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  const endKey = dateKey(now);
  if (!days || !endKey) return records.filter(hasReportingDate);

  const start = new Date(`${endKey}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startKey = start.toISOString().slice(0, 10);

  return records.filter((record) => {
    const key = dateKey(dateValue(record));
    return key && key >= startKey && key <= endKey;
  });
}

function creativeIdentity(record) {
  const id = first(record, ["creativeId", "sourceCreativeId", "adId"]);
  const title = first(record, ["videoFilename", "creativeTitle", "adName", "title"]);
  return {
    key: clean(id || title || record?.id || "Imported creative"),
    label: clean(title || id || "Imported creative"),
  };
}

function dailyRecordKey(record) {
  const creative = creativeIdentity(record).key;
  const campaign = first(record, ["workspaceCampaignId", "campaignId", "sourceCampaignId", "workspaceCampaignName", "campaignName"]);
  return [platformLabel(record), clean(campaign), creative, dateKey(dateValue(record))]
    .join("|")
    .toLowerCase();
}

function recordCompleteness(record) {
  return ["views", "videoViews", "impressions", "clicks", "orders", "conversions", "revenue", "conversionValue", "spend"]
    .filter((key) => present(record?.[key])).length;
}

function dateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function platformLabel(record) {
  return clean(first(record, ["sourcePlatform", "platform", "sourceType"])) || "Imported";
}

export const EFFECTIVENESS_VIEWS = [
  { value: "all", label: "All imported ads/campaigns" },
  { value: "campaign", label: "By campaign" },
  { value: "creative", label: "By creative/ad" },
  { value: "creator", label: "By creator" },
  { value: "product", label: "By product" },
];

export const EFFECTIVENESS_METRICS = [
  { value: "revenue", label: "Revenue" },
  { value: "spend", label: "Spend" },
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR" },
  { value: "cvr", label: "CVR" },
  { value: "orders", label: "Orders" },
  { value: "clicks", label: "Clicks" },
  { value: "impressions", label: "Impressions" },
  { value: "reach", label: "Reach" },
  { value: "cpc", label: "CPC" },
  { value: "cpm", label: "CPM" },
  { value: "engagementRate", label: "Engagement rate" },
  { value: "videoViews", label: "Video views" },
];

export function groupIdentity(record, view, allRecords = []) {
  if (view === "campaign") {
    const id = first(record, ["workspaceCampaignId", "campaignId", "sourceCampaignId"]);
    const name = first(record, ["workspaceCampaignName", "campaignName", "adsetName", "adGroupName", "utmCampaign"]);
    if (id || name) {
      return { key: clean(id || name), label: clean(name || id) };
    }
    const dates = allRecords.map(dateValue).map(dateKey).filter(Boolean).sort();
    const range = dates.length ? `${dates[0]}–${dates.at(-1)}` : "undated";
    const fallback = `${platformLabel(record)} · ${range}`;
    return { key: fallback, label: fallback };
  }

  if (view === "creative") {
    const id = first(record, ["creativeId", "sourceCreativeId", "adId"]);
    const title = first(record, ["adName", "creativeTitle", "title", "videoFilename"]);
    const fallback = [
      first(record, ["productTitle", "productName", "productLabel"]),
      first(record, ["creatorHandle", "creatorName"]),
      dateValue(record),
    ].filter(Boolean).join(" · ") || record.id || "Imported creative";
    return {
      key: clean(id || title || fallback),
      label: clean(id && title && clean(id) !== clean(title) ? `${id} · ${title}` : title || id || fallback),
    };
  }

  if (view === "creator") {
    const value = first(record, ["creatorHandle", "creatorName"]);
    return { key: clean(value || "Unknown creator"), label: clean(value || "Unknown creator") };
  }

  const id = first(record, ["productId", "shopifyProductId"]);
  const name = first(record, ["productName", "productTitle", "productLabel", "product"]);
  return { key: clean(id || name || "Unknown product"), label: clean(name || id || "Unknown product") };
}

export function buildEffectivenessGroups(records = [], view = "creative") {
  const groups = new Map();
  records.forEach((record) => {
    const identity = groupIdentity(record, view, records);
    const current = groups.get(identity.key) || { ...identity, records: [] };
    current.records.push(record);
    groups.set(identity.key, current);
  });
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function aggregateEffectiveness(records = []) {
  const revenue = importedSum(records, ["revenue", "conversionValue"]);
  const spend = importedSum(records, ["spend"]);
  const impressions = importedSum(records, ["impressions"]);
  const reach = importedSum(records, ["reach"]);
  const views = importedSum(records, ["videoViews", "views"]);
  const clicks = importedSum(records, ["clicks"]);
  const orders = importedSum(records, ["orders", "conversions"]);
  const likes = importedSum(records, ["likes"]);
  const comments = importedSum(records, ["comments"]);
  const shares = importedSum(records, ["shares"]);
  const saves = importedSum(records, ["saves"]);
  const explicitEngagements = importedSum(records, ["engagementCount", "engagements"]);
  const engagementPartsImported = likes.imported || comments.imported || shares.imported || saves.imported;
  const componentEngagements = engagementPartsImported
    ? number(likes.value) + number(comments.value) + number(shares.value) + number(saves.value)
    : null;
  const engagements = explicitEngagements.imported && (explicitEngagements.value > 0 || !engagementPartsImported)
    ? explicitEngagements.value
    : engagementPartsImported
      ? componentEngagements
      : null;
  const engagementDenominator =
    impressions.imported && impressions.value > 0 ? impressions.value : views.value;

  const calculated = (requirements, value) =>
    requirements ? { imported: true, value } : { imported: false, value: null };

  return {
    recordCount: records.length,
    revenue,
    spend,
    impressions,
    reach,
    videoViews: views,
    clicks,
    orders,
    likes,
    comments,
    shares,
    saves,
    engagements: { imported: engagements !== null, value: engagements },
    roas: calculated(revenue.imported && spend.imported && spend.value > 0, revenue.value / spend.value),
    ctr: calculated(
      clicks.imported && impressions.imported && impressions.value > 0,
      (clicks.value / impressions.value) * 100,
    ),
    cvr: calculated(orders.imported && clicks.imported && clicks.value > 0, (orders.value / clicks.value) * 100),
    engagementRate: calculated(
      engagements !== null && engagementDenominator > 0,
      (engagements / engagementDenominator) * 100,
    ),
    cpc: calculated(spend.imported && clicks.imported && clicks.value > 0, spend.value / clicks.value),
    cpm: calculated(
      spend.imported && impressions.imported && impressions.value > 0,
      (spend.value / impressions.value) * 1000,
    ),
    costPerOrder: calculated(spend.imported && orders.imported && orders.value > 0, spend.value / orders.value),
    hasPublicEngagement: views.imported || impressions.imported || engagementPartsImported,
    hasCommercialMetrics: revenue.imported || spend.imported || clicks.imported || orders.imported,
  };
}

export function dedupeDailyPerformanceRecords(records = []) {
  const byCreativeDate = new Map();
  records.forEach((record) => {
    const key = dailyRecordKey(record);
    const current = byCreativeDate.get(key);
    if (!current || recordCompleteness(record) >= recordCompleteness(current)) {
      byCreativeDate.set(key, record);
    }
  });
  return [...byCreativeDate.values()];
}

export function filterEffectivenessRecords(records = [], view = "all", key = "") {
  if (view === "all" || !key) return records;
  return records.filter((record) => groupIdentity(record, view, records).key === key);
}

export function comparisonGroups(records = []) {
  const hasCampaigns = records.some((record) =>
    first(record, ["campaignId", "sourceCampaignId", "campaignName", "adsetName", "adGroupName"]),
  );
  return buildEffectivenessGroups(records, hasCampaigns ? "campaign" : "creative");
}

export function metricNumber(summary, metric) {
  return summary?.[metric]?.imported ? number(summary[metric].value) : null;
}

export function buildTrendRows(records = [], { cumulative = false } = {}) {
  const byDate = new Map();
  dedupeDailyPerformanceRecords(records).forEach((record) => {
    const rawDate = dateValue(record);
    if (!rawDate) return;
    const date = dateKey(rawDate);
    const current = byDate.get(date) || [];
    current.push(record);
    byDate.set(date, current);
  });
  const dated = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  let running = [];
  return dated.map(([date, rows]) => {
    running = cumulative ? [...running, ...rows] : rows;
    return { date, label: date.slice(5), records: rows, summary: aggregateEffectiveness(running) };
  });
}

export function buildCreativeLaunchMarkers(records = []) {
  const launches = new Map();
  dedupeDailyPerformanceRecords(records).forEach((record) => {
    const creative = creativeIdentity(record);
    const launchDate = dateKey(first(record, ["creativeLaunchDate", "launchDate", "firstSeenDate"]) || dateValue(record));
    if (!launchDate) return;
    const current = launches.get(creative.key);
    if (!current || launchDate < current.date) {
      launches.set(creative.key, { creativeKey: creative.key, date: launchDate, label: `${creative.label} launched` });
    }
  });
  return [...launches.values()].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

export function trendAvailability(records = []) {
  const reportingDates = new Set(
    dedupeDailyPerformanceRecords(records).map(dateValue).map(dateKey).filter(Boolean),
  );
  return {
    dateCount: reportingDates.size,
    isSparse: reportingDates.size === 1,
    hasTrend: reportingDates.size > 1,
  };
}

export function performanceInsight(records = []) {
  const groups = buildEffectivenessGroups(records, "creative");
  if (!groups.length) return "Import creative performance records to unlock comparisons.";
  const ranked = groups.map((group) => ({ ...group, summary: aggregateEffectiveness(group.records) }));
  const roas = ranked.filter((group) => group.summary.roas.imported).sort((a, b) => b.summary.roas.value - a.summary.roas.value);
  if (roas.length) return `Best performer by ROAS: ${roas[0].label} · ${roas[0].summary.roas.value.toFixed(2)}x`;
  const engagement = ranked.filter((group) => group.summary.engagementRate.imported).sort((a, b) => b.summary.engagementRate.value - a.summary.engagementRate.value);
  if (engagement.length) return `Highest engagement: ${engagement[0].label} · ${engagement[0].summary.engagementRate.value.toFixed(2)}% engagement rate`;
  return "Import more dated rows to unlock trend analysis.";
}
