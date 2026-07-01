const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getLocalDemoAccess(request, env = process.env) {
  const url = new URL(request.url);
  const production = env.NODE_ENV === "production";
  const localHost = LOCAL_HOSTS.has(url.hostname);
  const hasEmbeddedParams = url.searchParams.has("shop") || url.searchParams.has("host");
  const explicitDemoMode = !production && localHost && url.searchParams.get("demo") === "1";
  const environmentBypass =
    !production && localHost && env.DEV_BYPASS_SHOPIFY_AUTH === "true";

  return {
    explicitDemoMode,
    useDemoWorkspace:
      !production &&
      localHost &&
      (!hasEmbeddedParams || explicitDemoMode || environmentBypass),
  };
}
