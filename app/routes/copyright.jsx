import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Copyright Policy | BluePrintAI" }];
};

export default function CopyrightRoute() {
  return <LegalPage pageId="copyright" />;
}
