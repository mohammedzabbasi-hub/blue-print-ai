import { redirect } from "react-router";
import {
  clearGoogleAdsDemoData,
  seedGoogleAdsDemoData,
} from "../models/ad-platform-connection.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const search = new URL(request.url).search;
  try {
    if (formData.get("intent") === "clear") {
      const result = await clearGoogleAdsDemoData(session.shop);
      return redirect(withEmbeddedRouteParams(`/app/connections?demoCleared=${result.count}`, search));
    }
    if (formData.get("intent") !== "load") throw new Error("Unknown demo data action.");
    const result = await seedGoogleAdsDemoData(session.shop);
    return redirect(withEmbeddedRouteParams(`/app/connections?demoLoaded=${result.count}`, search));
  } catch (error) {
    return redirect(withEmbeddedRouteParams(`/app/connections?error=${encodeURIComponent(error.message || "Could not update demo Google Ads data.")}`, search));
  }
};

export const loader = () => new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
