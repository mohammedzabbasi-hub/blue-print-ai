export function getConnectionsNotice({ actionSuccess, googleAdsConnection, query }) {
  if (query.get("connected")) {
    return `${platformLabel(query.get("connected"))} authorized. Select an accessible account to finish setup.`;
  }

  if (query.has("synced")) {
    const syncedRows = Number(query.get("synced")) || 0;
    return syncedRows === 0 && Boolean(googleAdsConnection)
      ? "Sync completed. No live Google Ads performance rows were found for this account."
      : `${syncedRows} daily performance rows synced.`;
  }

  if (query.get("disconnected")) {
    return `${platformLabel(query.get("disconnected"))} disconnected.`;
  }

  return actionSuccess;
}

function platformLabel(platform) {
  return {
    google: "Google Ads",
    meta: "Meta Ads",
    tiktok: "TikTok Ads",
  }[platform] || "Ad platform";
}
