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
            Need help with BluePrintAI? Use the configured support channel and include
            enough context for the team to understand the workspace and issue.
          </p>

          <div className="mt-10 grid gap-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <h2 className="text-xl font-black text-white">
                Current Product Status
              </h2>

              <p className="mt-3 leading-7 text-slate-400">
                Google Ads reporting is available when configured and authorized.
                The optional Google Ads integration is read-only/reporting-only
                and cannot create, edit, pause, enable, delete, or launch ads or
                campaigns. TikTok Ads and Meta Ads are not currently available.
                CSV import, Shopify product context, and manual uploads remain
                supported core data paths without connecting Google Ads.
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
                For support, contact BluePrintAI Commerce at
                {" "}support@blueprintai.app. Include your Shopify store domain
                and a non-sensitive description of the issue. Do not send
                passwords, API keys, OAuth codes, access tokens, refresh tokens,
                developer tokens, or private ad-account credentials.
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
