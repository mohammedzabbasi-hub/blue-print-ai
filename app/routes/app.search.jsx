/* eslint-disable react/prop-types */
import { Link, useLoaderData, useLocation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildCreators,
  buildRecommendations,
  listSavedBriefs,
  listSavedCreatives,
  loadMerchantData,
} from "../models/blueprint.server";
import { EmptyState, Icon, Notice, PageHeader, ProductThumbnail } from "../components/blueprint-ui";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import { getLocalDemoAccess } from "../utils/demo-access.server";

export const meta = () => [{ title: "Search | BluePrintAI" }];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();
  const { useDemoWorkspace: shouldUseDemoBypass } = getLocalDemoAccess(request);

  if (shouldUseDemoBypass) {
    return {
      query,
      merchantData: {
        errors: query
          ? [
              "Search is running in local demo mode. Start Shopify auth to search authenticated Shopify app data.",
            ]
          : [],
      },
      results: {
        products: [],
        creatives: [],
        briefs: [],
        recommendations: [],
        creators: [],
      },
    };
  }

  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const [briefs, creatives] = await Promise.all([
    listSavedBriefs(session.shop, 25),
    listSavedCreatives(session.shop, 25),
  ]);
  const recommendations = buildRecommendations(merchantData.products);
  const creators = buildCreators(merchantData.products, creatives);

  if (!query) {
    return {
      query,
      merchantData,
      results: {
        products: [],
        creatives: [],
        briefs: [],
        recommendations: [],
        creators: [],
      },
    };
  }

  const matcher = createMatcher(query);

  return {
    query,
    merchantData,
    results: {
      products: merchantData.products.filter((product) =>
        matcher([product.title, product.description, product.handle, product.status]),
      ),
      creatives: creatives.filter((creative) =>
        matcher([
          creative.title,
          creative.productTitle,
          creative.angle,
          creative.payload?.brief,
          creative.payload?.analysis?.pacingNotes,
          creative.payload?.analysis?.firstTenSecondRisk,
        ]),
      ),
      briefs: briefs.filter((brief) =>
        matcher([
          brief.productTitle,
          brief.angle,
          brief.payload?.hooks?.join(" "),
          brief.payload?.captions?.join(" "),
          brief.payload?.creatorDirection,
        ]),
      ),
      recommendations: recommendations.filter((recommendation) =>
        matcher([
          recommendation.title,
          recommendation.detail,
          recommendation.nextAction,
          recommendation.productTitle,
          recommendation.expectedImpact,
        ]),
      ),
      creators: creators.filter((creator) =>
        matcher([
          creator.name,
          creator.handle,
          creator.specialty,
          creator.productTitle,
          creator.projectedImpact,
        ]),
      ),
    },
  };
};

export default function SearchResults() {
  const { query, merchantData, results } = useLoaderData();
  const total = Object.values(results).reduce((sum, group) => sum + group.length, 0);

  return (
    <div className="bp-page bp-search-page">
      <PageHeader
        eyebrow="Search"
        title={query ? `Results for "${query}"` : "Search workspace"}
        subtitle="Search products, saved creative analyses, saved briefs, and recommendations."
      />

      <div className="bp-section-stack">
        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>
            {error}
          </Notice>
        ))}

        {!query ? (
          <EmptyState
            title="Type a search in the topbar"
            body="Try a product name, creative angle, brief hook, or recommendation keyword."
          />
        ) : total === 0 ? (
          <EmptyState
            title="No matching results"
            body="Try a broader product, angle, hook, CTA, or recommendation term."
          />
        ) : (
          <>
            <ResultGroup title="Products" items={results.products}>
              {(product) => (
                <SearchResult
                  key={product.id}
                  title={product.title}
                  subtitle={product.description || product.status}
                  href={`/app/ad-briefs?productId=${encodeURIComponent(product.id)}`}
                  thumbnail={<ProductThumbnail product={product} />}
                />
              )}
            </ResultGroup>

            <ResultGroup title="Creatives" items={results.creatives}>
              {(creative) => (
                <SearchResult
                  key={creative.id}
                  title={creative.title}
                  subtitle={`${creative.productTitle} · ${creative.angle || "Saved analysis"}`}
                  href={`/app/creative-library?creativeId=${encodeURIComponent(creative.id)}`}
                />
              )}
            </ResultGroup>

            <ResultGroup title="Briefs" items={results.briefs}>
              {(brief) => (
                <SearchResult
                  key={brief.id}
                  title={brief.angle}
                  subtitle={`${brief.productTitle} · ${formatDate(brief.createdAt)}`}
                  href={`/app/ad-briefs?productId=${encodeURIComponent(brief.productId)}&briefId=${encodeURIComponent(brief.id)}`}
                />
              )}
            </ResultGroup>

            <ResultGroup title="Recommendations" items={results.recommendations}>
              {(recommendation) => (
                <SearchResult
                  key={recommendation.id}
                  title={recommendation.title}
                  subtitle={recommendation.nextAction}
                  href={buildResultActionUrl(recommendation)}
                />
              )}
            </ResultGroup>

            <ResultGroup title="Creators" items={results.creators}>
              {(creator) => (
                <SearchResult
                  key={creator.id}
                  title={creator.name}
                  subtitle={`Creator performance account · ${creator.productTitle} · ${creator.fitScore}/100 account score`}
                  href={`/app/creators/${encodeURIComponent(creator.id)}`}
                />
              )}
            </ResultGroup>
          </>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ title, items, children }) {
  if (!items.length) return null;

  return (
    <section className="bp-search-group">
      <header>
        <h2>{title}</h2>
        <span>{items.length}</span>
      </header>
      <div className="bp-search-results">{items.map(children)}</div>
    </section>
  );
}

function SearchResult({ title, subtitle, href, thumbnail }) {
  const location = useLocation();

  return (
    <Link
      className="bp-search-result"
      to={withEmbeddedRouteParams(href, location.search)}
    >
      {thumbnail || (
        <span className="bp-search-result-icon">
          <Icon name="search" />
        </span>
      )}
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <em>Open</em>
    </Link>
  );
}

function createMatcher(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (values) => {
    const haystack = values
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US").format(new Date(value));
}

function buildResultActionUrl(item = {}) {
  const params = new URLSearchParams();

  if (item.productId) params.set("productId", item.productId);
  if (item.id) params.set("recommendationId", item.id);

  const text = `${item.title || ""} ${item.detail || ""} ${item.nextAction || ""}`.toLowerCase();

  if (/page|pdp|description|above the fold|cta|checkout|claim|shop now/.test(text)) {
    return `/app/revenue-blueprint?${params.toString()}`;
  }

  return `/app/ad-briefs?${params.toString()}`;
}
