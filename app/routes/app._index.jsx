import { Link, useLoaderData, useLocation } from "react-router";

import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "BluePrintAI | Creative Intelligence for Shopify" }];
};

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  return { shop: session.shop };
};

const welcomeFeatures = [
  {
    eyebrow: "Analyze",
    title: "Creative Intelligence",
    description:
      "Turn videos and performance signals into clear findings about hooks, messaging, and what to improve next.",
  },
  {
    eyebrow: "Create",
    title: "Creative Briefs",
    description:
      "Translate available patterns and product context into focused briefs your team and creators can act on.",
  },
  {
    eyebrow: "Plan",
    title: "Revenue Blueprint",
    description:
      "Connect creative priorities to a practical growth plan built around your Shopify catalog and goals.",
  },
];

export default function LandingRoute() {
  const { shop } = useLoaderData();
  const location = useLocation();

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2 sm:py-6">
      <section className="glass-strong relative overflow-hidden rounded-3xl border border-cyan-400/20 px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
        />

        <div className="relative max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
            Welcome to BluePrintAI
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Build better-performing creative with a clearer plan.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            BluePrintAI turns your Shopify product context, creative work, and
            performance signals into actionable intelligence—from first insight
              to the next creative brief and revenue blueprint.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Your workspace is securely connected to {formatShopName(shop)}.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Shopify product context works without an external account. Importing
            performance data and connecting read-only Google Ads are optional;
            AI Review Studio requires a video upload and an available analyzer.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="bp-primary-cta justify-center px-6 py-3 text-center"
              to={withEmbeddedRouteParams("/app/dashboard", location.search)}
            >
              Enter Command Center
            </Link>
            <Link
              className="rounded-xl border border-slate-700 bg-slate-950/40 px-6 py-3 text-center text-sm font-bold text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
              to={withEmbeddedRouteParams("/app/onboarding", location.search)}
            >
              Set up workspace
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="welcome-capabilities" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            One connected creative workflow
          </p>
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
            id="welcome-capabilities"
          >
            From signal to action
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {welcomeFeatures.map((feature, index) => (
            <article
              className="glass rounded-2xl border border-slate-800/80 p-6 transition hover:-translate-y-0.5 hover:border-cyan-400/30"
              key={feature.title}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                  {feature.eyebrow}
                </span>
                <span className="font-display text-2xl font-semibold text-slate-600">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatShopName(shop) {
  return String(shop || "Your store")
    .replace(/\.myshopify\.com$/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
