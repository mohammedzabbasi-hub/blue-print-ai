import { Link } from "react-router";

const sections = [
  {
    title: "Data You Provide",
    body: "BlueprintAI may store account information, onboarding workspace details, uploaded or imported CSV/JSON files, and creative/video analysis inputs you choose to submit. This includes shop names, product names, creator information, performance rows, creative metadata, and analysis results.",
  },
  {
    title: "Demo Data And Workspace Data",
    body: "Demo accounts use seeded demo data for evaluation. Onboarding-created accounts use the workspace and shop data associated with that account. The MVP is designed to keep demo data separate from real workspace data.",
  },
  {
    title: "Current MVP Import Flow",
    body: "The current MVP supports manual CSV/JSON import and creative upload/analysis. TikTok Shop OAuth and direct TikTok Shop API syncing are planned but are not live yet.",
  },
  {
    title: "Secrets And Credentials",
    body: "Do not submit API keys, account passwords, private access tokens, or other secrets through support messages, uploads, imports, or free-text fields.",
  },
  {
    title: "Support Contact",
    body: "For privacy or account questions, use the Support page and include only non-sensitive details needed to identify your workspace and issue.",
  },
];

export const meta = () => {
  return [{ title: "Privacy Policy | BluePrintAI" }];
};

export default function PrivacyRoute() {
  return (
    <div className="min-h-screen bg-[#070b16] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
        >
          BlueprintAI
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-[#0b1220] p-8 md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Privacy Policy
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
            Privacy Policy
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-400">
            This MVP privacy notice explains how BlueprintAI handles data during
            demo evaluation and onboarding-created workspace use.
          </p>

          <div className="mt-10 space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
              >
                <h2 className="text-xl font-black text-white">
                  {section.title}
                </h2>

                <p className="mt-3 leading-7 text-slate-400">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-cyan-200">
            <Link to="/terms" className="hover:text-cyan-100">
              Terms
            </Link>

            <Link to="/support" className="hover:text-cyan-100">
              Support
            </Link>

            <Link to="/auth/login" className="hover:text-cyan-100">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}