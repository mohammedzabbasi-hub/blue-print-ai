import { Link, redirect } from "react-router";
import { FileVideo, ScanSearch, ClipboardList } from "lucide-react";
import { withEmbeddedRouteParams } from "../../utils/embedded-routing";


export function loader({ request }) {
  const url = new URL(request.url);
  const isShopifyEmbeddedRequest =
    url.searchParams.get("embedded") === "1" ||
    url.searchParams.has("shop") ||
    url.searchParams.has("host") ||
    url.searchParams.has("id_token");

  if (isShopifyEmbeddedRequest) {
    return redirect(withEmbeddedRouteParams("/app", url.search));
  }

  return null;
}

export const meta = () => {
  return [{ title: "BluePrintAI | Creative Intelligence for Shopify" }];
};

const workflowSteps = [
  {
    icon: FileVideo,
    label: "Upload creative",
    body: "Add a product demo, UGC clip, or ad video.",
  },
  {
    icon: ScanSearch,
    label: "Analyzer reviews the video",
    body: "When the analyzer service is configured, get clearly labeled heuristic hook, clarity, CTA, and creative notes. Otherwise, the upload can still be saved.",
  },
  {
    icon: ClipboardList,
    label: "Generate next creative brief",
    body: "Turn the analysis into a practical brief for your next creative test.",
  },
];

export default function LandingRoute() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b16] text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070b16]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-[18px] sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8 lg:px-8">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070b16]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
              ✦
            </span>
            <span className="truncate text-xl font-black tracking-tight sm:text-2xl">
              BluePrintAI
            </span>
          </Link>

          <nav
            aria-label="Landing page navigation"
            className="hidden items-center gap-12 text-[18px] font-bold text-slate-400 lg:flex xl:gap-16"
          >
            <a
              href="#features"
              className="rounded-md transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070b16]"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="whitespace-nowrap rounded-md transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070b16]"
            >
              How it works
            </a>
            <Link
              to="/support"
              className="rounded-md transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070b16]"
            >
              Support
            </Link>
          </nav>

          <div className="flex items-center justify-self-end">
            <a
              data-public-launch-cta
              href="https://admin.shopify.com"
              className="whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-base font-black text-slate-200 transition-colors hover:border-cyan-400 hover:bg-slate-800/70 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070b16] sm:px-6"
            >
              Open Shopify Admin
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div className="min-w-0">
            <div className="inline-flex max-w-xs items-center justify-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-cyan-200 sm:max-w-full sm:px-5 sm:text-sm sm:tracking-[0.2em]">
              Creative planning intelligence
            </div>

            <h1 className="mt-8 w-full max-w-xs break-words text-xl font-black leading-[1.12] tracking-tight sm:max-w-5xl sm:text-5xl md:text-7xl">
              Plan your next creative with clearer evidence before you make it.
            </h1>

            <p className="mt-8 w-full max-w-xs text-base leading-7 text-slate-400 sm:max-w-3xl sm:text-xl sm:leading-9">
              BluePrintAI helps merchants analyze uploaded creative, organize
              manually imported shop data, spot useful hooks and creator styles,
              and turn those signals into the next creative brief.
            </p>

            <div className="mt-10 flex w-full max-w-xs flex-col gap-4 sm:max-w-none sm:flex-row">
              <a
                data-public-launch-cta
                href="https://admin.shopify.com"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-4 text-center text-lg font-black text-white shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                Open Shopify Admin
              </a>

              <Link
                to="/support"
                className="rounded-xl border border-slate-700 px-8 py-4 text-center text-lg font-black text-slate-200 transition hover:border-cyan-400 hover:text-cyan-100"
              >
                Contact support
              </Link>
            </div>

            <p className="mt-4 w-full max-w-xs text-sm font-bold text-slate-400 sm:max-w-none">
              Open BluePrintAI from your Shopify Admin.
            </p>

            <div className="mt-10 grid w-full max-w-xs gap-4 text-sm font-bold text-slate-400 sm:max-w-none sm:grid-cols-3">
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                Shopify-authenticated workspace
              </p>
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                Manual CSV performance import
              </p>
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                Manual creative uploads
              </p>
            </div>
          </div>

          <div className="w-full min-w-0 max-w-xs rounded-3xl border border-slate-800 bg-[#0b1220] p-5 shadow-2xl shadow-cyan-950/30 sm:max-w-none sm:p-6">
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
                    Product workflow
                  </p>
                  <h2 className="mt-3 text-xl font-black leading-tight sm:text-3xl">
                    From creative upload to next brief
                  </h2>
                </div>
                <span className="w-fit rounded-full bg-cyan-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                  3 steps
                </span>
              </div>

              <div className="mt-8 grid gap-4">
                {workflowSteps.map(({ icon: Icon, label, body }, index) => (
                  <div
                    key={label}
                    className="grid gap-4 rounded-2xl border border-slate-800 bg-[#070b16] p-5 sm:grid-cols-[auto_1fr] sm:items-start"
                  >
                    <div className="flex items-center gap-3 sm:block">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 sm:mt-3 sm:block">
                        Step {index + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-black leading-6 text-white">
                        {label}
                      </h3>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-400">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Next action
                </p>
                <p className="mt-3 text-lg font-black leading-7 text-white">
                  Create a problem-solution product demo
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-emerald-100">
                  Status: Ready to plan
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              [
                "Creative analysis",
                "Break down hooks, formats, creator styles, pacing, and visual patterns from uploaded creative assets.",
              ],
              [
                "Creative recommendations",
                "Get practical recommendations for your next direction based on the shop and creative data you provide.",
              ],
              [
                "Creative brief generation",
                "Turn uploaded creative notes and saved app signals into clear next-step briefs your team can use immediately.",
              ],
            ].map(([title, body]) => (
              <section
                key={title}
                className="rounded-2xl border border-slate-800 bg-[#0b1220] p-7"
              >
                <h2 className="text-2xl font-black">{title}</h2>
                <p className="mt-4 leading-7 text-slate-400">{body}</p>
              </section>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-14">
          <div className="border-y border-slate-800 py-12">
            <h2 className="text-4xl font-black tracking-tight">
              How it works
            </h2>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                [
                  "Step 1",
                  "Upload creatives",
                  "Add creative assets and manually import CSV performance data into one organized workspace.",
                ],
                [
                  "Step 2",
                  "Analyze creative signals",
                  "BluePrintAI identifies hooks, creator styles, and structures from uploaded creative and saved planning data.",
                ],
                [
                  "Step 3",
                  "Plan the next test",
                  "Use recommendations and briefs to plan the next creative. Optional read-only Google Ads reporting and manual CSV import provide performance context.",
                ],
              ].map(([step, title, body]) => (
                <section key={step}>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
                    {step}
                  </p>
                  <h3 className="mt-4 text-2xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{body}</p>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            BluePrintAI MVP. Shopify product context, manual import/upload, and
            optional read-only Google Ads reporting.
          </p>
          <div className="flex flex-wrap gap-5 font-bold">
            <Link to="/privacy" className="hover:text-cyan-200">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-cyan-200">
              Terms
            </Link>
            <Link to="/support" className="hover:text-cyan-200">
              Support
            </Link>
            <Link to="/data-deletion" className="hover:text-cyan-200">
              Data Deletion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
