import { authenticate } from "../shopify.server";

// Thin, shared wrapper around the standard Shopify authentication call so
// routes that only need `{ admin, session }` don't each re-import
// `shopify.server` directly.
export async function loadShopifyRouteContext(request) {
  return authenticate.admin(request);
}
