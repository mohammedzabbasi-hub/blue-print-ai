import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import TopBar from "../components/dashboard/TopBar";
import StatCards from "../components/dashboard/StatCards";
import PerformanceChart from "../components/dashboard/PerformanceChart";
import TopCreatives from "../components/dashboard/TopCreatives";
import PatternInsights from "../components/dashboard/PatternInsights";
import NextActions from "../components/dashboard/NextActions";

import { getEngineAnalysis } from "../services/engineApi";
import { getSelectedShopId } from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Dashboard | BluePrintAI" }];
};

function safeJsonParse(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getStoredUser() {
  if (typeof window === "undefined") return {};
  return safeJsonParse(localStorage.getItem("user"), {});
}

function getStoredSelectedShop() {
  if (typeof window === "undefined") return {};
  return safeJsonParse(localStorage.getItem("selectedShop"), {});
}

function isDemoUser(user = getStoredUser()) {
  return user?.is_demo === true;
}

function toShopId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getAllowedDemoShopIds(user = getStoredUser()) {
  const ids = Array.isArray(user?.shop_ids) ? user.shop_ids : [];
  return ids.map(toShopId).filter(Boolean);
}

function getLocalStorageItem(key) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function getSafeSelectedShopId() {
  if (typeof window === "undefined") return null;
  return getSelectedShopId();
}

function getDashboardShopId(
  user = getStoredUser(),
  selectedShop = getStoredSelectedShop()
) {
  if (isDemoUser(user)) {
    const allowedIds = getAllowedDemoShopIds(user);

    const demoCandidates = [
      getSafeSelectedShopId(),
      selectedShop?.id,
      selectedShop?.shop_id,
      getLocalStorageItem("selectedShopId"),
      getLocalStorageItem("demoShopId"),
      getLocalStorageItem("shop_id"),
      getLocalStorageItem("connected_shop_id"),
    ];

    const selectedAllowedId = demoCandidates
      .map(toShopId)
      .find((id) => id && allowedIds.includes(id));

    return selectedAllowedId || allowedIds[0] || null;
  }

  const realCandidates = [
    getSafeSelectedShopId(),
    selectedShop?.id,
    selectedShop?.shop_id,
    getLocalStorageItem("connected_shop_id"),
    getLocalStorageItem("shop_id"),
    user?.shop_id,
    user?.shopId,
  ];

  return realCandidates.map(toShopId).find(Boolean) || null;
}

function itemMatchesSearch(item, query) {
  if (!query) return true;
  if (item === null || item === undefined) return false;

  if (typeof item === "string" || typeof item === "number") {
    return String(item).toLowerCase().includes(query);
  }

  if (Array.isArray(item)) {
    return item.some((entry) => itemMatchesSearch(entry, query));
  }

  if (typeof item === "object") {
    return Object.values(item).some((value) => itemMatchesSearch(value, query));
  }

  return false;
}

function cloneDashboardData(data) {
  if (!data) return data;

  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function filterDashboardData(data, search) {
  const query = search.trim().toLowerCase();

  if (!query || !data) return data;

  const clone = cloneDashboardData(data);

  function filterArrays(obj) {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      if (Array.isArray(value)) {
        obj[key] = value.filter((item) => itemMatchesSearch(item, query));
      } else if (value && typeof value === "object") {
        filterArrays(value);
      }
    });

    return obj;
  }

  return filterArrays(clone);
}

function buildEmptyDashboardData(user, selectedShop) {
  const shopName =
    selectedShop?.shop_name ||
    selectedShop?.name ||
    user?.shop_name ||
    user?.business_name ||
    "Your Shop";

  return {
    isEmptyState: true,
    shop: {
      id: selectedShop?.id || selectedShop?.shop_id || user?.shop_id || null,
      shop_name: shopName,
      name: shopName,
    },
    totals: {
      creatives: 0,
      analyses: 0,
      briefs: 0,
      recommendations: 0,
      views: 0,
      clicks: 0,
      orders: 0,
      revenue: 0,
      total_revenue: 0,
      avg_ctr: 0,
      ctr: 0,
      avg_roas: 0,
      roas: 0,
      conversion_rate: 0,
    },
    patterns: {
      hooks: {},
      creator_types: {},
      humor_styles: {},
      delivery_styles: {},
    },
    recommendations: [],
    next_actions: [],
    top_creatives: [],
    leaderboard: [],
    issues: [],
    strategy: {},
  };
}

function dashboardHasData(data) {
  const totals = data?.totals || {};

  const numericFields = [
    "creatives",
    "total_creatives",
    "views",
    "total_views",
    "clicks",
    "orders",
    "total_orders",
    "revenue",
    "total_revenue",
    "briefs",
    "recommendations",
  ];

  return (
    numericFields.some((field) => Number(totals[field] || 0) > 0) ||
    (data?.leaderboard || []).length > 0 ||
    (data?.top_creatives || []).length > 0 ||
    (data?.recommendations || []).length > 0 ||
    (data?.next_actions || []).length > 0
  );
}

export default function DashboardRoute() {
  const [dateRange, setDateRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [demoAccount, setDemoAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEmptyDashboard = dashboardData?.isEmptyState === true;

  const filteredDashboardData = useMemo(() => {
    return filterDashboardData(dashboardData, search);
  }, [dashboardData, search]);

  useEffect(() => {
    const currentUser = getStoredUser();
    const currentSelectedShop = getStoredSelectedShop();

    setDemoAccount(isDemoUser(currentUser));
    setShopId(getDashboardShopId(currentUser, currentSelectedShop));
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const currentUser = getStoredUser();
        const currentSelectedShop = getStoredSelectedShop();
        const currentDemoAccount = isDemoUser(currentUser);

        let nextDashboardData = null;

        if (!shopId) {
          if (currentDemoAccount) {
            setError("No allowed demo shop is available for this account.");
            return;
          }

          nextDashboardData = buildEmptyDashboardData(
            currentUser,
            currentSelectedShop
          );
        } else {
          const engineData = await getEngineAnalysis(shopId);

          const data = {
            ...engineData,
            shop: {
              id: engineData.shop_id,
              shop_name: engineData.shop_name,
              name: engineData.shop_name,
            },
            totals: engineData.totals || {},
            patterns: engineData.patterns || {},
            recommendations: engineData.strategy?.recommendations || [],
            next_actions: engineData.strategy?.recommendations || [],
            top_creatives: engineData.scored_creatives || [],
            leaderboard: engineData.scored_creatives || [],
            issues: engineData.issues || [],
            strategy: engineData.strategy || {},
          };

          nextDashboardData =
            !currentDemoAccount && !dashboardHasData(data)
              ? {
                  ...buildEmptyDashboardData(
                    currentUser,
                    currentSelectedShop
                  ),
                  ...data,
                  isEmptyState: true,
                }
              : data;
        }

        setDashboardData(nextDashboardData);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError(
          "Could not load dashboard data. Make sure the backend is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [demoAccount, shopId]);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <TopBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          search={search}
          onSearchChange={setSearch}
        />

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {dashboardData?.shop?.shop_name ||
              dashboardData?.shop?.name ||
              "BluePrintAI"}{" "}
            Dashboard
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            TikTok Shop creative intelligence, performance patterns, and next
            actions for this connected shop.
          </p>
        </div>

        {loading && (
          <div className="glass rounded-xl p-5 text-sm text-muted-foreground">
            Loading dashboard data...
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <StatCards data={dashboardData} />

            {isEmptyDashboard && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-[16px] font-semibold text-foreground mb-1">
                  No shop data yet
                </h2>

                <p className="text-sm text-muted-foreground">
                  Import data or upload creatives to populate your dashboard.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to="/app/data-import"
                    className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-400 transition-colors"
                  >
                    Import Data
                  </Link>

                  <Link
                    to="/app/video-analysis"
                    className="px-4 py-2 rounded-lg border border-white/10 text-slate-200 text-sm font-semibold hover:border-white/20 hover:text-white transition-colors"
                  >
                    Upload Creative
                  </Link>
                </div>
              </div>
            )}

            {!isEmptyDashboard && search.trim() && (
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-sm text-sky-200">
                Showing dashboard matches for &quot;{search}&quot;.
              </div>
            )}

            {!isEmptyDashboard && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <PerformanceChart
                      dateRange={dateRange}
                      data={dashboardData}
                    />
                  </div>

                  <div>
                    <PatternInsights data={filteredDashboardData} />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <TopCreatives data={filteredDashboardData} />
                  </div>

                  <div>
                    <NextActions data={filteredDashboardData} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
