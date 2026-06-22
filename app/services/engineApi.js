import { API_BASE, getAuthHeaders, getSelectedShopId } from "../lib/accountContext";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.detail || `Request failed: ${res.status}`);
  }

  return data;
}

export async function getEngineAnalysis(shopId = getSelectedShopId()) {
  const data = await request(`/analytics/dashboard?shop_id=${encodeURIComponent(shopId)}`);

  return {
    ...data,
    shop_id: data?.shop?.id || shopId,
    shop_name: data?.shop?.shop_name || data?.shop?.name || "BluePrintAI",
    scored_creatives: data?.leaderboard || [],
    recommendations: data?.recommendations || [],
    next_actions: data?.next_actions || data?.recommendations || [],
    strategy: data?.strategy || {
      recommendations: data?.recommendations || data?.next_actions || [],
    },
  };
}

export async function getEngineRecommendations(shopId = getSelectedShopId()) {
  return request(`/recommendations?shop_id=${encodeURIComponent(shopId)}`);
}

export async function getEngineBriefs(shopId = getSelectedShopId(), productName = "") {
  const productQuery = productName ? `&product_name=${encodeURIComponent(productName)}` : "";
  return request(`/briefs?shop_id=${encodeURIComponent(shopId)}${productQuery}`);
}

export async function getGeminiStrategy(shopId = getSelectedShopId(), productName = "") {
  const productQuery = productName ? `&product_name=${encodeURIComponent(productName)}` : "";
  return request(`/analytics/dashboard?shop_id=${encodeURIComponent(shopId)}${productQuery}`);
}
