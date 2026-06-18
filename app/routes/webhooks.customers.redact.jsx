import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  // BluePrintAI does not persist customer records in its Prisma schema.
  // If customer-specific storage is added later, delete or anonymize it here.

  return new Response();
};
