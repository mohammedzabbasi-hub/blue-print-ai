import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
} from "../lib/accountContext";

const ACTIVITY_LOG_KEY = "blueprintai_activity_log";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse(value, fallback) {
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

function removeStorageItem(key) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}

function getStoredUser() {
  const possibleUserKeys = [
    "user",
    "currentUser",
    "demoUser",
    "authUser",
    "blueprint_user",
    "selectedUser",
  ];

  for (const key of possibleUserKeys) {
    const parsed = safeJsonParse(getStorageItem(key), null);
    if (parsed && (parsed.email || parsed.user_email)) return parsed;
  }

  return {};
}

function getActivityContext() {
  const user = getStoredUser();
  const shopId = getSelectedShopId();

  return {
    user_email:
      user.email ||
      user.user_email ||
      user.username ||
      getStorageItem("email") ||
      "unknown@demo.com",
    user_name:
      user.name ||
      user.user_name ||
      user.teamName ||
      user.team_name ||
      user.displayName ||
      "Demo User",
    shop_id: shopId,
  };
}

function getLocalActivityLog() {
  if (!canUseStorage()) return [];

  const parsed = safeJsonParse(getStorageItem(ACTIVITY_LOG_KEY), []);
  if (!Array.isArray(parsed)) return [];

  return parsed.sort((a, b) => {
    const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
    const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
    return bTime - aTime;
  });
}

function storeLocalActivity(activity = {}) {
  if (!canUseStorage()) return null;

  const entry = {
    id: activity.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: activity.type || activity.activity_type || "activity",
    activity_type: activity.activity_type || activity.type || "activity",
    title: activity.title || "Workspace activity",
    description: activity.description || "",
    metadata: activity.metadata || {},
    createdAt: activity.createdAt || new Date().toISOString(),
    timestamp: activity.timestamp || new Date().toISOString(),
  };

  const nextLog = [entry, ...getLocalActivityLog()].slice(0, 100);
  setStorageItem(ACTIVITY_LOG_KEY, JSON.stringify(nextLog));

  return entry;
}

export async function createActivityLog(activity) {
  const context = getActivityContext();

  const payload = {
    user_email: activity.user_email || context.user_email,
    user_name: activity.user_name || context.user_name,
    shop_id: activity.shop_id || context.shop_id,
    activity_type: activity.activity_type || activity.type || "general",
    title: activity.title || "Activity",
    description: activity.description || "",
    metadata: activity.metadata || {},
  };

  try {
    const res = await fetch(`${API_BASE}/activity-log/`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });

    if (res.ok) return res.json();
  } catch {
    // Keep the UI usable when the external model API is unavailable in Shopify dev.
  }

  return storeLocalActivity(payload);
}

export async function getActivityLogs(options = {}) {
  const context = getActivityContext();
  const params = new URLSearchParams();

  params.set("user_email", options.user_email || context.user_email);
  params.set("shop_id", options.shop_id || context.shop_id);

  if (options.activity_type && options.activity_type !== "all") {
    params.set("activity_type", options.activity_type);
  }

  try {
    const res = await fetch(`${API_BASE}/activity-log/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return res.json();
  } catch {
    // Fall back to local activity below.
  }

  return getLocalActivityLog();
}

export async function clearActivityLogs(options = {}) {
  const context = getActivityContext();
  const params = new URLSearchParams();

  params.set("user_email", options.user_email || context.user_email);
  params.set("shop_id", options.shop_id || context.shop_id);

  try {
    const res = await fetch(`${API_BASE}/activity-log/?${params.toString()}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) return res.json();
  } catch {
    // Clear local activity below.
  }

  removeStorageItem(ACTIVITY_LOG_KEY);
  return { ok: true };
}

export async function logActivity(activity, title, description, metadata) {
  if (typeof activity === "object" && activity !== null) {
    return createActivityLog(activity);
  }

  return createActivityLog({
    activity_type: activity,
    type: activity,
    title,
    description,
    metadata,
  });
}

export async function getActivityLog(options = {}) {
  return getActivityLogs(options);
}

export async function clearActivityLog(options = {}) {
  return clearActivityLogs(options);
}

export function removeActivityLogItem(id) {
  if (!canUseStorage()) return;

  const nextLog = getLocalActivityLog().filter((item) => item.id !== id);
  setStorageItem(ACTIVITY_LOG_KEY, JSON.stringify(nextLog));
}
