import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "prisma", "schema.prisma");
const productionDir = path.join(root, "prisma", "production");
const productionSchemaPath = path.join(productionDir, "schema.prisma");
const migrationDir = path.join(productionDir, "migrations", "20260630000000_initial_postgresql");
const migrationPath = path.join(migrationDir, "migration.sql");
const databaseUrl = process.env.DATABASE_URL || "";

if (process.env.NODE_ENV === "production" && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("Production DATABASE_URL must use a managed PostgreSQL database.");
}
if (
  process.env.NODE_ENV === "production" &&
  !(process.env.S3_BUCKET || process.env.MEDIA_S3_BUCKET)
) {
  throw new Error("S3_BUCKET is required for private production media storage.");
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
await mkdir(migrationDir, { recursive: true });

const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
const diff = spawnSync(
  prismaBin,
  [
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    productionSchemaPath,
    "--script",
  ],
  { encoding: "utf8" },
);
if (diff.status !== 0 || !diff.stdout.trim()) {
  throw new Error(diff.stderr || "Could not generate the PostgreSQL baseline migration.");
}
await writeFile(migrationPath, diff.stdout);
await writeFile(
  path.join(productionDir, "migrations", "migration_lock.toml"),
  'provider = "postgresql"\n',
);

console.info("Prepared PostgreSQL schema and baseline migration.");
