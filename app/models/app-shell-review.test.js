import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("every sidebar destination has a renderable route module", async () => {
  const shell = await readFile(new URL("../routes/app.jsx", import.meta.url), "utf8");
  const expectedRoutes = [
    "app.dashboard.jsx",
    "app.campaigns.jsx",
    "app.creative-library.jsx",
    "app.video-analysis.jsx",
    "app.ad-briefs.jsx",
    "app.recommendations.jsx",
    "app.revenue-blueprint.jsx",
    "app.creators.jsx",
    "app.data-import.jsx",
    "app.connections.jsx",
    "app.settings.jsx",
    "app.privacy.jsx",
    "app.terms.jsx",
    "app.support.jsx",
    "app.data-deletion.jsx",
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
    "/app/recommendations",
    "/app/revenue-blueprint",
    "/app/creators",
    "/app/data-import",
    "/app/connections",
    "/app/settings",
    "/app/privacy",
    "/app/terms",
    "/app/support",
    "/app/data-deletion",
  ]) {
    assert.match(shell, new RegExp(path.replaceAll("/", "\\/")), path);
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
