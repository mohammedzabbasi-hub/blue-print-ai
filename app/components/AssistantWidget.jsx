/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { useFetcher, useLocation } from "react-router";
import { getAssistantContext } from "../utils/assistant-context";

export default function AssistantWidget() {
  const fetcher = useFetcher();
  const location = useLocation();
  const context = getAssistantContext(location.pathname);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const handledResponse = useRef("");
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const pending = fetcher.state !== "idle";
  const contextLabel = fetcher.data?.meta?.contextLabel || "Using shop context";

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!fetcher.data || pending) return;
    const key = fetcher.data.requestId || fetcher.data.error;
    if (!key || handledResponse.current === key) return;
    handledResponse.current = key;
    setMessages((current) => [...current, fetcher.data.error
      ? { id: key, role: "error", recommendation: fetcher.data.error }
      : { ...fetcher.data, id: key, role: "assistant" }]);
  }, [fetcher.data, pending]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  function ask(value = question) {
    const nextQuestion = String(value).trim();
    if (!nextQuestion || pending) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", recommendation: nextQuestion }]);
    setQuestion("");
    fetcher.submit(
      {
        pathname: location.pathname,
        question: nextQuestion,
        search: location.search,
      },
      { method: "post", action: `/app/recommendations${location.search}` },
    );
  }

  return (
    <div className="bp-assistant" data-open={open ? "true" : "false"}>
      {open && (
        <section className="bp-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="bp-assistant-title">
          <header className="bp-assistant-header">
            <span className="bp-assistant-avatar"><Sparkles size={18} /></span>
            <div>
              <h2 id="bp-assistant-title">BluePrintAI Assistant</h2>
              <p><span /> {contextLabel}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close BluePrintAI Assistant"><X size={19} /></button>
          </header>

          <div className="bp-assistant-body" aria-live="polite">
            <AssistantMessage message={{ role: "assistant", recommendation: context.intro }} />
            {messages.map((message) => <AssistantMessage key={message.id} message={message} />)}
            {pending && <div className="bp-assistant-loading"><span /> Reading available store evidence…</div>}
            <div ref={scrollRef} />
          </div>

          <div className="bp-assistant-composer">
            <div className="bp-assistant-prompts">
              {context.prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={pending} aria-label={`Ask: ${prompt}`}>{prompt}</button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); ask(); }}>
              <label className="sr-only" htmlFor="bp-assistant-question">Ask BluePrintAI Assistant</label>
              <textarea ref={inputRef} id="bp-assistant-question" rows={1} maxLength={1200} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder="Ask what to fix, test, scale, or generate next..." />
              <button type="submit" disabled={pending || !question.trim()} aria-label="Send question to BluePrintAI Assistant"><Send size={17} /></button>
            </form>
            <p>Advisory only. Advice uses available store evidence and does not change, publish, launch, or delete anything externally.</p>
          </div>
        </section>
      )}
      {!open && (
        <button className="bp-assistant-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open BluePrintAI Assistant">
          <Sparkles size={19} /><span>Ask BluePrintAI</span>
        </button>
      )}
    </div>
  );
}

function AssistantMessage({ message }) {
  const user = message.role === "user";
  return (
    <div className={`bp-assistant-message ${user ? "is-user" : "is-assistant"} ${message.role === "error" ? "is-error" : ""}`}>
      {!user && <span className="bp-assistant-message-icon"><Bot size={15} /></span>}
      <div>
        <strong>{message.recommendation}</strong>
        {message.why && <p>{message.why}</p>}
        {message.risks?.length > 0 && <p className="bp-assistant-risks">Missing evidence: {message.risks.join(" ")}</p>}
        {message.nextAction && <p><b>Next:</b> {message.nextAction}</p>}
      </div>
    </div>
  );
}
