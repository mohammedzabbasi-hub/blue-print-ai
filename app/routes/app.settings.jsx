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
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Database,
  ExternalLink,
  FolderOpen,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";
import BillingNotice from "../components/legal/BillingNotice";
import ProductContextEvidence from "../components/ProductContextEvidence";
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
import { listCreativePerformance } from "../models/creative-performance.server";
import {
  buildProductContext,
  productContextLabel,
} from "../models/product-context";
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
const DEFAULT_SETTINGS_SECTION = "workspace";

const SETTINGS_SECTIONS = [
  { id: "workspace", label: "Workspace Profile", icon: SlidersHorizontal },
  { id: "store", label: "Store Context", icon: Building2 },
  { id: "imports", label: "Import Preferences", icon: Database },
  { id: "video", label: "Video Analysis", icon: Clapperboard },
  { id: "library", label: "Creative Library", icon: FolderOpen },
  { id: "account", label: "Account", icon: UserRound },
  { id: "legal", label: "Legal & Privacy", icon: ShieldCheck },
];

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
  const [settings, profile, performance] = await Promise.all([
    getWorkspaceSettingsMap(session.shop, SETTINGS_DEFAULTS),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
  ]);
  const productContext = buildProductContext({
    shopifyProducts: merchantData.products || [],
    performanceRecords: performance.records,
  });

  return {
    showDeveloperTools: process.env.ENABLE_DEVELOPER_TOOLS === "true",
    productError: merchantData.errors?.[0] || "",
    productContext,
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

function formatSetupMode(mode) {
  return {
    entire_store: "Entire store",
    primary_product: "Primary product",
    manual_product_context: "Manual product context",
  }[mode] || "Entire store";
}

export default function SettingsRoute() {
  const {
    productContext,
    productError,
    products,
    profile,
    settings,
    shop,
    showDeveloperTools,
  } = useLoaderData();
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
  const requestedSection = new URLSearchParams(location.search).get("section");
  const availableSections = showDeveloperTools
    ? [...SETTINGS_SECTIONS, { id: "developer", label: "Developer Tools", icon: Wrench }]
    : SETTINGS_SECTIONS;
  const activeSection = availableSections.some(({ id }) => id === requestedSection)
    ? requestedSection
    : DEFAULT_SETTINGS_SECTION;

  useEffect(() => {
    if (actionData?.resetSuccess) {
      setResetModalOpen(false);
      setResetConfirmation("");
    }
  }, [actionData?.resetSuccess]);

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6">
      <header className="border-b border-slate-800/90 pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Manage your BluePrintAI workspace, store context, imports, and preferences.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-800 bg-[#09111f]/90 p-2.5 lg:sticky lg:top-5">
          <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Workspace settings
          </p>
          <nav aria-label="Settings categories" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {availableSections.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                aria-current={activeSection === id ? "page" : undefined}
                className={`group flex min-w-max items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition lg:min-w-0 ${
                  activeSection === id
                    ? "border-cyan-400/25 bg-cyan-500/[0.12] text-cyan-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.9)]"
                    : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-100"
                }`}
                to={withEmbeddedRouteParams(`/app/settings?section=${id}`, location.search)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="hidden h-3.5 w-3.5 opacity-50 lg:block" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-800 bg-[#0b1322]/95 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)]">
          {activeSection === "workspace" && (
            <SettingsPanel
              icon={SlidersHorizontal}
              title="Workspace Profile"
              description="Set the product and brand context used across recommendations and planning."
            >
              {actionData?.profileError && <SettingsAlert tone="error">{actionData.profileError}</SettingsAlert>}
              {actionData?.profileSuccess && <SettingsAlert tone="success">{actionData.profileSuccess}</SettingsAlert>}
              <WorkspaceProfileForm
                key={`profile-${resetUiKey}`}
                profile={currentProfile}
                productContext={productContext}
                productError={productError}
                products={products}
                saving={navigation.state === "submitting" && navigation.formData?.get("intent") === "saveProfile"}
              />
            </SettingsPanel>
          )}

          {activeSection === "store" && (
            <SettingsPanel icon={Building2} title="Store Context" description="The Shopify store connected to this embedded app session.">
              <div className="flex flex-col gap-4 rounded-xl border border-slate-700/80 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-100">{shopName}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">{shop}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Connected
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CompactStat
                  label="Shopify products"
                  value={String(productContext.shopifyProductsCount)}
                />
                <CompactStat
                  label="Imported product names"
                  value={String(productContext.importedProductNamesCount)}
                />
                <CompactStat label="Context mode" value={formatSetupMode(currentProfile.setupMode)} />
              </div>
              <p className="mt-4 text-sm font-bold text-cyan-200">
                {productContextLabel(productContext)}
              </p>
              <div className="mt-4">
                <ProductContextEvidence
                  compact
                  productContext={productContext}
                  title="Product context available to AI workflows"
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Store switching is handled from Shopify admin. BluePrintAI always follows the authenticated store session.
              </p>
            </SettingsPanel>
          )}

          {activeSection === "imports" && (
            <SettingsPanel icon={Database} title="Import Preferences" description="Defaults and supported behavior for creative performance imports.">
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/30">
                <ReadOnlySetting label="Creator attribution" value="Create or match creator profiles" />
                <ReadOnlySetting label="Campaign assignment" value="Choose per import or use CSV values" />
                <ReadOnlySetting label="Import safety" value="Preview before saving" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                CSV data and matched videos populate Creative Library, Campaigns, Creators, and Command Center reporting.
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20"
                to={withEmbeddedRouteParams("/app/data-import", location.search)}
              >
                Open Data Import &amp; sample CSV <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            </SettingsPanel>
          )}

          {activeSection === "video" && (
            <SettingsPanel icon={Clapperboard} title="Video Analysis Preferences" description="Control how uploaded videos are processed and saved.">
              {actionData?.error && <SettingsAlert tone="error">{actionData.error}</SettingsAlert>}
              {actionData?.success && <SettingsAlert tone="success">{actionData.success}</SettingsAlert>}
              <Form key={`preferences-${resetUiKey}`} method="post" className="space-y-5">
                <input name="intent" type="hidden" value="savePreferences" />
                <label className="block max-w-xl">
                  <span className="mb-1.5 block text-sm font-bold text-slate-300">Analysis Depth</span>
                  <select className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-bold outline-none focus:border-cyan-400/60" defaultValue={currentSettings.analysis_depth} disabled={savingPreferences} name="analysis_depth">
                    <option value="standard">Standard Analysis</option>
                    <option value="deep">Deep Creative Breakdown</option>
                    <option value="fast">Fast Summary</option>
                  </select>
                </label>
                <PreferenceToggle defaultChecked={currentSettings.auto_save_analyzed_videos === "true"} disabled={savingPreferences} label="Auto-save analyzed videos" name="auto_save_analyzed_videos" description="Save results to the Creative Library automatically." />
                <button type="submit" disabled={savingPreferences} className="bp-primary-cta">
                  {savingPreferences ? "Saving..." : "Save Preferences"}
                </button>
              </Form>
            </SettingsPanel>
          )}

          {activeSection === "library" && (
            <SettingsPanel icon={FolderOpen} title="Creative Library Defaults" description="Current fallback labels for newly analyzed videos.">
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/30">
                <ReadOnlySetting label="Default Product Label" value="Unknown Product" />
                <ReadOnlySetting label="Default Creator Label" value="Uploaded Creator" />
                <ReadOnlySetting label="Default Source" value="Uploaded Video" />
                <ReadOnlySetting label="Default Sort" value="Newest First" />
              </div>
            </SettingsPanel>
          )}

          {activeSection === "account" && (
            <SettingsPanel icon={UserRound} title="Account" description="Authentication and access for this workspace.">
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/30">
                <ReadOnlySetting label="Access method" value="Shopify admin session" />
                <ReadOnlySetting label="Current store" value={shop} mono />
                <ReadOnlySetting label="Session status" value="Authenticated" status />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">Account access follows your active Shopify admin login and app permissions.</p>
            </SettingsPanel>
          )}

          {activeSection === "legal" && (
            <SettingsPanel icon={ShieldCheck} title="Legal & Privacy" description="Policies, disclosures, and data request information.">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Privacy Policy", "/app/privacy"], ["Terms of Service", "/app/terms"],
                  ["Contact & Data Requests", "/app/contact"], ["Refund Policy", "/app/refund-policy"],
                  ["Acceptable Use", "/app/acceptable-use"], ["AI Disclaimer", "/app/ai-disclaimer"],
                  ["Cookies", "/app/cookies"], ["Copyright", "/app/copyright"],
                ].map(([label, to]) => (
                  <Link key={to} to={withEmbeddedRouteParams(to, location.search)} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3.5 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-500/35 hover:text-cyan-100">
                    {label}<ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 px-4 py-3 text-xs leading-5 text-slate-400">
                Privacy or deletion requests: contact BluePrintAI Commerce at support@blueprintai.app. Include your Shopify store domain and a non-sensitive description of the request. Do not send passwords, API keys, OAuth codes, access tokens, refresh tokens, developer tokens, or private ad-account credentials.
              </p>
              <BillingNotice className="mt-4" />
            </SettingsPanel>
          )}

          {activeSection === "developer" && showDeveloperTools && (
            <SettingsPanel icon={Wrench} title="Developer Tools" description="Internal workspace controls. These tools are hidden in the normal settings experience.">
              <div className="rounded-xl border border-red-500/35 bg-red-500/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Danger zone</p>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-sm leading-6 text-red-50/75">Delete saved creatives, imported performance data, briefs, blueprints, reviews, and demo records for this workspace. Shopify authentication remains connected.</p>
                  <button type="button" className="shrink-0 rounded-xl border border-red-400/50 bg-red-500/15 px-4 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:opacity-60" disabled={resettingWorkspace} onClick={() => setResetModalOpen(true)}>Reset Demo Workspace</button>
                </div>
              </div>
              {actionData?.resetError && <SettingsAlert tone="error">{actionData.resetError}</SettingsAlert>}
              {actionData?.resetSuccess && <SettingsAlert tone="success">{actionData.resetSuccess}</SettingsAlert>}
            </SettingsPanel>
          )}
        </main>
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
  productContext = {},
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
          Shopify products could not be loaded right now. {productContext.hasImportedProductContext
            ? "Imported product context remains available."
            : "Import product names or use manual product context."}
        </div>
      )}

      {!productError && products.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 text-xs font-semibold text-slate-300">
          {productContext.hasImportedProductContext
            ? "Imported product context available. Product planning can use names from your CSV or ad data even though no Shopify products are loaded."
            : "No product context. Add products in Shopify, import product names with creative data, or enter product context manually."}
        </div>
      )}

      <SettingsCatalogSetup
        defaultValue={profile.selectedProductId}
        disabled={saving}
        mode={setupMode}
        onModeChange={setSetupMode}
        productContext={productContext}
        products={products}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsSelect
          defaultValue={profile.category}
          disabled={saving}
          label="Store/product category"
          name="category"
          options={PRODUCT_CATEGORY_OPTIONS}
        />

        <SettingsSelect
          defaultValue={profile.creativeGoal}
          disabled={saving}
          label="Main creative goal"
          name="creativeGoal"
          options={CREATIVE_GOAL_OPTIONS}
        />
      </div>

      {setupMode === "manual_product_context" && (
        <div className="grid gap-4 lg:grid-cols-2">
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
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

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
  productContext = {},
  products = [],
}) {
  return (
    <div className="block">
      <label className="mb-1.5 block text-sm font-bold text-slate-300" htmlFor="settingsSetupMode">
        Product context mode
      </label>
      <select
        id="settingsSetupMode"
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-bold outline-none focus:border-cyan-400/60"
        defaultValue={mode || "entire_store"}
        disabled={disabled}
        name="setupMode"
        onChange={(event) => onModeChange?.(event.target.value)}
      >
        <option value="entire_store">Use entire store</option>
        <option value="primary_product">Choose a primary product</option>
        <option value="manual_product_context">Enter product context manually</option>
      </select>
      <span className="mt-1.5 block text-xs leading-5 text-slate-500">
        BluePrintAI loads Shopify catalog context using safe pagination, up to
        1,000 of the most recently updated products. Choosing a primary product
        gives the app a starting point for product-specific briefs and recommendations.
      </span>

      {mode === "entire_store" && (
        <span className="mt-2.5 block rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-3.5 py-2.5 text-xs leading-5 text-cyan-50/90">
          {productContext.hasShopifyProducts
            ? "Recommended. BluePrintAI will use your connected Shopify catalog as the main store context."
            : productContext.hasImportedProductContext
              ? "Imported product context is available and will support product planning until Shopify catalog products are loaded."
              : "No catalog or imported product context is available yet."}
        </span>
      )}

      {mode === "primary_product" && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold text-slate-300">Primary Shopify product</span>
          <select
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-bold outline-none focus:border-cyan-400/60"
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
        <span className="mt-2.5 block rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs leading-5 text-amber-50/90">
          Use this if Shopify products are not available yet or you want to
          describe a product manually.
        </span>
      )}

      {mode === "primary_product" && products.length === 0 && (
        <span className="mt-2.5 block rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs leading-5 text-amber-50/90">
          Shopify products could not be loaded or this store has no products
          yet. Imported product names still support Ad Briefs and Revenue
          Blueprint; use manual context to choose a specific profile product.
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
      <span className="mb-1.5 block text-sm font-bold text-slate-300">{label}</span>
      <input
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-bold outline-none focus:border-cyan-400/60"
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
      <span className="mb-1.5 block text-sm font-bold text-slate-300">{label}</span>
      <select
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm font-bold outline-none focus:border-cyan-400/60"
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
      className={`flex max-w-xl items-center justify-between gap-5 ${
        last ? "" : "border-b border-slate-800 pb-4"
      }`}
    >
      <span>
        <label className="block text-sm font-black" htmlFor={name}>
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

function SettingsPanel({ children, description, icon: Icon, title }) {
  return (
    <section>
      <header className="flex items-start gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black text-slate-50">{title}</h2>
          <p className="mt-0.5 text-sm leading-5 text-slate-400">{description}</p>
        </div>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SettingsAlert({ children, tone }) {
  const toneClass = tone === "success"
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
    : "border-red-500/35 bg-red-500/10 text-red-200";
  return <div className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm font-bold ${toneClass}`}>{children}</div>;
}

function CompactStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-200">{value}</p>
    </div>
  );
}

function ReadOnlySetting({ label, mono = false, status = false, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : "text-sm font-bold"} ${status ? "text-emerald-300" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}
