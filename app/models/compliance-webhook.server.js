import { deleteWorkspaceData } from "./blueprint.server.js";
import db from "../db.server.js";

export const COMPLIANCE_TOPICS = Object.freeze({
  CUSTOMERS_DATA_REQUEST: "CUSTOMERS_DATA_REQUEST",
  CUSTOMERS_REDACT: "CUSTOMERS_REDACT",
  SHOP_REDACT: "SHOP_REDACT",
});

export function createComplianceAction({
  authenticateWebhook,
  deleteShopWorkspace = deleteWorkspaceData,
  deleteShopSessions = (shop) => db.session.deleteMany({ where: { shop } }),
}) {
  return async function complianceAction({ request }) {
    let webhook;

    try {
      // The original request is handed directly to Shopify. Do not read or clone it first:
      // authenticate.webhook consumes the raw body while verifying the HMAC signature.
      webhook = await authenticateWebhook(request);
    } catch (error) {
      if (
        error instanceof Response &&
        !request.headers.get("x-shopify-hmac-sha256") &&
        (error.status === 400 || error.status === 401)
      ) {
        throw new Response(null, { status: 401, statusText: "Unauthorized" });
      }
      throw error;
    }

    const { shop, topic } = webhook;

    switch (topic) {
      case COMPLIANCE_TOPICS.CUSTOMERS_DATA_REQUEST:
      case COMPLIANCE_TOPICS.CUSTOMERS_REDACT:
        // BluePrintAI has no Shopify customer or order models and requests no
        // customer/order scopes. There is no customer-specific app data to
        // export, delete, or include in this response.
        break;
      case COMPLIANCE_TOPICS.SHOP_REDACT:
        // Both operations are shop-scoped deleteMany flows, so Shopify retries
        // are safe even if a previous delivery completed only one operation.
        await deleteShopWorkspace(shop);
        await deleteShopSessions(shop);
        break;
      default:
        return new Response("Unsupported compliance webhook topic", {
          status: 400,
        });
    }

    return new Response(null, { status: 204 });
  };
}
