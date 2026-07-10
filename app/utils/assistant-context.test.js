import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAssistantContext } from "./assistant-context.js";

test("returns route-aware prompts for primary app pages and nested routes", () => {
  assert.equal(getAssistantContext("/app/connections").prompts[0], "Why is Google Ads showing no data?");
  assert.equal(getAssistantContext("/app/campaigns/123").prompts[0], "What is a local campaign?");
  assert.equal(getAssistantContext("/app/video-analysis").prompts[2], "What can I upload?");
});

test("returns safe general prompts for unmatched authenticated routes", () => {
  assert.equal(getAssistantContext("/app/activity-log").prompts[0], "What should I do next?");
});

test("assistant client code does not reference Llama secrets", async () => {
  const source = await readFile(new URL("../components/AssistantWidget.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /LLAMA_API_KEY|LLAMA_API_TOKEN|LLM_API_KEY|process\.env/);
  assert.match(source, /pathname: location\.pathname/);
});

test("assistant client binds responses to the latest request and only labels real evidence as shop context", async () => {
  const source = await readFile(new URL("../components/AssistantWidget.jsx", import.meta.url), "utf8");

  assert.match(source, /clientRequestId/);
  assert.match(source, /fetcher\.data\.clientRequestId !== activeRequestId\.current/);
  assert.match(source, /meta\?\.usingShopContext/);
  assert.match(source, /disabled=\{pending\}/);
  assert.doesNotMatch(source, /contextLabel = fetcher\.data\?\.meta\?\.contextLabel \|\| "Using shop context"/);
});
