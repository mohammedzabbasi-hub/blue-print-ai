const DEFAULT_CONTEXT = {
  intro: "Ask what to fix, test, scale, or generate next using the store evidence available to BluePrintAI.",
  prompts: [
    "What should I do next?",
    "What data is missing?",
    "What should I test next?",
  ],
};

const ROUTE_CONTEXTS = [
  ["/app/connections", "I can help interpret connection status and explain which data source to add next.", ["Why is Google Ads showing no data?", "What should I connect next?", "Can I use CSV instead?"]],
  ["/app/data-import", "I can help prepare imports and explain which metrics remain unavailable without source data.", ["What CSV fields do I need?", "Why are metrics unavailable?", "How do video file matches work?"]],
  ["/app/video-analysis", "I can help turn the current review workflow into practical creative improvements.", ["What should I improve in this video?", "Why is the analyzer unavailable?", "What can I upload?"]],
  ["/app/creative-library", "I can help you build and prioritize your creative evidence library.", ["What creative should I upload next?", "Why are there no creatives yet?", "How do I build my library?"]],
  ["/app/ad-briefs", "I can help shape an evidence-grounded brief from the product context available here.", ["Generate a brief from this product", "What data is missing?", "How do briefs use Shopify context?"]],
  ["/app/revenue-blueprint", "I can explain estimates and identify the evidence that would make this blueprint stronger.", ["What does this estimate mean?", "What data improves the blueprint?", "What should I plan next?"]],
  ["/app/campaigns", "I can help organize local campaign plans and tests. I cannot launch or edit ads on an external platform.", ["What is a local campaign?", "Will this launch ads?", "How should I organize tests?"]],
  ["/app/settings", "I can point you to workspace, support, legal, and privacy settings.", ["Where is legal and privacy info?", "How do I change store context?", "How do I contact support?"]],
  ["/app/recommendations", "Ask for evidence-grounded guidance from across your current workspace.", ["What should I do next?", "Which creative should I fix first?", "What data is missing from my store?"]],
  ["/app/creators", "I can help interpret creator signals and plan who or what to test next.", ["Which creator should I reuse?", "What creator data is missing?", "What style should I test next?"]],
  ["/app/dashboard", "I can help prioritize the next action from the evidence visible across your workspace.", ["What should I do next?", "Which area needs attention?", "What data is missing?"]],
];

export function getAssistantContext(pathname = "") {
  const match = ROUTE_CONTEXTS.find(([route]) =>
    pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!match) return DEFAULT_CONTEXT;
  return { intro: match[1], prompts: match[2] };
}

