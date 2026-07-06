import { loadShopifyRouteContext } from "../models/route-context.server";

export const action = async ({ request }) => {
  await loadShopifyRouteContext(request);
  return new Response(
    "TikTok Ads sync is coming soon. Manual CSV import is available.",
    { status: 404 },
  );
};

export const loader = () =>
  new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
