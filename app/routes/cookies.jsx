import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Cookie Policy | BluePrintAI" }];
};

export default function CookiesRoute() {
  return <LegalPage pageId="cookies" />;
}
