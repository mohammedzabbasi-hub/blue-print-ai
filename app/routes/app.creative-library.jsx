import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  deleteCreativePerformanceRecord,
  deleteVideoAnalysisRecord,
  deleteSavedCreative,
  getWorkspaceProfile,
  resolveProductContext,
} from "../models/blueprint.server";
import {
  hasPerformanceMetrics,
  listCreativePerformance,
  platformLabel,
  saveManualCreativePerformance,
} from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { generateCreativeTitleAndSummary } from "../utils/creative-display.server";
import { persistUploadedVideoFile } from "../utils/upload-storage.server";
import { assertUploadRequestSize } from "../utils/upload-storage.server";
import { assignCampaignRecords, listCampaigns } from "../models/campaign.server";

export const meta = () => {
  return [{ title: "Creative Library | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const url = new URL(request.url);
  const [performance, profile, campaigns] = await Promise.all([
    listCreativePerformance({
      merchantData,
      shop: session.shop,
    }),
    getWorkspaceProfile(session.shop),
    listCampaigns(session.shop),
  ]);

  return {
    creatives: performance.records
      .filter((record) => record.sourceRecordType !== "creator_performance_import")
      .map(toCreativeCard),
    campaigns: campaigns.map(({ id, name }) => ({ id, name })),
    deleted: url.searchParams.get("deleted") === "1",
    hasDemoPerformanceData: performance.hasDemoPerformanceData,
    hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
    integrationStatuses: performance.integrationStatuses,
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products,
    selectedProductId: profile.selectedProductId || merchantData.products[0]?.id || "",
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  assertUploadRequestSize(request);
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");

  if (intent === "assignCampaign") {
    const campaignId = String(formData.get("campaignId") || "");
    const recordId = String(formData.get("recordId") || "");
    const recordType = String(formData.get("recordType") || "");
    try {
      await assignCampaignRecords(session.shop, campaignId, {
        savedCreativeIds: recordType === "saved_creative" ? [recordId] : [],
        creativePerformanceIds: recordType === "saved_creative" ? [] : [recordId],
      });
      return { success: "Creative campaign updated." };
    } catch (error) {
      return { error: error.message || "Could not assign campaign." };
    }
  }

  if (intent === "deleteCreative" || intent === "delete") {
    const recordId = String(
      formData.get("recordId") || formData.get("creativeId") || "",
    ).trim();
    const recordType = String(formData.get("recordType") || "saved_creative").trim();

    if (!recordId) {
      return { error: "Choose a creative record to delete.", ok: false };
    }

    if (!["creative_performance", "saved_creative", "video_analysis"].includes(recordType)) {
      return {
        error: "This creative source cannot be deleted from the Creative Library.",
        ok: false,
      };
    }

    try {
      const deleted =
        recordType === "video_analysis"
          ? await deleteVideoAnalysisRecord(session.shop, recordId)
          : recordType === "creative_performance"
            ? await deleteCreativePerformanceRecord(session.shop, recordId)
          : await deleteSavedCreative(session.shop, recordId);

      if (!deleted) {
        return {
          error: "Creative was not found for this Shopify workspace.",
          ok: false,
        };
      }

      return {
        deletedDisplayId: String(formData.get("displayId") || recordId),
        deletedRecordId: recordId,
        deletedRecordType: recordType,
        ok: true,
        success: "Creative removed from this workspace.",
      };
    } catch (error) {
      return {
        error: error.message || "Could not remove this creative.",
        ok: false,
      };
    }
  }

  if (intent !== "save") {
    return { error: "Unknown Creative Library action." };
  }

  const videoFile = formData.get("video_file");
  const videoUrl = String(formData.get("video_url") || "").trim();
  if (!videoUrl && (!videoFile || !videoFile.name || !videoFile.size)) {
    return { error: "Choose a video file or enter a video URL before saving." };
  }
  const productTitle = String(formData.get("product") || "").trim() || "Uploaded Product";
  const profile = await getWorkspaceProfile(session.shop);
  const product =
    resolveProductContext(
      merchantData.products,
      profile,
      String(formData.get("productId") || ""),
    ) ||
    {
      id: `manual-product-${slugify(productTitle)}`,
      title: productTitle,
    };

  try {
    const storedVideo = videoUrl
      ? null
      : await persistUploadedVideoFile(videoFile, {
          namespace: "creative-library",
          shop: session.shop,
        });
    const mediaUrl = videoUrl || storedVideo?.mediaUrl || "";
    const providedTitle = String(formData.get("title") || "").trim();
    const providedInsight = String(formData.get("insight") || "").trim();
    const originalFilename = storedVideo?.originalName || videoFile?.name || "";
    const display = generateCreativeTitleAndSummary({
      productTitle: product.title || productTitle,
      fileName: originalFilename,
      preferredTitle: providedTitle,
      preferredSummary: providedInsight,
    });
    const title = display.displayTitle;
    const sourceId = videoUrl
      ? videoUrl
      : storedVideo?.fingerprint
        ? `upload:${storedVideo.fingerprint}`
        : videoFile?.name
          ? `${videoFile.name}:${videoFile.size || 0}:${videoFile.type || ""}`
        : null;
    const saved = await saveManualCreativePerformance({
      shop: session.shop,
      product: {
        id: product.id,
        title: product.title || productTitle,
      },
      fields: {
        angle: String(formData.get("angle") || display.summary || "").trim(),
        clicks: formData.get("clicks"),
        conversionRate: formData.get("conversionRate"),
        creativeTitle: title,
        creatorHandle: String(formData.get("creatorHandle") || "").trim(),
        creatorName: String(
          formData.get("creatorName") || formData.get("creator") || "",
        ).trim(),
        cta: String(formData.get("cta") || "").trim(),
        hook: String(formData.get("hook") || "").trim(),
        impressions: formData.get("impressions"),
        orders: formData.get("orders"),
        revenue: formData.get("revenue"),
        roas: formData.get("roas"),
        sourceCreativeId: sourceId,
        sourcePlatform: String(formData.get("sourcePlatform") || "manual"),
        spend: formData.get("spend"),
        thumbnailUrl: String(formData.get("thumbnail") || "").trim(),
        transcript: String(formData.get("transcript_summary") || "").trim(),
        videoUrl: mediaUrl,
        views: formData.get("views"),
      },
    });

    return {
      creative: toCreativeCard(saved),
      success: saved.wasCreated
        ? "Saved to Creative Library."
        : "Saved to Creative Library already.",
    };
  } catch (error) {
    return { error: error.message || "Could not save this creative." };
  }
};

function Metric({ label, value }) {
  const numeric = Number(value || 0);
  const displayValue =
    typeof value === "number" || (Number.isFinite(numeric) && value !== "")
      ? numeric.toLocaleString()
      : value || "0";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-slate-400 font-bold">{label}</p>
      <p className="mt-2 break-words text-2xl font-black leading-tight text-white">
        {displayValue}
      </p>
    </div>
  );
}

function PlanningMetricGrid({ creative }) {
  const metrics = [
    ["Hook", creative.hookScore],
    ["Clarity", creative.clarityScore],
    ["CTA", creative.ctaScore],
    ["Readiness", creative.readinessScore],
  ];

  return (
    <div>
      <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        AI-estimated planning indicators
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={value} />
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        These values come from saved app metadata or uploaded analysis results.
        They are not imported views, clicks, orders, revenue, or live TikTok
        performance.
      </p>
    </div>
  );
}

const emptyCreativeForm = {
  angle: "",
  clicks: "",
  conversionRate: "",
  creatorHandle: "",
  creatorName: "",
  cta: "",
  hook: "",
  impressions: "",
  orders: "",
  revenue: "",
  roas: "",
  sourcePlatform: "manual",
  spend: "",
  title: "",
  product: "",
  creator: "",
  video_file: null,
  video_url: "",
  thumbnail: "",
  insight: "",
  transcript_summary: "",
};

function resolveMediaUrl(url) {
  if (!url) return "";

  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  return url;
}

function isPlayableVideoUrl(url) {
  const normalized = String(url || "").trim().split(/[?#]/)[0].toLowerCase();

  return [".mp4", ".mov", ".m4v", ".webm"].some((extension) =>
    normalized.endsWith(extension),
  );
}

function getCreativeTime(creative) {
  const rawDate =
    creative.created_at ||
    creative.createdAt ||
    creative.uploaded_at ||
    creative.uploadedAt ||
    "";
  const timestamp = rawDate ? Date.parse(rawDate) : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function newestCreativesFirst(creatives) {
  return [...creatives].sort((left, right) => {
    const timeDifference = getCreativeTime(right) - getCreativeTime(left);

    if (timeDifference !== 0) return timeDifference;

    return Number(right.id || 0) - Number(left.id || 0);
  });
}

function toCreativeCard(record) {
  const recordType = record.storageRecordType || "";
  const recordId =
    record.storageRecordId ||
    (recordType === "video_analysis"
      ? String(record.id || "").replace(/^analysis-/, "")
      : record.id);

  return {
    id: record.id,
    canDelete: ["creative_performance", "saved_creative", "video_analysis"].includes(recordType),
    title: record.creativeTitle,
    product: record.productTitle,
    creator: record.creatorHandle || record.creatorName || "Manual Creator",
    video_url: record.videoUrl,
    fileName: record.videoFilename,
    source_url: record.sourceUrl,
    asset_url: record.assetUrl,
    thumbnail: record.thumbnailUrl,
    insight: safeCreativeText(record.angle || record.hook || record.transcript),
    transcript_summary: safeCreativeText(record.transcript),
    hook: record.hook,
    cta: record.cta,
    angle: record.angle,
    clarityScore: record.clarityScore,
    clicks: record.clicks,
    comments: record.comments,
    conversionRate: record.conversionRate,
    cpc: record.cpc,
    cpm: record.cpm,
    ctaScore: record.ctaScore,
    ctr: record.ctr,
    videoCompletionRate: record.videoCompletionRate,
    videoViews: record.videoViews,
    engagementCount: record.engagementCount,
    engagementRate: record.engagementRate,
    hookScore: record.hookScore,
    readinessScore: record.creativeScore,
    impressions: record.impressions,
    importSource: record.importSource,
    likes: record.likes,
    orders: record.orders,
    conversions: record.conversions,
    conversionValue: record.conversionValue,
    reposts: record.reposts,
    revenue: record.revenue,
    roas: record.roas,
    saves: record.saves,
    shares: record.shares,
    spend: record.spend,
    views: record.views,
    video100PercentWatched: record.video100PercentWatched,
    createdAt: record.firstSeenAt,
    source_platform: record.sourcePlatform,
    recordId,
    campaignRecordId: record.id,
    recordType,
    sourceLabel:
      record.importSource === "creative_upload_performance_import"
        ? "Imported creative + performance"
        : platformLabel(record.sourcePlatform),
    syncStatus: record.syncStatus,
    hasPerformanceMetrics: hasPerformanceMetrics(record),
    isDemoPerformanceData: record.sourcePlatform === "shopify_demo",
    campaignId: record.workspaceCampaignId || "",
    campaignName: record.workspaceCampaignName || "",
  };
}

function safeCreativeText(value = "") {
  const text = String(value || "").trim();

  if (/api[_ -]?key|not configured|stack trace|\bat .+\(.+:\d+:\d+\)|gemini/i.test(text)) {
    return "";
  }

  return text;
}

function CreativePreview({ creative, compact = false }) {
  const candidate =
    creative.video_url || creative.videoUrl || creative.asset_url ||
    creative.assetUrl || creative.source_url || creative.sourceUrl || "";
  const initialVideoUrl = isPlayableVideoUrl(candidate) ? resolveMediaUrl(candidate) : "";
  const [previewFailed, setPreviewFailed] = useState(false);
  const posterUrl = resolveMediaUrl(creative.thumbnail || creative.thumbnail_url || "");

  useEffect(() => setPreviewFailed(false), [initialVideoUrl, posterUrl]);

  if (initialVideoUrl && !previewFailed) {
    return (
      <video
        className={`aspect-video w-full rounded-2xl bg-black ${compact ? "object-contain" : "object-cover"}`}
        controls
        onError={() => setPreviewFailed(true)}
        poster={posterUrl || undefined}
        preload="metadata"
        src={initialVideoUrl}
      >
        <track kind="captions" />
      </video>
    );
  }

  if (posterUrl && !previewFailed) {
    return <img alt={creative.title || "Creative thumbnail"} className="aspect-video w-full rounded-2xl bg-black object-cover" src={posterUrl} onError={() => setPreviewFailed(true)} />;
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-slate-800 bg-black p-6 text-center text-slate-400">
      <span className="font-semibold text-slate-200">Preview unavailable</span>
      <span className="mt-2 max-w-full truncate text-sm">
        {safeCreativeText(creative.fileName) || safeCreativeText(creative.product) || safeCreativeText(creative.title) || "Creative media"}
      </span>
    </div>
  );
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "product";
}

export default function CreativeLibraryRoute() {
  const {
    campaigns,
    creatives: loaderCreatives,
    deleted,
    productError,
    products,
    selectedProductId,
    shop,
  } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const actionData = useActionData();
  const uploadFetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [deletedCreativeIds, setDeletedCreativeIds] = useState([]);
  const [selectedCreativeId, setSelectedCreativeId] = useState(() =>
    new URLSearchParams(location.search).get("creativeId"),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyCreativeForm);
  const uploadSaving = uploadFetcher.state !== "idle";
  const uploadError = uploadFetcher.data?.error || "";
  const uploadSuccess = uploadFetcher.data?.success || "";
  const actionError = actionData?.error || "";
  const actionSuccess =
    actionData?.success ||
    (deleted ? "Creative removed from library." : "");

  useEffect(() => {
    if (!uploadFetcher.data?.success) return;
    setUploadForm(emptyCreativeForm);
    setUploadOpen(false);
  }, [uploadFetcher.data]);

  useEffect(() => {
    const creativeId = new URLSearchParams(location.search).get("creativeId");

    if (creativeId) setSelectedCreativeId(creativeId);
  }, [location.search]);

  function updateUploadField(field, value) {
    setUploadForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openUploadForm() {
    setUploadOpen(true);
  }

  function closeUploadForm() {
    if (uploadSaving) return;

    setUploadOpen(false);
  }

  function markCreativeDeleted(creativeId) {
    setDeletedCreativeIds((current) =>
      current.includes(creativeId) ? current : [...current, creativeId],
    );
  }

  const creatives = newestCreativesFirst(
    uploadFetcher.data?.creative
      ? [
          uploadFetcher.data.creative,
          ...loaderCreatives.filter(
            (creative) => creative.id !== uploadFetcher.data.creative.id,
          ),
        ]
      : loaderCreatives,
  ).filter((creative) => !deletedCreativeIds.includes(creative.id));

  const visibleCreatives = creatives.filter(
    (creative) => !deletedCreativeIds.includes(creative.id),
  );

  const filtered = useMemo(() => {
    return visibleCreatives.filter((creative) => {
      const text = `${creative.title || ""} ${creative.product || ""} ${
        creative.creator || ""
      }`.toLowerCase();

      return text.includes(search.toLowerCase()) &&
        (campaignFilter === "all" ||
          (campaignFilter === "unassigned" ? !creative.campaignId : creative.campaignId === campaignFilter));
    });
  }, [campaignFilter, visibleCreatives, search]);
  const selectedCreative = creatives.find(
    (creative) =>
      String(creative.id) === String(selectedCreativeId) ||
      String(creative.recordId) === String(selectedCreativeId),
  );
  const requestedCreativeMissing = Boolean(selectedCreativeId && !selectedCreative);

  function closeCreativeDetails() {
    setSelectedCreativeId(null);
    const query = new URLSearchParams(location.search);
    query.delete("creativeId");
    navigate(query.size ? `${location.pathname}?${query}` : location.pathname, {
      replace: true,
    });
  }

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
              Creative Intelligence
            </p>

            <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
              Creative Library
            </h1>

            <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
              Only creatives uploaded or saved to {shop} will appear here.
            </p>
          </div>

          <button
            type="button"
            onClick={openUploadForm}
            className="bp-primary-cta"
          >
            Upload Creative
          </button>
        </div>
      </div>

      {(uploadSuccess || uploadError || actionSuccess || actionError) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            uploadError || actionError
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {uploadError || actionError || uploadSuccess || actionSuccess}
        </div>
      )}

      {requestedCreativeMissing && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100" role="status">
          <h2 className="font-display text-xl font-semibold">Creative detail unavailable</h2>
          <p className="mt-2 text-sm leading-6">
            This creative does not exist in this shop, or it was removed. The rest of
            the Creative Library is still available.
          </p>
          <button type="button" className="bp-primary-cta mt-4" onClick={closeCreativeDetails}>
            Back to Creative Library
          </button>
        </section>
      )}

      {uploadOpen && (
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Upload Creative
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Save a video URL and metadata directly to this shop&apos;s Creative
                Library.
              </p>
            </div>

            <button
              type="button"
              onClick={closeUploadForm}
              className="rounded-lg border border-border-strong bg-surface-2/60 px-4 py-2 text-sm font-semibold text-foreground"
            >
              Close
            </button>
          </div>

          <uploadFetcher.Form method="post" encType="multipart/form-data" className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-foreground">
                Title
                <input
                  name="title"
                  value={uploadForm.title}
                  onChange={(e) => updateUploadField("title", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Summer launch ad"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Product
                {products.length > 0 ? (
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
                ) : (
                  <input
                    name="product"
                    value={uploadForm.product}
                    onChange={(e) => updateUploadField("product", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Product name"
                  />
                )}
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Platform
                <select
                  name="sourcePlatform"
                  value={uploadForm.sourcePlatform}
                  onChange={(e) =>
                    updateUploadField("sourcePlatform", e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground"
                >
                  <option value="manual">Manual Upload</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="tiktok_ads">TikTok Ads</option>
                  <option value="tiktok_shop">TikTok Shop Affiliate</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Creator name
                <input
                  name="creatorName"
                  value={uploadForm.creatorName}
                  onChange={(e) => updateUploadField("creatorName", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Creator or account name"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Creator handle
                <input
                  name="creatorHandle"
                  value={uploadForm.creatorHandle}
                  onChange={(e) =>
                    updateUploadField("creatorHandle", e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="@creator"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Video URL
                <input
                  name="video_url"
                  value={uploadForm.video_url}
                  onChange={(e) =>
                    updateUploadField("video_url", e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="https://..."
                  type="url"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground md:col-span-2">
                Hook
                <input
                  name="hook"
                  value={uploadForm.hook}
                  onChange={(e) => updateUploadField("hook", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="First line or opening moment"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                CTA
                <input
                  name="cta"
                  value={uploadForm.cta}
                  onChange={(e) => updateUploadField("cta", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Shop now"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Angle
                <input
                  name="angle"
                  value={uploadForm.angle}
                  onChange={(e) => updateUploadField("angle", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Problem-solution, proof, offer, objection"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground md:col-span-2">
                Video file
                <input
                  name="video_file"
                  accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                  onChange={(e) =>
                    updateUploadField("video_file", e.target.files?.[0] || null)
                  }
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  type="file"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground md:col-span-2">
                Thumbnail URL
                <input
                  name="thumbnail"
                  value={uploadForm.thumbnail}
                  onChange={(e) =>
                    updateUploadField("thumbnail", e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="https://..."
                  type="url"
                />
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">
                Optional performance metrics
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ["spend", "Spend"],
                  ["impressions", "Impressions"],
                  ["views", "Views"],
                  ["clicks", "Clicks"],
                  ["orders", "Orders"],
                  ["revenue", "Revenue"],
                  ["roas", "ROAS"],
                  ["conversionRate", "Conversion rate"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    {label}
                    <input
                      name={name}
                      value={uploadForm[name]}
                      onChange={(e) => updateUploadField(name, e.target.value)}
                      className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      min="0"
                      step="any"
                      type="number"
                    />
                  </label>
                ))}
              </div>
            </div>

            {productError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
                Shopify products could not be loaded right now. Manual product
                context still works.
              </div>
            )}

            {!productError && products.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm font-semibold text-slate-200">
                No Shopify products found yet. Add products in Shopify or enter
                product context manually.
              </div>
            )}

            <label className="block text-sm font-semibold text-foreground">
              Insight / notes
              <textarea
                name="insight"
                value={uploadForm.insight}
                onChange={(e) => updateUploadField("insight", e.target.value)}
                className="mt-2 min-h-28 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="What should the team remember about this creative?"
              />
            </label>

            <label className="block text-sm font-semibold text-foreground">
              Transcript summary
              <textarea
                name="transcript_summary"
                value={uploadForm.transcript_summary}
                onChange={(e) =>
                  updateUploadField("transcript_summary", e.target.value)
                }
                className="mt-2 min-h-28 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Short summary of the spoken script or creative structure."
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={uploadSaving}
                className="bp-primary-cta"
            >
                {uploadSaving ? "Saving..." : "Save Creative"}
              </button>

              <button
                type="button"
                onClick={closeUploadForm}
                disabled={uploadSaving}
                className="rounded-lg border border-border-strong bg-surface-2/60 px-5 py-2.5 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </uploadFetcher.Form>
        </div>
      )}

      {visibleCreatives.length === 0 && (
        <EmptyWorkspaceState
          title="No creatives yet"
          description="Upload a creative, use the analyzer when configured, or import CSV performance data to begin building this shop's Creative Library. Optional read-only Google Ads reporting is available when configured and authorized; TikTok Ads and Meta Ads are not currently available. CSV import remains available without connecting Google Ads."
          primaryText="Open Review Studio"
          primaryLink="/app/video-analysis"
          secondaryText="Import CSV Data"
          secondaryLink="/app/data-import"
        />
      )}

      {visibleCreatives.length > 0 && (
        <>
          <div className="glass grid gap-3 rounded-2xl p-3 md:grid-cols-[1fr_260px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creatives..."
              className="w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground">
              <option value="all">All campaigns</option>
              <option value="unassigned">Unassigned</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </div>

          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                No creatives match these filters
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose All campaigns, select another campaign, or adjust your search.
              </p>
            </div>
          )}

          <div className="space-y-8">
            {filtered.map((creative) => (
              <CreativeCard
                key={creative.id}
                creative={creative}
                campaigns={campaigns}
                onDeleted={markCreativeDeleted}
                onViewDetails={() => setSelectedCreativeId(creative.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectedCreative && (
        <CreativeDetailsModal
          creative={selectedCreative}
          onClose={closeCreativeDetails}
        />
      )}
    </div>
  );
}

function CreativeCard({ campaigns, creative, onDeleted, onViewDetails }) {
  const deleteFetcher = useFetcher();
  const videoCandidate =
    creative.video_url ||
    creative.videoUrl ||
    creative.asset_url ||
    creative.assetUrl ||
    creative.source_url ||
    creative.sourceUrl ||
    "";
  const sourceUrl = resolveMediaUrl(
    creative.source_url || creative.sourceUrl || videoCandidate,
  );
  const isUploadedVideo =
    creative.source_platform === "manual" && Boolean(creative.video_url);
  const isImportedExternalSource =
    creative.importSource === "public_engagement_import" &&
    Boolean(sourceUrl) &&
    !isPlayableVideoUrl(videoCandidate);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleting =
    deleteFetcher.state !== "idle" &&
    deleteFetcher.formData?.get("intent") === "deleteCreative";
  const deleteError = deleteFetcher.data?.error || "";

  useEffect(() => {
    if (!deleteFetcher.data?.ok) return;
    onDeleted?.(creative.id);
  }, [creative.id, deleteFetcher.data, onDeleted]);

  return (
    <div className="glass rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {isImportedExternalSource ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-black p-6 text-center text-slate-400">
          <span className="font-semibold text-slate-200">External source link</span>
          <a className="mt-4 inline-flex rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100" href={sourceUrl} rel="noreferrer" target="_blank">Open source post</a>
        </div>
      ) : <CreativePreview creative={creative} />}

      <div>
        {isUploadedVideo && (
          <p className="mb-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            Uploaded video
          </p>
        )}

        <p className="mb-3 inline-flex rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
          {creative.sourceLabel}
        </p>

        <h2 className="font-display text-3xl font-semibold text-foreground">
          {creative.title || "Untitled Creative"}
        </h2>

        <p className="text-muted-foreground mt-2 text-sm">
          {creative.product || "Product"} · {creative.creator || "Creator"}
        </p>

        <p className="mt-3 text-sm font-semibold text-cyan-200">
          Campaign: {creative.campaignName || "Unassigned"}
        </p>

        {campaigns.length ? <Form method="post" className="mt-3 flex max-w-lg gap-2">
          <input type="hidden" name="intent" value="assignCampaign" />
          <input type="hidden" name="recordId" value={creative.campaignRecordId} />
          <input type="hidden" name="recordType" value={creative.recordType} />
          <select name="campaignId" defaultValue={creative.campaignId || campaigns[0]?.id} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <button className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-200" type="submit">{creative.campaignId ? "Move" : "Assign"}</button>
        </Form> : <Link to="/app/campaigns#create-campaign" className="mt-3 inline-flex text-sm font-bold text-cyan-300">Create a campaign to assign →</Link>}

        {creative.isDemoPerformanceData && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-100">
            Demo performance data
          </p>
        )}

        <p className="text-muted-foreground mt-7 text-sm">
          {creative.insight ||
            creative.transcript_summary ||
            "No insight available."}
        </p>

        {creative.fileName && creative.fileName !== creative.title && (
          <p className="mt-3 max-w-full truncate text-xs text-slate-500">
            Original file: {creative.fileName}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-block bg-transparent p-0 text-left font-semibold text-primary"
          >
            View creative details →
          </button>

          {!creative.canDelete ? null : confirmingDelete ? (
            <deleteFetcher.Form method="post" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              <input name="intent" type="hidden" value="deleteCreative" />
              <input name="displayId" type="hidden" value={creative.id} />
              <input name="recordId" type="hidden" value={creative.recordId} />
              <input name="recordType" type="hidden" value={creative.recordType} />
              <span className="w-full text-xs font-semibold text-red-100 sm:w-auto">
                Remove this creative from BluePrintAI? External ad platform data will not be deleted.
              </span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-border-strong bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deleting}
                className="rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Confirm delete"}
              </button>
            </deleteFetcher.Form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-lg border border-red-500/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>

        {deleteError && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-100">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}

function CreativeDetailsModal({ creative, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="creative-details-title"
        aria-modal="true"
        className="glass-strong relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-cyan-400/20 p-5 shadow-2xl shadow-cyan-950/40 sm:p-7"
        role="dialog"
      >
        <button
          aria-label="Close creative details"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/80 text-xl text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
          onClick={onClose}
          type="button"
        >
          ×
        </button>

        <div className="pr-12">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
            {creative.sourceLabel || "Creative details"}
          </p>
          <h2
            className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl"
            id="creative-details-title"
          >
            {creative.title || "Untitled Creative"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {creative.product || "Product"} · {creative.creator || "Creator"}
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <CreativePreview compact creative={creative} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <CreativeDetailValue label="Campaign" value={creative.campaignName || "Unassigned"} />
              <CreativeDetailValue label="Hook" value={creative.hook || "Not available"} />
              <CreativeDetailValue label="CTA" value={creative.cta || "Not available"} />
              <CreativeDetailValue label="Angle" value={creative.angle || "Not available"} />
            </div>
          </div>

          <div className="min-w-0">
            {creative.isDemoPerformanceData && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-100">
                Demo performance data
              </p>
            )}

            <PerformanceMetricGrid creative={creative} />

            {!creative.hasPerformanceMetrics && (
              <PlanningMetricGrid creative={creative} />
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Insight
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {creative.insight ||
              creative.transcript_summary ||
              "No insight available."}
          </p>
        </div>
      </section>
    </div>
  );
}

function CreativeDetailValue({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function PerformanceMetricGrid({ creative }) {
  const metrics = [
    ["Spend", formatOptionalCurrency(creative.spend)],
    ["Revenue", formatOptionalCurrency(creative.revenue ?? creative.conversionValue)],
    ["ROAS", formatOptionalRate(creative.roas, "x")],
    ["Impressions", formatOptionalNumber(creative.impressions)],
    ["Clicks", formatOptionalNumber(creative.clicks)],
    ["Orders / conv.", formatOptionalNumber(creative.orders ?? creative.conversions)],
    ["CTR", formatOptionalRate(creative.ctr, "%")],
    ["CVR", formatOptionalRate(creative.conversionRate, "%")],
    ["Video views", formatOptionalNumber(creative.videoViews ?? creative.views)],
    ["Completion", formatOptionalRate(creative.videoCompletionRate ?? creative.video100PercentWatched, "%")],
    ["Engagement", hasOptionalValue(creative.engagementRate) ? formatOptionalRate(creative.engagementRate, "%") : formatOptionalNumber(creative.engagementCount)],
    ["Likes", formatOptionalNumber(creative.likes)],
    ["Comments", formatOptionalNumber(creative.comments)],
    ["Shares", formatOptionalNumber(creative.shares)],
    ["Sync / import status", formatSyncStatus(creative.syncStatus || creative.importSource || creative.source_platform)],
  ];

  return (
    <div>
      <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        Performance metrics
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function hasOptionalValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatOptionalCurrency(value) {
  return hasOptionalValue(value) ? formatCurrency(value) : "Not imported";
}

function formatOptionalNumber(value) {
  return hasOptionalValue(value) ? formatNumber(value) : "Not imported";
}

function formatOptionalRate(value, suffix) {
  return hasOptionalValue(value) ? `${Number(value).toFixed(2)}${suffix}` : "Not imported";
}

function formatSyncStatus(value = "") {
  const labels = {
    analysis_only: "Analysis only",
    imported_public_engagement: "Imported public engagement",
    manual: "Manual",
    manual_entry: "Manual entry",
    saved_in_app: "Saved in app",
  };
  const key = String(value || "").trim();

  return labels[key] || key.replace(/_/g, " ") || "Manual";
}
