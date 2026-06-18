import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteWorkspaceData } from "../models/blueprint.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Deletes all app-owned workspace rows keyed by the verified shop domain.
  await deleteWorkspaceData(shop);
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
