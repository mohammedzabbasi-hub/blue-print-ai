const EMBEDDED_ROUTE_PARAMS = [
  "embedded",
  "host",
  "id_token",
  "locale",
  "shop",
];

export function getEmbeddedRouteSearch(currentSearch = "") {
  const sourceParams = new URLSearchParams(currentSearch);
  const embeddedParams = new URLSearchParams();

  EMBEDDED_ROUTE_PARAMS.forEach((param) => {
    const value = sourceParams.get(param);
    if (value) embeddedParams.set(param, value);
  });

  const search = embeddedParams.toString();
  return search ? `?${search}` : "";
}

export function withEmbeddedRouteParams(to, currentSearch = "") {
  const url = new URL(to, "https://blueprintai.local");
  const embeddedParams = new URLSearchParams(
    getEmbeddedRouteSearch(currentSearch),
  );

  embeddedParams.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function getEmbeddedRouteSearchFromRequest(request) {
  const url = new URL(request.url);
  const currentSearch = getEmbeddedRouteSearch(url.search);

  if (currentSearch) return currentSearch;

  const referrer = request.headers.get("referer");
  if (!referrer) return "";

  try {
    const referrerUrl = new URL(referrer);

    if (referrerUrl.origin !== url.origin) return "";

    return getEmbeddedRouteSearch(referrerUrl.search);
  } catch {
    return "";
  }
}
