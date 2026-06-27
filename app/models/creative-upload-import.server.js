import db from "../db.server.js";
import { persistUploadedVideoFile } from "../utils/upload-storage.server.js";
import { CREATIVE_VIDEO_FILE_FIELD } from "../utils/selected-video-files.js";
import { assignCampaignRecords } from "./campaign.server.js";
import { summarizeCreatorPreview } from "./creator-attribution.server.js";

export { CREATIVE_VIDEO_FILE_FIELD } from "../utils/selected-video-files.js";
export const CREATIVE_VIDEO_FILENAME_COLUMNS = [
  "video_filename",
  "videoFileName",
  "file_name",
  "filename",
  "asset_filename",
  "creative_filename",
];

const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export function getUploadedVideoFiles(formData) {
  return formData
    .getAll(CREATIVE_VIDEO_FILE_FIELD)
    .filter((file) => isFileLike(file) && file.size > 0);
}

export function buildCreativeUploadPreview({
  csvText = "",
  existingCreators = [],
  createCreatorProfiles = true,
  parsePublicEngagementCsv,
  uploadedVideos = [],
}) {
  const parsed = parsePublicEngagementCsv(csvText);
  const fileIndex = buildUploadedVideoIndex(uploadedVideos);
  const rows = (parsed.rows || []).map((row) =>
    decorateCreativeUploadRow(row, fileIndex),
  );
  const summary = summarizeCreativeUploadPreview(rows, fileIndex);
  const creatorSummary = createCreatorProfiles
    ? summarizeCreatorPreview(rows, existingCreators)
    : {
        creatorsDetected: 0,
        duplicateCreatorRowsMerged: 0,
        missingCreatorIdentity: 0,
        newCreators: 0,
        updatedCreators: 0,
      };
  const fileWarnings = [
    ...fileIndex.files
      .filter((file) => !file.supported)
      .map((file) => `${file.baseName || file.originalName} is not a supported video type.`),
    ...[...fileIndex.duplicateNames].map(
      (name) => `Multiple uploaded files are named ${name}; matching rows are ambiguous.`,
    ),
  ];

  return {
    ...parsed,
    errors: parsed.errors || [],
    fileWarnings,
    rows,
    summary: {
      ...summary,
      ...creatorSummary,
      warnings: summary.warnings + fileWarnings.length,
    },
  };
}

export async function importMatchedCreativeRows({
  campaignId = "",
  createCreatorProfiles = true,
  preview,
  shop,
  uploadedVideos,
  upsertPublicEngagementRecord,
}) {
  const fileIndex = buildUploadedVideoIndex(uploadedVideos);
  const storedByIndex = new Map();
  const summary = {
    created: 0,
    errors: preview.errors?.length || 0,
    performanceRows: 0,
    skipped: 0,
    updated: 0,
    warnings: 0,
    creatorsDetected: preview.summary?.creatorsDetected || 0,
    duplicateCreatorRowsMerged: preview.summary?.duplicateCreatorRowsMerged || 0,
    missingCreatorIdentity: preview.summary?.missingCreatorIdentity || 0,
    newCreators: preview.summary?.newCreators || 0,
    updatedCreators: preview.summary?.updatedCreators || 0,
  };
  const rows = [];
  const importedKeys = [];

  if (!shop) {
    return {
      ...preview,
      ok: false,
      summary: { ...summary, errors: summary.errors + 1 },
      topErrors: ["Authenticated Shopify workspace was not resolved."],
    };
  }

  for (const row of preview.rows || []) {
    if (row.status === "error") {
      summary.skipped += 1;
      summary.errors += 1;
      rows.push(row);
      continue;
    }

    const record = { ...(row.record || {}) };
    const matchedEntry =
      row.uploadedFileIndex !== null && row.uploadedFileIndex !== undefined
        ? fileIndex.files[row.uploadedFileIndex]
        : null;

    try {
      if (matchedEntry?.file) {
        const stored =
          storedByIndex.get(matchedEntry.index) ||
          (await persistUploadedVideoFile(matchedEntry.file, {
            namespace: "creative-library",
            shop,
          }));
        storedByIndex.set(matchedEntry.index, stored);
        record.videoUrl = stored.mediaUrl;
        record.assetUrl = record.assetUrl || stored.mediaUrl;
        record.uploadedVideo = {
          fileSize: stored.fileSize,
          fileType: stored.fileType,
          fingerprint: stored.fingerprint,
          originalName: stored.originalName,
          storedFileName: stored.storedFileName,
          storage: stored.storage,
        };
        record.mediaState = "local_public_upload";
      }

      const result = await upsertPublicEngagementRecord(shop, {
        ...row,
        record: {
          ...record,
          importSource: "creative_upload_performance_import",
          savedCreativeSourceType: "creative_performance_upload_import",
          sourceRecordType: "creative_upload_performance_import",
          sourceType: "creative_performance_upload_import",
          createCreatorProfile: createCreatorProfiles,
        },
      });
      summary[result] += 1;
      summary.warnings += row.warnings.length ? 1 : 0;
      summary.performanceRows += 1;
      importedKeys.push(record.importKey);
      rows.push({ ...row, record, status: "ready" });
    } catch (error) {
      summary.errors += 1;
      summary.skipped += 1;
      rows.push({
        ...row,
        errors: [...(row.errors || []), error.message || "Could not import this row."],
        status: "error",
      });
    }
  }

  if (campaignId && importedKeys.length) {
    const sourceIds = importedKeys.map((importKey) => `${shop}:${importKey}`);
    const [savedCreatives, performanceRecords] = await Promise.all([
      db.savedCreative.findMany({
        where: { shop, sourceId: { in: sourceIds } },
        select: { id: true },
      }),
      db.creativePerformance.findMany({
        where: { shop, importKey: { in: importedKeys } },
        select: { id: true },
      }),
    ]);

    await assignCampaignRecords(shop, campaignId, {
      creativePerformanceIds: performanceRecords.map((record) => record.id),
      savedCreativeIds: savedCreatives.map((record) => record.id),
    });
    if (createCreatorProfiles) {
      await db.creatorAttribution.updateMany({
        where: {
          shop,
          creativePerformanceId: { in: performanceRecords.map((record) => record.id) },
        },
        data: { campaignId },
      });
    }
  }

  return {
    ...preview,
    ok: summary.created + summary.updated > 0,
    rows,
    summary,
    assignedCampaignId: campaignId || null,
    topErrors: rows.flatMap((row) => row.errors || []).slice(0, 5),
  };
}

export function buildUploadedVideoIndex(uploadedVideos = []) {
  const files = uploadedVideos.map((file, index) => {
    const originalName = String(file.name || "").trim();
    const baseName = baseFileName(originalName);
    const normalizedName = normalizeFileMatchName(baseName);

    return {
      baseName,
      file,
      index,
      normalizedName,
      originalName,
      supported: isSupportedVideoFileName(baseName),
    };
  });
  const byName = new Map();

  for (const entry of files) {
    if (!entry.normalizedName) continue;
    const matches = byName.get(entry.normalizedName) || [];
    matches.push(entry);
    byName.set(entry.normalizedName, matches);
  }

  return {
    byName,
    duplicateNames: new Set(
      [...byName.entries()]
        .filter(([, matches]) => matches.length > 1)
        .map(([name]) => name),
    ),
    files,
  };
}

function decorateCreativeUploadRow(row, fileIndex) {
  const record = row.record || {};
  const rawFilename = firstValue(
    record.videoFilename,
    record.video_file_name,
    record.fileName,
    record.filename,
    record.assetFilename,
    record.creativeFilename,
  );
  const videoFilename = String(rawFilename || "").trim();
  const safeBaseName = baseFileName(videoFilename);
  const hasUnsafePath = Boolean(videoFilename) && safeBaseName !== videoFilename;
  const normalizedName = normalizeFileMatchName(safeBaseName);
  const fileMatches = normalizedName ? fileIndex.byName.get(normalizedName) || [] : [];
  const uploadedMatch = fileMatches.length === 1 ? fileMatches[0] : null;
  const hasPlayableUrl = isPlayableVideoPath(record.videoUrl);
  const errors = [...(row.errors || [])];
  const warnings = [...(row.warnings || [])];
  let creativeUploadStatus = errors.length ? "Missing required fields" : "Ready";

  function addFileMatchIssue(message, status) {
    if (hasPlayableUrl) {
      warnings.push(`${message} The direct playable video URL will be used instead.`);
      creativeUploadStatus = "Warning";
      return;
    }

    errors.push(message);
    creativeUploadStatus = status;
  }

  if (!videoFilename && !hasPlayableUrl) {
    warnings.push("No video was attached. This row will be imported as a performance-only creative record.");
    creativeUploadStatus = "Performance only";
  } else if (hasUnsafePath) {
    addFileMatchIssue(
      "Video filename must be a base filename, not a path.",
      "Missing required fields",
    );
  } else if (fileMatches.length > 1) {
    addFileMatchIssue(
      "Duplicate uploaded files share this filename.",
      "Duplicate filename",
    );
  } else if (uploadedMatch && !uploadedMatch.supported) {
    addFileMatchIssue(
      "Unsupported video type. Use MP4, MOV, M4V, or WebM.",
      "Unsupported video type",
    );
  } else if (!uploadedMatch && !hasPlayableUrl) {
    warnings.push("No matching video file was selected. This row will be imported without a playable video.");
    creativeUploadStatus = "Performance only";
  }

  if (!errors.length && warnings.length && creativeUploadStatus === "Ready") {
    creativeUploadStatus = "Warning";
  }

  const useUploadedMatch =
    !hasUnsafePath && fileMatches.length === 1 && Boolean(uploadedMatch?.supported);

  return {
    ...row,
    creativeUploadStatus,
    errors,
    matchedUploadedFile: uploadedMatch?.baseName || "",
    record: {
      ...record,
      importSource: "creative_upload_performance_import",
      mediaState: useUploadedMatch
        ? "local_public_upload"
        : hasPlayableUrl
          ? "direct_video_url"
          : "metadata_only",
      sourceRecordType: "creative_upload_performance_import",
      videoFilename,
    },
    status: errors.length ? "error" : warnings.length ? "warning" : "ready",
    uploadedFileIndex: useUploadedMatch ? uploadedMatch.index : null,
    videoFilename,
    warnings,
  };
}

function summarizeCreativeUploadPreview(rows = [], fileIndex) {
  const usedIndexes = new Set(
    rows
      .map((row) => row.uploadedFileIndex)
      .filter((index) => index !== null && index !== undefined),
  );

  return {
    errors: rows.filter((row) => row.status === "error").length,
    missingVideos: rows.filter(
      (row) => row.creativeUploadStatus === "Performance only",
    ).length,
    ready: rows.filter((row) => row.status !== "error").length,
    uploadedFilesMatched: usedIndexes.size,
    uploadedFilesUnused: fileIndex.files.filter((file) => !usedIndexes.has(file.index))
      .length,
    warnings: rows.filter((row) => row.status === "warning").length,
  };
}

function firstValue(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && String(value).trim(),
  );
}

function isFileLike(file) {
  return file && typeof file.arrayBuffer === "function" && typeof file.size === "number";
}

function baseFileName(value) {
  const text = String(value || "").trim().replace(/\\/g, "/");
  return text.split("/").pop() || "";
}

function normalizeFileMatchName(value) {
  return baseFileName(value).trim().toLowerCase();
}

function fileExtension(value) {
  const match = String(value || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function isSupportedVideoFileName(value) {
  return SUPPORTED_VIDEO_EXTENSIONS.has(fileExtension(value));
}

function isPlayableVideoPath(value) {
  const withoutQuery = String(value || "").split(/[?#]/)[0].toLowerCase();
  return [...SUPPORTED_VIDEO_EXTENSIONS].some((extension) =>
    withoutQuery.endsWith(extension),
  );
}
