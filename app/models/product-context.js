const GENERIC_PRODUCT_NAMES = new Set([
  "imported product",
  "manual product",
  "product",
  "uploaded product",
]);

function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function slugify(value) {
  return cleanName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function payloadFor(record = {}) {
  return record.payload && typeof record.payload === "object" ? record.payload : {};
}

function firstValue(record, ...keys) {
  const payload = payloadFor(record);
  for (const key of keys) {
    const value = record[key] ?? payload[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberFrom(record, ...keys) {
  return nullableNumber(firstValue(record, ...keys));
}

function sumAvailable(records, ...keys) {
  const values = records
    .map((record) => numberFrom(record, ...keys))
    .filter((value) => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function averageAvailable(records, ...keys) {
  const values = records
    .map((record) => numberFrom(record, ...keys))
    .filter((value) => value !== null);
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function rate(numerator, denominator, fallback) {
  if (numerator !== null && denominator !== null && denominator > 0) {
    return Math.round((numerator / denominator) * 10000) / 100;
  }
  return fallback === null ? null : Math.round(fallback * 100) / 100;
}

function ratio(numerator, denominator, fallback) {
  if (numerator !== null && denominator !== null && denominator > 0) {
    return Math.round((numerator / denominator) * 100) / 100;
  }
  return fallback === null ? null : Math.round(fallback * 100) / 100;
}

function uniqueText(records, ...keys) {
  const values = new Map();
  for (const record of records) {
    const value = cleanName(firstValue(record, ...keys));
    const key = value.toLowerCase().replace(/^@/, "");
    if (value && !values.has(key)) values.set(key, value);
  }
  return [...values.values()];
}

function importedProductName(record = {}) {
  return cleanName(
    firstValue(record, "productTitle", "productName", "productLabel", "productHandle"),
  );
}

function isImportedRecord(record = {}) {
  const source = [
    record.importSource,
    record.sourceRecordType,
    record.sourceType,
    record.syncStatus,
    record.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /import|csv|merchant_provided/.test(source);
}

function dateRange(records) {
  const dates = records
    .map((record) => firstValue(record, "reportingDate", "date", "importedAt"))
    .filter((value) => value !== null)
    .map((value) => ({ date: new Date(value), value }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.date - right.date);

  if (!dates.length) return null;
  return {
    start: dates[0].date.toISOString(),
    end: dates[dates.length - 1].date.toISOString(),
  };
}

function creativeSnapshot(record) {
  const name = cleanName(firstValue(record, "creativeTitle", "adName", "creativeName", "title"));
  const id = firstValue(record, "creativeId", "adId", "sourceCreativeId", "id");
  if (!name && !id) return null;

  return {
    id: id || null,
    name: name || null,
    creatorName: cleanName(firstValue(record, "creatorName", "creator")) || null,
    creatorHandle: cleanName(firstValue(record, "creatorHandle")) || null,
    impressions: numberFrom(record, "impressions"),
    clicks: numberFrom(record, "clicks"),
    orders: numberFrom(record, "orders"),
    conversions: numberFrom(record, "conversions"),
    revenue: numberFrom(record, "revenue", "conversionValue"),
    spend: numberFrom(record, "spend"),
    ctr: numberFrom(record, "ctr"),
    cvr: numberFrom(record, "cvr", "conversionRate"),
    roas: numberFrom(record, "roas"),
  };
}

function bestCreative(records) {
  const ranked = records
    .map((record) => ({ record, snapshot: creativeSnapshot(record) }))
    .filter(({ snapshot }) => snapshot)
    .sort((left, right) => {
      const leftMetrics = [left.snapshot.roas, left.snapshot.revenue, left.snapshot.orders ?? left.snapshot.conversions, left.snapshot.clicks, left.snapshot.impressions];
      const rightMetrics = [right.snapshot.roas, right.snapshot.revenue, right.snapshot.orders ?? right.snapshot.conversions, right.snapshot.clicks, right.snapshot.impressions];
      for (let index = 0; index < leftMetrics.length; index += 1) {
        const difference = (rightMetrics[index] ?? -Infinity) - (leftMetrics[index] ?? -Infinity);
        if (difference) return difference;
      }
      return 0;
    });
  return ranked[0]?.snapshot || null;
}

function emptyPerformanceContext() {
  return {
    relatedCreativeCount: null,
    creatorNames: [],
    creatorHandles: [],
    impressions: null,
    clicks: null,
    orders: null,
    conversions: null,
    revenue: null,
    spend: null,
    ctr: null,
    cvr: null,
    roas: null,
    bestPerformingCreative: null,
    dateRange: null,
  };
}

function normalizeCatalogProduct(product = {}) {
  const source = product.source === "demo" ? "demo" : "shopify";
  const title = cleanName(product.title || product.productName);
  return {
    ...product,
    id: product.id || `${source}-product:${slugify(title)}`,
    title,
    productName: title,
    source,
    sourceLabel: source === "demo" ? "Demo product" : "Shopify product",
    ...emptyPerformanceContext(),
  };
}

function buildImportedProduct(productName, records) {
  const impressions = sumAvailable(records, "impressions");
  const clicks = sumAvailable(records, "clicks");
  const orders = sumAvailable(records, "orders");
  const conversions = sumAvailable(records, "conversions");
  const revenue = sumAvailable(records, "revenue", "conversionValue");
  const spend = sumAvailable(records, "spend");
  const conversionOutcome = conversions ?? orders;

  return {
    id: `imported-product:${slugify(productName)}`,
    title: productName,
    productName,
    handle: slugify(productName),
    status: "IMPORTED",
    source: "imported",
    sourceLabel: "Imported product context",
    description: null,
    category: null,
    productType: null,
    vendor: null,
    price: null,
    priceRange: null,
    featuredImage: null,
    images: null,
    relatedCreativeCount: records.length,
    creatorNames: uniqueText(records, "creatorName", "creator"),
    creatorHandles: uniqueText(records, "creatorHandle"),
    impressions,
    clicks,
    orders,
    conversions,
    revenue,
    spend,
    ctr: rate(clicks, impressions, averageAvailable(records, "ctr")),
    cvr: rate(conversionOutcome, clicks, averageAvailable(records, "cvr", "conversionRate")),
    roas: ratio(revenue, spend, averageAvailable(records, "roas")),
    bestPerformingCreative: bestCreative(records),
    dateRange: dateRange(records),
  };
}

export function importedProductNamesFromRecords(records = []) {
  const names = new Map();

  for (const record of records) {
    if (!isImportedRecord(record)) continue;
    const name = importedProductName(record);
    const key = name.toLowerCase();

    if (!name || GENERIC_PRODUCT_NAMES.has(key) || names.has(key)) continue;
    names.set(key, name);
  }

  return [...names.values()];
}

export function buildProductContext({
  shopifyProducts = [],
  performanceRecords = [],
} = {}) {
  const catalogProducts = shopifyProducts.map(normalizeCatalogProduct);
  const realShopifyProducts = catalogProducts.filter((product) => product.source === "shopify");
  const demoProducts = catalogProducts.filter((product) => product.source === "demo");
  const importedRecords = performanceRecords.filter(isImportedRecord);
  const importedProductNames = importedProductNamesFromRecords(importedRecords);
  const existingNames = new Set(
    catalogProducts.map((product) => cleanName(product.title).toLowerCase()),
  );
  const importedProducts = importedProductNames
    .filter((name) => !existingNames.has(name.toLowerCase()))
    .map((name) => buildImportedProduct(
      name,
      importedRecords.filter(
        (record) => importedProductName(record).toLowerCase() === name.toLowerCase(),
      ),
    ));
  const hasShopifyProducts = realShopifyProducts.length > 0;
  const hasImportedProductContext = importedProductNames.length > 0;
  const hasDemoProductContext = demoProducts.length > 0;
  const productContextSource = hasShopifyProducts
    ? "shopify"
    : hasImportedProductContext
      ? "imported"
      : hasDemoProductContext
        ? "demo"
        : "none";

  return {
    shopifyProductsCount: realShopifyProducts.length,
    importedProductNamesCount: importedProductNames.length,
    hasShopifyProducts,
    hasImportedProductContext,
    hasDemoProductContext,
    hasAnyProductContext:
      hasShopifyProducts || hasImportedProductContext || hasDemoProductContext,
    productContextSource,
    importedProductNames,
    importedProducts,
    shopifyProducts: realShopifyProducts,
    demoProducts,
    availableProducts: [
      ...realShopifyProducts,
      ...importedProducts,
      ...demoProducts,
    ],
  };
}

export function productContextLabel(productContext = {}) {
  if (productContext.productContextSource === "shopify") return "Shopify product";
  if (productContext.productContextSource === "imported") return "Imported product context";
  if (productContext.productContextSource === "demo") return "Demo product";
  return "No product context";
}

export function buildDashboardDataSourceSummary(
  productContext = {},
  { hasUploadedData = false } = {},
) {
  const items = [];

  if (productContext.hasShopifyProducts) {
    const count = Number(productContext.shopifyProductsCount || 0);
    items.push({
      id: "shopify_products",
      active: true,
      label: `Using ${count} Shopify ${count === 1 ? "product" : "products"}`,
    });
  }

  if (productContext.hasImportedProductContext) {
    const count = Number(productContext.importedProductNamesCount || 0);
    items.push({
      id: "imported_products",
      active: true,
      label: `Using ${count} imported ${count === 1 ? "product" : "products"}`,
    });
  }

  if (!productContext.hasShopifyProducts && !productContext.hasImportedProductContext) {
    items.push({
      id: "no_product_context",
      active: false,
      label: "No active product context yet",
    });
  }

  items.push({
    id: "manual_uploads",
    active: hasUploadedData,
    label: hasUploadedData ? "Using manual uploads" : "Manual upload available",
  });

  const hasProductContext = Boolean(
    productContext.hasShopifyProducts || productContext.hasImportedProductContext,
  );

  return {
    heading: hasProductContext
      ? "Your workspace is ready to use"
      : "Choose a product context to get started",
    description: hasProductContext
      ? "BluePrintAI is prioritizing the product and creative data available now."
      : "Import product names from a CSV, sync Shopify products, or upload a creative to begin.",
    items,
  };
}

export function buildProductContextEvidence(productContext = {}, product = null) {
  const selected = product || productContext.availableProducts?.[0] || null;
  const source = ["shopify", "imported", "demo"].includes(selected?.source)
    ? selected.source
    : product
      ? "none"
      : productContext.productContextSource || "none";
  const sourceLabel = {
    shopify: "Shopify product",
    imported: "Imported product context",
    demo: "Demo product",
    none: "No product context",
  }[source] || "No product context";
  const explanation = {
    shopify: "Real catalog product data loaded from Shopify.",
    imported: "Product name and available performance evidence from CSV/ad imports; this is not a Shopify catalog record.",
    demo: "Sample product and performance context for demonstration only.",
    none: "No Shopify products or imported product names are available.",
  }[source] || "No Shopify products or imported product names are available.";

  return {
    product: selected,
    productName: selected?.productName || selected?.title || "Not available",
    source,
    sourceLabel,
    explanation,
  };
}
