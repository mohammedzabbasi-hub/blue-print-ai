import assert from "node:assert/strict";
import test from "node:test";

import { getConnectionsNotice } from "./connections-notice.js";

test("zero-row Google Ads sync explains that the connected account has no live data", () => {
  const notice = getConnectionsNotice({
    googleAdsConnection: { platform: "google", status: "connected" },
    query: new URLSearchParams("synced=0"),
  });

  assert.equal(
    notice,
    "Sync completed. No live Google Ads performance rows were found for this account.",
  );
});

test("positive Google Ads sync row messages remain unchanged", () => {
  const notice = getConnectionsNotice({
    googleAdsConnection: { platform: "google", status: "connected" },
    query: new URLSearchParams("synced=12"),
  });

  assert.equal(notice, "12 daily performance rows synced.");
});
