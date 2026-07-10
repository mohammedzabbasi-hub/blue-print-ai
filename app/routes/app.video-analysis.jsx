import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData, useLocation } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyzeUploadedVideoFile, getAnalyzerRuntimeStatus } from "../services/media-analyzer.server";
import {
  buildRevenueBlueprint,
  clearCurrentVideoAnalysis,
  getCurrentVideoAnalysis,
  getWorkspaceProfile,
  listVideoAnalyses,
  listSavedCreatives,
  REVIEW_PREVIEW_UNAVAILABLE_MESSAGE,
  resolveReviewPreviewMediaForCreative,
  resolveProductContext,
  saveCreativeRecord,
  saveCurrentVideoAnalysisAsReview,
  saveCurrentVideoAnalysisRecord,
  saveRevenueBlueprintRecord,
} from "../models/blueprint.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { persistUploadedVideoFile } from "../utils/upload-storage.server";
import { assertUploadRequestSize } from "../utils/upload-storage.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import db from "../db.server";
import {
  analyzerEvidence,
  normalizeRetentionAnalysis,
  transcriptEvidence,
} from "../utils/video-analysis-evidence";

export const meta = () => {
  return [{ title: "AI Review Studio | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [analyses, currentRecord, savedCreatives, profile] = await Promise.all([
    listVideoAnalyses(session.shop, 6),
    getCurrentVideoAnalysis(session.shop),
    listSavedCreatives(session.shop, 100),
    getWorkspaceProfile(session.shop),
  ]);
  const savedCurrentReview = currentRecord
    ? analyses.find((record) => record.sourceAnalysisId === currentRecord.id)
    : null;
  const currentSourceIds = [currentRecord?.id, savedCurrentReview?.id].filter(Boolean);
  const currentLibraryCreative = savedCreatives.find(
    (creative) =>
      creative.sourceType === "video_analysis" &&
      currentSourceIds.includes(creative.sourceId),
  );
  let currentMediaAvailable = true;

  if (currentRecord) {
    try {
      await resolveReviewPreviewMediaForCreative({
        shop: session.shop,
        reviewId: currentRecord.id,
      });
    } catch {
      currentMediaAvailable = false;
    }
  }

  return {
    analyses,
    currentAnalysis: currentRecord
      ? {
          ...currentRecord.payload,
          activeAnalysisId: currentRecord.id,
          savedAnalysisId: savedCurrentReview?.id || null,
          productId: currentRecord.productId,
          productTitle: currentRecord.productTitle,
        }
      : null,
    currentLibraryCreativeId: currentLibraryCreative?.id || "",
    currentMediaAvailable,
    libraryCreativeIds: savedCreatives
      .filter((creative) => creative.sourceType === "video_analysis")
      .reduce((result, creative) => {
        if (creative.sourceId) result[creative.sourceId] = creative.id;
        return result;
      }, {}),
    analyzerRuntime: getAnalyzerRuntimeStatus(),
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products,
    selectedProductId: profile.selectedProductId || merchantData.products[0]?.id || "",
  };
};

export const action = async ({ request }) => {
  assertUploadRequestSize(request);
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "analyze");

  try {
    if (intent === "analyze") {
      const profile = await getWorkspaceProfile(session.shop);
      const videoFile = formData.get("file");
      const storedVideo = await persistUploadedVideoFile(videoFile, {
        namespace: "video-analysis",
        shop: session.shop,
      });

      if (!storedVideo) {
        return { error: "Choose a valid video file before analyzing." };
      }

      const fileName = storedVideo?.originalName || "Uploaded creative";
      const fileType = storedVideo?.fileType || "";
      const fileSize = Number(storedVideo?.fileSize || 0);
      const product =
        resolveProductContext(
          merchantData.products,
          profile,
          String(formData.get("productId") || ""),
        ) || {
          id: "uploaded-video-product",
          title: "Uploaded Video",
        };
      const analyzer = await analyzeUploadedVideoFile(videoFile);
      if (!analyzer.available) {
        return {
          analyzerUnavailable: true,
          analyzerMessage: analyzer.message,
          success: "Upload saved, analysis unavailable.",
        };
      }
      const analysis = buildVideoAnalysisPayload({
        analyzer,
        fileName,
        fileSize,
        fileType,
        storedVideo,
        product,
      });
      const current = await saveCurrentVideoAnalysisRecord({
        shop: session.shop,
        product,
        fileName,
        brief: analysis.result.display.summary,
        analysis,
      });

      return {
        result: {
          ...analysis,
          activeAnalysisId: current.id,
          savedAnalysisId: null,
          productId: product.id,
          productTitle: product.title,
        },
        success: `Current analysis ready: ${analysis.result.display.displayTitle}`,
      };
    }

    if (intent === "clearCurrentAnalysis") {
      const cleared = await clearCurrentVideoAnalysis(
        session.shop,
        String(formData.get("activeAnalysisId") || ""),
      );

      return {
        cleared: cleared.cleared,
        success: cleared.cleared
          ? "Current analysis removed. Explicitly saved reviews and Creative Library items were kept."
          : "There is no current analysis to remove.",
      };
    }

    const analysisPayload = parseJsonField(formData.get("analysisPayload"));

    if (!analysisPayload) {
      return { error: "The saved analysis payload was missing. Analyze the video again." };
    }

    const profile = await getWorkspaceProfile(session.shop);
    const product =
      resolveProductContext(
        merchantData.products,
        profile,
        analysisPayload.productId,
      ) ||
      {
        id: analysisPayload.productId || "uploaded-video-product",
        title: analysisPayload.productTitle || "Uploaded Video",
    };
    const payload = analysisPayload.result || analysisPayload;
    const analysis = payload?.analysis || payload?.result?.analysis || {};
    const fileName = analysisPayload.filename || payload.filename || "Uploaded creative";
    const metadata =
      analysisPayload.result?.metadata || payload.metadata || payload?.result?.metadata || {};
    const media = analysisPayload.result?.media || payload.media || payload?.result?.media || {};
    const mediaUrl = media.mediaUrl || metadata.media_url || analysisPayload.mediaUrl || "";
    const mediaPath =
      media.mediaPath ||
      media.storedFileName ||
      metadata.media_path ||
      analysisPayload.mediaPath ||
      "";
    const mediaFingerprint =
      media.fingerprint || metadata.media_fingerprint || analysisPayload.mediaFingerprint || "";
    const display =
      analysisPayload.result?.display ||
      payload.display ||
      payload?.result?.display ||
      { displayTitle: fileName, originalFilename: fileName, summary: analysis.summary || "Not available" };
    const displayTitle = display.displayTitle || display.generatedTitle || fileName;
    const summary = display.summary || analysis.summary || "Not available";
    if (intent === "saveAnalysis") {
      const saved = await saveCurrentVideoAnalysisAsReview(
        session.shop,
        String(analysisPayload.activeAnalysisId || ""),
      );

      return {
        savedAnalysisId: saved.id,
        success: saved.wasCreated
          ? `Review saved as: ${displayTitle}`
          : `Review already saved as: ${displayTitle}`,
      };
    }

    if (intent === "saveCreative") {
      let previewMedia;
      try {
        previewMedia = await resolveReviewPreviewMediaForCreative({
          shop: session.shop,
          reviewId: analysisPayload.savedAnalysisId || "",
          mediaFingerprint,
          mediaPath,
          mediaUrl,
          originalFilename: display.originalFilename || fileName,
        });
      } catch {
        return { error: REVIEW_PREVIEW_UNAVAILABLE_MESSAGE };
      }

      const creative = await saveCreativeRecord(session.shop, {
        sourceType: "video_analysis",
        sourceId:
          analysisPayload.savedAnalysisId ||
          analysisPayload.activeAnalysisId ||
          (previewMedia.mediaFingerprint ? `upload:${previewMedia.mediaFingerprint}` : null),
        productId: product.id,
        productTitle: product.title,
        title: displayTitle,
        angle: summary,
        payload: {
          analysis,
          fullResult: payload,
          displayTitle,
          summary,
          description: summary,
          fileName,
          fileSize: Number(metadata.file_size || 0),
          fileType: metadata.file_type || "",
          mediaFingerprint: previewMedia.mediaFingerprint,
          mediaPath: previewMedia.mediaPath,
          mediaState: "private_upload",
          mediaStored: true,
          mediaStorage: previewMedia.mediaStorage || media.storage || "",
          mediaUrl: previewMedia.mediaUrl,
          originalFilename: previewMedia.originalFilename || display.originalFilename || fileName,
          source: "video_analysis",
          uploadId: previewMedia.uploadId || "",
          video_url: previewMedia.mediaUrl,
        },
      });

      const analysisRecordId =
        analysisPayload.savedAnalysisId || analysisPayload.activeAnalysisId;
      if (analysisRecordId) {
        await db.videoAnalysis.updateMany({
          where: { id: analysisRecordId, shop: session.shop },
          data: { savedToLibrary: true },
        });
      }

      return {
        creativeId: creative.id,
        success: creative.wasCreated
          ? `Saved to Creative Library as: ${displayTitle}`
          : `Creative Library already has: ${displayTitle}`,
      };
    }

    if (intent === "generateBlueprint") {
      const blueprint = buildRevenueBlueprint(merchantData, {
        product,
        workspaceProfile: profile,
        recommendation: {
          id: analysisPayload.savedAnalysisId || "video-analysis",
          title: `Blueprint from ${displayTitle}`,
          type: "creative",
          detail: summary,
          nextAction: "Turn the strongest hook and CTA into the next creative test.",
        },
      });
      const saved = await saveRevenueBlueprintRecord(session.shop, {
        ...blueprint,
        source: "video_analysis",
        sourceAnalysisId: analysisPayload.savedAnalysisId || null,
        sourceDisplayTitle: displayTitle,
        sourceFileName: fileName,
      });

      return {
        blueprintId: saved.id,
        success: saved.wasCreated ? "Blueprint saved." : "Blueprint already saved.",
      };
    }

    return { error: "Unknown video analysis action." };
  } catch (error) {
    return { error: error.message || "Could not complete this video analysis action." };
  }
};

export function buildVideoAnalysisPayload({
  analyzer,
  fileName,
  fileSize,
  fileType,
  storedVideo,
}) {
  const evidence = analyzerEvidence(analyzer);
  const { analysis, transcript } = evidence;
  const display = {
    displayTitle: analyzer?.display?.displayTitle || fileName,
    originalFilename: fileName,
    summary: analysis.summary || "Not available",
  };

  return {
    filename: fileName,
    result: {
      analysis,
      display,
      metadata: {
        ...evidence.metadata,
        file_size: fileSize,
        file_type: fileType,
        media_fingerprint: storedVideo?.fingerprint || "",
        media_path: storedVideo?.storedFileName || "",
        media_url: storedVideo?.mediaUrl || "",
      },
      media: storedVideo
        ? {
            fileName: storedVideo.originalName,
            fingerprint: storedVideo.fingerprint,
            mediaPath: storedVideo.storedFileName,
            mediaUrl: storedVideo.mediaUrl,
            originalName: storedVideo.originalName,
            storedFileName: storedVideo.storedFileName,
            storage: storedVideo.storage,
          }
        : null,
      transcript,
      ocr_text: evidence.ocr_text,
      retention_analysis: evidence.retention_analysis,
      analyzer,
    },
  };
}

function parseJsonField(value) {
  try {
    return value ? JSON.parse(String(value)) : null;
  } catch {
    return null;
  }
}

function scoreLabel(score) {
  if (score >= 8) return "Strong";
  if (score >= 5) return "Needs Testing";
  return "Weak";
}

function formatFileSize(bytes = 0) {
  const size = Number(bytes || 0);

  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function hasTechnicalFilename(value = "") {
  const text = String(value || "");

  return (
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text) ||
    /^[0-9a-f]{20,}/i.test(text) ||
    /upload-\d{8,}/i.test(text)
  );
}

function withoutExtension(value = "") {
  return String(value || "").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
}

function savedReviewPayload(record = {}) {
  const payload = record.payload || {};
  const result = payload.result || payload;

  return {
    payload,
    result,
    analysis: result.analysis || payload.analysis || {},
    display: result.display || payload.display || {},
    metadata: result.metadata || payload.metadata || {},
    transcript: transcriptEvidence(result.transcript || payload.transcript),
    retention: normalizeRetentionAnalysis(
      result.retention_analysis || payload.retention_analysis,
    ),
    media: result.media || payload.media || {},
  };
}

function pickText(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function pickList(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.some(Boolean)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }

  return [];
}

function formatSavedReviewDate(value) {
  if (!value) return "Date unavailable";

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Date unavailable";
  }
}

function normalizeScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score) || score <= 0) return null;
  return Math.round(score);
}

function formatReviewScore(value) {
  const score = normalizeScore(value);

  return score ? `${score}/10` : "Not available";
}

function truncateText(value = "", maxLength = 170) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function savedReviewTitle(record = {}, display = {}, analysis = {}) {
  const candidate = pickText(
    display.displayTitle,
    display.generatedTitle,
    record.title,
  );
  const fileName = pickText(record.fileName, display.originalFilename);

  if (candidate && candidate !== fileName && !hasTechnicalFilename(candidate)) {
    return candidate;
  }

  if (record.productTitle) {
    return `${record.productTitle} video review`;
  }

  if (analysis.creator_style || analysis.creator_type) {
    return `${analysis.creator_style || analysis.creator_type} video review`;
  }

  const cleanedFile = withoutExtension(fileName);
  if (cleanedFile && !hasTechnicalFilename(cleanedFile)) {
    return `${cleanedFile} review`;
  }

  return "Saved video review";
}

function buildSavedReview(record = {}) {
  const { payload, result, analysis, display, metadata, transcript, retention, media } =
    savedReviewPayload(record);
  const hookScore = normalizeScore(analysis.hook_score || analysis.hookScore);
  const clarityScore = normalizeScore(analysis.clarity_score || analysis.clarityScore);
  const ctaScore = normalizeScore(analysis.cta_score || analysis.ctaScore);
  const overallScore =
    normalizeScore(
      analysis.overall_score ||
        analysis.overallScore ||
        analysis.creative_score ||
        analysis.creativeScore ||
        analysis.readinessScore,
    );
  const summary = pickText(
    display.summary,
    analysis.summary,
    record.brief,
    result.summary,
    "Not available",
  );
  const recommendations = pickList(
    analysis.recommendations,
    analysis.next_actions,
    analysis.nextActions,
    retention.recommendations,
  );
  const nextAction = pickText(
    analysis.next_action,
    analysis.nextAction,
    result.nextAction,
  );
  const transcriptSummary = pickText(
    transcript.summary,
    transcript.full_text,
    result.transcriptSummary,
  );
  const rawFileName = pickText(record.fileName, display.originalFilename, media.fileName, result.filename);

  return {
    id: record.id || result.savedAnalysisId || rawFileName || "saved-review",
    title: savedReviewTitle(record, display, analysis),
    productTitle: record.productTitle || result.productTitle || "Uploaded Video",
    source: pickText(
      analysis.creator_style,
      analysis.creator_type,
      analysis.delivery_style,
      "Not available",
    ),
    date: formatSavedReviewDate(record.createdAt || result.createdAt),
    hookScore,
    clarityScore,
    ctaScore,
    overallScore,
    scorePrefix: /heuristic|estimate|predicted|modeled/i.test(
      String(analysis.analysis_method || analysis.evidence_type || ""),
    )
      ? "Estimated "
      : "",
    summary,
    summaryPreview: truncateText(summary),
    recommendations,
    nextAction,
    transcriptSummary,
    pacingNotes: pickText(
      analysis.pacingNotes,
      analysis.pacing_notes,
      analysis.firstTenSecondRisk,
      retention.verdict,
    ),
    creativeStructureNotes: pickText(
      analysis.creativeStructureNotes,
      analysis.creative_structure_notes,
      analysis.structure_notes,
      analysis.hook_type,
    ),
    ctaNotes: pickText(
      analysis.ctaNotes,
      analysis.cta_notes,
      analysis.cta_feedback,
    ),
    objectionHandlingNotes: pickText(
      analysis.objectionHandlingNotes,
      analysis.objection_handling_notes,
      analysis.objection_notes,
      analysis.weaknesses?.[0],
    ),
    strengths: pickList(analysis.strengths),
    weaknesses: pickList(analysis.weaknesses),
    rawFileName,
    metadata,
    retention,
    payload,
    productId: record.productId || result.productId || "",
  };
}

function ScoreCard({ label, value, method = "Analyzer output" }) {
  const score = normalizeScore(value);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        <RetentionBadge tone="info">{method}</RetentionBadge>
      </div>
      <p className="mt-2 text-4xl font-bold text-white">
        {score ? `${score}/10` : "Not available"}
      </p>
      {score && <p className="mt-2 text-xs text-sky-300">{scoreLabel(score)}</p>}
    </div>
  );
}

function RetentionBadge({ children, tone = "neutral" }) {
  const tones = {
    danger: "border-red-400/30 bg-red-500/15 text-red-100",
    warning: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    healthy: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    info: "border-sky-400/30 bg-sky-500/15 text-sky-100",
    neutral: "border-white/10 bg-white/10 text-slate-100",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${
        tones[tone] || tones.neutral
      }`}
    >
      {children}
    </span>
  );
}

function retentionTone(score) {
  if (!Number.isFinite(Number(score))) return "neutral";
  if (score >= 75) return "healthy";
  if (score >= 50) return "warning";
  return "danger";
}

function SectionCard({ title, subtitle, children, accent = false }) {
  return (
    <div
      className={`rounded-2xl border ${
        accent ? "border-sky-500/25" : "border-white/10"
      } bg-[#0d1526] p-6`}
    >
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4 leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

function ListCard({ title, items = [], accent = false }) {
  return (
    <SectionCard title={title} accent={accent}>
      <ul className="space-y-3">
        {items.length ? (
          items.map((item, index) => <li key={index}>• {item}</li>)
        ) : (
          <li>Not available</li>
        )}
      </ul>
    </SectionCard>
  );
}

function RetentionChart({ curve = [] }) {
  const chartData = Array.isArray(curve) ? curve : [];

  if (!chartData.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
        Retention curve not available. Connect platform or video analytics to
        measure viewer decay over time.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
          <XAxis
            dataKey="second"
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}s`}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={{ stroke: "rgba(56, 189, 248, 0.35)" }}
            contentStyle={{
              background: "#0a1020",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "14px",
              color: "#f8fafc",
            }}
            formatter={(value) => [`${value}%`, "Retention"]}
            labelFormatter={(value) => `${value} seconds`}
          />
          <Line
            type="monotone"
            dataKey="retention"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={{
              r: 4,
              fill: "#38bdf8",
              stroke: "#0a1020",
              strokeWidth: 2,
            }}
            activeDot={{ r: 6, fill: "#60a5fa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricTile({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07101f] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {detail && <p className="mt-2 text-sm text-slate-400">{detail}</p>}
    </div>
  );
}

function RetentionDropOffAnalyzer({ retentionAnalysis }) {
  const retention = normalizeRetentionAnalysis(retentionAnalysis);
  const hasScore =
    retention.retention_score !== undefined &&
    retention.retention_score !== null &&
    retention.retention_score !== "" &&
    Number.isFinite(Number(retention.retention_score));
  const score = hasScore ? Number(retention.retention_score) : null;
  const tone = retentionTone(score);
  const biggestDropoff = retention.biggest_dropoff || {};
  const isWeakHook = retention.hook_status === "Weak";
  const isHighDropoff = biggestDropoff.severity === "High";
  const isHeuristic = retention.evidence_type === "heuristic";
  const formatPercent = (value) =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value))
      ? `${Number(value)}%`
      : "Not available";

  if (!retention.available) {
    return (
      <section className="rounded-3xl border border-sky-500/20 bg-[#0a1020] p-6 shadow-2xl shadow-black/20">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
          Retention Analytics
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white">Viewer Retention</h2>
            <p className="mt-2 max-w-3xl text-slate-400">
              {retention.unavailable_reason}
            </p>
          </div>
          <RetentionBadge>Not available</RetentionBadge>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile label="First 3 Seconds" value="Not available" />
          <MetricTile label="First 5 Seconds" value="Not available" />
          <MetricTile label="First 10 Seconds" value="Not available" />
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-[#07101f] p-6 text-sm leading-6 text-slate-400">
          No retention curve, retention score, viewership flag, or drop-off
          diagnosis was generated. Those claims require measured audience data
          from a connected platform or video analytics source.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-sky-500/20 bg-[#0a1020] p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
            Retention Analytics
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Retention Drop-Off Analyzer
          </h2>
          <p className="mt-2 max-w-3xl text-slate-400">
            Metrics supplied by the analyzer. Estimated values are labeled and
            are not live platform performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <RetentionBadge tone={isHeuristic ? "info" : "healthy"}>
            {isHeuristic ? "Heuristic estimate" : "Analyzer output"}
          </RetentionBadge>
          {retention.hook_status && (
            <RetentionBadge tone={isWeakHook ? "danger" : "healthy"}>
              {retention.hook_status} Hook
            </RetentionBadge>
          )}
          {retention.useless_viewership_flag && (
            <RetentionBadge tone="danger">Useless Viewership Flag</RetentionBadge>
          )}
          {isHighDropoff && (
            <RetentionBadge tone="warning">High Drop-Off</RetentionBadge>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Retention Health Score"
          value={hasScore ? `${score}/100` : "Not available"}
        />
        <MetricTile
          label="Hook Status"
          value={retention.hook_status || "Not available"}
        />
        <MetricTile
          label="First 3 Seconds"
          value={formatPercent(retention.first_3_seconds_retention)}
        />
        <MetricTile
          label="First 5 Seconds"
          value={formatPercent(retention.first_5_seconds_retention)}
        />
        <MetricTile
          label="First 10 Seconds"
          value={formatPercent(retention.first_10_seconds_retention)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-[#07101f] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Retention Curve</h3>
              <p className="text-sm text-slate-500">
                Seconds watched vs. viewers retained
              </p>
            </div>
            <RetentionBadge tone={isHeuristic ? "info" : tone}>
              {isHeuristic ? "Estimated" : "Analyzer data"}
            </RetentionBadge>
          </div>
          <RetentionChart curve={retention.retention_curve} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Viewership Quality Flag">
            <p>
              {typeof retention.useless_viewership_flag === "boolean"
                ? retention.useless_viewership_flag
                  ? "Flagged by the analyzer."
                  : "Not flagged by the analyzer."
                : "Not available"}
            </p>
          </SectionCard>

          <SectionCard title="Biggest Drop-Off Moment" accent={isHighDropoff}>
            <p className="text-2xl font-black text-white">
              {biggestDropoff.timestamp || "Not available"}{" "}
              <span className="text-base text-slate-400">
                {biggestDropoff.drop_percent
                  ? `-${biggestDropoff.drop_percent}%`
                  : ""}
              </span>
            </p>
            <p className="mt-3">
              {biggestDropoff.reason || "Not available"}
            </p>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListCard
          title="Engagement Vacancies"
          items={retention.engagement_vacancies || []}
        />
        <ListCard
          title="Recommended Fixes"
          items={retention.recommendations || []}
          accent
        />
        <SectionCard title="Final Verdict" accent>
          <p>{retention.verdict || "Not available"}</p>
        </SectionCard>
      </div>
    </section>
  );
}

function VideoAdBreakdown({
  initialLibraryCreativeId = "",
  mediaAvailable = true,
  onRemoved,
  result,
  file,
}) {
  const location = useLocation();
  const analysisSaveFetcher = useFetcher();
  const saveFetcher = useFetcher();
  const blueprintFetcher = useFetcher();
  const clearFetcher = useFetcher();
  const [currentResult, setCurrentResult] = useState(result);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("success");
  const [libraryCreativeId, setLibraryCreativeId] = useState(
    initialLibraryCreativeId,
  );
  const payload = currentResult?.result || {};
  const analysis = payload?.analysis || {};
  const metadata = payload?.metadata || {};
  const transcript = transcriptEvidence(payload?.transcript);
  const ocrText = payload?.ocr_text || [];
  const retentionAnalysis = normalizeRetentionAnalysis(payload?.retention_analysis);
  const pipeline = payload?.analyzer?.pipeline || analysis.analysis_basis || {};

  const hookScore = analysis.hook_score;
  const ctaScore = analysis.cta_score;
  const clarityScore = analysis.clarity_score;
  const isEstimated = /heuristic|estimate|predicted|modeled/i.test(
    String(analysis.analysis_method || analysis.evidence_type || ""),
  );
  const scoreMethod = isEstimated ? "Estimated" : "Analyzer output";

  const detectedText = ocrText
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 5)
    .join(" | ");
  const visualElements = pickList(analysis.visual_elements, analysis.visualElements).join(
    " | ",
  );

  useEffect(() => {
    setCurrentResult(result);
    setLibraryCreativeId(initialLibraryCreativeId);
  }, [initialLibraryCreativeId, result]);

  useEffect(() => {
    const data = analysisSaveFetcher.data;
    if (!data) return;
    if (data.error) {
      setActionTone("error");
      setActionMessage(data.error);
    } else if (data.success) {
      if (data.savedAnalysisId) {
        setCurrentResult((existing) => ({
          ...existing,
          savedAnalysisId: data.savedAnalysisId,
        }));
      }
      setActionTone("success");
      setActionMessage(data.success);
    }
  }, [analysisSaveFetcher.data]);

  useEffect(() => {
    const data = saveFetcher.data;
    if (!data) return;
    if (data.error) {
      setActionTone("error");
      setActionMessage(data.error);
    } else if (data.success) {
      if (data.creativeId) setLibraryCreativeId(data.creativeId);
      setActionTone("success");
      setActionMessage(data.success);
    }
  }, [saveFetcher.data]);

  useEffect(() => {
    const data = blueprintFetcher.data;
    if (!data) return;
    if (data.error) {
      setActionTone("error");
      setActionMessage(data.error);
    } else if (data.success) {
      setActionTone("success");
      setActionMessage(data.success);
    }
  }, [blueprintFetcher.data]);

  useEffect(() => {
    const data = clearFetcher.data;
    if (!data) return;
    if (data.error) {
      setActionTone("error");
      setActionMessage(data.error);
    } else if (data.cleared) {
      onRemoved?.(data.success);
    } else if (data.success) {
      setActionTone("success");
      setActionMessage(data.success);
    }
  }, [clearFetcher.data, onRemoved]);

  function submitPersistedAction(intent, fetcher) {
    setActionMessage("");
    fetcher.submit(
      {
        intent,
        analysisPayload: JSON.stringify(currentResult),
      },
      { method: "post" },
    );
  }

  function downloadReport() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const report = {
      filename: currentResult?.filename || file?.name,
      generated_at: new Date().toISOString(),
      analysis,
      metadata,
      transcript,
      detected_text: detectedText,
      retention_analysis: retentionAnalysis,
      full_result: currentResult,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blueprintai-video-analysis-report.json";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
            Current analysis
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Video Ad Breakdown
          </h2>
          <p className="mt-2 text-slate-400">
            This analysis will stay here until you save it or remove it. Missing
            analyzer fields remain explicitly unavailable.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => submitPersistedAction("saveAnalysis", analysisSaveFetcher)}
            disabled={
              analysisSaveFetcher.state !== "idle" ||
              Boolean(currentResult?.savedAnalysisId)
            }
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analysisSaveFetcher.state !== "idle"
              ? "Saving review..."
              : currentResult?.savedAnalysisId
                ? "Review saved"
                : "Save Review"}
          </button>

          {libraryCreativeId ? (
            <Link
              to={withEmbeddedRouteParams(`/app/creative-library?creativeId=${encodeURIComponent(libraryCreativeId)}`, location.search)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/25"
            >
              Open in Creative Library
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => submitPersistedAction("saveCreative", saveFetcher)}
              disabled={saveFetcher.state !== "idle"}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveFetcher.state !== "idle" ? "Saving..." : "Save to Creative Library"}
            </button>
          )}

          <button
            type="button"
            onClick={() => submitPersistedAction("generateBlueprint", blueprintFetcher)}
            disabled={blueprintFetcher.state !== "idle"}
            className="rounded-xl border border-sky-500/30 bg-sky-500/20 px-4 py-2 font-semibold text-sky-200 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {blueprintFetcher.state !== "idle" ? "Saving blueprint..." : "Generate Blueprint"}
          </button>

          <button
            type="button"
            onClick={downloadReport}
            className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400"
          >
            Download Report
          </button>

          <button
            type="button"
            onClick={() =>
              clearFetcher.submit(
                {
                  intent: "clearCurrentAnalysis",
                  activeAnalysisId: currentResult?.activeAnalysisId || "",
                },
                { method: "post" },
              )
            }
            disabled={clearFetcher.state !== "idle"}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-semibold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearFetcher.state !== "idle"
              ? "Removing..."
              : "Remove current analysis"}
          </button>
        </div>
      </div>

      {!mediaAvailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100" role="status">
          The uploaded video preview is no longer available. You can still read
          this analysis, remove it, or upload a new video. Saving to Creative
          Library requires a playable preview.
        </div>
      )}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        {isEstimated
          ? "Estimated: the analyzer identified these results as heuristic or modeled, not measured audience performance."
          : "Only analyzer-provided values are shown; this page does not create fallback scores or conclusions."}
      </p>

      <SectionCard
        title="Analysis Coverage"
        subtitle="What this review actually inspected"
      >
        <div className="flex flex-wrap gap-2">
          <RetentionBadge tone={pipeline.metadata ? "healthy" : "neutral"}>
            Metadata {pipeline.metadata ? "analyzed" : "unavailable"}
          </RetentionBadge>
          <RetentionBadge tone={pipeline.frames ? "healthy" : "neutral"}>
            Frames {pipeline.frames ? "sampled" : "unavailable"}
          </RetentionBadge>
          <RetentionBadge tone={pipeline.ocr ? "healthy" : "neutral"}>
            OCR {pipeline.ocr ? "detected" : "not detected"}
          </RetentionBadge>
          <RetentionBadge tone={pipeline.audio ? "healthy" : "neutral"}>
            Audio {pipeline.audio ? "extracted" : "unavailable"}
          </RetentionBadge>
          <RetentionBadge tone={transcript.available ? "healthy" : "neutral"}>
            Transcript {transcript.available ? "analyzed" : "unavailable"}
          </RetentionBadge>
          <RetentionBadge
            tone={retentionAnalysis.available ? "healthy" : "neutral"}
          >
            Retention {retentionAnalysis.available ? "provided" : "unavailable"}
          </RetentionBadge>
        </div>
      </SectionCard>

      {actionMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            actionTone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
          role="status"
        >
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScoreCard label="Hook Score" value={hookScore} method={scoreMethod} />
        <ScoreCard label="CTA Score" value={ctaScore} method={scoreMethod} />
        <ScoreCard label="Clarity Score" value={clarityScore} method={scoreMethod} />
      </div>

      <SectionCard title="Executive Summary">
        <p>{analysis.summary || "Not available"}</p>
      </SectionCard>

      <RetentionDropOffAnalyzer retentionAnalysis={retentionAnalysis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Messaging Angle" subtitle="Main selling angle detected">
          <p>{analysis.creator_style || analysis.messaging_angle || "Not available"}</p>
        </SectionCard>

        <SectionCard title="Visual Elements" subtitle="Branding, text, product focus">
          <p>{visualElements || detectedText || "Not available"}</p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListCard title="Strengths" items={analysis.strengths || []} />
        <ListCard title="Weaknesses" items={analysis.weaknesses || []} />
        <ListCard
          title="Recommendations"
          items={analysis.recommendations || []}
          accent
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Ad Format">
          <p>
            Duration:{" "}
            {metadata.duration_seconds
              ? `${metadata.duration_seconds.toFixed(1)} seconds`
              : "Not available"}
          </p>
          <p>
            Size: {metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : "Not available"}
          </p>
          <p>FPS: {metadata.fps || "Not available"}</p>
        </SectionCard>

        <SectionCard title="Transcript Review">
          <p>
            {transcript.full_text ||
              `Not available. ${
                transcript.unavailable_reason ||
                "Speech transcription was not produced for this review."
              }`}
          </p>
        </SectionCard>

        <ListCard
          title="Next Test Plan"
          items={analysis.next_test_plan || analysis.nextTestPlan || []}
          accent
        />
      </div>
    </section>
  );
}

export default function VideoAnalysisRoute() {
  const {
    analyses,
    analyzerRuntime,
    currentAnalysis,
    currentLibraryCreativeId,
    currentMediaAvailable,
    productError,
    products,
    selectedProductId,
    libraryCreativeIds,
  } = useLoaderData();
  const analyzeFetcher = useFetcher();
  const [file, setFile] = useState(null);
  const [warning, setWarning] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const [displayedAnalysis, setDisplayedAnalysis] = useState(currentAnalysis);
  const loading = analyzeFetcher.state !== "idle";
  const result = displayedAnalysis;
  const error = analyzeFetcher.data?.error || "";
  const success = analyzeFetcher.data?.success || "";
  const analyzerUnavailable = analyzeFetcher.data?.analyzerUnavailable === true;
  const analyzerMessage = analyzeFetcher.data?.analyzerMessage || "";
  const selectedFileMeta = file
    ? [file.type || "video file", formatFileSize(file.size)].filter(Boolean).join(" · ")
    : "MP4, MOV, M4V, or WebM";
  const reviewHistory = analyses.map(buildSavedReview);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const selectedReview =
    reviewHistory.find((review) => review.id === selectedReviewId) || null;

  useEffect(() => {
    setDisplayedAnalysis(currentAnalysis);
  }, [currentAnalysis]);

  useEffect(() => {
    if (!analyzeFetcher.data?.result) return;
    setDisplayedAnalysis(analyzeFetcher.data.result);
    setClearMessage("");
  }, [analyzeFetcher.data]);

  const handleCurrentAnalysisRemoved = useCallback((message) => {
    setDisplayedAnalysis(null);
    setClearMessage(message || "Current analysis removed.");
    setFile(null);
  }, []);

  useEffect(() => {
    if (!selectedReview) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSelectedReviewId("");
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedReview]);

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setWarning("");

    if (!selectedFile) return;

    const sizeMb = selectedFile.size / (1024 * 1024);

    if (sizeMb > 100) {
      setWarning(
        "Large video detected. For fastest analysis, use TikTok-style clips under 60 seconds or under 100MB."
      );
    } else if (sizeMb > 50) {
      setWarning(
        "For best results, upload a short TikTok-style creative under 60 seconds."
      );
    }
  }

  return (
    <section className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Creative Intelligence
        </p>

        <h1 className="font-display mt-3 text-4xl font-semibold text-foreground">
          AI Review Studio
        </h1>

        <p className="mt-3 max-w-4xl text-sm text-muted-foreground sm:text-[15px]">
          Upload a short-form video for frame, metadata, and OCR checks plus
          clearly labeled heuristic creative guidance. Transcript and retention
          appear only when those signals are actually available.
        </p>

        {!analyzerRuntime.configured && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100" role="status">
            <strong>Analyzer unavailable in this environment.</strong>{" "}
            Needs production analyzer service configured. Uploads can still be
            saved, but no analysis scores or recommendations will be generated.
          </div>
        )}
        {analyzerRuntime.configured && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100" role="status">
            <strong>Full analyzer service enabled.</strong>{" "}
            Results are generated only from fields returned by the configured service. Missing transcript, retention, or performance fields remain unavailable.
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold">Upload your creative</h2>

          <p className="mt-2 text-slate-400">
            Choose a TikTok ad, product demo, UGC clip, or creator video.
          </p>

          {result && !result.savedAnalysisId && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Starting a new analysis will replace the current unsaved analysis.
            </p>
          )}

          <analyzeFetcher.Form method="post" encType="multipart/form-data">
            <input name="intent" type="hidden" value="analyze" />
            {products.length > 0 && (
              <label className="mt-6 block text-sm font-semibold text-foreground">
                Product context
                <select
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground"
                  defaultValue={selectedProductId}
                  name="productId"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}{product.source === "demo" ? " · Demo product" : product.source === "imported" ? " · Imported product context" : " · Shopify product"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {productError && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
                Shopify products could not be loaded right now. Manual
                workspace profile product context still works.
              </div>
            )}
            {!productError && products.length === 0 && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm font-semibold text-slate-200">
                No Shopify products found yet. Add products in Shopify or enter
                product context manually.
              </div>
            )}
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-[#08111f] p-5">
              <input
                id="video-upload-file"
                type="file"
                name="file"
                accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm"
                onChange={handleFileChange}
                className="sr-only"
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
                    Selected video
                  </p>
                  <p className="mt-2 truncate text-sm font-semibold text-white">
                    {file?.name || "No file selected"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedFileMeta}
                  </p>
                </div>

                <label
                  htmlFor="video-upload-file"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Choose video
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Supported files: MP4, MOV, M4V, and WebM. Unsupported or mismatched file contents are rejected before analysis.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="bp-primary-cta mt-6"
            >
              {loading
                ? !analyzerRuntime.configured
                  ? "Saving upload..."
                  : "Analyzing..."
                : analyzerRuntime.configured
                  ? "Analyze Video"
                  : "Save Upload"}
            </button>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Analysis results remain current drafts until you explicitly save
              the review or save it to Creative Library.
            </p>
          </analyzeFetcher.Form>

          {warning && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
              {warning}
            </div>
          )}

          {analyzerUnavailable && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100" role="status">
              <p className="font-semibold">Upload saved, analysis unavailable</p>
              <p className="mt-2 text-sm leading-6">
                {analyzerMessage || "Analyzer unavailable in this environment. Needs production analyzer service configured."}
                {" "}No analysis scores or recommendations were generated or saved.
              </p>
            </div>
          )}

          {loading && (
            <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/10 p-5">
              <p className="font-semibold text-sky-200">
                Analyzing your creative...
              </p>
              <p className="mt-2 text-slate-400">
                Upload complete. Waiting for the configured analyzer service
                to return available fields.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              {success}
            </div>
          )}

          {clearMessage && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              {clearMessage}
            </div>
          )}
      </div>

      {result && (
          <VideoAdBreakdown
            initialLibraryCreativeId={currentLibraryCreativeId}
            mediaAvailable={currentMediaAvailable}
            onRemoved={handleCurrentAnalysisRemoved}
            result={result}
            file={file}
          />
        )}

        <section className="mt-10 rounded-2xl border border-white/10 bg-[#0d1526] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
                Review history
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Saved reviews
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Reviews you explicitly saved.
              </p>
            </div>
          </div>

          {reviewHistory.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {reviewHistory.map((review) => (
                <SavedReviewCard
                  key={review.id}
                  review={review}
                  creativeId={libraryCreativeIds[review.id] || ""}
                  onView={() => setSelectedReviewId(review.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-slate-950/30 p-5">
              <p className="text-sm font-semibold text-slate-200">
                No saved reviews yet. Save the current analysis when you want it
                to appear in Review History.
              </p>
            </div>
          )}
        </section>

        {selectedReview && (
          <SavedReviewModal
            review={selectedReview}
            onClose={() => setSelectedReviewId("")}
          />
        )}
      </div>
    </section>
  );
}

function SavedReviewCard({ creativeId: initialCreativeId, review, onView }) {
  const location = useLocation();
  const saveFetcher = useFetcher();
  const creativeId = saveFetcher.data?.creativeId || initialCreativeId;
  const saving = saveFetcher.state !== "idle";
  const actionPayload = {
    ...review.payload,
    savedAnalysisId: review.id,
    productId: review.productId,
    productTitle: review.productTitle,
  };

  return (
    <article className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-black text-white">{review.title}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {review.productTitle} · {review.source} · {review.date}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <SavedReviewScore label={`${review.scorePrefix}Hook`} value={review.hookScore} />
        <SavedReviewScore label={`${review.scorePrefix}Clarity`} value={review.clarityScore} />
        <SavedReviewScore label={`${review.scorePrefix}CTA`} value={review.ctaScore} />
        <SavedReviewScore label={`${review.scorePrefix}Overall`} value={review.overallScore} />
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">
        {review.summaryPreview}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onView}
          className="inline-flex w-fit items-center rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-500/25"
        >
          View full review
        </button>
        {creativeId ? (
          <Link
            to={withEmbeddedRouteParams(`/app/creative-library?creativeId=${encodeURIComponent(creativeId)}`, location.search)}
            className="inline-flex w-fit items-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25"
          >
            Open in Creative Library
          </Link>
        ) : (
          <saveFetcher.Form method="post">
            <input name="intent" type="hidden" value="saveCreative" />
            <input
              name="analysisPayload"
              type="hidden"
              value={JSON.stringify(actionPayload)}
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-fit items-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save to Creative Library"}
            </button>
          </saveFetcher.Form>
        )}
      </div>
      {saveFetcher.data?.error && (
        <p className="mt-3 text-xs font-semibold text-red-200" role="alert">
          Could not save this review to Creative Library.
        </p>
      )}
    </article>
  );
}

function SavedReviewScore({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">
        {formatReviewScore(value)}
      </p>
    </div>
  );
}

function SavedReviewModal({ review, onClose }) {
  const modalTitleId = `saved-review-title-${review.id}`;
  const metadataItems = [
    review.metadata.duration_seconds
      ? `Duration: ${Number(review.metadata.duration_seconds).toFixed(1)}s`
      : "",
    review.metadata.width && review.metadata.height
      ? `Size: ${review.metadata.width} × ${review.metadata.height}`
      : "",
    review.metadata.fps ? `FPS: ${review.metadata.fps}` : "",
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#07101d] p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
              Saved AI review
            </p>
            <h2 id={modalTitleId} className="mt-2 text-3xl font-black text-white">
              {review.title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {review.productTitle} · {review.source} · {review.date}
            </p>
            {review.rawFileName && review.rawFileName !== review.title && (
              <p className="mt-2 max-w-full truncate text-xs text-slate-500">
                Original file: {review.rawFileName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
            aria-label="Close saved review"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SavedReviewScore label={`${review.scorePrefix}Hook`} value={review.hookScore} />
          <SavedReviewScore label={`${review.scorePrefix}Clarity`} value={review.clarityScore} />
          <SavedReviewScore label={`${review.scorePrefix}CTA`} value={review.ctaScore} />
          <SavedReviewScore label={`${review.scorePrefix}Overall`} value={review.overallScore} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SavedReviewDetail title="Summary">{review.summary}</SavedReviewDetail>
          <SavedReviewDetail title="Next action">{review.nextAction || "Not available"}</SavedReviewDetail>
          <SavedReviewList title="Recommendations" items={review.recommendations} />
          <SavedReviewDetail title="Transcript / summary">
            {review.transcriptSummary ||
              "Not available. Speech transcription was not produced for this review."}
          </SavedReviewDetail>
          <SavedReviewDetail title="Pacing notes">
            {review.pacingNotes || "Not available"}
          </SavedReviewDetail>
          <SavedReviewDetail title="Creative structure notes">
            {review.creativeStructureNotes || "Not available"}
          </SavedReviewDetail>
          <SavedReviewDetail title="CTA notes">
            {review.ctaNotes || "Not available"}
          </SavedReviewDetail>
          <SavedReviewDetail title="Objection handling notes">
            {review.objectionHandlingNotes || "Not available"}
          </SavedReviewDetail>
          <SavedReviewList title="Strengths" items={review.strengths} />
          <SavedReviewList title="Weaknesses" items={review.weaknesses} />
        </div>

        {metadataItems.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Media metadata
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {metadataItems.join(" · ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedReviewDetail({ title, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-sky-200">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{children}</p>
    </section>
  );
}

function SavedReviewList({ title, items }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-sky-200">
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Not available
        </p>
      )}
    </section>
  );
}
