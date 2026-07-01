import { Link } from "react-router";

export const meta = () => {
  return [{ title: "Support | BluePrintAI" }];
};

export default function SupportRoute() {
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
            Support
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
            Support
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-400">
            Need help with the MVP? Use the contact option below and include
            enough context for the team to understand the workspace and issue.
          </p>

          <div className="mt-10 grid gap-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <h2 className="text-xl font-black text-white">
                Current MVP Status
              </h2>

              <p className="mt-3 leading-7 text-slate-400">
                Current Shopify embedded app workflows support saved creative
                records, uploaded creative analysis, generated briefs,
                recommendations, and revenue blueprints. TikTok Shop OAuth/API
                connection is not live yet.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <h2 className="text-xl font-black text-white">
                What To Include
              </h2>

              <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-400">
                <li>Your Shopify store domain or workspace name.</li>
                <li>The page or workflow where the issue happened.</li>
                <li>
                  Whether you are using the embedded app or local demo mode.
                </li>
                <li>
                  A brief description of what you expected and what happened.
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <h2 className="text-xl font-black text-white">Contact</h2>

              <p className="mt-3 leading-7 text-slate-400">
                Contact [[OWNER ACTION REQUIRED: confirm support email]] for support, privacy, data
                deletion, billing, copyright, or legal questions. Do not send
                passwords, API keys, access tokens, or other secrets.
              </p>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-cyan-200">
            <Link to="/privacy" className="hover:text-cyan-100">
              Privacy
            </Link>

            <Link to="/terms" className="hover:text-cyan-100">
              Terms
            </Link>

            <Link to="/data-deletion" className="hover:text-cyan-100">
              Data Deletion
            </Link>

            <Link to="/auth/login" className="hover:text-cyan-100">
              Shopify login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
