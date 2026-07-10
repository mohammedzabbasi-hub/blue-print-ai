import { redirect } from "react-router";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  buildAdvisorContext,
  buildAssistantResponse,
} from "../models/advisor.server";
import {
  buildStoreIntelligenceContext,
  compactStoreContextForLLM,
  loadStoreIntelligenceData,
} from "../services/store-intelligence-context.server";
import { parseAssistantQuestion } from "../services/assistant-query-understanding.server";
import { resolveStoreEntities } from "../services/store-entity-resolver.server";
import { buildAssistantEvidencePacket } from "../services/assistant-facts.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => [{ title: "BluePrintAI" }];

// Keep this endpoint for the global AssistantWidget API, but retire the old page UI.
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  return redirect(withEmbeddedRouteParams("/app/dashboard", url.search));
};

export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const question = String(formData.get("question") || "").trim().slice(0, 1200);
    const clientRequestId = String(formData.get("clientRequestId") || "").trim().slice(0, 100);
    const pathname = sanitizeAppPath(formData.get("pathname"));
    const search = String(formData.get("search") || "").slice(0, 1000);
    const searchParams = new URLSearchParams(search);
    const selectedCreativeId = searchParams.get("creativeId") || "";
    const selectedProductId = searchParams.get("productId") || "";
    if (!question) {
      return Response.json({ error: "Ask BluePrintAI a question first." }, { status: 400 });
    }

    const context = await loadAdvisorContext(request, {
      question,
      routeId: pathname,
      selectedProductId,
    });
    const selectedCreative = selectedCreativeId
      ? context.rankings.creatives.find((creative) => String(creative.id) === String(selectedCreativeId))
      : null;
    const parsedQuestion = parseAssistantQuestion(question);
    const resolvedEntities = await resolveStoreEntities({
      shop: context.shop,
      parsedQuestion,
      data: context.storeData,
    });
    const evidencePacket = buildAssistantEvidencePacket({
      shop: context.shop,
      question,
      parsedQuestion,
      resolvedEntities,
    });
    logAssistantDebug({ question, parsedQuestion, resolvedEntities, evidencePacket });
    return Response.json({
      ...await buildAssistantResponse(context, question, {
        evidencePacket,
        pathname,
        selectedCreativeId,
        selectedCreativeName: selectedCreative?.name || "",
        storeIntelligenceContext: context.storeIntelligenceContext,
      }),
      clientRequestId,
      requestId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
  } catch (error) {
    console.error("Assistant action failed", {
      message: error?.message,
    });
    return Response.json(
      {
        error: "The assistant could not answer right now. Please try again.",
      },
      { status: 500 },
    );
  }
};

async function loadAdvisorContext(request, { question, routeId, selectedProductId }) {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const data = await loadStoreIntelligenceData({
    merchantData,
    shop: session.shop,
  });
  const storeContext = await buildStoreIntelligenceContext({
    data,
    merchantData,
    question,
    routeId,
    selectedProductId,
    shop: session.shop,
  });

  return {
    ...buildAdvisorContext({
      analyses: data.analyses,
      blueprints: data.blueprints,
      briefs: data.briefs,
      campaigns: data.campaigns,
      creatives: data.creatives,
      merchantData,
      performance: data.performance,
      profile: data.profile,
    }),
    shop: session.shop,
    storeData: data,
    storeIntelligenceContext: compactStoreContextForLLM(storeContext, question),
  };
}

function logAssistantDebug({ question, parsedQuestion, resolvedEntities, evidencePacket }) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("Assistant evidence", {
    question: safeDebugText(question),
    intent: parsedQuestion.intent,
    resolvedEntities: resolvedEntities.entityMatches.map((entity) => safeDebugText(entity.name)),
    sourceCounts: evidencePacket.sourceSummary,
  });
}

function safeDebugText(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "[URL omitted]")
    .replace(/\bBearer\s+\S+/gi, "[credential omitted]")
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|developer[_ -]?token|session|hmac|oauth)\s*[:=]\s*\S+/gi, "$1=[credential omitted]")
    .slice(0, 300);
}

function sanitizeAppPath(value) {
  const path = String(value || "/app/dashboard").trim();
  return path.startsWith("/app/") || path === "/app" ? path : "/app/dashboard";
}

export default function RecommendationsRedirect() {
  return null;
}
