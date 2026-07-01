import { redirect } from "react-router";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => {
  return [{ title: "Redirecting | BluePrintAI" }];
};

export const loader = ({ request }) => {
  return redirect(
    withEmbeddedRouteParams("/app", new URL(request.url).search),
  );
};

export default function LegacyOnboardingRedirect() {
  return null;
}
