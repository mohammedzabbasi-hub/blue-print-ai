import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Refund Policy | BluePrintAI" }];
};

export default function RefundPolicyRoute() {
  return <LegalPage pageId="refund-policy" />;
}
