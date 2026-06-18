import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  buildDashboard,
  buildCreativeConcepts,
  aiProviderStatus,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  Icon,
  MetricGrid,
  Notice,
  PageHeader,
  SectionCard,
  SecondaryButton,
  PrimaryButton,
  formatMoney,
} from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);

  return {
    merchantData,
    aiStatus: aiProviderStatus(),
    dashboard: buildDashboard(merchantData),
    concepts: buildCreativeConcepts(merchantData.products).slice(0, 3),
  };
};

const priorityCategories = ["Creative testing", "Product page", "Conversion lift"];
const priorityIcons = ["sparkles", "activity", "rocket"];
const demoOrderCounts = [318, 204, 176, 142, 96, 82];

function getProductMeta(product) {
  const source = product.source === "demo" ? "Demo product" : "Shopify product";
  const status = product.status || "ACTIVE";

  return `${source} · ${formatMoney(product.price, product.currencyCode)} · ${status}`;
}

function getProductInitials(title = "Product") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getOrdersForProduct(product, index, totalOrders, productCount) {
  if (Number(product.orders30d)) return Number(product.orders30d);
  if (totalOrders > 0 && productCount > 0) {
    return Math.max(1, Math.round(totalOrders / Math.max(1, index + 1)));
  }

  return demoOrderCounts[index % demoOrderCounts.length];
}

export default function Dashboard() {
  const { merchantData, dashboard } = useLoaderData();
  const usingDemoProducts = merchantData.products.some(
    (product) => product.source === "demo",
  );
  const priorityItems = dashboard.actionItems.slice(0, 3).map((item, index) => ({
    ...item,
    category: priorityCategories[index % priorityCategories.length],
    icon: priorityIcons[index % priorityIcons.length],
  }));
  const productsReadyForCreative = merchantData.products.slice(0, 6);

  return (
    <div className="bp-page bp-dashboard-page">
      <PageHeader
        eyebrow="Home"
        title="Creative priorities"
        subtitle={`${merchantData.shop.name} has ${dashboard.actionItems.length} recommended next moves ready.`}
        action={
          <PrimaryButton as={Link} to="/app/revenue-blueprint">
            <Icon name="rocket" /> Open blueprint
          </PrimaryButton>
        }
      />

      <div className="bp-section-stack">
        {usingDemoProducts && (
          <Notice tone="info">
            No Shopify products were available, so the app is using demo
            products to keep the installation review-safe and immediately
            usable.
          </Notice>
        )}

        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>
            {error}
          </Notice>
        ))}

        <MetricGrid
          metrics={[
            {
              label: "Products",
              value: dashboard.productCount,
              icon: "product",
              detail: usingDemoProducts ? "Demo fallback" : "Shopify catalog",
            },
            {
              label: "Creative health",
              value: dashboard.creativeHealthScore,
              unit: "/100",
              icon: "sparkles",
              detail: "Heuristic score",
            },
            {
              label: "Recommendations",
              value: dashboard.actionItems.length,
              icon: "list",
              detail: "Ready",
            },
          ]}
        />

        <SectionCard
          heading="What needs attention"
          description="Start with the highest-confidence creative move, then work down the list."
          icon="activity"
          action={<SecondaryButton as={Link} to="/app/recommendations">View all</SecondaryButton>}
        >
          <div className="bp-dashboard-priority-list">
            {priorityItems.map((item) => (
              <article className="bp-dashboard-priority-card" key={item.title}>
                <span className="bp-dashboard-priority-icon">
                  <Icon name={item.icon} />
                </span>
                <div className="bp-dashboard-priority-copy">
                  <span>{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <Link className="bp-dashboard-open-link" to={item.href || "/app/recommendations"}>
                    Review recommendation →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="bp-dashboard-grid">
          <SectionCard
            heading="Products ready for new creative"
            description="Use these products to start a brief or creative analysis."
            icon="product"
            action={<SecondaryButton as={Link} to="/app/creative-library">Open creatives</SecondaryButton>}
          >
            <div className="bp-dashboard-products-grid">
              {productsReadyForCreative.slice(0, 3).map((product, index) => (
                <article className="bp-dashboard-product-card" key={product.id}>
                  <div className="bp-dashboard-product-main">
                    <div
                      className="bp-dashboard-product-thumb"
                      style={{ "--bp-product-hue": `${158 + index * 27}deg` }}
                    >
                      {product.featuredImage?.url ? (
                        <img src={product.featuredImage.url} alt={product.featuredImage.altText || ""} />
                      ) : (
                        <span>{getProductInitials(product.title)}</span>
                      )}
                    </div>
                    <div className="bp-dashboard-product-copy">
                      <h3>{product.title}</h3>
                      <p>{getProductMeta(product)}</p>
                    </div>
                  </div>
                  <div className="bp-dashboard-product-orders">
                    <strong>
                      {getOrdersForProduct(
                        product,
                        index,
                        dashboard.orderCount,
                        productsReadyForCreative.length,
                      ).toLocaleString()}
                    </strong>
                    <span>orders / 30d</span>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="bp-side-stack">
            <SectionCard heading="Next actions" icon="sparkles">
              <ul className="bp-compact-list">
                {dashboard.actionItems.map((item) => (
                  <li key={item.title}>{item.detail}</li>
                ))}
              </ul>
            </SectionCard>

            <SecondaryButton as={Link} to="/app/video-analysis">
              <Icon name="video" /> Analyze creative
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
