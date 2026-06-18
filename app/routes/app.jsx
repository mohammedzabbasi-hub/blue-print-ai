import { useState } from "react";
import { Link, Outlet, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import {
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
  listWorkspaceRequests,
  loadTikTokConnection,
} from "../models/blueprint.server";
import {
  billingBypassed,
  billingRequired,
  getAppHandleFromConfig,
  getPlanSelectionUrl,
} from "../utils/billing.server";
import "../styles/blueprint.css";

export const loader = async ({ request }) => {
  const { billing, redirect, session } = await authenticate.admin(request);
  const appHandle = getAppHandleFromConfig();
  const shouldRequireBilling = billingRequired();
  const shouldBypassBilling = billingBypassed();
  let hasActivePayment = false;

  if (shouldRequireBilling) {
    const paymentStatus = await billing.check();
    hasActivePayment = paymentStatus.hasActivePayment;
  }

  if (shouldRequireBilling && !shouldBypassBilling && !hasActivePayment) {
    if (!appHandle) {
      throw new Response(
        "Shopify billing is required, but SHOPIFY_APP_HANDLE or shopify.app.toml handle is not configured.",
        { status: 503 },
      );
    }

    const planSelectionUrl = getPlanSelectionUrl(session.shop, appHandle);

    return redirect(planSelectionUrl, { target: "_parent" });
  }

  const [briefs, creatives, analyses, blueprints, requests, tiktokConnection] =
    await Promise.all([
      listSavedBriefs(session.shop, 4),
      listSavedCreatives(session.shop, 4),
      listVideoAnalyses(session.shop, 4),
      listRevenueBlueprints(session.shop, 4),
      listWorkspaceRequests(session.shop, 4),
      loadTikTokConnection(session.shop),
    ]);
  const notifications = buildNotifications({
    briefs,
    creatives,
    analyses,
    blueprints,
    requests,
    tiktokConnection,
  });

  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    billingStatus: {
      appHandle,
      bypassed: shouldBypassBilling,
      hasActivePayment,
      required: shouldRequireBilling,
    },
    notifications,
  };
};

const navItems = [
  { to: "/app", label: "Home", icon: "□" },
  { to: "/app/creative-library", label: "Creatives", icon: "▱" },
  { to: "/app/recommendations", label: "Recommendations", icon: "✓" },
  { to: "/app/ad-briefs", label: "Ad Briefs", icon: "✎" },
  { to: "/app/revenue-blueprint", label: "Revenue Blueprint", icon: "↗" },
  { to: "/app/settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const { apiKey, shop, billingStatus, notifications } = useLoaderData();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div className="bp-app-frame">
        <aside className="bp-sidebar" aria-label="BluePrintAI navigation">
          <Link to="/app" className="bp-brand">
            <span className="bp-brand-mark">✦</span>
            <span>
              <strong>BluePrintAI</strong>
              <small>Creative intelligence</small>
            </span>
          </Link>

          <nav className="bp-side-nav">
            {navItems.map((item) => {
              const active =
                location.pathname === item.to ||
                (item.to !== "/app" && location.pathname.startsWith(`${item.to}/`));

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={active ? "bp-side-link bp-side-link-active" : "bp-side-link"}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="bp-sidebar-note">
            <span>{billingStatus.bypassed ? "Development workspace" : "Merchant workspace"}</span>
            <p>
              {billingStatus.bypassed
                ? "Billing checks are bypassed in this environment."
                : "Billing is checked through Shopify."}
            </p>
          </div>
        </aside>

        <div className="bp-main-frame">
          <header className="bp-topbar">
            <button
              className="bp-topbar-menu"
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((value) => !value)}
            >
              ☰
            </button>
            <div className="bp-topbar-store">
              <span className="bp-topbar-store-icon" aria-hidden="true">▢</span>
              <div>
                <span>Active store</span>
                <strong>{shop}</strong>
              </div>
            </div>
            <form
              className="bp-topbar-search"
              method="get"
              action="/app/search"
              role="search"
              onSubmit={(event) => {
                if (!searchQuery.trim()) event.preventDefault();
              }}
            >
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search products, creatives, briefs, and recommendations"
                name="q"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products, creatives, briefs..."
                type="search"
                value={searchQuery}
              />
            </form>
            <button
              className="bp-topbar-bell"
              type="button"
              aria-label={`${notifications.length} recent activity items`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              ♢
              {notifications.length > 0 && (
                <span className="bp-notification-count">{notifications.length}</span>
              )}
            </button>
          </header>

          {mobileNavOpen && (
            <nav className="bp-mobile-nav-panel" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {notificationsOpen && (
            <div className="bp-notification-panel">
              <header>
                <span>Recent activity</span>
                <strong>Workspace updates</strong>
              </header>
              {notifications.length === 0 ? (
                <p>No recent briefs, analyses, blueprints, exports, or integration updates.</p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <Link to={item.href} onClick={() => setNotificationsOpen(false)}>
                        <span>{item.label}</span>
                        <strong>{item.title}</strong>
                        <small>{formatNotificationTime(item.createdAt)}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <main className="bp-shell">
            <Outlet />
          </main>
        </div>
      </div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

function buildNotifications({
  briefs = [],
  creatives = [],
  analyses = [],
  blueprints = [],
  requests = [],
  tiktokConnection,
}) {
  const items = [
    ...briefs.map((brief) => ({
      id: `brief-${brief.id}`,
      label: "Brief saved",
      title: `${brief.productTitle} · ${brief.angle}`,
      href: `/app/ad-briefs?productId=${encodeURIComponent(brief.productId)}&briefId=${encodeURIComponent(brief.id)}`,
      createdAt: brief.createdAt,
    })),
    ...creatives.map((creative) => ({
      id: `creative-${creative.id}`,
      label: creative.payload?.mediaUrl ? "Creative saved" : "Analysis saved",
      title: creative.title,
      href: `/app/creative-library?creativeId=${encodeURIComponent(creative.id)}`,
      createdAt: creative.createdAt,
    })),
    ...analyses.map((analysis) => ({
      id: `analysis-${analysis.id}`,
      label: analysis.savedToLibrary ? "Analysis added to library" : "Analysis saved",
      title: analysis.productTitle,
      href: "/app/video-analysis",
      createdAt: analysis.createdAt,
    })),
    ...blueprints.map((blueprint) => ({
      id: `blueprint-${blueprint.id}`,
      label: "Revenue blueprint generated",
      title: blueprint.payload?.context?.generatedFor || "7-day growth plan",
      href: `/app/revenue-blueprint?blueprintId=${encodeURIComponent(blueprint.id)}`,
      createdAt: blueprint.createdAt,
    })),
    ...requests.map((request) => ({
      id: `request-${request.id}`,
      label: request.type === "data_export" ? "Data export requested" : "Workspace request",
      title: requestLabel(request.type),
      href: "/app/settings",
      createdAt: request.createdAt,
    })),
  ];

  if (tiktokConnection?.connectedAt || tiktokConnection?.disconnectedAt) {
    items.push({
      id: `tiktok-${tiktokConnection.connected ? "connected" : "disconnected"}-${tiktokConnection.connectedAt || tiktokConnection.disconnectedAt}`,
      label: tiktokConnection.connected ? "TikTok connected" : "TikTok disconnected",
      title: tiktokConnection.connected
        ? tiktokConnection.sellerName || tiktokConnection.sellerId || "TikTok account connected"
        : "TikTok connection metadata cleared",
      href: "/app/settings",
      createdAt: tiktokConnection.connectedAt || tiktokConnection.disconnectedAt,
    });
  }

  return items
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);
}

function formatNotificationTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function requestLabel(type) {
  return String(type)
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
