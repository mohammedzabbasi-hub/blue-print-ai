import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "AI Disclaimer | BluePrintAI" }];
};

export default function AIDisclaimerRoute() {
  return <LegalPage pageId="ai-disclaimer" />;
}
