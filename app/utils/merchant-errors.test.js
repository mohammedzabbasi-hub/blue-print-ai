import assert from "node:assert/strict";
import test from "node:test";

import {
  googleAdsMerchantError,
  merchantErrorMessage,
} from "./merchant-errors.js";

test("merchant errors keep actionable validation and hide technical details", () => {
  assert.equal(
    merchantErrorMessage("Choose a creative record to delete.", "Try again."),
    "Choose a creative record to delete.",
  );
  assert.equal(
    merchantErrorMessage("Environment variable DATABASE_URL is missing.", "Try again."),
    "Try again.",
  );
  assert.equal(
    merchantErrorMessage("Prisma failed at /private/tmp/app.js", "Try again."),
    "Try again.",
  );
});

test("Google Ads errors translate provider and configuration failures", () => {
  assert.equal(
    googleAdsMerchantError("GOOGLE_ADS_DEVELOPER_TOKEN is missing"),
    "Google Ads is temporarily unavailable. Contact support if you need help connecting.",
  );
  assert.equal(
    googleAdsMerchantError("OAuth refresh token expired"),
    "Google Ads authorization expired or could not be refreshed. Reconnect the account and try again.",
  );
  assert.equal(
    googleAdsMerchantError("Select at least one campaign before syncing."),
    "Select at least one campaign before syncing.",
  );
});
