import assert from "node:assert/strict";
import test from "node:test";

import {
  completeAssistantChat,
  getLlamaConfig,
} from "./llm.server.js";

test("Llama provider uses server-side env vars and OpenAI-compatible chat endpoint", async () => {
  let request;
  const result = await completeAssistantChat(
    { messages: [{ role: "user", content: "hello" }] },
    {
      env: {
        LLM_PROVIDER: "llama",
        LLAMA_API_BASE_URL: "https://llama.example/v1/",
        LLAMA_API_KEY: "secret-llama-key",
        LLAMA_MODEL: "llama-test",
      },
      fetchImpl: async (url, options) => {
        request = { body: JSON.parse(options.body), headers: options.headers, method: options.method, url };
        return Response.json({ choices: [{ message: { content: "Use CSV import first." } }] });
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.content, "Use CSV import first.");
  assert.equal(request.url, "https://llama.example/v1/chat/completions");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer secret-llama-key");
  assert.equal(request.body.model, "llama-test");
  assert.equal(request.body.temperature, 0.3);
  assert.equal(request.body.max_tokens, 700);
});

test("missing Llama key falls back without exposing raw key errors", async () => {
  const result = await completeAssistantChat(
    { messages: [{ role: "user", content: "hello" }] },
    {
      env: {
        LLM_PROVIDER: "llama",
        LLAMA_API_BASE_URL: "https://llama.example/v1",
        LLAMA_MODEL: "llama-test",
      },
      fetchImpl: async () => {
        throw new Error("fetch should not be called without a key");
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_configured");
  assert.doesNotMatch(result.message, /key|secret|LLAMA_API_KEY/i);
});

test("Llama API failure returns a safe fallback response", async () => {
  const result = await completeAssistantChat(
    { messages: [{ role: "user", content: "hello" }] },
    {
      env: {
        LLM_PROVIDER: "llama",
        LLAMA_API_BASE_URL: "https://llama.example/v1",
        LLAMA_API_KEY: "secret-llama-key",
        LLAMA_MODEL: "llama-test",
      },
      fetchImpl: async () => Response.json({ error: { message: "bad" } }, { status: 500 }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_error");
  assert.doesNotMatch(result.message, /500|bad|secret|LLAMA_API_KEY/i);
});

test("Llama env aliases remain supported", () => {
  const config = getLlamaConfig({
    LLM_PROVIDER: "llama",
    LLAMA_API_TOKEN: "token",
    LLAMA_API_URL: "https://llama.example/v1",
    LLAMA_MODEL: "alias-model",
  });

  assert.equal(config.available, true);
  assert.equal(config.baseUrl, "https://llama.example/v1");
  assert.equal(config.model, "alias-model");
});
