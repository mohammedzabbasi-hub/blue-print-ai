import {
  CheckCircle2,
  ChevronDown,
  Database,
  PackageOpen,
  Plug,
  Upload,
} from "lucide-react";
import { Link } from "react-router";

import { buildDashboardDataSourceSummary } from "../models/product-context";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export default function ActiveDataContext({
  hasUploadedData = false,
  productContext = {},
  search = "",
}) {
  const summary = buildDashboardDataSourceSummary(productContext, {
    hasUploadedData,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1728] to-[#080d17]">
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            <Database aria-hidden="true" size={16} />
            Active data context
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {summary.heading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            {summary.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {summary.items.map((item) => (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  item.active
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-700 bg-slate-950/50 text-slate-300"
                }`}
                key={item.id}
              >
                {item.id === "manual_uploads" ? (
                  <Upload aria-hidden="true" size={14} />
                ) : item.active ? (
                  <CheckCircle2 aria-hidden="true" size={14} />
                ) : (
                  <PackageOpen aria-hidden="true" size={14} />
                )}
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-72 md:justify-end">
          <Link
            className="bp-primary-cta"
            to={withEmbeddedRouteParams("/app/data-import", search)}
          >
            Data Import
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
            to={withEmbeddedRouteParams(
              hasUploadedData ? "/app/creative-library" : "/app/video-analysis",
              search,
            )}
          >
            {hasUploadedData ? "Creative Library" : "AI Review Studio"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ConnectMoreDataSources({ statuses = [], search = "" }) {
  const optionalSources = statuses.filter(
    (item) => !["shopify_products", "manual_uploads"].includes(item.id),
  );

  if (!optionalSources.length) return null;

  return (
    <details className="group rounded-2xl border border-white/10 bg-slate-950/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
            <Plug aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Connect more data sources
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Optional — unlock deeper order, ad, and affiliate insights.
            </p>
          </div>
        </div>
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-slate-500 transition group-open:rotate-180"
          size={18}
        />
      </summary>

      <div className="border-t border-white/10 px-5 pb-5 pt-4">
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {optionalSources.map((item) => (
            <div className="flex items-start justify-between gap-3" key={item.id}>
              <div>
                <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {item.description || "Optional — connect when ready"}
                </p>
              </div>
              <span className={`mt-0.5 shrink-0 text-xs font-bold ${toneClass(item.tone)}`}>
                {item.tone === "connected" ? "Connected" : "Optional"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
            to={withEmbeddedRouteParams("/app/connections", search)}
          >
            Manage connections
          </Link>
          <Link
            className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
            to={withEmbeddedRouteParams("/app/data-import", search)}
          >
            Use CSV import instead
          </Link>
        </div>
      </div>
    </details>
  );
}

export function PerformanceDataNotice({
  hasDemoPerformanceData = false,
  hasImportedPerformanceData = false,
  hasMeasuredPerformanceData = false,
  productContext = {},
}) {
  if (hasDemoPerformanceData) {
    const contextMessage = productContext.hasShopifyProducts
      ? "Using Shopify product context."
      : productContext.hasImportedProductContext
        ? "Using imported product context."
        : "Demo product context is visible.";
    return (
      <Notice tone="amber">
        <span className="block text-xs font-black uppercase tracking-[0.16em]">
          Demo Data Status
        </span>
        <span className="mt-1 block">
          {contextMessage} Creative, creator, and performance metrics shown as
          demo data are not measured store results.
        </span>
      </Notice>
    );
  }

  if (!hasMeasuredPerformanceData && productContext.hasAnyProductContext) {
    return (
      <Notice tone="cyan">
        Product planning is ready with the active context above. Import a CSV
        or connect an optional source when you want measured performance insights.
      </Notice>
    );
  }

  if (!hasMeasuredPerformanceData) return null;

  if (hasImportedPerformanceData) {
    return (
      <Notice tone="cyan">
        <span className="block text-xs font-black uppercase tracking-[0.16em]">
          Imported performance data
        </span>
        <span className="mt-1 block">
          Commercial and engagement metrics shown here were merchant-provided through CSV import. They are not Shopify Analytics or connected-platform measurements.
        </span>
      </Notice>
    );
  }

  if (!productContext.hasShopifyProducts && productContext.hasImportedProductContext) {
    return (
      <Notice tone="cyan">
        Performance insights are using merchant-provided product names from imported data.
      </Notice>
    );
  }

  return null;
}

function Notice({ children, tone = "slate" }) {
  const tones = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    cyan: "border-cyan-500/35 bg-cyan-500/10 text-cyan-100",
    slate: "border-slate-700 bg-slate-950/40 text-slate-200",
  };

  return (
    <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </div>
  );
}

function toneClass(tone) {
  return tone === "connected" || tone === "available"
    ? "text-emerald-200"
    : "text-slate-500";
}
