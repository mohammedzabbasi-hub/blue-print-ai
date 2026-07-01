/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useFetcher,
  useLoaderData,
  useLocation,
} from "react-router";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Database,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import ProductContextEvidence from "../components/ProductContextEvidence";
import {
  getWorkspaceProfile,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { listCampaigns } from "../models/campaign.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import {
  buildAdvisorContext,
  buildAdvisorResponse,
} from "../models/advisor.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

const STARTERS = [
  "What should I do next?",
  "Which creative should I scale?",
  "Which campaign needs attention?",
  "Which creator should I reuse?",
  "What creative should I fix first?",
  "What data is missing from my store?",
  "What should I test next?",
  "What brief should I generate next?",
];

const WELCOME = {
  id: "welcome",
  role: "assistant",
  recommendation:
    "Ask me what to scale, fix, test, or generate next. I’ll use your current creative, campaign, creator, product, and performance data.",
  why: "Every answer is grounded in the records currently available to this shop.",
  evidence: [],
  risks: [],
  nextActions: [],
};

export const meta = () => [{ title: "AI Advisor | BluePrintAI" }];

export const loader = async ({ request }) => {
  const context = await loadAdvisorContext(request);
  return {
    counts: context.counts,
    gaps: context.gaps.length,
    productContext: context.productContext,
    shop: context.shop,
    sourceStatus: context.sourceStatus,
  };
};

export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const question = String(formData.get("question") || "").trim().slice(0, 1200);
    if (!question) {
      return Response.json({ error: "Ask BluePrintAI a question first." }, { status: 400 });
    }

    const context = await loadAdvisorContext(request);
    return Response.json({
      ...buildAdvisorResponse(context, question),
      requestId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error?.message ||
          "The advisor could not read the current workspace data. Please try again.",
      },
      { status: 500 },
    );
  }
};

async function loadAdvisorContext(request) {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [analyses, creatives, blueprints, briefs, profile, performance, campaigns] =
    await Promise.all([
      listVideoAnalyses(session.shop, 100),
      listSavedCreatives(session.shop, 100),
      listRevenueBlueprints(session.shop, 100),
      listSavedBriefs(session.shop, 100),
      getWorkspaceProfile(session.shop),
      listCreativePerformance({ merchantData, shop: session.shop }),
      listCampaigns(session.shop),
    ]);
  return {
    ...buildAdvisorContext({
      analyses,
      blueprints,
      briefs,
      campaigns,
      creatives,
      merchantData,
      performance,
      profile,
    }),
    shop: session.shop,
  };
}

export default function RecommendationsRoute() {
  const { counts, gaps, productContext, shop, sourceStatus } = useLoaderData();
  const fetcher = useFetcher();
  const location = useLocation();
  const [messages, setMessages] = useState([WELCOME]);
  const [question, setQuestion] = useState("");
  const handledResponse = useRef("");
  const scrollAnchor = useRef(null);
  const pending = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data || pending) return;
    const responseKey = fetcher.data.requestId || fetcher.data.error;
    if (!responseKey || handledResponse.current === responseKey) return;
    handledResponse.current = responseKey;
    setMessages((current) => [
      ...current,
      fetcher.data.error
        ? { id: responseKey, role: "error", recommendation: fetcher.data.error }
        : { ...fetcher.data, id: responseKey, role: "assistant" },
    ]);
  }, [fetcher.data, pending]);

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  function ask(nextQuestion) {
    const value = String(nextQuestion || question).trim();
    if (!value || pending) return;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", recommendation: value },
    ]);
    setQuestion("");
    fetcher.submit({ question: value }, { method: "post" });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              <BrainCircuit size={17} /> Action Engine
            </div>
            <h1 className="mt-3 font-display text-4xl font-semibold text-white sm:text-5xl">
              AI Advisor
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Ask BluePrintAI what to do next based on your creatives, campaigns,
              creators, products, and performance data.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
                <ShieldCheck className="mr-1.5 inline" size={14} /> Evidence grounded
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Store: {shop}
              </span>
              {gaps > 0 && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-amber-200">
                  {gaps} data gap{gaps === 1 ? "" : "s"} detected
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 xl:w-[620px]">
            <ContextMetric label="Creatives" value={counts.creatives} />
            <ContextMetric label="Performance" value={counts.performanceRecords} />
            <ContextMetric label="Campaigns" value={counts.campaigns} />
            <ContextMetric label="Creators" value={counts.creatorSignals} />
            <ContextMetric label="Products" value={counts.products} />
            <ContextMetric label="Briefs" value={counts.briefs} />
            <ContextMetric label="Blueprints" value={counts.blueprints} />
          </div>
        </div>
      </section>

      <ProductContextEvidence
        productContext={productContext}
        title="Store product context"
      />

      {sourceStatus.productError && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Shopify products could not be refreshed. The advisor will use
          imported product performance context when available and clearly
          identify it as CSV/ad data rather than Shopify catalog data.
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/65 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950">
              <Sparkles size={19} />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Store intelligence</h2>
              <p className="text-xs text-slate-500">Deterministic ranking · advisory only</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Ready
          </span>
        </div>

        <div className="h-[min(62vh,680px)] min-h-[500px] overflow-y-auto px-4 py-6 sm:px-7">
          <div className="mx-auto max-w-4xl space-y-6" aria-live="polite">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} search={location.search} />
            ))}
            {pending && <LoadingMessage />}
            <div ref={scrollAnchor} />
          </div>
        </div>

        <div className="border-t border-white/10 bg-slate-950/80 p-4 sm:p-6">
          {messages.length === 1 && (
            <div className="mx-auto mb-4 flex max-w-4xl flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => ask(starter)}
                  className="rounded-full border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-left text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}
          <fetcher.Form
            method="post"
            className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 focus-within:border-cyan-400/60"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <label className="sr-only" htmlFor="advisor-question">Ask AI Advisor</label>
            <textarea
              id="advisor-question"
              name="question"
              rows={1}
              maxLength={1200}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(question);
                }
              }}
              placeholder="Ask what to scale, fix, test, or generate next…"
              className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send question"
            >
              <Send size={18} />
            </button>
          </fetcher.Form>
          <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-slate-600">
            Advice uses available store evidence and does not change, publish, or delete anything externally.
          </p>
        </div>
      </section>
    </div>
  );
}

function ContextMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
      <strong className="block text-xl font-black text-white">{Number(value || 0)}</strong>
      <span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

function ChatMessage({ message, search }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-cyan-400 px-4 py-3 text-sm font-semibold leading-6 text-slate-950">
          {message.recommendation}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
          <UserRound size={17} />
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isError ? "bg-red-400/10 text-red-300" : "bg-blue-500/15 text-cyan-300"}`}>
        <Bot size={18} />
      </span>
      <article className={`min-w-0 flex-1 rounded-2xl rounded-tl-sm border p-4 sm:p-5 ${isError ? "border-red-400/30 bg-red-400/10" : "border-white/10 bg-white/[0.035]"}`}>
        <p className={`text-sm font-bold leading-6 sm:text-[15px] ${isError ? "text-red-100" : "text-white"}`}>{message.recommendation}</p>
        {message.why && (
          <div className="mt-4">
            <MessageLabel>Why</MessageLabel>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">{message.why}</p>
          </div>
        )}
        {message.evidence?.length > 0 && (
          <div className="mt-4">
            <MessageLabel>Evidence used</MessageLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {message.evidence.map((item) => (
                <span key={`${item.label}-${item.value}`} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.07] px-2.5 py-1.5 text-xs text-cyan-100">
                  <span className="text-slate-500">{item.label}</span> <strong>{item.value}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {message.storeSummary?.products?.length > 0 && (
          <div className="mt-4">
            <ProductContextEvidence
              compact
              product={message.storeSummary.products[0]}
              title="Product evidence used"
            />
          </div>
        )}
        {message.risks?.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
            <MessageLabel>Risks or missing data</MessageLabel>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
              {message.risks.map((risk) => <li key={risk}>• {risk}</li>)}
            </ul>
          </div>
        )}
        {message.nextAction && (
          <div className="mt-4">
            <MessageLabel>Suggested next action</MessageLabel>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">{message.nextAction}</p>
          </div>
        )}
        {message.nextActions?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.nextActions.map((action) => (
              <Link
                key={`${action.label}-${action.href}`}
                to={withEmbeddedRouteParams(action.href, search)}
                className={action.type === "primary"
                  ? "inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-300"
                  : "inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-black text-slate-200 transition hover:border-cyan-400/40"}
              >
                {action.label} <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function MessageLabel({ children }) {
  return <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-slate-500"><Database size={12} />{children}</p>;
}

function LoadingMessage() {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-cyan-300"><Bot size={18} /></span>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.035] px-4 py-4 text-sm text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        Ranking current store evidence…
      </div>
    </div>
  );
}
