import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { getAuthHeaders as getAccountAuthHeaders } from "../lib/accountContext";
import {
  getSelectedShopId,
  getStoredShopName,
  setSelectedShop,
} from "../lib/shopSession";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const FALLBACK_SHOPS = [
  {
    id: "1",
    shop_name: "GlowLab Beauty",
    category: "Beauty & Personal Care",
    region: "US",
    creatives: 17,
    creators: 4,
  },
  {
    id: "2",
    shop_name: "FitPulse Gear",
    category: "Fitness Accessories",
    region: "US",
    creatives: 17,
      creators: 4,
  },
  {
    id: "3",
    shop_name: "HomeEase Finds",
    category: "Home & Kitchen",
    region: "US",
    creatives: 17,
    creators: 4,
  },
  {
    id: "4",
    shop_name: "StyleNest Apparel",
    category: "Fashion",
    region: "US",
    creatives: 15,
    creators: 4,
  },
  {
    id: "5",
    shop_name: "TechTok Gadgets",
    category: "Consumer Electronics",
    region: "US",
    creatives: 14,
    creators: 4,
  },
];

export const meta = () => {
  return [{ title: "Settings | BluePrintAI" }];
};

function normalizeShop(shop, index = 0) {
  const rawId = shop.id || shop.shop_id || shop.shopId || String(index + 1);

  const numericId = String(rawId).includes("demo_shop_")
    ? String(Number(String(rawId).replace("demo_shop_", "")))
    : String(rawId);

  return {
    ...shop,
    id: numericId,
    shop_name: shop.shop_name || shop.name || `Shop ${numericId}`,
    category: shop.category || shop.industry || "TikTok Shop",
    region: shop.region || "US",
    creatives:
      shop.creative_count ||
      shop.creatives_count ||
      shop.total_creatives ||
      shop.creatives ||
      shop.summary?.total_creatives ||
      0,
    creators:
      shop.creator_count ||
      shop.creators_count ||
      shop.total_creators ||
      shop.creators ||
      shop.summary?.total_creators ||
      0,
  };
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getLocalStorageItem(key) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function getStoredUser() {
  if (typeof window === "undefined") return {};
  return safeJsonParse(localStorage.getItem("user"), {});
}

function getStoredSelectedShop() {
  if (typeof window === "undefined") return null;
  return safeJsonParse(localStorage.getItem("selectedShop"), null);
}

function getSafeSelectedShopId() {
  if (typeof window === "undefined") return "1";
  return getSelectedShopId();
}

function getSafeStoredShopName() {
  if (typeof window === "undefined") return "BlueprintAI";
  return getStoredShopName();
}

function isDemoUser(user) {
  return user?.is_demo === true;
}

function getAllowedDemoShopIds(user) {
  return Array.isArray(user?.shop_ids) ? user.shop_ids.map(Number) : [];
}

function filterAllowedDemoShops(shops, user) {
  const allowed = new Set(getAllowedDemoShopIds(user));
  return shops.filter((shop) => allowed.has(Number(shop.id || shop.shop_id)));
}

function getRealUserShop(user) {
  const storedShop = getStoredSelectedShop();

  const rawId =
    storedShop?.id ||
    storedShop?.shop_id ||
    user?.shop_id ||
    getLocalStorageItem("selectedShopId") ||
    getLocalStorageItem("shop_id");

  if (!rawId) return null;

  return normalizeShop({
    id: rawId,
    shop_id: rawId,
    shop_name:
      storedShop?.shop_name ||
      storedShop?.name ||
      user?.shop_name ||
      "My TikTok Shop",
    name:
      storedShop?.name ||
      storedShop?.shop_name ||
      user?.shop_name ||
      "My TikTok Shop",
    category: storedShop?.category || "TikTok Shop",
    region: storedShop?.region || "US",
    currency: storedShop?.currency || "USD",
  });
}

export default function SettingsRoute() {
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("1");
  const [selectedShopName, setSelectedShopName] = useState("BlueprintAI");
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [loadingShops, setLoadingShops] = useState(false);
  const [tiktokConnection, setTiktokConnection] = useState({
    connected: false,
  });
  const [tiktokStatus, setTiktokStatus] = useState(null);
  const [connectingTikTok, setConnectingTikTok] = useState(false);
  const [demoConnectingTikTok, setDemoConnectingTikTok] = useState(false);
  const [disconnectingTikTok, setDisconnectingTikTok] = useState(false);

  useEffect(() => {
    setSelectedShopId(getSafeSelectedShopId());
    setSelectedShopName(getSafeStoredShopName());

    if (typeof window === "undefined") return;

    const value = new URLSearchParams(window.location.search).get("tiktok");
    setTiktokStatus(["connected", "error", "pending"].includes(value) ? value : null);
  }, []);

  useEffect(() => {
    async function loadShops() {
      setLoadingShops(true);
      const user = getStoredUser();

      try {
        if (isDemoUser(user)) {
          let demoShops = FALLBACK_SHOPS;

          try {
            const res = await fetch(`${API_BASE}/demo/shops`, {
              headers: getAccountAuthHeaders(),
            });
            if (res.ok) {
              const data = await res.json();
              const list = Array.isArray(data) ? data : data.shops || [];
              demoShops = list.length
                ? list.map((shop, index) => normalizeShop(shop, index))
                : FALLBACK_SHOPS;
            }
          } catch {
            demoShops = FALLBACK_SHOPS;
          }

          const allowedShops = filterAllowedDemoShops(demoShops, user);
          setShops(allowedShops);

          const currentSelectedShopId = getSafeSelectedShopId();
          const stillAllowed = allowedShops.some(
            (shop) => String(shop.id) === String(currentSelectedShopId)
          );

          if (!stillAllowed && allowedShops[0]) {
            setSelectedShop(allowedShops[0]);
            setSelectedShopId(String(allowedShops[0].id));
            setSelectedShopName(allowedShops[0].shop_name);
          }

          return;
        }

        const realShop = getRealUserShop(user);
        setShops(realShop ? [realShop] : []);

        if (realShop) {
          setSelectedShopId(String(realShop.id));
          setSelectedShopName(realShop.shop_name);
        }
      } finally {
        setLoadingShops(false);
      }
    }

    loadShops();
  }, []);

  async function loadTikTokConnection() {
    try {
      const res = await fetch(`${API_BASE}/tiktok/oauth/status`, {
        headers: getAccountAuthHeaders(),
      });

      if (res.ok) {
        setTiktokConnection(await res.json());
        return;
      }
    } catch {
      // Fall through to disconnected state.
    }

    setTiktokConnection({
      connected: false,
      mode: "none",
      message: "TikTok Shop status is unavailable right now.",
      requires_seller_account: true,
      requires_development_shop: true,
    });
  }

  useEffect(() => {
    loadTikTokConnection();
  }, []);

  const activeShop = useMemo(() => {
    return shops.find((shop) => String(shop.id) === String(selectedShopId));
  }, [shops, selectedShopId]);

  function handleSelectShop(shop) {
    const user = getStoredUser();

    if (
      isDemoUser(user) &&
      !getAllowedDemoShopIds(user).includes(Number(shop.id))
    ) {
      return;
    }

    if (!isDemoUser(user)) {
      const realShop = getRealUserShop(user);

      if (!realShop || String(realShop.id) !== String(shop.id)) {
        return;
      }
    }

    setSelectedShop(shop);
    setSelectedShopId(String(shop.id));
    setSelectedShopName(shop.shop_name);
    setShopModalOpen(false);
  }

  function handleLogout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("demoUser");
      localStorage.removeItem("isAuthenticated");
    }

    navigate("/auth/login");
  }

  async function handleConnectTikTokShop() {
    setConnectingTikTok(true);
    setTiktokStatus(null);

    try {
      const res = await fetch(`${API_BASE}/tiktok/oauth/start`, {
        headers: getAccountAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok || !data.auth_url) {
        throw new Error(data.error || "Could not start TikTok OAuth");
      }

      const requiredParts = ["app_key=", "tts_state=", "redirect_uri="];

      if (!requiredParts.every((part) => data.auth_url.includes(part))) {
        throw new Error("TikTok OAuth URL is missing required parameters");
      }

      if (typeof window === "undefined") return;

      window.location.assign(data.auth_url);
      window.setTimeout(() => setConnectingTikTok(false), 3000);
    } catch {
      setConnectingTikTok(false);
      setTiktokStatus("error");
    }
  }

  async function handleDemoConnectTikTokShop() {
    setDemoConnectingTikTok(true);
    setTiktokStatus(null);

    try {
      const res = await fetch(`${API_BASE}/tiktok/oauth/demo-connect`, {
        method: "POST",
        headers: getAccountAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not enable demo TikTok data");
      }

      setTiktokConnection(data);
      setTiktokStatus("demo");
    } catch {
      setTiktokStatus("error");
    } finally {
      setDemoConnectingTikTok(false);
    }
  }

  async function handleDisconnectTikTokShop() {
    setDisconnectingTikTok(true);
    setTiktokStatus(null);

    try {
      const res = await fetch(`${API_BASE}/tiktok/oauth/disconnect`, {
        method: "POST",
        headers: getAccountAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not disconnect TikTok Shop");
      }

      setTiktokConnection(data);
      setTiktokStatus("disconnected");
    } catch {
      setTiktokStatus("error");
    } finally {
      setDisconnectingTikTok(false);
    }
  }

  const tiktokMode =
    tiktokConnection.mode || (tiktokConnection.connected ? "live" : "none");

  const tiktokStatusLabel =
    tiktokMode === "live"
      ? "Connected to TikTok Shop"
      : tiktokMode === "demo"
        ? "Demo TikTok Shop data enabled"
        : tiktokStatus === "pending"
          ? "Authorization pending"
          : "Not connected";

  const tiktokStatusTone =
    tiktokMode === "live"
      ? "bg-emerald-500/15 text-emerald-300"
      : tiktokMode === "demo"
        ? "bg-cyan-500/15 text-cyan-200"
        : tiktokStatus === "pending"
          ? "bg-amber-500/15 text-amber-200"
          : "bg-slate-700/70 text-slate-300";

  const tiktokStatusMessage =
    tiktokStatus === "pending"
      ? "Authorization pending: requires real seller shop or TikTok Development Shop Sandbox."
      : tiktokConnection.message ||
        "Connect TikTok Shop to sync seller data into BlueprintAI.";

  const tiktokBadgeLabel =
    tiktokMode === "live"
      ? "Live"
      : tiktokMode === "demo"
        ? "Demo"
        : tiktokStatus === "pending"
          ? "Pending"
          : "Not Connected";

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
              Manage your BlueprintAI workspace, active shop, and video analysis
              preferences.
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
                  Identity and goals for this workspace.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Workspace Name</span>
                <span className="font-bold">BlueprintAI</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Main Platform</span>
                <span className="font-bold">TikTok Shop</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400">Primary Goal</span>
                <span className="font-bold">Creative Intelligence</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Account Type</span>
                <span className="font-bold">MVP Testing</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                ↗
              </div>

              <div>
                <h2 className="text-2xl font-black">TikTok Shop Connection</h2>
                <p className="text-slate-400">
                  Connect your seller account for live commerce data.
                </p>
              </div>
            </div>

            {tiktokStatus === "connected" && (
              <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 font-bold text-emerald-200">
                TikTok Shop connected successfully.
              </div>
            )}

            {tiktokStatus === "demo" && (
              <div className="mb-5 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4 font-bold text-cyan-100">
                Demo TikTok Shop data is enabled.
              </div>
            )}

            {tiktokStatus === "disconnected" && (
              <div className="mb-5 rounded-2xl border border-slate-600 bg-slate-900/70 px-5 py-4 font-bold text-slate-200">
                TikTok Shop disconnected.
              </div>
            )}

            {tiktokStatus === "error" && (
              <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 font-bold text-red-200">
                TikTok Shop could not be connected. Please try again.
              </div>
            )}

            {tiktokStatus === "pending" && (
              <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 font-bold text-amber-100">
                Authorization pending: requires a real TikTok Shop seller
                account or TikTok Development Shop Sandbox.
              </div>
            )}

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
                TikTok Shop OAuth is implemented, but final authorization
                requires either a real registered TikTok Shop seller account or a
                TikTok Development Shop test seller account. While sandbox
                access is pending, you can use demo TikTok Shop data.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConnectTikTokShop}
                disabled={connectingTikTok}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-black text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectingTikTok
                  ? "Opening TikTok..."
                  : "Connect TikTok Shop"}
              </button>

              <button
                type="button"
                onClick={handleDemoConnectTikTokShop}
                disabled={demoConnectingTikTok}
                className="rounded-2xl border border-cyan-400/60 bg-cyan-500/10 px-6 py-3 font-black text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {demoConnectingTikTok
                  ? "Enabling Demo..."
                  : "Use Demo TikTok Shop Data"}
              </button>

              <button
                type="button"
                onClick={handleDisconnectTikTokShop}
                disabled={
                  disconnectingTikTok ||
                  (!tiktokConnection.connected && tiktokMode === "none")
                }
                className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300 transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disconnectingTikTok ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <h3 className="text-lg font-black">
                Current TikTok testing status
              </h3>

              <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                {[
                  "OAuth route working",
                  "Seller authorization requires TikTok Shop seller account or Development Shop",
                  "Sandbox request pending with TikTok Partner Support",
                  "Demo data can be used until access is approved",
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
                  The shop currently powering your account data.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">
                    {activeShop?.shop_name ||
                      (shops.length ? selectedShopName : "No shop connected")}
                  </h3>

                  <p className="mt-1 text-slate-400">
                    {shops.length
                      ? `${activeShop?.category || "TikTok Shop"} · ${
                          activeShop?.region || "US"
                        }`
                      : "Create a shop through onboarding to start using workspace data."}
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-300">
                  Connected
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShopModalOpen(true)}
              className="mt-5 rounded-2xl bg-cyan-500 px-6 py-3 font-black text-white transition hover:bg-cyan-400"
            >
              Manage Shops
            </button>

            <p className="mt-4 text-sm text-slate-400">
              One account can manage multiple shops, but BlueprintAI
              personalizes pages around one active shop at a time.
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

            <div className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-slate-400">
                  Analysis Depth
                </span>

                <select className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 font-bold outline-none">
                  <option>Standard Analysis</option>
                  <option>Deep Creative Breakdown</option>
                  <option>Fast Summary</option>
                </select>
              </label>

              <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                <div>
                  <p className="font-black">Auto-save analyzed videos</p>
                  <p className="text-sm text-slate-400">
                    Save results to the Creative Library automatically.
                  </p>
                </div>

                <div className="h-7 w-14 rounded-full bg-cyan-500 p-1">
                  <div className="ml-auto h-5 w-5 rounded-full bg-slate-950" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black">Email summaries</p>
                  <p className="text-sm text-slate-400">
                    Get a weekly digest of new insights.
                  </p>
                </div>

                <div className="h-7 w-14 rounded-full bg-slate-700 p-1">
                  <div className="h-5 w-5 rounded-full bg-slate-950" />
                </div>
              </div>
            </div>
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
                <p className="text-slate-400">Signed in to BlueprintAI.</p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300 hover:border-red-400 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      </div>

      {shopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-slate-700 bg-[#0b1322] p-7 shadow-2xl">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">
                  Shop Management
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Choose Active Shop
                </h2>

                <p className="mt-2 text-slate-400">
                  Switching shops updates the data shown across Dashboard,
                  Recommendations, Creators, Ad Briefs, and Blueprint Creation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShopModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 font-black text-slate-300 hover:border-cyan-400"
              >
                ✕
              </button>
            </div>

            {loadingShops ? (
              <div className="rounded-2xl border border-slate-800 p-6 text-slate-300">
                Loading shops...
              </div>
            ) : shops.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 p-6 text-slate-300">
                No shop is available for this account yet.
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {shops.map((shop) => {
                  const isActive = String(shop.id) === String(selectedShopId);

                  return (
                    <button
                      type="button"
                      key={shop.id}
                      onClick={() => handleSelectShop(shop)}
                      className={`rounded-3xl border p-5 text-left transition ${
                        isActive
                          ? "border-cyan-400 bg-cyan-950/25"
                          : "border-slate-800 bg-slate-950/40 hover:border-cyan-700"
                      }`}
                    >
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-black">
                            {shop.shop_name}
                          </h3>

                          <p className="mt-1 text-slate-400">
                            {shop.category} · {shop.region}
                          </p>
                        </div>

                        {isActive && (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-black text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-800 p-4">
                          <p className="text-sm text-slate-400">Creatives</p>
                          <p className="mt-1 text-xl font-black">
                            {shop.creatives}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 p-4">
                          <p className="text-sm text-slate-400">Creators</p>
                          <p className="mt-1 text-xl font-black">
                            {shop.creators}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleConnectTikTokShop}
                disabled={connectingTikTok}
                className="rounded-2xl bg-cyan-500 px-6 py-3 font-black text-white hover:bg-cyan-400"
              >
                {connectingTikTok ? "Opening TikTok..." : "+ Connect New Shop"}
              </button>

              <button
                type="button"
                onClick={() => setShopModalOpen(false)}
                className="rounded-2xl border border-slate-700 px-6 py-3 font-black text-slate-300 hover:border-cyan-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
