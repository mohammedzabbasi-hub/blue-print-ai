import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { withEmbeddedRouteParams } from "../utils/embedded-routing.js";

test("production free workspaces keep the Shopify AppProvider boundary", async () => {
  const source = await readFile(
    new URL("../routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /skipAppProvider: true/);
  assert.match(source, /skipAppProvider: false/);
  assert.match(source, /if \(billingStatus\.skipAppProvider\)/);
  assert.doesNotMatch(source, /if \(billingStatus\.bypassed\)/);
  assert.match(source, /<AppProvider embedded apiKey=\{apiKey\}>/);
});

test("production login recovery is readable and does not ask merchants to enter a shop domain", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../routes/auth.login/route.jsx", import.meta.url), "utf8"),
    readFile(new URL("../styles/blueprint.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /process\.env\.NODE_ENV === "production"/);
  assert.match(source, /url\.searchParams\.has\("shop"\)/);
  assert.match(source, /Open BluePrintAI from Shopify Admin/);
  assert.match(source, /href="https:\/\/admin\.shopify\.com"/);
  assert.match(source, /manualLoginAllowed: false/);
  assert.match(source, /<h1 className="[^"]*text-slate-50[^"]*">/);
  assert.match(source, /<p className="[^"]*text-slate-300[^"]*">/);
  assert.match(source, /<a[\s\S]*?className="[^"]*text-white[^"]*"[\s\S]*?href="https:\/\/admin\.shopify\.com"/);
  assert.doesNotMatch(source, /<h1 className="[^"]*text-slate-950/);
  assert.doesNotMatch(source, /<p className="[^"]*text-slate-600/);
  assert.match(styles, /:root\s*\{\s*color-scheme:\s*dark;/);
});

test("public homepage sends merchants to Shopify Admin instead of bare /app", async () => {
  const source = await readFile(
    new URL("../routes/_index/route.jsx", import.meta.url),
    "utf8",
  );

  assert.equal(
    [...source.matchAll(/withEmbeddedRouteParams\("\/app"/g)].length,
    1,
    "only the embedded-request loader may target /app",
  );
  assert.match(source, /redirect\(withEmbeddedRouteParams\("\/app", url\.search\)\)/);
  assert.doesNotMatch(
    source,
    /href\s*=\s*["'](?:\/app|https:\/\/blueprintai-app\.onrender\.com\/app)(?:["'/?#])/,
  );
  assert.doesNotMatch(source, /Open app|Open Shopify app/);

  const launchCtas = [...source.matchAll(/<a\s+([\s\S]*?data-public-launch-cta[\s\S]*?)>/g)];
  assert.equal(launchCtas.length, 2);
  for (const [, attributes] of launchCtas) {
    assert.match(attributes, /href="https:\/\/admin\.shopify\.com"/);
  }

  assert.match(source, /Open BluePrintAI from your Shopify Admin\./);
  assert.doesNotMatch(source, /<(?:form|Form)\b|name=["']shop["']/);
});

test("/app remains authenticated and embedded entry routing preserves Shopify context", async () => {
  const [appSource, landingSource] = await Promise.all([
    readFile(new URL("../routes/app.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/_index/route.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /await authenticate\.admin\(request\)/);
  assert.match(landingSource, /url\.searchParams\.get\("embedded"\) === "1"/);
  assert.match(landingSource, /url\.searchParams\.has\("shop"\)/);
  assert.match(landingSource, /url\.searchParams\.has\("host"\)/);
  assert.equal(
    withEmbeddedRouteParams(
      "/app",
      "?shop=test.myshopify.com&host=encoded-host&embedded=1&id_token=token&ignored=value",
    ),
    "/app?embedded=1&host=encoded-host&id_token=token&shop=test.myshopify.com",
  );
});

test("welcome copy explains which data paths are optional", async () => {
  const source = await readFile(
    new URL("../routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Shopify product context works without an external account/);
  assert.match(source, /read-only Google Ads are optional/);
  assert.match(source, /requires a video upload and an available analyzer/);
  assert.doesNotMatch(source, /proven patterns/);
});

test("every sidebar destination has a renderable route module", async () => {
  const shell = await readFile(new URL("../routes/app.jsx", import.meta.url), "utf8");
  const expectedRoutes = [
    "app.dashboard.jsx",
    "app.campaigns.jsx",
    "app.creative-library.jsx",
    "app.video-analysis.jsx",
    "app.ad-briefs.jsx",
    "app.revenue-blueprint.jsx",
    "app.creators.jsx",
    "app.data-import.jsx",
    "app.connections.jsx",
    "app.settings.jsx",
  ];

  for (const route of expectedRoutes) {
    const routeSource = await readFile(
      new URL(`../routes/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(routeSource, /export default function/, route);
  }

  for (const path of [
    "/app/dashboard",
    "/app/campaigns",
    "/app/creative-library",
    "/app/video-analysis",
    "/app/ad-briefs",
    "/app/revenue-blueprint",
    "/app/creators",
    "/app/data-import",
    "/app/connections",
    "/app/settings",
  ]) {
    assert.match(shell, new RegExp(path.replaceAll("/", "\\/")), path);
  }
});

test("standalone AI Advisor is retired while the global assistant remains", async () => {
  const [shell, retiredRoute] = await Promise.all([
    readFile(new URL("../routes/app.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/app.recommendations.jsx", import.meta.url), "utf8"),
  ]);
  const navSource = shell.match(/const navItems = \[([\s\S]*?)\n\];/)?.[1] || "";

  assert.doesNotMatch(navSource, /AI Advisor|\/app\/recommendations/);
  assert.match(shell, /<AssistantWidget \/>/);
  assert.match(retiredRoute, /redirect\(withEmbeddedRouteParams\("\/app\/dashboard"/);
  assert.doesNotMatch(retiredRoute, /AI Advisor|Store intelligence|advisor-question/);
  assert.match(retiredRoute, /export const action/);
  assert.match(retiredRoute, /buildAssistantResponse/);
});

test("sidebar keeps legal and support content consolidated under Settings", async () => {
  const shell = await readFile(new URL("../routes/app.jsx", import.meta.url), "utf8");
  const navSource = shell.match(/const navItems = \[([\s\S]*?)\n\];/)?.[1] || "";

  assert.match(navSource, /label: "Settings"/);
  for (const label of ["Privacy", "Terms", "Support", "Data Deletion"]) {
    assert.doesNotMatch(navSource, new RegExp(`label: "${label}"`), label);
  }
});

test("unavailable ad connectors are labeled and their direct endpoints fail closed", async () => {
  const [connections, statuses, start, callback, sync] = await Promise.all([
    readFile(new URL("../routes/app.connections.jsx", import.meta.url), "utf8"),
    readFile(new URL("./creative-performance.server.js", import.meta.url), "utf8"),
    readFile(new URL("../routes/auth.tiktok.start.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/auth.tiktok.callback.jsx", import.meta.url), "utf8"),
    readFile(new URL("../routes/app.connections.tiktok.sync.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(connections, /Connect \$\{platform\.name\} · Coming soon/);
  assert.match(connections, /Import TikTok performance with a CSV today/);
  assert.match(connections, /Import Meta performance with a CSV today/);
  assert.match(statuses, /Coming soon — use manual CSV import instead/);
  for (const source of [start, callback, sync]) {
    assert.match(source, /status: 404/);
    assert.doesNotMatch(source, /createConnection|upsertDailyAdPerformanceRows/);
  }
});
