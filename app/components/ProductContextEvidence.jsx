import { buildProductContextEvidence } from "../models/product-context";

const NOT_AVAILABLE = "Not available";

export default function ProductContextEvidence({
  compact = false,
  product = null,
  productContext = {},
  title = "Product context evidence",
}) {
  const evidence = buildProductContextEvidence(productContext, product);
  const item = evidence.product || {};
  const creators = unique([...(item.creatorNames || []), ...(item.creatorHandles || [])]);
  const bestCreative = item.bestPerformingCreative;

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-slate-950/45 p-5" aria-label={title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">{title}</p>
          <h2 className="mt-2 text-lg font-black text-white">{evidence.productName}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{evidence.explanation}</p>
        </div>
        <span className="w-fit rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-100">
          {evidence.sourceLabel}
        </span>
      </div>

      {evidence.source !== "none" && (
        <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4 xl:grid-cols-6"}`}>
          <EvidenceMetric label="Related creatives/ads" value={formatNumber(item.relatedCreativeCount)} />
          <EvidenceMetric label="Creators" value={creators.length ? creators.join(", ") : NOT_AVAILABLE} />
          <EvidenceMetric label="Impressions" value={formatNumber(item.impressions)} />
          <EvidenceMetric label="Clicks" value={formatNumber(item.clicks)} />
          <EvidenceMetric label="Orders / conversions" value={formatOutcomes(item.orders, item.conversions)} />
          <EvidenceMetric label="Revenue" value={formatCurrency(item.revenue)} />
          <EvidenceMetric label="Spend" value={formatCurrency(item.spend)} />
          <EvidenceMetric label="CTR" value={formatRate(item.ctr)} />
          <EvidenceMetric label="CVR" value={formatRate(item.cvr)} />
          <EvidenceMetric label="ROAS" value={formatRoas(item.roas)} />
          <EvidenceMetric label="Best creative/ad" value={bestCreative?.name || bestCreative?.id || NOT_AVAILABLE} />
          <EvidenceMetric label="Imported date range" value={formatDateRange(item.dateRange)} />
        </div>
      )}
    </section>
  );
}

function EvidenceMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
      <p className="mt-1.5 break-words text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatNumber(value) {
  return hasValue(value) ? new Intl.NumberFormat("en-US").format(Number(value)) : NOT_AVAILABLE;
}

function formatCurrency(value) {
  return hasValue(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value))
    : NOT_AVAILABLE;
}

function formatRate(value) {
  return hasValue(value) ? `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : NOT_AVAILABLE;
}

function formatRoas(value) {
  return hasValue(value) ? `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}x` : NOT_AVAILABLE;
}

function formatOutcomes(orders, conversions) {
  const values = [];
  if (hasValue(orders)) values.push(`${formatNumber(orders)} orders`);
  if (hasValue(conversions)) values.push(`${formatNumber(conversions)} conversions`);
  return values.join(" · ") || NOT_AVAILABLE;
}

function formatDateRange(range) {
  if (!range?.start || !range?.end) return NOT_AVAILABLE;
  const start = String(range.start).slice(0, 10);
  const end = String(range.end).slice(0, 10);
  return start === end ? start : `${start} – ${end}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
