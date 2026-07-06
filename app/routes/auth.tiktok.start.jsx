import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return new Response(
    "TikTok Ads connection is coming soon. Manual CSV import is available.",
    { status: 404 },
  );
};
