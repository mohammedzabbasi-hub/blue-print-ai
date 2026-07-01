import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import { useState } from "react";
import {
  createActivityLogRecord,
  getWorkspaceProfile,
  mergeWorkspaceProfileWithProduct,
  saveWorkspaceProfile,
  skipWorkspaceProfile,
  upsertWorkspaceSettings,
} from "../models/blueprint.server";
import {
  BRAND_TONE_OPTIONS,
  CREATIVE_GOAL_OPTIONS,
  CREATIVE_SOURCE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
} from "../models/workspace-profile-options";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Workspace Setup | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const url = new URL(request.url);
  const profile = await getWorkspaceProfile(session.shop);

  return {
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products || [],
    next: safeNextPath(url.searchParams.get("next")),
    profile,
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const url = new URL(request.url);
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "complete");
  const next = safeNextPath(String(formData.get("next") || "/app"));
  const embeddedNext = withEmbeddedRouteParams(next, url.search);

  try {
    if (!formData.has("legalConsent")) {
      return {
        error:
          "Agree to the Terms of Service and Privacy Policy before continuing.",
      };
    }

    if (intent === "skip") {
      await skipWorkspaceProfile(session.shop);
      await saveLegalConsent(session.shop);
      await createActivityLogRecord(session.shop, {
        type: "settings",
        title: "Workspace onboarding skipped",
        description:
          "Workspace profile setup was skipped. Generic empty states will be used until product context is saved.",
        relatedType: "WorkspaceSetting",
        relatedId: `workspace-profile-skip:${Date.now()}`,
      });

      throw redirect(embeddedNext);
    }

    if (intent !== "complete") {
      return { error: "Unknown onboarding action." };
    }

    const setupMode = String(formData.get("setupMode") || "entire_store");
    const selectedProductId =
      setupMode === "primary_product"
        ? String(formData.get("selectedProductId") || "")
        : "";
    const selectedProduct =
      merchantData.products.find((product) => product.id === selectedProductId) ||
      null;
    const profile = mergeWorkspaceProfileWithProduct(
      {
        setupMode,
        brandTone: String(formData.get("brandTone") || ""),
        category: String(formData.get("category") || ""),
        creativeGoal: String(formData.get("creativeGoal") || ""),
        creativeSource: String(formData.get("creativeSource") || ""),
        mainProduct:
          setupMode === "manual_product_context"
            ? String(formData.get("mainProduct") || "")
            : "",
        targetCustomer: String(formData.get("targetCustomer") || ""),
      },
      setupMode === "primary_product" ? selectedProduct : null,
    );

    if (!["entire_store", "primary_product", "manual_product_context"].includes(setupMode)) {
      return { error: "Choose how BluePrintAI should use your Shopify catalog." };
    }

    if (setupMode === "primary_product" && !selectedProduct) {
      return { error: "Choose a primary Shopify product or use the entire store." };
    }

    if (!profile.category && selectedProduct?.productType) {
      profile.category = "Other";
    }

    if (!profile.targetCustomer && selectedProduct) {
      profile.targetCustomer = "Current Shopify product shoppers";
    }

    if (!profile.creativeGoal && selectedProduct) {
      profile.creativeGoal = "Better product demos";
    }

    if (!profile.creativeSource && selectedProduct) {
      profile.creativeSource = "Product demos";
    }

    if (!profile.brandTone && selectedProduct?.vendor) {
      profile.brandTone = "Friendly";
    }

    if (setupMode === "manual_product_context" && !profile.category) {
      return { error: "Choose a store or product category." };
    }
    if (setupMode === "manual_product_context" && !profile.mainProduct.trim()) {
      return { error: "Enter your main product or product line." };
    }
    if (setupMode === "manual_product_context" && !profile.targetCustomer.trim()) {
      return { error: "Enter the target customer this workspace should focus on." };
    }
    if (setupMode === "manual_product_context" && !profile.creativeGoal) {
      return { error: "Choose a main creative goal." };
    }
    if (setupMode === "manual_product_context" && !profile.creativeSource) {
      return { error: "Choose the current creative source closest to your workflow." };
    }

    const saved = await saveWorkspaceProfile(session.shop, profile);
    await saveLegalConsent(session.shop);
    await createActivityLogRecord(session.shop, {
      type: "settings",
      title: "Workspace profile saved",
      description: `${saved.mainProduct} · ${saved.category}`,
      relatedType: "WorkspaceSetting",
      relatedId: `workspace-profile:${Date.now()}`,
      payload: saved,
    });

    throw redirect(embeddedNext);
  } catch (error) {
    if (error instanceof Response) throw error;
    return { error: error.message || "Could not save onboarding." };
  }
};

export default function OnboardingRoute() {
  const { next, productError, products, profile, shop } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData?.get("intent");
  const [setupMode, setSetupMode] = useState(profile.setupMode || "entire_store");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          Workspace setup
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Personalize BluePrintAI
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          BluePrintAI uses this store profile to tailor recommendations,
          briefs, and planning blueprints for {shop}. This stays scoped to the
          authenticated Shopify workspace.
        </p>
      </section>

      {actionData?.error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
          {actionData.error}
        </div>
      )}

      {productError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
          Shopify products could not be loaded right now. Manual product
          context still works.
        </div>
      )}

      {!productError && products.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-4 text-sm font-semibold text-slate-200">
          No Shopify products found yet. Add products in Shopify or enter
          product context manually.
        </div>
      )}

      <Form method="post" className="glass rounded-2xl p-6">
        <input name="next" type="hidden" value={next} />

        <div className="grid gap-5 md:grid-cols-2">
          <CatalogSetupField
            defaultValue={profile.selectedProductId}
            disabled={submitting}
            mode={setupMode}
            onModeChange={setSetupMode}
            products={products}
          />

          <SelectField
            defaultValue={profile.category}
            disabled={submitting}
            label="Store/product category"
            name="category"
            options={PRODUCT_CATEGORY_OPTIONS}
            required
          />

          {setupMode === "manual_product_context" && (
            <>
              <TextField
                defaultValue={profile.mainProduct}
                disabled={submitting}
                label="Main product or product line"
                name="mainProduct"
                placeholder="Flagship product, coffee bundle, resistance bands"
                required
              />

              <TextField
                defaultValue={profile.targetCustomer}
                disabled={submitting}
                label="Target customer"
                name="targetCustomer"
                placeholder="Teen skincare buyers, busy parents, fitness beginners"
                required
              />
            </>
          )}

          <SelectField
            defaultValue={profile.creativeGoal}
            disabled={submitting}
            label="Main creative goal"
            name="creativeGoal"
            options={CREATIVE_GOAL_OPTIONS}
            required={setupMode === "manual_product_context"}
          />

          <SelectField
            defaultValue={profile.creativeSource}
            disabled={submitting}
            label="Current creative source"
            name="creativeSource"
            options={CREATIVE_SOURCE_OPTIONS}
            required={setupMode === "manual_product_context"}
          />

          <SelectField
            defaultValue={profile.brandTone}
            disabled={submitting}
            label="Brand tone"
            name="brandTone"
            options={BRAND_TONE_OPTIONS}
          />
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm font-semibold text-slate-200">
          <input
            className="mt-1 h-5 w-5 accent-cyan-500"
            disabled={submitting}
            name="legalConsent"
            required
            type="checkbox"
            value="true"
          />
          <span>
            I agree to the{" "}
            <Link
              to={withEmbeddedRouteParams("/app/terms", location.search)}
              className="text-cyan-200 underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to={withEmbeddedRouteParams("/app/privacy", location.search)}
              className="text-cyan-200 underline"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && submittingIntent === "complete"
              ? "Saving setup..."
              : "Complete setup"}
          </button>

          <button
            type="submit"
            name="intent"
            value="skip"
            disabled={submitting}
            className="rounded-lg border border-border-strong bg-surface-2/60 px-5 py-2.5 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && submittingIntent === "skip"
              ? "Skipping..."
              : "Skip for now"}
          </button>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Skipping keeps the workspace usable, but BluePrintAI will show generic
          empty states until you add a profile, save a creative, or analyze a
          video.
        </p>
      </Form>
    </div>
  );
}

function CatalogSetupField({
  defaultValue = "",
  disabled = false,
  mode = "entire_store",
  onModeChange,
  products = [],
}) {
  return (
    <div className="block text-sm font-semibold text-foreground md:col-span-2">
      <label htmlFor="setupMode">Shopify product</label>
      <select
        id="setupMode"
        className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        defaultValue={mode || "entire_store"}
        disabled={disabled}
        name="setupMode"
        onChange={(event) => onModeChange?.(event.target.value)}
      >
        <option value="entire_store">Use entire store</option>
        <option value="primary_product">Choose a primary product</option>
        <option value="manual_product_context">Enter product context manually</option>
      </select>
      <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
        BluePrintAI analyzes your full Shopify store. Choosing a primary
        product only gives the app a starting point for product-specific ad
        briefs, creator matching, and recommendations.
      </span>

      {mode === "entire_store" && (
        <span className="mt-2 block rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs font-normal leading-5 text-cyan-50">
          Recommended. BluePrintAI will use your connected Shopify catalog as
          the main store context.
        </span>
      )}

      {mode === "primary_product" && (
        <label className="mt-4 block">
          <span className="block">Primary Shopify product</span>
          <select
            className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            defaultValue={defaultValue || ""}
            disabled={disabled || products.length === 0}
            name="selectedProductId"
            required={mode === "primary_product" && products.length > 0}
          >
            <option value="">
              {products.length
                ? "Choose a product"
                : "No Shopify products available"}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
                {product.productType ? ` · ${product.productType}` : ""}
                {product.vendor ? ` · ${product.vendor}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
            Optional. Pick one product as the first product BluePrintAI should
            focus on. The rest of the store will still remain available.
          </span>
        </label>
      )}

      {mode === "manual_product_context" && (
        <span className="mt-2 block rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-normal leading-5 text-amber-50">
          Use this if Shopify products are not available yet or you want to
          describe a product manually.
        </span>
      )}

      {mode === "primary_product" && products.length === 0 && (
        <span className="mt-2 block rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-normal leading-5 text-amber-50">
          Shopify products could not be loaded or this store has no products
          yet. Use entire store or enter product context manually.
        </span>
      )}
    </div>
  );
}

function TextField({
  defaultValue = "",
  disabled = false,
  label,
  name,
  placeholder = "",
  required = false,
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      <input
        className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function SelectField({
  defaultValue = "",
  disabled = false,
  label,
  name,
  options,
  required = false,
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      <select
        className="mt-2 w-full rounded-lg border border-border-strong bg-surface-2/60 px-4 py-3 text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        required={required}
      >
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function safeNextPath(value) {
  const next = String(value || "/app");
  return next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

async function saveLegalConsent(shop) {
  await upsertWorkspaceSettings(shop, {
    legal_consent_at: new Date().toISOString(),
    legal_consent_version: "June 23, 2026",
    legal_terms_privacy_accepted: "true",
  });
}
