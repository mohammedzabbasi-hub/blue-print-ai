import { LegalPage } from "../components/legal/LegalLayout";

export const meta = () => {
  return [{ title: "Contact | BluePrintAI" }];
};

export default function ContactRoute() {
  return <LegalPage pageId="contact" />;
}
