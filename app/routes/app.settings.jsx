import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import { useEffect, useState } from "react";
import BillingNotice from "../components/legal/BillingNotice";
import {
  createActivityLogRecord,
  getWorkspaceProfile,
  getWorkspaceSettingsMap,
  mergeWorkspaceProfileWithProduct,
  resetDemoWorkspaceFromSettingsForm,
  saveWorkspaceProfile,
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
  return [{ title: "Settings | BluePrintAI" }];
};

const SETTINGS_DEFAULTS = {
  analysis_depth: "standard",
  auto_save_analyzed_videos: "true",
};

const ANALYSIS_DEPTH_OPTIONS = new Set(["standard", "deep", "fast"]);
const RESET_DEMO_WORKSPACE_INTENT = "resetDemoWorkspace";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const legacyPanelRoute = {
    privacy: "/app/privacy",
    support: "/app/support",
    terms: "/app/terms",
  }[url.searchParams.get("panel")];

  if (legacyPanelRoute) {
    throw redirect(withEmbeddedRouteParams(legacyPanelRoute, url.search));
  }

  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [settings, profile] = await Promise.all([
    getWorkspaceSettingsMap(session.shop, SETTINGS_DEFAULTS),
    getWorkspaceProfile(session.shop),
  ]);

  return {
    showDeveloperTools: process.env.ENABLE_DEVELOPER_TOOLS === "true",
    productError: merchantData.errors?.[0] || "",
    products: merchantData.products || [],
    profile,
    shop: session.shop,
    settings,
  };
};

export const action = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "saveProfile") {
    try {
      const setupMode = String(formData.get("setupMode") || "entire_store");
      const selectedProductId =
        setupMode === "primary_product"
          ? String(formData.get("selectedProductId") || "")
          : "";
      const selectedProduct =
        merchantData.products.find((product) => product.id === selectedProductId) ||
        null;

      if (!["entire_store", "primary_product", "manual_product_context"].includes(setupMode)) {
        return { profileError: "Choose how BluePrintAI should use your Shopify catalog." };
      }

      if (setupMode === "primary_product" && !selectedProduct) {
        return { profileError: "Choose a primary Shopify product or use the entire store." };
      }

      const profileInput = mergeWorkspaceProfileWithProduct(
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

      if (!profileInput.category && selectedProduct?.productType) {
        profileInput.category = "Other";
      }

      const profile = await saveWorkspaceProfile(session.shop, profileInput);

      await createActivityLogRecord(session.shop, {
        type: "settings",
        title: "Workspace profile updated",
        description: profile.mainProduct
          ? `${profile.mainProduct} · ${profile.category || "Product context"}`
          : "Workspace profile updated",
        relatedType: "WorkspaceSetting",
        relatedId: `workspace-profile:${Date.now()}`,
        payload: profile,
      });

      return {
        profile,
        profileSuccess: "Workspace profile saved.",
      };
    } catch (error) {
      return { profileError: error.message || "Could not save workspace profile." };
    }
  }

  if (intent === RESET_DEMO_WORKSPACE_INTENT) {
    if (process.env.ENABLE_DEVELOPER_TOOLS !== "true") {
      return { resetError: "Developer tools are not enabled." };
    }
    const result = await resetDemoWorkspaceFromSettingsForm(session.shop, formData);

    if (result.resetSuccess) {
      return {
        ...result,
        profile: await getWorkspaceProfile(session.shop),
        settings: SETTINGS_DEFAULTS,
      };
    }

    return result;
  }

  if (intent !== "savePreferences") {
    return { error: "Unknown settings action." };
  }

  const analysisDepth = String(formData.get("analysis_depth") || "standard");

  if (!ANALYSIS_DEPTH_OPTIONS.has(analysisDepth)) {
    return { error: "Choose a valid analysis depth." };
  }

  try {
    const settings = await upsertWorkspaceSettings(session.shop, {
      analysis_depth: analysisDepth,
      auto_save_analyzed_videos: formData.has("auto_save_analyzed_videos")
        ? "true"
        : "false",
    });

    await createActivityLogRecord(session.shop, {
      type: "settings",
      title: "Settings updated",
      description: "Video analysis preferences were updated.",
      relatedType: "WorkspaceSetting",
      relatedId: `preferences:${Date.now()}`,
      payload: settings,
    });

    return {
      settings,
      success: "Video analysis preferences saved.",
    };
  } catch (error) {
    return { error: error.message || "Could not save settings." };
  }
};

function formatShopName(shop = "") {
  const base = String(shop || "")
    .replace(".myshopify.com", "")
    .replace(/[-_]+/g, " ");

  return (
    base
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || shop
  );
}

export default function SettingsRoute() {
  const { productError, products, profile, settings, shop, showDeveloperTools } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const savingPreferences =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "savePreferences";
  const resettingWorkspace =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === RESET_DEMO_WORKSPACE_INTENT;
  const currentSettings = actionData?.settings || settings;
  const currentProfile = actionData?.profile || profile;
  const resetUiKey = actionData?.resetSuccess ? `reset-${actionData.reset?.shop || shop}` : "current";
  const shopName = formatShopName(shop);

  useEffect(() => {
    if (actionData?.resetSuccess) {
      setResetModalOpen(false);
      setResetConfirmation("");
    }
  }, [actionData?.resetSuccess]);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-8 flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-2xl text-primary">
            ⚙
          </div>

          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
              Settings
            </h1>

            <p className="mt-2 text-muted-foreground">
              Manage your BlueprintAI workspace, Shopify store context, and
              video analysis preferences.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                ✨
              </div>

              <div>
                <h2 className="text-2xl font-black">Workspace Profile</h2>
                <p className="text-slate-400">
                  Product context used for recommendations and planning.
                </p>
              </div>
            </div>

            {actionData?.profileError && (
              <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 font-bold text-red-200">
                {actionData.profileError}
              </div>
            )}

            {actionData?.profileSuccess && (
              <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 font-bold text-emerald-200">
                {actionData.profileSuccess}
              </div>
            )}

            <WorkspaceProfileForm
              key={`profile-${resetUiKey}`}
              profile={currentProfile}
              productError={productError}
              products={products}
              saving={
                navigation.state === "submitting" &&
                navigation.formData?.get("intent") === "saveProfile"
              }
            />
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                🏬
              </div>

              <div>
                <h2 className="text-2xl font-black">Active Shop</h2>
                <p className="text-slate-400">
                  The authenticated Shopify store powering this embedded app session.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">{shopName}</h3>

                  <p className="mt-1 text-slate-400">
                    {shop}
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-300">
                  Connected
                </span>
              </div>
            </div>

            <p className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50/90">
              This embedded app session is connected to the current Shopify
              store. Switch stores from Shopify admin, not inside BluePrintAI.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                🎥
              </div>

              <div>
                <h2 className="text-2xl font-black">
                  Video Analysis Preferences
                </h2>

                <p className="text-slate-400">
                  Control how videos are processed.
                </p>
              </div>
            </div>

            {actionData?.error && (
              <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 font-bold text-red-200">
                {actionData.error}
              </div>
            )}

            {actionData?.success && (
              <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 font-bold text-emerald-200">
                {actionData.success}
              </div>
            )}

            <Form key={`preferences-${resetUiKey}`} method="post" className="space-y-6">
              <input name="intent" type="hidden" value="savePreferences" />

              <label className="block">
                <span className="mb-2 block text-slate-400">
                  Analysis Depth
                </span>

                <select
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none"
                  defaultValue={currentSettings.analysis_depth}
                  disabled={savingPreferences}
                  name="analysis_depth"
                >
                  <option value="standard">Standard Analysis</option>
                  <option value="deep">Deep Creative Breakdown</option>
                  <option value="fast">Fast Summary</option>
                </select>
              </label>

              <PreferenceToggle
                defaultChecked={
                  currentSettings.auto_save_analyzed_videos === "true"
                }
                disabled={savingPreferences}
                label="Auto-save analyzed videos"
                name="auto_save_analyzed_videos"
                description="Save results to the Creative Library automatically."
              />

              <button
                type="submit"
                disabled={savingPreferences}
                className="bp-primary-cta"
              >
                {savingPreferences ? "Saving..." : "Save Preferences"}
              </button>
            </Form>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                ▥
              </div>

              <div>
                <h2 className="text-2xl font-black">
                  Creative Library Defaults
                </h2>

                <p className="text-slate-400">
                  Defaults applied to newly analyzed videos.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Default Product Label</span>
                <span className="font-bold">Unknown Product</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Default Creator Label</span>
                <span className="font-bold">Uploaded Creator</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Default Source</span>
                <span className="font-bold">Uploaded Video</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Default Sort</span>
                <span className="font-bold">Newest First</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7 xl:col-span-2">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Account</h2>
                <p className="text-slate-400">
                  Access is managed by the current Shopify admin session.
                </p>
              </div>

              <span className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300">
                Shopify session
              </span>
            </div>
          </section>

          {showDeveloperTools && <section className="rounded-3xl border border-red-500/40 bg-[#170b12] p-7 shadow-[0_0_32px_rgba(239,68,68,0.08)] xl:col-span-2">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-red-300">
                  Danger Zone
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Reset Demo Workspace
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-6 text-red-50/80">
                  Deletes saved creatives, imported performance data, briefs,
                  blueprints, reviews, and demo records for this Shopify
                  workspace. Shopify authentication and app installation remain
                  connected.
                </p>
              </div>

              <button
                type="button"
                className="rounded-2xl border border-red-400/60 bg-red-500/15 px-6 py-3 font-black text-red-100 transition hover:border-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={resettingWorkspace}
                onClick={() => setResetModalOpen(true)}
              >
                Reset Demo Workspace
              </button>
            </div>

            {actionData?.resetError && (
              <div className="mt-5 rounded-2xl border border-red-500/50 bg-red-500/10 px-5 py-4 font-bold text-red-100">
                {actionData.resetError}
              </div>
            )}

            {actionData?.resetSuccess && (
              <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 font-bold text-emerald-100">
                {actionData.resetSuccess}
              </div>
            )}
          </section>}

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7 xl:col-span-2">
            <div className="mb-6">
              <div>
                <h2 className="text-2xl font-black">Legal & Privacy</h2>
                <p className="mt-2 max-w-3xl text-slate-400">
                  Review policies and send privacy or data deletion requests
                  for this Shopify workspace.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Link
                to={withEmbeddedRouteParams("/app/privacy", location.search)}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Privacy Policy
              </Link>
              <Link
                to={withEmbeddedRouteParams("/app/terms", location.search)}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Terms of Service
              </Link>
              <Link
                to={withEmbeddedRouteParams("/app/contact", location.search)}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Contact & Data Requests
              </Link>
              <Link
                to={withEmbeddedRouteParams("/app/refund-policy", location.search)}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Refund Policy
              </Link>
            </div>

            <p className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
              For privacy or data deletion requests, contact{" "}
              <span className="font-black text-cyan-100">
                mohammedzabbasi@gmail.com
              </span>{" "}
              with your Shopify store domain and enough detail to identify the
              workspace. Destructive deletion logic is not implemented here yet.
            </p>
            {/* TODO: Implement authenticated, shop-scoped deletion request handling once the retention and approval workflow is finalized. */}

            <BillingNotice className="mt-5" />
          </section>
        </div>
      </div>

      {showDeveloperTools && resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-2xl rounded-3xl border border-red-500/50 bg-[#100915] p-7 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-red-300">
                  Dangerous action
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Reset this demo workspace?
                </h2>
              </div>

              <button
                type="button"
                className="rounded-full border border-slate-700 px-3 py-1 text-lg font-black text-slate-300 transition hover:border-slate-500"
                onClick={() => setResetModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-200">
              <p>
                This deletes saved creatives, imported creative performance
                rows, generated ad briefs, revenue blueprints, video analysis
                reviews, workspace requests, activity history, and demo or test
                records scoped to {shop}.
              </p>

              <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-50">
                Shopify sessions, app installation/auth records, legal pages,
                billing configuration, route structure, and Shopify product
                pulls remain connected. Workspace profile and preference rows
                are cleared.
              </p>
            </div>

            <Form method="post" className="mt-6 space-y-5">
              <input
                name="intent"
                type="hidden"
                value={RESET_DEMO_WORKSPACE_INTENT}
              />
              <input
                name="confirmation"
                type="hidden"
                value={resetConfirmation}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-black text-red-100">
                  Type RESET to confirm
                </span>

                <input
                  autoComplete="off"
                  className="w-full rounded-2xl border border-red-500/40 bg-slate-950 px-4 py-4 font-black text-red-50 outline-none focus:border-red-300"
                  disabled={resettingWorkspace}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                  value={resetConfirmation}
                />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300 transition hover:border-slate-500"
                  disabled={resettingWorkspace}
                  onClick={() => setResetModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-2xl border border-red-400/70 bg-red-500/20 px-6 py-3 font-black text-red-50 transition hover:border-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={resetConfirmation !== "RESET" || resettingWorkspace}
                >
                  {resettingWorkspace
                    ? "Resetting..."
                    : "Reset workspace data"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceProfileForm({
  productError = "",
  products = [],
  profile = {},
  saving = false,
}) {
  const [setupMode, setSetupMode] = useState(profile.setupMode || "entire_store");

  return (
    <Form method="post" className="space-y-5">
      <input name="intent" type="hidden" value="saveProfile" />

      {productError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm font-bold text-amber-100">
          Shopify products could not be loaded right now. Manual product
          context still works.
        </div>
      )}

      {!productError && products.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-4 text-sm font-bold text-slate-200">
          No Shopify products found yet. Add products in Shopify or enter
          product context manually.
        </div>
      )}

      <SettingsCatalogSetup
        defaultValue={profile.selectedProductId}
        disabled={saving}
        mode={setupMode}
        onModeChange={setSetupMode}
        products={products}
      />

      <SettingsSelect
        defaultValue={profile.category}
        disabled={saving}
        label="Store/product category"
        name="category"
        options={PRODUCT_CATEGORY_OPTIONS}
      />

      {setupMode === "manual_product_context" && (
        <>
          <SettingsText
            defaultValue={profile.mainProduct}
            disabled={saving}
            label="Main product or product line"
            name="mainProduct"
            placeholder="Flagship product, resistance bands, coffee bundle"
          />

          <SettingsText
            defaultValue={profile.targetCustomer}
            disabled={saving}
            label="Target customer"
            name="targetCustomer"
            placeholder="Busy parents, first-time runners, gift buyers"
          />
        </>
      )}

      <SettingsSelect
        defaultValue={profile.creativeGoal}
        disabled={saving}
        label="Main creative goal"
        name="creativeGoal"
        options={CREATIVE_GOAL_OPTIONS}
      />

      <SettingsSelect
        defaultValue={profile.creativeSource}
        disabled={saving}
        label="Current creative source"
        name="creativeSource"
        options={CREATIVE_SOURCE_OPTIONS}
      />

      <SettingsSelect
        defaultValue={profile.brandTone}
        disabled={saving}
        label="Brand tone"
        name="brandTone"
        options={BRAND_TONE_OPTIONS}
      />

      <button
        type="submit"
        disabled={saving}
        className="bp-primary-cta"
      >
        {saving ? "Saving profile..." : "Save Workspace Profile"}
      </button>
    </Form>
  );
}

function SettingsCatalogSetup({
  defaultValue = "",
  disabled = false,
  mode = "entire_store",
  onModeChange,
  products = [],
}) {
  return (
    <div className="block">
      <label className="mb-2 block text-slate-400" htmlFor="settingsSetupMode">
        Shopify product
      </label>
      <select
        id="settingsSetupMode"
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none"
        defaultValue={mode || "entire_store"}
        disabled={disabled}
        name="setupMode"
        onChange={(event) => onModeChange?.(event.target.value)}
      >
        <option value="entire_store">Use entire store</option>
        <option value="primary_product">Choose a primary product</option>
        <option value="manual_product_context">Enter product context manually</option>
      </select>
      <span className="mt-2 block text-xs leading-5 text-slate-500">
        BluePrintAI analyzes your full Shopify store. Choosing a primary
        product only gives the app a starting point for product-specific ad
        briefs, creator matching, and recommendations.
      </span>

      {mode === "entire_store" && (
        <span className="mt-3 block rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-5 text-cyan-50">
          Recommended. BluePrintAI will use your connected Shopify catalog as
          the main store context.
        </span>
      )}

      {mode === "primary_product" && (
        <label className="mt-4 block">
          <span className="mb-2 block text-slate-400">Primary Shopify product</span>
          <select
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none"
            defaultValue={defaultValue || ""}
            disabled={disabled || products.length === 0}
            name="selectedProductId"
            required={mode === "primary_product" && products.length > 0}
          >
            <option value="">
              {products.length ? "Choose a product" : "No Shopify products available"}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
                {product.productType ? ` · ${product.productType}` : ""}
                {product.vendor ? ` · ${product.vendor}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs leading-5 text-slate-500">
            Optional. Pick one product as the first product BluePrintAI should
            focus on. The rest of the store will still remain available.
          </span>
        </label>
      )}

      {mode === "manual_product_context" && (
        <span className="mt-3 block rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-50">
          Use this if Shopify products are not available yet or you want to
          describe a product manually.
        </span>
      )}

      {mode === "primary_product" && products.length === 0 && (
        <span className="mt-3 block rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-50">
          Shopify products could not be loaded or this store has no products
          yet. Use entire store or enter product context manually.
        </span>
      )}
    </div>
  );
}

function SettingsText({
  defaultValue = "",
  disabled = false,
  label,
  name,
  placeholder = "",
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-slate-400">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none"
        defaultValue={defaultValue || ""}
        disabled={disabled}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function SettingsSelect({
  defaultValue = "",
  disabled = false,
  label,
  name,
  options = [],
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-slate-400">{label}</span>
      <select
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none"
        defaultValue={defaultValue || ""}
        disabled={disabled}
        name={name}
      >
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreferenceToggle({
  defaultChecked,
  description,
  disabled,
  label,
  last = false,
  name,
}) {
  return (
    <div
      className={`flex items-center justify-between gap-5 ${
        last ? "" : "border-b border-slate-800 pb-5"
      }`}
    >
      <span>
        <label className="block font-black" htmlFor={name}>
          {label}
        </label>
        <span className="block text-sm text-slate-400">{description}</span>
      </span>

      <input
        id={name}
        className="h-6 w-11 accent-cyan-500"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        type="checkbox"
        value="true"
      />
    </div>
  );
}
