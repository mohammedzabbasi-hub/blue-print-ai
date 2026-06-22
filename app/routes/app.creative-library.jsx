import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
  isDemoAccount,
} from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Creative Library | BluePrintAI" }];
};

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-slate-400 font-bold">{label}</p>
      <p className="text-white text-2xl font-black mt-2">
        {Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

const emptyCreativeForm = {
  title: "",
  product: "",
  creator: "",
  video_file: null,
  video_url: "",
  thumbnail: "",
  insight: "",
  transcript_summary: "",
};

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

function resolveMediaUrl(url) {
  if (!url) return "";

  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE.replace(/\/$/, "")}${url}`;
  }

  return url;
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

export default function CreativeLibraryRoute() {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [demo, setDemo] = useState(false);
  const [shopId, setShopId] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyCreativeForm);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  useEffect(() => {
    setDemo(isDemoAccount());
    setShopId(getSelectedShopId());
  }, []);

  const loadCreatives = useCallback(async () => {
    if (!shopId) return;

    setLoading(true);

    const endpoint = `${API_BASE}/personalized/creatives?shop_id=${encodeURIComponent(
      shopId
    )}`;

    try {
      const res = await fetch(endpoint, {
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.creatives || [];

      setCreatives(newestCreativesFirst(items));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadCreatives().catch((err) => {
      console.error(err);
      setCreatives([]);
      setLoading(false);
    });
  }, [loadCreatives]);

  function updateUploadField(field, value) {
    setUploadForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openUploadForm() {
    setUploadError("");
    setUploadSuccess("");
    setUploadOpen(true);
  }

  function closeUploadForm() {
    if (uploadSaving) return;

    setUploadOpen(false);
    setUploadError("");
  }

  async function submitUpload(event) {
    event.preventDefault();

    if (!shopId) {
      setUploadError("No shop is selected. Please select a shop and try again.");
      return;
    }

    setUploadSaving(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const hasFile = Boolean(uploadForm.video_file);
      const videoUrl = uploadForm.video_url.trim();

      if (!hasFile && !videoUrl) {
        throw new Error("Choose a video file or enter a Video URL.");
      }

      const response = hasFile
        ? await submitFileUpload()
        : await submitUrlUpload(videoUrl);

      if (!response.ok) {
        throw new Error(await getBackendErrorMessage(response));
      }

      setUploadForm(emptyCreativeForm);
      setUploadOpen(false);
      setUploadSuccess("Creative uploaded.");
      await loadCreatives();
    } catch (err) {
      setUploadError(
        err.message || "Could not upload this creative. Please try again."
      );
    } finally {
      setUploadSaving(false);
    }
  }

  function submitFileUpload() {
    const formData = new FormData();

    formData.append("file", uploadForm.video_file);
    formData.append("shop_id", String(Number(shopId)));
    formData.append("title", uploadForm.title.trim());
    formData.append("product", uploadForm.product.trim());
    formData.append("creator", uploadForm.creator.trim());
    formData.append("insight", uploadForm.insight.trim());
    formData.append(
      "transcript_summary",
      uploadForm.transcript_summary.trim()
    );

    return fetch(`${API_BASE}/personalized/creatives/upload`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });
  }

  function submitUrlUpload(videoUrl) {
    const payload = {
      shop_id: Number(shopId),
      title: uploadForm.title.trim(),
      product: uploadForm.product.trim(),
      creator: uploadForm.creator.trim(),
      video_url: videoUrl,
      thumbnail: uploadForm.thumbnail.trim(),
      insight: uploadForm.insight.trim(),
      transcript_summary: uploadForm.transcript_summary.trim(),
      source: "creative_library_upload",
      source_platform: "creative_library_upload",
      type: "creative_library_upload",
      score: 0,
    };

    return fetch(`${API_BASE}/personalized/creatives`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
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
              {demo
                ? "Demo creatives are visible for demo accounts."
                : "Only creatives uploaded or saved to this shop will appear here."}
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

      {(uploadSuccess || uploadError) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            uploadError
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {uploadError || uploadSuccess}
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

          <form onSubmit={submitUpload} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-foreground">
                Title
                <input
                  value={uploadForm.title}
                  onChange={(e) => updateUploadField("title", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Summer launch ad"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Product
                <input
                  value={uploadForm.product}
                  onChange={(e) => updateUploadField("product", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Product name"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Creator
                <input
                  value={uploadForm.creator}
                  onChange={(e) => updateUploadField("creator", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="@creator"
                />
              </label>

              <label className="block text-sm font-semibold text-foreground">
                Video URL
                <input
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
                Video file
                <input
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
                value={uploadForm.insight}
                onChange={(e) => updateUploadField("insight", e.target.value)}
                className="mt-2 min-h-28 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="What should the team remember about this creative?"
              />
            </label>

            <label className="block text-sm font-semibold text-foreground">
              Transcript summary
              <textarea
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
                className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadSaving ? "Uploading..." : "Save Creative"}
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
          </form>
        </div>
      )}

      {loading && <p className="text-muted-foreground">Loading creatives...</p>}

      {!loading && filtered.length === 0 && (
        <EmptyWorkspaceState
          title="No creatives yet"
          description="This new shop has no demo videos. Upload your first TikTok ad or connect shop data to begin building your personalized Creative Library."
          primaryText="Analyze Video"
          primaryLink="/app/video-analysis"
        />
      )}

      {!loading && filtered.length > 0 && (
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
  const videoUrl = resolveMediaUrl(creative.video_url || creative.videoUrl || "");
  const posterUrl = resolveMediaUrl(
    creative.thumbnail || creative.thumbnail_url || ""
  );
  const isUploadedVideo =
    creative.source_platform === "creative_library_upload";

  return (
    <div className="glass rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {videoUrl ? (
        <video
          src={videoUrl}
          poster={posterUrl || undefined}
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
        {isUploadedVideo && (
          <p className="mb-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            Uploaded video
          </p>
        )}

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
          {creative.insight ||
            creative.transcript_summary ||
            "No insight available."}
        </p>

        <Link
          to={`/app/creative-library/${creative.id}`}
          className="inline-block text-primary font-semibold mt-6"
        >
          View creative details →
        </Link>
      </div>
    </div>
  );
}
