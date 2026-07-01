import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Terms Of Service | BluePrintAI" }];
};

export default function TermsRoute() {
  return <LegalPage pageId="terms" />;
}
