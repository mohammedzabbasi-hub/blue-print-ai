import db from "../db.server.js";
import crypto from "node:crypto";
import {
  deletePrivateMediaObjects,
  deleteUploadedWorkspaceFiles,
  getPrivateMediaObject,
} from "../utils/upload-storage.server.js";
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

export const VIDEO_ANALYSIS_STATUS = Object.freeze({
  ACTIVE_DRAFT: "ACTIVE_DRAFT",
  DISCARDED: "DISCARDED",
  SAVED_REVIEW: "SAVED_REVIEW",
  SAVED_TO_LIBRARY: "SAVED_TO_LIBRARY",
});

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
    .map(normalizeCreativeBriefRecord)
    .filter((record) => !isSeededDemoRecord(record));
}

export async function findSavedBrief(shop, briefId) {
  if (!briefId) return null;

  const record = await db.savedBrief.findFirst({
    where: { id: briefId, shop },
  });

  if (!record) return null;

  const parsed = normalizeCreativeBriefRecord(record);

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

export function createCreativeBriefPreview(shop, input = {}, context = {}) {
  const product = context.product || {};
  const creative = context.creative || null;
  const analysis = context.analysis || null;
  const objective = cleanBriefText(input.campaignObjective) || "Conversions";
  const audience = cleanBriefText(input.targetAudience) || "Customers most likely to benefit from this product";
  const platform = cleanBriefText(input.platform) || "TikTok";
  const format = cleanBriefText(input.creativeFormat) || "Product demo";
  const tone = cleanBriefText(input.tone) || "Authentic";
  const sellingPoint = cleanBriefText(input.productSellingPoint) || product.description || product.productType || "the product's clearest practical benefit";
  const offer = cleanBriefText(input.offer);
  const duration = cleanBriefText(input.desiredVideoLength) || defaultBriefDuration(platform);
  const title = cleanBriefText(input.title) || `${product.title || "Product"} · ${objective} ${format}`;
  const creativePayload = creative?.payload || {};
  const analysisPayload = analysis?.payload || {};
  const analysisResult = analysisPayload.result?.analysis || analysisPayload.analysis || {};
  const sourceHook = cleanBriefText(
    creative?.hook || creativePayload.hook || analysisResult.hook || analysisResult.hook_analysis,
  );
  const productBenefit = cleanBriefText(sellingPoint);
  const hook = sourceHook || `What if ${product.title || "this product"} made ${productBenefit.toLowerCase()} easier to see in the first few seconds?`;
  const proofPoints = uniqueBriefValues([
    productBenefit,
    cleanBriefText(product.vendor) ? `Made by ${cleanBriefText(product.vendor)}` : "",
    cleanBriefText(creative?.angle || creativePayload.angle),
    cleanBriefText(analysisResult.summary || analysisPayload.result?.display?.summary),
  ]).slice(0, 4);
  const evidence = buildCreativeBriefEvidence({ analysis, creative, product });
  const missingDataNotes = [];
  if (!evidence.performanceMetrics?.length) {
    missingDataNotes.push("No connected performance data was available. This brief was generated from product context and creative-analysis inputs.");
  }
  if (!analysis) missingDataNotes.push("No saved video analysis was selected.");

  const preview = {
    version: 2,
    title,
    status: "DRAFT",
    setup: {
      productId: String(product.id || ""),
      productTitle: cleanBriefText(product.title) || "Product",
      sourceCreativeId: creative?.id || null,
      sourceCreativeTitle: creative ? creative.title || creative.creativeTitle || creativePayload.title || "Selected creative" : null,
      sourceVideoAnalysisId: analysis?.id || null,
      sourceVideoAnalysisTitle: analysis ? analysis.brief || analysis.fileName || analysisPayload.result?.display?.displayTitle || "Saved video analysis" : null,
      campaignObjective: objective,
      targetAudience: audience,
      platform,
      creativeFormat: format,
      tone,
      merchantNotes: cleanBriefText(input.merchantNotes),
      productSellingPoint: cleanBriefText(input.productSellingPoint),
      offer,
      desiredVideoLength: duration,
      restrictions: cleanBriefText(input.restrictions),
    },
    content: {
      mainConcept: `${format} that demonstrates ${productBenefit.toLowerCase()} for ${audience.toLowerCase()}.`,
      coreAngle: cleanBriefText(input.productSellingPoint) || cleanBriefText(creative?.angle || creativePayload.angle) || `Make the product benefit concrete through a quick, believable demonstration.`,
      hook,
      problem: `The audience needs ${productBenefit.toLowerCase()}, but may not immediately understand why ${product.title || "the product"} is relevant.`,
      solution: `Show ${product.title || "the product"} in use and connect one visible product moment directly to the audience need.`,
      productBenefit,
      proofPoints: proofPoints.length ? proofPoints : ["Use only claims supported by the product page or merchant-provided context."],
      sceneSequence: [
        `0–2s · Opening shot: Start on the result or problem while delivering the hook: “${hook}”`,
        `3–6s · Product reveal: Show ${product.title || "the product"} clearly and name the primary benefit.`,
        `7–12s · Demonstration: Capture one close, easy-to-follow use moment and one proof point.`,
        `13–${duration.replace(/[^0-9–-]/g, "") || "15"}s · Resolution: Reinforce the outcome${offer ? ` and introduce ${offer}` : ""}.`,
        `Final frame · CTA: Keep the product visible and use a direct action.`
      ],
      visualDirection: `${tone} lighting and pacing. Open with a tight result-led shot, move to a clean product-in-use close-up, and reserve the final frame for the product and CTA.`,
      onScreenText: [hook, productBenefit, offer, "Shop now"].filter(Boolean),
      voiceoverGuidance: `Use ${tone.toLowerCase()}, specific language. Speak to one audience problem, one product benefit, and one next action. Avoid unsupported guarantees.`,
      cta: offer ? `Shop ${product.title || "now"} and ${offer}.` : `Shop ${product.title || "now"} to see the product details.`,
      recommendedDuration: duration,
      platformGuidance: platformBriefGuidance(platform),
      testingVariations: [
        "Hook test: lead with the customer problem versus the desired result.",
        "Proof test: product demonstration versus creator explanation.",
        `CTA test: direct “Shop now” versus ${offer ? `offer-led “${offer}”` : "benefit-led product discovery"}.`,
      ],
    },
    evidence,
    assumptions: [
      `The selected audience is appropriate for the ${objective.toLowerCase()} objective.`,
      `The merchant will verify product claims, offer terms, and platform compliance before publishing.`,
    ],
    missingDataNotes,
    generatedAt: new Date().toISOString(),
  };

  return { ...preview, previewToken: creativeBriefPreviewToken(shop, preview) };
}

export function creativeBriefPreviewToken(shop, preview = {}) {
  return crypto
    .createHash("sha256")
    .update(`creative_brief_preview:${shop}:${stableStringify(stripVolatileFields(preview))}`)
    .digest("hex");
}

export async function saveCreativeBriefPreview(shop, preview, previewToken) {
  const normalized = normalizeCreativeBriefPayload(preview);
  const expectedToken = creativeBriefPreviewToken(shop, normalized);
  if (!previewToken || previewToken !== expectedToken) {
    throw new Error("This preview changed before it could be saved. Generate it again and retry.");
  }
  const idempotencyKey = `creative-brief:${shop}:${previewToken}`;
  const existing = await db.savedBrief.findUnique({ where: { idempotencyKey } });
  if (existing) return { ...normalizeCreativeBriefRecord(existing), wasCreated: false };

  try {
    const saved = await db.savedBrief.create({ data: creativeBriefData(shop, normalized, idempotencyKey) });
    await createActivityLogRecord(shop, {
      type: "creative_brief",
      title: "Creative brief saved",
      description: saved.title || saved.productTitle,
      relatedType: "SavedBrief",
      relatedId: saved.id,
    });
    return { ...normalizeCreativeBriefRecord(saved), wasCreated: true };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const raced = await db.savedBrief.findUnique({ where: { idempotencyKey } });
    if (!raced || raced.shop !== shop) throw error;
    return { ...normalizeCreativeBriefRecord(raced), wasCreated: false };
  }
}

export async function updateCreativeBrief(shop, briefId, updates = {}) {
  const existing = await db.savedBrief.findFirst({ where: { id: briefId, shop } });
  if (!existing) return null;
  const current = normalizeCreativeBriefRecord(existing);
  const payload = normalizeCreativeBriefPayload({
    ...current.payload,
    title: cleanBriefText(updates.title) || current.title,
    status: updates.status === "READY" ? "READY" : "DRAFT",
    setup: {
      ...current.payload.setup,
      campaignObjective: cleanBriefText(updates.campaignObjective) || current.campaignObjective,
      targetAudience: cleanBriefText(updates.targetAudience) || current.targetAudience,
      platform: cleanBriefText(updates.platform) || current.platform,
      creativeFormat: cleanBriefText(updates.creativeFormat) || current.creativeFormat,
      tone: cleanBriefText(updates.tone) || current.tone,
      merchantNotes: cleanBriefText(updates.merchantNotes),
    },
    content: { ...current.payload.content, ...(updates.content || {}) },
  });
  const saved = await db.savedBrief.update({
    where: { id: existing.id },
    data: creativeBriefData(shop, payload, existing.idempotencyKey),
  });
  await createActivityLogRecord(shop, { type: "creative_brief", title: "Creative brief updated", description: saved.title || saved.productTitle, relatedType: "SavedBrief", relatedId: saved.id });
  return normalizeCreativeBriefRecord(saved);
}

export async function duplicateCreativeBrief(shop, briefId, duplicateKey) {
  const existing = await db.savedBrief.findFirst({ where: { id: briefId, shop } });
  if (!existing) return null;
  const idempotencyKey = `creative-brief-copy:${shop}:${briefId}:${cleanBriefText(duplicateKey) || "default"}`;
  const prior = await db.savedBrief.findUnique({ where: { idempotencyKey } });
  if (prior) return { ...normalizeCreativeBriefRecord(prior), wasCreated: false };
  const source = normalizeCreativeBriefRecord(existing);
  const payload = normalizeCreativeBriefPayload({ ...source.payload, title: `${source.title} — Copy`, status: "DRAFT", generatedAt: new Date().toISOString() });
  try {
    const saved = await db.savedBrief.create({ data: creativeBriefData(shop, payload, idempotencyKey) });
    await createActivityLogRecord(shop, { type: "creative_brief", title: "Creative brief duplicated", description: saved.title, relatedType: "SavedBrief", relatedId: saved.id });
    return { ...normalizeCreativeBriefRecord(saved), wasCreated: true };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const raced = await db.savedBrief.findUnique({ where: { idempotencyKey } });
    if (!raced || raced.shop !== shop) throw error;
    return { ...normalizeCreativeBriefRecord(raced), wasCreated: false };
  }
}

export async function deleteCreativeBrief(shop, briefId) {
  const result = await db.savedBrief.deleteMany({ where: { id: briefId, shop } });
  if (!result.count) return false;
  await createActivityLogRecord(shop, { type: "creative_brief", title: "Creative brief deleted", relatedType: "SavedBrief", relatedId: briefId });
  return true;
}

export async function listVideoAnalyses(shop, limit = 8) {
  const records = await db.videoAnalysis.findMany({
    where: { shop, status: VIDEO_ANALYSIS_STATUS.SAVED_REVIEW },
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

export async function getCurrentVideoAnalysis(shop) {
  const record = await db.videoAnalysis.findFirst({
    where: { shop, status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT },
    orderBy: { createdAt: "desc" },
  });

  return record
    ? {
        ...record,
        payload: parsePayload(record.payloadJson),
      }
    : null;
}

export async function saveCurrentVideoAnalysisRecord({
  shop,
  product,
  fileName,
  brief,
  analysis,
}) {
  const existingDrafts = await db.videoAnalysis.findMany({
    where: { shop, status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT },
  });
  const mediaObjects = existingDrafts.flatMap((record) =>
    videoAnalysisMediaObjects(record),
  );
  const [, saved] = await db.$transaction([
    db.videoAnalysis.deleteMany({
      where: { shop, status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT },
    }),
    db.videoAnalysis.create({
      data: {
        shop,
        productId: product.id,
        productTitle: product.title,
        fileName,
        brief,
        payloadJson: JSON.stringify(analysis),
        status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT,
        savedToLibrary: false,
      },
    }),
  ]);

  await deleteUnreferencedPrivateMediaObjects(shop, mediaObjects);
  await createActivityLogRecord(shop, {
    type: "video_analysis_ready",
    title: "Current analysis ready",
    description: `${product.title} · ${fileName || "Uploaded video"}`,
    relatedType: "VideoAnalysis",
    relatedId: saved.id,
  });

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    replacedAnalysisIds: existingDrafts.map((record) => record.id),
  };
}

export async function clearCurrentVideoAnalysis(shop, analysisId = "") {
  const drafts = await db.videoAnalysis.findMany({
    where: {
      shop,
      status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT,
      ...(analysisId ? { id: analysisId } : {}),
    },
  });

  if (!drafts.length) return { cleared: false, deletedFiles: 0 };

  const mediaObjects = drafts.flatMap((record) => videoAnalysisMediaObjects(record));
  await db.videoAnalysis.deleteMany({
    where: { shop, id: { in: drafts.map((record) => record.id) } },
  });
  const mediaCleanup = await deleteUnreferencedPrivateMediaObjects(shop, mediaObjects);

  await createActivityLogRecord(shop, {
    type: "video_analysis_cleared",
    title: "Current analysis removed",
    description: drafts[0].fileName || drafts[0].productTitle || "Current analysis",
    payload: {
      analysisIds: drafts.map((record) => record.id),
      mediaFilesDeleted: mediaCleanup.deletedFiles > 0,
    },
  });

  return {
    cleared: true,
    deletedFiles: mediaCleanup.deletedFiles,
  };
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
  sourceAnalysisId = null,
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
  let existing = sourceAnalysisId
    ? await db.videoAnalysis.findFirst({
        where: {
          shop,
          sourceAnalysisId,
          status: VIDEO_ANALYSIS_STATUS.SAVED_REVIEW,
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!existing) {
    existing = await findRecordByPersistenceKey(
      "videoAnalysis",
      shop,
      persistenceKey,
      { status: VIDEO_ANALYSIS_STATUS.SAVED_REVIEW },
    );
  }

  if (existing) {
    if (sourceAnalysisId && !existing.sourceAnalysisId) {
      existing = await db.videoAnalysis.update({
        where: { id: existing.id },
        data: { sourceAnalysisId },
      });
    }
    if (savedToLibrary) {
      const existingPayload = parsePayload(existing.payloadJson);
      const previewMedia = await resolveReviewPreviewMediaForCreative({
        shop,
        reviewId: existing.id,
        mediaUrl,
        originalFilename: fileName,
      });
      await saveCreativeRecord(shop, {
        sourceType: "video_analysis",
        sourceId: existing.id,
        productId: product.id,
        productTitle: product.title,
        title: creativeTitle,
        angle: creativeSummary,
        payload: buildVideoAnalysisCreativePayload({
          analysis: existingPayload,
          creativeSummary,
          creativeTitle,
          fileName,
          fileSize,
          fileType,
          previewMedia,
        }),
      });
      await db.videoAnalysis.updateMany({
        where: { id: existing.id, shop },
        data: { savedToLibrary: true },
      });
    }

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
      status: VIDEO_ANALYSIS_STATUS.SAVED_REVIEW,
      sourceAnalysisId,
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
    const previewMedia = await resolveReviewPreviewMediaForCreative({
      shop,
      reviewId: saved.id,
      mediaUrl,
      originalFilename: fileName,
    });
    await saveCreativeRecord(shop, {
      sourceType: "video_analysis",
      sourceId: saved.id,
      productId: product.id,
      productTitle: product.title,
      title: creativeTitle,
      angle: creativeSummary,
      payload: buildVideoAnalysisCreativePayload({
        analysis,
        creativeSummary,
        creativeTitle,
        fileName,
        fileSize,
        fileType,
        previewMedia,
      }),
    });
  }

  return {
    ...saved,
    payload: parsePayload(saved.payloadJson),
    wasCreated: true,
  };
}

export async function saveCurrentVideoAnalysisAsReview(shop, analysisId) {
  const current = await db.videoAnalysis.findFirst({
    where: {
      id: analysisId,
      shop,
      status: VIDEO_ANALYSIS_STATUS.ACTIVE_DRAFT,
    },
  });

  if (!current) {
    throw new Error("The current analysis is no longer available. Analyze the video again.");
  }

  const payload = parsePayload(current.payloadJson) || {};
  const result = payload.result || payload;
  const display = result.display || {};
  const metadata = result.metadata || {};
  const media = result.media || {};
  const saved = await saveVideoAnalysisRecord({
    shop,
    product: { id: current.productId, title: current.productTitle },
    fileName: current.fileName || payload.filename || "Uploaded creative",
    fileType: metadata.file_type || "",
    fileSize: Number(metadata.file_size || 0),
    mediaUrl: media.mediaUrl || metadata.media_url || "",
    displayTitle: display.displayTitle || display.generatedTitle || current.fileName || "Video review",
    summary: display.summary || current.brief || "Creative analysis",
    brief: current.brief || display.summary || "Creative analysis",
    analysis: payload,
    savedToLibrary: false,
    sourceAnalysisId: current.id,
  });
  const linkedCreatives = await db.savedCreative.updateMany({
    where: {
      shop,
      sourceType: "video_analysis",
      sourceId: current.id,
    },
    data: { sourceId: saved.id },
  });

  if (linkedCreatives.count > 0) {
    await db.videoAnalysis.update({
      where: { id: saved.id },
      data: { savedToLibrary: true },
    });
    saved.savedToLibrary = true;
  }

  return saved;
}

export const REVIEW_PREVIEW_UNAVAILABLE_MESSAGE =
  "This review could not be saved because the uploaded video preview is unavailable. Please re-upload the video and try again.";

export async function resolveReviewPreviewMediaForCreative({
  shop,
  reviewId = "",
  uploadId = "",
  mediaFingerprint = "",
  mediaUrl = "",
  mediaPath = "",
  originalFilename = "",
} = {}) {
  const review = reviewId
    ? await db.videoAnalysis.findFirst({ where: { id: reviewId, shop } })
    : null;
  const reviewPayload = parsePayload(review?.payloadJson) || {};
  const payloadResult = reviewPayload.result || reviewPayload;
  const payloadMedia = payloadResult.media || reviewPayload.media || {};
  const payloadMetadata = payloadResult.metadata || reviewPayload.metadata || {};
  const candidates = [
    {
      fingerprint: mediaFingerprint,
      mediaPath,
      mediaUrl,
      originalFilename,
      uploadId,
    },
    {
      fingerprint: payloadMedia.fingerprint || payloadMetadata.media_fingerprint,
      mediaPath:
        payloadMedia.mediaPath ||
        payloadMedia.storedFileName ||
        payloadMetadata.media_path,
      mediaUrl: payloadMedia.mediaUrl || payloadMetadata.media_url,
      originalFilename:
        payloadMedia.originalName ||
        payloadMedia.fileName ||
        payloadResult.display?.originalFilename ||
        review?.fileName,
    },
  ];

  for (const candidate of candidates) {
    const resolved = await resolvePrivateMediaCandidate(shop, candidate);
    if (resolved) return resolved;
  }

  throw new Error(REVIEW_PREVIEW_UNAVAILABLE_MESSAGE);
}

function buildVideoAnalysisCreativePayload({
  analysis,
  creativeSummary,
  creativeTitle,
  fileName,
  fileSize,
  fileType,
  previewMedia,
}) {
  return {
    analysis,
    displayTitle: creativeTitle,
    summary: creativeSummary,
    description: creativeSummary,
    fileName,
    fileType,
    fileSize,
    mediaFingerprint: previewMedia.mediaFingerprint,
    mediaPath: previewMedia.mediaPath,
    mediaUrl: previewMedia.mediaUrl,
    brief: creativeSummary,
    mediaStored: true,
    mediaState: "private_upload",
    mediaStorage: previewMedia.mediaStorage,
    originalFilename: previewMedia.originalFilename || fileName,
    source: "video_analysis",
    uploadId: previewMedia.uploadId || "",
    video_url: previewMedia.mediaUrl,
  };
}

async function resolvePrivateMediaCandidate(shop, candidate = {}) {
  const parsed = parsePrivateMediaUrl(candidate.mediaUrl);
  const mediaPath = candidate.mediaPath || parsed?.storedFileName || "";
  const namespace = parsed?.namespace || "video-analysis";

  if (!mediaPath || !isPlayableMediaPath(mediaPath)) return null;
  if (candidate.mediaUrl && !parsed) return null;

  try {
    const media = await getPrivateMediaObject({
      shop,
      namespace,
      storedFileName: mediaPath,
    });
    if (!media?.body) return null;
  } catch {
    return null;
  }

  const mediaUrl =
    parsed?.mediaUrl ||
    `/app/media/${encodeURIComponent(namespace)}/${encodeURIComponent(mediaPath)}`;

  return {
    mediaFingerprint: candidate.fingerprint || fingerprintFromStoredFileName(mediaPath),
    mediaPath,
    mediaStorage: "private_uploads",
    mediaUrl,
    originalFilename: candidate.originalFilename || originalNameFromStoredFileName(mediaPath),
    uploadId: candidate.uploadId || "",
  };
}

function parsePrivateMediaUrl(value = "") {
  const raw = String(value || "").trim();

  if (!raw || /^https?:\/\//i.test(raw) || /render\.com|\/login\b/i.test(raw)) {
    return null;
  }

  let url;
  try {
    url = new URL(raw, "https://blueprintai.local");
  } catch {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "app" || parts[1] !== "media") {
    return null;
  }

  const namespace = decodeURIComponent(parts[2] || "");
  const storedFileName = decodeURIComponent(parts[3] || "");

  if (!namespace || !storedFileName || !isPlayableMediaPath(storedFileName)) {
    return null;
  }

  return {
    mediaUrl: `/app/media/${encodeURIComponent(namespace)}/${encodeURIComponent(storedFileName)}`,
    namespace,
    storedFileName,
  };
}

function isPlayableMediaPath(value = "") {
  return /\.(mp4|mov|m4v|webm)$/i.test(String(value || "").split(/[?#]/)[0]);
}

function fingerprintFromStoredFileName(value = "") {
  return String(value || "").split("-")[0] || "";
}

function originalNameFromStoredFileName(value = "") {
  return String(value || "").replace(/^[a-f0-9]{16}-/i, "");
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

  const deletionGroup = await resolveCreativeDeletionGroup(shop, {
    savedCreative: existing,
  });
  const duplicateIds = deletionGroup.savedCreativeIds;
  const mediaFiles = deletionGroup.mediaObjects;

  // Saved reviews/uploads may have been written more than once with the same
  // source or media identity. Remove the whole shop-local identity group so a
  // duplicate card cannot make a successful delete appear to have failed.
  await db.$transaction([
    db.adCampaignCreative.deleteMany({
      where: {
        shop,
        OR: [
          { savedCreativeId: { in: duplicateIds } },
          ...(deletionGroup.performanceRecordIds.length
            ? [
                {
                  creativePerformanceId: {
                    in: deletionGroup.performanceRecordIds,
                  },
                },
              ]
            : []),
        ],
      },
    }),
    db.savedCreative.deleteMany({
      where: { shop, id: { in: duplicateIds } },
    }),
    ...(deletionGroup.videoAnalysisIds.length
      ? [
          db.videoAnalysis.updateMany({
            where: { shop, id: { in: deletionGroup.videoAnalysisIds } },
            data: { savedToLibrary: false },
          }),
        ]
      : []),
    ...(deletionGroup.performanceRecordIds.length
      ? [
          db.creatorAttribution.deleteMany({
            where: {
              shop,
              creativePerformanceId: { in: deletionGroup.performanceRecordIds },
            },
          }),
          db.creativePerformance.deleteMany({
            where: { shop, id: { in: deletionGroup.performanceRecordIds } },
          }),
        ]
      : []),
  ]);
  const mediaCleanup = await deleteUnreferencedPrivateMediaObjects(shop, mediaFiles);

  await createActivityLogRecord(shop, {
    type: "creative_deleted",
    title: "Creative removed",
    description: `Removed ${existing.title || "Untitled Creative"} from Creative Library`,
    payload: {
      creativeId: existing.id,
      productId: existing.productId,
      productTitle: existing.productTitle,
      title: existing.title,
      mediaFilesDeleted: mediaCleanup.deletedFiles > 0,
      performanceRecordIds: deletionGroup.performanceRecordIds,
      savedCreativeIds: deletionGroup.savedCreativeIds,
      videoAnalysisIds: deletionGroup.videoAnalysisIds,
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
  const mediaCleanup = await deleteUnreferencedPrivateMediaObjects(
    shop,
    deleted.mediaObjects,
  );

  await createActivityLogRecord(shop, {
    type: "creative_deleted",
    title: "Imported creative removed",
    description: `Removed ${existing.adName || existing.creativeId || "imported creative"} from Creative Library`,
    payload: {
      creativeId: existing.creativeId,
      externalRecordsDeleted: false,
      mediaFilesDeleted: mediaCleanup.deletedFiles > 0,
      performanceRecordIds: deleted.performanceRecordIds,
      savedCreativeIds: deleted.savedCreativeIds,
      sourcePlatform: existing.platform,
      videoAnalysisIds: deleted.videoAnalysisIds,
    },
  });

  return existing;
}

async function deleteCreativePerformanceGroup(shop, existing) {
  const deletionGroup = await resolveCreativeDeletionGroup(shop, {
    performance: existing,
  });
  const { performanceRecordIds, savedCreativeIds, videoAnalysisIds } = deletionGroup;

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
    ...(videoAnalysisIds.length
      ? [
          db.videoAnalysis.updateMany({
            where: { shop, id: { in: videoAnalysisIds } },
            data: { savedToLibrary: false },
          }),
        ]
      : []),
  ]);

  return deletionGroup;
}

export async function deleteVideoAnalysisRecord(shop, analysisId) {
  if (!analysisId) return null;

  const existing = await db.videoAnalysis.findFirst({
    where: { id: analysisId, shop },
  });

  if (!existing) {
    return null;
  }

  const deletionGroup = await resolveCreativeDeletionGroup(shop, {
    videoAnalysis: {
      ...existing,
      payload: parsePayload(existing.payloadJson),
    },
  });
  const videoAnalysisIds = [
    ...new Set([existing.id, ...deletionGroup.videoAnalysisIds].filter(Boolean)),
  ];
  const mediaFiles = deletionGroup.mediaObjects;

  await db.videoAnalysis.delete({
    where: { id: existing.id },
  });
  if (deletionGroup.savedCreativeIds.length || deletionGroup.performanceRecordIds.length) {
    await db.$transaction([
      db.adCampaignCreative.deleteMany({
        where: {
          shop,
          OR: [
            ...(deletionGroup.savedCreativeIds.length
              ? [{ savedCreativeId: { in: deletionGroup.savedCreativeIds } }]
              : []),
            ...(deletionGroup.performanceRecordIds.length
              ? [
                  {
                    creativePerformanceId: {
                      in: deletionGroup.performanceRecordIds,
                    },
                  },
                ]
              : []),
          ],
        },
      }),
      db.creatorAttribution.deleteMany({
        where: {
          shop,
          creativePerformanceId: { in: deletionGroup.performanceRecordIds },
        },
      }),
      db.savedCreative.deleteMany({
        where: { shop, id: { in: deletionGroup.savedCreativeIds } },
      }),
      db.creativePerformance.deleteMany({
        where: { shop, id: { in: deletionGroup.performanceRecordIds } },
      }),
      ...(videoAnalysisIds.filter((id) => id !== existing.id).length
        ? [
            db.videoAnalysis.updateMany({
              where: {
                shop,
                id: { in: videoAnalysisIds.filter((id) => id !== existing.id) },
              },
              data: { savedToLibrary: false },
            }),
          ]
        : []),
    ]);
  }
  const mediaCleanup = await deleteUnreferencedPrivateMediaObjects(shop, mediaFiles);

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
      mediaFilesDeleted: mediaCleanup.deletedFiles > 0,
      performanceRecordIds: deletionGroup.performanceRecordIds,
      savedCreativeIds: deletionGroup.savedCreativeIds,
    },
  });

  return {
    ...existing,
    payload: parsePayload(existing.payloadJson),
  };
}

async function resolveCreativeDeletionGroup(
  shop,
  { performance = null, savedCreative = null, videoAnalysis = null } = {},
) {
  const allPerformances = await db.creativePerformance.findMany({ where: { shop } });
  const allSavedCreatives = await db.savedCreative.findMany({ where: { shop } });
  const allVideoAnalyses = await db.videoAnalysis.findMany({ where: { shop } });
  const seeds = [
    performance ? performanceDeletionIdentity(performance) : null,
    savedCreative ? savedCreativeDeletionIdentity(savedCreative) : null,
    videoAnalysis ? videoAnalysisDeletionIdentity(videoAnalysis) : null,
  ].filter(Boolean);
  const finalTokens = new Set(seeds.flatMap((identity) => identity.tokens));
  let matchedPerformances = [];
  let matchedSavedCreatives = [];
  let matchedVideoAnalyses = [];
  let changed = true;

  while (changed) {
    changed = false;
    const nextPerformances = allPerformances.filter((record) =>
      identitiesOverlap(finalTokens, performanceDeletionIdentity(record).tokens),
    );
    const nextSavedCreatives = allSavedCreatives.filter((record) =>
      identitiesOverlap(finalTokens, savedCreativeDeletionIdentity(record).tokens),
    );
    const nextVideoAnalyses = allVideoAnalyses.filter((record) =>
      identitiesOverlap(finalTokens, videoAnalysisDeletionIdentity(record).tokens),
    );
    const nextTokens = [
      ...nextPerformances.flatMap((record) => performanceDeletionIdentity(record).tokens),
      ...nextSavedCreatives.flatMap((record) => savedCreativeDeletionIdentity(record).tokens),
      ...nextVideoAnalyses.flatMap((record) => videoAnalysisDeletionIdentity(record).tokens),
    ];

    for (const token of nextTokens) {
      if (!finalTokens.has(token)) {
        finalTokens.add(token);
        changed = true;
      }
    }

    changed =
      changed ||
      nextPerformances.length !== matchedPerformances.length ||
      nextSavedCreatives.length !== matchedSavedCreatives.length ||
      nextVideoAnalyses.length !== matchedVideoAnalyses.length;
    matchedPerformances = nextPerformances;
    matchedSavedCreatives = nextSavedCreatives;
    matchedVideoAnalyses = nextVideoAnalyses;
  }
  const mediaObjects = [
    ...matchedPerformances.flatMap(performanceMediaObjects),
    ...matchedSavedCreatives.flatMap(savedCreativeMediaObjects),
    ...matchedVideoAnalyses.flatMap(videoAnalysisMediaObjects),
  ];

  return {
    mediaObjects: uniqueMediaObjects(mediaObjects),
    performanceRecordIds: uniqueIds(matchedPerformances.map(({ id }) => id)),
    savedCreativeIds: uniqueIds(matchedSavedCreatives.map(({ id }) => id)),
    videoAnalysisIds: uniqueIds(matchedVideoAnalyses.map(({ id }) => id)),
  };
}

function identitiesOverlap(leftTokens, rightTokens) {
  const right = new Set(rightTokens);
  return [...leftTokens].some((token) => right.has(token));
}

function performanceDeletionIdentity(record = {}) {
  const payload = parsePayload(record.payloadJson) || {};
  const platform = record.platform || payload.sourcePlatform || payload.platform || "";
  const tokens = new Set();

  addIdentityToken(tokens, "performance-id", record.id);
  addIdentityToken(tokens, "source-record", record.sourceRecordId);
  addIdentityToken(tokens, "creative-id", record.creativeId);
  addIdentityToken(tokens, "ad-id", record.adId || payload.adId);
  addIdentityToken(tokens, "import-key", record.importKey);
  addIdentityToken(tokens, "media-fingerprint", payload.mediaFingerprint);
  addIdentityToken(tokens, "media-url", record.videoUrl || payload.mediaUrl || payload.video_url);
  addIdentityToken(tokens, "media-path", payload.mediaPath);
  addIdentityToken(tokens, "filename", record.originalFilename || payload.originalFilename);
  addIdentityToken(tokens, "filename", payload.videoFilename);
  addIdentityToken(tokens, "creative-name", record.adName || payload.creativeName || payload.creativeTitle);
  addCompoundIdentityToken(tokens, "platform-creative", platform, record.creativeId);
  addCompoundIdentityToken(tokens, "platform-ad", platform, record.adId || payload.adId);
  addCompoundIdentityToken(
    tokens,
    "platform-filename",
    platform,
    record.originalFilename || payload.originalFilename || payload.videoFilename,
  );
  addCompoundIdentityToken(
    tokens,
    "platform-name",
    platform,
    record.adName || payload.creativeName || payload.creativeTitle,
  );

  return { tokens: [...tokens] };
}

function savedCreativeDeletionIdentity(record = {}) {
  const payload = record.payload || parsePayload(record.payloadJson) || {};
  const tokens = new Set();

  addIdentityToken(tokens, "saved-id", record.id);
  addIdentityToken(tokens, "source-record", record.id);
  addIdentityToken(tokens, "source-record", record.sourceId);
  addIdentityToken(tokens, "review-id", record.sourceType === "video_analysis" ? record.sourceId : "");
  addIdentityToken(tokens, "media-fingerprint", payload.mediaFingerprint);
  addIdentityToken(tokens, "media-url", payload.mediaUrl || payload.videoUrl || payload.video_url);
  addIdentityToken(tokens, "media-path", payload.mediaPath);
  addIdentityToken(tokens, "filename", payload.originalFilename || payload.fileName || payload.videoFilename);
  addIdentityToken(tokens, "creative-name", record.title || payload.creativeTitle || payload.displayTitle);

  return { tokens: [...tokens] };
}

function videoAnalysisDeletionIdentity(record = {}) {
  const payload = record.payload || parsePayload(record.payloadJson) || {};
  const result = payload.result || payload;
  const media = result.media || payload.media || {};
  const metadata = result.metadata || payload.metadata || {};
  const display = result.display || {};
  const tokens = new Set();

  addIdentityToken(tokens, "review-id", record.id);
  addIdentityToken(tokens, "source-record", record.id);
  addIdentityToken(tokens, "media-fingerprint", media.fingerprint || metadata.media_fingerprint);
  addIdentityToken(tokens, "media-url", media.mediaUrl || metadata.media_url);
  addIdentityToken(tokens, "media-path", media.mediaPath || media.storedFileName || metadata.media_path);
  addIdentityToken(tokens, "filename", record.fileName || display.originalFilename || media.originalName);

  return { tokens: [...tokens] };
}

function addIdentityToken(tokens, type, value) {
  const normalized = normalizeIdentityValue(value);
  if (normalized && /[a-z0-9]/.test(normalized)) tokens.add(`${type}:${normalized}`);
}

function addCompoundIdentityToken(tokens, type, namespace, value) {
  const normalizedValue = normalizeIdentityValue(value);
  if (!normalizedValue) return;

  addIdentityToken(tokens, type, `${namespace || "unknown"}:${normalizedValue}`);
}

function normalizeIdentityValue(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function uniqueIds(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function performanceMediaObjects(record = {}) {
  const payload = parsePayload(record.payloadJson) || {};
  return mediaObjectsFromCandidates(
    {
      mediaPath: payload.mediaPath,
      mediaUrl: record.videoUrl || payload.mediaUrl || payload.video_url,
    },
  );
}

function savedCreativeMediaObjects(record = {}) {
  const payload = record.payload || parsePayload(record.payloadJson) || {};
  return mediaObjectsFromCandidates(payload);
}

function videoAnalysisMediaObjects(record = {}) {
  const payload = record.payload || parsePayload(record.payloadJson) || {};
  const result = payload.result || payload;
  return mediaObjectsFromCandidates(result.media || payload.media || {}, result.metadata || payload.metadata || {});
}

function mediaObjectsFromCandidates(...candidates) {
  return candidates.flatMap((candidate) => {
    const parsed = parsePrivateMediaUrl(
      candidate.mediaUrl || candidate.videoUrl || candidate.video_url || "",
    );
    const mediaPath =
      candidate.mediaPath ||
      candidate.storedFileName ||
      candidate.media_path ||
      parsed?.storedFileName ||
      "";
    const namespace = parsed?.namespace || candidate.namespace || "creative-library";

    return mediaPath && isPlayableMediaPath(mediaPath)
      ? [{ namespace, storedFileName: mediaPath }]
      : [];
  });
}

function uniqueMediaObjects(objects = []) {
  return objects.filter(
    (object, index, records) =>
      object.storedFileName &&
      records.findIndex(
        (candidate) =>
          candidate.namespace === object.namespace &&
          candidate.storedFileName === object.storedFileName,
      ) === index,
  );
}

async function deleteUnreferencedPrivateMediaObjects(shop, mediaObjects = []) {
  const candidates = uniqueMediaObjects(mediaObjects);
  if (!candidates.length) return { deletedFiles: 0 };

  const remainingRecords = await Promise.all([
    db.savedCreative.findMany({ where: { shop }, select: { payloadJson: true } }),
    db.creativePerformance.findMany({
      where: { shop },
      select: { payloadJson: true, videoUrl: true },
    }),
    db.videoAnalysis.findMany({ where: { shop }, select: { payloadJson: true } }),
  ]);
  const haystack = JSON.stringify(remainingRecords).toLowerCase();
  const unreferenced = candidates.filter(
    ({ storedFileName }) => !haystack.includes(String(storedFileName).toLowerCase()),
  );

  return deletePrivateMediaObjects(shop, unreferenced);
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

function normalizeCreativeBriefRecord(record = {}) {
  const legacy = parsePayload(record.payloadJson) || record.payload || {};
  const payload = normalizeCreativeBriefPayload({
    ...legacy,
    title: record.title || legacy.title || legacy.brief_title || `${record.angle || legacy.angle || "Creative brief"} · ${record.productTitle || legacy.productTitle || "Product"}`,
    status: record.status || legacy.status || "DRAFT",
    setup: {
      productId: record.productId || legacy.productId,
      productTitle: record.productTitle || legacy.productTitle,
      sourceCreativeId: record.sourceCreativeId || legacy.context?.creativeId,
      sourceCreativeTitle: legacy.setup?.sourceCreativeTitle || legacy.context?.creativeTitle,
      sourceVideoAnalysisId: record.sourceVideoAnalysisId || legacy.context?.videoAnalysisId,
      campaignObjective: record.campaignObjective || legacy.campaignObjective || legacy.objective,
      targetAudience: record.targetAudience || legacy.targetAudience || legacy.audience,
      platform: record.platform || legacy.platform,
      creativeFormat: record.creativeFormat || legacy.creativeFormat || legacy.format,
      tone: record.tone || legacy.tone,
      merchantNotes: record.merchantNotes || legacy.merchantNotes,
      ...(legacy.setup || {}),
    },
    content: legacy.content || legacyContentFromBrief(legacy),
    evidence: legacy.evidence || legacyEvidenceFromBrief(record, legacy),
  });
  return {
    ...record,
    title: payload.title,
    status: payload.status,
    sourceCreativeId: payload.setup.sourceCreativeId,
    sourceVideoAnalysisId: payload.setup.sourceVideoAnalysisId,
    campaignObjective: payload.setup.campaignObjective,
    targetAudience: payload.setup.targetAudience,
    platform: payload.setup.platform,
    creativeFormat: payload.setup.creativeFormat,
    tone: payload.setup.tone,
    merchantNotes: payload.setup.merchantNotes,
    payload,
  };
}

function normalizeCreativeBriefPayload(value = {}) {
  const setup = value.setup && typeof value.setup === "object" ? value.setup : {};
  const content = value.content && typeof value.content === "object" ? value.content : {};
  const evidence = value.evidence && typeof value.evidence === "object" ? value.evidence : {};
  return {
    version: 2,
    title: cleanBriefText(value.title) || "Untitled Creative Brief",
    status: value.status === "READY" ? "READY" : "DRAFT",
    setup: {
      productId: cleanBriefText(setup.productId),
      productTitle: cleanBriefText(setup.productTitle) || "Product",
      sourceCreativeId: cleanBriefText(setup.sourceCreativeId) || null,
      sourceCreativeTitle: cleanBriefText(setup.sourceCreativeTitle) || null,
      sourceVideoAnalysisId: cleanBriefText(setup.sourceVideoAnalysisId) || null,
      sourceVideoAnalysisTitle: cleanBriefText(setup.sourceVideoAnalysisTitle) || null,
      campaignObjective: cleanBriefText(setup.campaignObjective) || "Conversions",
      targetAudience: cleanBriefText(setup.targetAudience) || "Not specified",
      platform: cleanBriefText(setup.platform) || "Other",
      creativeFormat: cleanBriefText(setup.creativeFormat) || "Product demo",
      tone: cleanBriefText(setup.tone) || "Authentic",
      merchantNotes: cleanBriefText(setup.merchantNotes),
      productSellingPoint: cleanBriefText(setup.productSellingPoint),
      offer: cleanBriefText(setup.offer),
      desiredVideoLength: cleanBriefText(setup.desiredVideoLength),
      restrictions: cleanBriefText(setup.restrictions),
    },
    content: {
      mainConcept: cleanBriefText(content.mainConcept),
      coreAngle: cleanBriefText(content.coreAngle),
      hook: cleanBriefText(content.hook),
      problem: cleanBriefText(content.problem),
      solution: cleanBriefText(content.solution),
      productBenefit: cleanBriefText(content.productBenefit),
      proofPoints: normalizeBriefList(content.proofPoints),
      sceneSequence: normalizeBriefList(content.sceneSequence),
      visualDirection: cleanBriefText(content.visualDirection),
      onScreenText: normalizeBriefList(content.onScreenText),
      voiceoverGuidance: cleanBriefText(content.voiceoverGuidance),
      cta: cleanBriefText(content.cta),
      recommendedDuration: cleanBriefText(content.recommendedDuration),
      platformGuidance: cleanBriefText(content.platformGuidance),
      testingVariations: normalizeBriefList(content.testingVariations),
    },
    evidence: {
      product: evidence.product && typeof evidence.product === "object" ? evidence.product : null,
      creative: evidence.creative && typeof evidence.creative === "object" ? evidence.creative : null,
      videoAnalysis: evidence.videoAnalysis && typeof evidence.videoAnalysis === "object" ? evidence.videoAnalysis : null,
      performanceMetrics: Array.isArray(evidence.performanceMetrics) ? evidence.performanceMetrics.filter((item) => item && item.value !== null && item.value !== undefined && item.value !== "") : [],
      connectedDataSource: cleanBriefText(evidence.connectedDataSource) || null,
      importedDateRange: evidence.importedDateRange || null,
    },
    assumptions: normalizeBriefList(value.assumptions),
    missingDataNotes: normalizeBriefList(value.missingDataNotes),
    generatedAt: value.generatedAt || new Date().toISOString(),
  };
}

function creativeBriefData(shop, payload, idempotencyKey) {
  return {
    shop,
    title: payload.title,
    status: payload.status,
    productId: payload.setup.productId,
    productTitle: payload.setup.productTitle,
    sourceCreativeId: payload.setup.sourceCreativeId,
    sourceVideoAnalysisId: payload.setup.sourceVideoAnalysisId,
    campaignObjective: payload.setup.campaignObjective,
    targetAudience: payload.setup.targetAudience,
    platform: payload.setup.platform,
    creativeFormat: payload.setup.creativeFormat,
    tone: payload.setup.tone,
    merchantNotes: payload.setup.merchantNotes,
    angle: payload.content.coreAngle || "Creative brief",
    payloadJson: JSON.stringify(payload),
    idempotencyKey,
  };
}

function legacyContentFromBrief(brief = {}) {
  return {
    mainConcept: brief.creatorDirection || brief.description || brief.summary || "",
    coreAngle: brief.angle || "",
    hook: brief.hooks?.[0] || brief.hook || "",
    productBenefit: brief.captions?.[0] || "",
    proofPoints: brief.captions || [],
    sceneSequence: brief.script || brief.shotList || [],
    visualDirection: brief.visualConcepts?.[0] || brief.visual_style || "",
    onScreenText: brief.captions || [],
    cta: brief.ctas?.[0] || brief.cta || "",
    recommendedDuration: brief.duration || "",
    testingVariations: brief.hooks?.slice(1) || [],
  };
}

function legacyEvidenceFromBrief(record = {}, brief = {}) {
  const imported = brief.context?.importedPerformance || {};
  const performanceMetrics = briefMetricItems(imported);
  return {
    product: {
      id: record.productId || brief.productId || null,
      title: record.productTitle || brief.productTitle || brief.context?.productName || "Product",
      description: null,
      source: brief.context?.productSource || "legacy",
    },
    creative: brief.context?.creativeId ? { id: brief.context.creativeId, title: brief.context.creativeTitle || "Source creative", hook: brief.context.creativeAnalysis || null, score: brief.context.creativeScore || null } : null,
    videoAnalysis: null,
    performanceMetrics,
    connectedDataSource: performanceMetrics.length ? brief.context?.productSourceLabel || "Imported performance data" : null,
    importedDateRange: imported.dateRange || null,
  };
}

function buildCreativeBriefEvidence({ analysis, creative, product }) {
  const creativePayload = creative?.payload || {};
  const analysisPayload = analysis?.payload || {};
  const analysisResult = analysisPayload.result?.analysis || analysisPayload.analysis || {};
  const productMetrics = briefMetricItems(product);
  const creativeMetrics = briefMetricItems({ ...creativePayload, ...creative });
  return {
    product: {
      id: product.id || null,
      title: product.title || "Product",
      description: cleanBriefText(product.description) || null,
      source: product.source || "shopify",
    },
    creative: creative ? {
      id: creative.id,
      title: creative.title || creative.creativeTitle || creativePayload.title || "Selected creative",
      hook: cleanBriefText(creative.hook || creativePayload.hook) || null,
      campaignName: cleanBriefText(creative.campaignName || creativePayload.campaignName) || null,
    } : null,
    videoAnalysis: analysis ? {
      id: analysis.id,
      title: analysis.brief || analysis.fileName || analysisPayload.result?.display?.displayTitle || "Saved video analysis",
      hookAnalysis: cleanBriefText(analysisResult.hook || analysisResult.hook_analysis) || null,
      creativeScore: analysisResult.creative_score ?? analysisResult.hook_score ?? null,
      summary: cleanBriefText(analysisResult.summary || analysisPayload.result?.display?.summary) || null,
    } : null,
    performanceMetrics: [...productMetrics, ...creativeMetrics].filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index),
    connectedDataSource: product.sourceLabel || (creative ? creative.sourcePlatform || creative.platform : null) || null,
    importedDateRange: product.dateRange || null,
  };
}

function briefMetricItems(source = {}) {
  const definitions = [
    ["Impressions", "impressions"], ["Clicks", "clicks"], ["Spend", "spend"],
    ["Orders", "orders"], ["Revenue", "revenue"], ["CTR", "ctr"],
    ["CVR", "cvr"], ["CPA", "cpa"], ["ROAS", "roas"],
  ];
  return definitions.flatMap(([label, key]) => {
    const value = source?.[key];
    return value === null || value === undefined || value === "" ? [] : [{ label, value }];
  });
}

function cleanBriefText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 6000) : "";
}

function normalizeBriefList(value) {
  return (Array.isArray(value) ? value : value ? String(value).split(/\n+/) : [])
    .map(cleanBriefText)
    .filter(Boolean)
    .slice(0, 24);
}

function uniqueBriefValues(values) {
  return [...new Set(values.map(cleanBriefText).filter(Boolean))];
}

function defaultBriefDuration(platform) {
  return /google/i.test(platform) ? "15 seconds" : /youtube/i.test(platform) ? "20 seconds" : "15 seconds";
}

function platformBriefGuidance(platform) {
  if (/tiktok/i.test(platform)) return "Use a native 9:16 frame, put the result or tension in the first two seconds, and keep captions inside safe zones.";
  if (/instagram/i.test(platform)) return "Use a 9:16 frame, a visually polished first frame, concise on-screen text, and a clear final CTA card.";
  if (/youtube/i.test(platform)) return "Use a 9:16 frame for Shorts, establish the promise immediately, and keep the narrative understandable with sound off.";
  if (/meta/i.test(platform)) return "Create 9:16 and 4:5 crops, keep the primary claim readable, and make the CTA clear before the final frame.";
  if (/google/i.test(platform)) return "Keep product branding visible, avoid unsupported claims, and prepare concise variants for placement-specific aspect ratios.";
  return "Adapt the opening frame, aspect ratio, text-safe area, and CTA to the selected placement before publishing.";
}

function parsePayload(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function findRecordByPersistenceKey(
  modelName,
  shop,
  persistenceKey,
  additionalWhere = {},
) {
  return db[modelName].findFirst({
    where: {
      shop,
      ...additionalWhere,
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
