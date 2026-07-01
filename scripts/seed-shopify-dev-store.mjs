#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const seedDir = path.join(rootDir, "seed");

const DEV_STORE_DOMAIN = "blueprintai-test-store.myshopify.com";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";
const DEMO_TAGS = ["blueprintai-demo", "final-review-demo", "seeded-by-blueprintai"];
const ORDER_DEMO_TAGS = [...DEMO_TAGS, "not-real-customer-purchase"];
const DEMO_NOTE = "BluePrintAI final review demo record. Not a real customer purchase.";
const ORDER_CREATE_DELAY_MS = 13000;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const queries = {
  shopInfo: `#graphql
    query SeedShopInfo {
      shop {
        name
        myshopifyDomain
      }
    }
  `,
  findProduct: `#graphql
    query FindSeedProduct($query: String!) {
      products(first: 1, query: $query) {
        nodes {
          id
          title
          handle
          tags
          variants(first: 1) {
            nodes {
              id
              sku
            }
          }
        }
      }
    }
  `,
  upsertProduct: `#graphql
    mutation UpsertSeedProduct($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product {
          id
          title
          handle
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
  findCustomer: `#graphql
    query FindSeedCustomer($query: String!) {
      customers(first: 1, query: $query) {
        nodes {
          id
          defaultEmailAddress {
            emailAddress
          }
          tags
        }
      }
    }
  `,
  upsertCustomer: `#graphql
    mutation UpsertSeedCustomer($identifier: CustomerSetIdentifiers, $input: CustomerSetInput!) {
      customerSet(identifier: $identifier, input: $input) {
        customer {
          id
          defaultEmailAddress {
            emailAddress
          }
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
  findDraftOrder: `#graphql
    query FindSeedDraftOrder($query: String!) {
      draftOrders(first: 1, query: $query) {
        nodes {
          id
          name
          tags
          status
        }
      }
    }
  `,
  createDraftOrder: `#graphql
    mutation CreateSeedDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          tags
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
  findOrder: `#graphql
    query FindSeedOrder($query: String!) {
      orders(first: 1, query: $query) {
        nodes {
          id
          name
          tags
          displayFinancialStatus
        }
      }
    }
  `,
  createOrder: `#graphql
    mutation CreateSeedOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order {
          id
          name
          tags
          displayFinancialStatus
          displayFulfillmentStatus
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
};

await main();

async function main() {
  await loadDotEnv();

  const shop = normalizeShop(process.env.SHOPIFY_SHOP || DEV_STORE_DOMAIN);
  guardDevStore(shop);

  const products = await readCsv("shopify-dev-store-products.csv");
  const customers = await readCsv("shopify-dev-store-customers.csv");
  const orders = await readCsv("shopify-dev-store-orders.csv");
  const analyticsOrders = await readOptionalCsv("shopify-dev-store-analytics-orders.csv");

  const summary = {
    products: { created: 0, updated: 0, skipped: 0 },
    customers: { created: 0, updated: 0, skipped: 0 },
    draftOrders: { created: 0, skipped: 0 },
    completedOrders: { created: 0, skipped: 0 },
    localOnlyOrders: { skipped: 0 },
    testOrders: { created: 0, skipped: 0 },
    warnings: [],
  };

  const accessToken = dryRun
    ? process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || null
    : await resolveAccessToken(shop);

  const client = accessToken ? createAdminClient(shop, accessToken) : null;

  if (!dryRun && !client) {
    printMissingTokenInstructions(shop);
    process.exitCode = 1;
    return;
  }

  if (client) {
    const shopInfo = await client.graphql(queries.shopInfo);
    const actualShop = normalizeShop(shopInfo.data?.shop?.myshopifyDomain || "");
    guardDevStore(actualShop);
    console.log(`Connected to ${shopInfo.data.shop.name} (${actualShop}) using Admin API ${API_VERSION}.`);
  } else {
    console.log(`Dry run for ${shop}; no Admin API token was required.`);
  }

  const productByHandle = new Map();
  for (const row of products) {
    const result = await seedProduct({ client, row, summary });
    if (result?.handle) productByHandle.set(result.handle, result);
  }

  const customerByEmail = new Map();
  for (const row of customers) {
    const result = await seedCustomer({ client, row, summary });
    if (result?.email) customerByEmail.set(result.email.toLowerCase(), result);
  }

  for (const row of [...orders, ...analyticsOrders]) {
    await seedOrder({
      client,
      customerByEmail,
      productByHandle,
      row,
      summary,
    });
  }

  printSummary(summary);
}

async function seedProduct({ client, row, summary }) {
  const handle = row.handle?.trim();
  if (!handle) {
    summary.products.skipped += 1;
    summary.warnings.push("Skipped product row with no handle.");
    return null;
  }

  const existing = dryRun ? null : await findProduct(client, handle);
  if (existing && !hasDemoTag(existing.tags)) {
    summary.products.skipped += 1;
    summary.warnings.push(
      `Skipped existing product ${handle}; it is not tagged as BluePrintAI demo data.`,
    );
    return {
      handle,
      title: existing.title,
      variantId: existing.variants?.nodes?.[0]?.id || null,
      price: row.price,
    };
  }

  const variant = {
    sku: row.sku,
    price: String(row.price || "0.00"),
    optionValues: [{ optionName: "Title", name: "Default Title" }],
    inventoryPolicy: "DENY",
  };
  const existingVariantId = existing?.variants?.nodes?.[0]?.id;
  if (existingVariantId) variant.id = existingVariantId;

  const tags = mergeTags(row.tags, DEMO_TAGS);
  const input = {
    title: row.title,
    handle,
    vendor: row.vendor,
    productType: row.productType,
    descriptionHtml: row.description,
    status: normalizeProductStatus(row.status),
    tags,
    productOptions: [
      {
        name: "Title",
        position: 1,
        values: [{ name: "Default Title" }],
      },
    ],
    variants: [variant],
    metafields: [
      {
        namespace: "blueprintai",
        key: "seed_handle",
        type: "single_line_text_field",
        value: handle,
      },
    ],
  };

  if (process.env.SHOPIFY_LOCATION_ID && row.inventoryQuantity) {
    variant.inventoryQuantities = [
      {
        locationId: process.env.SHOPIFY_LOCATION_ID,
        name: "available",
        quantity: Number(row.inventoryQuantity),
      },
    ];
  } else if (row.inventoryQuantity) {
    summary.warnings.push(
      `Inventory quantity for ${handle} was not set because SHOPIFY_LOCATION_ID is not configured.`,
    );
  }

  if (row.imageUrl) {
    summary.warnings.push(
      `Image URL for ${handle} is present but skipped by this safe seeder; add media manually if needed: ${row.imageUrl}`,
    );
  }

  if (dryRun) {
    summary.products.created += 1;
    console.log(`[dry-run] Would upsert product ${handle} (${row.title}).`);
    return { handle, title: row.title, variantId: null, price: row.price };
  }

  const response = await client.graphql(queries.upsertProduct, {
    identifier: { handle },
    input,
  });
  assertNoUserErrors("productSet", response.data?.productSet?.userErrors);

  if (existing) summary.products.updated += 1;
  else summary.products.created += 1;

  const product = response.data.productSet.product;
  console.log(`${existing ? "Updated" : "Created"} product ${product.handle} (${product.title}).`);
  const refreshed = await findProduct(client, handle);

  return {
    handle,
    title: product.title,
    variantId: refreshed?.variants?.nodes?.[0]?.id || null,
    price: row.price,
  };
}

async function seedCustomer({ client, row, summary }) {
  const email = row.email?.trim().toLowerCase();
  if (!email || !email.endsWith("@example.com")) {
    summary.customers.skipped += 1;
    summary.warnings.push(`Skipped customer with unsafe or missing email: ${row.email || "(blank)"}.`);
    return null;
  }

  const input = {
    email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone || null,
    tags: mergeTags(row.tags, DEMO_TAGS),
    note: "BluePrintAI seeded demo customer for final review testing.",
    addresses: [
      {
        address1: row.address1,
        city: row.city,
        province: row.province,
        country: row.country,
        zip: row.zip,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone || null,
      },
    ],
  };

  if (dryRun) {
    summary.customers.created += 1;
    console.log(`[dry-run] Would upsert customer ${email}.`);
    return { email, id: null };
  }

  const existing = await findCustomer(client, email);
  if (existing && !hasDemoTag(existing.tags)) {
    summary.customers.skipped += 1;
    summary.warnings.push(
      `Skipped existing customer ${email}; it is not tagged as BluePrintAI demo data.`,
    );
    return { email, id: existing.id };
  }

  const response = await client.graphql(queries.upsertCustomer, {
    identifier: { email },
    input,
  });
  assertNoUserErrors("customerSet", response.data?.customerSet?.userErrors);

  if (existing) summary.customers.updated += 1;
  else summary.customers.created += 1;

  const customer = response.data.customerSet.customer;
  console.log(`${existing ? "Updated" : "Created"} customer ${email}.`);

  return { email, id: customer.id };
}

async function seedOrder({ client, customerByEmail, productByHandle, row, summary }) {
  const orderName = row.orderName?.trim();
  if (!orderName) {
    summary.draftOrders.skipped += 1;
    summary.warnings.push("Skipped order row with no orderName.");
    return;
  }

  const createAs = normalizeCreateAs(row.createAs);

  if (createAs === "local_blueprintai_performance_only") {
    summary.localOnlyOrders.skipped += 1;
    console.log(`${dryRun ? "[dry-run] Would skip" : "Skipped"} Shopify order ${orderName}; local BluePrintAI performance seed handles this row.`);
    return;
  }

  if (createAs === "test_order") {
    summary.testOrders.skipped += 1;
    summary.warnings.push(
      `Skipping test order creation for ${orderName}; use completed_demo_order rows for Shopify-supported orderCreate test records.`,
    );
    return;
  }

  const product = productByHandle.get(row.productHandle);
  if (!product) {
    summary.draftOrders.skipped += 1;
    summary.warnings.push(`Skipped ${orderName}; product ${row.productHandle} was not available.`);
    return;
  }

  const customer = customerByEmail.get(row.customerEmail?.toLowerCase());
  const seedKey = `blueprintai-${orderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const orderTags = mergeTags(
    [row.channel, row.creatorHandle, row.campaignName, row.source || row.sourceName, seedKey]
      .filter(Boolean)
      .join(","),
    ORDER_DEMO_TAGS,
  );

  if (createAs === "completed_demo_order") {
    await seedCompletedOrder({
      client,
      customer,
      orderName,
      product,
      row,
      seedKey,
      summary,
      tags: orderTags,
    });
    return;
  }

  const input = {
    email: row.customerEmail,
    customerId: customer?.id || undefined,
    note: buildOrderNote(row, seedKey),
    tags: orderTags,
    lineItems: [
      product.variantId
        ? {
            variantId: product.variantId,
            quantity: Number(row.quantity || 1),
          }
        : {
            title: product.title,
            quantity: Number(row.quantity || 1),
            originalUnitPrice: String(product.price || "0.00"),
          },
    ],
    customAttributes: [
      { key: "blueprintai_seed_key", value: seedKey },
      { key: "blueprintai_campaign", value: row.campaignName || "" },
      { key: "blueprintai_creator", value: row.creatorHandle || "" },
      { key: "blueprintai_source", value: row.source || row.sourceName || "" },
      { key: "blueprintai_create_as_requested", value: createAs },
    ],
    metafields: [
      {
        namespace: "blueprintai",
        key: "seed_key",
        type: "single_line_text_field",
        value: seedKey,
      },
    ],
  };

  if (row.discountCode) {
    input.appliedDiscount = {
      title: row.discountCode,
      description: `Demo discount code ${row.discountCode}`,
      valueType: "PERCENTAGE",
      value: 10,
    };
  }

  if (dryRun) {
    summary.draftOrders.created += 1;
    console.log(`[dry-run] Would create draft order ${orderName} for ${row.customerEmail}.`);
    return;
  }

  const existing = await findDraftOrder(client, seedKey);
  if (existing) {
    summary.draftOrders.skipped += 1;
    console.log(`Skipped existing draft order ${existing.name} (${seedKey}).`);
    return;
  }

  const response = await client.graphql(queries.createDraftOrder, { input });
  assertNoUserErrors("draftOrderCreate", response.data?.draftOrderCreate?.userErrors);

  const draftOrder = response.data.draftOrderCreate.draftOrder;
  summary.draftOrders.created += 1;
  console.log(`Created draft order ${draftOrder.name} for ${row.customerEmail}.`);
}

async function seedCompletedOrder({ client, customer, orderName, product, row, seedKey, summary, tags }) {
  const fulfillmentStatus = normalizeFulfillmentStatus(row.fulfillmentStatus);
  const input = {
    name: orderName,
    email: row.customerEmail,
    customer: customer?.id ? { toAssociate: { id: customer.id } } : undefined,
    financialStatus: normalizeFinancialStatus(row.financialStatus),
    processedAt: normalizeOrderDate(row.orderDate || row.testDate),
    note: buildOrderNote(row, seedKey),
    poNumber: seedKey,
    referringSite: row.referrer || undefined,
    sourceName: normalizeSourceName(row.sourceName || row.channel),
    tags,
    test: true,
    lineItems: [
      product.variantId
        ? {
            variantId: product.variantId,
            quantity: Number(row.quantity || 1),
          }
        : {
            title: product.title,
            quantity: Number(row.quantity || 1),
            priceSet: moneyBag(row.unitPrice || product.price || "0.00"),
          },
    ],
    customAttributes: [
      { key: "blueprintai_seed_key", value: seedKey },
      { key: "blueprintai_order_name", value: orderName },
      { key: "blueprintai_campaign", value: row.campaignName || "" },
      { key: "blueprintai_creator", value: row.creatorHandle || "" },
      { key: "blueprintai_channel", value: row.channel || "" },
      { key: "blueprintai_source", value: row.source || row.sourceName || "" },
      { key: "blueprintai_referrer", value: row.referrer || "" },
      { key: "blueprintai_landing_page", value: row.landingPage || "" },
      { key: "utm_source", value: row.utmSource || "" },
      { key: "utm_medium", value: row.utmMedium || "" },
      { key: "utm_campaign", value: row.utmCampaign || "" },
      { key: "blueprintai_no_real_payment", value: "true" },
      { key: "blueprintai_no_fulfillment", value: "true" },
    ],
    metafields: [
      {
        namespace: "blueprintai",
        key: "seed_key",
        type: "single_line_text_field",
        value: seedKey,
      },
    ],
  };
  if (fulfillmentStatus) {
    input.fulfillmentStatus = fulfillmentStatus;
  }

  if (row.unitPrice && product.variantId) {
    input.customAttributes.push({ key: "blueprintai_unit_price_csv", value: String(row.unitPrice) });
  }

  if (dryRun) {
    summary.completedOrders.created += 1;
    const fulfillmentMessage = fulfillmentStatus
      ? `fulfillmentStatus=${fulfillmentStatus}`
      : "fulfillmentStatus omitted";
    console.log(`[dry-run] Would create completed demo order ${orderName} (${input.financialStatus}, ${fulfillmentMessage}, test=true) for ${row.customerEmail}.`);
    return;
  }

  const existing = await findOrder(client, seedKey);
  if (existing) {
    summary.completedOrders.skipped += 1;
    console.log(`Skipped existing completed demo order ${existing.name} (${seedKey}).`);
    return;
  }

  let response;
  try {
    response = await client.graphql(queries.createOrder, {
      order: input,
      options: {
        sendReceipt: false,
        sendFulfillmentReceipt: false,
      },
    });
  } catch (error) {
    if (isCriticalShopifySeedError(error)) throw error;
    summary.completedOrders.skipped += 1;
    summary.warnings.push(
      `Skipping completed demo order ${orderName}; Shopify orderCreate request failed: ${error.message}`,
    );
    return;
  }
  const userErrors = response.data?.orderCreate?.userErrors || [];
  if (userErrors.length > 0) {
    summary.completedOrders.skipped += 1;
    summary.warnings.push(
      `Skipping completed demo order ${orderName}; Shopify orderCreate returned: ${userErrors.map((error) => error.message).join("; ")}`,
    );
    return;
  }

  const order = response.data.orderCreate.order;
  summary.completedOrders.created += 1;
  console.log(`Created completed demo order ${order.name} (${order.displayFinancialStatus}).`);
  await delay(ORDER_CREATE_DELAY_MS);
}

async function findProduct(client, handle) {
  const response = await client.graphql(queries.findProduct, {
    query: `handle:${escapeQueryValue(handle)}`,
  });

  return response.data.products.nodes[0] || null;
}

async function findCustomer(client, email) {
  const response = await client.graphql(queries.findCustomer, {
    query: `email:${escapeQueryValue(email)}`,
  });

  return response.data.customers.nodes[0] || null;
}

async function findDraftOrder(client, seedKey) {
  const response = await client.graphql(queries.findDraftOrder, {
    query: `tag:${escapeQueryValue(seedKey)}`,
  });

  return response.data.draftOrders.nodes.find((draftOrder) =>
    (draftOrder.tags || []).includes(seedKey),
  ) || null;
}

async function findOrder(client, seedKey) {
  const response = await client.graphql(queries.findOrder, {
    query: `tag:${escapeQueryValue(seedKey)}`,
  });

  return response.data.orders.nodes.find((order) =>
    (order.tags || []).includes(seedKey),
  ) || null;
}

function createAdminClient(shop, accessToken) {
  const endpoint = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  return {
    async graphql(query, variables = {}) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await response.json();

      if (!response.ok || json.errors) {
        throw new Error(
          `Shopify GraphQL request failed: ${JSON.stringify(json.errors || json, null, 2)}`,
        );
      }

      return json;
    },
  };
}

async function resolveAccessToken(shop) {
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const session = await prisma.session.findFirst({
      where: { shop, isOnline: false },
      orderBy: { expires: "desc" },
    });
    await prisma.$disconnect();

    return session?.accessToken || null;
  } catch (error) {
    console.warn(`Could not read an offline Shopify session from Prisma: ${error.message}`);
    return null;
  }
}

function printMissingTokenInstructions(shop) {
  console.error(`No Admin API token was found for ${shop}.`);
  console.error("");
  console.error("Run the Shopify app locally and install/re-authenticate it on the dev store first:");
  console.error("  npm run dev");
  console.error("");
  console.error("Then rerun this seed command. You can also provide a token explicitly:");
  console.error("  SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_... npm run seed:shopify-dev");
  console.error("");
  console.error("Required scopes: read_products, write_products, read_customers, write_customers, read_draft_orders, write_draft_orders, read_orders, write_orders.");
}

async function readCsv(fileName) {
  const filePath = path.join(seedDir, fileName);
  const content = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(content);

  if (rows.length === 0) {
    throw new Error(`${fileName} has no data rows.`);
  }

  return rows;
}

async function readOptionalCsv(fileName) {
  try {
    return await readCsv(fileName);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), dataRow[index]?.trim() || ""])),
  );
}

function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");

  return fs
    .readFile(envPath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) process.env[key] = rest.join("=").replace(/^"|"$/g, "");
      }
    })
    .catch(() => {});
}

function mergeTags(...tagInputs) {
  const tags = new Set();

  for (const input of tagInputs) {
    const values = Array.isArray(input) ? input : String(input || "").split(",");
    for (const value of values) {
      const tag = value.trim();
      if (tag) tags.add(tag);
    }
  }

  return [...tags];
}

function hasDemoTag(tags = []) {
  return DEMO_TAGS.some((tag) => tags.includes(tag));
}

function normalizeProductStatus(status) {
  const normalized = String(status || "ACTIVE").trim().toUpperCase();
  return ["ACTIVE", "DRAFT", "ARCHIVED"].includes(normalized) ? normalized : "ACTIVE";
}

function normalizeCreateAs(value) {
  const normalized = String(value || "draft_order").trim();
  return [
    "draft_order",
    "test_order",
    "completed_demo_order",
    "local_blueprintai_performance_only",
  ].includes(normalized)
    ? normalized
    : "draft_order";
}

function normalizeFinancialStatus(status) {
  const normalized = String(status || "PAID").trim().toUpperCase();
  return [
    "AUTHORIZED",
    "EXPIRED",
    "PAID",
    "PARTIALLY_PAID",
    "PARTIALLY_REFUNDED",
    "PENDING",
    "REFUNDED",
    "VOIDED",
  ].includes(normalized)
    ? normalized
    : "PAID";
}

function normalizeFulfillmentStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return ["FULFILLED", "PARTIAL", "RESTOCKED"].includes(normalized)
    ? normalized
    : null;
}

function normalizeOrderDate(value) {
  const date = value ? new Date(`${value}T12:00:00-04:00`) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeSourceName(value) {
  return String(value || "blueprintai_demo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "blueprintai_demo";
}

function moneyBag(amount, currencyCode = "USD") {
  return {
    shopMoney: {
      amount: String(amount || "0.00"),
      currencyCode,
    },
  };
}

function buildOrderNote(row, seedKey) {
  return `${DEMO_NOTE}
Seed key: ${seedKey}
Campaign: ${row.campaignName || ""}
Creator: ${row.creatorHandle || ""}
Channel: ${row.channel || ""}
Source: ${row.source || row.sourceName || ""}
Referrer: ${row.referrer || ""}
Landing page: ${row.landingPage || ""}
UTM: ${[row.utmSource, row.utmMedium, row.utmCampaign].filter(Boolean).join(" / ")}
Test date: ${row.testDate || row.orderDate || ""}
${row.note || ""}`.trim();
}

function normalizeShop(shop) {
  return String(shop || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function guardDevStore(shop) {
  if (shop !== DEV_STORE_DOMAIN) {
    throw new Error(
      `Refusing to seed ${shop || "(unknown store)"}. This script only targets ${DEV_STORE_DOMAIN}.`,
    );
  }
}

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function assertNoUserErrors(operation, userErrors = []) {
  if (userErrors.length > 0) {
    throw new Error(`${operation} returned user errors: ${JSON.stringify(userErrors, null, 2)}`);
  }
}

function isCriticalShopifySeedError(error) {
  return /access denied|unauthorized|invalid api key|invalid access token|forbidden/i.test(
    error?.message || "",
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printSummary(summary) {
  console.log("");
  console.log("BluePrintAI Shopify dev seed summary");
  console.log("-----------------------------------");
  console.log(`Products: ${summary.products.created} created, ${summary.products.updated} updated, ${summary.products.skipped} skipped`);
  console.log(`Customers: ${summary.customers.created} created, ${summary.customers.updated} updated, ${summary.customers.skipped} skipped`);
  console.log(`Draft orders: ${summary.draftOrders.created} created, ${summary.draftOrders.skipped} skipped`);
  console.log(`Completed demo orders: ${summary.completedOrders.created} created, ${summary.completedOrders.skipped} skipped`);
  console.log(`Test orders: ${summary.testOrders.created} created, ${summary.testOrders.skipped} skipped`);
  console.log(`Local-only analytics rows: ${summary.localOnlyOrders.skipped} skipped by Shopify seed`);

  if (summary.warnings.length > 0) {
    console.log("");
    console.log("Warnings");
    for (const warning of [...new Set(summary.warnings)]) {
      console.log(`- ${warning}`);
    }
  }

  console.log("");
  console.log("Shopify Analytics/Growth charts are generated by Shopify from real store records and cannot be directly overwritten by CSV.");
}
