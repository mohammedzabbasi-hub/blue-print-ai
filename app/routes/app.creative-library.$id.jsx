import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { findImportedCreative } from "../models/importedData.server";
import { findSavedCreative } from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Creative Detail | BluePrintAI" }];
};

function formatMetric(value) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "—";
}

function normalizeImportedCreative(creative) {
  const tags = [];
  if (creative.hookType) tags.push({ label: creative.hookType });
  if (creative.platform) tags.push({ label: creative.platform });

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
    tags,
  };
}

function normalizeSavedCreative(creative) {
  const analysis = creative.payload?.analysis || {};
  const tags = [];

  if (analysis.hookType) tags.push({ label: analysis.hookType });
  if (analysis.retentionRisk) {
    tags.push({ label: `Retention risk: ${analysis.retentionRisk}` });
  }
  if (creative.angle) tags.push({ label: creative.angle });

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
    tags,
  };
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);

  const imported = await findImportedCreative(session.shop, params.id);
  if (imported) {
    return { creative: normalizeImportedCreative(imported) };
  }

  const saved = await findSavedCreative(session.shop, params.id);
  if (saved) {
    return { creative: normalizeSavedCreative(saved) };
  }

  return { creative: null };
};

export default function CreativeDetailRoute() {
  const { creative } = useLoaderData();

  if (!creative) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Creative not found</h1>

        <Link
          to="/app/creative-library"
          className="text-blue-600 hover:underline"
        >
          Back to Creative Library
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/app/creative-library"
          className="mb-6 inline-block text-blue-600 hover:underline"
        >
          ← Back to Creative Library
        </Link>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-4xl font-bold text-slate-900">
            {creative.title || "Untitled Creative"}
          </h1>

          <p className="mt-2 text-slate-600">
            {creative.product || "Product"} · {creative.creator || "Creator"}
          </p>

          {creative.videoUrl ? (
            <video
              src={creative.videoUrl}
              controls
              className="mt-6 max-h-[600px] w-full rounded-xl border bg-black object-contain"
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-xl border bg-black text-slate-300">
              No video available
            </div>
          )}

          {creative.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {creative.tags.map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full border px-3 py-1 text-sm"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="Views" value={formatMetric(creative.views)} />
            <Metric label="Likes" value={formatMetric(creative.likes)} />
            <Metric label="Shares" value={formatMetric(creative.shares)} />
            <Metric label="Clicks" value={formatMetric(creative.clicks)} />
            <Metric label="Orders" value={formatMetric(creative.orders)} />
          </div>

          <div className="mt-6 rounded-xl border bg-slate-50 p-5">
            <h2 className="text-xl font-bold text-slate-900">
              Creative Insight
            </h2>

            <p className="mt-2 text-slate-700">
              {creative.insight || "No insight available."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
