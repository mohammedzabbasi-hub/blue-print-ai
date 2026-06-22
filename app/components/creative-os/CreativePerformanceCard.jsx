/* eslint-disable react/prop-types */
import { Link } from "react-router";
import { statLabels } from "../../data/demo-creatives";

export function detailUrl(creative) {
  const params = new URLSearchParams();
  params.set("creativeId", creative.id);
  return `/app/creative-library?${params.toString()}`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

export function matchesCreative(creative, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [
    creative.title,
    creative.productTitle,
    creative.creator,
    creative.description,
    creative.hookType,
    creative.adStyle,
    creative.visualStyle,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export function CreativePerformanceCard({ creative, onSelect }) {
  return (
    <article className="bp-performance-card">
      <CreativeVideoPreview creative={creative} />
      <div className="bp-performance-card-copy">
        <div>
          <h2>{creative.title}</h2>
          <p className="bp-performance-meta">
            {creative.productTitle} · {creative.creator}
          </p>
        </div>

        <div className="bp-performance-stats" aria-label={`${creative.title} performance`}>
          {statLabels.map(([key, label]) => (
            <div className="bp-performance-stat" key={key}>
              <span>{label}</span>
              <strong>{formatNumber(creative.stats[key])}</strong>
            </div>
          ))}
        </div>

        <p className="bp-performance-description">{creative.description}</p>
        <Link
          className="bp-performance-link"
          to={detailUrl(creative)}
          onClick={() => onSelect(creative)}
        >
          View creative details →
        </Link>
      </div>
    </article>
  );
}

function CreativeVideoPreview({ creative }) {
  if (creative.mediaUrl) {
    return (
      <div className="bp-performance-video">
        <MediaPreview creative={creative} />
      </div>
    );
  }

  return (
    <div className="bp-performance-video bp-performance-video-placeholder">
      <div className="bp-performance-video-control">
        <span className="bp-performance-play" aria-hidden="true" />
        <span>0:00</span>
      </div>
      <div className="bp-performance-video-icons" aria-hidden="true">
        <span>◔</span>
        <span>□</span>
        <span>⋮</span>
      </div>
      <div className="bp-performance-video-track" />
    </div>
  );
}

function MediaPreview({ creative }) {
  const mediaType = String(creative.mediaType || "").toLowerCase();

  if (mediaType.startsWith("image/")) {
    return (
      <img
        alt={creative.title}
        className="bp-performance-media"
        src={creative.mediaUrl}
      />
    );
  }

  if (mediaType.startsWith("audio/")) {
    return (
      <audio controls className="bp-performance-audio" src={creative.mediaUrl}>
        <track kind="captions" />
      </audio>
    );
  }

  return (
    <video src={creative.mediaUrl} controls className="bp-performance-media">
      <track kind="captions" />
    </video>
  );
}
