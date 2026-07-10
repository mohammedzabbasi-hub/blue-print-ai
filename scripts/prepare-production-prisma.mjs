import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "prisma", "schema.prisma");
const productionDir = path.join(root, "prisma", "production");
const productionSchemaPath = path.join(productionDir, "schema.prisma");
const migrationsPath = path.join(productionDir, "migrations");
const databaseUrl = process.env.DATABASE_URL || "";
const appUrl = process.env.SHOPIFY_APP_URL || "";

if (process.env.NODE_ENV === "production" && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("Production DATABASE_URL must use a managed PostgreSQL database.");
}
if (process.env.NODE_ENV === "production") {
  const requiredShopifyValues = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SCOPES"]
    .filter((name) => !String(process.env[name] || "").trim());
  if (requiredShopifyValues.length) {
    throw new Error(`Missing required production Shopify configuration: ${requiredShopifyValues.join(", ")}.`);
  }
  if (process.env.SCOPES !== "read_products") {
    throw new Error("Production SCOPES must be exactly read_products for the current review build.");
  }
  let parsedAppUrl;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    throw new Error("SHOPIFY_APP_URL must be set to the deployed HTTPS app origin.");
  }
  if (
    parsedAppUrl.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(parsedAppUrl.hostname) ||
    /YOUR_PRODUCTION_APP_URL|example\.(com|invalid)/i.test(appUrl)
  ) {
    throw new Error("SHOPIFY_APP_URL must be the real deployed HTTPS origin, not a placeholder or development URL.");
  }

  const forbiddenProductionFlags = [
    "ENABLE_DEVELOPER_TOOLS",
    "SHOPIFY_BILLING_BYPASS",
  ].filter((name) => String(process.env[name] || "").toLowerCase() === "true");
  if (forbiddenProductionFlags.length) {
    throw new Error(
      `Development-only flags must be disabled in production: ${forbiddenProductionFlags.join(", ")}.`,
    );
  }

  if (String(process.env.ANALYZER_ENABLED || "").toLowerCase() === "true") {
    const analyzerUrl = String(process.env.ANALYZER_SERVICE_URL || "").trim();
    if (!analyzerUrl || !String(process.env.ANALYZER_API_KEY || "").trim()) {
      throw new Error("ANALYZER_SERVICE_URL and ANALYZER_API_KEY are required when production analysis is enabled.");
    }
    try {
      if (new URL(analyzerUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error("Production ANALYZER_SERVICE_URL must be an HTTPS URL.");
    }
  }

  const googleRequiredValues = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_REDIRECT_URI",
  ];
  const googleConfigured = googleRequiredValues.some((name) =>
    String(process.env[name] || "").trim(),
  );
  if (googleConfigured) {
    const missingGoogleValues = googleRequiredValues.filter(
      (name) => !String(process.env[name] || "").trim(),
    );
    const encryptionConfigured = String(
      process.env.GOOGLE_ADS_ENCRYPTION_SECRET ||
        process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY ||
        "",
    ).trim();
    if (!encryptionConfigured) missingGoogleValues.push("GOOGLE_ADS_ENCRYPTION_SECRET");
    if (missingGoogleValues.length) {
      throw new Error(`Google Ads production configuration is incomplete: ${missingGoogleValues.join(", ")}.`);
    }
    const expectedRedirect = `${parsedAppUrl.origin}/auth/google-ads/callback`;
    if (String(process.env.GOOGLE_ADS_REDIRECT_URI).trim() !== expectedRedirect) {
      throw new Error(`GOOGLE_ADS_REDIRECT_URI must exactly match ${expectedRedirect}.`);
    }
  }
}
if (process.env.NODE_ENV === "production") {
  if (process.env.FILE_STORAGE_DRIVER !== "s3") {
    throw new Error("FILE_STORAGE_DRIVER must be s3 in production.");
  }
  if (!(process.env.S3_BUCKET || process.env.MEDIA_S3_BUCKET)) {
    throw new Error("S3_BUCKET is required for private production media storage.");
  }
  if (!(process.env.S3_REGION || process.env.MEDIA_S3_REGION)) {
    throw new Error("S3_REGION is required for private production media storage.");
  }
}

const sqliteSchema = await readFile(sourcePath, "utf8");
const productionSchema = sqliteSchema
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace('url      = "file:dev.sqlite"', 'url      = env("DATABASE_URL")');

if (productionSchema === sqliteSchema) {
  throw new Error("Could not derive the PostgreSQL Prisma schema.");
}

await mkdir(productionDir, { recursive: true });
await writeFile(productionSchemaPath, productionSchema);

try {
  await access(path.join(migrationsPath, "migration_lock.toml"));
  const entries = await import("node:fs/promises").then(({ readdir }) =>
    readdir(migrationsPath, { withFileTypes: true }),
  );
  const migrationDirectories = entries.filter((entry) => entry.isDirectory());
  if (!migrationDirectories.length) throw new Error("No migration directories found.");
} catch (error) {
  throw new Error(
    "Committed PostgreSQL migrations are missing. Production preparation never generates or rewrites migration history; create and review a new immutable migration before deployment.",
    { cause: error },
  );
}

console.info("Prepared PostgreSQL schema. Existing committed migrations were left unchanged.");
