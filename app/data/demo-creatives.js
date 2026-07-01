export {
  DEMO_PERFORMANCE_LABEL,
  buildDemoPerformanceSeries,
  demoBrand,
  demoCreators,
  demoCreatives,
  demoProducts,
  enrichDemoCreative,
  getDemoCreative,
  getDemoCreator,
} from "./demo-brand.js";

export const statLabels = [
  ["views", "Views"],
  ["clicks", "Clicks"],
  ["orders", "Orders"],
  ["revenue", "Revenue"],
  ["spend", "Spend"],
];

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateCreativeMetrics(creative) {
  const stats = creative.stats || creative;
  const views = safeNumber(stats.views || stats.total_views);
  const clicks = safeNumber(stats.clicks);
  const orders = safeNumber(stats.orders || stats.conversions);
  const revenue = safeNumber(stats.revenue);
  const spend = safeNumber(stats.spend);
  const likes = safeNumber(stats.likes);
  const shares = safeNumber(stats.shares);
  const comments = safeNumber(stats.comments);
  const engagementRate =
    safeNumber(stats.engagementRate) ||
    (views
      ? Number((((likes + comments + shares) / views) * 100).toFixed(2))
      : 0);
  const conversionRate =
    safeNumber(stats.conversionRate) ||
    (clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0);

  return {
    views: Math.round(views),
    likes: Math.round(likes),
    shares: Math.round(shares),
    clicks: Math.round(clicks),
    orders: Math.round(orders),
    revenue,
    spend,
    roas: safeNumber(stats.roas) || (spend ? Number((revenue / spend).toFixed(2)) : 0),
    engagementRate,
    conversionRate,
  };
}

export function normalizeCreative(rawCreative, index = 0) {
  const payload = rawCreative.payload || {};
  const analysis = payload.analysis || {};
  const title = rawCreative.title || rawCreative.caption || `Saved creative ${index + 1}`;
  const productTitle =
    rawCreative.productTitle ||
    rawCreative.product ||
    payload.productTitle ||
    payload.product ||
    "Saved product";

  return {
    id: rawCreative.id || rawCreative.creative_id || `creative-${index}`,
    title,
    productTitle,
    creator:
      rawCreative.creator ||
      rawCreative.creatorName ||
      rawCreative.creatorHandle ||
      rawCreative.promoter_handle ||
      payload.creator ||
      "Saved Analysis",
    description:
      rawCreative.description ||
      rawCreative.transcriptSummary ||
      rawCreative.insight ||
      rawCreative.transcript_summary ||
      analysis.firstTenSecondRisk ||
      analysis.pacingNotes ||
      payload.brief ||
      "saved creative analysis",
    hookType: rawCreative.hookType || rawCreative.hook || rawCreative.hook_type || analysis.hookType,
    adStyle: rawCreative.adStyle || rawCreative.angle || rawCreative.ad_style || analysis.format,
    visualStyle: rawCreative.visualStyle || rawCreative.visual_style || analysis.visualStyle,
    mediaUrl: rawCreative.mediaUrl || rawCreative.videoUrl || rawCreative.video_url || payload.mediaUrl || payload.videoUrl || "",
    mediaType: rawCreative.mediaType || payload.fileType || analysis.fileSignals?.fileType || "",
    stats: calculateCreativeMetrics(rawCreative),
    saved: Boolean(rawCreative.saved || rawCreative.payload),
  };
}
