import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  listSavedBriefs,
  listSavedCreatives,
  loadMerchantData,
  buildRecommendations,
} from "../models/blueprint.server";
import { buildImportedDashboard } from "../models/importedData.server";

import TopBar from "../components/dashboard/TopBar";
import StatCards from "../components/dashboard/StatCards";
import PerformanceChart from "../components/dashboard/PerformanceChart";
import TopCreatives from "../components/dashboard/TopCreatives";
import PatternInsights from "../components/dashboard/PatternInsights";
import NextActions from "../components/dashboard/NextActions";

export const meta = () => {
  return [{ title: "Dashboard | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const [merchantData, savedBriefs, savedCreatives, imported] = await Promise.all([
    loadMerchantData(admin, session),
    listSavedBriefs(session.shop, 50),
    listSavedCreatives(session.shop, 50),
    buildImportedDashboard(session.shop),
  ]);

  const recommendations = buildRecommendations(merchantData.products, merchantData.orders);

  return {
    shopName: merchantData.shop?.name || session.shop,
    imported,
    totals: {
      ...imported.totals,
      creatives: imported.totals.creatives || savedCreatives.length,
      briefs: savedBriefs.length,
      recommendations: recommendations.length,
    },
  };
};

export default function DashboardRoute() {
  const { shopName, imported, totals } = useLoaderData();
  const [dateRange, setDateRange] = useState("30d");

  const dashboardData = {
    shop: { shop_name: shopName, name: shopName },
    totals,
    patterns: imported.patterns,
    top_creatives: imported.topCreatives,
    leaderboard: imported.topCreatives,
    series: imported.series,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <TopBar dateRange={dateRange} onDateRangeChange={setDateRange} />

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {shopName} Dashboard
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Creative intelligence, performance patterns, and next actions
            built from your imported shop data.
          </p>
        </div>

        <StatCards data={dashboardData} />

        {!imported.hasImportedData && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-[16px] font-semibold text-foreground mb-1">
              No shop performance data imported yet
            </h2>

            <p className="text-sm text-muted-foreground">
              Import a creators, creatives, or metrics CSV to populate views,
              orders, revenue, CTR, and top creatives below.
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <PerformanceChart data={dashboardData} dateRange={dateRange} />
          </div>

          <div>
            <PatternInsights data={dashboardData} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TopCreatives data={dashboardData} />
          </div>

          <div>
            <NextActions data={dashboardData} />
          </div>
        </div>
      </div>
    </div>
  );
}
