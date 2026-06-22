import { Link } from "react-router";

export default function EmptyWorkspaceState({
  eyebrow = "New Workspace",
  title = "No data yet",
  description = "This new shop does not have data yet. Upload a creative or connect your TikTok Shop to begin.",
  primaryText,
  primaryLabel,
  primaryLink = "/app/video-analysis",
  secondaryText,
  secondaryLabel,
  secondaryLink = "/app/settings",
}) {
  const resolvedPrimaryLabel = primaryText || primaryLabel || "Upload Creative";
  const resolvedSecondaryLabel = secondaryText || secondaryLabel || "Connect Shop";

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
            to={primaryLink}
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            {resolvedPrimaryLabel}
          </Link>
        )}

        {resolvedSecondaryLabel && secondaryLink && (
          <Link
            to={secondaryLink}
            className="rounded-lg border border-border-strong bg-surface-2/60 px-5 py-2.5 font-semibold text-foreground"
          >
            {resolvedSecondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
