import { Link } from "react-router";

export const meta = () => {
  return [{ title: "BluePrintAI | TikTok Shop Creative Intelligence" }];
};

export default function LandingRoute() {
  return (
    <div className="min-h-screen bg-[#070b16] text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070b16]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
              ✦
            </span>
            <span className="text-2xl font-black tracking-tight">
              BluePrintAI
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-cyan-200">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-cyan-200">
              How it works
            </a>
            <Link to="/support" className="transition hover:text-cyan-200">
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-400 hover:text-cyan-100"
            >
              Sign in
            </Link>
            <Link
              to="/auth/login"
              className="hidden rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] sm:inline-flex"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-cyan-200">
              AI-powered creative intelligence
            </div>

            <h1 className="mt-8 max-w-5xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl">
              Know which TikTok Shop creatives can sell before you make the next
              one.
            </h1>

            <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-400">
              BluePrintAI helps merchants analyze uploaded creative, organize
              manually imported shop data, spot useful hooks and creator styles,
              and turn those signals into the next ad brief.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/auth/login"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-4 text-center text-lg font-black text-white shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                Sign in
              </Link>

              <Link
                to="/auth/login"
                className="rounded-xl border border-slate-700 px-8 py-4 text-center text-lg font-black text-slate-200 transition hover:border-cyan-400 hover:text-cyan-100"
              >
                Create account
              </Link>
            </div>

            <div className="mt-10 grid gap-4 text-sm font-bold text-slate-400 sm:grid-cols-3">
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                Demo workspaces available
              </p>
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                Manual CSV/JSON import
              </p>
              <p className="rounded-2xl border border-slate-800 bg-[#0b1220] p-4">
                TikTok Shop API sync planned
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6 shadow-2xl shadow-cyan-950/30">
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
                    Creative OS
                  </p>
                  <h2 className="mt-3 text-3xl font-black">
                    Next ad direction
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-300">
                  Ready
                </span>
              </div>

              <div className="mt-8 space-y-4">
                {[
                  ["Hook pattern", "Problem-led opening with product payoff"],
                  ["Creator style", "Fast demo, plain-language voiceover"],
                  ["Brief output", "3 angles for the next TikTok test"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-800 bg-[#070b16] p-5"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 p-5">
                <p className="text-sm font-bold leading-6 text-cyan-100">
                  Upload creative and shop exports today. Use the resulting
                  patterns to plan, compare, and ship sharper ads.
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
                "Winning recommendations",
                "Get practical recommendations for your next direction based on the shop and creative data you provide.",
              ],
              [
                "Ad brief generation",
                "Turn performance signals into clear next-step briefs your team can use immediately.",
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
                  "Add creative assets and manually import CSV/JSON shop data into one organized workspace.",
                ],
                [
                  "Step 2",
                  "Analyze performance",
                  "BluePrintAI identifies the hooks, creators, and structures most associated with the signals you provide.",
                ],
                [
                  "Step 3",
                  "Launch the next winner",
                  "Use recommendations and briefs to plan the next creative. Direct TikTok Shop OAuth/API sync is planned.",
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
            BluePrintAI MVP. Manual import/upload today; TikTok Shop OAuth/API
            integration planned.
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
          </div>
        </div>
      </footer>
    </div>
  );
}
