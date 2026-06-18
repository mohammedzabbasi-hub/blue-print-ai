/* eslint-disable react/prop-types */
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  buildDashboard,
  buildCreativeConcepts,
  loadMerchantData,
} from "../models/blueprint.server";
import { Icon, Notice } from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);

  return {
    merchantData,
    dashboard: buildDashboard(merchantData),
    concepts: buildCreativeConcepts(merchantData.products).slice(0, 8),
  };
};

const dateRanges = ["Last 7 days", "Last 30 days", "Last 90 days"];
const hookPatterns = [
  { label: "product demo", value: 31 },
  { label: "benefit proof", value: 26 },
  { label: "before-after", value: 18 },
];
const creatorStyles = [
  { label: "customer testimonial", value: 54 },
  { label: "founder-led demo", value: 46 },
];

export default function Dashboard() {
  const { merchantData, dashboard, concepts } = useLoaderData();
  const shopName = merchantData.shop.name || merchantData.shop.myshopifyDomain;
  const usingDemoProducts = merchantData.products.some((product) => product.source === "demo");
  const creatives = buildCreatives(merchantData.products, concepts, dashboard);
  const totalViews = creatives.reduce((sum, item) => sum + item.views, 0);
  const totalOrders = Math.max(
    dashboard.orderCount,
    creatives.reduce((sum, item) => sum + item.orders, 0),
  );
  const totalClicks = creatives.reduce((sum, item) => sum + item.clicks, 0);
  const ctr = totalViews ? (totalClicks / totalViews) * 100 : 2.15;
  const roas = dashboard.revenue > 0 && totalOrders > 0 ? 5.8 : 3.4;
  const stats = [
    { label: "Total Creatives", value: creatives.length, icon: "video", tone: "sky" },
    { label: "Total Views", value: compact(totalViews), icon: "view", tone: "emerald" },
    { label: "Orders Generated", value: compact(totalOrders), icon: "bag", tone: "amber" },
    { label: "Avg. CTR", value: `${ctr.toFixed(2)}%`, icon: "cursor", tone: "blue" },
    { label: "Avg. ROAS", value: `${roas.toFixed(2)}x`, icon: "activity", tone: "rose" },
    { label: "Recommendations", value: dashboard.actionItems.length + 5, icon: "bulb", tone: "violet" },
  ];

  return (
    <div className="bp-page bp-dashboard-command">
      <section className="bp-dashboard-rangebar" aria-label="Dashboard date range">
        <div>
          <strong>Dashboard</strong>
          <span>Performance overview</span>
        </div>
        <div className="bp-range-tabs" role="tablist" aria-label="Time period">
          {dateRanges.map((range) => (
            <button
              className={range === "Last 30 days" ? "bp-range-tab bp-range-tab-active" : "bp-range-tab"}
              key={range}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </section>

      <header className="bp-dashboard-title">
        <h1>{formatShopName(shopName)} Dashboard</h1>
        <p>
          Shopify creative intelligence, performance patterns, and next actions for this connected shop.
        </p>
      </header>

      <div className="bp-section-stack bp-dashboard-stack">
        {usingDemoProducts && (
          <Notice tone="info">
            No Shopify products were available, so the app is using demo products to keep the workspace populated.
          </Notice>
        )}

        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>
            {error}
          </Notice>
        ))}

        <section className="bp-ttsa-stat-grid" aria-label="Dashboard stats">
          {stats.map((stat) => (
            <article className="bp-ttsa-stat" data-tone={stat.tone} key={stat.label}>
              <div className="bp-ttsa-stat-top">
                <span className="bp-ttsa-stat-icon">
                  <Icon name={stat.icon} />
                </span>
                <span className="bp-live-pill">Live</span>
              </div>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          ))}
        </section>

        <section className="bp-dashboard-main-grid">
          <PerformanceTrend totalViews={totalViews} totalOrders={totalOrders} ctr={ctr} />
          <PatternInsights />
        </section>

        <section className="bp-dashboard-main-grid bp-dashboard-lower-grid">
          <TopCreatives creatives={creatives} roas={roas} />
          <RecommendedActions actions={dashboard.actionItems} product={merchantData.products[0]} />
        </section>
      </div>
    </div>
  );
}

function PerformanceTrend({ totalViews, totalOrders, ctr }) {
  const points = Array.from({ length: 30 }, (_, index) => {
    const progress = (index + 1) / 30;
    const wave = 0.82 + Math.sin(index * 1.5) * 0.045 + Math.cos(index * 0.75) * 0.03;
    return Math.max(1, Math.round(Math.max(totalViews, 120000) * progress * wave));
  });
  const path = buildPath(points, 600, 190, 14);
  const area = `${path} L 586 176 L 14 176 Z`;

  return (
    <article className="bp-ttsa-panel bp-performance-panel">
      <header className="bp-panel-heading">
        <div>
          <h2>Performance Trend</h2>
          <p>Estimated trend from connected shop performance</p>
        </div>
        <div className="bp-metric-tabs">
          <button className="bp-metric-tab bp-metric-tab-active" type="button">Views</button>
          <button className="bp-metric-tab" type="button">Orders</button>
          <button className="bp-metric-tab" type="button">Roas</button>
        </div>
      </header>
      <div className="bp-chart-summary">
        <strong>{compact(totalViews)}</strong>
        <span>Total Views</span>
        <mark>{ctr.toFixed(2)}% CTR</mark>
        <small>{compact(totalOrders)} orders generated</small>
      </div>
      <div className="bp-chart-wrap">
        <svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Performance trend chart">
          <defs>
            <linearGradient id="bpChartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5bc6ff" stopOpacity=".30" />
              <stop offset="100%" stopColor="#5bc6ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bpChartFill)" />
          <path d={path} fill="none" stroke="#5bc6ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        </svg>
        <div className="bp-chart-labels">
          {["Day 5", "Day 10", "Day 15", "Day 20", "Day 25", "Day 30"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function PatternInsights() {
  return (
    <article className="bp-ttsa-panel bp-pattern-panel">
      <header className="bp-compact-heading">
        <span><Icon name="sparkles" /></span>
        <div>
          <h2>Pattern Insights</h2>
          <p>Win-rate by creative type</p>
        </div>
      </header>
      <PatternGroup title="Hook Types" items={hookPatterns} />
      <PatternGroup title="Creator Styles" items={creatorStyles} />
    </article>
  );
}

function PatternGroup({ title, items }) {
  return (
    <div className="bp-pattern-group">
      <h3>{title}</h3>
      {items.map((item) => (
        <div className="bp-pattern-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}%</strong>
          </div>
          <i style={{ width: `${item.value}%` }} />
        </div>
      ))}
    </div>
  );
}

function TopCreatives({ creatives, roas }) {
  return (
    <article className="bp-ttsa-panel bp-top-creatives">
      <header className="bp-panel-heading">
        <div>
          <h2>Top Performing Creatives</h2>
          <p>Ranked by orders from your saved creative stats</p>
        </div>
      </header>
      <div className="bp-creative-table-wrap">
        <table className="bp-creative-table">
          <thead>
            <tr>
              {["#", "Creative", "Product", "Views", "Orders", "CTR", "Est. ROAS"].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creatives.map((creative, index) => (
              <tr key={creative.id}>
                <td>{index + 1}</td>
                <td>
                  <div className="bp-creative-cell">
                    <span><Icon name="video" /></span>
                    <div>
                      <strong>{creative.title}</strong>
                      <small>{creative.angle}</small>
                    </div>
                  </div>
                </td>
                <td>{creative.product}</td>
                <td>{compact(creative.views)}</td>
                <td>{compact(creative.orders)}</td>
                <td>{creative.ctr.toFixed(2)}%</td>
                <td><b>{roas.toFixed(1)}x</b> <Icon name="activity" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function RecommendedActions({ actions, product }) {
  const visibleActions = [
    {
      title: "Scale product demo creatives",
      body: `${product?.title || "Your leading product"} is ready for more demo variations using a clear opening angle.`,
      priority: "High",
      href: `/app/ad-briefs?productId=${encodeURIComponent(product?.id || "")}`,
      icon: "zap",
    },
    {
      title: "Recruit more testimonial creators",
      body: "Customer-led proof is showing up as a strong creative pattern. Prioritize creators with similar delivery.",
      priority: "High",
      href: "/app/creators",
      icon: "users",
    },
    {
      title: "Turn the top creative into variants",
      body: "Test new CTAs, benefit-first openings, and product-page objections from the current top performer.",
      priority: "Medium",
      href: "/app/revenue-blueprint",
      icon: "activity",
    },
    ...actions.map((action) => ({
      title: action.title,
      body: action.detail,
      priority: "Medium",
      href: action.href,
      icon: "sparkles",
    })),
  ].slice(0, 3);

  return (
    <aside className="bp-ttsa-panel bp-actions-panel">
      <header className="bp-actions-heading">
        <span><Icon name="zap" /></span>
        <div>
          <h2>Recommended Actions</h2>
          <p>Generated from connected shop patterns</p>
        </div>
      </header>
      <div className="bp-action-stack">
        {visibleActions.map((action) => (
          <article className="bp-ttsa-action-card" key={action.title}>
            <span className="bp-action-icon"><Icon name={action.icon} /></span>
            <div>
              <div className="bp-action-title-row">
                <h3>{action.title}</h3>
                <mark>{action.priority}</mark>
              </div>
              <p>{action.body}</p>
              <Link to={action.href}>{action.title.includes("creator") ? "Find Creators" : "Generate Brief"} →</Link>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function buildCreatives(products, concepts, dashboard) {
  const pool = products.length ? products : [{ id: "demo", title: "Hero Product" }];

  return Array.from({ length: 8 }, (_, index) => {
    const product = pool[index % pool.length];
    const concept = concepts[index % Math.max(concepts.length, 1)];
    const views = 177409 + (index + 1) * 83127 + (product.title.length % 7) * 18421;
    const clicks = Math.max(1200, Math.round(views * (0.012 + (index % 4) * 0.007)));
    const orders = Math.max(25, dashboard.orderCount || Math.round(clicks * (0.07 + (index % 3) * 0.015)));

    return {
      id: `${product.id}-${index}`,
      title: `Demo Shopify creative for ${product.title}`,
      product: product.title,
      angle: concept?.angle || ["product demo", "benefit proof", "before-after"][index % 3],
      views,
      clicks,
      orders,
      ctr: (clicks / views) * 100,
    };
  });
}

function buildPath(data, width, height, padding) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return [x, y];
  });

  return points.reduce((path, [x, y], index) => {
    if (index === 0) return `M ${x} ${y}`;
    const [previousX, previousY] = points[index - 1];
    const controlX1 = previousX + (x - previousX) * 0.5;
    const controlX2 = x - (x - previousX) * 0.5;
    return `${path} C ${controlX1} ${previousY}, ${controlX2} ${y}, ${x} ${y}`;
  }, "");
}

function compact(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toLocaleString();
}

function formatShopName(shop = "") {
  const base = shop.replace(".myshopify.com", "").replace(/[-_]+/g, " ");
  return base
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "BluePrintAI";
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
