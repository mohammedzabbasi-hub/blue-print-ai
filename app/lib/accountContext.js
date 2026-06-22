export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export const DEMO_EMAILS = new Set([
  "beauty@demo.com",
  "fitness@demo.com",
  "home@demo.com",
  "agency@demo.com",
]);

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function safeJsonParse(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getStorageItem(key) {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(key);
}

function setStorageItem(key, value) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, value);
}

export function getCurrentUser() {
  return safeJsonParse(getStorageItem("user"), {});
}

export function getSelectedShop() {
  return safeJsonParse(getStorageItem("selectedShop"), {});
}

export function getAuthHeaders(json = false) {
  const token =
    getStorageItem("token") ||
    getStorageItem("access_token") ||
    getStorageItem("authToken");

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getSelectedShopId() {
  const user = getCurrentUser();
  const shop = getSelectedShop();
  const userScopedShopId = user.id ? getStorageItem(`selectedShopId:${user.id}`) : null;

  return Number(
    userScopedShopId ||
      shop.id ||
      shop.shop_id ||
      getStorageItem("selectedShopId") ||
      getStorageItem("shop_id") ||
      getStorageItem("connected_shop_id") ||
      getStorageItem("demoShopId") ||
      user.shop_id ||
      user.shopId ||
      1
  );
}

export function isDemoAccount() {
  const user = getCurrentUser();
  const email = String(user.email || "").toLowerCase();

  return (
    user.is_demo === true ||
    user.isDemo === true ||
    user.account_type === "demo" ||
    DEMO_EMAILS.has(email) ||
    getStorageItem("isDemoAccount") === "true" ||
    getStorageItem("demoAccount") === "true"
  );
}

export function getAccountLabel() {
  const user = getCurrentUser();
  const shop = getSelectedShop();

  return {
    userName: user.name || "User",
    email: user.email || "",
    shopName:
      shop.shop_name ||
      shop.name ||
      user.shop_name ||
      getStorageItem("selectedShopName") ||
      getStorageItem("connected_shop_name") ||
      "My TikTok Shop",
    shopId: getSelectedShopId(),
    isDemo: isDemoAccount(),
  };
}

export function getStoredShopName() {
  const shop = getSelectedShop();

  return (
    shop.shop_name ||
    shop.name ||
    getStorageItem("selectedShopName") ||
    getStorageItem("connected_shop_name") ||
    getStorageItem("shop_name") ||
    "BlueprintAI Demo Shop"
  );
}

export function setSelectedShopId(shopId) {
  if (!shopId) return;

  setStorageItem("selectedShopId", String(shopId));
  setStorageItem("shop_id", String(shopId));
  setStorageItem("connected_shop_id", String(shopId));
}

export function setSelectedShop(shop) {
  const id = String(shop?.id || shop?.shop_id || shop?.shopId || "");
  if (!id) return;

  const normalizedShop = {
    ...shop,
    id: Number.isNaN(Number(id)) ? id : Number(id),
    shop_id: Number.isNaN(Number(id)) ? id : Number(id),
    shop_name: shop.shop_name || shop.name || "Selected Shop",
    name: shop.name || shop.shop_name || "Selected Shop",
  };

  setStorageItem("selectedShop", JSON.stringify(normalizedShop));
  setStorageItem("selectedShopId", id);
  setStorageItem("shop_id", id);
  setStorageItem("connected_shop_id", id);
  setStorageItem("selectedShopName", normalizedShop.shop_name);
  setStorageItem("connected_shop_name", normalizedShop.shop_name);
  setStorageItem("connected_shop_category", shop.category || "");
  setStorageItem("connected_shop_region", shop.region || "");
  setStorageItem("connected_shop_currency", shop.currency || "USD");

  const user = getCurrentUser();
  if (user.id) {
    setStorageItem(`selectedShopId:${user.id}`, id);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("blueprintai:shop-changed", {
        detail: { shopId: id, shop: normalizedShop },
      })
    );
  }
}
