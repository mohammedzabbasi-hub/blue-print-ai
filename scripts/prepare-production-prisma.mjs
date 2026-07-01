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
