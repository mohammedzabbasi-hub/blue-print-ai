import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Acceptable Use Policy | BluePrintAI" }];
};

export default function AcceptableUseRoute() {
  return <LegalPage pageId="acceptable-use" />;
}
