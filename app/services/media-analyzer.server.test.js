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
      assert.equal(options.body.get("file").name, "review.mp4");
      assert.equal(options.body.get("file").type, "video/mp4");
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.deepEqual(result, { available: true, ...payload });
});

test("legacy backend result envelope is normalized", async () => {
  const result = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: true,
          filename: "review.mp4",
          result: {
            analysis: { hook_score: 8 },
            transcript: { full_text: "Hello" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.deepEqual(result, {
    available: true,
    analysis: { hook_score: 8 },
    transcript: { full_text: "Hello" },
  });
});

test("non-2xx and malformed responses return safe failures without results", async () => {
  const failed = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () => new Response("down", { status: 503 }),
  });
  assert.deepEqual(failed, {
    available: false,
    reason: "service_error",
    message: "Video analysis could not be completed right now. Try again shortly.",
  });

  const malformed = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  });
  assert.equal(malformed.available, false);
  assert.equal(malformed.reason, "malformed_response");
  assert.equal("analysis" in malformed, false);
});

test("network failures return no analysis", async () => {
  const result = await analyzeUploadedVideoFile(videoFile(), {
    env: configuredEnv,
    fetchImpl: async () => {
      throw new TypeError("connection refused");
    },
  });

  assert.deepEqual(result, {
    available: false,
    reason: "network_error",
    message: "Video analysis is temporarily unavailable. Try again shortly.",
  });
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
  assert.equal(
    result.message,
    "Video analysis took too long. Try a shorter video or retry later.",
  );
  assert.equal("analysis" in result, false);
});

test("runtime details remain server-side in the Review Studio loader", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../routes/app.video-analysis.jsx", import.meta.url), "utf8"),
  );

  assert.match(source, /analyzerRuntime: \{ configured: getAnalyzerRuntimeStatus\(\)\.configured \}/);
  assert.doesNotMatch(source, /analyzerRuntime: getAnalyzerRuntimeStatus\(\)/);
  assert.doesNotMatch(source, /Needs production analyzer service configured/);
  assert.doesNotMatch(source, /Upload saved, analysis unavailable/);
  assert.match(source, /deletePrivateMediaObjects/);
});
