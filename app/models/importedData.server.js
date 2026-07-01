import db from "../db.server.js";
import { parseCsvRecords } from "../utils/csv.server.js";
import { IMPORT_TABLES } from "../utils/importTables.js";

export { IMPORT_TABLES } from "../utils/importTables.js";

function toFloat(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toInt(value) {
  const number = toFloat(value);
  return number === null ? null : Math.round(number);
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function externalIdFor(record) {
  const explicit = record.id || record.external_id || record.externalid;
  if (explicit) return String(explicit).trim();

  const stable = Object.keys(record)
    .sort()
    .map((key) => `${key}=${record[key]}`)
    .join("|");

  return `row-${fnv1aHash(stable)}`;
}

function mapProductRow(record) {
  return {
    title: record.title || record.name || "Untitled product",
    price: toFloat(record.price),
    currency: record.currency || null,
    inventory: toInt(record.inventory),
    status: record.status || null,
    imageUrl: record.image_url || null,
    category: record.category || null,
  };
}

function mapOrderRow(record) {
  return {
    productExternalId: record.product_id || null,
    productTitle: record.product_title || null,
    amount: toFloat(record.amount) || 0,
    currency: record.currency || null,
    orderedAt: toDate(record.ordered_at || record.date),
  };
}

function mapCreatorRow(record) {
  return {
    name: record.name || "Unnamed creator",
    handle: record.handle || record.tiktok_handle || null,
    platform: record.platform || null,
    status: record.status || null,
    followers: toInt(record.followers || record.follower_count),
    totalViews: toInt(record.total_views || record.views),
    totalLikes: toInt(record.total_likes || record.likes),
    totalComments: toInt(record.total_comments || record.comments),
    totalShares: toInt(record.total_shares || record.shares),
    totalOrders: toInt(record.total_orders || record.orders || record.total_conversions || record.conversions),
    totalRevenue: toFloat(record.total_revenue || record.revenue),
    notes: record.notes || null,
  };
}

function mapCreativeRow(record) {
  return {
    title: record.title || "Untitled creative",
    productExternalId: record.product_id || null,
    productTitle: record.product_title || null,
    creatorHandle: record.creator_handle || record.creator || null,
    platform: record.platform || null,
    views: toInt(record.views),
    likes: toInt(record.likes),
    shares: toInt(record.shares),
    clicks: toInt(record.clicks),
    orders: toInt(record.orders),
    revenue: toFloat(record.revenue),
    hookType: record.hook_type || null,
    mediaUrl: record.media_url || record.video_url || null,
  };
}

function mapMetricRow(record) {
  return {
    date: toDate(record.date),
    scope: record.scope || "account",
    refId: record.ref_id || null,
    views: toInt(record.views),
    clicks: toInt(record.clicks),
    orders: toInt(record.orders),
    revenue: toFloat(record.revenue),
    spend: toFloat(record.spend),
  };
}

const TABLE_CONFIG = {
  products: { model: () => db.importedProduct, mapRow: mapProductRow },
  orders: { model: () => db.importedOrder, mapRow: mapOrderRow },
  creators: { model: () => db.importedCreator, mapRow: mapCreatorRow },
  creatives: { model: () => db.importedCreative, mapRow: mapCreativeRow },
  metrics: { model: () => db.importedMetric, mapRow: mapMetricRow },
};

function normalizeJsonRecord(record) {
  const normalized = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, "_");
    normalized[normalizedKey] = value === null || value === undefined ? "" : String(value);
  });
  return normalized;
}

export async function importRows(shop, table, records) {
  const config = TABLE_CONFIG[table];

  if (!config) {
    return { table, inserted: 0, skipped: 0, errors: [`"${table}" is not an importable table.`] };
  }

  const model = config.model();
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const record of records) {
    try {
      const externalId = externalIdFor(record);
      const existing = await model.findUnique({
        where: { shop_externalId: { shop, externalId } },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await model.create({
        data: {
          shop,
          externalId,
          ...config.mapRow(record),
        },
      });
      inserted += 1;
    } catch (error) {
      errors.push(error.message || "A row could not be imported.");
    }
  }

  return { table, inserted, skipped, errors };
}

export async function importCsvText(shop, table, csvText) {
  const records = parseCsvRecords(csvText);

  if (records.length === 0) {
    return { table, inserted: 0, skipped: 0, errors: ["The CSV file had no data rows."] };
  }

  return importRows(shop, table, records);
}

export async function importJsonBundleText(shop, jsonText) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return { results: [], errors: ["The JSON file could not be parsed."] };
  }

  const results = [];

  for (const table of IMPORT_TABLES) {
    const records = Array.isArray(parsed?.[table]) ? parsed[table] : [];
    if (records.length === 0) continue;

    results.push(await importRows(shop, table, records.map(normalizeJsonRecord)));
  }

  return { results, errors: [] };
}

export async function getImportSummary(shop) {
  const [products, orders, creators, creatives, metrics] = await Promise.all([
    db.importedProduct.count({ where: { shop } }),
    db.importedOrder.count({ where: { shop } }),
    db.importedCreator.count({ where: { shop } }),
    db.importedCreative.count({ where: { shop } }),
    db.importedMetric.count({ where: { shop } }),
  ]);

  return { products, orders, creators, creatives, metrics };
}

export async function clearImportedData(shop) {
  await db.$transaction([
    db.importedProduct.deleteMany({ where: { shop } }),
    db.importedOrder.deleteMany({ where: { shop } }),
    db.importedCreator.deleteMany({ where: { shop } }),
    db.importedCreative.deleteMany({ where: { shop } }),
    db.importedMetric.deleteMany({ where: { shop } }),
  ]);
}

export async function listImportedProducts(shop, limit = 200) {
  return db.importedProduct.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function listImportedOrders(shop, limit = 500) {
  return db.importedOrder.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function listImportedCreators(shop, limit = 200) {
  return db.importedCreator.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function listImportedCreatives(shop, limit = 200) {
  return db.importedCreative.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function listImportedMetrics(shop, limit = 1000) {
  return db.importedMetric.findMany({ where: { shop }, orderBy: { createdAt: "asc" }, take: limit });
}

export async function findImportedCreator(shop, id) {
  return db.importedCreator.findFirst({ where: { shop, id } });
}

export async function findImportedCreative(shop, id) {
  return db.importedCreative.findFirst({ where: { shop, id } });
}

// Real, transparent formulas over imported numbers only (no synthetic scoring).
export function computeCreativeMetrics(creative) {
  const views = Number(creative.views || 0);
  const clicks = Number(creative.clicks || 0);
  const orders = Number(creative.orders || 0);
  const revenue = Number(creative.revenue || 0);

  return {
    ctr: views > 0 ? (clicks / views) * 100 : null,
    conversionRate: clicks > 0 ? (orders / clicks) * 100 : null,
    revenuePerOrder: orders > 0 ? revenue / orders : null,
  };
}

export function computeCreatorEngagement(creator) {
  const views = Number(creator.totalViews || 0);
  const engagementActions =
    Number(creator.totalLikes || 0) + Number(creator.totalComments || 0) + Number(creator.totalShares || 0);

  return {
    engagementActions,
    engagementRate: views > 0 ? (engagementActions / views) * 100 : null,
  };
}

export async function buildImportedCreators(shop) {
  const creators = await listImportedCreators(shop);

  return creators
    .map((creator) => ({
      ...creator,
      ...computeCreatorEngagement(creator),
    }))
    .sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0));
}

export async function buildImportedCreatives(shop) {
  const creatives = await listImportedCreatives(shop);

  return creatives
    .map((creative) => ({
      ...creative,
      ...computeCreativeMetrics(creative),
    }))
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
}

export async function buildImportedDashboard(shop) {
  const [creatives, creators, orders, metrics, summary] = await Promise.all([
    listImportedCreatives(shop),
    listImportedCreators(shop),
    listImportedOrders(shop),
    listImportedMetrics(shop),
    getImportSummary(shop),
  ]);

  const hasImportedData = Object.values(summary).some((count) => count > 0);

  const creativeTotals = creatives.reduce(
    (acc, creative) => {
      acc.views += Number(creative.views || 0);
      acc.clicks += Number(creative.clicks || 0);
      acc.orders += Number(creative.orders || 0);
      acc.revenue += Number(creative.revenue || 0);
      return acc;
    },
    { views: 0, clicks: 0, orders: 0, revenue: 0 },
  );

  const metricTotals = metrics.reduce(
    (acc, metric) => {
      acc.views += Number(metric.views || 0);
      acc.clicks += Number(metric.clicks || 0);
      acc.orders += Number(metric.orders || 0);
      acc.revenue += Number(metric.revenue || 0);
      acc.spend += Number(metric.spend || 0);
      return acc;
    },
    { views: 0, clicks: 0, orders: 0, revenue: 0, spend: 0 },
  );

  const ordersRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);

  const totalViews = creativeTotals.views || metricTotals.views;
  const totalClicks = creativeTotals.clicks || metricTotals.clicks;
  const totalOrders = creativeTotals.orders || orders.length || metricTotals.orders;
  const totalRevenue = creativeTotals.revenue || ordersRevenue || metricTotals.revenue;

  const avgCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
  const avgRoas = metricTotals.spend > 0 ? totalRevenue / metricTotals.spend : 0;

  const hookTally = {};
  creatives.forEach((creative) => {
    if (!creative.hookType) return;
    hookTally[creative.hookType] = (hookTally[creative.hookType] || 0) + 1;
  });

  const topCreatives = [...creatives]
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
    .slice(0, 8)
    .map((creative) => {
      const derived = computeCreativeMetrics(creative);

      return {
        id: creative.id,
        title: creative.title,
        product: creative.productTitle,
        creator: creative.creatorHandle,
        hook_type: creative.hookType,
        views: creative.views || 0,
        clicks: creative.clicks || 0,
        orders: creative.orders || 0,
        revenue: creative.revenue || 0,
        ctr: derived.ctr,
      };
    });

  const seriesByDate = new Map();
  metrics
    .filter((metric) => metric.date)
    .forEach((metric) => {
      const key = metric.date.toISOString().slice(0, 10);
      const existing = seriesByDate.get(key) || { date: key, views: 0, clicks: 0, orders: 0, revenue: 0 };
      existing.views += Number(metric.views || 0);
      existing.clicks += Number(metric.clicks || 0);
      existing.orders += Number(metric.orders || 0);
      existing.revenue += Number(metric.revenue || 0);
      seriesByDate.set(key, existing);
    });

  const series = Array.from(seriesByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasImportedData,
    summary,
    creatorCount: creators.length,
    totals: {
      views: totalViews,
      clicks: totalClicks,
      orders: totalOrders,
      revenue: totalRevenue,
      ctr: avgCtr,
      roas: avgRoas,
    },
    patterns: {
      hooks: hookTally,
    },
    topCreatives,
    series,
  };
}
