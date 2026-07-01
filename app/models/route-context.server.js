import { authenticate } from "../shopify.server";
import { DEMO_PRODUCTS, loadMerchantData } from "./blueprint.server";
import { getLocalDemoAccess } from "../utils/demo-access.server";

export async function loadShopifyProducts(request) {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);

  return {
    admin,
    products: merchantData.products,
    merchantData,
    session,
  };
}

export async function loadShopifyStoreContext(request) {
  return loadShopifyRouteContext(request);
}

export async function loadShopifyRouteContext(request) {
  const { explicitDemoMode, useDemoWorkspace } = getLocalDemoAccess(request);

  if (useDemoWorkspace) {
    return {
      admin: null,
      merchantData: {
        products: explicitDemoMode ? DEMO_PRODUCTS : [],
        shop: {
          name: explicitDemoMode ? "BluePrintAI demo" : "BluePrintAI local",
          myshopifyDomain: "blueprintai-test-store.myshopify.com",
          currencyCode: "USD",
        },
        orders: [],
        orderScopeEnabled: false,
        scopes: [],
        errors: [],
      },
      session: { shop: "blueprintai-test-store.myshopify.com" },
      demoMode: explicitDemoMode,
    };
  }

  const { admin, merchantData, session } = await loadShopifyProducts(request);

  return { admin, merchantData, session, demoMode: false };
}
