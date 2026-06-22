import { useState } from "react";
import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
  isDemoAccount,
} from "../lib/accountContext";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { logActivity } from "../services/activityLog";

export const meta = () => {
  return [{ title: "Video Analysis | BluePrintAI" }];
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

async function getBackendErrorMessage(response) {
  const text = await response.text().catch(() => "");

  if (!text) return `Request failed with status ${response.status}.`;

  try {
    const data = JSON.parse(text);
    return data?.detail || data?.error || text;
  } catch {
    return text;
  }
}

function VideoAdBreakdown({ result, file }) {
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("success");
  const payload = result?.result || {};
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

  async function saveToCreativeLibrary() {
    if (typeof window === "undefined") return;

    try {
      setActionMessage("");

      const shopId = getSelectedShopId();
      const demo = isDemoAccount();
      const filename = result?.filename || file?.name || "Uploaded Creative";
      const transcriptSummary =
        transcript.summary ||
        analysis.transcript_summary ||
        transcript.full_text ||
        analysis.summary ||
        "";
      const videoUrl =
        result?.video_url ||
        result?.videoUrl ||
        payload?.video_url ||
        payload?.videoUrl ||
        metadata.video_url ||
        metadata.videoUrl ||
        "";
      const thumbnail =
        result?.thumbnail ||
        result?.thumbnail_url ||
        payload?.thumbnail ||
        payload?.thumbnail_url ||
        metadata.thumbnail ||
        metadata.thumbnail_url ||
        "";
      const sourceMode = demo ? "demo" : "personalized";
      const endpoint = `${API_BASE}/personalized/creatives`;

      const creativePayload = {
        shop_id: shopId,
        title: filename,
        product:
          analysis.product ||
          analysis.product_name ||
          metadata.product ||
          "Uploaded Product",
        creator:
          analysis.creator ||
          analysis.creator_name ||
          analysis.creator_style ||
          "Uploaded Creator",
        video_url: videoUrl,
        videoUrl,
        thumbnail,
        insight:
          analysis.summary ||
          retentionAnalysis.verdict ||
          "Video analysis saved from BluePrintAI.",
        transcript_summary: transcriptSummary,
        hook_score: hookScore,
        cta_score: ctaScore,
        clarity_score: clarityScore,
        score: Math.round((hookScore + ctaScore + clarityScore) / 3),
        impact: impact.level,
        source: "video_analysis",
        source_mode: sourceMode,
        type: "video_analysis",
        analysis,
        full_result: result,
        hook_type: analysis.hook_type,
        creator_type: analysis.creator_type || analysis.creator_style,
        humor_style: analysis.humor_style,
        delivery_style: analysis.delivery_style,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(creativePayload),
      });

      if (!response.ok) {
        throw new Error(await getBackendErrorMessage(response));
      }

      const savedCreative = await response.json().catch(() => null);

      await logActivity(
        "creative_saved",
        "Creative saved to library",
        analysis.summary ||
          "A video analysis was saved to the creative library.",
        {
          creative_id: savedCreative?.creative_id,
          filename,
          shop_id: shopId,
          hook_score: hookScore,
          cta_score: ctaScore,
          clarity_score: clarityScore,
        }
      );

      setActionTone("success");
      setActionMessage("Saved to Creative Library.");
    } catch (err) {
      setActionTone("error");
      setActionMessage(
        err.message || "Could not save this creative. Please try again."
      );
    }
  }

  function generateBlueprint() {
    if (typeof window === "undefined") return;

    try {
      const blueprint = {
        id: Date.now(),
        title: `Blueprint from ${
          result?.filename || file?.name || "Video Analysis"
        }`,
        created_at: new Date().toISOString(),
        main_goal:
          "Improve creative performance and TikTok Shop conversion potential.",
        diagnosis: analysis.summary,
        recommended_tests: [
          rewrite.hook,
          rewrite.cta,
          "Add clearer product-benefit text on screen.",
          "Test a creator voiceover version.",
        ],
        source_analysis: result,
      };

      window.localStorage.setItem(
        "latestVideoBlueprint",
        JSON.stringify(blueprint)
      );

      logActivity(
        "blueprint_generated",
        "Blueprint generated from video analysis",
        analysis.summary || "A blueprint was generated from a video analysis.",
        {
          filename: result?.filename || file?.name,
          recommended_tests: blueprint.recommended_tests,
        }
      );

      setActionTone("success");
      setActionMessage("Blueprint generated from this analysis.");
    } catch {
      setActionTone("error");
      setActionMessage("Could not generate this blueprint. Please try again.");
    }
  }

  function downloadReport() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const report = {
      filename: result?.filename || file?.name,
      generated_at: new Date().toISOString(),
      performance_prediction: impact,
      winning_pattern_match: pattern,
      ad_classification: classification,
      rewrite_this_ad: rewrite,
      analysis,
      metadata,
      transcript,
      detected_text: detectedText,
      retention_analysis: retentionAnalysis,
      full_result: result,
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
            Hook, messaging, visual clarity, CTA strength, format, predicted
            impact, and next-test recommendations.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveToCreativeLibrary}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15"
          >
            Save to Creative Library
          </button>

          <button
            type="button"
            onClick={generateBlueprint}
            className="rounded-xl border border-sky-500/30 bg-sky-500/20 px-4 py-2 font-semibold text-sky-200 hover:bg-sky-500/30"
          >
            Generate Blueprint
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
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setResult(null);
    setError("");
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

  async function handleAnalyze() {
    if (!file) {
      setError("Choose a video file first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/video-analysis/analyze`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Video analysis failed.");
      }

      setResult(data);

      logActivity(
        "video_analysis",
        "Video analysis created",
        data?.result?.analysis?.summary ||
          "A new video creative was analyzed.",
        {
          filename: data?.filename,
          hook_score: data?.result?.analysis?.hook_score,
          cta_score: data?.result?.analysis?.cta_score,
          clarity_score: data?.result?.analysis?.clarity_score,
        }
      );
    } catch (err) {
      setError(err.message || "Video analysis failed.");
    } finally {
      setLoading(false);
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

          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-white/20 p-6">
            <input
              type="file"
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
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="mt-6 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Analyzing video..." : "Analyze Video"}
          </button>

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
        </div>

        {result && <VideoAdBreakdown result={result} file={file} />}
      </div>
    </section>
  );
}
