import { redirect } from "react-router";
import {
  getWorkspaceProfile,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { listCampaigns } from "../models/campaign.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  buildAdvisorContext,
  buildAssistantResponse,
} from "../models/advisor.server";
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
    const pathname = sanitizeAppPath(formData.get("pathname"));
    const search = String(formData.get("search") || "").slice(0, 1000);
    const selectedCreativeId = new URLSearchParams(search).get("creativeId") || "";
    if (!question) {
      return Response.json({ error: "Ask BluePrintAI a question first." }, { status: 400 });
    }

    const context = await loadAdvisorContext(request);
    const selectedCreative = selectedCreativeId
      ? context.rankings.creatives.find((creative) => String(creative.id) === String(selectedCreativeId))
      : null;
    return Response.json({
      ...await buildAssistantResponse(context, question, {
        pathname,
        selectedCreativeId,
        selectedCreativeName: selectedCreative?.name || "",
      }),
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

async function loadAdvisorContext(request) {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [analyses, creatives, blueprints, briefs, profile, performance, campaigns] =
    await Promise.all([
      listVideoAnalyses(session.shop, 100),
      listSavedCreatives(session.shop, 100),
      listRevenueBlueprints(session.shop, 100),
      listSavedBriefs(session.shop, 100),
      getWorkspaceProfile(session.shop),
      listCreativePerformance({ merchantData, shop: session.shop }),
      listCampaigns(session.shop),
    ]);

  return {
    ...buildAdvisorContext({
      analyses,
      blueprints,
      briefs,
      campaigns,
      creatives,
      merchantData,
      performance,
      profile,
    }),
    shop: session.shop,
  };
}

function sanitizeAppPath(value) {
  const path = String(value || "/app/dashboard").trim();
  return path.startsWith("/app/") || path === "/app" ? path : "/app/dashboard";
}

export default function RecommendationsRedirect() {
  return null;
}
