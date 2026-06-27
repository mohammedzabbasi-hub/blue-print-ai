import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyzeUploadedVideoFile } from "../services/media-analyzer.server";
import {
  analyzeVideoInput,
  buildRevenueBlueprint,
  getWorkspaceProfile,
  getWorkspaceSettingsMap,
  listVideoAnalyses,
  resolveProductContext,
  saveCreativeRecord,
  saveRevenueBlueprintRecord,
  saveVideoAnalysisRecord,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { generateCreativeTitleAndSummary } from "../utils/creative-display.server";
import { persistUploadedVideoFile } from "../utils/upload-storage.server";

export const meta = () => {
  return [{ title: "Video Analysis | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [analyses, settings, profile, performance] = await Promise.all([
    listVideoAnalyses(session.shop, 6),
    getWorkspaceSettingsMap(session.shop, {
      auto_save_analyzed_videos: "true",
    }),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
  ]);

  return {
    analyses,
    autoSaveAnalyzedVideos: settings.auto_save_analyzed_videos === "true",
    hasDemoPerformanceData: performance.hasDemoPerformanceData,
    hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products,
    selectedProductId: profile.selectedProductId || merchantData.products[0]?.id || "",
  };
};

export const action = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "analyze");

  try {
    if (intent === "analyze") {
      const settings = await getWorkspaceSettingsMap(session.shop, {
        auto_save_analyzed_videos: "true",
      });
      const profile = await getWorkspaceProfile(session.shop);
      const autoSaveAnalyzedVideos =
        settings.auto_save_analyzed_videos === "true";
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
      const analysis = buildVideoAnalysisPayload({
        analyzer,
        fileName,
        fileSize,
        fileType,
        storedVideo,
        product,
      });
      const saved = autoSaveAnalyzedVideos
        ? await saveVideoAnalysisRecord({
            shop: session.shop,
            product,
            fileName,
            fileType,
            fileSize,
            mediaUrl: storedVideo?.mediaUrl || "",
            displayTitle: analysis.result.display.displayTitle,
            summary: analysis.result.display.summary,
            brief: analysis.result.display.summary,
            analysis,
            savedToLibrary: true,
          })
        : null;

      return {
        result: {
          ...analysis,
          savedAnalysisId: saved?.id || null,
          productId: product.id,
          productTitle: product.title,
        },
        success: autoSaveAnalyzedVideos
          ? saved.wasCreated
            ? `Analysis saved as: ${analysis.result.display.displayTitle}`
            : `Analysis already saved as: ${analysis.result.display.displayTitle}`
          : `Analysis ready as: ${analysis.result.display.displayTitle}. Save manually when ready.`,
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
    const mediaFingerprint =
      media.fingerprint || metadata.media_fingerprint || analysisPayload.mediaFingerprint || "";
    const display =
      analysisPayload.result?.display ||
      payload.display ||
      payload?.result?.display ||
      generateCreativeTitleAndSummary({
        productTitle: product.title,
        fileName,
        analysis,
        metadata,
      });
    const displayTitle = display.displayTitle || display.generatedTitle || fileName;
    const summary = display.summary || analysis.summary || "Video analysis";
    const saveableAnalysis = {
      filename: fileName,
      result: {
        ...(analysisPayload.result || payload.result || {}),
        display,
      },
    };

    if (intent === "saveAnalysis") {
      const saved = await saveVideoAnalysisRecord({
        shop: session.shop,
        product,
        fileName,
        fileType: metadata.file_type || "",
        fileSize: Number(metadata.file_size || 0),
        mediaUrl,
        displayTitle,
        summary,
        brief: summary,
        analysis: saveableAnalysis,
        savedToLibrary: false,
      });

      return {
        savedAnalysisId: saved.id,
        success: saved.wasCreated
          ? `Analysis saved as: ${displayTitle}`
          : `Analysis already saved as: ${displayTitle}`,
      };
    }

    if (intent === "saveCreative") {
      const creative = await saveCreativeRecord(session.shop, {
        sourceType: "video_analysis",
        sourceId:
          analysisPayload.savedAnalysisId ||
          (mediaFingerprint ? `upload:${mediaFingerprint}` : null),
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
          mediaFingerprint,
          mediaState: mediaUrl ? "local_public_upload" : "analysis_only",
          mediaStored: Boolean(mediaUrl),
          mediaStorage: media.storage || "",
          mediaUrl,
          originalFilename: display.originalFilename || fileName,
          source: "video_analysis",
          video_url: mediaUrl,
        },
      });

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

const DEFAULT_RETENTION_ANALYSIS = {
  retention_score: 42,
  hook_status: "Weak",
  useless_viewership_flag: true,
  first_3_seconds_retention: 78,
  first_5_seconds_retention: 61,
  first_10_seconds_retention: 39,
  retention_curve: [
    { second: 0, retention: 100 },
    { second: 3, retention: 78 },
    { second: 5, retention: 61 },
    { second: 10, retention: 39 },
    { second: 15, retention: 31 },
    { second: 20, retention: 24 },
    { second: 30, retention: 18 },
  ],
  biggest_dropoff: {
    timestamp: "0:10",
    drop_percent: 22,
    severity: "High",
    reason:
      "The ad loses momentum before the product benefit is clearly shown.",
  },
  major_dropoffs: [],
  engagement_vacancies: [
    "No strong pattern interrupt in the first 10 seconds",
    "Product benefit appears too late",
    "Visual pacing slows down before the viewer has a reason to stay",
  ],
  recommendations: [
    "Show the product result within the first 2 seconds.",
    "Cut the intro by 3-5 seconds.",
    "Add a bold text overlay that states the main pain point immediately.",
    "Insert a fast visual change before second 8.",
  ],
  verdict:
    "This ad loses too much viewer attention in the first 10 seconds, so much of the viewership is low-value.",
};

function buildVideoAnalysisPayload({
  analyzer,
  fileName,
  fileSize,
  fileType,
  storedVideo,
  product,
}) {
  const heuristic = analyzeVideoInput({
    description: [
      analyzer?.summary,
      analyzer?.transcript?.full_text,
      analyzer?.ocr_text?.map((item) => item.text).join(" "),
    ]
      .filter(Boolean)
      .join(" "),
    productTitle: product.title,
    fileName,
    fileSize,
    fileType,
    contentSignature: analyzer?.message || "",
  });
  const analysis = {
    summary:
      analyzer?.summary ||
      `${fileName} creative analysis saved from Shopify workspace upload.`,
    hook_score: heuristic.hookScore,
    cta_score: heuristic.ctaScore,
    clarity_score: heuristic.clarityScore,
    creator_style: "Product demonstration",
    recommendations: heuristic.rewriteSuggestions,
    strengths: [
      analyzer?.available
        ? "The uploaded video was processed by the local media analyzer."
        : "The analysis used file metadata from the uploaded video.",
    ],
    weaknesses: [heuristic.firstTenSecondRisk],
    hook_type: "Problem-solution",
    creator_type: "Product demo",
    delivery_style: "Direct response",
    pacingNotes: heuristic.pacingNotes,
    firstTenSecondRisk: heuristic.firstTenSecondRisk,
  };
  const display = generateCreativeTitleAndSummary({
    productTitle: product.title,
    fileName,
    transcriptText: analyzer?.transcript?.full_text || "",
    ocrText: analyzer?.ocr_text?.map((item) => item.text).join(" ") || "",
    analysis,
    metadata: analyzer?.metadata || {},
  });

  analysis.summary = display.summary;

  return {
    filename: fileName,
    result: {
      analysis,
      display,
      metadata: {
        duration_seconds: analyzer?.metadata?.duration_seconds || 0,
        fps: analyzer?.metadata?.fps || 0,
        height: analyzer?.metadata?.height || 0,
        width: analyzer?.metadata?.width || 0,
        file_size: fileSize,
        file_type: fileType,
        media_fingerprint: storedVideo?.fingerprint || "",
        media_url: storedVideo?.mediaUrl || "",
      },
      media: storedVideo
        ? {
            fileName: storedVideo.originalName,
            fingerprint: storedVideo.fingerprint,
            mediaUrl: storedVideo.mediaUrl,
            storage: storedVideo.storage,
          }
        : null,
      transcript: analyzer?.transcript || {
        summary: "",
        full_text: "",
      },
      ocr_text: analyzer?.ocr_text || [],
      retention_analysis: analyzer?.retention_analysis || DEFAULT_RETENTION_ANALYSIS,
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

function predictImpact(analysis) {
  const hook = Number(analysis.hook_score || 0);
  const cta = Number(analysis.cta_score || 0);
  const clarity = Number(analysis.clarity_score || 0);
  const avg = (hook + cta + clarity) / 3;

  if (avg >= 7) {
    return {
      level: "High",
      reason:
        "Strong hook, clear message, and CTA give this creative stronger estimated readiness for the next planning test.",
    };
  }

  if (avg >= 4) {
    return {
      level: "Medium",
      reason:
        "The creative has some usable elements, but weak clarity or CTA may limit readiness for a TikTok-style planning test.",
    };
  }

  return {
    level: "Low",
    reason:
      "Weak CTA, unclear benefit, and low hook strength make this unlikely to convert well without revision.",
  };
}

function getWinningPattern(analysis) {
  const hook = Number(analysis.hook_score || 0);
  const cta = Number(analysis.cta_score || 0);
  const clarity = Number(analysis.clarity_score || 0);

  const missing = [];
  if (hook < 6) missing.push("strong hook");
  if (cta < 6) missing.push("clear CTA");
  if (clarity < 6) missing.push("clear benefit text");

  return {
    matches: hook >= 7 && cta >= 7 && clarity >= 7 ? "Yes" : "No",
    closest: analysis.creator_style || "Product Demo",
    missing: missing.length
      ? missing.join(", ")
      : "No major missing pattern detected",
  };
}

function getAdClassification(analysis, metadata) {
  const style = analysis.creator_style || "Product demonstration";
  const duration = Number(metadata.duration_seconds || 0);

  return {
    format: `${style} / short-form ad`,
    style,
    bestUse:
      duration > 60
        ? "Retargeting or product education, not cold traffic"
        : "Cold traffic test or retargeting creative",
  };
}

function rewriteAd(analysis) {
  const summary = `${analysis.summary || ""}`.toLowerCase();

  if (summary.includes("old spice") || summary.includes("deodorant")) {
    return {
      hook: "Most deodorants fade by noon — this one does not.",
      cta: "Tap to shop Old Spice now.",
      angle: "Lead with the product benefit, then show the result clearly.",
    };
  }

  return {
    hook: "Stop scrolling — this fixes the problem you deal with every day.",
    cta: "Tap to shop now.",
    angle:
      "Open with the pain point, show the product in action, then end with a direct CTA.",
  };
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
    transcript: result.transcript || payload.transcript || {},
    retention: result.retention_analysis || payload.retention_analysis || {},
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

  return score ? `${score}/10` : "—";
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
  const knownScores = [hookScore, clarityScore, ctaScore].filter(Boolean);
  const overallScore =
    normalizeScore(
      analysis.overall_score ||
        analysis.overallScore ||
        analysis.creative_score ||
        analysis.creativeScore ||
        analysis.readinessScore,
    ) ||
    (knownScores.length
      ? Math.round(
          knownScores.reduce((total, score) => total + score, 0) /
            knownScores.length,
        )
      : null);
  const summary = pickText(
    display.summary,
    analysis.summary,
    record.brief,
    result.summary,
    "No summary saved for this review.",
  );
  const recommendations = pickList(
    analysis.recommendations,
    analysis.next_actions,
    analysis.nextActions,
    retention.recommendations,
  );
  const nextAction =
    recommendations[0] ||
    pickText(
      analysis.next_action,
      analysis.nextAction,
      result.nextAction,
      "Turn the strongest hook and CTA into the next creative test.",
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
      "Manual upload",
    ),
    date: formatSavedReviewDate(record.createdAt || result.createdAt),
    hookScore,
    clarityScore,
    ctaScore,
    overallScore,
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
      analysis.cta_score
        ? `CTA strength was scored ${analysis.cta_score}/10.`
        : "",
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
  };
}

function ScoreCard({ label, value }) {
  const score = Number(value || 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-bold text-white">{score}/10</p>
      <p className="mt-2 text-xs text-sky-300">{scoreLabel(score)}</p>
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
  if (score >= 75) return "healthy";
  if (score >= 50) return "warning";
  return "danger";
}

function retentionStatus(score) {
  if (score >= 75) return "Healthy Retention";
  if (score >= 50) return "Medium Warning";
  return "Critical Warning";
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
          <li>No data available.</li>
        )}
      </ul>
    </SectionCard>
  );
}

function RetentionChart({ curve = [] }) {
  const chartData = curve.length
    ? curve
    : DEFAULT_RETENTION_ANALYSIS.retention_curve;

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
  const retention = retentionAnalysis || DEFAULT_RETENTION_ANALYSIS;
  const score = Number(retention.retention_score || 0);
  const tone = retentionTone(score);
  const biggestDropoff = retention.biggest_dropoff || {};
  const isWeakHook = retention.hook_status === "Weak";
  const isHighDropoff = biggestDropoff.severity === "High";

  return (
    <section className="rounded-3xl border border-sky-500/20 bg-[#0a1020] p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
            Retention Intelligence
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Retention Drop-Off Analyzer
          </h2>
          <p className="mt-2 max-w-3xl text-slate-400">
            Viewer decay, hook strength, engagement vacancies, and fixes for
            keeping more valuable attention.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <RetentionBadge tone={tone}>{retentionStatus(score)}</RetentionBadge>
          <RetentionBadge tone={isWeakHook ? "danger" : "healthy"}>
            {isWeakHook ? "Weak Hook" : "Strong Hook"}
          </RetentionBadge>
          {retention.useless_viewership_flag && (
            <RetentionBadge tone="danger">Useless Viewership Flag</RetentionBadge>
          )}
          {isHighDropoff && (
            <RetentionBadge tone="warning">High Drop-Off</RetentionBadge>
          )}
        </div>
      </div>

      {score < 50 && (
        <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-red-100">
          <p className="font-black">Critical retention warning</p>
          <p className="mt-1 text-sm text-red-100/85">
            Retention score is below 50. The first 5-10 seconds should be
            rebuilt before this ad is scaled.
          </p>
        </div>
      )}

      {score >= 50 && score < 75 && (
        <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-black">Medium retention warning</p>
          <p className="mt-1 text-sm text-amber-100/85">
            Retention is usable, but the ad needs a stronger early payoff and
            pacing test.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Retention Health Score"
          value={`${score}/100`}
          detail={retentionStatus(score)}
        />
        <MetricTile label="Hook Status" value={retention.hook_status || "Unknown"} />
        <MetricTile
          label="First 3 Seconds"
          value={`${retention.first_3_seconds_retention ?? 0}%`}
        />
        <MetricTile
          label="First 5 Seconds"
          value={`${retention.first_5_seconds_retention ?? 0}%`}
        />
        <MetricTile
          label="First 10 Seconds"
          value={`${retention.first_10_seconds_retention ?? 0}%`}
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
            <RetentionBadge tone={tone}>
              {score >= 75 ? "Healthy Retention" : "Drop-Off Risk"}
            </RetentionBadge>
          </div>
          <RetentionChart curve={retention.retention_curve} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Useless Viewership Flag">
            <p
              className={
                retention.useless_viewership_flag
                  ? "text-red-100"
                  : "text-emerald-100"
              }
            >
              {retention.useless_viewership_flag
                ? "True - retention at 10 seconds is below the healthy threshold."
                : "False - enough viewers are staying through the early value window."}
            </p>
          </SectionCard>

          <SectionCard title="Biggest Drop-Off Moment" accent={isHighDropoff}>
            <p className="text-2xl font-black text-white">
              {biggestDropoff.timestamp || "No major drop"}{" "}
              <span className="text-base text-slate-400">
                {biggestDropoff.drop_percent
                  ? `-${biggestDropoff.drop_percent}%`
                  : ""}
              </span>
            </p>
            <p className="mt-3">
              {biggestDropoff.reason || "No significant drop-off detected."}
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
          <p>{retention.verdict || "No retention verdict available yet."}</p>
        </SectionCard>
      </div>
    </section>
  );
}

function VideoAdBreakdown({ autoSaveAnalyzedVideos, result, file }) {
  const analysisSaveFetcher = useFetcher();
  const saveFetcher = useFetcher();
  const blueprintFetcher = useFetcher();
  const [currentResult, setCurrentResult] = useState(result);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("success");
  const payload = currentResult?.result || {};
  const analysis = payload?.analysis || {};
  const metadata = payload?.metadata || {};
  const transcript = payload?.transcript || {};
  const ocrText = payload?.ocr_text || [];
  const retentionAnalysis =
    payload?.retention_analysis || DEFAULT_RETENTION_ANALYSIS;

  const hookScore = Number(analysis.hook_score || 0);
  const ctaScore = Number(analysis.cta_score || 0);
  const clarityScore = Number(analysis.clarity_score || 0);

  const impact = predictImpact(analysis);
  const pattern = getWinningPattern(analysis);
  const classification = getAdClassification(analysis, metadata);
  const rewrite = rewriteAd(analysis);

  const detectedText = ocrText
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 5)
    .join(" | ");

  useEffect(() => {
    setCurrentResult(result);
  }, [result]);

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
      estimated_creative_readiness: impact,
      creative_pattern_match: pattern,
      ad_classification: classification,
      rewrite_this_ad: rewrite,
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
            Creative Intelligence Report
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Video Ad Breakdown
          </h2>
          <p className="mt-2 text-slate-400">
            Hook, messaging, visual clarity, CTA strength, format,
            AI-estimated creative readiness, and next-test recommendations.
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
              ? "Saving analysis..."
              : currentResult?.savedAnalysisId || autoSaveAnalyzedVideos
                ? "Analysis saved"
                : "Save Analysis"}
          </button>

          <button
            type="button"
            onClick={() => submitPersistedAction("saveCreative", saveFetcher)}
            disabled={saveFetcher.state !== "idle"}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveFetcher.state !== "idle" ? "Saving..." : "Save to Creative Library"}
          </button>

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
        </div>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        AI-estimated analysis can be inaccurate. Review results before using
        them for publishing, claims, or business decisions.
      </p>

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
        <ScoreCard label="Hook Score" value={hookScore} />
        <ScoreCard label="CTA Score" value={ctaScore} />
        <ScoreCard label="Clarity Score" value={clarityScore} />
      </div>

      <SectionCard title="Executive Summary">
        <p>{analysis.summary || "No summary available."}</p>
      </SectionCard>

      <RetentionDropOffAnalyzer retentionAnalysis={retentionAnalysis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Estimated Creative Readiness"
          subtitle="AI-estimated planning signal, not live TikTok performance"
          accent
        >
          <p className="text-3xl font-black text-white">{impact.level}</p>
          <p className="mt-3">{impact.reason}</p>
        </SectionCard>

        <SectionCard
          title="Creative Pattern Match"
          subtitle="How closely this upload matches saved planning patterns"
        >
          <p>
            <strong>Matches Planning Pattern:</strong> {pattern.matches}
          </p>
          <p className="mt-2">
            <strong>Closest Pattern:</strong> {pattern.closest}
          </p>
          <p className="mt-2">
            <strong>Missing:</strong> {pattern.missing}
          </p>
        </SectionCard>

        <SectionCard
          title="Ad Type / Format Classification"
          subtitle="Creative format and best use"
        >
          <p>
            <strong>Format:</strong> {classification.format}
          </p>
          <p className="mt-2">
            <strong>Style:</strong> {classification.style}
          </p>
          <p className="mt-2">
            <strong>Best Use:</strong> {classification.bestUse}
          </p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Hook Analysis"
          subtitle="First 3 seconds and scroll-stopping power"
        >
          <p>
            The opening hook scored <strong>{hookScore}/10</strong>.{" "}
            {hookScore >= 7
              ? "The opening is strong enough to earn attention."
              : "A stronger first 3 seconds should quickly show the problem, result, or product payoff."}
          </p>
        </SectionCard>

        <SectionCard title="Messaging Angle" subtitle="Main selling angle detected">
          <p>
            Detected creator style:{" "}
            <strong>{analysis.creator_style || "Not clearly detected"}</strong>.
          </p>
          <p className="mt-2">
            The core benefit should be made clearer earlier, especially for
            viewers watching without sound.
          </p>
        </SectionCard>

        <SectionCard title="Visual Elements" subtitle="Branding, text, product focus">
          <p>
            Detected text:{" "}
            <span className="text-slate-400">
              {detectedText || "No readable on-screen text detected."}
            </span>
          </p>
          <p className="mt-2">
            Visual clarity score: <strong>{clarityScore}/10</strong>.
          </p>
        </SectionCard>

        <SectionCard title="CTA Effectiveness" subtitle="Planning prompt strength">
          <p>
            CTA score: <strong>{ctaScore}/10</strong>.{" "}
            {ctaScore >= 7
              ? "The next step is clear."
              : "The ad should clearly tell the viewer what to do next."}
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Rewrite This Ad"
        subtitle="Suggested creative variation to test next"
        accent
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Better Hook
            </p>
            <p className="mt-2 font-semibold text-white">“{rewrite.hook}”</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Better CTA
            </p>
            <p className="mt-2 font-semibold text-white">“{rewrite.cta}”</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Better Angle
            </p>
            <p className="mt-2 font-semibold text-white">{rewrite.angle}</p>
          </div>
        </div>
      </SectionCard>

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
              : "Unknown"}
          </p>
          <p>
            Size: {metadata.width || "?"} × {metadata.height || "?"}
          </p>
          <p>FPS: {metadata.fps || "Unknown"}</p>
        </SectionCard>

        <SectionCard title="Transcript Review">
          <p>{transcript.full_text || "No clear transcript detected."}</p>
        </SectionCard>

        <SectionCard title="Next Test Plan" accent>
          <ul className="space-y-3">
            <li>• Test a stronger first 3-second hook.</li>
            <li>• Add clearer product-benefit text on screen.</li>
            <li>• Add a direct CTA near the end.</li>
            <li>• Test a creator voiceover version.</li>
          </ul>
        </SectionCard>
      </div>
    </section>
  );
}

export default function VideoAnalysisRoute() {
  const {
    analyses,
    autoSaveAnalyzedVideos,
    productError,
    products,
    selectedProductId,
  } = useLoaderData();
  const analyzeFetcher = useFetcher();
  const [file, setFile] = useState(null);
  const [warning, setWarning] = useState("");
  const loading = analyzeFetcher.state !== "idle";
  const result = analyzeFetcher.data?.result || null;
  const error = analyzeFetcher.data?.error || "";
  const success = analyzeFetcher.data?.success || "";
  const selectedFileMeta = file
    ? [file.type || "video file", formatFileSize(file.size)].filter(Boolean).join(" · ")
    : "MP4, MOV, M4V, or WebM";
  const savedReviews = analyses.map(buildSavedReview);
  const currentSavedReview =
    result?.savedAnalysisId &&
    !savedReviews.some((review) => review.id === result.savedAnalysisId)
      ? buildSavedReview({
          id: result.savedAnalysisId,
          productId: result.productId,
          productTitle: result.productTitle,
          fileName: result.filename,
          brief: result.result?.display?.summary,
          payload: result,
          createdAt: new Date().toISOString(),
        })
      : null;
  const reviewHistory = currentSavedReview
    ? [currentSavedReview, ...savedReviews]
    : savedReviews;
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const selectedReview =
    reviewHistory.find((review) => review.id === selectedReviewId) || null;

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
          Video Analysis
        </h1>

        <p className="mt-3 max-w-4xl text-sm text-muted-foreground sm:text-[15px]">
          Upload a TikTok-style video and BlueprintAI will break down the hook,
          clarity, CTA, transcript, pacing, and creative structure.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold">Upload your creative</h2>

          <p className="mt-2 text-slate-400">
            Choose a TikTok ad, product demo, UGC clip, or creator video.
          </p>

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
                      {product.title}
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
                accept="video/*"
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
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="bp-primary-cta mt-6"
            >
              {loading
                ? autoSaveAnalyzedVideos
                  ? "Analyzing and saving..."
                  : "Analyzing..."
                : "Analyze Video"}
            </button>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {autoSaveAnalyzedVideos
                ? "Auto-save enabled"
                : "Auto-save disabled - save manually after analysis"}
            </p>
          </analyzeFetcher.Form>

          {warning && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
              {warning}
            </div>
          )}

          {loading && (
            <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/10 p-5">
              <p className="font-semibold text-sky-200">
                Analyzing your creative...
              </p>
              <p className="mt-2 text-slate-400">
                Extracting frames, reading on-screen text, checking transcript,
                scoring hook, CTA, and clarity.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              {success}
            </div>
          )}
      </div>

      {result && (
          <VideoAdBreakdown
            autoSaveAnalyzedVideos={autoSaveAnalyzedVideos}
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
                Shop-scoped AI Review Studio records saved from analyzed videos.
              </p>
            </div>
          </div>

          {reviewHistory.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {reviewHistory.map((review) => (
                <SavedReviewCard
                  key={review.id}
                  review={review}
                  onView={() => setSelectedReviewId(review.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-slate-950/30 p-5">
              <p className="text-sm font-semibold text-slate-200">
                No saved reviews yet. Analyze a video to create the first shop-scoped review.
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

function SavedReviewCard({ review, onView }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-black text-white">{review.title}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {review.productTitle} · {review.source} · {review.date}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <SavedReviewScore label="Hook" value={review.hookScore} />
        <SavedReviewScore label="Clarity" value={review.clarityScore} />
        <SavedReviewScore label="CTA" value={review.ctaScore} />
        <SavedReviewScore label="Overall" value={review.overallScore} />
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">
        {review.summaryPreview}
      </p>

      <button
        type="button"
        onClick={onView}
        className="mt-4 inline-flex w-fit items-center rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-500/25"
      >
        View full review
      </button>
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
          <SavedReviewScore label="Hook" value={review.hookScore} />
          <SavedReviewScore label="Clarity" value={review.clarityScore} />
          <SavedReviewScore label="CTA" value={review.ctaScore} />
          <SavedReviewScore label="Overall" value={review.overallScore} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SavedReviewDetail title="Summary">{review.summary}</SavedReviewDetail>
          <SavedReviewDetail title="Next action">{review.nextAction}</SavedReviewDetail>
          <SavedReviewList title="Recommendations" items={review.recommendations} />
          <SavedReviewDetail title="Transcript / summary">
            {review.transcriptSummary || "No transcript summary was saved."}
          </SavedReviewDetail>
          <SavedReviewDetail title="Pacing notes">
            {review.pacingNotes || "No pacing notes were saved."}
          </SavedReviewDetail>
          <SavedReviewDetail title="Creative structure notes">
            {review.creativeStructureNotes || "No creative structure notes were saved."}
          </SavedReviewDetail>
          <SavedReviewDetail title="CTA notes">
            {review.ctaNotes || "No CTA notes were saved."}
          </SavedReviewDetail>
          <SavedReviewDetail title="Objection handling notes">
            {review.objectionHandlingNotes || "No objection handling notes were saved."}
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
          No saved details for this section.
        </p>
      )}
    </section>
  );
}
