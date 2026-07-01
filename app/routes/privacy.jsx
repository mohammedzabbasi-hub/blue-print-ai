import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Privacy Policy | BluePrintAI" }];
};

export default function PrivacyRoute() {
  return <LegalPage pageId="privacy" />;
}
