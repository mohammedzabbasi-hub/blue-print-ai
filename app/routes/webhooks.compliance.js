import { createComplianceAction } from "../models/compliance-webhook.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = () =>
  new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });

export const action = createComplianceAction({
  authenticateWebhook: (request) => authenticate.webhook(request),
});
