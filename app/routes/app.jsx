/* eslint-disable react/prop-types */
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
  { to: "/app", label: "Command Center", icon: "grid" },
  { to: "/app/creative-library", label: "Creative Library", icon: "layers" },
  { to: "/app/video-analysis", label: "AI Review Studio", icon: "video" },
  { to: "/app/ad-briefs", label: "Ad Briefs", icon: "brief" },
  { to: "/app/recommendations", label: "Recommendations", icon: "list" },
  { to: "/app/revenue-blueprint", label: "Revenue Blueprint", icon: "activity" },
  { to: "/app/creators", label: "Creators", icon: "users" },
  { to: "/app/data-import", label: "Data Import", icon: "database" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
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
              <small>Creative OS</small>
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
                  <ShellIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="bp-sidebar-note">
            <span>Workspace</span>
            <p>
              {billingStatus.bypassed
                ? "Development billing is bypassed; Shopify auth and sessions remain active."
                : "Billing, auth, and shop data stay scoped through Shopify."}
            </p>
          </div>
          <div className="bp-sidebar-footer-links">
            <Link to="/app/activity-log">Activity</Link>
            <Link to="/app/settings">Settings</Link>
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
              <ShellIcon className="bp-topbar-store-icon" name="bag" />
              <div>
                <span>Active shop</span>
                <strong>{formatShopName(shop)}</strong>
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
            <span className="bp-status-pill">
              <ShellIcon name={billingStatus.bypassed ? "sparkles" : "check"} />
              {billingStatus.bypassed ? "Demo" : "Live"}
            </span>
            <button
              className="bp-topbar-bell"
              type="button"
              aria-label={`${notifications.length} recent activity items`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              <ShellIcon name="bell" />
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

function formatShopName(shop = "") {
  const base = shop.replace(".myshopify.com", "").replace(/[-_]+/g, " ");
  return base
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || shop;
}

function ShellIcon({ name, className = "" }) {
  const glyphs = {
    activity: "〽",
    bag: "▢",
    bell: "♢",
    brief: "▤",
    check: "✓",
    database: "◫",
    grid: "▦",
    layers: "▱",
    list: "☷",
    search: "⌕",
    settings: "⚙",
    sparkles: "✣",
    users: "♙",
    video: "▻",
  };

  return (
    <span className={`bp-shell-icon ${className}`} aria-hidden="true">
      {glyphs[name] || glyphs.sparkles}
    </span>
  );
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
