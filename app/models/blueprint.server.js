import db from "../db.server";

const PRODUCT_QUERY = `#graphql
  query BluePrintAIProducts {
    shop {
      name
      myshopifyDomain
      currencyCode
    }
    products(first: 12, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        description
        featuredImage {
          url
          altText
        }
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        totalInventory
        updatedAt
      }
    }
  }
`;

const ORDERS_QUERY = `#graphql
  query BluePrintAIOrders {
    orders(first: 25, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export const DEMO_PRODUCTS = [
  {
    id: "demo-product-1",
    title: "Hydrating Barrier Serum",
    handle: "hydrating-barrier-serum",
    status: "ACTIVE",
    description:
      "Lightweight skincare serum for dry, stressed skin with a clean daily routine positioning.",
    featuredImage: null,
    price: "38.00",
    currencyCode: "USD",
    totalInventory: 128,
    source: "demo",
  },
  {
    id: "demo-product-2",
    title: "Compact Recovery Massager",
    handle: "compact-recovery-massager",
    status: "ACTIVE",
    description:
      "Portable muscle recovery tool for busy customers who want quick relief after training or long workdays.",
    featuredImage: null,
    price: "74.00",
    currencyCode: "USD",
    totalInventory: 42,
    source: "demo",
  },
  {
    id: "demo-product-3",
    title: "Everyday Leakproof Travel Cup",
    handle: "everyday-leakproof-travel-cup",
    status: "ACTIVE",
    description:
      "Insulated travel cup positioned around commute convenience, leakproof storage, and giftability.",
    featuredImage: null,
    price: "29.00",
    currencyCode: "USD",
    totalInventory: 210,
    source: "demo",
  },
];

export function configuredScopes() {
  return (process.env.SCOPES || "read_products,read_orders")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function listSavedBriefs(shop, limit = 8) {
  const records = await db.savedBrief.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    payload: parsePayload(record.payloadJson),
  }));
}

export async function findSavedBrief(shop, briefId) {
  if (!briefId) return null;

  const record = await db.savedBrief.findFirst({
    where: { id: briefId, shop },
  });

  return record
    ? {
        ...record,
        payload: parsePayload(record.payloadJson),
      }
    : null;
}

export async function findSavedCreative(shop, creativeId) {
  if (!creativeId) return null;

  const record = await db.savedCreative.findFirst({
    where: { id: creativeId, shop },
  });

  return record
    ? {
        ...record,
        payload: parsePayload(record.payloadJson),
      }
    : null;
}

export async function findRevenueBlueprint(shop, blueprintId) {
  if (!blueprintId) return null;

  const record = await db.revenueBlueprint.findFirst({
    where: { id: blueprintId, shop },
  });

  return record
    ? {
        ...record,
        payload: parsePayload(record.payloadJson),
      }
    : null;
}

export async function saveBriefRecord(shop, product, brief) {
  const angle = brief.angle || (brief.hooks[0]?.includes("problem")
    ? "Problem-solution demo"
    : "Creative brief");

  const saved = await db.savedBrief.create({
    data: {
      shop,
      productId: product.id,
      productTitle: product.title,
      angle,
      payloadJson: JSON.stringify(brief),
    },
  });

  return {
    ...saved,
    payload: brief,
  };
}

export async function listVideoAnalyses(shop, limit = 8) {
  const records = await db.videoAnalysis.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    payload: parsePayload(record.payloadJson),
  }));
}

export async function saveVideoAnalysisRecord({
  shop,
  product,
  fileName,
  fileType = "",
  fileSize = 0,
  mediaUrl = "",
  brief,
  analysis,
  savedToLibrary = false,
}) {
  const saved = await db.videoAnalysis.create({
    data: {
      shop,
      productId: product.id,
      productTitle: product.title,
      fileName,
      brief,
      payloadJson: JSON.stringify(analysis),
      savedToLibrary,
    },
  });

  if (savedToLibrary) {
    await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: saved.id,
      productId: product.id,
      productTitle: product.title,
      title: `${product.title} creative analysis`,
      angle: brief || "Creative analysis",
      payload: {
        analysis,
        fileName,
        fileType,
        fileSize,
        mediaUrl,
        brief,
        mediaStored: Boolean(mediaUrl),
        mediaState: mediaUrl ? "stored_data_url" : "analysis_only",
      },
    });
  }

  return {
    ...saved,
    payload: analysis,
  };
}

export async function listSavedCreatives(shop, limit = 12) {
  const records = await db.savedCreative.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    payload: parsePayload(record.payloadJson),
  }));
}

export async function saveCreativeRecord(shop, creative) {
  const saved = await db.savedCreative.create({
    data: {
      shop,
      sourceType: creative.sourceType,
      sourceId: creative.sourceId,
      productId: creative.productId,
      productTitle: creative.productTitle,
      title: creative.title,
      angle: creative.angle,
      payloadJson: JSON.stringify(creative.payload || creative),
    },
  });

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
  };
}

export async function listRevenueBlueprints(shop, limit = 5) {
  const records = await db.revenueBlueprint.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    payload: parsePayload(record.payloadJson),
  }));
}

export async function saveRevenueBlueprintRecord(shop, blueprint) {
  const saved = await db.revenueBlueprint.create({
    data: {
      shop,
      payloadJson: JSON.stringify(blueprint),
    },
  });

  return {
    ...saved,
    payload: blueprint,
  };
}

export async function getWorkspaceSetting(shop, key) {
  return db.workspaceSetting.findUnique({
    where: {
      shop_key: {
        shop,
        key,
      },
    },
  });
}

export async function listWorkspaceRequests(shop, limit = 8) {
  const records = await db.workspaceRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    payload: parsePayload(record.payloadJson),
  }));
}

export async function createWorkspaceRequest(shop, type, payload = {}) {
  return db.workspaceRequest.create({
    data: {
      shop,
      type,
      status: "requested",
      payloadJson: JSON.stringify(payload),
    },
  });
}

export async function upsertWorkspaceSetting(shop, key, value) {
  return db.workspaceSetting.upsert({
    where: {
      shop_key: {
        shop,
        key,
      },
    },
    create: {
      shop,
      key,
      value,
    },
    update: {
      value,
    },
  });
}

export async function deleteWorkspaceData(shop) {
  await db.$transaction([
    db.savedBrief.deleteMany({ where: { shop } }),
    db.videoAnalysis.deleteMany({ where: { shop } }),
    db.savedCreative.deleteMany({ where: { shop } }),
    db.revenueBlueprint.deleteMany({ where: { shop } }),
    db.workspaceRequest.deleteMany({ where: { shop } }),
    db.workspaceSetting.deleteMany({ where: { shop } }),
  ]);
}

export async function disconnectTikTokWorkspace(shop) {
  const disconnectedAt = new Date().toISOString();

  await db.$transaction([
    db.workspaceSetting.deleteMany({
      where: {
        shop,
        key: {
          in: [
            "tiktok_access_token",
            "tiktok_refresh_token",
            "tiktok_shop_id",
            "tiktok_seller_id",
            "tiktok_connection_payload",
            "tiktok_connected_at",
          ],
        },
      },
    }),
    db.workspaceSetting.upsert({
      where: {
        shop_key: {
          shop,
          key: "tiktok_connected",
        },
      },
      create: {
        shop,
        key: "tiktok_connected",
        value: "false",
      },
      update: {
        value: "false",
      },
    }),
    db.workspaceSetting.upsert({
      where: {
        shop_key: {
          shop,
          key: "tiktok_disconnected_at",
        },
      },
      create: {
        shop,
        key: "tiktok_disconnected_at",
        value: disconnectedAt,
      },
      update: {
        value: disconnectedAt,
      },
    }),
  ]);

  return { disconnectedAt };
}

export async function buildWorkspaceExport(shop) {
  const [briefs, analyses, creatives, blueprints, requests, settings] =
    await Promise.all([
      db.savedBrief.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.videoAnalysis.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.savedCreative.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.revenueBlueprint.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.workspaceRequest.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.workspaceSetting.findMany({ where: { shop }, orderBy: { key: "asc" } }),
    ]);

  return {
    shop,
    exportedAt: new Date().toISOString(),
    savedBriefs: briefs.map(withParsedPayload),
    videoAnalyses: analyses.map(withParsedPayload),
    savedCreatives: creatives.map(withParsedPayload),
    revenueBlueprints: blueprints.map(withParsedPayload),
    workspaceRequests: requests.map(withParsedPayload),
    workspaceSettings: settings.map((setting) => ({
      key: setting.key,
      value:
        /token|secret|password/i.test(setting.key) && setting.value
          ? "[redacted]"
          : setting.value,
      updatedAt: setting.updatedAt,
    })),
  };
}

export async function loadTimelineCompletion(shop, blueprintKey = "legacy") {
  const key = timelineCompletionKey(blueprintKey);
  const record = await getWorkspaceSetting(shop, key);
  const parsed = parsePayload(record?.value);

  return parsed && typeof parsed === "object" ? parsed : {};
}

export async function updateTimelineCompletion(shop, blueprintKey, actionId, completed) {
  const key = timelineCompletionKey(blueprintKey);
  const current = await loadTimelineCompletion(shop, blueprintKey);
  const next = {
    ...current,
    [actionId]: Boolean(completed),
  };

  await upsertWorkspaceSetting(
    shop,
    key,
    JSON.stringify(next),
  );

  return next;
}

function timelineCompletionKey(blueprintKey = "legacy") {
  return blueprintKey === "legacy"
    ? "revenue_timeline_completion"
    : `revenue_timeline_completion:${blueprintKey}`;
}

export function aiProviderStatus() {
  const configured = Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY,
  );

  return {
    configured,
    mode: configured ? "configured" : "demo_fallback",
    label: configured
      ? "AI provider environment variable detected"
      : "Demo fallback active",
    note: configured
      ? "Server-side AI calls can be wired without exposing keys to the browser."
      : "No AI key is required for app review or development-store testing.",
  };
}

export async function loadMerchantData(admin, session) {
  const scopes = configuredScopes();
  const result = {
    shop: {
      name: session.shop,
      myshopifyDomain: session.shop,
      currencyCode: "USD",
    },
    products: [],
    orders: [],
    orderScopeEnabled: scopes.includes("read_orders"),
    scopes,
    errors: [],
  };

  try {
    const response = await admin.graphql(PRODUCT_QUERY);
    const json = await response.json();

    if (json.errors) {
      result.errors.push("Products could not be loaded from Shopify.");
    } else {
      result.shop = json.data.shop;
      result.products = json.data.products.nodes.map(normalizeProduct);
    }
  } catch (error) {
    result.errors.push("Products could not be loaded from Shopify.");
  }

  if (result.orderScopeEnabled) {
    try {
      const response = await admin.graphql(ORDERS_QUERY);
      const json = await response.json();

      if (json.errors) {
        result.errors.push("Orders could not be loaded with the current shop access.");
      } else {
        result.orders = json.data.orders.nodes.map((order) => ({
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          amount: Number(order.totalPriceSet.shopMoney.amount || 0),
          currencyCode: order.totalPriceSet.shopMoney.currencyCode,
        }));
      }
    } catch (error) {
      result.errors.push("Orders could not be loaded with the current shop access.");
    }
  }

  if (!result.products.length) {
    result.products = DEMO_PRODUCTS;
  }

  return result;
}

export function buildDashboard(data) {
  const revenue = data.orders.reduce((sum, order) => sum + order.amount, 0);
  const activeProducts = data.products.filter(
    (product) => product.status === "ACTIVE" || product.source === "demo",
  ).length;
  const creativeHealthScore = Math.min(
    94,
    Math.max(58, 62 + activeProducts * 4 + (data.orders.length ? 8 : 0)),
  );

  const actionItems = [
    {
      title: "Create product-specific ad angles",
      detail:
        "Turn your latest products into hooks, visual concepts, and CTA tests.",
      href: `/app/ad-briefs?productId=${encodeURIComponent(data.products[0]?.id || "")}&recommendationId=dashboard-ad-angles&generate=1`,
    },
    {
      title: "Analyze a current ad concept",
      detail:
        "Check hook strength, clarity, CTA quality, and first 10 second retention risk.",
      href: "/app/video-analysis",
    },
    {
      title: "Generate a 7-day growth plan",
      detail:
        data.orders.length > 0
          ? "Use catalog and recent order context to prioritize the next tests."
          : "Use catalog data now; order context will appear when orders are available.",
      href: "/app/revenue-blueprint",
    },
  ];

  return {
    productCount: data.products.length,
    activeProducts,
    orderCount: data.orders.length,
    revenue,
    currencyCode:
      data.orders[0]?.currencyCode || data.shop.currencyCode || "USD",
    creativeHealthScore,
    actionItems,
  };
}

export function buildCreativeConcepts(products) {
  return products.map((product, index) => ({
    productId: product.id,
    productTitle: product.title,
    source: product.source || "shopify",
    angle: [
      "Problem-solution demo",
      "Before-and-after proof",
      "Giftable everyday upgrade",
      "Objection handling",
    ][index % 4],
    hook: hookForProduct(product),
    visual:
      "Open on the customer problem, show the product in use, then cut to the clearest result.",
    cta: "Shop the product in this store.",
    risk:
      product.description?.length > 180
        ? "Description is detailed enough for testing multiple claims."
        : "Add more benefit detail before scaling creative tests.",
  }));
}

export function analyzeVideoInput({
  description = "",
  productTitle = "",
  fileName = "",
  fileSize = 0,
  fileType = "",
  contentSignature = "",
}) {
  const text = `${description} ${productTitle} ${fileName} ${fileType} ${contentSignature}`.toLowerCase();
  const hasProblem = /problem|struggle|before|pain|hard|frustrat|mess|slow/.test(text);
  const hasResult = /result|after|save|easy|fast|clear|better|proof/.test(text);
  const hasCta = /shop|buy|order|tap|try|checkout|today/.test(text);
  const hasVideoFile = Boolean(fileName || fileType || fileSize);
  const sizeMb = fileSize ? fileSize / (1024 * 1024) : 0;
  const hasProductEarly = productTitle
    ? text.indexOf(productTitle.toLowerCase().split(" ")[0]) >= 0
    : /product|serum|cup|massager|bundle|kit/.test(text);

  const hookScore = clampScore(5 + (hasProblem ? 2 : 0) + (hasProductEarly ? 1 : 0) + (hasVideoFile ? 1 : 0));
  const clarityScore = clampScore(5 + (hasResult ? 2 : 0) + (description.length > 140 ? 1 : 0) + (sizeMb > 0 && sizeMb < 80 ? 1 : 0));
  const ctaScore = clampScore(4 + (hasCta ? 3 : 0) + (/caption|overlay|end/.test(text) ? 1 : 0));
  const pacingRisk = hookScore < 7 || !hasProductEarly ? "Medium" : "Low";

  return {
    mode: aiProviderStatus().mode,
    analysisBasis: hasVideoFile
      ? "File metadata, upload signature, product context, and optional angle text. Full frame/audio processing is not available in this Shopify app runtime."
      : "Product context and optional angle text only. Upload a video file for file-grounded scoring.",
    fileSignals: {
      fileName,
      fileType,
      fileSize,
      fileSizeMb: Number(sizeMb.toFixed(2)),
      contentSignature,
    },
    hookScore,
    clarityScore,
    ctaScore,
    pacingNotes:
      pacingRisk === "Low"
        ? "The concept introduces the product early enough for a short-form ad test."
        : "Move the product and main benefit into the opening seconds before adding context.",
    retentionRisk:
      hookScore + clarityScore + ctaScore >= 22 ? "Low" : "Medium",
    firstTenSecondRisk:
      hasProductEarly && hasProblem
        ? "Clear opening structure"
        : "Viewer may not understand the product or reason to keep watching quickly enough.",
    rewriteSuggestions: [
      hookForProduct({ title: productTitle || "this product", description }),
      "Show the product result before explaining features.",
      hasCta ? "Keep the CTA direct and visible." : "Add a direct shop CTA in the final frame.",
    ],
    disclaimer:
      "These are file-grounded creative recommendations, not guaranteed performance claims.",
  };
}

export function buildRecommendations(products, orders = []) {
  return products.slice(0, 6).map((product, index) => ({
    id: `rec-${product.id}`,
    productId: product.id,
    productTitle: product.title,
    priority: index < 2 ? "High" : "Medium",
    expectedImpact:
      orders.length > 0
        ? "Use recent sales context to improve message-market fit."
        : "Improve creative clarity before paid traffic testing.",
    title: `Test a sharper angle for ${product.title}`,
    detail:
      product.description?.length > 80
        ? "Convert the strongest benefit from the product description into a hook and proof sequence."
        : "Add benefit-led description detail, then test a direct product demo creative.",
    nextAction: `Create a brief for ${product.title} and run one hook, one proof shot, and one CTA variation.`,
  }));
}

export function buildBrief(product, context = {}) {
  const selected = product || DEMO_PRODUCTS[0];
  const sourceLabel = context.creativeTitle
    ? `Creative source: ${context.creativeTitle}.`
    : context.recommendationTitle
      ? `Recommendation source: ${context.recommendationTitle}.`
      : "Catalog source: Shopify product data.";
  const generatedAt = new Date().toISOString();

  return {
    productId: selected.id,
    productTitle: selected.title,
    angle:
      context.angle ||
      (context.creativeTitle ? "Creative-derived brief" : "Problem-solution demo"),
    generatedAt,
    context: {
      productId: selected.id,
      recommendationId: context.recommendationId || null,
      recommendationTitle: context.recommendationTitle || null,
      creativeId: context.creativeId || null,
      creativeTitle: context.creativeTitle || null,
      sourceLabel,
      creativeScore: context.creativeScore || null,
      creativePlatform: context.creativePlatform || null,
      creativeAnalysis: context.creativeAnalysis || null,
      creativeRecommendation: context.creativeRecommendation || null,
    },
    hooks: [
      context.hook || hookForProduct(selected),
      context.analysisHook || context.creativeAnalysis || null,
      `The everyday problem ${selected.title} is built to solve.`,
      `What changed after switching to ${selected.title}?`,
    ].filter(Boolean),
    script: [
      "0-2s: Open with the problem or desired outcome in plain language.",
      "3-7s: Show the product in use with the clearest visual proof.",
      "8-15s: Explain one benefit and one objection answer.",
      "Final frame: Show product, offer context, and a direct shop CTA.",
    ],
    captions: [
      `${selected.title} makes the daily routine easier to understand at a glance.`,
      "A simple product demo beats a vague lifestyle shot.",
      "Lead with the result, then explain the feature.",
    ],
    visualConcepts: [
      context.visual || context.creativeRecommendation || "Close-up product use with text overlay naming the benefit.",
      "Before-and-after sequence showing the customer problem and result.",
      "Founder or creator-style walkthrough with one clear proof point.",
    ],
    ctas: [context.cta || "Shop now", "Try it today", "View product details"],
    creatorDirection:
      `${sourceLabel} Use natural, specific language. Avoid unsupported performance guarantees and keep claims tied to visible product benefits.`,
  };
}

export function buildActionUrl(item = {}) {
  const params = new URLSearchParams();

  if (item.productId) params.set("productId", item.productId);
  if (item.id) params.set("recommendationId", item.id);

  const type = String(item.type || "").toLowerCase();
  const text = `${item.title || ""} ${item.detail || ""} ${item.nextAction || ""}`.toLowerCase();

  if (type === "product_page" || /page|pdp|description|above the fold/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

  if (type === "testing" || type === "creative" || /brief|angle|hook|creative|test/.test(text)) {
    params.set("generate", "1");
    return `/app/ad-briefs?${params.toString()}`;
  }

  if (type === "cta" || /cta|checkout|claim|shop now/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

  params.set("generate", "1");
  return `/app/ad-briefs?${params.toString()}`;
}

function withParsedPayload(record) {
  return {
    ...record,
    payload: parsePayload(record.payloadJson),
    payloadJson: undefined,
  };
}

export function buildRevenueBlueprint(data, context = {}) {
  const topProduct = context.product || data.products[0] || DEMO_PRODUCTS[0];
  const hasOrders = data.orders.length > 0;
  const recommendation = context.recommendation || null;
  const recommendationType = String(recommendation?.type || "").replace("_", " ");
  const ctaOrPagePlan =
    recommendation && /cta|product_page/.test(String(recommendation.type || ""))
      ? `Act on "${recommendation.title}" for ${topProduct.title}: ${recommendation.nextAction || recommendation.detail}`
      : `Clarify the main product promise for ${topProduct.title} above the fold and in every ad hook.`;

  return {
    context: {
      productId: topProduct.id,
      productTitle: topProduct.title,
      recommendationId: recommendation?.id || null,
      recommendationTitle: recommendation?.title || null,
      recommendationType: recommendation?.type || null,
      generatedFor: recommendation
        ? `${topProduct.title} · ${recommendationType || "recommendation"}`
        : topProduct.title,
    },
    diagnosis: hasOrders
      ? `${topProduct.title} has enough Shopify context to prioritize the next conversion and creative tests.`
      : `${topProduct.title} can move forward with catalog-based positioning while order history builds.`,
    priorities: [
      ctaOrPagePlan,
      "Create one creative brief per priority product before adding more channels.",
      hasOrders
        ? "Compare recent order patterns with product-level creative angles."
        : "Use generated test data or demo products to validate the workflow before real orders arrive.",
    ],
    conversionIdeas: [
      recommendation?.type === "cta"
        ? `Test a direct CTA for ${topProduct.title}: ${recommendation.nextAction || "Shop now with a concrete benefit."}`
        : "Match ad hooks to product page headings.",
      recommendation?.type === "product_page"
        ? `Update the ${topProduct.title} product page with proof, objection handling, and above-the-fold clarity.`
        : "Add visual proof near the primary product benefit.",
      "Use a direct CTA that keeps shoppers inside Shopify checkout.",
    ],
    positioning: `${topProduct.title} should lead with a concrete customer problem, a fast product demonstration, and one memorable benefit.`,
    creativePlan: [
      "One problem-solution demo",
      "One proof-led before-and-after concept",
      "One objection-handling concept",
    ],
    sevenDayPlan: [
      `Day 1: Audit ${topProduct.title} and write one benefit-led hook tied to the selected recommendation.`,
      `Day 2: Produce or outline the opening five seconds for ${topProduct.title}.`,
      recommendation?.type === "cta"
        ? `Day 3: Draft CTA variants for ${topProduct.title} and match them to the checkout path.`
        : `Day 3: Build matching ${topProduct.title} product page CTA and image notes.`,
      "Day 4: Analyze one existing ad or concept for hook, clarity, CTA, and pacing.",
      `Day 5: Generate briefs for the strongest ${topProduct.title} angle.`,
      "Day 6: Review recommendations and choose one priority test.",
      "Day 7: Document learnings and prepare the next creative iteration.",
    ],
  };
}

export function findProduct(products, productId) {
  return products.find((product) => product.id === productId) || products[0] || DEMO_PRODUCTS[0];
}

export function findProductStrict(products, productId) {
  return products.find((product) => product.id === productId) || null;
}

export async function loadTikTokConnection(shop) {
  const settings = await db.workspaceSetting.findMany({
    where: {
      shop,
      key: {
        in: [
          "tiktok_connected",
          "tiktok_shop_id",
          "tiktok_seller_id",
          "tiktok_connection_payload",
          "tiktok_connected_at",
          "tiktok_disconnected_at",
        ],
      },
    },
  });
  const byKey = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const payload = parsePayload(byKey.tiktok_connection_payload) || {};
  const connected = byKey.tiktok_connected === "true" && Boolean(byKey.tiktok_shop_id || byKey.tiktok_seller_id || payload.shopId || payload.sellerId);

  return {
    connected,
    shopId: byKey.tiktok_shop_id || payload.shopId || "",
    sellerId: byKey.tiktok_seller_id || payload.sellerId || "",
    sellerName: payload.sellerName || payload.shopName || "",
    connectedAt: byKey.tiktok_connected_at || "",
    disconnectedAt: byKey.tiktok_disconnected_at || "",
    mode: payload.mode || (connected ? "connected" : "disconnected"),
  };
}

function normalizeProduct(product) {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    description: stripHtml(product.description || ""),
    featuredImage: product.featuredImage,
    price: product.priceRangeV2?.minVariantPrice?.amount || "0.00",
    currencyCode:
      product.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
    totalInventory: product.totalInventory,
    updatedAt: product.updatedAt,
    source: "shopify",
  };
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hookForProduct(product) {
  const title = product.title || "this product";
  const firstBenefit = product.description
    ? product.description.split(".")[0].slice(0, 110)
    : "make the customer outcome obvious";

  return `If ${title} solves one problem, show ${firstBenefit.toLowerCase()} in the first three seconds.`;
}

function clampScore(score) {
  return Math.max(1, Math.min(10, score));
}

function parsePayload(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}
