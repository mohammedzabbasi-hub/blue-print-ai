import { LegalPage } from "../components/legal/LegalLayout";
import { loadShopifyRouteContext } from "../models/route-context.server";

export const meta = () => {
  return [{ title: "Copyright Policy | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);

  return { shop: session.shop };
};

export default function AppCopyrightRoute() {
  return <LegalPage appPath pageId="copyright" />;
}
