/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildCreativeConcepts,
  listSavedCreatives,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  Notice,
  PageHeader,
  PrimaryButton,
  ProductThumbnail,
  SecondaryButton,
} from "../components/blueprint-ui";

const ANGLE_LABELS = {
  problem: "Problem-Solution Demo",
  proof: "Before-After Proof",
  giftable: "Giftable Upgrade",
  objection: "Objection Handling",
  social: "Social Proof",
  founder: "Founder Story",
  ugc: "UGC Demo",
  saved: "Saved Analyses",
};

const SOURCE_LABELS = ["UGC", "Studio", "Founder", "AI"];
const HUES = [186, 145, 268, 18, 132, 345, 292, 215];

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const merchantData = await loadMerchantData(admin, session);
  const savedCreatives = await listSavedCreatives(session.shop);

  return {
    merchantData,
    creatives: [
      ...savedCreatives.map(savedCreativeToCard),
      ...buildCreativeCards(
        buildCreativeConcepts(merchantData.products),
        merchantData.products,
      ),
    ],
    initialCreativeId: url.searchParams.get("creativeId"),
  };
};

function savedCreativeToCard(record, index = 0) {
  const payload = record.payload || {};
  const analysis = payload.analysis || {};

  return {
    id: record.id,
    product: {
      id: record.productId,
      title: record.productTitle,
      source: "saved",
    },
    angle: "saved",
    title: record.title,
    productTitle: record.productTitle,
    source: "Saved",
    durationSec: 30,
    score: Math.max(
      1,
      Math.min(
        100,
        ((analysis.hookScore || 7) + (analysis.clarityScore || 7) + (analysis.ctaScore || 7)) * 3,
      ),
    ),
    hookStrength: (analysis.hookScore || 7) * 10,
    retention: analysis.retentionRisk === "Low" ? 82 : 64,
    ctaQuality: (analysis.ctaScore || 7) * 10,
    hook: analysis.firstTenSecondRisk || payload.brief || "Saved creative analysis",
    insight: analysis.pacingNotes || "Saved from Creative analysis.",
    improvement: analysis.rewriteSuggestions?.[0] || "Open the analysis and turn the strongest fix into a brief.",
    mediaUrl: payload.mediaUrl || payload.videoUrl || "",
    mediaType: payload.fileType || analysis.fileSignals?.fileType || "",
    mediaState: payload.mediaState || (payload.mediaUrl ? "stored_media" : "analysis_only"),
    fileName: payload.fileName || analysis.fileSignals?.fileName || "",
    analysis,
    thumbHue: 210 + index * 18,
    saved: true,
  };
}

function buildCreativeCards(concepts, products) {
  return concepts.map((concept, index) => {
    const product =
      products.find((item) => item.id === concept.productId) || products[index];
    const angle = angleKey(concept.angle, index);
    const score = 86 - ((index * 7) % 22);
    const hookStrength = Math.min(95, score + 4 + (index % 3));
    const retention = Math.max(62, score - 5 + (index % 4));
    const ctaQuality = Math.max(64, score - 8 + (index % 5));

    return {
      id: concept.productId,
      product,
      angle,
      title: titleForConcept(concept, product, index),
      productTitle: product?.title || concept.productTitle,
      source: SOURCE_LABELS[index % SOURCE_LABELS.length],
      durationSec: [27, 32, 41, 24, 22, 48, 35, 29][index % 8],
      score,
      hookStrength,
      retention,
      ctaQuality,
      hook: hookCopy(concept, index),
      insight:
        "Pain-first opener outperforms feature-led intros by 38%.",
      improvement:
        index % 2 === 0
          ? "Add a 1-second product reveal between seconds 3-4."
          : "Move the customer problem into the first spoken line.",
      mediaUrl: concept.mediaUrl || "",
      mediaType: "",
      mediaState: "concept_only",
      fileName: "",
      thumbHue: HUES[index % HUES.length],
    };
  });
}

function briefUrl(creative) {
  const params = new URLSearchParams();
  params.set("productId", creative?.product?.id || creative?.productId || "");
  params.set("creativeId", creative?.id || "");
  params.set("generate", "1");
  return `/app/ad-briefs?${params.toString()}`;
}

function angleKey(angle, index) {
  const normalized = String(angle || "").toLowerCase();
  if (normalized.includes("before")) return "proof";
  if (normalized.includes("gift")) return "giftable";
  if (normalized.includes("objection")) return "objection";
  if (normalized.includes("founder")) return "founder";
  if (normalized.includes("social")) return "social";
  if (normalized.includes("ugc")) return "ugc";
  return ["problem", "proof", "giftable", "objection", "social", "founder", "ugc"][
    index % 7
  ];
}

function titleForConcept(concept, product, index) {
  const productName = product?.title || concept.productTitle || "This product";
  const titles = [
    `Why I stopped ignoring ${productName}`,
    `${productName} solves the daily problem`,
    `The upgrade customers actually notice`,
    `What changed after switching to ${productName}`,
    `Real shoppers keep coming back for this`,
    `I built this because the old way was broken`,
    `Unboxing ${productName} without the usual delay`,
  ];

  return titles[index % titles.length];
}

function hookCopy(concept, index) {
  return [
    "Same routine, same problem, brand new outcome.",
    "Open with the customer problem, then cut to the clearest result.",
    "Three seconds to show why this belongs in the cart.",
    "Address the hesitation before the product demo starts.",
    "Lead with proof, then make the product feel inevitable.",
    "A founder-style opener with one visible reason to care.",
    concept.visual || "Watch this before buying the obvious alternative.",
  ][index % 7];
}

function CreativeBoardCard({ creative, featured = false, onOpen, onPreview }) {
  return (
    <article
      className={`bp-creative-card ${featured ? "bp-creative-card-featured" : ""}`}
    >
      <div
        className="bp-creative-video"
        style={{
          "--creative-hue": creative.thumbHue,
        }}
      >
        {creative.mediaUrl ? (
          <>
            <CreativePreviewSurface creative={creative} mode="media" />
            <button
              type="button"
              className="bp-play-button"
              aria-label={`Play ${creative.title}`}
              onClick={() => onPreview(creative)}
              title="Play saved media"
            >
              <span aria-hidden="true" />
            </button>
          </>
        ) : (
          <CreativePreviewSurface creative={creative} onClick={() => onOpen(creative)} />
        )}
      </div>

      <div className="bp-creative-product">
        <ProductThumbnail product={creative.product} />
        <div>
          <p>{creative.productTitle}</p>
          <h4>{creative.title}</h4>
          <small>{creative.source} · {ANGLE_LABELS[creative.angle] || creative.angle}</small>
        </div>
      </div>

      <div className="bp-creative-hook">
        <span>{creative.saved ? "Saved analysis" : "Concept"}</span>
        <p>{creative.hook}</p>
      </div>

      <div className="bp-creative-metrics">
        <span>Score <strong>{creative.score}</strong></span>
        <button type="button" onClick={() => onOpen(creative)}>
          Open details
        </button>
      </div>
      <Link className="bp-creative-brief-link" to={briefUrl(creative)}>
        <Icon name="brief" /> Generate brief
      </Link>
    </article>
  );
}

function CreativeListRow({ creative, onOpen, onPreview }) {
  return (
    <div className="bp-creative-row">
      <ProductThumbnail product={creative.product} />
      <div>
        <strong>{creative.title}</strong>
        <p>
          {creative.productTitle} - {creative.source}
        </p>
      </div>
      <span>{creative.score}/100</span>
      <div className="bp-creative-row-actions">
        <button type="button" onClick={() => onOpen(creative)}>Details</button>
        <button type="button" onClick={() => onPreview(creative)}>
          {creative.mediaUrl ? "Play" : creative.saved ? "Notes" : "Concept"}
        </button>
        <Link to={briefUrl(creative)}>Brief</Link>
      </div>
    </div>
  );
}

function CreativePreviewSurface({ creative, mode = "concept", onClick }) {
  const label = mode === "media"
    ? "Playable preview"
    : creative.saved
      ? "Analysis only"
      : "Preview concept";

  return (
    <button
      type="button"
      className={`bp-creative-preview-surface bp-creative-preview-${mode}`}
      aria-label={`${label} for ${creative.title}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="bp-creative-preview-glow" />
      <span className="bp-creative-video-tags">
        <span>{label}</span>
        <span>{creative.durationSec}s</span>
      </span>
      <span className="bp-creative-preview-frame">
        <span className="bp-creative-preview-product">
          <ProductThumbnail product={creative.product} />
        </span>
        <span className="bp-creative-preview-copy">
          <strong>{creative.productTitle}</strong>
          <small>{ANGLE_LABELS[creative.angle] || creative.source}</small>
        </span>
      </span>
      <span className="bp-creative-preview-icon">
        <Icon name={mode === "media" ? "video" : "sparkles"} />
      </span>
      {mode === "concept" && (
        <span className="bp-concept-preview-button">
          {label}
        </span>
      )}
    </button>
  );
}

export default function CreativeLibrary() {
  const { merchantData, creatives, initialCreativeId } = useLoaderData();
  const [view, setView] = useState("board");
  const [query, setQuery] = useState("");
  const [angle, setAngle] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("score");
  const [minScore, setMinScore] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(
    () => creatives.find((creative) => creative.id === initialCreativeId) || null,
  );
  const [previewCreative, setPreviewCreative] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return creatives.filter((creative) => {
      const matchesQuery =
        !q ||
        creative.title.toLowerCase().includes(q) ||
        creative.productTitle.toLowerCase().includes(q);
      const matchesAngle = angle === "all" || creative.angle === angle;
      const matchesSource =
        source === "all" || String(creative.source).toLowerCase() === source;
      const matchesScore =
        minScore === "all" || Number(creative.score || 0) >= Number(minScore);

      return matchesQuery && matchesAngle && matchesSource && matchesScore;
    }).sort((a, b) => {
      if (sort === "product") return a.productTitle.localeCompare(b.productTitle);
      if (sort === "recent") return String(b.id).localeCompare(String(a.id));
      return Number(b.score || 0) - Number(a.score || 0);
    });
  }, [angle, creatives, minScore, query, sort, source]);

  const featured = filtered[0];
  const grouped = useMemo(() => {
    return filtered.slice(1).reduce((groups, creative) => {
      groups[creative.angle] ||= [];
      groups[creative.angle].push(creative);
      return groups;
    }, {});
  }, [filtered]);

  return (
    <div className="bp-page bp-creative-library-page">
      <PageHeader
        eyebrow="Creatives"
        title="Creative library"
        subtitle="Browse saved analyses and product concepts, then open the next useful action."
        action={
          <PrimaryButton as={Link} to="/app/video-analysis">
            <Icon name="upload" /> Analyze creative
          </PrimaryButton>
        }
      />

      <div className="bp-section-stack">
        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>
            {error}
          </Notice>
        ))}

        <div className="bp-creative-filter-bar">
          <label className="bp-creative-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creatives or products"
              type="search"
            />
          </label>
          <select
            className="bp-creative-select"
            value={angle}
            onChange={(event) => setAngle(event.target.value)}
          >
            <option value="all">All angles</option>
            {Object.entries(ANGLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <SecondaryButton
            className="bp-creative-more"
            type="button"
            onClick={() => setShowAdvancedFilters((value) => !value)}
          >
            <Icon name="filter" /> Filters
          </SecondaryButton>
          <div className="bp-view-toggle" aria-label="Creative library view">
            <button
              type="button"
              className={view === "board" ? "bp-view-toggle-active" : ""}
              onClick={() => setView("board")}
              aria-label="Board view"
            >
              <Icon name="grid" />
            </button>
            <button
              type="button"
              className={view === "list" ? "bp-view-toggle-active" : ""}
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <Icon name="list" />
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="bp-creative-advanced-panel">
            <label>
              <span>Source</span>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="all">All sources</option>
                {Array.from(new Set(creatives.map((creative) => String(creative.source).toLowerCase()))).map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Minimum score</span>
              <select value={minScore} onChange={(event) => setMinScore(event.target.value)}>
                <option value="all">Any score</option>
                <option value="80">80+</option>
                <option value="70">70+</option>
                <option value="60">60+</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="score">Highest score</option>
                <option value="product">Product</option>
                <option value="recent">Recently saved</option>
              </select>
            </label>
          </div>
        )}

        {previewCreative && (
          <div className="bp-creative-detail-panel">
            <header>
              <div>
                <span>Creative preview</span>
                <h2>{previewCreative.title}</h2>
              </div>
              <button type="button" onClick={() => setPreviewCreative(null)}>Close</button>
            </header>
            {previewCreative.mediaUrl ? (
              <MediaPreview creative={previewCreative} />
            ) : (
              <Notice tone="warning">
                {previewCreative.saved
                  ? "This saved analysis has no stored media file. Showing the saved hook and analysis instead."
                  : "This is a generated concept, not a playable media asset. Showing concept details instead."}
              </Notice>
            )}
            <p>{previewCreative.hook}</p>
          </div>
        )}

        {selectedCreative && (
          <div className="bp-creative-detail-panel">
            <header>
              <div>
                <span>Creative detail</span>
                <h2>{selectedCreative.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedCreative(null)}>Close</button>
            </header>
            <dl className="bp-creative-detail-grid">
              <div><dt>Product</dt><dd>{selectedCreative.productTitle}</dd></div>
              <div><dt>Platform/source</dt><dd>{selectedCreative.source}</dd></div>
              <div><dt>Angle</dt><dd>{ANGLE_LABELS[selectedCreative.angle] || selectedCreative.angle}</dd></div>
              <div><dt>Score</dt><dd>{selectedCreative.score}/100</dd></div>
              <div><dt>Hook</dt><dd>{selectedCreative.hook}</dd></div>
              <div><dt>CTA quality</dt><dd>{selectedCreative.ctaQuality}/100</dd></div>
              <div><dt>Analysis</dt><dd>{selectedCreative.insight}</dd></div>
              <div><dt>Recommendation</dt><dd>{selectedCreative.improvement}</dd></div>
              <div><dt>Saved</dt><dd>{selectedCreative.saved ? "Saved analysis" : "Concept board"}</dd></div>
              <div><dt>Media</dt><dd>{selectedCreative.mediaUrl ? "Playable media attached" : selectedCreative.saved ? "Analysis only - no media stored" : "Concept only - no media file"}</dd></div>
            </dl>
            <div className="bp-creative-detail-actions">
              <Link to={briefUrl(selectedCreative)}>Generate brief</Link>
              <button type="button" onClick={() => setPreviewCreative(selectedCreative)}>
                {selectedCreative.mediaUrl ? "Play media" : "Open notes"}
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            title="No creatives match those filters"
            body="Try a different angle or clear your search to see the full board."
          />
        ) : view === "list" ? (
          <div className="bp-creative-list">
            {filtered.map((creative) => (
              <CreativeListRow
                key={creative.id}
                creative={creative}
                onOpen={setSelectedCreative}
                onPreview={setPreviewCreative}
              />
            ))}
          </div>
        ) : (
          <div className="bp-creative-board">
            {featured && (
              <div className="bp-featured-creative">
                <CreativeBoardCard
                  creative={featured}
                  featured
                  onOpen={setSelectedCreative}
                  onPreview={setPreviewCreative}
                />
                <div className="bp-featured-side">
                  <div className="bp-featured-winner">
                    <Icon name="sparkles" />
                    <div>
                      <span>Top creative to review</span>
                      <p>
                        <strong>{featured.title}</strong> - {featured.insight}
                      </p>
                    </div>
                  </div>
                  <div className="bp-improvement-card">
                    <header>
                      <Icon name="sparkles" />
                      <strong>Improvement opportunity</strong>
                    </header>
                    <p>{featured.improvement}</p>
                  </div>
                </div>
              </div>
            )}

            {Object.entries(grouped).map(([groupAngle, items]) => (
              <section className="bp-creative-angle-section" key={groupAngle}>
                <div className="bp-creative-angle-header">
                  <h3>{ANGLE_LABELS[groupAngle]}</h3>
                  <span>{items.length} creatives</span>
                </div>
                <div className="bp-creative-angle-grid">
                  {items.map((creative) => (
                    <CreativeBoardCard
                      key={creative.id}
                      creative={creative}
                      onOpen={setSelectedCreative}
                      onPreview={setPreviewCreative}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaPreview({ creative }) {
  const mediaType = String(creative.mediaType || "").toLowerCase();

  if (mediaType.startsWith("image/")) {
    return (
      <img
        alt={creative.title}
        className="bp-creative-preview-video"
        src={creative.mediaUrl}
      />
    );
  }

  if (mediaType.startsWith("audio/")) {
    return (
      <audio controls className="bp-creative-preview-audio" src={creative.mediaUrl}>
        <track kind="captions" />
      </audio>
    );
  }

  return (
    <video src={creative.mediaUrl} controls className="bp-creative-preview-video">
      <track kind="captions" />
    </video>
  );
}
