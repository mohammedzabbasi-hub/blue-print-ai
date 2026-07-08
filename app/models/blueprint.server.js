import db from "../db.server.js";
import crypto from "node:crypto";
import { deleteUploadedWorkspaceFiles } from "../utils/upload-storage.server.js";
import {
  BRAND_TONE_OPTIONS,
  CREATIVE_GOAL_OPTIONS,
  CREATIVE_SOURCE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
} from "./workspace-profile-options.js";
import {
  DEMO_PERFORMANCE_LABEL,
  demoBrand,
  demoCreators,
  demoProducts,
  demoRecommendations,
} from "../data/demo-brand.js";

const SHOPIFY_PRODUCT_PAGE_SIZE = 100;
const MAX_SHOPIFY_PRODUCTS = 1000;

const PRODUCT_QUERY = `#graphql
  query BluePrintAIProducts($cursor: String) {
    shop {
      name
      myshopifyDomain
      currencyCode
    }
    products(first: ${SHOPIFY_PRODUCT_PAGE_SIZE}, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        productType
        vendor
        featuredImage {
          url
          altText
        }
        variants(first: 3) {
          nodes {
            id
            title
            price
          }
        }
        createdAt
        updatedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const DEMO_PRODUCTS = demoProducts;
const DEMO_PRODUCT_IDS = new Set(DEMO_PRODUCTS.map((product) => product.id));

export const WORKSPACE_PROFILE_KEY = "workspace_profile";
export const WORKSPACE_SETUP_MODES = [
  "entire_store",
  "primary_product",
  "manual_product_context",
];

export function configuredScopes() {
  return (process.env.SCOPES || "read_products")
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

  return records
    .map((record) => ({
      ...record,
      payload: parsePayload(record.payloadJson),
    }))
    .filter((record) => !isSeededDemoRecord(record));
}

export async function findSavedBrief(shop, briefId) {
  if (!briefId) return null;

  const record = await db.savedBrief.findFirst({
    where: { id: briefId, shop },
  });

  if (!record) return null;

  const parsed = {
    ...record,
    payload: parsePayload(record.payloadJson),
  };

  return isSeededDemoRecord(parsed) ? null : parsed;
}

export async function findSavedCreative(shop, creativeId) {
  if (!creativeId) return null;

  const record = await db.savedCreative.findFirst({
    where: { id: creativeId, shop },
  });

  if (!record) return null;

  const parsed = {
    ...record,
    payload: parsePayload(record.payloadJson),
  };

  return isSeededDemoRecord(parsed) ? null : parsed;
}

export async function findRevenueBlueprint(shop, blueprintId) {
  if (!blueprintId) return null;

  const record = await db.revenueBlueprint.findFirst({
    where: { id: blueprintId, shop },
  });

  if (!record) return null;

  const parsed = {
    ...record,
    payload: parsePayload(record.payloadJson),
  };

  return isSeededDemoRecord(parsed) ? null : parsed;
}

export async function saveBriefRecord(shop, product, brief) {
  const angle = brief.angle || (brief.hooks[0]?.includes("problem")
    ? "Problem-solution brief"
    : "Creative brief");
  const persistenceKey = persistenceFingerprint("saved_brief", {
    productId: product.id,
    angle,
    brief,
  });
  const existing = await findRecordByPersistenceKey("savedBrief", shop, persistenceKey);

  if (existing) {
    return {
      ...existing,
      payload: parsePayload(existing.payloadJson),
      wasCreated: false,
    };
  }

  const saved = await db.savedBrief.create({
    data: {
      shop,
      productId: product.id,
      productTitle: product.title,
      angle,
      payloadJson: JSON.stringify(withPersistenceMetadata(brief, persistenceKey)),
    },
  });
  await createActivityLogRecord(shop, {
    type: "ad_brief",
    title: "Brief saved",
    description: `${product.title} · ${angle}`,
    relatedType: "SavedBrief",
    relatedId: saved.id,
  });

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    wasCreated: true,
  };
}

export async function listVideoAnalyses(shop, limit = 8) {
  const records = await db.videoAnalysis.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records
    .map((record) => ({
      ...record,
      payload: parsePayload(record.payloadJson),
    }))
    .filter((record) => !isSeededDemoRecord(record));
}

export async function saveVideoAnalysisRecord({
  shop,
  product,
  fileName,
  fileType = "",
  fileSize = 0,
  mediaUrl = "",
  displayTitle = "",
  summary = "",
  brief,
  analysis,
  savedToLibrary = false,
}) {
  const creativeTitle =
    displayTitle ||
    analysis?.result?.display?.displayTitle ||
    analysis?.result?.display?.generatedTitle ||
    fileName ||
    `${product.title} creative analysis`;
  const creativeSummary =
    summary ||
    analysis?.result?.display?.summary ||
    brief ||
    "Creative analysis";
  const persistenceKey = persistenceFingerprint("video_analysis", {
    productId: product.id,
    fileName,
    fileType,
    fileSize,
    brief,
    analysis,
  });
  const existing = await findRecordByPersistenceKey("videoAnalysis", shop, persistenceKey);

  if (existing) {
    return {
      ...existing,
      payload: parsePayload(existing.payloadJson),
      wasCreated: false,
    };
  }

  const saved = await db.videoAnalysis.create({
    data: {
      shop,
      productId: product.id,
      productTitle: product.title,
      fileName,
      brief: creativeSummary,
      payloadJson: JSON.stringify(withPersistenceMetadata(analysis, persistenceKey)),
      savedToLibrary,
    },
  });
  await createActivityLogRecord(shop, {
    type: "video_analysis",
    title: "Analysis saved",
    description: `${product.title} · ${creativeTitle}`,
    relatedType: "VideoAnalysis",
    relatedId: saved.id,
  });

  if (savedToLibrary) {
    await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: saved.id,
      productId: product.id,
      productTitle: product.title,
      title: creativeTitle,
      angle: creativeSummary,
      payload: {
        analysis,
        displayTitle: creativeTitle,
        summary: creativeSummary,
        description: creativeSummary,
        fileName,
        fileType,
        fileSize,
        mediaUrl,
        brief: creativeSummary,
        mediaStored: Boolean(mediaUrl),
        mediaState: mediaUrl ? "local_public_upload" : "analysis_only",
        mediaStorage: mediaUrl ? "local_public_uploads" : "",
        originalFilename: fileName,
        video_url: mediaUrl,
      },
    });
  }

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    wasCreated: true,
  };
}

export async function listSavedCreatives(shop, limit = 12) {
  const records = await db.savedCreative.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records
    .map((record) => ({
      ...record,
      payload: parsePayload(record.payloadJson),
    }))
    .filter((record) => !isSeededDemoRecord(record));
}

export async function saveCreativeRecord(shop, creative) {
  const persistenceKey = persistenceFingerprint("saved_creative", {
    sourceType: creative.sourceType,
    sourceId: creative.sourceId || null,
    productId: creative.productId,
    title: creative.title,
    angle: creative.angle,
    payload: creative.payload || creative,
  });
  let existing = creative.sourceId
    ? await db.savedCreative.findFirst({
        where: {
          shop,
          sourceType: creative.sourceType,
          sourceId: creative.sourceId,
        },
        orderBy: { createdAt: "desc" },
      })
    : await findRecordByPersistenceKey("savedCreative", shop, persistenceKey);

  if (!existing) {
    const incomingMediaKeys = savedCreativeMediaKeys(creative.payload || creative);
    if (incomingMediaKeys.size) {
      const candidates = await db.savedCreative.findMany({
        where: { shop, sourceType: creative.sourceType },
        orderBy: { createdAt: "desc" },
      });
      existing = candidates.find((candidate) => {
        const candidateKeys = savedCreativeMediaKeys(parsePayload(candidate.payloadJson));
        return [...incomingMediaKeys].some((key) => candidateKeys.has(key));
      });
    }
  }

  if (existing) {
    const mergedPayload = {
      ...parsePayload(existing.payloadJson),
      ...(creative.payload || creative),
    };
    const updated = await db.savedCreative.update({
      where: { id: existing.id },
      data: {
        sourceId: creative.sourceId || existing.sourceId,
        productId: creative.productId,
        productTitle: creative.productTitle,
        title: creative.title,
        angle: creative.angle,
        payloadJson: JSON.stringify(
          withPersistenceMetadata(mergedPayload, persistenceKey),
        ),
      },
    });

    return {
      ...updated,
      payload: parsePayload(updated.payloadJson),
      wasCreated: false,
    };
  }

  const saved = await db.savedCreative.create({
    data: {
      shop,
      sourceType: creative.sourceType,
      sourceId: creative.sourceId,
      productId: creative.productId,
      productTitle: creative.productTitle,
      title: creative.title,
      angle: creative.angle,
      payloadJson: JSON.stringify(
        withPersistenceMetadata(creative.payload || creative, persistenceKey),
      ),
    },
  });
  await createActivityLogRecord(shop, {
    type: "creative",
    title: "Creative saved",
    description: `${creative.productTitle} · ${creative.title}`,
    relatedType: "SavedCreative",
    relatedId: saved.id,
  });

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    wasCreated: true,
  };
}

function savedCreativeMediaKeys(payload = {}) {
  const media = payload.media || payload.result?.media || {};
  const metadata = payload.metadata || payload.result?.metadata || {};
  return new Set(
    [
      payload.mediaFingerprint,
      media.fingerprint,
      metadata.media_fingerprint,
      payload.mediaUrl,
      payload.videoUrl,
      payload.video_url,
      media.mediaUrl,
      metadata.media_url,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

export async function deleteSavedCreative(shop, creativeId) {
  const existing = await findSavedCreative(shop, creativeId);

  if (!existing) {
    return null;
  }

  const duplicateRecords = existing.sourceId
    ? await db.savedCreative.findMany({
        where: {
          shop,
          sourceId: existing.sourceId,
          sourceType: existing.sourceType,
        },
        select: { id: true },
      })
    : [{ id: existing.id }];
  const duplicateIds = duplicateRecords.map(({ id }) => id);
  const sourceReferences = [existing.id, existing.sourceId, ...duplicateIds].filter(Boolean);
  const linkedPerformance = sourceReferences.length
    ? await db.creativePerformance.findFirst({
        where: { shop, sourceRecordId: { in: sourceReferences } },
      })
    : null;

  if (linkedPerformance) {
    await deleteCreativePerformanceGroup(shop, linkedPerformance);
  }

  // Saved reviews may have been written more than once with the same source
  // identity. Remove the whole local identity group so a duplicate card cannot
  // make a successful delete appear to have failed.
  await db.$transaction([
    db.adCampaignCreative.deleteMany({
      where: { shop, savedCreativeId: { in: duplicateIds } },
    }),
    db.savedCreative.deleteMany({
      where: { shop, id: { in: duplicateIds } },
    }),
  ]);

  await createActivityLogRecord(shop, {
    type: "creative_deleted",
    title: "Creative removed",
    description: `Removed ${existing.title || "Untitled Creative"} from Creative Library`,
    payload: {
      creativeId: existing.id,
      productId: existing.productId,
      productTitle: existing.productTitle,
      title: existing.title,
      mediaFilesDeleted: false,
    },
  });

  return existing;
}

export async function deleteCreativePerformanceRecord(shop, performanceId) {
  if (!performanceId) return null;

  const existing = await db.creativePerformance.findFirst({
    where: { id: performanceId, shop },
  });

  if (!existing) return null;

  const deleted = await deleteCreativePerformanceGroup(shop, existing);

  await createActivityLogRecord(shop, {
    type: "creative_deleted",
    title: "Imported creative removed",
    description: `Removed ${existing.adName || existing.creativeId || "imported creative"} from Creative Library`,
    payload: {
      creativeId: existing.creativeId,
      externalRecordsDeleted: false,
      performanceRecordIds: deleted.performanceRecordIds,
      savedCreativeIds: deleted.savedCreativeIds,
      sourcePlatform: existing.platform,
    },
  });

  return existing;
}

async function deleteCreativePerformanceGroup(shop, existing) {
  const identityWhere = existing.creativeId
    ? {
        shop,
        creativeId: existing.creativeId,
        ...(existing.platform ? { platform: existing.platform } : {}),
      }
    : { shop, id: existing.id };
  const performanceRecords = await db.creativePerformance.findMany({
    where: identityWhere,
    select: { id: true, sourceRecordId: true },
  });
  const performanceRecordIds = performanceRecords.map((record) => record.id);
  const sourceRecordIds = performanceRecords
    .map((record) => record.sourceRecordId)
    .filter(Boolean);
  const savedCreatives = sourceRecordIds.length
    ? await db.savedCreative.findMany({
        where: {
          shop,
          OR: [
            { id: { in: sourceRecordIds } },
            { sourceId: { in: sourceRecordIds } },
          ],
        },
        select: { id: true },
      })
    : [];
  const savedCreativeIds = savedCreatives.map((record) => record.id);

  await db.$transaction([
    db.adCampaignCreative.deleteMany({
      where: {
        shop,
        OR: [
          { creativePerformanceId: { in: performanceRecordIds } },
          ...(savedCreativeIds.length
            ? [{ savedCreativeId: { in: savedCreativeIds } }]
            : []),
        ],
      },
    }),
    db.creatorAttribution.deleteMany({
      where: { shop, creativePerformanceId: { in: performanceRecordIds } },
    }),
    db.creativePerformance.deleteMany({
      where: { shop, id: { in: performanceRecordIds } },
    }),
    ...(savedCreativeIds.length
      ? [
          db.savedCreative.deleteMany({
            where: { shop, id: { in: savedCreativeIds } },
          }),
        ]
      : []),
  ]);

  return { performanceRecordIds, savedCreativeIds };
}

export async function deleteVideoAnalysisRecord(shop, analysisId) {
  if (!analysisId) return null;

  const existing = await db.videoAnalysis.findFirst({
    where: { id: analysisId, shop },
  });

  if (!existing) {
    return null;
  }

  await db.videoAnalysis.delete({
    where: { id: existing.id },
  });

  await createActivityLogRecord(shop, {
    type: "creative_deleted",
    title: "Creative analysis removed",
    description: `Removed ${
      existing.fileName || existing.productTitle || "saved analysis"
    } from Creative Library`,
    payload: {
      analysisId: existing.id,
      productId: existing.productId,
      productTitle: existing.productTitle,
      mediaFilesDeleted: false,
    },
  });

  return {
    ...existing,
    payload: parsePayload(existing.payloadJson),
  };
}

export async function listRevenueBlueprints(shop, limit = 5) {
  const records = await db.revenueBlueprint.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records
    .map((record) => ({
      ...record,
      payload: parsePayload(record.payloadJson),
    }))
    .filter((record) => !isSeededDemoRecord(record));
}

export async function saveRevenueBlueprintRecord(shop, blueprint) {
  const persistenceKey = persistenceFingerprint("revenue_blueprint", blueprint);
  const existing = await findRecordByPersistenceKey(
    "revenueBlueprint",
    shop,
    persistenceKey,
  );

  if (existing) {
    return {
      ...existing,
      payload: parsePayload(existing.payloadJson),
      wasCreated: false,
    };
  }

  const saved = await db.revenueBlueprint.create({
    data: {
      shop,
      payloadJson: JSON.stringify(withPersistenceMetadata(blueprint, persistenceKey)),
    },
  });
  await createActivityLogRecord(shop, {
    type: "blueprint",
    title: "Blueprint saved",
    description:
      saved.payloadJson && parsePayload(saved.payloadJson)?.context?.generatedFor
        ? parsePayload(saved.payloadJson).context.generatedFor
        : "Revenue blueprint saved",
    relatedType: "RevenueBlueprint",
    relatedId: saved.id,
  });

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    wasCreated: true,
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

export async function getWorkspaceSettingsMap(shop, defaults = {}) {
  const records = await db.workspaceSetting.findMany({
    where: {
      shop,
      key: {
        in: Object.keys(defaults),
      },
    },
  });
  const values = { ...defaults };

  records.forEach((record) => {
    values[record.key] = record.value;
  });

  return values;
}

export async function getWorkspaceProfile(shop) {
  const record = await getWorkspaceSetting(shop, WORKSPACE_PROFILE_KEY);
  return normalizeWorkspaceProfile(parsePayload(record?.value) || {});
}

export async function saveWorkspaceProfile(shop, profile = {}) {
  const normalized = normalizeWorkspaceProfile({
    ...profile,
    completedAt: profile.completedAt || new Date().toISOString(),
    skippedAt: profile.skippedAt || "",
  });

  await upsertWorkspaceSetting(
    shop,
    WORKSPACE_PROFILE_KEY,
    JSON.stringify(normalized),
  );

  return normalized;
}

export function mergeWorkspaceProfileWithProduct(profile = {}, product = null) {
  if (!product) return profile;

  return {
    ...profile,
    setupMode: "primary_product",
    category: profile.category || product.productType || "",
    mainProduct: product.title || profile.mainProduct || "",
    selectedProductHandle: product.handle || "",
    selectedProductId: product.id || "",
    selectedProductImageAlt: product.featuredImage?.altText || "",
    selectedProductImageUrl: product.featuredImage?.url || "",
    selectedProductProductType: product.productType || "",
    selectedProductVendor: product.vendor || "",
  };
}

export async function skipWorkspaceProfile(shop) {
  const current = await getWorkspaceProfile(shop);
  const skipped = normalizeWorkspaceProfile({
    ...current,
    completedAt: current.completedAt || new Date().toISOString(),
    skippedAt: new Date().toISOString(),
  });

  await upsertWorkspaceSetting(
    shop,
    WORKSPACE_PROFILE_KEY,
    JSON.stringify(skipped),
  );

  return skipped;
}

export async function isWorkspaceOnboarded(shop) {
  const profile = await getWorkspaceProfile(shop);
  return Boolean(profile.completedAt || profile.skippedAt);
}

export function workspaceProfileHasContext(profile = {}) {
  if (profile.setupMode === "entire_store") return true;

  return Boolean(
    profile.mainProduct ||
      profile.category ||
      profile.targetCustomer ||
      profile.creativeGoal,
  );
}

export function productFromWorkspaceProfile(profile = {}) {
  const normalized = normalizeWorkspaceProfile(profile);
  const title = normalized.mainProduct || "";

  if (normalized.setupMode === "entire_store") return null;
  if (!title) return null;

  return {
    id: normalized.selectedProductId || `workspace-profile-${slugify(title)}`,
    title,
    handle: normalized.selectedProductHandle || slugify(title),
    status: "ACTIVE",
    description: [
      normalized.category ? `Category: ${normalized.category}.` : "",
      normalized.selectedProductProductType
        ? `Product type: ${normalized.selectedProductProductType}.`
        : "",
      normalized.selectedProductVendor
        ? `Vendor: ${normalized.selectedProductVendor}.`
        : "",
      normalized.targetCustomer
        ? `Target customer: ${normalized.targetCustomer}.`
        : "",
      normalized.creativeGoal ? `Creative goal: ${normalized.creativeGoal}.` : "",
      normalized.brandTone ? `Tone: ${normalized.brandTone}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    featuredImage: normalized.selectedProductImageUrl
      ? {
          url: normalized.selectedProductImageUrl,
          altText: normalized.selectedProductImageAlt,
        }
      : null,
    price: "0.00",
    currencyCode: "USD",
    totalInventory: null,
    productType: normalized.selectedProductProductType,
    vendor: normalized.selectedProductVendor,
    source: "workspace_profile",
  };
}

export async function upsertWorkspaceSettings(shop, settings) {
  const entries = Object.entries(settings);

  await db.$transaction(
    entries.map(([key, value]) =>
      db.workspaceSetting.upsert({
        where: {
          shop_key: {
            shop,
            key,
          },
        },
        create: {
          shop,
          key,
          value: String(value),
        },
        update: {
          value: String(value),
        },
      }),
    ),
  );

  return getWorkspaceSettingsMap(shop, settings);
}

export async function createActivityLogRecord(shop, activity = {}) {
  if (!shop || !activity.type || !activity.title) return null;

  if (activity.relatedType && activity.relatedId) {
    const existing = await db.activityLog.findFirst({
      where: {
        shop,
        type: activity.type,
        relatedType: activity.relatedType,
        relatedId: activity.relatedId,
      },
    });

    if (existing) return existing;
  }

  return db.activityLog.create({
    data: {
      shop,
      type: activity.type,
      title: activity.title,
      description: activity.description || "",
      relatedType: activity.relatedType || null,
      relatedId: activity.relatedId || null,
      payloadJson: activity.payload ? JSON.stringify(activity.payload) : null,
    },
  });
}

export async function listActivityLogs(shop, { type = "all", limit = 50 } = {}) {
  const records = await db.activityLog.findMany({
    where: {
      shop,
      ...(type && type !== "all" ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records
    .map((record) => ({
      ...record,
      payload: parsePayload(record.payloadJson),
    }))
    .filter((record) => !isSeededDemoActivity(record));
}

export async function clearActivityLogs(shop) {
  return db.activityLog.deleteMany({ where: { shop } });
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
  if (!shop || typeof shop !== "string" || !shop.trim()) {
    throw new Error("A Shopify shop is required to delete workspace data.");
  }

  const shopScope = shop.trim();
  const storage = await deleteUploadedWorkspaceFiles(shopScope);
  await db.$transaction([
    db.adCampaignCreative.deleteMany({ where: { shop: shopScope } }),
    db.creatorAttribution.deleteMany({ where: { shop: shopScope } }),
    db.adCampaign.deleteMany({ where: { shop: shopScope } }),
    db.adPerformanceDaily.deleteMany({ where: { shop: shopScope } }),
    db.adPlatformConnection.deleteMany({ where: { shop: shopScope } }),
    db.savedBrief.deleteMany({ where: { shop: shopScope } }),
    db.videoAnalysis.deleteMany({ where: { shop: shopScope } }),
    db.savedCreative.deleteMany({ where: { shop: shopScope } }),
    db.revenueBlueprint.deleteMany({ where: { shop: shopScope } }),
    db.workspaceRequest.deleteMany({ where: { shop: shopScope } }),
    db.workspaceSetting.deleteMany({ where: { shop: shopScope } }),
    db.activityLog.deleteMany({ where: { shop: shopScope } }),
    db.creator.deleteMany({ where: { shop: shopScope } }),
    db.creativePerformance.deleteMany({ where: { shop: shopScope } }),
  ]);
  return { shop: shopScope, storage };
}

export async function deleteWorkspaceDataFromSettingsForm(shop, formData) {
  if (String(formData.get("confirmation") || "") !== "DELETE") {
    return { deletionError: "Type DELETE to confirm data deletion." };
  }

  try {
    const deletion = await deleteWorkspaceData(shop);
    return {
      deletion,
      deletionSuccess: "BluePrintAI data was deleted for this Shopify store.",
    };
  } catch (error) {
    return { deletionError: error.message || "Could not delete BluePrintAI data." };
  }
}

export const DEMO_WORKSPACE_RESET_MODELS = [
  "AdCampaignCreative",
  "AdCampaign",
  "SavedBrief",
  "VideoAnalysis",
  "SavedCreative",
  "RevenueBlueprint",
  "WorkspaceRequest",
  "ActivityLog",
  "CreativePerformance",
];

export const RESET_DEMO_WORKSPACE_INTENT = "resetDemoWorkspace";

export async function resetDemoWorkspaceFromSettingsForm(shop, formData) {
  const confirmation = String(formData.get("confirmation") || "");

  if (confirmation !== "RESET") {
    return { resetError: "Type RESET to confirm the workspace reset." };
  }

  try {
    const reset = await resetDemoWorkspace(shop);

    return {
      reset,
      resetSuccess: "Demo workspace data was reset for this Shopify store.",
    };
  } catch (error) {
    return { resetError: error.message || "Could not reset workspace data." };
  }
}

export async function resetDemoWorkspace(shop) {
  if (!shop || typeof shop !== "string" || !shop.trim()) {
    throw new Error("A Shopify shop is required to reset workspace data.");
  }

  const shopScope = shop.trim();
  const uploadedFiles = await deleteUploadedWorkspaceFiles(shopScope);
  const [
    adCampaignCreatives,
    adCampaigns,
    savedBriefs,
    videoAnalyses,
    savedCreatives,
    revenueBlueprints,
    workspaceRequests,
    workspaceSettings,
    activityLogs,
    creativePerformance,
  ] = await db.$transaction([
    db.adCampaignCreative.deleteMany({ where: { shop: shopScope } }),
    db.adCampaign.deleteMany({ where: { shop: shopScope } }),
    db.savedBrief.deleteMany({ where: { shop: shopScope } }),
    db.videoAnalysis.deleteMany({ where: { shop: shopScope } }),
    db.savedCreative.deleteMany({ where: { shop: shopScope } }),
    db.revenueBlueprint.deleteMany({ where: { shop: shopScope } }),
    db.workspaceRequest.deleteMany({ where: { shop: shopScope } }),
    db.workspaceSetting.deleteMany({ where: { shop: shopScope } }),
    db.activityLog.deleteMany({ where: { shop: shopScope } }),
    db.creativePerformance.deleteMany({ where: { shop: shopScope } }),
  ]);

  const result = {
    shop: shopScope,
    deleted: {
      AdCampaignCreative: adCampaignCreatives.count,
      AdCampaign: adCampaigns.count,
      SavedBrief: savedBriefs.count,
      VideoAnalysis: videoAnalyses.count,
      SavedCreative: savedCreatives.count,
      RevenueBlueprint: revenueBlueprints.count,
      WorkspaceRequest: workspaceRequests.count,
      WorkspaceSetting: workspaceSettings.count,
      ActivityLog: activityLogs.count,
      CreativePerformance: creativePerformance.count,
      UploadedFiles: uploadedFiles.deletedFiles,
    },
    preserved: ["Session"],
    storage: uploadedFiles,
  };

  logResetSummary(result);

  return result;
}

function logResetSummary(result) {
  if (process.env.NODE_ENV !== "development") return;

  console.info(`Reset Demo Workspace complete for ${result.shop}:`);
  Object.entries(result.deleted).forEach(([model, count]) => {
    console.info(`- ${model} deleted: ${count}`);
  });
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
  const [briefs, analyses, creatives, blueprints, requests, settings, activities] =
    await Promise.all([
      db.savedBrief.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.videoAnalysis.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.savedCreative.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.revenueBlueprint.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.workspaceRequest.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
      db.workspaceSetting.findMany({ where: { shop }, orderBy: { key: "asc" } }),
      db.activityLog.findMany({ where: { shop }, orderBy: { createdAt: "desc" } }),
    ]);

  return {
    shop,
    exportedAt: new Date().toISOString(),
    savedBriefs: briefs.map(withParsedPayload),
    videoAnalyses: analyses.map(withParsedPayload),
    savedCreatives: creatives.map(withParsedPayload),
    revenueBlueprints: blueprints.map(withParsedPayload),
    workspaceRequests: requests.map(withParsedPayload),
    activityLogs: activities.map(withParsedPayload),
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
    orderScopeEnabled: false,
    scopes,
    errors: [],
    productLoad: {
      complete: false,
      count: 0,
      limit: MAX_SHOPIFY_PRODUCTS,
    },
  };

  try {
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage && result.products.length < MAX_SHOPIFY_PRODUCTS) {
      const response = await admin.graphql(PRODUCT_QUERY, {
        variables: { cursor },
      });
      const json = await response.json();

      if (json.errors || !json.data?.products) {
        result.errors.push(
          result.products.length
            ? "Some Shopify products could not be loaded. Showing the products loaded so far."
            : "Products could not be loaded from Shopify.",
        );
        break;
      }

      result.shop = json.data.shop || result.shop;
      const products = json.data.products.nodes || [];
      result.products.push(
        ...products.map((product) => normalizeProduct(product, result.shop)),
      );

      const pageInfo = json.data.products.pageInfo || {};
      hasNextPage = Boolean(pageInfo.hasNextPage);
      cursor = pageInfo.endCursor || null;
      if (hasNextPage && !cursor) {
        result.errors.push(
          "Shopify reported more products but did not provide a pagination cursor. Showing the products loaded so far.",
        );
        break;
      }
    }

    if (hasNextPage && result.products.length >= MAX_SHOPIFY_PRODUCTS) {
      result.errors.push(
        `Shopify product context is limited to the ${MAX_SHOPIFY_PRODUCTS} most recently updated products for this workspace.`,
      );
    }

    result.productLoad = {
      complete: !hasNextPage,
      count: result.products.length,
      limit: MAX_SHOPIFY_PRODUCTS,
    };
  } catch (error) {
    result.errors.push(
      result.products.length
        ? "Some Shopify products could not be loaded. Showing the products loaded so far."
        : "Products could not be loaded from Shopify.",
    );
    result.productLoad.count = result.products.length;
  }

  return result;
}

export function buildDashboard(data) {
  const activeProducts = data.products.filter(
    (product) => product.status === "ACTIVE" || product.source === "demo",
  ).length;
  const creativeHealthScore = Math.min(
    94,
    Math.max(58, 62 + activeProducts * 4),
  );

  const actionItems = [
    {
      title: "Create product-specific ad angles",
      detail:
        "Turn your latest products into hooks, visual concepts, and CTA tests.",
      href: `/app/ad-briefs?productId=${encodeURIComponent(data.products[0]?.id || "")}&recommendationId=dashboard-ad-angles`,
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
        "Use Shopify catalog context and saved app activity as planning inputs for the next tests.",
      href: "/app/revenue-blueprint",
    },
  ];

  return {
    productCount: data.products.length,
    activeProducts,
    orderCount: 0,
    revenue: 0,
    currencyCode: data.shop.currencyCode || "USD",
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
      "Problem-solution brief",
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
    : /product|item|offer|bundle|kit/.test(text);

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

export function buildRecommendations(products, { includeDemo = false } = {}) {
  if (!products.length) {
    return includeDemo ? demoRecommendations() : [];
  }

  const productRecommendations = products.slice(0, 6).map((product, index) => ({
    id: `rec-${product.id}`,
    productId: product.id,
    productTitle: product.title,
    priority: index < 2 ? "High" : "Medium",
    expectedImpact: "Improve creative clarity before paid traffic testing.",
    title: `Test a sharper angle for ${product.title}`,
    detail:
      product.description?.length > 80
        ? "Convert the strongest benefit from the product description into a hook and proof sequence."
        : "Add benefit-led description detail, then test a direct product demo creative.",
    nextAction: `Create a brief for ${product.title} and run one hook, one proof shot, and one CTA variation.`,
  }));

  return productRecommendations;
}

export function buildCreators(products = [], creatives = [], { includeDemo = false } = {}) {
  // Sample creator identities must never enter an authenticated merchant
  // workspace. They are available only to explicit, non-production fixtures.
  if (!includeDemo) return [];

  const productPool = products.length ? products : DEMO_PRODUCTS;

  if (!productPool.length) {
    return [];
  }
  const assignedCreativeIds = new Set();

  const creatorRows = demoCreators.map((creator, index) => {
    const fallbackProduct = productPool[index % Math.max(productPool.length, 1)] || {};
    const matchedProduct =
      productPool.find((product) => product.title === creator.topProduct) ||
      fallbackProduct;
    const savedForProduct = creatives.filter(
      (creative) => {
        const creativeId = creative.id || creative.sourceId || creative.sourceCreativeId;
        if (creativeId && assignedCreativeIds.has(creativeId)) return false;

        const creativeCreatorKey = creatorIdentityKey(creative);
        if (creativeCreatorKey) {
          return creativeCreatorKey === creatorIdentityKey(creator);
        }

        return (
          creative.productId === matchedProduct.id ||
          creative.productTitle === matchedProduct.title
        );
      },
    );
    savedForProduct.forEach((creative) => {
      const creativeId = creative.id || creative.sourceId || creative.sourceCreativeId;
      if (creativeId) assignedCreativeIds.add(creativeId);
    });
    const demoCreativeRows = savedForProduct.length
      ? savedForProduct.map((creative) => ({
          id: creative.id,
          title: creative.title,
          angle: creative.angle || "Saved analysis",
          href: `/app/creative-library?creativeId=${encodeURIComponent(creative.id)}`,
        }))
      : [];
    const fitScore = Math.min(
      98,
      Math.round(
        72 +
          creator.engagementRate * 1.2 +
          creator.conversionRate * 2 +
          Math.min(creator.orders, 400) / 24,
      ),
    );

    return {
      ...creator,
      status: index < 3 ? "Active" : index < 5 ? "Testing" : "Available",
      specialty: creator.niche,
      channel: creator.platform,
      productId: matchedProduct.id || `demo-product-${index}`,
      productTitle: matchedProduct.title || creator.topProduct,
      fitScore,
      avgHookScore: Math.min(99, 80 + index + Math.round(creator.engagementRate)),
      responseRate: `${Math.round(68 + creator.conversionRate * 4)}%`,
      creativeCount: Math.max(2, demoCreativeRows.length + 2),
      projectedImpact: `${DEMO_PERFORMANCE_LABEL}. ${creator.recommendedNextAction}`,
      notes: [
        `Top product: ${creator.topProduct}.`,
        `Best angle: ${creator.topCreativeAngle}.`,
        creator.recommendedNextAction,
      ],
      creatives: demoCreativeRows,
      brandName: demoBrand.name,
    };
  });

  return dedupeCreatorRows(creatorRows);
}

function dedupeCreatorRows(creators = []) {
  const byCreator = new Map();

  creators.forEach((creator) => {
    const key = creatorIdentityKey(creator);
    const fallbackKey = `fallback:${creator.source || creator.platform || creator.channel || "creator"}:${creator.productId || creator.productTitle || creator.id}`;
    const mapKey = key || fallbackKey;
    const existing = byCreator.get(mapKey);

    if (!existing) {
      byCreator.set(mapKey, creator);
      return;
    }

    const knownCreativeIds = new Set(
      (existing.creatives || []).map((creative) => creative.id).filter(Boolean),
    );
    const mergedCreatives = [
      ...(existing.creatives || []),
      ...(creator.creatives || []).filter((creative) => {
        if (!creative.id) return true;
        if (knownCreativeIds.has(creative.id)) return false;
        knownCreativeIds.add(creative.id);
        return true;
      }),
    ];

    byCreator.set(mapKey, {
      ...existing,
      creativeCount: Math.max(existing.creativeCount || 0, creator.creativeCount || 0),
      creatives: mergedCreatives,
    });
  });

  return [...byCreator.values()];
}

function creatorIdentityKey(record = {}) {
  const payload = record.payload || {};
  const handle =
    record.creatorHandle ||
    record.handle ||
    payload.creatorHandle ||
    payload.creator_handle;
  const name =
    record.creatorName ||
    record.name ||
    record.creator ||
    payload.creatorName ||
    payload.creator_name ||
    payload.creator;
  const normalizedHandle = normalizeCreatorIdentity(handle);

  if (normalizedHandle) return `handle:${normalizedHandle}`;

  const normalizedName = normalizeCreatorIdentity(name);
  return normalizedName ? `name:${normalizedName}` : "";
}

function normalizeCreatorIdentity(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function findCreator(creators = [], creatorId = "") {
  return creators.find((creator) => creator.id === creatorId) || null;
}

export function buildDataImportJobs(merchantData, requests = []) {
  const productCount = merchantData.products?.length || 0;
  const orderCount = merchantData.orders?.length || 0;
  const latestProduct = merchantData.products?.[0];

  return [
    {
      id: "shopify-products",
      source: "Shopify catalog",
      status: productCount ? "Available" : "No Shopify products",
      records: productCount,
      updatedAt: latestProduct?.updatedAt || new Date().toISOString(),
      detail: productCount
        ? "Product titles, handles, status, product types, vendors, images, and variant prices are available from the authenticated Shopify context."
        : "No Shopify products were returned. Imported product names or manual workspace context may still support product-based planning outputs.",
      href: "/app/ad-briefs",
    },
    {
      id: "shopify-orders",
      source: "Shopify orders",
      status: "Not requested",
      records: orderCount,
      updatedAt: merchantData.orders?.[0]?.createdAt || "",
      detail:
        "Order reads are not requested in this build. Current planning workflows use Shopify catalog context and saved app records.",
      href: "/app/revenue-blueprint",
    },
    {
      id: "workspace-requests",
      source: "Workspace activity",
      status: requests.length ? "Tracked" : "Ready",
      records: requests.length,
      updatedAt: requests[0]?.createdAt || "",
      detail: "Exports, disconnect requests, and workspace operations are stored per authenticated Shopify shop.",
      href: "/app/activity-log",
    },
  ];
}

export function buildActivityEvents({
  briefs = [],
  creatives = [],
  analyses = [],
  blueprints = [],
  requests = [],
}) {
  return [
    ...briefs.map((brief) => ({
      id: `brief-${brief.id}`,
      type: "Brief",
      title: `Generated brief for ${brief.productTitle}`,
      detail: brief.angle,
      href: `/app/ad-briefs?productId=${encodeURIComponent(brief.productId)}&briefId=${encodeURIComponent(brief.id)}`,
      createdAt: brief.createdAt,
    })),
    ...creatives.map((creative) => ({
      id: `creative-${creative.id}`,
      type: "Creative",
      title: creative.title,
      detail: `${creative.productTitle} · ${creative.angle || "Saved analysis"}`,
      href: `/app/creative-library?creativeId=${encodeURIComponent(creative.id)}`,
      createdAt: creative.createdAt,
    })),
    ...analyses.map((analysis) => ({
      id: `analysis-${analysis.id}`,
      type: "Analysis",
      title: `Analyzed ${analysis.fileName || analysis.productTitle}`,
      detail: analysis.savedToLibrary ? "Saved to creative library" : "Analysis only",
      href: "/app/video-analysis",
      createdAt: analysis.createdAt,
    })),
    ...blueprints.map((blueprint) => ({
      id: `blueprint-${blueprint.id}`,
      type: "Blueprint",
      title: "Revenue blueprint generated",
      detail: blueprint.payload?.summary || "Action plan created",
      href: `/app/revenue-blueprint?blueprintId=${encodeURIComponent(blueprint.id)}`,
      createdAt: blueprint.createdAt,
    })),
    ...requests.map((request) => ({
      id: `request-${request.id}`,
      type: "Workspace",
      title: request.type.replace(/_/g, " "),
      detail: request.status,
      href: "/app/settings",
      createdAt: request.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function buildBrief(product, context = {}) {
  const selected =
    product ||
    context.product ||
    productFromWorkspaceProfile(context.workspaceProfile) || {
      id: "workspace-product-context",
      title: "your main product",
      handle: "workspace-product-context",
      description: "No product context has been configured yet.",
      source: "workspace_profile",
    };
  const sourceLabel = context.creativeTitle
      ? `Creative source: ${context.creativeTitle}.`
      : context.recommendationTitle
        ? `Recommendation source: ${context.recommendationTitle}.`
      : selected.source === "imported"
        ? "Imported product context: merchant-provided creative or performance data."
      : selected.source === "workspace_profile"
        ? "Workspace profile source: onboarding product context."
        : "Catalog source: Shopify product data.";
  const generatedAt = new Date().toISOString();
  const importedPerformance = selected.source === "imported"
    ? {
        relatedCreativeCount: selected.relatedCreativeCount ?? null,
        creatorNames: selected.creatorNames || [],
        creatorHandles: selected.creatorHandles || [],
        impressions: selected.impressions ?? null,
        clicks: selected.clicks ?? null,
        orders: selected.orders ?? null,
        conversions: selected.conversions ?? null,
        revenue: selected.revenue ?? null,
        spend: selected.spend ?? null,
        ctr: selected.ctr ?? null,
        cvr: selected.cvr ?? null,
        roas: selected.roas ?? null,
        bestPerformingCreative: selected.bestPerformingCreative ?? null,
        dateRange: selected.dateRange ?? null,
      }
    : null;

  return {
    productId: selected.id,
    productTitle: selected.title,
    angle:
      context.angle ||
      (context.creativeTitle ? "Creative-derived brief" : "Problem-solution brief"),
    generatedAt,
    context: {
      productId: selected.id,
      productName: selected.productName || selected.title,
      productSource: selected.source || "shopify",
      productSourceLabel: selected.sourceLabel || sourceLabel.replace(/\.$/, ""),
      importedPerformance,
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
      context.hook ||
        demoHookForProduct(selected) ||
        hookForProduct(selected),
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
      "A simple product proof shot beats a vague lifestyle shot.",
      "Lead with the result, then explain the feature.",
    ],
    visualConcepts: [
      context.visual || context.creativeRecommendation || "Close-up product use with text overlay naming the benefit.",
      "Before-and-after sequence showing the customer problem and result.",
      "Founder or creator-style walkthrough with one clear proof point.",
    ],
    ctas: [context.cta || "Shop now", "Try it today", "View product details"],
    recommendedCreatorType:
      context.recommendedCreatorType ||
      demoRecommendedCreatorType(selected) ||
      "UGC product demo creator",
    successMetric:
      context.successMetric ||
      "Improve hook score, click-through rate, and product-page conversion rate.",
    shotList: [
      "First-frame problem/result close-up.",
      "Product-in-hand usage shot.",
      "One proof or comparison moment.",
      "Final product/offer frame with CTA.",
    ],
    creatorDirection:
      `${sourceLabel}${importedPerformance?.bestPerformingCreative?.name ? ` Use the imported signal from ${importedPerformance.bestPerformingCreative.name} as context, without treating it as a guarantee.` : ""} Use natural, specific language. Avoid unsupported performance guarantees and keep claims tied to available evidence.`,
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "creator";
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
    return `/app/ad-briefs?${params.toString()}`;
  }

  if (type === "cta" || /cta|checkout|claim|shop now/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

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
  const topProduct =
    context.product ||
    data.products[0] ||
    productFromWorkspaceProfile(context.workspaceProfile) || {
      id: "workspace-product-context",
      title: "your main product",
      description: "No product context has been configured yet.",
      source: "workspace_profile",
    };
  const recommendation = context.recommendation || null;
  const performanceRecords = context.performanceRecords || [];
  const demoRecords = performanceRecords.filter(
    (record) => record.sourcePlatform === "shopify_demo",
  );
  const importedRecords = performanceRecords.filter((record) =>
    /import|csv/.test(
      `${record.importSource || ""} ${record.sourceRecordType || ""}`.toLowerCase(),
    ),
  );
  const paidSignalRecords = importedRecords.filter(
    (record) =>
      Number(record.revenue || 0) > 0 ||
      Number(record.orders || 0) > 0 ||
      Number(record.spend || 0) > 0,
  );
  const topDemoRecords = demoRecords
    .slice()
    .sort((left, right) => Number(right.revenue || 0) - Number(left.revenue || 0))
    .slice(0, 4);
  const performanceContext =
    importedRecords.length > 0
      ? paidSignalRecords.length > 0
        ? `Use ${importedRecords.length} imported engagement/performance record${importedRecords.length === 1 ? "" : "s"} as planning context, with optional revenue, orders, or spend available for ${paidSignalRecords.length}.`
        : `Use ${importedRecords.length} imported public engagement record${importedRecords.length === 1 ? "" : "s"} for engagement-goal planning until deeper performance stats are available.`
      : performanceRecords.length > 0
      ? `Use ${performanceRecords.length} CreativePerformance record${performanceRecords.length === 1 ? "" : "s"} as the shared creative/ad performance context.`
      : "Connect an ad platform or upload creatives manually to start analyzing performance.";
  const recommendationType = String(recommendation?.type || "").replace("_", " ");
  const ctaOrPagePlan =
    recommendation && /cta|product_page/.test(String(recommendation.type || ""))
      ? `Act on "${recommendation.title}" for ${topProduct.title}: ${recommendation.nextAction || recommendation.detail}`
      : `Clarify the main product promise for ${topProduct.title} above the fold and in every ad hook.`;

  return {
    context: {
      productId: topProduct.id,
      productTitle: topProduct.title,
      productName: topProduct.productName || topProduct.title,
      productSource: topProduct.source || "shopify",
      productSourceLabel:
        topProduct.source === "imported"
          ? "Imported product context (CSV/ad data)"
          : topProduct.source === "demo"
            ? "Demo product"
            : topProduct.source === "workspace_profile"
              ? "Workspace product context"
              : "Shopify product",
      importedPerformance: topProduct.source === "imported"
        ? {
            relatedCreativeCount: topProduct.relatedCreativeCount ?? null,
            creatorNames: topProduct.creatorNames || [],
            creatorHandles: topProduct.creatorHandles || [],
            impressions: topProduct.impressions ?? null,
            clicks: topProduct.clicks ?? null,
            orders: topProduct.orders ?? null,
            conversions: topProduct.conversions ?? null,
            revenue: topProduct.revenue ?? null,
            spend: topProduct.spend ?? null,
            ctr: topProduct.ctr ?? null,
            cvr: topProduct.cvr ?? null,
            roas: topProduct.roas ?? null,
            bestPerformingCreative: topProduct.bestPerformingCreative ?? null,
            dateRange: topProduct.dateRange ?? null,
          }
        : null,
      recommendationId: recommendation?.id || null,
      recommendationTitle: recommendation?.title || null,
      recommendationType: recommendation?.type || null,
      generatedFor: recommendation
        ? `${topProduct.title} · ${recommendationType || "recommendation"}`
        : topProduct.title,
    },
    diagnosis: topProduct.source === "imported"
      ? paidSignalRecords.length > 0
        ? `${topProduct.title} uses imported CSV/ad performance context plus saved app activity; it is not a Shopify catalog product record.`
        : `${topProduct.title} uses imported CSV/ad engagement context; it is not a Shopify catalog product record. Revenue-backed guidance remains unavailable until commercial metrics are imported.`
      : importedRecords.length
      ? paidSignalRecords.length > 0
        ? `${topProduct.title} can move forward with planning guidance based on imported engagement and performance records plus saved app activity.`
        : `${topProduct.title} can move forward with engagement-led planning based on imported public engagement records and saved app activity. Revenue-backed guidance will improve once revenue, orders, or spend are imported.`
      : `${topProduct.title} can move forward with catalog-based positioning and saved app activity.`,
    priorities: [
      performanceContext,
      ctaOrPagePlan,
      "Create one creative brief per priority product before adding more channels.",
      "Use saved analyses, briefs, and creative records to choose the next product-level test.",
    ],
    demoAssumptions: demoRecords.length
      ? [
          `${DEMO_PERFORMANCE_LABEL}: revenue, orders, spend, ROAS, creator, and creative metrics are simulated for review testing.`,
          "Shopify product titles and handles remain live from the connected store when available.",
          "No Shopify Orders, Meta, TikTok, or TikTok Shop data is connected in this build.",
        ]
      : [],
    opportunities: (importedRecords.length ? importedRecords : topDemoRecords).slice(0, 4).map((record) => ({
      id: record.id,
      productTitle: record.productTitle,
      creatorName: record.creatorName || record.creatorHandle,
      angle: record.angle || record.hook,
      estimatedUpside: null,
      recommendation:
        record.revenue === null || record.revenue === undefined
          ? "Use this high-engagement record as an engagement planning signal and import revenue/orders later if available."
          : record.roas !== null && record.roas !== undefined && Number(record.roas) >= 3
          ? "Treat this as a stronger directional signal and verify it with a controlled hook test."
          : "Improve value framing before scaling spend.",
    })),
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
      "One problem-solution proof shot",
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
  return products.find((product) => product.id === productId) || products[0] || null;
}

export function findProductStrict(products, productId) {
  return products.find((product) => product.id === productId) || null;
}

export function resolveProductContext(products = [], profile = {}, productId = "") {
  const selectedProduct = findProductStrict(
    products,
    productId || (profile.setupMode === "primary_product" ? profile.selectedProductId : ""),
  );

  if (selectedProduct) return selectedProduct;

  if (profile.setupMode === "manual_product_context") {
    return productFromWorkspaceProfile(profile) || products[0] || null;
  }

  if (profile.setupMode === "primary_product") {
    return productFromWorkspaceProfile(profile) || products[0] || null;
  }

  return (
    products[0] ||
    productFromWorkspaceProfile(profile) ||
    null
  );
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

function normalizeProduct(product, shop = {}) {
  const variants = (product.variants?.nodes || []).map((variant) => ({
    id: variant.id,
    title: variant.title,
    price: String(variant.price || ""),
  }));
  const firstVariant = variants[0] || null;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    description: [
      product.productType ? `Product type: ${product.productType}.` : "",
      product.vendor ? `Vendor: ${product.vendor}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    featuredImage: product.featuredImage,
    price: firstVariant?.price || "0.00",
    currencyCode: shop.currencyCode || "USD",
    totalInventory: null,
    productType: product.productType || "",
    vendor: product.vendor || "",
    variants,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    source: "shopify",
  };
}

function hookForProduct(product) {
  const title = product.title || "this product";
  const firstBenefit = product.description
    ? product.description.split(".")[0].slice(0, 110)
    : "make the customer outcome obvious";

  return `If ${title} solves one problem, show ${firstBenefit.toLowerCase()} in the first three seconds.`;
}

function normalizeWorkspaceProfile(profile = {}) {
  const setupMode = normalizeWorkspaceSetupMode(profile.setupMode);

  return {
    setupMode,
    category: optionOrEmpty(profile.category, PRODUCT_CATEGORY_OPTIONS),
    mainProduct: cleanText(profile.mainProduct, 120),
    targetCustomer: cleanText(profile.targetCustomer, 160),
    creativeGoal: optionOrEmpty(profile.creativeGoal, CREATIVE_GOAL_OPTIONS),
    creativeSource: optionOrEmpty(profile.creativeSource, CREATIVE_SOURCE_OPTIONS),
    brandTone: optionOrEmpty(profile.brandTone, BRAND_TONE_OPTIONS),
    selectedProductHandle: cleanText(profile.selectedProductHandle, 120),
    selectedProductId: cleanText(profile.selectedProductId, 160),
    selectedProductImageAlt: cleanText(profile.selectedProductImageAlt, 160),
    selectedProductImageUrl: cleanText(profile.selectedProductImageUrl, 500),
    selectedProductProductType: cleanText(profile.selectedProductProductType, 120),
    selectedProductVendor: cleanText(profile.selectedProductVendor, 120),
    completedAt: cleanText(profile.completedAt, 64),
    skippedAt: cleanText(profile.skippedAt, 64),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWorkspaceSetupMode(value) {
  const normalized = cleanText(value, 80);
  return WORKSPACE_SETUP_MODES.includes(normalized)
    ? normalized
    : "entire_store";
}

function optionOrEmpty(value, options) {
  const normalized = cleanText(value, 80);
  return options.includes(normalized) ? normalized : "";
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isSeededDemoRecord(record = {}) {
  const productId =
    record.productId ||
    record.payload?.productId ||
    record.payload?.context?.productId ||
    record.payload?.result?.productId ||
    "";

  return DEMO_PRODUCT_IDS.has(productId);
}

function isSeededDemoActivity(record = {}) {
  const payloadProductId = record.payload?.productId || record.payload?.context?.productId || "";
  const text = `${record.title || ""} ${record.description || ""}`;

  return DEMO_PRODUCT_IDS.has(payloadProductId) || /GlowForge Beauty|GlowLift Facial Sculptor|Ice Roller Pro/i.test(text);
}

function demoHookForProduct(product = {}) {
  const hooks = {
    "GlowLift Facial Sculptor":
      "I tested this facial sculptor for 7 days, and this is the side-by-side result.",
    "Ice Roller Pro":
      "My morning puffiness routine takes 10 seconds now.",
    "LashLift Starter Kit":
      "I stopped paying for lash appointments after trying this starter kit.",
    "GlowPrep Headband Set":
      "This tiny setup upgrade keeps my whole skincare routine cleaner.",
    "Glass Skin Bundle":
      "Here is the full routine I would buy as a bundle instead of separately.",
  };

  return hooks[product.title] || "";
}

function demoRecommendedCreatorType(product = {}) {
  const creators = {
    "GlowLift Facial Sculptor": "review creator who can handle skepticism",
    "Ice Roller Pro": "TikTok GRWM creator with fast routine pacing",
    "LashLift Starter Kit": "before-after beauty creator",
    "GlowPrep Headband Set": "college or vanity setup creator",
    "Glass Skin Bundle": "premium skincare routine creator",
  };

  return creators[product.title] || "";
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

async function findRecordByPersistenceKey(modelName, shop, persistenceKey) {
  return db[modelName].findFirst({
    where: {
      shop,
      payloadJson: {
        contains: `"persistenceKey":"${persistenceKey}"`,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

function withPersistenceMetadata(payload, persistenceKey) {
  return {
    ...payload,
    persistence: {
      ...(payload?.persistence || {}),
      persistenceKey,
    },
  };
}

function persistenceFingerprint(type, value) {
  return crypto
    .createHash("sha256")
    .update(`${type}:${stableStringify(stripVolatileFields(value))}`)
    .digest("hex");
}

function stripVolatileFields(value) {
  if (Array.isArray(value)) return value.map(stripVolatileFields);

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["generatedAt", "generated_at", "persistence"].includes(key))
      .map(([key, entry]) => [key, stripVolatileFields(entry)]),
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
