/* eslint-disable react/prop-types */
import { Link } from "react-router";
import { legalNavItems, legalPages } from "../../content/legal";

// OWNER NOTICE: These pages are scaffolding with owner-fill fields, not legally
// reviewed text. Before submission, the owner must confirm the legal entity name,
// support email, mailing address, Privacy Policy, and Terms with an appropriate
// qualified party.

export function LegalPage({ appPath = false, pageId }) {
  const page = legalPages[pageId] || legalPages.terms;
  const basePath = appPath ? "/app" : "";
  const homePath = appPath ? "/app" : "/";
  const legalPageClass = appPath
    ? "bp-legal-page bp-legal-page-embedded"
    : "min-h-screen px-6 py-10 text-white";
  const legalWrapClass = appPath
    ? "bp-legal-wrap bp-legal-wrap-embedded"
    : "mx-auto max-w-5xl";
  const legalCardClass = appPath
    ? "bp-legal-card bp-legal-card-embedded"
    : "mt-8 rounded-3xl border border-slate-800 bg-[#0b1220] p-8 md:p-10";

  return (
    <div className={legalPageClass}>
      <div className={legalWrapClass}>
        <Link
          to={homePath}
          className={appPath ? "bp-legal-brand" : "text-sm font-bold text-cyan-300 hover:text-cyan-200"}
        >
          BluePrintAI
        </Link>

        <article
          className={legalCardClass}
        >
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {page.title}
          </h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Effective date: {page.updated}
          </p>
          <p className="mt-5 max-w-4xl text-base leading-7 text-slate-400">
            {page.intro}
          </p>

          <div className="mt-10 grid gap-5">
            {page.sections.map((section) => (
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
        </article>

        <LegalFooter basePath={basePath} />
      </div>
    </div>
  );
}

const legalHubGroups = [
  {
    title: "Core Policies",
    body: "Primary terms for using BluePrintAI and understanding account responsibilities.",
    items: ["terms", "acceptable-use", "refund-policy"],
  },
  {
    title: "Data And Privacy",
    body: "How workspace data, cookies, privacy requests, and retention are described.",
    items: ["privacy", "cookies"],
  },
  {
    title: "AI And Content",
    body: "Guidance for AI-estimated outputs, uploads, ownership, and copyright concerns.",
    items: ["ai-disclaimer", "copyright"],
  },
  {
    title: "Support And Contact",
    body: "Help, data requests, legal questions, and support routing.",
    items: ["contact", "support"],
  },
];

export function LegalHub({ appPath = false }) {
  const basePath = appPath ? "/app" : "";
  const homePath = appPath ? "/app" : "/";
  const supportPath = appPath ? "/app/support" : "/support";
  const legalPageClass = appPath
    ? "bp-legal-page bp-legal-page-embedded"
    : "min-h-screen px-6 py-10 text-white";
  const legalWrapClass = appPath
    ? "bp-legal-wrap bp-legal-wrap-embedded"
    : "mx-auto max-w-6xl";
  const legalCardClass = appPath
    ? "bp-legal-card bp-legal-card-embedded"
    : "mt-8 rounded-3xl border border-slate-800 bg-[#0b1220] p-8 md:p-10";

  const getItem = (pageId) => {
    if (pageId === "support") {
      return {
        body: "Get help with MVP workflows, current limitations, and support routing.",
        label: "Support",
        title: "Support",
        to: supportPath,
      };
    }

    const navItem = legalNavItems.find((item) => item.pageId === pageId);
    const page = legalPages[pageId];

    return {
      body: page?.intro,
      label: navItem?.label || page?.eyebrow || pageId,
      title: page?.title || navItem?.label || pageId,
      to: `${basePath}${navItem?.to || `/${pageId}`}`,
    };
  };

  return (
    <div className={legalPageClass}>
      <div className={legalWrapClass}>
        <Link
          to={homePath}
          className={appPath ? "bp-legal-brand" : "text-sm font-bold text-cyan-300 hover:text-cyan-200"}
        >
          BluePrintAI
        </Link>

        <article
          className={legalCardClass}
        >
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Legal Hub
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Legal, Privacy, And Support
          </h1>
          <p className="mt-5 max-w-4xl text-base leading-7 text-slate-400">
            Find BluePrintAI policies, privacy information, AI and content
            guidance, and support contact routes from one organized page.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {legalHubGroups.map((group) => (
              <section
                key={group.title}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
              >
                <h2 className="text-xl font-black text-white">
                  {group.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {group.body}
                </p>

                <div className="mt-5 grid gap-3">
                  {group.items.map((pageId) => {
                    const item = getItem(pageId);

                    return (
                      <Link
                        key={pageId}
                        to={item.to}
                        className="rounded-2xl border border-slate-800 bg-[#070b16] p-4 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                      >
                        <span className="block text-base font-black text-cyan-100">
                          {item.label}
                        </span>
                        <span className="mt-2 block line-clamp-2 text-sm leading-6 text-slate-400">
                          {item.body || item.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>

        <LegalFooter basePath={basePath} />
      </div>
    </div>
  );
}

export function LegalFooter({ basePath = "" }) {
  return (
    <footer className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-cyan-200">
        {legalNavItems.map((item) => (
          <Link
            key={item.pageId}
            to={`${basePath}${item.to}`}
            className="hover:text-cyan-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
