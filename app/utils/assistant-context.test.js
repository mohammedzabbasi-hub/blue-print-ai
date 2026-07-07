import assert from "node:assert/strict";
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

