export const demoCreatives = [
  {
    id: "demo-hydraglow-1",
    title: "Demo TikTok creative for HydraGlow Serum",
    productTitle: "HydraGlow Serum",
    creator: "Demo Creator 1",
    description: "shock fact creative for HydraGlow Serum",
    hookType: "shock fact",
    adStyle: "voiceover tutorial",
    visualStyle: "desk setup",
    stats: {
      views: 769168,
      likes: 83228,
      shares: 7698,
      clicks: 9974,
      orders: 1105,
    },
  },
  {
    id: "demo-bright-skin-2",
    title: "Demo TikTok creative for Bright Skin Mask",
    productTitle: "Bright Skin Mask",
    creator: "Demo Creator 2",
    description: "problem-solution creative for Bright Skin Mask",
    hookType: "problem-solution",
    adStyle: "face-to-camera",
    visualStyle: "bathroom routine",
    stats: {
      views: 501710,
      likes: 53715,
      shares: 6248,
      clicks: 15653,
      orders: 334,
    },
  },
  {
    id: "demo-lashlift-3",
    title: "Demo TikTok creative for LashLift Kit",
    productTitle: "LashLift Kit",
    creator: "Demo Creator 3",
    description: "3-second demo creative for LashLift Kit",
    hookType: "3-second demo",
    adStyle: "trend-based",
    visualStyle: "desk setup",
    stats: {
      views: 733024,
      likes: 18711,
      shares: 10497,
      clicks: 7445,
      orders: 444,
    },
  },
  {
    id: "demo-lashlift-4",
    title: "Demo TikTok creative for LashLift Kit",
    productTitle: "LashLift Kit",
    creator: "Demo Creator 4",
    description: "creator testimonial creative for LashLift Kit",
    hookType: "creator testimonial",
    adStyle: "testimonial",
    visualStyle: "vanity close-up",
    stats: {
      views: 832652,
      likes: 24064,
      shares: 10478,
      clicks: 7235,
      orders: 600,
    },
  },
  {
    id: "demo-lashlift-before-after",
    title: "Demo TikTok creative for LashLift Kit",
    productTitle: "LashLift Kit",
    creator: "Demo Creator 1",
    description: "before-after creative for LashLift Kit",
    hookType: "before-after",
    adStyle: "comparison",
    visualStyle: "beauty routine",
    stats: {
      views: 510369,
      likes: 58667,
      shares: 5329,
      clicks: 15136,
      orders: 1759,
    },
  },
];

export const statLabels = [
  ["views", "Views"],
  ["likes", "Likes"],
  ["shares", "Shares"],
  ["clicks", "Clicks"],
  ["orders", "Orders"],
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
  const likes = safeNumber(stats.likes);
  const shares = safeNumber(stats.shares);
  const comments = safeNumber(stats.comments);

  return {
    views: Math.round(views),
    likes: Math.round(likes),
    shares: Math.round(shares),
    clicks: Math.round(clicks),
    orders: Math.round(orders),
    engagementRate: views ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0,
    conversionRate: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
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
    creator: rawCreative.creator || rawCreative.promoter_handle || payload.creator || "Saved Analysis",
    description:
      rawCreative.description ||
      rawCreative.insight ||
      rawCreative.transcript_summary ||
      analysis.firstTenSecondRisk ||
      analysis.pacingNotes ||
      payload.brief ||
      "saved creative analysis",
    hookType: rawCreative.hookType || rawCreative.hook_type || analysis.hookType,
    adStyle: rawCreative.adStyle || rawCreative.ad_style || analysis.format,
    visualStyle: rawCreative.visualStyle || rawCreative.visual_style || analysis.visualStyle,
    mediaUrl: rawCreative.mediaUrl || rawCreative.video_url || payload.mediaUrl || payload.videoUrl || "",
    mediaType: rawCreative.mediaType || payload.fileType || analysis.fileSignals?.fileType || "",
    stats: calculateCreativeMetrics(rawCreative),
    saved: Boolean(rawCreative.saved || rawCreative.payload),
  };
}
