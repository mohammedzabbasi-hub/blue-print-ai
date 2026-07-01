import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import BillingNotice from "../components/legal/BillingNotice";
import {
  createActivityLogRecord,
  getWorkspaceProfile,
  getWorkspaceSettingsMap,
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

export const meta = () => {
  return [{ title: "Settings | BluePrintAI" }];
};

const SETTINGS_DEFAULTS = {
  analysis_depth: "standard",
  auto_save_analyzed_videos: "true",
  email_summaries: "false",
};

const ANALYSIS_DEPTH_OPTIONS = new Set(["standard", "deep", "fast"]);

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const legacyPanelRoute = {
    privacy: "/app/privacy",
    support: "/app/support",
    terms: "/app/terms",
  }[url.searchParams.get("panel")];

  if (legacyPanelRoute) {
    throw redirect(legacyPanelRoute);
  }

  const { session } = await loadShopifyRouteContext(request);
  const [settings, profile] = await Promise.all([
    getWorkspaceSettingsMap(session.shop, SETTINGS_DEFAULTS),
    getWorkspaceProfile(session.shop),
  ]);

  return {
    profile,
    shop: session.shop,
    settings,
  };
};

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "saveProfile") {
    try {
      const profile = await saveWorkspaceProfile(session.shop, {
        brandTone: String(formData.get("brandTone") || ""),
        category: String(formData.get("category") || ""),
        creativeGoal: String(formData.get("creativeGoal") || ""),
        creativeSource: String(formData.get("creativeSource") || ""),
        mainProduct: String(formData.get("mainProduct") || ""),
        targetCustomer: String(formData.get("targetCustomer") || ""),
      });

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
      email_summaries: formData.has("email_summaries") ? "true" : "false",
    });

    await createActivityLogRecord(session.shop, {
      type: "settings",
      title: "Settings updated",
      description: "Video analysis and notification preferences were updated.",
      relatedType: "WorkspaceSetting",
      relatedId: `preferences:${Date.now()}`,
      payload: settings,
    });

    return {
      settings,
      success:
        "Settings saved. Email summaries are saved as a preference only; delivery is not active yet.",
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
  const { profile, settings, shop } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const savingPreferences =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "savePreferences";
  const currentSettings = actionData?.settings || settings;
  const currentProfile = actionData?.profile || profile;
  const shopName = formatShopName(shop);

  const tiktokStatusLabel = "TikTok connection coming soon";
  const tiktokStatusTone = "bg-slate-700/70 text-slate-300";
  const tiktokStatusMessage =
    "TikTok OAuth is not live in this Shopify app yet. BlueprintAI currently works with uploaded videos, saved creative records, generated briefs, and manual creative data.";
  const tiktokBadgeLabel = "Coming Soon";

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
              profile={currentProfile}
              saving={
                navigation.state === "submitting" &&
                navigation.formData?.get("intent") === "saveProfile"
              }
            />
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                ↗
              </div>

              <div>
                <h2 className="text-2xl font-black">TikTok Shop Connection</h2>
                <p className="text-slate-400">
                  TikTok OAuth/API sync is planned, but not live in this Shopify app yet.
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 font-bold text-amber-100">
              TikTok connection coming soon. No TikTok seller account is connected
              to this Shopify app right now.
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                    Connection Status
                  </p>

                  <h3 className="mt-2 text-xl font-black">
                    {tiktokStatusLabel}
                  </h3>

                  <p className="mt-1 max-w-2xl text-slate-400">
                    {tiktokStatusMessage}
                  </p>
                </div>

                <span
                  className={`rounded-full px-4 py-2 text-sm font-black ${tiktokStatusTone}`}
                >
                  {tiktokBadgeLabel}
                </span>
              </div>

              <p className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50/90">
                Until TikTok OAuth is implemented end-to-end, use uploaded
                videos, manual creative records, generated ad briefs, and saved
                revenue blueprints inside this Shopify workspace.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-black text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Connect TikTok Shop - Coming Soon
              </button>

              <button
                type="button"
                disabled
                className="rounded-2xl border border-cyan-400/60 bg-cyan-500/10 px-6 py-3 font-black text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Demo TikTok Sync - Coming Soon
              </button>

              <button
                type="button"
                disabled
                className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300 transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Disconnect Unavailable
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <h3 className="text-lg font-black">
                Current TikTok testing status
              </h3>

              <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                {[
                  "TikTok OAuth is not wired in this Shopify app yet",
                  "No TikTok access or refresh tokens are stored",
                  "No TikTok seller account is connected",
                  "Uploaded and manual creative workflows are available now",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.8)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
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

            <Form method="post" className="space-y-6">
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

              <PreferenceToggle
                defaultChecked={currentSettings.email_summaries === "true"}
                disabled={savingPreferences}
                label="Email summaries"
                name="email_summaries"
                description="Save the preference for future weekly digests. Email delivery is not active yet."
                last
              />

              <button
                type="submit"
                disabled={savingPreferences}
                className="rounded-2xl bg-cyan-500 px-6 py-3 font-black text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7 xl:col-span-2">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Legal & Privacy</h2>
                <p className="mt-2 max-w-3xl text-slate-400">
                  Review policies and send privacy or data deletion requests
                  for this Shopify workspace.
                </p>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-200">
                Review ready
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Link
                to="/app/privacy"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Privacy Policy
              </Link>
              <Link
                to="/app/terms"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Terms of Service
              </Link>
              <a
                href="mailto:mohammedzabbasi@gmail.com"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 font-black text-cyan-100 hover:border-cyan-500/40"
              >
                Contact & Data Requests
              </a>
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
    </div>
  );
}

function WorkspaceProfileForm({ profile = {}, saving = false }) {
  return (
    <Form method="post" className="space-y-5">
      <input name="intent" type="hidden" value="saveProfile" />

      <SettingsSelect
        defaultValue={profile.category}
        disabled={saving}
        label="Store/product category"
        name="category"
        options={PRODUCT_CATEGORY_OPTIONS}
      />

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
        className="rounded-2xl bg-cyan-500 px-6 py-3 font-black text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving profile..." : "Save Workspace Profile"}
      </button>
    </Form>
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
