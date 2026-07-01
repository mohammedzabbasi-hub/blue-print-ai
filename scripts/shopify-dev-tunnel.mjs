import { spawn } from "node:child_process";

const tunnelUrlValue = process.env.SHOPIFY_DEV_TUNNEL_URL?.trim();
const tunnelPortValue = process.env.SHOPIFY_DEV_TUNNEL_PORT?.trim() || "3000";

if (!tunnelUrlValue) {
  console.error(
    "SHOPIFY_DEV_TUNNEL_URL is required. Example: https://your-stable-domain.ngrok-free.app",
  );
  process.exit(1);
}

let tunnelUrl;
try {
  tunnelUrl = new URL(tunnelUrlValue);
} catch {
  console.error("SHOPIFY_DEV_TUNNEL_URL must be a valid HTTPS URL.");
  process.exit(1);
}

if (
  tunnelUrl.protocol !== "https:" ||
  tunnelUrl.username ||
  tunnelUrl.password ||
  tunnelUrl.pathname !== "/" ||
  tunnelUrl.search ||
  tunnelUrl.hash
) {
  console.error(
    "SHOPIFY_DEV_TUNNEL_URL must be an HTTPS origin with no credentials, path, query, or fragment.",
  );
  process.exit(1);
}

if (!/^\d+$/.test(tunnelPortValue)) {
  console.error("SHOPIFY_DEV_TUNNEL_PORT must be a number from 1 to 65535.");
  process.exit(1);
}

const tunnelPort = Number(tunnelPortValue);
if (tunnelPort < 1 || tunnelPort > 65535) {
  console.error("SHOPIFY_DEV_TUNNEL_PORT must be a number from 1 to 65535.");
  process.exit(1);
}

if (tunnelUrl.port && Number(tunnelUrl.port) !== tunnelPort) {
  console.error(
    "Set the local port with SHOPIFY_DEV_TUNNEL_PORT instead of including a different port in SHOPIFY_DEV_TUNNEL_URL.",
  );
  process.exit(1);
}

const publicOrigin = `${tunnelUrl.protocol}//${tunnelUrl.hostname}`;
const shopifyTunnelValue = `${publicOrigin}:${tunnelPort}`;
const extraArgs = process.argv.slice(2);

if (extraArgs.some((arg) => arg === "--tunnel-url" || arg.startsWith("--tunnel-url="))) {
  console.error(
    "Do not pass --tunnel-url to dev:tunnel; set SHOPIFY_DEV_TUNNEL_URL instead.",
  );
  process.exit(1);
}

console.info(`Starting Shopify development with stable tunnel ${publicOrigin}`);
console.info(
  `Google Ads callback: ${publicOrigin}/auth/google-ads/callback`,
);

const shopifyExecutable = process.platform === "win32" ? "shopify.cmd" : "shopify";
const child = spawn(
  shopifyExecutable,
  ["app", "dev", `--tunnel-url=${shopifyTunnelValue}`, ...extraArgs],
  {
    env: {
      ...process.env,
      SHOPIFY_DEV_TUNNEL_URL: publicOrigin,
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Unable to start Shopify CLI: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
