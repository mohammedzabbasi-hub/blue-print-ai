import assert from "node:assert/strict";
import test from "node:test";

import { analyzeUploadedVideoFile, getAnalyzerRuntimeStatus } from "./media-analyzer.server.js";

const configuredEnv = {
  ANALYZER_ENABLED: "true",
  ANALYZER_SERVICE_URL: "https://analyzer.example.test/analyze",
  ANALYZER_API_KEY: "test-key",
  ANALYZER_TIMEOUT_MS: "50",
};

function videoFile() {
  return new File([new TextEncoder().encode("video")], "review.mp4", { type: "video/mp4" });
}

test("disabled and missing analyzer configuration fail closed", () => {
  assert.equal(getAnalyzerRuntimeStatus({ ANALYZER_ENABLED: "false" }).reason, "disabled");
  assert.equal(getAnalyzerRuntimeStatus({ ANALYZER_ENABLED: "true" }).reason, "missing_config");
  assert.equal(
    getAnalyzerRuntimeStatus({ ...configuredEnv, ANALYZER_API_KEY: "" }).configured,
    false,
  );
  assert.equal(
    getAnalyzerRuntimeStatus({ ...configuredEnv, ANALYZER_SERVICE_URL: "" }).configured,
    false,
  );
});

test("disabled analyzer returns no analysis", async () => {
  const result = await analyzeUploadedVideoFile(videoFile(), {
    env: { ANALYZER_ENABLED: "false" },
  });
  assert.equal(result.available, false);
  assert.equal(result.reason, "disabled");
  assert.equal("analysis" in result, false);
});

test("successful analyzer output is preserved", async () => {
  const payload = { analysis: { hook_score: 9 }, metadata: { duration_seconds: 12 } };
  const result = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer test-key");
      assert.ok(options.body instanceof FormData);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.deepEqual(result, { available: true, ...payload });
});

test("non-2xx and malformed responses return safe failures without results", async () => {
  const failed = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () => new Response("down", { status: 503 }),
  });
  assert.deepEqual(failed, {
    available: false,
    reason: "service_error",
    message: "Analyzer service returned HTTP 503.",
  });

  const malformed = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  });
  assert.equal(malformed.available, false);
  assert.equal(malformed.reason, "malformed_response");
  assert.equal("analysis" in malformed, false);
});

test("timeout aborts the analyzer request and returns no results", async () => {
  const result = await analyzeUploadedVideoFile(videoFile(), {
    env: { ...configuredEnv, ANALYZER_TIMEOUT_MS: "5" },
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  });
  assert.equal(result.available, false);
  assert.equal(result.reason, "timeout");
  assert.equal("analysis" in result, false);
});
