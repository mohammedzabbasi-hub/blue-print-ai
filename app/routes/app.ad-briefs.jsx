import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  buildBrief,
  getWorkspaceProfile,
  listSavedBriefs,
  resolveProductContext,
  saveBriefRecord,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";

export const meta = () => {
  return [{ title: "Ad Briefs | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [briefs, profile, performance] = await Promise.all([
    listSavedBriefs(session.shop, 20),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
  ]);

  return {
    briefs: briefs.map(toBriefCard),
    canGenerate: Boolean(resolveProductContext(merchantData.products, profile)),
    hasDemoPerformanceData: performance.hasDemoPerformanceData,
    hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
    performanceBriefs: performance.records.slice(0, 4).map(toPerformanceBriefCard),
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products,
    selectedProductId: profile.selectedProductId || merchantData.products[0]?.id || "",
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const profile = await getWorkspaceProfile(session.shop);
  const product = resolveProductContext(
    merchantData.products,
    profile,
    String(formData.get("productId") || ""),
  );

  if (!product) {
    return { error: "No product context yet. Complete onboarding or add a Shopify product before saving a brief." };
  }

  try {
    const brief = buildBrief(product, { workspaceProfile: profile });
    const saved = await saveBriefRecord(session.shop, product, brief);

    return {
      brief: toBriefCard(saved),
      success: saved.wasCreated ? "Brief saved." : "Brief already saved.",
    };
  } catch (error) {
    return { error: error.message || "Could not generate this ad brief." };
  }
};

function formatBriefDescription(brief) {
  if (brief.description || brief.content || brief.summary) {
    return brief.description || brief.content || brief.summary;
  }

  if (brief.structure) return brief.structure;

  if (Array.isArray(brief.script)) {
    return brief.script
      .map((scene) => scene.direction || scene.goal || scene)
      .filter(Boolean)
      .join(" ");
  }

  if (Array.isArray(brief.hooks)) return brief.hooks[0] || "";

  if (brief.hook_type || brief.creator_type || brief.visual_style) {
    return [brief.hook_type, brief.creator_type, brief.visual_style]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

export default function AdBriefsRoute() {
  const {
    briefs: loaderBriefs,
    canGenerate,
    performanceBriefs,
    productError,
    products,
    selectedProductId,
    shop,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const briefs = actionData?.brief
    ? [actionData.brief, ...loaderBriefs.filter((brief) => brief.id !== actionData.brief.id)]
    : loaderBriefs;

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
              Creative Planning
            </p>

            <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
              Ad Briefs
            </h1>

            <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
              Briefs generated from {shop}&apos;s Shopify product context and
              saved app activity. They are planning outputs, not performance
              guarantees.
            </p>
          </div>

          <Form method="post" className="min-w-[260px] space-y-3">
            {products.length > 0 && (
              <label className="block text-sm font-semibold text-foreground">
                Product
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
            <button
              type="submit"
              disabled={!canGenerate || saving}
              className="bp-primary-cta"
            >
              {saving ? "Generating and saving..." : "Generate and Save Brief"}
            </button>
          </Form>
        </div>
      </div>

      {actionData?.error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {actionData.error}
        </div>
      )}

      {actionData?.success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          {actionData.success}
        </div>
      )}

      {productError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
          Shopify products could not be loaded right now. Manual workspace
          profile product context still works.
        </div>
      )}

      {briefs.length === 0 && (
        <EmptyWorkspaceState
          title="No ad briefs yet"
          description={
            canGenerate
              ? "Generate the first saved brief from this shop's product context."
              : "No Shopify products found yet. Add products in Shopify or enter product context manually."
          }
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      <div className="space-y-6">
        {performanceBriefs.map((brief) => (
          <div key={brief.id} className="glass rounded-2xl p-5">
            <p className="mb-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              {brief.sourceLabel}
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {brief.title}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {brief.description}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniBriefField label="Hook" value={brief.hook} />
              <MiniBriefField label="CTA" value={brief.cta} />
              <MiniBriefField label="Creator type" value={brief.creatorType} />
            </div>
          </div>
        ))}

        {briefs.map((brief, index) => (
          <div key={brief.id || index} className="glass rounded-2xl p-5">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {brief.title || brief.brief_title || "Ad Brief"}
            </h2>

          <p className="text-muted-foreground mt-3 text-sm">
            {formatBriefDescription(brief)}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MiniBriefField label="Creator type" value={brief.recommendedCreatorType} />
            <MiniBriefField label="Hook idea" value={brief.hooks?.[0]} />
            <MiniBriefField label="Success metric" value={brief.successMetric} />
          </div>
          {brief.shotList?.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Shot list
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {brief.shotList.join(" ")}
              </p>
            </div>
          )}

        </div>
      ))}
      </div>
    </div>
  );
}

function MiniBriefField({ label, value }) {
  if (!value) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function toPerformanceBriefCard(record) {
  return {
    id: `performance-${record.id}`,
    sourceLabel:
      record.sourcePlatform === "shopify_demo"
        ? "Demo performance data"
        : "CreativePerformance",
    title: `${record.creativeTitle || "Creative"} · ${record.productTitle || "Product"}`,
    description:
      record.hook ||
      record.angle ||
      record.cta ||
      "Use this creative performance record to draft hook, proof, angle, and CTA guidance.",
    hook: record.hook,
    cta: record.cta,
    creatorType: record.creatorName || record.creatorHandle || "Demo creator",
  };
}

function toBriefCard(record) {
  const payload = record.payload || record;

  return {
    id: record.id,
    productId: record.productId || payload.productId,
    title: `${record.angle || payload.angle || "Ad Brief"} · ${record.productTitle || payload.productTitle}`,
    description: payload.creatorDirection || payload.hooks?.[0] || "",
    ...payload,
  };
}
