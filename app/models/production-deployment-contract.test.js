import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("production startup deploys migrations before accepting requests", async () => {
  const packageJson = JSON.parse(await rootFile("package.json"));

  assert.equal(
    packageJson.scripts["setup:production"],
    "npm run prisma:prepare:production && prisma generate --schema prisma/production/schema.prisma && prisma migrate deploy --schema prisma/production/schema.prisma",
  );
  assert.equal(
    packageJson.scripts["docker-start"],
    "npm run setup:production && npm run start",
  );
});

test("production preparation fails closed for unsafe runtime configuration", async () => {
  const source = await rootFile("scripts/prepare-production-prisma.mjs");

  assert.match(source, /Production DATABASE_URL must use a managed PostgreSQL database/);
  assert.match(source, /FILE_STORAGE_DRIVER must be s3 in production/);
  assert.match(source, /ENABLE_DEVELOPER_TOOLS/);
  assert.match(source, /SHOPIFY_BILLING_BYPASS/);
  assert.match(source, /Production ANALYZER_SERVICE_URL must be an HTTPS URL/);
  assert.match(source, /GOOGLE_ADS_REDIRECT_URI must exactly match/);
  assert.match(source, /Existing committed migrations were left unchanged/);
  assert.doesNotMatch(source, /migrate reset|db push/);
});

test("Render can use a public, non-cached health check without Shopify auth", async () => {
  const source = await rootFile("app/routes/health.jsx");

  assert.match(source, /new Response\("ok"/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.match(source, /"Content-Type": "text\/plain; charset=utf-8"/);
  assert.match(source, /status: 200/);
  assert.doesNotMatch(source, /authenticate|prisma|DATABASE_URL/);
  assert.doesNotMatch(source, /export default/);
});
