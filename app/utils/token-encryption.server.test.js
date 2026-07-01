import assert from "node:assert/strict";
import test from "node:test";

import { decryptToken, encryptToken } from "./token-encryption.server.js";

test("platform tokens round-trip through authenticated encryption", () => {
  const previous = process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY;
  process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY = "11".repeat(32);
  try {
    const encrypted = encryptToken("refresh-token-value");
    assert.notEqual(encrypted, "refresh-token-value");
    assert.equal(decryptToken(encrypted), "refresh-token-value");
  } finally {
    if (previous === undefined) delete process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY;
    else process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("token storage refuses a missing encryption key", () => {
  const previous = process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY;
  delete process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptToken("refresh-token-value"), /is required/);
  } finally {
    if (previous !== undefined) process.env.AD_PLATFORM_TOKEN_ENCRYPTION_KEY = previous;
  }
});
