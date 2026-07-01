import db from "../app/db.server.js";

const shop =
  process.argv.find((arg) => arg.startsWith("--shop="))?.slice("--shop=".length) ||
  process.env.SHOP ||
  process.env.SHOPIFY_SHOP ||
  "blueprintai-test-store.myshopify.com";

const models = [
  ["SavedBrief", db.savedBrief],
  ["VideoAnalysis", db.videoAnalysis],
  ["SavedCreative", db.savedCreative],
  ["RevenueBlueprint", db.revenueBlueprint],
  ["WorkspaceRequest", db.workspaceRequest],
  ["WorkspaceSetting", db.workspaceSetting],
  ["ActivityLog", db.activityLog],
  ["CreativePerformance", db.creativePerformance],
];

const counts = await Promise.all(
  models.map(async ([label, model]) => [label, await model.count({ where: { shop } })]),
);
const sessions = await db.session.count({ where: { shop } });

console.log(`BluePrintAI persisted workspace counts for ${shop}`);
for (const [label, count] of counts) {
  console.log(`- ${label}: ${count}`);
}
console.log(`- Session (preserved Shopify auth): ${sessions}`);

await db.$disconnect();
