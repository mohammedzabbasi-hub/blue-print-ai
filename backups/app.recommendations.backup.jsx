/* eslint-disable react/prop-types */
import { Link, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  buildRecommendations,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  Notice,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "../components/blueprint-ui";

const TABS = [
  { id: "all", label: "All" },
  { id: "high", label: "High priority" },
  { id: "creative", label: "Creative" },
  { id: "product_page", label: "Product page" },
];

const TYPE_ROTATION = ["creative", "product_page", "cta", "testing"];

function normalizePriority(priority) {
  return String(priority || "medium").toLowerCase();
}

function recommendationType(item, index) {
  const title = `${item.title} ${item.detail} ${item.nextAction}`.toLowerCase();

  if (/cta|checkout|claim|shop now/.test(title)) return "cta";
  if (/page|description|above the fold|pdp/.test(title)) return "product_page";
  if (/test|experiment|split|cadence/.test(title)) return "testing";

  return TYPE_ROTATION[index % TYPE_ROTATION.length];
}

function typeLabel(type) {
  return type.replace("_", " ");
}

function buildActionUrl(item = {}) {
  const params = new URLSearchParams();

  if (item.productId) params.set("productId", item.productId);
  if (item.id) params.set("recommendationId", item.id);

  const type = String(item.type || "").toLowerCase();
  const text = `${item.title || ""} ${item.detail || ""} ${item.nextAction || ""}`.toLowerCase();

  if (type === "product_page" || /page|pdp|description|above the fold/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

  if (type === "cta" || /cta|checkout|claim|shop now/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

  if (type === "creative" && !/brief|angle|hook/.test(text)) {
    return `/app/creative-library?productId=${encodeURIComponent(item.productId || "")}`;
  }

  params.set("generate", "1");
  return `/app/ad-briefs?${params.toString()}`;
}

function actionLabel(item = {}) {
  const type = String(item.type || "").toLowerCase();
  const text = `${item.title || ""} ${item.detail || ""} ${item.nextAction || ""}`.toLowerCase();

  if (type === "product_page" || type === "cta" || /page|pdp|description|above the fold|cta|checkout/.test(text)) {
    return "Open blueprint";
  }

  if (type === "creative" && !/brief|angle|hook/.test(text)) {
    return "Open creative";
  }

  return "Generate brief";
}

function enrichRecommendation(item, index) {
  const type = recommendationType(item, index);
  const priority = normalizePriority(item.priority);

  return {
    ...item,
    type,
    priority,
    evidence:
      item.evidence ||
      "Catalog signal is strong enough to justify a focused creative test.",
    effort:
      item.effort || (type === "product_page" ? "medium" : index > 3 ? "high" : "low"),
    rationale: item.rationale || item.detail,
  };
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);

  return {
    merchantData,
    recommendations: buildRecommendations(
      merchantData.products,
      merchantData.orders,
    ),
  };
};

export default function Recommendations() {
  const { merchantData, recommendations } = useLoaderData();
  const [tab, setTab] = useState("all");

  const enrichedRecommendations = useMemo(
    () => recommendations.map(enrichRecommendation),
    [recommendations],
  );

  const filteredRecommendations = useMemo(() => {
    if (tab === "all") return enrichedRecommendations;
    if (tab === "high") {
      return enrichedRecommendations.filter((item) => item.priority === "high");
    }

    return enrichedRecommendations.filter((item) => item.type === tab);
  }, [enrichedRecommendations, tab]);

  const nextTest =
    enrichedRecommendations.find(
      (item) => item.priority === "high" && item.type === "testing",
    ) ||
    enrichedRecommendations.find((item) => item.priority === "high") ||
    enrichedRecommendations[0];

  return (
    <div className="bp-page bp-recommendations-page">
      <PageHeader
        eyebrow="Recommendations"
        title="Next best actions"
        subtitle="Prioritized creative and product moves from your current store context."
        action={
          <SecondaryButton
            className="bp-filter-button"
            type="button"
            onClick={() => setTab(tab === "high" ? "all" : "high")}
          >
            <Icon name="filter" /> {tab === "high" ? "Show all" : "High priority"}
          </SecondaryButton>
        }
      />

      <div className="bp-section-stack">
        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>
            {error}
          </Notice>
        ))}

        {enrichedRecommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            body="Add Shopify products or generated test data to create product-specific recommendations."
          />
        ) : (
          <>
            {nextTest && (
              <section className="bp-rec-next-test bp-section">
                <header className="bp-section-header">
                  <div className="bp-section-title">
                    <Icon name="zap" />
                    <div>
                      <h2>Recommended next test</h2>
                      <p>Highest-impact experiment to launch this week.</p>
                    </div>
                  </div>
                  <PrimaryButton
                    as={Link}
                    to={buildActionUrl(nextTest)}
                    className="bp-rec-brief-button"
                  >
                    <Icon name="sparkles" /> {actionLabel(nextTest)}
                  </PrimaryButton>
                </header>
                <div className="bp-section-body">
                  <div className="bp-rec-next-layout">
                    <div className="bp-rec-next-copy">
                      <div className="bp-rec-meta-row">
                        <PriorityPill priority={nextTest.priority} />
                        <span>
                          {typeLabel(nextTest.type)} · {nextTest.productTitle}
                        </span>
                      </div>
                      <h3>{nextTest.title}</h3>
                      <p>{nextTest.rationale}</p>
                      <div className="bp-rec-proof-grid">
                        <div>
                          <span>Evidence</span>
                          <p>{nextTest.evidence}</p>
                        </div>
                        <div>
                          <span>Recommended action</span>
                          <p>{nextTest.nextAction}</p>
                        </div>
                      </div>
                    </div>
                    <aside className="bp-rec-insight">
                      <div>
                        <Icon name="sparkles" />
                      </div>
                      <span>Next action</span>
                      <p>{nextTest.nextAction}</p>
                    </aside>
                  </div>
                </div>
              </section>
            )}

            <div className="bp-rec-tabs" role="tablist" aria-label="Recommendation filters">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? "bp-rec-tab bp-rec-tab-active" : "bp-rec-tab"}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filteredRecommendations.length === 0 ? (
              <EmptyState
                title="No recommendations match this filter"
                body="Try a different tab, or generate fresh recommendations from your Shopify catalog."
              />
            ) : (
              <div className="bp-rec-card-grid">
                {filteredRecommendations.map((item, index) => (
                  <RecommendationCard
                    item={item}
                    key={item.id}
                    glow={index === filteredRecommendations.length - 1 && item.type === "testing"}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PriorityPill({ priority }) {
  return (
    <span className={`bp-rec-priority bp-rec-priority-${priority}`}>
      <span />
      {priority === "high" ? "High priority" : priority === "medium" ? "Medium" : "Low"}
    </span>
  );
}

function RecommendationCard({ item, glow = false }) {
  return (
    <article className={glow ? "bp-rec-card bp-rec-card-glow" : "bp-rec-card"}>
      <div className="bp-rec-card-top">
        <div className="bp-rec-card-eyebrow">
          <span className="bp-rec-chevron">›</span>
          <p>
            {typeLabel(item.type)}
            {item.productTitle ? ` · ${item.productTitle}` : ""}
          </p>
        </div>
        <PriorityPill priority={item.priority} />
      </div>
      <h3>{item.title}</h3>
      <p>{item.rationale}</p>
      <p className="bp-rec-card-impact">{item.nextAction}</p>
      <Link
        className="bp-rec-card-link"
        to={buildActionUrl(item)}
      >
        {actionLabel(item)} →
      </Link>
    </article>
  );
}
