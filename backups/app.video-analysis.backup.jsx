import { useEffect, useMemo, useState } from "react";
import { Buffer } from "node:buffer";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  aiProviderStatus,
  analyzeVideoInput,
  findProductStrict,
  listVideoAnalyses,
  loadMerchantData,
  saveVideoAnalysisRecord,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  PrimaryButton,
  SecondaryButton,
} from "../components/blueprint-ui";

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);

  return {
    merchantData,
    aiStatus: aiProviderStatus(),
    recentAnalyses: await listVideoAnalyses(session.shop),
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const merchantData = await loadMerchantData(admin, session);
  const productId = String(formData.get("productId") || "");
  const product = findProductStrict(merchantData.products, productId);
  const brief = String(formData.get("brief") || "");
  const videoFile = formData.get("videoFile");
  const fileName = typeof videoFile?.name === "string" ? videoFile.name : "";
  const fileType = typeof videoFile?.type === "string" ? videoFile.type : "";
  const fileSize = Number(videoFile?.size || 0);
  const uploadError = validateVideoUpload({ fileName, fileSize, fileType });

  if (!product) {
    return {
      selectedProductId: productId,
      brief,
      fileName,
      error: "Select a product before analyzing or saving a creative.",
    };
  }

  if (uploadError) {
    return {
      selectedProductId: product.id,
      brief,
      fileName,
      error: uploadError,
    };
  }

  const fileSignature = await buildFileSignature(videoFile);
  const { analyzeUploadedVideoFile } = await import("../services/media-analyzer.server.js");
  const mediaAnalyzer = await analyzeUploadedVideoFile(videoFile);
  const mediaPersistence = await buildMediaReference(videoFile);
  const description = [brief, fileName, fileType, `${fileSize} bytes`].filter(Boolean).join(" ");
  const savedToLibrary = formData.get("intent") === "analyze_and_save";
  const analysis = analyzeVideoInput({
    description,
    productTitle: product.title,
    fileName,
    fileType,
    fileSize,
    contentSignature: fileSignature,
  });
  mergeMediaAnalyzerResult(analysis, mediaAnalyzer);
  analysis.mediaPersistence = mediaPersistence.message;

  if (savedToLibrary && !fileName && !brief.trim()) {
    return {
      selectedProductId: product.id,
      brief,
      fileName,
      error: "Upload a video file or add angle notes before saving an analysis.",
    };
  }

  const savedAnalysis = await saveVideoAnalysisRecord({
    shop: session.shop,
    product,
    fileName,
    fileType,
    fileSize,
    mediaUrl: mediaPersistence.mediaUrl,
    brief,
    analysis,
    savedToLibrary,
  });

  return {
    selectedProductId: product.id,
    brief,
    fileName,
    fileType,
    fileSize,
    mediaUrl: mediaPersistence.mediaUrl,
    mediaStored: Boolean(mediaPersistence.mediaUrl),
    mediaPersistence: mediaPersistence.message,
    mediaAnalyzer,
    analysis,
    savedAnalysisId: savedAnalysis.id,
    savedToLibrary,
  };
};

function validateVideoUpload({ fileName, fileSize, fileType }) {
  const hasUpload = Boolean(fileName || fileSize || fileType);

  if (!hasUpload) return "";

  const extension = fileName
    .toLowerCase()
    .slice(fileName.lastIndexOf("."));

  if (!fileName || fileSize <= 0) {
    return "Upload a valid video file before analyzing media.";
  }

  if (fileSize > MAX_VIDEO_UPLOAD_BYTES) {
    return "Upload a video smaller than 200MB.";
  }

  if (!String(fileType || "").startsWith("video/")) {
    return "Upload a video file. Supported formats are MP4, MOV, M4V, and WebM.";
  }

  if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
    return "Use a supported video format: MP4, MOV, M4V, or WebM.";
  }

  return "";
}

async function buildFileSignature(videoFile) {
  if (!videoFile || typeof videoFile.slice !== "function") return "";

  const bytes = new Uint8Array(await videoFile.slice(0, 65536).arrayBuffer());
  let hash = 2166136261;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}-${bytes.length}b`;
}

function mergeMediaAnalyzerResult(analysis, mediaAnalyzer) {
  if (!mediaAnalyzer?.available) {
    analysis.mediaAnalyzer = {
      available: false,
      message: mediaAnalyzer?.message || "Media analyzer did not run.",
    };
    analysis.analysisBasis =
      "File metadata, upload signature, product context, and optional angle text. Full media analysis did not run for this upload.";
    return;
  }

  const analyzerAnalysis = mediaAnalyzer.analysis || {};
  const metadata = mediaAnalyzer.metadata || {};
  const frames = mediaAnalyzer.frames || [];
  const ocrText = mediaAnalyzer.ocr_text || [];
  const transcript = mediaAnalyzer.transcript || {};
  const recommendations = analyzerAnalysis.recommendations || [];

  analysis.hookScore = Number(analyzerAnalysis.hook_score || analysis.hookScore);
  analysis.clarityScore = Number(analyzerAnalysis.clarity_score || analysis.clarityScore);
  analysis.ctaScore = Number(analyzerAnalysis.cta_score || analysis.ctaScore);
  analysis.retentionRisk =
    analysis.hookScore + analysis.clarityScore + analysis.ctaScore >= 22
      ? "Low"
      : "Medium";
  analysis.analysisBasis =
    "BlueprintAI media analyzer inspected video metadata, sampled frames, extracted audio status, OCR text, product context, and your notes.";
  analysis.mediaAnalyzer = {
    available: true,
    pipeline: mediaAnalyzer.pipeline,
    metadata,
    frameCount: frames.length,
    ocrTextCount: ocrText.length,
    transcriptSummary: transcript.full_text || "",
    summary: analyzerAnalysis.summary || "",
    creatorStyle: analyzerAnalysis.creator_style || "",
    strengths: analyzerAnalysis.strengths || [],
    weaknesses: analyzerAnalysis.weaknesses || [],
    recommendations,
    fallback: Boolean(mediaAnalyzer.fallback),
    fallbackReason: mediaAnalyzer.fallback_reason || "",
  };
  analysis.firstTenSecondRisk =
    analyzerAnalysis.weaknesses?.[0] ||
    (frames.length
      ? `Analyzer sampled ${frames.length} frames from a ${metadata.duration_seconds || "short"} second video.`
      : analysis.firstTenSecondRisk);
  analysis.pacingNotes = analyzerAnalysis.summary || analysis.pacingNotes;
  analysis.rewriteSuggestions = recommendations.length
    ? recommendations.slice(0, 3)
    : analysis.rewriteSuggestions;
  analysis.fileSignals = {
    ...analysis.fileSignals,
    durationSeconds: metadata.duration_seconds,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    aspectRatio: metadata.aspect_ratio,
    frameCount: frames.length,
    ocrText: ocrText.map((item) => item.text).filter(Boolean).slice(0, 6),
  };
}

async function buildMediaReference(videoFile) {
  const maxStoredBytes = 8 * 1024 * 1024;

  if (!videoFile || typeof videoFile.arrayBuffer !== "function" || !videoFile.size) {
    return {
      mediaUrl: "",
      message: "No media file was stored; this record contains analysis metadata only.",
    };
  }

  if (videoFile.size > maxStoredBytes) {
    return {
      mediaUrl: "",
      message: "The uploaded file was larger than the safe local storage limit, so only metadata and analysis were saved.",
    };
  }

  const bytes = Buffer.from(await videoFile.arrayBuffer());
  const mimeType = videoFile.type || "application/octet-stream";

  return {
    mediaUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    message: "A playable media preview was stored with this analysis.",
  };
}

export default function VideoAnalysis() {
  const { merchantData, aiStatus, recentAnalyses } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const analysis = actionData?.analysis;
  const [fileName, setFileName] = useState(actionData?.fileName || "");
  const [previewUrl, setPreviewUrl] = useState(actionData?.mediaStored ? actionData?.mediaUrl : "");
  const [selectedProductId, setSelectedProductId] = useState(actionData?.selectedProductId || "");
  const canAnalyze = Boolean(selectedProductId) && !isSubmitting;
  const selectedProduct = useMemo(
    () => merchantData.products.find((product) => product.id === selectedProductId),
    [merchantData.products, selectedProductId],
  );
  const scoreMetrics = analysis ? buildScoreMetrics(analysis) : [];
  const resultGroups = analysis ? buildResultGroups(analysis) : [];

  useEffect(() => {
    if (actionData?.mediaStored && actionData?.mediaUrl) {
      setPreviewUrl(actionData.mediaUrl);
    }
  }, [actionData?.mediaStored, actionData?.mediaUrl]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    setFileName(file?.name || "");

    if (!file) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
      return nextPreviewUrl;
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="bp-page bp-video-analysis-page">
      <section className="bp-video-hero" aria-labelledby="video-analysis-title">
        <p className="bp-eyebrow">Creative Intelligence</p>
        <h1 id="video-analysis-title">Video Analysis</h1>
        <p>
          Upload a TikTok-style video and BlueprintAI will break down the hook,
          clarity, CTA, transcript, pacing, and creative structure.
        </p>
      </section>

      <div className="bp-video-workspace">
        <section className="bp-video-input-panel" aria-labelledby="video-upload-title">
          <header className="bp-video-panel-heading">
            <span className="bp-video-panel-icon">
              <Icon name="video" />
            </span>
            <div>
              <h2 id="video-upload-title">Upload your creative</h2>
              <p>Choose a TikTok ad, product demo, UGC clip, or creator video.</p>
            </div>
          </header>

          <Form method="post" encType="multipart/form-data" className="bp-video-form">
            <label className="bp-video-field">
              <span>Product</span>
              <select
                name="productId"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="bp-select bp-video-select"
              >
                <option value="" disabled>Select a product...</option>
                {merchantData.products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="bp-video-field">
              <span>Video file</span>
              <label htmlFor="video-file" className="bp-upload-dropzone">
                <span className="bp-upload-icon">
                  <Icon name="upload" />
                </span>
                <span className="bp-upload-copy">
                  <strong>{fileName || "Choose File"}</strong>
                  <small>{fileName ? "Ready to analyze" : "No file chosen"}</small>
                </span>
                <em>{fileName || "No file selected"}</em>
              </label>
              <input
                id="video-file"
                name="videoFile"
                type="file"
                accept="video/*"
                className="bp-sr-only"
                onChange={handleFileChange}
              />
            </div>

            <label className="bp-video-field">
              <span>What&apos;s the angle / intent? (optional)</span>
              <textarea
                name="brief"
                rows="4"
                defaultValue={actionData?.brief || ""}
                className="bp-textarea bp-video-textarea"
                placeholder="e.g. Pain-led UGC for cold prospecting on TikTok and Reels"
              />
            </label>

            <div className="bp-video-actions">
              <PrimaryButton
                as="button"
                type="submit"
                className="bp-video-primary"
                disabled={!canAnalyze}
                aria-disabled={!canAnalyze}
              >
                <Icon name="sparkles" /> {isSubmitting ? "Analyzing video..." : "Analyze Video"}
              </PrimaryButton>
              <SecondaryButton
                as="button"
                type="submit"
                name="intent"
                value="analyze_and_save"
                className="bp-video-secondary"
                disabled={!canAnalyze}
                aria-disabled={!canAnalyze}
              >
                <Icon name="save" /> {isSubmitting ? "Saving..." : "Analyze & save"}
              </SecondaryButton>
              {!selectedProductId && (
                <span className="bp-video-action-hint">Select a product to enable analysis.</span>
              )}
            </div>

            <div className={actionData?.error ? "bp-video-status bp-video-status-error" : "bp-video-status"}>
              <strong>
                <Icon name="warning" />{" "}
                {actionData?.error
                  ? "Analysis not saved"
                  : actionData?.savedToLibrary
                  ? "Saved to Creative Library"
                  : actionData?.savedAnalysisId
                    ? "Analysis saved"
                    : aiStatus.configured
                      ? "AI engine mode"
                      : "Demo fallback mode"}
              </strong>
              <p>
                {actionData?.error
                  ? actionData.error
                  : actionData?.savedToLibrary
                  ? "This analysis is now available in Creative Library for this shop."
                  : actionData?.savedAnalysisId
                    ? "This file-grounded analysis is saved to your workspace history."
                    : aiStatus.configured
                  ? "Your configured AI provider can run live analysis for selected products."
                    : "Uploads are analyzed with the BluePrintAI media analyzer when available. If local video tooling is unavailable, the app falls back to metadata and notes."}
              </p>
              {(actionData?.mediaPersistence || analysis?.analysisBasis) && (
                <p>
                  {actionData?.mediaPersistence || analysis?.analysisBasis}
                </p>
              )}
              {actionData?.savedToLibrary && (
                <Link to="/app/creative-library">View in Creative Library</Link>
              )}
            </div>
          </Form>
        </section>

        <section className="bp-video-preview-panel" aria-labelledby="video-preview-title">
          <header className="bp-video-panel-heading">
            <span className="bp-video-panel-icon">
              <Icon name="view" />
            </span>
            <div>
              <h2 id="video-preview-title">Creative preview</h2>
              <p>{selectedProduct ? selectedProduct.title : "Select a product to anchor the read."}</p>
            </div>
          </header>
          <div className="bp-video-preview-frame">
            {previewUrl ? (
              <video src={previewUrl} controls>
                <track
                  kind="captions"
                  label="Uploaded video captions"
                  src="data:text/vtt,WEBVTT%0A"
                />
              </video>
            ) : (
              <div className="bp-video-preview-empty">
                <Icon name="video" />
                <strong>No video selected</strong>
                <p>Upload a clip to preview it here before running analysis.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="bp-video-results-stack">
          {isSubmitting ? (
            <section className="bp-video-result-card">
              <header className="bp-video-panel-heading">
                <span className="bp-video-panel-icon"><Icon name="activity" /></span>
                <div>
                  <h2>Analyzing creative</h2>
                  <p>Reading the upload, product context, and angle notes.</p>
                </div>
              </header>
              <div className="bp-loading-lines" aria-label="Loading analysis">
                <span />
                <span />
                <span />
              </div>
            </section>
          ) : !analysis ? (
            <section className="bp-video-result-card">
              <header className="bp-video-panel-heading">
                <span className="bp-video-panel-icon"><Icon name="video" /></span>
                <div>
                  <h2>Awaiting analysis</h2>
                  <p>Results will appear here after a creative is reviewed.</p>
                </div>
              </header>
              <EmptyState
                icon="video"
                title="No analysis yet"
                body="Choose a product, add a video or notes, then run analysis."
              />
            </section>
          ) : (
            <>
              <div className="bp-video-score-grid">
                {scoreMetrics.map((metric) => (
                  <article className="bp-video-score-card" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}<small>/100</small></strong>
                    <p>{metric.detail}</p>
                  </article>
                ))}
              </div>

              <section className="bp-video-result-card">
                <header className="bp-video-panel-heading">
                  <span className="bp-video-panel-icon"><Icon name="activity" /></span>
                  <div>
                    <h2>Overall assessment</h2>
                    <p>{analysis.mediaAnalyzer?.summary || "AI readout and next best edits."}</p>
                  </div>
                </header>
                <div className="bp-video-assessment">
                  <p>{analysis.pacingNotes}</p>
                  <p>{analysis.firstTenSecondRisk}</p>
                </div>
                <details className="bp-analysis-details">
                  <summary>Analysis basis</summary>
                  <p className="bp-video-muted">{analysis.analysisBasis}</p>
                  {analysis.mediaPersistence && (
                    <p className="bp-video-muted">{analysis.mediaPersistence}</p>
                  )}
                  {analysis.mediaAnalyzer?.available && (
                    <p className="bp-video-muted">
                      Media analyzer: {analysis.mediaAnalyzer.frameCount} frames sampled,
                      {" "}{analysis.mediaAnalyzer.ocrTextCount} OCR text item(s) found.
                    </p>
                  )}
                </details>
              </section>

              <section className="bp-video-insight-grid" aria-label="Video analysis insights">
                {resultGroups.map((group) => (
                  <article className="bp-video-insight-card" key={group.title}>
                    <span>{group.label}</span>
                    <h3>{group.title}</h3>
                    <ul className="bp-video-fix-list">
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${item}`}>
                          <span>{index + 1}</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>
            </>
          )}

          {recentAnalyses.length > 0 && (
            <section className="bp-video-result-card bp-video-recent-card">
              <header className="bp-video-panel-heading">
                <span className="bp-video-panel-icon"><Icon name="list" /></span>
                <div>
                  <h2>Recent analyses</h2>
                  <p>Saved reads for this Shopify workspace.</p>
                </div>
              </header>
              <ul className="bp-compact-list">
                {recentAnalyses.map((item) => (
                  <li key={item.id}>
                    {item.productTitle} - {new Date(item.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </div>
  );
}

function buildScoreMetrics(analysis) {
  const hookScore = Number(analysis.hookScore || 0) * 10;
  const clarityScore = Number(analysis.clarityScore || 0) * 10;
  const ctaScore = Number(analysis.ctaScore || 0) * 10;
  const conversionScore = Math.round((hookScore + clarityScore + ctaScore) / 3);

  return [
    { label: "Hook score", value: hookScore, detail: "Opening pull" },
    { label: "CTA score", value: ctaScore, detail: "Action clarity" },
    { label: "Clarity score", value: clarityScore, detail: "Message focus" },
    {
      label: "Conversion",
      value: conversionScore,
      detail: `${analysis.retentionRisk || "Medium"} retention risk`,
    },
  ];
}

function buildResultGroups(analysis) {
  const analyzer = analysis.mediaAnalyzer || {};
  const strengths = analyzer.strengths?.length
    ? analyzer.strengths
    : [
      "The product context is clear enough to frame the creative around a specific shopper problem.",
      "The angle gives the analysis enough intent to produce focused next edits.",
    ];
  const weaknesses = analyzer.weaknesses?.length
    ? analyzer.weaknesses
    : [
      analysis.firstTenSecondRisk || "The opening needs a faster visual payoff before the viewer scrolls.",
      "The CTA can be made more specific to the product outcome.",
    ];
  const fixes = analysis.rewriteSuggestions?.length
    ? analysis.rewriteSuggestions
    : [
      "Add a product reveal before second 3.",
      "Move the strongest proof point into the opening hook.",
      "Shorten the intro before the first visual payoff.",
    ];

  return [
    { label: "What works", title: "Strengths", items: strengths.slice(0, 3) },
    { label: "Friction", title: "Weaknesses", items: weaknesses.slice(0, 3) },
    { label: "Next edits", title: "Recommended fixes", items: fixes.slice(0, 3) },
  ];
}
