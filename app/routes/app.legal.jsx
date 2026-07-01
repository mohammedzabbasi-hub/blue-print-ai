import { LegalHub } from "../components/legal/LegalLayout";
import { loadShopifyRouteContext } from "../models/route-context.server";

export const meta = () => {
  return [{ title: "Legal | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);

  return { shop: session.shop };
};

export default function AppLegalRoute() {
  return <LegalHub appPath />;
}
