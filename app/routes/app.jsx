/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Link,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { isWorkspaceOnboarded } from "../models/blueprint.server";
import {
  billingBypassed,
  billingRequired,
  getAppHandleFromConfig,
  getPlanSelectionUrl,
} from "../utils/billing.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { getLocalDemoAccess } from "../utils/demo-access.server";
import AssistantWidget from "../components/AssistantWidget";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const { explicitDemoMode, useDemoWorkspace: shouldUseDemoBypass } =
    getLocalDemoAccess(request);

  if (shouldUseDemoBypass) {
    const demoShop = "blueprintai-test-store.myshopify.com";
    const appHandle = getAppHandleFromConfig();
    await redirectToOnboardingIfNeeded({
      pathname: url.pathname,
      search: url.search,
      shop: demoShop,
      skipOnboarding: explicitDemoMode,
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: demoShop,
      billingStatus: {
        appHandle,
        bypassed: true,
        demoMode: explicitDemoMode,
        hasActivePayment: true,
        required: false,
        skipAppProvider: true,
      },
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

  await redirectToOnboardingIfNeeded({
    pathname: url.pathname,
    search: url.search,
    shop: session.shop,
    skipOnboarding: false,
  });

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    billingStatus: {
      appHandle,
      bypassed: shouldBypassBilling,
      demoMode: false,
      hasActivePayment,
      required: shouldRequireBilling,
      skipAppProvider: false,
    },
  };
};

const navItems = [
  { to: "/app/dashboard", label: "Command Center", icon: "grid" },
  { to: "/app/campaigns", label: "Campaigns", icon: "activity" },
  { to: "/app/creative-library", label: "Creative Library", icon: "layers" },
  { to: "/app/video-analysis", label: "AI Review Studio", icon: "video" },
  { to: "/app/ad-briefs", label: "Creative Briefs", icon: "brief" },
  {
    to: "/app/revenue-blueprint",
    label: "Revenue Blueprint",
    icon: "activity",
  },
  { to: "/app/creators", label: "Creators", icon: "users" },
  { to: "/app/data-import", label: "Data Import", icon: "database" },
  { to: "/app/connections", label: "Connections", icon: "plug" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

export default function App() {
  const { apiKey, billingStatus } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarPinnedOpen, setIsSidebarPinnedOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarExpanded = isSidebarPinnedOpen || isSidebarHovered;

  const shell = (
    <div
      className={
        isSidebarExpanded
          ? "bp-app-frame bp-sidebar-expanded"
          : "bp-app-frame bp-sidebar-collapsed"
      }
    >
        <ShellSidebar
          expanded={isSidebarExpanded}
          location={location}
          navigate={navigate}
          onHoverChange={setIsSidebarHovered}
          onTogglePinned={() => setIsSidebarPinnedOpen((value) => !value)}
          pinned={isSidebarPinnedOpen}
        />

        <div className="bp-main-frame">
          <main className="bp-shell">
            {billingStatus.demoMode && (
              <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100" role="status">
                <span className="block text-xs font-black uppercase tracking-[0.16em]">
                  Demo workspace · sample data
                </span>
                <span className="mt-1 block">
                  Products, CSV imports, uploads, metrics, recommendations, briefs,
                  blueprints, and saved reviews in this local demo are sample data—not
                  live merchant or connected-platform results.
                </span>
              </div>
            )}
            <Outlet />
          </main>
        </div>
        <AssistantWidget />
      </div>
  );

  if (billingStatus.skipAppProvider) {
    return shell;
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      {shell}
    </AppProvider>
  );
}

function ShellSidebar({
  expanded,
  location,
  navigate,
  onHoverChange,
  onNavigate,
  onTogglePinned,
  pinned,
  mobile = false,
}) {
  return (
    <aside
      className={mobile ? "bp-sidebar bp-sidebar-mobile" : "bp-sidebar"}
      aria-label="BluePrintAI navigation"
      data-expanded={expanded ? "true" : "false"}
      data-pinned={pinned ? "true" : "false"}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onHoverChange?.(false);
        }
      }}
      onFocusCapture={() => onHoverChange?.(true)}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <button
        type="button"
        className="bp-brand"
        aria-expanded={expanded}
        aria-label={pinned ? "Collapse sidebar" : "Expand sidebar"}
        onClick={onTogglePinned}
      >
        <span className="bp-brand-mark">
          <ShellIcon name="sparkles" />
        </span>
        <span className="bp-brand-copy">
          <strong>BluePrintAI</strong>
          <small>Creative OS</small>
        </span>
      </button>

      <nav className="bp-side-nav">
        {navItems.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to !== "/app" && location.pathname.startsWith(`${item.to}/`));
          const href = withEmbeddedRouteParams(item.to, location.search);

          return (
            <Link
              key={item.to}
              to={href}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.shiftKey
                ) {
                  return;
                }

                event.preventDefault();
                onNavigate?.();
                navigate?.(href);
              }}
              aria-current={active ? "page" : undefined}
              aria-label={`Open ${item.label}`}
              data-sidebar-route={item.to}
              title={expanded ? undefined : item.label}
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

    </aside>
  );
}

async function redirectToOnboardingIfNeeded({
  pathname,
  search = "",
  shop,
  skipOnboarding = false,
}) {
  if (skipOnboarding || isOnboardingAllowedPath(pathname)) return;

  const onboarded = await isWorkspaceOnboarded(shop);

  if (!onboarded) {
    const next = `${pathname}${search || ""}`;
    throw redirect(
      withEmbeddedRouteParams(
        `/app/onboarding?next=${encodeURIComponent(next)}`,
        search,
      ),
    );
  }
}

function isOnboardingAllowedPath(pathname) {
  return (
    pathname === "/app" ||
    pathname === "/app/onboarding" ||
    pathname === "/app/support" ||
    pathname === "/app/privacy" ||
    pathname === "/app/terms" ||
    pathname === "/app/cookies" ||
    pathname === "/app/acceptable-use" ||
    pathname === "/app/refund-policy" ||
    pathname === "/app/ai-disclaimer" ||
    pathname === "/app/copyright" ||
    pathname === "/app/contact" ||
    pathname === "/app/data-deletion"
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

function ShellIcon({ name, className = "" }) {
  if (name === "sparkles") {
    return (
      <span className={`bp-shell-icon ${className}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M10 3.5 12.2 8.8 17.5 11l-5.3 2.2L10 18.5l-2.2-5.3L2.5 11l5.3-2.2L10 3.5Z" />
          <path d="M18.5 4.5v4" />
          <path d="M16.5 6.5h4" />
          <circle cx="5.2" cy="18.1" r="1.4" />
        </svg>
      </span>
    );
  }

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
    menu: "☰",
    plug: "⌁",
    search: "⌕",
    settings: "⚙",
    users: "♙",
    video: "▻",
  };

  return (
    <span className={`bp-shell-icon ${className}`} aria-hidden="true">
      {glyphs[name] || glyphs.sparkles}
    </span>
  );
}
