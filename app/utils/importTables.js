// Shared (client + server safe) constants for the Data Import feature.
// Keep this file free of server-only imports (Prisma, node:fs, etc.) so
// routes can reference it directly in rendered JSX.
export const IMPORT_TABLES = ["products", "orders", "creators", "creatives", "metrics"];

export const IMPORT_TABLE_COLUMNS = {
  products: ["id", "title", "price", "currency", "inventory", "status", "image_url", "category"],
  orders: ["id", "product_id", "product_title", "amount", "currency", "ordered_at"],
  creators: [
    "id",
    "name",
    "handle",
    "platform",
    "status",
    "followers",
    "total_views",
    "total_likes",
    "total_comments",
    "total_shares",
    "total_orders",
    "total_revenue",
    "notes",
  ],
  creatives: [
    "id",
    "title",
    "product_id",
    "product_title",
    "creator_handle",
    "platform",
    "views",
    "likes",
    "shares",
    "clicks",
    "orders",
    "revenue",
    "hook_type",
    "media_url",
  ],
  metrics: ["id", "date", "scope", "ref_id", "views", "clicks", "orders", "revenue", "spend"],
};
