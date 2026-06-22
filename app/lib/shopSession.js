import {
  getCurrentUser as getAccountUser,
  getSelectedShopId as getAccountSelectedShopId,
  getStoredShopName as getAccountStoredShopName,
  setSelectedShop as setAccountSelectedShop,
} from "./accountContext";

export const SHOP_STORAGE_KEY = "selectedShopId";

export function getCurrentUser() {
  return getAccountUser();
}

export function getSelectedShopId() {
  return String(getAccountSelectedShopId() || 1);
}

export function setSelectedShop(shop) {
  setAccountSelectedShop(shop);
}

export function getStoredShopName() {
  return getAccountStoredShopName();
}
