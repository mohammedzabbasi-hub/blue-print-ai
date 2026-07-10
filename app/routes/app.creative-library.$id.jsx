import { redirect } from "react-router";
import { deleteSavedCreative } from "../models/blueprint.server";
import { assignCampaignRecords } from "../models/campaign.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { merchantErrorMessage } from "../utils/merchant-errors";

export const meta = () => {
  return [{ title: "Creative Library | BluePrintAI" }];
};

export const loader = async ({ params, request }) => {
  const query = new URLSearchParams(new URL(request.url).search);
  query.set("creativeId", params.id);

  return redirect(`/app/creative-library?${query.toString()}`);
};

// Preserve legacy "Move to campaign" and delete form submissions while GET
// requests use the Creative Library modal instead of the old detail screen.
export const action = async ({ params, request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "assignCampaign") {
    try {
      await assignCampaignRecords(
        session.shop,
        String(formData.get("campaignId") || ""),
        { savedCreativeIds: [params.id] },
      );
      return { success: "Creative campaign updated." };
    } catch (error) {
      return { error: merchantErrorMessage(error, "Could not assign this creative. Try again.") };
    }
  }

  if (intent !== "delete") {
    return { error: "Unknown creative action." };
  }

  try {
    const deleted = await deleteSavedCreative(session.shop, params.id);

    if (!deleted) {
      return { error: "Creative was not found for this shop." };
    }

    const query = new URLSearchParams(new URL(request.url).search);
    query.set("deleted", "1");
    query.delete("creativeId");
    return redirect(`/app/creative-library?${query.toString()}`);
  } catch (error) {
    return { error: merchantErrorMessage(error, "Could not remove this creative. Try again.") };
  }
};

export default function LegacyCreativeDetailRedirect() {
  return null;
}
