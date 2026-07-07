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
  buildAdvisorResponse,
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
    if (!question) {
      return Response.json({ error: "Ask BluePrintAI a question first." }, { status: 400 });
    }

    const context = await loadAdvisorContext(request);
    return Response.json({
      ...buildAdvisorResponse(context, question),
      requestId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error?.message ||
          "The assistant could not read the current workspace data. Please try again.",
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

export default function RecommendationsRedirect() {
  return null;
}
