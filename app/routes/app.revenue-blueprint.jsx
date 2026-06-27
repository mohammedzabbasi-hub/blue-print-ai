import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  buildRevenueBlueprint,
  findRevenueBlueprint,
  getWorkspaceProfile,
  listRevenueBlueprints,
  resolveProductContext,
  saveRevenueBlueprintRecord,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { listCampaigns } from "../models/campaign.server";

export const meta = () => {
  return [{ title: "Revenue Blueprint | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const url = new URL(request.url);
  const [selected, blueprints, profile, performance, campaigns] = await Promise.all([
    findRevenueBlueprint(session.shop, url.searchParams.get("blueprintId")),
    listRevenueBlueprints(session.shop, 8),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
    listCampaigns(session.shop),
  ]);
  const activeBlueprint = selected || blueprints[0] || null;
  const hasRevenueBackedRecords = performance.records.some((record) =>
    ["revenue", "orders", "spend"].some(
      (key) =>
        record.importSource === "public_engagement_import" &&
        record[key] !== null &&
        record[key] !== undefined &&
        Number(record[key] || 0) > 0,
    ),
  );

  return {
    blueprint: activeBlueprint?.payload || null,
    campaigns: campaigns.map(({ id, name }) => ({ id, name })),
    blueprints,
    hasDemoPerformanceData: performance.hasDemoPerformanceData,
    hasContext: Boolean(resolveProductContext(merchantData.products, profile)),
    hasMeasuredPerformanceData: performance.hasMeasuredPerformanceData,
    hasRevenueBackedRecords,
    performanceRecords: performance.records.slice(0, 5),
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

  try {
    if (!product) {
      return {
        error:
          "No product context yet. Complete onboarding or add a Shopify product before generating a blueprint.",
      };
    }

    const performance = await listCreativePerformance({
      merchantData,
      shop: session.shop,
    });
    const campaignId = String(formData.get("campaignId") || "");
    const creativeId = String(formData.get("creativeId") || "");
    const campaign = campaignId ? (await listCampaigns(session.shop)).find((item) => item.id === campaignId) : null;
    const selectedCreative = creativeId ? performance.records.find((record) => record.id === creativeId) : null;
    const scopedRecords = selectedCreative ? [selectedCreative] : campaign
      ? performance.records.filter((record) => record.workspaceCampaignId === campaign.id) : performance.records;
    const topPerformanceRecord = scopedRecords.find(
      (record) => record.sourcePlatform !== "shopify_demo",
    );
    const blueprint = buildRevenueBlueprint(merchantData, {
      product,
      performanceRecords: scopedRecords,
      recommendation: topPerformanceRecord
        ? {
            id: topPerformanceRecord.id,
            title: topPerformanceRecord.creativeTitle,
            type: "creative",
            detail: topPerformanceRecord.angle || topPerformanceRecord.hook,
            nextAction:
              "Turn this CreativePerformance record into the next hook, proof, and CTA test.",
          }
        : null,
      workspaceProfile: profile,
    });
    blueprint.scope = selectedCreative
      ? { type: "creative", id: selectedCreative.id, name: selectedCreative.creativeTitle, label: `Blueprint based on creative: ${selectedCreative.creativeTitle}` }
      : campaign
      ? { type: "campaign", id: campaign.id, name: campaign.name, label: `Blueprint based on campaign: ${campaign.name}` }
      : { type: "workspace", label: "Blueprint based on entire workspace" };
    const saved = await saveRevenueBlueprintRecord(session.shop, blueprint);

    return {
      blueprint: saved.payload,
      blueprintId: saved.id,
      success: saved.wasCreated ? "Blueprint saved." : "Blueprint already saved.",
      scopeLabel: blueprint.scope.label,
    };
  } catch (error) {
    return { error: error.message || "Could not generate this blueprint." };
  }
};

export default function RevenueBlueprintRoute() {
  const {
    blueprint: loaderBlueprint,
    campaigns,
    blueprints,
    hasContext,
    hasRevenueBackedRecords,
    performanceRecords,
    productError,
    products,
    selectedProductId,
    shop,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const generating = navigation.state === "submitting";
  const blueprint = actionData?.blueprint || loaderBlueprint;
  const newEmptyAccount = !hasContext && !blueprint;

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          AI Growth Plan
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Revenue Blueprint
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          A shop-specific planning estimate saved to {shop}. Outputs are
          generated from available Shopify app context and are not financial
          guarantees.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-semibold text-red-200">
          {actionData.error}
        </div>
      )}

      {actionData?.success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 font-semibold text-emerald-200">
          {actionData.success}
          {actionData.scopeLabel ? ` ${actionData.scopeLabel}.` : ""}
        </div>
      )}

      {productError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 font-semibold text-amber-100">
          Shopify products could not be loaded right now. Manual workspace
          profile product context still works.
        </div>
      )}

      {newEmptyAccount && (
        <EmptyWorkspaceState
          title="No blueprint yet"
          description="This new shop does not have enough saved app context for a useful planning estimate yet. Analyze a video or save a creative first."
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      {!newEmptyAccount && !blueprint && (
        <section className="glass rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            No saved blueprints yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate the first shop-scoped planning estimate from current
            Shopify product context and saved app activity.
          </p>
          <BlueprintGenerator
            campaigns={campaigns}
            performanceRecords={performanceRecords}
            generating={generating}
            products={products}
            selectedProductId={selectedProductId}
          />
        </section>
      )}

      {blueprint && (
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            {blueprint.context?.generatedFor || "AI Growth Blueprint"}
          </h2>

          <p className="text-muted-foreground mt-4 text-sm">
            {blueprint.diagnosis || "Your blueprint is ready."}
          </p>

          <BlueprintGenerator
            campaigns={campaigns}
            performanceRecords={performanceRecords}
            generating={generating}
            label="Generate New Blueprint"
            products={products}
            selectedProductId={selectedProductId}
          />

          <div className="space-y-5 mt-8">
            {performanceRecords.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                <p className="text-cyan-300 font-black">Imported performance context</p>
                <p className="mt-2 text-sm text-slate-400">
                  {performanceRecords.length} imported engagement/performance records are available for planning guidance.{" "}
                  {hasRevenueBackedRecords
                    ? "Revenue, orders, or spend are included, so revenue-backed confidence can be used where available."
                    : "Only public engagement is imported right now, so this blueprint avoids revenue-backed assumptions until revenue, orders, or spend are added."}
                </p>
              </div>
            )}

            {blueprint.demoAssumptions?.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                <p className="font-black text-amber-100">Demo performance assumptions</p>
                <div className="mt-3 space-y-2 text-sm text-amber-50">
                  {blueprint.demoAssumptions.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            )}

            {blueprint.opportunities?.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {blueprint.opportunities.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Revenue opportunity
                    </p>
                    <h3 className="mt-2 text-xl font-black text-white">
                      {item.productTitle}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {item.creatorName} · {item.angle}
                    </p>
                    <p className="mt-4 text-2xl font-black text-cyan-100">
                      +{formatCurrency(item.estimatedUpside)} estimated upside
                    </p>
                    <p className="mt-3 text-sm text-slate-300">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            )}

            {(blueprint.sevenDayPlan || []).map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
              >
                <p className="text-cyan-300 font-black">
                  Step {index + 1}
                </p>

                <h3 className="text-2xl font-black mt-2">
                  Day {index + 1}
                </h3>

                <p className="text-slate-400 mt-3">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Saved blueprints
        </h2>
        {blueprints.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No blueprint records have been saved for this shop yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {blueprints.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="font-semibold text-foreground">
                  {item.payload?.context?.generatedFor || "Saved blueprint"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
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

function BlueprintGenerator({
  campaigns = [],
  generating,
  label = "Generate Blueprint",
  performanceRecords = [],
  products = [],
  selectedProductId = "",
}) {
  return (
    <Form method="post" className="mt-7 space-y-3">
      <label className="block max-w-md text-sm font-semibold text-foreground">
        Blueprint scope
        <select name="campaignId" className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground">
          <option value="">Entire workspace / selected product</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>Campaign: {campaign.name}</option>)}
        </select>
      </label>
      {performanceRecords.length > 0 && <label className="block max-w-md text-sm font-semibold text-foreground">
        Specific creative (optional)
        <select name="creativeId" className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground">
          <option value="">Use workspace, campaign, or product scope</option>
          {performanceRecords.map((record) => <option key={record.id} value={record.id}>{record.creativeTitle || record.adName || "Imported creative"}</option>)}
        </select>
      </label>}
      {products.length > 0 && (
        <label className="block max-w-md text-sm font-semibold text-foreground">
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
        disabled={generating}
        className="bp-primary-cta"
      >
        {generating ? "Generating and saving..." : label}
      </button>
    </Form>
  );
}
