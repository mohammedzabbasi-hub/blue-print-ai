import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import { authenticate } from "../shopify.server";
import {
  buildBrief,
  listSavedBriefs,
  loadMerchantData,
  saveBriefRecord,
} from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Ad Briefs | BluePrintAI" }];
};

function formatBriefDescription(brief) {
  const payload = brief.payload || brief;

  if (payload.description || payload.content || payload.summary) {
    return payload.description || payload.content || payload.summary;
  }

  if (payload.structure) return payload.structure;

  if (Array.isArray(payload.script)) {
    return payload.script
      .map((scene) =>
        typeof scene === "string" ? scene : scene.direction || scene.goal,
      )
      .filter(Boolean)
      .join(" ");
  }

  if (Array.isArray(payload.hooks) && payload.hooks.length) {
    return payload.hooks[0];
  }

  if (payload.hook_type || payload.creator_type || payload.visual_style) {
    return [payload.hook_type, payload.creator_type, payload.visual_style]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const savedBriefs = await listSavedBriefs(session.shop, 25);

  const briefs = savedBriefs.map((item) => ({
    id: item.id,
    title: item.angle || item.productTitle || "Ad Brief",
    productTitle: item.productTitle,
    createdAt: item.createdAt,
    description: formatBriefDescription(item),
  }));

  return {
    products: merchantData.products,
    briefs,
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");
  const merchantData = await loadMerchantData(admin, session);
  const product =
    merchantData.products.find((item) => item.id === productId) ||
    merchantData.products[0];

  if (!product) {
    return redirect("/app/ad-briefs");
  }

  const brief = buildBrief(product);
  await saveBriefRecord(session.shop, product, brief);

  return redirect("/app/ad-briefs");
};

export default function AdBriefsRoute() {
  const { products, briefs } = useLoaderData();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          Creative Planning
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Ad Briefs
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          Briefs generated from this shop’s real creative patterns.
        </p>
      </div>

      {products.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Generate a new brief
          </h2>

          <p className="text-muted-foreground mt-2 text-sm">
            Pick a product from your catalog to generate hooks, script, and
            CTA options.
          </p>

          <Form method="post" className="flex flex-col sm:flex-row gap-3 mt-5">
            <select
              name="productId"
              className="flex-1 rounded-lg border border-border-strong bg-surface-2/60 px-4 py-2.5 text-sm text-foreground"
              defaultValue={products[0]?.id}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={isGenerating}
              className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Brief"}
            </button>
          </Form>
        </div>
      )}

      {briefs.length === 0 && (
        <EmptyWorkspaceState
          title="No ad briefs yet"
          description="This shop does not have enough creative data to generate personalized ad briefs yet. Upload or analyze creatives first."
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      <div className="space-y-6">
        {briefs.map((brief) => (
          <div key={brief.id} className="glass rounded-2xl p-5">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {brief.title}
            </h2>

            {brief.productTitle && (
              <p className="text-primary mt-1 text-xs font-semibold uppercase tracking-[0.14em]">
                {brief.productTitle}
              </p>
            )}

            <p className="text-muted-foreground mt-3 text-sm">
              {brief.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
