import { Link, useLocation } from "react-router";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export default function EmptyWorkspaceState({
  eyebrow = "New Workspace",
  title = "No data yet",
  description = "This new shop does not have saved app data yet. Analyze a video or save a creative to populate this section.",
  primaryText,
  primaryLabel,
  primaryLink = "/app/video-analysis",
  secondaryText,
  secondaryLabel,
  secondaryLink = "/app/creative-library",
}) {
  const location = useLocation();
  const resolvedPrimaryLabel = primaryText || primaryLabel || "Upload Creative";
  const resolvedSecondaryLabel = secondaryText || secondaryLabel || "Open Creative Library";

  return (
    <div className="glass rounded-2xl p-8">
      <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>

      <h2 className="font-display text-3xl font-semibold mt-3 text-foreground">{title}</h2>

      <p className="text-muted-foreground mt-3 text-sm max-w-3xl">
        {description}
      </p>

      <div className="flex flex-wrap gap-4 mt-8">
        {resolvedPrimaryLabel && primaryLink && (
          <Link
            to={withEmbeddedRouteParams(primaryLink, location.search)}
            className="bp-primary-cta"
          >
            {resolvedPrimaryLabel}
          </Link>
        )}

        {resolvedSecondaryLabel && secondaryLink && (
          <Link
            to={withEmbeddedRouteParams(secondaryLink, location.search)}
            className="bp-primary-cta"
          >
            {resolvedSecondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
