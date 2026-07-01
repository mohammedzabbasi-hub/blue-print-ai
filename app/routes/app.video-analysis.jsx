import { useEffect, useState } from "react";
import { Form, useActionData, useNavigation, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { analyzeUploadedVideoFile } from "../services/media-analyzer.server";
import { saveVideoAnalysisRecord } from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Video Analysis | BluePrintAI" }];
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "analyze");

  if (intent === "analyze") {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      return { error: "Choose a video file first." };
    }

    const result = await analyzeUploadedVideoFile(file);

    if (!result.available) {
      return {
        error:
          result.message || "Video analysis is unavailable for this file.",
      };
    }

    return { filename: file.name, result };
  }

  if (intent === "save") {
    const fileName = String(formData.get("fileName") || "Uploaded Creative");
    const fileType = String(formData.get("fileType") || "");
    const fileSize = Number(formData.get("fileSize") || 0);
    const analysisJson = String(formData.get("analysis") || "");

    let analysis;
    try {
      analysis = JSON.parse(analysisJson);
    } catch {
      return { saveError: "Could not read this analysis. Please re-analyze the video." };
    }

    const slug =
      fileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "video";

    try {
      await saveVideoAnalysisRecord({
        shop: session.shop,
        product: { id: `local-${slug}`, title: fileName },
        fileName,
        fileType,
        fileSize,
        brief: analysis?.summary || "",
        analysis,
        savedToLibrary: true,
      });

      return { saved: true };
    } catch (err) {
      return {
        saveError:
          err?.message || "Could not save this creative. Please try again.",
      };
    }
  }

  return { error: "No action was selected." };
};

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
        "Strong hook, clear message, and CTA give this creative stronger conversion potential.",
    };
  }

  if (avg >= 4) {
    return {
      level: "Medium",
      reason:
        "The creative has some usable elements, but weak clarity or CTA may limit TikTok Shop conversions.",
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

function VideoAdBreakdown({ filename, result }) {
  const saveFetcher = useFetcher();
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("success");

  const analysis = result?.analysis || {};
  const metadata = result?.metadata || {};
  const transcript = result?.transcript || {};
  const ocrText = result?.ocr_text || [];

  const hookScore = Number(analysis.hook_score || 0);
  const ctaScore = Number(analysis.cta_score || 0);
  const clarityScore = Number(analysis.clarity_score || 0);

  const impact = predictImpact(analysis);
  const pattern = getWinningPattern(analysis);
  const classification = getAdClassification(analysis, metadata);

  const detectedText = ocrText
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 5)
    .join(" | ");

  useEffect(() => {
    if (saveFetcher.state !== "idle" || !saveFetcher.data) return;

    if (saveFetcher.data.saved) {
      setActionTone("success");
      setActionMessage("Saved to Creative Library.");
    } else if (saveFetcher.data.saveError) {
      setActionTone("error");
      setActionMessage(saveFetcher.data.saveError);
    }
  }, [saveFetcher.state, saveFetcher.data]);

  function downloadReport() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const report = {
      filename,
      generated_at: new Date().toISOString(),
      performance_prediction: impact,
      winning_pattern_match: pattern,
      ad_classification: classification,
      analysis,
      metadata,
      transcript,
      detected_text: detectedText,
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

  const isSaving = saveFetcher.state !== "idle";

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
            Hook, messaging, visual clarity, CTA strength, format, predicted
            impact, and next-test recommendations.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <saveFetcher.Form method="post">
            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="fileName" value={filename || ""} />
            <input
              type="hidden"
              name="analysis"
              value={JSON.stringify(analysis)}
            />
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save to Creative Library"}
            </button>
          </saveFetcher.Form>

          <button
            type="button"
            onClick={downloadReport}
            className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400"
          >
            Download Report
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Performance Prediction"
          subtitle="Predicted TikTok Shop impact"
          accent
        >
          <p className="text-3xl font-black text-white">{impact.level}</p>
          <p className="mt-3">{impact.reason}</p>
        </SectionCard>

        <SectionCard
          title="Winning Pattern Match"
          subtitle="How close this ad is to a winning creative"
        >
          <p>
            <strong>Matches Winning Pattern:</strong> {pattern.matches}
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

        <SectionCard title="CTA Effectiveness" subtitle="Conversion prompt strength">
          <p>
            CTA score: <strong>{ctaScore}/10</strong>.{" "}
            {ctaScore >= 7
              ? "The next step is clear."
              : "The ad should clearly tell the viewer what to do next."}
          </p>
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
              ? `${Number(metadata.duration_seconds).toFixed(1)} seconds`
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
  const actionData = useActionData();
  const navigation = useNavigation();
  const [file, setFile] = useState(null);
  const [warning, setWarning] = useState("");

  const isAnalyzing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") !== "save";

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

  const result = actionData?.result;
  const filename = actionData?.filename;
  const error = actionData?.error;

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

          <Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="analyze" />

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-white/20 p-6">
              <input
                type="file"
                name="file"
                accept="video/*"
                onChange={handleFileChange}
                className="text-slate-300"
              />

              <p className="text-sm text-slate-400">
                {file?.name || "No file selected"}
              </p>
            </div>

            {warning && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                {warning}
              </div>
            )}

            <button
              type="submit"
              disabled={isAnalyzing}
              className="mt-6 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 py-3 font-bold text-white disabled:opacity-60"
            >
              {isAnalyzing ? "Analyzing video..." : "Analyze Video"}
            </button>
          </Form>

          {isAnalyzing && (
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
        </div>

        {result && <VideoAdBreakdown filename={filename} result={result} />}
      </div>
    </section>
  );
}
