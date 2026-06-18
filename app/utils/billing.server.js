import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const shopifyAppConfigPath = path.join(appDirectory, "shopify.app.toml");

export function getShopHandle(shop) {
  return String(shop || "").replace(/\.myshopify\.com$/i, "");
}

export function billingRequired() {
  return process.env.SHOPIFY_BILLING_REQUIRED === "true";
}

export function billingBypassed() {
  return !billingRequired() || process.env.SHOPIFY_BILLING_BYPASS === "true";
}

export function getPlanSelectionUrl(shop, appHandle) {
  const storeHandle = encodeURIComponent(getShopHandle(shop));
  const encodedAppHandle = encodeURIComponent(appHandle);

  return `https://admin.shopify.com/store/${storeHandle}/charges/${encodedAppHandle}/pricing_plans`;
}

export function getAppHandleFromConfig() {
  if (process.env.SHOPIFY_APP_HANDLE) {
    return process.env.SHOPIFY_APP_HANDLE.trim();
  }

  const config = readFileSync(shopifyAppConfigPath, "utf8");
  const explicitHandle = readRootTomlString(config, "handle");

  if (explicitHandle) {
    return explicitHandle;
  }

  return "";
}

function readRootTomlString(config, key) {
  const lines = config.split(/\r?\n/);
  const keyPattern = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"\\s*$`);

  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      return "";
    }

    const match = line.match(keyPattern);
    if (match) {
      return match[1].trim();
    }
  }

  return "";
}
