import { useMemo, useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import { authenticate } from "../shopify.server";
import { buildImportedCreatives } from "../models/importedData.server";
import { listSavedCreatives, saveCreativeRecord } from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Creative Library | BluePrintAI" }];
};

function Metric({ label, value }) {
  const hasValue = value !== null && value !== undefined;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-slate-400 font-bold">{label}</p>
      <p className="text-white text-2xl font-black mt-2">
        {hasValue ? Number(value).toLocaleString() : "—"}
      </p>
    </div>
  );
}

function normalizeImportedCreative(creative) {
  const insightParts = [];
  if (creative.hookType) insightParts.push(`Hook: ${creative.hookType}`);
  if (creative.platform) insightParts.push(creative.platform);

  return {
    id: creative.id,
    source: "imported",
    title: creative.title,
    product: creative.productTitle,
    creator: creative.creatorHandle,
    views: creative.views,
    likes: creative.likes,
    shares: creative.shares,
    clicks: creative.clicks,
    orders: creative.orders,
    ctr: creative.ctr,
    videoUrl: creative.mediaUrl,
    insight: insightParts.length ? insightParts.join(" · ") : null,
    createdAt: creative.createdAt,
    detailHref: `/app/creative-library/${creative.id}`,
  };
}

function normalizeSavedCreative(creative) {
  return {
    id: creative.id,
    source: "saved",
    title: creative.title,
    product: creative.productTitle,
    creator: creative.angle || "Saved analysis",
    views: null,
    likes: null,
    shares: null,
    clicks: null,
    orders: null,
    ctr: null,
    videoUrl: creative.payload?.mediaUrl || null,
    insight:
      creative.payload?.analysis?.pacingNotes || creative.payload?.brief || null,
    createdAt: creative.createdAt,
    detailHref: `/app/creative-library/${creative.id}`,
  };
}

function newestFirst(creatives) {
  return [...creatives].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || 0) || 0;
    const rightTime = Date.parse(right.createdAt || 0) || 0;

    return rightTime - leftTime;
  });
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [importedCreatives, savedCreatives] = await Promise.all([
    buildImportedCreatives(session.shop),
    listSavedCreatives(session.shop, 50),
  ]);

  const merged = newestFirst([
    ...importedCreatives.map(normalizeImportedCreative),
    ...savedCreatives.map(normalizeSavedCreative),
  ]);

  return { creatives: merged };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = String(formData.get("title") || "").trim();
  const product = String(formData.get("product") || "").trim();
  const creator = String(formData.get("creator") || "").trim();
  const videoUrl = String(formData.get("video_url") || "").trim();
  const thumbnail = String(formData.get("thumbnail") || "").trim();
  const insight = String(formData.get("insight") || "").trim();
  const transcriptSummary = String(
    formData.get("transcript_summary") || "",
  ).trim();

  if (!videoUrl) {
    return { error: "Enter a Video URL to save this creative." };
  }

  await saveCreativeRecord(session.shop, {
    sourceType: "creative_library_upload",
    productId: "manual",
    productTitle: product || "Untitled product",
    title: title || "Untitled Creative",
    angle: creator || "Creative library upload",
    payload: {
      mediaUrl: videoUrl,
      thumbnail,
      insight,
      transcriptSummary,
    },
  });

  return redirect("/app/creative-library");
};

const emptyCreativeForm = {
  title: "",
  product: "",
  creator: "",
  video_url: "",
  thumbnail: "",
  insight: "",
  transcript_summary: "",
};

export default function CreativeLibraryRoute() {
  const { creatives } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyCreativeForm);

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
    if (isSaving) return;
    setUploadOpen(false);
  }

  const filtered = useMemo(() => {
    return creatives.filter((creative) => {
      const text = `${creative.title || ""} ${creative.product || ""} ${
        creative.creator || ""
      }`.toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [creatives, search]);

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
              Only creatives imported from your data or saved to this shop
              will appear here.
            </p>
          </div>

          <button
            type="button"
            onClick={openUploadForm}
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            Upload Creative
          </button>
        </div>
      </div>

      {actionData?.error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {actionData.error}
        </div>
      )}

      {uploadOpen && (
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Upload Creative
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Save a video URL and metadata directly to this shop&apos;s
                Creative Library. Paste a hosted video URL — file upload
                isn&apos;t available in this Shopify app runtime yet.
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

          <Form method="post" className="mt-6 space-y-5">
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
                <input
                  name="product"
                  value={uploadForm.product}
                  onChange={(e) => updateUploadField("product", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Product name"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Creator
                <input
                  name="creator"
                  value={uploadForm.creator}
                  onChange={(e) => updateUploadField("creator", e.target.value)}
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
                  required
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
                disabled={isSaving}
                className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Creative"}
              </button>

              <button
                type="button"
                onClick={closeUploadForm}
                disabled={isSaving}
                className="rounded-lg border border-border-strong bg-surface-2/60 px-5 py-2.5 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {filtered.length === 0 && (
        <EmptyWorkspaceState
          title="No creatives yet"
          description="No creatives yet — import a creatives.csv on the Data Import page, or analyze a video to save your first creative."
          primaryText="Import Data"
          primaryLink="/app/data-import"
          secondaryText="Analyze a Video"
          secondaryLink="/app/video-analysis"
        />
      )}

      {filtered.length > 0 && (
        <>
          <div className="glass rounded-2xl p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creatives..."
              className="w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-8">
            {filtered.map((creative) => (
              <CreativeCard key={creative.id} creative={creative} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CreativeCard({ creative }) {
  const isImported = creative.source === "imported";

  return (
    <div className="glass rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {creative.videoUrl ? (
        <video
          src={creative.videoUrl}
          controls
          className="w-full rounded-2xl bg-black aspect-video object-cover"
        >
          <track kind="captions" />
        </video>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black text-slate-400">
          No video available
        </div>
      )}

      <div>
        <p
          className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
            isImported
              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
              : "border-violet-500/30 bg-violet-500/10 text-violet-200"
          }`}
        >
          {isImported ? "Imported" : "Saved analysis"}
        </p>

        <h2 className="font-display text-3xl font-semibold text-foreground">
          {creative.title || "Untitled Creative"}
        </h2>

        <p className="text-muted-foreground mt-2 text-sm">
          {creative.product || "Product"} · {creative.creator || "Creator"}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-7">
          <Metric label="Views" value={creative.views} />
          <Metric label="Likes" value={creative.likes} />
          <Metric label="Shares" value={creative.shares} />
          <Metric label="Clicks" value={creative.clicks} />
          <Metric label="Orders" value={creative.orders} />
        </div>

        <p className="text-muted-foreground mt-7 text-sm">
          {creative.insight || "No insight available."}
        </p>

        <Link
          to={creative.detailHref}
          className="inline-block text-primary font-semibold mt-6"
        >
          View creative details →
        </Link>
      </div>
    </div>
  );
}
