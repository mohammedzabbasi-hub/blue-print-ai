import { buildProductContext, productContextLabel } from "./product-context.js";
import { completeAssistantChat } from "../services/llm.server.js";

const ACTIONS = {
  briefs: { label: "Generate Brief", href: "/app/ad-briefs", type: "primary" },
  campaigns: { label: "Open Campaigns", href: "/app/campaigns", type: "primary" },
  creators: { label: "Compare Creators", href: "/app/creators", type: "secondary" },
  import: { label: "Import More Data", href: "/app/data-import", type: "primary" },
  library: { label: "Open Creative Library", href: "/app/creative-library", type: "secondary" },
  review: { label: "Open AI Review Studio", href: "/app/video-analysis", type: "primary" },
  settings: { label: "Open Settings", href: "/app/settings", type: "secondary" },
  blueprint: { label: "Open Revenue Blueprint", href: "/app/revenue-blueprint", type: "secondary" },
};

export function buildAdvisorContext({
  analyses = [],
  blueprints = [],
  briefs = [],
  campaigns = [],
  creatives = [],
  merchantData = { products: [] },
  performance = {},
  profile = {},
} = {}) {
  const records = performance.records || [];
  const productContext = buildProductContext({
    shopifyProducts: merchantData.products || [],
    performanceRecords: records,
  });
  const creativeRanking = rankCreatives({ analyses, creatives, records });
  const campaignRanking = rankCampaigns(campaigns);
  const creatorRanking = rankCreators(records);
  const counts = {
    analyses: analyses.length,
    blueprints: blueprints.length,
    briefs: briefs.length,
    campaigns: campaigns.length,
    creatives: creatives.length,
    creatorSignals: creatorRanking.length,
    performanceRecords: records.length,
    products: productContext.availableProducts.length,
    shopifyProducts: productContext.shopifyProductsCount,
    importedProductNames: productContext.importedProductNamesCount,
  };
  const gaps = buildDataGaps({ counts, productContext, records, profile });

  return {
    counts,
    gaps,
    productContext,
    storeSummary: {
      productContextSource: productContext.productContextSource,
      productContextLabel: productContextLabel(productContext),
      products: productContext.availableProducts,
    },
    rankings: {
      campaigns: campaignRanking,
      creatives: creativeRanking,
      creators: creatorRanking,
    },
    sourceStatus: {
      hasDemoPerformanceData: Boolean(performance.hasDemoPerformanceData),
      hasMeasuredPerformanceData: Boolean(performance.hasMeasuredPerformanceData),
      productError: merchantData.errors?.[0] || "",
    },
  };
}

export function buildAdvisorResponse(context, question = "What should I do next?") {
  const assistantIntent = classifyAssistantIntent(question);
  if (assistantIntent === "page_help") {
    return withResponseMeta(answerPageHelp(context.pathname), context, assistantIntent, []);
  }
  if (assistantIntent === "navigation_help") {
    return withResponseMeta(answerNavigationHelp(context.pathname), context, assistantIntent, []);
  }
  if (assistantIntent === "google_ads_help") {
    return withResponseMeta(answerGoogleAdsHelp(), context, assistantIntent, []);
  }
  if (assistantIntent === "data_import_help") {
    return withResponseMeta(answerDataImportHelp(), context, assistantIntent, []);
  }
  if (assistantIntent === "settings_legal_help") {
    return withResponseMeta(answerSettingsLegalHelp(), context, assistantIntent, []);
  }

  const namedCreative = assistantIntent === "specific_creative_advice"
    ? findMentionedCreative(context.rankings?.creatives || [], question)
    : null;
  if (namedCreative) {
    return withResponseMeta(answerCreative(namedCreative, context.gaps, /fix|improve|weak|problem|change/i.test(question)), context, assistantIntent, namedCreative.evidence);
  }

  const intent = detectIntent(question);
  const { rankings, gaps } = context;
  let result;

  if (intent === "missing") result = answerMissingData(context);
  else if (intent === "creator") result = answerCreator(rankings.creators[0], gaps);
  else if (intent === "campaign_fix") {
    const weakCampaign = rankings.campaigns.find((row) => row.needsAttention);
    result = weakCampaign
      ? answerCampaign(weakCampaign, gaps, true)
      : answerNoCampaignAttention(rankings.campaigns[0], gaps);
  }
  else if (intent === "campaign") result = answerCampaign(rankings.campaigns[0], gaps, false);
  else if (intent === "creative_fix") result = answerCreative(rankings.creatives.find((row) => row.needsAttention), gaps, true);
  else if (intent === "creative") result = answerCreative(rankings.creatives[0], gaps, false);
  else if (intent === "brief") result = answerBrief(context);
  else if (intent === "test") result = answerTest(context);
  else result = answerNext(context);

  return withResponseMeta(result, context, assistantIntent || intent, result.evidence || []);
}

export async function buildAssistantResponse(context, question = "What should I do next?", options = {}) {
  const enrichedContext = {
    ...context,
    pathname: options.pathname || context.pathname || "/app/dashboard",
    selectedCreativeId: options.selectedCreativeId || "",
    selectedCreativeName: options.selectedCreativeName || "",
  };
  const intent = classifyAssistantIntent(question, enrichedContext);
  const deterministic = buildAdvisorResponse(enrichedContext, question);
  const messages = buildAssistantMessages(enrichedContext, question, intent);
  const completeChat = options.completeChat || completeAssistantChat;
  const provider = await completeChat({ messages });

  if (!provider.ok) {
    return {
      ...deterministic,
      risks: unique([
        provider.reason === "provider_error" ? provider.message : "",
        ...(deterministic.risks || []),
      ]),
      meta: {
        ...deterministic.meta,
        provider: provider.provider,
        providerFallback: true,
        providerReason: provider.reason,
      },
    };
  }

  const parsed = formatProviderContent(provider.content);
  return {
    ...deterministic,
    answer: provider.content,
    recommendation: parsed.recommendation,
    why: parsed.why,
    meta: {
      ...deterministic.meta,
      deterministic: false,
      provider: provider.provider,
      providerFallback: false,
    },
  };
}

function withResponseMeta(result, context, intent) {
  const risks = unique([
    ...(result.risks || []),
    context.sourceStatus.productError
      ? "Shopify product data could not be refreshed, so saved workspace context was used where available."
      : "",
    context.sourceStatus.hasDemoPerformanceData && !context.sourceStatus.hasMeasuredPerformanceData
      ? "Some visible performance signals are demo data and should not be treated as measured store results."
      : "",
  ]).filter(Boolean);
  const evidence = [
    ...(result.evidence || []),
    {
      label: "Product context",
      value: productContextLabel(context.productContext),
    },
  ].filter((item) => item?.label && item?.value !== undefined);
  const recommendation = result.recommendation;
  const why = result.why;

  return {
    answer: `${recommendation} ${why}`.trim(),
    recommendation,
    why,
    evidence,
    risks,
    nextAction: result.nextAction,
    nextActions: result.nextActions || [],
    storeSummary: context.storeSummary,
    meta: {
      deterministic: true,
      evidenceCount: evidence.length,
      intent,
      recordsConsidered: context.counts.performanceRecords,
    },
  };
}

function answerNext(context) {
  const weakCampaign = context.rankings.campaigns.find((row) => row.needsAttention);
  const strongCampaign = context.rankings.campaigns.find((row) => !row.needsAttention && row.metrics.roas !== null);
  const strongCreative = context.rankings.creatives[0];

  if (weakCampaign) return answerCampaign(weakCampaign, context.gaps, true);
  if (strongCampaign) return answerCampaign(strongCampaign, context.gaps, false);
  if (strongCreative) return answerCreative(strongCreative, context.gaps, false);
  return answerMissingData(context);
}

function answerCreative(creative, gaps, fix) {
  if (!creative) {
    return fallback(
      "There is not enough creative evidence to rank a creative yet.",
      "Import performance data or analyze a creative first; BluePrintAI will not guess without a saved signal.",
      "Analyze one creative or import at least one performance record.",
      [ACTIONS.review, ACTIONS.import],
      gaps,
    );
  }
  const shouldFix = fix || creative.needsAttention;
  return {
    recommendation: shouldFix
      ? `Fix “${creative.name}” before putting more spend behind it.`
      : `Use “${creative.name}” as the lead candidate for the next measured test.`,
    why: shouldFix
      ? "It has the clearest weak readiness, CTA, click, or conversion signal in the available store data."
      : "It ranks highest across available imported performance and saved heuristic review signals. This is directional guidance, not a platform rating or performance guarantee.",
    evidence: creative.evidence,
    risks: creative.risks,
    nextAction: shouldFix
      ? "Open AI Review Studio and revise the weakest hook, clarity, or CTA element before producing a new variation."
      : "Generate one brief that keeps this angle and changes a single variable, then compare it on the same campaign objective.",
    nextActions: shouldFix ? [ACTIONS.review, ACTIONS.library] : [ACTIONS.briefs, ACTIONS.library],
  };
}

function answerCampaign(campaign, gaps, needsAttention) {
  if (!campaign) {
    return fallback(
      "There is not enough assigned campaign evidence to choose a campaign yet.",
      "Campaign recommendations require a saved campaign and assigned creative performance records.",
      "Assign imported creative records to a campaign, then ask again.",
      [ACTIONS.campaigns, ACTIONS.import],
      gaps,
    );
  }
  const fix = needsAttention || campaign.needsAttention;
  return {
    recommendation: fix
      ? `Open “${campaign.name}” first and diagnose it before adding spend.`
      : `“${campaign.name}” has the strongest campaign signal for a controlled scale test.`,
    why: fix
      ? "Its assigned records show a weak return, click-through, or conversion signal relative to the available campaign set."
      : "It ranks highest using the app’s aggregated ROAS, revenue, CVR, CTR, creative assignments, and data completeness.",
    evidence: campaign.evidence,
    risks: campaign.risks,
    nextAction: fix
      ? "Review the weakest assigned creative and test one stronger hook or CTA before reassessing budget."
      : "Increase budget gradually and monitor CVR and ROAS before making another change.",
    nextActions: [
      { label: "Open Campaign", href: `/app/campaigns/${campaign.id}`, type: "primary" },
      ACTIONS.review,
    ],
  };
}

function answerNoCampaignAttention(campaign, gaps) {
  if (!campaign) return answerCampaign(null, gaps, true);
  return {
    recommendation: `No campaign currently crosses BluePrintAI’s weak-signal threshold; review “${campaign.name}” first because it has the strongest available campaign evidence.`,
    why: "None of the ranked campaigns has imported ROAS below 1x, CTR below 1%, or CVR below 1%. That does not prove every campaign is healthy, especially where metrics are incomplete.",
    evidence: campaign.evidence,
    risks: unique([
      ...campaign.risks,
      "A campaign without complete ROAS, CTR, and CVR cannot be cleared as healthy.",
    ]),
    nextAction: "Open the campaign and check its assigned creative coverage before changing budget or pausing anything.",
    nextActions: [
      { label: "Open Campaign", href: `/app/campaigns/${campaign.id}`, type: "primary" },
      ACTIONS.import,
    ],
  };
}

function answerCreator(creator, gaps) {
  if (!creator) {
    return fallback(
      "There is not enough creator attribution data to recommend a creator yet.",
      "No performance records contain a usable creator handle or name.",
      "Import creative performance with creator names, clicks, orders, and revenue.",
      [ACTIONS.import, ACTIONS.creators],
      gaps,
    );
  }
  return {
    recommendation: `Reuse ${creator.name} for the next controlled creator test.`,
    why: "This creator has the strongest blended signal across revenue, orders, clicks, engagement, conversion, and consistency in current records.",
    evidence: creator.evidence,
    risks: creator.risks,
    nextAction: "Generate a brief around this creator’s strongest product or angle, then hold the offer and campaign objective constant.",
    nextActions: [ACTIONS.briefs, ACTIONS.creators],
  };
}

function answerMissingData(context) {
  const topGaps = context.gaps.slice(0, 4);
  const first = topGaps[0];
  return {
    recommendation: first
      ? first.recommendation
      : "Your core store context is present; improve confidence by adding more recent, consistently attributed performance rows.",
    why: first
      ? first.why
      : "More observations reduce the chance that one creative or campaign is ranked from a thin sample.",
    evidence: Object.entries(context.counts).map(([label, value]) => ({
      label: countLabel(label),
      value: String(value),
    })),
    risks: topGaps.map((gap) => gap.risk),
    nextAction: first?.nextAction || "Import another reporting period with campaign, creative, creator, product, spend, and outcome fields.",
    nextActions: first?.actions || [ACTIONS.import, ACTIONS.settings],
  };
}

function answerBrief(context) {
  const creative = context.rankings.creatives[0];
  if (!creative) return answerCreative(null, context.gaps, false);
  return {
    recommendation: `Generate the next brief from “${creative.name}” and preserve its strongest angle.`,
    why: "The best next brief should start from the highest-ranked saved creative signal, then isolate one new hook, proof sequence, or CTA variable.",
    evidence: [...creative.evidence, { label: "Saved briefs", value: String(context.counts.briefs) }],
    risks: creative.risks,
    nextAction: "Create one product-specific brief with a single testable change and a defined success metric.",
    nextActions: [ACTIONS.briefs, ACTIONS.blueprint],
  };
}

function answerTest(context) {
  const creative = context.rankings.creatives[0];
  const campaign = context.rankings.campaigns[0];
  if (!creative && !campaign) return answerMissingData(context);
  return {
    recommendation: creative
      ? `Test a new hook variation of “${creative.name}” without changing its product, offer, or campaign objective.`
      : `Test one new creative inside “${campaign.name}” while holding the audience and offer constant.`,
    why: "Changing one variable makes the next result interpretable and lets BluePrintAI compare it with the current strongest signal.",
    evidence: creative?.evidence || campaign.evidence,
    risks: unique([...(creative?.risks || []), ...(campaign?.risks || [])]),
    nextAction: "Write a brief with one explicit hypothesis and import the next result with spend, clicks, orders, and revenue.",
    nextActions: [ACTIONS.briefs, ACTIONS.import],
  };
}

export function classifyAssistantIntent(question = "", context = {}) {
  const q = String(question || "").toLowerCase();
  const selectedCreative = String(context.selectedCreativeName || "").toLowerCase();
  if (/\bgoogle\b|\bads?\b|connection|connect|sync|zero rows|no data/.test(q)) return "google_ads_help";
  if (/csv|import|upload|video file|data import|fields|columns|match/.test(q)) return "data_import_help";
  if (/settings|legal|privacy|terms|support|contact|delete data|billing/.test(q)) return "settings_legal_help";
  if (/where|how do i get|navigate|find|open\b|go to/.test(q)) return "navigation_help";
  if (/what (does|can|is).*(page|screen|tab|library)|what.*(creative library|dashboard|connections|campaigns|settings).*(do|for|help)|help me do|what can i do here/.test(q)) return "page_help";
  if (selectedCreative && q.includes(selectedCreative)) return "specific_creative_advice";
  if (context.selectedCreativeId && /this creative|selected creative|current creative|fix it|improve it/.test(q)) return "specific_creative_advice";
  if (/\bttad\d+\b|\.mp4\b|specific creative|this creative|selected creative/.test(q)) return "specific_creative_advice";
  if (/campaign/.test(q) && /specific|this campaign|selected campaign|fix|weak|problem|improve/.test(q)) return "specific_campaign_advice";
  if (/creative/.test(q) && /fix|improve|weak|problem|selected|this/.test(q)) return "specific_creative_advice";
  return "general_strategy";
}

function buildAssistantMessages(context, question, intent) {
  const creative = intent === "specific_creative_advice"
    ? findMentionedCreative(context.rankings?.creatives || [], `${question} ${context.selectedCreativeName || ""} ${context.selectedCreativeId || ""}`)
    : null;
  const campaign = intent === "specific_campaign_advice"
    ? findMentionedCampaign(context.rankings?.campaigns || [], question)
    : null;
  const userContext = {
    counts: context.counts,
    currentRoute: context.pathname || "/app/dashboard",
    gaps: context.gaps?.slice(0, 4).map(({ recommendation, why }) => ({ recommendation, why })) || [],
    intent,
    page: pageSummary(context.pathname),
    productContext: productContextLabel(context.productContext),
    selectedCampaign: campaign ? summarizeRankedRow(campaign) : null,
    selectedCreative: creative ? summarizeRankedRow(creative) : null,
  };

  return [
    {
      role: "system",
      content: [
        "You are the BluePrintAI embedded Shopify assistant.",
        "Answer merchants with concise, practical, review-safe guidance.",
        "Google Ads access is read-only reporting. Never claim you can create, edit, pause, launch, delete, spend on, or mutate ads, campaigns, Shopify resources, Google Ads, or external platforms.",
        "Advice is advisory only. The user must review and perform external actions themselves.",
        "If the question is generic page help, answer about the page generally and do not mention individual creative filenames.",
        "Use selectedCreative or selectedCampaign only when present. Do not infer a first creative as selected.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        context: userContext,
        question,
      }),
    },
  ];
}

function formatProviderContent(content) {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return {
      recommendation: "The assistant could not produce a response.",
      why: "Try asking again with a little more detail.",
    };
  }
  const [first, ...rest] = clean.split(/(?<=\.)\s+/);
  return {
    recommendation: first.slice(0, 500),
    why: rest.join(" ").slice(0, 900),
  };
}

function answerPageHelp(pathname = "") {
  const summary = pageSummary(pathname);
  return {
    recommendation: summary.title,
    why: summary.description,
    evidence: [{ label: "Current page", value: summary.route }],
    risks: [],
    nextAction: summary.nextAction,
    nextActions: summary.actions,
  };
}

function answerNavigationHelp(pathname = "") {
  return {
    recommendation: "Use the left navigation to move between Dashboard, Creative Library, Data Import, Connections, Campaigns, and Settings.",
    why: `You are currently on ${pageSummary(pathname).title}. I can point you to the page that matches the workflow, but I do not change Shopify, ads, or external platforms for you.`,
    evidence: [{ label: "Current page", value: pathname || "/app/dashboard" }],
    risks: [],
    nextAction: "Tell me what task you are trying to complete and I will name the safest page to open.",
    nextActions: [ACTIONS.library, ACTIONS.import, ACTIONS.campaigns, ACTIONS.settings],
  };
}

function answerGoogleAdsHelp() {
  return {
    recommendation: "Google Ads in BluePrintAI is read-only reporting.",
    why: "A connection lets the app sync reporting rows for analysis when configured, but it does not create, edit, pause, launch, delete, or spend on campaigns. If rows are missing, check account selection, campaign selection, date coverage, and whether the account has recent activity.",
    evidence: [{ label: "Integration", value: "Google Ads read-only reporting" }],
    risks: ["A successful OAuth connection can still show no rows if the selected account or campaigns have no matching report activity."],
    nextAction: "Open Connections, confirm the Google Ads account, refresh campaigns, then sync reporting data.",
    nextActions: [ACTIONS.import],
  };
}

function answerDataImportHelp() {
  return {
    recommendation: "Use Data Import to add CSV performance rows and optionally match uploaded video files.",
    why: "CSV rows improve recommendations when they include creative names, platform, dates, views or impressions, clicks, spend, orders, revenue, product names, campaign names, and creator identifiers when available.",
    evidence: [{ label: "Import type", value: "CSV and matched videos" }],
    risks: ["Metrics that are not present in the CSV stay unavailable; BluePrintAI should not invent missing revenue, spend, CTR, CVR, or ROAS."],
    nextAction: "Prepare a CSV with creative-level rows and upload matching videos only when you want playable Creative Library media.",
    nextActions: [ACTIONS.import, ACTIONS.library],
  };
}

function answerSettingsLegalHelp() {
  return {
    recommendation: "Settings holds workspace context, support, legal, privacy, and data deletion entry points.",
    why: "Use it to review store context and find policy/support links. BluePrintAI does not modify Shopify settings or external platform settings from the assistant.",
    evidence: [{ label: "Page", value: "Settings" }],
    risks: [],
    nextAction: "Open Settings and choose the workspace, support, or legal section you need.",
    nextActions: [ACTIONS.settings],
  };
}

function pageSummary(pathname = "") {
  if (pathname.startsWith("/app/creative-library")) {
    return {
      actions: [ACTIONS.library, ACTIONS.import, ACTIONS.review],
      description: "Creative Library helps you inspect saved creatives, imported performance context, playable matched media, product links, and evidence you can use for briefs or tests. It is a workspace view, not an ad launcher.",
      nextAction: "Open a creative only when you want creative-specific advice; otherwise use the page to organize evidence and spot what data is missing.",
      route: "/app/creative-library",
      title: "Creative Library helps you organize creative evidence.",
    };
  }
  if (pathname.startsWith("/app/connections")) {
    return {
      actions: [ACTIONS.import],
      description: "Connections shows optional ad-platform reporting connections and keeps CSV import available. Google Ads is reporting-only and does not mutate campaigns.",
      nextAction: "Connect or sync read-only reporting where configured, or use CSV import.",
      route: "/app/connections",
      title: "Connections helps you manage optional data sources.",
    };
  }
  if (pathname.startsWith("/app/data-import")) {
    return {
      actions: [ACTIONS.import, ACTIONS.library],
      description: "Data Import lets you bring in CSV performance rows and match local video uploads so BluePrintAI can analyze real workspace evidence.",
      nextAction: "Import creative-level rows with as many outcome fields as you have.",
      route: "/app/data-import",
      title: "Data Import helps you add evidence.",
    };
  }
  if (pathname.startsWith("/app/campaigns")) {
    return {
      actions: [ACTIONS.campaigns, ACTIONS.import],
      description: "Campaigns are local planning groups for organizing creative records and tests. They do not launch or edit ads externally.",
      nextAction: "Group related creatives and compare imported outcomes.",
      route: "/app/campaigns",
      title: "Campaigns helps you organize local test plans.",
    };
  }
  if (pathname.startsWith("/app/settings")) {
    return {
      actions: [ACTIONS.settings],
      description: "Settings contains workspace profile, store context, support, legal, privacy, and data controls.",
      nextAction: "Review workspace context or open support/legal links.",
      route: "/app/settings",
      title: "Settings helps you manage workspace and policy information.",
    };
  }
  return {
    actions: [ACTIONS.import, ACTIONS.library, ACTIONS.briefs],
    description: "This app page helps turn Shopify and workspace evidence into advisory creative planning. The assistant does not make changes in Shopify or external ad platforms.",
    nextAction: "Ask what data is missing or what workflow to open next.",
    route: pathname || "/app/dashboard",
    title: "BluePrintAI helps you plan from available evidence.",
  };
}

function findMentionedCreative(creatives, question = "") {
  const q = normalizeText(question);
  return creatives.find((creative) => {
    const name = normalizeText(creative.name);
    const id = normalizeText(creative.id);
    return (name && q.includes(name)) || (id && q.includes(id));
  }) || null;
}

function findMentionedCampaign(campaigns, question = "") {
  const q = normalizeText(question);
  return campaigns.find((campaign) => {
    const name = normalizeText(campaign.name);
    const id = normalizeText(campaign.id);
    return (name && q.includes(name)) || (id && q.includes(id));
  }) || null;
}

function summarizeRankedRow(row) {
  return {
    evidence: row.evidence || [],
    id: row.id,
    name: row.name,
    needsAttention: Boolean(row.needsAttention),
    risks: row.risks || [],
  };
}

function fallback(recommendation, why, nextAction, nextActions, gaps) {
  return {
    recommendation,
    why,
    evidence: gaps.slice(0, 4).map((gap) => gap.evidence),
    risks: gaps.slice(0, 3).map((gap) => gap.risk),
    nextAction,
    nextActions,
  };
}

function rankCampaigns(campaigns) {
  return campaigns.map((campaign) => {
    const metrics = campaign.metrics || {};
    const roas = nullable(metrics.roas);
    const ctr = nullable(metrics.ctr);
    const cvr = nullable(metrics.cvr);
    const revenue = nullable(metrics.revenue);
    const completeness = [roas, ctr, cvr, revenue, nullable(metrics.clicks), nullable(metrics.orders)].filter((v) => v !== null).length;
    const needsAttention = (roas !== null && roas < 1) || (ctr !== null && ctr < 1) || (cvr !== null && cvr < 1);
    const score = (roas || 0) * 18 + Math.min(30, (revenue || 0) / 100) + (cvr || 0) * 2 + (ctr || 0) + Number(campaign.creativeCount || 0) * 3 + completeness * 2 - (needsAttention ? 15 : 0);
    return {
      id: campaign.id,
      name: campaign.name || "Untitled campaign",
      metrics: { roas, ctr, cvr, revenue },
      needsAttention,
      score,
      evidence: compact([
        metric("ROAS", roas, "x"), metric("Revenue", revenue, "currency"), metric("CVR", cvr, "%"),
        metric("CTR", ctr, "%"), { label: "Assigned creatives", value: String(campaign.creativeCount || 0) },
      ]),
      risks: completeness < 3 ? ["This campaign has incomplete commercial metrics, which lowers ranking confidence."] : [],
    };
  }).sort((a, b) => b.score - a.score);
}

function rankCreatives({ analyses, creatives, records }) {
  const rows = [];
  for (const record of records) {
    const roas = value(record, "roas");
    const revenue = value(record, "revenue");
    const orders = value(record, "orders", "conversions");
    const clicks = value(record, "clicks");
    const ctr = value(record, "ctr");
    const cvr = value(record, "cvr", "conversionRate");
    const engagement = value(record, "engagementRate");
    const readiness = value(record, "creativeScore", "readinessScore");
    const score = (roas || 0) * 16 + Math.min(35, (revenue || 0) / 80) + (orders || 0) * 3 + Math.min(20, (clicks || 0) / 25) + (engagement || 0) + (readiness || 0) / 5;
    const commercialCount = [roas, revenue, orders, clicks, ctr, cvr].filter((v) => v !== null).length;
    rows.push({
      id: record.id,
      name: record.creativeTitle || record.adName || record.creativeId || "Imported creative",
      needsAttention: (clicks !== null && clicks >= 50 && (!cvr || cvr < 1.5)) || (readiness !== null && readiness < 55),
      score,
      evidence: compact([metric("ROAS", roas, "x"), metric("Revenue", revenue, "currency"), metric("Orders", orders), metric("Clicks", clicks), metric("CTR", ctr, "%"), metric("CVR", cvr, "%"), metric("Engagement", engagement, "%"), metric("Creative readiness", readiness, "/100")]),
      risks: commercialCount < 2 ? ["This creative has limited commercial outcome data; its rank leans on engagement or readiness signals."] : [],
    });
  }
  for (const record of analyses) rows.push(analysisCreative(record, "Saved AI review"));
  for (const record of creatives) rows.push(savedCreative(record));
  return dedupeByName(rows).sort((a, b) => b.score - a.score);
}

function analysisCreative(record, source) {
  const payload = record.payload?.result || record.payload || {};
  const scores = payload.scores || payload.analysis?.scores || payload.reviewScores || {};
  const hook = scoreValue(scores, "hook", "hookScore");
  const clarity = scoreValue(scores, "clarity", "clarityScore");
  const cta = scoreValue(scores, "cta", "ctaScore");
  const readiness = scoreValue(scores, "readiness", "readinessScore") || Math.round(((hook || 0) + (clarity || 0) + (cta || 0)) / 3 * 10);
  return {
    id: record.id,
    name: record.productTitle || record.fileName || "Saved analysis",
    needsAttention: readiness < 55 || (cta !== null && cta < 5),
    score: readiness,
    evidence: compact([metric("Hook", hook, "/10"), metric("Clarity", clarity, "/10"), metric("CTA", cta, "/10"), metric("Creative readiness", readiness, "/100"), { label: "Source", value: source }]),
    risks: ["No linked commercial performance was found for this saved AI review."],
  };
}

function savedCreative(record) {
  const row = analysisCreative({ ...record, payload: record.payload?.analysis || record.payload }, "Saved creative");
  row.name = record.title || row.name;
  row.score = row.score || Number(record.payload?.score || 0) || 40;
  return row;
}

function rankCreators(records) {
  const groups = new Map();
  for (const record of records) {
    const name = record.creatorHandle || record.creatorName;
    if (!name) continue;
    const key = String(name).trim().toLowerCase();
    const row = groups.get(key) || { name, records: 0, clicks: 0, orders: 0, revenue: 0, engagements: 0, views: 0, commercialRows: 0 };
    row.records += 1;
    row.clicks += number(record.clicks);
    row.orders += number(record.orders ?? record.conversions);
    row.revenue += number(record.revenue);
    row.engagements += number(record.engagements) + number(record.likes) + number(record.comments) + number(record.shares);
    row.views += number(record.views ?? record.videoViews);
    if ([record.clicks, record.orders, record.revenue].some((v) => v !== null && v !== undefined)) row.commercialRows += 1;
    groups.set(key, row);
  }
  return [...groups.values()].map((row) => {
    const cvr = row.clicks ? row.orders / row.clicks * 100 : null;
    const engagementRate = row.views ? row.engagements / row.views * 100 : null;
    const score = row.revenue / 80 + row.orders * 4 + row.clicks / 25 + (engagementRate || 0) + Math.min(10, row.records * 2);
    return {
      ...row,
      score,
      evidence: compact([metric("Revenue", row.revenue, "currency"), metric("Orders", row.orders), metric("Clicks", row.clicks), metric("CVR", cvr, "%"), metric("Engagement", engagementRate, "%"), { label: "Records", value: String(row.records) }]),
      risks: row.commercialRows ? [] : ["This creator rank is based on public engagement only; conversion attribution is missing."],
    };
  }).sort((a, b) => b.score - a.score);
}

function buildDataGaps({ counts, productContext, records, profile }) {
  const gaps = [];
  if (!productContext.hasAnyProductContext && !profile.mainProduct) gaps.push(gap("Add product context.", "Product context is missing, so advice cannot reliably connect creative signals to a specific product.", "Product context", "0", "Add a Shopify product, import a product name, or enter your main product in Settings.", [ACTIONS.import, ACTIONS.settings]));
  if (!counts.performanceRecords) gaps.push(gap("Import performance data before choosing a winner.", "There are no imported or synced performance records, so BluePrintAI cannot compare real outcomes.", "Performance records", "0", "Import creative-level performance with clicks, orders, revenue, and spend.", [ACTIONS.import]));
  if (!counts.campaigns) gaps.push(gap("Create or import a campaign and assign its creatives.", "Campaign assignments are missing, which prevents campaign-level opportunity ranking.", "Campaigns", "0", "Create a campaign and assign related creative records.", [ACTIONS.campaigns]));
  if (!counts.creatorSignals) gaps.push(gap("Add creator attribution to imported creative rows.", "No usable creator name or handle is present, so BluePrintAI cannot compare creators.", "Creator signals", "0", "Import creator handles with clicks, orders, revenue, and engagement.", [ACTIONS.import, ACTIONS.creators]));
  if (!counts.briefs && (counts.creatives || counts.analyses)) gaps.push(gap("Generate a brief from the strongest saved creative.", "Creative evidence exists, but there is no saved brief defining the next controlled test.", "Saved briefs", "0", "Generate a brief with one hypothesis and success metric.", [ACTIONS.briefs]));
  const commercialRows = records.filter((row) => [row.clicks, row.orders, row.revenue, row.spend].some((v) => v !== null && v !== undefined)).length;
  if (records.length && !commercialRows) gaps.push(gap("Import commercial outcomes to improve confidence.", "Current rows contain engagement but no clicks, orders, revenue, or spend.", "Commercial rows", "0", "Add available outcome fields to the next import.", [ACTIONS.import]));
  return gaps;
}

function gap(recommendation, why, label, value, nextAction, actions) {
  return { recommendation, why, evidence: { label, value }, risk: why, nextAction, actions };
}

function detectIntent(question) {
  const q = String(question || "").toLowerCase();
  if (/missing|need more data|data gap|connect/.test(q)) return "missing";
  if (/creator|influencer/.test(q)) return "creator";
  if (/campaign/.test(q) && /attention|wast|fix|weak|pause|problem/.test(q)) return "campaign_fix";
  if (/campaign/.test(q)) return "campaign";
  if (/creative|\bad\b/.test(q) && /fix|weak|first|improve|attention/.test(q)) return "creative_fix";
  if (/creative|\bad\b|scale|strongest|winner/.test(q)) return "creative";
  if (/brief|generate/.test(q)) return "brief";
  if (/test|experiment|try next/.test(q)) return "test";
  return "next";
}

function metric(label, raw, suffix = "") {
  const value = nullable(raw);
  if (value === null) return null;
  if (suffix === "currency") return { label, value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) };
  return { label, value: `${formatNumber(value)}${suffix}` };
}

function compact(values) { return values.filter(Boolean).slice(0, 7); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function number(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function nullable(value) { return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value); }
function value(record, ...keys) { for (const key of keys) { const found = nullable(record[key]); if (found !== null) return found; } return null; }
function scoreValue(scores, ...keys) { for (const key of keys) { const found = nullable(scores?.[key]?.score ?? scores?.[key]); if (found !== null) return found > 10 ? found / 10 : found; } return null; }
function formatNumber(value) { return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function countLabel(value) {
  if (value === "products") return "Products";
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
function dedupeByName(rows) {
  const output = new Map();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const current = output.get(key);
    if (!current || row.score > current.score) output.set(key, row);
  }
  return [...output.values()];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[^\w.:-]+/g, " ")
    .trim();
}
