import { redirect } from "react-router";
import { withEmbeddedRouteParams } from "./embedded-routing.js";

function safeReturnTo(value) {
  const candidate = String(value || "/app/connections").trim();
  if (!candidate || candidate.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    return "/app/connections";
  }

  try {
    const url = new URL(candidate, "https://blueprintai.local");
    return url.origin === "https://blueprintai.local" && url.pathname.startsWith("/app/")
      ? `${url.pathname}${url.search}${url.hash}`
      : "/app/connections";
  } catch {
    return "/app/connections";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function connectionsRedirect(stateData = {}, params = {}) {
  const returnTo = safeReturnTo(stateData.returnTo);
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return withEmbeddedRouteParams(
    `${returnTo}${query.size ? `?${query}` : ""}`,
    stateData.returnSearch,
  );
}

export function recoveryResponse(stateData, params, clearCookieHeader, status = 200) {
  const target = connectionsRedirect(stateData, params);
  const message = params.googleAds === "connected"
    ? "Google Ads connected."
    : params.error || "Google Ads connection needs attention.";

  console.info("Google Ads OAuth callback recovery", {
    finalRedirectPath: target,
    hostPresent: Boolean(stateData?.host),
    shop: stateData?.shop,
  });

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Return to Connections | BluePrintAI</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #080d17; color: #e2e8f0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; background: #0b1220; padding: 24px; }
      h1 { margin: 0 0 8px; color: #fff; font-size: 22px; }
      p { margin: 0 0 18px; line-height: 1.5; color: #cbd5e1; }
      a { display: inline-flex; border-radius: 12px; background: #22d3ee; color: #082f49; font-weight: 800; padding: 10px 14px; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(message)}</h1>
      <p>Return to BluePrintAI Connections to continue setup inside Shopify Admin.</p>
      <a href="${escapeHtml(target)}" target="_top" rel="noreferrer">Return to Connections</a>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...(clearCookieHeader ? { "Set-Cookie": clearCookieHeader } : {}),
      },
      status,
    },
  );
}

export function redirectOrRecover(stateData, params, clearCookieHeader, status) {
  const target = connectionsRedirect(stateData, params);
  console.info("Google Ads OAuth callback redirect", {
    finalRedirectPath: target,
    hostPresent: Boolean(stateData?.host),
    shop: stateData?.shop,
  });

  if (!stateData?.host) {
    return recoveryResponse(stateData, params, clearCookieHeader, status);
  }

  return redirect(target, {
    headers: clearCookieHeader ? { "Set-Cookie": clearCookieHeader } : undefined,
  });
}
