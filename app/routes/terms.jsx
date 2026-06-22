import { Link } from "react-router";

const sections = [
  {
    title: "MVP And Beta Nature",
    body: "BlueprintAI is currently an MVP. Features, data models, analysis outputs, and integrations may change as the product is tested and improved.",
  },
  {
    title: "Current Workflow",
    body: "The current workflow supports demo accounts, onboarding-created workspaces, manual CSV/JSON import, and creative upload/analysis. TikTok Shop OAuth and direct TikTok Shop API integration are planned but are not live yet.",
  },
  {
    title: "User Responsibility",
    body: "You are responsible for the data you upload or import, including confirming that you have the right to use any shop, product, creator, order, creative, or performance data submitted to the app.",
  },
  {
    title: "AI Recommendations",
    body: "AI-generated analysis, recommendations, briefs, scores, and predictions are informational tools. They are not guarantees of ad performance, revenue, sales, ROAS, or platform approval.",
  },
  {
    title: "No Guaranteed Results",
    body: "BlueprintAI does not guarantee sales lift, ROAS improvement, account growth, creator performance, or any specific business outcome.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#070b16] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          BlueprintAI
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-[#0b1220] p-8 md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Terms Of Service
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
            Terms Of Service
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            These terms are written for the current MVP and are intentionally
            plain about what is available today.
          </p>

          <div className="mt-10 space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                <h2 className="text-xl font-black text-white">{section.title}</h2>
                <p className="mt-3 leading-7 text-slate-400">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-cyan-200">
            <Link to="/privacy" className="hover:text-cyan-100">Privacy</Link>
            <Link to="/support" className="hover:text-cyan-100">Support</Link>
            <Link to="/login" className="hover:text-cyan-100">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
