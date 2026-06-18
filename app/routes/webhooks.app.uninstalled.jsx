import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteWorkspaceData } from "../models/blueprint.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await deleteWorkspaceData(shop);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
