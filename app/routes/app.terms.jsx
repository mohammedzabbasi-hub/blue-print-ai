import { redirect } from "react-router";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Terms | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  throw redirect(withEmbeddedRouteParams("/app/settings?section=legal", url.search));
};

export default function AppTermsRoute() {
  return null;
}
