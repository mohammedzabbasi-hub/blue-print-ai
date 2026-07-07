const sections = [
  {
    title: "Privacy & Data Use",
    body: "BluePrintAI is a Shopify embedded app. It processes store-scoped information only to authenticate users, provide app features, generate and save requested outputs, support users, secure the service, and meet applicable legal obligations. BluePrintAI does not promise revenue, campaign performance, or business results.",
  },
  {
    title: "Google Ads Data Access",
    body: "Connecting Google Ads is optional and OAuth-based. Access is read-only and reporting-only. BluePrintAI does not create, edit, pause, launch, bid, set budgets, or spend on Google Ads campaigns. Users can disconnect Google Ads at any time from Connections.",
  },
  {
    title: "Shopify Store Data",
    body: "BluePrintAI uses Shopify store, catalog, order, and performance data only to provide app functionality, such as product context, workspace reporting, creative analysis, and recommendations. Data is scoped to the authenticated Shopify store.",
  },
  {
    title: "Read-Only Advertising Data",
    body: "Authorized advertising metrics are used for reporting, analysis, and planning context. BluePrintAI cannot mutate campaigns or act as an ad-buying tool. Connected-platform data remains identified separately from manual imports and demo data.",
  },
  {
    title: "Terms of Use",
    body: "Use BluePrintAI lawfully and only with content and data you are authorized to provide. Outputs are planning aids, may be incomplete or inaccurate, and must be reviewed before use. You remain responsible for product claims, advertising decisions, platform compliance, and business outcomes.",
  },
  {
    title: "Support",
    body: "Support is available for the embedded app, connections, imports, uploads, saved outputs, and workspace settings. Include your Shopify store domain, the affected page or workflow, and a non-sensitive description of the issue.",
  },
  {
    title: "Data Deletion / Account Removal",
    body: "Users can request deletion while the app is installed. Uninstall and verified Shopify shop-redact events also invoke the shop-scoped workspace and session deletion flow. Requests may require verification of the Shopify store and requester authority.",
  },
  {
    title: "Contact",
    body: "Contact BluePrintAI Commerce at support@blueprintai.app for support, privacy questions, or data deletion requests. Do not send passwords, API keys, OAuth codes, access tokens, refresh tokens, developer tokens, or private ad-account credentials.",
  },
];

export default function LegalPrivacyContent() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map(({ title, body }) => (
          <section
            className="rounded-2xl border border-slate-800 bg-slate-950/35 p-5"
            key={title}
          >
            <h3 className="text-lg font-black text-slate-100">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
          </section>
        ))}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Full public policies remain available for Shopify review at /privacy,
        /terms, /support, and /data-deletion.
      </p>
    </div>
  );
}
