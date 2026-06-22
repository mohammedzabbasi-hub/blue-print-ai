/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router";
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

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const isLocalDemoHost = ["localhost", "127.0.0.1", "::1"].includes(
    url.hostname,
  );

  const shouldUseDemoBypass =
    isLocalDemoHost ||
    process.env.NODE_ENV !== "production" ||
    process.env.DEV_BYPASS_SHOPIFY_AUTH === "true" ||
    url.searchParams.get("demo") === "1";

  if (shouldUseDemoBypass) {
    const demoShop = "blueprintai-test-store.myshopify.com";
    const appHandle = getAppHandleFromConfig();

    const [briefs, creatives, analyses, blueprints, requests, tiktokConnection] =
      await Promise.all([
        listSavedBriefs(demoShop, 4),
        listSavedCreatives(demoShop, 4),
        listVideoAnalyses(demoShop, 4),
        listRevenueBlueprints(demoShop, 4),
        listWorkspaceRequests(demoShop, 4),
        loadTikTokConnection(demoShop),
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
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: demoShop,
      billingStatus: {
        appHandle,
        bypassed: true,
        hasActivePayment: true,
        required: false,
      },
      notifications,
    };
  }

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
  {
    to: "/app/revenue-blueprint",
    label: "Revenue Blueprint",
    icon: "activity",
  },
  { to: "/app/creators", label: "Creators", icon: "users" },
  { to: "/app/data-import", label: "Data Import", icon: "database" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

export default function App() {
  const { apiKey, shop, billingStatus, notifications } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const closeMobileNav = () => setMobileNavOpen(false);
  const handleLogout = () => {
    if (typeof window !== "undefined") {
      [
        "token",
        "access_token",
        "authToken",
        "user",
        "selectedShop",
        "selectedShopId",
        "shop_id",
        "connected_shop_id",
        "selectedShopName",
        "connected_shop_name",
        "onboardingComplete",
      ].forEach((key) => window.localStorage.removeItem(key));
    }

    navigate(billingStatus.bypassed ? "/" : "/auth/login", { replace: true });
  };

  const shell = (
    <div className="bp-app-frame">
        <ShellSidebar location={location} onLogout={handleLogout} />

        <div className="bp-main-frame">
          <header className="bp-topbar">
            <button
              className="bp-topbar-menu"
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <ShellIcon name="menu" />
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
                <span className="bp-notification-count">
                  {notifications.length}
                </span>
              )}
            </button>
          </header>

          {mobileNavOpen && (
            <div
              className="bp-mobile-nav-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <button
                className="bp-mobile-nav-backdrop"
                type="button"
                aria-label="Close navigation"
                onClick={closeMobileNav}
              />

              <div className="bp-mobile-sidebar-wrap">
                <button
                  className="bp-mobile-nav-close"
                  type="button"
                  aria-label="Close navigation"
                  onClick={closeMobileNav}
                >
                  <ShellIcon name="close" />
                </button>

                <ShellSidebar
                  location={location}
                  onNavigate={closeMobileNav}
                  onLogout={handleLogout}
                  mobile
                />
              </div>
            </div>
          )}

          {notificationsOpen && (
            <div className="bp-notification-panel">
              <header>
                <span>Recent activity</span>
                <strong>Workspace updates</strong>
              </header>

              {notifications.length === 0 ? (
                <p>
                  No recent briefs, analyses, blueprints, exports, or
                  integration updates.
                </p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        onClick={() => setNotificationsOpen(false)}
                      >
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
  );

  if (billingStatus.bypassed) {
    return shell;
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      {shell}
    </AppProvider>
  );
}

function ShellSidebar({ location, onNavigate, onLogout, mobile = false }) {
  return (
    <aside
      className={mobile ? "bp-sidebar bp-sidebar-mobile" : "bp-sidebar"}
      aria-label="BluePrintAI navigation"
    >
      <Link to="/app" onClick={onNavigate} className="bp-brand">
        <span className="bp-brand-mark">
          <ShellIcon name="sparkles" />
        </span>
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
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                active ? "bp-side-link bp-side-link-active" : "bp-side-link"
              }
            >
              <ShellIcon name={item.icon} />
              <span className="bp-side-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="bp-sidebar-note">
        <span>
          <ShellIcon name="sparkles" />
          Workspace
        </span>
        <p>
          Connected to Shopify as the system of record for routing, auth,
          billing, and store context.
        </p>
      </div>

      <div className="bp-sidebar-footer-links">
        <Link to="/app/settings?panel=support" onClick={onNavigate}>
          Support
        </Link>
        <Link to="/app/settings?panel=privacy" onClick={onNavigate}>
          Privacy
        </Link>
        <Link to="/app/settings?panel=terms" onClick={onNavigate}>
          Terms
        </Link>
      </div>

      <div className="bp-sidebar-logout-form">
        <button
          className="bp-sidebar-logout"
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout?.();
          }}
        >
          <ShellIcon name="logout" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// Shopify needs React Router to catch some thrown responses,
// so that their headers are included in the response.
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
      href: `/app/ad-briefs?productId=${encodeURIComponent(
        brief.productId,
      )}&briefId=${encodeURIComponent(brief.id)}`,
      createdAt: brief.createdAt,
    })),
    ...creatives.map((creative) => ({
      id: `creative-${creative.id}`,
      label: creative.payload?.mediaUrl ? "Creative saved" : "Analysis saved",
      title: creative.title,
      href: `/app/creative-library?creativeId=${encodeURIComponent(
        creative.id,
      )}`,
      createdAt: creative.createdAt,
    })),
    ...analyses.map((analysis) => ({
      id: `analysis-${analysis.id}`,
      label: analysis.savedToLibrary
        ? "Analysis added to library"
        : "Analysis saved",
      title: analysis.productTitle,
      href: "/app/video-analysis",
      createdAt: analysis.createdAt,
    })),
    ...blueprints.map((blueprint) => ({
      id: `blueprint-${blueprint.id}`,
      label: "Revenue blueprint generated",
      title: blueprint.payload?.context?.generatedFor || "7-day growth plan",
      href: `/app/revenue-blueprint?blueprintId=${encodeURIComponent(
        blueprint.id,
      )}`,
      createdAt: blueprint.createdAt,
    })),
    ...requests.map((request) => ({
      id: `request-${request.id}`,
      label:
        request.type === "data_export"
          ? "Data export requested"
          : "Workspace request",
      title: requestLabel(request.type),
      href: "/app/settings",
      createdAt: request.createdAt,
    })),
  ];

  if (tiktokConnection?.connectedAt || tiktokConnection?.disconnectedAt) {
    items.push({
      id: `tiktok-${tiktokConnection.connected ? "connected" : "disconnected"}-${
        tiktokConnection.connectedAt || tiktokConnection.disconnectedAt
      }`,
      label: tiktokConnection.connected
        ? "TikTok connected"
        : "TikTok disconnected",
      title: tiktokConnection.connected
        ? tiktokConnection.sellerName ||
          tiktokConnection.sellerId ||
          "TikTok account connected"
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

  return (
    base
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || shop
  );
}

function ShellIcon({ name, className = "" }) {
  const glyphs = {
    activity: "〽",
    bag: "▢",
    bell: "♢",
    brief: "▤",
    check: "✓",
    close: "×",
    database: "◫",
    grid: "▦",
    layers: "▱",
    list: "☷",
    logout: "↪",
    menu: "☰",
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
