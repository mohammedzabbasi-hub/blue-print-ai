const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopDomain(value) {
  const shop = String(value || "").trim().toLowerCase();
  return SHOP_DOMAIN_PATTERN.test(shop) ? shop : null;
}

export async function hasInstalledShopifySession(sessionStore, shop) {
  const sessions = await sessionStore.findSessionsByShop(shop);

  return sessions.some(
    (session) =>
      session.shop === shop &&
      !session.isOnline &&
      Boolean(session.accessToken || session.refreshToken),
  );
}
