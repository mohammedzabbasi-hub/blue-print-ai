import { Link } from "react-router";
import { loadShopifyRouteContext } from "../models/route-context.server";

export const meta = () => {
  return [{ title: "Support | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);

  return { shop: session.shop };
};

export default function AppSupportRoute() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Support
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
            Support
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Get help with the current Shopify embedded app workflows and MVP
            testing limitations.
          </p>
        </div>

        <Link
          to="/support"
          className="rounded-2xl border border-cyan-400/50 px-5 py-3 text-sm font-black text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/10"
        >
          Public support page
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
          <h2 className="text-2xl font-black">Current Status</h2>
          <p className="mt-4 leading-7 text-slate-400">
            BluePrintAI currently supports saved creative records, uploaded
            video analysis, generated briefs, planning recommendations, revenue
            blueprints, workspace settings, and activity logs inside the
            authenticated Shopify workspace.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
          <h2 className="text-2xl font-black">Known Limitations</h2>
          <p className="mt-4 leading-7 text-slate-400">
            TikTok Shop OAuth, direct TikTok Shop API sync, creator CRM,
            affiliate outreach, CSV/JSON bulk import, and email delivery are
            not live in this Shopify app yet.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1322] p-7">
          <h2 className="text-2xl font-black">Contact Guidance</h2>
          <p className="mt-4 leading-7 text-slate-400">
            Contact [[OWNER ACTION REQUIRED: confirm support email]]. Include your store domain, the
            page or workflow, what you expected, and what happened. Do not send
            passwords, API keys, private tokens, or other secrets.
          </p>
        </section>
      </div>
    </div>
  );
}
